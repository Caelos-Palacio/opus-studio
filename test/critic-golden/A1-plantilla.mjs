// Defecto inyectado: look de plantilla (degradado a pantalla completa + glow gratuito + partículas decorativas deterministas).
import A1 from '../../shots/A1.mjs';
export default { ...A1, draw(ctx, t, u, shot, film, api) {
  const g = ctx.createLinearGradient(0, 0, film.width, film.height);
  g.addColorStop(0, api.color('accent2')); g.addColorStop(1, api.color('accent'));
  ctx.fillStyle = g; ctx.fillRect(0, 0, film.width, film.height);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 80; i++) { ctx.beginPath(); ctx.arc((i * 131) % film.width, (i * 71 + t * 40) % film.height, 2 + (i % 3), 0, Math.PI * 2); ctx.fill(); }
  api.glow(film.width / 2, film.height / 2, film.height * 0.6, 'accent', 0.8);
  A1.draw(ctx, t, u, shot, film, api);
} };
