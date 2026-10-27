// frame.js: frame(ctx,t) PURA. Disena en 1920x1080 y escala segun ctx.canvas (preview a 1/4). Tres escenas: sobre (objeto por piezas), mapa (costas reales),
// mar (botella y moneda). Las transiciones son motivadas: la mancha de tinta del sobre revela el mapa; el nivel del agua sube del mapa al mar.
import { createCanvas } from 'canvas';
import { outBack, inOutCubic, spring, clamp, smoothstep } from '../../kit/base.mjs';
import { papel, agua, tinta, grano, vineta } from '../../kit/materia.mjs';
import { tubo } from '../../kit/formas.mjs';
import { botella, moneda, sobre } from '../../kit/objetos.mjs';
import { encuadre, dibujarCostas, graticula, proyectar, marcador, ruta } from '../../kit/mapa.mjs';
import { revelarTinta, cortinaAgua } from '../../kit/transiciones.mjs';
import { texto, textoEn, cifrasTabulares, escribirse } from '../../kit/texto.mjs';
import { conCamara } from '../../kit/camara.mjs';
import { fps, W, H, escenas, cruces } from './timeline.js';
import { hechos } from './hechos.js';
export { W, H };

const INK = '#1f2a36', CREMA = '#f4efe2', ULT = { texto: [], objetos: [], sujeto: null };
let REG = true; // solo la escena principal registra cajas (no la que entra durante un cruce)
const reg = (k, id, b) => { if (REG) ULT[k].push({ id, ...b }); };
const ENC = encuadre({ lon0: -13, lat0: 41.5, lon1: 6, lat1: 56 }, W, H);

function escenaSobre(g, lt, dur) {
  papel(g, W, H, { tono: '#e7dcc3', seed: 4 });
  const caida = outBack(clamp(lt / 1.1), 1.3), abre = inOutCubic(clamp((lt - 1.3) / 1.6));
  const s = sobre(g, { x: 640, y: 712 - (1 - caida) * 260, w: 900, abierto: abre, rot: -0.03 + (1 - caida) * 0.08, seed: 5 });
  reg('objetos', 'sobre', s.caja); if (REG) ULT.sujeto = s.caja;
  const a = smoothstep(0.2, 1, lt);
  reg('texto', 'titulo', textoEn(g, hechos.titulo, { x: 1160, y: 330, w: 680, h: 270 }, { tam: 96, peso: 'bold', color: INK, alfa: a }));
  reg('texto', 'subtitulo', escribirse(hechos.subtitulo, lt - 2.2, { cps: 24, ctx: g, x: 1160, y: 660, alinear: 'left', tam: 40, color: '#3a3f46' }));
  tinta(g, 640, 640, 560, clamp(lt - (dur - 2.4), 0, 9), 3);
}

function escenaMapa(g, lt) {
  dibujarCostas(g, ENC, { estilo: 'acuarela', seed: 7 }); graticula(g, ENC);
  const o = proyectar(hechos.origen.lon, hechos.origen.lat, ENC), d = proyectar(hechos.destino.lon, hechos.destino.lat, ENC), u = clamp((lt - 1.2) / 3.2);
  ruta(g, o, d, inOutCubic(u), { arco: 0.2, grosor: 5 });
  const m1 = marcador(g, { x: o[0], y: o[1], nombre: hechos.origen.nombre }, { u: clamp((lt - 0.4) / 1.2) }), m2 = marcador(g, { x: d[0], y: d[1], nombre: hechos.destino.nombre }, { u: clamp((lt - 4) / 1.2) });
  for (const m of [m1, m2]) if (m) { reg('objetos', 'pin', m.pin); if (m.etiqueta) reg('texto', 'lugar', m.etiqueta); }
  reg('texto', 'pie', textoEn(g, hechos.mapa, { x: 120, y: 940, w: 900, h: 70 }, { tam: 46, color: INK, fondoVelo: '#eef3f2', alfa: smoothstep(1, 2, lt) }));
  if (REG) ULT.sujeto = { x: 0, y: 0, w: W, h: H };
}

