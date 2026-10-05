import { PARAMS, word, focusOf, since, pop, fit, gridlines, ROWS, clamp, shake, stack, lerp, playhead, barPhase } from './K_tipo.mjs';
// K11 · pulsos 24 → 28 (compás 7). Cuenta atrás de filas: 4, 3, 2, 1. En cada pulso se va una (TOC, CLAC, TIC) y las que quedan CRECEN (cartel justificado);
// la última, PUM, queda tumbada ocupando el alto. Lo roto se reduce a su esencia: el bombo.
export default {
  params: PARAMS,
  draw(ctx, t, u, shot, film, api) {
    const S = api.safe, P = api.params, boxes = [], k = Math.floor(since(film, shot, t, 0) >= 0 ? (t - shot.t[0]) / 1e9 : 0), tt = (j) => since(film, shot, t, j);
    const left = tt(3) >= 0 ? 1 : tt(2) >= 0 ? 2 : tt(1) >= 0 ? 3 : 4, age = tt(4 - left === 0 ? 0 : 4 - left);   // filas que quedan; edad desde el último pulso de cambio
    const since0 = left === 4 ? tt(0) : tt(4 - left), p = pop(api, since0, { from: left === 4 ? 1 : 1.35 }), [jx, jy] = shake(P, t, 12 * (1 - 0.5 * P.lock), 29);
    gridlines(ctx, api, { cols: 4, rows: 8, alpha: 0.3 + 0.5 * P.lock, lit: P.kick });
    playhead(ctx, api, barPhase(film, shot, t), { alpha: 0.7 });
    const words = ROWS.slice(0, left);
    if (left === 1) {                                                       // PUM tumbada ocupa el alto del cuadro
      const size = fit('PUM', S.h * 0.8), e = P.kick;
      boxes.push(word(ctx, api, 'PUM', S.cx + jx, S.cy + jy, size * p.s * (1 + 0.05 * e), { rot: -Math.PI / 2, color: e > 0.4 ? 'accent' : 'ink', split: 14 * e + 18 * Math.exp(-since0 * 11) }));
    } else {
      const L = stack(api, words.map(([s]) => s), { width: S.w * 0.78, cy: S.cy, maxH: S.h * 0.8, maxSize: 520 });
      L.forEach((l, i) => { const e = P[words[i][1]]; boxes.push(word(ctx, api, l.str, l.cx + jx, l.cy + jy, l.size * p.s * (1 + 0.07 * e), { color: e > 0.45 ? 'accent' : 'ink', split: 14 * Math.exp(-since0 * 11) + 8 * e, per: undefined })); });
    }
    void age; void k; void lerp; void clamp;
    focusOf(api, boxes, 'secuenciador');
  },
};
