// transiciones.mjs: transiciones MOTIVADAS (nunca un fundido cruzado). Cada una es `(ctx,u,dibujarA,dibujarB,opts)`, PURA en u (0..1):
// u<=0 pinta exactamente A y u>=1 exactamente B. dibujarA(ctx) y dibujarB(ctx) pintan cada escena completa (pueden llamarse con otro ctx del mismo tamano).
// Las coordenadas de opts son normalizadas (0..1 del ancho x alto del lienzo), salvo que se diga otra cosa.
//
// CUANDO USAR CADA UNA (la transicion debe salir de algo que YA esta en el plano):
//  revelarTinta   hay una mancha de tinta, agua, cafe o vino en A: crece y por dentro aparece B. Cambio de lugar o de tiempo con "derrame".
//  barridoObjeto  un objeto (barco, mano, botella, ola de sombra) cruza el cuadro y su cuerpo tapa el corte. Cambio de lugar con movimiento.
//  papelQueSube   B es un documento, carta, mapa o pagina: una hoja entra desde abajo con su sombra. Pasar de la accion a la informacion.
//  cortinaAgua    A o B son marinos o hay lluvia, llanto o inundacion: un nivel de agua con superficie ondulada sube o baja. Inmersion o recuerdo.
//  zoomA          A tiene un detalle (ojo, ojo de buey, moneda, ventana) que es la puerta a B: la camara entra en el y dentro vive B.
//  corteEco       una forma de A (disco, rectangulo, silueta) tiene la misma forma en B: el resto se apaga, la forma viaja y continua. Corte por analogia.
import { createCanvas } from 'canvas';
import { fbm, valor, rng, clamp, lerp, smoothstep, inOutCubic, rgba, oscurecer, aclarar } from './base.mjs';

