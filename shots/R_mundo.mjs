// «Regla» — el mundo compartido por R01–R14 (no es un shot: lo importan los shots).
// Una criatura de placas (2×3) bajo una rueda de 8 radios recibe golpes distintos. TODO es función pura de t:
//   · los golpes salen de los `sfx impact` del timeline (instante) + KINDS (qué golpe es cada uno): una sola fuente de verdad con el audio;
//   · los pasos de la rueda salen de los `sfx tick` de R02–R09/R11; la revelación, del `sfx rev` de R12;
//   · la fuerza de cada golpe es el parámetro `fuerza` del shot (lo dirige la memoria: relación `escala`);
//   · la respuesta de la criatura DECRECE con cada golpe (resp) mientras el estruendo CRECE: es la pista plantada que el giro relee.
// Proyección de mundo declarada: X,Y en unidades de alto de cuadro (H), origen = centro; view = {x,y,z} (centro y zoom del encuadre).
import { clamp, lerp, seg, smooth, hash2, spring, TAU } from '../engine/core.mjs';
import { rgba, mix } from '../engine/color.mjs';

export const KINDS = {
  R02: ['corte'], R03: ['impacto'], R04: ['calor'], R05: ['espinas'], R06: ['prensa'],
  R07: ['corte', 'impacto', 'espinas'], R08: ['calor', 'corte'], R09: ['impacto', 'corte'], R11: ['final'],
};
const CLICKS = new Set(['R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R09', 'R11']);
export const BODY = { cx: 0, cy: 0.06, w: 0.36, h: 0.5 };
export const WHEEL = { cx: 0, cy: -0.335, r: 0.105 };
const GAP = 0.008, CH = 0.014, A_CORTE = -0.62;

// ───────── tiempo del film (derivado del timeline, sin constantes por film) ─────────
const memo = new WeakMap();
export function world(film) {
  let W = memo.get(film); if (W) return W;
  const byId = Object.fromEntries(film.shots.map((s) => [s.id, s])), blows = [];
  for (const s of film.shots) { const ks = KINDS[s.id]; if (!ks) continue; (s.sfx ?? []).filter((e) => e.type === 'impact').forEach((e, i) => blows.push({ t: s.t[0] + e.at, kind: ks[i], shot: s.id, i })); }
  blows.sort((a, b) => a.t - b.t); blows.forEach((b, n) => { b.n = n; b.g = film.param(b.shot, 'fuerza', b.t); });
  const fin = blows.find((b) => b.kind === 'final'), rv = (byId.R12.sfx ?? []).find((e) => e.type === 'rev');
  const clicks = film.shots.filter((s) => CLICKS.has(s.id)).flatMap((s) => (s.sfx ?? []).filter((e) => e.type === 'tick').map((e) => s.t[0] + e.at)).sort((a, b) => a - b);
  W = { blows, pre: blows.filter((b) => b !== fin), fin, FINAL: fin.t, REV: byId.R12.t[0] + rv.at, clicks, cracks: new Map() };
  memo.set(film, W); return W;
}
export const resp = (b) => 1 / (1 + 0.3 * b.n);                         // la criatura responde cada vez menos
const bump = (d, T) => (d <= 0 ? 0 : (d / T) * Math.exp(1 - d / T));
const rise = (d, T) => (d <= 0 ? 0 : 1 - Math.exp(-d / T));
const easeOut = (u) => 1 - (1 - clamp(u)) ** 3;
const outExpo = (u) => (u >= 1 ? 1 : 1 - 2 ** (-10 * clamp(u)));
const gi = (b) => 0.45 + 0.55 * Math.min(b.g, 4.5) / 1.6;               // multiplicador de estruendo (≈1 con fuerza 1,6)

// ───────── proyección ─────────
export const proj = (film, view) => {
  const H = film.height, z = view.z;
  return { T: (x, y) => [film.width / 2 + (x - view.x) * z * H, H / 2 + (y - view.y) * z * H], L: (l) => l * z * H };
};
// patada de cámara por golpe (dentro del shot: el mundo tiembla, no la cámara falsa)
export function kick(film, t) {
  const W = world(film); let x = 0, y = 0;
  for (const b of W.blows) { const d = t - b.t; if (d < 0 || d > 0.8) continue; const a = 0.0045 * gi(b) * (b.kind === 'final' ? 2.2 : 1) * Math.exp(-d * 9); x += a * Math.cos(d * 58 + b.n * 2.1); y += a * Math.sin(d * 51 + b.n * 1.3); }
  return { x, y };
}
export const framed = (film, t, v) => { const k = kick(film, t); return { x: v.x + k.x, y: v.y + k.y, z: v.z }; };

