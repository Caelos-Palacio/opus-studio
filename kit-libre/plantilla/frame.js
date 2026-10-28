// frame.js: frame(ctx,t) PURA. Disena en 1920x1080 y escala segun ctx.canvas (preview a 1/4).
// La GRAMATICA (el medio) se elige con GRAMATICA=neon|tiza|papel (ver README: se elige por tema). La plantilla solo habla con `G`; nada de papel fijo.
// Tres escenas: titulo (un objeto, un texto, un acento), ruta (una linea que se dibuja entre dos puntos) y cifra (un numero que cuenta). El corte entre escenas es el del medio (G.transicion).
import { createCanvas } from 'canvas';
import { clamp, smoothstep, inOutCubic, outBack } from '../kit/base.mjs';
import { elegir, FARO } from '../kit/gramaticas/index.mjs';
import { conCamara } from '../kit/camara.mjs';
import { fps, W, H, escenas, cruces } from './timeline.js';
import { hechos } from './hechos.js';
export { W, H };

export const GRAMATICA = process.env.GRAMATICA || 'tiza';
const G = elegir(GRAMATICA); // elegir('neon', { a1: '#ffb000' }) cambia la paleta
const ULT = { texto: [], objetos: [], sujeto: null };
let REG = true; // solo la escena principal registra cajas (no la que entra durante un cruce)
const reg = (k, id, b) => { if (REG) ULT[k].push({ id, ...b }); };
const grosor = { neon: 15, tiza: 11, papel: 7 }[GRAMATICA], tam = { neon: 100, tiza: 104, papel: 112 }[GRAMATICA], tamCifra = { neon: 230, tiza: 210, papel: 210 }[GRAMATICA];
const pl = (P, x, y, s) => P.flatMap((q, i) => { const a = i ? P[i - 1] : q, n = i ? Math.max(1, Math.ceil(Math.hypot(q[0] - a[0], q[1] - a[1]) * s / 30)) : 1; return Array.from({ length: n }, (_, k) => i ? [x + (a[0] + (q[0] - a[0]) * (k + 1) / n) * s, y + (a[1] + (q[1] - a[1]) * (k + 1) / n) * s] : [x + q[0] * s, y + q[1] * s]); });

function escenaTitulo(g, lt, t) {
  G.soporte(g, W, H, t); const u = clamp(lt / 3.2), s = 840, x = 110, y = 120;
  FARO.cuerpo.forEach((p, i) => { const k = clamp(u * 1.5 - i * 0.05); G.trazo(g, pl(p, x, y, s), { grosor, seed: 10 + i, t, u: k, encendido: k, color: GRAMATICA === 'neon' ? G.paleta.a1 : null }); });
  FARO.luz.forEach((p, i) => { const k = clamp(u * 1.5 - 0.3); G.trazo(g, pl(p, x, y, s), { grosor: grosor * 0.8, seed: 30 + i, t, u: k, encendido: k, color: G.paleta.a2 }); });
  reg('objetos', 'faro', { x, y, w: s, h: s }); if (REG) ULT.sujeto = { x, y, w: s, h: s };
  const a = smoothstep(0.4, 1.4, lt), c = G.texto(g, hechos.titulo, 1000, 330, { tam, t, seed: 3, encendido: a, alfa: GRAMATICA === 'papel' ? a : 1 }); reg('texto', 'titulo', c);
  G.acento(g, c, { forma: GRAMATICA === 'papel' ? 'mancha' : 'subrayado', u: clamp((lt - 2) / 1.2), t, seed: 6 });
  reg('texto', 'subtitulo', G.texto(g, hechos.subtitulo, 1000, 600, { tam: tam * 0.38, t, seed: 4, color: GRAMATICA === 'neon' ? G.paleta.a2 : undefined, peso: GRAMATICA === 'papel' ? 'normal' : 'bold', encendido: smoothstep(2.4, 3.4, lt), alfa: smoothstep(2.4, 3.4, lt) }));
}

