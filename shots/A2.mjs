import { springS, lerp, smooth, seg } from '../engine/core.mjs';
import A1 from './A1.mjs';
// Hereda el estado exacto del punto en t=2.0 (handoff) y lo transforma: dot → ring (el hueco se abre).
const params = {
  text: { type: 'string', semantic: 'rótulo del plan (default: shot.text del timeline)' },
  size: { type: 'number', range: [0.05, 0.5], unit: 'vh', default: 0.3, semantic: 'tamaño final del anillo' },
  x: { type: 'number', range: [0.1, 0.9], unit: 'w', default: 0.35, semantic: 'destino horizontal del anillo' },
  openIn: { type: 'number', range: [0, 2], unit: 's', default: 0.3, semantic: 'cuándo empieza a abrirse el hueco' },
  glow: { type: 'color', default: 'accent', semantic: 'color del halo' },
  glowAlpha: { type: 'number', range: [0, 1], default: 0.25, semantic: 'intensidad del halo' },
  textX: { type: 'number', range: [0.5, 0.9], unit: 'w', default: 0.68, semantic: 'posición horizontal del rótulo' },
  textIn: { type: 'number', range: [0, 2], unit: 's', default: 0.3, semantic: 'entrada del rótulo' },
};
const dot = (t, film) => {
  const s = film.shots.find((x) => x.id === 'A2'), st = A1.entities.dot(s.t[0], film), k = springS(t - s.t[0], film, 'soft'), P = film.params('A2', t);
  const g = film.S.grade.letterbox, bar = g ? Math.max(0, (film.height - film.width / g) / 2) : 0, vh = film.height - 2 * bar;
  return { x: lerp(st.x, film.width * P.x, k), y: st.y, s: lerp(st.s, P.size * vh, k), u: smooth(seg(t, s.t[0] + P.openIn, s.t[1])) };
};
export default {
  params,
  entities: { dot },
  draw(ctx, t, u, shot, film, api) {
    const P = api.params, d = dot(t, film), p = dot(t - api.dt, film), vx = (d.x - p.x) / api.dt, vy = (d.y - p.y) / api.dt;
    api.depth(0.25, () => { ctx.strokeStyle = api.color('shade'); ctx.lineWidth = 2; for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) { const x = film.width * (0.1 + i * 0.1), y = api.safe.y0 + api.safe.h * (0.15 + j * 0.25); ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 7); ctx.stroke(); } });
    api.glow(d.x, d.y, d.s * 1.6, P.glow, P.glowAlpha);
    api.smear(d.x, d.y, vx, vy, () => api.morph('dot', 'ring', d.u, { x: d.x, y: d.y, size: d.s, label: 'anillo' }));
    api.text(shot.text, film.width * P.textX, d.y, { role: 'h2', alpha: api.spring(t - shot.t[0] - P.textIn) });
  },
};
