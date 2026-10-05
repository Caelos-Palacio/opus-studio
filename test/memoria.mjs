#!/usr/bin/env node
// Memoria conceptual (docs/MEMORIA.md): estado(t) con decaimiento/refuerzo/reinterpretación, lint conceptual por
// mutación, capa de dirección determinista y explicable, y CLI. Puro: sin render, sin copia del repo.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import * as M from '../engine/memoria.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let fail = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? '✓' : '✗'} memoria: ${name}${cond ? '' : '  ' + extra}`); if (!cond) fail++; };
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const near = (a, b, e = 2e-3) => Math.abs(a - b) <= e;
const FX = 'test/fixtures/memoria/adapta.memoria.json', fx = rd(FX), fctx = M.contexto(fx), demo = rd('data/memoria.json'), dctx = M.contexto(demo);
const fixes = (L) => L.filter((i) => i.level === 'FIX'), has = (L, re, level = 'FIX') => L.some((i) => i.level === level && re.test(`${i.problem} → ${i.remedy}`));

// 1) esquema
ok('demo y fixture validan el esquema', !M.validateMemoria(demo).length && !M.validateMemoria(fx).length, JSON.stringify(M.validateMemoria(demo)));
{ const m = clone(fx); m.conceptos[0].kind = 'entidda'; m.relaciones[0].tipo = 'cuasa';
  const L = M.validateMemoria(m); ok('esquema: kind/tipo mal escritos → FIX con ruta y sugerencia', has(L, /\/conceptos\/0\/kind.*"entidad"/) && has(L, /\/relaciones\/0\/tipo.*"causa"/), JSON.stringify(L)); }

// 2) estado(t): decaimiento exponencial, refuerzo por reaparición, piso, preguntas sin decaer
const syn = (extra = {}) => ({ version: 1, memoria: { vidaMedia: 2, piso: 0, umbral: 0.01 }, conceptos: [{ id: 'x', label: 'x', kind: 'entidad', saliencia: 1, refuerzos: [0], ...extra }] });
const sctx = { duration: 100, shots: [{ id: 'P', t: [0, 3] }], entities: new Set(), params: new Map() };
ok('decay: vida media exacta (1 → 0,5 → 0,25)', M.peso(syn(), 'x', 0, sctx) === 1 && near(M.peso(syn(), 'x', 2, sctx), 0.5) && near(M.peso(syn(), 'x', 4, sctx), 0.25));
ok('decay: antes de aparecer pesa 0', M.peso(syn({ refuerzos: [5] }), 'x', 4, sctx) === 0);
const re = syn({ refuerzos: [0, 2] });
ok('refuerzo: reaparecer sube el peso (1−Π(1−cᵢ))', near(M.peso(re, 'x', 4, sctx), 1 - (1 - 0.25) * (1 - 0.5)) && M.peso(re, 'x', 4, sctx) > M.peso(syn(), 'x', 4, sctx));
const pr = syn({ refuerzos: [], anclas: [{ shot: 'P' }] });
ok('presencia: en pantalla no decae; decae desde que sale', M.peso(pr, 'x', 2.9, sctx) === 1 && near(M.peso(pr, 'x', 5, sctx), 0.5));
const dup = syn({ refuerzos: [], anclas: [{ shot: 'P' }, { t: [0, 3] }] });
ok('presencia: dos anclas al mismo plano son una huella', near(M.peso(dup, 'x', 5, sctx), 0.5));
const pi = syn(); pi.memoria.piso = 0.1;
ok('piso: lo visto no se olvida del todo', near(M.peso(pi, 'x', 100, sctx), 0.1));
const q = syn({ kind: 'pregunta', saliencia: 0.6, refuerzos: [], abre: 1, resuelve: { t: 10, por: 'x' } });
ok('pregunta abierta no decae (Zeigarnik) y decae tras resolverse', M.peso(q, 'x', 9.9, sctx) === 0.6 && M.peso(q, 'x', 14, sctx) < 0.6 && M.peso(q, 'x', 14, sctx) > 0);

