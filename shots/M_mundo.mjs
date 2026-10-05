// «e^{iπ}: elevar es girar» — el mundo compartido por M01–M08 (no es un shot: lo importan los shots).
// Un solo plano complejo que cambia de ENCUADRE (recta → plano → recta), un solo punto z (ámbar) y UNA ecuación que muta.
// Todo es función pura de t. Coordenadas en unidades complejas (z = 1 es «uno»); X/Y las llevan a píxeles con la vista V(t).
//   color = categoría: ámbar = el punto y la respuesta · azul (accent2) = lo real, crecer · violeta (quant) = lo imaginario, girar
//   coral (anom) = el modelo roto · tinta = texto · shade = lo atenuado
import { clamp, lerp, seg, ease, TAU } from '../engine/core.mjs';
import { rgba } from '../engine/color.mjs';

const PI = Math.PI, E = Math.E;
const eio = (u) => ease.inOut(clamp(u));
const sm = (t, a, b) => eio((t - a) / (b - a));              // 0→1 suave entre a y b

// ───────── calendario (segundos de film) ─────────
export const T = {
  hop1: [11.0, 13.2], hop2: [14.4, 16.8], back1: [19.0, 20.8],       // M02: ×e, ×e, vuelta a casa
  grow: [24.0, 30.8], back2: [31.8, 33.6],                           // M03: dz/dt = z
  glide1: [33.6, 37.4], turn: [37.0, 38.6], rot: [38.6, 44.6], back3: [45.2, 46.9],   // M04: la velocidad gira 90°; el punto gira
  glide2: [46.2, 50.0],
  run: [[50.4, 52.5, 2], [54.2, 56.6, 4], [58.0, 59.8, 8]],          // M05: [inicio, fin, n]
  back: [[53.0, 53.8], [57.1, 57.8]],
  climb: [61.2, 63.8], land: 66.0,                                   // M06: n 8 → 2500, aterrizaje
  home: [82.0, 88.0],                                                // M08: el punto vuelve a 1 por el arco
};
export const LMAX = 2500;                                            // pasos del polígono al final del ascenso

// ───────── vista (encuadre del plano) ─────────
const VK = [
  [0, [0.14, 0.60, 0.19]], [33.6, [0.14, 0.60, 0.19]], [37.4, [0.50, 0.58, 0.20]], [46.2, [0.50, 0.58, 0.20]], [50.0, [0.50, 0.74, 0.18]],
  [61.2, [0.50, 0.74, 0.18]], [63.8, [0.50, 0.72, 0.28]], [82.0, [0.50, 0.72, 0.28]], [88.8, [0.14, 0.60, 0.19]],
];
export function view(film, t) {
  let i = 0; while (i < VK.length - 2 && t >= VK[i + 1][0]) i++;
  const [t0, a] = VK[i], [t1, b] = VK[i + 1], e = sm(t, t0, t1), W = film.width, H = film.height;
  return { ox: lerp(a[0], b[0], e) * W, oy: lerp(a[1], b[1], e) * H, u: lerp(a[2], b[2], e) * H, line: 1 - sm(t, 33.6, 37.4) + sm(t, 82, 88.8) };
}
export const X = (V, c) => V.ox + V.u * c[0];
export const Y = (V, c) => V.oy - V.u * c[1];

// ───────── aritmética compleja y polígonos de Euler ─────────
export const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
export const cis = (th, r = 1) => [r * Math.cos(th), r * Math.sin(th)];
// z_K = (1 + iπ/n)^K en forma cerrada (módulo y argumento) y posición a lo largo del polígono de n pasos en s ∈ [0, n]
export function polyAt(n, s) {
  const x = PI / n, K = Math.floor(s + 1e-9), f = s - K, z = cis(K * Math.atan(x), Math.pow(1 + x * x, K / 2));
  return cmul(z, [1, f * x]);
}
export function polyPts(n, upto = n) {
  const x = PI / n, K = Math.floor(upto + 1e-9), pts = [];
  for (let k = 0; k <= K; k++) pts.push(cis(k * Math.atan(x), Math.pow(1 + x * x, k / 2)));
  if (upto - K > 1e-9) pts.push(polyAt(n, upto));
  return pts;
}
const nOfClimb = (t) => Math.exp(lerp(Math.log(8), Math.log(LMAX), sm(t, T.climb[0], T.climb[1])));
export const climbN = nOfClimb;

