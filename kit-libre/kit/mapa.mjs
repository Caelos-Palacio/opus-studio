// mapa.mjs: costas reales (Natural Earth 1:50m, dominio publico) de Europa occidental y Atlantico Norte (lon -25..30, lat 35..72),
// proyectadas en Mercator y dibujadas como acuarela, tinta o grabado. Datos: kit/datos/costas.json (se regenera con herramientas/costas-build.mjs).
import { createCanvas } from 'canvas';
import fs from 'node:fs';
import { fbm, valor, rng, lerp, clamp, smoothstep, outBack, mezclar, oscurecer, aclarar, rgba, hexRgb } from './base.mjs';
import { texto } from './texto.mjs';

let DATOS = null;
/** cargarCostas(): lee (una vez) kit/datos/costas.json -> {bbox, anillos:[{hueco,p:[lon,lat,...]}]}. */
export function cargarCostas() { return DATOS ??= JSON.parse(fs.readFileSync(new URL('./datos/costas.json', import.meta.url), 'utf8')); }
export const REGION = { lon0: -25, lat0: 35, lon1: 30, lat1: 72 };
const mx = (lon) => lon * Math.PI / 180, my = (lat) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));

/**
 * encuadre({lon0,lat0,lon1,lat1},W,H,{modo}): ventana Mercator sobre el lienzo W x H. modo 'cubrir' (por defecto) llena todo el cuadro y recorta
 * lo que sobra; 'contener' muestra la caja entera. Usa solo cajas dentro de REGION: fuera no hay datos.
 */
export function encuadre(caja, W, H, { modo = 'cubrir' } = {}) {
  const x0 = mx(caja.lon0), x1 = mx(caja.lon1), y0 = my(caja.lat0), y1 = my(caja.lat1), dx = x1 - x0, dy = y1 - y0, s = (modo === 'contener' ? Math.min : Math.max)(W / dx, H / dy);
  return { W, H, s, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, caja: { ...caja }, clave: [W, H, s.toFixed(3), ((x0 + x1) / 2).toFixed(4), ((y0 + y1) / 2).toFixed(4)].join(',') };
}
/** proyectar(lon,lat,enc): [x,y] en pixeles del lienzo (Mercator). */
export const proyectar = (lon, lat, enc) => [(mx(lon) - enc.cx) * enc.s + enc.W / 2, (enc.cy - my(lat)) * enc.s + enc.H / 2];
/** invertir(x,y,enc): [lon,lat] de un pixel (inversa de proyectar). */
export const invertir = (x, y, enc) => [((x - enc.W / 2) / enc.s + enc.cx) * 180 / Math.PI, (2 * Math.atan(Math.exp(enc.cy - (y - enc.H / 2) / enc.s)) - Math.PI / 2) * 180 / Math.PI];

const C = new Map();
const anillosPx = (enc) => { const b = cargarCostas().bbox, borde = (v, w) => Math.abs(v - w) < 1e-6; return cargarCostas().anillos.map((a) => { const P = [], B = []; for (let i = 0; i < a.p.length; i += 2) { P.push(proyectar(a.p[i], a.p[i + 1], enc)); B.push(borde(a.p[i], b[0]) || borde(a.p[i], b[2]) || borde(a.p[i + 1], b[1]) || borde(a.p[i + 1], b[3])); } return { P, B }; }).filter(({ P }) => P.some(([x, y]) => x > -50 && x < enc.W + 50 && y > -50 && y < enc.H + 50)); };
const trazarTodo = (g, R) => { g.beginPath(); for (const { P } of R) { P.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); } };
const costa = (g, R, ancho, color, seed, vari = 0.7) => { g.lineCap = 'round'; g.strokeStyle = color; R.forEach(({ P, B }, k) => { for (let i = 1; i <= P.length; i++) { const a = P[i - 1], b = P[i % P.length]; if (B[i - 1] && B[i % P.length]) continue; g.lineWidth = ancho * (1 - vari / 2 + vari * fbm(i * 0.07 + k * 3.1, k, seed, 2)); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } }); };
const veta = (g, W, H, fn, esc, alfa, modo) => { const w = Math.ceil(W / esc), h = Math.ceil(H / esc), c = createCanvas(w, h), q = c.getContext('2d'), im = q.createImageData(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, gg, b] = fn(x * esc, y * esc), o = (y * w + x) * 4; im.data[o] = r; im.data[o + 1] = gg; im.data[o + 2] = b; im.data[o + 3] = 255; } q.putImageData(im, 0, 0); g.save(); g.globalCompositeOperation = modo; g.globalAlpha = alfa; g.imageSmoothingEnabled = true; g.drawImage(c, 0, 0, W, H); g.restore(); };

