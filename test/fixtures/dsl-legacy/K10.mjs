import { PARAMS, word, focusOf, since, pop, fit, gridlines, ROWS, clamp, shake, snapTo, playhead, barPhase } from './K_tipo.mjs';
// K10 · pulsos 20 → 24 (compás 6). Las cuatro filas, ya clavadas a la rejilla, laten con su pista: la letra salta cuando suena su instrumento
// (hop escalonado por letra) y un cursor lima recorre el compás. Aquí `lock` ≈ 0,8–1 y `chaos` cae con cada bombo (expresión sobre dos señales).
export default {
  params: PARAMS,
  draw(ctx, t, u, shot, film, api) {
    const S = api.safe, P = api.params, boxes = [], size = Math.min(330, fit('CLAC', S.w * 0.7)), lamp = 70;
    gridlines(ctx, api, { cols: 4, rows: 8, alpha: 0.35 + 0.6 * P.lock, lit: P.kick });
    playhead(ctx, api, barPhase(film, shot, t), { alpha: 0.9 });
    ROWS.forEach(([str, track], i) => {
      const e = P[track], cy = S.cy + ((i - 1.5) * S.h * 0.88) / 4, [jx, jy] = shake(P, t, 10, 19 + i), [sx, sy] = snapTo(api, S.x0, cy, P.lock * 0.9), n = str.length;
      const per = (k) => { const w = clamp(e - k * 0.12); return { dy: -w * 0.16 * size * Math.sin((k + 1) * 1.1), s: 1 + 0.08 * w, color: w > 0.35 ? 'accent' : null }; };
      boxes.push(word(ctx, api, str, sx + jx + 50, sy + jy, size * (1 + 0.05 * e), { align: 'left', per }));
      const L = lamp * (1 + 0.5 * e); ctx.save(); ctx.fillStyle = api.color(e > 0.1 ? 'accent' : 'shade'); ctx.globalAlpha = 0.35 + 0.65 * clamp(e); ctx.fillRect(S.x1 - 50 - L, cy - L / 2, L, L); ctx.restore(); void n;
    });
    focusOf(api, boxes, 'secuenciador');
  },
};
