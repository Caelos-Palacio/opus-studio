import { PARAMS, word, focusOf, since, fit, stack, shake, glitch, clamp } from './K_tipo.mjs';
// K15 · pulsos 36 → 38. R·O·M·P·E: una letra por semicorchea, cada una a pantalla completa; después ROM / PE entero titila con tiras y canales crecientes.
// Cinco golpes seguidos (tick ascendente de la sonoridad) = tensión por densidad, no por volumen.
const LET = [0, 0.2, 0.4, 0.6, 0.8];
export default {
  params: PARAMS,
  draw(ctx, t, u, shot, film, api) {
    const S = api.safe, P = api.params, boxes = [], [jx, jy] = shake(P, t, 24 + 30 * P.tension, 15), whole = since(film, shot, t, 1);
    if (whole < 0) {
      let i = -1; LET.forEach((k, j) => { if (since(film, shot, t, k) >= 0) i = j; });
      if (i >= 0) { const ch = 'ROMPE'[i], size = fit(ch, S.w * 0.9); boxes.push(word(ctx, api, ch, S.cx + jx, S.cy + jy, size, { reg: false, split: 28, label: ch })); }
      boxes.push({ x: S.cx - 40, y: S.cy - 40, w: 80, h: 80 });
    } else {
      const c = api.ease('inOut', clamp(whole / 0.55));                      // sin titileo: la palabra entera se aprieta despacio (la calma que precede al golpe)
      stack(api, ['ROM', 'PE'], { width: S.w * 0.78, cy: S.cy }).forEach((l, i) => boxes.push(word(ctx, api, l.str, l.cx, l.cy, l.size, { label: 'ROMPE', split: 12 * (1 - c * 0.5), color: 'ink' })));
    }
    focusOf(api, boxes, 'rotura');
  },
};
