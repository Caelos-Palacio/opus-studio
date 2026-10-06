// «Potencias» — el mundo compartido por P01–P13 (no es un shot: lo importan los shots).
// La escala NO es cámara: es contenido. L(t) = log10 del lado (en metros) de la ventana que ocupa S0 px.
// Un punto del mundo (X, Y) en metros (Y hacia arriba, origen = centro de la persona) se proyecta a
//   x = cx + X·ppm,  y = cy − Y·ppm,  ppm = S0 / 10^L.
// Todo es función pura de t (los conjuntos de estrellas/galaxias son constantes sembradas).
import { clamp, lerp, hash2, noise1, TAU, seg } from '../engine/core.mjs';
import { rgba } from '../engine/color.mjs';
// api.tex no acepta alpha (pone globalAlpha=1 por dentro): para fundir TeX se pasa un color rgba.
export const inkA = (api, a, role = 'ink') => (a >= 0.999 ? role : rgba(api.color(role), clamp(a)));

// ───────── reloj de escala ─────────
export const TA = 9.5, RA = 2, T = 1.5, LMAX = Math.log10(8.8e26);   // 8,8×10^26 m = diámetro comóvil del universo observable
export const TE = TA + RA / 2 + LMAX * T;                             // ≈ 50,92 s: el borde
export const tk = (k) => TA + RA / 2 + k * T;                         // instante en que L = k (k ≥ 1): 10,5 + 1,5·k
export function Lof(t) {
  if (t <= TA) return 0;
  const s = t - TA;
  if (s < RA) return (s * s) / (2 * T * RA);                          // arranque: la velocidad sube de 0 a 1/T en RA s
  if (t < TE) return (s - RA / 2) / T;                                // ritmo constante: ×10 cada 1,5 s
  const u = t - TE, w = 7, z = 0.55, wd = w * Math.sqrt(1 - z * z);   // choque con el borde: velocidad continua, sobrepaso y asiento
  return LMAX + ((1 / T) / wd) * Math.exp(-z * w * u) * Math.sin(wd * u);
}

// ───────── geometría de pantalla (sin api: la usan también las entidades de relevo) ─────────
export function geo(film) {
  const W = film.width, H = film.height, P = film.P.safe, g = film.S.grade.letterbox, bar = g ? Math.max(0, (H - W / g) / 2) : 0;
  const sx0 = W * P.side, sx1 = W * (1 - P.side), sy0 = bar + H * P.top, sy1 = H - bar - H * P.bottom, sw = sx1 - sx0, sh = sy1 - sy0;
  const G = { W, H, cx: W / 2, cy: H / 2, S0: 0.34 * sh, sx0, sx1, sy0, sy1, sw, sh, k: Math.min(W, H) / 1080 };
  G.rx = (v) => sx0 + 0.1 * sw + (v / 27) * 0.8 * sw;                  // regla de exponentes (P11–P13)
  G.ry = sy0 + 0.69 * sh;
  G.dot = 7 * G.k * 1.5;                                               // diámetro de un punto de la regla
  return G;
}
export const proj = (G, L) => { const ppm = G.S0 / 10 ** L; return { ppm, P: (X, Y) => [G.cx + X * ppm, G.cy - Y * ppm] }; };

// ───────── datos del mundo (metros) ─────────
export const RE = 6.371e6, H0 = 0.85, AU = 1.495978707e11, LY = 9.4607e15;
const deg = Math.PI / 180;
export const SUN = [-AU * Math.cos(25 * deg), -AU * Math.sin(25 * deg)];            // la órbita terrestre pasa por el origen (tú)
export const MOON_R = 3.844e8, MOON_ANG = 40 * deg;
export const PLANETS = [['mercurio', 0.387], ['venus', 0.723], ['tierra', 1], ['marte', 1.524], ['júpiter', 5.203], ['saturno', 9.537], ['urano', 19.19], ['neptuno', 30.07]];
export const PROXIMA = [4.0e16 * Math.cos(172 * deg), 4.0e16 * Math.sin(172 * deg)];
export const GAL_C = [2.53e20 * Math.cos(58 * deg), 2.53e20 * Math.sin(58 * deg)];  // centro galáctico (8,2 kpc)
export const M31 = [2.4e22 * Math.cos(20 * deg), 2.4e22 * Math.sin(20 * deg)];
export const R_OBS = 4.4e26;

// silueta de persona: caja 0..100 de alto (≙ 1,7 m), centrada en x = 0
export const PERSON = 'M0 0 A7.5 7.5 0 1 1 0 15 A7.5 7.5 0 1 1 0 0 Z M-9 18 C-12 18 -14 20 -14 24 L-15.5 50 C-15.5 53.5 -11 53.5 -11 50 L-10 30 L-9 58 L-8.5 97 C-8.5 100.5 -2 100.5 -2 97 L-1 60 L1 60 L2 97 C2 100.5 8.5 100.5 8.5 97 L9 58 L10 30 L11 50 C11 53.5 15.5 53.5 15.5 50 L14 24 C14 20 12 18 9 18 Z';

