import { seg, clamp } from '../engine/core.mjs';
import { drawWorld, drawTicks, drawEq, zEntity, velocity, T } from './M_mundo.mjs';
// Si la velocidad apunta de lado. La flecha gira 90° (×i) y el punto deja de crecer: gira, dibujando un arco ámbar.
// Concepto nuevo: «girar». La etiqueta nace pegada al ángulo de 90°.
export default {
  entities: { z: zEntity },
  draw(ctx, t, u, shot, film, api) {
    const S = api.k * 1.5;
    const W = drawWorld(ctx, api, film, t);
    drawTicks(api, film, t);
    drawEq(api, film, t);
    const v = velocity(film, t);
    const al = seg(t, 36.4, 37.0) * (1 - seg(t, 39.6, 40.6));
    if (v && al > 0.05) {
      const r0 = 0.3 * W.V.u;
      api.focus(v.x0, v.y0 - r0, r0, r0, 'giro', { weight: 0.6, hollow: 0.6 });
      api.text('girar 90°', v.x0 + r0 + 12 * S, v.y0 - r0 * 0.9 - 8 * S, { role: 'body', align: 'left', alpha: al, color: 'quant' });
    }
    api.text(shot.text, film.width / 2, film.height * 0.865, { role: 'h2', alpha: seg(t, 35.2, 36.4) * (1 - seg(t, 41.0, 41.8)) });
    api.text('no crece: gira', film.width / 2, film.height * 0.865, { role: 'h2', alpha: seg(t, 42.0, 43.2) * (1 - seg(t, 46.0, 46.8)) });
    void clamp; void T;
  },
};
