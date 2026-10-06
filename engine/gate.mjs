#!/usr/bin/env node
// Gates ejecutables. Un gate = lista de "criterio::comando" (gates.json; comando = ID de data/commands.json o argv, sin shell). Cierre TRANSACCIONAL (digest → criterios → freeze → verificación → commit). Se cierra SOLO si todos los comandos salen con 0;
// `--force "razón"` lo cierra igualmente y la razón queda en el ledger. Estado en out/gates.json; snapshot git al cerrar.
//   node engine/gate.mjs list | status
//   node engine/gate.mjs close <gate> [--force "razón"]
//   node engine/gate.mjs verify                  → exit 0 si el lint global es SHIP vigente y el crítico no tiene FIX vigente
//   node engine/gate.mjs restore <gate> [n]      → restaura el árbol de trabajo al snapshot opus/gate/<gate>/<n> (último por defecto)
// Snapshot = commit huérfano de HEAD con el árbol ACTUAL (índice temporal: no toca HEAD, índice ni rama) + tag opus/gate/<gate>/<n>.
import { isMain } from './paths.mjs';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, record, who, digest } from './ledger.mjs';
import { withLockSync, writeAtomic } from './lock.mjs';
import { currentHashes, isFresh, lintState, readJSON, stamp, filmKey } from './verdict.mjs';
import { resolveCommand, spawnArgv, display } from './command.mjs';

export const GATES_DEF = path.join(ROOT, 'gates.json'), GATES_OUT = path.join(ROOT, 'out/gates.json');
// Criterio = "texto::comando" (comando = ID de data/commands.json + args, o argv literal permitido) | {criterion, cmd: ID|string} | {criterion, argv: [...]}.
// Sin shell: un comando no permitido NO se ejecuta; el criterio falla con `error`.
export const parseCriteria = (list) => (list ?? []).map((c) => {
  let criterion, spec;
  if (c && typeof c === 'object' && !Array.isArray(c)) { criterion = String(c.criterion ?? '').trim(); spec = c.argv ?? c.cmd; if (!criterion || spec == null) throw new Error(`criterio sin {criterion, argv|cmd}: ${JSON.stringify(c).slice(0, 80)}`); }
  else { const i = String(c).indexOf('::'); if (i < 1) throw new Error(`criterio sin "::comando": ${c}`); criterion = c.slice(0, i).trim(); spec = c.slice(i + 2).trim(); }
  const r = resolveCommand(spec);
  return { criterion, cmd: r.ok ? r.display : display(spec), argv: r.ok ? r.argv : null, error: r.ok ? null : r.why };
});
export const gateDefs = () => { const d = readJSON(GATES_DEF) ?? {}; return Object.fromEntries(Object.entries(d).filter(([k, v]) => !k.startsWith('_') && Array.isArray(v))); };
export const gateState = () => readJSON(GATES_OUT) ?? {};

