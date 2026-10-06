#!/usr/bin/env node
// Roles aplicados: roles.json (rol → globs escribibles) + claims vigentes de otros agentes (engine/lock.mjs).
//   canWrite(role, path)            → {allow, rule, reason}                 (puro: solo roles.json)
//   decide({path, role?, agent?})   → {decision, enforced, reason}; registra en el ledger
//      mode observer: nunca bloquea, registra would_allow / would_deny (mide falsos positivos antes de activar)
//      mode enforce : registra allow / deny y el llamador (hook PreToolUse) bloquea
//   node engine/roles.mjs check <ruta> [--role animator:A2]
//   node engine/roles.mjs replay [--repo <dir>] [--json]   mide falsos positivos sobre el historial git: por commit, el rol (≠ director) que
//      menos deniega; un denegado es LEGÍTIMO si el fichero es directorOnly (roles.json) y FALSO POSITIVO si no.
// Por defecto el modo es ENFORCE (roles.json); OPUS_ROLES_MODE=observer lo baja a solo-registrar. Un roles.json ilegible degrada a observer.
// Rol del proceso: env OPUS_ROLE (director por defecto); "animator:A1+A2" rellena {ids} en los globs.
import { isMain } from './paths.mjs';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { ROOT, record, who, fileDigest } from './ledger.mjs';
import { holder } from './lock.mjs';