function escenaMar(g, lt) {
  agua(g, W, H, lt + 3, { arriba: '#2d6f78', abajo: '#0b2f3b', particulas: 80 });
  const entra = spring(lt - 0.2, 0.45, 7), by = 620 + (1 - entra) * 500 + Math.sin(lt * 0.9) * 10, b = botella(g, { x: 840, y: by, alto: 1350, rot: 1.32 + Math.sin(lt * 0.9) * 0.025, lleno: 0.4, algas: 0.8, t: lt, seed: 6 });
  reg('objetos', 'botella', b.caja); if (REG) ULT.sujeto = b.caja;
  const v = hechos.cifra.valor * inOutCubic(clamp((lt - 1.2) / 3.2)), a = smoothstep(1, 1.6, lt);
  reg('texto', 'etiqueta', texto(g, hechos.cifra.etiqueta, 120, 80, { tam: 40, color: CREMA, fondoVelo: '#0b2f3b', alfa: a }));
  reg('texto', 'cifra', cifrasTabulares(g, v, 120, 140, { tam: 150, color: CREMA }));
  const s1 = Math.sin(lt * 0.9) * 12, s2 = Math.sin(lt * 0.9 - 0.4) * 22;
  tubo(g, [[1650, -20], [1650 + s1, 160], [1650 + s2, 270]], { grosor: 7, color: '#7b5f3d', seed: 5 });
  const c = moneda(g, { x: 1650 + s2, y: 380, r: 105, giro: lt * 1.1, leyenda: 'PRIMUS ANNUS', rot: Math.sin(lt * 0.9 - 0.4) * 0.12 }); reg('objetos', 'moneda', c.caja);
  const f = smoothstep(7, 8, lt); if (f > 0) reg('texto', 'final', texto(g, hechos.final, 1500, 1000, { tam: 48, color: CREMA, alinear: 'center', alfa: f, fondoVelo: '#0b2f3b' }));
}

const ESC = [escenaSobre, escenaMapa, escenaMar];
const inicio = (i) => escenas[i].t0 - (i > 0 ? cruces[i - 1] : 0);
const TRANS = [
  (ctx, u, A, B) => revelarTinta(ctx, u, A, B, { origen: { x: 0.33, y: 0.59 }, color: '#17222e', seed: 3 }),
  (ctx, u, A, B) => cortinaAgua(ctx, u, A, B, { modo: 'sube', color: '#2d6f78' }),
];
/** frame(ctx,t): dibuja el fotograma del instante t (segundos); sin estado entre llamadas. */
export function frame(ctx, t) {
  ULT.texto.length = 0; ULT.objetos.length = 0; ULT.sujeto = null; REG = true;
  const w = ctx.canvas.width, h = ctx.canvas.height, k = w / W, fi = Math.round(t * fps), last = escenas.length - 1;
  const dib = (c, i, registra) => { REG = registra; const lt = Math.max(0, t - inicio(i)), e = escenas[i]; conCamara(c, lt, 'medio', (g) => { g.scale(k, k); ESC[i](g, lt, e.dur + (i < last ? cruces[i] : 0)); }, { dur: e.dur, seed: i + 1 }); REG = true; };
  let i = escenas.findIndex((e) => t < e.t0 + e.dur); if (i < 0) i = last;
  const e = escenas[i], c0 = i < last ? cruces[i] : 0;
  if (i < last && t > e.t0 + e.dur - c0) TRANS[i](ctx, (t - (e.t0 + e.dur - c0)) / c0, (c) => dib(c, i, true), (c) => dib(c, i + 1, false));
  else dib(ctx, i, true);
  vineta(ctx, w, h, 0.38); grano(ctx, w, h, fi, 0.05);
}
/** cajas(t): {texto, objetos, sujeto} en coordenadas de diseno 1920x1080 para la auditoria. */
export function cajas(t) { frame(createCanvas(96, 54).getContext('2d'), t); return { texto: ULT.texto.map((b) => ({ ...b })), objetos: ULT.objetos.map((b) => ({ ...b })), sujeto: ULT.sujeto && { ...ULT.sujeto } }; }
