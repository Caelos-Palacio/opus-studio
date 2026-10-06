import { springS } from '../engine/core.mjs';
// Lógica de A1 que no es declarable (entidad `dot`: el punto que late). La escena vive en A1.scene.json (spec 010).
const vis = (film) => { const g = film.S.grade.letterbox, bar = g ? Math.max(0, (film.height - film.width / g) / 2) : 0; return { bar, h: film.height - 2 * bar }; };
const pulse = (t, shot, film, P) => (shot.on_beat_at ?? []).reduce((a, b) => a + P.pulse * springS(t - shot.t[0] - b, film) * Math.exp(-3 * Math.max(0, t - shot.t[0] - b)), 0);
export const dot = (t, film) => {
  const shot = film.shots.find((s) => s.id === 'A1'), v = vis(film), P = film.params('A1', t);
  return { x: film.width / 2, y: v.bar + v.h * P.y, s: P.size * v.h * springS(t - shot.t[0], film) * (1 + pulse(t, shot, film, P)) };
};
