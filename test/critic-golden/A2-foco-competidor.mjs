// Defecto inyectado: segundo foco del mismo peso que el sujeto, con más contraste.
import A2 from '../../shots/A2.mjs';
export default { ...A2, draw(ctx, t, u, shot, film, api) {
  A2.draw(ctx, t, u, shot, film, api);
  const r = film.height * 0.16, x = film.width * 0.8, y = film.height * 0.45;
  ctx.fillStyle = api.color('ink'); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  api.focus(x - r, y - r, 2 * r, 2 * r, 'rival');
} };
