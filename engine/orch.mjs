#!/usr/bin/env node
// Orquestación que converge (F3). N agentes sin interferencia destructiva: cada regla es código, y todo queda en el ledger.
//   1 un escritor      accept exige roles.json + claims; los no-dueños:  orch propose <ruta.json> <patch.json> --why "…"
//                      el Director:                                      orch decide <id> accept|reject --why "…"
//   2 contratos        orch freeze (lo llama `gate close animatic`) · orch contracts · orch reopen <gate> --why "…"
//   3 dependencias     q deps · q impact <ID|ruta>   (depGraph / impact / plan de este módulo)
//   4 trinquete        orch accept <change.json>   ({files:{ruta:contenido}, base?, why}; ver data/orch.schema.json)
//   5 anti-oscilación  historial shotHash+problemas en el ledger (orch.state); A→B→A o K intentos → congela y escala
//                      orch unfreeze <shot/ID|gate/G> --why "…"   (Director)
//   6 críticos         orch note <nota.json> ({shot, problem, evidence[], tag?}: sin prescripción) · orch list notes
//   7 contexto         orch brief <agente> <tarea>  (≤ briefTokens, determinista) · orch run [--lines N] -- <cmd …>
//   8 entrega          orch deliver <entrega.json>  (re-ejecuta evidence[].cmd y exige el mismo exit)
// Configuración: orch.json (K, gateBudget, theta, quorum, briefTokens, toolLines, lintArgs, contractsGate).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, record, readLedger, who, digest, fileDigest } from './ledger.mjs';
import { withLock, withLockSync, writeAtomic, holder, listLocks } from './lock.mjs';
import { currentHashes, isFresh, lintDir, filmKey, readJSON } from './verdict.mjs';
import { canWrite, rel } from './roles.mjs';
import { validate } from './schema.mjs';
import { contractFile, readContract, contractHash, boundariesOf, contractIssues } from './contract.mjs';

const DEF = { K: 3, gateBudget: 2, theta: 0.5, quorum: 2, briefTokens: 500, toolLines: 20, lintArgs: [], contractsGate: 'animatic' };
export const config = () => ({ ...DEF, ...(readJSON(path.join(ROOT, 'orch.json')) ?? {}) });
const SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/orch.schema.json'), 'utf8'));
export const schemaErrors = (kind, v) => validate(v, SCHEMA.$defs[kind], SCHEMA).filter((e) => e.level === 'FIX').map((e) => `${e.path}: ${e.message}${e.remedy ? ' → ' + e.remedy : ''}`);
export const isDirector = (role = who().role) => String(role).split(':')[0] === 'director';
const tlPath = () => process.env.OPUS_TIMELINE ?? 'data/timeline.json';
const abs = (p) => path.join(ROOT, p);
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').slice(0, n);
const EMPTY = digest('');
class OrchError extends Error {}
const die = (m) => { throw new OrchError(m); };
const needWhy = (why) => { if (!why || String(why).trim().length < 3) die('falta el motivo: --why "…"'); return String(why).trim(); };
const needDirector = (what) => { if (!isDirector()) die(`${what}: solo el Director (OPUS_ROLE=director); tu rol es ${who().role}`); };

// ── 7. salidas de herramientas: veredicto + N líneas + ruta al log (el resto nunca entra en el contexto) ────────────────
export function runLogged(cmd, { lines = config().toolLines, env = {} } = {}) {
  const opt = { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 256 << 20 };
  const r = Array.isArray(cmd) ? spawnSync(cmd[0], cmd.slice(1), opt) : spawnSync(cmd, { ...opt, shell: true });
  const all = (r.stdout ?? '') + (r.stderr ?? '') + (r.error ? String(r.error) : ''), status = r.status ?? -1;
  const label = Array.isArray(cmd) ? cmd.map((a) => (a === process.execPath ? 'node' : a)).join(' ') : cmd;
  const log = path.join(ROOT, 'out/logs', `${Date.now().toString(36)}-${process.pid}-${digest(label + Math.random()).slice(0, 6)}.log`);
  fs.mkdirSync(path.dirname(log), { recursive: true }); fs.writeFileSync(log, `$ ${label}\n${all}\n[exit ${status}]\n`);
  const L = all.split('\n').filter((l) => l.trim());
  const verdict = ([...L].reverse().find((l) => /^\s*(SHIP|FIX|PASS|OK|NO|ABIERTO|CERRADO|FORZADO|ACEPTADO|RECHAZADO)\b/.test(l)) ?? L[L.length - 1] ?? '').trim();
  const text = `exit ${status} · ${clip(verdict, 160)}\n${L.slice(0, lines).map((l) => clip(l, 240)).join('\n')}${L.length > lines ? `\n… (${L.length - lines} líneas más)` : ''}\nlog: ${path.relative(ROOT, log)}`;
  return { status, verdict, text, log: path.relative(ROOT, log) };
}

