import { ride, hud, caption, winRide, AU } from './P_mundo.mjs';
// 10^9–10^12 m: la luz del Sol entra antes que el Sol; la órbita terrestre (ámbar) pasa por el centro: por ti.
export default {
  entities: { win: winRide },
  draw(ctx, t, u, shot, film, api) {
    const r = ride(ctx, api, film, t);
    if (r.so) {
      const R = AU * r.so.ppm;
      if (R > 30 && R < 190) api.focus(r.so.sx - R, r.so.sy - R, 2 * R, 2 * R, 'órbita terrestre', { weight: 1, hollow: 0.85 });
      else if (R <= 30) api.focus(r.so.sx - 8, r.so.sy - 8, 16, 16, 'sol', { weight: 1 });
    }
    hud(api, film, t);
    caption(api, film, t, 26.0, 27.95, 'NUESTRA ÓRBITA', String.raw`3\times10^{11}\,\mathrm{m}`);
  },
};
