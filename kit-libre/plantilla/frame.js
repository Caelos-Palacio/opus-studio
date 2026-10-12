// frame.js: frame(ctx,t) PURA. Disena en 1920x1080 y escala segun ctx.canvas (preview a 1/4). Dos escenas de ejemplo.
import { createCanvas } from 'canvas';
import { outBack, inOutCubic, spring, clamp, smoothstep } from '../kit/base.mjs';
import { papel, acuarela, agua, tinta, metal, grano, vineta } from '../kit/materia.mjs';
import { torno, perfil, tubo, sombraContacto, trazoMano } from '../kit/formas.mjs';
import { texto, cifrasTabulares, escribirse } from '../kit/texto.mjs';
import { conCamara } from '../kit/camara.mjs';
import { fps, W, H, escenas, cruce } from './timeline.js';
import { hechos } from './hechos.js';
export { W, H };

const INK = '#1f2a36', CREMA = '#f4efe2', ULT = { texto: [], objetos: [] };
const reg = (k, id, b, tam) => ULT[k].push({ id, ...b, tam });
const BLOB = [[0, -1], [0.9, -0.6], [1, 0.3], [0.4, 1], [-0.6, 0.9], [-1, 0.1], [-0.7, -0.7]];
const BOTELLA = perfil([[-165, 14], [-140, 14], [-120, 20], [-60, 56], [120, 56], [160, 50]].map(([y, r]) => [y * 1.5, r * 1.5]));
const SUBRAYADO = Array.from({ length: 60 }, (_, i) => [160 + i * 12, 292 + 7 * Math.sin(i * 0.25)]);

function escenaPapel(g, lt) {
  papel(g, W, H, { tono: '#efe5d0', seed: 4 });
  const e = outBack(lt / 1.6, 1.3), cx = 1330, cy = 560 + Math.sin(lt * 0.8) * 6;
  g.save(); g.translate(cx, cy); g.scale(e, e); g.translate(-cx, -cy);
  acuarela(g, BLOB.map(([x, y]) => [cx + x * 300, 560 + y * 255]), { color: '#3d7f8c', seed: 2 });
  g.globalAlpha = smoothstep(1, 2, lt); acuarela(g, BLOB.map(([x, y]) => [cx - 120 + y * 110, 700 + x * 90]), { color: '#d49a3a', seed: 6, capas: 28 }); g.restore();
  tinta(g, cx + 60, 600, 150, clamp(lt - 1.8, 0, 9), 3);
  const f = inOutCubic((lt - 1) / 1.4), n = Math.floor(2 + f * 57); if (f > 0) trazoMano(g, SUBRAYADO.slice(0, n), { tam: 9, color: '#a8452f', seed: 3 });
  const dy = (1 - smoothstep(0.1, 1, lt)) * 24;
  reg('texto', 'titulo', texto(g, hechos.titulo, 160, 150 + dy, { tam: 104, peso: 'bold', color: INK, alfa: smoothstep(0.1, 1, lt) }), 104);
  reg('texto', 'subtitulo', texto(g, escribirse(hechos.subtitulo, lt - 2.6, { cps: 22 }), 160, 340, { tam: 44, color: '#3a3f46' }), 44);
  reg('objetos', 'mancha', { x: cx - 300 * e, y: cy - 255 * e, w: 600 * e, h: 510 * e });
}

function escenaAgua(g, lt) {
  agua(g, W, H, lt + 3, { arriba: '#78b8b0', abajo: '#0f3b4a', particulas: 80 });
  const y = 500 - 600 * (1 - spring(lt - 0.2, 0.4, 8)) + Math.sin(lt * 1.1) * 8;
  torno(g, BOTELLA, { x: 520, y, rot: Math.sin(lt * 0.9) * 0.05, tono: '#4a8f6a', luz: -0.55 });
  reg('objetos', 'botella', { x: 430, y: y - 250, w: 180, h: 500 });
  const v = hechos.cifra.valor * inOutCubic((lt - 1.2) / 3.2);
  if (lt > 1) { // el texto entra cuando acaba el cruce: asi nada de la escena anterior lo tapa
    g.globalAlpha = smoothstep(1, 1.6, lt);
    reg('texto', 'etiqueta', texto(g, hechos.cifra.etiqueta, 1010, 330, { tam: 40, color: CREMA, fondoVelo: '#0b2f3b' }), 40);
    reg('texto', 'cifra', cifrasTabulares(g, v, 1010, 390, { tam: 170, color: CREMA }), 170); g.globalAlpha = 1;
  }
  const s1 = Math.sin(lt * 0.9) * 12, s2 = Math.sin(lt * 0.9 - 0.4) * 22;
  tubo(g, [[1660, -20], [1660 + s1, 300], [1660 + s2, 560]], { grosor: 7, color: '#7b5f3d', seed: 5 });
  metal(g, 1660 + s2, 622, 62, { seed: 8 }); reg('objetos', 'moneda', { x: 1598 + s2, y: 560, w: 124, h: 124 });
  const a = smoothstep(5, 5.8, lt); if (a > 0) reg('texto', 'final', texto(g, hechos.final, 960, 850, { tam: 56, color: CREMA, alinear: 'center', alfa: a, fondoVelo: '#0b2f3b' }), 56);
}

const ESC = [escenaPapel, escenaAgua];
let tmp = null;
/** frame(ctx,t): dibuja el fotograma del instante t (segundos); sin estado entre llamadas. */
export function frame(ctx, t) {
  ULT.texto.length = 0; ULT.objetos.length = 0;
  const w = ctx.canvas.width, h = ctx.canvas.height, k = w / W, fi = Math.round(t * fps), last = escenas.length - 1;
  const dib = (c, i) => { const e = escenas[i], lt = Math.max(0, t - e.t0); conCamara(c, lt, 'medio', (g) => { g.scale(k, k); ESC[i](g, lt); }, { dur: e.dur, seed: i + 1 }); };
  let i = escenas.findIndex((e) => t < e.t0 + e.dur); if (i < 0) i = last;
  dib(ctx, i);
  const e = escenas[i];
  if (i < last && t > e.t0 + e.dur - cruce) {
    if (!tmp || tmp.width !== w || tmp.height !== h) tmp = createCanvas(w, h);
    tmp.getContext('2d').clearRect(0, 0, w, h); dib(tmp.getContext('2d'), i + 1);
    ctx.globalAlpha = smoothstep(e.t0 + e.dur - cruce, e.t0 + e.dur, t); ctx.drawImage(tmp, 0, 0); ctx.globalAlpha = 1;
  }
  vineta(ctx, w, h, 0.38); grano(ctx, w, h, fi, 0.05);
}
/** cajas(t): cajas {texto, objetos} en coordenadas de diseno 1920x1080 para la auditoria. */
export function cajas(t) { frame(createCanvas(96, 54).getContext('2d'), t); return { texto: ULT.texto.map((b) => ({ ...b })), objetos: ULT.objetos.map((b) => ({ ...b })) }; }
