#!/usr/bin/env node
// Spec 013 · lint narrativo (N1–N11). Unidades puras de engine/narr.mjs + arc por forma + CLI determinista.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { rootFrom } from '../engine/paths.mjs';
import { checkStory, checkOleada, frescura, discover, effLevel, analyzeAll } from '../engine/narr.mjs';
import { analyze, thresholds, validateStory } from '../engine/arc.mjs';
import { validateStorySchema } from '../engine/inputs.mjs';

const ROOT = rootFrom(import.meta.url);
let fail = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? '✓' : '✗'} narr: ${name}${cond ? '' : '  ' + extra}`); if (!cond) fail++; };
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const V2 = rd('data/story.template.json'), has = (is, c, l) => is.some((i) => i.check === c && (!l || i.level === l));
const D = 45;

// N1 · compatibilidad
for (const f of ['data/mate_papel/story.json', 'data/reel/story.json', 'data/regla/story.json', 'data/stress/story.json']) ok(`N1 ${f} (v1) sigue valiendo`, !validateStorySchema(rd(f)).some((e) => e.level === 'FIX' && !e.path.startsWith('/medium')));   // reel/regla traen medium.name en vez de id (deuda previa a la spec 013)
ok('N1 la plantilla v2 valida y no da FIX narrativo', !validateStorySchema(V2).some((e) => e.level === 'FIX') && !checkStory(V2, { duration: D }).some((i) => i.level === 'FIX'), JSON.stringify(checkStory(V2, { duration: D }).filter((i) => i.level === 'FIX')));
{ const s = clone(V2); delete s.voz; ok('N1 v2 sin voz → FIX schema.v2', has(checkStory(s, { duration: D }), 'schema.v2', 'FIX')); }

// N2 · ancla visible
{ const sh = (text, action = '') => [{ t: 0, end: 20, text, action, shot: 'S1' }];
  ok('N2 ancla ausente de pantalla → FIX', has(checkStory(V2, { duration: D, texts: sh('Un título cualquiera', 'un fondo liso') }), 'ancla.visible', 'FIX'));
  ok('N2 ancla en pantalla → pasa', !has(checkStory(V2, { duration: D, texts: sh('Consta', 'un cilindro de platino bajo tres campanas en Sèvres') }), 'ancla.visible'));
  const s = clone(V2); s.ancla.dato = { valor: 'mucho', fuente: '' }; ok('N2b ancla.dato sin cifra/fuente → FIX', has(checkStory(s, { duration: D }), 'ancla.dato', 'FIX')); }

// N3 · apertura de cliché
{ const s = (q, extra = {}) => ({ ...clone(V2), question: { ...V2.question, text: q }, ...extra }), run = (x) => checkStory(x, { duration: D });
  ok('N3 «¿Qué pasaría si…?» → FIX cliche.apertura', has(run(s('¿Qué pasaría si el kilo cambiara?')), 'cliche.apertura', 'FIX'));
  ok('N3 dentro de una cita «…» pasa', !has(run(s('Dijo «¿qué pasaría si?» y calló')), 'cliche.apertura'));
  ok('N3 con narr_ok justificada pasa (EXC)', !has(run(s('¿Qué pasaría si el kilo cambiara?', { narr_ok: [{ check: 'cliche.apertura', porque: 'parodia deliberada del tópico' }] })), 'cliche.apertura', 'FIX') && has(run(s('¿Qué pasaría si el kilo cambiara?', { narr_ok: [{ check: 'cliche.apertura', porque: 'parodia deliberada del tópico' }] })), 'cliche.apertura', 'EXC'));
  ok('N3 narr_ok sin porqué → FIX', has(run(s('x', { narr_ok: [{ check: 'cliche.apertura' }] })), 'narr_ok.sin_porque', 'FIX')); }

// N4 · moraleja
{ const s = clone(V2); s.beats.at(-1).text = 'tú eres el paso cero'; const is = checkStory(s, { duration: D }); ok('N4 último beat «tú eres el paso cero» → FIX cierre.moraleja', has(is, 'cierre.moraleja', 'FIX')); }

// N5 · ritmo de beats
{ const mkb = (ts) => ({ ...clone(V2), beats: ts.map((t, i) => ({ id: `b${i}`, t, text: `beat ${i} del objeto`, link: i ? 'pero' : undefined })) });
  ok('N5 beats uniformes (CV < 0,30) → WARN ritmo.beats_cv', has(checkStory(mkb([0, 8, 16, 24, 32, 40]), { duration: 48 }), 'ritmo.beats_cv', 'WARN'));
  ok('N5 beats irregulares → pasa', !has(checkStory(mkb([0, 2, 16, 19, 35, 40]), { duration: 48 }), 'ritmo.beats_cv')); }

// N6 · spine metrónomo
{ const mkb = (links) => ({ ...clone(V2), beats: links.map((l, i) => ({ id: `b${i}`, t: i * 6 + (i % 3), text: `beat ${i} del objeto`, link: l || undefined })) });
  ok('N6 ABAB estricto en 6 beats → WARN spine.metronomo', has(checkStory(mkb([null, 'pero', 'por lo tanto', 'pero', 'por lo tanto', 'pero']), { duration: 40 }), 'spine.metronomo', 'WARN'));
  ok('N6 spine variado → pasa', !has(checkStory(mkb([null, 'pero', 'por lo tanto', 'por lo tanto', 'pero', 'pero']), { duration: 40 }), 'spine.metronomo')); }

// N7 · los films v1 actuales reproducen el diagnóstico (research §1)
{ const R = analyzeAll(ROOT).filter((f) => ['mate_papel', 'reel', 'regla', 'stress'].includes(f.key));
  ok('N7 hay 4 films v1 analizados', R.length === 4 && R.every((f) => !f.story.v));
  ok('N7 retorno en los 4 cierres (cliche.cierre WARN)', R.every((f) => f.issues.some((i) => i.check === 'cliche.cierre' && /retorno/.test(i.problem))));
  ok('N7 pregunta de apertura de plantilla en los 4', R.every((f) => has(f.issues, 'pregunta.plantilla', 'WARN')));
  ok('N7 giro en el 72–81 % en los 4 (y avisa de coincidencias)', R.every((f) => { const g = f.story.accommodation.t / f.duration; return g >= 0.715 && g <= 0.815; }) && R.filter((f) => has(f.issues, 'giro.posicion')).length >= 3);
  ok('N7 ningún FIX efectivo en v1 (no bloquean el gate)', R.every((f) => f.issues.every((i) => effLevel(i, f.story) !== 'FIX'))); }

// N8 · arc por forma
{ const f = 12, Dd = 8, N = Dd * f, T = thresholds('reel'), curve = (fn) => Array.from({ length: N }, (_, i) => fn((i + 1) / f));
  const E = curve((t) => (t < 2.4 ? 0.002 : t < 4.4 ? 0.006 : t < 5.4 ? 0 : t < 6.0 ? 0.04 : 0.003 * Math.exp(-(t - 6))));
  const M = { duration: Dd, fps: 30, sampleFps: f, holdEnergy: 0.0005, E, accent: E.map(() => 0), frames: [{ t: 0.3, foci: [], texts: [{ shot: 'S1', label: '¿CABE UNA ESCALA EN UN PUNTO?' }] }], impacts: [{ shot: 'S2', t: 5.4 }], smear: {}, transients: [5.4 + 1 / 30], silences: [], profile: 'reel', shots: [{ id: 'S1', t: [0, 4], size: 'WS', on: 1, cam: null }, { id: 'S2', t: [4, 6.6], size: 'CU', on: 1, cam: null, sakuga: 'hero' }, { id: 'S3', t: [6.6, 8], size: 'MS', on: 1, cam: null }] };
  const base = rd('test/fixtures/arc/story.json'), lat = { ...base, accommodation: { ...base.accommodation, type: 'creencia' }, beats: base.beats.map((b, i) => (i === 2 ? { ...b, link: 'y luego' } : b)) };
  const fx = (s) => analyze(M, s, T).issues.filter((i) => i.level === 'FIX' && /y luego|conector/.test(i.problem));
  ok('N8 kisho: giro lateral sin "pero" no da FIX', !fx({ ...lat, forma: 'kisho' }).length && validateStory({ ...lat, forma: 'kisho' }).length === 0, JSON.stringify(fx({ ...lat, forma: 'kisho' })));
  ok('N8 causal mantiene la regla actual (y luego → FIX)', fx({ ...lat, forma: 'causal' }).length > 0 && fx({ ...lat, forma: undefined }).length > 0);
  ok('N8 accommodation.type creencia admitido', validateStory({ ...base, accommodation: { ...base.accommodation, type: 'creencia' } }).length === 0); }

// N9 · diversidad de oleada
{ const e = (key, medio, tono) => ({ key, duration: 40, story: { forma: 'causal', medium: { id: medio }, tono: { primario: tono } } });
  ok('N9 3 stories con el mismo medio → FIX diversidad.oleada', has(checkOleada([e('a', 'kraft', 'x'), e('b', 'kraft', 'y'), e('c', 'kraft', 'z')]), 'diversidad.oleada', 'FIX'));
  ok('N9 mismo tono → FIX', has(checkOleada([e('a', 'm1', 'asombro'), e('b', 'm2', 'Asombro')]), 'diversidad.oleada', 'FIX'));
  ok('N9 medios y tonos distintos → sin FIX', !checkOleada([e('a', 'm1', 'x'), e('b', 'm2', 'y'), e('c', 'm3', 'z')]).some((i) => i.level === 'FIX')); }

// N10 · frescura: vetos
{ const mk = (p) => ({ ...clone(V2), frescura: { puntos: p } }), full = { ancla: 2, pregunta: 2, hecho_raro: 2, giro_relee: 2, apuesta: 2, distancia_default: 2, distancia_archivo: 2 };
  ok('N10 14/14 apto', frescura(mk(full)).ok);
  for (const k of ['ancla', 'pregunta', 'hecho_raro', 'distancia_default']) ok(`N10 un 0 en ${k} veta aunque sume ≥ 10`, (() => { const r = frescura(mk({ ...full, [k]: 0 })); return !r.ok && r.total >= 10; })());
  ok('N10 un 0 en giro_relee no veta', frescura(mk({ ...full, giro_relee: 0 })).ok);
  ok('N10 frescura vetada → FIX frescura.registro', has(checkStory(mk({ ...full, ancla: 0 }), { duration: D }), 'frescura.registro', 'FIX')); }

// N11 · determinismo de la CLI
{ const run = () => spawnSync(process.execPath, ['engine/narr.mjs'], { cwd: ROOT, encoding: 'utf8' }); const a = run(), b = run();
  ok('N11 dos ejecuciones dan la misma salida', a.stdout === b.stdout && a.stdout.length > 100 && a.status === 0, a.stderr.slice(0, 200)); }

// anti-cliché: el vocab lint lo excluye a propósito
ok('lista anti-cliché excluida del lint de vocab', (await import('../engine/vocab.mjs')).EXEMPT.includes('data/anticliche.es.json'));
process.exit(fail ? 1 : 0);
