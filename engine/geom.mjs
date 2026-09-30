// Geometría vectorial unificada. TODO (glifos TeX, iconos SVG, formas del motivo, mapas) se normaliza a:
//   Shape = { contours: [ { closed, d: [x0,y0, c1x,c1y,c2x,c2y,x1,y1, ...] } ], w?, h? }   (Béziers cúbicas)
// Así un solo algoritmo sirve para morph, draw-on (trim), deformación y proyección 2.5D.
// Puro. Las memorias (WeakMap) son cachés de resultados deterministas, no estado de película.
import { lerp, clamp, noise1 } from './core.mjs';

// ───────── parser SVG path (M L H V C S Q T A Z, abs/rel) → cúbicas ─────────
export function parsePath(str) {
  const tok = String(str).match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
  const contours = []; let cur = null, i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, lc = null, lq = null;
  const num = () => +tok[i++];
  const start = (X, Y) => { cur = { closed: false, d: [X, Y] }; contours.push(cur); sx = X; sy = Y; };
  const cub = (a, b, c, d, e, f) => { if (!cur) start(x, y); cur.d.push(a, b, c, d, e, f); x = e; y = f; };
  const line = (X, Y) => cub(x + (X - x) / 3, y + (Y - y) / 3, x + (2 * (X - x)) / 3, y + (2 * (Y - y)) / 3, X, Y);
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
    const rel = cmd === cmd.toLowerCase() && cmd !== 'z', C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'Z') { if (cur) { if (Math.hypot(x - sx, y - sy) > 1e-9) line(sx, sy); cur.closed = true; } x = sx; y = sy; cur = null; lc = lq = null; continue; }
    if (C === 'M') { const X = num() + ox, Y = num() + oy; start(X, Y); x = X; y = Y; cmd = rel ? 'l' : 'L'; lc = lq = null; continue; }
    if (C === 'L') { line(num() + ox, num() + oy); lc = lq = null; }
    else if (C === 'H') { line(num() + (rel ? x : 0), y); lc = lq = null; }
    else if (C === 'V') { line(x, num() + (rel ? y : 0)); lc = lq = null; }
    else if (C === 'C') { const a = num() + ox, b = num() + oy, c = num() + ox, d = num() + oy, e = num() + ox, f = num() + oy; cub(a, b, c, d, e, f); lc = [c, d]; lq = null; }
    else if (C === 'S') { const a = lc ? 2 * x - lc[0] : x, b = lc ? 2 * y - lc[1] : y, c = num() + ox, d = num() + oy, e = num() + ox, f = num() + oy; cub(a, b, c, d, e, f); lc = [c, d]; lq = null; }
    else if (C === 'Q' || C === 'T') {
      let qx, qy; if (C === 'Q') { qx = num() + ox; qy = num() + oy; } else { qx = lq ? 2 * x - lq[0] : x; qy = lq ? 2 * y - lq[1] : y; }
      const e = num() + ox, f = num() + oy; cub(x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), e + (2 / 3) * (qx - e), f + (2 / 3) * (qy - f), e, f); lq = [qx, qy]; lc = null;
    } else if (C === 'A') {
      const rx = num(), ry = num(), rot = num(), la = num(), sw = num(), X = num() + ox, Y = num() + oy;
      for (const s of arcToCubics(x, y, rx, ry, rot, la, sw, X, Y)) cub(...s); lc = lq = null;
    } else { i++; }
  }
  return { contours: contours.filter((c) => c.d.length >= 8) };
}
function arcToCubics(x1, y1, rx, ry, phiDeg, fa, fs, x2, y2) {
  if (!rx || !ry) return [[x1 + (x2 - x1) / 3, y1 + (y2 - y1) / 3, x1 + (2 * (x2 - x1)) / 3, y1 + (2 * (y2 - y1)) / 3, x2, y2]];
  const phi = (phiDeg * Math.PI) / 180, cp = Math.cos(phi), sp = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
  rx = Math.abs(rx); ry = Math.abs(ry); const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry); if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const sg = fa === fs ? -1 : 1, num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, co = sg * Math.sqrt(Math.max(0, num / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)));
  const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx, cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry); let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dt > 0) dt -= 2 * Math.PI; else if (fs && dt < 0) dt += 2 * Math.PI;
  const n = Math.ceil(Math.abs(dt) / (Math.PI / 2)), h = dt / n, k = (4 / 3) * Math.tan(h / 4), out = [];
  const P = (t) => [cx + rx * Math.cos(t) * cp - ry * Math.sin(t) * sp, cy + rx * Math.cos(t) * sp + ry * Math.sin(t) * cp];
  const D = (t) => [-rx * Math.sin(t) * cp - ry * Math.cos(t) * sp, -rx * Math.sin(t) * sp + ry * Math.cos(t) * cp];
  for (let j = 0; j < n; j++) { const a = t1 + j * h, b = a + h, pa = P(a), pb = P(b), da = D(a), db = D(b); out.push([pa[0] + k * da[0], pa[1] + k * da[1], pb[0] - k * db[0], pb[1] - k * db[1], pb[0], pb[1]]); }
  return out;
}

