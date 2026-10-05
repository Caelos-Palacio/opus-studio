import { ride, hud, caption, winRide, geo, proj, Lof, GAL_C } from './P_mundo.mjs';
// 10^18–10^21 m: los brazos espirales (con estela por motion blur) hasta que la Vía Láctea entera cabe en la ventana.
export default {
  entities: { win: winRide },
  draw(ctx, t, u, shot, film, api) {
    ride(ctx, api, film, t);
    const G = geo(film), { ppm, P } = proj(G, Lof(t)), [gx, gy] = P(...GAL_C), R = 5e20 * ppm;
    if (R > 40 && R < 330) api.focus(gx - R, gy - R, 2 * R, 2 * R, 'Vía Láctea', { weight: 1, hollow: 0.5 });
    else api.focus(G.cx - 10, G.cy - 10, 20, 20, 'estrellas', { weight: 1 });
    hud(api, film, t);
    caption(api, film, t, 39.4, 41.45, 'LA VÍA LÁCTEA', String.raw`10^{21}\,\mathrm{m}`);
  },
};
