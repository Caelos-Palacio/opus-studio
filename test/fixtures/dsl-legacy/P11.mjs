import { clamp, lerp, seg, springS } from '../engine/core.mjs';
import { geo, hud, ruler, sqdot, TEX_EDGE, TEX_LOG, LMAX, CUR, inkA } from './P_mundo.mjs';
// La revelación. Las 27 ventanas (anidadas, casi todas ya sub-píxel) salen del centro y se alinean como puntos
// equidistantes: pasos iguales. La ventana del borde se vuelve el cursor; el contador pasa de 8,8×10^26 a 10^26,9.
const T0 = 55.5;
const ek = (t, film, k) => springS(t - T0 - 0.4 - (LMAX - k) * 0.04, film, 'soft');   // el borde sale primero; la ventana de 1 m, la última
const win = (t, film) => { const G = geo(film), e = ek(t, film, LMAX); return { x: lerp(G.cx, G.rx(LMAX), e), y: lerp(G.cy, G.ry, e), s: lerp(G.S0, CUR * G.dot, e), L: LMAX }; };
export default {
  entities: { win },
  draw(ctx, t, u, shot, film, api) {
    const lt = t - T0, G = geo(film), K = G.k * 1.5, acc = api.color('accent'), a2 = api.color('accent2');
    // el mar de galaxias y el borde se retiran; el anillo vuela a su sitio en la regla (icono «borde»)
    const eE = ek(t, film, LMAX), sea = 1 - seg(lt, 0, 1.0);
    if (sea > 0) { ctx.save(); ctx.fillStyle = a2; ctx.globalAlpha = 0.05 * sea; ctx.beginPath(); ctx.arc(G.cx, G.cy, G.S0 / 2, 0, 6.2832); ctx.fill(); ctx.restore(); }
    const rx = lerp(G.cx, G.rx(LMAX), eE), ry = lerp(G.cy, G.ry - 26 * K, eE), rr = lerp(G.S0 / 2, 8 * K, eE);
    ctx.save(); ctx.strokeStyle = a2; ctx.globalAlpha = 0.9; ctx.lineWidth = lerp(2 * K, 2, eE); ctx.beginPath(); ctx.arc(rx, ry, rr, 0, 6.2832); ctx.stroke(); ctx.restore();
    ruler(ctx, api, G, { line: seg(lt, 1.0, 2.4), ticks: seg(lt, 1.2, 2.6), icons: seg(lt, 3.0, 4.6), labels: seg(lt, 3.4, 4.2), noEdge: true });
    // las ventanas 0..26: de cuadrado (en el centro, con su tamaño real) a punto (en x = rx(k)), con un arco
    for (let k = 0; k <= 26; k++) {
      const e = ek(t, film, k), w0 = G.S0 * 10 ** (k - LMAX); if (e <= 0.001 && w0 < 0.4) continue;
      const x = lerp(G.cx, G.rx(k), e), y = lerp(G.cy, G.ry, e) - Math.sin(Math.PI * e) * 0.07 * G.sh, w = lerp(w0, G.dot, e);
      sqdot(ctx, x, y, Math.max(w, 1.2 * e), e, acc, clamp(e * 3 + (w0 > 2 ? 1 : 0)));
    }
    const c = win(t, film);                                                     // la ventana del borde → cursor (sigue siendo un cuadrado hueco)
    sqdot(ctx, c.x, c.y, c.s, 0, acc, 1, lerp(2.2 * K, 1.8, eE));
    const [hx, hy] = [G.cx, G.sy0 + 0.3 * G.sh];
    api.text(shot.text, hx, hy, { role: 'h1', alpha: api.spring(lt - 2.8) * (1 - seg(lt, 6.8, 7.4)) });
    hud(api, film, t, { tex: { from: TEX_EDGE, to: TEX_LOG, u: api.ease('inOut', clamp((lt - 3.4) / 1.2)) } });
    void inkA;
  },
};
