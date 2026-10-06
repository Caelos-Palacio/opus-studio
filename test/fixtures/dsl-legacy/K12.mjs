import { PARAMS, word, focusOf, since, pop, shake, stack, playhead, barPhase, beatX, shotBeat0, clamp, lerp } from './K_tipo.mjs';
// K12 · pulsos 28 → 32 (compás 8). A / COMPÁS: la A gigante (cartel justificado) y un cursor lima que barre el compás; abajo los cuatro pulsos numerados
// (1 2 3 4), cada uno se enciende en el suyo. «A COMPÁS» es el primer enunciado: lo roto cae al pulso.
export default {
  params: PARAMS,
  draw(ctx, t, u, shot, film, api) {
    const S = api.safe, P = api.params, boxes = [], a0 = since(film, shot, t, 0), p = pop(api, a0, { from: 1.1 }), [jx, jy] = shake(P, t, 10, 31);
    const bx = beatX(film, t) - shotBeat0(film, shot), cur = clamp(Math.floor(bx), 0, 3), within = bx - Math.floor(bx);
    playhead(ctx, api, barPhase(film, shot, t), { alpha: 1 });
    stack(api, ['A', 'COMPÁS'], { width: S.w * 0.8, cy: S.cy - 90, gap: 0.22 }).forEach((l, i) => boxes.push(word(ctx, api, l.str, l.cx + jx, l.cy + jy, l.size * p.s * (1 + 0.04 * P.kick), { label: 'A COMPÁS', split: 10 * Math.exp(-a0 * 11) + 8 * P.snare })));
    for (let i = 0; i < 4; i++) {                                           // los cuatro pulsos del compás
      const x = S.x0 + (S.w * (i + 0.5)) / 4, on = i === cur, e = on ? Math.exp(-within * 5) : 0;
      boxes.push(word(ctx, api, String(i + 1), x, S.y1 - 150, 100 * (1 + 0.5 * e), { color: on ? 'accent' : 'shade', alpha: on ? 1 : 0.7, label: 'pulso ' + (i + 1) }));
    }
    focusOf(api, boxes, 'compás');
  },
};