// ───────── el punto z(t) en unidades complejas ─────────
export function zAt(t) {
  const [h1a, h1b] = T.hop1, [h2a, h2b] = T.hop2, [ba, bb] = T.back1;
  if (t < h1a) return [1, 0];
  if (t < h1b) return [lerp(1, E, eio((t - h1a) / (h1b - h1a))), 0];
  if (t < h2a) return [E, 0];
  if (t < h2b) return [lerp(E, E * E, eio((t - h2a) / (h2b - h2a))), 0];
  if (t < ba) return [E * E, 0];
  if (t < bb) return [lerp(E * E, 1, eio((t - ba) / (bb - ba))), 0];
  if (t < T.grow[0]) return [1, 0];
  if (t < T.grow[1]) return [Math.exp(1.6 * sm(t, ...T.grow)), 0];
  if (t < T.back2[0]) return [Math.exp(1.6), 0];
  if (t < T.back2[1]) return [lerp(Math.exp(1.6), 1, sm(t, ...T.back2)), 0];
  if (t < T.rot[0]) return [1, 0];
  if (t < T.rot[1]) return cis(1.9 * sm(t, ...T.rot));
  if (t < T.back3[0]) return cis(1.9);
  if (t < T.back3[1]) return cis(1.9 * (1 - sm(t, ...T.back3)));
  const R = T.run;
  if (t < R[0][0]) return [1, 0];
  for (let i = 0; i < 3; i++) {                                      // tres intentos: correr el polígono, posarse, volver a 1 (salvo el último)
    const [a, b, n] = R[i];
    if (t < b) return polyAt(n, n * sm(t, a, b));
    if (i === 2) break;
    if (t < T.back[i][0]) return polyAt(n, n);
    if (t < T.back[i][1]) return lerpC(polyAt(n, n), [1, 0], sm(t, ...T.back[i]));
    if (t < R[i + 1][0]) return [1, 0];
  }
  if (t < T.climb[0]) return polyAt(8, 8);
  if (t < T.climb[1]) { const n = nOfClimb(t); return polyAt(n, n); }
  if (t < T.home[0]) return [-1, 0];
  if (t < T.home[1]) return cis(PI * (1 - sm(t, ...T.home)));
  return [1, 0];
}
const lerpC = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
export const zEntity = (t, film) => { const V = view(film, t), z = zAt(t); return { x: X(V, z), y: Y(V, z), s: 17, role: 'accent' }; };

// ángulo del arco recorrido por z (para el rastro circular de M04 y el regreso de M08)
export function thetaAt(t) {
  if (t < T.rot[0]) return 0;
  if (t < T.rot[1]) return 1.9 * sm(t, ...T.rot);
  if (t < T.back3[0]) return 1.9;
  if (t < T.back3[1]) return 1.9 * (1 - sm(t, ...T.back3));
  if (t < T.climb[1]) return 0;
  if (t < T.home[0]) return PI;
  if (t < T.home[1]) return PI * (1 - sm(t, ...T.home));
  return 0;
}

