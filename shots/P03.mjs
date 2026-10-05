import { ride, hud, caption, winRide, geo } from './P_mundo.mjs';
// 10^1–10^6 m: árboles y casas, una ciudad, montañas; el aire termina a 100 km (línea de Kármán) y el suelo se curva.
export default {
  entities: { win: winRide },
  draw(ctx, t, u, shot, film, api) {
    const G = geo(film);
    ride(ctx, api, film, t);
    if (t > 12.2 && t < 14.2) api.text('TÚ', G.cx + 10 * G.k * 1.5, G.cy, { role: 'label', align: 'left', alpha: api.spring(t - 12.2) * (t > 13.8 ? (14.2 - t) / 0.4 : 1) });
    hud(api, film, t);
    caption(api, film, t, 13.95, 16.35, 'UNA CIUDAD');
    caption(api, film, t, 16.6, 18.95, 'EL AIRE TERMINA A 100 KM', String.raw`100\,\mathrm{km}=10^{5}\,\mathrm{m}`);
  },
};
