import { ride, hud, caption, winRide, geo, Lof } from './P_mundo.mjs';
import { clamp, seg } from '../engine/core.mjs';
import { datacenterScene } from './W_datacenter.mjs';
// 10^1–10^6 m: árboles y casas, una ciudad, montañas; el aire termina a 100 km (línea de Kármán) y el suelo se curva.
// Variante A/B `w3d` (data/stress/potencias.json → variants.w3d; npm run … --variant w3d): los primeros metros son un centro de datos 3D real
// (api.world3d, spec 004) en lugar del 2D, con el MISMO zoom de escala (la cámara 3D sale de Lof(t)) y fundiéndose al 2D original hacia t≈14,8.
// Con el parámetro apagado (por defecto) el shot es el original, píxel a píxel.
const W3_FROM = 13.9, W3_TO = 14.8, dcCam = (t) => { const L = Lof(t), u = clamp((L - 0.67) / 2); return { dist: 4.8 * 10 ** L, az: -10 - 22 * u, el: 12 + 20 * u }; };
export default {
  params: { w3d: { type: 'boolean', default: false, semantic: 'A/B: los primeros metros como centro de datos 3D (world3d) en vez del 2D original' } },
  entities: { win: winRide },
  draw(ctx, t, u, shot, film, api) {
    const G = geo(film);
    ride(ctx, api, film, t);
    if (api.params.w3d && t < W3_TO) api.world3d(datacenterScene(), { t, u, cam: dcCam, alpha: 1 - seg(t, W3_FROM, W3_TO), motionBlur: { samples: 4, shutter: 0.4 } });
    if (t > 12.2 && t < 14.2) api.text('TÚ', G.cx + 10 * G.k * 1.5, G.cy, { role: 'label', align: 'left', alpha: api.spring(t - 12.2) * (t > 13.8 ? (14.2 - t) / 0.4 : 1) });
    hud(api, film, t);
    caption(api, film, t, 13.95, 16.35, 'UNA CIUDAD');
    caption(api, film, t, 16.6, 18.95, 'EL AIRE TERMINA A 100 KM', String.raw`100\,\mathrm{km}=10^{5}\,\mathrm{m}`);
  },
};
