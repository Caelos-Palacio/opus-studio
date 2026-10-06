import { seg } from '../engine/core.mjs';
import { drawWorld, drawTicks, drawEq, zEntity } from './M_mundo.mjs';
// El límite (pico). Calma; luego n pasa de 8 a 2500 y el polígono se redondea hasta ser una semicircunferencia; su extremo aterriza en −1.
// Tras el aterrizaje, silencio visual y sonoro (hold).
export default {
  entities: { z: zEntity },
  draw(ctx, t, u, shot, film, api) {
    drawWorld(ctx, api, film, t);
    drawTicks(api, film, t);
    drawEq(api, film, t);
    api.text(shot.text, film.width / 2, film.height * 0.865, { role: 'h2', alpha: seg(t, 59.9, 60.9) * (1 - seg(t, 62.4, 63.2)) });
    api.text('el polígono se vuelve arco', film.width / 2, film.height * 0.865, { role: 'h2', alpha: seg(t, 69.2, 70.4) });
  },
};
