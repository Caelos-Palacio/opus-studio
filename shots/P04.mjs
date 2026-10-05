import { ride, hud, caption, winRide } from './P_mundo.mjs';
// 10^6–10^9 m: la Tierra entera (api.globe) y la órbita de la Luna (scene graph Tierra → brazo → Luna).
export default {
  entities: { win: winRide },
  draw(ctx, t, u, shot, film, api) {
    const r = ride(ctx, api, film, t);
    if (r.mo && r.mo.rm > 40 && r.mo.rm < 260) api.focus(r.mo.ex - r.mo.rm, r.mo.ey - r.mo.rm, 2 * r.mo.rm, 2 * r.mo.rm, 'órbita lunar', { weight: 1, hollow: 0.85 });
    hud(api, film, t);
    caption(api, film, t, 20.3, 21.8, 'LA TIERRA', String.raw`1{,}3\times10^{7}\,\mathrm{m}`);
    caption(api, film, t, 21.9, 23.45, 'ÓRBITA LUNAR', String.raw`7{,}7\times10^{8}\,\mathrm{m}`);
  },
};
