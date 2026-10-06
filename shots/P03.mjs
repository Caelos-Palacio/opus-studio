import { ride, hud, caption, winRide, geo, Lof, proj, windows, mixHex, H0 } from './P_mundo.mjs';
import { clamp, seg } from '../engine/core.mjs';
import { datacenterSceneV2 } from './W_datacenter.mjs';
// 10^1–10^6 m: árboles y casas, una ciudad, montañas; el aire termina a 100 km (línea de Kármán) y el suelo se curva.
// Variante A/B `w3d` (data/stress/potencias.json → variants.w3d; npm run ab -- potencias w3d): los primeros metros son un centro de datos 3D real
// (api.world3d, specs 004 y 009) en lugar del 2D, INTEGRADO en el escenario: su horizonte ES la línea de suelo del 2D (cada fotograma, con el mismo zoom de
// escala: px/m del reloj Lof), el suelo 3D tiene el color del suelo 2D y recibe luz y sombras, el cielo es el del 2D (capa con alfa), el ángulo sigue la regla del
// plano general (el 8°→14°) y el motivo de la ventana se dibuja ENCIMA. Se funde al 2D original hacia t≈14,8.
// Con el parámetro apagado (por defecto) el shot es el original, píxel a píxel.
const W3_FROM = 13.9, W3_TO = 14.8;
export default {
  params: { w3d: { type: 'boolean', default: false, semantic: 'A/B: los primeros metros como centro de datos 3D (world3d v2) en vez del 2D original' } },
  entities: { win: winRide },
  draw(ctx, t, u, shot, film, api) {
    const G = geo(film), L = Lof(t), on = api.params.w3d && t < W3_TO;
    ride(ctx, api, film, t, on ? { win: { alpha: 0 } } : {});
    if (on) {
      const gcol = mixHex(api.color('paper'), api.color('shade'), 0.2);                       // = el suelo 2D de ride() (L < 4,5)
      const cam = (tt) => { const Lt = Lof(tt), ppm = proj(G, Lt).ppm, k = clamp((Lt - 0.67) / 2.2); return { ppm, horizon: (G.cy + H0 * ppm) / G.H, az: -12 - 24 * k, el: 8.5 + 5.5 * k }; };
      api.world3d(datacenterSceneV2(gcol), { t, u, cam, transparent: true, bloom: true, alpha: seg(t, 11.5, 12.1) * (1 - seg(t, W3_FROM, W3_TO)), motionBlur: { samples: 4, shutter: 0.4 } });
      windows(ctx, api, G, L, {});
    }
    if (t > 12.2 && t < 14.2) api.text('TÚ', G.cx + 10 * G.k * 1.5, G.cy, { role: 'label', align: 'left', alpha: api.spring(t - 12.2) * (t > 13.8 ? (14.2 - t) / 0.4 : 1) });
    hud(api, film, t);
    caption(api, film, t, 13.95, 16.35, 'UNA CIUDAD');
    caption(api, film, t, 16.6, 18.95, 'EL AIRE TERMINA A 100 KM', String.raw`100\,\mathrm{km}=10^{5}\,\mathrm{m}`);
  },
};