// 3) reinterpretación retroactiva (fixture "regla que se adapta")
const at = (E, id) => E.activos.find((a) => a.id === id);
const E15 = M.estado(fx, 15, fctx), E45 = M.estado(fx, 45, fctx);
ok('t=15: el espectador cree que es daño', at(E15, 'golpes')?.lectura === 'cada corte lo hiere: el atacante va ganando' && !at(E15, 'golpes').por);
ok('t=15: pregunta abierta "¿por qué gira la rueda?"', E15.preguntas.map((x) => x.id).join() === 'por-que-gira');
ok('t=15: el director sabe lo que el espectador aún no (pendientes)', E15.pendientes.map((p) => p.id).sort().join() === 'aprendizaje,reloj');
ok('t=45: la lectura vigente es la reinterpretada', at(E45, 'golpes')?.lectura.startsWith('cada corte era una lección') && at(E45, 'golpes').por === 'aprendizaje');
const R5 = E45.recuerdo.find((r) => r.concepto === 'golpes');
ok('t=45: el tramo [5,20] se recuerda distinto (antes → después)', R5 && R5.tramo.join() === '5,20' && R5.antes.startsWith('cada corte lo hiere') && R5.por === 'aprendizaje');
const fin = M.final(fx, fctx), r20 = fin.recuerdo.find((r) => r.concepto === 'golpes' && r.tramo[0] === 20);
ok('final: lo no reinterpretado conserva su lectura', r20 && r20.lectura === 'los cortes cuestan más: resiste' && !r20.por);
ok('final: preguntas cerradas, la de la tensión también', !fin.preguntas.length);
ok('giro = recuerdo: el objetivo se refuerza al reinterpretarse', M.peso(fx, 'golpes', 40, fctx) > M.peso(fx, 'golpes', 39.99, fctx));
ok('en el tramo, antes del giro, la lectura no cambia (sin spoilers)', M.estado(fx, 39.9, fctx).recuerdo.length === 0);
const pq = M.porQue(fx, 'contra-adaptacion', fctx);
ok('por qué: cadena causal hacia atrás (amenaza ← adaptación ← golpes)', ['amenaza', 'adaptacion', 'golpes'].every((id) => pq.causas.some((c) => c.de === id)), JSON.stringify(pq.causas));
ok('demo: en t=5 el punto ya se relee como semilla del marco', M.estado(demo, 5, dctx).recuerdo.some((r) => r.concepto === 'idea' && r.por === 'semilla'));

// 4) lint conceptual
ok('lint: fixture limpio (ni FIX ni WARN)', !M.lintMemoria(fx, fctx).length, JSON.stringify(M.lintMemoria(fx, fctx)));
ok('lint: demo sin FIX', !fixes(M.lintMemoria(demo, dctx)).length, JSON.stringify(fixes(M.lintMemoria(demo, dctx))));
ok('lint: demo verifica sus anclas param contra los params reales de A3 (sin WARN de "no verificable")', !has(M.lintMemoria(demo, dctx), /no verificable/, 'WARN') && dctx.params.get('A3')?.has('pulse') && dctx.params.get('A3')?.has('textIn'));
const lint = (f) => { const m = clone(fx); f(m); return M.lintMemoria(m, fctx); };
const C = (m, id) => m.conceptos.find((c) => c.id === id);
let L = lint((m) => { const g = C(m, 'golpes'); g.anclas = [{ shot: 'S4' }]; g.estados.shift(); });
ok('payoff sin setup: giro relee un tramo donde no se plantó nada → FIX', has(L, /payoff sin setup: el giro aprendizaje/), JSON.stringify(fixes(L)));
L = lint((m) => { m.reinterpretaciones[0].tramo = [41, 50]; });
ok('payoff: reinterpretar el futuro → FIX', has(L, /reinterpreta el futuro/));
L = lint((m) => { m.conceptos.push({ id: 'sorpresa', label: 'sorpresa', kind: 'revelación', anclas: [{ shot: 'S6' }] }); });
ok('revelación sin nada plantado que releer → FIX', has(L, /revelación «sorpresa» no relee nada/));
L = lint((m) => { C(m, 'golpes').anclas.push({ shot: 'S22' }); });
ok('ancla rota a shot → FIX con sugerencia', has(L, /ancla rota, shot "S22" no existe → ¿quisiste decir "S2"\?/), JSON.stringify(fixes(L)));
L = lint((m) => { C(m, 'adaptacion').anclas.push({ param: '/shots/S5/params/ecco', rol: 'eco' }); });
ok('ancla rota a param → FIX con sugerencia', has(L, /el shot no expone "ecco" → ¿quisiste decir "eco"\?/));
L = lint((m) => { C(m, 'adaptacion').anclas.push({ param: '/shots/S9/params/eco' }); C(m, 'rueda').anclas.push({ entidad: 'ruedaa' }); });
ok('ancla rota a shot de param y a entidad → FIX', has(L, /S9\/params\/eco: shot "S9" no existe/) && has(L, /entidad "ruedaa" no existe → ¿quisiste decir "rueda"\?/));
L = lint((m) => { delete C(m, 'por-que-gira').resuelve; });
ok('pregunta abierta nunca resuelta → FIX', has(L, /pregunta abierta nunca resuelta: «¿por qué gira la rueda\?»/));
L = lint((m) => { delete C(m, 'por-que-gira').resuelve; C(m, 'por-que-gira').abiertaAPropósito = 'final abierto deliberado'; });
ok('pregunta abierta a propósito (con porqué) → sin FIX', !has(L, /nunca resuelta/));
L = lint((m) => { C(m, 'amenaza').resuelve.t = 70; });
ok('pregunta resuelta después del final → FIX', has(L, /después del final/));
L = lint((m) => { m.reinterpretaciones = m.reinterpretaciones.filter((g) => g.id !== 'reloj'); m.relaciones = m.relaciones.filter((r) => r.id !== 'contador'); });
ok('setup sin payoff (planta sin cosecha) → WARN', has(L, /setup sin payoff: «rueda»/, 'WARN') && !fixes(L).length, JSON.stringify(L));
L = lint((m) => { m.relaciones.push({ tipo: 'causa', de: 'rueda', a: 'golpes' }); });
ok('ciclo causal → FIX', has(L, /ciclo causal: golpes → rueda/), JSON.stringify(fixes(L)));
L = lint((m) => { m.relaciones.push({ tipo: 'depende', de: 'golpes', a: 'rueda' }); });
ok('ciclo causal vía "depende" (A depende de B = B causa A) → FIX', has(L, /ciclo causal/));
L = lint((m) => { m.conceptos.push({ id: 'suelto', label: 'nada lo encarna', kind: 'tema' }); });
ok('concepto huérfano → FIX', has(L, /concepto huérfano/));
L = lint((m) => { m.relaciones.push({ tipo: 'rima', de: 'golpes', a: 'adaptacon' }); });
ok('relación a concepto inexistente → FIX con sugerencia', has(L, /"adaptacon" no existe → ¿quisiste decir "adaptacion"\?/));

