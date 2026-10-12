// materia.mjs: materiales procedurales sobre node-canvas. Cada uno se cachea por clave+resolucion; todo con semilla.
import { createCanvas } from 'canvas';
import { rng, gauss, fbm, valor, lerp, clamp, smoothstep, hexRgb, rgba, mezclar, oscurecer, aclarar } from './base.mjs';

const C = new Map(), S = new Map();
/** limpiarCache(): vacia las texturas cacheadas (usar solo en tests). */
export const limpiarCache = () => { C.clear(); S.clear(); };
const cached = (key, W, H, fn) => { let c = C.get(key); if (!c) { if (C.size > 48) C.clear(); c = createCanvas(Math.max(1, Math.ceil(W)), Math.max(1, Math.ceil(H))); fn(c.getContext('2d'), c); C.set(key, c); } return c; };
const scratch = (k, w, h) => { const id = `${k}|${w}|${h}`; if (!S.has(id)) S.set(id, createCanvas(w, h)); return S.get(id); };
const trazar = (g, pts) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
const bbox = (pts) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }; };
const campo = (w, h, fn) => { const c = scratch('campo', w, h), g = c.getContext('2d'), im = g.createImageData(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4, p = fn(x, y); im.data[o] = p[0]; im.data[o + 1] = p[1]; im.data[o + 2] = p[2]; im.data[o + 3] = p[3]; } g.putImageData(im, 0, 0); return c; };