// conjuntos sembrados (constantes: cero estado)
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const SKY = range(3, (L) => range(70, (i) => ({ x: (hash2(i + L * 97, 11) - 0.5) * 1.7, y: (hash2(i + L * 97, 12) - 0.5) * 1.7, r: 0.8 + 1.6 * hash2(i + L * 97, 13) ** 3, b: 0.35 + 0.65 * hash2(i + L * 97, 14) })));
const NEAR = range(34, (i) => { const side = i % 2 ? 1 : -1, X = side * (2.2 + 90 * hash2(i, 21) ** 1.6), tree = hash2(i, 22) < 0.6; return { X, tree, h: tree ? 4 + 10 * hash2(i, 23) : 5 + 4 * hash2(i, 24), w: tree ? 3 + 4 * hash2(i, 25) : 7 + 8 * hash2(i, 26) }; });
const CITY = range(240, (i) => { const X = 1400 + (hash2(i, 31) - 0.5) * 9000 * (0.3 + hash2(i, 32)), d = Math.abs(X - 1400) / 4500; return { X, w: 12 + 30 * hash2(i, 33), h: (6 + 130 * hash2(i, 34) ** 2) * Math.max(0.15, 1 - d) }; });
const RIDGE = range(401, (i) => { const X = -3e5 + (i / 400) * 6e5; let h = 0; for (let o = 0; o < 4; o++) h += noise1(X / (4e4 / 2 ** o), 41 + o) / 2 ** o; return [X, Math.max(0, 2600 * (h + 0.15))]; });
const STARS = range(320, (i) => { const d = 10 ** (16.62 + 2.3 * hash2(i, 51)), a = TAU * hash2(i, 52); return { X: d * Math.cos(a), Y: d * Math.sin(a), r: 0.7 + 1.9 * hash2(i, 53) ** 4, b: 0.3 + 0.7 * hash2(i, 54) }; });
const GALAXY = (() => {                                                // dos brazos logarítmicos (pitch ≈ 13°) + bulbo; el Sol cae sobre un brazo
  const Rd = 5e20, b = Math.tan(13 * deg), a0 = 0.06 * Rd, out = [];
  const rs = Math.hypot(...GAL_C), ths = Math.log(rs / a0) / b, rot = Math.atan2(-GAL_C[1], -GAL_C[0]) - ths;
  for (let i = 0; i < 3200; i++) {
    const bulge = i < 520, u = hash2(i, 61), v = hash2(i, 62), w = hash2(i, 63);
    let r, th;
    if (bulge) { r = 0.13 * Rd * Math.sqrt(-Math.log(1 - 0.95 * u)) * 0.6; th = TAU * v; }
    else { r = a0 * Math.exp(b * (u * (Math.log(Rd / a0) / b))); th = Math.log(r / a0) / b + (i % 2) * Math.PI + (w - 0.5) * 0.55 + rot; r *= 1 + (hash2(i, 64) - 0.5) * 0.18; }
    out.push({ X: GAL_C[0] + r * Math.cos(th), Y: GAL_C[1] + r * Math.sin(th), s: bulge ? 1.3 : 0.6 + 1.1 * hash2(i, 65) ** 3, b: bulge ? 0.9 : 0.35 + 0.6 * hash2(i, 66) });
  }
  return out;
})();
const ANDRO = range(900, (i) => { const r = 1.1e21 * Math.sqrt(hash2(i, 71)) * (i < 200 ? 0.25 : 1), a = TAU * hash2(i, 72), x = r * Math.cos(a), y = r * Math.sin(a) * 0.32, c = Math.cos(38 * deg), s = Math.sin(38 * deg); return { X: M31[0] + x * c - y * s, Y: M31[1] + x * s + y * c, b: i < 200 ? 0.9 : 0.4 }; });
const WEB = (() => {                                                   // red cósmica: nodos en rejilla perturbada; filamentos a los vecinos cercanos
  const D = 3e24, n = Math.ceil(R_OBS / D) + 1, nodes = [], edges = [];
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) { const X = (i + 0.8 * (hash2(i * 1009 + j, 81) - 0.5)) * D, Y = (j + 0.8 * (hash2(i * 1009 + j, 82) - 0.5)) * D; if (Math.hypot(X, Y) < R_OBS) nodes.push({ X, Y, i, j, m: hash2(i * 1009 + j, 83) }); }
  const at = new Map(nodes.map((q, k) => [q.i + ',' + q.j, k]));
  nodes.forEach((q, k) => { for (const [di, dj] of [[1, 0], [0, 1], [1, 1]]) { const o = at.get(q.i + di + ',' + (q.j + dj)); if (o != null && hash2(k * 3 + di + 2 * dj, 84) < 0.62) edges.push([k, o]); } });
  return { D, nodes, edges };
})();
const LAND = [[-60, 10, 28], [20, 40, 22], [100, 30, 30], [140, -25, 16], [-10, -15, 20]].map(([lo, la, r], k) =>
  range(49, (i) => { const a = (i / 48) * TAU, rr = r * (0.75 + 0.35 * noise1(i * 0.35, k + 3)); return [lo + rr * Math.cos(a), la + rr * 0.7 * Math.sin(a)]; }));

// ───────── capas ─────────
const disc = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
const inView = (G, x, y, m = 40) => x > -m && x < G.W + m && y > -m && y < G.H + m;

// Cielo en el infinito: 3 capas de profundidad (scene graph con z → niebla y DOF del estilo). No escala con L.
function sky(api, G, L, t) {
  const a = lerp(0.3, 1, seg(L, 4.5, 6)) * (1 - seg(L, 15.3, 17.3)); if (a < 0.01) return;
  const air = 1 - seg(L, 4, 6), ink = api.color('ink');
  api.scene({ id: 'cielo', x: G.cx, y: G.cy, opacity: a, children: SKY.map((stars, l) => ({ id: 'cielo' + l, z: [150, 80, 30][l], draw: (c) => {
    const g0 = c.globalAlpha; c.fillStyle = ink;                          // g0 = opacidad del nodo × niebla por z
    stars.forEach((s, i) => { c.globalAlpha = g0 * s.b * (1 - 0.55 * air * (0.5 + 0.5 * noise1(t * 2.2 + i * 1.7, 9 + l))); disc(c, s.x * G.W, s.y * G.H, s.r * G.k * 1.4); });
  } })) });
}

