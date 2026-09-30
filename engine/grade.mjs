// Post: viñeta, grano determinista (semilla = fotograma a 24 fps), fundido y letterbox. Parámetros del estilo.
import { rng } from './core.mjs';
import { rgba } from './color.mjs';
import { bloom, chroma, colorGrade, pool } from './fx.mjs';
export function barHeight(film) {
  const g = film.S.grade; if (!g.letterbox) return 0;
  const vis = film.width / g.letterbox; return vis < film.height ? (film.height - vis) / 2 : 0;
}
export function applyGrade(ctx, film, t) {
  const g = film.S.grade, W = film.width, H = film.height, post = g.post ?? {};
  if (post.bloom || post.chroma) {                                        // post global sobre el fotograma ya compuesto (px de dispositivo)
    const cv = ctx.canvas, snap = pool(film).get(cv.width, cv.height); snap.getContext('2d').drawImage(cv, 0, 0);
    if (post.chroma) { chroma(snap, post.chroma * (cv.width / W)); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(snap, 0, 0); ctx.restore(); }
    if (post.bloom) bloom(film, ctx, snap, { ...post.bloom, radius: (post.bloom.radius ?? 24) * (cv.width / W) });
  }
  if (g.vignette > 0) {
    const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.55);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${g.vignette})`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
  if (g.grain > 0) {
    const r = rng(Math.floor(t * 24) * 7919 + 17), n = Math.round(W * H * g.grain * 0.02), s = 1.4 * Math.max(1, W / 1280);
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; for (let i = 0; i < n; i++) ctx.fillRect(r() * W, r() * H, s, s);
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < n; i++) ctx.fillRect(r() * W, r() * H, s, s);
  }
  const f = g.fade ?? {}; let a = 0;
  if (f.in > 0 && t < f.in) a = 1 - t / f.in;
  if (f.out > 0 && t > film.duration - f.out) a = Math.max(a, (t - (film.duration - f.out)) / f.out);
  if (a > 0) { ctx.fillStyle = rgba(film.palette[f.color ?? 'ink'] ?? '#000000', a); ctx.fillRect(0, 0, W, H); }
  if (post.color) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); colorGrade(ctx, ctx.canvas.width, ctx.canvas.height, post.color, t); ctx.restore(); }
  const bar = barHeight(film);
  if (bar > 0) { ctx.fillStyle = g.barColor || '#000'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar); }
}
