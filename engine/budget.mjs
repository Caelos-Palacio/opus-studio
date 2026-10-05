#!/usr/bin/env node
// Presupuestos (data/budgets.json) medidos desde el ledger: tokens por rol/tarea, minutos de render por film, iteraciones por shot y por gate.
//   checkBudget({kind:'tokens', role?, task?} | {kind:'render', film} | {kind:'iterations', shot?, gate?}) → {level:'ok'|'warn'|'block', used, limit, ...}
//   level warn al llegar a warnAt (80 %), block al llegar al 100 %; warn/block dejan budget.warn / budget.block en el ledger.
// PUNTO DE ENGANCHE (gate.mjs / orch.mjs, no editados aquí): antes de ejecutar criterios de un gate o de lanzar otra iteración sobre un shot:
//   import { checkBudget } from './budget.mjs'; const b = checkBudget({ kind: 'iterations', gate: name }); if (b.level === 'block') die(b.why);
// Consumo: recordUsage({tokens, minutes, role, task, film}) de ledger.mjs. Sin data/budgets.json no se bloquea nada.
import { isMain } from './paths.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, record, readLedger } from './ledger.mjs';

export const BUDGETS = path.join(ROOT, 'data/budgets.json');
export const loadBudgets = () => { try { return JSON.parse(fs.readFileSync(BUDGETS, 'utf8')); } catch { return null; } };
const lvl = (used, limit, warnAt) => (!limit ? 'ok' : used >= limit ? 'block' : used >= limit * warnAt ? 'warn' : 'ok');

function measure(k, B, E) {
  if (k.kind === 'tokens') {
    const sum = (f) => E.filter((e) => e.action === 'usage' && f(e)).reduce((a, e) => a + (e.tokens ?? 0), 0), P = B.tokens ?? {};
    if (k.task != null) return { key: 'task/' + k.task, used: sum((e) => new RegExp(`(^|/)task/${k.task}$`).test(e.target ?? '')), limit: P.perTask?.[k.task] ?? null };
    return { key: 'role/' + k.role, used: sum((e) => e.role === k.role), limit: P.perRole?.[k.role] ?? null };
  }
  if (k.kind === 'render') {
    const used = E.filter((e) => e.action === 'usage' && new RegExp(`(^|/)film/${k.film}(/|$)`).test(e.target ?? '')).reduce((a, e) => a + (e.ms ?? 0), 0) / 60000;
    return { key: 'film/' + k.film, used, limit: B.renderMinutes?.perFilm?.[k.film] ?? B.renderMinutes?.default ?? null };
  }
  if (k.kind === 'iterations') {
    if (k.shot != null) return { key: 'shot/' + k.shot, used: E.filter((e) => e.action === 'lint' && (e.target ?? '').split('/')[2] === String(k.shot)).length, limit: B.iterations?.perShot ?? null };
    return { key: 'gate/' + k.gate, used: E.filter((e) => e.action === 'gate.close' && e.target === 'gate/' + k.gate).length, limit: B.iterations?.perGate ?? null };
  }
  throw new Error('budget: kind desconocido ' + k.kind);
}
export function checkBudget(k, { log = true } = {}) {
  const B = loadBudgets(); if (!B) return { level: 'ok', used: 0, limit: null, kind: k.kind, why: 'sin data/budgets.json' };
  const m = measure(k, B, readLedger()), level = lvl(m.used, m.limit, B.warnAt ?? 0.8);
  const r = { ...m, kind: k.kind, level, why: m.limit ? `${k.kind} ${m.key}: ${+m.used.toFixed(1)}/${m.limit}` : 'sin tope' };
  if (log && level !== 'ok') record({ action: 'budget.' + level, target: m.key, verdict: level, why: r.why, code: level === 'block' ? 'budget.exceeded' : undefined, agent: 'budget' });
  return r;
}
// Informe: true si algo está bloqueado.
export function reportBudget() {
  const B = loadBudgets(), E = readLedger(); if (!B) { console.log('sin data/budgets.json'); return false; }
  const keys = [];
  for (const r of Object.keys(B.tokens?.perRole ?? {})) keys.push({ kind: 'tokens', role: r });
  for (const t of new Set(E.filter((e) => e.action === 'usage').map((e) => /task\/([^/]+)/.exec(e.target ?? '')?.[1]).filter(Boolean))) keys.push({ kind: 'tokens', task: t });
  for (const f of new Set(E.filter((e) => e.action === 'usage').map((e) => /film\/([^/]+)/.exec(e.target ?? '')?.[1]).filter(Boolean))) keys.push({ kind: 'render', film: f });
  for (const s of new Set(E.filter((e) => e.action === 'lint').map((e) => (e.target ?? '').split('/')[2]).filter((x) => x && !x.startsWith('only:') && x !== 'schema'))) keys.push({ kind: 'iterations', shot: s });
  for (const g of new Set(E.filter((e) => e.action === 'gate.close').map((e) => (e.target ?? '').replace('gate/', '')))) keys.push({ kind: 'iterations', gate: g });
  let blocked = false;
  for (const k of keys) { const c = checkBudget(k, { log: false }); if (c.level === 'block') blocked = true; if (c.used || c.level !== 'ok') console.log(`${c.level === 'block' ? 'BLOQUEO' : c.level === 'warn' ? 'aviso  ' : 'ok     '} ${c.kind.padEnd(10)} ${c.key.padEnd(18)} ${+c.used.toFixed(1)} / ${c.limit ?? '∞'}`); }
  return blocked;
}
if (isMain(import.meta.url)) process.exit(reportBudget() ? 1 : 0);
