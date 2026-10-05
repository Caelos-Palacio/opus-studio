import { PARAMS, word, focusOf, since, shake, glitch, stack, cracks, pop, clamp } from './K_tipo.mjs';
// K06 · pulsos 6 → 8. ROM / PE entra en el pulso 1; en el 2.º se agrieta y la ? lima golpea abajo: la pregunta se cierra… y no tiene respuesta.
export default {
  params: PARAMS,
  draw(ctx, t, u, shot, film, api) {
    const S = api.safe, P = api.params, a0 = since(film, shot, t, 0), a1 = since(film, shot, t, 1), p0 = pop(api, a0, { from: 1.1 }), p1 = pop(api, a1, { from: 1.15 }), [jx, jy] = shake(P, t, 18, 6), j1 = a1 >= 0 ? Math.exp(-a1 * 14) : 0;
    const boxes = [word(ctx, api, '¿', S.x0 + 56, S.y0 + 150, 160, { color: 'accent', align: 'left', alpha: 0.95 })], L = stack(api, ['ROM', 'PE'], { width: api.safe.w * 0.78, cy: S.cy - 120, gap: 0.22 });
    L.forEach((l, i) => boxes.push(word(ctx, api, l.str, l.cx + jx + 22 * j1 * Math.sin(t * 90), l.cy + jy, l.size * p0.s * (1 + 0.03 * P.kick), { label: 'ROMPE', slice: glitch(P, t, l.size, 6 + i), split: 9 * P.chaos + 30 * j1 })));
    const my = (L[0].cy + L[1].cy) / 2; cracks(ctx, api, S.cx, my, L[1].size * 0.9, a1 >= 0 ? clamp(a1 / 0.35) : 0, { seed: 11, n: 6, color: 'paper' });
    if (p1.a > 0) boxes.push(word(ctx, api, '?', S.cx + 40 * Math.sin(a1 * 40) * j1, S.cy + 560, 420 * p1.s, { color: 'accent' }));
    focusOf(api, boxes, 'pregunta');
  },
};
