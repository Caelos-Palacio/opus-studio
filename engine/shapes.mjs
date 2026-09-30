// Catálogo de formas del MOTIVO. Todas comparten una parametrización (caja redondeada con marco de grosor `th`),
// así que morph = interpolar parámetros (forma→forma), no píxeles: dot→ring abre el hueco; ring→frame endereza el radio.
//   w,h: caja · r: radio de esquina · th: grosor del marco (≥ min(w,h)/2 ⇒ sólido) · sat: satélite (orbit)
import { lerp } from './core.mjs';
export const SHAPES = {
  dot:   (s) => ({ w: s, h: s, r: s / 2, th: s / 2, sat: 0 }),
  ring:  (s) => ({ w: s, h: s, r: s / 2, th: 0.1 * s, sat: 0 }),
  bar:   (s) => ({ w: 3 * s, h: 0.3 * s, r: 0.15 * s, th: 0.15 * s, sat: 0 }),
  frame: (s) => ({ w: 3.5 * s, h: 2 * s, r: 0.08 * s, th: 0.035 * s, sat: 0 }),
  card:  (s) => ({ w: 2.4 * s, h: 1.6 * s, r: 0.14 * s, th: 0.8 * s, sat: 0 }),
  orbit: (s) => ({ w: s, h: s, r: s / 2, th: 0.06 * s, sat: 1 }),
};
export const SHAPE_NAMES = Object.keys(SHAPES);
export const lerpShape = (a, b, u) => ({ w: lerp(a.w, b.w, u), h: lerp(a.h, b.h, u), r: lerp(a.r, b.r, u), th: lerp(a.th, b.th, u), sat: lerp(a.sat, b.sat, u) });
