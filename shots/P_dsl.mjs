// «Potencias» en DSL (spec 010): funciones PURAS de apoyo que los .scene.json de P01–P13 llaman por nombre (fns / entities / let).
// La lógica de dibujo sigue en P_mundo.mjs; aquí solo hay constantes del mundo, geometría derivada y las entidades de relevo de P11–P13.
import { lerp, clamp, ease, springS } from '../engine/core.mjs';
import { geo, proj, LMAX, AU, LY, CUR, PROXIMA, GAL_C, M31 } from './P_mundo.mjs';

export const lmax = () => LMAX, au = () => AU, ly = () => LY, cur = () => CUR;
export const rx = (G, v) => G.rx(v);                                           // posición x de la marca v en la regla de exponentes
const PTS = { PROXIMA, GAL_C, M31 };
export const projPt = (G, L, name) => proj(G, L).P(...PTS[name]);              // punto del mundo (m) → pantalla
export const ppmOf = (G, L) => proj(G, L).ppm;

// ── entidades de relevo (la ventana: centro, tamaño y escala; el motor las usa para continuidad y cámara) ──
const T11 = 55.5, ek11 = (t, film, k) => springS(t - T11 - 0.4 - (LMAX - k) * 0.04, film, 'soft');
export const win11 = (t, film) => { const G = geo(film), e = ek11(t, film, LMAX); return { x: lerp(G.cx, G.rx(LMAX), e), y: lerp(G.cy, G.ry, e), s: lerp(G.S0, CUR * G.dot, e), L: LMAX }; };
const T12 = 63, vOf12 = (t) => LMAX * (1 - ease.inOut(clamp((t - T12 - 1.5) / 5)));
export const win12 = (t, film) => { const G = geo(film), v = vOf12(t); return { x: G.rx(v), y: G.ry, s: CUR * G.dot, L: v }; };
const T13 = 71, e13 = (t, film) => springS(t - T13 - 0.3, film, 'soft');
export const win13 = (t, film) => { const G = geo(film), e = e13(t, film); return { x: lerp(G.rx(0), G.cx, e), y: lerp(G.ry, G.cy, e), s: lerp(CUR * G.dot, G.S0, e), L: 0 }; };

// ── beats 3D de Potencias (P03 ciudad, P04 globo): cámaras como función pura del tiempo de FILM (el reloj de escala Lof) ──
import { Lof, windows, H0 } from './P_mundo.mjs';
export const cityCam = (film, tt) => { const G = geo(film), Lt = Lof(tt), ppm = proj(G, Lt).ppm, k = clamp((Lt - 0.67) / 2.2); return { ppm, horizon: (G.cy + H0 * ppm) / G.H, az: -12 - 24 * k, el: 8.5 + 5.5 * k }; };
export const earthCam = (film, tt) => ({ dist: film.height / (proj(geo(film), Lof(tt)).ppm * 1000) / (2 * Math.tan(7 * Math.PI / 180)), az: 0, el: 0 });   // escena en km, fov 14°
export const windowsOn = (ctx, api, film, t) => windows(ctx, api, geo(film), Lof(t), {});