const C = new Map();
const capa = (ctx, nombre, fn) => { const W = ctx.canvas.width, H = ctx.canvas.height, id = `${nombre}${W}x${H}`; if (!C.has(id)) C.set(id, createCanvas(W, H)); const c = C.get(id), g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H); fn(g); return c; };
const extremos = (u, ctx, A, B) => { if (u <= 0) { A(ctx); return true; } if (u >= 1) { B(ctx); return true; } return false; };
const poli = (g, P) => { g.beginPath(); P.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
const dimension = (ctx) => ({ W: ctx.canvas.width, H: ctx.canvas.height, s: ctx.canvas.width / 1920 });

/** revelarTinta(ctx,u,A,B,{origen,color,seed}): una mancha de tinta nace en `origen` sobre A, crece con dedos y satelites, y por dentro se descubre B. */
export function revelarTinta(ctx, u, A, B, { origen = { x: 0.5, y: 0.5 }, color = '#17222e', seed = 3 } = {}) {
  if (extremos(u, ctx, A, B)) return;
  const { W, H, s } = dimension(ctx), ox = origen.x * W, oy = origen.y * H, e = Math.pow(u, 1.35), Rmax = Math.max(Math.hypot(ox, oy), Math.hypot(W - ox, oy), Math.hypot(ox, H - oy), Math.hypot(W - ox, H - oy)) * 1.5, R = Rmax * e;
  const dedos = Array.from({ length: 7 }, (_, i) => ({ a: (i + valor(i, seed, seed)) / 7 * 6.283, w: 0.12 + 0.12 * valor(i, 2, seed), k: 0.25 + 0.3 * valor(i, 5, seed) }));
  const borde = (f) => Array.from({ length: 120 }, (_, i) => { const a = i / 120 * 6.283; let k = 0.7 + 0.6 * fbm(Math.cos(a) * 1.5 + seed, Math.sin(a) * 1.5, seed, 3); for (const d of dedos) { const da = Math.atan2(Math.sin(a - d.a), Math.cos(a - d.a)); k += d.k * Math.exp(-((da / d.w) ** 2)) * smoothstep(0, 0.5, u); } return [ox + Math.cos(a) * R * k * f, oy + Math.sin(a) * R * k * f]; });
  A(ctx); const grosor = (6 * s + R * 0.035) * (1 - smoothstep(0.7, 1, u)), b = capa(ctx, 'tintaB', (g) => B(g));
  ctx.save(); for (const f of [1.1, 1.05]) { ctx.fillStyle = 'rgba(255,250,240,0.10)'; poli(ctx, borde(f)); ctx.fill(); }
  ctx.fillStyle = rgba(color, 0.93); poli(ctx, borde(1)); ctx.fill();
  const r = rng(seed + 9); ctx.fillStyle = rgba(color, 0.8); for (let i = 0; i < 14; i++) { const a = r() * 6.283, d = R * (1.15 + r() * 0.5); ctx.beginPath(); ctx.arc(ox + Math.cos(a) * d, oy + Math.sin(a) * d, Math.max(1, R * 0.018 * r() * (1 - u)), 0, 6.283); ctx.fill(); }
  ctx.save(); poli(ctx, borde(1)); ctx.clip(); const dentro = borde(1).map(([x, y]) => { const d = Math.hypot(x - ox, y - oy) || 1; return [x - (x - ox) / d * grosor, y - (y - oy) / d * grosor]; }); poli(ctx, dentro); ctx.clip(); ctx.drawImage(b, 0, 0); ctx.restore(); ctx.restore();
}

/**
 * objetoPincelada: objeto por defecto de barridoObjeto, un golpe de brocha ancha con pintura densa: frente redondeado con cresta de pintura,
 * cerdas largas en el sentido del avance (nunca tiras perpendiculares), reflejo humedo y cola de brocha seca con cerdas sueltas que dejan ver lo de atras.
 */
function objetoPincelada(g, { x, y, w, h, vert, dir = 'der' }, seed = 4) {
  const r = rng(seed), ang = { der: 0, abj: Math.PI / 2, izq: Math.PI, arr: -Math.PI / 2 }[dir] ?? (vert ? Math.PI / 2 : 0), n = 110, frente = w * 0.5, cola = -w * 0.5, paso = h / n;
  g.save(); g.translate(x, y); g.rotate(ang);
  const borde = (yy, k) => frente - w * 0.05 * Math.pow(Math.abs(yy) / (h / 2), 2) + (fbm(yy * 0.01, k, seed, 3) - 0.5) * w * 0.05;
  const cuerpo = [], fin = []; for (let i = 0; i <= n; i++) { const yy = -h / 2 + i * paso; cuerpo.push([borde(yy, 3), yy]); fin.push([cola + w * 0.1 * (0.5 + fbm(yy * 0.02, 9, seed, 2)), yy]); }
  const gr = g.createLinearGradient(cola, 0, frente, 0); gr.addColorStop(0, 'rgba(14,17,22,0.9)'); gr.addColorStop(0.55, 'rgb(20,24,31)'); gr.addColorStop(1, 'rgb(34,40,50)');
  g.fillStyle = gr; g.beginPath(); cuerpo.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); [...fin].reverse().forEach(([a, b]) => g.lineTo(a, b)); g.closePath(); g.fill();
  g.lineCap = 'round'; // cerdas: trazos largos y finos, con ondulacion suave, que siguen el avance
  for (let i = 0; i < 150; i++) {
    const yy = (r() - 0.5) * h, a0 = cola + w * (0.08 + r() * 0.5), a1 = Math.min(borde(yy, 3) - w * 0.01, a0 + w * (0.2 + r() * 0.6)), k = r(), amp = h * 0.004 * (0.5 + r());
    g.strokeStyle = k < 0.5 ? `rgba(0,0,0,${0.12 + 0.25 * r()})` : `rgba(120,135,155,${0.04 + 0.1 * r()})`; g.lineWidth = Math.max(1, h * (0.0012 + 0.003 * r()));
    g.beginPath(); g.moveTo(a0, yy); g.bezierCurveTo(a0 + (a1 - a0) * 0.35, yy + amp, a0 + (a1 - a0) * 0.7, yy - amp, a1, yy + amp * 0.3); g.stroke();
  }
  g.strokeStyle = 'rgba(190,205,225,0.28)'; g.lineWidth = Math.max(2, w * 0.012); g.beginPath(); cuerpo.forEach(([a, b], i) => { const q = [a - w * 0.025, b]; i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.stroke(); // cresta humeda del frente
  for (let i = 0; i < 170; i++) { // cerdas sueltas de la cola
    const yy = (r() - 0.5) * h, a0 = cola + w * 0.12 * r(), L = w * (0.05 + 0.35 * r() * r()), t = 0.8 + 0.2 * r();
    g.strokeStyle = `rgba(${Math.round(20 * t)},${Math.round(24 * t)},${Math.round(31 * t)},${0.5 + 0.4 * r()})`; g.lineWidth = Math.max(1, h * (0.0015 + 0.0035 * r()));
    g.beginPath(); g.moveTo(a0, yy); g.quadraticCurveTo(a0 - L * 0.5, yy + (r() - 0.5) * h * 0.006, a0 - L, yy + (r() - 0.5) * h * 0.01); g.stroke();
  }
  g.restore();
}
/**
 * barridoObjeto(ctx,u,A,B,{objeto,dir,ancho}): un objeto cruza el cuadro; tras el, B; el corte esta DEBAJO del cuerpo del objeto.
 * `objeto(g,{x,y,w,h,u,dir,vert})` lo pinta centrado en x,y (w = grosor en el sentido del avance, h = largo transversal); por defecto una pincelada.
 * dir: 'der' | 'izq' | 'arr' | 'abj'. `ancho`: grosor del objeto como fraccion del avance (>= 0.3 para que tape el corte).
 */
export function barridoObjeto(ctx, u, A, B, { objeto = null, dir = 'der', ancho = 0.4 } = {}) {
  if (extremos(u, ctx, A, B)) return;
  const { W, H } = dimension(ctx), vert = dir === 'arr' || dir === 'abj', L = vert ? H : W, T = vert ? W : H, ow = L * Math.max(0.3, ancho), sgn = dir === 'der' || dir === 'abj' ? 1 : -1, e = inOutCubic(u);
  const p = sgn > 0 ? lerp(-ow / 2, L + ow / 2, e) : lerp(L + ow / 2, -ow / 2, e); // posicion del objeto en el eje de avance
  A(ctx); const b = capa(ctx, 'barridoB', (g) => B(g));
  ctx.save(); ctx.beginPath(); vert ? ctx.rect(0, sgn > 0 ? 0 : p, W, sgn > 0 ? p : H - p) : ctx.rect(sgn > 0 ? 0 : p, 0, sgn > 0 ? p : W - p, H); ctx.clip(); ctx.drawImage(b, 0, 0); ctx.restore();
  const cx = vert ? W / 2 : p, cy = vert ? p : H / 2; ctx.save(); // sombra del objeto sobre ambos lados
  const g = vert ? ctx.createLinearGradient(0, cy - ow, 0, cy + ow) : ctx.createLinearGradient(cx - ow, 0, cx + ow, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.38)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  (objeto ?? objetoPincelada)(ctx, { x: cx, y: cy, w: ow, h: T * 1.1 + ow * 0.2, u, dir, vert });
}

/** papelQueSube(ctx,u,A,B,{papel}): una hoja con B impreso entra desde abajo, con borde irregular, canto de luz y sombra proyectada sobre A. */
export function papelQueSube(ctx, u, A, B, { papel = '#f1e8d3', seed = 5 } = {}) {
  if (extremos(u, ctx, A, B)) return;
  const { W, H, s } = dimension(ctx), e = inOutCubic(u), top = lerp(H, -50 * s, e), ang = (1 - e) * 0.035, cx = W / 2;
  A(ctx); const b = capa(ctx, 'papelB', (g) => B(g));
  const borde = Array.from({ length: 80 }, (_, i) => [-W * 0.1 + (i / 79) * W * 1.2, top + (fbm(i * 0.25, 0, seed, 3) - 0.5) * 14 * s]);
  ctx.save(); ctx.translate(cx, top); ctx.rotate(ang); ctx.translate(-cx, -top);
  const sh = ctx.createLinearGradient(0, top - 70 * s, 0, top + 4 * s); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, `rgba(20,14,8,${0.5 * (1 - 0.6 * u)})`); ctx.fillStyle = sh; ctx.fillRect(-W * 0.2, top - 70 * s, W * 1.4, 70 * s);
  poli(ctx, [...borde, [W * 1.1, H * 2], [-W * 0.1, H * 2]]); ctx.save(); ctx.clip(); ctx.fillStyle = papel; ctx.fillRect(-W * 0.2, top - 20, W * 1.4, H * 2);
  ctx.drawImage(b, 0, top + 50 * s, W, H); ctx.restore();
  const curl = ctx.createLinearGradient(0, top, 0, top + 60 * s); curl.addColorStop(0, 'rgba(255,255,255,0.35)'); curl.addColorStop(0.15, 'rgba(255,255,255,0)'); curl.addColorStop(0.5, 'rgba(60,40,20,0.10)'); curl.addColorStop(1, 'rgba(60,40,20,0)'); ctx.fillStyle = curl; ctx.fillRect(-W * 0.2, top, W * 1.4, 60 * s);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2 * s; ctx.beginPath(); borde.forEach(([x, y], i) => i ? ctx.lineTo(x, y + 1) : ctx.moveTo(x, y + 1)); ctx.stroke(); ctx.restore();
}

/** cortinaAgua(ctx,u,A,B,{modo,color,seed}): un nivel de agua con superficie ondulada. 'sube': el agua sube y bajo ella esta B refractada; 'baja': A esta bajo el agua que desciende y revela B. */
export function cortinaAgua(ctx, u, A, B, { modo = 'sube', color = '#2f7f8f', seed = 2 } = {}) {
  if (extremos(u, ctx, A, B)) return;
  const { W, H, s } = dimension(ctx), e = inOutCubic(u), amp = 0.022 * H * Math.sin(Math.PI * clamp(u * 0.95 + 0.03)) + 3 * s, sube = modo !== 'baja';
  const y0 = (x) => (sube ? lerp(H + amp * 2, -amp * 2, e) : lerp(-amp * 2, H + amp * 2, e)) + amp * (Math.sin(x * 0.006 + u * 9 + seed) + 0.6 * Math.sin(x * 0.014 - u * 13) + 0.3 * Math.sin(x * 0.031 + u * 21 + seed * 2));
  const arriba = capa(ctx, 'aguaA', (g) => (sube ? A : B)(g)), abajo = capa(ctx, 'aguaB', (g) => (sube ? B : A)(g)), N = 70, sup = Array.from({ length: N + 1 }, (_, i) => [i / N * W, y0(i / N * W)]);
  ctx.drawImage(arriba, 0, 0);
  ctx.save(); poli(ctx, [...sup, [W, H + 20], [0, H + 20]]); ctx.clip(); const paso = Math.max(2, Math.round(3 * s)), dis = 12 * s * (1 - 0.7 * e);
  for (let y = 0; y < H; y += paso) { const dx = Math.sin(y * 0.045 + u * 16) * dis + Math.sin(y * 0.013 - u * 7) * dis; ctx.drawImage(abajo, 0, y, W, paso, dx, y, W, paso); }
  const sombra = ctx.createLinearGradient(0, 0, 0, H); sombra.addColorStop(0, rgba(aclarar(color, 0.3), 0.32 * (1 - 0.6 * e))); sombra.addColorStop(1, rgba(oscurecer(color, 0.4), 0.5 * (1 - 0.7 * e))); ctx.fillStyle = sombra; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'screen'; ctx.lineWidth = 1.4 * s; for (let k = 0; k < 7; k++) { ctx.strokeStyle = `rgba(255,255,225,${0.13 - k * 0.015})`; ctx.beginPath(); sup.forEach(([x, y], i) => { const yy = y + (14 + k * 18) * s + Math.sin(x * 0.02 + k + u * 6) * 6 * s; i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }); ctx.stroke(); } ctx.restore();
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3 * s; ctx.beginPath(); sup.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  ctx.strokeStyle = rgba(color, 0.55); ctx.lineWidth = 7 * s; ctx.beginPath(); sup.forEach(([x, y], i) => i ? ctx.lineTo(x, y + 5 * s) : ctx.moveTo(x, y + 5 * s)); ctx.stroke();
  const r = rng(seed + 11); ctx.fillStyle = 'rgba(255,255,255,0.75)'; for (let i = 0; i < 60; i++) { const x = r() * W, y = y0(x) + (r() - 0.6) * 10 * s; ctx.beginPath(); ctx.arc(x, y, (1 + r() * 2.5) * s, 0, 6.283); ctx.fill(); } ctx.restore();
}

/** zoomA(ctx,u,A,B,{foco,forma}): la camara entra en un detalle de A (foco {x,y,r} normalizado; r = fraccion del alto) y dentro vive B; al llegar al borde, B llena el cuadro. forma: 'circulo' | 'marco'. */
export function zoomA(ctx, u, A, B, { foco = { x: 0.5, y: 0.5, r: 0.12 }, forma = 'circulo', borde = '#2a2420' } = {}) {
  if (extremos(u, ctx, A, B)) return;
  const { W, H, s } = dimension(ctx), e = inOutCubic(u), f = { x: foco.x * W, y: foco.y * H }, c = { x: W / 2, y: H / 2 }, circ = forma === 'circulo', r0 = circ ? foco.r * H : foco.r * W, fin = circ ? Math.hypot(W, H) / 2 : W / 2;
  const S = Math.exp(Math.log(fin / r0) * e), fs = { x: lerp(f.x, c.x, e), y: lerp(f.y, c.y, e) }, r = r0 * S, sb = circ ? Math.max(r / fin, Math.min(1, 2 * r / H)) : r / fin, b = capa(ctx, 'zoomB', (g) => B(g));
  ctx.save(); ctx.translate(fs.x, fs.y); ctx.scale(S, S); ctx.translate(-f.x, -f.y); A(ctx); ctx.restore();
  ctx.save(); ctx.beginPath(); circ ? ctx.arc(fs.x, fs.y, r, 0, 6.283) : ctx.rect(fs.x - r, fs.y - r * H / W, 2 * r, 2 * r * H / W); ctx.clip();
  ctx.translate(fs.x, fs.y); ctx.scale(sb, sb); ctx.translate(-c.x, -c.y); ctx.drawImage(b, 0, 0); ctx.restore();
  const a = 1 - smoothstep(0.75, 1, u); ctx.save(); ctx.strokeStyle = rgba(borde, 0.9 * a); ctx.lineWidth = Math.max(2, 5 * s * Math.sqrt(S)); ctx.beginPath(); circ ? ctx.arc(fs.x, fs.y, r, 0, 6.283) : ctx.rect(fs.x - r, fs.y - r * H / W, 2 * r, 2 * r * H / W); ctx.stroke();
  ctx.strokeStyle = `rgba(255,255,255,${0.35 * a})`; ctx.lineWidth = Math.max(1, 1.5 * s * Math.sqrt(S)); ctx.beginPath(); circ ? ctx.arc(fs.x, fs.y, r - ctx.lineWidth * 3, 0.9, 2.2) : ctx.rect(fs.x - r + 6, fs.y - r * H / W + 6, 2 * r - 12, 2 * r * H / W - 12); ctx.stroke(); ctx.restore();
}

/** corteEco(ctx,u,A,B,{a,b,forma,oscuro}): una forma de A ({x,y,r} normalizado, r = fraccion del alto; `forma`: 'circulo'|'elipse'|'rect') viaja a su sitio en B mientras el resto se apaga; dentro de la forma A pasa a B (analogia). */
export function corteEco(ctx, u, A, B, { a = { x: 0.5, y: 0.5, r: 0.2 }, b = { x: 0.5, y: 0.5, r: 0.2 }, forma = 'circulo', oscuro = '#0b0d10' } = {}) {
  if (extremos(u, ctx, A, B)) return;
  const { W, H } = dimension(ctx), e = inOutCubic(u), P = (q) => ({ x: q.x * W, y: q.y * H, r: q.r * H }), pa = P(a), pb = P(b), cur = { x: lerp(pa.x, pb.x, e), y: lerp(pa.y, pb.y, e), r: lerp(pa.r, pb.r, e) };
  const dim = Math.pow(Math.sin(Math.PI * u), 0.7), mezcla = smoothstep(0.42, 0.58, u), forma2 = (g, q) => { g.beginPath(); forma === 'rect' ? g.rect(q.x - q.r, q.y - q.r, 2 * q.r, 2 * q.r) : forma === 'elipse' ? g.ellipse(q.x, q.y, q.r * 1.5, q.r, 0, 0, 6.283) : g.arc(q.x, q.y, q.r, 0, 6.283); };
  (u < 0.5 ? A : B)(ctx);
  ctx.save(); ctx.fillStyle = rgba(oscuro, 0.96 * dim); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.fill(); ctx.restore();
  const dentro = (fn, q0, alfa) => { ctx.save(); forma2(ctx, cur); ctx.clip(); ctx.globalAlpha = alfa; ctx.translate(cur.x, cur.y); ctx.scale(cur.r / q0.r, cur.r / q0.r); ctx.translate(-q0.x, -q0.y); fn(ctx); ctx.restore(); };
  ctx.save(); ctx.fillStyle = oscuro; forma2(ctx, cur); ctx.fill(); ctx.restore(); dentro(A, pa, 1 - mezcla); if (mezcla > 0) dentro(B, pb, mezcla);
  ctx.save(); ctx.strokeStyle = `rgba(255,245,225,${0.5 * dim})`; ctx.lineWidth = 2.5 * (W / 1920); forma2(ctx, cur); ctx.stroke(); ctx.restore();
}
