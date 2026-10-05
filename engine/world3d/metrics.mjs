// Métricas de calidad de la capa 3D (puras, sin dependencias): las usan test/world3d.mjs y el golden con tolerancia.
// Una imagen es { width, height, data: Uint8ClampedArray RGBA de arriba abajo }.
const srgbLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export const hexRGB = (h) => { h = String(h).replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
// sRGB → CIE Lab (D65)
export function lab(rgb) {
  const r = srgbLin(rgb[0]), g = srgbLin(rgb[1]), b = srgbLin(rgb[2]);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047, Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b, Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (v) => (v > 216 / 24389 ? Math.cbrt(v) : (24389 / 27 * v + 16) / 116);
  const fx = f(X), fy = f(Y), fz = f(Z); return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export const deltaE = (a, b) => { const p = Array.isArray(a) && a.length === 3 && typeof a[0] === 'number' ? lab(a) : a, q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export function psnr(a, b) {
  let s = 0, n = 0; for (let i = 0; i < a.length; i += 4) for (let c = 0; c < 3; c++) { const d = a[i + c] - b[i + c]; s += d * d; n++; }
  return s === 0 ? Infinity : 10 * Math.log10((255 * 255) / (s / n));
}
export function diffCount(a, b) { let c = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) c++; return c; }

// desviación típica del ruido de alta frecuencia (luminancia − media local 3×3) en una región [x,y,w,h] (px)
export function noiseStd(data, W, H, [rx, ry, rw, rh]) {
  const x0 = Math.max(1, Math.round(rx)), y0 = Math.max(1, Math.round(ry)), x1 = Math.min(W - 1, Math.round(rx + rw)), y1 = Math.min(H - 1, Math.round(ry + rh));
  const L = (x, y) => { const i = (y * W + x) * 4; return lum(data[i], data[i + 1], data[i + 2]); };
  let s = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    let m = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) m += L(x + i, y + j);
    const d = L(x, y) - m / 9; s += d * d; n++;
  }
  return Math.sqrt(s / Math.max(1, n));
}

