import { ride, hud, caption, winRide, geo } from './P_mundo.mjs';
// 10^24–10^26,9 m: la red cósmica; el alejamiento choca con el borde (CMB se enciende) y el contador no llega a 10^27.
// Después: hold y silencio (hold_ok en el timeline; el audio no tiene eventos entre 51,8 y 55,8 s).
export default {
  entities: { win: winRide },
  draw(ctx, t, u, shot, film, api) {
    const r = ride(ctx, api, film, t), G = geo(film);
    if (!r.ed) api.focus(G.cx - 10, G.cy - 10, 20, 20, 'Grupo Local', { weight: 1 });
    hud(api, film, t);
    caption(api, film, t, 46.8, 49.2, 'LA RED CÓSMICA');
    caption(api, film, t, 51.6, 55.3, 'EL BORDE DE LO OBSERVABLE');
  },
};