// ───────── la ecuación única que muta ─────────
export const EQ = [
  { t: 1.0, d: 2.6, tex: String.raw`e^{i\pi}`, x: 0.5, y: 0.27, s: 0.105 },
  { t: 9.8, d: 1.6, tex: String.raw`e^{i\pi}`, x: 0.17, y: 0.16, s: 0.052 },
  { t: 14.2, d: 1.8, tex: String.raw`e^{2}=e\cdot e`, x: 0.2, y: 0.16, s: 0.052 },
  { t: 17.4, d: 1.8, tex: String.raw`e^{i\pi}=e\cdot e\cdots`, x: 0.215, y: 0.16, s: 0.052 },
  { t: 21.8, d: 2.0, tex: String.raw`\frac{dz}{dt}=z`, x: 0.17, y: 0.17, s: 0.052 },
  { t: 30.4, d: 1.8, tex: String.raw`z(t)=e^{t}`, x: 0.17, y: 0.16, s: 0.052 },
  { t: 36.0, d: 1.8, tex: String.raw`\frac{dz}{dt}=i\,z`, x: 0.17, y: 0.17, s: 0.052 },
  { t: 43.4, d: 1.8, tex: String.raw`z(t)=e^{it}`, x: 0.17, y: 0.16, s: 0.052 },
  { t: 47.8, d: 3.0, tex: String.raw`z_{k+1}=\left(1+\frac{i\pi}{n}\right)z_k`, x: 0.72, y: 0.17, s: 0.052 },
  { t: 55.2, d: 1.8, tex: String.raw`z_{n}=\left(1+\frac{i\pi}{n}\right)^{n}`, x: 0.72, y: 0.17, s: 0.052 },
  { t: 57.9, d: 3.2, tex: String.raw`\lim_{n\to\infty}\left(1+\frac{i\pi}{n}\right)^{n}=e^{i\pi}`, x: 0.5, y: 0.27, s: 0.082 },
  { t: 72.4, d: 3.6, tex: String.raw`e^{i\pi}=-1`, x: 0.5, y: 0.27, s: 0.092 },
  { t: 77.2, d: 2.2, tex: String.raw`e^{i\pi}+1=0`, x: 0.5, y: 0.27, s: 0.092 },
];
export function eqAt(t) {
  let i = -1; for (let k = 0; k < EQ.length; k++) if (EQ[k].t <= t) i = k;
  if (i < 0) return null;
  const e = EQ[i], u = (t - e.t) / e.d;
  if (i === 0) return { tex: e.tex, x: e.x, y: e.y, s: e.s, write: eio(u), morphTo: undefined, u: 0 };
  const p = EQ[i - 1], k = eio(u), same = p.tex === e.tex;
  if (k >= 1 - 1e-9) return { tex: e.tex, x: e.x, y: e.y, s: e.s, write: 1, morphTo: undefined, u: 0 };
  return { tex: p.tex, x: lerp(p.x, e.x, k), y: lerp(p.y, e.y, k), s: lerp(p.s, e.s, k), write: 1, morphTo: same ? undefined : e.tex, u: same ? 0 : k };
}
export function drawEq(api, film, t, o = {}) {
  const q = eqAt(t); if (!q) return null;
  return api.tex(q.tex, q.x * film.width, q.y * film.height, { size: q.s * film.height, align: 'center', color: o.color ?? 'ink', write: q.write, morphTo: q.morphTo, u: q.u, stagger: 0.55 });
}

// ───────── dibujo del mundo ─────────
const role = (api, c) => api.color(c);
function line(ctx, x0, y0, x1, y1, col, lw, a = 1, dash = null) {
  ctx.save(); ctx.strokeStyle = col; ctx.globalAlpha = a; ctx.lineWidth = lw; ctx.lineCap = 'round'; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore();
}
function pts(ctx, P, col, lw, a = 1, dash = null) {
  if (P.length < 2) return;
  ctx.save(); ctx.strokeStyle = col; ctx.globalAlpha = a; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]); ctx.stroke(); ctx.restore();
}
function ring(ctx, x, y, r, col, lw, a = 1) { ctx.save(); ctx.strokeStyle = col; ctx.globalAlpha = a; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.restore(); }
function arrowTo(ctx, x0, y0, x1, y1, col, lw, a = 1, head = 9) {
  const an = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0), h = Math.min(head, len * 0.6);
  ctx.save(); ctx.strokeStyle = ctx.fillStyle = col; ctx.globalAlpha = a; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(an) * h * 0.7, y1 - Math.sin(an) * h * 0.7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - h * Math.cos(an - 0.42), y1 - h * Math.sin(an - 0.42)); ctx.lineTo(x1 - h * Math.cos(an + 0.42), y1 - h * Math.sin(an + 0.42)); ctx.closePath(); ctx.fill(); ctx.restore();
}
export const VEL = 0.34;                       // longitud de la flecha de velocidad = VEL·u·|z|

// Flecha de velocidad en cada instante: {x0,y0,x1,y1,alpha,color,kind} o null
export function velocity(film, t) {
  const V = view(film, t), z = zAt(t), r = Math.hypot(z[0], z[1]), th = Math.atan2(z[1], z[0]);
  let phi = 0, a = 0, col = 'accent2';
  if (t >= 22.8 && t < 36.2) { a = seg(t, 22.8, 23.6) * (1 - seg(t, 34.4, 35.6)); }
  else if (t >= 36.2 && t < 47.6) { phi = (PI / 2) * sm(t, ...T.turn); a = seg(t, 36.2, 36.6) * (1 - seg(t, 46.9, 47.6)); col = phi > 0.8 ? 'quant' : 'accent2'; }
  if (a <= 0.01) return null;
  const L = VEL * V.u * (t < 36.2 ? r : 1), ang = th + phi, x0 = X(V, z), y0 = Y(V, z);
  return { x0, y0, x1: x0 + L * Math.cos(ang), y1: y0 - L * Math.sin(ang), alpha: a, color: col, phi, r, th, L };
}

