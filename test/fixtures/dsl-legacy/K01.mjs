import { PARAMS, word, focusOf, since, pop, shake } from './K_tipo.mjs';
// K01 · pulso 0 → 1. La ¿ lima golpea el primer pulso del film. El fotograma 0 YA tiene la ¿ a escala 1,25: el reel no empieza en negro.
export default {
  params: PARAMS,
  draw(ctx, t, u, shot, film, api) {
    const S = api.safe, P = api.params, age = since(film, shot, t, 0), p = pop(api, age, { from: 1.1 }), size = 1200 * p.s * (1 + 0.05 * P.kick), [jx, jy] = shake(P, t, 10, 1);
    const b = word(ctx, api, '¿', S.cx + jx, S.cy - 0.1 * size + jy, size, { color: 'accent', split: 7 * P.chaos * (0.3 + P.kick) });
    focusOf(api, [b], 'pregunta');
  },
};