// ── crítico: FIX vigente = (a) out/critic.json {verdict,...sello} vigente, o (b) caché del crítico con FIX para el hash ACTUAL del shot.
export async function criticState({ film, plan } = {}, cur = currentHashes()) {
  const v = readJSON(path.join(ROOT, 'out/critic.json'));
  if (v && isFresh(v, cur) && v.verdict === 'FIX') return { verdict: 'FIX', why: 'out/critic.json en FIX' };
  let vFresh = v && isFresh(v, cur) ? v.verdict : null;                          // veredicto sellado vigente (SHIP|FIX)
  const rd = path.join(ROOT, 'out/review', filmKey().replace(/\.edit$/, '')), cf = path.join(rd, 'critic.json'), cache = readJSON(cf);
  if (!vFresh) {                                                                  // verdict.json del crítico (critic.mjs): vigente si su plan = el plan de hoy
    const cv = readJSON(path.join(rd, 'verdict.json'));
    if (cv?.plan && ['SHIP', 'FIX'].includes(cv.verdict)) {
      if (!film || !plan) { const F = await import('./film.mjs'), C = await import('./cut.mjs'); film = await F.loadFilm({ animatic: true }); plan = C.plan; }
      const P0 = plan(film, { fps: film.fps, size: `${film.width}x${film.height}` }), h0 = (id) => P0.jobs.filter((j) => j.shots.includes(id)).map((j) => j.hash).join('.');
      const sha = crypto.createHash('sha256').update(JSON.stringify(film.shots.map((x) => [x.id, h0(x.id)]))).digest('hex').slice(0, 16);   // = planH de critic.mjs
      if (cv.plan === sha) { vFresh = cv.verdict; if (vFresh === 'FIX') return { verdict: 'FIX', why: 'verdict.json del crítico en FIX (plan vigente)' }; }
    }
  }
  if (!cache) return { verdict: vFresh, why: vFresh ? 'crítico sin FIX' : 'sin veredicto de crítico vigente' };
  if (!film || !plan) { const F = await import('./film.mjs'), C = await import('./cut.mjs'); film = await F.loadFilm({ animatic: true }); plan = C.plan; }
  const P = plan(film, { fps: film.fps, size: `${film.width}x${film.height}` }), hashOf = (id) => P.jobs.filter((j) => j.shots.includes(id)).map((j) => j.hash).join('.');
  const bad = Object.entries(cache).filter(([id, e]) => id !== '_film' && e?.hash === hashOf(id) && (e.result?.issues ?? []).some((i) => i.severity === 'FIX')).map(([id]) => id);
  const key = film.shots.map((s) => hashOf(s.id)).join('|'), fb = cache._film?.hash === key && (cache._film.result?.issues ?? []).some((i) => i.severity === 'FIX');
  if (bad.length || fb) return { verdict: 'FIX', why: `crítico con FIX vigente en ${[...bad, ...(fb ? ['coherencia'] : [])].join(', ')}` };
  const all = film.shots.every((s) => cache[s.id]?.hash === hashOf(s.id));          // SHIP solo si el crítico cubre TODOS los shots con su hash actual
  return vFresh || all ? { verdict: 'SHIP', why: 'crítico sin FIX vigente' } : { verdict: null, why: 'sin veredicto de crítico vigente (la caché no cubre todos los shots con su hash actual)' };
}
// Condición del master: SHIP vigente + crítico sin FIX. Con force="razón" pasa, y queda en el ledger.
export async function masterGate({ film, plan, force } = {}) {
  const cur = currentHashes(), L = lintState(cur), C = await criticState({ film, plan }, cur), reasons = [];
  if (!(L.fresh && L.verdict === 'SHIP')) reasons.push(`lint: ${L.why}`);
  try {                                                                              // spec 013: 0 FIX narrativos, solo si el story es v2 (los v1 no se bloquean)
    const [A, N, F] = await Promise.all([import('./arc.mjs'), import('./narr.mjs'), import('./film.mjs')]), sp = A.storyPath(film);
    if (sp) { const r = N.analyzeOne(sp, F.timelinePath()), nf = r.story.v === 2 ? r.issues.filter((i) => i.level === 'FIX') : []; if (nf.length) reasons.push(`narr: ${nf.length} FIX narrativos (${nf.map((i) => i.check).join(', ')})`); }
  } catch {}
  if (C.verdict !== 'SHIP') reasons.push(`crítico: ${C.why}`);                       // sin veredicto vigente tampoco hay master (o --force "razón")
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
// Commit huérfano con el árbol ACTUAL (sin tag): el candidato inmutable de un cierre. null si no hay git.
export function snapCommit(msg) {
  if (!gitRoot()) return null;
  const idx = path.join(os.tmpdir(), `opus-idx-${process.pid}-${Date.now()}`), env = { ...process.env, GIT_INDEX_FILE: idx };
  try {
    const head = git(['rev-parse', '-q', '--verify', 'HEAD']).stdout.trim();
    if (head) git(['read-tree', head], { env });
    if (git(['add', '-A'], { env }).status) return null;                   // respeta .gitignore (out/, .trash/, node_modules)
    const tree = git(['write-tree'], { env }).stdout.trim(); if (!tree) return null;
    const id = git(['config', 'user.name']).stdout.trim() ? [] : ['-c', 'user.name=opus-gate', '-c', 'user.email=opus-gate@localhost'];
    const c = git([...id, 'commit-tree', tree, ...(head ? ['-p', head] : []), '-m', msg]); if (c.status) return null;
    return c.stdout.trim();
  } finally { fs.rmSync(idx, { force: true }); }
}
export const tagCommit = (tag, commit) => (commit && !git(['tag', tag, commit]).status ? { tag, commit: commit.slice(0, 12) } : null);
export const snapshot = (tag, msg) => tagCommit(tag, snapCommit(msg));
export function restore(name, n) {
  if (!gitRoot()) throw new Error('restore: no hay repo git en la raíz del proyecto');
  const tags = gateTags(name), tag = n ? `opus/gate/${name}/${n}` : tags[tags.length - 1];
  if (!tag || !tags.includes(tag)) throw new Error(`restore: no existe snapshot para el gate "${name}"${n ? ' #' + n : ''}`);
  const backup = snapshot(`opus/backup/${Date.now()}`, `opus backup antes de restaurar ${tag}`);   // lo actual nunca se pierde
  const r = git(['restore', `--source=${tag}`, '--worktree', '--', '.', ...EXCL]); if (r.status) throw new Error('git restore: ' + r.stderr.trim());
  record({ action: 'gate.restore', target: tag, hash_after: git(['rev-parse', tag]).stdout.trim().slice(0, 16), verdict: 'restored', why: backup ? `backup en ${backup.tag}` : 'sin backup' });
  return { tag, backup };
}

export const treeDigest = (cur) => digest(`${cur.film}|${cur.engineHash}|${cur.filmHash}`);   // lo que un cierre PROBÓ

// ── cerrar un gate: TRANSACCIÓN
//   lock gate/<n> → candidato (digest de hashes + commit git sin tag) → criterios sobre ESA versión → freeze de contratos
//   → verificación (el árbol sigue = digest) → commit atómico del estado con el digest (+ tag). Cualquier fallo: NO se cierra,
//   se deshace el freeze y el motivo queda en el ledger. --force salta criterios, nunca la integridad (árbol cambiado / freeze).
export function closeGate(name, { force = null, quiet = false } = {}) {
  const defs = gateDefs(); if (!defs[name]) throw new Error(`gate "${name}" no definido en gates.json (${Object.keys(defs).join(', ')})`);
  const orch = readJSON(path.join(ROOT, 'orch.json')) ?? {}, budget = orch.gateBudget ?? 2, prev0 = gateState()[name];
  if (!force && prev0?.status === 'open' && (prev0.fails ?? 0) >= budget) {
    record({ action: 'gate.frozen', target: `gate/${name}`, verdict: 'frozen', why: `${prev0.fails} fallos seguidos ≥ presupuesto ${budget}` });
    throw new Error(`gate "${name}" congelado tras ${prev0.fails} fallos seguidos: escala al Director (node engine/orch.mjs unfreeze gate/${name} --why "…" o --force "razón")`);
  }
  return withLockSync(`gate/${name}`, () => transaction(name, defs[name], { force, quiet, orch }), { ttlMs: 3600000, waitMs: 2000 });
}
function transaction(name, def, { force, quiet, orch }) {
  const crit = parseCriteria(def), results = [], cand = currentHashes(), D0 = treeDigest(cand), contractsGate = name === (orch.contractsGate ?? 'animatic');
  const commit = snapCommit(`opus gate ${name}: candidato ${D0}`);                 // árbol candidato inmutable (sin tag hasta cerrar)
  for (const c of crit) {
    const r = c.argv ? spawnArgv(c.argv) : { status: null, stdout: '', stderr: '✗ ' + c.error };
    results.push({ criterion: c.criterion, cmd: c.cmd, exit: r.status ?? -1, ...(c.error ? { error: c.error } : {}) });
    if (!quiet) console.log(`  ${r.status === 0 ? '✓' : '✗'} ${c.criterion}  (${c.cmd} → exit ${r.status ?? -1})${r.status ? '\n     ' + String(r.stdout + r.stderr).trim().split('\n').slice(-4).join('\n     ') : ''}`);
  }
  const passed = results.every((r) => r.exit === 0);
  if (!passed && force === true) throw new Error('--force exige una razón: --force "por qué"');
  let status = passed ? 'closed' : force ? 'forced' : 'open', why = null, contracts = null;
  const cf = path.join(ROOT, 'out/contracts'), saved = fs.existsSync(cf) ? new Map(fs.readdirSync(cf).map((f) => [f, fs.readFileSync(path.join(cf, f))])) : new Map();
  const undoContracts = () => { fs.mkdirSync(cf, { recursive: true }); for (const f of fs.readdirSync(cf)) if (!saved.has(f)) fs.rmSync(path.join(cf, f), { force: true }); for (const [f, b] of saved) writeAtomic(path.join(cf, f), b); };
  const changed = () => treeDigest(currentHashes()) !== D0;
  if (status !== 'open' && changed()) { status = 'open'; why = `el árbol cambió durante los criterios (${D0} ya no es el árbol): no se cierra lo no probado`; }
  if (status !== 'open' && contractsGate) {
    const r = spawnArgv([process.execPath, path.join(ROOT, 'engine/orch.mjs'), 'freeze']);
    contracts = r.status === 0 ? r.stdout.trim() : '✗ contratos NO congelados: ' + String(r.stderr || r.stdout).trim().slice(-300);
    if (r.status !== 0) { status = 'open'; why = contracts; undoContracts(); }
    else if (changed()) { status = 'open'; why = 'el árbol cambió durante el freeze de contratos'; undoContracts(); }
    if (!quiet) console.log('  ' + (contracts ?? ''));
  }
  const st = withLockSync('gates', () => {
    if (status !== 'open' && changed()) { status = 'open'; why = 'el árbol cambió antes del commit del gate'; if (contractsGate) undoContracts(); }   // verificación final
    const S = gateState(), prev = S[name] ?? {}, fails = status === 'open' ? (prev.status === 'open' ? prev.fails ?? 0 : 0) + 1 : 0;
    const snap = status !== 'open' ? tagCommit(`opus/gate/${name}/${gateTags(name).length + 1}`, commit) : null;
    const entry = { status, ts: new Date().toISOString(), ...who(), criteria: results, ...stamp(cand), digest: D0, fails, snapshot: snap?.tag ?? null, ...(contracts ? { contracts } : {}), ...(why ? { why: why.slice(0, 140) } : force && !passed ? { why: String(force).slice(0, 140) } : {}) };
    try { S[name] = entry; writeAtomic(GATES_OUT, JSON.stringify(S, null, 1)); }
    catch (e) { if (contractsGate && status !== 'open') undoContracts(); throw e; }
    record({ action: why ? 'gate.close' : force && !passed ? 'gate.force' : 'gate.close', target: `gate/${name}`, hash_after: cand.filmHash, verdict: status, why: why ?? (force && !passed ? force : `${results.filter((r) => r.exit === 0).length}/${results.length} criterios · digest ${D0}`) });
    return entry;
  });
  return st;
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2), [cmd, name, n] = argv, fi = argv.indexOf('--force'), force = fi >= 0 ? (argv[fi + 1] && !argv[fi + 1].startsWith('--') ? argv[fi + 1] : true) : null;
  try {
    if (cmd === 'list') for (const [k, v] of Object.entries(gateDefs())) console.log(`${k}\n${parseCriteria(v).map((c) => `  · ${c.criterion}  ::  ${c.cmd}`).join('\n')}`);
    else if (cmd === 'status') { const S = gateState(), cur = currentHashes(); for (const k of Object.keys(gateDefs())) { const s = S[k]; console.log(`${k.padEnd(10)} ${s ? `${s.status.padEnd(7)} ${isFresh(s, cur) ? 'vigente ' : 'caducado'} ${s.ts} ${s.agent}${s.snapshot ? ' · ' + s.snapshot : ''}${s.fails ? ` · ${s.fails} fallos seguidos` : ''}` : '—'}`); } }
    else if (cmd === 'verify') { const g = await masterGate({}); console.log(g.ok ? 'OK  SHIP vigente, crítico sin FIX' : 'NO  ' + g.reasons.join(' · ')); process.exit(g.ok ? 0 : 1); }
    else if (cmd === 'close') {
      const s = closeGate(name, { force });
      console.log(`\n${s.status === 'open' ? 'ABIERTO' : s.status === 'forced' ? 'FORZADO' : 'CERRADO'}  gate ${name}${s.snapshot ? ` · snapshot ${s.snapshot}` : ''}${s.status === 'open' && s.why ? `\n  motivo: ${s.why}` : ''}${s.fails >= 2 ? `\n${s.fails} fallos seguidos: detente y reporta al Director (no reintentes a ciegas).` : ''}`);
      process.exit(s.status === 'open' ? 1 : 0);
    } else if (cmd === 'restore') { const r = restore(name, n); console.log(`✓ restaurado ${r.tag}${r.backup ? ` (estado previo en ${r.backup.tag})` : ''}`); }
    else console.log('Uso: node engine/gate.mjs list | status | verify | close <gate> [--force "razón"] | restore <gate> [n]');
  } catch (e) { console.error('✗ ' + e.message); process.exit(2); }
}
