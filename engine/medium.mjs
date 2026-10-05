// MEDIO (spec 003): la superficie y la materia de todo el film. Soporte (papel con fibras y manchas), tinta (grano riso,
// erosión, desregistro, jitter de trazo), grano animado, viñeta, paleta cerrada, capas de parallax y reglas de composición.
//   · Datos: styles/medios/<nombre>.json; el film lo elige con `"medium"` en el timeline. Sin medio: seek no entra aquí.
//   · Puro y determinista: toda textura sale de rng(seed) y se PRECALCULA UNA VEZ por (medio, seed, tamaño) — nunca por fotograma.
//     Por fotograma solo hay drawImage/patrones desplazados (grano = N teselas con desplazamiento aleatorio por índice de fotograma).
//   · Los shots no cambian: dibujan con la paleta del medio (api.color) en una capa de tinta transparente; seek la compone con
//     multiply sobre el papel (así la tinta "es" del papel: erosión, doble pasada desregistrada y temblor de trazo).
//   · Utilidad pura para shots: paperTone. (docs/MEDIOS.md)
import { rng, clamp, lerp, noise1 } from './core.mjs';
import { hex2rgb } from './color.mjs';
import { applyCam } from './camera.mjs';

export const mediumStats = { builds: 0 };
const PAD = 1.35;                                                         // las capas de parallax se dibujan 35 % más grandes que el cuadro

// Sobrescrituras de estilo que implica el medio (paleta, post, reglas, composición). El timeline manda sobre ellas.
export const mediumOverrides = (m) => ({ palette: m.palette, grade: m.grade, rules: m.rules, compose: m.composition });

// ───────── campos de ruido ─────────
function field(w, h, cell, r) {                                           // ruido de valor bilineal [0,1], malla `cell` px
  const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2, g = new Float32Array(gw * gh), out = new Float32Array(w * h);
  for (let i = 0; i < g.length; i++) g[i] = r();
  for (let y = 0; y < h; y++) {
    const fy = y / cell, y0 = Math.floor(fy), v = fy - y0, sv = v * v * (3 - 2 * v);
    for (let x = 0; x < w; x++) {
      const fx = x / cell, x0 = Math.floor(fx), u = fx - x0, su = u * u * (3 - 2 * u), i = y0 * gw + x0;
      out[y * w + x] = lerp(lerp(g[i], g[i + 1], su), lerp(g[i + gw], g[i + gw + 1], su), sv);
    }
  }
  return out;
}
const rgbOf = (c) => hex2rgb(c);
const rr = (r, [a, b]) => a + (b - a) * r();

