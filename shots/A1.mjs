import { springS } from '../engine/core.mjs';
// Motivo "seed": dot → ring → frame. La cámara la aplica el motor; el layout sale de api.safe / entidades.
// Parámetros promovidos (F4): editables por metadatos en timeline shots[i].params o por capa /shots/A1/params/<nombre>.
const params = {
  text: { type: 'string', semantic: 'título del plan (default: shot.text del timeline)' },
  size: { type: 'number', range: [0.05, 0.4], unit: 'vh', default: 0.17, semantic: 'tamaño del punto (fracción del alto visible)' },
  y: { type: 'number', range: [0.3, 0.8], unit: 'vh', default: 0.55, semantic: 'altura del punto' },
  pulse: { type: 'number', range: [0, 1], unit: '×', default: 0.3, semantic: 'amplitud del latido en cada on_beat_at' },
  glow: { type: 'color', default: 'accent', semantic: 'color del halo (rol de paleta o #hex)' },
  glowAlpha: { type: 'number', range: [0, 1], default: 0.35, semantic: 'intensidad del halo' },
  textY: { type: 'number', range: [0, 1], unit: 'safe', default: 0.22, semantic: 'altura del título en el área segura' },
  textIn: { type: 'number', range: [0, 2], unit: 's', default: 0.2, semantic: 'entrada del título (desde el inicio del plan)' },
};
const vis = (film) => { const g = film.S.grade.letterbox, bar = g ? Math.max(0, (film.height - film.width / g) / 2) : 0; return { bar, h: film.height - 2 * bar }; };
const pulse = (t, shot, film, P) => (shot.on_beat_at ?? []).reduce((a, b) => a + P.pulse * springS(t - shot.t[0] - b, film) * Math.exp(-3 * Math.max(0, t - shot.t[0] - b)), 0);
const dot = (t, film) => {
  const shot = film.shots.find((s) => s.id === 'A1'), v = vis(film), P = film.params('A1', t);
  return { x: film.width / 2, y: v.bar + v.h * P.y, s: P.size * v.h * springS(t - shot.t[0], film) * (1 + pulse(t, shot, film, P)) };
};
export default {
  params,
  entities: { dot },
  draw(ctx, t, u, shot, film, api) {
    const P = api.params;
    api.depth(0.25, () => {
      ctx.strokeStyle = api.color('shade'); ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) { const x = film.width * (0.1 + i * 0.1), y = api.safe.y0 + api.safe.h * (0.15 + j * 0.25); ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 7); ctx.stroke(); }
    });
    const d = dot(t, film);
    api.glow(d.x, d.y, d.s * 2, P.glow, P.glowAlpha);
    api.morph('dot', 'dot', 0, { x: d.x, y: d.y, size: d.s, label: 'punto' });
    const [x, y] = api.at(0.5, P.textY);
    api.text(shot.text, x, y, { role: 'h1', alpha: api.spring(t - shot.t[0] - P.textIn) });
  },
};