// 5) dirección → capa (determinista, explicable, aplicable)
const D1 = M.dirigir(fx, fctx), txt = M.capaJSON(D1.capa);
const shuffled = clone(fx); shuffled.conceptos.reverse(); shuffled.relaciones.reverse(); shuffled.reinterpretaciones.reverse(); shuffled.conceptos.forEach((c) => c.anclas?.reverse());
ok('capa determinista (dos veces y con el orden de entrada barajado)', txt === M.capaJSON(M.dirigir(fx, fctx).capa) && txt === M.capaJSON(M.dirigir(shuffled, M.contexto(shuffled)).capa));
ok('capa = golden (test/fixtures/memoria/adapta.layer.json)', txt === fs.readFileSync(path.join(ROOT, 'test/fixtures/memoria/adapta.layer.json'), 'utf8'));
ok('contrato de capa {name, priority, ops: RFC6902}', Object.keys(D1.capa).join() === 'name,priority,ops' && D1.capa.ops.every((o) => o.op === 'add' && /^\/shots\/[^/]+\/params\/[^/]+$/.test(o.path) && 'value' in o));
const ids = new Set(fx.conceptos.map((c) => c.id)), rids = new Set(M.reglas(fx).map((r) => r.id));
ok('cada op lleva why, concepto origen y regla', D1.capa.ops.length >= 5 && D1.capa.ops.every((o) => o.why?.length > 10 && !/\{\w+\}/.test(o.why) && o.concepto.split('+').every((c) => ids.has(c)) && rids.has(o.regla)));
const val = (p) => D1.capa.ops.find((o) => o.path === p)?.value;
ok('escala sube la intensidad por paso (S5 ×1,5; S6 ×2)', val('/shots/S5/params/escala') === 1.5 && val('/shots/S6/params/intensidad') === 2);
const eco = val('/shots/S5/params/eco');
ok('reinterpretación pide callback a los planos releídos (S2, S1)', Array.isArray(eco) && eco.map((e) => e.ref).join() === '/shots/S2,/shots/S1' && eco.every((e) => e.fuerza > 0 && e.fuerza <= 1));
ok('callback más fuerte cuanto más olvidado (rueda < golpes en peso)', eco.find((e) => e.concepto === 'rueda').fuerza > eco.find((e) => e.concepto === 'golpes').fuerza);
ok('pregunta abierta retiene la respuesta hasta su resolución (S5: 8 s)', val('/shots/S5/params/revelar_en') === 8);
ok('peso con decay dirige el énfasis (rueda en S4)', val('/shots/S4/params/rueda_brillo') === M.peso(fx, 'rueda', 26, fctx));
ok('intención sin parámetro: visible, nunca inventada', D1.intenciones.some((i) => i.concepto === 'amenaza' && i.sinParam) && !D1.capa.ops.some((o) => o.concepto === 'amenaza' && o.regla === 'pregunta-retencion'));
const doc = { shots: Object.fromEntries(rd(fx.timeline).shots.map((s) => [s.id, { params: { ...(s.params ?? {}) } }])) };
const apply = (d, ops) => { for (const o of ops) { const ks = o.path.split('/').slice(1), last = ks.pop(); let p = d; for (const k of ks) { if (!(k in p)) throw new Error('ruta inexistente ' + o.path); p = p[k]; } p[last] = o.value; } return d; };
let applied = true; try { apply(clone(doc), D1.capa.ops); } catch (e) { applied = e.message; }
ok('la capa se aplica sobre los params declarados (RFC 6902 add)', applied === true, applied);
const ov = clone(fx); ov.direccion = { reglas: [{ id: 'escala-intensidad', ganancia: 1 }, { id: 'giro-hold', off: true }] };
const Dov = M.dirigir(ov, fctx);
ok('reglas declarativas: re-parametrizar (ganancia) y desactivar (off) desde memoria.json', Dov.capa.ops.find((o) => o.path === '/shots/S5/params/escala').value === 2 && !Dov.capa.ops.some((o) => o.regla === 'giro-hold'));
const cf = clone(fx); C(cf, 'adaptacion').anclas.push({ param: '/shots/S5/params/eco', rol: 'enfasis' });
ok('conflicto en una ruta: gana la prioridad y se informa', M.dirigir(cf, fctx).conflictos.some((c) => c.path === '/shots/S5/params/eco' && /giro-eco/.test(c.gana) && /peso-enfasis/.test(c.pierde)));

