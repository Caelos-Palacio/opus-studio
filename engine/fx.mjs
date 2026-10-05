// Compositor. Cada efecto es una función pura de (píxeles de la capa, t, parámetros).
// Soluciones a límites reales de Canvas 2D / node-canvas:
//  · ctx.filter='blur()' NO funciona en node-canvas → blur por cadena de reducción/ampliación (≈gaussiano, O(px), igual en navegador).
//  · motion blur sin estado: como la capa es función de t, se redibuja en t−k·δ y se promedia (supermuestreo temporal exacto).
//  · warps de raster (texto, footage): malla de triángulos con transform afín por celda (sin WebGL).
//  · banding en fondos oscuros: dither determinista en el grade.
import { clamp, noise1, hash2 } from './core.mjs';
import { span, run } from './perf.mjs';

// Pool de lienzos por tamaño: evita crear miles de canvas por render. Se reinicia en cada seek (sin estado visible).
export function pool(film) {
  if (!film._pool) film._pool = { free: new Map(), used: [] };
  const P = film._pool;
  return {
    get(w, h) {
      const k = w + 'x' + h, arr = P.free.get(k) ?? []; let c = arr.pop();
      if (!c) c = film.canvas(w, h);
      const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, w, h);
      P.used.push([k, c]); return c;
    },
  };
}
export function releasePool(film) { const P = film._pool; if (!P) return; for (const [k, c] of P.used) { if (!P.free.has(k)) P.free.set(k, []); P.free.get(k).push(c); } P.used = []; }


// R3 (opt-in, film.P.fxFast): reescalado barato de capas ya desenfocadas. La subida bilinear a resolución completa cuesta ~15 ms
// por llamada en cairo (sin SIMD); con fxFast se sube bilinear a ½ del destino (4× menos píxeles) y de ahí 'nearest' al tamaño completo.
// Por defecto (fxFast ausente) = drawImage exacto de siempre: golden intacto.
const fast = (film) => !!film?.P?.fxFast;
function drawUp(film, ctx, src, W, H) {
  if (!fast(film) || src.width >= W) { ctx.drawImage(src, 0, 0, W, H); return; }
  const hw = Math.max(1, Math.ceil(W / 2)), hh = Math.max(1, Math.ceil(H / 2));
  let cur = src;
  if (src.width < hw) { const c = pool(film).get(hw, hh), x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.drawImage(src, 0, 0, hw, hh); cur = c; }
  const keep = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false; ctx.drawImage(cur, 0, 0, W, H); ctx.imageSmoothingEnabled = keep;
}