// ───────── soporte: tono + mottle + diente + microfibras (estático) ─────────
function buildSupport(film, M, W, H, r, mk) {
  const cv = mk(W, H), x = cv.getContext('2d'), S = M.support, k = W / 1280, im = x.createImageData(W, H), d = im.data;
  const base = rgbOf(S.base), warm = rgbOf(S.mottle.warm), cool = rgbOf(S.mottle.cool);
  const f1 = field(W, H, Math.max(8, S.mottle.cell * k), r), f2 = field(W, H, Math.max(4, S.mottle.cell * k * 0.3), r);
  for (let i = 0, p = 0; i < W * H; i++, p += 4) {
    const n = (f1[i] * 0.7 + f2[i] * 0.3), t = n - 0.5, a = S.mottle.amount * 2, tooth = 1 + (r() - 0.5) * S.tooth * 2;
    for (let c = 0; c < 3; c++) {
      const mixc = t > 0 ? lerp(base[c], warm[c], clamp(t * 2.4)) : lerp(base[c], cool[c], clamp(-t * 2.4));
      d[p + c] = clamp((mixc * (1 + (n - 0.5) * a) * tooth) / 255) * 255;
    }
    d[p + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  fibers(x, r, S.fibers, W, H, k);
  return cv;
}
// Fibras: arcos cortos y finos, algunas claras (sobre el papel) y otras oscuras.
function fibers(x, r, F, W, H, k, over = 0) {
  x.save(); x.lineCap = 'round';
  for (let i = 0; i < F.n; i++) {
    const px = r() * W, py = r() * H, len = rr(r, F.len) * k, ang = r() * Math.PI, bend = (r() - 0.5) * 1.4, light = !over && F.light && r() < 0.3;
    x.strokeStyle = light ? F.light : F.color; x.globalAlpha = rr(r, F.alpha); x.lineWidth = (F.width ?? 0.8) * k * (0.6 + r() * 0.8);
    x.beginPath(); x.moveTo(px, py);
    x.quadraticCurveTo(px + Math.cos(ang + bend) * len * 0.5, py + Math.sin(ang + bend) * len * 0.5, px + Math.cos(ang) * len, py + Math.sin(ang) * len); x.stroke();
  }
  x.restore();
}
function specks(x, r, P, W, H, k) {
  x.save(); x.fillStyle = P.color;
  for (let i = 0; i < P.n; i++) { x.globalAlpha = rr(r, P.alpha); x.beginPath(); x.arc(r() * W, r() * H, rr(r, P.r) * k, 0, 6.2832); x.fill(); }
  x.restore();
}
function stains(x, r, T, W, H, k) {                                       // mancha de té: relleno suave + borde más oscuro (anillo de café)
  for (let i = 0; i < T.n; i++) {
    const cx = r() * W, cy = r() * H, R = rr(r, T.r) * k, sx = 0.7 + r() * 0.6, [R0, G0, B0] = rgbOf(T.color);
    x.save(); x.translate(cx, cy); x.scale(sx, 1); x.rotate(r() * 3);
    const g = x.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
    g.addColorStop(0, `rgba(${R0},${G0},${B0},${T.alpha * 0.55})`); g.addColorStop(0.78, `rgba(${R0},${G0},${B0},${T.alpha * 0.8})`);
    g.addColorStop(0.93, `rgba(${R0 * 0.7 | 0},${G0 * 0.7 | 0},${B0 * 0.7 | 0},${T.alpha * (1 + T.ring)})`); g.addColorStop(1, `rgba(${R0},${G0},${B0},0)`);
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, R, 0, 6.2832); x.fill(); x.restore();
  }
}
function hatch(x, r, Hc, W, H, k) {                                       // parches de rayado a lápiz: líneas paralelas con deriva y longitud irregular
  x.save(); x.strokeStyle = Hc.color; x.lineCap = 'round';
  for (let p = 0; p < Hc.patches; p++) {
    const cx = r() * W, cy = r() * H, sz = rr(r, Hc.size) * k, ang = -0.6 + (r() - 0.5) * 0.5, gap = Hc.gap * k, ca = Math.cos(ang), sa = Math.sin(ang);
    for (let o = -sz; o < sz; o += gap * (0.8 + r() * 0.5)) {
      const l = sz * (0.5 + 0.5 * Math.cos((o / sz) * 1.4)) * (0.7 + r() * 0.3), ox = -sa * o, oy = ca * o;
      x.globalAlpha = Hc.alpha * (0.5 + r() * 0.8); x.lineWidth = (0.7 + r() * 0.6) * k;
      x.beginPath(); x.moveTo(cx + ox - ca * l, cy + oy - sa * l); x.lineTo(cx + ox + ca * l + (r() - 0.5) * 3, cy + oy + sa * l + (r() - 0.5) * 3); x.stroke();
    }
  }
  x.restore();
}
function buildLayer(L, W, H, r, mk) {
  const PW = Math.round(W * PAD), PH = Math.round(H * PAD), cv = mk(PW, PH), x = cv.getContext('2d'), k = W / 1280;
  if (L.stains) stains(x, r, L.stains, PW, PH, k);
  if (L.hatch) hatch(x, r, L.hatch, PW, PH, k);
  if (L.fibers) fibers(x, r, L.fibers, PW, PH, k, 1);
  if (L.specks) specks(x, r, L.specks, PW, PH, k);
  return { cv, PW, PH };
}

// ───────── tinta: máscara de erosión (agujeritos de grano riso, agrupados) y teselas de grano ─────────
function buildErosion(M, W, H, r, mk) {
  const E = M.ink.erosion, w = W + 64, h = H + 64, cv = mk(w, h), x = cv.getContext('2d'), im = x.createImageData(w, h), d = im.data, k = W / 1280;
  const c1 = field(w, h, Math.max(3, E.cell * k), r);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    const cl = clamp((c1[i] - 0.38) * 2.6), a = r() < 0.18 + cl * 0.55 ? (0.35 + r() * 0.65) * clamp(0.3 + cl) : 0;   // sal: más densa donde el campo grueso es alto
    d[p] = d[p + 1] = d[p + 2] = 0; d[p + 3] = a * E.amount * 255;
  }
  x.putImageData(im, 0, 0); return cv;
}
function buildGrain(M, W, H, r, mk) {
  const G = M.grain, w = W + 48, h = H + 48, tiles = [];
  for (let n = 0; n < G.tiles; n++) {
    const cv = mk(w, h), x = cv.getContext('2d'), im = x.createImageData(w, h), d = im.data;
    for (let p = 0; p < d.length; p += 4) { const v = 255 * (1 - G.amount * r() * 1.8); d[p] = d[p + 1] = d[p + 2] = v; d[p + 3] = 255; }   // multiply: oscurece en motas (media ≈ 1 − 0,9·amount)
    x.putImageData(im, 0, 0); tiles.push(cv);
  }
  return tiles;
}

