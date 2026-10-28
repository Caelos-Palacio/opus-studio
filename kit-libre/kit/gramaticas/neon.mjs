// neon.mjs: gramatica NEON. Luz sobre muro oscuro: ladrillo humedo, tubos de vidrio con halo, parpadeo, desregistro del halo, encendido por tramos,
// rotulo de tubo (letras huecas de contorno) y un acento que es un tubo mas que se enciende. Se reconoce a 1x por el halo de color sobre negro.
import { hash, rng, fbm, valor, clamp, smoothstep, mezclar, oscurecer, rgba, inOutCubic } from '../base.mjs';
import { fuenteCss } from '../texto.mjs';
import { vineta, grano } from '../materia.mjs';
import { paleta, lienzoCache, capaTemporal, parpadeo, longitudes, recortarPor, cajaDe } from './comun.mjs';

const PALETA = { neutro: '#0b0c11', ladrillo: '#2c1b1e', tinta: '#ff4f9a', a1: '#ff4f9a', a2: '#35e1ff', nucleo: '#fff6fa' };
const luz = (p, c) => mezclar(c, p.nucleo, 0.78); // color del nucleo caliente de un tubo (es el que ve la auditoria como color de texto)

/** muro(W,H,seed,p): {base, mascara}; base = ladrillo oscuro con juntas, manchas de humedad y suelo mojado; mascara = donde un ladrillo recibe luz. */
function muro(W, H, seed, p) {
  const s = W / 1920, bh = 64 * s, bw = 168 * s, id = `neon|${W}|${H}|${seed}|${p.neutro}|${p.ladrillo}`;
  const base = lienzoCache(id, W, H, (g) => {
    g.fillStyle = oscurecer(p.neutro, 0.2); g.fillRect(0, 0, W, H); const r = rng(seed * 7 + 1), filas = Math.ceil(H / bh) + 1;
    for (let j = 0; j < filas; j++) for (let i = -1; i < Math.ceil(W / bw) + 1; i++) {
      const x = i * bw + (j % 2 ? bw / 2 : 0), y = j * bh, k = fbm(i * 0.7 + 3, j * 0.9, seed, 2), c = mezclar(p.neutro, p.ladrillo, 0.35 + 0.9 * k * (0.6 + 0.8 * r()));
      g.fillStyle = c; g.fillRect(x + 2 * s, y + 2 * s, bw - 4 * s, bh - 4 * s);
      g.fillStyle = 'rgba(255,255,255,0.045)'; g.fillRect(x + 2 * s, y + 2 * s, bw - 4 * s, 2 * s); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 2 * s, y + bh - 5 * s, bw - 4 * s, 3 * s);
      if (r() < 0.12) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + bw * r() * 0.7, y + bh * 0.1, bw * 0.2, bh * 0.35); } // desconchado
    }
    const ln = capaTemporal(160, 90), lg = ln.getContext('2d'), im = lg.createImageData(160, 90); // manchas de humedad y salitre (ruido de baja resolucion)
    for (let y = 0; y < 90; y++) for (let x = 0; x < 160; x++) { const v = fbm(x * 0.07, y * 0.12, seed + 5, 4), o = (y * 160 + x) * 4; im.data[o + 3] = clamp((v - 0.35) * 2.2, 0, 1) * 150; }
    lg.putImageData(im, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(ln, 0, 0, W, H);
    for (let i = 0; i < 16; i++) { const x = r() * W, L = H * (0.2 + 0.6 * r()), gr = g.createLinearGradient(0, 0, 0, L); gr.addColorStop(0, 'rgba(0,0,0,0.0)'); gr.addColorStop(0.3, 'rgba(0,0,0,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x, 0, (4 + 14 * r()) * s, L); } // chorreones
    const suelo = H * 0.88, sg = g.createLinearGradient(0, suelo, 0, H); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(0.12, 'rgba(4,5,9,0.85)'); sg.addColorStop(1, 'rgba(8,9,14,0.95)'); g.fillStyle = sg; g.fillRect(0, suelo, W, H - suelo);
  });
  const mascara = lienzoCache(id + '|m', W, H, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H); const r = rng(seed * 7 + 1);
    for (let j = 0; j < Math.ceil(H / bh) + 1; j++) for (let i = -1; i < Math.ceil(W / bw) + 1; i++) { const x = i * bw + (j % 2 ? bw / 2 : 0), y = j * bh, k = 0.55 + 0.45 * r(); g.fillStyle = `rgb(${Math.round(255 * k)},${Math.round(255 * k)},${Math.round(255 * k)})`; g.fillRect(x + 3 * s, y + 3 * s, bw - 6 * s, bh - 8 * s); }
  });
  return { base, mascara };
}