export function drawWorld(ctx, api, film, t) {
  const V = view(film, t), k = api.k, W = film.width, H = film.height, z = zAt(t), px = X(V, z), py = Y(V, z);
  const blue = role(api, 'accent2'), vio = role(api, 'quant'), amb = role(api, 'accent'), ink = role(api, 'ink'), shade = role(api, 'shade'), coral = role(api, 'anom');
  const fin = seg(t, 0.4, 2.0), x0 = 0.05 * W, x1 = 0.96 * W;
  // — eje real (azul): recta numérica en M01–M03; en el plano, de −2.6 a 2.8
  const ax0 = lerp(x0, X(V, [-2.7, 0]), 1 - V.line), ax1 = lerp(x1, X(V, [2.8, 0]), 1 - V.line);
  line(ctx, ax0, V.oy, lerp(ax0, ax1, eio(fin * 1.2)), V.oy, blue, 2 * k, 0.5 * fin);
  api.focus(ax0, V.oy - 8, ax1 - ax0, 16, 'recta', { weight: 0.3, hollow: 0.5, bleed: true });
  if (V.line > 0.01) for (let i = 0; i <= 8; i++) { const xx = X(V, [i, 0]); line(ctx, xx, V.oy - 6 * k, xx, V.oy + 6 * k, blue, 1.5 * k, 0.55 * fin * V.line); }
  // — eje imaginario (violeta): aparece al girar
  const ia = seg(t, 35.4, 37.4) * (1 - seg(t, 84.0, 88.0));
  if (ia > 0.01) { const top = Y(V, [0, 1.62 * (V.u > V.oy * 0.4 ? 1.05 : 1)]), bot = Y(V, [0, -0.25]); line(ctx, V.ox, bot, V.ox, lerp(bot, Math.max(top, 0.2 * H), ia), vio, 2 * k, 0.55 * ia);
    line(ctx, V.ox - 6 * k, Y(V, [0, 1]), V.ox + 6 * k, Y(V, [0, 1]), vio, 1.5 * k, 0.8 * ia); line(ctx, X(V, [1, 0]), V.oy - 6 * k, X(V, [1, 0]), V.oy + 6 * k, blue, 1.5 * k, 0.8 * ia * (1 - V.line)); }
  // — M02: dos saltos ×e (arcos azules sobre la recta)
  const hop = (a, b, ta, tb, fade) => {
    const p = seg(t, ta, ta + 1.0), al = (1 - fade) * 0.9; if (p <= 0) return;
    const xa = X(V, [a, 0]), xb = X(V, [b, 0]), h = Math.min(0.22 * (xb - xa), 86 * k * 1.5), n = 40, P = [];
    for (let i = 0; i <= Math.round(n * p); i++) { const s = i / n; P.push([lerp(xa, xb, s), V.oy - 4 * k - 4 * h * s * (1 - s)]); }
    pts(ctx, P, blue, 2.4 * k, al);
    if (p > 0.95) arrowTo(ctx, P[P.length - 2][0], P[P.length - 2][1], P[P.length - 1][0], P[P.length - 1][1], blue, 2.2 * k, al, 11 * k);
  };
  const hopFade = seg(t, 20.2, 21.6);
  hop(1, E, T.hop1[0] - 0.4, T.hop1[1], hopFade); hop(E, E * E, T.hop2[0] - 0.4, T.hop2[1], hopFade);
  // — M03: rastro del crecimiento (azul, sobre la recta) y marca de e
  if (t > T.grow[0] - 1 && t < 34.4) { const a = 1 - seg(t, 33.0, 34.2); line(ctx, X(V, [1, 0]), V.oy, px, V.oy, blue, 5 * k, 0.8 * a * seg(t, T.grow[0] - 1, T.grow[0] + 0.2)); }
  // — M04: rastro circular (ámbar) del ángulo recorrido, y regreso de M08
  const th = thetaAt(t);
  if (th > 0.01) { const P = []; const n = Math.max(2, Math.ceil(th * 40)); for (let i = 0; i <= n; i++) P.push([X(V, cis(th * i / n)), Y(V, cis(th * i / n))]); pts(ctx, P, amb, (t > 60 ? 3.4 : 2.6) * k, 0.9); }
  // — M05/M06: polígonos de Euler
  if (t >= T.run[0][0] - 1.5 && t < T.climb[1] + 0.02) {
    const R = T.run; let cur = -1; for (let i = 0; i < 3; i++) if (t >= R[i][0]) cur = i;
    for (let i = 0; i <= cur; i++) {   // los intentos anteriores quedan tenues; el actual, vivo
      const [a, b, n] = R[i], live = i === cur && t < T.climb[0], full = t >= b, up = full ? n : n * sm(t, a, b);
      if (i < cur || t >= T.climb[0]) { if (t < T.climb[0]) { const fade = 0.3; pts(ctx, polyPts(n).map((c) => [X(V, c), Y(V, c)]), amb, 1.6 * k, fade); } continue; }
      pts(ctx, polyPts(n, up).map((c) => [X(V, c), Y(V, c)]), amb, 2.4 * k, 0.85);
      if (live) for (const c of polyPts(n, Math.floor(up))) { ctx.save(); ctx.fillStyle = amb; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(X(V, c), Y(V, c), 3 * k, 0, TAU); ctx.fill(); ctx.restore(); }
    }
    // marcas de los extremos de intentos terminados (anillos)
    for (let i = 0; i < 3; i++) { const [, b, n] = R[i], eP = polyAt(n, n); const st = i < 2 ? T.back[i][0] : T.climb[0]; if (t >= st) ring(ctx, X(V, eP), Y(V, eP), 6 * k, ink, 1.6 * k, 0.55 * (1 - seg(t, T.climb[0] + 1.0, T.climb[0] + 2.0))); void b; }
    if (t >= T.climb[0]) {
      for (const d of [0.7, 0.55, 0.4, 0.28, 0.17]) { const tg = t - d; if (tg > T.climb[0]) pts(ctx, polyPts(nOfClimb(tg)).map((c) => [X(V, c), Y(V, c)]), amb, 1.8 * k, 0.4 * (1 - d / 0.9)); }   // estela: los polígonos recién pasados convergen al arco
      const n = nOfClimb(t); pts(ctx, polyPts(n).map((c) => [X(V, c), Y(V, c)]), amb, 3.2 * k, 0.95);
    }
    const nn = t >= T.climb[0] ? nOfClimb(t) : R[Math.max(0, R.findLastIndex((r) => t >= r[0]))][2], up2 = t >= T.climb[0] ? nn : Math.max(1, nn * sm(t, ...R[Math.max(0, R.findLastIndex((r) => t >= r[0]))].slice(0, 2)));
    const Q = polyPts(nn, up2).map((c) => [X(V, c), Y(V, c)]), bx = Math.min(...Q.map((q) => q[0])), by = Math.min(...Q.map((q) => q[1])), bX = Math.max(...Q.map((q) => q[0])), bY = Math.max(...Q.map((q) => q[1]));
    api.focus(bx, by, bX - bx, bY - by, 'polígono', { weight: 0.3, hollow: 0.92 });
  }
  // — la semicircunferencia exacta tras el aterrizaje
  if (t >= T.climb[1] && t < T.home[0]) { api.focus(X(V, [-1, 0]), Y(V, [0, 1]), 2 * V.u, V.u, 'semicircunferencia', { weight: 0.3, hollow: 0.92 }); const P = []; for (let i = 0; i <= 120; i++) P.push([X(V, cis(PI * i / 120)), Y(V, cis(PI * i / 120))]); pts(ctx, P, amb, 3.4 * k, 0.95); }
  // — flecha de velocidad (azul: sigue a z; violeta: de lado)
  const v = velocity(film, t);
  if (v) { arrowTo(ctx, v.x0, v.y0, v.x1, v.y1, role(api, v.color), 2.6 * k, v.alpha, 11 * k);
    if (t >= 36.2 && t < 38.6) { const r0 = 0.3 * V.u, a1 = (PI / 2) * sm(t, ...T.turn); ctx.save(); ctx.strokeStyle = vio; ctx.globalAlpha = 0.9 * v.alpha; ctx.lineWidth = 1.8 * k; ctx.beginPath(); ctx.arc(v.x0, v.y0, r0, -a1, 0); ctx.stroke(); ctx.restore(); } }
  // — pasos del polígono (flecha fantasma del paso en curso)
  if (t >= T.run[0][0] - 1.5 && t < T.climb[0]) { const R = T.run; for (let i = 0; i < 3; i++) { const [a, b, n] = R[i]; if (t >= a - 0.8 && t < b + 0.2) {
    const s = n * sm(t, a, b), K = Math.min(n - 1, Math.floor(s + 1e-9)), A = polyAt(n, K), B = polyAt(n, K + 1), al = seg(t, a - 0.8, a - 0.2) * (1 - seg(t, b - 0.1, b + 0.2));
    arrowTo(ctx, X(V, A), Y(V, A), X(V, B), Y(V, B), vio, 2.2 * k, 0.8 * al, 10 * k); } } }
  // — aterrizaje: anillo que se abre en −1
  if (t >= T.land && t < T.land + 2.6) { const p = (t - T.land) / 2.6; for (const [d, w] of [[0, 2.6], [0.35, 1.8]]) { const q = clamp(p - d / 2.6); if (q > 0 && q < 1) ring(ctx, X(V, [-1, 0]), V.oy, (10 + 92 * ease.out(q)) * k * 1.5, amb, w * k, 0.85 * (1 - q)); } }
  // — el punto z
  const gl = 0.55 + 0.1 * Math.sin(t * 1.3);
  const flash = seg(t, T.land - 0.15, T.land + 0.25) * (1 - seg(t, T.land + 0.25, T.land + 2.4));   // el aterrizaje florece: luz, no decoración (es la fuente del punto)
  api.glow(px, py, 62 * k * (1 + 3.8 * flash), 'accent', Math.min(0.95, gl + 0.45 * flash) * fin);
  ctx.save(); ctx.fillStyle = amb; ctx.globalAlpha = fin; ctx.beginPath(); ctx.arc(px, py, 8.5 * k * 1.4, 0, TAU); ctx.fill(); ctx.restore();
  api.focus(px - 16, py - 16, 32, 32, 'punto', { weight: 1 });
  return { V, z, px, py, v, th, rgba, shade, coral, ink, blue, vio, amb, H };
}

