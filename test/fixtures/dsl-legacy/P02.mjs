import { seg, clamp } from '../engine/core.mjs';
import { ride, hud, winRide, geo, inkA } from './P_mundo.mjs';
// La regla (×10) y la pregunta (brecha de información). En t = 10 s empieza el alejamiento: la ventana de 10 m entra.
export default {
  entities: { win: winRide },
  draw(ctx, t, u, shot, film, api) {
    const lt = t - shot.t[0], G = geo(film);
    ride(ctx, api, film, t);
    const r = seg(lt, 0.5, 1.4) * (1 - seg(lt, 2.9, 3.5));                     // «×10» junto a la ventana (se va antes del primer paso)
    if (r > 0) api.tex(String.raw`\times 10`, G.cx + G.S0 / 2 + 18 * G.k * 1.5, G.cy - G.S0 / 2, { size: 34 * G.k * 1.5, align: 'left', color: inkA(api, r, 'accent'), write: clamp((lt - 0.5) / 0.8) });
    const [qx, qy] = api.at(0.5, 0.93);
    api.text(shot.text, qx, qy, { role: 'body', alpha: api.spring(lt - 1.1) * (1 - seg(lt, 5.4, 6)) });
    hud(api, film, t);
  },
};