function pintar(g, enc, estilo, { seed, mar, tierra, tinta }) {
  const { W, H } = enc, R = anillosPx(enc), s = W / 1920, r = rng(seed);
  if (estilo === 'acuarela') {
    g.fillStyle = mar; g.fillRect(0, 0, W, H); veta(g, W, H, (x, y) => { const n = fbm(x * 0.004, y * 0.004, seed, 4), c = hexRgb(mezclar(oscurecer(mar, 0.25), aclarar(mar, 0.3), n)); return c; }, 6, 0.7, 'multiply');
    for (const [d, a] of [[70, 0.05], [48, 0.06], [30, 0.07], [16, 0.08], [7, 0.09]]) { trazarTodo(g, R); g.strokeStyle = rgba(aclarar(mar, 0.5), a * 2.2); g.lineWidth = d * s * 2; g.lineJoin = 'round'; g.stroke(); }
    for (let i = 0; i < 9; i++) { trazarTodo(g, R); g.save(); g.translate((r() - 0.5) * 2.4 * s, (r() - 0.5) * 2.4 * s); g.fillStyle = rgba(mezclar(tierra, r() < 0.5 ? '#6b4a2a' : '#ffffff', r() * 0.18), 0.17 + r() * 0.1); g.fill('evenodd'); g.restore(); }
    g.save(); trazarTodo(g, R); g.clip('evenodd'); veta(g, W, H, (x, y) => hexRgb(mezclar('#7a5a34', '#f4e9cf', fbm(x * 0.012, y * 0.012, seed + 4, 4))), 3, 0.4, 'multiply');
    for (const [wd, a] of [[22, 0.07], [12, 0.09], [5, 0.12]]) { g.strokeStyle = rgba(oscurecer(tierra, 0.5), a); g.lineWidth = wd * s; trazarTodo(g, R); g.stroke(); } g.restore();
    costa(g, R, 2.2 * s, rgba(oscurecer(tierra, 0.62), 0.85), seed);
  } else if (estilo === 'tinta') {
    g.fillStyle = tierra; g.fillRect(0, 0, W, H);
    for (const [d, a] of [[44, 0.2], [30, 0.3], [19, 0.42], [10, 0.55], [4, 0.7]]) { trazarTodo(g, R); g.lineJoin = 'round'; g.strokeStyle = rgba(tinta, a); g.lineWidth = d * 2 * s; g.stroke(); g.strokeStyle = tierra; g.lineWidth = d * 2 * s - 2.6 * s; g.stroke(); }
    g.save(); trazarTodo(g, R); g.fillStyle = tierra; g.fill('evenodd'); g.clip('evenodd'); g.fillStyle = rgba(tinta, 0.55); for (let i = 0; i < 4200 * s * s + 900; i++) { const x = r() * W, y = r() * H; g.fillRect(x, y, 1.1 * s, 1.1 * s); } g.restore();
    costa(g, R, 3 * s, tinta, seed, 1.1);
  } else { // grabado: lineas de agua onduladas + sombreado diagonal en tierra
    g.fillStyle = tierra; g.fillRect(0, 0, W, H); g.strokeStyle = rgba(tinta, 0.6); g.lineWidth = 1 * s;
    for (let y = 0; y < H; y += 4 * s) { g.beginPath(); for (let x = 0; x <= W; x += 8 * s) { const yy = y + (fbm(x * 0.01, y * 0.02, seed, 2) - 0.5) * 3 * s; x ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke(); }
    trazarTodo(g, R); g.lineJoin = 'round'; g.strokeStyle = tierra; g.lineWidth = 22 * s; g.stroke(); g.fillStyle = tierra; g.fill('evenodd');
    g.save(); trazarTodo(g, R); g.clip('evenodd'); g.strokeStyle = rgba(tinta, 0.3); g.lineWidth = 0.8 * s; for (let k = -H; k < W + H; k += 11 * s) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k - H * 0.6, H); g.stroke(); }
    for (const [wd, a] of [[16, 0.1], [9, 0.16], [4, 0.22]]) { g.strokeStyle = rgba(tinta, a); g.lineWidth = wd * s; trazarTodo(g, R); g.stroke(); } g.restore();
    costa(g, R, 1.8 * s, tinta, seed, 0.9); costa(g, R, 0.8 * s, rgba(tinta, 0.7), seed + 1, 0.4);
  }
}