// ───────── constructores ─────────
const K = 0.5522847498;
export const shapes = {
  circle: (cx, cy, r) => ({ contours: [{ closed: true, d: [cx + r, cy, cx + r, cy + K * r, cx + K * r, cy + r, cx, cy + r, cx - K * r, cy + r, cx - r, cy + K * r, cx - r, cy, cx - r, cy - K * r, cx - K * r, cy - r, cx, cy - r, cx + K * r, cy - r, cx + r, cy - K * r, cx + r, cy] }] }),
  rect: (x, y, w, h, r = 0) => parsePath(r > 0 ? `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z` : `M${x} ${y}H${x + w}V${y + h}H${x}Z`),
  polygon: (pts) => parsePath('M' + pts.map((p) => p.join(' ')).join('L') + 'Z'),
  polyline: (pts) => parsePath('M' + pts.map((p) => p.join(' ')).join('L')),
  star: (cx, cy, r, n = 5, inner = 0.45) => shapes.polygon(Array.from({ length: 2 * n }, (_, i) => { const a = (i * Math.PI) / n - Math.PI / 2, rr = i % 2 ? r * inner : r; return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]; })),
  ring: (cx, cy, r, th) => { const a = shapes.circle(cx, cy, r), b = reverse(shapes.circle(cx, cy, r - th)); return { contours: [...a.contours, ...b.contours] }; },
};
export const reverse = (S) => ({ ...S, contours: S.contours.map((c) => { const d = c.d, out = [d[d.length - 2], d[d.length - 1]]; for (let i = d.length - 8; i >= 0; i -= 6) out.push(d[i + 4], d[i + 5], d[i + 2], d[i + 3], d[i], d[i + 1]); return { closed: c.closed, d: out }; }) });