// ── 3. grafo de dependencias entre shots ────────────────────────────────────────────────────────────────────────────
// Aristas fuertes (ordenan la ejecución): handoff, after, cam.chain, import entre shots. Recurso compartido: estilo y timeline.
export function depGraph(tl = readJSON(abs(tlPath()))) {
  const shots = (tl?.shots ?? []).filter((s) => s?.id), ids = shots.map((s) => s.id), has = new Set(ids), edges = [];
  const add = (from, to, kind) => { if (has.has(from) && has.has(to) && from !== to && !edges.some((e) => e.from === from && e.to === to && e.kind === kind)) edges.push({ from, to, kind }); };
  for (const h of tl?.handoffs ?? []) add(h.from, h.to, 'handoff');
  shots.forEach((s, i) => {
    if (s.after) add(s.after, s.id, 'after');
    if (s.cam?.chain && i > 0) add(ids[i - 1], s.id, 'chain');
    const f = abs(`shots/${s.id}.mjs`);
    if (fs.existsSync(f)) for (const [, d] of fs.readFileSync(f, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"]\.\/([\w-]+)\.mjs['"]/g)) add(d, s.id, 'import');
  });
  return { ids, edges, style: `styles/${tl?.style ?? 'editorial'}.json`, timeline: tlPath() };
}
// Plan de ejecución: niveles topológicos (dentro de un nivel, en paralelo). Un ciclo es un error de diseño del timeline.
export function execPlan(G = depGraph()) {
  const indeg = Object.fromEntries(G.ids.map((i) => [i, 0])), pairs = [...new Set(G.edges.map((e) => e.from + '>' + e.to))].map((p) => p.split('>'));
  for (const [, b] of pairs) indeg[b]++;
  const levels = []; let ready = G.ids.filter((i) => !indeg[i]), seen = 0;
  while (ready.length) { levels.push(ready); seen += ready.length; const nx = []; for (const a of ready) for (const [x, b] of pairs) if (x === a && !--indeg[b]) nx.push(b); ready = G.ids.filter((i) => nx.includes(i)); }
  if (seen < G.ids.length) die(`ciclo de dependencias entre ${G.ids.filter((i) => indeg[i] > 0).join(', ')}`);
  return levels;
}
const adj = (G, id) => { const i = G.ids.indexOf(id); return i < 0 ? [] : [G.ids[i - 1], G.ids[i + 1]].filter(Boolean); };
// Impacto de cambiar un shot o un archivo: shots cuyo hash cambia (cierre por aristas) + vecinos (sus veredictos fijan a los vecinos).
export function impact(target, G = depGraph()) {
  const t = String(target).replace(/^\.\//, ''), m = /^shots\/([\w-]+)\.mjs$/.exec(t), id = G.ids.includes(t) ? t : m?.[1];
  let seeds;
  if (id && G.ids.includes(id)) seeds = [id];
  else if (m) seeds = G.ids.filter((s) => fs.existsSync(abs(`shots/${s}.mjs`)) && new RegExp(`['"]\\./${m[1]}\\.mjs['"]`).test(fs.readFileSync(abs(`shots/${s}.mjs`), 'utf8')));   // módulo auxiliar importado
  else if (/^(out|docs|test)\/|\.md$/.test(t)) seeds = [];
  else seeds = [...G.ids];                                                       // timeline, estilo compartido, motor, datos: todo
  const closure = new Set(seeds), q = [...seeds];
  while (q.length) { const a = q.shift(); for (const e of G.edges) if (e.from === a && !closure.has(e.to)) { closure.add(e.to); q.push(e.to); } }
  const relint = new Set(closure); for (const s of closure) for (const n of adj(G, s)) relint.add(n);
  const order = (S) => G.ids.filter((i) => S.has(i)), R = order(relint);
  return { target: t, seeds, changed: order(closure), relint: R, cover: lintCover(R, G) };
}
// Mínimo de `lint --shot X` que cubre los shots pedidos (cada uno lintea X + vecinos). null = lint completo.
export function lintCover(ids, G) {
  if (!ids.length) return [];
  if (ids.length >= G.ids.length) return null;
  const left = new Set(ids), out = [];
  while (left.size) {
    let best = null, bn = 0;
    for (const x of G.ids) { const w = [x, ...adj(G, x)], n = w.filter((y) => left.has(y)).length * 10 - w.length; if (n > bn) { bn = n; best = x; } }   // más cubiertos, ventana menor
    out.push(best); for (const y of [best, ...adj(G, best)]) left.delete(y);
  }
  return out.length * 2 > G.ids.length ? null : out;
}

// ── veredictos por shot ─────────────────────────────────────────────────────────────────────────────────────────────
const vFile = (id) => path.join(lintDir(), id + '.json');
export const verdicts = (ids, H = currentHashes()) => Object.fromEntries(ids.map((id) => { const v = readJSON(vFile(id)); return [id, v && isFresh(v, H) ? v : null]; }));
const fixes = (v) => (v ? v.issues.filter((i) => i.level === 'FIX') : null);
export const nFix = (v) => fixes(v)?.length ?? 1;                              // sin veredicto vigente = rojo
const keyOf = (i) => i.check ?? String(i.problem).replace(/[\d.]+/g, '#');
const fixKeys = (v) => new Set(v ? fixes(v).map(keyOf) : ['sin-veredicto']);
export const problemsOf = (v) => digest(v ? [...new Set(fixes(v).map((i) => keyOf(i) + '|' + String(i.problem).replace(/[\d.]+/g, '#')))].sort().join('\n') : 'sin-veredicto');
function lintRun(ids, G, out) {
  const cover = lintCover(ids, G), extra = config().lintArgs ?? [];
  for (const x of cover ?? [null]) { const r = runLogged([process.execPath, 'engine/lint.mjs', ...(x ? ['--shot', x] : []), ...extra]); out.push(`lint ${x ? '--shot ' + x : '(completo)'}: ${r.text}`); }
}
function freshVerdicts(ids, G, out) {
  let V = verdicts(ids); const stale = ids.filter((i) => !V[i]);
  if (stale.length) { lintRun(stale, G, out); V = verdicts(ids); }
  return V;
}

// ── 4. trinquete (puro): el shot cambiado mejora o iguala, ningún check verde pasa a rojo, el FIX global no sube ──────────
export function ratchet(before, after, changed = []) {
  const reasons = []; let b = 0, a = 0;
  for (const id of Object.keys(after)) {
    const B = before[id] ?? null, A = after[id] ?? null; b += nFix(B); a += nFix(A);
    if (changed.includes(id) && nFix(A) > nFix(B)) reasons.push(`${id} empeora: FIX ${nFix(B)}→${nFix(A)}`);
    const kb = fixKeys(B); for (const k of fixKeys(A)) if (!kb.has(k)) reasons.push(`${id}: check "${k}" pasa de verde a rojo`);
  }
  if (a > b) reasons.push(`FIX global sube: ${b}→${a}`);
  return { ok: !reasons.length, reasons: [...new Set(reasons)], fixBefore: b, fixAfter: a };
}

// ── 5. anti-oscilación: historial en el ledger ──────────────────────────────────────────────────────────────────────
// orch.state {target: shot/ID, hash_before: shotHash, hash_after: digest(problemas), verdict: base|accepted|rejected|oscillation, why: "FIX n"}
const states = (id) => readLedger({ action: 'orch.state', target: 'shot/' + id });
export const history = (id) => states(id).filter((e) => e.verdict === 'base' || e.verdict === 'accepted').map((e) => ({ hash: e.hash_before, problems: e.hash_after }));
export function oscillation(hist, cand) {                                     // puro: ¿reaparece un estado ya superado (A→B→A)?
  if (!hist.length) return null;
  const last = hist[hist.length - 1], prev = hist.slice(0, -1);
  if (cand.hash && cand.hash !== last.hash && prev.some((h) => h.hash === cand.hash)) return `el código vuelve a un estado ya superado (${cand.hash.slice(0, 8)}: A→B→A)`;
  if (cand.problems && cand.problems !== EMPTY && cand.problems !== last.problems && prev.some((h) => h.problems === cand.problems)) return 'reaparece un conjunto de problemas ya superado (A→B→A)';
  return null;
}
export function budgetUsed(id) {                                               // intentos desde el último SHIP aceptado / descongelado
  let n = 0;
  for (const e of readLedger().filter((e) => e.target === 'shot/' + id && (e.action === 'orch.state' || e.action === 'orch.unfreeze'))) {
    if (e.action === 'orch.unfreeze' || e.verdict === 'base' || (e.verdict === 'accepted' && e.why === 'FIX 0')) n = 0; else n++;
  }
  return n;
}
const lastFreeze = (target) => readLedger().filter((e) => e.target === target && (e.action === 'orch.freeze' || e.action === 'orch.unfreeze')).pop();
export const isFrozen = (target) => lastFreeze(target)?.action === 'orch.freeze';
const recState = (id, hash, problems, verdict, why) => record({ action: 'orch.state', target: 'shot/' + id, hash_before: hash, hash_after: problems, verdict, why });

function udiff(a, b, label) {
  const d = path.join(ROOT, 'out/orch/tmp'); fs.mkdirSync(d, { recursive: true });
  const fa = path.join(d, `a-${process.pid}`), fb = path.join(d, `b-${process.pid}`); fs.writeFileSync(fa, a ?? ''); fs.writeFileSync(fb, b ?? '');
  const r = spawnSync('diff', ['-u', '--label', `${label} (aceptado)`, '--label', `${label} (candidato)`, fa, fb], { encoding: 'utf8' });
  fs.rmSync(fa, { force: true }); fs.rmSync(fb, { force: true });
  if (r.status !== null && !r.error) return r.stdout;
  const A = (a ?? '').split('\n'), B = (b ?? '').split('\n');                   // sin diff(1): líneas que salen / entran
  return [...A.filter((l) => !B.includes(l)).map((l) => '-' + l), ...B.filter((l) => !A.includes(l)).map((l) => '+' + l)].join('\n');
}
function freezeShot(id, why, files, prevContent) {
  const target = 'shot/' + id;
  if (!isFrozen(target)) record({ action: 'orch.freeze', target, verdict: 'frozen', why });
  const diff = Object.entries(files).map(([p, c]) => udiff(prevContent[p], c, p)).join('\n');
  const f = path.join(ROOT, 'out/orch/escalations', id + '.json');
  writeAtomic(f, JSON.stringify({ shot: id, why, agent: who().agent, history: history(id).map((h) => h.hash), diff }, null, 1));
  record({ action: 'orch.escalate', target, verdict: 'director', why: `${why} · ${path.relative(ROOT, f)}` });
  return path.relative(ROOT, f);
}

// ── 1+4+5. aceptar un cambio ────────────────────────────────────────────────────────────────────────────────────────
const snap = (files) => Object.fromEntries(files.map((p) => [p, fs.existsSync(abs(p)) ? fs.readFileSync(abs(p), 'utf8') : null]));
const put = (files) => { for (const [p, c] of Object.entries(files)) { if (c == null) fs.rmSync(abs(p), { force: true }); else writeAtomic(abs(p), c); } };
const snapVerdicts = () => { const d = lintDir(), fl = fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => path.relative(ROOT, path.join(d, f))) : []; return snap([...fl, 'out/lint.json']); };
const restoreVerdicts = (S) => { const d = lintDir(); if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) { const p = path.relative(ROOT, path.join(d, f)); if (f.endsWith('.json') && !(p in S)) fs.rmSync(abs(p), { force: true }); } put(S); };

