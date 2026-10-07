// Métrica fondo.profundidad (spec 012 P6) — PURA: recibe fotogramas (RGBA o luma) + cajas; no toca el motor ni el disco.
// Mide cuánto "hay" en el fondo (estrellas, niebla, viñeta, textura de soporte, parallax, parpadeo) para distinguir el
// negro ELEGIDO por el tema (con profundidad) del negro VACÍO (relleno por defecto). Definición y umbrales: registry.mjs
// ('fondo.profundidad') y docs/handoff/fondo.md.
//
//   Y'(x) = 100·(0,2126 R + 0,7152 G + 0,0722 B)/255            luma sRGB codificada, % de escala completa
//   fondo = píxeles fuera de las cajas {kind: focus|text} ensanchadas un margen (4 % del lado menor)
//   σ_esp  = RMS del residuo de Y' respecto a la media de su bloque (ancho/6 px): estrellas, grano, niebla fina
//   σ_grad = desviación típica de las medias de bloque (rejilla 6×3) respecto a la media global del fondo (viñeta, degradado, luz)
//   τ      = media de |Y'(t) − Y'(t−Δ)| sobre el fondo común de dos fotogramas consecutivos (parallax, parpadeo, deriva)
//   P      = σ_esp + σ_grad + τ     [% de escala completa; 0 = fondo plano y quieto]
// Ventana: mediana de σ_esp, σ_grad, τ y luminancia sobre los fotogramas de la ventana (robusta a un destello o corte aislado).
export const FONDO = {
  tgrid: 48,              // τ se mide en bloques de ancho/48 (promedia el grano de píxel)
  grid: 6,                // bloques por ancho: la banda gruesa (viñeta/degradado) = rejilla de 6×(≈3) bloques, sea cual sea la resolución
  margin: 0.04,           // ensanche de las cajas (fracción del lado menor)
  minBg: 0.08,            // fracción mínima de fondo visible para medir; por debajo la ventana es 'sin dato' (cuenta como con profundidad)
  fps: 4,                 // muestreo del check (fotogramas/s) a 384 px, con gradación (lo que ve el espectador)
  size: 384,
  windowS: 2,             // s por ventana
  dark: 18,               // Y' mediana del fondo ≤ 18 % ⇒ fondo oscuro (el negro de un cosmos ronda 2–10 %; el de pizarra/neón ~10–20 %)
  empty: 1.0,             // P < 1,0 % ⇒ sin profundidad. Calibrado: negro vacío (Mate v1) 0,7–0,9 en el 90 % de sus ventanas; Potencias v2 oscuro 0,9–5 (estrellas, galaxia, globo)
  warnFrac: 0.3,          // WARN si ≥ 30 % de la duración medida es fondo oscuro vacío (los tramos de calma sueltos son dramaturgia, no defecto)
  fixFrac: 0.6,           // FIX si ≥ 60 %: el film ES negro vacío
};

const lumaOf = (d, n) => { const y = new Float32Array(n); for (let i = 0; i < n; i++) y[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) * (100 / 255); return y; };
const toLuma = (f) => f.y ?? (f.luma ? Float32Array.from(f.luma, (v) => v * (100 / 255)) : lumaOf(f.data, f.W * f.H));   // f.luma: Uint8 0–255 · f.y: ya en %

export function bgMask(W, H, boxes = [], margin = FONDO.margin) {
  const m = new Uint8Array(W * H).fill(1), pad = margin * Math.min(W, H);
  for (const b of boxes ?? []) {
    if (b.kind !== 'focus' && b.kind !== 'text') continue;
    const x0 = Math.max(0, Math.floor(b.x - pad)), x1 = Math.min(W, Math.ceil(b.x + b.w + pad)), y0 = Math.max(0, Math.floor(b.y - pad)), y1 = Math.min(H, Math.ceil(b.y + b.h + pad));
    for (let y = y0; y < y1; y++) m.fill(0, y * W + x0, y * W + x1);
  }
  return m;
}
const median = (a) => { if (!a.length) return NaN; const s = [...a].sort((p, q) => p - q), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };

