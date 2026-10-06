import { PARAMS, word, shatter, ring, dot, stack, clamp, lerp, beatX } from './K_tipo.mjs';
// K19 · respiro (hold, a treses). Las esquirlas flotan casi quietas y apagadas; el compás SIGUE en silencio: un anillo lima late en cada pulso virtual de la rejilla.
export default {
  params: PARAMS,
  draw(ctx, t, u, shot, film, api) {
    const S = api.safe, P = api.params, age = t - shot.t[0], a = clamp(age / 0.5) * 0.3;
    stack(api, ['ROM', 'PE'], { cy: S.cy, gap: 0.22 }).forEach((l, i) => shatter(ctx, api, l.str, l.cx + 24 * P.drift, l.cy - 18 * P.drift * (i ? -1 : 1), l.size, { u: 1, seed: 31 + i, power: 0.55, cols: 10, rows: 5, alpha: a, color: 'shade' }));
    const bx = beatX(film, t), f = bx - Math.floor(bx), e = api.ease('outExpo', f);
    ring(ctx, api, S.cx, S.cy, 30 + 420 * e, 6, 'accent', (1 - f) * 0.55);
    dot(ctx, api, S.cx, S.cy, 14 * (1 + 0.35 * P.drift), 'accent', 1);
    api.focus(S.cx - 60, S.cy - 60, 120, 120, 'punto', { weight: 1, bleed: true, hollow: 0.9 });
    void word; void lerp;
  },
};
