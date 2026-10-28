#!/usr/bin/env node
// T1: paquetes de contexto por rol, deterministas, ≤ maxTokens (≈ chars/4). Fuentes: roles.json + data/ctx.json + package.json
// + data/commands.json + gates.json + orch.json. Los punteros de lectura llevan el digest del archivo (verificables).
//   node engine/ctx.mjs            genera docs/ctx/<rol>.md        node engine/ctx.mjs --check   exit 1 si alguno está caducado
import { isMain } from './paths.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, digest } from './ledger.mjs';
import { commands } from './command.mjs';

const rd = (p) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); } catch { return null; } };
export const tokens = (s) => Math.ceil(s.length / 4);
// referenceInvariant mínimo (no existe en main): puntero ruta@digest8 de lo que se leyó; "—" si falta.
export const ref = (p) => { try { return `${p}@${digest(fs.readFileSync(path.join(ROOT, p))).slice(0, 8)}`; } catch { return `${p}@—`; } };
export function pack(role, { cfg = rd('data/ctx.json') ?? {}, roles = rd('roles.json') ?? {} } = {}) {
  const C = cfg.roles?.[role] ?? {}, com = cfg.common ?? {}, scripts = rd('package.json')?.scripts ?? {}, cmds = commands(), gates = Object.keys(rd('gates.json') ?? {}).filter((k) => !k.startsWith('_')), o = rd('orch.json') ?? {};
  const writes = [...(roles.roles?.['*'] ?? []), ...(roles.roles?.[role] ?? [])];
  const cmdLine = (C.cmds ?? []).map((c) => (cmds[c] ? `${c}=${cmds[c].join(' ')}` : scripts[c] ? `npm run ${c}` : null)).filter(Boolean);
  const L = [`# Contexto: ${role}`, `(generado por engine/ctx.mjs; no editar. Fuentes: roles.json, data/ctx.json, data/commands.json, package.json)`, '',
    `Escribes: ${writes.join(', ') || '—'}  (roles.json, modo ${roles.mode ?? 'observer'})`, '',
    'Lee (puntero ruta@digest):', ...[...(com.read ?? []), ...(C.read ?? [])].map((p) => `- ${ref(p)}`), '',
    'Comandos (sin shell):', ...cmdLine.map((c) => `- ${c}`), '',
    `Gates: ${gates.join(' → ') || '—'} · K=${o.K ?? '-'} intentos por shot, gateBudget=${o.gateBudget ?? '-'}, concurrencia ${o.concurrency ?? 3}`, '',
    'Trampas:', ...[...(com.traps ?? []), ...(C.traps ?? [])].map((t) => `- ${t}`)];
  let text = L.join('\n') + '\n';
  const max = cfg.maxTokens ?? 1500; if (tokens(text) > max) text = text.slice(0, max * 4 - 2) + '…\n';
  return text;
}
export function build() {
  const cfg = rd('data/ctx.json') ?? {}, out = {};
  for (const r of Object.keys(cfg.roles ?? {})) out[`docs/ctx/${r}.md`] = pack(r);
  return out;
}
if (isMain(import.meta.url)) {
  const B = build(), stale = [];
  for (const [f, t] of Object.entries(B)) {
    const cur = fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f), 'utf8') : null;
    if (process.argv.includes('--check')) { if (cur !== t) stale.push(f); }
    else if (cur !== t) { fs.mkdirSync(path.dirname(path.join(ROOT, f)), { recursive: true }); fs.writeFileSync(path.join(ROOT, f), t); }
  }
  if (process.argv.includes('--check')) { console.log(stale.length ? `NO  caducados: ${stale.join(', ')} (node engine/ctx.mjs)` : `OK  ${Object.keys(B).length} paquetes de contexto vigentes`); process.exit(stale.length ? 1 : 0); }
  console.log(`✓ ${Object.keys(B).length} paquetes en docs/ctx/ (${Object.entries(B).map(([f, t]) => `${path.basename(f, '.md')}:${tokens(t)}t`).join(' ')})`);
}
