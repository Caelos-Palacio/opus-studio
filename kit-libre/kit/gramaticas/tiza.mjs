// tiza.mjs: gramatica TIZA. Pizarra verde con polvo, borrones y fantasmas de lo borrado; trazo de tiza con grano y presion irregular; letra manuscrita de pizarra
// (con la mono como respaldo); acento = subrayado o circulo a tiza de color; el BORRADO es la transicion. Se reconoce a 1x por el grano de la tiza y el polvo.
import { hash, rng, fbm, valor, clamp, smoothstep, mezclar, oscurecer, aclarar, rgba, inOutCubic } from '../base.mjs';
import { fuenteCss } from '../texto.mjs';
import { vineta, grano } from '../materia.mjs';
import { paleta, lienzoCache, capaTemporal, longitudes, recortarPor, cajaDe } from './comun.mjs';

const PALETA = { neutro: '#1d2c28', tinta: '#f1efe3', a1: '#f4d35e', a2: '#f08fa3', marco: '#6b4a2e' };

/** densificar(P,paso): puntos cada `paso` px sobre la polilinea (conserva las esquinas). */
function densificar(P, paso) { const o = [P[0]]; for (let i = 1; i < P.length; i++) { const [a, b] = [P[i - 1], P[i]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / paso)); for (let k = 1; k <= n; k++) o.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } return o; }

/** Grano de tiza: agujerea una capa (destination-out) con motas finas, gruesas y vetas; `dens` = motas por px2 de la zona. */
function agrietar(g, w, h, seed, dens, zona = null) {
  const r = rng(seed), n = Math.round((zona ?? w * h) * dens); g.save(); g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < n; i++) { const a = 0.25 + 0.65 * r(), s = r() < 0.9 ? 1 + r() : 2 + 2 * r(); g.fillStyle = `rgba(0,0,0,${a})`; g.fillRect(r() * w, r() * h, s, s * (0.6 + r())); }
  g.restore();
}