/** papel(ctx,W,H,{tono,fibra,seed}): papel con fbm a 1/8 en multiply, fibras finas y viñeta suave. */
export function papel(ctx, W, H, { tono = '#eee4cf', fibra = 400, seed = 1 } = {}) {
  const c = cached(`papel|${W}|${H}|${tono}|${fibra}|${seed}`, W, H, (g) => {
    g.fillStyle = tono; g.fillRect(0, 0, W, H);
    const w = Math.ceil(W / 8), h = Math.ceil(H / 8), a = hexRgb(oscurecer(tono, 0.3)), b = hexRgb(aclarar(tono, 0.1));
    const lo = campo(w, h, (x, y) => { const n = fbm(x * 0.07, y * 0.07, seed, 4); return [lerp(a[0], b[0], n), lerp(a[1], b[1], n), lerp(a[2], b[2], n), 255]; });
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.25; g.drawImage(lo, 0, 0, W, H);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    const r = rng(seed * 31 + 7), s = W / 1920; g.lineCap = 'round';
    for (let i = 0; i < fibra; i++) {
      const x = r() * W, y = r() * H, L = (10 + r() * 30) * s, an = r() * 6.283, cx = x + Math.cos(an) * L / 2 + gauss(r) * 4 * s, cy = y + Math.sin(an) * L / 2 + gauss(r) * 4 * s;
      g.strokeStyle = i % 4 ? 'rgba(70,50,30,0.04)' : 'rgba(255,255,255,0.06)'; g.lineWidth = (0.5 + r()) * s;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(cx, cy, x + Math.cos(an) * L, y + Math.sin(an) * L); g.stroke();
    }
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, Math.hypot(W, H) * 0.55);
    v.addColorStop(0, 'rgba(60,40,20,0)'); v.addColorStop(1, 'rgba(60,40,20,0.14)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  });
  ctx.drawImage(c, 0, 0);
}

/** deformar(pts,niveles,amp,r): subdivide cada arista y desplaza su punto medio con ruido gaussiano. */
export function deformar(pts, niveles, amp, r) {
  for (let l = 0; l < niveles; l++) {
    const out = [];
    pts.forEach((a, i) => { const b = pts[(i + 1) % pts.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]); out.push(a, [(a[0] + b[0]) / 2 + gauss(r) * d * amp, (a[1] + b[1]) / 2 + gauss(r) * d * amp]); });
    pts = out; amp *= 0.8;
  }
  return pts;
}

/** acuarela(ctx,poligono,{color,capas,seed}): lavado con 25-40 capas deformadas, borde oscuro y granulacion. */
export function acuarela(ctx, poly, { color = '#3f7f9a', capas = 32, seed = 5 } = {}) {
  const B = bbox(poly), m = Math.max(B.w, B.h) * 0.15 + 8, key = `acua|${poly.map((p) => p.map(Math.round)).join()}|${color}|${capas}|${seed}`;
  const c = cached(key, B.w + 2 * m, B.h + 2 * m, (g) => {
    const r = rng(seed), s = Math.max(B.w, B.h) / 400;
    g.translate(m - B.x, m - B.y);
    const base = deformar(poly, 5, 0.16, r);
    for (let i = 0; i < capas; i++) {
      g.fillStyle = rgba(mezclar(color, r() < 0.5 ? '#000000' : '#ffffff', r() * 0.12), 0.02 + r() * 0.03);
      trazar(g, deformar(base, 2, 0.07, r)); g.fill();
    }
    g.strokeStyle = rgba(oscurecer(color, 0.45), 0.1); g.lineWidth = 1.5 * Math.max(s, 0.5);
    for (let i = 0; i < 3; i++) { trazar(g, deformar(base, 1, 0.05, r)); g.stroke(); }
    g.save(); trazar(g, base); g.clip();
    const n = Math.min(7000, Math.floor(B.w * B.h / 25));
    for (let k = 0; k < n; k++) { const x = B.x + r() * B.w, y = B.y + r() * B.h, d = (0.5 + r()) * Math.max(s, 0.6); g.globalCompositeOperation = k % 3 ? 'destination-out' : 'source-over'; g.fillStyle = k % 3 ? `rgba(0,0,0,${0.06 + r() * 0.12})` : rgba(oscurecer(color, 0.5), 0.05 + r() * 0.06); g.fillRect(x, y, d, d); }
    g.restore();
  });
  ctx.drawImage(c, B.x - m, B.y - m);
}

/** agua(ctx,W,H,t,{arriba,abajo,particulas,causticas}): degradado, 2 nieblas fbm en parallax, particulas y caústicas. */
export function agua(ctx, W, H, t, { arriba = '#6fb0b4', abajo = '#0d3545', particulas = 70, causticas = true, seed = 3 } = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, arriba); g.addColorStop(1, abajo); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const w = Math.ceil(W / 8), h = Math.ceil(H / 8), s = W / 1920, bruma = scratch('bruma', w, h), bg = bruma.getContext('2d'); bg.clearRect(0, 0, w, h);
  [[0.05, 0.05, aclarar(arriba, 0.3)], [0.13, 0.09, oscurecer(abajo, 0.2)]].forEach(([vel, esc, col], k) => {
    const [r0, g0, b0] = hexRgb(col);
    bg.drawImage(campo(w, h, (x, y) => [r0, g0, b0, 255 * 0.55 * smoothstep(0.42, 0.78, fbm(x * esc + t * vel * 6, y * esc, seed + k * 9, 3))]), 0, 0);
  });
  const medio = scratch('medio', W >> 1, H >> 1), mg = medio.getContext('2d'); mg.clearRect(0, 0, W >> 1, H >> 1); mg.patternQuality = 'bilinear'; mg.drawImage(bruma, 0, 0, W >> 1, H >> 1);
  ctx.save(); ctx.patternQuality = 'fast'; ctx.globalAlpha = 0.5; ctx.drawImage(medio, 0, 0, W, H); ctx.restore();
  ctx.globalAlpha = 1; const r = rng(seed + 100), tam = [1.2, 2.5, 4.5], vel = [5, 11, 22];
  for (let i = 0; i < particulas; i++) {
    const k = i % 3, x0 = r() * W, y0 = r() * H, a = 0.12 + r() * 0.22, x = (((x0 + t * vel[k] * s * 0.6 + Math.sin(t * 0.6 + i) * 8 * s) % W) + W) % W, y = (((y0 - t * vel[k] * s) % H) + H) % H;
    ctx.fillStyle = `rgba(235,250,245,${a})`; ctx.beginPath(); ctx.arc(x, y, tam[k] * s, 0, 6.283); ctx.fill();
  }
  if (causticas) {
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineWidth = 1.3 * s;
    for (let i = 0; i < 16; i++) {
      const y0 = (i / 16) * H * 0.35, a = 0.1 * (1 - y0 / (H * 0.35)); ctx.strokeStyle = `rgba(255,255,225,${a})`; ctx.beginPath();
      for (let x = 0; x <= W; x += 14) { const y = y0 + 9 * s * (Math.sin(x * 0.011 + t * 0.9 + i) + Math.sin(x * 0.023 - t * 1.3 + i * 2) + 0.6 * Math.sin(x * 0.047 + t * 2.1 - i)); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** vidrio(ctx,puntos,{tinte,alfa,refraccion}): cuerpo semitransparente, brillo vertical, fondo desplazado y borde de grosor variable. */
export function vidrio(ctx, pts, { tinte = '#9fd4cc', alfa = 0.45, refraccion = 3, seed = 2 } = {}) {
  const B = bbox(pts), m = ctx.getTransform?.();
  ctx.save(); trazar(ctx, pts); ctx.clip();
  if (refraccion && m && !m.b && !m.c) {
    const cw = ctx.canvas.width, ch = ctx.canvas.height, sx = clamp(Math.floor(m.a * B.x + m.e), 0, cw - 1), sy = clamp(Math.floor(m.d * B.y + m.f), 0, ch - 1), sw = Math.min(Math.ceil(m.a * B.w) + 1, cw - sx), sh = Math.min(Math.ceil(m.d * B.h) + 1, ch - sy);
    if (sw > 0 && sh > 0) { const t = scratch('vid', sw, sh), tg = t.getContext('2d'); tg.clearRect(0, 0, sw, sh); tg.drawImage(ctx.canvas, sx, sy, sw, sh, 0, 0, sw, sh); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.6; ctx.drawImage(t, sx + refraccion * m.a, sy - refraccion * 0.5 * m.a); ctx.restore(); }
  }
  const g = ctx.createLinearGradient(B.x, 0, B.x + B.w, 0), osc = oscurecer(tinte, 0.55);
  g.addColorStop(0, rgba(osc, alfa + 0.2)); g.addColorStop(0.18, rgba(tinte, alfa * 0.8)); g.addColorStop(0.5, rgba(aclarar(tinte, 0.1), alfa * 0.6)); g.addColorStop(0.82, rgba(tinte, alfa * 0.8)); g.addColorStop(1, rgba(osc, alfa + 0.2));
  ctx.fillStyle = g; ctx.fillRect(B.x, B.y, B.w, B.h);
  for (const [fx, fw, fa] of [[0.2, 0.06, 0.55], [0.8, 0.025, 0.2]]) {
    const v = ctx.createLinearGradient(0, B.y, 0, B.y + B.h); v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(0.15, `rgba(255,255,255,${fa})`); v.addColorStop(0.85, `rgba(255,255,255,${fa})`); v.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = v; ctx.fillRect(B.x + B.w * fx, B.y, B.w * fw, B.h);
  }
  ctx.restore(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  pts.forEach((a, i) => { const b = pts[(i + 1) % pts.length]; ctx.strokeStyle = aclarar(tinte, 0.55); ctx.lineWidth = 1 + 2.2 * valor(i * 0.05, 0, seed); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); });
}

/** tinta(ctx,x,y,r,lt,seed): mancha de tinta que se corre; radio r*(1-e^(-2.2 lt)), borde por ruido y halo claro. */
export function tinta(ctx, x, y, r, lt, seed = 1, color = '#17222e') {
  const R = r * (1 - Math.exp(-2.2 * lt)); if (R < 1) return;
  const forma = (k) => Array.from({ length: 72 }, (_, i) => { const a = i / 72 * 6.283, q = R * k * (0.78 + 0.5 * fbm(Math.cos(a) * 1.6 + seed, Math.sin(a) * 1.6, seed, 3)); return [x + Math.cos(a) * q, y + Math.sin(a) * q]; });
  for (const k of [1.3, 1.18, 1.08]) { ctx.fillStyle = 'rgba(255,250,240,0.1)'; trazar(ctx, forma(k)); ctx.fill(); }
  const g = ctx.createRadialGradient(x, y, 0, x, y, R * 1.1); g.addColorStop(0, rgba(color, 0.9)); g.addColorStop(1, rgba(color, 0.45));
  ctx.fillStyle = g; trazar(ctx, forma(1)); ctx.fill(); ctx.strokeStyle = rgba(color, 0.5); ctx.lineWidth = Math.max(1, R * 0.015); ctx.stroke();
  const rr = rng(seed + 3); ctx.fillStyle = rgba(color, 0.75);
  for (let i = 0; i < 6; i++) { const a = rr() * 6.283, L = R * (0.25 + rr() * 0.45) * smoothstep(0.2, 1, lt), w = (rr() - 0.5) * 0.7; for (let k = 0; k <= 8; k++) { const q = k / 8, an = a + w * q, d = R * 0.9 + L * q; ctx.beginPath(); ctx.arc(x + Math.cos(an) * d, y + Math.sin(an) * d, Math.max(0.8, R * 0.055 * (1 - q)), 0, 6.283); ctx.fill(); } }
}

/** metal(ctx,x,y,r,{tono,desgaste,estrias,seed}): disco metalico, degradado radial anisotropo, relieve +-1px, canto estriado y desgaste. */
export function metal(ctx, x, y, r, { tono = '#b99a5b', desgaste = 0.5, estrias = true, seed = 7 } = {}) {
  const N = Math.ceil(2 * r + 8), c = cached(`metal|${Math.round(r)}|${tono}|${desgaste}|${estrias}|${seed}`, N, N, (g) => {
    const o = N / 2, rr = rng(seed); g.translate(o, o);
    g.save(); g.beginPath(); g.arc(0, 0, r, 0, 6.283); g.clip(); g.save(); g.scale(1, 0.8);
    const b = g.createRadialGradient(-0.3 * r, -0.4 * r, r * 0.1, 0, 0, r * 1.2);
    b.addColorStop(0, aclarar(tono, 0.55)); b.addColorStop(0.4, tono); b.addColorStop(1, oscurecer(tono, 0.5)); g.fillStyle = b; g.fillRect(-r * 2, -r * 2, r * 4, r * 4); g.restore();
    for (let i = 0; i < r * 1.5; i++) { g.fillStyle = rr() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; g.fillRect(-r, (rr() * 2 - 1) * r, 2 * r, 1); }
    if (estrias) { g.lineWidth = 1; for (let i = 0; i < 100; i++) { const a = i / 100 * 6.283; g.strokeStyle = i % 2 ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.15)'; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); g.stroke(); } }
    for (const k of [0.8, 0.45]) for (const [dx, col] of [[-1, 'rgba(255,255,255,0.5)'], [1, 'rgba(0,0,0,0.4)']]) { g.strokeStyle = col; g.lineWidth = 1.2; g.beginPath(); g.arc(dx, dx, r * k, 0, 6.283); g.stroke(); }
    const w = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.7); w.addColorStop(0, rgba(tono, desgaste * 0.55)); w.addColorStop(1, rgba(tono, 0)); g.fillStyle = w; g.fillRect(-r, -r, 2 * r, 2 * r);
    g.restore(); g.strokeStyle = rgba(oscurecer(tono, 0.6), 0.8); g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, r - 0.5, 0, 6.283); g.stroke();
  });
  ctx.drawImage(c, x - N / 2, y - N / 2);
}

/** grano(ctx,W,H,frameIndex,alfa): grano de pelicula a 1/2 resolucion (puntos claros/oscuros con alfa), semilla = fotograma, con parpadeo de +-1.5%. */
export function grano(ctx, W, H, fi, alfa = 0.055) {
  const w = Math.ceil(W / 2), h = Math.ceil(H / 2), r = rng(fi * 7919 + 13), c = scratch('grano', w, h), g = c.getContext('2d'), im = g.createImageData(w, h), u = new Uint32Array(im.data.buffer), k = alfa * 255 * 2.4;
  for (let i = 0; i < u.length; i++) { const n = r() + r() + r() - 1.5, a = Math.min(255, Math.abs(n) * k) | 0; u[i] = (a << 24 | (n > 0 ? 0xffffff : 0)) >>> 0; }
  g.putImageData(im, 0, 0); ctx.save(); ctx.patternQuality = 'fast'; ctx.drawImage(c, 0, 0, W, H);
  const e = (r() - 0.5) * 0.03; ctx.fillStyle = e > 0 ? `rgba(255,255,255,${e})` : `rgba(0,0,0,${-e})`; ctx.fillRect(0, 0, W, H); ctx.restore();
}

/** vineta(ctx,W,H,fuerza): oscurecimiento radial de bordes (cacheado). */
export function vineta(ctx, W, H, fuerza = 0.4) {
  ctx.drawImage(cached(`vin|${W}|${H}|${fuerza}`, W, H, (g) => { const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.58); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${fuerza})`); g.fillStyle = v; g.fillRect(0, 0, W, H); }), 0, 0);
}
