#!/usr/bin/env node
// Orquestación F3: cada regla con un test que falla sin ella, y una simulación de 4 agentes (procesos) sobre el demo que
// converge sin regresiones ni oscilación (un agente torpe rompe a un vecino → el trinquete lo rechaza; uno oscila → se congela).
// Corre en copias temporales (nunca toca tus archivos).   node test/orch.mjs [--only nombre] [-v]
import fs from 'node:fs';
import { rootFrom } from '../engine/paths.mjs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = rootFrom(import.meta.url);
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const NODE = process.execPath;
const COPY = ['engine', 'data', 'shots', 'styles', 'assets', 'storyboard', 'gates.json', 'roles.json', 'orch.json', 'package.json'];
const copy = ({ fixture = false, orch = {} } = {}) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'opus-orch-'));
  for (const e of COPY) if (fs.existsSync(path.join(ROOT, e))) fs.cpSync(path.join(ROOT, e), path.join(d, e), { recursive: true });
  fs.rmSync(path.join(d, 'data/autocam'), { recursive: true, force: true });
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(d, 'node_modules'));
  if (fixture) { const fx = path.join(ROOT, 'test/fixtures/showcase'); for (const f of fs.readdirSync(path.join(fx, 'shots'))) fs.copyFileSync(path.join(fx, 'shots', f), path.join(d, 'shots', f)); fs.copyFileSync(path.join(fx, 'timeline.json'), path.join(d, 'data/fixture.json')); }
  fs.writeFileSync(path.join(d, 'orch.json'), JSON.stringify({ ...JSON.parse(fs.readFileSync(path.join(ROOT, 'orch.json'), 'utf8')), ...orch }));
  return d;
};
const rm = (d) => fs.rmSync(d, { recursive: true, force: true });
const run = (d, args, env = {}) => spawnSync(NODE, args, { cwd: d, encoding: 'utf8', env: { ...process.env, ...env }, timeout: 600000 });
const runP = (d, args, env = {}) => new Promise((res) => { const p = spawn(NODE, args, { cwd: d, env: { ...process.env, ...env } }); let out = ''; p.stdout.on('data', (b) => (out += b)); p.stderr.on('data', (b) => (out += b)); p.on('close', (status) => res({ status, out })); });
const J = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const W = (d, f, v) => { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), typeof v === 'string' ? v : JSON.stringify(v)); return f; };
const ledger = (d) => (fs.existsSync(path.join(d, 'out/ledger.jsonl')) ? fs.readFileSync(path.join(d, 'out/ledger.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const imp = (d, m) => import(path.join(d, 'engine', m) + `?${Math.random()}`);
const DIR = { OPUS_AGENT: 'dora', OPUS_ROLE: 'director' };
for (const k of ['OPUS_TIMELINE', 'OPUS_STYLE', 'OPUS_PROFILE', 'OPUS_EDIT', 'OPUS_AGENT', 'OPUS_ROLE', 'OPUS_ROLES_MODE']) delete process.env[k];

let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('  ✗ orch:', m); } };
const T = [];
const test = (name, fn) => T.push({ name, fn });
const issue = (shot, check, level = 'FIX') => ({ level, check, shot, t: 0, problem: `${check} roto`, remedy: '' });
const V = (...iss) => ({ verdict: iss.some((i) => i.level === 'FIX') ? 'FIX' : 'SHIP', issues: iss });

// ── 3. grafo de dependencias y plan ─────────────────────────────────────────────────────────────────────────────────
test('deps', async () => {
  const d = copy({ fixture: true });
  try {
    let r = run(d, ['engine/q.mjs', 'deps', '--json']), G = JSON.parse(r.stdout);
    const has = (f, t, k) => G.edges.some((e) => e.from === f && e.to === t && e.kind === k);
    ok(r.status === 0 && ['handoff', 'after', 'chain', 'import'].every((k) => has('A1', 'A2', k) && has('A2', 'A3', k)), 'deps: aristas handoff, after, cam.chain e import entre shots');
    ok(JSON.stringify(G.plan) === '[["A1"],["A2"],["A3"]]', 'deps: con dependencias → orden topológico ' + JSON.stringify(G.plan));
    r = run(d, ['engine/q.mjs', 'impact', 'A3', '--json']); let I = JSON.parse(r.stdout);
    ok(I.changed.join() === 'A3' && I.relint.join() === 'A2,A3' && I.cover.join() === 'A3', 'impact A3: cambia A3, re-lintea A2+A3 con un solo lint --shot A3');
    I = JSON.parse(run(d, ['engine/q.mjs', 'impact', 'A1', '--json']).stdout);
    ok(I.changed.join() === 'A1,A2,A3' && I.cover === null, 'impact A1: A2 y A3 importan A1 → cambian todos → lint completo');
    I = JSON.parse(run(d, ['engine/q.mjs', 'impact', 'styles/editorial.json', '--json']).stdout);
    ok(I.relint.length === 3, 'impact de un estilo compartido: todos los shots');
    const F = { OPUS_TIMELINE: 'data/fixture.json' };
    G = JSON.parse(run(d, ['engine/q.mjs', 'deps', '--json'], F).stdout);
    ok(G.edges.length === 0 && G.plan.length === 1 && G.plan[0].length === 5, 'deps (fixture): sin dependencias → un solo nivel en paralelo');
    I = JSON.parse(run(d, ['engine/q.mjs', 'impact', 'S3', '--json'], F).stdout);
    ok(I.changed.join() === 'S3' && I.relint.join() === 'S2,S3,S4' && I.cover.join() === 'S3', 'impact S3 (fixture): S3 + vecinos, no el film entero');
    const tl = J(path.join(d, 'data/timeline.json')); tl.shots[0].after = 'A3'; W(d, 'data/ciclo.json', tl);
    r = run(d, ['engine/q.mjs', 'deps'], { OPUS_TIMELINE: 'data/ciclo.json' });
    ok(r.status === 2 && /ciclo/.test(r.stderr), 'deps: un ciclo de dependencias es un error');
  } finally { rm(d); }
});

// ── 4. trinquete (puro) ─────────────────────────────────────────────────────────────────────────────────────────────
test('trinquete', async () => {
  const O = await imp(ROOT, 'orch.mjs');
  const base = { A1: V(), A2: V(issue('A2', 'layout')), A3: V() };
  ok(O.ratchet(base, { A1: V(), A2: V(), A3: V() }, ['A2']).ok, 'trinquete: arreglar el propio shot se acepta');
  ok(O.ratchet(base, { ...base }, ['A2']).ok, 'trinquete: igualar se acepta');
  let r = O.ratchet(base, { A1: V(), A2: V(), A3: V(issue('A3', 'handoffs')) }, ['A2']);
  ok(!r.ok && r.reasons.some((x) => /A3: check "handoffs" pasa de verde a rojo/.test(x)), 'trinquete: arregla lo suyo pero rompe al vecino → rechazado');
  r = O.ratchet(base, { A1: V(), A2: V(issue('A2', 'camera')), A3: V() }, ['A2']);
  ok(!r.ok && /camera/.test(r.reasons.join()), 'trinquete: cambiar un FIX por otro en un check que estaba verde → rechazado');
  r = O.ratchet(base, { A1: V(), A2: V(issue('A2', 'layout'), issue('A2', 'layout')), A3: V() }, ['A2']);
  ok(!r.ok && /empeora/.test(r.reasons.join()) && /global sube: 1→2/.test(r.reasons.join()), 'trinquete: más FIX en el propio shot y en el global → rechazado');
  ok(!O.ratchet(base, { A1: V(), A2: V(), A3: null }, ['A2']).ok, 'trinquete: sin veredicto vigente después = rojo');
});

// ── 5. anti-oscilación (puro + ledger) y presupuesto de gates ─────────────────────────────────────────────────────────
test('oscilacion', async () => {
  const d = copy();
  try {
    const O = await imp(d, 'orch.mjs'), E = O.problemsOf(V());
    const h = [{ hash: 'aaaa', problems: 'p1' }, { hash: 'bbbb', problems: 'p2' }];
    ok(/A→B→A/.test(O.oscillation(h, { hash: 'aaaa' })), 'oscilación: volver a un shotHash ya superado (A→B→A)');
    ok(!O.oscillation(h, { hash: 'bbbb' }) && !O.oscillation(h, { hash: 'cccc', problems: 'p3' }), 'oscilación: estado actual o nuevo no lo es');
    ok(/problemas/.test(O.oscillation(h, { hash: 'cccc', problems: 'p1' })) && !O.oscillation([{ hash: 'a', problems: E }, { hash: 'b', problems: 'x' }], { hash: 'c', problems: E }), 'oscilación: reaparece un conjunto de problemas (pero volver a SHIP no cuenta)');
    const L = await imp(d, 'ledger.mjs'), st = (verdict, why = 'FIX 1') => L.record({ action: 'orch.state', target: 'shot/A2', hash_before: 'abcdef12', hash_after: 'abcdef12', verdict, why });
    st('base'); st('rejected'); st('accepted'); ok(O.budgetUsed('A2') === 2, 'presupuesto: rechazos y aceptados aún en FIX gastan intentos');
    st('accepted', 'FIX 0'); ok(O.budgetUsed('A2') === 0, 'presupuesto: llegar a SHIP lo repone');
    L.record({ action: 'orch.freeze', target: 'shot/A2', verdict: 'frozen', why: 'test' });
    W(d, 'out/c.json', { why: 'mejora', files: { 'shots/A2.mjs': fs.readFileSync(path.join(d, 'shots/A2.mjs'), 'utf8') + '\n//x\n' } });
    let r = run(d, ['engine/orch.mjs', 'accept', 'out/c.json'], { OPUS_AGENT: 'bob', OPUS_ROLE: 'animator:A2' });
    ok(r.status === 1 && /congelado/.test(r.stdout), 'shot congelado: el animator no puede cambiarlo ' + r.stdout.slice(-200));
    r = run(d, ['engine/orch.mjs', 'unfreeze', 'shot/A2', '--why', 'yo decido'], { OPUS_AGENT: 'bob', OPUS_ROLE: 'animator:A2' });
    ok(r.status === 2 && O.isFrozen('shot/A2'), 'unfreeze: solo el Director');
    r = run(d, ['engine/orch.mjs', 'unfreeze', 'shot/A2', '--why', 'nuevo enfoque acordado'], DIR);
    ok(r.status === 0 && !O.isFrozen('shot/A2') && O.budgetUsed('A2') === 0, 'unfreeze del Director: descongela y repone el presupuesto');
    // gates: 2 cierres fallidos seguidos → congelado
    W(d, 'out/exit3.mjs', 'process.exit(3)'); W(d, 'gates.json', { no: [{ criterion: 'nunca', argv: ['node', 'out/exit3.mjs'] }] });
    run(d, ['engine/gate.mjs', 'close', 'no']); run(d, ['engine/gate.mjs', 'close', 'no']);
    r = run(d, ['engine/gate.mjs', 'close', 'no']);
    ok(r.status === 2 && /congelado/.test(r.stderr) && ledger(d).some((e) => e.action === 'gate.frozen'), 'gate: agotado el presupuesto (2) no se reintenta: se congela y escala');
    run(d, ['engine/orch.mjs', 'unfreeze', 'gate/no', '--why', 'criterio corregido'], DIR);
    r = run(d, ['engine/gate.mjs', 'close', 'no']); ok(r.status === 1, 'gate: el Director lo descongela y se puede volver a intentar');
  } finally { rm(d); }
});

// ── 1+2. un escritor por artefacto, propuestas, contratos congelados ──────────────────────────────────────────────────
test('contratos', async () => {
  const d = copy();
  try {
    const AN = { OPUS_AGENT: 'tor', OPUS_ROLE: 'animator:A2' }, tl0 = fs.readFileSync(path.join(d, 'data/timeline.json'), 'utf8');
    W(d, 'out/ok.mjs', 'process.exit(0)'); W(d, 'gates.json', { animatic: [{ criterion: 'ok', argv: ['node', 'out/ok.mjs'] }] });
    let r = run(d, ['engine/gate.mjs', 'close', 'animatic'], DIR);
    const C = J(path.join(d, 'out/contracts/main.json'));
    ok(r.status === 0 && C.status === 'frozen' && /^[0-9a-f]{16}$/.test(C.hash) && C.boundaries.length === 2, 'contratos: cerrar el animatic congela una frontera por corte, con hash ' + r.stdout.slice(-300));
    const b = C.boundaries[1];
    ok(b.from === 'A2' && b.to === 'A3' && b.t === 4 && b.cam && b.handoffs[0].entity === 'dot' && typeof b.handoffs[0].state?.x === 'number', 'contratos: t de corte, cámara de salida y estado de la entidad de handoff');
    ok(ledger(d).some((e) => e.action === 'contract.freeze' && e.hash_after === C.hash), 'contratos: el congelado queda en el ledger');
    r = run(d, ['engine/lint.mjs', '--only', 'contracts']); ok(r.status === 0, 'contratos: el estado congelado los cumple');
    const a2 = path.join(d, 'shots/A2.mjs'), src = fs.readFileSync(a2, 'utf8');
    fs.writeFileSync(a2, src.replace('default: 0.35, semantic', 'default: 0.1, semantic'));
    r = run(d, ['engine/lint.mjs', '--only', 'contracts']); let L = J(path.join(d, 'out/lint/main/_only-contracts.json'));
    ok(r.status === 1 && ['A2', 'A3'].every((s) => L.issues.some((i) => i.shot === s && i.check === 'contracts' && i.level === 'FIX')), 'contratos: mover la entidad de handoff de A2 da FIX en A2 y en su vecino A3');
    fs.writeFileSync(a2, src);
    const cf = path.join(d, 'out/contracts/main.json'), craw = fs.readFileSync(cf, 'utf8'), T = J(cf); T.boundaries[0].t = 9; fs.writeFileSync(cf, JSON.stringify(T));
    r = run(d, ['engine/lint.mjs', '--only', 'contracts']); ok(r.status === 1 && /alterado/.test(r.stdout), 'contratos: editar el contrato a mano rompe su hash → FIX');
    fs.writeFileSync(cf, craw);
    // regla 1: el animator no escribe el timeline; propone un JSON Patch y decide el Director
    const tl = J(path.join(d, 'data/timeline.json')); tl.shots[1].t[1] = 4.5; tl.shots[2].t[0] = 4.5;
    W(d, 'out/x.json', { why: 'alargar A2', files: { 'data/timeline.json': JSON.stringify(tl, null, 2) } });
    r = run(d, ['engine/orch.mjs', 'accept', 'out/x.json'], AN);
    ok(r.status === 1 && /no eres su escritor/.test(r.stdout) && fs.readFileSync(path.join(d, 'data/timeline.json'), 'utf8') === tl0, 'un escritor: el animator no puede aceptar un cambio al timeline');
    W(d, 'out/p.json', [{ op: 'test', path: '/shots/1/t/1', value: 4 }, { op: 'replace', path: '/shots/1/t/1', value: 4.5 }, { op: 'replace', path: '/shots/2/t/0', value: 4.5 }]);
    r = run(d, ['engine/orch.mjs', 'propose', 'data/timeline.json', 'out/p.json', '--why', 'A2 necesita medio segundo más'], AN);
    const pid = /propuesta (p-\w+)/.exec(r.stdout)?.[1], P = pid && J(path.join(d, `out/proposals/${pid}.json`));
    ok(r.status === 0 && P?.status === 'pending' && P.agent === 'tor' && P.base, 'propuesta: JSON Patch en out/proposals/ con base y autor');
    r = run(d, ['engine/orch.mjs', 'decide', pid, 'accept', '--why', 'vale'], AN); ok(r.status === 2 && /Director/.test(r.stderr), 'propuesta: solo el Director decide');
    r = run(d, ['engine/orch.mjs', 'decide', pid, 'accept'], DIR); ok(r.status === 2 && /motivo/.test(r.stderr), 'propuesta: decidir exige motivo');
    r = run(d, ['engine/orch.mjs', 'decide', pid, 'accept', '--why', 'el ritmo lo pide'], DIR);
    ok(r.status === 2 && /contrato/.test(r.stderr) && fs.readFileSync(path.join(d, 'data/timeline.json'), 'utf8') === tl0 && J(path.join(d, `out/proposals/${pid}.json`)).status === 'pending', 'contratos: mover un corte congelado se bloquea (el timeline queda intacto)');
    r = run(d, ['engine/orch.mjs', 'reopen', 'animatic', '--why', 'x'], AN); ok(r.status === 2, 'reabrir un gate: solo el Director');
    r = run(d, ['engine/orch.mjs', 'reopen', 'animatic', '--why', 'reajuste de ritmo en A2'], DIR);
    ok(r.status === 0 && ledger(d).some((e) => e.action === 'gate.reopen' && e.why === 'reajuste de ritmo en A2') && J(path.join(d, 'out/gates.json')).animatic.status === 'reopened', 'reabrir el gate queda en el ledger');
    r = run(d, ['engine/orch.mjs', 'decide', pid, 'accept', '--why', 'el ritmo lo pide'], DIR);
    ok(r.status === 0 && J(path.join(d, 'data/timeline.json')).shots[1].t[1] === 4.5 && J(path.join(d, `out/proposals/${pid}.json`)).decision_why === 'el ritmo lo pide', 'con el gate reabierto, el Director acepta y el parche se aplica');
    r = run(d, ['engine/lint.mjs', '--only', 'contracts']); ok(r.status === 0, 'contratos reabiertos: no obligan hasta volver a cerrar el gate');
    W(d, 'out/p2.json', [{ op: 'replace', path: '/title', value: 'otro' }]);
    const p2 = /propuesta (p-\w+)/.exec(run(d, ['engine/orch.mjs', 'propose', 'data/timeline.json', 'out/p2.json', '--why', 'título'], AN).stdout)?.[1];
    const p3 = /propuesta (p-\w+)/.exec(run(d, ['engine/orch.mjs', 'propose', 'data/timeline.json', 'out/p2.json', '--why', 'título bis'], AN).stdout)?.[1];
    run(d, ['engine/orch.mjs', 'decide', p2, 'reject', '--why', 'el título es del brief'], DIR);
    ok(J(path.join(d, `out/proposals/${p2}.json`)).status === 'rejected' && ledger(d).some((e) => e.action === 'orch.decide' && e.verdict === 'rejected' && e.why === 'el título es del brief'), 'propuesta rechazada queda con motivo');
    W(d, 'out/p4.json', [{ op: 'replace', path: '/bpm', value: 121 }]);
    const p4 = /propuesta (p-\w+)/.exec(run(d, ['engine/orch.mjs', 'propose', 'data/timeline.json', 'out/p4.json', '--why', 'tempo'], AN).stdout)?.[1];
    run(d, ['engine/orch.mjs', 'decide', p4, 'accept', '--why', 'ok tempo'], DIR);
    r = run(d, ['engine/orch.mjs', 'decide', p3, 'accept', '--why', 'de acuerdo'], DIR);
    ok(r.status === 2 && J(path.join(d, `out/proposals/${p3}.json`)).status === 'stale', 'propuesta sobre una base vieja: obsoleta, no se aplica a ciegas');
  } finally { rm(d); }
});

// ── 6. críticos: diagnóstico sin prescripción, consenso con evidencias independientes ─────────────────────────────────
test('notas', async () => {
  const d = copy();
  try {
    const note = (agent, x) => { const f = W(d, `out/n-${agent}-${Math.random()}.json`, x); return run(d, ['engine/orch.mjs', 'note', f], { OPUS_AGENT: agent, OPUS_ROLE: 'review' }); };
    let r = note('rita', { shot: 'A2', problem: 'el anillo compite con el texto', evidence: ['out/sheets/A2.png#t=3.0'], remedy: 'bajar el glow' });
    ok(r.status === 2 && /campo desconocido/.test(r.stderr), 'nota con arreglo (prescripción) se rechaza');
    ok(note('rita', { shot: 'A2', problem: 'x', evidence: [] }).status === 2, 'nota sin evidencia se rechaza');
    note('rita', { shot: 'A2', tag: 'foco', problem: 'el anillo compite con el texto', evidence: ['sheet:A2@3.0', 'lint:A2:layout'] });
    note('rita', { shot: 'A2', tag: 'foco', problem: 'otra vez lo mismo', evidence: ['sheet:A2@3.5'] });   // mismo revisor: no suma
    note('eco', { shot: 'A2', tag: 'foco', problem: 'el anillo tapa el texto', evidence: ['sheet:A2@3.0', 'lint:A2:layout'] });
    const O = await imp(d, 'orch.mjs'), notes = () => fs.readdirSync(path.join(d, 'out/notes')).map((f) => J(path.join(d, 'out/notes', f)));
    let c = O.consensus(notes(), { theta: 0.5, quorum: 2 });
    ok(c.length === 1 && c[0].notes.length === 3 && !c[0].consensus && c[0].independent === 1, 'consenso: el mismo revisor o evidencias solapadas (eco) no cuentan');
    note('ivo', { shot: 'A2', tag: 'foco', problem: 'en gris el texto se pierde', evidence: ['grey:A2@3.0', 'motion:A2@2.8', 'sheet:A2@3.0'] });
    c = O.consensus(notes(), { theta: 0.5, quorum: 2 });
    ok(c[0].consensus && c[0].independent === 2, 'consenso: dos revisores con evidencias independientes (Jaccard < θ)');
    ok(!O.consensus(notes(), { theta: 0.2, quorum: 2 })[0].consensus, 'consenso: θ configurable (más estricto → no hay consenso)');
    ok(/consenso en A2/.test(run(d, ['engine/orch.mjs', 'brief', 'dora', 'revisión']).stdout), 'brief: muestra dónde hay consenso');
    const id = notes().find((x) => x.agent === 'ivo').id;
    r = run(d, ['engine/orch.mjs', 'decide', id, 'apply', '--why', 'x'], { OPUS_AGENT: 'ivo', OPUS_ROLE: 'review' }); ok(r.status === 2, 'nota: el crítico no decide');
    r = run(d, ['engine/orch.mjs', 'decide', id, 'reject', '--why', 'el foco es intencional en el beat 2'], DIR);
    ok(r.status === 0 && J(path.join(d, 'out/notes', id + '.json')).decision_why === 'el foco es intencional en el beat 2', 'nota: el Director rechaza con motivo');
  } finally { rm(d); }
});

// ── 7. contexto por punteros ────────────────────────────────────────────────────────────────────────────────────────
test('brief', async () => {
  const d = copy();
  try {
    run(d, ['-e', "import('./engine/ledger.mjs').then(m=>m.record({action:'x',why:'HISTORIAL-SECRETO'}))"]);
    const a = run(d, ['engine/orch.mjs', 'brief', 'ana', 'arreglar A3']).stdout, b = run(d, ['engine/orch.mjs', 'brief', 'ana', 'arreglar A3']).stdout;
    ok(a === b && a.includes('BRIEF ana') && /gates: /.test(a) && /shots: A1/.test(a) && /out\/lint\/main/.test(a), 'brief: determinista, con gates, veredictos por shot y rutas');
    ok(!a.includes('HISTORIAL-SECRETO') && Math.ceil(a.trim().length / 4) <= 500, 'brief: ≤500 tokens y nunca historial');
    const tl = J(path.join(d, 'data/timeline.json')), sh = tl.shots[0];
    tl.shots = Array.from({ length: 80 }, (_, i) => ({ ...sh, id: 'PLANO_LARGO_' + String(i).padStart(3, '0'), t: [i * 0.5, i * 0.5 + 0.5], after: null }));
    tl.duration = 40; tl.handoffs = []; W(d, 'data/largo.json', tl);
    const L = run(d, ['engine/orch.mjs', 'brief', 'ana', 'x'.repeat(400)], { OPUS_TIMELINE: 'data/largo.json' }).stdout;
    ok(Math.ceil(L.trim().length / 4) <= 500 && /… \+\d+/.test(L) && /rutas:/.test(L), `brief: con 80 shots sigue ≤500 tokens (${Math.ceil(L.trim().length / 4)}) y conserva las rutas`);
    const r = run(d, ['engine/orch.mjs', 'run', '--lines', '5', '--', NODE, '-e', "for(let i=0;i<100;i++)console.log('linea '+i);console.log('FIX (3)  [x]');process.exit(1)"]);
    const lp = /log: (\S+)/.exec(r.stdout)?.[1];
    ok(r.status === 1 && /^exit 1 · FIX \(3\)/.test(r.stdout) && r.stdout.split('\n').filter((l) => /^linea/.test(l)).length === 5 && /96 líneas más/.test(r.stdout), 'run: veredicto + N líneas, el resto fuera del contexto');
    ok(lp && fs.readFileSync(path.join(d, lp), 'utf8').includes('linea 99'), 'run: la salida completa queda en el log');
  } finally { rm(d); }
});

// ── 8. entrega tipada ───────────────────────────────────────────────────────────────────────────────────────────────
test('entrega', async () => {
  const d = copy();
  try {
    for (const c of [0, 1, 4]) W(d, `out/exit${c}.mjs`, `process.exit(${c})`);
    const D = { summary: 'A3 arreglado', changed: ['shots/A3.mjs'], evidence: [{ cmd: ['node', 'out/exit0.mjs'], exit: 0 }, { cmd: ['node', 'out/exit4.mjs'], exit: 4 }], risks: ['ninguno conocido'], confidence: 0.8, next: ['revisar ritmo'] };
    let r = run(d, ['engine/orch.mjs', 'deliver', W(d, 'out/d1.json', D)]);
    ok(r.status === 0 && /ACEPTADO/.test(r.stdout), 'entrega: evidencia reproducible → aceptada');
    r = run(d, ['engine/orch.mjs', 'deliver', W(d, 'out/d2.json', { ...D, evidence: [{ cmd: ['node', 'out/exit1.mjs'], exit: 0 }] })]);
    ok(r.status === 1 && /dijo exit 0, da 1/.test(r.stdout), 'entrega: exit declarado ≠ real → rechazada');
    const { risks, ...sinRiesgos } = D;
    r = run(d, ['engine/orch.mjs', 'deliver', W(d, 'out/d3.json', sinRiesgos)]); ok(r.status === 1 && /risks/.test(r.stdout), 'entrega: sin campo obligatorio (risks) → rechazada');
    r = run(d, ['engine/orch.mjs', 'deliver', W(d, 'out/d4.json', { ...D, evidence: [] })]); ok(r.status === 1, 'entrega: sin evidencia ejecutable → rechazada');
    ok(ledger(d).filter((e) => e.action === 'orch.deliver').map((e) => e.verdict).join() === 'accepted,rejected,rejected,rejected', 'entrega: cada veredicto queda en el ledger');
  } finally { rm(d); }
});

// ── simulación: 4 agentes (procesos) sobre el demo ───────────────────────────────────────────────────────────────────
const AGENT = `
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileDigest } from './engine/ledger.mjs';
const me = process.env.OPUS_AGENT, res = [], sh = (...a) => spawnSync(process.execPath, a, { encoding: 'utf8', env: process.env });
const wait = (f) => { while (!fs.existsSync(f)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50); };
const log = (step, r) => { res.push({ step, status: r.status, out: (r.stdout + r.stderr).slice(-1500) }); fs.writeFileSync('out/sim/' + me + '.json', JSON.stringify(res, null, 1)); };
let k = 0;
const accept = (step, file, content) => { const f = 'out/sim/' + me + '-' + (k++) + '.json'; fs.writeFileSync(f, JSON.stringify({ id: me + ':' + step, why: step, files: { [file]: content }, base: { [file]: fileDigest(file) } })); log(step, sh('engine/orch.mjs', 'accept', f)); };
const read = (f) => fs.readFileSync(f, 'utf8');
const lintArgs = JSON.parse(read('orch.json')).lintArgs;
if (me === 'dora') {                                                   // Director
  log('gate-animatic', sh('engine/gate.mjs', 'close', 'animatic'));
  log('lint-base', sh('engine/lint.mjs', ...lintArgs));
  fs.writeFileSync('out/sim/go', '');
  for (const a of ['ana', 'tor', 'osc']) wait('out/sim/done-' + a);
  for (const f of fs.readdirSync('out/proposals')) log('decide', sh('engine/orch.mjs', 'decide', f.replace('.json', ''), 'reject', '--why', 'el corte A2→A3 está bajo contrato; no se reabre por ritmo'));
  log('lint-final', sh('engine/lint.mjs', ...lintArgs));
  log('brief', sh('engine/orch.mjs', 'brief', 'dora', 'cierre'));
  fs.writeFileSync('out/sim/entrega.json', JSON.stringify({ summary: 'film convergido', changed: ['shots/A1.mjs', 'shots/A3.mjs'], evidence: [{ cmd: 'node engine/gate.mjs verify', exit: 0 }, { cmd: 'node engine/orch.mjs contracts', exit: 0 }], risks: ['A1 congelado: decidir variante'], confidence: 0.9, next: ['crítico'] }));
  const V = await import('./engine/verdict.mjs'); fs.writeFileSync('out/critic.json', JSON.stringify({ verdict: 'SHIP', ...V.stamp(V.currentHashes()) }));   // el crítico firma el estado final (el master lo exige)
  log('deliver', sh('engine/orch.mjs', 'deliver', 'out/sim/entrega.json'));
} else {
  wait('out/sim/go');
  if (me === 'ana') accept('arreglar-A3', 'shots/A3.mjs', read('out/sim/A3.fixed'));                         // buena: arregla su shot
  if (me === 'tor') {                                                                                         // torpe: rompe al vecino
    accept('mover-anillo', 'shots/A2.mjs', read('shots/A2.mjs').replace('default: 0.35, semantic', 'default: 0.1, semantic'));
    accept('tocar-timeline', 'data/timeline.json', read('data/timeline.json').replace('"at": 4.0', '"at": 3.5'));
    fs.writeFileSync('out/sim/patch.json', JSON.stringify([{ op: 'replace', path: '/handoffs/1/at', value: 3.5 }]));
    log('proponer', sh('engine/orch.mjs', 'propose', 'data/timeline.json', 'out/sim/patch.json', '--why', 'el relevo quedaría mejor antes'));
  }
  if (me === 'osc') {                                                                                         // oscila: A → B → A → B
    const A = read('shots/A1.mjs'), B = A + '\\n// variante B: latido más seco\\n';
    accept('ir-a-B', 'shots/A1.mjs', B); accept('volver-a-A', 'shots/A1.mjs', A); accept('otra-vez-B', 'shots/A1.mjs', B);
  }
  fs.writeFileSync('out/sim/done-' + me, '');
}`;
test('simulacion', async () => {
  const d = copy({ orch: { lintArgs: ['--fps', '4'] } });
  try {
    const a3 = path.join(d, 'shots/A3.mjs'), A3 = fs.readFileSync(a3, 'utf8'), A2 = fs.readFileSync(path.join(d, 'shots/A2.mjs'), 'utf8'), A1 = fs.readFileSync(path.join(d, 'shots/A1.mjs'), 'utf8');
    W(d, 'out/sim/A3.fixed', A3);
    fs.writeFileSync(a3, A3.replace(/("\$shot": "text"\s*\},\s*"x": )\{\s*"\$expr": "dot_x"\s*\}/, '$1 20'));   // estado inicial: A3 (DSL, spec 006) en FIX: texto fuera de safe area
    W(d, 'sim-agent.mjs', AGENT);
    const roles = { dora: 'director', ana: 'animator:A3', tor: 'animator:A2', osc: 'animator:A1' };
    const ps = await Promise.all(Object.entries(roles).map(([a, r]) => runP(d, ['sim-agent.mjs'], { OPUS_AGENT: a, OPUS_ROLE: r })));
    ok(ps.every((p) => p.status === 0), 'simulación: los 4 procesos terminan ' + ps.map((p) => p.out.slice(-300)).join(' | '));
    const R = Object.fromEntries(Object.keys(roles).map((a) => [a, Object.fromEntries((fs.existsSync(path.join(d, `out/sim/${a}.json`)) ? J(path.join(d, `out/sim/${a}.json`)) : []).map((x) => [x.step, x]))]));
    const say = (a, s) => `${a}/${s}: ${R[a][s]?.out?.slice(-400)}`;
    ok(R.dora['gate-animatic']?.status === 0 && fs.existsSync(path.join(d, 'out/contracts/main.json')), 'sim: el Director cierra el animatic y congela contratos ' + say('dora', 'gate-animatic'));
    ok(R.dora['lint-base']?.status === 1, 'sim: línea base en FIX (A3 roto)');
    ok(R.ana['arreglar-A3']?.status === 0 && fs.readFileSync(a3, 'utf8') === A3, 'sim: la buena arregla A3 → aceptado ' + say('ana', 'arreglar-A3'));
    ok(R.tor['mover-anillo']?.status === 1 && /A3: check "contracts" pasa de verde a rojo/.test(R.tor['mover-anillo'].out) && fs.readFileSync(path.join(d, 'shots/A2.mjs'), 'utf8') === A2, 'sim: el torpe rompe al vecino A3 → el trinquete lo rechaza y A2 queda intacto ' + say('tor', 'mover-anillo'));
    ok(R.tor['tocar-timeline']?.status === 1 && /no eres su escritor/.test(R.tor['tocar-timeline'].out), 'sim: el torpe no puede escribir el timeline');
    ok(R.tor.proponer?.status === 0 && R.dora.decide?.status === 0, 'sim: propone un parche y el Director lo rechaza con motivo');
    ok(R.osc['ir-a-B']?.status === 0 && R.osc['volver-a-A']?.status === 1 && /A→B→A/.test(R.osc['volver-a-A'].out) && R.osc['otra-vez-B']?.status === 1 && /congelado/.test(R.osc['otra-vez-B'].out), 'sim: el que oscila se congela en A→B→A y no puede seguir ' + say('osc', 'volver-a-A'));
    const esc = path.join(d, 'out/orch/escalations/A1.json');
    ok(fs.existsSync(esc) && /variante B/.test(J(esc).diff) && ledger(d).some((e) => e.action === 'orch.escalate' && e.target === 'shot/A1'), 'sim: escalado al Director con el diff');
    ok(fs.readFileSync(path.join(d, 'shots/A1.mjs'), 'utf8') !== A1, 'sim: A1 queda en el último estado aceptado (B), no vuelve atrás');
    ok(R.dora['lint-final']?.status === 0 && J(path.join(d, 'out/lint.json')).verdict === 'SHIP', 'sim: converge — lint final SHIP ' + say('dora', 'lint-final'));
    ok(R.dora.deliver?.status === 0, 'sim: entrega del Director con evidencia reproducible ' + say('dora', 'deliver'));
    // monotonía: ningún cambio aceptado sube el FIX global; ningún shot repite un estado aceptado (sin oscilación)
    const acc = ledger(d).filter((e) => e.action === 'orch.accept' && e.verdict === 'accepted').map((e) => /FIX (\d+)→(\d+)/.exec(e.why)).map((m) => [+m[1], +m[2]]);
    ok(acc.length === 2 && acc.every(([b, a]) => a <= b), 'sim: cada cambio aceptado deja el FIX global igual o menor ' + JSON.stringify(acc));
    const states = ledger(d).filter((e) => e.action === 'orch.state' && ['base', 'accepted'].includes(e.verdict));
    ok(['A1', 'A3'].every((s) => { const h = states.filter((e) => e.target === 'shot/' + s).map((e) => e.hash_before); return new Set(h).size === h.length; }), 'sim: ningún shot repite un estado aceptado');
    ok(ledger(d).filter((e) => e.action === 'orch.accept').length === 6, 'sim: todo intento queda en el ledger');
  } finally { rm(d); }
});

for (const t of T.filter((x) => !only || x.name === only)) {
  const b0 = bad, t0 = Date.now();
  try { await t.fn(); } catch (e) { ok(false, `${t.name}: ${e.stack}`); }
  if (process.argv.includes('-v')) console.log(`  ${bad === b0 ? '·' : '✗'} ${t.name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
console.log(`${bad ? '✗' : '✓'} orquestación   ${n - bad}/${n}`); process.exit(bad ? 1 : 0);
