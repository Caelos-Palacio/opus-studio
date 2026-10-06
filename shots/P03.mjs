import { ride, hud, caption, winRide, geo, Lof, proj, windows, H0 } from './P_mundo.mjs';
import { clamp, seg } from '../engine/core.mjs';
import { cityScene } from './W_potencias.mjs';
// 10^1–10^6 m: árboles y casas, una ciudad, montañas; el aire termina a 100 km (línea de Kármán) y el suelo se curva.
// BEAT 3D b3 (data/stress/story.json): la CIUDAD COMO VOLUMEN. Es el último tramo a escala humana: lo que aún se recorre a pie tiene profundidad (torres, calles, sombra).
// El 3D (api.world3d, specs 004 y 009) está integrado en el escenario: su horizonte ES la línea de suelo del 2D (cada fotograma, con el zoom del reloj de escala Lof),
// el suelo 3D solo recibe sombras sobre el terreno rayado del 2D, el ángulo sigue la regla del plano general (el 8°→14° al alejarse: la cámara se eleva) y la ventana
// (motivo) se dibuja ENCIMA. Al llegar a 10^3 m el volumen se aplana en la silueta 2D de la ciudad (13,9→14,8 s): lo plano ya basta cuando el cuerpo no cabe.
// Parámetro `w3d` (A/B): apagado = el 2D original sin ciudad 3D.
const W3_FROM = 13.9, W3_TO = 14.8;
export default {
  params: { w3d: { type: 'boolean', default: true, semantic: 'beat 3D b3: la ciudad como volumen (world3d v2); apagado = silueta 2D' } },
  entities: { win: winRide },
  draw(ctx, t, u, shot, film, api) {
    const G = geo(film), L = Lof(t), on = api.params.w3d && t < W3_TO;
    ride(ctx, api, film, t, on ? { win: { alpha: 0 }, surf: seg(t, W3_FROM, W3_TO) } : {});
    if (on) {
      const cam = (tt) => { const Lt = Lof(tt), ppm = proj(G, Lt).ppm, k = clamp((Lt - 0.67) / 2.2); return { ppm, horizon: (G.cy + H0 * ppm) / G.H, az: -12 - 24 * k, el: 8.5 + 5.5 * k }; };
      api.world3d(cityScene(), { t, u, cam, transparent: true, bloom: true, alpha: seg(t, 11.5, 12.1) * (1 - seg(t, W3_FROM, W3_TO)), motionBlur: { samples: 4, shutter: 0.4 } });
      windows(ctx, api, G, L, {});
    }
    if (t > 12.2 && t < 14.2) api.text('TÚ', G.cx + 10 * G.k * 1.5, G.cy, { role: 'label', align: 'left', alpha: api.spring(t - 12.2) * (t > 13.8 ? (14.2 - t) / 0.4 : 1) });
    hud(api, film, t);
    caption(api, film, t, 13.95, 16.35, 'UNA CIUDAD');
    caption(api, film, t, 16.6, 18.95, 'EL AIRE TERMINA A 100 KM', String.raw`100\,\mathrm{km}=10^{5}\,\mathrm{m}`);
  },
};
