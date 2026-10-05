import { seg } from '../engine/core.mjs';
import { drawWorld, drawTicks, drawEq, zEntity, view, velocity } from './M_mundo.mjs';
// Otra idea: crecer. La flecha de velocidad tiene siempre el largo de la posición (dz/dt = z) y el punto avanza por la recta.
// Concepto nuevo: «velocidad». La etiqueta nace pegada a la flecha y la sigue.
export default {
  entities: { z: zEntity },
  draw(ctx, t, u, shot, film, api) {
    const S = api.k * 1.5;
    drawWorld(ctx, api, film, t);
    drawTicks(api, film, t);
    drawEq(api, film, t);
    const v = velocity(film, t);
    if (v && v.alpha > 0.2) {
      api.focus(Math.min(v.x0, v.x1), v.y0 - 10 * S, Math.abs(v.x1 - v.x0), 20 * S, 'velocidad', { weight: 0.6, hollow: 0.5 });
      api.text('velocidad', (v.x0 + v.x1) / 2, v.y0 - 40 * S, { role: 'body', alpha: seg(t, 23.0, 23.8) * (1 - seg(t, 32.6, 33.6)), color: 'accent2' });
    }
    api.text(shot.text, film.width / 2, film.height * 0.865, { role: 'h2', alpha: seg(t, 22.0, 23.2) * (1 - seg(t, 31.6, 32.6)) });
    void view;
  },
};