// píxeles RGB dentro de un disco centrado: radio = frac × (radio de pantalla de la esfera unidad a dist 6, fov 30 ⇒ rel 0.631 × alto/2)
export function disc(im, frac, rel = 0.631) {
  const cx = im.width / 2, cy = im.height / 2, R = rel * (im.height / 2) * frac, out = [];
  for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= R * R) { const i = (y * im.width + x) * 4; out.push({ x: x - cx, y: cy - y, c: [im.data[i], im.data[i + 1], im.data[i + 2]] }); }
  return out;
}
// nº de tonos (clusters codiciosos a ΔE < thr) con ≥ 1,5 % de los píxeles
export function clusters(pts, thr = 7) {
  const cs = [];
  for (const p of pts) { const l = lab(p.c); let c = cs.find((q) => Math.hypot(q.l[0] - l[0], q.l[1] - l[1], q.l[2] - l[2]) < thr); if (!c) cs.push((c = { l, n: 0 })); c.n++; }
  return cs.filter((c) => c.n >= pts.length * 0.015).length;
}
// energía de gradiente (alta frecuencia) media dentro del disco: hatching ≫ bandas lisas
export function hatchEnergy(im) {
  const R = 0.631 * (im.height / 2) * 0.9, cx = im.width / 2, cy = im.height / 2; let s = 0, n = 0;
  const L = (x, y) => { const i = (y * im.width + x) * 4; return lum(im.data[i], im.data[i + 1], im.data[i + 2]); };
  for (let y = Math.floor(cy - R); y < cy + R; y++) for (let x = Math.floor(cx - R); x < cx + R; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= R * R) { s += Math.abs(L(x + 1, y) - L(x, y)) + Math.abs(L(x, y + 1) - L(x, y)); n++; }
  return s / Math.max(1, n);
}
// ángulo (°, 0 = derecha, 90 = arriba) del centroide de luminancia de la esfera
export function lightAngle(im, frac = 0.6) {
  const pts = disc(im, frac), Ls = pts.map((p) => lum(...p.c)), mn = Math.min(...Ls); let sx = 0, sy = 0, w = 0;
  pts.forEach((p, i) => { const k = Ls[i] - mn; sx += k * p.x; sy += k * p.y; w += k; });
  return (Math.atan2(sy / Math.max(1e-9, w), sx / Math.max(1e-9, w)) * 180 / Math.PI + 360) % 360;
}
// escalera de un borde recto: RMS (px) del residuo de la posición subpíxel del borde por fila respecto a su recta de ajuste.
// El objeto (fg) ocupa el lado derecho de cada fila; cobertura = proyección del color sobre el eje bg→fg.
export function stairRms(im, bgHex, fgHex, [f0, f1] = [0.15, 0.85]) {
  const bg = hexRGB(bgHex), fg = hexRGB(fgHex), ax = fg.map((v, i) => v - bg[i]), n2 = ax.reduce((p, q) => p + q * q, 0), ys = [], xs = [];
  for (let y = Math.floor(im.height * f0); y < Math.floor(im.height * f1); y++) {
    let e = 0; for (let x = 0; x < im.width; x++) { const i = (y * im.width + x) * 4; const c = ((im.data[i] - bg[0]) * ax[0] + (im.data[i + 1] - bg[1]) * ax[1] + (im.data[i + 2] - bg[2]) * ax[2]) / n2; e += 1 - Math.min(1, Math.max(0, c)); }
    ys.push(y); xs.push(e);
  }
  const N = ys.length, my = ys.reduce((p, q) => p + q, 0) / N, mx = xs.reduce((p, q) => p + q, 0) / N; let sxy = 0, syy = 0;
  for (let i = 0; i < N; i++) { sxy += (ys[i] - my) * (xs[i] - mx); syy += (ys[i] - my) ** 2; }
  const b = sxy / syy; let r = 0; for (let i = 0; i < N; i++) r += (xs[i] - (mx + b * (ys[i] - my))) ** 2;
  return Math.sqrt(r / N);
}
// percentil p de ΔE (Lab) de cada píxel (con alfa > 0) al color más cercano de la paleta
export function paletteDeltaE(im, palHex, p = 0.95) {
  const P = palHex.map((h) => lab(hexRGB(h))), ds = [], cache = new Map();
  for (let i = 0; i < im.data.length; i += 4) {
    if (im.data[i + 3] === 0) continue;
    const key = (im.data[i] << 16) | (im.data[i + 1] << 8) | im.data[i + 2]; let d = cache.get(key);
    if (d === undefined) { const l = lab([im.data[i], im.data[i + 1], im.data[i + 2]]); d = Math.min(...P.map((q) => Math.hypot(q[0] - l[0], q[1] - l[1], q[2] - l[2]))); cache.set(key, d); }
    ds.push(d);
  }
  ds.sort((a, b) => a - b); return ds[Math.min(ds.length - 1, Math.floor(ds.length * p))] ?? 0;
}
// color medio de los píxeles de la región [x0,y0,x1,y1] (fracciones) que difieren del fondo (ΔE > 1,5 respecto al color de la esquina)
export function objMean(im, [a, b, c, d]) {
  const bg = [im.data[0], im.data[1], im.data[2]], x0 = Math.floor(a * im.width), x1 = Math.floor(c * im.width), y0 = Math.floor(b * im.height), y1 = Math.floor(d * im.height); let r = 0, g = 0, bl = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * im.width + x) * 4, px = [im.data[i], im.data[i + 1], im.data[i + 2]]; if (deltaE(px, bg) > 1.5) { r += px[0]; g += px[1]; bl += px[2]; n++; } }
  return n ? [r / n, g / n, bl / n] : null;
}
// diferencias de luminancia > thr entre dos imágenes: nº de píxeles y fracción que se oscurece
export function diffRegion(a, b, thr = 8) {
  let count = 0, dark = 0;
  for (let i = 0; i < a.data.length; i += 4) { const d = lum(a.data[i], a.data[i + 1], a.data[i + 2]) - lum(b.data[i], b.data[i + 1], b.data[i + 2]); if (Math.abs(d) > thr) { count++; if (d < 0) dark++; } }
  return { count, darker: count ? dark / count : 1 };
}
// halo de recorte: p95 de la distancia (ΔE, Lab) de cada píxel de borde (0 < alfa < 255) al segmento fondo–(color opaco más cercano).
// Un recorte limpio mezcla el objeto con el fondo; un halo (premultiplicación mal hecha, borde negro) cae lejos de ese segmento.
export function haloRing(im, bgHex) {
  const bg = lab(hexRGB(bgHex)), W = im.width, H = im.height, ds = [];
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = (y * W + x) * 4, a = im.data[i + 3]; if (a === 0 || a === 255) continue;
    let ob = null; for (let j = -2; j <= 2 && !ob; j++) for (let k = -2; k <= 2; k++) { const q = ((y + j) * W + x + k) * 4; if (im.data[q + 3] === 255) { ob = lab([im.data[q], im.data[q + 1], im.data[q + 2]]); break; } }
    if (!ob) continue;
    const v = ob.map((q, j) => q - bg[j]), vv = v.reduce((p, q) => p + q * q, 0) || 1, l = lab([im.data[i], im.data[i + 1], im.data[i + 2]]);
    const t = Math.min(1, Math.max(0, l.reduce((p, q, j) => p + (q - bg[j]) * v[j], 0) / vv));
    ds.push(Math.hypot(...l.map((q, j) => q - (bg[j] + v[j] * t))));
  }
  if (!ds.length) return 0; ds.sort((p, q) => p - q); return ds[Math.floor(ds.length * 0.95)];
}
