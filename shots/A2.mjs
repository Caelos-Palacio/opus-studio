import { springS, lerp, smooth, seg } from '../engine/core.mjs';
import A1 from './A1.mjs';
// Hereda el estado exacto del punto en t=2.0 (handoff) y lo transforma: dot → ring (el hueco se abre).
const dot = (t, film) => {
  const s = film.shots.find((x) => x.id === 'A2'), st = A1.entities.dot(s.t[0], film), k = springS(t - s.t[0], film, 'soft');
  const g = film.S.grade.letterbox, bar = g ? Math.max(0, (film.height - film.width / g) / 2) : 0, vh = film.height - 2 * bar;
  return { x: lerp(st.x, film.width * 0.35, k), y: st.y, s: lerp(st.s, 0.3 * vh, k), u: smooth(seg(t, s.t[0] + 0.3, s.t[1])) };
};
export default {
  entities: { dot },
  draw(ctx, t, u, shot, film, api) {
    const d = dot(t, film), p = dot(t - api.dt, film), vx = (d.x - p.x) / api.dt, vy = (d.y - p.y) / api.dt;
    api.depth(0.25, () => { ctx.strokeStyle = api.color('shade'); ctx.lineWidth = 2; for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) { const x = film.width * (0.1 + i * 0.1), y = api.safe.y0 + api.safe.h * (0.15 + j * 0.25); ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 7); ctx.stroke(); } });
    api.glow(d.x, d.y, d.s * 1.6, 'accent', 0.25);
    api.smear(d.x, d.y, vx, vy, () => api.morph('dot', 'ring', d.u, { x: d.x, y: d.y, size: d.s, label: 'anillo' }));
    api.text(shot.text, film.width * 0.68, d.y, { role: 'h2', alpha: api.spring(t - shot.t[0] - 0.3) });
  },
};
