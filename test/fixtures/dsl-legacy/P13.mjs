import { lerp, seg, springS } from '../engine/core.mjs';
import { geo, hud, ruler, sqdot, ride, person, texPow, CUR } from './P_mundo.mjs';
// Casa. El cursor, en 10^0, vuelve a ser la ventana de 1 m y el icono de la persona vuelve a tamaño real.
// La regla baja al suelo como memoria. El último fotograma rima con el primero (misma masa, otra función).
const T0 = 71;
const e2 = (t, film) => springS(t - T0 - 0.3, film, 'soft');
const win = (t, film) => { const G = geo(film), e = e2(t, film); return { x: lerp(G.rx(0), G.cx, e), y: lerp(G.ry, G.cy, e), s: lerp(CUR * G.dot, G.S0, e), L: 0 }; };
export default {
  entities: { win },
  draw(ctx, t, u, shot, film, api) {
    const lt = t - T0, G = geo(film), K = G.k * 1.5, acc = api.color('accent'), e = e2(t, film);
    const back = seg(lt, 0.2, 2.8);                                            // vuelve el mundo a escala humana (cielo y suelo)
    if (back > 0) api.layer({ opacity: back }, (c, tt, A) => ride(c, A, film, t, { L: 0, person: { fill: 0 }, win: { alpha: 0 } }));
    const y = lerp(G.ry, G.sy0 + 0.95 * G.sh, seg(lt, 0.4, 2.2)), ra = 1 - 0.55 * seg(lt, 0.4, 2.2);
    ruler(ctx, api, G, { y, alpha: ra, icons: 1 - seg(lt, 0.3, 1.2), labels: 1 - seg(lt, 0.3, 1.0), noPerson: true, weight: 0.3 });
    for (let k = 1; k <= 26; k++) sqdot(ctx, G.rx(k), y, G.dot, 1, acc, 0.55 * ra);
    const c = win(t, film); sqdot(ctx, c.x, c.y, c.s, 0, acc, 1, lerp(1.8, 2.2 * K, e));
    if (e > 0.3) api.focus(c.x - c.s / 2, c.y - c.s / 2, c.s, c.s, 'ventana', { weight: 0.3, hollow: 0.9 });
    // la persona: el icono de la regla se funde y la de 1,7 m aparece en su sitio (fundido, no vuelo: el final desciende)
    const pf = seg(lt, 0.6, 2.4);
    if (pf < 1) person(api, G, 0, { x: G.rx(0), y: G.ry - 26 * K, h: 2.6 * 8 * K, fill: 1 - pf, focus: false });
    if (pf > 0) person(api, G, 0, { x: G.cx, y: G.cy, h: 1.7 * G.S0, fill: pf, focus: pf > 0.5 });
    const d = seg(lt, 2.0, 2.7), x = G.cx + G.S0 / 2 + 16 * K;
    if (d > 0) { ctx.save(); ctx.strokeStyle = api.color('ink'); ctx.globalAlpha = 0.6 * d; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, G.cy - G.S0 / 2); ctx.lineTo(x, G.cy - G.S0 / 2 + G.S0 * d); ctx.moveTo(x - 5, G.cy - G.S0 / 2); ctx.lineTo(x + 5, G.cy - G.S0 / 2); ctx.moveTo(x - 5, G.cy + G.S0 / 2); ctx.lineTo(x + 5, G.cy + G.S0 / 2); ctx.stroke(); ctx.restore(); }
    api.text(shot.text, x + 14 * K, G.cy, { role: 'body', align: 'left', alpha: api.spring(lt - 2.3) });
    hud(api, film, t, { tex: { from: texPow(0) } });
  },
};
