import { seg } from '../engine/core.mjs';
import { drawWorld, drawTicks, drawEq, zEntity } from './M_mundo.mjs';
// La pregunta. Una recta azul, el número 1 (el punto ámbar) y e^{iπ}, que se escribe despacio. Nada más hasta que aparece la pregunta.
export default {
  entities: { z: zEntity },
  draw(ctx, t, u, shot, film, api) {
    drawWorld(ctx, api, film, t);
    drawTicks(api, film, t);
    drawEq(api, film, t);
    api.text(shot.text, film.width / 2, film.height * 0.4, { role: 'h2', alpha: seg(t, 3.0, 4.4) });   // la pregunta del gancho (3 s: dentro del primer 10 %)
  },
};