// 6) CLI (engine/memoria.mjs y q.mjs memoria)
const cli = (args, opt = {}) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', ...opt });
let r = cli(['engine/memoria.mjs', 'en', '15', '--mem', FX, '--json']);
ok('CLI en <t> --json', r.status === 0 && JSON.parse(r.stdout).preguntas[0]?.id === 'por-que-gira', r.stderr);
r = cli(['engine/memoria.mjs', 'por', 'qué', 'golpes', '--mem', FX]);
ok('CLI por qué <id> (lecturas en vivo vs recordada + ops)', r.status === 0 && /recordado «cada corte era una lección/.test(r.stdout) && /causa rueda/.test(r.stdout), r.stdout + r.stderr);
r = cli(['engine/memoria.mjs', 'reinterpreta', '--mem', FX]);
ok('CLI reinterpreta', r.status === 0 && /aprendizaje @40s/.test(r.stdout));
r = cli(['engine/memoria.mjs', 'lint']);
ok('CLI lint del demo: PASS (exit 0)', r.status === 0 && /memoria: PASS/.test(r.stdout), r.stdout);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opus-mem-')), bad = clone(fx); delete C(bad, 'por-que-gira').resuelve;
fs.writeFileSync(path.join(tmp, 'm.json'), JSON.stringify(bad));
r = cli(['engine/memoria.mjs', 'lint', '--mem', path.join(tmp, 'm.json')]);
ok('CLI lint con FIX → exit 1', r.status === 1 && /nunca resuelta/.test(r.stdout));
r = cli(['engine/memoria.mjs', 'capa', '--mem', path.join(tmp, 'm.json')]);
ok('CLI capa se niega con lint en FIX', r.status === 1);
const out = path.join(tmp, 'layer.json');
r = cli(['engine/memoria.mjs', 'capa', '--mem', FX, '--write', out]);
const r2 = cli(['engine/memoria.mjs', 'capa', '--mem', FX, '--write', out, '--check']);
fs.writeFileSync(out, '{}');
const r3 = cli(['engine/memoria.mjs', 'capa', '--mem', FX, '--write', out, '--check']);
ok('CLI capa --write / --check detecta capa caducada', r.status === 0 && r2.status === 0 && r3.status === 1 && /CADUCADA/.test(r3.stdout), r.stderr + r2.stdout + r3.stdout);
fs.rmSync(tmp, { recursive: true, force: true });
r = cli(['engine/q.mjs', 'memoria', '5', '--json']);
const Q = r.status === 0 ? JSON.parse(r.stdout) : null;
ok('q memoria: capa conceptual separada de la observada', Q && 'observada' in Q && Q.conceptual?.activos?.some((a) => a.id === 'marco') && !Q.conceptual.activos.some((a) => 'boxes' in a), r.stderr);

process.exit(fail ? 1 : 0);
