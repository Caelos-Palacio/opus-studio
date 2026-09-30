// Color perceptual (OKLab/OKLCH) + contraste WCAG + generador de paletas con reglas de gusto.
const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const hex2rgb = (h) => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const rgb2hex = (c) => '#' + c.map((v) => Math.round(cl(v, 0, 255)).toString(16).padStart(2, '0')).join('');
const toLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const fromLin = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

export function hex2oklab(h) {
  const [r, g, b] = hex2rgb(h).map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const oklab2lin = ([L, a, b]) => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
};
export const oklch = (h) => { const [L, a, b] = hex2oklab(h); return { L, C: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 }; };
// Reduce croma hasta caber en sRGB (gamut mapping), conservando L y matiz.
export function fromOklch(L, C, hue) {
  const hr = (hue * Math.PI) / 180; let c = C;
  for (let i = 0; i < 48; i++) {
    const lin = oklab2lin([L, c * Math.cos(hr), c * Math.sin(hr)]);
    if (lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4)) return rgb2hex(lin.map(fromLin));
    c *= 0.94;
  }
  return rgb2hex(oklab2lin([L, 0, 0]).map(fromLin));
}
export const luminance = (h) => { const [r, g, b] = hex2rgb(h).map(toLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const A = luminance(a), B = luminance(b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };
export const mix = (a, b, t) => { const A = hex2oklab(a), B = hex2oklab(b); return rgb2hex(oklab2lin(A.map((v, i) => v + (B[i] - v) * t)).map((v) => fromLin(cl(v)))); };
export const rgba = (hex, a) => { const [r, g, b] = hex2rgb(hex); return `rgba(${r},${g},${b},${cl(a)})`; };

const CHROMA = { muted: 0.07, calm: 0.12, bold: 0.18, vivid: 0.24 };
const OFFSET = { complementary: 180, analogous: 35, triad: 120, split: 150, mono: 0 };
// Paleta con roles y contraste garantizado: papel/tinta neutros teñidos con el matiz (nunca #000/#fff puros),
// acento con croma según el ánimo, acento2 por armonía, sombra derivada del papel.
export function generatePalette({ hue = 25, scheme = 'complementary', mode = 'light', mood = 'calm' } = {}) {
  const dark = mode === 'dark', C = CHROMA[mood] ?? 0.12;
  const paper = fromOklch(dark ? 0.16 : 0.955, 0.014, hue), ink = fromOklch(dark ? 0.93 : 0.2, 0.012, hue);
  const tune = (L0, c, h) => { let L = L0, col = fromOklch(L, c, h); while (contrast(col, paper) < 3 && L > 0.2 && L < 0.95) { L += dark ? 0.02 : -0.02; col = fromOklch(L, c, h); } return col; };
  const accent = tune(dark ? 0.74 : 0.6, C, hue), accent2 = tune(dark ? 0.7 : 0.5, C * 0.85, (hue + (OFFSET[scheme] ?? 180)) % 360);
  return { paper, ink, accent, accent2, shade: fromOklch(dark ? 0.3 : 0.84, 0.02, hue) };
}
