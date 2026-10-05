import { PARAMS, word, focusOf, since, pop, fit, rng, clamp, lerp } from './K_tipo.mjs';
// K07 · pulsos 8 → 12 (un compás). RUIDO: cinco golpes sueltos (onomatopeyas) en síncopa 3+3+4+3+3 semicorcheas, en filas desordenadas.
// Cada golpe cae en una semicorchea que NO es un pulso: el ojo y el oído oyen ruido porque la rejilla todavía no se ve.
const HITS = [[0, 'CRAC', 'accent2'], [0.75, 'TAC', 'ink'], [1.5, 'PUM', 'ink'], [2.5, 'CLIC', 'ink'], [3.25, 'BUM', 'accent2']], ROW = [2, 0, 4, 1, 3];
export default {
  params: PARAMS,
  draw(ctx, t, u, shot, film, api) {
    const S = api.safe, P = api.params, boxes = [], R = rng(7), n = 5;
    HITS.forEach(([k, str, color], i) => {
      const age = since(film, shot, t, k); if (age < 0) return;
      const p = pop(api, age, { from: 1.15 }), size = Math.min(340, fit(str, S.w * 0.8)), left = i % 2 === 0, row = ROW[i], cy = S.y0 + ((row + 0.5) * S.h) / n, rot = (R() - 0.5) * 0.07 * Math.exp(-age * 5);
      boxes.push(word(ctx, api, str, left ? S.x0 + 30 : S.x1 - 30, cy, size * p.s, { align: left ? 'left' : 'right', color, rot, split: 26 * Math.exp(-age * 11) }));
    });
    focusOf(api, boxes.length ? boxes : [{ x: S.cx - 10, y: S.cy - 10, w: 20, h: 20 }], 'ruido');
  },
};
