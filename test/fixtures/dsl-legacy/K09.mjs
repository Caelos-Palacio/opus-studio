import { PARAMS, word, focusOf, since, pop, fit, gridlines, ROWS, lerp, clamp, shake, snapTo } from './K_tipo.mjs';
// K09 · pulsos 16 → 20 (compás 5). Cuatro filas de SECUENCIADOR entran una por pulso (PUM, TIC, CLAC, TOC). Cada fila se enciende con SU pista de audio:
// bombo → PUM, hats → TIC, caja/palmas → CLAC, toms → TOC (parámetros kick/hat/snare/tom enlazados a audio.json.tracks). La música dibuja la imagen.
export default {
  params: PARAMS,
  draw(ctx, t, u, shot, film, api) {
    const S = api.safe, P = api.params, boxes = [], size = Math.min(330, fit('CLAC', S.w * 0.7)), lamp = 70;
    gridlines(ctx, api, { cols: 4, rows: 8, alpha: 0.28 + 0.7 * P.lock, lit: P.kick * 0.8 });
    ROWS.forEach(([str, track], i) => {
      const age = since(film, shot, t, i); if (age < 0) return;
      const e = P[track], p = pop(api, age, { from: 1.15 }), cy = S.cy + ((i - 1.5) * S.h * 0.88) / 4, [jx, jy] = shake(P, t, 16, 9 + i), [sx, sy] = snapTo(api, S.x0, cy, P.lock * 0.5);
      boxes.push(word(ctx, api, str, sx + jx + 50, sy + jy, size * p.s * (1 + 0.1 * e), { align: 'left', color: e > 0.45 ? 'accent' : 'ink', split: 16 * Math.exp(-age * 11) + 10 * e }));
      ctx.save(); ctx.fillStyle = api.color(e > 0.1 ? 'accent' : 'shade'); ctx.globalAlpha = 0.35 + 0.65 * clamp(e); ctx.fillRect(S.x1 - 50 - lamp * (1 + 0.5 * e), cy - lamp * (1 + 0.5 * e) / 2, lamp * (1 + 0.5 * e), lamp * (1 + 0.5 * e)); ctx.restore();
    });
    focusOf(api, boxes.length ? boxes : [{ x: S.cx - 10, y: S.cy - 10, w: 20, h: 20 }], 'secuenciador');
  },
};
