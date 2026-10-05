import { PARAMS, dot } from './K_tipo.mjs';
// K17 · pulso 39 → golpe. El vacío: negro y un punto lima casi quieto. El audio también está en silencio digital (vacío del impacto = un pulso).
export default {
  params: PARAMS,
  draw(ctx, t, u, shot, film, api) {
    const S = api.safe; dot(ctx, api, S.cx, S.cy, 18, 'accent', 1);
    api.focus(S.cx - 60, S.cy - 60, 120, 120, 'punto', { weight: 1, bleed: true, hollow: 0.9 });
  },
};
