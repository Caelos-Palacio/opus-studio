import { PARAMS, word, focusOf, since, pop, shake, glitch, stack, bphase, clamp } from './K_tipo.mjs';
// K13 · pulsos 32 → 34. TO / DO a pantalla completa: el crescendo se tensa (señal `tension`): más tiras, más canales, destello lima de 2 fotogramas en cada pulso.
export default {
  params: PARAMS,
  draw(ctx, t, u, shot, film, api) {
    const S = api.safe, P = api.params, a0 = since(film, shot, t, 0), p = pop(api, a0, { from: 1.1 }), [jx, jy] = shake(P, t, 10 + 30 * P.tension, 13), ph = bphase(film, t), flash = ph < 0.07 ? 1 : 0;
    if (flash) { ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = api.color('accent'); ctx.fillRect(0, 0, film.width, film.height); ctx.restore(); }
    const boxes = stack(api, ['TO', 'DO'], { width: api.safe.w * 0.78, cy: S.cy, gap: 0.22 }).map((l, i) => { const g = glitch(P, t, l.size, 13 + i, 0.1); return word(ctx, api, l.str, l.cx + jx * (i ? -1 : 1), l.cy + jy, l.size * p.s * (1 + 0.04 * P.kick + 0.05 * P.tension), { label: 'TODO', slice: { ...g, amp: g.amp + l.size * 0.05 * P.tension }, split: 8 + 26 * P.tension }); });
    focusOf(api, boxes, 'rotura');
  },
};
