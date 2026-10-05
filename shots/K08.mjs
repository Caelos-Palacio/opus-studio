import { PARAMS, word, focusOf, since, pop, fit, clamp, gridlines, lerp, snapTo } from './K_tipo.mjs';
// K08 · pulsos 12 → 16 (un compás). Ocho golpes en corcheas con síncopa; el vocabulario se REPITE (TIC TAC TIC…) y la rejilla visible empieza a asomar
// (señal `lock` → opacidad de las líneas y fuerza con que cada palabra se pega a su casilla).
const HITS = [[0, 'TIC'], [0.5, 'TAC'], [1, 'TIC'], [1.75, 'CLAC'], [2, 'TIC'], [2.5, 'TAC'], [3.25, 'PUM'], [3.5, 'CRAC']], ROW = [3, 6, 0, 5, 2, 7, 1, 4];
export default {
  params: PARAMS,
  draw(ctx, t, u, shot, film, api) {
    const S = api.safe, P = api.params, boxes = [], n = 8, size = Math.min(185, fit('CLAC', S.w * 0.55));
    gridlines(ctx, api, { cols: 4, rows: 8, alpha: 0.12 + 0.9 * P.lock, lit: P.kick * P.lock });
    HITS.forEach(([k, str], i) => {
      const age = since(film, shot, t, k); if (age < 0) return;
      const p = pop(api, age, { from: 1.15 }), left = i % 2 === 0, cy = S.y0 + ((ROW[i] + 0.5) * S.h) / n, x0 = left ? S.x0 + 40 : S.x1 - 40, col = str === 'CRAC' || str === 'PUM' ? 'accent2' : 'ink';
      const [sx, sy] = snapTo(api, x0, cy, P.lock * 0.6), jit = (1 - P.lock) * 26 * Math.sin(i * 7.3 + 1);
      boxes.push(word(ctx, api, str, sx + (left ? jit : -jit), sy, size * p.s, { align: left ? 'left' : 'right', color: col, split: 18 * Math.exp(-age * 12) }));
    });
    focusOf(api, boxes.length ? boxes : [{ x: S.cx - 10, y: S.cy - 10, w: 20, h: 20 }], 'ruido');
  },
};