export async function accept(change, { log = [] } = {}) {
  const { agent, role } = who(), cfg = config(), dir = isDirector(role);
  const bad = schemaErrors('change', change); if (bad.length) return done(false, 'cambio inválido: ' + bad.join('; '));
  const files = {}; for (const [p, c] of Object.entries(change.files)) { const r = rel(p); if (!r) return done(false, `${p}: fuera del proyecto`); files[r] = c; }
  const paths = Object.keys(files); if (!paths.length) return done(false, 'cambio vacío');
  for (const p of paths) {                                                       // regla 1: un escritor por artefacto
    const c = canWrite(role, p); if (!c.allow) return done(false, `${c.reason}: no eres su escritor → propón un parche (orch propose ${p} patch.json --why "…")`);
    const h = holder(p); if (h && h.agent !== agent) return done(false, `${p} reclamado por ${h.agent}`);
  }
  function done(ok, why, extra = {}) {
    record({ action: 'orch.accept', target: clip(change?.id ?? Object.keys(change?.files ?? {}).join(','), 200), hash_before: extra.h0 ?? null, hash_after: extra.h1 ?? null, verdict: ok ? 'accepted' : extra.verdict ?? 'rejected', why: clip(why, 140) });
    return { ok, why, ...extra, log };
  }
  return withLock('orch/accept', async () => {
    for (const [p, h] of Object.entries(change.base ?? {})) if (fileDigest(rel(p) ?? p) !== h) return done(false, `${p} cambió desde tu base (otro cambio aceptado): rehaz sobre el estado actual`, { verdict: 'stale' });
    const G = depGraph(), H0 = currentHashes();
    const shotIds = paths.map((p) => /^shots\/([\w-]+)\.mjs$/.exec(p)?.[1]).filter((id) => id && H0.order.includes(id));
    for (const id of shotIds) if (isFrozen('shot/' + id) && !dir) return done(false, `${id} congelado (oscilación o presupuesto agotado): escalado al Director`, { verdict: 'frozen' });
    const relint0 = [...new Set(paths.flatMap((p) => impact(p, G).relint))];
    const before = freshVerdicts(relint0, G, log);                               // línea base vigente (content-addressed)
    for (const id of shotIds) if (!history(id).length) recState(id, H0.shots[id], problemsOf(before[id]), 'base', `FIX ${nFix(before[id])}`);
    const prev = snap(paths), vbak = snapVerdicts(), undo = () => { put(prev); restoreVerdicts(vbak); };
    put(files);
    const H1 = currentHashes();
    for (const id of shotIds) {                                                  // oscilación por estado: sin gastar un lint
      const why = oscillation(history(id), { hash: H1.shots[id] });
      if (why) { undo(); recState(id, H1.shots[id], null, 'oscillation', why); const esc = freezeShot(id, why, files, prev); return done(false, `${id}: ${why} → congelado, escalado (${esc})`, { verdict: 'oscillation', escalation: esc, h0: H0.filmHash }); }
    }
    const G1 = depGraph(), relint = [...new Set([...relint0, ...paths.flatMap((p) => impact(p, G1).relint)])].filter((i) => G1.ids.includes(i));
    lintRun(relint, G1, log);
    const H2 = currentHashes();
    if (H2.filmHash !== H1.filmHash) { undo(); return done(false, 'el árbol cambió durante el lint (escritura fuera de orch): reintenta', { verdict: 'stale' }); }
    const after = verdicts(relint, H2), r = ratchet(Object.fromEntries(relint.map((i) => [i, before[i] ?? null])), after, shotIds);
    let osc = null;
    if (r.ok) for (const id of shotIds) { const w = oscillation(history(id), { hash: H1.shots[id], problems: problemsOf(after[id]) }); if (w) { osc = [id, w]; break; } }
    const summary = `FIX ${r.fixBefore}→${r.fixAfter}`;
    if (!r.ok || osc) {
      undo();
      let esc = null;
      for (const id of shotIds) {
        recState(id, H1.shots[id], problemsOf(after[id]), osc?.[0] === id ? 'oscillation' : 'rejected', `FIX ${nFix(after[id])}`);
        const why = osc?.[0] === id ? osc[1] : budgetUsed(id) >= cfg.K ? `presupuesto agotado (${cfg.K} intentos sin SHIP)` : null;
        if (why) esc = freezeShot(id, why, files, prev);
      }
      return done(false, `${osc ? osc[0] + ': ' + osc[1] : r.reasons.join('; ')} (${summary})`, { verdict: osc ? 'oscillation' : 'rejected', reasons: r.reasons, escalation: esc, h0: H0.filmHash, h1: H2.filmHash });
    }
    for (const id of shotIds) recState(id, H1.shots[id], problemsOf(after[id]), 'accepted', `FIX ${nFix(after[id])}`);
    return done(true, `${summary} · ${change.why}`, { fixBefore: r.fixBefore, fixAfter: r.fixAfter, h0: H0.filmHash, h1: H2.filmHash });
  }, { ttlMs: 60000, waitMs: 3600000 });
}

