// comun.mjs: utilidades compartidas por las gramaticas (medios). Una gramatica es un objeto {nombre,cuando,paleta,soporte,trazo,texto,acento,post,transicion}.
// El contrato (todo PURO y determinista; coordenadas en el espacio de diseno 1920x1080 salvo que se diga otra cosa):
//   soporte(ctx,W,H,t,{paleta,seed,...})   fondo con materia propia y vida sutil (depende de t)
//   trazo(ctx,puntos,{color,grosor,seed,t,encendido,...}) como se dibuja UNA linea en ese medio; devuelve su caja {x,y,w,h}
//   texto(ctx,str,x,y,{tam,color,alinear,alfa,seed,t,...}) tipografia propia; devuelve {x,y,w,h,color,tam,alfa} (para la auditoria)
//   acento(ctx,caja,{forma,u,color,seed,t}) como se marca lo importante (u 0..1 = progreso)
//   post(ctx,W,H,frameIndex)               tratamiento final de todo el cuadro
//   transicion(ctx,u,A,B,opts)             el corte propio del medio (u<=0 A, u>=1 B)
import { createCanvas } from 'canvas';
import { hash, rng, valor, clamp } from '../base.mjs';

/** paleta(defecto,cambios): mezcla superficial; `neutro` (soporte), `tinta` (texto y trazo principal), `a1` y `a2` (acentos). */
export const paleta = (def, cambios) => ({ ...def, ...(cambios || {}) });

const C = new Map(), CT = new Map();
/** lienzoCache(clave,w,h,fn,{chico}): lienzo que se dibuja UNA vez (fn(g)) y se reutiliza. `chico` = piezas pequenas y numerosas (textos): cache aparte, para que no expulsen al fondo. */
export function lienzoCache(clave, w, h, fn, { chico = false } = {}) {
  const M = chico ? CT : C; let c = M.get(clave);
  if (!c) { if (M.size > (chico ? 400 : 40)) M.clear(); c = createCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h))); fn(c.getContext('2d'), c); M.set(clave, c); }
  return c;
}
/** capaTemporal(w,h): lienzo transparente nuevo (no cacheado) para componer un trazo o un texto. */
export const capaTemporal = (w, h) => createCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
/** limpiarGramaticas(): vacia las cachas de las gramaticas. */
export const limpiarGramaticas = () => { C.clear(); CT.clear(); };

/** parpadeo(t,seed,{raro}): factor de brillo 0..1; casi siempre ~1 con zumbido y, de vez en cuando, caidas bruscas (tubo que falla). */
export function parpadeo(t, seed = 1, raro = 0.12) {
  const k = Math.floor(t * 9), r = rng(hash(`p${seed}|${k}`))(), caida = r < raro ? 0.15 + 0.5 * rng(hash(`q${seed}|${k}`))() : 1;
  return clamp(caida * (0.93 + 0.07 * Math.sin(t * 47 + seed) * valor(t * 3, seed, seed)), 0, 1);
}

/** longitudes(P): longitud acumulada de una polilinea [[x,y]...] y total. */
export function longitudes(P) { const a = [0]; for (let i = 1; i < P.length; i++) a.push(a[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); return { acum: a, total: a[a.length - 1] }; }
/** recortarPor(P,u): primera fraccion u (0..1) de la polilinea. */
export function recortarPor(P, u) {
  const { acum, total } = longitudes(P), L = total * clamp(u, 0, 1), out = [P[0]];
  for (let i = 1; i < P.length; i++) { if (acum[i] <= L) out.push(P[i]); else { const k = (L - acum[i - 1]) / Math.max(1e-6, acum[i] - acum[i - 1]); out.push([P[i - 1][0] + (P[i][0] - P[i - 1][0]) * k, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * k]); break; } }
  return out;
}
export const cajaDe = (P, m = 0) => { const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]), x = Math.min(...xs) - m, y = Math.min(...ys) - m; return { x, y, w: Math.max(...xs) + m - x, h: Math.max(...ys) + m - y }; };

/**
 * FIGURAS: dibujos de ejemplo como polilineas, comunes a las tres gramaticas (cada medio las dibuja a su manera). Coordenadas 0..1 en una caja cuadrada.
 * `faro`: torre con rayas, galeria, linterna, tejado y haces de luz. Devuelve {cuerpo:[...polilineas], luz:[...polilineas]}.
 */
export const FARO = {
  cuerpo: [
    [[0.36, 1.0], [0.42, 0.28], [0.58, 0.28], [0.64, 1.0]], [[0.395, 0.62], [0.605, 0.62]], [[0.375, 0.8], [0.625, 0.8]],
    [[0.34, 0.28], [0.66, 0.28]], [[0.36, 0.28], [0.36, 0.22], [0.64, 0.22], [0.64, 0.28]], [[0.43, 0.22], [0.43, 0.1], [0.57, 0.1], [0.57, 0.22]],
    [[0.41, 0.1], [0.5, 0.0], [0.59, 0.1], [0.41, 0.1]], [[0.46, 0.16], [0.54, 0.16]], [[0.47, 1.0], [0.47, 0.9], [0.53, 0.9], [0.53, 1.0]], [[0.2, 1.0], [0.8, 1.0]],
  ],
  luz: [[[0.43, 0.15], [0.02, 0.05]], [[0.43, 0.17], [0.0, 0.2]], [[0.57, 0.15], [0.98, 0.05]], [[0.57, 0.17], [1.0, 0.2]]],
};
