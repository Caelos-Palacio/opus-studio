// Defecto inyectado: el texto del shot en color sombra (sin contraste con el papel), pequeño y en la esquina.
import A2 from '../../shots/A2.mjs';
export default { ...A2, draw(ctx, t, u, shot, film, api) {
  A2.draw(ctx, t, u, { ...shot, text: '' }, film, api);
  api.text(shot.text, film.width * 0.9, film.height * 0.9, { role: 'label', color: 'shade' });
} };
