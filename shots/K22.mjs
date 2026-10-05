import { PARAMS, word, focusOf, finalStack, since, clamp } from './K_tipo.mjs';
// K22 · pulsos 49 → 51. A SONAR entra de derecha a izquierda y cierra el bloque justificado: la frase está completa.
export default {
  params: PARAMS,
  draw(ctx, t, u, shot, film, api) {
    const P = api.params, a0 = since(film, shot, t, 0), e = api.ease('outExpo', clamp(a0 / 0.16)), L = finalStack(api), boxes = [];
    L.forEach((l, i) => { const nw = i === 3, b = word(ctx, api, l.str, l.cx, l.cy, l.size * (1 + 0.035 * P.kick), nw ? { reveal: [1 - e, 1], split: 18 * Math.exp(-a0 * 9) } : { split: 4 + 10 * P.snare }); boxes.push(b);
      if (nw && e < 0.999 && a0 >= 0) { ctx.save(); ctx.fillStyle = api.color('accent'); ctx.fillRect(b.x + b.w * (1 - e) - 8, l.cy - l.cap * 0.62, 16, l.cap * 1.24); ctx.restore(); } });
    focusOf(api, boxes, 'frase');
  },
};
