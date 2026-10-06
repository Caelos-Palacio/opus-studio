import { ride, hud, caption, winRide, geo, proj, Lof, M31 } from './P_mundo.mjs';
// 10^21–10^24 m: Andrómeda y el Grupo Local. Todo se vuelve tenue: la calma antes del pico.
export default {
  entities: { win: winRide },
  draw(ctx, t, u, shot, film, api) {
    ride(ctx, api, film, t);
    const G = geo(film), { ppm, P } = proj(G, Lof(t)), [ax, ay] = P(...M31), R = Math.max(10, 1.1e21 * ppm);
    if (ax > 0 && ax < G.W && ay > 0 && ay < G.H) api.focus(ax - R, ay - R, 2 * R, 2 * R, 'Andrómeda', { weight: 1 });
    else api.focus(G.cx - 10, G.cy - 10, 20, 20, 'Vía Láctea', { weight: 1 });
    hud(api, film, t);
    caption(api, film, t, 43.2, 45.2, 'ANDRÓMEDA', String.raw`2{,}4\times10^{22}\,\mathrm{m}`);
  },
};