// ───────── transformaciones ─────────
export const mapPts = (S, f) => ({ ...S, contours: S.contours.map((c) => { const d = c.d.slice(); for (let i = 0; i < d.length; i += 2) { const p = f(d[i], d[i + 1]); d[i] = p[0]; d[i + 1] = p[1]; } return { closed: c.closed, d }; }) });
export const affine = (S, { x = 0, y = 0, s = 1, sx = s, sy = s, rot = 0, ox = 0, oy = 0 } = {}) => {
  const c = Math.cos(rot), n = Math.sin(rot);
  return mapPts(S, (px, py) => { const X = (px - ox) * sx, Y = (py - oy) * sy; return [x + X * c - Y * n, y + X * n + Y * c]; });
};
// Subdivide cada cúbica en k (De Casteljau): necesario antes de deformaciones fuertes.
export function subdivide(S, k = 2) {
  if (k <= 1) return S;
  return { ...S, contours: S.contours.map((c) => {
    const d = c.d, out = [d[0], d[1]];
    for (let i = 2; i < d.length; i += 6) {
      let p0 = [d[i - 2], d[i - 1]], p1 = [d[i], d[i + 1]], p2 = [d[i + 2], d[i + 3]], p3 = [d[i + 4], d[i + 5]];
      for (let j = k; j > 1; j--) { const t = 1 / j, L = split(p0, p1, p2, p3, t); out.push(...L[0][1], ...L[0][2], ...L[0][3]); [p0, p1, p2, p3] = L[1]; }
      out.push(...p1, ...p2, ...p3);
    }
    return { closed: c.closed, d: out };
  }) };
}
function split(p0, p1, p2, p3, t) {
  const L = (a, b) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)], a = L(p0, p1), b = L(p1, p2), c = L(p2, p3), d = L(a, b), e = L(b, c), f = L(d, e);
  return [[p0, a, d, f], [f, e, c, p3]];
}
export function bbox(S) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of S.contours) for (let i = 0; i < c.d.length; i += 2) { const x = c.d[i], y = c.d[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x0 === Infinity ? { x: 0, y: 0, w: 0, h: 0 } : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// ───────── muestreo ─────────
const cubicAt = (d, i, t) => { const m = 1 - t, a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, e = t * t * t; return [a * d[i - 2] + b * d[i] + c * d[i + 2] + e * d[i + 4], a * d[i - 1] + b * d[i + 1] + c * d[i + 3] + e * d[i + 5]]; };
export function flatten(c, per = 12) {
  const d = c.d, pts = [[d[0], d[1]]];
  for (let i = 2; i < d.length; i += 6) for (let j = 1; j <= per; j++) pts.push(cubicAt(d, i, j / per));
  return pts;
}
const cumLen = (pts) => { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return L; };
export function resample(pts, n, closed) {
  const P = closed ? [...pts, pts[0]] : pts, L = cumLen(P), tot = L[L.length - 1] || 1, out = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const s = (i / (closed ? n : n - 1)) * tot;
    while (j < L.length - 2 && L[j + 1] < s) j++;
    const u = (s - L[j]) / Math.max(1e-9, L[j + 1] - L[j]);
    out.push([lerp(P[j][0], P[j + 1][0], clamp(u)), lerp(P[j][1], P[j + 1][1], clamp(u))]);
  }
  return out;
}
export const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
const centroid = (pts) => { let x = 0, y = 0; for (const p of pts) { x += p[0]; y += p[1]; } return [x / pts.length, y / pts.length]; };
export const length = (S) => S.contours.reduce((a, c) => { const L = cumLen(flatten(c, 8)); return a + L[L.length - 1]; }, 0);

// ───────── morph arbitrario (problemas conocidos resueltos) ─────────
// 1 · correspondencia de contornos: exteriores con exteriores y agujeros con agujeros, por área y cercanía.
// 2 · sobrantes: nacen/mueren colapsados en el centroide del contorno emparejado más cercano (sin "volar" desde el origen).
// 3 · retorcimiento: mismo sentido de giro + desfase cíclico que minimiza la distancia cuadrática.
// 4 · extremos nítidos: u≈0 y u≈1 devuelven la forma original (curvas exactas, no polilínea).
const PLAN = new WeakMap();
export function morphPlan(A, B, n = 72) {
  let m = PLAN.get(A); if (!m) PLAN.set(A, (m = new WeakMap()));
  const hit = m.get(B); if (hit && hit.n === n) return hit;
  const prep = (S) => S.contours.map((c) => { const pts = resample(flatten(c, 10), n, true), a = area(pts); return { pts, a, abs: Math.abs(a), c: centroid(pts) }; });
  const PA = prep(A), PB = prep(B), sgnA = Math.sign(PA.reduce((p, q) => (q.abs > p.abs ? q : p), { abs: -1, a: 1 }).a) || 1, sgnB = Math.sign(PB.reduce((p, q) => (q.abs > p.abs ? q : p), { abs: -1, a: 1 }).a) || 1;
  const kind = (c, s) => (Math.sign(c.a) === s ? 'out' : 'hole');
  const pairs = [];
  for (const k of ['out', 'hole']) {
    const a = PA.filter((c) => kind(c, sgnA) === k).sort((p, q) => q.abs - p.abs), b = PB.filter((c) => kind(c, sgnB) === k).sort((p, q) => q.abs - p.abs), usedB = new Set();
    for (const ca of a) {
      let best = -1, bd = Infinity; b.forEach((cb, j) => { if (usedB.has(j)) return; const d = Math.hypot(ca.c[0] - cb.c[0], ca.c[1] - cb.c[1]) + 0.5 * Math.abs(Math.sqrt(ca.abs) - Math.sqrt(cb.abs)); if (d < bd) { bd = d; best = j; } });
      if (best >= 0) { usedB.add(best); pairs.push([ca, b[best]]); } else pairs.push([ca, null]);
    }
    b.forEach((cb, j) => { if (!usedB.has(j)) pairs.push([null, cb]); });
  }
  const all = [...PA, ...PB], near = (c, pool) => pool.reduce((p, q) => (Math.hypot(q.c[0] - c.c[0], q.c[1] - c.c[1]) < Math.hypot(p.c[0] - c.c[0], p.c[1] - c.c[1]) ? q : p), pool[0] ?? c);
  const tracks = pairs.map(([a, b]) => {
    if (!a) { const t = near(b, PA.length ? PA : all); return [b.pts.map(() => t.c.slice()), b.pts]; }
    if (!b) { const t = near(a, PB.length ? PB : all); return [a.pts, a.pts.map(() => t.c.slice())]; }
    let pb = Math.sign(a.a) !== Math.sign(b.a) ? [...b.pts].reverse() : b.pts, best = 0, bd = Infinity;
    for (let off = 0; off < n; off++) { let s = 0; for (let i = 0; i < n; i += 3) { const p = a.pts[i], q = pb[(i + off) % n]; s += (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; if (s > bd) break; } if (s < bd) { bd = s; best = off; } }
    return [a.pts, a.pts.map((_, i) => pb[(i + best) % n])];
  });
  const plan = { n, tracks }; m.set(B, plan); return plan;
}
// Devuelve polígonos interpolados (u en 0..1). Con `arc` > 0 los puntos viajan en arco (evita cruzarse por el centro).
export function morphPolys(A, B, u, { n = 72, arc = 0 } = {}) {
  const { tracks } = morphPlan(A, B, n);
  return tracks.map(([a, b]) => a.map((p, i) => {
    const q = b[i]; let x = lerp(p[0], q[0], u), y = lerp(p[1], q[1], u);
    if (arc) { const dx = q[0] - p[0], dy = q[1] - p[1], s = Math.sin(Math.PI * u) * arc; x += -dy * s; y += dx * s; }
    return [x, y];
  }));
}

// ───────── dibujo ─────────
export function tracePath(ctx, S) {
  for (const c of S.contours) { const d = c.d; ctx.moveTo(d[0], d[1]); for (let i = 2; i < d.length; i += 6) ctx.bezierCurveTo(d[i], d[i + 1], d[i + 2], d[i + 3], d[i + 4], d[i + 5]); if (c.closed) ctx.closePath(); }
}
export function tracePolys(ctx, polys, closed = true) {
  for (const P of polys) {           // curva suave por puntos medios (sin facetas visibles)
    const n = P.length; if (n < 2) continue;
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], m0 = closed ? mid(P[n - 1], P[0]) : P[0];
    ctx.moveTo(m0[0], m0[1]);
    for (let i = 0; i < (closed ? n : n - 1); i++) { const p = P[i], q = mid(p, P[(i + 1) % n]); ctx.quadraticCurveTo(p[0], p[1], q[0], q[1]); }
    if (closed) ctx.closePath(); else ctx.lineTo(P[n - 1][0], P[n - 1][1]);
  }
}
// Draw-on: fracción [a,b] de la longitud total, recorriendo contornos en orden (escritura).
export function traceTrim(ctx, S, a, b) {
  if (b <= a) return;
  const segs = S.contours.map((c) => { const pts = flatten(c, 10); return { pts, L: cumLen(pts) }; }), tot = segs.reduce((p, s) => p + s.L[s.L.length - 1], 0);
  let acc = 0; const A = a * tot, B = b * tot;
  for (const s of segs) {
    const len = s.L[s.L.length - 1], s0 = Math.max(A - acc, 0), s1 = Math.min(B - acc, len); acc += len;
    if (s1 <= s0) continue;
    let started = false;
    for (let i = 1; i < s.pts.length; i++) {
      const la = s.L[i - 1], lb = s.L[i]; if (lb < s0 || la > s1) continue;
      const p = s.pts[i - 1], q = s.pts[i], at = (v) => { const u = clamp((v - la) / Math.max(1e-9, lb - la)); return [lerp(p[0], q[0], u), lerp(p[1], q[1], u)]; };
      if (!started) { const st = at(Math.max(s0, la)); ctx.moveTo(st[0], st[1]); started = true; }
      const en = at(Math.min(s1, lb)); ctx.lineTo(en[0], en[1]);
    }
  }
}

// ───────── deformaciones vectoriales (se aplican a puntos de control: resolución infinita) ─────────
// Todas son fábricas puras (params) → (x,y) → [x',y'].  Componer: compose(w1, w2).
export const WARPS = {
  wave: ({ amp = 12, freq = 0.02, phase = 0, axis = 'y' } = {}) => (x, y) => (axis === 'y' ? [x, y + amp * Math.sin(x * freq + phase)] : [x + amp * Math.sin(y * freq + phase), y]),
  bulge: ({ cx = 0, cy = 0, r = 200, k = 0.4 } = {}) => (x, y) => { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy), f = d < r ? 1 + k * (1 - (d / r) ** 2) ** 2 : 1; return [cx + dx * f, cy + dy * f]; },
  twist: ({ cx = 0, cy = 0, r = 200, ang = 1 } = {}) => (x, y) => { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy), a = ang * Math.max(0, 1 - d / r) ** 2, c = Math.cos(a), s = Math.sin(a); return [cx + dx * c - dy * s, cy + dx * s + dy * c]; },
  bend: ({ cx = 0, cy = 0, k = 0.002 } = {}) => (x, y) => { if (Math.abs(k) < 1e-7) return [x, y]; const R = 1 / k, a = (x - cx) / R, rr = R - (y - cy); return [cx + rr * Math.sin(a), cy + R - rr * Math.cos(a)]; },
  noise: ({ amp = 6, scale = 0.01, t = 0, seed = 1 } = {}) => (x, y) => [x + amp * noise1(x * scale + t, seed + Math.floor(y * scale)), y + amp * noise1(y * scale + t, seed + 7 + Math.floor(x * scale))],
  // Homografía: cuadrilátero unidad (bbox src) → 4 esquinas destino [[x,y]×4] (TL,TR,BR,BL). Perspectiva real de tarjetas/pantallas.
  quad: ({ src, dst }) => { const H = homography(src, dst); return (x, y) => { const w = H[6] * x + H[7] * y + 1; return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]; }; },
};
export const compose = (...ws) => (x, y) => ws.reduce((p, w) => w(p[0], p[1]), [x, y]);
export function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) { const [x, y] = src[i], [X, Y] = dst[i]; A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]); b.push(X); A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]); b.push(Y); }
  for (let c = 0; c < 8; c++) { let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; } }
  return b.map((v, i) => v / A[i][i]);
}
export const warpShape = (S, w, sub = 3) => mapPts(subdivide(S, sub), w);