/** dibujarCostas(ctx,enc,{estilo,seed,mar,tierra,tinta}): sin ctx previo, pinta mar + tierra (se cachea por encuadre). estilo 'acuarela' (relleno de tierra en lavados), 'tinta' (lineas paralelas a la costa) o 'grabado'. */
export function dibujarCostas(ctx, enc, { estilo = 'acuarela', seed = 5, mar = '#b9cfd0', tierra = estilo === 'acuarela' ? '#d9b97a' : '#f0e6cf', tinta = '#1d2a38' } = {}) {
  const m = ctx.getTransform?.(), sc = Math.min(2, Math.max(0.25, m ? Math.hypot(m.a, m.b) : 1)), key = [enc.clave, estilo, seed, mar, tierra, tinta, sc.toFixed(2)].join('|');
  let c = C.get(key); if (!c) { if (C.size > 6) C.clear(); c = createCanvas(Math.ceil(enc.W * sc), Math.ceil(enc.H * sc)); const g = c.getContext('2d'); g.scale(sc, sc); pintar(g, enc, estilo, { seed, mar, tierra, tinta }); C.set(key, c); }
  ctx.drawImage(c, 0, 0, enc.W, enc.H);
}

/** graticula(ctx,enc,{paso,color}): meridianos y paralelos finos, a mano alzada. */
export function graticula(ctx, enc, { paso = 5, color = 'rgba(40,50,60,0.16)' } = {}) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = Math.max(0.6, enc.W / 1920); const { lon0, lon1, lat0, lat1 } = enc.caja;
  for (let lo = Math.ceil(lon0 / paso) * paso; lo <= lon1; lo += paso) { ctx.beginPath(); for (let la = lat0; la <= lat1; la += 1) { const [x, y] = proyectar(lo, la, enc); la === lat0 ? ctx.moveTo(x, y) : ctx.lineTo(x + (valor(la, lo, 3) - 0.5), y); } ctx.stroke(); }
  for (let la = Math.ceil(lat0 / paso) * paso; la <= lat1; la += paso) { ctx.beginPath(); for (let lo = lon0; lo <= lon1; lo += 1) { const [x, y] = proyectar(lo, la, enc); lo === lon0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y + (valor(lo, la, 4) - 0.5)); } ctx.stroke(); }
  ctx.restore();
}

/**
 * marcador(ctx,lugar,{u,color,tam,esc,etiqueta}): chincheta con sombra y onda; lugar = {x,y,nombre} (de proyectar). u 0..1: cae con rebote y lanza una onda.
 * Devuelve {pin:{x,y,w,h},etiqueta:{x,y,w,h,color,tam}|null} (cajas para la auditoria).
 */