// ───────── estado por (medio, seed, tamaño) ─────────
export function mediumState(film, cv) {
  const M = film.medium; if (!M || !film.canvas) return null;
  const W = cv.width, H = cv.height, key = `${M.name}:${M.seed}:${W}x${H}`;
  film._mx ??= new Map(); let st = film._mx.get(key); if (st) return st;
  if (film._mx.size > 6) film._mx.clear();
  const r = rng(M.seed ?? 1), mk = (w, h) => film.canvas(w, h);
  st = { W, H, support: buildSupport(film, M, W, H, r, mk), layers: M.layers.map((L) => ({ L, ...buildLayer(L, W, H, r, mk) })), erosion: buildErosion(M, W, H, r, mk), grain: buildGrain(M, W, H, r, mk), ink: mk(W, H), tmp: mk(W, H) };
  st.vig = null; mediumStats.builds++; film._mx.set(key, st); return st;
}

// Desplazamiento de cada capa para una cámara dada (misma ley que applyCam con profundidad = depth): lo usan seek y los tests.
export const layerOffsets = (M, cam, W, H) => M.layers.map((L) => {
  const z = 1 + (cam.z - 1) * L.depth; return { name: L.name, depth: L.depth, over: !!L.over, s: z, dx: cam.x * L.depth, dy: cam.y * L.depth };
});

