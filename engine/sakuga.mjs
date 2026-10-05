// Primitivas de "sakuga" (F5): impact frames y smear como DATOS además de píxeles. Cada llamada deja metadatos
// (`boxes.meta`, prim 'impact' | 'smear') para que engine/arc.mjs mida el presupuesto por escena, la sincronía
// impacto–transitorio de audio y si se concentran en el pico. Funciones puras de t; sin estado entre frames.
import { clamp } from './core.mjs';
import { DOC } from './prims.mjs';

const SAKUGA_DOC = {
  impact: ['api.impact(at, {frames, mode, x, y, color, rays})', 'Impact frame: `frames` fotogramas (2 por defecto, a fps del film) desde `at` (s, relativo al shot). mode "invert" (negativo de todo el cuadro) | "burst" (rayos radiales desde x,y) | "both" (1.º invertido, resto rayos). Llamarlo SIEMPRE (no dentro de un if): fuera de su ventana no dibuja, pero registra el impacto para arc (presupuesto y sincronía con el audio).'],
  smear: ['api.smear(x, y, vx, vy, fn)', 'Smear: estira el dibujo de fn en el eje de la velocidad (px/s) según motion.smear del estilo; no hace nada si el estilo no lo pide. Cuando estira, lo registra (arc mide segundos de smear por escena).'],
};
for (const [k, [sig, text]] of Object.entries(SAKUGA_DOC)) DOC[k] = { sig, text };

// Impactos DECLARADOS (api.impact registrado en meta, y sfx type:"impact" del timeline): su salto de energía es intencional, no un pop.
export const declaredImpacts = (film, metas = []) => [
  ...metas.filter((m) => m.prim === 'impact').map((m) => ({ t: +m.t, frames: m.frames ?? 2 })),
  ...film.shots.flatMap((s) => (s.sfx ?? []).filter((e) => e.type === 'impact').map((e) => ({ t: s.t[0] + e.at, frames: 2 }))),
];
export const inImpact = (t, imps, fps) => imps.some((m) => t >= m.t - 0.5 / fps && t <= m.t + (m.frames + 1.5) / fps);

export function sakuga(ctx, api, film, shot, cx) {
  const S = film.S, W = film.width, H = film.height, log = (prim, extra) => api.meta.push({ prim, shot: shot.id, ...extra });
  return {
    smear(x, y, vx, vy, fn) {
      const kk = S.motion.smear || 0, sp = Math.hypot(vx, vy);
      if (!kk || sp < 1) return fn();
      const st = 1 + kk * clamp(sp / (W * 0.6)), an = Math.atan2(vy, vx);
      if (st > 1.001) log('smear', { x, y, st: +st.toFixed(4) });
      ctx.save(); ctx.translate(x, y); ctx.rotate(an); ctx.scale(st, 1 / Math.sqrt(st)); ctx.rotate(-an); ctx.translate(-x, -y); fn(); ctx.restore();
    },
    impact(at, o = {}) {
      const frames = o.frames ?? 2, mode = o.mode ?? 'both', x = o.x ?? W / 2, y = o.y ?? H / 2;
      log('impact', { at, t: shot.t[0] + at, frames, x, y });
      const k = Math.floor((cx.t - shot.t[0] - at) * film.fps + 1e-6);           // índice de fotograma dentro del impacto
      if (k < 0 || k >= frames) return false;
      const invert = mode === 'invert' || (mode === 'both' && k === 0), b = cx.base;
      ctx.save();
      if (invert) {                                                             // negativo de todo el cuadro (en px de dispositivo)
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      } else {                                                                  // rayos radiales deterministas (sin rng: ángulos fijos)
        ctx.setTransform(b.a, b.b, b.c, b.d, b.e, b.f);
        const n = o.rays ?? 24, R = Math.hypot(W, H), r0 = Math.min(W, H) * (0.08 + 0.05 * k);
        ctx.fillStyle = api.color(o.color ?? 'ink');
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + (i % 2) * 0.07, w = (i % 3 === 0 ? 0.035 : 0.018);
          ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
          ctx.lineTo(x + Math.cos(a - w) * R, y + Math.sin(a - w) * R); ctx.lineTo(x + Math.cos(a + w) * R, y + Math.sin(a + w) * R); ctx.closePath(); ctx.fill();
        }
      }
      ctx.restore();
      return true;
    },
  };
}
