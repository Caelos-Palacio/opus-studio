// Calma: la persona (referencia de escala humana) y un punto diminuto que respira. La pregunta del gancho.
export default {
  draw(ctx, t, u, shot, film, api) {
    const W = film.width, H = film.height, lt = t - shot.t[0], px = W * 0.3, py = H * 0.66, h = H * 0.18;
    ctx.save(); ctx.strokeStyle = api.color('ink'); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath();
    ctx.arc(px, py - h * 0.85, h * 0.12, 0, Math.PI * 2);
    ctx.moveTo(px, py - h * 0.72); ctx.lineTo(px, py - h * 0.3); ctx.lineTo(px - h * 0.15, py); ctx.moveTo(px, py - h * 0.3); ctx.lineTo(px + h * 0.15, py);
    ctx.moveTo(px - h * 0.2, py - h * 0.6); ctx.lineTo(px + h * 0.2, py - h * 0.6); ctx.stroke(); ctx.restore();
    api.focus(px - h * 0.2, py - h, h * 0.4, h, 'persona');
    api.morph('dot', 'dot', 0, { x: W * 0.62, y: py - h * 0.5, size: H * 0.05 * (1 + 0.05 * Math.sin(lt * 2)), label: 'punto' });
    const [x, y] = api.at(0.5, 0.12);
    api.text(shot.text, x, y, { role: 'h2', alpha: api.spring(lt - 0.2) });
  },
};
