#!/usr/bin/env node
// F5 · lint dramático. (1) Unidades puras de engine/arc.mjs (calibración, spine, brecha, energía, sincronía) sin render.
// (2) Criterio de hecho del plan, test A/B: la variante "PowerPoint" (energía constante, cortes regulares, sin hold) da FIX
//     y la variante con arco da SHIP con puntuación claramente mayor, con la MISMA story.json (la diferencia es medida, no declarada).
// (3) El demo sin story.json: arc omite con WARN y exit 0 (no cambia de veredicto sin intención).
// Corre en una copia temporal del repo (node_modules enlazado).   node test/arc.mjs [--quick]  (--quick: solo unidades)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { copyRepo, rmrf } from './lib.mjs';
import { calibrate, analyze, thresholds, validateStory, energyArc } from '../engine/arc.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let n = 0, bad = 0; const ok = (c, m, extra = '') => { n++; if (!c) { bad++; console.log(`  ✗ arc: ${m} ${extra}`); } };

// ───────── (1) unidades ─────────
ok(calibrate(3, []) === 3, 'calibración sin datos = prior');
ok(Math.abs(calibrate(3, Array(30).fill(5)) - 4) < 1e-9, 'calibración N=30: w=0.5 → (3+5)/2 = 4');
ok(calibrate(3, Array(120).fill(100)) === 6, 'calibración: clamp a 2·prior');
ok(calibrate(3, Array(120).fill(0)) === 1.5, 'calibración: clamp a prior/2');
ok(Math.abs(calibrate(2, Array(6).fill(4)) - 2.2) < 1e-9, 'calibración N=6: w=0.1');
ok(thresholds('reel', { reel: { peakRatio: Array(60).fill(5) } }).peakRatio === 4, 'umbral por perfil recalibrado desde data/arc.calib.json');
ok(thresholds('explainer').conceptsPerMin === 3 && thresholds('nope')._profile === 'reel', 'priors por perfil (fallback reel)');

const story = JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/arc/story.json'), 'utf8'));
ok(validateStory(story).length === 0, 'story del fixture válida', validateStory(story).join('; '));
ok(validateStory({ idea: 'x' }).length >= 3, 'story incompleta → errores de esquema');
// medidas sintéticas: 8 s a 12 fps; curva con arco (calma, construcción, hold, pico al 70 %, descenso)
const f = 12, D = 8, N = D * f, T = thresholds('reel');
const curve = (fn) => Array.from({ length: N }, (_, i) => fn((i + 1) / f));
const arcE = curve((t) => (t < 2.4 ? 0.002 : t < 4.4 ? 0.006 : t < 5.4 ? 0 : t < 6.0 ? 0.04 : 0.003 * Math.exp(-(t - 6))));
const M = (E, o = {}) => ({ duration: D, fps: 30, sampleFps: f, holdEnergy: 0.0005, E, accent: E.map(() => 0), frames: [{ t: 0.3, foci: [], texts: [{ shot: 'S1', label: '¿CABE UNA ESCALA EN UN PUNTO?' }] }], impacts: [], smear: {}, transients: [], silences: [], profile: 'reel',
  shots: [{ id: 'S1', t: [0, 4], size: 'WS', on: 1, cam: null }, { id: 'S2', t: [4, 6.6], size: 'CU', on: 1, cam: null, sakuga: 'hero' }, { id: 'S3', t: [6.6, 8], size: 'MS', on: 1, cam: null }], ...o });
