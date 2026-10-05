import { seg } from '../engine/core.mjs';
import { drawWorld, drawTicks, drawEq, zEntity } from './M_mundo.mjs';
// Regreso a casa. El punto vuelve a 1 por el arco, que se deshace al pasarlo; la vista regresa a la recta del principio.
export default {
  entities: { z: zEntity },
  draw(ctx, t, u, shot, film, api) {
    drawWorld(ctx, api, film, t);
    drawTicks(api, film, t);
    drawEq(api, film, t);
    api.text(shot.text, film.width / 2, film.height * 0.865, { role: 'h2', alpha: seg(t, 83.0, 84.6) });
  },
};
