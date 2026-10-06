import { springS, lerp, smooth, seg } from '../engine/core.mjs';
import A1 from './A1.mjs';
// Lógica de A2 que no es declarable (entidad `dot`: hereda el punto de A1 y abre el anillo). La escena vive en A2.scene.json (spec 010).
export const dot = (t, film) => {
  const s = film.shots.find((x) => x.id === 'A2'), st = A1.entities.dot(s.t[0], film), k = springS(t - s.t[0], film, 'soft'), P = film.params('A2', t);
  const g = film.S.grade.letterbox, bar = g ? Math.max(0, (film.height - film.width / g) / 2) : 0, vh = film.height - 2 * bar;
  return { x: lerp(st.x, film.width * P.x, k), y: st.y, s: lerp(st.s, P.size * vh, k), u: smooth(seg(t, s.t[0] + P.openIn, s.t[1])) };
};
