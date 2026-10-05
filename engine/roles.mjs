#!/usr/bin/env node
// Roles aplicados: roles.json (rol → globs escribibles) + claims vigentes de otros agentes (engine/lock.mjs).
//   canWrite(role, path)            → {allow, rule, reason}                 (puro: solo roles.json)
//   decide({path, role?, agent?})   → {decision, enforced, reason}; registra en el ledger
//      mode observer: nunca bloquea, registra would_allow / would_deny (mide falsos positivos antes de activar)
//      mode enforce : registra allow / deny y el llamador (hook PreToolUse) bloquea
//   node engine/roles.mjs check <ruta> [--role animator:A2]
// Rol del proceso: env OPUS_ROLE (director por defecto); "animator:A1+A2" rellena {ids} en los globs.
import fs from 'node:fs';
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
export const loadRoles = () => { try { return JSON.parse(fs.readFileSync(ROLES_FILE, 'utf8')); } catch { return { mode: 'observer', roles: { director: ['**'] } }; } };
export const rel = (p) => { const a = path.resolve(ROOT, p), r = path.relative(ROOT, a); return r.startsWith('..') || path.isAbsolute(r) ? null : r.split(path.sep).join('/'); };

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

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2), [cmd, p] = argv, role = argv.includes('--role') ? argv[argv.indexOf('--role') + 1] : who().role;
  if (cmd === 'check' && p) { const c = canWrite(role, p); console.log(`${c.allow ? 'allow' : 'deny '}  ${role}  ${p}  · ${c.reason}`); process.exit(c.allow ? 0 : 1); }
  console.log('Uso: node engine/roles.mjs check <ruta> [--role rol]');
}
