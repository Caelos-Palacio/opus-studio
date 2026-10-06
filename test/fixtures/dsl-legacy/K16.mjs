import { PARAMS, word, focusOf, since, stack, clamp, lerp, dot } from './K_tipo.mjs';
// K16 · pulso 38 → 39. Inspiración: ROM / PE se contrae hasta un punto lima y el color se va (poca energía: es la calma que precede al golpe).
export default {
  params: PARAMS,
  draw(ctx, t, u, shot, film, api) {
    const S = api.safe, e = api.ease('inOut', clamp(u)), boxes = [], k = 1 - e, lbl = 'ROMPE';
    stack(api, ['ROM', 'PE'], { width: S.w * 0.78, cy: S.cy }).forEach((l) => boxes.push(word(ctx, api, l.str, l.cx, l.cy, l.size, { alpha: clamp(1 - e * e * e * 1.05), label: lbl, split: 6 })));   // solo se apaga (quieta): la contracción visible sería movimiento, y esto es la calma antes del golpe
    dot(ctx, api, S.cx, S.cy, 14 + 4 * e, 'accent', 1);
    if (boxes.length) focusOf(api, boxes, 'rotura'); else api.focus(S.cx - 60, S.cy - 60, 120, 120, 'punto', { weight: 1, bleed: true, hollow: 0.9 });
    void since;
  },
};
