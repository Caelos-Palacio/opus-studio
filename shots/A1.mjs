import { springS } from '../engine/core.mjs';
// Motivo "seed": dot → ring → frame. La cámara la aplica el motor; el layout sale de api.safe / entidades.
const vis = (film) => { const g = film.S.grade.letterbox, bar = g ? Math.max(0, (film.height - film.width / g) / 2) : 0; return { bar, h: film.height - 2 * bar }; };
const pulse = (t, shot, film) => (shot.on_beat_at ?? []).reduce((a, b) => a + 0.3 * springS(t - shot.t[0] - b, film) * Math.exp(-3 * Math.max(0, t - shot.t[0] - b)), 0);
const dot = (t, film) => {
  const shot = film.shots.find((s) => s.id === 'A1'), v = vis(film);
  return { x: film.width / 2, y: v.bar + v.h * 0.55, s: 0.17 * v.h * springS(t - shot.t[0], film) * (1 + pulse(t, shot, film)) };
};
export default {
  entities: { dot },
  draw(ctx, t, u, shot, film, api) {
    api.depth(0.25, () => {
      ctx.strokeStyle = api.color('shade'); ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) { const x = film.width * (0.1 + i * 0.1), y = api.safe.y0 + api.safe.h * (0.15 + j * 0.25); ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 7); ctx.stroke(); }
    });
    const d = dot(t, film);
    api.glow(d.x, d.y, d.s * 2, 'accent', 0.35);
    api.morph('dot', 'dot', 0, { x: d.x, y: d.y, size: d.s, label: 'punto' });
    const [x, y] = api.at(0.5, 0.22);
    api.text(shot.text, x, y, { role: 'h1', alpha: api.spring(t - shot.t[0] - 0.2) });
  },
};
