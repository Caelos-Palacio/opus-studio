// Descenso: el anillo vuelve a tinta y se asienta despacio; la respuesta llega tarde (87 %).
import { lerp } from '../engine/core.mjs';
export default {
  draw(ctx, t, u, shot, film, api) {
    const W = film.width, H = film.height, lt = t - shot.t[0], k = 1 - Math.exp(-2.5 * lt);
    api.morph('ring', 'ring', 0, { x: W * 0.5, y: H * 0.55, size: lerp(H * 0.5, H * 0.42, k), label: 'escala' });
    const [x, y] = api.at(0.5, 0.1);
    api.text(shot.text, x, y, { role: 'h2', alpha: api.spring(lt - 0.4, 'soft') });
  },
};
