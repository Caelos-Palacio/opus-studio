// camara.mjs: empuje, microderiva y parallax por planos; desenfoque de movimiento por submuestras.
import { createCanvas } from 'canvas';
import { valor, clamp, smoothstep } from './base.mjs';

const PLANOS = { fondo: 0.3, medio: 0.7, sujeto: 1 };
/** conCamara(ctx,t,plano,fn,{empuje,dur,deriva,seed}): ejecuta fn(ctx) con empuje lento (2-6%) y microderiva; plano = 'fondo'(x0.3) | 'medio'(x0.7) | 'sujeto'(x1) o un factor. */
export function conCamara(ctx, t, plano, fn, { empuje = 0.04, dur = 10, deriva = 0.005, seed = 1 } = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height, f = PLANOS[plano] ?? plano, s = 1 + f * (2 * deriva + empuje * smoothstep(0, 1, clamp(t / dur)));
  const dx = (valor(t * 0.15, 0.5, seed) - 0.5) * 2 * deriva * W * f, dy = (valor(t * 0.15, 9.5, seed + 1) - 0.5) * 2 * deriva * H * f;
  ctx.save(); ctx.translate(W / 2 + dx, H / 2 + dy); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2); fn(ctx); ctx.restore();
}

const cv = new Map();
const lienzo = (k, W, H) => { const id = `${k}${W}x${H}`; if (!cv.has(id)) cv.set(id, createCanvas(W, H)); const g = cv.get(id).getContext('2d'); g.clearRect(0, 0, W, H); return cv.get(id); };
/** desenfoque(ctx,t,fn,{n,obtura}): promedia n submuestras de fn(ctx2,ts) en [t±obtura/2] (usar solo en movimientos rapidos; fn debe ser pura). */
export function desenfoque(ctx, t, fn, { n = 4, obtura = 1 / 30 } = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  if (n < 2) return fn(ctx, t);
  const acc = lienzo('acc', W, H), tmp = lienzo('tmp', W, H), ga = acc.getContext('2d'), gt = tmp.getContext('2d');
  for (let i = 0; i < n; i++) { gt.clearRect(0, 0, W, H); fn(gt, t + obtura * (i / (n - 1) - 0.5)); ga.globalAlpha = 1 / (i + 1); ga.drawImage(tmp, 0, 0); }
  ctx.drawImage(acc, 0, 0);
}