// ───────── placas ─────────
const PLATES = [];
for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
  const inset = r === 0 ? 0.015 : 0, id = r * 2 + c;
  PLATES.push({ id, c, r, x: BODY.cx + (c - 0.5) * (BODY.w / 2), y: BODY.cy + (r - 1) * (BODY.h / 3), w: BODY.w / 2 - GAP - inset, h: BODY.h / 3 - GAP,
    D: [(hash2(id, 5) - 0.5) * 1.5 + (c - 0.5) * 0.7, (hash2(id, 6) - 0.5) * 1.1 + (r - 1) * 0.35], rot: (hash2(id, 7) - 0.5) * 6 });
}
function plateKick(b, p, d, g, R) {                                       // desplazamiento [dx, dy, rot] (H) de la placa p por el golpe b
  const A = 0.016 * (0.55 + 0.45 * Math.min(g, 4)) * resp(b), px = p.x - BODY.cx, py = p.y - BODY.cy;
  if (b.kind === 'corte') {
    const tx = Math.cos(A_CORTE), ty = Math.sin(A_CORTE), side = Math.sign(px * -ty + py * tx) || 1, o = side * A * 1.1 * (0.4 * rise(d, 0.05) + 0.6 * bump(d, 0.07));
    return [tx * o, ty * o, side * 0.02 * bump(d, 0.1)];
  }
  if (b.kind === 'impacto') { const m = Math.hypot(px, py) || 1, o = A * (0.35 * rise(d, 0.05) + 0.65 * bump(d, 0.06)); return [(px / m) * o, (py / m) * o, (hash2(p.id + b.n * 7, 3) - 0.5) * 0.05 * bump(d, 0.1)]; }
  if (b.kind === 'calor') return [0, -A * 0.5 * Math.sin(d * 42) * Math.exp(-d * 2.6) + A * 0.2 * rise(d, 0.3), 0.01 * Math.sin(d * 30 + p.id) * Math.exp(-d * 3)];
  if (b.kind === 'espinas') { const a = hash2(p.id + b.n * 13, 4) * TAU, o = A * 0.9 * (0.3 * rise(d, 0.04) + 0.7 * bump(d, 0.06)); return [Math.cos(a) * o, Math.sin(a) * o, (hash2(p.id + b.n, 9) - 0.5) * 0.03 * bump(d, 0.08)]; }
  if (b.kind === 'prensa') { const o = A * 0.8 * bump(d, 0.07); return [-Math.sign(px) * o * 0.5, (py > 0 ? 1 : -1) * o * 0.6, 0]; }
  return [0, 0, 0];
}
// pose global del cuerpo: se hunde con la ráfaga, se comprime con la prensa; vuelve al revelar
export function bodyPose(film, t) {
  const W = world(film); let sink = 0, tilt = 0, sx = 1, sy = 1;
  for (const b of W.pre) {
    const d = t - b.t; if (d < 0) continue;
    if (b.n >= 5) { const k = 0.018 * rise(d, 0.08); sink += k * gi(b) * 0.5; tilt += (b.n % 2 ? 1 : -1) * 0.006 * rise(d, 0.1); }
    if (b.kind === 'prensa') { const c = bump(d, 0.07) * 0.3 + rise(d, 0.06) * (1 - rise(d - 0.9, 0.25)) * 0.7, k = 0.14 * resp(b) * c; sx -= k; sy += k * 0.4; }
  }
  const back = t < W.REV ? 1 : 1 - smooth(seg(t, W.REV, W.REV + 0.9)), kd = t < W.FINAL ? 1 : 0 + (t < W.REV ? 1 : back);
  void kd;
  return { dy: sink * back, rot: tilt * back, sx: lerp(1, sx, back), sy: lerp(1, sy, back), back };
}
// dispersión de las placas: 0 intactas · 1 dispersas; explota con el golpe final y vuelve en reversa al revelar
export function scatter(film, t) { const W = world(film); return t < W.FINAL ? 0 : t < W.REV ? easeOut(seg(t, W.FINAL, W.FINAL + 0.9)) : 1 - outExpo(seg(t, W.REV, W.REV + 0.8)); }

// ───────── grietas / costuras ─────────
const corteGeom = (b) => { const v = b.n > 0 ? 1 : 0; return { a: A_CORTE + (hash2(b.n, 41) - 0.5) * 0.6 * v, ox: (hash2(b.n, 42) - 0.5) * 0.2 * v, oy: (hash2(b.n, 43) - 0.5) * 0.2 * v }; };
function crack(film, b) {
  const W = world(film), key = b.n; if (W.cracks.has(key)) return W.cracks.get(key);
  const R = (i) => hash2(b.n * 31 + i, 11), out = [];
  if (b.kind === 'corte') { const n = 9, G = corteGeom(b), tx = Math.cos(G.a), ty = Math.sin(G.a), ox = G.ox, oy = G.oy; out.push(Array.from({ length: n + 1 }, (_, i) => { const s = (i / n - 0.5) * 0.62, j = (R(i + 3) - 0.5) * 0.016; return [BODY.cx + ox + tx * s - ty * j, BODY.cy + oy + ty * s + tx * j]; })); }
  else if (b.kind === 'impacto') { const o = [(R(1) - 0.5) * 0.16, (R(2) - 0.5) * 0.16]; for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + R(k + 5) * 0.6, len = 0.1 + 0.14 * R(k + 12); out.push(Array.from({ length: 5 }, (_, i) => { const s = (i / 4) * len, j = (R(k * 7 + i + 20) - 0.5) * 0.02; return [BODY.cx + o[0] + Math.cos(a) * s - Math.sin(a) * j, BODY.cy + o[1] + Math.sin(a) * s + Math.cos(a) * j]; })); } }
  else if (b.kind === 'calor') { for (let k = 0; k < 3; k++) { const y = BODY.cy + (k - 1) * (BODY.h / 3) + (R(k) - 0.5) * 0.05, x0 = BODY.cx - 0.13 - R(k + 3) * 0.04, x1 = BODY.cx + 0.13 + R(k + 6) * 0.04; out.push([[x0, y], [lerp(x0, x1, 0.35), y + 0.006 * (R(k + 9) - 0.5) * 2], [lerp(x0, x1, 0.7), y - 0.006], [x1, y]]); } }
  else if (b.kind === 'espinas') { for (let k = 0; k < 3; k++) { const x = BODY.cx + (R(k * 2) - 0.5) * 0.28, y = BODY.cy + (R(k * 2 + 1) - 0.5) * 0.4; out.push([[x - 0.014, y - 0.014], [x, y + 0.004], [x + 0.014, y - 0.014]]); } }
  else if (b.kind === 'prensa') { for (const sd of [-1, 1]) out.push(Array.from({ length: 6 }, (_, i) => [BODY.cx + sd * (0.135 + 0.01 * (R(i + sd * 4) - 0.5)), BODY.cy - 0.2 + i * 0.08])); }
  W.cracks.set(key, out); return out;
}
function strokePoly(ctx, T, pts, u = 1) {                                 // polilínea proyectada, recortada a la fracción u de su longitud
  if (u <= 0) return; ctx.beginPath(); const n = pts.length - 1;
  pts.forEach(([x, y], i) => { if (i / n > u + 1e-9 && i > 0) return; const [sx, sy] = T(x, y); if (i === 0) ctx.moveTo(sx, sy); else { const f = Math.min(1, (u * n - (i - 1)) ), [px, py] = T(...pts[i - 1]); if (f >= 1) ctx.lineTo(sx, sy); else ctx.lineTo(px + (sx - px) * f, py + (sy - py) * f); } });
  ctx.stroke();
}