/** soporte(ctx,W,H,t,{paleta,seed,luces,suelo}): muro de ladrillo oscuro que RECIBE la luz de los tubos (`luces`:[{x,y,color,r}]); zumbido, reflejo en el suelo mojado y gotas. */
export function soporte(ctx, W, H, t, { paleta: pp, seed = 3, luces = null, suelo = true } = {}) {
  const p = paleta(PALETA, pp), s = W / 1920, { base, mascara } = muro(W, H, seed, p);
  ctx.drawImage(base, 0, 0);
  const L = luces ?? [{ x: W * 0.3, y: H * 0.45, color: p.a1, r: W * 0.36 }, { x: W * 0.74, y: H * 0.38, color: p.a2, r: W * 0.3 }];
  const capa = lienzoCache(`neon-luz|${W}|${H}`, W, H, () => {}), g = capa.getContext('2d');
  L.forEach((l, i) => {
    const f = 0.8 + 0.2 * parpadeo(t, seed + i * 7, 0.08), pulso = 1 + 0.04 * Math.sin(t * 1.3 + i);
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
    const gr = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * pulso); gr.addColorStop(0, rgba(l.color, 0.3 * f)); gr.addColorStop(0.45, rgba(l.color, 0.07 * f)); gr.addColorStop(1, rgba(l.color, 0)); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(mascara, 0, 0); // la luz solo prende en la cara del ladrillo (la junta queda negra)
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(capa, 0, 0); ctx.restore();
  });
  if (suelo) { // reflejo alargado en el suelo mojado
    L.forEach((l, i) => { const f = 0.7 + 0.3 * parpadeo(t, seed + i * 7, 0.08), y0 = H * 0.9, gr = ctx.createRadialGradient(l.x, y0, 0, l.x, y0, l.r * 0.5); gr.addColorStop(0, rgba(l.color, 0.15 * f)); gr.addColorStop(1, rgba(l.color, 0)); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(0, y0); ctx.scale(1, 0.12); ctx.translate(0, -y0); ctx.fillStyle = gr; ctx.fillRect(l.x - l.r, y0 - l.r, l.r * 2, l.r * 2); ctx.restore(); });
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const r = rng(seed + 11); // gotas que bajan por el muro humedo
  for (let i = 0; i < 7; i++) { const x = r() * W, v = 0.03 + 0.04 * r(), y = ((t * v + r()) % 1) * H * 0.85; ctx.fillStyle = 'rgba(190,210,255,0.14)'; ctx.fillRect(x, y, 1.6 * s, 14 * s); ctx.fillStyle = 'rgba(190,210,255,0.06)'; ctx.fillRect(x, y - 40 * s, 1.2 * s, 40 * s); }
  ctx.restore();
}

/** nivelTramo(l,t,seed): brillo de un tramo segun su encendido l (0..1): rafagas de chisporroteo al encenderse y, ya encendido, zumbido con caidas raras. */
const nivelTramo = (l, t, seed, raro = 0.1) => l <= 0 ? 0 : l < 1 ? (rng(hash(`e${seed}|${Math.floor(t * 16)}`))() < 0.25 + 0.65 * l ? 0.35 + 0.65 * l : 0.04) : parpadeo(t, seed, raro);

/**
 * trazo(ctx,puntos,{color,grosor,t,encendido,seed,desregistro}): un tubo de vidrio doblado siguiendo `puntos`. Vidrio oscuro con abrazaderas y electrodos (apagado tambien se ve),
 * y, si esta encendido, cuerpo de color, nucleo caliente y 4 halos desplazados (desregistro). `encendido` 0..1 enciende los tramos de uno en uno en orden irregular.
 */
