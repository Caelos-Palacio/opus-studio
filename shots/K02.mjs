import { PARAMS, word, focusOf, since, pop, shake, glitch, fit } from './K_tipo.mjs';
// K02 · pulso 1 → 2. QUÉ cae en el pulso, tumbada (lee de abajo arriba: ocupa el alto del cuadro vertical), tembloroso (ruido); la ¿ queda de viñeta arriba.
export default {
  params: PARAMS,
  draw(ctx, t, u, shot, film, api) {
    const S = api.safe, P = api.params, age = since(film, shot, t, 0), p = pop(api, age, { from: 1.1 }), size = fit('QUÉ', S.h * 0.84), [jx, jy] = shake(P, t, 18, 2);
    const q = word(ctx, api, '¿', S.x0 + 56, S.y0 + 135, 220, { color: 'accent', align: 'left', alpha: 0.95 });
    const b = word(ctx, api, 'QUÉ', S.cx + 60 + jx, S.cy + jy, size * p.s * (1 + 0.035 * P.kick), { rot: -Math.PI / 2, slice: glitch(P, t, size, 2), split: 12 * P.chaos * (0.4 + P.snare) });
    focusOf(api, [b, q], 'pregunta');
  },
};