// ───────── dibujo ─────────
const steel = (api) => mix(api.color('shade'), api.color('ink'), 0.3);
function quad(ctx, T, L, p, off, pose, hs) {                              // placa biselada → ruta proyectada
  const cx = p.x + off[0], cy = p.y + off[1], w = p.w / 2, h = p.h / 2, c = CH, rot = off[2] + p.rot * 0 + hs, co = Math.cos(rot), si = Math.sin(rot);
  const pts = [[-w + c, -h], [w - c, -h], [w, -h + c], [w, h - c], [w - c, h], [-w + c, h], [-w, h - c], [-w, -h + c]];
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    let X = (cx - BODY.cx + x * co - y * si) * pose.sx + BODY.cx, Y = (cy - BODY.cy + x * si + y * co) * pose.sy + BODY.cy;
    const c2 = Math.cos(pose.rot), s2 = Math.sin(pose.rot), rx = X - BODY.cx, ry = Y - BODY.cy; X = BODY.cx + rx * c2 - ry * s2; Y = BODY.cy + rx * s2 + ry * c2 + pose.dy;
    const [sx, sy] = T(X, Y); if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  });
  ctx.closePath();
}
export function drawBody(ctx, api, film, t, view, o = {}) {
  const W = world(film), { T, L } = proj(film, view), pose = bodyPose(film, t), s = scatter(film, t), heatMax = Math.max(0, ...W.pre.filter((b) => b.kind === 'calor').map((b) => { const d = t - b.t; return d < 0 ? 0 : Math.min(1, rise(d, 0.12)) * Math.exp(-Math.max(0, d - 0.4) * 0.5) * gi(b) * 0.6; }));
  const al = 1 - smooth(seg(s, 0.25, 1)); if (al <= 0.01) return { al: 0, pose, T, L };
  const base = steel(api), ink = api.color('ink'), red = api.color('accent'), gold = api.color('accent2');
  const gt = t < W.REV ? 0 : smooth(seg(t, W.REV + 0.1, W.REV + 0.9)), edge = mix(ink, gold, gt), fill0 = mix(base, red, Math.min(0.85, heatMax) * 0.9), fill = mix(fill0, gold, gt * 0.18);
  ctx.save(); ctx.globalAlpha = al;
  for (const p of PLATES) {
    let dx = 0, dy = 0, dr = 0;
    if (t < W.FINAL) for (const b of W.pre) { const d = t - b.t; if (d < 0) continue; const [a, bb, c] = plateKick(b, p, d, b.g, 0); dx += a; dy += bb; dr += c; }
    const sc = t < W.FINAL ? 0 : s;
    const off = [dx + p.D[0] * sc, dy + p.D[1] * sc, dr + p.D[1] * sc * 3 + p.rot * sc];
    quad(ctx, T, L, p, off, pose, 0);
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = rgba(edge, 0.9); ctx.lineWidth = Math.max(1.5, L(0.0035)); ctx.lineJoin = 'miter'; ctx.stroke();
    if (heatMax > 0.05) { ctx.save(); ctx.clip(); ctx.fillStyle = rgba(red, 0.25 * heatMax); ctx.fillRect(0, 0, film.width, film.height); ctx.restore(); }
    quad(ctx, T, L, { ...p, w: p.w - 0.034, h: p.h - 0.034 }, off, pose, 0); ctx.strokeStyle = rgba(ink, 0.16); ctx.lineWidth = Math.max(1, L(0.002)); ctx.stroke();
    // bisel: luz de borde arriba-izquierda
    const [x0, y0] = T(p.x + off[0] - p.w / 2 + CH * 0.5, p.y + off[1] - p.h / 2 + 0.002), [x1] = T(p.x + off[0] + p.w / 2 - CH * 1.5, 0);
    ctx.strokeStyle = rgba(ink, 0.5); ctx.lineWidth = Math.max(1, L(0.0022)); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
  }
  // grietas (rojas hasta el golpe final) y costuras de oro (después)
  const crackAl = t < W.FINAL ? 1 : t < W.REV ? 0 : 1;
  if (crackAl) for (const b of W.pre.filter((q) => q.n < 7)) {
    const d = t - b.t; if (d < 0) continue; const pts = crack(film, b), tp = (c) => { const [sx, sy] = T(c[0], c[1]); return [sx, sy]; };
    void tp;
    const T2 = (x, y) => T(x, y + pose.dy);
    if (t < W.FINAL) {
      const u = clamp(d / 0.12), hot = Math.exp(-d * 1.2);
      for (const pl of pts) { ctx.strokeStyle = rgba(red, 0.35 + 0.5 * hot); ctx.lineWidth = Math.max(2.5, L(0.011)); ctx.lineCap = 'round'; strokePoly(ctx, T2, pl, u); ctx.strokeStyle = rgba(api.color('paper'), 0.9); ctx.lineWidth = Math.max(1.4, L(0.0045)); strokePoly(ctx, T2, pl, u); }
    } else {
      const k = b.n, u = clamp((t - W.REV - 0.12 - 0.09 * k) / 0.35), pul = 0.65 + 0.35 * Math.sin((t - W.REV) * 2.2 + k);
      for (const pl of pts) { ctx.strokeStyle = rgba(gold, 0.35 * pul * u); ctx.lineWidth = Math.max(3, L(0.012)); ctx.lineCap = 'round'; strokePoly(ctx, T2, pl, u); ctx.strokeStyle = rgba(gold, 0.95 * u); ctx.lineWidth = Math.max(1.4, L(0.0035)); strokePoly(ctx, T2, pl, u); }
    }
  }
  ctx.restore();
  return { al, pose, T, L, gt };
}
// el núcleo: rombo entre las placas; apagado hasta el revelado
export function drawCore(ctx, api, film, t, view) {
  const W = world(film), { T, L } = proj(film, view), pose = bodyPose(film, t), s = scatter(film, t), al = 1 - smooth(seg(s, 0.1, 0.8)), gt = t < W.REV ? 0 : smooth(seg(t, W.REV + 0.2, W.REV + 1.0));
  if (al <= 0.01) return;
  const [x, y] = T(BODY.cx, BODY.cy + pose.dy), r = L(0.028), col = mix(api.color('shade'), api.color('accent2'), gt), pul = 1 + 0.08 * gt * Math.sin(t * 5);
  if (gt > 0.02) api.glow(x, y, r * 5, 'accent2', 0.55 * gt * al);
  ctx.save(); ctx.globalAlpha = al; ctx.fillStyle = rgba(col, 0.55 + 0.45 * gt); ctx.beginPath(); ctx.moveTo(x, y - r * pul); ctx.lineTo(x + r * 0.7 * pul, y); ctx.lineTo(x, y + r * pul); ctx.lineTo(x - r * 0.7 * pul, y); ctx.closePath(); ctx.fill(); ctx.restore();
}
// la rueda: 8 radios y 8 asas; da un paso de 45° con cada tic (muelle con rebote); las asas se encienden tenuemente, una por golpe
export function wheelPose(film, t) {
  const W = world(film), pose = bodyPose(film, t), dim = t >= W.FINAL && t < W.REV ? 0.5 + 0.5 * smooth(seg(t, W.REV - 0.4, W.REV)) : 1;
  let th = 0.045 * Math.min(t, W.FINAL) + 0.03 * Math.max(0, t - W.REV), n = 0;     // deriva lenta; quieta en el silencio
  for (const c of W.clicks) if (t >= c) { th += (Math.PI / 4) * spring(t - c, { omega: 26, zeta: 0.42 }); n++; }
  return { x: WHEEL.cx, y: WHEEL.cy + pose.dy * 0.5, r: WHEEL.r, th, n, dim, gt: t < W.REV ? 0 : smooth(seg(t, W.REV, W.REV + 0.7)) };
}
export function drawWheel(ctx, api, film, t, view, o = {}) {
  const w = wheelPose(film, t), W = world(film), { T, L } = proj(film, view), [x, y] = T(w.x, w.y), r = L(w.r), ink = api.color('ink'), gold = api.color('accent2'), gt = w.gt, hint = o.hint ?? 0.3;
  const body = mix(ink, gold, gt), echo = o.echo ?? 0;
  if (gt > 0.01 || echo > 0.01) api.glow(x, y, r * 3.2, 'accent2', 0.45 * Math.max(gt, echo) * w.dim);
  ctx.save(); ctx.globalAlpha = w.dim; ctx.lineCap = 'round';
  // tirantes al cuerpo
  const [bx, by] = T(BODY.cx, BODY.cy - BODY.h / 2 + bodyPose(film, t).dy); ctx.strokeStyle = rgba(ink, 0.35 * (scatter(film, t) < 0.5 ? 1 : 0)); ctx.lineWidth = Math.max(1, L(0.003));
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + sd * r * 0.55, y + r * 0.82); ctx.lineTo(bx + sd * L(0.05), by); ctx.stroke(); }
  ctx.strokeStyle = rgba(body, 0.95); ctx.lineWidth = Math.max(2, L(0.012)); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  ctx.lineWidth = Math.max(1.5, L(0.005)); ctx.beginPath(); ctx.arc(x, y, r * 0.3, 0, TAU); ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = w.th + (i * TAU) / 8, c = Math.cos(a), s = Math.sin(a), lit = i < w.n || (echo > 0 && i < echo * 8);
    ctx.strokeStyle = rgba(body, 0.9); ctx.lineWidth = Math.max(1.5, L(0.0055)); ctx.beginPath(); ctx.moveTo(x + c * r * 0.3, y + s * r * 0.3); ctx.lineTo(x + c * r * 1.0, y + s * r * 1.0); ctx.stroke();
    const k = gt > 0 ? 1 : lit ? hint : 0, hc = mix(ink, gold, Math.max(gt, lit ? Math.max(hint, echo > 0 && i < echo * 8 ? 1 : 0) : 0));
    ctx.strokeStyle = rgba(hc, lit || gt > 0 ? 0.35 + 0.65 * Math.max(k, echo > 0 && i < echo * 8 ? 1 : 0) : 0.8); ctx.lineWidth = Math.max(2, L(0.0085));
    ctx.beginPath(); ctx.moveTo(x + c * r * 1.0, y + s * r * 1.0); ctx.lineTo(x + c * r * 1.2, y + s * r * 1.2); ctx.stroke();
    if (lit || gt > 0) { ctx.fillStyle = rgba(gold, (gt > 0 ? 0.9 : hint * 1.4)); ctx.beginPath(); ctx.arc(x + c * r * 1.2, y + s * r * 1.2, Math.max(2, L(0.0075)), 0, TAU); ctx.fill(); }
  }
  ctx.restore();
  void W;
  return { x, y, r, w };
}