function escenaRuta(g, lt, t) {
  G.soporte(g, W, H, t, { seed: 5 }); const o = [300, 760], d = [1560, 330], u = inOutCubic(clamp((lt - 1) / 3.6));
  const curva = Array.from({ length: 40 }, (_, i) => { const q = i / 39; return [o[0] + (d[0] - o[0]) * q + Math.sin(q * 6) * 40, o[1] + (d[1] - o[1]) * q - Math.sin(q * Math.PI) * 220 + Math.cos(q * 9) * 18]; });
  G.trazo(g, curva, { grosor: grosor * 0.9, seed: 7, t, u, encendido: u, color: GRAMATICA === 'neon' ? G.paleta.a1 : null });
  for (const [p, n, a] of [[o, hechos.origen, 0.2], [d, hechos.destino, 3.8]]) {
    const k = clamp((lt - a) / 0.8), r = 34 * outBack(k, 1.4), ring = Array.from({ length: 28 }, (_, i) => [p[0] + Math.cos(i / 27 * 6.4) * r, p[1] + Math.sin(i / 27 * 6.4) * r]);
    if (k > 0) { G.trazo(g, ring, { grosor: grosor * 0.8, seed: 40, t, color: G.paleta.a2 }); reg('texto', 'lugar', G.texto(g, n, p[0] - 120, p[1] + 60, { tam: tam * 0.45, t, seed: 8, alfa: k, color: GRAMATICA === 'neon' ? G.paleta.a2 : undefined })); reg('objetos', 'pin', { x: p[0] - r, y: p[1] - r, w: 2 * r, h: 2 * r }); }
  }
  const c = G.texto(g, hechos.mapa, 960, 900, { tam: tam * 0.55, alinear: 'center', t, seed: 9, encendido: smoothstep(1.5, 2.5, lt), alfa: smoothstep(1.5, 2.5, lt) }); reg('texto', 'pie', c);
  if (REG) ULT.sujeto = { x: 0, y: 0, w: W, h: H };
}

function escenaCifra(g, lt, t) {
  G.soporte(g, W, H, t, { seed: 8 }); const v = Math.round(hechos.cifra.valor * inOutCubic(clamp((lt - 0.8) / 3.2))), s = String(v).replace(/\B(?=(\d{3})+$)/g, ' ');
  reg('texto', 'etiqueta', G.texto(g, hechos.cifra.etiqueta, 960, 220, { tam: tam * 0.5, alinear: 'center', t, seed: 11, color: GRAMATICA === 'neon' ? G.paleta.a2 : undefined, encendido: smoothstep(0.2, 1, lt), alfa: smoothstep(0.2, 1, lt) }));
  const c = G.texto(g, s, 960, 400, { tam: tamCifra, alinear: 'center', t, seed: 12 }); reg('texto', 'cifra', c);
  G.acento(g, c, { forma: GRAMATICA === 'tiza' ? 'circulo' : GRAMATICA === 'neon' ? 'marco' : 'mancha', u: clamp((lt - 4.2) / 1.2), t, seed: 13 });
  const f = smoothstep(7, 8, lt); if (f > 0) reg('texto', 'final', G.texto(g, hechos.final, 960, 880, { tam: tam * 0.5, alinear: 'center', t, seed: 14, alfa: f, encendido: f }));
  if (REG) ULT.sujeto = { x: 0, y: 0, w: W, h: H };
}

const ESC = [escenaTitulo, escenaRuta, escenaCifra];
const inicio = (i) => escenas[i].t0 - (i > 0 ? cruces[i - 1] : 0);
/** frame(ctx,t): dibuja el fotograma del instante t (segundos); sin estado entre llamadas. */
export function frame(ctx, t) {
  ULT.texto.length = 0; ULT.objetos.length = 0; ULT.sujeto = null; REG = true;
  const w = ctx.canvas.width, h = ctx.canvas.height, k = w / W, fi = Math.round(t * fps), last = escenas.length - 1;
  const dib = (c, i, registra) => { REG = registra; const lt = Math.max(0, t - inicio(i)); conCamara(c, lt, 'medio', (g) => { g.scale(k, k); ESC[i](g, lt, t); }, { dur: escenas[i].dur, seed: i + 1 }); REG = true; };
  let i = escenas.findIndex((e) => t < e.t0 + e.dur); if (i < 0) i = last;
  const e = escenas[i], c0 = i < last ? cruces[i] : 0;
  if (i < last && t > e.t0 + e.dur - c0) G.transicion(ctx, (t - (e.t0 + e.dur - c0)) / c0, (c) => dib(c, i, true), (c) => dib(c, i + 1, false));
  else dib(ctx, i, true);
  G.post(ctx, w, h, fi);
}
/** cajas(t): {texto, objetos, sujeto} en coordenadas de diseno 1920x1080 para la auditoria. */
export function cajas(t) { frame(createCanvas(96, 54).getContext('2d'), t); return { texto: ULT.texto.map((b) => ({ ...b })), objetos: ULT.objetos.map((b) => ({ ...b })), sujeto: ULT.sujeto && { ...ULT.sujeto } }; }