function ground(ctx, api, G, L, t, e3 = 0) {
  const { ppm, P } = proj(G, L), shade = api.color('shade'), a2 = api.color('accent2');
  if (L < 3.2) {
    const yg = G.cy + H0 * ppm;
    ctx.fillStyle = groundCol(api, L); ctx.fillRect(-G.W, yg, 3 * G.W, 3 * G.H);
    hatch(ctx, api, G, yg);                                              // terreno en sección (plano técnico): rayado oblicuo fijo en pantalla, solo se mueve el borde
    ctx.fillStyle = api.color('ink'); ctx.globalAlpha = 0.85; ctx.fillRect(-G.W, yg - 0.75 * G.k, 3 * G.W, 1.5 * G.k); ctx.globalAlpha = 1;
    return { yg };
  }
  const [ex, ey] = P(0, -(RE + H0)), r = RE * ppm;
  const dh = 5e3, lw = Math.max(1, dh * ppm);                           // atmósfera: 20 capas finas, densidad ∝ e^(−h/15 km)
  const air = seg(L, 4.2, 4.9);                                           // dentro del aire no hay «banda»: aparece al verla desde fuera
  if (air > 0) for (let j = 20; j >= 1; j--) { const rr = (RE + j * dh) * ppm; if (rr - r < 0.5) continue; ctx.strokeStyle = a2; ctx.globalAlpha = air * 0.13 * Math.exp((-j * dh) / 1.5e4) * clamp((rr - r) / 2) * Math.min(1, (dh * ppm) / lw * 3); ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(ex, ey, rr, 0, TAU); ctx.stroke(); }
  ctx.globalAlpha = 1 - e3; ctx.fillStyle = groundCol(api, L); ctx.beginPath(); ctx.arc(ex, ey, Math.max(r, 0.6), 0, TAU); ctx.fill();   // e3 = fracción que ya cubre el globo 3D (P04)
  ctx.globalAlpha = 1;
  if (e3 <= 0) earthLines(ctx, api, G, L);
  return { ex, ey, r };
}
// Líneas de la Tierra (globo con graticule y continentes + la línea de Kármán): van ENCIMA del globo 3D cuando lo hay.
export function earthLines(ctx, api, G, L) {
  const { ppm, P } = proj(G, L), [ex, ey] = P(0, -(RE + H0)), r = RE * ppm, a2 = api.color('accent2'), g = seg(L, 6.4, 6.9);
  if (g > 0 && r < 700) api.globe({ x: ex, y: ey, r, lon: -35, lat: 22, features: LAND, u: g, color: 'ink', lw: 1.4, graticule: true, label: 'la Tierra' });
  const kr = (RE + 1e5) * ppm; if (L > 4.1 && L < 6.3 && kr - r > 3) { ctx.save(); ctx.strokeStyle = a2; ctx.globalAlpha = 0.65 * seg(L, 4.1, 4.5) * (1 - seg(L, 5.9, 6.3)); ctx.setLineDash([6 * G.k, 6 * G.k]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ex, ey, kr, 0, TAU); ctx.stroke(); ctx.restore(); }
}
// Suelo: sección de terreno más profunda que el cielo (el plano técnico es azul; el terreno, azul de tinta). Al verse como planeta se aclara.
const groundCol = (api, L) => mixHex(mixHex(api.color('paper'), '#000000', 0.72), api.color('shade'), lerp(0, 0.5, seg(L, 4.5, 6.5)));
function hatch(ctx, api, G, yg) {
  const y0 = Math.max(yg, 0), step = 16 * G.k * 1.5; if (y0 >= G.H) return;
  ctx.save(); ctx.beginPath(); ctx.rect(0, y0, G.W, G.H - y0); ctx.clip(); ctx.strokeStyle = api.color('accent2'); ctx.globalAlpha = 0.24; ctx.lineWidth = Math.max(1, G.k * 1.5); ctx.beginPath();
  for (let x = -G.H; x < G.W + G.H; x += step) { ctx.moveTo(x, G.H); ctx.lineTo(x + G.H, 0); }
  ctx.stroke(); ctx.restore();
}
const groundY = (X) => -H0 - (X * X) / (RE + Math.sqrt(Math.max(0, RE * RE - X * X)));   // suelo curvo exacto (sin cancelación)

