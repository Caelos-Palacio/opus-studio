// formas.mjs: objetos con volumen en 2D (revolucion, tubos, extrusion, trazo a mano). Sin clip-art: todo sombreado en bandas.
import { createCanvas } from 'canvas';
import { rng, gauss, valor, fbm, lerp, clamp, smoothstep, mezclar, oscurecer, aclarar, rgba } from './base.mjs';

const scr = new Map();
const lienzo = (ctx) => { const k = ctx.canvas.width + 'x' + ctx.canvas.height; if (!scr.has(k)) scr.set(k, createCanvas(ctx.canvas.width, ctx.canvas.height)); const c = scr.get(k); c.getContext('2d').clearRect(0, 0, c.width, c.height); return c; };

/** suavizar(pts,paso): remuestrea una polilinea con Catmull-Rom cada ~paso px. */
export function suavizar(p, paso = 3) {
  const out = [], n = p.length;
  for (let i = 0; i < n - 1; i++) {
    const a = p[Math.max(i - 1, 0)], b = p[i], c = p[i + 1], d = p[Math.min(i + 2, n - 1)], m = Math.max(2, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) / paso));
    for (let k = 0; k < m; k++) { const t = k / m, t2 = t * t, t3 = t2 * t, f = (j) => 0.5 * (2 * b[j] + (-a[j] + c[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * t3); out.push([f(0), f(1)]); }
  }
  out.push(p[n - 1]); return out;
}

/** perfil(puntos,paso): puntos [y,radio] de control -> perfil denso [y,radio] con transiciones suaves (coseno). */
export function perfil(pts, paso = 2) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) { const [y0, r0] = pts[i], [y1, r1] = pts[i + 1], m = Math.max(1, Math.ceil((y1 - y0) / paso)); for (let k = 0; k < m; k++) out.push([y0 + (y1 - y0) * k / m, lerp(r0, r1, (1 - Math.cos(Math.PI * k / m)) / 2)]); }
  out.push(pts[pts.length - 1]); return out;
}

/** torno(ctx,perfil,{x,y,luz,tono,rot,estrias}): cuerpo de revolucion (botella, jarra, moneda de canto) en 4 tonos con reflejo; eje en x,y hacia abajo. */
export function torno(ctx, per, { x = 0, y = 0, luz = -0.5, tono = '#4f8f6a', rot = 0, estrias = false, reflejo = true } = {}) {
  const tc = [oscurecer(tono, 0.55), oscurecer(tono, 0.25), tono, aclarar(tono, 0.3)], lz = Math.sqrt(1 - luz * luz), th = [0.3, 0.6, 0.85], segs = [];
  let ult = -1;
  for (let i = 0; i <= 200; i++) { const u = -1 + i / 100, I = luz * u + lz * Math.sqrt(Math.max(0, 1 - u * u)), b = I < th[0] ? 0 : I < th[1] ? 1 : I < th[2] ? 2 : 3; if (b !== ult) { segs.push([u, 1, b]); if (segs.length > 1) segs[segs.length - 2][1] = u; ult = b; } }
  const y0 = per[0][0], H = per[per.length - 1][0] - y0;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const hh = (i) => (per[i + 1] ? per[i + 1][0] - per[i][0] : 1) + 0.9;
  per.forEach(([yy, r], i) => { for (const [u0, u1, b] of segs) { ctx.fillStyle = tc[b]; ctx.fillRect(u0 * r, yy, (u1 - u0) * r + 0.6, hh(i)); } });
  if (reflejo) per.forEach(([yy, r], i) => { const f = smoothstep(0, 0.1, (yy - y0) / H) * smoothstep(1, 0.9, (yy - y0) / H); ctx.fillStyle = `rgba(255,255,255,${0.5 * f})`; ctx.fillRect((luz * 0.85 - 0.06) * r, yy, 0.12 * r, hh(i) - 0.55); ctx.fillStyle = `rgba(255,255,255,${0.14 * f})`; ctx.fillRect((-luz * 0.8) * r, yy, 0.05 * r, hh(i) - 0.55); });
  if (estrias) { ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; for (let yy = y0 + 2; yy < y0 + H; yy += 3) { const r = per.find((p) => p[0] >= yy)?.[1] ?? 0; ctx.beginPath(); ctx.moveTo(-r, yy); ctx.lineTo(r, yy); ctx.stroke(); } }
  ctx.strokeStyle = rgba(oscurecer(tono, 0.75), 0.9); ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  for (const s of [-1, 1]) { ctx.beginPath(); per.forEach(([yy, r], i) => i ? ctx.lineTo(s * r, yy) : ctx.moveTo(s * r, yy)); ctx.stroke(); }
  const rt = per[0][1], rb = per[per.length - 1][1]; ctx.beginPath(); ctx.moveTo(-rt, y0); ctx.lineTo(rt, y0); ctx.moveTo(-rb, y0 + H); ctx.lineTo(rb, y0 + H); ctx.stroke();
  ctx.restore(); return { y0, alto: H };
}