// etiqueta numérica de la recta/plano (marcas «0», «1», «e», «e²», «i», «−1»): solo las que cuentan en cada momento
export function drawTicks(api, film, t) {
  const V = view(film, t), k = api.k, a = seg(t, 1.0, 2.0), dy = 40 * k * 1.5;
  const lab = (s, c, al, dx = 0, dyy = dy, col = 'ink') => { if (al > 0.2) api.text(s, X(V, c) + dx, Y(V, c) + dyy, { role: 'body', alpha: al, color: col }); };
  if (t < 34.4) { lab('0', [0, 0], a * 0.8); lab('1', [1, 0], a); }
  if (t >= 13.4 && t < 20.4) lab('e', [E, 0], seg(t, 13.4, 14.0) * (1 - seg(t, 19.6, 20.4)));
  if (t >= 16.8 && t < 20.4) lab('e²', [E * E, 0], seg(t, 16.9, 17.6) * (1 - seg(t, 19.6, 20.4)));
  if (t >= 28.4 && t < 33.4) lab('e', [E, 0], seg(t, 28.0, 28.6) * (1 - seg(t, 32.6, 33.4)));
  if (t >= 34.4) { const f = 1 - seg(t, 84.5, 87.5); lab('1', [1, 0], seg(t, 34.4, 36.4) * f, 10 * k, dy); if (t >= 36.4) lab('i', [0, 0.55], seg(t, 36.4, 37.6) * f * (1 - seg(t, 70.2, 71.6)), 18 * k * 1.5, 0, 'quant'); }
  if (t >= T.land + 0.1 && t < 84) api.text('−1', X(V, [-1, 0]) - 4 * k, V.oy + dy, { role: 'body', alpha: seg(t, T.land + 0.1, T.land + 0.9) * (1 - seg(t, 83.5, 85)) });
}