/** soporte(ctx,W,H,t,{paleta,seed,fantasmas,bandeja}): pizarra verde con borrones de esponja, fantasmas de lo borrado, marco de madera y bandeja con tiza y borrador; polvo que flota. */
export function soporte(ctx, W, H, t, { paleta: pp, seed = 2, fantasmas = ['f(x) = 2x + 1', '3 x 4 = 12', 'a + b = c', 'ok?'], bandeja = true } = {}) {
  const p = paleta(PALETA, pp), s = W / 1920, id = `tiza|${W}|${H}|${seed}|${p.neutro}|${fantasmas.join('~')}|${bandeja}`;
  const base = lienzoCache(id, W, H, (g) => {
    g.fillStyle = p.neutro; g.fillRect(0, 0, W, H); const r = rng(seed * 5 + 2), ln = capaTemporal(192, 108), lg = ln.getContext('2d'), im = lg.createImageData(192, 108);
    for (let y = 0; y < 108; y++) for (let x = 0; x < 192; x++) { const v = fbm(x * 0.05, y * 0.08, seed, 4), o = (y * 192 + x) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = 235; im.data[o + 3] = clamp((v - 0.4) * 1.8, 0, 1) * 46; } // nube de polvo antiguo
    lg.putImageData(im, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(ln, 0, 0, W, H);
    g.lineCap = 'round'; for (let i = 0; i < 9; i++) { const y = H * (0.08 + 0.8 * r()), x0 = W * (0.05 + 0.5 * r()), L = W * (0.2 + 0.4 * r()), a = (r() - 0.5) * 0.3; const a0 = 0.012 + 0.012 * r(), ww = (70 + 90 * r()) * s; for (const k of [1, 0.75, 0.5, 0.28]) { g.strokeStyle = `rgba(235,235,225,${a0})`; g.lineWidth = ww * k; g.beginPath(); g.moveTo(x0, y); g.bezierCurveTo(x0 + L * 0.3, y - 40 * s + a * 100, x0 + L * 0.6, y + 40 * s, x0 + L, y + a * 300); g.stroke(); } } // pasadas de esponja
    fantasmas.forEach((f, i) => { const gt = capaTemporal(W * 0.5, 160 * s), q = gt.getContext('2d'); q.fillStyle = '#e8e6da'; q.font = fuenteCss('normal', 64 * s, 'mano'); q.textBaseline = 'top'; q.fillText(f, 6, 10 * s); g.save(); g.translate(W * (0.06 + 0.3 * r()), H * (0.1 + 0.2 * i + 0.1 * r())); g.rotate((r() - 0.5) * 0.12); for (const [dx, dy, a] of [[0, 0, 0.1], [5 * s, 2 * s, 0.05], [-6 * s, 4 * s, 0.04]]) { g.globalAlpha = a; g.drawImage(gt, dx, dy); } g.restore(); }); // fantasmas
    g.globalAlpha = 1; for (let i = 0; i < 4; i++) { const x = W * r(), y = H * (0.1 + 0.7 * r()); g.strokeStyle = 'rgba(235,235,225,0.07)'; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 120 * s, y - 50 * s, x + 260 * s, y + 20 * s); g.stroke(); }
    const m = 18 * s, bh = bandeja ? 74 * s : 0, mar = (x, y, w, h) => { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, aclarar(p.marco, 0.15)); gr.addColorStop(1, oscurecer(p.marco, 0.4)); g.fillStyle = gr; g.fillRect(x, y, w, h); };
    mar(0, 0, W, m * 0.8); mar(0, 0, m, H); mar(W - m, 0, m, H); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(m, m * 0.8, W - 2 * m, 5 * s);
    if (bandeja) { mar(0, H - bh, W, bh); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, H - bh, W, 4 * s); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(240,238,225,${0.05 + 0.2 * r()})`; g.fillRect(W * r(), H - bh + 6 * s + (bh * 0.5) * r() * r(), (1 + 2 * r()) * s, (1 + r()) * s); } // polvo en la bandeja
      g.save(); g.translate(W * 0.18, H - bh + 18 * s); g.rotate(-0.05); g.fillStyle = '#f2f0e6'; g.beginPath(); g.roundRect(0, 0, 150 * s, 17 * s, 6 * s); g.fill(); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 11 * s, 150 * s, 6 * s); g.restore(); // tiza
      g.save(); g.translate(W * 0.74, H - bh + 4 * s); g.fillStyle = '#7a5f3c'; g.fillRect(0, 22 * s, 170 * s, 14 * s); g.fillStyle = '#2f2c2a'; g.beginPath(); g.roundRect(0, 0, 170 * s, 26 * s, 4 * s); g.fill(); g.fillStyle = 'rgba(255,255,255,0.18)'; for (let i = 0; i < 60; i++) g.fillRect(r() * 170 * s, r() * 22 * s, 2 * s, 1.5 * s); g.restore(); } // borrador de fieltro
  });
  ctx.drawImage(base, 0, 0);
  const r = rng(seed + 9); ctx.save(); ctx.globalCompositeOperation = 'lighter'; // polvo que flota
  for (let i = 0; i < 46; i++) { const v = 0.01 + 0.03 * r(), x = ((r() + t * v * (r() - 0.3)) % 1 + 1) % 1 * W, y = ((r() + t * v * 0.8) % 1) * H, a = 0.05 + 0.12 * r() * (0.6 + 0.4 * Math.sin(t * 0.7 + i)); ctx.fillStyle = `rgba(240,238,225,${a})`; ctx.beginPath(); ctx.arc(x, y, (0.8 + 1.6 * r()) * s, 0, 6.283); ctx.fill(); }
  ctx.restore();
}

/**
 * trazo(ctx,puntos,{color,grosor,seed,u,presion}): una linea a tiza. Ondula con la mano, la presion cambia a lo largo (grosor y densidad), la tiza salta donde se alivia,
 * grano que agujerea el trazo, vetas en el sentido de la linea y polvo suelto. `u` 0..1 dibuja solo esa fraccion.
 */
export function trazo(ctx, puntos, { color = null, grosor = 9, seed = 1, u = 1, paleta: pp, presion = 1, alfa = 1 } = {}) {
  const p = paleta(PALETA, pp), col = color ?? p.tinta, g = grosor, D = recortarPor(densificar(puntos, 3), u), { acum } = longitudes(D);
  const P = D.map(([x, y], i) => { const l = acum[i], a = D[Math.min(D.length - 1, i + 1)], b = D[Math.max(0, i - 1)], an = Math.atan2(a[1] - b[1], a[0] - b[0]) + Math.PI / 2, off = (valor(l * 0.012, seed, 5) - 0.5) * g * 1.1; return [x + Math.cos(an) * off, y + Math.sin(an) * off, an]; });
  const bb = cajaDe(P, g * 3), L = capaTemporal(bb.w, bb.h), q = L.getContext('2d'); q.translate(-bb.x, -bb.y); q.fillStyle = col;
  const pres = (l) => clamp((0.55 + 0.75 * valor(l * 0.011, seed, 9) - 0.2 * valor(l * 0.09, seed, 2)) * presion, 0.15, 1.15);
  for (let i = 0; i < P.length; i++) { const l = acum[i], k = pres(l), rad = g * 0.5 * (0.55 + 0.6 * k); q.globalAlpha = clamp(0.35 + 0.75 * k, 0, 1); q.beginPath(); q.arc(P[i][0], P[i][1], rad, 0, 6.283); q.fill(); }
  q.globalAlpha = 1; q.setTransform(1, 0, 0, 1, 0, 0); q.globalCompositeOperation = 'destination-out'; const r = rng(hash(`tz${seed}`)), N = Math.round(acum[acum.length - 1] * g * 0.55);
  for (let i = 0; i < N; i++) { const k = Math.floor(r() * P.length), [x, y, an] = P[k], off = (r() - 0.5) * g * 1.3, f = (1 - pres(acum[k])) * 0.8 + 0.25; if (r() > f) continue; q.fillStyle = `rgba(0,0,0,${0.35 + 0.6 * r()})`; const s = 1 + 1.6 * r(); q.fillRect(x + Math.cos(an) * off - bb.x, y + Math.sin(an) * off - bb.y, s, s * (0.6 + r())); }
  for (let v = 0; v < 4; v++) { const off = (v - 1.5) * g * 0.25 + (r() - 0.5) * g * 0.1; q.strokeStyle = `rgba(0,0,0,${0.18 + 0.15 * r()})`; q.lineWidth = 0.8; q.beginPath(); P.forEach(([x, y, an], i) => { const X = x + Math.cos(an) * off - bb.x, Y = y + Math.sin(an) * off - bb.y; i ? q.lineTo(X, Y) : q.moveTo(X, Y); }); q.stroke(); }
  ctx.save(); ctx.globalAlpha = alfa * 0.95; ctx.drawImage(L, bb.x, bb.y); ctx.globalAlpha = alfa * 0.3; ctx.fillStyle = col; for (let i = 0; i < Math.min(60, P.length / 4); i++) { const [x, y] = P[Math.floor(r() * P.length)], a = r() * 6.283, d = g * (0.8 + 1.4 * r()); ctx.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.2, 1.2); } // polvo suelto
  ctx.restore(); return cajaDe(puntos, g);
}

/** texto(ctx,str,x,y,{tam,color,alinear,alfa,seed}): letra de pizarra, cada caracter con su propia inclinacion, tamaño y linea base; tiza gordita con grano y polvo (cacheado). */
export function texto(ctx, str, x, y, { tam = 84, color = null, alinear = 'left', alfa = 1, seed = 1, paleta: pp, peso = 'bold' } = {}) {
  const p = paleta(PALETA, pp), col = color ?? p.tinta, f = fuenteCss(peso, tam, 'mano'), M = capaTemporal(4, 4).getContext('2d'); M.font = f;
  const cs = [...String(str)], ws = cs.map((c) => M.measureText(c).width + tam * 0.02), W = ws.reduce((a, b) => a + b, 0), pad = Math.ceil(tam * 0.4), Hh = tam * 1.35;
  const c = lienzoCache(`tz-t|${str}|${tam}|${col}|${seed}|${peso}`, W + 2 * pad, Hh + 2 * pad, (g) => {
    const r = rng(hash(str + seed)); g.font = f; g.textBaseline = 'top'; g.fillStyle = g.strokeStyle = col; g.lineJoin = 'round'; let cx = pad;
    cs.forEach((ch, i) => { g.save(); g.translate(cx + ws[i] / 2, pad + tam * 0.1 + (r() - 0.5) * tam * 0.07); g.rotate((r() - 0.5) * 0.1); const k = 0.96 + 0.1 * r(); g.scale(k, k); g.lineWidth = tam * 0.045; g.textAlign = 'center'; g.strokeText(ch, 0, 0); g.fillText(ch, 0, 0); g.restore(); cx += ws[i]; });
    agrietar(g, g.canvas.width, g.canvas.height, hash(str) + seed, 0.045, W * Hh); agrietar(g, g.canvas.width, g.canvas.height, hash(str) + seed + 1, 0.0012, W * Hh * 0.2);
  }, { chico: true });
  const x0 = alinear === 'center' ? x - W / 2 : alinear === 'right' ? x - W : x;
  ctx.save(); ctx.globalAlpha = alfa * 0.14; for (const [dx, dy] of [[3, 2], [-2, 4]]) ctx.drawImage(c, x0 - pad + dx, y - pad + dy); ctx.globalAlpha = alfa; ctx.drawImage(c, x0 - pad, y - pad); ctx.restore();
  return { x: x0, y, w: W, h: tam * 1.2, color: col, tam, alfa };
}

/** acento(ctx,caja,{forma:'subrayado'|'circulo',u,color,seed}): lo importante se marca con tiza de color: doble subrayado nervioso o un circulo que se pasa de vuelta (u 0..1 = progreso). */
export function acento(ctx, caja, { forma = 'subrayado', u = 1, color = null, seed = 4, paleta: pp, grosor = 10 } = {}) {
  const p = paleta(PALETA, pp), c = color ?? p.a1, { x, y, w, h } = caja, o = { color: c, grosor, seed, u, paleta: pp };
  if (forma === 'circulo') { const cx = x + w / 2, cy = y + h / 2, rx = w / 2 + h * 0.6, ry = h * 0.75, P = Array.from({ length: 70 }, (_, i) => { const a = -2.4 + (i / 69) * 7.2, k = 1 + 0.06 * (i / 69); return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]; }); return trazo(ctx, P, o); }
  const yy = y + h + grosor * 1.4; trazo(ctx, [[x - 12, yy], [x + w * 0.5, yy + 3], [x + w + 14, yy - 2]], { ...o, u: clamp(u * 1.6, 0, 1) }); return trazo(ctx, [[x + w * 0.08, yy + grosor * 1.6], [x + w * 0.55, yy + grosor * 1.6 + 2], [x + w * 0.9, yy + grosor * 1.4]], { ...o, u: clamp(u * 1.6 - 0.6, 0, 1), seed: seed + 3, grosor: grosor * 0.8 });
}

/** post(ctx,W,H,frameIndex): velo de polvo de tiza (nube fija que respira), viñeta suave y grano fino. W,H en pixeles reales. */
export function post(ctx, W, H, fi = 0) {
  const c = lienzoCache(`tz-post|${W}|${H}`, 96, 54, (g) => { const im = g.createImageData(96, 54); for (let y = 0; y < 54; y++) for (let x = 0; x < 96; x++) { const o = (y * 96 + x) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = 240; im.data[o + 3] = clamp((fbm(x * 0.08, y * 0.1, 11, 3) - 0.35) * 2, 0, 1) * 255; } g.putImageData(im, 0, 0); });
  ctx.save(); ctx.globalAlpha = 0.06 + 0.01 * Math.sin(fi * 0.05); ctx.imageSmoothingEnabled = true; ctx.drawImage(c, 0, 0, W, H); ctx.restore(); vineta(ctx, W, H, 0.4); grano(ctx, W, H, fi, 0.035);
}

/** transicion(ctx,u,A,B): BORRADO. Un borrador recorre la pizarra en pasadas de ida y vuelta; lo que pasa se limpia (aparece B) y deja una estela de polvo. Pura en u; u<=0 A, u>=1 B. */
export function transicion(ctx, u, A, B, { filas = 4, paleta: pp } = {}) {
  if (u <= 0) return A(ctx); if (u >= 1) return B(ctx);
  const W = ctx.canvas.width, H = ctx.canvas.height, s = W / 1920, e = inOutCubic(u) * filas, j = Math.min(filas - 1, Math.floor(e)), fr = e - j, rh = H / filas, alto = rh * 1.3;
  const dir = (n) => n % 2 === 0 ? 1 : -1, xAt = (n, f) => dir(n) > 0 ? W * f : W * (1 - f);
  A(ctx); ctx.save(); ctx.beginPath();
  for (let n = 0; n <= j; n++) { const f = n < j ? 1 : fr, xa = xAt(n, 0), xb = xAt(n, f), y = n * rh + rh / 2 - alto / 2; ctx.rect(Math.min(xa, xb) - (n < j ? 2 : 0), Math.max(0, y), Math.abs(xb - xa) + (n < j ? 4 : 0), alto); }
  ctx.clip(); B(ctx); ctx.restore();
  const y = j * rh + rh / 2, x = xAt(j, fr), d = dir(j); // estela de polvo detras del borrador
  const gr = ctx.createLinearGradient(x, 0, x - d * W * 0.25, 0); gr.addColorStop(0, 'rgba(235,235,225,0.16)'); gr.addColorStop(1, 'rgba(235,235,225,0)'); ctx.save(); ctx.fillStyle = gr; ctx.fillRect(Math.min(x, x - d * W * 0.25), y - alto / 2, W * 0.25, alto); ctx.restore();
  ctx.save(); ctx.translate(x, y); ctx.rotate(d * 0.05); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-90 * s + 8 * s, -42 * s + 14 * s, 190 * s, 90 * s); ctx.fillStyle = '#7a5f3c'; ctx.fillRect(-90 * s, 12 * s, 190 * s, 32 * s); ctx.fillStyle = '#2f2c2a'; ctx.beginPath(); ctx.roundRect(-90 * s, -42 * s, 190 * s, 60 * s, 8 * s); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.12)'; const r = rng(7); for (let i = 0; i < 90; i++) ctx.fillRect(-90 * s + r() * 190 * s, -42 * s + r() * 56 * s, 3 * s, 2 * s); ctx.restore();
  void pp;
}

export default { nombre: 'tiza', cuando: 'SI: explicar, aprender, procesos paso a paso, tono cercano o escolar, humor; NO: lujo, precision técnica fina, drama nocturno o realismo fotográfico.', paleta: PALETA, soporte, trazo, texto, acento, post, transicion };