// Blur ≈ gaussiano de radio r (px de dispositivo): reducir a escala 1/f en pasos de 2 y volver a ampliar (bilineal).
function blurCanvas_(film, src, r, { small = false } = {}) {
  if (r < 0.75) return src;
  const W = src.width, H = src.height, pl = pool(film), steps = Math.max(1, Math.min(6, Math.round(Math.log2(r * 1.2))));
  let cur = src, w = W, h = H; const chain = [];
  for (let i = 0; i < steps; i++) { w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); const c = pl.get(w, h), x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.drawImage(cur, 0, 0, w, h); chain.push(c); cur = c; }
  if (small) return cur;                                                     // quien compone puede ampliar al dibujar (1 pasada menos)
  for (let i = steps - 2; i >= 0; i--) { const c = pl.get(chain[i].width, chain[i].height), x = c.getContext('2d'); x.drawImage(cur, 0, 0, c.width, c.height); cur = c; }
  const out = pl.get(W, H), ox = out.getContext('2d'); ox.imageSmoothingEnabled = true; drawUp(film, ox, cur, W, H); return out;
}
// Bloom: umbral de luminancia a 1/4, blur, suma aditiva. Solo lo brillante florece (no "glow" genérico sobre todo).
function bloom_(film, ctx, src, { threshold = 0.72, strength = 0.8, radius = 24 } = {}) {
  const pl = pool(film), w = Math.max(1, src.width >> 2), h = Math.max(1, src.height >> 2), c = pl.get(w, h), x = c.getContext('2d');
  if (fast(film) && src.width >= 4 * w) { const c2 = pl.get(src.width >> 1, src.height >> 1); c2.getContext('2d').drawImage(src, 0, 0, c2.width, c2.height); x.drawImage(c2, 0, 0, w, h); }   // 2 pasos ×2 (≈1 ms) en vez de 1 paso ×4 (≈11 ms)
  else x.drawImage(src, 0, 0, w, h);
  const im = x.getImageData(0, 0, w, h), d = im.data, th = threshold * 255;
  for (let i = 0; i < d.length; i += 4) { const L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2], k = L > th ? (L - th) / (255 - th + 1e-6) : 0; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; }
  x.putImageData(im, 0, 0);
  const b = blurCanvas(film, c, radius / 4, { small: true }), st = clamp(strength, 0, 2);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = Math.min(1, st); drawUp(film, ctx, b, src.width, src.height); if (st > 1) { ctx.globalAlpha = st - 1; drawUp(film, ctx, b, src.width, src.height); } ctx.restore();
}
// Operaciones por píxel sobre la capa (in-place).
// Aberración cromática RADIAL (modelo de lente: desplazamiento ∝ r², nulo en el centro). La uniforme hace parpadear de color
// las líneas finas al moverse la cámara (la fase subpíxel cambia cada frame); la radial deja limpio el centro, donde vive el sujeto.
const CHROMA = new Map();                                                   // tablas de índices por (W,H,px): cálculo una vez, lookup después
function chroma_(c, px = 2) {
  if (!px) return; const x = c.getContext('2d'), W = c.width, H = c.height, key = `${W}x${H}:${px}`;
  let T = CHROMA.get(key);
  if (!T) {
    const cx = W / 2, cy = H / 2, k = px / (cx * cx + cy * cy), idx = [], rs = [], bs = [];
    for (let y = 0; y < H; y++) { const dy = y - cy; for (let X = 0; X < W; X++) {
      const dx = X - cx, f = k * (dx * dx + dy * dy); if (f < 0.25) continue;
      const n = Math.hypot(dx, dy) || 1, ox = (dx / n) * f, oy = (dy / n) * f, cl = (v, m) => Math.min(m - 1, Math.max(0, Math.round(v)));
      idx.push((y * W + X) * 4); rs.push((cl(y + oy, H) * W + cl(X + ox, W)) * 4); bs.push((cl(y - oy, H) * W + cl(X - ox, W)) * 4 + 2);
    } }
    T = { idx: Int32Array.from(idx), rs: Int32Array.from(rs), bs: Int32Array.from(bs) }; if (CHROMA.size > 8) CHROMA.clear(); CHROMA.set(key, T);
  }
  const im = x.getImageData(0, 0, W, H), s = im.data, d = new Uint8ClampedArray(s), { idx, rs, bs } = T;
  for (let q = 0; q < idx.length; q++) { d[idx[q]] = s[rs[q]]; d[idx[q] + 2] = s[bs[q]]; }
  im.data.set(d); x.putImageData(im, 0, 0);
}
function displace_(c, { amp = 8, scale = 0.012, t = 0, seed = 3 } = {}) {
  const x = c.getContext('2d'), W = c.width, H = c.height, im = x.getImageData(0, 0, W, H), s = new Uint8ClampedArray(im.data), d = im.data;
  const gx = new Float32Array(W), gy = new Float32Array(H);                   // campo separable: O(W+H) ruidos, no O(W·H)
  for (let X = 0; X < W; X++) gx[X] = noise1(X * scale + t, seed);
  for (let y = 0; y < H; y++) gy[y] = noise1(y * scale + t * 1.3, seed + 11);
  for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) {
    const sx = clamp(Math.round(X + amp * gy[y]), 0, W - 1), sy = clamp(Math.round(y + amp * gx[X]), 0, H - 1), i = (y * W + X) * 4, j = (sy * W + sx) * 4;
    d[i] = s[j]; d[i + 1] = s[j + 1]; d[i + 2] = s[j + 2]; d[i + 3] = s[j + 3];
  }
  x.putImageData(im, 0, 0);
}
// Warp de malla (raster): la capa src se redibuja deformada por warp(x,y)→[x',y'] con una rejilla de n×n celdas.
function meshWarp_(ctx, src, warp, n = 24) {
  const W = src.width, H = src.height, cw = W / n, ch = H / n, P = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) P.push(warp(i * cw, j * ch));
  const tri = (s0, s1, s2, d0, d1, d2) => {
    const [x0, y0] = s0, [x1, y1] = s1, [x2, y2] = s2, [u0, v0] = d0, [u1, v1] = d1, [u2, v2] = d2;
    const den = x0 * (y2 - y1) - x1 * y2 + x2 * y1 + (x1 - x2) * y0; if (Math.abs(den) < 1e-9) return;
    const a = -(y0 * (u2 - u1) - y1 * u2 + y2 * u1 + (y1 - y2) * u0) / den, b = (y1 * v2 + y0 * (v1 - v2) - y2 * v1 + (y2 - y1) * v0) / den;
    const c = (x0 * (u2 - u1) - x1 * u2 + x2 * u1 + (x1 - x2) * u0) / den, d = -(x1 * v2 + x0 * (v1 - v2) - x2 * v1 + (x2 - x1) * v0) / den;
    const e = (x0 * (y2 * u1 - y1 * u2) + y0 * (x1 * u2 - x2 * u1) + (x2 * y1 - x1 * y2) * u0) / den, f = (x0 * (y2 * v1 - y1 * v2) + y0 * (x1 * v2 - x2 * v1) + (x2 * y1 - x1 * y2) * v0) / den;
    const cx = (u0 + u1 + u2) / 3, cy = (v0 + v1 + v2) / 3, g = (p) => [p[0] + Math.sign(p[0] - cx) * 0.6, p[1] + Math.sign(p[1] - cy) * 0.6];   // 0.6 px de solape: sin costuras
    const [q0, q1, q2] = [g(d0), g(d1), g(d2)];
    ctx.save(); ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); ctx.closePath(); ctx.clip();
    ctx.setTransform(a, b, c, d, e, f); ctx.drawImage(src, 0, 0); ctx.restore();
  };
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * (n + 1) + i, s = (ii, jj) => [ii * cw, jj * ch];
    tri(s(i, j), s(i + 1, j), s(i, j + 1), P[k], P[k + 1], P[k + n + 1]);
    tri(s(i + 1, j), s(i + 1, j + 1), s(i, j + 1), P[k + 1], P[k + n + 2], P[k + n + 1]);
  }
  ctx.restore();
}

