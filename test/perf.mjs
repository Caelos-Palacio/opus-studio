#!/usr/bin/env node
// Rendimiento (docs/EFICIENCIA.md R0–R4). Lo que se optimiza NO puede cambiar píxeles por defecto:
//   perf-off      la instrumentación (engine/perf.mjs) está apagada por defecto y mide tiempo EXCLUSIVO por categoría.
//   vignette      el overlay de viñeta cacheado es bit a bit igual al relleno directo del gradiente (y lo reutiliza).
//   fx-rapido     film.P.fxFast (R3, opt-in): bloom/blur/layer ≈ exactos (error medio pequeño) y distintos solo si se activa.
//   x264          R4: argumentos de codificación: por defecto medium y sin -threads (bytes de siempre); preset/threads opt-in.
//   profile       `engine/profile.mjs` corre y emite la tabla (categorías, top shots) sobre el fixture.
import fs from 'node:fs';
import path from 'node:path';
import canvasPkg from 'canvas';
import { ROOT, copyRepo, rmrf, run } from './lib.mjs';
const { createCanvas } = canvasPkg;
let n = 0, bad = 0; const ok = (c, m) => { n++; if (!c) { bad++; console.log('  ✗ perf:', m); } };
const buf = (cv) => cv.toBuffer('raw');
const mad = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };

// perf-off + exclusivo
const { perf, span, enter, leave, reset } = await import('../engine/perf.mjs');
ok(perf.on === false, 'perf apagada por defecto');
const busy = (ms) => { const t = Date.now(); while (Date.now() - t < ms); };
const inner = span('hijo', () => busy(30)), outer = span('padre', () => { busy(30); inner(); });
outer(); ok(Object.keys(perf.acc).length === 0, 'apagada: no registra nada');
perf.on = true; reset(); outer(); perf.on = false;
ok(perf.acc.hijo >= 28 && perf.acc.padre >= 28 && perf.acc.padre < 45, `tiempo exclusivo (padre ${perf.acc.padre?.toFixed(0)} ≈ 30, hijo ${perf.acc.hijo?.toFixed(0)} ≈ 30)`);