// ───────── golpes: FX ─────────
const sh = (ctx, fn) => { ctx.save(); fn(); ctx.restore(); };
function slash(ctx, S, E, wmax, color, alpha) {
  const n = 28; ctx.fillStyle = color; ctx.globalAlpha = alpha; ctx.beginPath();
  const dx = E[0] - S[0], dy = E[1] - S[1], m = Math.hypot(dx, dy) || 1, nx = -dy / m, ny = dx / m, pts = [];
  for (let i = 0; i <= n; i++) { const u = i / n, w = wmax * Math.sin(Math.PI * u) ** 0.6; pts.push([S[0] + dx * u + nx * w, S[1] + dy * u + ny * w]); }
  for (let i = n; i >= 0; i--) { const u = i / n, w = wmax * Math.sin(Math.PI * u) ** 0.6; pts.push([S[0] + dx * u - nx * w, S[1] + dy * u - ny * w]); }
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill();
}
function embers(ctx, b, d, n, ox, oy, T, L, o) {                          // chispas balísticas deterministas
  if (d < 0 || d > o.life) return;
  for (let i = 0; i < n; i++) {
    const R = (k) => hash2(b.n * 977 + i * 13 + k, 21), a = o.angle + (R(1) - 0.5) * o.spread, sp = o.speed * (0.35 + 0.65 * R(2)), life = o.life * (0.5 + 0.5 * R(3));
    if (d > life) continue; const u = d / life, x = ox + Math.cos(a) * sp * d * (1 - 0.35 * u), y = oy + Math.sin(a) * sp * d * (1 - 0.35 * u) + o.g * d * d;
    const [sx, sy] = T(x, y); ctx.fillStyle = rgba(o.color(R(4)), (1 - u) ** 1.3 * o.alpha); const rr = Math.max(1, L(o.size * (0.5 + R(5)) * (1 - 0.6 * u))); ctx.fillRect(sx - rr, sy - rr, rr * 2, rr * 2);
  }
}
export function drawBlows(ctx, api, film, t, view) {
  const W = world(film), { T, L } = proj(film, view), pose = bodyPose(film, t), ink = api.color('ink'), red = api.color('accent'), gold = api.color('accent2');
  const cy = BODY.cy + pose.dy, [fx, fy] = T(BODY.cx, cy), Hh = film.height;
  for (const b of W.blows) {
    const d = t - b.t; if (d < -0.65 || d > 2.4) continue; const g = gi(b), R = resp(b);
    if (b.kind === 'corte') {
      const G = corteGeom(b), a = G.a, tx = Math.cos(a), ty = Math.sin(a), len = 2.1, ox = G.ox, oy = G.oy;
      const Sx = BODY.cx + ox - tx * len / 2, Sy = cy + oy - ty * len / 2, Ex = BODY.cx + ox + tx * len / 2, Ey = cy + oy + ty * len / 2;
      if (d < 0) { const u = clamp((d + 0.55) / 0.55); sh(ctx, () => { ctx.strokeStyle = rgba(red, 0.75 * u * u); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(...T(Sx, Sy)); ctx.lineTo(...T(Ex, Ey)); ctx.stroke(); }); }
      else if (d < 0.7) { const hd = clamp(d / 0.045), e2 = lerp(0, 1, hd), fade = Math.exp(-d * 6); const S = T(Sx, Sy), E = T(Sx + (Ex - Sx) * e2, Sy + (Ey - Sy) * e2); sh(ctx, () => { slash(ctx, S, E, L(0.045 * g * 0.7), red, 0.75 * fade); slash(ctx, S, E, L(0.014 * g), ink, fade); }); }
      if (d >= 0 && d < 1.2) embers(ctx, b, d, Math.round(10 + 6 * g), BODY.cx + ox, cy + oy, T, L, { angle: a - Math.PI / 2, spread: 2.6, speed: 0.55 * g, life: 1.0, g: 0.5, size: 0.006, alpha: 0.9, color: (r) => (r < 0.5 ? ink : red) });
    } else if (b.kind === 'impacto') {
      if (d < 0) { const u = clamp((d + 0.55) / 0.55); sh(ctx, () => { ctx.strokeStyle = rgba(red, 0.75 * u * u); ctx.lineWidth = 1.4; for (let k = 0; k < 6; k++) { const aa = (k / 6) * TAU; ctx.beginPath(); ctx.moveTo(...T(BODY.cx + Math.cos(aa) * (0.6 - 0.4 * u), cy + Math.sin(aa) * (0.6 - 0.4 * u))); ctx.lineTo(...T(BODY.cx + Math.cos(aa) * (0.58 - 0.4 * u), cy + Math.sin(aa) * (0.58 - 0.4 * u))); ctx.stroke(); } }); }
      else if (d < 1.0) sh(ctx, () => { for (let k = 0; k < 3; k++) { const dk = d - 0.05 * k; if (dk <= 0) continue; const r = L(0.05 + (0.45 + 0.1 * k) * g * 0.8 * (1 - Math.exp(-dk * 5))), f = Math.max(0, 1 - dk / 0.8); ctx.strokeStyle = rgba(k ? red : ink, f * (k ? 0.8 : 1)); ctx.lineWidth = Math.max(1.5, L(0.016 * f * g)); ctx.beginPath(); ctx.arc(fx, fy, r, 0, TAU); ctx.stroke(); }
        if (d < 0.2) { ctx.strokeStyle = rgba(ink, 0.8 * (1 - d / 0.2)); ctx.lineWidth = 1.6; for (let k = 0; k < 18; k++) { const aa = (k / 18) * TAU + 0.1, r1 = L(0.07 + 0.3 * d * 6), r2 = r1 + L(0.12 + 0.12 * hash2(k, 44)); ctx.beginPath(); ctx.moveTo(fx + Math.cos(aa) * r1, fy + Math.sin(aa) * r1); ctx.lineTo(fx + Math.cos(aa) * r2, fy + Math.sin(aa) * r2); ctx.stroke(); } } });
      if (d >= 0 && d < 1.2) embers(ctx, b, d, Math.round(12 + 8 * g), BODY.cx, cy, T, L, { angle: 0, spread: TAU, speed: 0.6 * g, life: 0.9, g: 0.6, size: 0.005, alpha: 0.9, color: (r) => (r < 0.6 ? ink : red) });
    } else if (b.kind === 'calor') {
      const k = d < 0 ? 0 : rise(d, 0.15) * Math.exp(-Math.max(0, d - 0.5) * 1.1);
      if (k > 0.01) { api.glow(fx, fy, L(0.5) * (0.9 + 0.2 * g), 'accent', 0.6 * k * Math.min(1, g)); sh(ctx, () => { ctx.strokeStyle = rgba(red, 0.7 * k); ctx.lineCap = 'round'; for (let i = 0; i < 30; i++) { const aa = (i / 30) * TAU + 0.07, fl = 0.55 + 0.45 * Math.sin(t * 19 + i * 2.3), r1 = L(0.27 + 0.02 * hash2(i, 45)), r2 = r1 + L((0.08 + 0.2 * hash2(i, 46)) * fl * k * g); ctx.lineWidth = Math.max(1.5, L(0.006 + 0.006 * hash2(i, 47))); ctx.beginPath(); ctx.moveTo(fx + Math.cos(aa) * r1, fy + Math.sin(aa) * r1 * 1.05); ctx.lineTo(fx + Math.cos(aa) * r2, fy + Math.sin(aa) * r2 * 1.05); ctx.stroke(); } }); }
      if (d < 0) { const u = clamp((d + 0.6) / 0.6); api.glow(fx, fy, L(0.35) * u, 'accent', 0.25 * u * u); }
      if (d > 0 && d < 2.4) embers(ctx, b, d, Math.round(26 + 8 * g), BODY.cx, cy + 0.1, T, L, { angle: -Math.PI / 2, spread: 1.4, speed: 0.32 * g, life: 2.2, g: -0.04, size: 0.0045, alpha: 0.95, color: (r) => (r < 0.5 ? gold : red) });
    } else if (b.kind === 'espinas') {
      const N = 7;
      for (let i = 0; i < N; i++) {
        const ang = [-2.7, -2.0, -1.3, -0.4, 0.5, 1.3, 2.2][i], tx = BODY.cx + (hash2(i + b.n * 3, 48) - 0.5) * 0.26, ty = cy + (hash2(i + b.n * 3, 49) - 0.5) * 0.4, ta = b.t - (N - 1 - i) * 0.022 - 0.0, dd = t - ta;
        if (dd < -0.25 || dd > (t < W.REV ? 99 : 0.8)) continue; const far = 1.1, u = outExpo(clamp((dd + 0.1) / 0.1)), len = 0.95, back = t >= W.REV ? smooth(seg(t, W.REV, W.REV + 0.7)) : 0;
        const dirx = Math.cos(ang), diry = Math.sin(ang), bx = tx - dirx * far * (1 - u) - dirx * 0.9 * back, by = ty - diry * far * (1 - u) - diry * 0.9 * back;    // base de la espina; la punta está en (bx,by)+dir*len
        const tipx = bx + dirx * 0.0, tipy = by + diry * 0.0, vib = dd > 0 ? 0.006 * Math.exp(-dd * 8) * Math.sin(dd * 70 + i) : 0;
        const tail = [tipx - dirx * len + vib * -diry, tipy - diry * len + vib * dirx], w = 0.014 * (0.7 + 0.3 * g), px = -diry * w, py = dirx * w;
        sh(ctx, () => { ctx.globalAlpha = 1 - back; ctx.fillStyle = mix(steel(api), ink, 0.35); ctx.beginPath(); ctx.moveTo(...T(tipx, tipy)); ctx.lineTo(...T(tail[0] + px, tail[1] + py)); ctx.lineTo(...T(tail[0] - px, tail[1] - py)); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = rgba(red, 0.9); ctx.lineWidth = Math.max(1.5, L(0.0035)); ctx.stroke();
          if (dd > 0 && dd < 0.35) { ctx.fillStyle = rgba(red, (1 - dd / 0.35) * 0.9); const [sx, sy] = T(tipx, tipy), rr = L(0.03 * (1 - dd / 0.35)); ctx.beginPath(); ctx.arc(sx, sy, rr, 0, TAU); ctx.fill(); } });
      }
    } else if (b.kind === 'prensa') {
      const reach = BODY.w / 2 + 0.005, ax = reach + 0.9, c1 = d < 0 ? 1 - Math.exp(-((d + 0.55) / 0.55) * 0) : 1, x0 = d < -0.45 ? ax : d < 0 ? lerp(ax, reach + 0.04, ((d + 0.45) / 0.45) ** 2) : 0;
      let off;
      if (d < -0.45) off = ax; else if (d < 0) off = lerp(ax, reach + 0.03, ((d + 0.45) / 0.45) ** 2.4); else if (d < 0.08) off = lerp(reach + 0.03, reach - 0.012, d / 0.08); else if (d < 0.9) off = reach - 0.012; else off = lerp(reach - 0.012, ax, easeOut((d - 0.9) / 0.9));
      void c1; void x0;
      sh(ctx, () => { for (const sd of [-1, 1]) { const [x, y] = T(BODY.cx + sd * (off + 0.25), cy), w = L(0.5), h = L(0.74); ctx.fillStyle = mix(steel(api), api.color('paper'), 0.35); ctx.strokeStyle = rgba(ink, 0.9); ctx.lineWidth = Math.max(2, L(0.005)); ctx.fillRect(x - w / 2, y - h / 2, w, h); ctx.strokeRect(x - w / 2, y - h / 2, w, h);
        ctx.strokeStyle = rgba(red, 0.7); ctx.lineWidth = Math.max(2, L(0.006)); ctx.beginPath(); ctx.moveTo(x - sd * w / 2, y - h / 2); ctx.lineTo(x - sd * w / 2, y + h / 2); ctx.stroke(); } });
      if (d >= 0 && d < 1.0) embers(ctx, b, d, 18, BODY.cx, cy + 0.2, T, L, { angle: -Math.PI / 2, spread: 3.0, speed: 0.4 * g, life: 0.9, g: 0.5, size: 0.006, alpha: 0.8, color: (r) => (r < 0.7 ? ink : red) });
    } else if (b.kind === 'final') {
      const k = d < 0 ? 0 : 1;
      if (d >= 0 && d < 1.6) {
        const f = Math.exp(-d * 5), [bx0, by0] = T(BODY.cx, cy);
        sh(ctx, () => { ctx.fillStyle = rgba(ink, d < 0.1 ? 1 : Math.max(0, 1 - (d - 0.1) / 0.16)); ctx.fillRect(0, 0, film.width, film.height);
          if (d >= 0.1) { ctx.fillStyle = rgba(red, Math.min(0.9, 0.9 * Math.exp(-(d - 0.1) * 2.0))); ctx.fillRect(0, 0, film.width, film.height); }
          for (let q = 0; q < 3; q++) { const dk = d - 0.03 * q, r = L(0.1 + 1.3 * (1 - Math.exp(-dk * 4)) * (1 + 0.2 * q)); if (dk <= 0) continue; ctx.strokeStyle = rgba(q ? red : api.color('paper'), Math.max(0, 1 - dk / 1.1)); ctx.lineWidth = Math.max(2, L(0.04 * (1 - dk / 1.1))); ctx.beginPath(); ctx.arc(bx0, by0, r, 0, TAU); ctx.stroke(); } });
        embers(ctx, b, d, 60, BODY.cx, cy, T, L, { angle: 0, spread: TAU, speed: 1.1, life: 1.6, g: 0.1, size: 0.007, alpha: 1, color: (r) => (r < 0.4 ? ink : r < 0.7 ? gold : red) });
      }
      void k;
    }
  }
}
// la hoja de luz: se forma sobre la criatura durante la carga (tension 0→1) y cae en el golpe final
export function drawBlade(ctx, api, film, t, view, tension) {
  const W = world(film), { T, L } = proj(film, view), d = t - W.FINAL, red = api.color('accent'), ink = api.color('ink');
  if (t >= W.FINAL + 0.35) return;
  const tn = clamp(tension), tipY = d < 0 ? lerp(-0.56, -0.40, tn ** 1.2) : lerp(-0.44, 0.5, outExpo(d / 0.05)), [tx, ty] = T(0, tipY), [x0, y0] = T(0, -0.8);
  const w = d < 0 ? L(0.004 + 0.012 * tn) : L(0.016 + 0.2 * Math.exp(-Math.max(0, d) * 9));
  sh(ctx, () => {
    if (tn > 0.02 || d >= 0) { ctx.strokeStyle = rgba(red, 0.55 * tn ** 1.5 * (d < 0 ? 1 : 0)); ctx.lineWidth = 1.4; for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU + 0.2, rr = 1.1 * (1 - 0.82 * tn ** 1.2) , [ex, ey] = T(Math.cos(a) * rr * 0.9, tipY + Math.sin(a) * rr * 0.65); ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(tx + (ex - tx) * 0.78, ty + (ey - ty) * 0.78); ctx.stroke(); } }
    const f = d < 0 ? 1 : Math.exp(-d * 8); ctx.fillStyle = rgba(ink, f); ctx.beginPath(); ctx.moveTo(x0 - w, y0); ctx.lineTo(x0 + w, y0); ctx.lineTo(tx + w * 0.15, ty - L(0.02)); ctx.lineTo(tx, ty); ctx.lineTo(tx - w * 0.15, ty - L(0.02)); ctx.closePath(); ctx.fill();
    api.glow(tx, ty, L(0.2 + 0.25 * tn), 'accent', 0.5 * tn * (d < 0 ? 1 : 0));
  });
}
// polvo del silencio: motas hacia arriba tras el golpe final (energía mínima, pero viva)
export function drawDust(ctx, api, film, t, view) {
  const W = world(film), { T, L } = proj(film, view); if (t < W.FINAL + 0.5 || t > W.REV + 1.2) return;
  const a = smooth(seg(t, W.FINAL + 0.5, W.FINAL + 1.8)) * (1 - smooth(seg(t, W.REV, W.REV + 1.0)));
  sh(ctx, () => { for (let i = 0; i < 36; i++) { const x0 = (hash2(i, 61) - 0.5) * 1.5, y0 = 0.15 + 0.5 * hash2(i, 62), v = 0.012 + 0.03 * hash2(i, 63), ph = hash2(i, 64) * TAU, [sx, sy] = T(x0 + 0.012 * Math.sin(t * 0.7 + ph), y0 - v * (t - W.FINAL)); const rr = Math.max(0.8, L(0.0016 + 0.0032 * hash2(i, 65)));
    ctx.fillStyle = rgba(hash2(i, 66) < 0.15 ? api.color('accent') : api.color('ink'), a * (0.1 + 0.22 * hash2(i, 67))); ctx.fillRect(sx - rr, sy - rr, rr * 2, rr * 2); } });
}
// fondo: suelo y pilares de hormigón en la penumbra (parallax lo pone el motor con api.depth)
export function drawBackdrop(ctx, api, film, view, o = {}) {
  const { T, L } = proj(film, view), mood = o.mood ?? 1, ink = api.color('ink');
  api.depth(0.3, () => {
    for (const [x, w, h] of [[-0.62, 0.12, 0.9], [-0.44, 0.05, 0.7], [0.5, 0.05, 0.75], [0.7, 0.14, 1.0]]) { const [sx, sy] = T(x, 0.5 - h / 2 + 0.34), ww = L(w), hh = L(h); ctx.fillStyle = rgba(api.color('shade'), 0.35 * mood); ctx.fillRect(sx - ww / 2, sy - hh / 2, ww, hh); }
  });
  const gy = T(0, BODY.cy + BODY.h / 2 + 0.035)[1];
  ctx.save(); ctx.fillStyle = rgba(api.color('shade'), 0.5 * mood); ctx.fillRect(-film.width, gy, 3 * film.width, 3 * film.height); ctx.fillStyle = rgba(ink, 0.35 * mood); ctx.fillRect(-film.width, gy - 1, 3 * film.width, 2); ctx.restore();
}
// aviso previo al golpe (pre-silencio visual): oscurece el cuadro y la rueda contiene el aliento
export function tell(ctx, film, t) {
  const W = world(film); let u = 0;
  for (const b of W.blows) { const d = b.t - t; if (b.kind !== 'final' && d > 0 && d < 0.45) u = Math.max(u, 1 - d / 0.45); }
  if (u > 0) { ctx.save(); ctx.fillStyle = `rgba(0,0,0,${0.32 * u * u})`; ctx.fillRect(0, 0, film.width, film.height); ctx.restore(); }
}
// rótulo: se funde con muelle y sobre una placa oscura que lo separa del detalle
export function caption(api, film, t, str, t0, t1, o = {}) {
  if (t < t0 || t > t1 + 0.4) return;
  const a = api.spring(t - t0) * clamp((t1 + 0.4 - t) / 0.4), role = o.role ?? 'h2', [x, y] = o.at ?? api.at(0.5, 0.93);
  api.text(str, x, y, { role, color: o.color ?? 'ink', alpha: clamp(a), tracking: o.tracking });
}