// Tesela 64×64 de ruido triangular (TPDF, media 0): dither sin hash por píxel; el desfase por frame evita patrón fijo.
const DTILE = Float32Array.from({ length: 4096 }, (_, i) => hash2(i, 91) + hash2(i, 92) - 1), LUTS = new Map();
// Grade de color por LUT (lift/gamma/gain, temperatura, saturación) + dither. ~6 ms a 720p.
function colorGrade_(ctx, W, H, g, t) {
  if (!g) return;
  const { lift = 0, gamma = 1, gain = 1, temp = 0, sat = 1, dither = 0 } = g;
  if (!lift && gamma === 1 && gain === 1 && !temp && sat === 1 && !dither) return;
  const key = JSON.stringify(g); let lut = LUTS.get(key);
  if (!lut) { lut = [0, 1, 2].map((ch) => { const L = new Uint8ClampedArray(256), tk = ch === 0 ? 1 + temp * 0.08 : ch === 2 ? 1 - temp * 0.08 : 1;
    for (let v = 0; v < 256; v++) { let x = v / 255; x = x * gain * tk + lift * (1 - x); x = Math.pow(clamp(x), 1 / gamma); L[v] = Math.round(x * 255); } return L; }); if (LUTS.size > 16) LUTS.clear(); LUTS.set(key, lut); }
  const im = ctx.getImageData(0, 0, W, H), d = im.data, f = Math.floor(t * 24), ox = (f * 37) & 63, oy = (f * 23) & 63, [L0, L1, L2] = lut;
  for (let y = 0, i = 0; y < H; y++) { const row = ((y + oy) & 63) << 6; for (let x = 0; x < W; x++, i += 4) {
    let r = L0[d[i]], gg = L1[d[i + 1]], b = L2[d[i + 2]];
    if (sat !== 1) { const L = 0.2126 * r + 0.7152 * gg + 0.0722 * b; r = L + (r - L) * sat; gg = L + (gg - L) * sat; b = L + (b - L) * sat; }
    if (dither) { const n = DTILE[row | ((x + ox) & 63)] * dither; r += n; gg += n; b += n; }
    d[i] = r; d[i + 1] = gg; d[i + 2] = b;
  } }
  ctx.putImageData(im, 0, 0);
}