// Estructura espacial de una imagen de luma y + máscara de fondo → { bgFrac, lum, esp, grad }
export function structure(y, mask, W, H, { block } = {}) {
  block ??= Math.max(8, Math.round(W / FONDO.grid));
  let n = 0, s = 0; for (let i = 0; i < W * H; i++) if (mask[i]) { n++; s += y[i]; }
  const bgFrac = n / (W * H);
  if (bgFrac < FONDO.minBg) return { bgFrac, lum: NaN, esp: NaN, grad: NaN };
  let ss = 0, cnt = 0; const means = [], wts = [];
  for (let by = 0; by < H; by += block) for (let bx = 0; bx < W; bx += block) {
    let bs = 0, bn = 0; const x1 = Math.min(W, bx + block), y1 = Math.min(H, by + block);
    for (let yy = by; yy < y1; yy++) for (let xx = bx; xx < x1; xx++) { const i = yy * W + xx; if (mask[i]) { bs += y[i]; bn++; } }
    if (bn < 4) continue;
    const mu = bs / bn; means.push(mu); wts.push(bn);
    for (let yy = by; yy < y1; yy++) for (let xx = bx; xx < x1; xx++) { const i = yy * W + xx; if (mask[i]) { ss += (y[i] - mu) ** 2; cnt++; } }
  }
  const wsum = wts.reduce((a, b) => a + b, 0), mm = means.reduce((a, v, i) => a + v * wts[i], 0) / wsum;
  return { bgFrac, lum: s / n, esp: Math.sqrt(ss / Math.max(1, cnt)), grad: Math.sqrt(means.reduce((a, v, i) => a + wts[i] * (v - mm) ** 2, 0) / wsum) };
}
const prep = (f) => ({ W: f.W, H: f.H, y: toLuma(f), mask: f.mask ?? bgMask(f.W, f.H, f.boxes) });
// Cambio temporal entre dos fotogramas a escala de bloque (ancho/48 ≈ 8 px a 384): el grano (independiente por píxel) se promedia y
// no cuenta; sí cuentan parpadeo, deriva y parallax de masas. Media de |Δ media de bloque| sobre bloques de fondo común.
export function temporal(a, b, { block } = {}) {
  const { W, H } = a; block ??= Math.max(4, Math.round(W / FONDO.tgrid)); let s = 0, n = 0;
  for (let by = 0; by + block <= H; by += block) for (let bx = 0; bx + block <= W; bx += block) {
    let sa = 0, sb = 0, c = 0;
    for (let yy = by; yy < by + block; yy++) for (let xx = bx; xx < bx + block; xx++) { const i = yy * W + xx; if (a.mask[i] && b.mask[i]) { sa += a.y[i]; sb += b.y[i]; c++; } }
    if (c >= block * block * 0.75) { s += Math.abs(sa - sb) / c; n++; }
  }
  return n >= 4 ? s / n : NaN;
}
// Una ventana de fotogramas consecutivos (≥ 1) → { lum, esp, grad, tau, P, dark, empty }
// esp y grad se miden sobre la IMAGEN INTEGRADA de la ventana (media por píxel de los fotogramas, fondo = común a todos): el grano de la
// gradación cambia en cada fotograma y se atenúa ×1/√n; las estrellas, texturas y nieblas persisten.
export function windowStats(frames) {
  const F = frames.map(prep), { W, H } = F[0], N = W * H, mean = new Float32Array(N), mask = new Uint8Array(N).fill(1);
  for (const f of F) for (let i = 0; i < N; i++) { mean[i] += f.y[i] / F.length; if (!f.mask[i]) mask[i] = 0; }
  const st = structure(mean, mask, W, H);
  if (!Number.isFinite(st.lum)) return { lum: NaN, esp: NaN, grad: NaN, tau: NaN, P: NaN, dark: false, empty: false, nodata: true };
  const taus = []; for (let i = 1; i < F.length; i++) { const t = temporal(F[i - 1], F[i]); if (Number.isFinite(t)) taus.push(t); }
  const tau = taus.length ? median(taus) : 0, P = st.esp + st.grad + tau, dark = st.lum <= FONDO.dark;
  return { lum: st.lum, esp: st.esp, grad: st.grad, tau, P, dark, empty: dark && P < FONDO.empty, nodata: false };
}
// Serie completa: frames = [{t, W, H, data|luma|y, boxes}] ordenados, a ritmo regular. → ventanas + resumen del film
export function fondoSeries(frames, { fps, windowS = FONDO.windowS } = {}) {
  const per = Math.max(2, Math.round(windowS * fps)), wins = [];
  for (let i = 0; i < frames.length; i += per) {
    const fr = frames.slice(i, i + per); if (!fr.length) break;
    wins.push({ t0: fr[0].t, t1: fr[fr.length - 1].t + 1 / fps, ...windowStats(fr) });
  }
  const meas = wins.filter((w) => !w.nodata), dur = (w) => w.t1 - w.t0, T = meas.reduce((a, w) => a + dur(w), 0) || 1;
  const darkT = meas.filter((w) => w.dark).reduce((a, w) => a + dur(w), 0), emptyT = meas.filter((w) => w.empty).reduce((a, w) => a + dur(w), 0);
  const runs = []; let cur = null;
  for (const w of wins) { if (w.empty) { if (cur) cur.t1 = w.t1; else runs.push((cur = { t0: w.t0, t1: w.t1, P: w.P, lum: w.lum })); } else cur = null; }
  return { wins, runs, P: median(meas.map((w) => w.P)), darkFrac: darkT / T, emptyFrac: emptyT / T, emptyS: emptyT, measuredS: T };
}
// Veredicto del check fondo.vacio (spec 012 P6) sobre el resumen de fondoSeries: null = pasa · 'WARN' · 'FIX' (la mayor parte del film).
export const veredicto = (S) => (S.emptyFrac >= FONDO.fixFrac ? 'FIX' : S.emptyFrac >= FONDO.warnFrac ? 'WARN' : null);