// ───────── el hilo rojo del atacante ─────────
export function drawThread(ctx, api, film, t, view, headX, o = {}) {
  const { T, L } = proj(film, view), red = api.color('accent'), [hx, hy] = T(headX, BODY.cy), [ex] = T(-1.2, 0), k = o.k ?? 1, pul = 0.6 + 0.4 * Math.sin(t * 6);
  api.glow(hx, hy, L(0.09 * k), 'accent', 0.5 * pul * (o.a ?? 1));
  sh(ctx, () => { ctx.globalAlpha = o.a ?? 1; ctx.strokeStyle = rgba(red, 0.7); ctx.lineWidth = Math.max(1.5, L(0.0035)); ctx.beginPath(); ctx.moveTo(ex, hy); ctx.lineTo(hx, hy); ctx.stroke(); ctx.fillStyle = rgba(red, 0.95); ctx.beginPath(); ctx.arc(hx, hy, Math.max(2.5, L(0.008 * k)), 0, TAU); ctx.fill(); });
}

// ───────── eco dorado de un golpe releído (R12): u 0→1, s = fuerza del eco ─────────
export const ECO_KIND = { 'golpe-corte': 'corte', 'golpe-impacto': 'impacto', 'golpe-calor': 'calor', 'golpe-espinas': 'espinas', 'golpe-prensa': 'prensa', rafaga: 'rafaga', rueda: 'rueda' };
export function drawEcho(ctx, api, film, view, kind, u, s) {
  if (u <= 0 || u >= 1) return; const { T, L } = proj(film, view), gold = api.color('accent2'), f = (1 - u) ** 1.2, [fx, fy] = T(BODY.cx, BODY.cy), k = 0.35 + 0.65 * s;
  sh(ctx, () => {
    ctx.strokeStyle = rgba(gold, f); ctx.fillStyle = rgba(gold, f); ctx.lineWidth = Math.max(2, L(0.008 * k)); ctx.lineCap = 'round';
    if (kind === 'corte') { const tx = Math.cos(A_CORTE), ty = Math.sin(A_CORTE), hd = clamp(u / 0.25); ctx.beginPath(); ctx.moveTo(...T(-tx * 1.0, BODY.cy - ty * 1.0)); ctx.lineTo(...T(-tx * 1.0 + 2 * tx * hd, BODY.cy - ty * 1.0 + 2 * ty * hd)); ctx.stroke(); }
    else if (kind === 'impacto') { ctx.beginPath(); ctx.arc(fx, fy, L(0.05 + 0.4 * k * easeOut(u)), 0, TAU); ctx.stroke(); }
    else if (kind === 'calor') { for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU, r1 = L(0.27), r2 = r1 + L(0.1 * k * (0.5 + hash2(i, 45))); ctx.beginPath(); ctx.moveTo(fx + Math.cos(a) * r1, fy + Math.sin(a) * r1); ctx.lineTo(fx + Math.cos(a) * r2, fy + Math.sin(a) * r2); ctx.stroke(); } }
    else if (kind === 'espinas') { for (let i = 0; i < 7; i++) { const a = [-2.7, -2.0, -1.3, -0.4, 0.5, 1.3, 2.2][i], r1 = L(0.12 + 0.55 * (1 - easeOut(u * 1.4))), r2 = L(0.12); ctx.beginPath(); ctx.moveTo(fx + Math.cos(a) * r1 * 1.6, fy + Math.sin(a) * r1 * 1.6); ctx.lineTo(fx + Math.cos(a) * r2, fy + Math.sin(a) * r2); ctx.stroke(); } }
    else if (kind === 'prensa') { const o = lerp(0.5, BODY.w / 2 + 0.01, easeOut(u * 2)); for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(...T(BODY.cx + sd * o, BODY.cy - 0.28)); ctx.lineTo(...T(BODY.cx + sd * o, BODY.cy + 0.28)); ctx.stroke(); } }
    else if (kind === 'rafaga') { for (let i = 0; i < 3; i++) { const a = A_CORTE + (i - 1) * 0.5, c = Math.cos(a), sn = Math.sin(a); ctx.beginPath(); ctx.moveTo(...T(-c * 0.5, BODY.cy - sn * 0.5 + (i - 1) * 0.08)); ctx.lineTo(...T(c * 0.5, BODY.cy + sn * 0.5 + (i - 1) * 0.08)); ctx.stroke(); } }
  });
}

