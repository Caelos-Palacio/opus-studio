// Post: viñeta, grano determinista (semilla = fotograma a 24 fps), fundido y letterbox. Parámetros del estilo.
import { rng } from './core.mjs';
import { rgba } from './color.mjs';
import { bloom, chroma, colorGrade, pool } from './fx.mjs';
import { span } from './perf.mjs';
export function barHeight(film) {
  const g = film.S.grade; if (!g.letterbox) return 0;
  const vis = film.width / g.letterbox; return vis < film.height ? (film.height - vis) / 2 : 0;
}
// Viñeta: el gradiente radial a pantalla completa cuesta ~18 ms (cairo, sin SIMD) y es idéntico en todos los fotogramas.
// Se rasteriza UNA vez a un overlay (negro con alfa) y se compone con drawImage 1:1 (~1 ms): bit a bit igual (test/perf.mjs).
const VIG = new Map();
function vignette(film, ctx, W, H, v) {
  const cv = ctx.canvas, m = ctx.getTransform(), key = [cv.width, cv.height, W, H, v, m.a, m.b, m.c, m.d, m.e, m.f].join();
  let o = VIG.get(key);
  if (!o) {
    o = film.canvas(cv.width, cv.height); const x = o.getContext('2d'); x.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    const gr = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.55);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${v})`);
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    if (VIG.size > 6) VIG.clear(); VIG.set(key, o);
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(o, 0, 0); ctx.restore();
}
// Grano del estilo (motas deterministas por fotograma). Aparte para que el export con alfa (`cut --alpha --alpha-grain`) lo reutilice sobre el sujeto.
export function applyGrain(ctx, film, t) {
  const g = film.S.grade, W = film.width, H = film.height; if (!(g.grain > 0)) return;
  const r = rng(Math.floor(t * 24) * 7919 + 17), n = Math.round(W * H * g.grain * 0.02), s = 1.4 * Math.max(1, W / 1280);
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; for (let i = 0; i < n; i++) ctx.fillRect(r() * W, r() * H, s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < n; i++) ctx.fillRect(r() * W, r() * H, s, s);
}
function applyGrade_(ctx, film, t) {
  const g = film.S.grade, W = film.width, H = film.height, post = g.post ?? {};
  if (post.bloom || post.chroma) {                                        // post global sobre el fotograma ya compuesto (px de dispositivo)
    const cv = ctx.canvas, snap = pool(film).get(cv.width, cv.height); snap.getContext('2d').drawImage(cv, 0, 0);
    if (post.chroma) { chroma(snap, post.chroma * (cv.width / W)); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(snap, 0, 0); ctx.restore(); }
    if (post.bloom) bloom(film, ctx, snap, { ...post.bloom, radius: (post.bloom.radius ?? 24) * (cv.width / W) });
  }
  if (g.vignette > 0) vignette(film, ctx, W, H, g.vignette);
  applyGrain(ctx, film, t);
  const f = g.fade ?? {}; let a = 0;
  if (f.in > 0 && t < f.in) a = 1 - t / f.in;
  if (f.out > 0 && t > film.duration - f.out) a = Math.max(a, (t - (film.duration - f.out)) / f.out);
  if (a > 0) { ctx.fillStyle = rgba(film.palette[f.color ?? 'ink'] ?? '#000000', a); ctx.fillRect(0, 0, W, H); }
  if (post.color) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); colorGrade(ctx, ctx.canvas.width, ctx.canvas.height, post.color, t); ctx.restore(); }
  const bar = barHeight(film);
  if (bar > 0) { ctx.fillStyle = g.barColor || '#000'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar); }
}
export const applyGrade = span('grade.post', applyGrade_);
