// Versión "PowerPoint": energía constante, cortes regulares cada 2 s, un título por diapositiva, sin hold ni pico.
export const orbit = (t, film) => ({ x: film.width * 0.5 + film.height * 0.22 * Math.cos(Math.PI * t), y: film.height * 0.55 + film.height * 0.22 * Math.sin(Math.PI * t) });
export const slide = (ctx, t, shot, film, api) => {
  const p = orbit(t, film);
  api.morph('dot', 'dot', 0, { x: p.x, y: p.y, size: film.height * 0.08, label: 'punto' });
  const [x, y] = api.at(0.5, 0.1);
  api.text(shot.text, x, y, { role: 'h2', alpha: api.spring(t - shot.t[0] - 0.1) });
};
export default {
  draw(ctx, t, u, shot, film, api) {
    const W = film.width, H = film.height, px = W * 0.2, py = H * 0.7, h = H * 0.18;
    ctx.save(); ctx.strokeStyle = api.color('ink'); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath();
    ctx.arc(px, py - h * 0.85, h * 0.12, 0, Math.PI * 2);
    ctx.moveTo(px, py - h * 0.72); ctx.lineTo(px, py - h * 0.3); ctx.lineTo(px - h * 0.15, py); ctx.moveTo(px, py - h * 0.3); ctx.lineTo(px + h * 0.15, py);
    ctx.moveTo(px - h * 0.2, py - h * 0.6); ctx.lineTo(px + h * 0.2, py - h * 0.6); ctx.stroke(); ctx.restore();
    api.focus(px - h * 0.2, py - h, h * 0.4, h, 'persona');
    slide(ctx, t, shot, film, api);
  },
};
