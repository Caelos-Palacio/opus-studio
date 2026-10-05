import { clamp, seg } from '../engine/core.mjs';
import { ride, hud, winRide, geo } from './P_mundo.mjs';
// Un metro. Escala humana ANTES del salto: la persona se dibuja y la ventana de 1 m se cierra a su alrededor (beat 2,4 s).
export default {
  entities: { win: winRide },
  draw(ctx, t, u, shot, film, api) {
    const lt = t - shot.t[0], G = geo(film);
    ride(ctx, api, film, t, { person: { trim: seg(lt, 0.3, 1.9), fill: seg(lt, 1.5, 2.4) }, win: { draw0: 0 } });
    const k = api.spring(lt - 1.6), s = G.S0 * (1 + 0.7 * (1 - k)), a = seg(lt, 1.5, 1.9);   // la ventana llega desde fuera y se asienta
    ctx.save(); ctx.strokeStyle = api.color('accent'); ctx.globalAlpha = a * 0.95; ctx.lineWidth = 2.2 * G.k * 1.5; ctx.strokeRect(G.cx - s / 2, G.cy - s / 2, s, s); ctx.restore();
    if (a > 0.1) api.focus(G.cx - s / 2, G.cy - s / 2, s, s, 'ventana', { weight: 0.3, hollow: 0.9 });
    // cota de 1 m
    const d = seg(lt, 2.5, 3.2) * (1 - seg(lt, 5.4, 6)), x = G.cx + G.S0 / 2 + 16 * G.k * 1.5;
    if (d > 0) {
      ctx.save(); ctx.strokeStyle = api.color('ink'); ctx.globalAlpha = 0.6 * d; ctx.lineWidth = 1.2; ctx.beginPath();
      ctx.moveTo(x, G.cy - G.S0 / 2); ctx.lineTo(x, G.cy - G.S0 / 2 + G.S0 * d);
      ctx.moveTo(x - 5, G.cy - G.S0 / 2); ctx.lineTo(x + 5, G.cy - G.S0 / 2); ctx.moveTo(x - 5, G.cy + G.S0 / 2); ctx.lineTo(x + 5, G.cy + G.S0 / 2); ctx.stroke(); ctx.restore();
    }
    api.text(shot.text, x + 14 * G.k * 1.5, G.cy, { role: 'body', align: 'left', alpha: api.spring(lt - 2.7) * (1 - seg(lt, 5.4, 6)) });
    hud(api, film, t, { write: clamp((lt - 1.0) / 1.2) });
  },
};
