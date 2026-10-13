// objetos.mjs: objetos hechos de PIEZAS (>= 10 cada uno), con parametros y sombreado propio. Cada funcion devuelve {piezas:[nombres], caja:{x,y,w,h}}
// y dibuja centrado en (x,y) con `rot` (radianes). Todo determinista (semilla); nada de clip-art: vidrio con espesor, relieve por mapa de alturas.
import { createCanvas } from 'canvas';
import { rng, gauss, fbm, valor, lerp, clamp, smoothstep, hexRgb, rgba, mezclar, oscurecer, aclarar } from './base.mjs';
import { perfil, torno, suavizar, trazoMano } from './formas.mjs';
import { fuenteCss, textoEn, registrarFuentes } from './texto.mjs';

const TAU = Math.PI * 2, C = new Map();
const guardar = (k, fn) => { let v = C.get(k); if (!v) { if (C.size > 40) C.clear(); v = fn(); C.set(k, v); } return v; };
const escala = (ctx) => { const m = ctx.getTransform?.(); return Math.min(2, Math.max(0.25, m ? Math.hypot(m.a, m.b) : 1)); };
const trazar = (g, P, cerrar = true) => { g.beginPath(); P.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); if (cerrar) g.closePath(); };
const blob = (cx, cy, r, seed, amp = 0.12, n = 40) => Array.from({ length: n }, (_, i) => { const a = i / n * TAU, k = 1 + amp * (fbm(Math.cos(a) * 1.7 + seed, Math.sin(a) * 1.7, seed, 3) - 0.5) * 2; return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k]; });
const bboxRot = (pts, x, y, rot) => { const c = Math.cos(rot), s = Math.sin(rot), P = pts.map(([px, py]) => [x + px * c - py * s, y + px * s + py * c]), xs = P.map((p) => p[0]), ys = P.map((p) => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys); return { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 }; };
const esquinas = (hw, hh) => [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];

/** sombraSuave(g,x,y,rx,ry,alfa): mancha elíptica difusa (sombra de contacto). */
function sombraSuave(g, x, y, rx, ry, alfa = 0.35) { g.save(); g.translate(x, y); g.scale(1, ry / rx); for (const [k, a] of [[1.2, 0.5], [0.65, 0.9]]) { const q = g.createRadialGradient(0, 0, 0, 0, 0, rx * k); q.addColorStop(0, `rgba(10,8,6,${a * alfa})`); q.addColorStop(1, 'rgba(10,8,6,0)'); g.fillStyle = q; g.beginPath(); g.arc(0, 0, rx * k, 0, TAU); g.fill(); } g.restore(); }

// ------------------------------------------------------------------ BOTELLA
const PERFIL_BOTELLA = perfil([[0, 0.045], [0.032, 0.047], [0.036, 0.038], [0.07, 0.034], [0.28, 0.036], [0.33, 0.052], [0.4, 0.105], [0.47, 0.138], [0.52, 0.145], [0.94, 0.145], [0.975, 0.128], [1, 0.1]], 0.004);
/**
 * botella(ctx,{x,y,alto,rot,lleno,corcho,lastre,tarjetaDentro,algas,tono,luz,sombra,seed,t}): botella de vidrio con labio, cuello, hombro, pared con espesor, fondo grueso con
 * cuenco, nivel de agua con menisco, lastre de guijarros, rollo de papel con cordel, corcho, burbujas, algas adheridas y dos reflejos. lleno 0..1; lastre 0..1 (altura de grava);
 * algas 0..1 (cantidad); t = segundos para el vaiven de algas y burbujas. Eje vertical con rot=0.
 */