export function trazo(ctx, puntos, { color = null, grosor = 14, t = 0, encendido = 1, seed = 1, paleta: pp, desregistro = 1 } = {}) {
  const p = paleta(PALETA, pp), col = color ?? p.a1, g = grosor, { acum, total } = longitudes(puntos), K = clamp(Math.round(total / 240), 1, 16), orden = Array.from({ length: K }, (_, i) => i).sort((a, b) => hash(`${seed}|${a}`) - hash(`${seed}|${b}`));
  const tramo = (i) => { const a = (total * i) / K, b = (total * (i + 1)) / K, out = []; for (let k = 0; k < puntos.length; k++) if (acum[k] >= a && acum[k] <= b) out.push(puntos[k]); const ini = recortarPor(puntos, a / total), fin = recortarPor(puntos, b / total); return [ini[ini.length - 1], ...out.filter((q) => q !== ini[ini.length - 1]), fin[fin.length - 1]]; };
  const ruta = (P, dx = 0, dy = 0) => { ctx.beginPath(); P.forEach(([x, y], k) => k ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy)); };
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const T = Array.from({ length: K }, (_, i) => tramo(i));
  T.forEach((P) => { ctx.strokeStyle = '#16171d'; ctx.lineWidth = g * 1.05; ruta(P); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = g * 0.16; ruta(P, -g * 0.22, -g * 0.22); ctx.stroke(); }); // vidrio
  for (let i = 0; i <= K; i++) { // abrazaderas y electrodos
    const q = recortarPor(puntos, i / K), e = q[q.length - 1], pr = q[q.length - 2] ?? e, a = Math.atan2(e[1] - pr[1], e[0] - pr[0]) + Math.PI / 2;
    ctx.save(); ctx.translate(e[0], e[1]); ctx.rotate(a); ctx.fillStyle = i === 0 || i === K ? '#2a2b33' : '#202128'; ctx.beginPath(); ctx.roundRect(-g * 0.35, -g * 1.25, g * 0.7, g * 2.5, g * 0.15); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(-g * 0.35, -g * 1.25, g * 0.14, g * 2.5); ctx.restore();
  }
  const od = desregistro * g * 0.2;
  T.forEach((P, i) => {
    const l = clamp(encendido * K - orden.indexOf(i), 0, 1), b = nivelTramo(l, t, seed * 31 + i); if (b <= 0.01) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [w, a] of [[10, 0.03], [6, 0.05], [3.4, 0.08], [1.9, 0.13]]) { ctx.strokeStyle = rgba(col, a * b); ctx.lineWidth = g * w; ruta(P, od * (1 + 0.3 * Math.sin(t * 2 + i)), od * 0.5); ctx.stroke(); }
    ctx.restore(); ctx.strokeStyle = rgba(col, 0.92 * b); ctx.lineWidth = g * 0.95; ruta(P); ctx.stroke(); ctx.strokeStyle = rgba(luz(p, col), b); ctx.lineWidth = g * 0.42; ruta(P); ctx.stroke();
  });
  ctx.restore(); return cajaDe(puntos, g);
}

/**
 * texto(ctx,str,x,y,{tam,color,alinear,alfa,t,encendido,seed}): rotulo de tubo. Letras HUECAS (contorno de tubo, interior oscuro) con una letra enferma que falla;
 * por debajo de 70 px el tubo se funde en una sola linea gruesa. La caja devuelve como `color` el nucleo caliente (el que se mide contra el muro).
 */
export function texto(ctx, str, x, y, { tam = 110, color = null, alinear = 'left', alfa = 1, t = 0, encendido = 1, seed = 1, paleta: pp, peso = 'bold', desregistro = 1 } = {}) {
  const p = paleta(PALETA, pp), col = color ?? p.tinta, f = fuenteCss(peso, tam, 'sans'), M = capaTemporal(4, 4).getContext('2d'); M.font = f;
  const tr = tam * 0.07, cs = [...String(str)], ws = cs.map((c) => M.measureText(c).width + tr), W = ws.reduce((a, b) => a + b, 0) - tr, x0 = alinear === 'center' ? x - W / 2 : alinear === 'right' ? x - W : x;
  const vivas = cs.map((c, i) => i).filter((i) => cs[i] !== ' '), K = Math.max(1, vivas.length), enferma = vivas.length >= 4 ? vivas[hash(str + seed) % K] : -1, hueco = tam >= 70;
  if (!hueco) { const q = tam * 0.5; ctx.save(); ctx.globalAlpha = alfa * 0.6; for (let k = 3; k >= 0; k--) { ctx.fillStyle = 'rgba(4,4,8,0.35)'; ctx.beginPath(); ctx.roundRect(x0 - q - k * q * 0.25, y - q * 0.5 - k * q * 0.15, W + 2 * q + k * q * 0.5, tam * 1.1 + q + k * q * 0.3, q); ctx.fill(); } ctx.restore(); } // chapa oscura tras el rotulo pequeño: asi se lee sobre el halo
  ctx.save(); ctx.globalAlpha = alfa; ctx.font = f; ctx.textBaseline = 'top'; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; let cx = x0; const od = desregistro * tam * 0.016;
  cs.forEach((c, i) => {
    const n = vivas.indexOf(i), l = n < 0 ? 0 : clamp(encendido * K - n, 0, 1), b = n < 0 ? 0 : nivelTramo(l, t, seed * 17 + i, i === enferma ? 0.55 : 0.04);
    if (n >= 0) {
      if (hueco) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(c, cx, y); ctx.strokeStyle = '#1a1b21'; ctx.lineWidth = tam * 0.062; ctx.strokeText(c, cx, y); } else { ctx.fillStyle = '#1a1b21'; ctx.fillText(c, cx, y); }
      if (b > 0.01) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const [w, a] of [[0.5, 0.03], [0.28, 0.055], [0.16, 0.1], [0.1, 0.16]]) { ctx.strokeStyle = rgba(col, a * b); ctx.lineWidth = Math.min(tam, 96) * w; ctx.strokeText(c, cx + od, y + od * 0.5); }
        ctx.restore();
        if (hueco) { ctx.strokeStyle = rgba(col, 0.92 * b); ctx.lineWidth = tam * 0.05; ctx.strokeText(c, cx, y); ctx.strokeStyle = rgba(luz(p, col), b); ctx.lineWidth = tam * 0.022; ctx.strokeText(c, cx, y); }
        else { ctx.fillStyle = rgba(luz(p, col), b); ctx.fillText(c, cx, y); }
      }
    }
    cx += ws[i];
  });
  ctx.restore(); return { x: x0, y, w: W, h: tam * 1.1, color: luz(p, col), tam, alfa };
}