export function marcador(ctx, lugar, { u = 1, color = '#b23a2a', tam = 1, esc = 1, etiqueta = true, tinta = '#1d2a38' } = {}) {
  if (u <= 0) return null;
  const s = esc * tam, x = lugar.x, y = lugar.y, caida = (1 - outBack(clamp(u * 2), 1.7)) * 70 * s, a = smoothstep(0, 0.2, u), on = smoothstep(0.45, 1, u);
  ctx.save(); ctx.globalAlpha = a;
  if (on > 0 && on < 1) for (const k of [0, 0.25]) { const q = clamp(on - k) / (1 - k); ctx.strokeStyle = rgba(color, 0.5 * (1 - q)); ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.ellipse(x, y, (8 + 46 * q) * s, (3 + 17 * q) * s, 0, 0, 6.283); ctx.stroke(); }
  ctx.fillStyle = 'rgba(10,8,6,0.35)'; ctx.beginPath(); ctx.ellipse(x + 2 * s, y + 1 * s, 9 * s, 3.2 * s, 0, 0, 6.283); ctx.fill();
  ctx.translate(0, -caida); const h = 36 * s, r = 11 * s; // gota: punta en (x,y)
  ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x - r * 0.25, y - h * 0.35, x - r, y - h * 0.5, x - r, y - h * 0.72); ctx.arc(x, y - h * 0.72, r, Math.PI, 0); ctx.bezierCurveTo(x + r, y - h * 0.5, x + r * 0.25, y - h * 0.35, x, y); ctx.closePath();
  const g = ctx.createRadialGradient(x - r * 0.4, y - h * 0.82, r * 0.1, x, y - h * 0.7, r * 1.4); g.addColorStop(0, aclarar(color, 0.5)); g.addColorStop(0.5, color); g.addColorStop(1, oscurecer(color, 0.5)); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = rgba(oscurecer(color, 0.7), 0.9); ctx.lineWidth = 1.3 * s; ctx.stroke();
  ctx.fillStyle = 'rgba(255,240,225,0.85)'; ctx.beginPath(); ctx.arc(x, y - h * 0.72, r * 0.38, 0, 6.283); ctx.fill(); ctx.restore();
  let et = null; if (etiqueta && lugar.nombre) { ctx.save(); ctx.globalAlpha = smoothstep(0.35, 0.9, u); et = texto(ctx, lugar.nombre, x + 50 * s, y - h * 0.95, { tam: Math.round(34 * s), color: tinta, peso: 'bold', fondoVelo: '#f4ecd8' }); ctx.restore(); et.alfa = smoothstep(0.35, 0.9, u); }
  return { pin: { x: x - r, y: y - h - caida, w: 2 * r, h }, etiqueta: et };
}

/** ruta(ctx,a,b,u,{arco,color,grosor,seed,esc}): trazo discontinuo a mano de a a b (arco curvo) hasta la fraccion u, con punta de flecha; devuelve la cabeza {x,y,ang}. a,b = [x,y] o {x,y}. */
export function ruta(ctx, a, b, u, { arco = 0.18, color = '#a8452f', grosor = 4, seed = 2, esc = 1 } = {}) {
  const A = Array.isArray(a) ? a : [a.x, a.y], B = Array.isArray(b) ? b : [b.x, b.y], s = esc, d = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, nx = -(B[1] - A[1]) / d, ny = (B[0] - A[0]) / d, cx = (A[0] + B[0]) / 2 + nx * d * arco, cy = (A[1] + B[1]) / 2 + ny * d * arco;
  const N = Math.max(12, Math.round(d / (6 * s))), P = Array.from({ length: N + 1 }, (_, i) => { const t = i / N, q = 1 - t, w = (fbm(i * 0.15, 0, seed, 2) - 0.5) * 3.5 * s; return [q * q * A[0] + 2 * q * t * cx + t * t * B[0] + nx * w, q * q * A[1] + 2 * q * t * cy + t * t * B[1] + ny * w]; });
  const n = Math.floor(clamp(u) * N); if (n < 1) return { x: A[0], y: A[1], ang: 0 };
  ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = color;
  for (let i = 1; i <= n; i++) { if (Math.floor((i - 1) / 3) % 2) continue; ctx.lineWidth = grosor * s * (0.8 + 0.5 * fbm(i * 0.2, 5, seed, 2)); ctx.beginPath(); ctx.moveTo(P[i - 1][0], P[i - 1][1]); ctx.lineTo(P[i][0], P[i][1]); ctx.stroke(); }
  const h = P[n], p = P[Math.max(0, n - 3)], ang = Math.atan2(h[1] - p[1], h[0] - p[0]); ctx.fillStyle = color; ctx.translate(h[0], h[1]); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(12 * s, 0); ctx.lineTo(-6 * s, -8 * s); ctx.lineTo(-2 * s, 0); ctx.lineTo(-6 * s, 8 * s); ctx.closePath(); ctx.fill(); ctx.restore();
  return { x: h[0], y: h[1], ang };
}
