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