export function botella(ctx, { x = 0, y = 0, alto = 600, rot = 0, lleno = 0.4, corcho = true, lastre = 0.12, tarjetaDentro = true, algas = 0.6, tono = '#4f8f6a', luz = -0.5, sombra = false, seed = 3, t = 0 } = {}) {
  const piezas = [], P = PERFIL_BOTELLA, g = ctx, esp = 0.017, yb = 0.94, r = rng(seed), liq = mezclar(tono, '#2f6f8f', 0.45);
  const cont = [...P.map(([yy, rr]) => [-rr, yy - 0.5]), ...[...P].reverse().map(([yy, rr]) => [rr, yy - 0.5])];
  const interior = (() => { const Q = P.filter(([yy]) => yy > 0.045 && yy < 0.955).map(([yy, rr]) => [yy, Math.max(0.004, rr - esp)]); return [...Q.map(([yy, rr]) => [-rr, yy - 0.5]), ...[...Q].reverse().map(([yy, rr]) => [rr, yy - 0.5])]; })();
  const rad = (yy) => { let i = 0; while (i < P.length - 2 && P[i + 1][0] < yy) i++; const [ya, ra] = P[i], [yb2, rb] = P[i + 1]; return lerp(ra, rb, clamp((yy - ya) / ((yb2 - ya) || 1))); };
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(alto, alto);
  if (sombra) { sombraSuave(g, 0.03, 0.5, 0.2, 0.035, 0.4); piezas.push('sombra'); }
  // 1 cuerpo de vidrio: translucido, mas denso en los bordes
  const cuerpo = g.createLinearGradient(-0.15, 0, 0.15, 0); for (const [o, a, c] of [[0, 0.78, oscurecer(tono, 0.45)], [0.14, 0.5, tono], [0.4, 0.3, aclarar(tono, 0.15)], [0.7, 0.34, tono], [1, 0.8, oscurecer(tono, 0.5)]]) cuerpo.addColorStop(o, rgba(c, a)); g.fillStyle = cuerpo; trazar(g, cont); g.fill(); piezas.push('cuerpo');
  // 2 contenido en el marco del MUNDO (el agua y la grava no giran con la botella), recortado por la cara interior de la pared
  const cs = Math.cos(rot), sn = Math.sin(rot), Iw = interior.map(([px, py]) => [px * cs - py * sn, px * sn + py * cs]), ys = Iw.map((p) => p[1]), yMin = Math.min(...ys), yMax = Math.max(...ys);
  const cuerda = (yy) => { const xs = []; for (let i = 0; i < Iw.length; i++) { const a = Iw[i], b = Iw[(i + 1) % Iw.length]; if ((a[1] <= yy) !== (b[1] <= yy)) xs.push(a[0] + (yy - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); } xs.sort((p, q) => p - q); return xs; };
  const ancho = (yy) => { const xs = cuerda(yy); let w = 0; for (let i = 0; i + 1 < xs.length; i += 2) w += xs[i + 1] - xs[i]; return w; };
  const cap = (() => { let v = 0; for (let k = 0; k < 90; k++) v += ancho(yMin + (k + 0.5) / 90 * (yMax - yMin)); return v; })(), nivelW = (frac) => { let v = 0; for (let k = 0; k < 90; k++) { const yy = yMax - (k + 0.5) / 90 * (yMax - yMin); v += ancho(yy); if (v >= frac * cap) return yy; } return yMin; };
  const dentro = (px, py) => { let c = false; for (let i = 0, j = Iw.length - 1; i < Iw.length; j = i++) { const a = Iw[i], b = Iw[j]; if ((a[1] > py) !== (b[1] > py) && px < (b[0] - a[0]) * (py - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const Lq = lleno > 0.001 ? nivelW(clamp(lleno)) : yMax, vol = (f) => nivelW(clamp(f));
  g.save(); trazar(g, interior); g.clip(); g.rotate(-rot);
  const vl = g.createLinearGradient(0, Lq, 0, yMax); vl.addColorStop(0, rgba(aclarar(liq, 0.2), 0.42)); vl.addColorStop(1, rgba(oscurecer(liq, 0.35), 0.62));
  if (lleno > 0.01) { g.fillStyle = vl; g.fillRect(-0.4, Lq, 0.8, yMax - Lq + 0.05); piezas.push('liquido'); const xs = cuerda(Lq + 0.001), cx0 = xs.length > 1 ? (xs[0] + xs[xs.length - 1]) / 2 : 0, rw = xs.length > 1 ? (xs[xs.length - 1] - xs[0]) / 2 : 0.02; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.0035; g.beginPath(); g.ellipse(cx0, Lq, rw, Math.min(rw * 0.16, 0.02), 0, 0, TAU); g.stroke(); g.strokeStyle = rgba(aclarar(liq, 0.5), 0.5); g.beginPath(); g.ellipse(cx0, Lq + 0.002, rw, Math.min(rw * 0.16, 0.02), 0, 0.1, Math.PI - 0.1); g.stroke(); piezas.push('menisco'); }
  if (lastre > 0.005) { const top = nivelW(clamp(0.12 * lastre * 3 * (cap > 0 ? 1 : 1) + 0.0)); const piso = nivelW(lastre * 0.35); let n = 0; for (let i = 0; i < 700 && n < 110 * lastre + 14; i++) { const px = lerp(Math.min(...Iw.map((q) => q[0])), Math.max(...Iw.map((q) => q[0])), r()), py = lerp(piso, yMax, r() ** 0.8); if (!dentro(px, py)) continue; n++; const rr = 0.006 + r() * 0.011, c = mezclar('#8a7d6a', r() < 0.5 ? '#3d3a35' : '#c9bda4', r()); g.fillStyle = c; g.beginPath(); g.ellipse(px, py, rr, rr * 0.75, r() * 3, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(px - rr * 0.3, py - rr * 0.3, rr * 0.3, 0, TAU); g.fill(); } void top; piezas.push('lastre'); }
  if (tarjetaDentro) { // rollo de papel flotando en el nivel, con cordel y lineas de tinta
    const xs = cuerda(Math.min(Lq - 0.03, yMax - 0.08)), disp = xs.length > 1 ? (xs[xs.length - 1] - xs[0]) : 0.1, L = Math.min(0.21, disp * 0.8), w = Math.min(0.034, L * 0.2), cx0 = xs.length > 1 ? (xs[0] + xs[xs.length - 1]) / 2 : 0, cy = Math.min(Lq - w * 0.8, yMax - w - 0.01); g.save(); g.translate(cx0, cy); g.rotate(-0.1 + Math.sin(t * 0.8) * 0.02);
    const rol = g.createLinearGradient(0, -w, 0, w); rol.addColorStop(0, '#fbf5e4'); rol.addColorStop(0.5, '#ecdfbf'); rol.addColorStop(1, '#a89873'); g.fillStyle = rol; g.beginPath(); g.roundRect(-L / 2, -w, L, 2 * w, w * 0.4); g.fill(); piezas.push('rollo');
    g.strokeStyle = 'rgba(60,40,20,0.35)'; g.lineWidth = 0.0025; for (const k of [0.3, 0.5, 0.7]) { g.beginPath(); g.arc(L / 2, 0, w * k, -1.3, 1.3); g.stroke(); } g.fillStyle = '#9d8e6a'; g.beginPath(); g.ellipse(L / 2, 0, w * 0.35, w, 0, 0, TAU); g.fill(); piezas.push('espiral');
    g.strokeStyle = 'rgba(30,38,48,0.5)'; g.lineWidth = 0.0032; for (const k of [-0.5, -0.1, 0.3]) { g.beginPath(); g.moveTo(-L / 2 + 0.02, k * w); g.bezierCurveTo(-L * 0.15, k * w - 0.004, L * 0.1, k * w + 0.005, L / 2 - 0.045, k * w); g.stroke(); } piezas.push('escritura');
    g.strokeStyle = '#a8452f'; g.lineWidth = 0.007; g.beginPath(); g.moveTo(L * 0.1, -w); g.lineTo(L * 0.1, w); g.stroke(); piezas.push('cordel'); g.restore();
  }
  for (let i = 0, n = 0; i < 400 && n < 14; i++) { const bx = lerp(-0.14, 0.14, r()), by = lerp(Lq, yMax, r()) - ((t * 0.02 * (1 + i % 3)) % 0.1), br = 0.003 + r() * 0.006; if (!dentro(bx, by + 0.0) || by < Lq) continue; n++; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.0014; g.beginPath(); g.arc(bx, by, br, 0, TAU); g.stroke(); } piezas.push('burbujas'); void vol;
  g.restore();
  // 3 fondo grueso: banda de vidrio macizo con cuenco concavo
  g.save(); trazar(g, cont); g.clip(); const fg = g.createLinearGradient(0, yb - 0.5 - 0.01, 0, 0.5); fg.addColorStop(0, rgba(oscurecer(tono, 0.2), 0.0)); fg.addColorStop(0.3, rgba(oscurecer(tono, 0.3), 0.6)); fg.addColorStop(1, rgba(oscurecer(tono, 0.55), 0.85)); g.fillStyle = fg; g.fillRect(-0.2, yb - 0.5 - 0.01, 0.4, 0.07);
  g.strokeStyle = rgba(aclarar(tono, 0.5), 0.5); g.lineWidth = 0.0035; g.beginPath(); g.ellipse(0, yb - 0.5 - 0.004, 0.128, 0.026, 0, 0.1, Math.PI - 0.1); g.stroke(); g.fillStyle = rgba(aclarar(tono, 0.2), 0.18); g.beginPath(); g.ellipse(0, 0.5 - 0.022, 0.07, 0.012, 0, 0, TAU); g.fill(); piezas.push('fondo');
  // 4 pared: linea interior y oscurecimiento de borde (espesor del vidrio)
  g.lineJoin = 'round'; g.strokeStyle = rgba(oscurecer(tono, 0.6), 0.5); g.lineWidth = esp * 2; trazar(g, cont); g.stroke(); piezas.push('refraccion'); g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 0.002; trazar(g, interior); g.stroke(); piezas.push('pared');
  // 5 hombro y cuello: brillos que siguen el contorno
  for (const [w, a] of [[0.014, 0.18], [0.007, 0.35], [0.003, 0.65]]) { g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); P.filter(([yy]) => yy > 0.3 && yy < 0.52).forEach(([yy, rr2], i) => { const px = -rr2 + 0.02 - (yy - 0.3) * 0.05; i ? g.lineTo(px, yy - 0.5) : g.moveTo(px, yy - 0.5); }); g.stroke(); } piezas.push('hombro');
  const gl = g.createLinearGradient(0, 0.06 - 0.5, 0, 0.94 - 0.5); gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(0.1, 'rgba(255,255,255,0.7)'); gl.addColorStop(0.85, 'rgba(255,255,255,0.45)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gl; g.beginPath(); g.moveTo(-0.108, 0.55 - 0.5); g.quadraticCurveTo(-0.118, 0.7 - 0.5, -0.113, 0.9 - 0.5); g.lineTo(-0.092, 0.9 - 0.5); g.quadraticCurveTo(-0.098, 0.7 - 0.5, -0.088, 0.55 - 0.5); g.closePath(); g.fill(); piezas.push('reflejo');
  g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.moveTo(-0.018, 0.08 - 0.5); g.lineTo(-0.007, 0.08 - 0.5); g.lineTo(-0.01, 0.28 - 0.5); g.lineTo(-0.02, 0.28 - 0.5); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.2)'; g.beginPath(); g.roundRect(0.1, 0.58 - 0.5, 0.012, 0.3, 0.006); g.fill(); piezas.push('reflejoSec');
  // 6 labio y corcho
  const lg = g.createLinearGradient(-0.05, 0, 0.05, 0); lg.addColorStop(0, oscurecer(tono, 0.5)); lg.addColorStop(0.3, aclarar(tono, 0.35)); lg.addColorStop(1, oscurecer(tono, 0.55)); g.fillStyle = lg; g.beginPath(); g.roundRect(-0.049, -0.5 - 0.004, 0.098, 0.04, 0.008); g.fill(); g.strokeStyle = rgba(oscurecer(tono, 0.7), 0.8); g.lineWidth = 0.0022; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 0.003; g.beginPath(); g.moveTo(-0.04, -0.5 + 0.004); g.lineTo(-0.04, -0.5 + 0.03); g.stroke(); piezas.push('labio');
  if (corcho) { const cg = g.createLinearGradient(-0.032, 0, 0.032, 0); cg.addColorStop(0, '#8a6535'); cg.addColorStop(0.35, '#d1a468'); cg.addColorStop(1, '#7c5a2e'); g.fillStyle = cg; g.beginPath(); g.moveTo(-0.034, -0.5 - 0.05); g.lineTo(0.034, -0.5 - 0.05); g.lineTo(0.031, -0.5 + 0.11); g.lineTo(-0.031, -0.5 + 0.11); g.closePath(); g.fill();
    const rc = rng(seed + 5); for (let i = 0; i < 70; i++) { g.fillStyle = rc() < 0.6 ? 'rgba(60,35,12,0.45)' : 'rgba(240,215,160,0.4)'; g.fillRect((rc() * 2 - 1) * 0.03, -0.5 - 0.05 + rc() * 0.16, 0.0016 + rc() * 0.003, 0.0012 + rc() * 0.002); }
    g.fillStyle = '#e0b878'; g.beginPath(); g.ellipse(0, -0.5 - 0.05, 0.034, 0.006, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(60,35,12,0.6)'; g.lineWidth = 0.002; g.stroke(); piezas.push('corcho'); }
  else { g.fillStyle = 'rgba(8,10,10,0.8)'; g.beginPath(); g.ellipse(0, -0.5, 0.036, 0.007, 0, 0, TAU); g.fill(); }
  // 7 algas adheridas por fuera: cintas con hojillas que se mecen
  const na = Math.round(9 * algas), ra = rng(seed + 9); for (let i = 0; i < na; i++) {
    const yy = lerp(0.55, 0.97, ra()), sg = ra() < 0.5 ? -1 : 1, x0 = sg * rad(yy) * 0.97, L = 0.05 + ra() * 0.14, fase = ra() * 6, col = mezclar('#3e6b36', '#8fa24a', ra()); let px = x0, py = yy - 0.5; const pts = [[px, py]];
    for (let k = 1; k <= 10; k++) { const q = k / 10; px = x0 + sg * (0.01 + 0.07 * q * ra() * 0.5) * (1) + Math.sin(t * 1.4 + fase + q * 3) * 0.012 * q; py = yy - 0.5 + L * q * 0.9 + Math.sin(t * 0.9 + fase) * 0.006 * q; pts.push([px, py]); }
    g.lineCap = 'round'; for (let k = 1; k < pts.length; k++) { g.strokeStyle = rgba(oscurecer(col, 0.3), 0.9); g.lineWidth = 0.011 * (1 - k / 11) + 0.002; g.beginPath(); g.moveTo(...pts[k - 1]); g.lineTo(...pts[k]); g.stroke(); g.strokeStyle = col; g.lineWidth = 0.006 * (1 - k / 11) + 0.0012; g.stroke(); }
    pts.forEach(([hx, hy], k) => { if (k % 3 !== 2) return; g.fillStyle = rgba(col, 0.9); g.beginPath(); g.ellipse(hx + sg * 0.012, hy, 0.018, 0.005, sg * 0.5 + k * 0.2, 0, TAU); g.fill(); });
  } if (na) piezas.push('algas');
  g.restore();
  return { piezas, caja: bboxRot([...cont.map(([px, py]) => [px * alto, py * alto]), [0, -alto * (0.5 + (corcho ? 0.05 : 0))]], x, y, rot) };
}

// ------------------------------------------------------------------ MONEDA
const cajaBlur = (a, n, r) => { const t = new Float32Array(a.length); for (let pasada = 0; pasada < 2; pasada++) { for (let y = 0; y < n; y++) { let s = 0; for (let x = -r; x <= r; x++) s += a[y * n + clamp(x, 0, n - 1)]; for (let x = 0; x < n; x++) { t[y * n + x] = s / (2 * r + 1); s += a[y * n + Math.min(n - 1, x + r + 1)] - a[y * n + Math.max(0, x - r)]; } } for (let x = 0; x < n; x++) { let s = 0; for (let y = -r; y <= r; y++) s += t[clamp(y, 0, n - 1) * n + x]; for (let y = 0; y < n; y++) { a[y * n + x] = s / (2 * r + 1); s += t[Math.min(n - 1, y + r + 1) * n + x] - t[Math.max(0, y - r) * n + x]; } } } return a; };
const leerMascara = (c, n) => { const d = c.getContext('2d').getImageData(0, 0, n, n).data, a = new Float32Array(n * n); for (let i = 0; i < n * n; i++) a[i] = d[i * 4] / 255; return a; };
// perfil de busto (mira a la derecha), coordenadas relativas al radio de la moneda
const BUSTO = [[-0.3, 0.62], [-0.38, 0.35], [-0.5, 0.15], [-0.52, -0.1], [-0.42, -0.34], [-0.2, -0.5], [0.05, -0.54], [0.24, -0.42], [0.31, -0.26], [0.32, -0.16], [0.43, 0.0], [0.42, 0.06], [0.32, 0.09], [0.34, 0.16], [0.3, 0.2], [0.34, 0.26], [0.28, 0.34], [0.31, 0.42], [0.22, 0.48], [0.12, 0.5], [0.16, 0.62]];
function dispositivoMoneda(g, n, cara, rr, seed) {
  const R = n / 2; g.save(); g.translate(R, R); g.fillStyle = '#fff'; g.strokeStyle = '#fff';
  if (cara === 'perfil') {
    const P = suavizar(BUSTO.map(([px, py]) => [px * R * 0.95, (py - 0.04) * R * 0.95]), 2); trazar(g, [...P, [P[P.length - 1][0] - 4, R * 0.62], [-R * 0.32, R * 0.62]]); g.fill();
    g.fillStyle = '#000'; g.beginPath(); g.ellipse(R * 0.2, -R * 0.2, R * 0.022, R * 0.012, 0, 0, TAU); g.fill();
    g.strokeStyle = '#7a7a7a'; g.lineWidth = R * 0.012; g.lineCap = 'round'; for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(-R * 0.18 - i * R * 0.04, -R * 0.1 + i * R * 0.02, R * (0.34 - i * 0.02), 3.7, 5.4); g.stroke(); }
    g.fillStyle = '#d0d0d0'; for (let i = 0; i < 9; i++) { const a = -2.9 + i * 0.17; g.beginPath(); g.ellipse(Math.cos(a) * R * 0.5 - R * 0.12, Math.sin(a) * R * 0.5 - R * 0.05, R * 0.05, R * 0.025, a + 1.5, 0, TAU); g.fill(); }
  } else {
    const w = R * 0.52, h = R * 0.62, esc = () => { g.beginPath(); g.moveTo(-w, -h * 0.85); g.lineTo(w, -h * 0.85); g.lineTo(w, h * 0.1); g.bezierCurveTo(w, h * 0.55, w * 0.4, h * 0.8, 0, h); g.bezierCurveTo(-w * 0.4, h * 0.8, -w, h * 0.55, -w, h * 0.1); g.closePath(); };
    esc(); g.fillStyle = '#9a9a9a'; g.fill(); g.save(); g.scale(0.86, 0.86); esc(); g.fillStyle = '#6a6a6a'; g.fill(); g.restore();
    g.fillStyle = '#fff'; g.fillRect(-w * 0.14, -h * 0.7, w * 0.28, h * 1.45); g.fillRect(-w * 0.72, -h * 0.28, w * 1.44, h * 0.26); for (const [bx, by] of [[-0.45, -0.58], [0.45, -0.58], [-0.45, 0.35], [0.45, 0.35]]) { g.beginPath(); g.arc(bx * w, by * h, R * 0.07, 0, TAU); g.fill(); }
    g.beginPath(); g.moveTo(-R * 0.25, -h * 0.98); for (let i = 0; i < 5; i++) { g.lineTo(-R * 0.25 + i * R * 0.125, -h * 0.98 - R * 0.07); g.lineTo(-R * 0.19 + i * R * 0.125, -h * 0.98); } g.closePath(); g.fill(); // corona
  }
  g.restore();
}
function caraMoneda(R, sc, { cara, leyenda, desgaste, tono, seed, luz, estrias }) {
  const n = Math.ceil(2 * R * sc) + 4, rpx = R * sc, o = n / 2, mk = createCanvas(n, n), mg = mk.getContext('2d'); mg.fillStyle = '#000'; mg.fillRect(0, 0, n, n);
  dispositivoMoneda(mg, n, cara, rpx, seed); const dev = cajaBlur(leerMascara(mk, n), n, Math.max(1, Math.round(rpx * 0.018)));
  mg.fillStyle = '#000'; mg.fillRect(0, 0, n, n); registrarFuentes(); mg.fillStyle = '#fff'; mg.translate(o, o);
  const txt = String(leyenda || '').toUpperCase(), tam = rpx * 0.13; mg.font = fuenteCss('bold', tam, false); mg.textAlign = 'center'; mg.textBaseline = 'middle';
  if (txt) { const arco = Math.min(Math.PI * 1.55, txt.length * 0.17 + 0.4), a0 = -Math.PI / 2 - arco / 2; [...txt].forEach((ch, i) => { const a = a0 + (i + 0.5) / txt.length * arco; mg.save(); mg.rotate(a + Math.PI / 2); mg.fillText(ch, 0, -rpx * 0.76); mg.restore(); }); }
  const leg = cajaBlur(leerMascara(mk, n), n, Math.max(1, Math.round(rpx * 0.006))), H = new Float32Array(n * n), rng2 = rng(seed);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = x + 0.5 - o, dy = y + 0.5 - o, q = Math.hypot(dx, dy) / rpx, aro = smoothstep(0.915, 0.94, q) * smoothstep(1, 0.975, q), perla = (() => { const a = Math.atan2(dy, dx), seg = (a + Math.PI) / (Math.PI * 2) * 76, d = Math.hypot((seg % 1) - 0.5, (q - 0.885) * rpx / (rpx * 0.02) * 0.5); return smoothstep(0.5, 0.3, d) * smoothstep(0.86, 0.87, q) * smoothstep(0.91, 0.9, q); })();
    const amp = 1 - desgaste * 0.7 * (1 - q), ruido = (fbm(x * 0.09, y * 0.09, seed, 3) - 0.5) * 0.12 * (0.3 + desgaste) + (fbm(x * 0.5, y * 0.5, seed + 3, 2) - 0.5) * 0.05;
    H[y * n + x] = (aro * 1.0 + perla * 0.55 + dev[y * n + x] * 0.9 * amp + leg[y * n + x] * 1.0 * amp + ruido) * (q < 1 ? 1 : 0);
  }
  const out = createCanvas(n, n), og = out.getContext('2d'), im = og.createImageData(n, n), d = im.data, kz = 7 / Math.max(rpx, 40) * 40 / 7 * 0.9 * (rpx / 60 > 1 ? 1 : 1);
  const lx = Math.cos(-2.3 + luz * 0.5), ly = Math.sin(-2.3 + luz * 0.5), lz = 0.75, ln = Math.hypot(lx, ly, lz), L = [lx / ln, ly / ln, lz / ln], hv = [L[0], L[1], L[2] + 1], hn = Math.hypot(...hv), Hv = hv.map((v) => v / hn), c0 = hexRgb(oscurecer(tono, 0.65)), c1 = hexRgb(tono), c2 = hexRgb(aclarar(tono, 0.55)), pat = hexRgb(mezclar(oscurecer(tono, 0.55), '#2f4a3a', 0.45));
  const rel = rpx * 0.055; // alto maximo del relieve en pixeles
  for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) {
    const i = y * n + x, dx = x + 0.5 - o, dy = y + 0.5 - o, q = Math.hypot(dx, dy) / rpx, cov = clamp((rpx - Math.hypot(dx, dy)) + 0.5, 0, 1); if (cov <= 0) continue;
    const gx = (H[i + 1] - H[i - 1]) * rel * 0.5, gy = (H[i + n] - H[i - n]) * rel * 0.5, nn = Math.hypot(gx, gy, 1), N = [-gx / nn, -gy / nn, 1 / nn];
    const dif = Math.max(0, N[0] * L[0] + N[1] * L[1] + N[2] * L[2]), esp = Math.pow(Math.max(0, N[0] * Hv[0] + N[1] * Hv[1] + N[2] * Hv[2]), 24) * 0.55, base = clamp(dif * 0.95 + 0.06, 0, 1.3), ao = 1 - 0.35 * smoothstep(0.1, 0, H[i]) * smoothstep(0.1, 0.3, Math.abs(gx) + Math.abs(gy) + 0.1), anis = 0.94 + 0.06 * Math.sin(Math.atan2(dy, dx) * 8 + q * 40);
    const t2 = clamp(base * ao * anis, 0, 1.25), a = t2 < 0.55 ? t2 / 0.55 : (t2 - 0.55) / 0.7, ca = t2 < 0.55 ? c0 : c1, cb = t2 < 0.55 ? c1 : c2, poro = smoothstep(0.05, -0.02, H[i] - 0.12) * smoothstep(0.45, 0.7, fbm(x * 0.12, y * 0.12, seed + 7, 3)) * desgaste * desgaste, ruido = ((x * 73856093 ^ y * 19349663) & 255) / 255 - 0.5, o4 = i * 4;
    for (let k = 0; k < 3; k++) { const v = lerp(lerp(ca[k], cb[k], Math.min(1, a)), pat[k], poro * 0.55) * (1 - 0.2 * smoothstep(0.93, 1, q)); d[o4 + k] = clamp(lerp(v, 255, clamp(esp, 0, 1)) + ruido * 3, 0, 255); }
    d[o4 + 3] = cov * 255;
  }
  og.putImageData(im, 0, 0); void rng2, kz, estrias; return { c: out, n: n / sc };
}
/**
 * moneda(ctx,{x,y,r,cara,leyenda,desgaste,canto,giro,tono,luz,grosor,seed}): moneda con relieve por MAPA DE ALTURAS iluminado por una luz direccional (nunca una esfera).
 * cara 'perfil' (busto) o 'escudo'; leyenda = texto circular en relieve; desgaste 0..1 (el relieve se aplana hacia el centro y aparece patina); canto = true dibuja el canto estriado.
 * giro 0 = de frente ... PI/2 = de canto (el disco se estrecha y asoma el canto con sus estrias). grosor = espesor relativo al radio.
 */
export function moneda(ctx, { x = 0, y = 0, r = 140, cara = 'perfil', leyenda = 'PRIMUS ANNUS', desgaste = 0.4, canto = true, giro = 0, rot = 0, tono = '#b99a5b', luz = -0.6, grosor = 0.17, seed = 7 } = {}) {
  const piezas = ['disco', 'reborde', 'campo', 'relieve', cara === 'perfil' ? 'busto' : 'escudo', 'leyenda', 'perlas', 'desgaste', 'patina', 'brillo', 'luz-direccional'], sc = escala(ctx), cg = Math.cos(giro), sg = Math.sin(giro), e = r * grosor, wTot = 2 * r * Math.abs(cg) + e * sg, xf = -wTot / 2 + r * Math.abs(cg), bandaX = r * Math.abs(cg);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); sombraSuave(ctx, 0, r * 1.02, r * (0.5 + 0.6 * Math.abs(cg)), r * 0.14, 0.3);
  if (canto && sg > 0.02) { // canto: banda con estrias entre el disco de atras y el de delante
    const bx = xf + bandaX * 0.0, ancho = e * sg, x0 = xf, grad = ctx.createLinearGradient(0, -r, 0, r); grad.addColorStop(0, aclarar(tono, 0.4)); grad.addColorStop(0.35, tono); grad.addColorStop(0.75, oscurecer(tono, 0.45)); grad.addColorStop(1, oscurecer(tono, 0.7));
    ctx.fillStyle = grad; ctx.beginPath(); ctx.ellipse(x0 + ancho, 0, bandaX, r, 0, 0, TAU); ctx.fill(); ctx.fillRect(x0, -r, ancho, 2 * r);
    if (Math.abs(cg) < 0.02) { ctx.fillStyle = grad; ctx.fillRect(x0 - ancho / 2 + ancho / 2, -r, ancho, 2 * r); }
    ctx.save(); ctx.beginPath(); ctx.ellipse(x0 + ancho, 0, bandaX, r, 0, 0, TAU); ctx.rect(x0, -r, ancho, 2 * r); ctx.clip(); const N = 56; for (let i = 0; i < N; i++) { const a = -Math.PI / 2 + (i + 0.5) / N * Math.PI, yy = Math.sin(a) * r, xs = Math.cos(a) * bandaX; ctx.strokeStyle = i % 2 ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.2)'; ctx.lineWidth = Math.max(0.8, r * 0.012); ctx.beginPath(); ctx.moveTo(x0 + xs, yy); ctx.lineTo(x0 + xs + ancho, yy); ctx.stroke(); } ctx.restore();
    ctx.strokeStyle = rgba(oscurecer(tono, 0.7), 0.7); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x0 + ancho, 0, bandaX, r, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke(); piezas.push('canto', 'estrias');
  }
  if (Math.abs(cg) > 0.02) { const cara0 = guardar(['m', Math.round(r), cara, leyenda, Math.round(desgaste * 20), tono, seed, luz, sc.toFixed(2)].join('|'), () => caraMoneda(r, sc, { cara, leyenda, desgaste, tono, seed, luz })); ctx.save(); ctx.translate(canto && sg > 0.02 ? xf : 0, 0); ctx.scale(Math.abs(cg), 1); ctx.drawImage(cara0.c, -r - 2, -r - 2, cara0.n, cara0.n); ctx.restore(); }
  else { const w = e, gr = ctx.createLinearGradient(0, -r, 0, r); gr.addColorStop(0, aclarar(tono, 0.4)); gr.addColorStop(0.4, tono); gr.addColorStop(1, oscurecer(tono, 0.65)); ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(-w / 2, -r, w, 2 * r, w * 0.15); ctx.fill(); piezas.push('canto', 'estrias'); const N = 60; for (let i = 0; i < N; i++) { const yy = Math.sin(-Math.PI / 2 + (i + 0.5) / N * Math.PI) * r; ctx.strokeStyle = i % 2 ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.22)'; ctx.lineWidth = Math.max(0.8, r * 0.012); ctx.beginPath(); ctx.moveTo(-w / 2, yy); ctx.lineTo(w / 2, yy); ctx.stroke(); } }
  ctx.restore();
  return { piezas: [...new Set(piezas)], caja: bboxRot(esquinas(wTot / 2, r), x, y, rot) };
}

// ------------------------------------------------------------------ PAPEL: sobre, tarjeta, sello
const textura = (w, h, seed, tono) => guardar(['tp', Math.round(w), Math.round(h), seed, tono].join('|'), () => { const n = Math.ceil(w / 3), m = Math.ceil(h / 3), c = createCanvas(n, m), g = c.getContext('2d'), im = g.createImageData(n, m), a = hexRgb(oscurecer(tono, 0.07)), b = hexRgb(aclarar(tono, 0.04)); for (let y = 0; y < m; y++) for (let x = 0; x < n; x++) { const q = fbm(x * 0.2, y * 0.2, seed, 3), o = (y * n + x) * 4; for (let k = 0; k < 3; k++) im.data[o + k] = lerp(a[k], b[k], q); im.data[o + 3] = 255; } g.putImageData(im, 0, 0); return c; });
function sello_cera(g, x, y, r, seed, color = '#8e2b2b', roto = 0) {
  const P = blob(x, y, r, seed, 0.1, 36), gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1); gr.addColorStop(0, aclarar(color, 0.45)); gr.addColorStop(0.5, color); gr.addColorStop(1, oscurecer(color, 0.55));
  g.save(); sombraSuave(g, x + r * 0.1, y + r * 0.2, r * 1.1, r * 0.9, 0.35); g.fillStyle = gr; trazar(g, P); g.fill(); g.strokeStyle = rgba(oscurecer(color, 0.7), 0.7); g.lineWidth = Math.max(1, r * 0.03); g.stroke();
  g.strokeStyle = rgba(oscurecer(color, 0.45), 0.9); g.lineWidth = r * 0.08; g.beginPath(); g.arc(x, y, r * 0.66, 0, TAU); g.stroke(); g.strokeStyle = rgba(aclarar(color, 0.5), 0.6); g.lineWidth = r * 0.03; g.beginPath(); g.arc(x - r * 0.02, y - r * 0.02, r * 0.66, 3.4, 5.2); g.stroke();
  g.fillStyle = rgba(oscurecer(color, 0.4), 0.9); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3, r * 0.17, r * 0.06, a, 0, TAU); g.fill(); } g.beginPath(); g.arc(x, y, r * 0.1, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(x - r * 0.4, y - r * 0.55, r * 0.22, r * 0.09, -0.6, 0, TAU); g.fill();
  if (roto) { g.strokeStyle = 'rgba(30,8,8,0.8)'; g.lineWidth = r * 0.05; g.beginPath(); g.moveTo(x - r * 0.1, y - r); g.lineTo(x + r * 0.08, y - r * 0.4); g.lineTo(x - r * 0.12, y + r * 0.1); g.lineTo(x + r * 0.05, y + r); g.stroke(); }
  g.restore();
}
/**
 * sobre(ctx,{x,y,w,abierto,sello,rot,tono,seed}): sobre de papel: sombra, forro interior, carta que asoma, cuerpo con fibra, pliegues laterales e inferior, solapa que
 * gira de cerrada a abierta (abierto 0..1; el apice cruza el borde superior), sello de lacre (se rompe al abrir), direccion a mano, borde y arrugas.
 */
export function sobre(ctx, { x = 0, y = 0, w = 700, abierto = 0, sello = true, rot = 0, tono = '#e6d6b2', seed = 3 } = {}) {
  const h = w * 0.66, piezas = [], g = ctx, a = clamp(abierto), cf = Math.cos(a * Math.PI), L = 0.58 * h * cf, forro = '#8a3a34', cuerpo = () => g.rect(-w / 2, -h / 2, w, h);
  g.save(); g.translate(x, y); g.rotate(rot);
  sombraSuave(g, 0, h / 2 + h * 0.02, w * 0.52, h * 0.1, 0.4); piezas.push('sombra');
  const solapa = (frente) => { // triangulo con bisagra en el borde superior
    const ap = -h / 2 + L; g.beginPath(); g.moveTo(-w / 2, -h / 2); g.lineTo(w / 2, -h / 2); g.lineTo(0, ap); g.closePath();
    const q = frente ? tono : forro, gr = g.createLinearGradient(0, -h / 2, 0, ap); gr.addColorStop(0, oscurecer(q, frente ? 0.08 : 0.25)); gr.addColorStop(1, frente ? aclarar(q, 0.04) : q); g.fillStyle = gr; g.fill(); g.strokeStyle = rgba(oscurecer(tono, 0.5), 0.55); g.lineWidth = 1.4; g.stroke();
    if (!frente) { g.save(); g.clip(); g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 2; for (let i = -10; i < 24; i++) { g.beginPath(); g.moveTo(-w / 2 + i * 22, -h / 2 + 60); g.lineTo(-w / 2 + i * 22 + 70, ap - 30); g.stroke(); } g.restore(); }
  };
  if (cf < 0) { solapa(false); piezas.push('solapa'); }
  g.fillStyle = forro; g.beginPath(); cuerpo(); g.fill(); piezas.push('forro');
  if (a > 0.25) { const k = smoothstep(0.25, 0.9, a), ch = h * 0.78, cy = -h / 2 + h * 0.06 - k * h * 0.26; g.save(); sombraSuave(g, 0, cy + ch * 0.5, w * 0.4, h * 0.04, 0.18); const gr = g.createLinearGradient(0, cy, 0, cy + ch); gr.addColorStop(0, '#faf4e2'); gr.addColorStop(1, '#e9dfc2'); g.fillStyle = gr; g.beginPath(); g.roundRect(-w * 0.42, cy, w * 0.84, ch, 3); g.fill(); g.strokeStyle = 'rgba(30,38,48,0.55)'; g.lineWidth = 2.2; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-w * 0.33, cy + h * 0.1 + i * h * 0.075); g.bezierCurveTo(-w * 0.1, cy + h * 0.1 + i * h * 0.075 - 3, w * 0.1, cy + h * 0.1 + i * h * 0.075 + 3, w * (0.33 - i * 0.05), cy + h * 0.1 + i * h * 0.075); g.stroke(); } g.restore(); piezas.push('carta'); }
  // cuerpo frontal con fibra y arrugas
  g.save(); g.beginPath(); cuerpo(); g.clip(); g.drawImage(textura(w, h, seed, tono), -w / 2, -h / 2, w, h);
  const sg = g.createLinearGradient(0, -h / 2, 0, h / 2); sg.addColorStop(0, 'rgba(255,255,255,0.1)'); sg.addColorStop(1, 'rgba(60,40,20,0.14)'); g.fillStyle = sg; g.fillRect(-w / 2, -h / 2, w, h); piezas.push('cuerpo', 'fibra');
  g.strokeStyle = rgba(oscurecer(tono, 0.45), 0.5); g.lineWidth = 1.5; for (const sg2 of [-1, 1]) { g.beginPath(); g.moveTo(sg2 * w / 2, -h / 2); g.lineTo(0, h * 0.08); g.stroke(); g.strokeStyle = `rgba(255,255,255,0.35)`; g.beginPath(); g.moveTo(sg2 * w / 2, -h / 2 + 2); g.lineTo(0, h * 0.08 + 2); g.stroke(); g.strokeStyle = rgba(oscurecer(tono, 0.45), 0.5); } piezas.push('pliegue-lateral');
  g.beginPath(); g.moveTo(-w / 2, h / 2); g.lineTo(0, h * 0.08); g.lineTo(w / 2, h / 2); g.stroke(); piezas.push('pliegue-inferior');
  const rr = rng(seed + 2); g.strokeStyle = 'rgba(60,40,20,0.07)'; g.lineWidth = 1.2; for (let i = 0; i < 5; i++) { g.beginPath(); const x0 = (rr() - 0.5) * w, y0 = (rr() - 0.5) * h; g.moveTo(x0, y0); g.quadraticCurveTo(x0 + (rr() - 0.5) * 120, y0 + (rr() - 0.5) * 80, x0 + (rr() - 0.5) * 200, y0 + (rr() - 0.5) * 150); g.stroke(); } piezas.push('arrugas');
  if (a < 0.6) { g.globalAlpha = 1 - a / 0.6; for (let i = 0; i < 3; i++) trazoMano(g, Array.from({ length: 14 }, (_, k) => [-w * (0.24 - i * 0.02) + k * w * (0.035 - i * 0.003), h * (0.2 + i * 0.075) + Math.sin(k * 0.8 + i) * 2.5 * (w / 700)]), { tam: 3.4 * (w / 700), color: '#1f2a36', seed: seed + i }); g.globalAlpha = 1; piezas.push('direccion'); }
  g.restore(); g.strokeStyle = rgba(oscurecer(tono, 0.55), 0.6); g.lineWidth = 1.6; g.beginPath(); cuerpo(); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-w / 2 + 2, -h / 2 + 2); g.lineTo(-w / 2 + 2, h / 2 - 2); g.stroke(); piezas.push('borde');
  if (cf >= 0) { // sombra de la solapa cerrada sobre el cuerpo y solapa
    g.save(); g.translate(0, h * 0.012); g.globalAlpha = 0.35; g.fillStyle = '#000'; g.beginPath(); g.moveTo(-w / 2, -h / 2); g.lineTo(w / 2, -h / 2); g.lineTo(0, -h / 2 + L); g.closePath(); g.filter = 'none'; g.fill(); g.restore(); solapa(true); piezas.push('solapa');
  }
  if (sello) { if (a < 0.12) sello_cera(g, 0, -h / 2 + L + (cf < 0 ? 0 : 0) - w * 0.045, w * 0.07, seed, '#8e2b2b', 0); else if (a < 0.7) { sello_cera(g, w * 0.03, -h / 2 + L - w * 0.04, w * 0.065, seed, '#8e2b2b', 1); sello_cera(g, -w * 0.04, h * 0.1, w * 0.03, seed + 1, '#7a2424', 0); } else sello_cera(g, -w * 0.05, h * 0.12, w * 0.032, seed + 1, '#7a2424', 0); piezas.push('sello'); }
  g.restore();
  const ext = [[-w / 2, -h / 2 + Math.min(0, L) - (a > 0.25 ? h * 0.26 * smoothstep(0.25, 0.9, a) : 0)], [w / 2, h / 2]];
  return { piezas, caja: bboxRot([[ext[0][0], ext[0][1]], [ext[1][0], ext[0][1]], [ext[1][0], ext[1][1]], [ext[0][0], ext[1][1]]], x, y, rot) };
}