/** acento(ctx,caja,{forma:'subrayado'|'marco',u,color,t,seed}): un tubo mas que se enciende (u 0..1, tramo a tramo) junto a lo importante; por defecto en el segundo acento. */
export function acento(ctx, caja, { forma = 'subrayado', u = 1, color = null, t = 0, seed = 5, paleta: pp, grosor = 11 } = {}) {
  const p = paleta(PALETA, pp), c = color ?? p.a2, { x, y, w, h } = caja, m = grosor * 2.6;
  const P = forma === 'marco' ? [[x - m * 1.5, y - m], [x + w + m * 1.5, y - m], [x + w + m * 1.5, y + h + m], [x - m * 1.5, y + h + m], [x - m * 1.5, y - m * 0.2]] : [[x - m, y + h + m], [x + w * 0.62, y + h + m], [x + w * 0.67, y + h + m * 1.5], [x + w + m, y + h + m * 1.5]];
  return trazo(ctx, P, { color: c, grosor, t, encendido: u, seed, paleta: pp });
}

/** post(ctx,W,H,frameIndex): floracion (la luz sangra por encima de todo), viñeta fuerte y un grano fino. W,H en pixeles reales del canvas. */
export function post(ctx, W, H, fi = 0) {
  for (const [d, a] of [[6, 0.22], [18, 0.3]]) { const c = lienzoCache(`neon-bloom|${d}|${W}|${H}`, W / d, H / d, () => {}), g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'copy'; g.drawImage(ctx.canvas, 0, 0, c.width, c.height); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.imageSmoothingEnabled = true; ctx.drawImage(c, 0, 0, W, H); ctx.restore(); }
  vineta(ctx, W, H, 0.55); grano(ctx, W, H, fi, 0.03);
}

/** transicion(ctx,u,A,B): apagon. A chisporrotea y se va a negro; B vuelve a encenderse a rafagas. Pura en u; u<=0 A, u>=1 B. */
export function transicion(ctx, u, A, B, { color = null, paleta: pp } = {}) {
  if (u <= 0) return A(ctx); if (u >= 1) return B(ctx);
  const p = paleta(PALETA, pp), W = ctx.canvas.width, H = ctx.canvas.height, e = inOutCubic(u), flick = (k) => rng(hash(`ap|${Math.floor(u * 28)}|${k}`))();
  const sube = u < 0.5; sube ? A(ctx) : B(ctx); const osc = sube ? smoothstep(0, 0.5, u) : 1 - smoothstep(0.5, 1, u), vivo = flick(1) < 0.55 ? 1 : 0.35;
  ctx.save(); ctx.fillStyle = rgba(color ?? oscurecer(p.neutro, 0.4), clamp(osc * vivo + (osc > 0.9 ? 0.1 : 0), 0, 1) * (0.55 + 0.45 * e)); ctx.fillRect(0, 0, W, H); ctx.restore();
}

export default { nombre: 'neon', cuando: 'SI: noche, ciudad, bares, musica, tension o modernidad urbana; NO: texto largo, datos finos, calidez doméstica o temas históricos solemnes.', paleta: PALETA, soporte, trazo, texto, acento, post, transicion };