// ───────── composición común de un shot ─────────
// o: { view:{x,y,z}, tension, caps:[{str,t0,t1,color,role,at}], thread:{x,k,a}, wheelEcho, echoes:[{kind,u,s}], mood, bleed, impactColor }
export function renderShot(ctx, api, film, shot, t, o) {
  const W = world(film), view = framed(film, t, o.view), { T, L } = proj(film, view);
  drawBackdrop(ctx, api, film, view, { mood: o.mood ?? 1 });
  drawBody(ctx, api, film, t, view); drawCore(ctx, api, film, t, view);
  const wh = drawWheel(ctx, api, film, t, view, { echo: o.wheelEcho ?? 0 });
  if (o.thread) drawThread(ctx, api, film, t, view, o.thread.x, o.thread);
  drawBlows(ctx, api, film, t, view);
  if (o.tension !== undefined) drawBlade(ctx, api, film, t, view, o.tension);
  for (const e of o.echoes ?? []) drawEcho(ctx, api, film, view, e.kind, e.u, e.s);
  drawDust(ctx, api, film, t, view);
  tell(ctx, film, t);
  // foco: el cuerpo (o la zona de impacto en planos cerrados); la rueda en planos de rueda
  const [x0, y0] = T(-BODY.w / 2, BODY.cy - BODY.h / 2), [x1, y1] = T(BODY.w / 2, BODY.cy + BODY.h / 2);
  if (o.focus === 'wheel') api.focus(wh.x - wh.r * 1.3, wh.y - wh.r * 1.3, wh.r * 2.6, wh.r * 2.6, 'rueda', { weight: 1, bleed: true });
  else api.focus(x0, y0, x1 - x0, y1 - y0, 'criatura', { weight: 1, bleed: !!o.bleed });
  for (const c of o.caps ?? []) {
    if (t < c.t0 || t > c.t1 + 0.4) continue; const a = api.spring(t - c.t0) * clamp((c.t1 + 0.4 - t) / 0.4), [x, y] = c.at ?? api.at(0.5, 0.93), role = c.role ?? 'h2', sz = api.sizes[role];
    ctx.save(); ctx.globalAlpha = 0.55 * clamp(a); ctx.fillStyle = api.color('paper'); const w = Math.max(240, c.str.length * sz * 0.62); ctx.fillRect(x - w / 2, y - sz * 0.8, w, sz * 1.6); ctx.restore();
    api.text(c.str, x, y, { role, color: c.color ?? 'ink', alpha: clamp(a) });
  }
  for (const b of W.blows) if (b.shot === shot.id) { const [ix, iy] = T(BODY.cx, BODY.cy); api.impact(b.t - shot.t[0], { frames: 2, mode: b.kind === 'final' ? 'both' : 'burst', x: ix, y: iy, color: 'ink' }); }
  return { view, T, L, wh };
}
export const wheelEntity = (view) => (t, film) => { const { T, L } = proj(film, view), w = wheelPose(film, t), [x, y] = T(w.x, w.y); return { x, y, s: L(w.r), role: 'ink' }; };