export function unfreeze(target, why) {
  needDirector('unfreeze'); why = needWhy(why);
  if (target.startsWith('gate/')) {
    const name = target.slice(5), F = path.join(ROOT, 'out/gates.json');
    withLockSync('gates', () => { const S = readJSON(F) ?? {}; if (S[name]) { S[name].fails = 0; writeAtomic(F, JSON.stringify(S, null, 1)); } });
  } else if (!isFrozen(target)) die(`${target} no está congelado`);
  record({ action: 'orch.unfreeze', target, verdict: 'unfrozen', why });
}

// ── 2. contratos ────────────────────────────────────────────────────────────────────────────────────────────────────
async function filmForContracts() {
  const { loadFilm } = await import('./film.mjs');
  try { return await loadFilm(); } catch { return loadFilm({ animatic: true }); }   // antes de que existan los shots: sin estados
}
export async function freezeContracts({ gate = config().contractsGate } = {}) {
  const film = await filmForContracts(), boundaries = boundariesOf(film);
  const C = { film: filmKey().replace(/\.edit$/, ''), gate, status: 'frozen', hash: contractHash(boundaries), agent: who().agent, boundaries };
  const bad = schemaErrors('contract', C); if (bad.length) die('contrato inválido: ' + bad.join('; '));
  writeAtomic(contractFile(), JSON.stringify(C, null, 1));
  record({ action: 'contract.freeze', target: path.relative(ROOT, contractFile()), hash_after: C.hash, verdict: 'frozen', why: `${boundaries.length} fronteras al cerrar ${gate}` });
  return C;
}
export function reopen(gate, why) {
  needDirector('reopen'); why = needWhy(why);
  const F = path.join(ROOT, 'out/gates.json');
  withLockSync('gates', () => { const S = readJSON(F) ?? {}; S[gate] = { ...(S[gate] ?? {}), status: 'reopened', fails: 0, why: clip(why, 140) }; writeAtomic(F, JSON.stringify(S, null, 1)); });
  const C = readContract();
  if (C && C.gate === gate) { C.status = 'reopened'; C.why = clip(why, 140); writeAtomic(contractFile(), JSON.stringify(C, null, 1)); }
  record({ action: 'gate.reopen', target: `gate/${gate}`, hash_after: C?.hash ?? null, verdict: 'reopened', why });
}
async function contractViolations() { const C = readContract(); if (!C || C.status !== 'frozen') return []; return contractIssues(await filmForContracts(), C); }

