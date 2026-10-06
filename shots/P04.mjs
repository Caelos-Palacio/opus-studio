import { ride, hud, caption, winRide, geo, proj, Lof, RE, H0 } from './P_mundo.mjs';
import { seg } from '../engine/core.mjs';
import { earthScene } from './W_potencias.mjs';
// 10^6–10^9 m: la Tierra entera y la órbita de la Luna (scene graph Tierra → brazo → Luna, 2D, intacta: es lo que más gustó).
// BEAT 3D b4 (data/stress/story.json): EL SUELO PLANO ERA UNA ESFERA. La Tierra pasa de línea de suelo a globo con volumen (api.world3d, specs 004/009): luz lateral con
// terminador y luz de borde cian (atmósfera). La luz viene del lado donde entrará el Sol en P05 (la dirección de P_mundo.SUN), así el siguiente paso ya estaba anunciado.
// El 2D pinta el fondo (cielo, atmósfera) y, ENCIMA del globo, las líneas de la Tierra (continentes, graticule), la ventana y la órbita de la Luna: la escala sigue siendo
// contenido del reloj Lof (cam.ppm), no cámara. Parámetro `w3d` (A/B): apagado = el disco 2D original.
export default {
  params: { w3d: { type: 'boolean', default: true, semantic: 'beat 3D b4: la Tierra como globo con volumen (world3d v2); apagado = disco 2D' } },
  entities: { win: winRide },
  draw(ctx, t, u, shot, film, api) {
    const G = geo(film), on = api.params.w3d, e3 = on ? seg(t, 19.1, 19.9) : 0;
    ride(ctx, api, film, t, { stage: 'back', earth3d: e3 });
    if (on) {
      const cam = (tt) => ({ dist: (film.height / (proj(G, Lof(tt)).ppm * 1000)) / (2 * Math.tan(7 * Math.PI / 180)), az: 0, el: 0 });   // distancia para que 1 km = ppm·1000 px (escena en km, fov 14°)
      api.world3d(earthScene(), { t, u, cam, transparent: true, alpha: e3, groundFy: 0.5, override: true });
    }
    const r = ride(ctx, api, film, t, { stage: 'front', earth3d: e3 });
    if (r.mo && r.mo.rm > 40 && r.mo.rm < 260) api.focus(r.mo.ex - r.mo.rm, r.mo.ey - r.mo.rm, 2 * r.mo.rm, 2 * r.mo.rm, 'órbita lunar', { weight: 1, hollow: 0.85 });
    hud(api, film, t);
    caption(api, film, t, 20.3, 21.8, 'LA TIERRA', String.raw`1{,}3\times10^{7}\,\mathrm{m}`);
    caption(api, film, t, 21.9, 23.45, 'ÓRBITA LUNAR', String.raw`7{,}7\times10^{8}\,\mathrm{m}`);
  },
};
