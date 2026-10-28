import { PARAMS, word, focusOf, finalStack, beatX, shotBeat0, clamp } from './K_tipo.mjs';
// K23 · pulsos 51 → 55. La frase completa late con el groove: una ola lima recorre las letras (un barrido cada dos pulsos) y cada letra salta al paso de la ola.
export default {
  params: PARAMS,
  draw(ctx, t, u, shot, film, api) {
    const P = api.params, L = finalStack(api), N = L.reduce((a, l) => a + l.str.replace(' ', '').length, 0), bx = beatX(film, t) - shotBeat0(film, shot), wp = ((bx / 2) % 1) * (N + 8) - 4, boxes = [];
    let g = 0;
    L.forEach((l) => { const base = g, n = l.str.length; let gi = base; const idx = [...l.str].map((c) => (c === ' ' ? -1 : gi++)); g = gi;
      const per = (i) => { const k = idx[i], lit = k < 0 ? 0 : clamp(1 - Math.abs(k - wp) / 2.2); return { dy: -lit * 0.07 * l.size, s: 1 + 0.1 * lit, color: lit > 0.4 ? 'accent' : null }; };
      boxes.push(word(ctx, api, l.str, l.cx, l.cy, l.size * (1 + 0.03 * P.kick), { per })); void n; });
    focusOf(api, boxes, 'frase');
  },
};
