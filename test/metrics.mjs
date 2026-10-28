#!/usr/bin/env node
// Spec 005: métricas con sentido. 3DD: unidades/dimensiones, casos de control con valor analítico conocido, invariancia a
// resolución/fps/duración, coherencia del registro, CLI. Corre en el repo (escribe en out/tmp-metrics, ignorado por git).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, run, FULL } from './lib.mjs';

let fail = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? '✓' : '✗'} metrics: ${name}${cond ? '' : '  ' + extra}`); if (!cond) fail++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const M = await import('../engine/metrics/mathx.mjs'), C = await import('../engine/metrics/colorimetry.mjs'), A = await import('../engine/metrics/audiox.mjs');
const { REGISTRY, byId, CONVENTIONS } = await import('../engine/metrics/registry.mjs'), U = await import('../engine/metrics/units.mjs');
const { measureTimeline, cameraStats, montage, curveDescriptors, REF_FOCAL_MM } = await import('../engine/metrics/measure.mjs');
const { renderDoc } = await import('../engine/metrics/doc.mjs'), { loadFilm } = await import('../engine/film.mjs');

// ── 1. matemática ──
ok('entropía normalizada: uniforme = 1, un solo pico = 0', near(M.entropyNorm([1, 1, 1, 1]), 1, 1e-12) && M.entropyNorm([0, 0, 5, 0]) === 0);
ok('cuantil tipo 7 y mediana', M.quantile([1, 2, 3, 4], 0.5) === 2.5 && M.median([5, 1, 3]) === 3 && M.quantile([0, 10], 0.95) === 9.5);
ok('DTW: idéntica = 0; desplazada < L2', M.dtw([0, 1, 2, 1, 0], [0, 1, 2, 1, 0]) === 0 && M.dtw([0, 0, 1, 2, 1], [0, 1, 2, 1, 0], 0.4) < M.l2([0, 0, 1, 2, 1], [0, 1, 2, 1, 0]));
ok('L2 (RMS) conocido', near(M.l2([0, 0, 0, 0], [1, 1, 1, 1]), 1, 1e-12) && near(M.l2([0, 3], [0, 0]), Math.sqrt(4.5), 1e-12));
{ const s = Array.from({ length: 200 }, (_, i) => Math.sin((2 * Math.PI * i) / 25)), p = M.dominantPeriod(s); ok('autocorrelación: periodo 25 de un seno', p && p.lag === 25 && p.r > 0.8, JSON.stringify(p)); }
{ const v = [0, 0.2, 1, 0.3, 0.1, 0.6, 0.2]; const pk = M.peaks(v, 0.15); ok('picos con prominencia topográfica', pk[0].i === 2 && pk[0].prom === 1 && pk.some((p) => p.i === 5 && near(p.prom, 0.5, 1e-9)), JSON.stringify(pk)); }
ok('Wilson y Poisson contienen el estimador', (() => { const w = M.wilson(3, 10), p = M.poissonCI(9); return w[0] < 0.3 && w[1] > 0.3 && p[0] < 9 && p[1] > 9; })());
ok('bootstrap reproducible (semilla fija)', JSON.stringify(M.bootstrapCI([1, 2, 3, 4, 9], M.mean)) === JSON.stringify(M.bootstrapCI([1, 2, 3, 4, 9], M.mean)));
ok('Spearman monótono = 1', near(M.spearman([1, 2, 3, 9], [2, 4, 5, 100]), 1, 1e-12));
{ const lin = Array.from({ length: 100 }, (_, i) => (i + 0.5) / 100), d = curveDescriptors(lin); ok('curva rampa: pico al final, centroide 2/3, entropía < 1', d.peakPos > 0.98 && near(d.centroid, 2 / 3, 0.01) && d.entropy < 1); }

// ── 2. colorimetría normativa ──
ok('CIEDE2000: pares de Sharma, Wu & Dalal (2005)', near(C.deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485]), 2.0425, 1e-3) && near(C.deltaE2000([50, 2.5, 0], [50, 0, -2.5]), 4.3065, 1e-3) && near(C.deltaE2000([50, 2.5, 0], [73, 25, -18]), 27.1492, 1e-3));
ok('WCAG negro/blanco = 21:1', near(C.wcag('#000000', '#ffffff'), 21, 1e-9));
ok('APCA: negro/blanco = 106,04; blanco/negro = −107,88', near(C.apca('#000000', '#ffffff'), 106.04, 0.01) && near(C.apca('#ffffff', '#000000'), -107.88, 0.01));

// ── 3. unidades y dimensiones ──
{ const bad = REGISTRY.filter((m) => !U.UNITS[m.unit]).map((m) => m.id); ok('toda métrica declara una unidad conocida', !bad.length, bad.join(','));
  const sym = (u) => Object.keys(U.UNITS[u].dim), badDim = REGISTRY.filter((m) => sym(m.unit).some((s) => !m.dim.includes(s))).map((m) => `${m.id}[${m.unit}] «${m.dim}»`); ok('análisis dimensional: el campo dim contiene las dimensiones base de su unidad', !badDim.length, badDim.join(' | '));
  const miss = REGISTRY.filter((m) => !m.formula || !m.estimator || !m.uncertainty || !m.invariance || !m.norm || !m.source).map((m) => m.id); ok('toda métrica: fórmula, estimador, incertidumbre, invariancia, norma y fuente', !miss.length, miss.join(','));
  ok('ids únicos', new Set(REGISTRY.map((m) => m.id)).size === REGISTRY.length);
  ok('escala de plano: umbrales monótonos y clases', U.scaleName(1.2) === 'ECU' && U.scaleName(0.5) === 'MCU' && U.scaleName(0.3) === 'MS' && U.scaleName(0.02) === 'ELS' && U.declaredScale('WS') === 5);
  ok('dimensiones: décadas/s ≠ stops/s ≠ anchos/s', U.dimOf('décadas/s') !== U.dimOf('stops/s') && U.dimOf('stops/s') !== U.dimOf('anchos/s') && U.dimOf('anchos/s') === 'T^-1'); }
{ const film = { fps: 30, width: 1280, height: 720, S: { grade: { letterbox: 0 } }, P: { safe: { top: 0.08, bottom: 0.08 } } };
  ok('px → anchos de pantalla (14 px a 1280 = 1,09 %)', near(U.PARAM_UNITS.px.convert(14, film, 'hitR').value, 14 / 1280, 1e-12));
  ok('vh de un tamaño → escala de plano', /MLS/.test(U.PARAM_UNITS.vh.convert(0.17, film, 'size').note) && U.PARAM_UNITS.vh.convert(0.17, film, 'size').unit === 'escala de plano');
  ok('s → fotogramas', /12.0 fotogramas/.test(U.PARAM_UNITS.s.convert(0.4, film, 'textIn').note)); }
{ const used = new Set(); for (const f of fs.readdirSync(path.join(ROOT, 'shots')).filter((n) => /\.mjs$/.test(n))) for (const m of fs.readFileSync(path.join(ROOT, 'shots', f), 'utf8').matchAll(/unit: '([^']+)'/g)) used.add(m[1]);
  ok('todas las unidades de los esquemas de params de los shots tienen conversión', [...used].every((u) => U.PARAM_UNITS[u]), [...used].filter((u) => !U.PARAM_UNITS[u]).join(',')); }

// ── 4. controles analíticos ──
const TMP = path.join(ROOT, 'out/tmp-metrics'); fs.mkdirSync(TMP, { recursive: true });
const shot = (id, a, b, extra = {}) => ({ id, t: [a, b], size: 'MS', action: 'control', text: id, transition_out: 'cut', ...extra });
function write(name, tl, copyFrom) {
  const d = path.join(TMP, name); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'timeline.json'), JSON.stringify({ title: name, style: 'editorial', fps: 30, width: 1280, height: 720, bpm: 120, beatOffset: 0, ...tl }));
  if (copyFrom) for (const f of ['memoria.json', 'story.json']) if (fs.existsSync(path.join(ROOT, copyFrom, f))) fs.copyFileSync(path.join(ROOT, copyFrom, f), path.join(d, f));
  return `out/tmp-metrics/${name}/timeline.json`;
}
const val = (r, id) => r.metrics.find((m) => m.id === id);
const periodic = (n, len) => Array.from({ length: n }, (_, i) => shot('S' + i, i * len, (i + 1) * len));
{
  const r = await measureTimeline(write('cortes20', { duration: 20, shots: periodic(10, 2) }), { sampleFps: 4, audio: false, B: 100 });
  ok('control: un corte cada 2 s ⇒ ASL = 2 s (IC lo contiene)', near(val(r, 'montaje.asl').value, 2, 1e-9) && val(r, 'montaje.asl').ci[0] <= 2 && val(r, 'montaje.asl').ci[1] >= 2);
  ok('control: ritmo de corte = 60·9/20 = 27 cortes/min; CV = 0; MSL = 2 s', near(val(r, 'montaje.cutRate').value, 27, 1e-9) && val(r, 'montaje.slCV').value === 0 && val(r, 'montaje.msl').value === 2);
  ok('control: 120 BPM con cortes cada 2 s ⇒ 100 % en el pulso; 100 % cortes duros', val(r, 'montaje.cutOnBeat').value === 100 && val(r, 'montaje.hardCutRatio').value === 100);
  const r40 = await measureTimeline(write('cortes40', { duration: 40, shots: periodic(20, 2) }), { sampleFps: 4, audio: false, B: 100 });
  ok('invariancia a la duración: ASL idéntico a D=20 y D=40; ritmo de corte → 30 (±10 %)', val(r40, 'montaje.asl').value === val(r, 'montaje.asl').value && near(val(r40, 'montaje.cutRate').value, 30, 3));
  const r100 = await measureTimeline(write('cortes100', { duration: 20, bpm: 100, shots: periodic(10, 2) }), { sampleFps: 4, audio: false, B: 100 });
  ok('control: 100 BPM (pulso 0,6 s) con cortes cada 2 s ⇒ 3 de 9 en el pulso = 33,3 %; el azar esperado es p₀ = 0,133', near(val(r100, 'montaje.cutOnBeat').value, 33.333, 0.01) && /p₀=0\.133/.test(val(r100, 'montaje.cutOnBeat').notes));
  ok('control: cada métrica sin datos declara por qué (valor null ⇒ confianza 0 y notes)', r.metrics.filter((m) => m.value == null).every((m) => m.confidence === 0 && /sin datos/.test(m.notes)));
}
{
  const cam = async (name, cam) => { const p = write(name, { duration: 2, shots: [shot('C1', 0, 2, { cam: { why: 'approach', ease: 'linear', ...cam } })] }); return cameraStats(await loadFilm({ timeline: p })); };
  const f0 = REF_FOCAL_MM, pan = await cam('cam_pan', { move: 'slide', dir: [1, 0], amount: 0.2 });
  ok(`control: paneo lineal 0,2 anchos en 2 s ⇒ ω = atan(0,2·36/f₀)/2 = ${((Math.atan((0.2 * 36) / f0) * 180) / Math.PI / 2).toFixed(2)} °/s`, near(pan.pan, (Math.atan((0.2 * 36) / f0) * 180) / Math.PI / 2, 0.06), pan.pan);
  const roll = await cam('cam_roll', { move: 'rotate', amount: 6 }); ok('control: rotación lineal 6° en 2 s ⇒ 3 °/s', near(roll.roll, 3, 0.03), roll.roll);
  const push = await cam('cam_push', { move: 'push', amount: 1 }); ok('control: push lineal z 1→2 en 2 s ⇒ 0,5 stops/s; focal media 1,5·f₀', near(push.zoom, 0.5, 0.03) && near(push.focal, 1.5 * f0, 0.02 * f0), `${push.zoom} ${push.focal}`);
  const st = await cam('cam_static', { move: 'static' }); ok('control: cámara quieta ⇒ 0 °/s, 0 stops/s, focal f₀ y FOV = 2·atan(18/f₀)', st.pan === 0 && st.zoom === 0 && near(st.focal, f0, 1e-9) && near(st.fov, (2 * Math.atan(18 / f0) * 180) / Math.PI, 1e-6) && st.moving === 0);
  ok('sensibilidad a la convención: f₀ = 50 mm da un paneo menor (∝ 1/f₀)', (await (async () => { const f = await loadFilm({ timeline: 'out/tmp-metrics/cam_pan/timeline.json' }); return cameraStats(f, { f0: 50 }).pan < cameraStats(f, { f0: 24 }).pan; })()));
}
{
  const sr = 48000, N = sr * 20, L = new Float32Array(N), R = new Float32Array(N); for (let i = 0; i < N; i++) L[i] = R[i] = 10 ** (-23 / 20) * Math.sin((2 * Math.PI * 997 * i) / sr);
  const l = A.loudnessOf(L, R); ok('control: tono 997 Hz a −23 dBFS en ambos canales ⇒ −23,0 LUFS (±0,1) y pico ≈ −23 dBTP', near(l.I, -23, 0.1) && near(l.TP, -23, 0.3), `${l.I} ${l.TP}`);
  const K = new Float32Array(N); for (let b = 0; b < 40; b++) { const s = Math.round(b * 0.5 * sr); for (let i = 0; i < 2000; i++) K[s + i] += Math.sin(i * 0.3) * Math.exp(-i / 300); }
  const tp = A.tempoBPM(K, K, sr); ok('control: clics a 0,5 s ⇒ 120 BPM (±1,5) con IC que lo contiene', near(tp.bpm, 120, 1.5) && tp.ci[0] <= tp.bpm && tp.ci[1] >= tp.bpm, JSON.stringify(tp.bpm));
  const on = A.onsets(K, K, sr), ev = Array.from({ length: 40 }, (_, b) => b * 0.5), s0 = A.syncOffsets(on, ev), s30 = A.syncOffsets(on, ev.map((t) => t - 0.03));
  ok('control: desfase AV: clics alineados ⇒ 0 ms (±12); eventos 30 ms antes ⇒ +30 ms', near(s0.median, 0, 12) && near(s30.median - s0.median, 30, 6), `${s0.median} ${s30.median}`);
  const Kc = new Float32Array(N), W = { 261.63: 1, 293.66: 0.4, 329.63: 0.7, 349.23: 0.4, 392: 0.8, 440: 0.4, 493.88: 0.3 }; for (const f in W) for (let i = 0; i < N; i++) Kc[i] += 0.2 * W[f] * Math.sin((2 * Math.PI * f * i) / sr);
  ok('control: escala de Do mayor con tónica reforzada ⇒ tonalidad C major', A.keyKS(Kc, Kc, sr).name === 'C major', A.keyKS(Kc, Kc, sr).name);
}

// ── 5. invariancia (demo; render y film a otras resoluciones/fps) + coherencia con el registro ──
{
  const demo = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/timeline.json'), 'utf8')), variant = (name, o) => write(name, { ...demo, ...o });
  const base = await measureTimeline(variant('inv_base', {}), { sampleFps: 8, renderW: 192, audio: false, B: 150 });
  const vs = { 'resolución del film 640×360': [variant('inv_res', { width: 640, height: 360 }), { sampleFps: 8, renderW: 192 }], 'fps del film 24': [variant('inv_fps', { fps: 24 }), { sampleFps: 8, renderW: 192 }], 'render 128 px y muestreo 12 Hz': [variant('inv_base', {}), { sampleFps: 12, renderW: 128 }] };
  const ids = new Set(base.metrics.map((m) => m.id));
  ok('registro ↔ salida: cada id del registro aparece en el resultado y viceversa', REGISTRY.every((m) => ids.has(m.id)) && base.metrics.every((m) => byId[m.id]));
  ok('esquema estándar: schema, film, params, metrics{id,name,domain,value,unit,ci,method,confidence}', base.schema === 'opus-metrics/1' && base.metrics.every((m) => ['id', 'name', 'domain', 'value', 'unit', 'ci', 'method', 'confidence'].every((k) => k in m)));
  ok('series de tensión en tiempo normalizado: 100 muestras en [0,1]', base.series.tension?.v.length === 100 && Math.min(...base.series.tension.v) >= 0 && Math.max(...base.series.tension.v) <= 1);
  for (const [name, [tlp, o]] of Object.entries(vs)) {
    const r = await measureTimeline(tlp, { ...o, audio: false, B: 150 }), bad = [];
    for (const m of base.metrics) { const q = val(r, m.id); if (typeof m.value !== 'number' || typeof q?.value !== 'number') { if ((m.value == null) !== (q?.value == null)) bad.push(m.id + ' (presencia)'); continue; }
      const hw = (x) => (x.ci ? (x.ci[1] - x.ci[0]) / 2 : 0), tol = hw(m) + hw(q) + 0.03 * Math.max(Math.abs(m.value), Math.abs(q.value)) + 1e-6; if (Math.abs(m.value - q.value) > tol) bad.push(`${m.id}: ${m.value} vs ${q.value} (±${tol.toFixed(3)})`); }
    ok(`invariancia: ${name} ⇒ mismas métricas dentro de su IC`, !bad.length, bad.join(' | '));
  }
  ok('docs/METRICAS.md está al día con el registro (npm run metrics -- doc)', fs.existsSync(path.join(ROOT, 'docs/METRICAS.md')) && fs.readFileSync(path.join(ROOT, 'docs/METRICAS.md'), 'utf8') === renderDoc());
}

// ── 6. CLI ──
{
  const r = await run(['engine/metrics.mjs', 'demo', '--json', '--no-audio'], { timeout: 280000 }), first = r.stderr.split('\n')[0];
  let J = null; try { J = JSON.parse(r.stdout); } catch {}
  ok('CLI: 1.ª línea «film: …» (stderr con --json) y stdout JSON puro', /^film: main/.test(first) && J?.schema === 'opus-metrics/1', first + r.stdout.slice(0, 80));
  ok('CLI: escribe out/metrics/main.json y la ficha .md', fs.existsSync(path.join(ROOT, 'out/metrics/main.json')) && /Ficha de métricas/.test(fs.readFileSync(path.join(ROOT, 'out/metrics/main.md'), 'utf8')));
  const u = await run(['engine/metrics.mjs', 'units', 'demo']); ok('CLI units: params promovidos con conversión (A1.size → escala de plano)', /A1\.size.*escala de plano/.test(u.stdout) && /A3\.hitR.*anchos de pantalla/.test(u.stdout), u.stdout.slice(0, 300));
  const c = await run(['engine/metrics.mjs', 'calibrate', ...(FULL ? [] : ['--dry'])]);; ok('CLI calibrate: advierte n pequeño', /n pequeño/.test(c.stdout), c.stdout + c.stderr);   // quick: --dry = solo cabecera y advertencia, sin medir los 3 films de data/notas.json
}
fs.rmSync(TMP, { recursive: true, force: true });
console.log(fail ? `${fail} fallos` : 'metrics: todo verde'); process.exit(fail ? 1 : 0);
