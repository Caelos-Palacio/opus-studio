import { datacenterScene, datacenterCam, datacenterHud, dist, TARGET } from './W_datacenter.mjs';
// «datacenter» (spike webgl rehecho como shot del motor): 3D real como CAPA del compositor + HUD 2D de regla log.
// El 3D lo declara este archivo como datos (api.world3d); el estilo pone paleta, luz clave, bandas toon, contorno de tinta, niebla y sombra de contacto.
const D = 4.2;
export default {
  draw(ctx, t, u, shot, film, api) {
    const lt = Math.max(0, t - shot.t[0]);
    api.world3d(datacenterScene(), { t: lt, u, cam: (tt) => datacenterCam(tt, D), motionBlur: { samples: 6, shutter: 0.4 } });
    datacenterHud(ctx, api, film, lt, dist(lt, D));
    const [cx, cy] = [film.width * 0.5, film.height * 0.5]; api.focus(cx - 320, cy - 190, 640, 380, 'rack héroe', { weight: 1 });
  },
};
