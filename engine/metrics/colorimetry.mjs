// Colorimetría normativa: CIE Lab/ΔE2000 (Sharma, Wu, Dalal 2005), WCAG 2.x, APCA-W3 0.0.98G-4g y armonía por ángulo de tono.
import { hex2rgb } from '../color.mjs';
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export function hex2lab(h) {                                   // sRGB D65 → XYZ → Lab (blanco D65)
  const [r, g, b] = hex2rgb(h).map(lin), X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b, Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b, Z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116), fx = f(X / 0.95047), fy = f(Y), fz = f(Z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export function deltaE2000([L1, a1, b1], [L2, a2, b2], kL = 1, kC = 1, kH = 1) {
  const d2r = Math.PI / 180, r2d = 180 / Math.PI, C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2, G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1, ap2 = (1 + G) * a2, Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2);
  const hp = (b, a) => (b === 0 && a === 0 ? 0 : ((Math.atan2(b, a) * r2d) + 360) % 360), hp1 = hp(b1, ap1), hp2 = hp(b2, ap2);
  const dL = L2 - L1, dC = Cp2 - Cp1; let dh = 0; if (Cp1 * Cp2 !== 0) { dh = hp2 - hp1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh * d2r) / 2), Lb = (L1 + L2) / 2, Cpb = (Cp1 + Cp2) / 2;
  let hb = hp1 + hp2; if (Cp1 * Cp2 === 0) hb = hp1 + hp2; else if (Math.abs(hp1 - hp2) <= 180) hb /= 2; else hb = (hb + (hp1 + hp2 < 360 ? 360 : -360)) / 2;
  const T = 1 - 0.17 * Math.cos((hb - 30) * d2r) + 0.24 * Math.cos(2 * hb * d2r) + 0.32 * Math.cos((3 * hb + 6) * d2r) - 0.2 * Math.cos((4 * hb - 63) * d2r);
  const dth = 30 * Math.exp(-(((hb - 275) / 25) ** 2)), Rc = 2 * Math.sqrt(Cpb ** 7 / (Cpb ** 7 + 25 ** 7)), SL = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2), SC = 1 + 0.045 * Cpb, SH = 1 + 0.015 * Cpb * T, RT = -Math.sin(2 * dth * d2r) * Rc;
  return Math.sqrt((dL / (kL * SL)) ** 2 + (dC / (kC * SC)) ** 2 + (dH / (kH * SH)) ** 2 + RT * (dC / (kC * SC)) * (dH / (kH * SH)));
}
export const dE00 = (h1, h2) => deltaE2000(hex2lab(h1), hex2lab(h2));
export const labC = ([, a, b]) => Math.hypot(a, b);
export const labH = ([, a, b]) => ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
const Ylum = (h) => { const [r, g, b] = hex2rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const wcag = (a, b) => { const A = Ylum(a), B = Ylum(b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };
// APCA-W3 (0.0.98G-4g): Lc con signo (positivo texto oscuro/fondo claro; negativo texto claro/fondo oscuro).
export function apca(txt, bg) {
  const f = (h) => { const [r, g, b] = hex2rgb(h).map((c) => (c / 255) ** 2.4), y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b; return y > 0.022 ? y : y + (0.022 - y) ** 1.414; };
  const Yt = f(txt), Yb = f(bg); if (Math.abs(Yb - Yt) < 0.0005) return 0;
  if (Yb > Yt) { const s = (Yb ** 0.56 - Yt ** 0.57) * 1.14; return s < 0.1 ? 0 : (s - 0.027) * 100; }
  const s = (Yb ** 0.65 - Yt ** 0.62) * 1.14; return s > -0.1 ? 0 : (s + 0.027) * 100;
}
// Armonía clásica por huecos de tono entre los cromáticos (C* > 8): mono | análoga | complementaria | triádica | policromática | acromática.
export function harmony(hexes) {
  const hs = hexes.map(hex2lab).filter((l) => labC(l) > 8).map(labH).sort((a, b) => a - b); if (hs.length < 2) return hs.length ? 'monocromática' : 'acromática';
  const gaps = hs.map((h, i) => (i ? h - hs[i - 1] : hs[0] + 360 - hs[hs.length - 1])).sort((a, b) => b - a), span = 360 - gaps[0];
  if (span < 20) return 'monocromática'; if (span <= 60) return 'análoga';
  if (hs.length === 2 || span <= 200 && gaps[1] >= 100) return Math.abs(gaps[0] - 180) < 40 || span >= 140 ? 'complementaria' : 'análoga';
  return gaps[2] != null && gaps[2] >= 90 ? 'triádica' : 'policromática';
}
