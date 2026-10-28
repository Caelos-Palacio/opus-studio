import { seg } from '../engine/core.mjs';
import { drawWorld, drawTicks, drawEq, zEntity, view, X, T } from './M_mundo.mjs';
// Pasos pequeños de ese giro. Con n pasos de tamaño π/n el punto dibuja un polígono; sus extremos (anillos) para n = 2, 4, 8 se acercan a un mismo sitio.
export default {
  entities: { z: zEntity },
  draw(ctx, t, u, shot, film, api) {
    const V = view(film, t), S = api.k * 1.5;
    drawWorld(ctx, api, film, t);
    drawTicks(api, film, t);
    drawEq(api, film, t);
    const R = T.run, lab = [[48.6, 'n = 2'], [53.9, 'n = 4'], [57.7, 'n = 8']];
    lab.forEach(([a, s], i) => { const b = i < 2 ? R[i + 1][0] - 0.2 : 60; api.text(s, X(V, [1, 0]) + 80 * S, V.oy - 32 * S, { role: 'body', alpha: seg(t, a, a + 0.8) * (1 - seg(t, b - 0.4, b)), color: 'quant' }); });
    api.text(shot.text, film.width / 2, film.height * 0.865, { role: 'h2', alpha: seg(t, 47.8, 49.0) * (1 - seg(t, 52.4, 53.2)) });
    api.text('¿Dónde termina con n pasos?', film.width / 2, film.height * 0.865, { role: 'h2', alpha: seg(t, 53.6, 54.8) * (1 - seg(t, 59.0, 59.9)) });
  },
};