// Capa con efectos. draw(ctxCapa, tCapa, apiCapa). spec:
//  { blur, bloom:{threshold,strength,radius}, motionBlur:{shutter:0.5, samples:6}, trail:{length:0.4, samples:6, decay:0.6},
//    dirBlur:{angle,dist,samples}, chroma:px, displace:{amp,scale}, warp:(x,y)=>[x',y'], mask:(ctx,api)=>void, opacity, blend, fps }
function layer_(film, mainCtx, spec, t, draw) {
  const W = mainCtx.canvas.width, H = mainCtx.canvas.height, pl = pool(film), m = mainCtx.getTransform();
  const q = (tt) => (spec.fps ? Math.floor(tt * spec.fps + 1e-9) / spec.fps : tt);
  // Capa solo-blur: se renderiza a 1/f (f ≈ r/2 potencia de 2): el contenido desenfocado no tiene frecuencias que perder (Nyquist).
  const sm = Math.hypot(m.a, m.b), rDev = (spec.blur ?? 0) * sm, onlyBlur = rDev >= 4 && !spec.motionBlur && !spec.trail && !spec.dirBlur && !spec.chroma && !spec.displace && !spec.mask && !spec.warp && !spec.bloom;
  const f = onlyBlur ? Math.min(8, 2 ** Math.floor(Math.log2(rDev / 2))) : 1, LW = Math.ceil(W / f), LH = Math.ceil(H / f);
  const render = (tt) => { const c = pl.get(LW, LH), x = c.getContext('2d'); x.setTransform(m.a / f, m.b / f, m.c / f, m.d / f, m.e / f, m.f / f); run('shot', draw, x, tt); return c; };
  if (onlyBlur) {
    const b = blurCanvas(film, render(q(t)), rDev / f, { small: true });
    mainCtx.save(); mainCtx.setTransform(1, 0, 0, 1, 0, 0); mainCtx.globalAlpha = spec.opacity ?? 1; if (spec.blend) mainCtx.globalCompositeOperation = spec.blend; mainCtx.imageSmoothingEnabled = true;
    drawUp(film, mainCtx, b, W, H); mainCtx.restore(); return;
  }
  let img;
  const mb = spec.motionBlur, tr = spec.trail;
  if (mb) {                                                                // promedio exacto de sub-fotogramas dentro del obturador
    const n = mb.samples ?? 6, sh = (mb.shutter ?? 0.5) / film.fps; img = pl.get(W, H); const x = img.getContext('2d');
    for (let i = 0; i < n; i++) { const c = render(q(t - sh * (i / Math.max(1, n - 1)))); x.globalAlpha = 1 / (i + 1); x.drawImage(c, 0, 0); }
  } else img = render(q(t));
  if (tr) {                                                                // ecos del pasado con decaimiento (estela de luz)
    const n = tr.samples ?? 6, L = tr.length ?? 0.4, dec = tr.decay ?? 0.6, acc = pl.get(W, H), x = acc.getContext('2d');
    for (let i = n; i >= 1; i--) { x.globalAlpha = Math.pow(dec, i) * 0.9; x.drawImage(render(q(t - (L * i) / n)), 0, 0); }
    x.globalAlpha = 1; x.drawImage(img, 0, 0); img = acc;
  }
  if (spec.dirBlur) { const { angle = 0, dist = 12, samples = 8 } = spec.dirBlur, o = pl.get(W, H), x = o.getContext('2d'), dx = Math.cos(angle) * dist, dy = Math.sin(angle) * dist;
    for (let i = 0; i < samples; i++) { const f = i / Math.max(1, samples - 1) - 0.5; x.globalAlpha = 1 / (i + 1); x.drawImage(img, dx * f, dy * f); } img = o; }
  if (spec.blur) img = blurCanvas(film, img, rDev);
  if (spec.chroma) chroma(img, spec.chroma);
  if (spec.displace) displace(img, { t, ...spec.displace });
  if (spec.mask) { const mk = pl.get(W, H), x = mk.getContext('2d'); x.setTransform(m.a, m.b, m.c, m.d, m.e, m.f); spec.mask(x); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-in'; x.drawImage(img, 0, 0); img = mk; }
  mainCtx.save(); mainCtx.setTransform(1, 0, 0, 1, 0, 0); mainCtx.globalAlpha = spec.opacity ?? 1; if (spec.blend) mainCtx.globalCompositeOperation = spec.blend;
  if (spec.warp) meshWarp(mainCtx, img, spec.warp, spec.grid ?? 24); else mainCtx.drawImage(img, 0, 0);
  mainCtx.restore();
  if (spec.bloom) bloom(film, mainCtx, img, spec.bloom);
}

export const blurCanvas = span('fx.blur', blurCanvas_);
export const bloom = span('fx.bloom', bloom_);
export const chroma = span('fx.chroma', chroma_);
export const displace = span('fx.displace', displace_);
export const meshWarp = span('fx.warp', meshWarp_);
export const colorGrade = span('grade.color', colorGrade_);
export const layer = span('fx.layer', layer_);