const ea = energyArc(M(arcE), T);
ok(ea.ratio >= 3 && ea.pos > 0.6 && ea.pos < 0.85 && ea.holds.length === 1, 'energía con arco: pico ≥3×, al 60–85 %, hold junto al pico', JSON.stringify({ r: ea.ratio, p: ea.pos, h: ea.holds }));
const good = analyze(M(arcE, { impacts: [{ shot: 'S2', t: 5.4 }], transients: [5.4 + 1 / 30] }), story, T);
ok(good.verdict === 'SHIP', 'arco sintético + impacto a 1 fotograma del transitorio → SHIP', JSON.stringify(good.issues));
const flatE = curve((t) => 0.01 + 0.002 * Math.sin(t * 6));
const flat = analyze(M(flatE), story, T);
ok(flat.verdict === 'FIX' && flat.issues.some((i) => /pico de energía/.test(i.problem)) && flat.issues.some((i) => /hold/.test(i.problem)), 'energía plana → FIX (pico y hold)');
ok(good.score > flat.score, 'puntuación arco > plana');
const desync = analyze(M(arcE, { impacts: [{ shot: 'S2', t: 5.4 }], transients: [5.4 + 3 / 30] }), story, T);
ok(desync.issues.some((i) => i.level === 'FIX' && /desincronizado/.test(i.problem)), 'impacto a 3 fotogramas del transitorio → FIX');
ok(analyze(M(arcE, { impacts: [{ shot: 'S2', t: 5.4 }] }), story, T).issues.some((i) => /sin transitorio/.test(i.problem)), 'impacto sin audio → FIX');
const yluego = { ...story, beats: story.beats.map((b, i) => (i === 2 ? { ...b, link: 'y luego' } : b)) };
ok(analyze(M(arcE), yluego, T).issues.some((i) => i.level === 'FIX' && /y luego/.test(i.problem)), 'spine con "y luego" → FIX');
const late = { ...story, question: { ...story.question, posed_at: 2, on_screen: false } };
ok(analyze(M(arcE), late, T).issues.some((i) => i.level === 'FIX' && /gancho/.test(i.problem)), 'pregunta planteada tarde → FIX');
const early = { ...story, question: { ...story.question, answered_at: 2, on_screen: false } };
ok(analyze(M(arcE), early, T).issues.some((i) => i.level === 'FIX' && /se cierra pronto/.test(i.problem)), 'pregunta resuelta pronto → FIX');
const noref = { ...story, scale: [{ at: 5.4 }] };
ok(analyze(M(arcE), noref, T).issues.some((i) => i.level === 'FIX' && /referencia humana/.test(i.problem)), 'salto de escala sin referencia humana previa → FIX');
const noacc = { ...story }; delete noacc.accommodation;
ok(analyze(M(arcE), noacc, T).issues.some((i) => i.level === 'FIX' && /accommodation/.test(i.problem)), 'sin momento de acomodación → FIX');
ok(analyze(M(arcE), null, T).skipped && analyze(M(arcE), null, T).verdict === 'SHIP', 'sin story → omitido, nunca FIX');
const twos = analyze(M(arcE, { shots: M(arcE).shots.map((s) => ({ ...s, on: 2 })) }), story, T);
ok(twos.issues.some((i) => /doses/.test(i.problem)), 'frame-rate: pico a doses → WARN');
const budget = analyze(M(arcE, { impacts: [1, 2, 3].map((k) => ({ shot: 'S1', t: k })), transients: [1, 2, 3] }), story, T);
ok(budget.issues.some((i) => /impactos en S1/.test(i.problem)) && budget.issues.some((i) => /lejos del pico/.test(i.problem)), 'presupuesto de impactos por escena y fuera del pico → WARN');
const lin = analyze(M(arcE, { shots: M(arcE).shots.map((s, i) => ({ ...s, cam: i ? null : { move: 'slide', linearDev: 0.001, overshoot: 0 } })) }), story, T);
ok(lin.issues.some((i) => /lineal/.test(i.problem)), 'cámara lineal → WARN');
const mono = analyze(M(arcE, { shots: M(arcE).shots.map((s) => ({ ...s, size: 'MS' })) }), story, T);
ok(mono.issues.some((i) => /entropía/.test(i.problem)), 'tamaños de plano monótonos → WARN');
// pedagogía (explainer): huérfano, carga, elementos animados
const fr = (t, foci, texts = []) => ({ t, foci, texts });
const box = (label, x, extra = {}) => ({ shot: 'S1', label, weight: 1, x, y: 0.4, w: 0.1, h: 0.1, ...extra });
const ped = analyze(M(arcE, { profile: 'explainer', frames: [fr(0, [box('tornillo', 0.1)]), fr(0.1, [1, 2, 3, 4, 5].map((k) => box('punto' + k, 0.1 * k + 0.01)))].concat([fr(0.2, [1, 2, 3, 4, 5].map((k) => box('punto' + k, 0.1 * k)))]) }),
  { ...story, concepts: [0.5, 1, 1.5, 2].map((t, i) => ({ term: 'termino' + i, t })) }, thresholds('explainer'));
ok(ped.issues.some((i) => /huérfano "tornillo"/.test(i.problem)), 'Mayer: elemento sin frase → FIX (explainer)');
ok(ped.issues.some((i) => /conceptos nuevos/.test(i.problem)), 'Mayer: >3 conceptos/min → WARN');
ok(ped.issues.some((i) => /elementos animados/.test(i.problem)), 'Mayer: >4 animados a la vez → WARN');
console.log(`${bad ? '✗' : '✓'} arc unidades    ${n - bad}/${n}`);

