import { PARAMS, word, focusOf, finalStack, since, clamp } from './K_tipo.mjs';
// K21 · pulsos 47 → 49. LO / ROTO ya encajados; VUELVE entra barriendo de izquierda a derecha en el pulso (recorte con filo lima; la caja ya está en su sitio).
export default {
  params: PARAMS,
  draw(ctx, t, u, shot, film, api) {
    const P = api.params, a0 = since(film, shot, t, 0), e = api.ease('outExpo', clamp(a0 / 0.16)), L = finalStack(api), boxes = [];
    L.slice(0, 3).forEach((l, i) => { const nw = i === 2, b = word(ctx, api, l.str, l.cx, l.cy, l.size * (1 + 0.035 * P.kick), nw ? { reveal: [0, e], split: 18 * Math.exp(-a0 * 9), color: 'ink' } : { split: 4 + 10 * P.snare }); boxes.push(b);
      if (nw && e < 0.999 && a0 >= 0) { ctx.save(); ctx.fillStyle = api.color('accent'); ctx.fillRect(b.x + b.w * e - 8, l.cy - l.cap * 0.62, 16, l.cap * 1.24); ctx.restore(); } });
    focusOf(api, boxes, 'frase');
  },
};
