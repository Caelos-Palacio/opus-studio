// Construcción: el punto avanza y crece (energía en subida) y ATERRIZA antes del corte (anticipación: calma antes del pico).
import { lerp, smooth, seg } from '../engine/core.mjs';
export default {
  draw(ctx, t, u, shot, film, api) {
    const W = film.width, H = film.height, k = smooth(seg(t - shot.t[0], 0.2, 1.7));
    api.morph('dot', 'dot', 0, { x: lerp(W * 0.25, W * 0.5, k), y: lerp(H * 0.62, H * 0.5, k), size: lerp(H * 0.05, H * 0.12, k), label: 'punto' });
  },
};