/** tubo(ctx,puntos,{grosor,variacion,seed,color,luz,torsion}): cuerda o cable con grosor modulado, sombra, cuerpo y luz. */
export function tubo(ctx, pts, { grosor = 8, variacion = 0.25, seed = 1, color = '#8c6b42', luz = -0.5, torsion = true } = {}) {
  const P = suavizar(pts, 2), W = P.map((_, i) => grosor * (1 + variacion * (fbm(i * 0.04, 0, seed, 2) * 2 - 1) * 2)), seg = (g, k, off = [0, 0], f = 1) => { for (let i = 1; i < P.length; i++) { g.lineWidth = W[i] * f; g.beginPath(); g.moveTo(P[i - 1][0] + off[0], P[i - 1][1] + off[1]); g.lineTo(P[i][0] + off[0], P[i][1] + off[1]); g.stroke(); } };
  const sh = lienzo(ctx), sg = sh.getContext('2d'); sg.lineCap = 'round'; sg.strokeStyle = '#000'; seg(sg, 0, [-luz * grosor * 0.5, grosor * 0.45]);
  ctx.save(); ctx.globalAlpha = 0.28; ctx.drawImage(sh, 0, 0); ctx.globalAlpha = 1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = oscurecer(color, 0.4); seg(ctx, 0); ctx.strokeStyle = color; seg(ctx, 0, [luz * grosor * 0.08, -grosor * 0.05], 0.72); ctx.strokeStyle = aclarar(color, 0.4); seg(ctx, 0, [luz * grosor * 0.2, -grosor * 0.18], 0.25);
  if (torsion) { ctx.strokeStyle = rgba(oscurecer(color, 0.6), 0.35); ctx.lineWidth = 1; let acc = 0; for (let i = 1; i < P.length; i++) { acc += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); if (acc < grosor * 1.1) continue; acc = 0; const a = Math.atan2(P[i][1] - P[i - 1][1], P[i][0] - P[i - 1][0]) + 1.1, d = W[i] * 0.45; ctx.beginPath(); ctx.moveTo(P[i][0] - Math.cos(a) * d, P[i][1] - Math.sin(a) * d); ctx.lineTo(P[i][0] + Math.cos(a) * d, P[i][1] + Math.sin(a) * d); ctx.stroke(); } }
  ctx.restore(); return P;
}

/** catenaria(a,b,caida,n): n+1 puntos de la curva colgante entre a y b con flecha maxima `caida` (px, hacia abajo). */
export function catenaria(a, b, caida, n = 24) {
  const k = 2, c = Math.cosh(k);
  return Array.from({ length: n + 1 }, (_, i) => { const s = i / n, u = 2 * s - 1; return [lerp(a[0], b[0], s), lerp(a[1], b[1], s) + caida * (c - Math.cosh(k * u)) / (c - 1)]; });
}

/** red(ctx,{x,y,w,h,cols,filas,seed,grosor,caida,color}): red de cuerdas irregulares con nudos en los cruces; devuelve los nudos. */
export function red(ctx, { x, y, w, h, cols = 6, filas = 4, seed = 1, grosor = 4, caida = 0.07, color = '#9a7b4f' } = {}) {
  const r = rng(seed), cw = w / cols, ch = h / filas;
  const N = Array.from({ length: filas + 1 }, (_, i) => Array.from({ length: cols + 1 }, (_, j) => [x + j * cw + gauss(r) * cw * 0.08, y + i * ch + gauss(r) * ch * 0.08]));
  for (let i = 0; i <= filas; i++) for (let j = 0; j < cols; j++) tubo(ctx, catenaria(N[i][j], N[i][j + 1], cw * caida * (0.6 + r()), 8), { grosor, seed: seed + i * 7 + j, color, torsion: false });
  for (let i = 0; i < filas; i++) for (let j = 0; j <= cols; j++) { const a = N[i][j], b = N[i + 1][j], s = (r() - 0.5) * ch * 0.12; tubo(ctx, [a, [(a[0] + b[0]) / 2 + s, (a[1] + b[1]) / 2], b], { grosor: grosor * 0.9, seed: seed + 50 + i * 7 + j, color, torsion: false }); }
  for (const f of N) for (const [px, py] of f) { ctx.fillStyle = oscurecer(color, 0.3); ctx.beginPath(); ctx.ellipse(px, py, grosor * 1.2, grosor * 0.95, r() * 0.8, 0, 6.283); ctx.fill(); ctx.fillStyle = aclarar(color, 0.35); ctx.beginPath(); ctx.ellipse(px - grosor * 0.3, py - grosor * 0.3, grosor * 0.45, grosor * 0.3, 0, 0, 6.283); ctx.fill(); }
  return N.flat();
}

