// base.mjs: PRNG con semilla, ruido, easings, muelle y color. Sin dependencias. Todo determinista.

/** hash(str): cadena -> semilla uint32 (FNV-1a). */
export const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
/** mulberry32(semilla): devuelve una funcion rnd() en [0,1) reproducible. */
export const mulberry32 = (a) => () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
/** rng(semilla): como mulberry32 pero acepta numero o texto. */
export const rng = (s = 1) => mulberry32(typeof s === 'string' ? hash(s) : s >>> 0);
/** gauss(rnd): numero normal N(0,1) con Box-Muller usando rnd. */
export const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

const ih = (x, y, s) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** valor(x,y,seed): ruido de valor suave 2D en [0,1]. */
export function valor(x, y = 0, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = ih(xi, yi, seed), b = ih(xi + 1, yi, seed), c = ih(xi, yi + 1, seed), d = ih(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** fbm(x,y,seed,oct): suma de octavas de ruido de valor, normalizada a [0,1]. */
export function fbm(x, y = 0, seed = 0, oct = 4) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { s += a * valor(x, y, seed + i * 101); n += a; x = x * 2 + 17.3; y = y * 2 + 5.1; a /= 2; }
  return s / n;
}

/** lerp(a,b,k): interpolacion lineal. */
export const lerp = (a, b, k) => a + (b - a) * k;
/** clamp(x,a,b): limita x al rango [a,b]. */
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
/** smoothstep(a,b,x): escalon suave 0..1 entre a y b. */
export const smoothstep = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
/** inOutCubic(t): aceleracion y frenada suaves (t en 0..1). */
export const inOutCubic = (t) => (t = clamp(t), t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** outBack(t,s): llega con sobreimpulso; s 1.2-1.7 (t en 0..1). */
export const outBack = (t, s = 1.4) => { t = clamp(t) - 1; return 1 + (s + 1) * t * t * t + s * t * t; };
/** outExpo(t): arranque rapido y frenada larga. */
export const outExpo = (t) => (t = clamp(t), t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
/** spring(t,zeta,omega): muelle amortiguado 0->1 (zeta 0.3-0.6, omega 6-14), t en segundos. */
export const spring = (t, zeta = 0.45, omega = 10) => t <= 0 ? 0 : 1 - Math.exp(-zeta * omega * t) * Math.cos(omega * Math.sqrt(1 - zeta * zeta) * t);

/** hexRgb(hex): '#rrggbb' o '#rgb' -> [r,g,b] 0-255. */
export const hexRgb = (h) => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
/** rgbHex(r,g,b): [0-255] -> '#rrggbb'. */
export const rgbHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
/** rgba(hex,a): hex + alfa -> cadena css rgba(). */
export const rgba = (h, a = 1) => { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; };

const lin = (v) => (v /= 255) <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
const gam = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
/** aOklab([r,g,b]): sRGB 0-255 -> [L,a,b] OKLab. */
export function aOklab([r, g, b]) {
  r = lin(r); g = lin(g); b = lin(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
/** deOklab([L,a,b]): OKLab -> sRGB 0-255. */
export function deOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), gam(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
}
/** mezclar(c1,c2,k): mezcla dos colores hex en OKLab (k=0 -> c1, k=1 -> c2); devuelve hex. */
export function mezclar(c1, c2, k) {
  const A = aOklab(hexRgb(c1)), B = aOklab(hexRgb(c2));
  return rgbHex(...deOklab(A.map((v, i) => lerp(v, B[i], k))));
}
/** oscurecer(hex,k) / aclarar(hex,k): mezcla con negro / blanco en OKLab. */
export const oscurecer = (h, k) => mezclar(h, '#000000', k);
export const aclarar = (h, k) => mezclar(h, '#ffffff', k);