/**
 * tarjeta(ctx,{x,y,w,h,lineas,sello,doblez,rot,tono,tam,seed}): hoja con borde irregular, filete, lineas de texto AJUSTADAS dentro de la tarjeta (nunca se salen), regla tenue,
 * mancha de taza, esquina levantada, doblez central con luz y sombra (doblez 0..1) y sello de tinta. Devuelve ademas `textos`: cajas de cada linea con su `contenedor`.
 */
export function tarjeta(ctx, { x = 0, y = 0, w = 560, h = 380, lineas = [], sello = true, doblez = 0.5, rot = 0, tono = '#f3ead3', tam = 34, color = '#1f2a36', seed = 4, alfa = 1 } = {}) {
  const g = ctx, piezas = [], r = rng(seed), m = w * 0.08, textos = [];
  g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = alfa; sombraSuave(g, 0, h / 2 + 4, w * 0.55, h * 0.08, 0.38); piezas.push('sombra');
  const borde = []; const N = 26; for (let i = 0; i <= N; i++) borde.push([-w / 2 + w * i / N, -h / 2 + (fbm(i * 0.8, 1, seed, 2) - 0.5) * 5]); for (let i = 1; i <= N * 0.7; i++) borde.push([w / 2 + (fbm(i * 0.8, 2, seed, 2) - 0.5) * 5, -h / 2 + h * i / (N * 0.7)]); for (let i = 1; i <= N; i++) borde.push([w / 2 - w * i / N, h / 2 + (fbm(i * 0.8, 3, seed, 2) - 0.5) * 5]); for (let i = 1; i < N * 0.7; i++) borde.push([-w / 2 + (fbm(i * 0.8, 4, seed, 2) - 0.5) * 5, h / 2 - h * i / (N * 0.7)]);
  g.save(); trazar(g, borde); g.clip(); g.fillStyle = tono; g.fillRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12); g.drawImage(textura(w, h, seed, tono), -w / 2, -h / 2, w, h); piezas.push('hoja', 'fibra');
  const vg = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); vg.addColorStop(0, 'rgba(255,255,255,0.14)'); vg.addColorStop(1, 'rgba(80,55,25,0.16)'); g.fillStyle = vg; g.fillRect(-w / 2, -h / 2, w, h);
  g.strokeStyle = rgba(color, 0.35); g.lineWidth = 1.4; g.strokeRect(-w / 2 + m * 0.55, -h / 2 + m * 0.55, w - m * 1.1, h - m * 1.1); g.strokeStyle = rgba(color, 0.2); g.strokeRect(-w / 2 + m * 0.7, -h / 2 + m * 0.7, w - m * 1.4, h - m * 1.4); piezas.push('filete');
  const cx0 = r() * w * 0.2 + w * 0.12, cy0 = h * 0.2 + r() * h * 0.2; g.strokeStyle = 'rgba(120,80,40,0.22)'; g.lineWidth = 4; g.beginPath(); g.arc(cx0, cy0, 30, 0.3, 5.6); g.stroke(); g.strokeStyle = 'rgba(120,80,40,0.1)'; g.lineWidth = 9; g.stroke(); piezas.push('mancha');
  const fila = tam * 1.55, top = -h / 2 + m * 1.1; g.strokeStyle = 'rgba(90,110,140,0.22)'; g.lineWidth = 1; for (let yy = top + fila; yy < h / 2 - m; yy += fila) { g.beginPath(); g.moveTo(-w / 2 + m, yy); g.lineTo(w / 2 - m, yy); g.stroke(); } piezas.push('regla');
  lineas.forEach((ln, i) => { const cont = { x: -w / 2 + m * 1.1, y: top + i * fila, w: w - m * 2.2, h: fila * 0.95 }; if (cont.y + cont.h > h / 2 - m * 0.6) return; const c = textoEn(g, ln, cont, { tam, min: 12, color, interlinea: 1.15 }); textos.push({ ...c, id: 'linea' + i }); }); if (lineas.length) piezas.push('texto');
  if (doblez > 0.01) { const d = doblez; const a = g.createLinearGradient(-w * 0.04, 0, w * 0.04, 0); a.addColorStop(0, 'rgba(60,40,20,0)'); a.addColorStop(0.42, `rgba(255,255,255,${0.35 * d})`); a.addColorStop(0.5, `rgba(60,40,20,${0.42 * d})`); a.addColorStop(0.58, `rgba(60,40,20,${0.12 * d})`); a.addColorStop(1, 'rgba(60,40,20,0)'); g.fillStyle = a; g.fillRect(-w * 0.04, -h / 2, w * 0.08, h); g.fillStyle = `rgba(60,40,20,${0.06 * d})`; g.fillRect(0, -h / 2, w / 2, h); piezas.push('doblez'); }
  g.restore(); // esquina levantada
  g.save(); g.translate(w / 2, h / 2); g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.moveTo(-w * 0.1, 3); g.lineTo(3, -h * 0.12); g.lineTo(3, 3); g.fill(); g.fillStyle = aclarar(tono, 0.1); g.beginPath(); g.moveTo(-w * 0.1, 0); g.lineTo(0, -h * 0.11); g.lineTo(-w * 0.075, -h * 0.065); g.closePath(); g.fill(); piezas.push('esquina'); g.restore();
  if (sello) { g.save(); g.translate(w * 0.3, h * 0.26); g.rotate(-0.25); g.globalAlpha = alfa * 0.8; g.strokeStyle = '#8e2b2b'; g.lineWidth = 3.2; g.beginPath(); g.arc(0, 0, w * 0.085, 0, TAU); g.stroke(); g.lineWidth = 1.4; g.beginPath(); g.arc(0, 0, w * 0.068, 0, TAU); g.stroke(); g.fillStyle = '#8e2b2b'; for (let i = 0; i < 5; i++) { const q = -Math.PI / 2 + i * TAU / 5; g.beginPath(); g.arc(Math.cos(q) * w * 0.032, Math.sin(q) * w * 0.032, w * 0.011, 0, TAU); g.fill(); } const rs = rng(seed + 8); g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${0.3 + rs() * 0.5})`; g.fillRect((rs() * 2 - 1) * w * 0.09, (rs() * 2 - 1) * w * 0.09, 1 + rs() * 2, 1 + rs() * 2); } g.restore(); piezas.push('sello'); }
  g.restore();
  const c = Math.cos(rot), s = Math.sin(rot), P2 = ({ x: bx, y: by, w: bw, h: bh, ...rest }) => { const co = [[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]].map(([px, py]) => [x + px * c - py * s, y + px * s + py * c]), xs = co.map((p2) => p2[0]), ys = co.map((p2) => p2[1]); return { ...rest, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; };
  return { piezas, caja: bboxRot(esquinas(w / 2, h / 2), x, y, rot), textos: textos.map((t) => ({ ...P2(t), contenedor: P2(t.contenedor) })) };
}

/**
 * sello(ctx,{x,y,tam,texto,golpe,color,rot,seed}): sello de goma con mango torneado. golpe 0..1: baja, toca el papel hacia 0.45 y sube dejando la huella (anillos, texto circular,
 * estrella, tinta irregular). (x,y) es el punto de contacto. Pinta tambien la almohadilla de tinta si `almohadilla` es true.
 */
export function sello(ctx, { x = 0, y = 0, tam = 260, texto = 'ARCHIVO', golpe = 0, color = '#8e2b2b', rot = 0, seed = 3, almohadilla = false } = {}) {
  const g = ctx, piezas = [], rm = tam * 0.24, e = (v) => v * v * (3 - 2 * v), g0 = clamp(golpe), alza = g0 < 0.45 ? 1 - e(g0 / 0.45) : e((g0 - 0.45) / 0.55) * 0.9, marca = smoothstep(0.45, 0.52, g0), lift = alza * tam * 0.9;
  registrarFuentes();
  if (marca > 0) { // huella: se cachea como bitmap con tinta irregular
    const sc = escala(g), n = Math.ceil(rm * 2.4 * sc), b = guardar(['sm', n, texto, color, seed].join('|'), () => { const c = createCanvas(n, n), q = c.getContext('2d'); q.scale(sc, sc); q.translate(n / 2 / sc, n / 2 / sc); q.fillStyle = q.strokeStyle = color; q.lineWidth = rm * 0.09; q.beginPath(); q.arc(0, 0, rm, 0, TAU); q.stroke(); q.lineWidth = rm * 0.03; q.beginPath(); q.arc(0, 0, rm * 0.62, 0, TAU); q.stroke();
      const T = String(texto).toUpperCase(), tt = rm * 0.19; q.font = fuenteCss('bold', tt, false); q.textAlign = 'center'; q.textBaseline = 'middle'; const arco = Math.min(Math.PI * 1.4, T.length * 0.3), a0 = -Math.PI / 2 - arco / 2; [...T].forEach((ch, i) => { const a = a0 + (i + 0.5) / T.length * arco; q.save(); q.rotate(a + Math.PI / 2); q.fillText(ch, 0, -rm * 0.81); q.restore(); });
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5, a2 = a + TAU / 10; q.beginPath(); q.moveTo(Math.cos(a) * rm * 0.3, Math.sin(a) * rm * 0.3); q.lineTo(Math.cos(a2) * rm * 0.12, Math.sin(a2) * rm * 0.12); q.lineTo(Math.cos(a + TAU / 5) * rm * 0.3, Math.sin(a + TAU / 5) * rm * 0.3); q.fill(); }
      const rr = rng(seed); q.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 1400; i++) { const px = (rr() * 2 - 1) * rm * 1.1, py = (rr() * 2 - 1) * rm * 1.1, k = fbm(px * 0.05, py * 0.05, seed, 3); if (k > 0.45) { q.fillStyle = `rgba(0,0,0,${0.25 + rr() * 0.6})`; q.fillRect(px, py, 0.8 + rr() * 2.2, 0.8 + rr() * 2.2); } } return c; });
    g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = marca * 0.92; g.globalCompositeOperation = 'multiply'; g.drawImage(b, -b.width / sc / 2, -b.height / sc / 2, b.width / sc, b.height / sc); g.restore(); piezas.push('huella', 'huella-anillos', 'huella-texto', 'huella-estrella', 'huella-grano');
  }
  if (almohadilla) { g.save(); g.translate(x + rm * 2.4, y + rm * 0.3); const gr = g.createLinearGradient(0, -rm * 0.4, 0, rm * 0.4); gr.addColorStop(0, '#4a4f55'); gr.addColorStop(1, '#23262a'); g.fillStyle = gr; g.beginPath(); g.roundRect(-rm * 0.85, -rm * 0.3, rm * 1.7, rm * 0.7, rm * 0.1); g.fill(); g.fillStyle = oscurecer(color, 0.25); g.beginPath(); g.roundRect(-rm * 0.72, -rm * 0.4, rm * 1.44, rm * 0.5, rm * 0.08); g.fill(); g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(-rm * 0.6, -rm * 0.36, rm * 0.8, rm * 0.04); g.restore(); piezas.push('almohadilla'); }
  // la herramienta, sobre el punto de contacto, se inclina un poco al bajar
  const sh = 1 - alza * 0.55; sombraSuave(g, x + lift * 0.12, y + rm * 0.15, rm * (1.0 + alza * 0.25), rm * 0.22, 0.28 * sh * (1 - marca * 0.3)); piezas.push('sombra');
  g.save(); g.translate(x + lift * 0.1, y - lift); g.rotate(rot + alza * 0.08);
  const base = (yy, hh, col) => { const gr = g.createLinearGradient(-rm, 0, rm, 0); gr.addColorStop(0, oscurecer(col, 0.45)); gr.addColorStop(0.3, aclarar(col, 0.15)); gr.addColorStop(1, oscurecer(col, 0.55)); g.fillStyle = gr; g.beginPath(); g.roundRect(-rm, yy, 2 * rm, hh, rm * 0.08); g.fill(); g.strokeStyle = rgba(oscurecer(col, 0.7), 0.7); g.lineWidth = 1.2; g.stroke(); };
  g.fillStyle = '#1b1b1d'; g.beginPath(); g.roundRect(-rm * 0.97, -rm * 0.16, rm * 1.94, rm * 0.16, rm * 0.05); g.fill(); piezas.push('goma');
  g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-rm * 0.9, -rm * 0.1); g.lineTo(rm * 0.9, -rm * 0.1); g.stroke(); piezas.push('cara');
  base(-rm * 0.46, rm * 0.3, '#8a5a32'); piezas.push('base');
  base(-rm * 0.58, rm * 0.13, '#b99a5b'); piezas.push('virola');
  torno(g, perfil([[-rm * 1.75, rm * 0.2], [-rm * 1.7, rm * 0.3], [-rm * 1.5, rm * 0.34], [-rm * 1.25, rm * 0.27], [-rm * 0.95, rm * 0.2], [-rm * 0.75, rm * 0.22], [-rm * 0.58, rm * 0.4]], 1), { x: 0, y: 0, tono: '#6b4326', luz: -0.5, reflejo: true }); piezas.push('mango');
  torno(g, perfil(Array.from({ length: 24 }, (_, i) => { const a = Math.PI * i / 23; return [-rm * 2.1 - Math.cos(a) * rm * 0.35, Math.sin(a) * rm * 0.46]; }), 1), { x: 0, y: 0, tono: '#6b4326', luz: -0.5, reflejo: false }); piezas.push('pomo');
  g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.2; for (const k of [-1.38, -1.2, -1.02]) { g.beginPath(); g.moveTo(-rm * 0.32, rm * k); g.lineTo(rm * 0.32, rm * k); g.stroke(); } piezas.push('anillos-mango');
  g.restore();
  return { piezas: [...new Set(piezas)], caja: { x: x - rm * 1.2, y: y - lift - rm * 2.5, w: rm * 2.4, h: rm * 2.7 + lift } };
}

// ------------------------------------------------------------------ LUPA
/**
 * lupa(ctx,{x,y,r,ang,aumento}): lupa con aro de laton, bisel, cristal que AMPLIA de verdad lo que hay debajo (lee el lienzo), reflejos, aberracion cromatica, virola, mango torneado
 * y remaches. (x,y) = centro del cristal; ang = direccion del mango. Requiere que el ctx tenga solo escala/traslacion.
 */
export function lupa(ctx, { x = 0, y = 0, r = 160, ang = Math.PI * 0.75, aumento = 1.7, tono = '#b99a5b' } = {}) {
  const g = ctx, piezas = [], m = g.getTransform?.() ?? { a: 1, d: 1, e: 0, f: 0 }, sc = Math.hypot(m.a, m.b ?? 0) || 1, cx = m.a * x + m.e, cy = m.d * y + m.f, rd = r * sc, W = g.canvas.width, H = g.canvas.height;
  sombraSuave(g, x + r * 0.15, y + r * 1.04, r * 0.9, r * 0.18, 0.3); piezas.push('sombra');
  g.save(); g.translate(x, y); g.rotate(ang);
  torno(g, perfil([[r * 1.04, r * 0.07], [r * 1.12, r * 0.1], [r * 1.5, r * 0.1], [r * 1.9, r * 0.14], [r * 2.35, r * 0.16], [r * 2.45, r * 0.13], [r * 2.5, r * 0.06]], 1), { x: 0, y: 0, tono: '#5e3d24', luz: -0.5 }); piezas.push('mango');
  torno(g, perfil([[r * 0.98, r * 0.12], [r * 1.0, r * 0.16], [r * 1.12, r * 0.16], [r * 1.14, r * 0.12]], 1), { x: 0, y: 0, tono, luz: -0.5 }); piezas.push('virola');
  g.fillStyle = oscurecer(tono, 0.5); for (const dx of [-r * 0.07, r * 0.07]) { g.beginPath(); g.arc(dx, r * 1.07, r * 0.017, 0, TAU); g.fill(); } piezas.push('remaches'); g.restore();
  const aro = g.createLinearGradient(x - r, y - r, x + r, y + r); aro.addColorStop(0, aclarar(tono, 0.5)); aro.addColorStop(0.45, tono); aro.addColorStop(1, oscurecer(tono, 0.6));
  g.fillStyle = aro; g.beginPath(); g.arc(x, y, r * 1.07, 0, TAU); g.arc(x, y, r * 0.97, 0, TAU, true); g.fill('evenodd'); piezas.push('aro');
  g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = r * 0.012; g.beginPath(); g.arc(x, y, r * 1.045, 3.4, 5.0); g.stroke(); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(x, y, r * 1.0, 0.3, 1.9); g.stroke(); piezas.push('bisel');
  g.save(); g.beginPath(); g.arc(x, y, r * 0.97, 0, TAU); g.clip();
  if (rd > 4) { const q = Math.ceil(rd * 2) + 2, tmp = createCanvas(q, q), tg = tmp.getContext('2d'); tg.drawImage(g.canvas, cx - rd - 1, cy - rd - 1, q, q, 0, 0, q, q); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(tmp, 0, 0, q, q, cx - rd * aumento - aumento, cy - rd * aumento - aumento, q * aumento, q * aumento); g.restore(); } piezas.push('ampliacion');
  const vg = g.createRadialGradient(x, y, r * 0.5, x, y, r); vg.addColorStop(0, 'rgba(255,255,255,0.04)'); vg.addColorStop(0.85, 'rgba(20,30,40,0.1)'); vg.addColorStop(1, 'rgba(10,15,20,0.4)'); g.fillStyle = vg; g.fillRect(x - r, y - r, 2 * r, 2 * r); piezas.push('cristal');
  g.lineWidth = r * 0.025; g.strokeStyle = 'rgba(255,60,60,0.25)'; g.beginPath(); g.arc(x, y, r * 0.93, 0.2, 1.4); g.stroke(); g.strokeStyle = 'rgba(60,160,255,0.25)'; g.beginPath(); g.arc(x, y, r * 0.93 + 2, 3.3, 4.5); g.stroke(); piezas.push('aberracion');
  g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.ellipse(x - r * 0.38, y - r * 0.45, r * 0.34, r * 0.07, -0.75, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = r * 0.03; g.lineCap = 'round'; g.beginPath(); g.arc(x, y, r * 0.86, 3.5, 4.3); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.arc(x + r * 0.45, y + r * 0.5, r * 0.05, 0, TAU); g.fill(); piezas.push('reflejo', 'reflejo-secundario');
  g.restore();
  const mx = x + Math.cos(ang) * r * 2.5, my = y + Math.sin(ang) * r * 2.5, x0 = Math.min(x - r * 1.07, mx), y0 = Math.min(y - r * 1.07, my);
  return { piezas, caja: { x: x0, y: y0, w: Math.max(x + r * 1.07, mx) - x0, h: Math.max(y + r * 1.07, my) - y0 } };
}