/** solido(ctx,plan,alto,tonos,{luz}): extrusion de un poligono de planta; caras con 4 bandas de tono (sombra al pie) y tapa mas clara. */
export function solido(ctx, plan, alto, tonos = '#8a7ba8', { luz = -0.5 } = {}) {
  const T = typeof tonos === 'string' ? [oscurecer(tonos, 0.5), oscurecer(tonos, 0.25), tonos, aclarar(tonos, 0.2)] : tonos, n = plan.length;
  const area = plan.reduce((s, p, i) => s + p[0] * plan[(i + 1) % n][1] - plan[(i + 1) % n][0] * p[1], 0), sg = area < 0 ? -1 : 1, caras = [];
  plan.forEach((a, i) => { const b = plan[(i + 1) % n], nx = (b[1] - a[1]) * sg, ny = -(b[0] - a[0]) * sg, L = Math.hypot(nx, ny) || 1; if (ny / L > 0.02) caras.push({ a, b, I: clamp(0.5 + (nx / L) * luz * 1.6 + 0.12 * ny / L), y: Math.max(a[1], b[1]) }); });
  caras.sort((p, q) => p.y - q.y);
  for (const { a, b, I } of caras) {
    const base = T[Math.min(2, Math.floor(I * 3))];
    for (let k = 0; k < 4; k++) { const z0 = alto * k / 4, z1 = alto * (k + 1) / 4 + 0.7; ctx.fillStyle = mezclar(base, '#000000', 0.22 * (1 - k / 3)); ctx.beginPath(); ctx.moveTo(a[0], a[1] - z0); ctx.lineTo(b[0], b[1] - z0); ctx.lineTo(b[0], b[1] - z1); ctx.lineTo(a[0], a[1] - z1); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0], a[1] - alto); ctx.moveTo(b[0], b[1]); ctx.lineTo(b[0], b[1] - alto); ctx.stroke();
  }
  const cima = plan.map(([px, py]) => [px, py - alto]); ctx.fillStyle = aclarar(T[3], 0.18); ctx.beginPath(); cima.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.2; ctx.stroke(); return cima;
}

/** sombraContacto(ctx,x,y,rx,{ry,alfa}): sombra elíptica bajo un objeto apoyado, difusa fuera y densa junto al contacto. */
export function sombraContacto(ctx, x, y, rx, { ry = rx * 0.22, alfa = 0.4 } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
  for (const [k, a] of [[1.15, 0.55], [0.6, 0.9]]) { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * k); g.addColorStop(0, `rgba(10,8,6,${a * alfa})`); g.addColorStop(1, 'rgba(10,8,6,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx * k, 0, 6.283); ctx.fill(); }
  ctx.restore();
}

/** trazoMano(ctx,puntos,{presion,seed,color,tam}): trazo de pluma/lapiz con grosor segun presion (fn de 0..1, array o por defecto), velocidad y temblor. */
export function trazoMano(ctx, pts, { presion, seed = 1, color = '#1b1b22', tam = 6 } = {}) {
  const P = suavizar(pts, 1.5), n = P.length, pr = typeof presion === 'function' ? presion : Array.isArray(presion) ? (s) => presion[Math.min(presion.length - 1, Math.floor(s * presion.length))] : (s) => 0.35 + 0.65 * Math.pow(Math.sin(Math.PI * s), 0.6);
  const L = [], R = []; let ex = 0, ey = 0;
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; ex = (b[0] - a[0]) / d; ey = (b[1] - a[1]) / d;
    const w = tam * (0.2 + 0.8 * pr(i / (n - 1))) * (1 + 0.25 * (valor(i * 0.08, 0, seed) - 0.5)) / 2;
    L.push([P[i][0] - ey * w, P[i][1] + ex * w]); R.push([P[i][0] + ey * w, P[i][1] - ex * w]);
  }
  ctx.fillStyle = color; ctx.beginPath(); L.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); R.reverse().forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath(); ctx.fill();
  for (const i of [0, n - 1]) { const w = tam * (0.2 + 0.8 * pr(i / (n - 1))) / 2; ctx.beginPath(); ctx.arc(P[i][0], P[i][1], w, 0, 6.283); ctx.fill(); }
}