export const ROLES_FILE = path.join(ROOT, 'roles.json');
export function globRe(g) {
  let re = '', i = 0;
  while (i < g.length) {
    const c = g[i];
    if (c === '*' && g[i + 1] === '*') { i += 2; if (g[i] === '/') { i++; re += '(?:.*/)?'; } else re += '.*'; continue; }
    if (c === '*') re += '[^/]*'; else if (c === '?') re += '[^/]';
    else if (c === '{') { const j = g.indexOf('}', i); re += '(?:' + g.slice(i + 1, j).split(',').map((x) => x.replace(/[.+^$()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')).join('|') + ')'; i = j; }
    else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
    i++;
  }
  return new RegExp('^' + re + '$');
}
export const loadRoles = () => { try { return JSON.parse(fs.readFileSync(ROLES_FILE, 'utf8')); } catch { return { mode: 'observer', roles: { director: ['**'] } }; } };   // roles.json ilegible: fail-open (observer), no bloquear a todos
// realpath del ancestro existente más profundo + el resto: en macOS /var → /private/var (tmp por symlink) y ROOT (import.meta.url) es real.
const realish = (a) => { const tail = []; let d = a; for (;;) { try { return path.join(fs.realpathSync(d), ...tail.reverse()); } catch { const up = path.dirname(d); if (up === d) return a; tail.push(path.basename(d)); d = up; } } };
const REAL_ROOT = realish(ROOT);
export const rel = (p) => {
  const a = path.resolve(ROOT, p); let r = path.relative(ROOT, a);
  if (r.startsWith('..') || path.isAbsolute(r)) r = path.relative(REAL_ROOT, realish(a));     // ruta dada por otro camino (symlink) hacia el mismo árbol
  return r.startsWith('..') || path.isAbsolute(r) ? null : r.split(path.sep).join('/');
};

export function canWrite(role = who().role, p, R = loadRoles()) {
  const r = rel(p); if (r === null) return { allow: true, rule: null, reason: 'fuera del proyecto' };
  const [name, ids] = String(role).split(':'), idList = ids ? ids.split(/[+,]/).filter(Boolean) : null;
  if (!(name in (R.roles ?? {}))) return { allow: false, rule: null, reason: `rol "${name}" no existe en roles.json` };
  const globs = [...(R.roles['*'] ?? []), ...(R.roles[name] ?? [])].map((g) => g.replace('{ids}', idList ? (idList.length > 1 ? `{${idList.join(',')}}` : idList[0]) : '*'));
  const rule = globs.find((g) => globRe(g).test(r));
  return rule ? { allow: true, rule, reason: `${name} puede escribir ${rule}` } : { allow: false, rule: null, reason: `${name} no puede escribir ${r} (roles.json)` };
}

export function decide({ path: p, role = who().role, agent = who().agent, tool = null }) {
  const R = loadRoles(), mode = process.env.OPUS_ROLES_MODE ?? R.mode ?? 'observer', r = rel(p);
  let c = canWrite(role, p, R);
  if (c.allow && r) { const h = holder(r); if (h && h.agent !== agent) c = { allow: false, rule: c.rule, reason: `${r} reclamado por ${h.agent} hasta ${new Date(h.expires).toISOString()}` }; }
  const decision = c.allow ? 'allow' : 'deny', enforced = mode === 'enforce';
  if (r !== null) record({ action: 'write', target: r, hash_before: fileDigest(r), verdict: enforced ? decision : 'would_' + decision, why: `${tool ? tool + ': ' : ''}${c.reason}`, role, agent });
  return { decision, enforced, mode, reason: c.reason };
}

// Replay sobre el historial git: ¿cuántos de los ficheros que un rol ajustado escribió en commits reales habría denegado sin razón?
export function replay({ repo = ROOT, R = loadRoles() } = {}) {
  const git = (a) => spawnSync('git', ['-C', repo, ...a], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const out = git(['log', '--all', '--no-merges', '--name-only', '--pretty=format:@@%h']);
  if (out.status !== 0) return { commits: 0, files: 0, falsePositives: [], falsePositiveRate: 0, error: 'sin git' };
  const commits = []; for (const l of out.stdout.split('\n')) { if (l.startsWith('@@')) commits.push({ id: l.slice(2), files: [] }); else if (l && commits.length) commits.at(-1).files.push(l); }
  const names = Object.keys(R.roles ?? {}).filter((r) => !['*', 'director', 'review'].includes(r)), dOnly = (R.directorOnly ?? []).map(globRe);
  const stat = {}; let files = 0, fp = [], legit = 0, mixed = 0;
  for (const c of commits.filter((c) => c.files.length)) {
    // animator solo cuenta si el commit toca únicamente shots (sus IDs son los del commit)
    const ids = [...new Set(c.files.map((f) => /^shots\/([^/]+)\.mjs$/.exec(f)?.[1]).filter(Boolean))];
    const cand = names.map((r) => ({ r: r === 'animator' ? `animator:${ids.join('+') || '_'}` : r }));
    let best = null;
    for (const k of cand) { const den = c.files.filter((f) => !canWrite(k.r, f, R).allow); if (!best || den.length < best.den.length) best = { role: k.r, den }; }
    // Commit "mixto": ningún rol cubre ≥ 80 % de sus ficheros (monolito de la era del Director único): no mide ajuste de roles, se cuenta aparte.
    if (best.den.length / c.files.length > 0.2) { mixed++; for (const f of best.den) if (dOnly.some((re) => re.test(f))) legit++; continue; }
    files += c.files.length;
    for (const f of best.den) { if (dOnly.some((re) => re.test(f))) legit++; else fp.push({ commit: c.id, role: best.role, file: f }); }
    const n = best?.role.split(':')[0]; stat[n] = (stat[n] ?? 0) + 1;
  }
  return { commits: commits.length, mixedCommits: mixed, files, bestRoleByCommit: stat, legitimateDenials: legit, falsePositives: fp, falsePositiveRate: files ? fp.length / files : 0 };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2), [cmd, p] = argv, role = argv.includes('--role') ? argv[argv.indexOf('--role') + 1] : who().role;
  if (cmd === 'check' && p) { const c = canWrite(role, p); console.log(`${c.allow ? 'allow' : 'deny '}  ${role}  ${p}  · ${c.reason}`); process.exit(c.allow ? 0 : 1); }
  if (cmd === 'replay') {
    const r = replay({ repo: argv.includes('--repo') ? argv[argv.indexOf('--repo') + 1] : ROOT });
    if (argv.includes('--json')) { console.log(JSON.stringify(r)); process.exit(0); }
    console.log(`replay: ${r.commits} commits (${r.mixedCommits} mixtos, de Director único, fuera de la medida), ${r.files} ficheros · denegados legítimos (directorOnly) ${r.legitimateDenials} · falsos positivos ${r.falsePositives.length} (${(100 * r.falsePositiveRate).toFixed(1)} %)`);
    for (const f of r.falsePositives.slice(0, 40)) console.log(`  FP  ${f.commit}  ${f.role}  ${f.file}`);
    process.exit(0);
  }
  console.log('Uso: node engine/roles.mjs check <ruta> [--role rol] | replay [--repo dir] [--json]');
}
