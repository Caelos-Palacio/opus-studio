import { springS, lerp, clamp } from '../engine/core.mjs';
import A2 from './A2.mjs';
// ring → frame: el anillo endereza su radio hasta ser marco; el texto vive en el vacío.
const pulse = (t, shot, film) => (shot.on_beat_at ?? []).reduce((a, b) => a + 0.2 * springS(t - shot.t[0] - b, film) * Math.exp(-3 * Math.max(0, t - shot.t[0] - b)), 0);
const dot = (t, film) => {
  const s = film.shots.find((x) => x.id === 'A3'), st = A2.entities.dot(s.t[0], film), k = springS(t - s.t[0], film, 'soft');
  const g = film.S.grade.letterbox, bar = g ? Math.max(0, (film.height - film.width / g) / 2) : 0, vh = film.height - 2 * bar;
  return { x: lerp(st.x, film.width / 2, k), y: lerp(st.y, bar + vh / 2, k), s: st.s * (1 + pulse(t, s, film)), u: clamp(k) };
};
export default {
  entities: { dot },
  draw(ctx, t, u, shot, film, api) {
    const d = dot(t, film);
    api.ground(0.86, 0.22);
    api.depth(0.25, () => { ctx.strokeStyle = api.color('shade'); ctx.lineWidth = 2; for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) { const x = film.width * (0.1 + i * 0.1), y = api.safe.y0 + api.safe.h * (0.15 + j * 0.25); ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 7); ctx.stroke(); } });
    const fill = api.gradient(d.x - d.s, d.y - d.s, d.x + d.s * 2, d.y + d.s, ['accent', 'accent2'], 'ink');
    const m = api.morph('ring', 'frame', d.u, { x: d.x, y: d.y, size: d.s, fill, label: 'marco', lit: false });
    const hit = t - shot.t[0] >= 1.0 && t - shot.t[0] < 1.1, hy = d.y - m.h / 2;
    api.focus(d.x - 16, hy - 16, 32, 32, 'acento', { weight: 0.3 });
    if (hit) { ctx.fillStyle = api.color('accent'); ctx.beginPath(); ctx.arc(d.x, hy, 14, 0, Math.PI * 2); ctx.fill(); }
    api.text(shot.text, d.x, d.y, { role: 'body', alpha: api.spring(t - shot.t[0] - 0.7) });
  },
};
