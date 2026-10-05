import { seg } from '../engine/core.mjs';
import { ride, hud, caption, winRide, geo, proj, Lof, LY, PROXIMA } from './P_mundo.mjs';
// 10^15–10^18 m: un año luz (barra de escala) y Próxima Centauri; las estrellas vecinas entran con estela (motion blur).
export default {
  entities: { win: winRide },
  draw(ctx, t, u, shot, film, api) {
    ride(ctx, api, film, t);
    const G = geo(film), L = Lof(t), { ppm, P } = proj(G, L), a2 = api.color('accent2');
    const b = seg(t, 33.2, 33.6) * (1 - seg(t, 34.7, 35.1)), w = LY * ppm, y = G.cy + G.S0 * 0.62;   // 1 año luz
    if (b > 0 && w < G.W) {
      ctx.save(); ctx.strokeStyle = a2; ctx.globalAlpha = b; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(G.cx - w / 2, y); ctx.lineTo(G.cx + w / 2, y); ctx.moveTo(G.cx - w / 2, y - 6); ctx.lineTo(G.cx - w / 2, y + 6); ctx.moveTo(G.cx + w / 2, y - 6); ctx.lineTo(G.cx + w / 2, y + 6);
      ctx.stroke(); ctx.restore();
    }
    const [px, py] = P(...PROXIMA), pa = seg(L, 16.0, 16.4);                                        // Próxima: estrella + anillo cian
    if (pa > 0 && px > -20 && px < G.W + 20 && py > -20 && py < G.H + 20) {
      ctx.save(); ctx.fillStyle = api.color('ink'); ctx.globalAlpha = pa; ctx.beginPath(); ctx.arc(px, py, 2.6, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = a2; ctx.lineWidth = 1.5; ctx.globalAlpha = pa * (1 - seg(t, 37.0, 37.5)); ctx.beginPath(); ctx.arc(px, py, 11, 0, 6.2832); ctx.stroke(); ctx.restore();
      api.focus(px - 12, py - 12, 24, 24, 'Próxima Centauri', { weight: 1 });
    } else api.focus(G.cx - 8, G.cy - 8, 16, 16, 'el Sol', { weight: 1 });
    hud(api, film, t);
    caption(api, film, t, 33.3, 35.0, 'UN AÑO LUZ', String.raw`9{,}5\times10^{15}\,\mathrm{m}`);
    caption(api, film, t, 35.1, 36.95, 'PRÓXIMA CENTAURI', String.raw`4\times10^{16}\,\mathrm{m}`);
  },
};
