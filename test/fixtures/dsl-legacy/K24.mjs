import { PARAMS, word, dot, focusOf, finalStack, atBeat, since, clamp, lerp, pop } from './K_tipo.mjs';
// K24 · pulso 55 → fin. La frase se contrae hacia el centro y en su lugar queda UN punto lima del tamaño de la ¿ del principio: respuesta y rima (primer y último fotograma dialogan).
export default {
  params: PARAMS,
  draw(ctx, t, u, shot, film, api) {
    const S = api.safe, P = api.params, a0 = since(film, shot, t, 0), c = api.ease('inOut', clamp((since(film, shot, t, 0.6)) / (atBeat(film, shot, 1.6) - atBeat(film, shot, 0.6)))), boxes = [], p = pop(api, since(film, shot, t, 1.6), { from: 0.4, kind: 'main' });
    const fl = Math.exp(-Math.max(0, a0) * 8);
    if (c < 0.97) finalStack(api).forEach((l) => { const k = 1 - c, sc = lerp(1, 0.05, c); boxes.push(word(ctx, api, l.str, S.cx + (l.cx - S.cx) * k, S.cy + (l.cy - S.cy) * k, l.size * sc * (1 + 0.04 * fl), { alpha: clamp(1 - c * 1.2), color: fl > 0.3 ? 'accent' : 'ink', reg: false })); });
    if (p.a > 0 && since(film, shot, t, 1.6) >= 0) { const r = 200 * p.s * (1 + 0.04 * P.kick); dot(ctx, api, S.cx, S.cy, r, 'accent', 1); boxes.push({ x: S.cx - r, y: S.cy - r, w: 2 * r, h: 2 * r }); }
    focusOf(api, boxes.length ? boxes : [{ x: S.cx - 60, y: S.cy - 60, w: 120, h: 120 }], 'frase');
  },
};