// ── 1. propuestas (JSON Patch) y decisiones del Director ─────────────────────────────────────────────────────────────
const ptr = (p) => p.split('/').slice(1).map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
export function applyPatch(doc, ops) {
  const d = structuredClone(doc);
  for (const o of ops) {
    const k = ptr(o.path), last = k.pop(); let par = d;
    for (const s of k) { if (par == null || typeof par !== 'object' || !(s in par)) die(`patch: ruta inexistente ${o.path}`); par = par[s]; }
    if (o.op === 'test') { if (JSON.stringify(last === undefined ? d : par?.[last]) !== JSON.stringify(o.value)) die(`patch: test falla en ${o.path}`); continue; }
    if (last === undefined) die('patch: no se reemplaza el documento entero');
    const arr = Array.isArray(par), i = arr ? (last === '-' ? par.length : +last) : last;
    if (o.op !== 'add' && !(arr ? i < par.length : i in par)) die(`patch: ${o.op} sobre ruta inexistente ${o.path}`);
    if (o.op === 'remove') { if (arr) par.splice(i, 1); else delete par[i]; }
    else if (o.op === 'replace') par[i] = o.value;
    else if (arr) par.splice(i, 0, o.value); else par[i] = o.value;
  }
  return d;
}
const PROPS = () => path.join(ROOT, 'out/proposals'), NOTES = () => path.join(ROOT, 'out/notes');
const items = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => readJSON(path.join(dir, f))).filter(Boolean) : []);
const newId = (pre, x) => `${pre}-${digest(JSON.stringify(x) + Date.now() + Math.random()).slice(0, 8)}`;
export function propose(target, patch, why) {
  const r = rel(target), { agent, role } = who(); why = needWhy(why);
  if (!r || !r.endsWith('.json') || !fs.existsSync(abs(r))) die(`${target}: solo se proponen parches sobre JSON existentes del proyecto`);
  const bad = schemaErrors('patch', patch); if (bad.length) die('patch inválido: ' + bad.join('; '));
  applyPatch(readJSON(abs(r)), patch);                                           // debe aplicar limpio sobre el estado actual
  const P = { id: newId('p', [r, patch, agent]), kind: 'proposal', agent, role, target: r, patch, why: clip(why, 280), base: fileDigest(r), status: 'pending' };
  writeAtomic(path.join(PROPS(), P.id + '.json'), JSON.stringify(P, null, 1));
  record({ action: 'orch.propose', target: r, hash_before: P.base, verdict: 'pending', why: `${P.id}: ${why}` });
  return P;
}
export async function decide(id, decision, why) {
  needDirector('decide'); why = needWhy(why);
  const isNote = id.startsWith('n-'), f = path.join(isNote ? NOTES() : PROPS(), id + '.json'), X = readJSON(f);
  if (!X) die(`no existe ${id}`); if (X.status !== 'pending') die(`${id} ya está ${X.status}`);
  const ok = isNote ? ['apply', 'reject'] : ['accept', 'reject']; if (!ok.includes(decision)) die(`decisión: ${ok.join('|')}`);
  if (decision !== 'reject' && !isNote) {
    const res = await withLock('orch/accept', async () => {
      if (fileDigest(X.target) !== X.base) return { status: 'stale', why: 'el archivo cambió desde la propuesta: que se reproponga' };
      const before = fs.readFileSync(abs(X.target), 'utf8');
      writeAtomic(abs(X.target), JSON.stringify(applyPatch(JSON.parse(before), X.patch), null, 2) + '\n');
      const v = await contractViolations().catch((e) => [{ problem: 'el film no carga: ' + e.message }]);
      if (v.length) { writeAtomic(abs(X.target), before); return { blocked: `viola el contrato congelado (${v.map((x) => x.problem).join('; ').slice(0, 200)}): reabre el gate (orch reopen ${readContract()?.gate} --why "…")` }; }
      return { status: 'accepted' };
    }, { ttlMs: 60000, waitMs: 3600000 });
    if (res.blocked) { record({ action: 'orch.decide', target: id, verdict: 'blocked', why: res.blocked }); die(res.blocked); }
    if (res.status === 'stale') { Object.assign(X, { status: 'stale', decidedBy: who().agent, decision_why: res.why }); writeAtomic(f, JSON.stringify(X, null, 1)); record({ action: 'orch.decide', target: id, verdict: 'stale', why: res.why }); die(res.why); }
  }
  const status = decision === 'reject' ? 'rejected' : isNote ? 'applied' : 'accepted';
  Object.assign(X, { status, decidedBy: who().agent, decision_why: clip(why, 280) }); writeAtomic(f, JSON.stringify(X, null, 1));
  record({ action: 'orch.decide', target: id, hash_after: isNote ? null : fileDigest(X.target), verdict: status, why });
  return X;
}

