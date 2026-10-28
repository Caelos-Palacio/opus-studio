// escena-generica.mjs: la MISMA escena (un objeto, un texto, un acento) en cualquier gramatica; sirve para compararlas y para la plantilla.
import { acuarela } from './kit/materia.mjs';
import { FARO } from './kit/gramaticas/index.mjs';
const denso = (P, paso) => P.flatMap((q, i) => { if (!i) return [q]; const a = P[i - 1], n = Math.max(1, Math.ceil(Math.hypot(q[0] - a[0], q[1] - a[1]) / paso)); return Array.from({ length: n }, (_, k) => [a[0] + (q[0] - a[0]) * (k + 1) / n, a[1] + (q[1] - a[1]) * (k + 1) / n]); });
const aPuntos = (pl, x, y, s) => denso(pl.map(([a, b]) => [x + a * s, y + b * s]), 30); // densos: asi un suavizado Catmull-Rom no redondea las esquinas
/** escenaGenerica(G,ctx,t,{W,H,u}): dibuja soporte, faro (trazos), titulo y acento en el espacio 1920x1080 (ctx ya escalado). Devuelve las cajas. */
export function escenaGenerica(G, ctx, t, { W = 1920, H = 1080, u = 1, titulo = 'Luz en la costa', seed = 3 } = {}) {
  G.soporte(ctx, W, H, t, { seed });
  if (G.nombre === 'papel') acuarela(ctx, denso([[0.37, 0.98], [0.425, 0.3], [0.575, 0.3], [0.63, 0.98], [0.37, 0.98]].map(([a, b]) => [160 + a * 760, 150 + b * 760]), 40), { color: G.paleta.a2, capas: 28, seed });
  const s = 760, x = 160, y = 150, g = G.nombre === 'neon' ? 15 : G.nombre === 'tiza' ? 11 : 7;
  FARO.cuerpo.forEach((pl, i) => G.trazo(ctx, aPuntos(pl, x, y, s), { grosor: g, seed: seed * 10 + i, t, u: clamp01(u * 1.4 - i * 0.04), encendido: clamp01(u * 1.4 - i * 0.04), color: G.nombre === 'neon' ? G.paleta.a1 : null }));
  FARO.luz.forEach((pl, i) => G.trazo(ctx, aPuntos(pl, x, y, s), { grosor: g * 0.8, seed: seed * 10 + 20 + i, t, u: clamp01(u * 1.4 - 0.2), encendido: clamp01(u * 1.4 - 0.2), color: G.paleta.a2 }));
  const tam = G.nombre === 'neon' ? 110 : G.nombre === 'tiza' ? 96 : 104, caja = G.texto(ctx, titulo, 1000, 380, { tam, t, seed, encendido: clamp01(u * 1.5) });
  const ac = G.acento(ctx, caja, { forma: G.nombre === 'tiza' ? 'subrayado' : G.nombre === 'neon' ? 'subrayado' : 'mancha', u: clamp01(u * 2 - 1), t, seed });
  return { texto: caja, acento: ac, sujeto: { x, y, w: s, h: s } };
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));
