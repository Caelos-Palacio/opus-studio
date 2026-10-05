import { springS, lerp, clamp } from '../engine/core.mjs';
import A2 from './A2.mjs';
// Lógica de A3 que no es declarable (entidad `dot`: el punto que viaja de A2 al centro). La escena vive en A3.scene.json.
const pulse = (t, shot, film, P) => (shot.on_beat_at ?? []).reduce((a, b) => a + P.pulse * springS(t - shot.t[0] - b, film) * Math.exp(-3 * Math.max(0, t - shot.t[0] - b)), 0);
export const dot = (t, film) => {
  const s = film.shots.find((x) => x.id === 'A3'), st = A2.entities.dot(s.t[0], film), k = springS(t - s.t[0], film, 'soft'), P = film.params('A3', t);
  const g = film.S.grade.letterbox, bar = g ? Math.max(0, (film.height - film.width / g) / 2) : 0, vh = film.height - 2 * bar;
  return { x: lerp(st.x, film.width / 2, k), y: lerp(st.y, bar + vh / 2, k), s: st.s * (1 + pulse(t, s, film, P)), u: clamp(k) };
};