// ── 6. notas de críticos: diagnóstico sin prescripción; consenso solo con evidencias independientes ────────────────────
export function addNote(note) {
  const bad = schemaErrors('note', note), { agent } = who();
  if (bad.length) die('nota inválida (diagnóstico {shot, problem, evidence[], tag?}; sin arreglo: decide el Director): ' + bad.join('; '));
  const N = { id: newId('n', [note, agent]), kind: 'note', agent, ...note, status: 'pending' };
  writeAtomic(path.join(NOTES(), N.id + '.json'), JSON.stringify(N, null, 1));
  record({ action: 'orch.note', target: `shot/${note.shot}`, verdict: 'pending', why: `${N.id}: ${note.problem}` });
  return N;
}
export const jaccard = (a, b) => { const A = new Set(a), B = new Set(b), u = new Set([...A, ...B]).size; return u ? [...A].filter((x) => B.has(x)).length / u : 0; };
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w ]+/g, ' ').replace(/\s+/g, ' ').trim();
export function consensus(notes, { theta = config().theta, quorum = config().quorum } = {}) {
  const groups = new Map();
  for (const n of notes) { const k = `${n.shot}|${n.tag ?? norm(n.problem)}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(n); }
  return [...groups].map(([key, G]) => {
    const ev = new Map();                                                        // evidencia por revisor (unión de sus notas del grupo)
    for (const n of G) ev.set(n.agent, [...new Set([...(ev.get(n.agent) ?? []), ...n.evidence])]);
    const picked = [];                                                           // revisores con evidencias independientes por pares (orden estable)
    for (const a of [...ev.keys()].sort()) if (picked.every((p) => jaccard(ev.get(p), ev.get(a)) < theta)) picked.push(a);
    return { key, shot: G[0].shot, notes: G.map((n) => n.id), reviewers: picked, independent: picked.length, consensus: picked.length >= quorum };
  });
}

// ── 7. brief: resumen determinista ≤ briefTokens (estado, nunca historial) ───────────────────────────────────────────
export const tokens = (s) => Math.ceil(s.length / 4);
export function brief(agent, task, { budget = config().briefTokens } = {}) {
  const H = currentHashes(), gdef = Object.keys(readJSON(abs('gates.json')) ?? {}).filter((k) => !k.startsWith('_')), GS = readJSON(abs('out/gates.json')) ?? {};
  const gates = gdef.map((g) => `${g}=${GS[g] ? GS[g].status + (GS[g].status !== 'reopened' && !isFresh(GS[g], H) ? '(caducado)' : '') : '—'}`).join(' ');
  const shot = (id) => {
    const v = readJSON(vFile(id)), fz = isFrozen('shot/' + id) ? '❄' : '';
    if (!v) return `${id}${fz} —`; if (!isFresh(v, H)) return `${id}${fz} caducado`;
    const f = fixes(v); return `${id}${fz} ${v.verdict}${f.length ? `(${f.length}:${[...new Set(f.map(keyOf))].join(',')})` : ''}`;
  };
  const C = readContract(), P = items(PROPS()).filter((p) => p.status === 'pending'), N = items(NOTES()).filter((n) => n.status === 'pending');
  const cons = consensus(N).filter((c) => c.consensus).map((c) => c.shot);
  const claims = listLocks().filter((L) => !L.expired && !String(L.target).startsWith('orch/')).map((L) => `${L.target}→${L.agent}`).sort();
  const head = [
    `BRIEF ${clip(agent, 40)} · tarea: ${clip(task, 140)}`,
    `film ${H.film} · ${H.order.length} shots · engine ${H.engineHash.slice(0, 8)} · film ${H.filmHash.slice(0, 8)}`,
    `gates: ${gates || '—'}`,
  ];
  const tail = [
    `contratos: ${C ? `${C.status} · ${C.boundaries.length} fronteras · hash ${C.hash.slice(0, 8)}` : 'sin congelar'}`,
    `claims: ${claims.join(' ') || '—'}`,
    `pendiente: ${P.length} propuestas · ${N.length} notas${cons.length ? ` · consenso en ${[...new Set(cons)].join(',')}` : ''}`,
    `rutas: veredictos out/lint/${H.film}/<ID>.json · contratos ${path.relative(ROOT, contractFile())} · propuestas out/proposals/ · notas out/notes/ · escalados out/orch/escalations/ · logs out/logs/`,
    'antes de tocar: node engine/q.mjs impact <ID> · itera: node engine/lint.mjs --shot <ID> · entrega: orch accept <change.json> → orch deliver <entrega.json>',
  ];
  const room = budget * 4 - [...head, ...tail].join('\n').length - 12;
  let sh = 'shots: '; const all = H.order.map(shot);
  for (let i = 0; i < all.length; i++) { const nx = (i ? ' · ' : '') + all[i], more = ` … +${all.length - i - 1}`; if (sh.length + nx.length + (i < all.length - 1 ? more.length : 0) > room) { sh += ` … +${all.length - i}`; break; } sh += nx; }
  let text = [...head, sh, ...tail].join('\n');
  if (tokens(text) > budget) text = text.slice(0, budget * 4 - 1) + '…';
  return text;
}

// ── 8. entrega tipada: la evidencia se re-ejecuta ────────────────────────────────────────────────────────────────────
export function deliver(D) {
  const bad = schemaErrors('delivery', D);
  if (bad.length) { record({ action: 'orch.deliver', target: 'entrega', verdict: 'rejected', why: clip('inválida: ' + bad.join('; '), 140) }); return { ok: false, reasons: bad, results: [] }; }
  const results = D.evidence.map((e) => { const r = runLogged(e.cmd, { lines: 3 }); return { cmd: e.cmd, claimed: e.exit, got: r.status, log: r.log }; });
  const off = results.filter((r) => r.claimed !== r.got), ok = !off.length, reasons = off.map((r) => `"${r.cmd}" dijo exit ${r.claimed}, da ${r.got} (log ${r.log})`);
  record({ action: 'orch.deliver', target: clip(D.summary, 100), hash_after: digest(D), verdict: ok ? 'accepted' : 'rejected', why: ok ? `${results.length} evidencias reproducidas · confianza ${D.confidence}` : clip(reasons.join('; '), 140) });
  return { ok, reasons, results };
}

// ── CLI ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2), dd = argv.indexOf('--'), rest = dd >= 0 ? argv.slice(dd + 1) : [], args = dd >= 0 ? argv.slice(0, dd) : argv;
  const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; }, pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
  const [cmd, a1, a2] = pos, J = (f) => { const v = readJSON(path.resolve(f)); if (!v) die(`no se puede leer JSON de ${f}`); return v; };
  try {
    if (cmd === 'accept') {
      const r = await accept(J(a1));
      for (const l of r.log) console.log(l);
      console.log(`${r.ok ? 'ACEPTADO' : 'RECHAZADO'}  ${r.why}`); process.exit(r.ok ? 0 : 1);
    } else if (cmd === 'freeze') { const C = await freezeContracts(); console.log(`✓ contratos congelados: ${C.boundaries.length} fronteras · hash ${C.hash} → ${path.relative(ROOT, contractFile())}`); }
    else if (cmd === 'contracts') {
      const C = readContract(); if (!C) { console.log('sin contratos (se congelan al cerrar el gate ' + config().contractsGate + ')'); process.exit(0); }
      const v = await contractViolations(); console.log(`contratos ${C.status} · ${C.boundaries.length} fronteras · hash ${C.hash}`);
      for (const x of v) console.log(`FIX   ${String(x.shot).padEnd(6)} ${x.problem}  →  ${x.remedy}`);
      console.log(v.length ? `FIX (${v.length})` : 'OK  contratos respetados'); process.exit(v.length ? 1 : 0);
    } else if (cmd === 'reopen') { reopen(a1, flag('--why')); console.log(`✓ gate ${a1} reabierto: los contratos no obligan hasta volver a cerrarlo`); }
    else if (cmd === 'unfreeze') { unfreeze(a1, flag('--why')); console.log(`✓ ${a1} descongelado`); }
    else if (cmd === 'propose') { const P = propose(a1, J(a2), flag('--why')); console.log(`✓ propuesta ${P.id} sobre ${P.target} (pendiente del Director)`); }
    else if (cmd === 'decide') { const X = await decide(a1, a2, flag('--why')); console.log(`✓ ${X.id} ${X.status}: ${X.decision_why}`); }
    else if (cmd === 'note') { const N = addNote(J(a1)); console.log(`✓ nota ${N.id} (${N.shot})`); }
    else if (cmd === 'list') {
      const P = items(PROPS()), N = items(NOTES());
      if (a1 !== 'notes') for (const p of P) console.log(`${p.id}  ${p.status.padEnd(8)} ${p.agent.padEnd(10)} ${p.target}  · ${clip(p.why, 80)}${p.decision_why ? '  ⇒ ' + clip(p.decision_why, 60) : ''}`);
      if (a1 !== 'proposals') { for (const n of N) console.log(`${n.id}  ${n.status.padEnd(8)} ${n.agent.padEnd(10)} ${n.shot}  ${clip(n.problem, 70)}  [${n.evidence.length} evid.]`); for (const c of consensus(N.filter((n) => n.status === 'pending'))) console.log(`  ${c.consensus ? '● consenso' : '○ sin consenso'}  ${c.key}  (${c.independent} independientes de ${c.notes.length})`); }
    } else if (cmd === 'brief' || cmd === 'status') console.log(brief(cmd === 'brief' ? a1 ?? who().agent : who().agent, cmd === 'brief' ? pos.slice(2).join(' ') || '—' : 'estado'));
    else if (cmd === 'run') { if (!rest.length) die('uso: orch run [--lines N] -- <cmd …>'); const r = runLogged(rest, { lines: +(flag('--lines') ?? config().toolLines) }); console.log(r.text); process.exit(r.status); }
    else if (cmd === 'deliver') {
      const r = deliver(J(a1)); for (const x of r.results) console.log(`  ${x.claimed === x.got ? '✓' : '✗'} ${x.cmd}  (exit ${x.got}, declarado ${x.claimed}) · ${x.log}`);
      console.log(r.ok ? 'ACEPTADO  entrega con evidencia reproducible' : 'RECHAZADO  ' + r.reasons.join('; ')); process.exit(r.ok ? 0 : 1);
    } else if (cmd === 'deps' || cmd === 'impact') { const r = spawnSync(process.execPath, [path.join(ROOT, 'engine/q.mjs'), ...argv], { stdio: 'inherit' }); process.exit(r.status ?? 1); }
    else console.log('Uso: node engine/orch.mjs accept <change.json> | propose <ruta.json> <patch.json> --why "…" | decide <id> accept|reject|apply --why "…"\n  | note <nota.json> | list [proposals|notes] | freeze | contracts | reopen <gate> --why "…" | unfreeze <shot/ID|gate/G> --why "…"\n  | brief <agente> <tarea> | status | run [--lines N] -- <cmd …> | deliver <entrega.json>      (grafo: node engine/q.mjs deps | impact <ID>)');
  } catch (e) { console.error('✗ ' + (e instanceof OrchError ? e.message : e.stack)); process.exit(2); }
}
