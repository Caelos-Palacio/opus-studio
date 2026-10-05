#!/usr/bin/env node
// Gates ejecutables. Un gate = lista de "criterio::comando" (gates.json). Se cierra SOLO si todos los comandos salen con 0;
// `--force "razón"` lo cierra igualmente y la razón queda en el ledger. Estado en out/gates.json; snapshot git al cerrar.
//   node engine/gate.mjs list | status
//   node engine/gate.mjs close <gate> [--force "razón"]
//   node engine/gate.mjs verify                  → exit 0 si el lint global es SHIP vigente y el crítico no tiene FIX vigente
//   node engine/gate.mjs restore <gate> [n]      → restaura el árbol de trabajo al snapshot opus/gate/<gate>/<n> (último por defecto)
// Snapshot = commit huérfano de HEAD con el árbol ACTUAL (índice temporal: no toca HEAD, índice ni rama) + tag opus/gate/<gate>/<n>.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, record, who } from './ledger.mjs';
import { withLockSync, writeAtomic } from './lock.mjs';
import { currentHashes, isFresh, lintState, readJSON, stamp, filmKey } from './verdict.mjs';

export const GATES_DEF = path.join(ROOT, 'gates.json'), GATES_OUT = path.join(ROOT, 'out/gates.json');
export const parseCriteria = (list) => (list ?? []).map((c) => { const i = String(c).indexOf('::'); if (i < 1) throw new Error(`criterio sin "::comando": ${c}`); return { criterion: c.slice(0, i).trim(), cmd: c.slice(i + 2).trim() }; });
export const gateDefs = () => { const d = readJSON(GATES_DEF) ?? {}; return Object.fromEntries(Object.entries(d).filter(([k, v]) => !k.startsWith('_') && Array.isArray(v))); };
export const gateState = () => readJSON(GATES_OUT) ?? {};

// ── crítico: FIX vigente = (a) out/critic.json {verdict,...sello} vigente, o (b) caché del crítico con FIX para el hash ACTUAL del shot.
export async function criticState({ film, plan } = {}, cur = currentHashes()) {
  const v = readJSON(path.join(ROOT, 'out/critic.json'));
  if (v && isFresh(v, cur) && v.verdict === 'FIX') return { verdict: 'FIX', why: 'out/critic.json en FIX' };
  const cf = path.join(ROOT, 'out/review', filmKey().replace(/\.edit$/, ''), 'critic.json'), cache = readJSON(cf);
  if (!cache) return { verdict: v && isFresh(v, cur) ? v.verdict : null, why: v ? 'crítico sin FIX' : 'sin veredicto de crítico' };
  if (!film || !plan) { const F = await import('./film.mjs'), C = await import('./cut.mjs'); film = await F.loadFilm({ animatic: true }); plan = C.plan; }
  const P = plan(film, { fps: film.fps, size: `${film.width}x${film.height}` }), hashOf = (id) => P.jobs.filter((j) => j.shots.includes(id)).map((j) => j.hash).join('.');
  const bad = Object.entries(cache).filter(([id, e]) => id !== '_film' && e?.hash === hashOf(id) && (e.result?.issues ?? []).some((i) => i.severity === 'FIX')).map(([id]) => id);
  const key = film.shots.map((s) => hashOf(s.id)).join('|'), fb = cache._film?.hash === key && (cache._film.result?.issues ?? []).some((i) => i.severity === 'FIX');
  if (bad.length || fb) return { verdict: 'FIX', why: `crítico con FIX vigente en ${[...bad, ...(fb ? ['coherencia'] : [])].join(', ')}` };
  return { verdict: 'SHIP', why: 'crítico sin FIX vigente' };
}
// Condición del master: SHIP vigente + crítico sin FIX. Con force="razón" pasa, y queda en el ledger.
export async function masterGate({ film, plan, force } = {}) {
  const cur = currentHashes(), L = lintState(cur), C = await criticState({ film, plan }, cur), reasons = [];
  if (!(L.fresh && L.verdict === 'SHIP')) reasons.push(`lint: ${L.why}`);
  if (C.verdict === 'FIX') reasons.push(`crítico: ${C.why}`);
  if (reasons.length && force === true) return { ok: false, reasons: [...reasons, '--force exige una razón: --force "por qué"'] };
  if (reasons.length && typeof force === 'string' && force.trim()) { record({ action: 'master.force', target: `master/${cur.film}`, hash_after: cur.filmHash, verdict: 'forced', why: force }); return { ok: true, forced: true, reasons }; }
  return { ok: !reasons.length, reasons };
}

