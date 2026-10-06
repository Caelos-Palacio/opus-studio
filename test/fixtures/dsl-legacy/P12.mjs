import { clamp, ease, seg } from '../engine/core.mjs';
import { geo, hud, ruler, sqdot, TEX_LOG, texPow, LMAX, CUR, inkA } from './P_mundo.mjs';
// Descenso. El cursor vuelve por la regla de 26,9 a 0 (los hitos se encienden al pasar) y la ecuación se escribe con
// los números que ya están en pantalla: contar pasos de ×10 ES tomar el logaritmo.
const T0 = 63;
export const vOf = (t) => LMAX * (1 - ease.inOut(clamp((t - T0 - 1.5) / 5)));
const win = (t, film) => { const G = geo(film), v = vOf(t); return { x: G.rx(v), y: G.ry, s: CUR * G.dot, L: v }; };
const EQ = String.raw`\log_{10}\!\left(\frac{8{,}8\times10^{26}\,\mathrm{m}}{1\,\mathrm{m}}\right)\approx 26{,}9`;
export default {
  entities: { win },
  draw(ctx, t, u, shot, film, api) {
    const lt = t - T0, G = geo(film), v = vOf(t), acc = api.color('accent');
    ruler(ctx, api, G, { hi: lt > 1.4 && lt < 6.8 ? v : null });
    for (let k = 0; k <= 26; k++) sqdot(ctx, G.rx(k), G.ry, G.dot, 1, acc, k > v + 0.02 ? 0.4 : 1);   // lo recorrido queda atenuado
    const c = win(t, film); sqdot(ctx, c.x, c.y, c.s, 0, acc, 1, 1.8);
    const w = clamp((lt - 0.9) / 2.4), out = 1 - seg(lt, 7.4, 8);
    if (w > 0) api.tex(EQ, G.cx, G.sy0 + 0.3 * G.sh, { size: 40 * G.k * 1.5, color: inkA(api, out), write: w });
    if (lt < 6.5) hud(api, film, t, { tex: { from: TEX_LOG } });
    else hud(api, film, t, { tex: { from: TEX_LOG, to: texPow(0), u: api.ease('inOut', clamp((lt - 6.5) / 0.6)) } });
  },
};
