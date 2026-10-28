// papel.mjs: gramatica PAPEL (la del kit v1/v2 extraida): papel con fibra, acuarela, pluma y serif. Es una opcion mas, no la de por defecto.
// Se reconoce a 1x por la fibra del papel, el borde oscuro de la acuarela y el serif de tinta.
import { clamp } from '../base.mjs';
import { papel as papelBase, acuarela, grano, vineta } from '../materia.mjs';
import { trazoMano } from '../formas.mjs';
import { texto as textoBase } from '../texto.mjs';
import { revelarTinta } from '../transiciones.mjs';
import { paleta } from './comun.mjs';

const PALETA = { neutro: '#e7dcc3', tinta: '#1f2a36', a1: '#a8452f', a2: '#3d7f8c' };

/** soporte(ctx,W,H,t,{paleta,seed}): papel con fibra y viñeta; una luz de ventana muy lenta pasa por encima (vida sutil). */
export function soporte(ctx, W, H, t, { paleta: pp, seed = 4 } = {}) {
  const p = paleta(PALETA, pp); papelBase(ctx, W, H, { tono: p.neutro, seed });
  const x = W * (0.3 + 0.4 * (0.5 + 0.5 * Math.sin(t * 0.12))), gr = ctx.createRadialGradient(x, H * 0.2, 0, x, H * 0.2, W * 0.6); gr.addColorStop(0, 'rgba(255,248,230,0.1)'); gr.addColorStop(1, 'rgba(255,248,230,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
}
/** trazo(ctx,puntos,{color,grosor,seed}): pluma o lapiz con presion y temblor (trazoMano). */
export function trazo(ctx, puntos, { color = null, grosor = 8, seed = 1, paleta: pp, presion } = {}) { const p = paleta(PALETA, pp); trazoMano(ctx, puntos, { tam: grosor, color: color ?? p.tinta, seed, presion }); const xs = puntos.map((q) => q[0]), ys = puntos.map((q) => q[1]), x = Math.min(...xs); return { x, y: Math.min(...ys), w: Math.max(...xs) - x, h: Math.max(...ys) - Math.min(...ys) }; }
/** texto(ctx,str,x,y,{tam,peso,color,alinear,alfa}): serif de tinta. */
export function texto(ctx, str, x, y, { tam = 72, peso = 'bold', color = null, alinear = 'left', alfa = 1, paleta: pp } = {}) { const p = paleta(PALETA, pp); return textoBase(ctx, str, x, y, { tam, peso, color: color ?? p.tinta, alinear, alfa }); }
/** acento(ctx,caja,{forma:'mancha'|'subrayado',u,color,seed}): lo importante se marca con un lavado de acuarela debajo (u = opacidad) o con un subrayado de pluma. */
export function acento(ctx, caja, { forma = 'mancha', u = 1, color = null, seed = 6, paleta: pp } = {}) {
  const p = paleta(PALETA, pp), c = color ?? p.a1, { x, y, w, h } = caja;
  if (forma === 'subrayado') { const yy = y + h + 8; trazoMano(ctx, [[x - 8, yy], [x + w * 0.5, yy + 4], [x + w + 8, yy - 2]].map(([a, b], i, A) => [a * clamp(u * 1.2, 0, 1) + A[0][0] * (1 - clamp(u * 1.2, 0, 1)), b]), { tam: 7, color: c, seed }); return caja; }
  const m = h * 0.25; ctx.save(); ctx.globalAlpha = clamp(u, 0, 1) * 0.7; ctx.globalCompositeOperation = 'multiply';
  acuarela(ctx, [[x - m * 2, y + h * 0.1], [x + w * 0.3, y - m], [x + w * 0.7, y - m * 0.6], [x + w + m * 2, y + h * 0.1], [x + w + m, y + h + m], [x + w * 0.5, y + h + m * 1.4], [x - m, y + h + m * 0.6]], { color: c, capas: 26, seed }); ctx.restore(); return caja;
}
/** post(ctx,W,H,frameIndex): grano de pelicula y viñeta suave. */
export function post(ctx, W, H, fi = 0) { vineta(ctx, W, H, 0.38); grano(ctx, W, H, fi, 0.05); }
/** transicion(ctx,u,A,B): la mancha de tinta crece y por dentro aparece B (revelarTinta). */
export function transicion(ctx, u, A, B, { origen = { x: 0.5, y: 0.55 }, color = null, paleta: pp } = {}) { const p = paleta(PALETA, pp); revelarTinta(ctx, u, A, B, { origen, color: color ?? p.tinta, seed: 3 }); }

export default { nombre: 'papel', cuando: 'SI: historia, cartas, viajes, memoria, calidez artesanal; NO: tecnologia, noche urbana, energia o ritmo rapido.', paleta: PALETA, soporte, trazo, texto, acento, post, transicion };