// viñeta cacheada == directa
const { applyGrade } = await import('../engine/grade.mjs');
{
  const W = 640, H = 360, film = { width: W, height: H, duration: 10, palette: { ink: '#000', paper: '#fff' }, S: { grade: { vignette: 0.4 } }, canvas: (w, h) => createCanvas(w, h) };
  const mk = () => { const cv = createCanvas(W, H), x = cv.getContext('2d'); x.fillStyle = '#223'; x.fillRect(0, 0, W, H); for (let i = 0; i < 200; i++) { x.fillStyle = `rgba(${i % 255},${(i * 7) % 255},${(i * 13) % 255},${(i % 10) / 10})`; x.fillRect((i * 97) % W, (i * 53) % H, 60, 40); } return cv; };
  const ref = mk(), rx = ref.getContext('2d'), g = film.S.grade, gr = rx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.55);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${g.vignette})`); rx.fillStyle = gr; rx.fillRect(0, 0, W, H);
  const A = mk(), ax = A.getContext('2d'); applyGrade(ax, film, 1); const B = mk(), bx = B.getContext('2d'); applyGrade(bx, film, 2);
  ok(buf(A).equals(buf(ref)), 'viñeta cacheada: bit a bit igual (1ª llamada)'); ok(buf(B).equals(buf(ref)), 'viñeta cacheada: bit a bit igual (2ª, desde caché)');
  const S = createCanvas(W, H), sx = S.getContext('2d'); sx.setTransform(0.5, 0, 0, 0.5, 0, 0);       // con escala de salida (--size)
  const R2 = createCanvas(W / 2, H / 2), r2 = R2.getContext('2d'); r2.setTransform(0.5, 0, 0, 0.5, 0, 0); r2.fillStyle = '#345'; r2.fillRect(0, 0, W, H);
  const D = createCanvas(W / 2, H / 2), d2 = D.getContext('2d'); d2.setTransform(0.5, 0, 0, 0.5, 0, 0); d2.fillStyle = '#345'; d2.fillRect(0, 0, W, H);
  const g2 = r2.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.55); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,0.4)'); r2.fillStyle = g2; r2.fillRect(0, 0, W, H);
  applyGrade(d2, film, 3); ok(buf(D).equals(buf(R2)), 'viñeta cacheada: igual con transformación de escala');
}

// R3 fx rápido (opt-in)
{
  const { bloom, blurCanvas, layer } = await import('../engine/fx.mjs'), W = 640, H = 360;
  const mkFilm = (P) => ({ P, fps: 30, canvas: (w, h) => createCanvas(w, h) });
  const scene = () => { const cv = createCanvas(W, H), x = cv.getContext('2d'); x.fillStyle = '#102'; x.fillRect(0, 0, W, H); const gr = x.createRadialGradient(320, 180, 5, 320, 180, 160); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,160,40,0)'); x.fillStyle = gr; x.fillRect(0, 0, W, H); return cv; };
  const doBloom = (P) => { const f = mkFilm(P), src = scene(), c = scene(), x = c.getContext('2d'); bloom(f, x, src, { threshold: 0.5, strength: 0.8, radius: 24 }); return buf(c); };
  const e1 = doBloom({}), e2 = doBloom({}), fa = doBloom({ fxFast: true });
  ok(e1.equals(e2), 'bloom exacto: determinista'); ok(!e1.equals(fa), 'bloom fxFast: activo cambia píxeles'); ok(mad(e1, fa) < 2.5, `bloom fxFast: error medio ${mad(e1, fa).toFixed(2)} < 2.5/255`);
  const doLayer = (P) => { const f = mkFilm(P), c = createCanvas(W, H), x = c.getContext('2d'); x.fillStyle = '#102'; x.fillRect(0, 0, W, H); layer(f, x, { blur: 14 }, 0, (lx) => { lx.fillStyle = '#fc4'; lx.beginPath(); lx.arc(320, 180, 70, 0, 6.2832); lx.fill(); }); return buf(c); };
  const l1 = doLayer({}), l2 = doLayer({ fxFast: true });
  ok(l1.equals(doLayer({})), 'layer blur exacto: determinista'); ok(mad(l1, l2) < 2.5, `layer blur fxFast: error medio ${mad(l1, l2).toFixed(2)} < 2.5/255`);
}

// R4 argumentos x264
{
  const { x264Args } = await import('../engine/encode.mjs'), a = x264Args({ crf: 16 }), j = a.join(' ');
  ok(/-preset medium/.test(j) && /-crf 16/.test(j) && !/-threads/.test(j), 'x264 por defecto: medium, sin -threads (bytes de siempre)');
  ok(/-preset faster/.test(x264Args({ crf: 16, preset: 'faster' }).join(' ')) && /-threads 1/.test(x264Args({ crf: 16, threads: 1 }).join(' ')), 'x264: preset y threads opt-in');
  const { workerThreads } = await import('../engine/encode.mjs');
  ok(workerThreads(12, 12) === 1 && workerThreads(2, 12) === 6 && workerThreads(1, 12) === 0, 'threads por worker = CPUs/workers (0 = automático si hay un solo worker)');
}

// profile CLI sobre el fixture
{
  const d = copyRepo({ fixture: path.join(ROOT, 'test/fixtures/showcase') }), json = path.join(d, 'p.json');
  try {
    const r = await run(['engine/profile.mjs', '--fixture', path.join(ROOT, 'test/fixtures/showcase'), '--frames', '8', '--no-encode', '--json', json], { cwd: ROOT, timeout: 240000 });
    ok(r.status === 0 && /ms\/fotograma/.test(r.stdout) && /Top-10 shots/.test(r.stdout) && /fx\.bloom|grade\.post/.test(r.stdout), 'profile: tabla de categorías + top shots ' + r.stderr.slice(-200));
    const D = fs.existsSync(json) ? JSON.parse(fs.readFileSync(json, 'utf8')) : null; ok(D && D.shots.length >= 3 && D.cats.shot > 0 && D.mean_ms > 0, 'profile: JSON con shots y categorías');
  } finally { rmrf(d); }
}
console.log(`${bad ? '✗' : '✓'} perf            ${n - bad}/${n}`); process.exit(bad ? 1 : 0);
