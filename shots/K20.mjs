import { PARAMS, word, focusOf, shatter, finalStack, ring, atBeat, since, clamp, lerp, jolt } from './K_tipo.mjs';
// K20 · pulsos 45 → 47. El groove vuelve EN rejilla (el respiro dura 5 pulsos exactos). Esquirlas de LO / ROTO vuelan de vuelta y ENCAJAN en el pulso 1,6
// (la misma geometría del golpe, recorrida al revés: u 1→0); al encajar: destello lima, sacudida y anillo.
export default {
  params: PARAMS,
  draw(ctx, t, u, shot, film, api) {
    const S = api.safe, P = api.params, tl = since(film, shot, t, 1.6), T = atBeat(film, shot, 1.6) - shot.t[0], x = clamp((t - shot.t[0]) / T), uu = 1 - api.ease('inOut', x), L = finalStack(api).slice(0, 2), boxes = [];
    const [jx, jy] = tl >= 0 ? jolt(tl, 30, 10, 7) : [0, 0];
    ctx.save(); ctx.translate(jx, jy);
    L.forEach((l, i) => {
      if (uu > 0.02) { boxes.push(word(ctx, api, l.str, l.cx, l.cy, l.size, { reg: 'only', alpha: 0 })); shatter(ctx, api, l.str, l.cx, l.cy, l.size, { u: uu, seed: 41 + i, cols: 12, rows: i ? 6 : 8, power: 1.1, curve: 1.6, color: 'ink', split: 10 * uu }); }
      else boxes.push(word(ctx, api, l.str, l.cx, l.cy, l.size * (1 + 0.04 * P.kick), { color: tl >= 0 && tl < 0.25 ? 'accent' : 'ink', split: 6 + 24 * P.shock }));
    });
    ctx.restore();
    if (tl >= 0) { const e = clamp(tl / 0.5); ring(ctx, api, S.cx, L[0].cy, 80 + 900 * api.ease('outExpo', e), 20 * (1 - e) + 1, 'accent', 1 - e); }
    focusOf(api, boxes.length ? boxes : [{ x: S.cx - 60, y: S.cy - 60, w: 120, h: 120 }], 'frase');
  },
};
