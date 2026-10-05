import { PARAMS, word, focusOf, since, shake, glitch, stack, clamp } from './K_tipo.mjs';
// K04 · pulso 4 → 5. CUAN / DO: cada línea barre de un lado al otro en una semicorchea (la 1.ª de izquierda a derecha, la 2.ª al revés); el filo es una barra lima.
export default {
  params: PARAMS,
  draw(ctx, t, u, shot, film, api) {
    const S = api.safe, P = api.params, age = since(film, shot, t, 0), [jx, jy] = shake(P, t, 14, 4), boxes = [];
    boxes.push(word(ctx, api, '¿', S.x0 + 56, S.y0 + 135, 220, { color: 'accent', align: 'left', alpha: 0.95 }));
    stack(api, ['CUAN', 'DO'], { width: api.safe.w * 0.78, cy: S.cy + 90 }).forEach((l, i) => {
      const e = api.ease('outExpo', clamp((age - i * 0.05) / 0.16)), dir = i ? -1 : 1, b = word(ctx, api, l.str, l.cx + jx, l.cy + jy, l.size * (1 + 0.03 * P.kick), { label: 'CUANDO', reveal: dir > 0 ? [0, e] : [1 - e, 1], slice: glitch(P, t, l.size, 4 + i, 0.08), split: 6 * P.chaos });
      boxes.push(b); if (e < 0.999 && age >= 0) { ctx.save(); ctx.fillStyle = api.color('accent'); const x = dir > 0 ? b.x + b.w * e : b.x + b.w * (1 - e); ctx.fillRect(x - 8, l.cy - l.cap * 0.62, 16, l.cap * 1.24); ctx.restore(); }
    });
    focusOf(api, boxes, 'pregunta');
  },
};