// ───────── (2) A/B sobre render real + (3) demo sin story ─────────
if (!process.argv.includes('--quick')) {
  const d = copyRepo();   // copia mínima del repo (F0): sin docs/, test/ ni worktrees
  const run = (args, env = {}) => { const r = spawnSync(process.execPath, args, { cwd: d, encoding: 'utf8', timeout: 600000, env: { ...process.env, ...env } }); return { ...r, J: fs.existsSync(path.join(d, 'out/arc.json')) ? JSON.parse(fs.readFileSync(path.join(d, 'out/arc.json'), 'utf8')) : null }; };
  try {
    fs.mkdirSync(path.join(d, 'out'), { recursive: true });
    const demo = run(['engine/arc.mjs']);
    ok(demo.status === 0 && demo.J?.skipped && demo.J.verdict === 'SHIP' && demo.J.issues.length === 1 && demo.J.issues[0].level === 'WARN', 'demo sin story.json → WARN, exit 0', demo.stdout.slice(-300));
    const fx = path.join(ROOT, 'test/fixtures/arc');
    fs.copyFileSync(path.join(fx, 'story.json'), path.join(d, 'data/arc.story.json'));
    const res = {};
    for (const v of ['flat', 'arc']) {
      for (const s of fs.readdirSync(path.join(fx, v, 'shots'))) fs.copyFileSync(path.join(fx, v, 'shots', s), path.join(d, 'shots', s));
      fs.copyFileSync(path.join(fx, v, 'timeline.json'), path.join(d, `data/arc-${v}.json`));
      fs.rmSync(path.join(d, 'out/arc.json'), { force: true });
      const r = run(['engine/arc.mjs', '--timeline', `data/arc-${v}.json`, '--story', 'data/arc.story.json']); res[v] = r;
      const e = r.J?.measures?.energy ?? {};
      console.log(`  ${v.padEnd(5)} ${r.J?.verdict} arco ${r.J?.score}/100 · pico ${e.ratio}× en ${e.peakT}s (${Math.round((e.peakPos ?? 0) * 100)}%) · calma ${e.calm} · hold ${e.longestHoldNearPeak}s · FIX: ${(r.J?.issues ?? []).filter((i) => i.level === 'FIX').map((i) => i.problem.split(':')[0]).join(' | ') || '—'}`);
    }
    ok(res.flat.J?.verdict === 'FIX' && res.flat.status === 1, 'A/B: la versión "PowerPoint" da FIX');
    ok(res.arc.J?.verdict === 'SHIP' && res.arc.status === 0, 'A/B: la versión con arco da SHIP', JSON.stringify(res.arc.J?.issues?.filter((i) => i.level === 'FIX')));
    ok(res.arc.J?.score - res.flat.J?.score >= 25, 'A/B: puntuación del arco claramente mayor (≥ 25 puntos)', `${res.arc.J?.score} vs ${res.flat.J?.score}`);
    ok(res.arc.J?.measures?.impacts?.length === 1 && res.arc.J.measures.impacts[0].dFrames <= 2, 'api.impact registrado y sincronizado con el sfx impact');
    // hook en lint: con story, lint incorpora los FIX de arc; sin story, lint no cambia
    const L = spawnSync(process.execPath, ['engine/lint.mjs', '--only', 'arc', '--timeline', 'data/arc-flat.json', '--story', 'data/arc.story.json'], { cwd: d, encoding: 'utf8', timeout: 600000 });
    const LJ = JSON.parse(fs.readFileSync(path.join(d, 'out/lint/arc-flat/_only-arc.json'), 'utf8'));   // --only nunca escribe el global (F1)
    ok(LJ.verdict === 'FIX' && LJ.issues.some((i) => /^\[arc\]/.test(i.problem)), 'lint --only arc incorpora los FIX de arc', L.stdout.slice(-300));
    spawnSync(process.execPath, ['engine/lint.mjs', '--only', 'arc'], { cwd: d, encoding: 'utf8' });
    const L0 = JSON.parse(fs.readFileSync(path.join(d, 'out/lint/main/_only-arc.json'), 'utf8'));
    ok(L0.verdict === 'PASS' && L0.issues.length === 0, 'lint del demo sin story: arc no añade nada');
  } finally { rmrf(d); }
}
console.log(`${bad ? '✗' : '✓'} arc            ${n - bad}/${n}`); process.exit(bad ? 1 : 0);