function drawLayer(out, B, st, l, cam, film) {
  out.save(); out.setTransform(B.a, B.b, B.c, B.d, B.e, B.f);
  applyCam(out, cam, film.width, film.height, l.L.depth);
  const sx = B.a, ox = -((PAD - 1) / 2) * film.width, oy = -((PAD - 1) / 2) * film.height;
  out.drawImage(l.cv, ox, oy, l.PW / sx, l.PH / sx); out.restore();
}
// Fondo: soporte + capas de parallax por detrás (multiply). `cam` = cámara del shot activo.
export function paintBackdrop(out, film, st, cam, B) {
  out.save(); out.setTransform(1, 0, 0, 1, 0, 0); out.globalCompositeOperation = 'source-over'; out.drawImage(st.support, 0, 0); out.restore();
  out.save(); out.globalCompositeOperation = 'multiply';
  for (const l of st.layers) if (!l.L.over) drawLayer(out, B, st, l, cam, film);
  out.restore();
}
// Tinta: erosiona la capa (destination-out con la máscara desplazada), la pasa con temblor por bandas y la compone con multiply,
// más una pasada fantasma desplazada (desregistro). Luego capas en primer plano (polvo, parallax > 1).
export function compositeInk(out, film, st, cam, t, B, animated = true) {   // animated=false (mediciones sin grade): erosión fija y sin temblor → la energía de movimiento mide solo la animación del film
  const M = film.medium, I = M.ink, lc = st.ink.getContext('2d'), W = st.W, H = st.H, k = W / 1280;
  if (I.erosion) {
    const i = animated ? Math.floor(t * I.erosion.fps) : 0, r = rng(i * 7919 + 13), ox = Math.floor(r() * 64), oy = Math.floor(r() * 64);
    lc.save(); lc.setTransform(1, 0, 0, 1, 0, 0); lc.globalCompositeOperation = 'destination-out'; lc.drawImage(st.erosion, -ox, -oy); lc.restore();
  }
  const mis = I.misregister;
  out.save(); out.setTransform(1, 0, 0, 1, 0, 0); out.globalCompositeOperation = 'multiply';
  if (mis && animated) { out.globalAlpha = mis.alpha; out.drawImage(st.ink, mis.dx * k, mis.dy * k); }
  out.globalAlpha = I.alpha ?? 1;
  if (I.jitter && animated) {
    const J = I.jitter, band = Math.max(1, Math.round(J.band * k)), f = Math.floor(t * J.fps), amp = J.amp * k;
    for (let y = 0; y < H; y += band) { const dx = amp * (noise1(y / (band * 9), f * 31 + 5) * 1.2 + (noise1(y / 2 + f, 77) * 0.4)); out.drawImage(st.ink, 0, y, W, Math.min(band, H - y), dx, y, W, Math.min(band, H - y)); }
  } else out.drawImage(st.ink, 0, 0);
  out.restore();
  out.save(); out.globalCompositeOperation = 'multiply';
  for (const l of st.layers) if (l.L.over) drawLayer(out, B, st, l, cam, film);
  out.restore();
}
// Post del medio (solo con grade): grano animado + viñeta cálida. Determinista por fotograma.
export function postMedium(out, film, st, t) {
  const M = film.medium, G = M.grain, W = st.W, H = st.H;
  out.save(); out.setTransform(1, 0, 0, 1, 0, 0);
  if (G && G.amount > 0) { const i = Math.floor(t * G.fps), r = rng(i * 104729 + 31); out.globalCompositeOperation = 'multiply'; out.drawImage(st.grain[i % st.grain.length], -Math.floor(r() * 48), -Math.floor(r() * 48)); }
  const v = M.vignette;
  if (v && v.amount > 0) {
    const [R, Gc, Bc] = rgbOf(v.color), g = out.createRadialGradient(W / 2, H / 2, Math.min(W, H) * v.inner, W / 2, H / 2, Math.hypot(W, H) * 0.56);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, `rgb(${Math.round(lerp(255, R, v.amount * 2.2))},${Math.round(lerp(255, Gc, v.amount * 2.2))},${Math.round(lerp(255, Bc, v.amount * 2.2))})`);
    out.globalCompositeOperation = 'multiply'; out.fillStyle = g; out.fillRect(0, 0, W, H);
  }
  out.restore();
}
// Preparar la capa de tinta para un fotograma: transparente, con la transformación base del seek.
export function beginInk(st, B) { const c = st.ink.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, st.W, st.H); c.setTransform(B.a, B.b, B.c, B.d, B.e, B.f); return c; }

// ───────── utilidades puras para shots ─────────
// Tono de papel (0..1) en (x,y) a partir de ruido de valor determinista: para dibujar «luz» o sombra coherente con el soporte.
export const paperTone = (x, y, seed = 1) => 0.5 + 0.5 * noise1(x * 0.004 + y * 0.0031, seed);