// ── git snapshots
const git = (args, opt = {}) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opt });
export function gitRoot() {
  const r = git(['rev-parse', '--show-toplevel']); if (r.status) return null;
  try { return fs.realpathSync(r.stdout.trim()) === fs.realpathSync(ROOT) ? ROOT : null; } catch { return null; }
}
const EXCL = [':(exclude)node_modules', ':(exclude)out', ':(exclude).trash'];
export const gateTags = (name) => { const r = git(['tag', '-l', `opus/gate/${name}/*`]); return r.status ? [] : r.stdout.split('\n').filter(Boolean).sort((a, b) => +a.split('/').pop() - +b.split('/').pop()); };
export function snapshot(tag, msg) {
  if (!gitRoot()) return null;
  const idx = path.join(os.tmpdir(), `opus-idx-${process.pid}-${Date.now()}`), env = { ...process.env, GIT_INDEX_FILE: idx };
  try {
    const head = git(['rev-parse', '-q', '--verify', 'HEAD']).stdout.trim();
    if (head) git(['read-tree', head], { env });
    if (git(['add', '-A'], { env }).status) return null;                   // respeta .gitignore (out/, .trash/, node_modules)
    const tree = git(['write-tree'], { env }).stdout.trim(); if (!tree) return null;
    const id = git(['config', 'user.name']).stdout.trim() ? [] : ['-c', 'user.name=opus-gate', '-c', 'user.email=opus-gate@localhost'];
    const c = git([...id, 'commit-tree', tree, ...(head ? ['-p', head] : []), '-m', msg]); if (c.status) return null;
    if (git(['tag', tag, c.stdout.trim()]).status) return null;
    return { tag, commit: c.stdout.trim().slice(0, 12) };
  } finally { fs.rmSync(idx, { force: true }); }
}
export function restore(name, n) {
  if (!gitRoot()) throw new Error('restore: no hay repo git en la raíz del proyecto');
  const tags = gateTags(name), tag = n ? `opus/gate/${name}/${n}` : tags[tags.length - 1];
  if (!tag || !tags.includes(tag)) throw new Error(`restore: no existe snapshot para el gate "${name}"${n ? ' #' + n : ''}`);
  const backup = snapshot(`opus/backup/${Date.now()}`, `opus backup antes de restaurar ${tag}`);   // lo actual nunca se pierde
  const r = git(['restore', `--source=${tag}`, '--worktree', '--', '.', ...EXCL]); if (r.status) throw new Error('git restore: ' + r.stderr.trim());
  record({ action: 'gate.restore', target: tag, hash_after: git(['rev-parse', tag]).stdout.trim().slice(0, 16), verdict: 'restored', why: backup ? `backup en ${backup.tag}` : 'sin backup' });
  return { tag, backup };
}

// ── cerrar un gate
export function closeGate(name, { force = null, quiet = false } = {}) {
  const defs = gateDefs(); if (!defs[name]) throw new Error(`gate "${name}" no definido en gates.json (${Object.keys(defs).join(', ')})`);
  const crit = parseCriteria(defs[name]), results = [];
  for (const c of crit) {
    const r = spawnSync(c.cmd, { cwd: ROOT, shell: true, encoding: 'utf8', env: process.env, maxBuffer: 64 << 20 });
    results.push({ ...c, exit: r.status ?? -1 });
    if (!quiet) console.log(`  ${r.status === 0 ? '✓' : '✗'} ${c.criterion}  (${c.cmd} → exit ${r.status})${r.status ? '\n     ' + String(r.stdout + r.stderr).trim().split('\n').slice(-4).join('\n     ') : ''}`);
  }
  const passed = results.every((r) => r.exit === 0), cur = currentHashes();
  if (!passed && force === true) throw new Error('--force exige una razón: --force "por qué"');
  const status = passed ? 'closed' : force ? 'forced' : 'open';
  return withLockSync('gates', () => {
    const S = gateState(), prev = S[name] ?? {}, fails = status === 'open' ? (prev.status === 'open' ? prev.fails ?? 0 : 0) + 1 : 0;
    let snap = null;
    if (status !== 'open') snap = snapshot(`opus/gate/${name}/${gateTags(name).length + 1}`, `opus gate ${name}: ${status}${force ? ' — ' + force : ''}`);
    S[name] = { status, ts: new Date().toISOString(), ...who(), criteria: results, ...stamp(cur), fails, snapshot: snap?.tag ?? null, ...(force && !passed ? { why: String(force).slice(0, 140) } : {}) };
    writeAtomic(GATES_OUT, JSON.stringify(S, null, 1));
    record({ action: force && !passed ? 'gate.force' : 'gate.close', target: `gate/${name}`, hash_after: cur.filmHash, verdict: status, why: force && !passed ? force : `${results.filter((r) => r.exit === 0).length}/${results.length} criterios` });
    return S[name];
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2), [cmd, name, n] = argv, fi = argv.indexOf('--force'), force = fi >= 0 ? (argv[fi + 1] && !argv[fi + 1].startsWith('--') ? argv[fi + 1] : true) : null;
  try {
    if (cmd === 'list') for (const [k, v] of Object.entries(gateDefs())) console.log(`${k}\n${parseCriteria(v).map((c) => `  · ${c.criterion}  ::  ${c.cmd}`).join('\n')}`);
    else if (cmd === 'status') { const S = gateState(), cur = currentHashes(); for (const k of Object.keys(gateDefs())) { const s = S[k]; console.log(`${k.padEnd(10)} ${s ? `${s.status.padEnd(7)} ${isFresh(s, cur) ? 'vigente ' : 'caducado'} ${s.ts} ${s.agent}${s.snapshot ? ' · ' + s.snapshot : ''}${s.fails ? ` · ${s.fails} fallos seguidos` : ''}` : '—'}`); } }
    else if (cmd === 'verify') { const g = await masterGate({}); console.log(g.ok ? 'OK  SHIP vigente, crítico sin FIX' : 'NO  ' + g.reasons.join(' · ')); process.exit(g.ok ? 0 : 1); }
    else if (cmd === 'close') {
      const s = closeGate(name, { force });
      console.log(`\n${s.status === 'open' ? 'ABIERTO' : s.status === 'forced' ? 'FORZADO' : 'CERRADO'}  gate ${name}${s.snapshot ? ` · snapshot ${s.snapshot}` : ''}${s.fails >= 2 ? `\n${s.fails} fallos seguidos: detente y reporta al Director (no reintentes a ciegas).` : ''}`);
      process.exit(s.status === 'open' ? 1 : 0);
    } else if (cmd === 'restore') { const r = restore(name, n); console.log(`✓ restaurado ${r.tag}${r.backup ? ` (estado previo en ${r.backup.tag})` : ''}`); }
    else console.log('Uso: node engine/gate.mjs list | status | verify | close <gate> [--force "razón"] | restore <gate> [n]');
  } catch (e) { console.error('✗ ' + e.message); process.exit(2); }
}
