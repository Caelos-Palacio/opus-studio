import { ride, hud, caption, winRide, AU } from './P_mundo.mjs';
// 10^12–10^15 m: hasta Neptuno; después, tres pasos sin nada nuevo: el sistema solar se vuelve un punto.
export default {
  entities: { win: winRide },
  draw(ctx, t, u, shot, film, api) {
    const r = ride(ctx, api, film, t, { hi: t < 30.8 ? 'neptuno' : null });
    if (r.so) {
      const R = 30.07 * AU * r.so.ppm;
      if (R > 30 && R < 190) api.focus(r.so.sx - R, r.so.sy - R, 2 * R, 2 * R, 'órbita de Neptuno', { weight: 1, hollow: 0.85 });
      else if (R <= 30) api.focus(r.so.sx - 10, r.so.sy - 10, 20, 20, 'sistema solar', { weight: 1 });
    }
    hud(api, film, t);
    caption(api, film, t, 28.9, 30.6, 'NEPTUNO', String.raw`9\times10^{12}\,\mathrm{m}`);
    caption(api, film, t, 30.7, 32.45, 'Y LUEGO, NADA');
  },
};