function surface(ctx, api, G, L, f = 1) {
  const { ppm, P } = proj(G, L), sil = mixHex(mixHex(api.color('paper'), '#000000', 0.55), api.color('shade'), 0.3);
  if (L > 3.1 && L < 6.3) {                                            // montañas sobre el suelo curvo
    const a = f * seg(L, 3.1, 3.6) * (1 - seg(L, 5.6, 6.3)); ctx.fillStyle = sil; ctx.globalAlpha = 0.85 * a; ctx.beginPath();
    RIDGE.forEach(([X, h], i) => { const [x, y] = P(X, groundY(X) + h); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    for (let i = RIDGE.length - 1; i >= 0; i--) { const X = RIDGE[i][0], [x, y] = P(X, groundY(X)); ctx.lineTo(x, y); }
    ctx.fill(); ctx.globalAlpha = 1;
  }
  if (L > 2.1 && L < 4.8) {                                            // ciudad con ventanas encendidas
    const a = f * seg(L, 2.1, 2.6) * (1 - seg(L, 4.2, 4.8)); ctx.fillStyle = sil;
    for (const b of CITY) { const h = b.h * ppm; if (h < 0.4) continue; const [x, y] = P(b.X - b.w / 2, groundY(b.X) + b.h); if (x > G.W + 20 || x + b.w * ppm < -20) continue; ctx.globalAlpha = a * clamp(h); ctx.fillRect(x, y, Math.max(0.6, b.w * ppm), h + 1); }
    if (L < 3.4) { ctx.fillStyle = api.color('ink'); for (const [i, b] of CITY.entries()) { const hp = b.h * ppm; if (hp < 6) continue; const [x, y] = P(b.X, groundY(b.X) + b.h * 0.7); ctx.globalAlpha = a * 0.55 * seg(hp, 6, 14) * hash2(i, 35); ctx.fillRect(x - 0.8, y, 1.6, 1.6); } }
    ctx.globalAlpha = 1;
  }
  if (L > 0.15 && L < 2.9) {                                           // árboles y casas cerca de ti
    const a = f * seg(L, 0.15, 0.5) * (1 - seg(L, 2.3, 2.9)), silN = mixHex(mixHex(api.color('paper'), '#000000', 0.6), api.color('shade'), 0.15);   // siluetas de bajo contraste: el primer ×10 no compite con el borde
    for (const o of NEAR) {
      const h = o.h * ppm; if (h < 0.8) continue; const [x, yg] = P(o.X, -H0); if (x < -60 || x > G.W + 60) continue;
      ctx.globalAlpha = a * clamp(h / 3); ctx.fillStyle = silN;
      if (o.tree) { ctx.fillRect(x - 0.12 * o.w * ppm, yg - 0.45 * h, 0.24 * o.w * ppm, 0.45 * h); disc(ctx, x, yg - 0.62 * h, 0.5 * o.w * ppm); }
      else { ctx.fillRect(x - (o.w * ppm) / 2, yg - 0.62 * h, o.w * ppm, 0.62 * h); ctx.beginPath(); ctx.moveTo(x - 0.58 * o.w * ppm, yg - 0.62 * h); ctx.lineTo(x, yg - h); ctx.lineTo(x + 0.58 * o.w * ppm, yg - 0.62 * h); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
}

// Persona (≙ 1,7 m): la referencia humana antes del salto. trim = draw-on del contorno; fill = relleno.
export function person(api, G, L, { trim = 1, fill = 1, focus = true, x, y, h } = {}) {
  const { ppm } = proj(G, L), hh = h ?? 1.7 * ppm; if (hh < 1.2) return null;
  const px = x ?? G.cx, top = y != null ? y - hh / 2 : G.cy - (1.7 - H0) * ppm, s = hh / 100;
  if (trim < 1) api.path(PERSON, { x: px, y: top, s, trim: [0, trim], stroke: 'ink', lw: 1.6, focus: false });
  if (fill > 0) api.path(PERSON, { x: px, y: top, s, fill: mixHex(api.color('ink'), api.color('shade'), 0.35), alpha: fill, focus: focus && hh > 30, label: 'persona', weight: 1 });
  return { x: px, y: top + hh / 2, h: hh };
}

// La ventana (motivo): cuadrados de lado 10^k m. Registra como foco la ventana ≤ S0 (el hueco admite tipo).
export function windows(ctx, api, G, L, { alpha = 1, draw0 = 1, dim = 0 } = {}) {
  const acc = api.color('accent');
  for (let k = Math.max(0, Math.floor(L - 1.4)); k <= Math.ceil(L + 0.6); k++) {
    if (k > LMAX + 1e-9) continue;
    const s = G.S0 * 10 ** (k - L); if (s < 3) continue;
    let a = alpha * clamp((s - 3) / 25) * clamp((2.6 * G.S0 - s) / (1.2 * G.S0)) * (1 - 0.72 * seg(L, 24.0, 24.8) * (1 - dim)); if (k === 0) a *= draw0;   // anticipación: las ventanas se apagan antes del choque (calma previa al pico)
    if (a <= 0.004) continue;
    const cur = Math.abs(k - L) < 0.5;
    ctx.save(); ctx.strokeStyle = acc; ctx.globalAlpha = a * (cur ? 0.95 : 0.55); ctx.lineWidth = (cur ? 2.2 : 1.3) * G.k * 1.5; ctx.strokeRect(G.cx - s / 2, G.cy - s / 2, s, s); ctx.restore();
    if (cur && s > 40) cota(ctx, api, G, s, a);
    if (s <= G.S0 * 1.05 && s > G.S0 * 0.3) api.focus(G.cx - s / 2, G.cy - s / 2, s, s, 'ventana', { weight: 0.3, hollow: 0.9 });
  }
  // el último cuadrado: 8,8×10^26 m (el borde) — solo tras el choque
  if (L > LMAX - 0.9) { const s = G.S0 * 10 ** (LMAX - L), a = alpha * seg(L, LMAX - 0.14, LMAX - 0.02); ctx.save(); ctx.strokeStyle = acc; ctx.globalAlpha = a; ctx.lineWidth = 2.2 * G.k * 1.5; ctx.strokeRect(G.cx - s / 2, G.cy - s / 2, s, s); ctx.restore(); }
}

// Cota de la ventana actual (dibujo técnico): línea con flechas y marcas de extremo bajo el cuadrado; el número lo da el contador.
function cota(ctx, api, G, s, a) {
  const y = G.cy + s / 2 + 16 * G.k * 1.5, x0 = G.cx - s / 2, x1 = G.cx + s / 2, h = 5 * G.k * 1.5;
  ctx.save(); ctx.strokeStyle = api.color('accent'); ctx.fillStyle = api.color('accent'); ctx.globalAlpha = 0.8 * a; ctx.lineWidth = 1.2 * G.k * 1.5;
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.moveTo(x0, y - 2 * h); ctx.lineTo(x0, y + h); ctx.moveTo(x1, y - 2 * h); ctx.lineTo(x1, y + h); ctx.stroke();
  for (const [x, d] of [[x0, 1], [x1, -1]]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + d * 2.4 * h, y - h * 0.8); ctx.lineTo(x + d * 2.4 * h, y + h * 0.8); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}

// Tú: cuando la persona ya no se ve, queda un anillo ámbar en el origen.
function you(ctx, api, G, L) {
  const a = seg(L, 0.9, 1.4); if (a <= 0) return;
  ctx.save(); ctx.strokeStyle = ctx.fillStyle = api.color('accent'); ctx.globalAlpha = a; ctx.lineWidth = 1.6 * G.k * 1.5;
  ctx.beginPath(); ctx.arc(G.cx, G.cy, 5 * G.k * 1.5, 0, TAU); ctx.stroke(); disc(ctx, G.cx, G.cy, 1.6 * G.k * 1.5); ctx.restore();
}

// Tierra → brazo → Luna (scene graph: la Luna es hija del brazo, hijo de la Tierra).
function moon(api, G, L) {
  const a = seg(L, 7.3, 7.8) * (1 - seg(L, 10, 10.6)); if (a <= 0) return null;
  const { ppm, P } = proj(G, L), [ex, ey] = P(0, -(RE + H0)), rm = MOON_R * ppm, ink = api.color('ink');
  api.scene({ id: 'tierra', x: ex, y: ey, opacity: a, children: [
    { id: 'orbitaLuna', draw: (c) => { c.strokeStyle = ink; c.globalAlpha *= 0.6; c.lineWidth = 1.5; c.setLineDash([4, 5]); c.beginPath(); c.arc(0, 0, rm, 0, TAU); c.stroke(); } },
    { id: 'brazoLuna', rot: -MOON_ANG, children: [{ id: 'luna', x: rm, draw: (c) => { c.fillStyle = ink; disc(c, 0, 0, Math.max(1.6, 1.737e6 * ppm)); } }] },
  ] });
  return { ex, ey, rm };
}

// Sol → brazos de planetas (scene graph); la órbita terrestre (ámbar: pasa por ti) y el resto en tinta.
function solar(ctx, api, G, L, { hi } = {}) {
  const a = seg(L, 9.6, 10.2) * (1 - seg(L, 15.2, 16)); if (a <= 0) return null;
  const { ppm, P } = proj(G, L), [sx, sy] = P(...SUN), ink = api.color('ink'), acc = api.color('accent'), rs = Math.max(2.4 * G.k * 1.5, 6.96e8 * ppm);
  api.glow(sx, sy, G.W * 0.55, 'ink', 0.16 * a);                     // la luz entra antes que el Sol
  api.scene({ id: 'sol', x: sx, y: sy, opacity: a, children: [
    { id: 'disco', draw: (c) => { c.fillStyle = ink; disc(c, 0, 0, rs); } },
    ...PLANETS.map(([n, au], i) => { const r = au * AU * ppm; if (r < 2.5 || r > 6000) return null; const earth = n === 'tierra', on = hi === n;
      return { id: 'órbita-' + n, children: [
        { id: 'aro-' + n, draw: (c) => { c.strokeStyle = earth ? acc : ink; c.globalAlpha *= (earth ? 0.6 : on ? 0.85 : 0.28) * clamp((r - 2.5) / 6); c.lineWidth = earth || on ? 1.6 : 1.1; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); } },
        { id: 'brazo-' + n, rot: earth ? Math.atan2(-(0 - SUN[1]), 0 - SUN[0]) : TAU * hash2(i, 91), children: [{ id: n, x: r, draw: (c) => { if (earth) return; c.fillStyle = ink; c.globalAlpha *= clamp((r - 4) / 10); disc(c, 0, 0, 1.6 * G.k * 1.5); } }] },
      ] }; }).filter(Boolean),
  ] });
  return { sx, sy, ppm };
}

function stars(ctx, api, G, L, t) {
  const a = seg(L, 15.2, 16.2) * (1 - seg(L, 19.2, 20.2)); if (a <= 0) return;
  const { ppm, P } = proj(G, L), ink = api.color('ink'); ctx.fillStyle = ink;
  for (const s of STARS) { const [x, y] = P(s.X, s.Y); if (!inView(G, x, y)) continue; ctx.globalAlpha = a * s.b * clamp((Math.hypot(x - G.cx, y - G.cy) - 3) / 20); disc(ctx, x, y, s.r * G.k * 1.5); }
  ctx.globalAlpha = 1;
}
function galaxy(ctx, api, G, L) {
  const a = seg(L, 18.3, 19.3) * (1 - seg(L, 24.2, 25.2)); if (a <= 0) return;
  const { ppm, P } = proj(G, L), ink = api.color('ink'); ctx.fillStyle = ink;
  const big = seg(L, 18.3, 20.4);                                       // de cerca, puntos tenues; entera, más densa (y atenuada al alejarse: media constante)
  for (const s of GALAXY) { const [x, y] = P(s.X, s.Y); if (!inView(G, x, y, 4)) continue; ctx.globalAlpha = a * s.b * (0.45 + 0.55 * big) * (1 - 0.45 * seg(L, 19.6, 20.3)); const r = s.s * G.k * 1.2; if (r < 1.1) ctx.fillRect(x - r, y - r, 2 * r, 2 * r); else disc(ctx, x, y, r); }
  if (L > 20.3) { ctx.fillStyle = ink; for (const s of ANDRO) { const [ax, ay] = P(s.X, s.Y); if (!inView(G, ax, ay, 4)) continue; ctx.globalAlpha = a * s.b * 0.25 * seg(L, 20.3, 21.2); ctx.fillRect(ax - 0.7, ay - 0.7, 1.4, 1.4); } }
  ctx.globalAlpha = 1;
}
function web(ctx, api, G, L) {
  // calma antes del pico: la red se apaga (×0,2) mientras se comprime, para que el choque con el borde sea el único pico
  const a = seg(L, 23.2, 24.2) * (1 - 0.94 * seg(L, 23.5, 24.3)); if (a <= 0) return;
  const { ppm, P } = proj(G, L), cell = WEB.D * ppm, fine = clamp((cell - 5) / 18), ink = api.color('ink'), a2 = api.color('accent2');
  if (fine > 0) {
    ctx.strokeStyle = a2; ctx.lineWidth = 1; ctx.globalAlpha = 0.06 * a * fine; ctx.beginPath();
    for (const [p, q] of WEB.edges) { const A = WEB.nodes[p], B = WEB.nodes[q], [x0, y0] = P(A.X, A.Y), [x1, y1] = P(B.X, B.Y); if (!inView(G, x0, y0, cell) && !inView(G, x1, y1, cell)) continue; ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
    ctx.stroke(); ctx.fillStyle = ink;
    for (const n of WEB.nodes) { if (n.m < 0.45) continue; const [x, y] = P(n.X, n.Y); if (!inView(G, x, y, 4)) continue; ctx.globalAlpha = 0.45 * a * fine * (0.3 + 0.6 * n.m); disc(ctx, x, y, (0.8 + 1.8 * n.m) * G.k * 1.5); }
  }
  // (el «mar» uniforme de galaxias tras la red se quitó: un disco al 2–3 % producía un salto de brillo de pantalla completa justo antes del choque)
  ctx.globalAlpha = 1;
}
// El borde: la superficie de última dispersión (CMB). Se enciende al chocar (t = TE): impacto de 2 fotogramas + decaimiento.
export function edge(ctx, api, G, L, t) {
  const R = R_OBS * ppmOf(G, L); if (R > 3 * G.W) return null;
  const a2 = api.color('accent2'), hit = t - TE, flash = hit >= 0 ? Math.exp(-hit / 0.55) : 0, imp = hit >= 0 && hit < 3 / 30;
  const draw = (c) => { c.save(); c.strokeStyle = imp ? api.color('ink') : a2; c.globalAlpha = clamp(0.1 + flash); c.lineWidth = (2 + 6 * flash + (imp ? 6 : 0)) * G.k * 1.5; c.beginPath(); c.arc(G.cx, G.cy, R, 0, TAU); c.stroke();
    if (flash > 0.02) { const hot = hit >= 0 && hit < 6 / 30; c.fillStyle = hot ? api.color('accent') : a2; c.globalAlpha = hot ? 0.85 - 0.3 * (hit * 5) : 0.3 * flash; disc(c, G.cx, G.cy, R); } c.restore(); };   // el golpe: 2 fotogramas de bermellón (el acento marca el pico)
  if (hit >= 0 && hit < 1.2) {                                       // el golpe, en capas: velo blanco de pantalla completa (la hoja del plano se sobreexpone) + onda de choque que sale del borde
    ctx.save(); ctx.fillStyle = api.color('ink'); ctx.globalAlpha = 0.5 * Math.exp(-hit / 0.1); ctx.fillRect(0, 0, G.W, G.H);
    ctx.strokeStyle = api.color('ink'); ctx.globalAlpha = 0.7 * Math.exp(-hit / 0.45); ctx.lineWidth = Math.max(1, (5 * Math.exp(-hit / 0.5)) * G.k * 1.5); ctx.beginPath(); ctx.arc(G.cx, G.cy, R * (1 + 3.5 * (1 - Math.exp(-hit / 0.4))), 0, TAU); ctx.stroke(); ctx.restore();
  }
  if (flash > 0.02) api.layer({ bloom: { threshold: 0.35, strength: 1.4 * flash + 0.3, radius: 34 } }, (c) => draw(c)); else draw(ctx);
  if (R > 30 && R < G.S0 * 1.3) api.focus(G.cx - R, G.cy - R, 2 * R, 2 * R, 'borde observable', { weight: 1, hollow: 0.85 });
  return { R, flash };
}
const ppmOf = (G, L) => G.S0 / 10 ** L;

// ───────── viaje completo: una sola función para todos los shots (continuidad exacta en cada corte) ─────────
export function ride(ctx, api, film, t, o = {}) {
  // o.stage = 'back' | 'front' | (todo): un shot con 3D en medio (P04) pinta el fondo, el globo 3D y luego el frente (la ventana, la Luna, las líneas de la Tierra).
  // o.earth3d (0–1) = fracción del globo 3D sobre el disco 2D; o.surf (0–1) = opacidad de árboles/casas/ciudad 2D (P03 los cede a la ciudad 3D).
  const G = geo(film), L = o.L ?? Lof(t), back = o.stage !== 'front', front = o.stage !== 'back', e3 = o.earth3d ?? 0;
  let gr = null;
  if (back) {
    sky(api, G, L, t);
    const blurred = (fn) => (L > 15 && L < 23.5 && o.blur !== false && t > TA ? api.layer({ motionBlur: { shutter: 0.5, samples: 5 } }, (c, tt, A) => fn(c, Lof(tt), A)) : fn(ctx, L, api));
    blurred((c, LL, A) => { stars(c, A, G, LL); galaxy(c, A, G, LL); web(c, A, G, LL); });
    gr = ground(ctx, api, G, L, t, e3);
  }
  if (!front) return { G, L, gr };
  surface(ctx, api, G, L, o.surf ?? 1);
  if (e3 > 0) earthLines(ctx, api, G, L);
  const mo = moon(api, G, L);
  const so = solar(ctx, api, G, L, { hi: o.hi });
  const ed = edge(ctx, api, G, L, t);
  const pe = L < 2 ? person(api, G, L, o.person ?? {}) : null;
  you(ctx, api, G, L);
  windows(ctx, api, G, L, { dim: seg(t, TE + 0.1, TE + 0.9), ...(o.win ?? {}) });
  return { G, L, gr, mo, so, ed, pe };
}

// ───────── contador (TeX real): 10^n m; en cada cruce, morph glifo a glifo de n−1 a n ─────────
export const texPow = (n) => `10^{${n}}\\,\\mathrm{m}`;
export const TEX_EDGE = String.raw`8{,}8\times10^{26}\,\mathrm{m}`, TEX_LOG = String.raw`10^{26{,}9}\,\mathrm{m}`;
export function hud(api, film, t, { alpha = 1, write, L: Lf, tex } = {}) {
  const G = geo(film), x = G.sx0 + 0.035 * G.sw, y = G.sy0 + 0.07 * G.sh, size = 40 * G.k * 1.5;
  if (alpha <= 0.02) return null;
  const base = { size, align: 'left', color: inkA(api, alpha) };
  if (tex) return api.tex(tex.from, x, y, { ...base, ...(tex.to ? { morphTo: tex.to, u: tex.u } : {}), write: tex.write ?? 1 });
  const L = Lf ?? Lof(t);
  if (t >= TE - 0.05 && Lf == null) { const u = clamp((t - TE - 0.25) / 0.6); return api.tex(texPow(26), x, y, { ...base, morphTo: TEX_EDGE, u: api.ease('inOut', u) }); }
  const n = Math.min(26, Math.floor(L + 1e-6));
  if (n >= 1 && Lf == null) { const u = clamp((t - tk(n)) / 0.35); if (u < 1) return api.tex(texPow(n - 1), x, y, { ...base, morphTo: texPow(n), u: api.ease('inOut', u) }); }
  return api.tex(texPow(n), x, y, { ...base, write: write ?? 1 });
}

// Rótulo de hito: nombre (tipo) + valor (TeX) abajo a la izquierda, dentro de [t0, t1].
export function caption(api, film, t, t0, t1, name, tex) {
  const G = geo(film), a = api.spring(t - t0) * (1 - seg(t, t1 - 0.3, t1)); if (a <= 0.02 || t < t0 || t > t1) return;
  const x = G.sx0 + 0.035 * G.sw;
  api.text(name, x, G.sy0 + 0.83 * G.sh, { role: 'body', align: 'left', alpha: a });
  if (tex) api.tex(tex, x, G.sy0 + 0.9 * G.sh, { size: 28 * G.k * 1.5, align: 'left', color: inkA(api, 1 - seg(t, t1 - 0.3, t1), 'accent2'), write: clamp((t - t0 - 0.15) / 0.6) });
}

// Relevo: la ventana (centro, tamaño en pantalla y escala). Mismo objeto en todos los cortes del viaje.
export const winRide = (t, film) => { const G = geo(film); return { x: G.cx, y: G.cy, s: G.S0, L: Lof(t) }; };

// ───────── la regla de exponentes (P11–P13) ─────────
// Cada ventana k (lado 10^k m) se vuelve un punto en x = rx(k): pasos iguales = escala logarítmica.
export const ICONS = [
  { v: 0, id: 'persona' }, { v: Math.log10(1.2742e7), id: 'tierra' }, { v: Math.log10(7.688e8), id: 'luna' }, { v: Math.log10(2 * AU), id: 'sol' },
  { v: Math.log10(4.0e16), id: 'estrella' }, { v: 21, id: 'galaxia' }, { v: Math.log10(2.4e22), id: 'andromeda' }, { v: 24.6, id: 'red' }, { v: LMAX, id: 'borde' },
];
export const CUR = 1.6;                                               // cursor = 1,6 × punto
// Cuadrado → punto: caja redondeada con marco de grosor th (el mismo truco que engine/shapes, en cuadrado).
export function sqdot(ctx, x, y, w, e, color, alpha = 1, th0 = 1.6) {
  if (w < 0.4 || alpha <= 0) return;
  const r = lerp(0, w / 2, e), th = lerp(Math.min(th0, w / 2), w / 2, e), rr = (xx, yy, ww, hh, q) => { q = Math.max(0, Math.min(q, ww / 2, hh / 2)); ctx.moveTo(xx + q, yy); ctx.arcTo(xx + ww, yy, xx + ww, yy + hh, q); ctx.arcTo(xx + ww, yy + hh, xx, yy + hh, q); ctx.arcTo(xx, yy + hh, xx, yy, q); ctx.arcTo(xx, yy, xx + ww, yy, q); ctx.closePath(); };
  ctx.save(); ctx.fillStyle = color; ctx.globalAlpha = alpha; ctx.beginPath(); rr(x - w / 2, y - w / 2, w, w, r);
  if (th < w / 2 - 0.3) rr(x - w / 2 + th, y - w / 2 + th, w - 2 * th, w - 2 * th, Math.max(0, r - th));
  ctx.fill('evenodd'); ctx.restore();
}
// Línea, marcas, iconos y etiquetas de la regla. o: { line (0..1), ticks, icons (0..1), labels (0..1), y, alpha, hi (v del cursor) }
export function ruler(ctx, api, G, o = {}) {
  const y = o.y ?? G.ry, al = o.alpha ?? 1, ink = api.color('ink'), a2 = api.color('accent2'), acc = api.color('accent'), K = G.k * 1.5;
  if ((o.line ?? 1) > 0) api.path(`M${G.rx(0)} ${y} L${G.rx(27)} ${y}`, { stroke: inkA(api, 0.45 * al), lw: 1.2, trim: [0, o.line ?? 1], focus: false });
  if ((o.ticks ?? 1) > 0) { ctx.save(); ctx.strokeStyle = ink; ctx.lineWidth = 1; for (let k = 0; k <= 27; k++) { ctx.globalAlpha = al * 0.35 * clamp((o.ticks ?? 1) * 28 - k); ctx.beginPath(); ctx.moveTo(G.rx(k), y + 5 * K); ctx.lineTo(G.rx(k), y + (k % 5 ? 9 : 13) * K); ctx.stroke(); } ctx.restore(); }
  const ia = o.icons ?? 1;
  if (ia > 0) for (const [i, ic] of ICONS.entries()) {
    const a = al * clamp(ia * ICONS.length - i), x = G.rx(ic.v), yy = y - 26 * K, hot = o.hi != null ? clamp(1 - Math.abs(o.hi - ic.v) / 0.8) : 0; if (a <= 0) continue;
    if (hot > 0) api.glow(x, yy, 22 * K, 'accent', 0.55 * hot * a);
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineWidth = 1.3;
    const R = 8 * K;
    if (ic.id === 'persona' && !o.noPerson) { ctx.restore(); api.path(PERSON, { x, y: yy - R * 1.3, s: (R * 2.6) / 100, fill: inkA(api, a), focus: false }); continue; }
    if (ic.id === 'tierra') { ctx.fillStyle = mixHex(api.color('paper'), api.color('shade'), 0.6); disc(ctx, x, yy, R * 0.8); ctx.strokeStyle = a2; ctx.beginPath(); ctx.arc(x, yy, R * 0.8, 0, TAU); ctx.stroke(); }
    if (ic.id === 'luna') { ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.arc(x, yy, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]); disc(ctx, x + R * 0.77, yy - R * 0.64, 1.8); disc(ctx, x, yy, 1.6); }
    if (ic.id === 'sol') { disc(ctx, x - R * 0.5, yy, 2.6); ctx.strokeStyle = acc; ctx.beginPath(); ctx.arc(x - R * 0.5, yy, R, 0, TAU); ctx.stroke(); }
    if (ic.id === 'estrella') { ctx.beginPath(); ctx.moveTo(x - R, yy); ctx.lineTo(x + R, yy); ctx.moveTo(x, yy - R); ctx.lineTo(x, yy + R); ctx.stroke(); disc(ctx, x, yy, 2); }
    if (ic.id === 'galaxia') { ctx.beginPath(); for (let s = 0; s < 2; s++) for (let q = 0; q <= 24; q++) { const th = q * 0.26 + s * Math.PI, rr = R * 0.12 * Math.exp(0.33 * q * 0.26); const px = x + rr * Math.cos(th), py = yy + rr * Math.sin(th) * 0.8; q ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); }
    if (ic.id === 'andromeda') { ctx.beginPath(); ctx.ellipse(x, yy, R, R * 0.34, -0.6, 0, TAU); ctx.stroke(); disc(ctx, x, yy, 1.8); }
    if (ic.id === 'red') { ctx.strokeStyle = a2; ctx.beginPath(); ctx.moveTo(x - R, yy + R * 0.5); ctx.lineTo(x, yy - R * 0.6); ctx.lineTo(x + R, yy + R * 0.3); ctx.stroke(); for (const [dx, dy] of [[-R, R * 0.5], [0, -R * 0.6], [R, R * 0.3]]) disc(ctx, x + dx, yy + dy, 1.8); }
    if (ic.id === 'borde' && !o.noEdge) { ctx.strokeStyle = a2; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, yy, R, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
  const la = o.labels ?? 1;
  if (la > 0.02) for (const v of [0, 10, 20]) api.tex(`10^{${v}}`, G.rx(v), y + 30 * K, { size: 22 * K, color: inkA(api, 0.7 * la * al), write: 1 });
  api.focus(G.rx(0) - 14 * K, y - 40 * K, G.rx(27) - G.rx(0) + 28 * K, 56 * K, 'regla', { weight: o.weight ?? 1 });
}

// mezcla de colores hex (sin estado)
export function mixHex(a, b, u) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)), A = p(a), B = p(b);
  return '#' + A.map((v, i) => Math.round(lerp(v, B[i], u)).toString(16).padStart(2, '0')).join('');
}
