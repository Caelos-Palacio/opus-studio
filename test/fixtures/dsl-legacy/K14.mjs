import { PARAMS, word, focusOf, since, pop, shake, glitch, fit, bphase } from './K_tipo.mjs';
// K14 · pulsos 34 → 36. SE, enorme, vibra sin parar; destello lima en cada pulso. La palabra más pequeña de la frase es la más grande de la pantalla.
export default {
  params: PARAMS,
  draw(ctx, t, u, shot, film, api) {
    const S = api.safe, P = api.params, a0 = since(film, shot, t, 0), p = pop(api, a0, { from: 1.1 }), size = fit('SE', S.w * 0.68), [jx, jy] = shake(P, t, 14 + 36 * P.tension, 14);
    if (bphase(film, t) < 0.07) { ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = api.color('accent'); ctx.fillRect(0, 0, film.width, film.height); ctx.restore(); }
    const g = glitch(P, t, size, 14, 0.1), b = word(ctx, api, 'SE', S.cx + jx, S.cy + jy, size * p.s * (1 + 0.04 * P.kick + 0.06 * P.tension), { slice: { ...g, amp: g.amp + size * 0.06 * P.tension }, split: 10 + 30 * P.tension });
    focusOf(api, [b], 'rotura');
  },
};
