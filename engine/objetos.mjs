// BIBLIOTECA DE OBJETOS (spec 014): objetos concretos, paramétricos y VECTORIALES (no clip-art), pensados para ser el ANCLA de un film
// (013: lo que funciona es un objeto con física propia). Módulo PURO: cada objeto se dibuja en un cuadro unidad (lado mayor = 1, origen en el
// centro, y hacia abajo) y expone  · params  (forma, cantidad, texto)  · partes (valores 0..1 / rangos animables por t)  · estados (juegos de
// partes con nombre; se interpolan con estado:[a,b,u])  · anclas (puntos con nombre que el shot lee para colocar otras cosas).
// Respetan el medio: trazo con la tinta, relleno por rol de la paleta (fill/acento), sin colores propios salvo transparencias y brillos.
//   drawObjeto(ctx, id, {x,y,size,rot,estado,partes,params,color,relleno,acento,flip,alfa}, E) → {x,y,w,h,rot, <ancla>:{x,y}, …}
//   E = { pal:{rol:hex}, k, t, font }
import { clamp, lerp, rng, hashStr } from './core.mjs';
import { mix as mixHex, rgba } from './color.mjs';
import { hint, T, paramMeta, paramsTB } from './fondo-capas.mjs';
import { makeColor } from './fondos.mjs';

const P2 = Math.PI * 2;
export const OBJETOS = {};
const wc = (s) => String(s).trim().split(/\s+/).length;
const pa = (def, doc, min, max) => ({ type: 'num', def, doc, min, max });
function objeto(id, resumen, tags, { caja = [1, 1], params = {}, partes = {}, estados = {}, anclas = [], relleno = 'shade' }, draw) {
  if (wc(resumen) > 15) throw new Error(`objeto ${id}: resumen > 15 palabras`);
  const ps = {}; for (const [k, v] of Object.entries(partes)) ps[k] = { type: 'num', def: v[0], min: v[1], max: v[2], doc: v[3] };
  OBJETOS[id] = { id, resumen, tags, caja, params, partes: ps, estados: { reposo: {}, ...estados }, anclas, relleno, draw };
}
const C = (c, f) => { c.beginPath(); f(c); };
const rrect = (c, x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
const lg = (c, x0, y0, x1, y1, st) => { const g = c.createLinearGradient(x0, y0, x1, y1); st.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
// pintado en dos pasadas: relleno y trazo de tinta (grosor en múltiplos del trazo base)
const FS = (S, c, fill, w = 1) => { if (fill) { c.fillStyle = fill; c.fill(); } if (w) { c.lineWidth = S.lw * w; c.strokeStyle = S.ink; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); } };
const pt = (x, y) => [x, y];
const rp = (a, [x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];   // gira un punto de ancla como el dibujo
// texto en el cuadro unidad: se dibuja a escala ×1000 (las fuentes de fracciones de píxel no son fiables)
const FT = (S, c, str, x, y, size, { bold = true, align = 'center', base = 'middle' } = {}) => { c.save(); c.scale(0.001, 0.001); c.font = `${bold ? 'bold ' : ''}${Math.max(1, Math.round(size * 1000))}px ${S.font}`; c.textAlign = align; c.textBaseline = base; c.fillText(String(str), x * 1000, y * 1000); c.restore(); };

// ═════ 1. cilindro metálico (el kilo) ═════
objeto('cilindro_metalico', 'Cilindro de metal pulido, alto igual que ancho, con brillo que recorre su flanco.', ['metal', 'kilo', 'pesa', 'ciencia'], {
  caja: [0.74, 0.74], relleno: 'shade', anclas: ['tapa', 'base', 'centro'], params: { acabado: T.enu('pulido', 'brillo del metal', ['pulido', 'mate']) },
  partes: { brillo: [0.35, 0, 1, 'posición del reflejo en el flanco'], inclinacion: [0, -1, 1, 'giro leve del cilindro'] }, estados: { destello: { brillo: 1 }, apagado: { brillo: 0 } } },
(c, P, S) => {
  const w = 0.66, h = 0.58, ry = 0.075, x0 = -w / 2, y0 = -h / 2 + 0.02, y1 = y0 + h, ia = S.q.inclinacion * 0.12; c.rotate(ia);
  const body = lg(c, x0, 0, -x0, 0, [[0, S.dk(S.fill, 0.35)], [clamp(S.q.brillo * 0.8 + 0.1), S.lt(S.fill, P.acabado === 'pulido' ? 0.75 : 0.3)], [1, S.dk(S.fill, 0.45)]]);
  C(c, (c) => { c.moveTo(x0, y0); c.lineTo(x0, y1); c.ellipse(0, y1, w / 2, ry, 0, Math.PI, 0, true); c.lineTo(-x0, y0); c.closePath(); }); FS(S, c, body, 1.2);
  C(c, (c) => c.ellipse(0, y0, w / 2, ry, 0, 0, P2)); FS(S, c, S.lt(S.fill, 0.55), 1.2);
  c.strokeStyle = S.A(S.paper, 0.5); c.lineWidth = S.lw * 0.7; C(c, (c) => c.ellipse(0, y0, w / 2 * 0.8, ry * 0.7, 0, Math.PI * 1.1, Math.PI * 1.75)); c.stroke();
  return { tapa: rp(ia, pt(0, y0)), base: rp(ia, pt(0, y1 + ry)), centro: pt(0, 0) };
});
// ═════ 2. campana de cristal ═════
objeto('campana_cristal', 'Campana de cristal sobre peana, con condensación; admite hasta tres campanas anidadas.', ['cristal', 'custodia', 'museo', 'frio'], {
  caja: [0.7, 1], relleno: 'paper', anclas: ['cima', 'borde', 'peana', 'centro'], params: { anidadas: { type: 'int', def: 1, doc: 'campanas una dentro de otra', min: 1, max: 3 } },
  partes: { elevacion: [0, 0, 1, 'cuánto se alza la campana'], condensacion: [0.4, 0, 1, 'gotas de condensación'] }, estados: { alzada: { elevacion: 1 }, empanada: { condensacion: 1 } } },
(c, P, S) => {
  const by = 0.4, lift = S.q.elevacion * 0.22; c.save();
  C(c, (c) => { rrect(c, -0.34, by, 0.68, 0.08, 0.03); }); FS(S, c, S.dk(S.fill, 0.25), 1.2);
  const bell = (k, a) => { const w = 0.3 * k, top = -0.4 * k - lift, bot = by - lift * 0; c.beginPath(); c.moveTo(-w, bot); c.bezierCurveTo(-w * 1.05, top * 0.1, -w * 0.9, top, 0, top); c.bezierCurveTo(w * 0.9, top, w * 1.05, top * 0.1, w, bot); c.closePath(); c.fillStyle = S.A(S.paper, a); c.fill(); c.lineWidth = S.lw; c.strokeStyle = S.ink; c.globalAlpha *= 0.85; c.stroke(); c.globalAlpha /= 0.85;
    c.strokeStyle = S.A('#ffffff', 0.75); c.lineWidth = S.lw * 1.4; c.beginPath(); c.moveTo(-w * 0.62, bot - 0.04); c.bezierCurveTo(-w * 0.8, top * 0.3, -w * 0.62, top * 0.85, -w * 0.18, top * 0.93); c.stroke();
    const R = rng(hashStr('cond' + k)); c.fillStyle = S.A('#ffffff', 0.5); for (let i = 0; i < 26 * S.q.condensacion; i++) { const u = R(), x = (R() - 0.5) * w * 1.5, y = lerp(bot - 0.03, top * 0.85, u); c.beginPath(); c.arc(x, y, (0.004 + R() * 0.008) * k, 0, P2); c.fill(); } };
  for (let i = P.anidadas; i >= 1; i--) bell(0.5 + 0.5 * (i / P.anidadas), 0.14);
  c.restore(); return { cima: pt(0, -0.4 - lift), borde: pt(-0.3, by), peana: pt(0, by + 0.04), centro: pt(0, 0) };
});
// ═════ 3. llave de latón ═════
objeto('llave_laton', 'Llave de latón con aro, caña y paletón dentado; gira en la cerradura.', ['llave', 'laton', 'custodia', 'cerradura'], {
  caja: [1, 0.36], relleno: 'accent2', anclas: ['aro', 'punta', 'dientes'], params: { dientes: { type: 'int', def: 4, doc: 'dientes del paletón', min: 1, max: 8 }, aro: T.enu('redondo', 'forma del aro', ['redondo', 'trebol']) },
  partes: { giro: [0, 0, 1, 'giro de la llave sobre su eje (0..90°)'], brillo: [0.5, 0, 1, 'reflejo del latón'] }, estados: { girada: { giro: 1 } } },
(c, P, S) => {
  const brass = S.lt(S.mix(S.fill, '#c9a24a', 0.8), 0.1); c.rotate(S.q.giro * Math.PI / 2 * 0.0); const sq = Math.cos(S.q.giro * Math.PI / 2 * 0.9) * 0.55 + 0.45;
  c.save(); c.scale(1, sq);
  C(c, (c) => { c.arc(-0.34, 0, 0.14, 0, P2); c.arc(-0.34, 0, 0.065, 0, P2, true); }); FS(S, c, lg(c, -0.5, -0.14, -0.2, 0.14, [[0, S.lt(brass, 0.5)], [1, S.dk(brass, 0.3)]]), 1.3);
  if (P.aro === 'trebol') for (const a of [0, 2.1, 4.2]) C(c, (c) => c.arc(-0.34 + Math.cos(a) * 0.14, Math.sin(a) * 0.14, 0.05, 0, P2)), FS(S, c, brass, 1);
  C(c, (c) => rrect(c, -0.22, -0.026, 0.58, 0.052, 0.02)); FS(S, c, lg(c, 0, -0.03, 0, 0.03, [[0, S.lt(brass, 0.55)], [0.5, brass], [1, S.dk(brass, 0.35)]]), 1.1);
  C(c, (c) => { c.moveTo(0.18, 0.026); for (let i = 0; i < P.dientes; i++) { const x = 0.2 + i * (0.16 / P.dientes) * 1.0, hh = 0.045 + 0.05 * ((i * 37) % 3) / 2; c.lineTo(x, 0.026 + hh); c.lineTo(x + 0.16 / P.dientes * 0.6, 0.026 + hh); c.lineTo(x + 0.16 / P.dientes * 0.6, 0.026); } c.lineTo(0.36, 0.026); c.closePath(); }); FS(S, c, brass, 1.1);
  c.restore(); return { aro: pt(-0.34, 0), punta: pt(0.36, 0), dientes: pt(0.27, 0.07 * sq) };
});
// ═════ 4. balanza de cruz ═════
objeto('balanza_cruz', 'Balanza de brazos iguales con platos colgados; la aguja puede quedar ladeada.', ['balanza', 'medida', 'peso', 'ciencia'], {
  caja: [1, 0.9], relleno: 'accent2', anclas: ['pivote', 'platoIzq', 'platoDer', 'aguja'], params: { cadenas: { type: 'int', def: 2, doc: 'cuerdas por plato', min: 2, max: 3 } },
  partes: { inclinacion: [0, -1, 1, 'brazo: −1 izq. arriba … +1 der. arriba'], aguja: [0, -1, 1, 'desvío extra de la aguja (no vuelve al cero)'], oscilacion: [0, 0, 1, 'cuánto se mece el brazo con t'] }, estados: { ladeada: { inclinacion: 0.05, aguja: 0.6 }, desequilibrio: { inclinacion: -0.7 } } },
(c, P, S) => {
  const brass = S.mix(S.fill, '#b88a3a', 0.6), ang = (S.q.inclinacion + S.q.oscilacion * Math.sin(S.t * 2.4) * 0.3) * 0.17, pv = [0, -0.2], L = 0.42;
  C(c, (c) => { c.moveTo(-0.16, 0.45); c.lineTo(0.16, 0.45); c.lineTo(0.06, 0.38); c.lineTo(0.03, -0.2); c.lineTo(-0.03, -0.2); c.lineTo(-0.06, 0.38); c.closePath(); }); FS(S, c, S.dk(brass, 0.15), 1.2);
  C(c, (c) => rrect(c, -0.2, 0.42, 0.4, 0.045, 0.015)); FS(S, c, S.dk(brass, 0.3), 1.1);
  const ex = (s) => [pv[0] + Math.cos(ang) * L * s, pv[1] + Math.sin(ang) * L * s]; c.save(); c.translate(pv[0], pv[1]); c.rotate(ang); C(c, (c) => { c.moveTo(-L, 0); c.lineTo(-L * 0.4, -0.026); c.lineTo(L * 0.4, -0.026); c.lineTo(L, 0); c.lineTo(L * 0.4, 0.026); c.lineTo(-L * 0.4, 0.026); c.closePath(); }); FS(S, c, brass, 1.2); c.restore();
  const pl = []; for (const s of [-1, 1]) { const [ax, ay] = ex(s), py = ay + 0.36; c.strokeStyle = S.ink; c.lineWidth = S.lw * 0.7;
    for (let i = 0; i < P.cadenas; i++) { const dx = (i / (P.cadenas - 1) - 0.5) * 0.2; c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax + dx * 1.7, py); c.stroke(); }
    C(c, (c) => { c.moveTo(ax - 0.12, py); c.quadraticCurveTo(ax, py + 0.1, ax + 0.12, py); c.closePath(); }); FS(S, c, S.lt(brass, 0.25), 1.1); c.fillStyle = S.ink; c.beginPath(); c.arc(ax, ay, 0.012, 0, P2); c.fill(); pl.push(pt(ax, py + 0.02)); }
  const na = clamp(S.q.aguja) * 0.5 + (S.q.aguja < 0 ? S.q.aguja * 0.5 : 0) + ang * 0.0, ax2 = pv[0] + Math.sin(na) * 0.22, ay2 = pv[1] + Math.cos(na) * 0.22;
  C(c, (c) => { c.moveTo(pv[0], pv[1]); c.lineTo(ax2, ay2); }); c.strokeStyle = S.acc; c.lineWidth = S.lw * 1.5; c.stroke(); c.fillStyle = S.ink; c.beginPath(); c.arc(pv[0], pv[1], 0.02, 0, P2); c.fill();
  return { pivote: pt(pv[0], pv[1]), platoIzq: pl[0], platoDer: pl[1], aguja: pt(ax2, ay2) };
});
// ═════ 5. sello / tampón ═════
objeto('sello_tampon', 'Sello de goma con mango de madera; baja, estampa (o no, sin tinta) y sube.', ['sello', 'tampon', 'tinta', 'burocracia'], {
  caja: [0.7, 1], relleno: 'accent', anclas: ['cara', 'mango', 'huella'], params: { texto: { type: 'string', def: 'CONSTA', doc: 'texto del sello' }, forma: T.enu('rectangular', 'forma de la huella', ['rectangular', 'redondo']) },
  partes: { altura: [1, 0, 1, '1 = levantado · 0 = apoyado'], tinta: [1, 0, 1, 'tinta en la cara y en la huella (0 = sin tinta)'], huella: [0, 0, 1, 'huella visible en el papel'] }, estados: { estampando: { altura: 0, huella: 1 }, sin_tinta: { altura: 0, tinta: 0, huella: 0 } } },
(c, P, S) => {
  const lift = S.q.altura * 0.28, fy = 0.28 - lift, wood = S.mix('#7a4e2a', S.fill, 0.15);
  c.save(); c.globalAlpha *= S.q.huella; c.fillStyle = S.A(S.acc, 0.85 * S.q.tinta); c.strokeStyle = S.A(S.acc, 0.9 * S.q.tinta); c.lineWidth = S.lw * 1.6;
  if (S.q.huella > 0.01) { if (P.forma === 'redondo') { c.beginPath(); c.arc(0, 0.37, 0.14, 0, P2); c.stroke(); } else { c.strokeRect(-0.24, 0.31, 0.48, 0.12); } FT(S, c, P.texto, 0, 0.372, 0.075); }
  c.restore();
  C(c, (c) => rrect(c, -0.2, fy - 0.07, 0.4, 0.08, 0.02)); FS(S, c, S.dk(wood, 0.1), 1.2);
  C(c, (c) => rrect(c, -0.07, fy - 0.38, 0.14, 0.32, 0.05)); FS(S, c, lg(c, -0.07, 0, 0.07, 0, [[0, S.lt(wood, 0.3)], [1, S.dk(wood, 0.3)]]), 1.2);
  C(c, (c) => { c.arc(0, fy - 0.42, 0.095, 0, P2); }); FS(S, c, lg(c, -0.1, -0.5, 0.1, -0.3, [[0, S.lt(wood, 0.3)], [1, S.dk(wood, 0.3)]]), 1.2);
  C(c, (c) => rrect(c, -0.2, fy, 0.4, 0.035, 0.01)); FS(S, c, S.mix(S.ink, S.acc, 0.3 + 0.6 * S.q.tinta), 1);
  return { cara: pt(0, fy + 0.035), mango: pt(0, fy - 0.5), huella: pt(0, 0.37) };
});
// ═════ 6. acta / cuaderno con renglones ═════
objeto('acta_cuaderno', 'Hoja de acta con título, renglones escritos y líneas de firma.', ['acta', 'papel', 'renglones', 'firma', 'expediente'], {
  caja: [0.72, 1], relleno: 'paper', anclas: ['titulo', 'firma1', 'firma2', 'firma3', 'esquina'], params: { renglones: { type: 'int', def: 9, doc: 'renglones', min: 3, max: 18 }, firmas: { type: 'int', def: 3, doc: 'líneas de firma', min: 1, max: 3 }, margen: T.bool(true, 'línea de margen') },
  partes: { escrito: [1, 0, 1, 'fracción de renglones escritos'], firmadas: [0, 0, 1, 'fracción de firmas puestas (0.66 = 2 de 3)'], curvatura: [0.3, 0, 1, 'esquina doblada'] }, estados: { llena: { escrito: 1, firmadas: 0.66 }, vacia: { escrito: 0 } } },
(c, P, S) => {
  const w = 0.62, h = 0.9, x0 = -w / 2, y0 = -h / 2; c.save(); c.rotate(-0.02);
  C(c, (c) => { c.moveTo(x0, y0); c.lineTo(-x0, y0); c.lineTo(-x0, -y0 - 0.06 * S.q.curvatura); c.lineTo(-x0 - 0.06 * S.q.curvatura, -y0); c.lineTo(x0, -y0); c.closePath(); }); FS(S, c, S.lt(S.fill, 0.25), 1.2);
  if (S.q.curvatura > 0.05) C(c, (c) => { c.moveTo(-x0, -y0 - 0.06 * S.q.curvatura); c.lineTo(-x0 - 0.06 * S.q.curvatura, -y0 - 0.06 * S.q.curvatura); c.lineTo(-x0 - 0.06 * S.q.curvatura, -y0); c.closePath(); }), FS(S, c, S.dk(S.fill, 0.15), 0.8);
  c.fillStyle = S.ink; c.fillRect(x0 + 0.06, y0 + 0.06, w * 0.5, 0.034); c.fillRect(x0 + 0.06, y0 + 0.11, w * 0.28, 0.014);
  if (P.margen) { c.strokeStyle = S.A(S.acc, 0.7); c.lineWidth = S.lw * 0.8; c.beginPath(); c.moveTo(x0 + 0.1, y0 + 0.03); c.lineTo(x0 + 0.1, -y0 - 0.03); c.stroke(); }
  const n = P.renglones, top = y0 + 0.2, bot = -y0 - 0.2, R = rng(5);
  for (let i = 0; i < n; i++) { const y = lerp(top, bot, i / (n - 1)); c.strokeStyle = S.A(S.ink, 0.28); c.lineWidth = S.lw * 0.6; c.beginPath(); c.moveTo(x0 + 0.06, y); c.lineTo(-x0 - 0.06, y); c.stroke();
    if (i / n < S.q.escrito) { c.strokeStyle = S.ink; c.lineWidth = S.lw * 1.1; c.beginPath(); c.moveTo(x0 + 0.13, y - 0.012); const len = (0.55 + 0.35 * R()) * (w - 0.22); for (let x = 0; x < len; x += 0.018) c.lineTo(x0 + 0.13 + x, y - 0.012 - 0.008 * Math.sin(x * 90 + i) * (0.6 + R() * 0.8)); c.stroke(); } }
  const an = {}; for (let i = 1; i <= 3; i++) { const fx = x0 + 0.1 + ((i - 1) / Math.max(1, P.firmas - 1 || 1)) * (w - 0.3), fy = -y0 - 0.1, ii = Math.min(i, P.firmas); const px = P.firmas === 1 ? 0 : (ii - 1) / (P.firmas - 1); const X = x0 + 0.1 + px * (w - 0.34);
    c.strokeStyle = S.ink; c.lineWidth = S.lw * 0.8; c.beginPath(); if (i <= P.firmas) { c.moveTo(X, fy); c.lineTo(X + 0.15, fy); c.stroke(); }
    if (i <= P.firmas && (i - 0.5) / P.firmas <= S.q.firmadas + 1e-6) { c.lineWidth = S.lw * 1.3; c.beginPath(); c.moveTo(X + 0.01, fy - 0.01); c.bezierCurveTo(X + 0.04, fy - 0.07, X + 0.06, fy + 0.02, X + 0.09, fy - 0.05); c.bezierCurveTo(X + 0.1, fy - 0.01, X + 0.13, fy - 0.03, X + 0.14, fy - 0.02); c.stroke(); }
    an['firma' + i] = pt(X + 0.075, fy); }
  c.restore(); return { titulo: pt(x0 + 0.2, y0 + 0.07), esquina: pt(-x0, -y0), ...an };
});
// ═════ 7. pluma ═════
objeto('pluma', 'Pluma de ave o estilográfica con plumín; deja un trazo de tinta al escribir.', ['pluma', 'escritura', 'tinta', 'firma'], {
  caja: [1, 0.5], relleno: 'paper', anclas: ['punta', 'extremo', 'tintero'], params: { tipo: T.enu('ave', 'tipo de pluma', ['ave', 'estilografica']) },
  partes: { trazo: [0, 0, 1, 'largo del trazo de tinta ya escrito'], inclinacion: [0, -1, 1, 'ángulo de la pluma'], mojada: [1, 0, 1, 'tinta en la punta'] }, estados: { escribiendo: { trazo: 1 } } },
(c, P, S) => {
  const pa0 = -0.55 + S.q.inclinacion * 0.25; c.rotate(pa0); const tip = [-0.4, 0.22], end = [0.45, -0.22];
  c.save(); c.rotate(0.55 - S.q.inclinacion * 0.25); if (S.q.trazo > 0.01) { c.strokeStyle = S.ink; c.lineWidth = S.lw * 1.6; c.lineCap = 'round'; c.beginPath(); const n = 24 * S.q.trazo; for (let i = 0; i <= n; i++) { const u = i / 24; c.lineTo(-0.4 - 0.55 * u + 0.5 * u * 0 , 0.34 + 0.03 * Math.sin(u * 18)); } c.stroke(); } c.restore();
  if (P.tipo === 'ave') {
    c.strokeStyle = S.ink; c.lineWidth = S.lw * 1.3; C(c, (c) => { c.moveTo(tip[0], tip[1]); c.lineTo(end[0], end[1]); }); c.stroke();
    C(c, (c) => { c.moveTo(0.0, 0); c.bezierCurveTo(0.25, 0.08, 0.5, -0.05, end[0] + 0.05, end[1] - 0.2); c.bezierCurveTo(0.35, -0.2, 0.2, -0.15, 0.0, 0); }); FS(S, c, S.lt(S.fill, 0.15), 1);
    c.strokeStyle = S.A(S.ink, 0.5); c.lineWidth = S.lw * 0.5; for (let i = 0; i < 9; i++) { const u = 0.1 + i * 0.1; c.beginPath(); c.moveTo(lerp(0.0, 0.45, u), lerp(0, -0.22, u)); c.lineTo(lerp(0.0, 0.45, u) + 0.07, lerp(0, -0.22, u) - 0.1 + u * 0.05); c.stroke(); }
    C(c, (c) => { c.moveTo(tip[0], tip[1]); c.lineTo(tip[0] + 0.1, tip[1] - 0.08); c.lineTo(tip[0] + 0.07, tip[1] - 0.02); c.closePath(); }); FS(S, c, S.ink, 0.8);
  } else {
    C(c, (c) => { c.moveTo(tip[0], tip[1]); c.lineTo(tip[0] + 0.14, tip[1] - 0.06); c.lineTo(tip[0] + 0.14, tip[1] - 0.12); c.closePath(); }); FS(S, c, S.lt(S.mix(S.fill, '#c9a24a', 0.8), 0.2), 1);
    C(c, (c) => { c.moveTo(tip[0] + 0.12, tip[1] - 0.14); c.lineTo(end[0], end[1] - 0.06); c.lineTo(end[0] + 0.03, end[1] + 0.02); c.lineTo(tip[0] + 0.15, tip[1] - 0.04); c.closePath(); }); FS(S, c, S.dk(S.fill, 0.7), 1.2);
  }
  if (S.q.mojada > 0.05) { c.fillStyle = S.A(S.ink, S.q.mojada); c.beginPath(); c.arc(tip[0] - 0.005, tip[1] + 0.005, 0.014, 0, P2); c.fill(); }
  return { punta: rp(pa0, tip), extremo: rp(pa0, end), tintero: rp(pa0, pt(tip[0] - 0.1, tip[1] + 0.12)) };
});
// ═════ 8. fotomultiplicador ═════
objeto('fotomultiplicador', 'Tubo fotomultiplicador de bulbo grande: cúpula de vidrio, cuello y base con patillas.', ['fotomultiplicador', 'detector', 'cuba', 'vidrio', 'luz'], {
  caja: [0.86, 1], relleno: 'shade', anclas: ['cupula', 'cuello', 'base', 'centro'], params: { patillas: { type: 'int', def: 7, doc: 'patillas de la base', min: 3, max: 14 } },
  partes: { luz: [0, 0, 1, 'destello del fotocátodo'], giro: [0, -1, 1, 'giro leve del tubo'] }, estados: { destello: { luz: 1 } } },
(c, P, S) => {
  c.rotate(S.q.giro * 0.2); const glow = S.acc, r = 0.4;
  if (S.q.luz > 0.02) { const g = c.createRadialGradient(0, -0.1, 0, 0, -0.1, 0.8); g.addColorStop(0, S.A(glow, 0.5 * S.q.luz)); g.addColorStop(1, S.A(glow, 0)); c.fillStyle = g; c.fillRect(-1, -1, 2, 2); }
  C(c, (c) => { c.moveTo(-0.07, 0.26); c.bezierCurveTo(-0.1, 0.2, -r, 0.18, -r, -0.1); c.bezierCurveTo(-r, -0.45, r, -0.45, r, -0.1); c.bezierCurveTo(r, 0.18, 0.1, 0.2, 0.07, 0.26); c.closePath(); });
  FS(S, c, lg(c, -r, -0.4, r, 0.2, [[0, S.A(S.mix(S.fill, glow, S.q.luz), 0.45 + 0.4 * S.q.luz)], [1, S.A(S.dk(S.fill, 0.4), 0.8)]]), 1.3);
  c.strokeStyle = S.A('#ffffff', 0.7); c.lineWidth = S.lw * 1.6; c.beginPath(); c.moveTo(-r * 0.78, 0.0); c.bezierCurveTo(-r * 0.85, -0.2, -r * 0.55, -0.34, -r * 0.2, -0.36); c.stroke();
  C(c, (c) => c.ellipse(0, -0.1, r * 0.62, 0.2, 0, 0, P2)); c.strokeStyle = S.A(S.ink, 0.45); c.lineWidth = S.lw * 0.7; c.stroke();
  C(c, (c) => rrect(c, -0.075, 0.24, 0.15, 0.1, 0.01)); FS(S, c, S.dk(S.fill, 0.35), 1.1);
  C(c, (c) => rrect(c, -0.13, 0.34, 0.26, 0.1, 0.02)); FS(S, c, S.dk(S.fill, 0.5), 1.1);
  c.strokeStyle = S.ink; c.lineWidth = S.lw * 0.9; for (let i = 0; i < P.patillas; i++) { const x = lerp(-0.11, 0.11, P.patillas === 1 ? 0.5 : i / (P.patillas - 1)); c.beginPath(); c.moveTo(x, 0.44); c.lineTo(x, 0.5); c.stroke(); }
  return { cupula: pt(0, -0.38), cuello: pt(0, 0.28), base: pt(0, 0.5), centro: pt(0, -0.1) };
});
// ═════ 9. cuba ═════
objeto('cuba', 'Corte de una cuba cilíndrica de agua con fotomultiplicadores en las paredes y destello.', ['cuba', 'detector', 'agua', 'ciencia'], {
  caja: [1, 0.9], relleno: 'accent2', anclas: ['centro', 'superficie', 'fondo', 'paredIzq', 'paredDer', 'destello'], params: { pmts: { type: 'int', def: 9, doc: 'fotomultiplicadores por pared', min: 2, max: 20 }, destelloX: pa(0.1, 'x del destello (−1..1)', -1, 1), destelloY: pa(0.1, 'y del destello (−1..1)', -1, 1) },
  partes: { nivel: [0.92, 0, 1, 'nivel del agua'], destello: [0, 0, 1, 'destello de luz Cherenkov'], luz: [0.25, 0, 1, 'brillo general de los tubos'] }, estados: { destello: { destello: 1, luz: 0.7 } } },
(c, P, S) => {
  const w = 0.9, h = 0.78, x0 = -w / 2, y0 = -h / 2 + 0.02, wl = y0 + h * (1 - S.q.nivel);
  C(c, (c) => rrect(c, x0, y0, w, h, 0.03)); FS(S, c, S.A(S.dk(S.fill, 0.75), 0.9), 1.4);
  c.save(); C(c, (c) => rrect(c, x0 + 0.01, wl, w - 0.02, y0 + h - wl, 0.02)); c.fillStyle = lg(c, 0, wl, 0, y0 + h, [[0, S.A(S.fill, 0.55)], [1, S.A(S.dk(S.fill, 0.85), 0.95)]]); c.fill(); c.restore();
  c.strokeStyle = S.A(S.lt(S.fill, 0.6), 0.8); c.lineWidth = S.lw; c.beginPath(); c.moveTo(x0 + 0.01, wl); c.lineTo(-x0 - 0.01, wl); c.stroke();
  const dx = P.destelloX * w * 0.4, dy = P.destelloY * h * 0.4;
  const tube = (x, y, r) => { const d = Math.hypot(x - dx, y - dy), on = clamp(S.q.luz + S.q.destello * Math.max(0, 1 - d / 0.5)); const g = c.createRadialGradient(x, y, 0, x, y, r * 1.8); g.addColorStop(0, S.A(S.acc, 0.7 * on)); g.addColorStop(1, S.A(S.acc, 0)); c.fillStyle = g; c.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
    c.fillStyle = S.A(S.mix(S.fill, S.acc, on), 0.9); c.beginPath(); c.arc(x, y, r, 0, P2); c.fill(); c.strokeStyle = S.ink; c.lineWidth = S.lw * 0.6; c.stroke(); };
  for (let i = 0; i < P.pmts; i++) { const y = lerp(y0 + 0.06, y0 + h - 0.06, i / (P.pmts - 1)); tube(x0 + 0.04, y, 0.022); tube(-x0 - 0.04, y, 0.022); }
  for (let i = 0; i < Math.round(P.pmts * 0.8); i++) { const x = lerp(x0 + 0.1, -x0 - 0.1, i / (Math.round(P.pmts * 0.8) - 1)); tube(x, y0 + h - 0.04, 0.02); }
  if (S.q.destello > 0.02) { const g = c.createRadialGradient(dx, dy, 0, dx, dy, 0.3); g.addColorStop(0, S.A('#ffffff', 0.9 * S.q.destello)); g.addColorStop(0.2, S.A(S.acc, 0.6 * S.q.destello)); g.addColorStop(1, S.A(S.acc, 0)); c.fillStyle = g; c.fillRect(dx - 0.4, dy - 0.4, 0.8, 0.8); }
  return { centro: pt(0, 0), superficie: pt(0, wl), fondo: pt(0, y0 + h), paredIzq: pt(x0, 0), paredDer: pt(-x0, 0), destello: pt(dx, dy) };
});
// ═════ 10. contador ═════
objeto('contador', 'Contador de dígitos mecánico (rodillos) o numérico (siete segmentos) con valor animable.', ['contador', 'cifra', 'mecanismo', 'numero'], {
  caja: [1, 0.4], relleno: 'ink', anclas: ['ultimo', 'primero', 'marco'], params: { digitos: { type: 'int', def: 4, doc: 'número de dígitos', min: 1, max: 8 }, tipo: T.enu('mecanico', 'rodillos o siete segmentos', ['mecanico', 'numerico']) },
  partes: { valor: [0, 0, 99999999, 'cifra mostrada (con decimales rueda el último dígito)'], brillo: [0.6, 0, 1, 'brillo del numérico'] }, estados: { veinticuatro: { valor: 24 } } },
(c, P, S) => {
  const n = P.digitos, dw = 0.82 / n, h = 0.3, x0 = -0.5 + 0.09; C(c, (c) => rrect(c, -0.5, -h / 2 - 0.04, 1, h + 0.08, 0.04)); FS(S, c, S.dk(S.mix(S.fill, S.ink, 0.7), 0.1), 1.4);
  const v = Math.max(0, S.q.valor), whole = Math.floor(v), fr = v - whole; 
  for (let i = 0; i < n; i++) {
    const cx = x0 + (i + 0.5) * dw, place = n - 1 - i, dig = Math.floor(whole / 10 ** place) % 10, roll = place === 0 ? fr : (whole % 10 ** place) / 10 ** place >= 1 - 1e-9 ? 0 : 0, rollv = place === 0 ? fr : ((whole % 10 ** place) + fr) / 10 ** place > 0.9 ? ((((whole % 10 ** place) + fr) / 10 ** place) - 0.9) * 10 : 0;
    c.save(); C(c, (c) => rrect(c, cx - dw * 0.44, -h / 2, dw * 0.88, h, 0.015)); c.clip();
    c.fillStyle = P.tipo === 'mecanico' ? S.lt(S.paper, 0.1) : S.dk(S.ink, 0.1); c.fillRect(cx - dw / 2, -h / 2, dw, h);
    c.fillStyle = P.tipo === 'mecanico' ? S.ink : S.A(S.acc, 0.35 + 0.65 * S.q.brillo); const off = (place === 0 ? fr : rollv) * h * 0.95, shown = (d, dy) => FT(S, c, ((d % 10) + 10) % 10, cx, dy, h * 0.82);
    shown(dig, -off); shown(dig + 1, h * 0.95 - off); c.restore();
    const gg = c.createLinearGradient(0, -h / 2, 0, h / 2); gg.addColorStop(0, 'rgba(0,0,0,0.35)'); gg.addColorStop(0.3, 'rgba(0,0,0,0)'); gg.addColorStop(0.7, 'rgba(0,0,0,0)'); gg.addColorStop(1, 'rgba(0,0,0,0.35)'); c.fillStyle = gg; c.fillRect(cx - dw * 0.44, -h / 2, dw * 0.88, h);
  }
  return { ultimo: pt(x0 + (n - 0.5) * dw, 0), primero: pt(x0 + 0.5 * dw, 0), marco: pt(0, -h / 2 - 0.04) };
});
// ═════ 11. papel continuo ═════
objeto('papel_continuo', 'Hoja de papel continuo de impresora: bandas, perforaciones laterales y líneas impresas.', ['papel', 'impresora', 'listado', 'archivo'], {
  caja: [0.7, 1], relleno: 'paper', anclas: ['cabeza', 'final', 'borde'], params: { pliegues: { type: 'int', def: 5, doc: 'pliegues en zigzag', min: 1, max: 12 } },
  partes: { despliegue: [0.7, 0.1, 1, 'cuánto papel hay desplegado'], impreso: [0.8, 0, 1, 'fracción de líneas impresas'] }, estados: { vacio: { impreso: 0 } } },
(c, P, S) => {
  const w = 0.6, n = P.pliegues, H = 0.9 * S.q.despliegue, y0 = -0.45, seg = H / n, R = rng(9);
  for (let i = 0; i < n; i++) { const y = y0 + i * seg, dir = i % 2 ? 1 : -1, sk = 0.05 * dir; C(c, (c) => { c.moveTo(-w / 2, y + (i ? 0 : 0)); c.lineTo(w / 2, y); c.lineTo(w / 2 + sk * 0.2, y + seg); c.lineTo(-w / 2 + sk * 0.2, y + seg); c.closePath(); });
    FS(S, c, lg(c, 0, y, 0, y + seg, [[0, i % 2 ? S.dk(S.lt(S.fill, 0.3), 0.07) : S.lt(S.fill, 0.3)], [1, i % 2 ? S.lt(S.fill, 0.3) : S.dk(S.lt(S.fill, 0.3), 0.07)]]), 0.9);
    c.fillStyle = S.A(S.ink, 0.35); for (const sx of [-1, 1]) for (let j = 0; j < 4; j++) { c.beginPath(); c.arc(sx * (w / 2 - 0.028), y + seg * (j + 0.5) / 4, 0.01, 0, P2); c.fill(); }
    c.strokeStyle = S.A(S.acc2, 0.18); c.fillStyle = S.A(S.ink, 0.75); for (let j = 0; j < 4; j++) { const f = (i * 4 + j) / (n * 4); if (f > S.q.impreso) continue; const yy = y + seg * (j + 0.55) / 4, len = (w - 0.14) * (0.4 + 0.6 * R()); c.fillRect(-w / 2 + 0.07, yy, len, 0.011); }
    c.fillStyle = S.A(S.acc2, 0.12); if (i % 2 === 0) c.fillRect(-w / 2 + 0.05, y, w - 0.1, seg * 0.5); }
  return { cabeza: pt(0, y0), final: pt(0, y0 + H), borde: pt(w / 2, y0 + H / 2) };
});
// ═════ 12. lápiz ═════
objeto('lapiz', 'Lápiz hexagonal con virola y goma; se desgasta y puede escribir una línea.', ['lapiz', 'escritura', 'dibujo', 'grafito'], {
  caja: [1, 0.14], relleno: 'accent2', anclas: ['punta', 'goma', 'centro'], params: { color: T.color('accent2', 'color del cuerpo') },
  partes: { desgaste: [0, 0, 1, 'se acorta y se afila'], giro: [0, 0, 1, 'giro sobre el eje (rota las caras)'] }, estados: { gastado: { desgaste: 0.8 } } },
(c, P, S) => {
  const len = 0.98 - 0.35 * S.q.desgaste, x0 = -0.5, body = S.hex(P.color), h = 0.1;
  C(c, (c) => rrect(c, x0, -h / 2, 0.08, h, 0.03)); FS(S, c, S.mix('#e0a0a0', S.paper, 0.2), 1.1);
  C(c, (c) => rrect(c, x0 + 0.08, -h / 2, 0.07, h, 0.004)); FS(S, c, lg(c, 0, -h / 2, 0, h / 2, [[0, S.lt('#b8b8b8', 0.5)], [0.5, '#9a9a9a'], [1, '#666']]), 1);
  const bx = x0 + 0.15, ex = x0 + len - 0.14; C(c, (c) => c.rect(bx, -h / 2, ex - bx, h)); FS(S, c, lg(c, 0, -h / 2, 0, h / 2, [[0, S.lt(body, 0.35)], [0.35, body], [1, S.dk(body, 0.45)]]), 1.2);
  c.strokeStyle = S.A(S.ink, 0.35); c.lineWidth = S.lw * 0.6; for (const f of [0.17, 0.5, 0.83].map((v) => (v + S.q.giro / 3) % 1)) { c.beginPath(); c.moveTo(bx, -h / 2 + f * h); c.lineTo(ex, -h / 2 + f * h); c.stroke(); }
  C(c, (c) => { c.moveTo(ex, -h / 2); c.lineTo(x0 + len, 0); c.lineTo(ex, h / 2); c.closePath(); }); FS(S, c, S.lt('#d9b98a', 0.3), 1.1);
  C(c, (c) => { c.moveTo(x0 + len - 0.045, -0.012); c.lineTo(x0 + len, 0); c.lineTo(x0 + len - 0.045, 0.012); c.closePath(); }); FS(S, c, S.ink, 0.6);
  return { punta: pt(x0 + len, 0), goma: pt(x0, 0), centro: pt(x0 + len / 2, 0) };
});
// ═════ 13. lámpara de mesa ═════
objeto('lampara_mesa', 'Lámpara de mesa articulada con pantalla y cono de luz que se enciende.', ['lampara', 'luz', 'mesa', 'escritorio'], {
  caja: [0.95, 1], relleno: 'accent', anclas: ['bombilla', 'base', 'codo', 'pantalla'], params: { cono: T.bool(true, 'dibuja el cono de luz') },
  partes: { brazo1: [0.55, 0, 1, 'inclinación del brazo inferior'], brazo2: [0.5, 0, 1, 'inclinación del brazo superior'], encendida: [1, 0, 1, 'intensidad de la luz'] }, estados: { apagada: { encendida: 0 } } },
(c, P, S) => {
  const a1 = -Math.PI / 2 + (S.q.brazo1 - 0.5) * 1.1 + 0.25, a2 = a1 + 1.5 + (S.q.brazo2 - 0.5) * 1.4, base = [-0.3, 0.44], j1 = [base[0] + Math.cos(a1) * 0.45, base[1] + Math.sin(a1) * 0.45], j2 = [j1[0] + Math.cos(a2) * 0.4, j1[1] + Math.sin(a2) * 0.4];
  const on = S.q.encendida, tilt = a2 + 0.5, shadeW = 0.16;
  C(c, (c) => c.ellipse(base[0], base[1], 0.17, 0.045, 0, 0, P2)); FS(S, c, S.dk(S.fill, 0.2), 1.2);
  c.lineCap = 'round'; for (const [p0, p1] of [[base, j1], [j1, j2]]) { c.strokeStyle = S.ink; c.lineWidth = S.lw * 4.6; c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.stroke(); c.strokeStyle = S.lt(S.fill, 0.2); c.lineWidth = S.lw * 3; c.stroke(); }
  c.fillStyle = S.ink; for (const j of [j1, j2, base]) { c.beginPath(); c.arc(j[0], j[1], S.lw * 3, 0, P2); c.fill(); }
  const bulb = [j2[0] + Math.cos(tilt) * 0.13, j2[1] + Math.sin(tilt) * 0.13];
  if (on > 0.02 && P.cono) { const l = 0.9, w = 0.5, ax = Math.cos(tilt), ay = Math.sin(tilt), nx = -ay, ny = ax, g = c.createLinearGradient(bulb[0], bulb[1], bulb[0] + ax * l, bulb[1] + ay * l); g.addColorStop(0, S.A(S.paper, 0.55 * on)); g.addColorStop(1, S.A(S.paper, 0)); c.fillStyle = g;
    c.beginPath(); c.moveTo(bulb[0] + nx * 0.05, bulb[1] + ny * 0.05); c.lineTo(bulb[0] + ax * l + nx * w, bulb[1] + ay * l + ny * w); c.lineTo(bulb[0] + ax * l - nx * w, bulb[1] + ay * l - ny * w); c.lineTo(bulb[0] - nx * 0.05, bulb[1] - ny * 0.05); c.closePath(); c.fill(); }
  c.save(); c.translate(j2[0], j2[1]); c.rotate(tilt - Math.PI / 2 + Math.PI); C(c, (c) => { c.moveTo(-0.04, 0); c.lineTo(-shadeW, 0.17); c.lineTo(shadeW, 0.17); c.lineTo(0.04, 0); c.closePath(); }); c.restore();
  c.save(); c.translate(j2[0], j2[1]); c.rotate(tilt - Math.PI / 2); C(c, (c) => { c.moveTo(-0.045, 0.0); c.lineTo(-shadeW, 0.17); c.lineTo(shadeW, 0.17); c.lineTo(0.045, 0.0); c.closePath(); }); FS(S, c, lg(c, -shadeW, 0, shadeW, 0, [[0, S.lt(S.fill, 0.25)], [1, S.dk(S.fill, 0.35)]]), 1.3);
  c.fillStyle = S.A(S.mix(S.paper, '#fff3c0', 0.5), 0.25 + 0.75 * on); c.beginPath(); c.arc(0, 0.17, 0.035, 0, P2); c.fill(); c.restore();
  return { bombilla: pt(bulb[0], bulb[1]), base: pt(base[0], base[1]), codo: pt(j1[0], j1[1]), pantalla: pt(j2[0], j2[1]) };
});
// ═════ 14. botella de vidrio con lastre ═════
objeto('botella_vidrio', 'Botella de vidrio con lastre de arena, tapón y mensaje enrollado; flota inclinada.', ['botella', 'vidrio', 'mensaje', 'mar'], {
  caja: [0.4, 1], relleno: 'accent2', anclas: ['boca', 'fondo', 'lastre', 'mensaje', 'centro'], params: { tinte: T.color('accent2', 'tinte del vidrio') },
  partes: { inclinacion: [0.3, -1, 1, 'inclinación al flotar'], lastre: [0.18, 0, 0.5, 'altura del lastre (arena) en el fondo'], tapon: [1, 0, 1, '1 = tapón puesto · 0 = fuera'], mensaje: [1, 0, 1, 'mensaje enrollado visible'], cabeceo: [0, 0, 1, 'cuánto cabecea con t'] }, estados: { destapada: { tapon: 0 }, vacia: { mensaje: 0, lastre: 0 } } },
(c, P, S) => {
  const ba = S.q.inclinacion * 0.9 + S.q.cabeceo * Math.sin(S.t * 1.6) * 0.1; c.rotate(ba); const glass = S.hex(P.tinte), body = { w: 0.17, top: -0.14, bot: 0.46 }, neck = { w: 0.05, top: -0.46 };
  const path = (c) => { c.moveTo(-neck.w, neck.top); c.lineTo(-neck.w, -0.3); c.bezierCurveTo(-neck.w, -0.2, -body.w, -0.22, -body.w, body.top); c.lineTo(-body.w, body.bot - 0.05); c.quadraticCurveTo(-body.w, body.bot, -body.w + 0.05, body.bot); c.lineTo(body.w - 0.05, body.bot); c.quadraticCurveTo(body.w, body.bot, body.w, body.bot - 0.05); c.lineTo(body.w, body.top); c.bezierCurveTo(body.w, -0.22, neck.w, -0.2, neck.w, -0.3); c.lineTo(neck.w, neck.top); c.closePath(); };
  c.save(); C(c, path); c.fillStyle = S.A(S.lt(glass, 0.5), 0.35); c.fill(); c.clip();
  const sy = body.bot - S.q.lastre; c.fillStyle = S.mix(S.paper, '#a58a5e', 0.6); c.fillRect(-0.3, sy, 0.6, 0.6);
  if (S.q.mensaje > 0.02) { c.save(); c.rotate(0.15); c.globalAlpha *= S.q.mensaje; C(c, (c) => rrect(c, -0.045, -0.1, 0.09, 0.36, 0.04)); FS(S, c, S.lt(S.paper, 0.1), 0.8); c.strokeStyle = S.A(S.ink, 0.5); c.lineWidth = S.lw * 0.5; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-0.03, -0.06 + i * 0.05); c.lineTo(0.03, -0.06 + i * 0.05); c.stroke(); } c.restore(); }
  c.restore(); C(c, path); c.strokeStyle = S.ink; c.lineWidth = S.lw * 1.3; c.lineJoin = 'round'; c.stroke();
  c.strokeStyle = S.A('#ffffff', 0.75); c.lineWidth = S.lw * 1.6; c.beginPath(); c.moveTo(-body.w * 0.6, body.top + 0.02); c.lineTo(-body.w * 0.6, body.bot - 0.12); c.stroke();
  const cy = neck.top - 0.07 - (1 - S.q.tapon) * 0.12; C(c, (c) => rrect(c, -neck.w - 0.01, cy, neck.w * 2 + 0.02, 0.09, 0.015)); FS(S, c, S.mix('#b88a5a', S.fill, 0.15), 1.1);
  return { boca: rp(ba, pt(0, neck.top)), fondo: rp(ba, pt(0, body.bot)), lastre: rp(ba, pt(0, sy + 0.04)), mensaje: rp(ba, pt(0.0, 0.08)), centro: rp(ba, pt(0, 0.05)) };
});
// ═════ 15. tarjeta postal ═════
objeto('tarjeta_postal', 'Tarjeta postal con costa por delante y renglones, sello y dirección por detrás.', ['postal', 'tarjeta', 'carta', 'correo'], {
  caja: [1, 0.66], relleno: 'paper', anclas: ['sello', 'centro', 'esquina', 'mensaje'], params: { texto: { type: 'string', def: 'BREAK THE BOTTLE', doc: 'línea de texto del reverso' } },
  partes: { giro: [1, 0, 1, '0 = anverso (paisaje) · 1 = reverso (texto); entre medias gira'], escrito: [1, 0, 1, 'texto escrito en el reverso'] }, estados: { anverso: { giro: 0 }, reverso: { giro: 1 } } },
(c, P, S) => {
  const g = S.q.giro, sx = Math.max(0.02, Math.abs(Math.cos(g * Math.PI))), back = g > 0.5 ? 1 : 0, w = 0.94, h = 0.62; c.scale(back ? sx : sx, 1); c.save();
  C(c, (c) => rrect(c, -w / 2, -h / 2, w, h, 0.02)); FS(S, c, S.lt(S.fill, 0.25), 1.3); c.clip();
  if (!g || !back) { const sky = lg(c, 0, -h / 2, 0, h / 2, [[0, S.lt(S.acc2, 0.6)], [0.55, S.lt(S.acc, 0.7)], [1, S.lt(S.acc2, 0.4)]]); c.fillStyle = sky; c.fillRect(-w / 2, -h / 2, w, h); c.fillStyle = S.A(S.acc, 0.8); c.beginPath(); c.arc(0.15, 0.02, 0.07, 0, P2); c.fill();
    c.fillStyle = S.A(S.dk(S.acc2, 0.5), 0.9); c.beginPath(); c.moveTo(-w / 2, 0.06); for (let x = -w / 2; x <= w / 2; x += 0.04) c.lineTo(x, 0.06 + 0.012 * Math.sin(x * 30)); c.lineTo(w / 2, h / 2); c.lineTo(-w / 2, h / 2); c.fill(); c.strokeStyle = S.A(S.paper, 0.7); c.lineWidth = S.lw * 1.6; c.strokeRect(-w / 2 + 0.04, -h / 2 + 0.04, w - 0.08, h - 0.08); }
  else { c.strokeStyle = S.A(S.ink, 0.5); c.lineWidth = S.lw * 0.8; c.beginPath(); c.moveTo(0.02, -h / 2 + 0.06); c.lineTo(0.02, h / 2 - 0.06); c.stroke();
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(0.08, -0.05 + i * 0.09); c.lineTo(w / 2 - 0.05, -0.05 + i * 0.09); c.stroke(); }
    c.strokeStyle = S.ink; c.lineWidth = S.lw * 1.2; const R = rng(2); for (let i = 0; i < 6; i++) { if (i / 6 > S.q.escrito) break; c.beginPath(); c.moveTo(-w / 2 + 0.06, -0.2 + i * 0.075); for (let x = 0; x < 0.3 + 0.1 * R(); x += 0.02) c.lineTo(-w / 2 + 0.06 + x, -0.2 + i * 0.075 + 0.01 * Math.sin(x * 70 + i)); c.stroke(); }
    c.fillStyle = S.ink; FT(S, c, P.texto, 0.08, -h / 2 + 0.1, 0.034, { align: 'left' });
    C(c, (c) => c.rect(w / 2 - 0.2, -h / 2 + 0.04, 0.16, 0.18)); c.strokeStyle = S.A(S.ink, 0.6); c.setLineDash([0.012, 0.01]); c.stroke(); c.setLineDash([]); c.fillStyle = S.A(S.acc, 0.55); c.fillRect(w / 2 - 0.185, -h / 2 + 0.055, 0.13, 0.15); }
  c.restore(); return { sello: pt(w / 2 - 0.12, -h / 2 + 0.13), centro: pt(0, 0), esquina: pt(w / 2, h / 2), mensaje: pt(-0.2, -0.1) };
});
// ═════ 16. moneda ═════
objeto('moneda', 'Moneda con canto, orla y emblema; gira sobre su eje y refleja la luz.', ['moneda', 'dinero', 'metal', 'precio'], {
  caja: [1, 1], relleno: 'accent2', anclas: ['borde', 'centro', 'emblema'], params: { simbolo: T.enu('estrella', 'emblema', ['estrella', 'cruz', 'numero', 'ancla']), texto: { type: 'string', def: '1', doc: 'cifra si el emblema es numero' } },
  partes: { giro: [0, 0, 1, 'vueltas sobre el eje vertical'], brillo: [0.4, 0, 1, 'reflejo'] }, estados: { canto: { giro: 0.25 } } },
(c, P, S) => {
  const sx = Math.abs(Math.cos(S.q.giro * P2)), r = 0.42, gold = S.mix(S.fill, '#c9a24a', 0.7); const w = Math.max(0.1, sx);
  c.save(); c.scale(w, 1); const edge = 0.05 * (1 - w);
  if (edge > 0.003) { C(c, (c) => { c.arc(0, 0, r + 0.03, 0, P2); }); FS(S, c, S.dk(gold, 0.5), 1); }
  C(c, (c) => c.arc(0, 0, r, 0, P2)); FS(S, c, lg(c, -r, -r, r, r, [[0, S.lt(gold, 0.35 + 0.4 * S.q.brillo)], [0.5, gold], [1, S.dk(gold, 0.35)]]), 1.4);
  C(c, (c) => c.arc(0, 0, r * 0.86, 0, P2)); c.strokeStyle = S.A(S.ink, 0.6); c.lineWidth = S.lw * 0.8; c.stroke();
  c.fillStyle = S.A(S.ink, 0.7); c.strokeStyle = S.A(S.ink, 0.7); c.lineWidth = S.lw;
  if (P.simbolo === 'estrella') { c.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * P2 - Math.PI / 2, q = i % 2 ? r * 0.2 : r * 0.5; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); c.fill(); }
  else if (P.simbolo === 'cruz') { c.fillRect(-r * 0.08, -r * 0.5, r * 0.16, r); c.fillRect(-r * 0.4, -r * 0.1, r * 0.8, r * 0.16); }
  else if (P.simbolo === 'ancla') { c.beginPath(); c.moveTo(0, -r * 0.5); c.lineTo(0, r * 0.45); c.moveTo(-r * 0.3, -r * 0.25); c.lineTo(r * 0.3, -r * 0.25); c.moveTo(-r * 0.4, r * 0.15); c.quadraticCurveTo(0, r * 0.7, r * 0.4, r * 0.15); c.stroke(); }
  else { FT(S, c, P.texto, 0, 0, r * 0.9); }
  c.restore(); return { borde: pt(r * w, 0), centro: pt(0, 0), emblema: pt(0, 0) };
});
// ═════ 17. sobre con sello ═════
objeto('sobre_sello', 'Sobre con solapa que se abre, sello de correos con matasellos y dirección.', ['sobre', 'carta', 'correo', 'sello'], {
  caja: [1, 0.68], relleno: 'paper', anclas: ['sello', 'solapa', 'centro', 'direccion'], params: { matasellos: T.bool(true, 'círculo de matasellos sobre el sello') },
  partes: { abierto: [0, 0, 1, 'apertura de la solapa'], carta: [0, 0, 1, 'carta que asoma'] }, estados: { abierto: { abierto: 1, carta: 0.8 } } },
(c, P, S) => {
  const w = 0.96, h = 0.62, x0 = -w / 2, y0 = -h / 2 + 0.03, op = S.q.abierto;
  if (S.q.carta > 0.02) { C(c, (c) => rrect(c, x0 + 0.06, y0 - 0.2 * S.q.carta, w - 0.12, h * 0.8, 0.01)); FS(S, c, S.lt(S.paper, 0.3), 1); c.strokeStyle = S.A(S.ink, 0.3); c.lineWidth = S.lw * 0.6; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x0 + 0.12, y0 - 0.2 * S.q.carta + 0.07 + i * 0.05); c.lineTo(-x0 - 0.12, y0 - 0.2 * S.q.carta + 0.07 + i * 0.05); c.stroke(); } }
  C(c, (c) => rrect(c, x0, y0, w, h, 0.012)); FS(S, c, S.lt(S.fill, 0.1), 1.3);
  C(c, (c) => { c.moveTo(x0, y0 + h); c.lineTo(0, y0 + h * 0.42); c.lineTo(-x0, y0 + h); }); c.strokeStyle = S.A(S.ink, 0.5); c.lineWidth = S.lw * 0.8; c.stroke();
  const fl = op * 2 - 1; C(c, (c) => { c.moveTo(x0, y0); c.lineTo(0, y0 + h * 0.55 * -fl); c.lineTo(-x0, y0); c.closePath(); }); FS(S, c, op > 0.5 ? S.dk(S.fill, 0.12) : S.lt(S.fill, 0.05), 1.2);
  c.strokeStyle = S.A(S.ink, 0.45); c.lineWidth = S.lw * 0.7; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-0.15, y0 + h * 0.62 + i * 0.045); c.lineTo(0.2 - i * 0.04, y0 + h * 0.62 + i * 0.045); c.stroke(); }
  const sx = -x0 - 0.2, sy = y0 + 0.05; C(c, (c) => c.rect(sx, sy, 0.14, 0.17)); c.save(); c.setLineDash([0.012, 0.008]); FS(S, c, S.mix(S.acc, S.paper, 0.2), 1); c.setLineDash([]); c.restore();
  c.fillStyle = S.A(S.paper, 0.6); c.beginPath(); c.arc(sx + 0.07, sy + 0.07, 0.035, 0, P2); c.fill();
  if (P.matasellos) { c.strokeStyle = S.A(S.ink, 0.75); c.lineWidth = S.lw; c.beginPath(); c.arc(sx + 0.02, sy + 0.1, 0.09, 0, P2); c.stroke(); for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(sx - 0.2, sy + 0.04 + i * 0.03); c.lineTo(sx - 0.07, sy + 0.04 + i * 0.03); c.stroke(); } }
  return { sello: pt(sx + 0.07, sy + 0.085), solapa: pt(0, y0 + h * 0.55 * -fl), centro: pt(0, 0), direccion: pt(0.0, y0 + h * 0.72) };
});
// ═════ 18. red de pesca ═════
objeto('red_pesca', 'Red de malla en rombos que cuelga de una soga con flotadores y se tensa.', ['red', 'pesca', 'mar', 'malla'], {
  caja: [1, 0.8], relleno: 'accent2', anclas: ['soga', 'centro', 'fondo', 'flotador'], params: { malla: { type: 'int', def: 12, doc: 'rombos a lo ancho', min: 4, max: 30 }, filas: { type: 'int', def: 9, doc: 'filas de malla', min: 3, max: 20 } },
  partes: { tension: [0.4, 0, 1, '0 = cae colgante · 1 = estirada'], ondeo: [0.3, 0, 1, 'cuánto ondea con t'], captura: [0, 0, 1, 'bulto de la captura en el centro'] }, estados: { tensa: { tension: 1 }, cargada: { captura: 1 } } },
(c, P, S) => {
  const n = P.malla, m = P.filas, W = 0.94, top = -0.3, Hh = 0.62, T0 = S.q.tension, node = (i, j) => { const u = i / n, v = j / (m - 1), sag = (1 - T0) * 0.14 * Math.sin(u * Math.PI) * (v + 0.2), wave = S.q.ondeo * 0.03 * Math.sin(S.t * 1.7 + u * 6 + v * 3) * v, belly = S.q.captura * 0.2 * Math.sin(u * Math.PI) ** 2 * v * v, narrow = 1 - 0.18 * v * (1 - T0);
    return [(u - 0.5) * W * narrow + (j % 2 ? W / n / 2 * narrow : 0) * 0, top + v * Hh * (0.75 + 0.25 * T0) + sag + wave + belly]; };
  c.strokeStyle = S.A(S.ink, 0.9); c.lineWidth = S.lw * 0.8; c.lineCap = 'round';
  for (let j = 0; j < m - 1; j++) for (let i = 0; i < n; i++) { const a = node(i, j), b = node(i + 1, j + 1), d = node(i + 1, j), e = node(i, j + 1); c.globalAlpha *= 1; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.moveTo(d[0], d[1]); c.lineTo(e[0], e[1]); c.stroke(); }
  c.strokeStyle = S.ink; c.lineWidth = S.lw * 2.2; c.beginPath(); for (let i = 0; i <= n; i++) { const p = node(i, 0); i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); } c.stroke();
  for (let i = 1; i < n; i += 2) { const p = node(i, 0); C(c, (c) => c.ellipse(p[0], p[1] - 0.012, 0.022, 0.016, 0, 0, P2)); FS(S, c, i % 4 === 1 ? S.acc : S.lt(S.paper, 0.1), 0.8); }
  const mid = node(Math.round(n / 2), Math.round(m / 2)); return { soga: pt(0, node(Math.round(n / 2), 0)[1]), centro: pt(mid[0], mid[1]), fondo: pt(0, node(Math.round(n / 2), m - 1)[1]), flotador: pt(node(1, 0)[0], node(1, 0)[1]) };
});
// ═════ 19. mapa costero ═════
objeto('mapa_costero', 'Mapa de costa con mar rayado, rosa de los vientos, ruta punteada y cruz.', ['mapa', 'costa', 'ruta', 'mar'], {
  caja: [1, 0.74], relleno: 'paper', anclas: ['cruz', 'norte', 'rutaFin', 'puerto'], params: { semilla: { type: 'int', def: 3, doc: 'forma de la costa', min: 0, max: 9999 }, cuadricula: T.bool(true, 'meridianos y paralelos') },
  partes: { ruta: [1, 0, 1, 'tramo de la ruta dibujado'], marca: [1, 0, 1, 'cruz de destino visible'] }, estados: { sin_ruta: { ruta: 0, marca: 0 } } },
(c, P, S) => {
  const w = 0.96, h = 0.7, x0 = -w / 2, y0 = -h / 2, R = rng(P.semilla * 977 + 11);
  c.save(); C(c, (c) => rrect(c, x0, y0, w, h, 0.01)); FS(S, c, S.lt(S.fill, 0.2), 1.3); c.clip();
  if (P.cuadricula) { c.strokeStyle = S.A(S.acc2, 0.25); c.lineWidth = S.lw * 0.5; for (let i = 1; i < 8; i++) { c.beginPath(); c.moveTo(x0 + (w * i) / 8, y0); c.lineTo(x0 + (w * i) / 8, y0 + h); c.stroke(); } for (let j = 1; j < 5; j++) { c.beginPath(); c.moveTo(x0, y0 + (h * j) / 5); c.lineTo(x0 + w, y0 + (h * j) / 5); c.stroke(); } }
  const coast = []; let y = y0 - 0.02, xm = 0.1; for (let i = 0; i <= 26; i++) { const u = i / 26; xm += (R() - 0.5) * 0.08; xm = clamp(xm, -0.15, 0.25); coast.push([x0 + (0.34 + xm + 0.1 * Math.sin(u * 5 + P.semilla)) * w * 0.9, y0 + u * h]); }
  c.fillStyle = S.A(S.mix(S.fill, S.acc, 0.12), 1); c.beginPath(); c.moveTo(x0, y0); coast.forEach(([x, yy]) => c.lineTo(x, yy)); c.lineTo(x0, y0 + h); c.closePath(); c.fill(); c.strokeStyle = S.ink; c.lineWidth = S.lw * 1.4; c.beginPath(); coast.forEach(([x, yy], i) => (i ? c.lineTo(x, yy) : c.moveTo(x, yy))); c.stroke();
  c.strokeStyle = S.A(S.acc2, 0.5); c.lineWidth = S.lw * 0.6; for (let k = 1; k <= 3; k++) { c.beginPath(); coast.forEach(([x, yy], i) => (i ? c.lineTo(x + k * 0.03, yy) : c.moveTo(x + k * 0.03, yy))); c.stroke(); }
  c.strokeStyle = S.A(S.acc2, 0.3); c.lineWidth = S.lw * 0.5; for (let i = 0; i < 40; i++) { const yy = y0 + R() * h, xx = x0 + w * (0.5 + 0.5 * R()); c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + 0.05, yy + 0.01); c.stroke(); }
  const end = [x0 + w * 0.62, y0 + h * 0.5], st = [coast[10][0] + 0.02, coast[10][1]]; c.setLineDash([0.014, 0.012]); c.strokeStyle = S.acc; c.lineWidth = S.lw * 1.4; c.beginPath(); c.moveTo(st[0], st[1]); const nn = 30 * S.q.ruta; for (let i = 1; i <= nn; i++) { const u = i / 30; c.lineTo(lerp(st[0], end[0], u) + 0.05 * Math.sin(u * 7), lerp(st[1], end[1], u) + 0.07 * Math.sin(u * 4.4)); } c.stroke(); c.setLineDash([]);
  if (S.q.marca > 0.02) { c.strokeStyle = S.acc; c.lineWidth = S.lw * 2.2; const s = 0.03 * S.q.marca; c.beginPath(); c.moveTo(end[0] - s, end[1] - s); c.lineTo(end[0] + s, end[1] + s); c.moveTo(end[0] + s, end[1] - s); c.lineTo(end[0] - s, end[1] + s); c.stroke(); }
  const rx = x0 + w - 0.12, ry = y0 + 0.12; c.strokeStyle = S.ink; c.lineWidth = S.lw; c.beginPath(); c.arc(rx, ry, 0.06, 0, P2); c.stroke(); c.fillStyle = S.ink; c.beginPath(); c.moveTo(rx, ry - 0.09); c.lineTo(rx + 0.018, ry); c.lineTo(rx - 0.018, ry); c.fill(); c.beginPath(); c.moveTo(rx, ry + 0.07); c.lineTo(rx + 0.012, ry); c.lineTo(rx - 0.012, ry); c.stroke();
  c.restore(); return { cruz: pt(end[0], end[1]), norte: pt(rx, ry - 0.09), rutaFin: pt(end[0], end[1]), puerto: pt(st[0], st[1]) };
});
// ═════ 20. reloj ═════
objeto('reloj', 'Reloj de pared redondo con números, agujas de hora, minuto y segundero.', ['reloj', 'tiempo', 'hora', 'pared'], {
  caja: [1, 1], relleno: 'paper', anclas: ['centro', 'agujaHora', 'agujaMinuto', 'doce'], params: { numeros: T.bool(true, 'números en la esfera'), segundero: T.bool(true, 'segundero') },
  partes: { hora: [10.1, 0, 12, 'hora (decimal: 3.5 = 3:30)'], segundos: [0, 0, 60, 'segundero'], tic: [0, 0, 1, 'el segundero avanza a saltos con t'] }, estados: { tres: { hora: 3 } } },
(c, P, S) => {
  const r = 0.46, hh = S.q.hora, mm = (hh % 1) * 60, ss = S.q.tic ? Math.floor(S.t) % 60 : S.q.segundos;
  C(c, (c) => c.arc(0, 0, r + 0.025, 0, P2)); FS(S, c, S.dk(S.mix(S.fill, S.ink, 0.5), 0.1), 1.4); C(c, (c) => c.arc(0, 0, r, 0, P2)); FS(S, c, S.lt(S.fill, 0.5), 1.1);
  for (let i = 0; i < 60; i++) { const a = (i / 60) * P2 - Math.PI / 2, big = i % 5 === 0, l = big ? 0.05 : 0.02; c.strokeStyle = S.ink; c.lineWidth = S.lw * (big ? 1.5 : 0.6); c.beginPath(); c.moveTo(Math.cos(a) * (r - 0.02), Math.sin(a) * (r - 0.02)); c.lineTo(Math.cos(a) * (r - 0.02 - l), Math.sin(a) * (r - 0.02 - l)); c.stroke(); }
  if (P.numeros) { c.fillStyle = S.ink; for (let i = 1; i <= 12; i++) { const a = (i / 12) * P2 - Math.PI / 2; FT(S, c, i, Math.cos(a) * (r - 0.115), Math.sin(a) * (r - 0.115), 0.062); } }
  const hand = (ang, len, w2, col) => { const a = ang * P2 - Math.PI / 2; c.strokeStyle = col; c.lineWidth = S.lw * w2; c.lineCap = 'round'; c.beginPath(); c.moveTo(-Math.cos(a) * len * 0.12, -Math.sin(a) * len * 0.12); c.lineTo(Math.cos(a) * len, Math.sin(a) * len); c.stroke(); return pt(Math.cos(a) * len, Math.sin(a) * len); };
  const ph = hand((hh % 12) / 12, r * 0.5, 3.2, S.ink), pm = hand(mm / 60, r * 0.76, 2.2, S.ink); if (P.segundero) hand(ss / 60, r * 0.82, 1, S.acc);
  c.fillStyle = S.ink; c.beginPath(); c.arc(0, 0, 0.018, 0, P2); c.fill(); return { centro: pt(0, 0), agujaHora: ph, agujaMinuto: pm, doce: pt(0, -r) };
});
// ═════ 21. mano esquemática ═════
objeto('mano', 'Mano esquemática de dedos articulados: abierta, puño, señalando o en pinza.', ['mano', 'gesto', 'persona', 'custodio'], {
  caja: [0.9, 1], relleno: 'paper', anclas: ['puntaIndice', 'puntaPulgar', 'palma', 'muneca'], params: {},
  partes: { pulgar: [0.2, 0, 1, 'flexión del pulgar'], indice: [0, 0, 1, 'flexión del índice'], corazon: [0, 0, 1, 'flexión del corazón'], anular: [0, 0, 1, 'flexión del anular'], menique: [0, 0, 1, 'flexión del meñique'] },
  estados: { abierta: {}, puno: { pulgar: 0.8, indice: 1, corazon: 1, anular: 1, menique: 1 }, senala: { pulgar: 0.4, corazon: 1, anular: 1, menique: 1 }, pinza: { pulgar: 0.55, indice: 0.55, corazon: 0.15, anular: 0.1, menique: 0.1 } } },
(c, P, S) => {
  const skin = S.lt(S.fill, 0.1), fing = [['menique', -0.17, 0.22, 0.2], ['anular', -0.085, 0.27, 0.22], ['corazon', 0.0, 0.3, 0.24], ['indice', 0.085, 0.27, 0.22]], tips = {};
  const finger = (x0, y0, ang, segs, flex, wd) => { let x = x0, y = y0, a = ang, pts = [[x, y]]; segs.forEach((l, i) => { a += flex * (1.1 + 0.25 * i) * (ang < -1 ? -1 : 1) * 1; x += Math.cos(a) * l; y += Math.sin(a) * l; pts.push([x, y]); });
    for (const [col, ww] of [[S.ink, wd + S.lw * 2.4], [skin, wd]]) { c.strokeStyle = col; c.lineWidth = ww; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.stroke(); } return pts[pts.length - 1]; };
  C(c, (c) => { c.moveTo(-0.21, 0.02); c.lineTo(-0.2, 0.3); c.quadraticCurveTo(-0.12, 0.44, 0, 0.44); c.quadraticCurveTo(0.12, 0.44, 0.17, 0.3); c.lineTo(0.2, 0.02); c.closePath(); }); FS(S, c, skin, 1.3);
  for (const [name, x, y, l] of fing) tips[name] = finger(x, 0.04, -Math.PI / 2 + (x < 0 ? 0.05 : x > 0.05 ? -0.05 : 0), [l * 0.42, l * 0.33, l * 0.25], S.q[name] * 0.95, 0.062);
  tips.pulgar = finger(0.2, 0.26, -0.5 - 0.0, [0.14, 0.12], -S.q.pulgar * 0.9 + 0.0, 0.07);
  return { puntaIndice: tips.indice, puntaPulgar: tips.pulgar, palma: pt(0, 0.2), muneca: pt(0, 0.44) };
});
// ═════ 22. puerta ═════
objeto('puerta', 'Puerta con marco, paneles y picaporte que gira sobre sus bisagras dejando pasar luz.', ['puerta', 'umbral', 'entrada', 'arquitectura'], {
  caja: [0.56, 1], relleno: 'shade', anclas: ['picaporte', 'bisagra', 'umbral', 'rendija'], params: { paneles: { type: 'int', def: 4, doc: 'paneles de la hoja', min: 0, max: 6 } },
  partes: { apertura: [0, 0, 1, 'giro de la hoja'], luz: [0.8, 0, 1, 'luz que sale por el hueco'] }, estados: { entreabierta: { apertura: 0.35 }, abierta: { apertura: 0.85 } } },
(c, P, S) => {
  const w = 0.44, h = 0.92, x0 = -w / 2, y0 = -h / 2, op = S.q.apertura, wood = S.fill;
  C(c, (c) => c.rect(x0, y0, w, h)); FS(S, c, S.mix(S.A(S.paper, 0.8) && S.lt(S.paper, 0.1), S.acc, 0.1 * op), 1.2);
  if (op > 0.02) { const g = c.createLinearGradient(x0, 0, x0 + w, 0); g.addColorStop(0, S.A(S.paper, 0.9 * S.q.luz * op)); g.addColorStop(1, S.A(S.paper, 0.2 * S.q.luz * op)); c.fillStyle = g; c.fillRect(x0 + 0.005, y0 + 0.005, w - 0.01, h - 0.01); }
  const wd = w * Math.max(0.12, Math.cos(op * 1.35)), sk = 0.16 * op * h * 0.2; C(c, (c) => { c.moveTo(x0, y0); c.lineTo(x0 + wd, y0 + sk); c.lineTo(x0 + wd, y0 + h - sk); c.lineTo(x0, y0 + h); c.closePath(); }); FS(S, c, lg(c, x0, 0, x0 + wd, 0, [[0, S.dk(wood, 0.15)], [1, S.dk(wood, 0.35 * (1 - op * 0.3))]]), 1.4);
  c.strokeStyle = S.A(S.ink, 0.5); c.lineWidth = S.lw * 0.8; for (let i = 0; i < P.paneles; i++) { const col = i % 2, row = Math.floor(i / 2), px = x0 + wd * (0.14 + col * 0.44), pw = wd * 0.34, py = y0 + h * (0.08 + row * 0.3) + sk, ph = h * 0.24; if (P.paneles <= 2) { c.strokeRect(x0 + wd * 0.14, y0 + h * (0.1 + i * 0.45) + sk, wd * 0.72, h * 0.35); continue; } c.strokeRect(px, py, pw, ph); }
  c.fillStyle = S.lt(S.fill, 0.6); c.strokeStyle = S.ink; c.lineWidth = S.lw; c.beginPath(); c.arc(x0 + wd * 0.88, 0.04, 0.022, 0, P2); c.fill(); c.stroke();
  return { picaporte: pt(x0 + wd * 0.88, 0.04), bisagra: pt(x0, 0), umbral: pt(0, y0 + h), rendija: pt(x0 + w - 0.02, 0) };
});
// ═════ 23. ventana ═════
objeto('ventana', 'Ventana de cuarterones con alféizar, hojas que se abren y luz de fuera.', ['ventana', 'luz', 'casa', 'arquitectura'], {
  caja: [0.8, 1], relleno: 'shade', anclas: ['picaporte', 'alfeizar', 'centro', 'cristal'], params: { columnas: { type: 'int', def: 2, doc: 'cuarterones a lo ancho', min: 1, max: 4 }, filas: { type: 'int', def: 3, doc: 'cuarterones a lo alto', min: 1, max: 5 } },
  partes: { abierta: [0, 0, 1, 'apertura de las hojas'], luz: [0.7, 0, 1, 'claridad del cristal'], cielo: [0.5, 0, 1, 'tono del cielo: 0 noche · 1 día'] }, estados: { abierta: { abierta: 0.8 }, noche: { cielo: 0, luz: 0.3 } } },
(c, P, S) => {
  const w = 0.66, h = 0.84, x0 = -w / 2, y0 = -h / 2 - 0.03, op = S.q.abierta;
  C(c, (c) => rrect(c, x0 - 0.04, y0 - 0.04, w + 0.08, h + 0.08, 0.01)); FS(S, c, S.dk(S.fill, 0.15), 1.3);
  c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip(); c.fillStyle = lg(c, 0, y0, 0, y0 + h, [[0, S.mix(S.dk(S.acc2, 0.6), S.lt(S.acc2, 0.5), S.q.cielo)], [1, S.mix(S.dk(S.acc, 0.5), S.lt(S.paper, 0.1), S.q.cielo)]]); c.fillRect(x0, y0, w, h); c.fillStyle = S.A('#ffffff', 0.25 * S.q.luz * S.q.cielo); c.fillRect(x0, y0, w * 0.5, h); c.restore();
  const hojaW = (w / 2) * (1 - 0.8 * op); for (const side of [-1, 1]) { const hx = side < 0 ? x0 : x0 + w - hojaW; C(c, (c) => c.rect(hx, y0, hojaW, h)); c.strokeStyle = S.ink; c.lineWidth = S.lw * 1.2; c.stroke();
    c.strokeStyle = S.ink; c.lineWidth = S.lw * 0.9; const cols = Math.max(1, Math.round(P.columnas / 2)); for (let i = 1; i < cols; i++) { c.beginPath(); c.moveTo(hx + (hojaW * i) / cols, y0); c.lineTo(hx + (hojaW * i) / cols, y0 + h); c.stroke(); } for (let j = 1; j < P.filas; j++) { c.beginPath(); c.moveTo(hx, y0 + (h * j) / P.filas); c.lineTo(hx + hojaW, y0 + (h * j) / P.filas); c.stroke(); } }
  C(c, (c) => rrect(c, x0 - 0.07, y0 + h + 0.035, w + 0.14, 0.04, 0.01)); FS(S, c, S.lt(S.fill, 0.15), 1.2); c.fillStyle = S.ink; c.beginPath(); c.arc(0, 0, 0.014, 0, P2); c.fill();
  return { picaporte: pt(0, 0), alfeizar: pt(0, y0 + h + 0.055), centro: pt(0, y0 + h / 2), cristal: pt(x0 + 0.1, y0 + 0.1) };
});
// ═════ 24. mesa ═════
objeto('mesa', 'Mesa de tablero grueso y cuatro patas en alzado frontal, con mantel opcional.', ['mesa', 'mueble', 'oficina', 'escritorio'], {
  caja: [1, 0.64], relleno: 'accent', anclas: ['superficie', 'centro', 'pataIzq', 'pataDer'], params: { cajon: T.bool(false, 'cajón bajo el tablero') },
  partes: { mantel: [0, 0, 1, 'mantel que cuelga'], vuelo: [0.5, 0, 1, 'grosor visible del tablero'] }, estados: { puesta: { mantel: 1 } } },
(c, P, S) => {
  const w = 0.96, top = -0.14, th = 0.05 + 0.04 * S.q.vuelo, wood = S.mix(S.fill, '#8a6034', 0.5), lw = 0.05;
  for (const sx of [-1, 1]) { C(c, (c) => c.rect(sx * (w / 2 - 0.1) - lw / 2, top + th, lw, 0.42)); FS(S, c, S.dk(wood, 0.3), 1.2); C(c, (c) => c.rect(sx * (w / 2 - 0.2) - lw / 3, top + th, lw / 1.5, 0.36)); FS(S, c, S.dk(wood, 0.5), 1); }
  if (P.cajon) { C(c, (c) => rrect(c, -0.2, top + th, 0.4, 0.09, 0.01)); FS(S, c, S.dk(wood, 0.1), 1.1); c.fillStyle = S.ink; c.fillRect(-0.025, top + th + 0.04, 0.05, 0.012); }
  C(c, (c) => rrect(c, -w / 2, top, w, th, 0.01)); FS(S, c, lg(c, 0, top, 0, top + th, [[0, S.lt(wood, 0.35)], [1, S.dk(wood, 0.2)]]), 1.3);
  if (S.q.mantel > 0.02) { const dr = 0.28 * S.q.mantel; C(c, (c) => { c.moveTo(-w / 2 - 0.01, top); c.lineTo(w / 2 + 0.01, top); c.lineTo(w / 2 + 0.01, top + th + dr); for (let i = 12; i >= 0; i--) c.lineTo(lerp(-w / 2 - 0.01, w / 2 + 0.01, i / 12), top + th + dr + (i % 2 ? 0.02 : -0.01)); c.closePath(); }); FS(S, c, S.A(S.lt(S.paper, 0.1), 0.95), 1.1); }
  return { superficie: pt(0, top), centro: pt(0, 0.0), pataIzq: pt(-w / 2 + 0.1, 0.3), pataDer: pt(w / 2 - 0.1, 0.3) };
});
// ═════ 25. libro ═════
objeto('libro', 'Libro cerrado o abierto con tapas, lomo, páginas con texto y página que pasa.', ['libro', 'lectura', 'conocimiento', 'registro'], {
  caja: [1, 0.76], relleno: 'accent', anclas: ['lomo', 'paginaDer', 'paginaIzq', 'centro'], params: { titulo: { type: 'string', def: 'ACTA', doc: 'título en la portada' } },
  partes: { apertura: [0, 0, 1, '0 = cerrado · 1 = abierto'], pagina: [0, 0, 1, 'página que se pasa'], escrito: [1, 0, 1, 'texto en las páginas'] }, estados: { abierto: { apertura: 1 }, pasando: { apertura: 1, pagina: 0.5 } } },
(c, P, S) => {
  const op = S.q.apertura, cover = S.fill;
  if (op < 0.5) { const w = 0.56, h = 0.72, k = 1 - op * 0.9; c.save(); c.scale(k + 0.1, 1);
    C(c, (c) => rrect(c, -w / 2, -h / 2, w, h, 0.02)); FS(S, c, lg(c, -w / 2, 0, w / 2, 0, [[0, S.dk(cover, 0.4)], [0.1, cover], [1, S.dk(cover, 0.2)]]), 1.4); C(c, (c) => c.rect(-w / 2, -h / 2, 0.05, h)); FS(S, c, S.dk(cover, 0.45), 1);
    c.strokeStyle = S.A(S.paper, 0.7); c.lineWidth = S.lw; c.strokeRect(-w / 2 + 0.1, -h / 2 + 0.08, w - 0.18, h - 0.16); c.fillStyle = S.A(S.paper, 0.9); FT(S, c, P.titulo, 0.02, -0.04, 0.07); c.restore();
    return { lomo: pt(-w / 2 * (k + 0.1), 0), paginaDer: pt(w / 2 * (k + 0.1), 0), paginaIzq: pt(-w / 2, 0), centro: pt(0, 0) };
  }
  const w = 0.5, h = 0.66, R = rng(4); C(c, (c) => rrect(c, -w - 0.03, -h / 2 - 0.03, 2 * w + 0.06, h + 0.06, 0.02)); FS(S, c, S.dk(cover, 0.3), 1.4);
  for (const s of [-1, 1]) { C(c, (c) => { c.moveTo(0, -h / 2); c.quadraticCurveTo(s * w * 0.5, -h / 2 - 0.02, s * w, -h / 2 + 0.01); c.lineTo(s * w, h / 2); c.quadraticCurveTo(s * w * 0.5, h / 2 - 0.01, 0, h / 2); c.closePath(); }); FS(S, c, S.lt(S.paper, 0.1), 1.1);
    c.strokeStyle = S.A(S.ink, 0.65); c.lineWidth = S.lw * 0.9; for (let i = 0; i < 12; i++) { if (i / 12 > S.q.escrito) break; const y = -h / 2 + 0.07 + i * (h - 0.14) / 11; c.beginPath(); c.moveTo(s * 0.06, y); c.lineTo(s * (0.06 + (w - 0.14) * (0.6 + 0.4 * R())), y); c.stroke(); } }
  if (S.q.pagina > 0.02 && S.q.pagina < 0.98) { const u = S.q.pagina, wd = w * Math.cos(u * Math.PI), sk = Math.sin(u * Math.PI) * 0.04; C(c, (c) => { c.moveTo(0, -h / 2); c.quadraticCurveTo(wd * 0.5, -h / 2 - sk * 2, wd, -h / 2 + sk); c.lineTo(wd, h / 2 + sk); c.quadraticCurveTo(wd * 0.5, h / 2 - sk * 2, 0, h / 2); c.closePath(); }); FS(S, c, S.lt(S.paper, 0.2), 1.1); }
  return { lomo: pt(0, 0), paginaDer: pt(w / 2, 0), paginaIzq: pt(-w / 2, 0), centro: pt(0, 0) };
});

// ── meta uniforme ──
export const metaObjeto = (o) => ({ id: o.id, kind: 'objeto', resumen: o.resumen, tags: o.tags, params: [...paramMeta(o.params), ...Object.entries(o.partes).map(([name, d]) => ({ name: `partes.${name}`, type: `num[${d.min},${d.max}]`, def: d.def }))], anclas: o.anclas, estados: Object.keys(o.estados) });
export const META = Object.values(OBJETOS).map((o) => ({ id: o.id, resumen: o.resumen, tags: o.tags, params: { ...paramsTB(o.params), ...Object.fromEntries(Object.keys(o.partes).map((k) => ['partes.' + k, 'number'])), estado: 'string' }, cuando: `objeto ancla con anclas ${o.anclas.join(', ')} y estados ${Object.keys(o.estados).join(', ')}`, ejemplo: `{"type":"objeto","objeto":"${o.id}","x":640,"y":360,"size":300}` }));
export const META_OBJETOS = Object.values(OBJETOS).map(metaObjeto);

// ── validación de los literales de un objeto (los {$expr} del DSL se comprueban aparte) ──
export const OBJ_KEYS = ['objeto', 'x', 'y', 'size', 'rot', 'estado', 'partes', 'params', 'color', 'relleno', 'acento', 'flip', 'alfa', 'label'];
const isExpr = (v) => v && typeof v === 'object' && !Array.isArray(v) && '$expr' in v;
export function validateObjeto(o, path, E) {
  const def = OBJETOS[o.objeto]; if (!def) { E(`${path}/objeto`, `objeto desconocido "${o.objeto}"`, hint(String(o.objeto), Object.keys(OBJETOS))); return; }
  for (const [k, v] of Object.entries(o.params ?? {})) { const d = def.params[k]; if (!d) { E(`${path}/params/${k}`, `param desconocido "${k}" en ${def.id}`, hint(k, Object.keys(def.params))); continue; } if (isExpr(v)) continue;
    const bad = d.type === 'int' ? !(Number.isInteger(v) && v >= d.min && v <= d.max) : d.type === 'num' ? !(typeof v === 'number' && v >= d.min && v <= d.max) : d.type === 'bool' ? typeof v !== 'boolean' : d.type === 'enum' ? !d.opts.includes(v) : d.type === 'string' ? typeof v !== 'string' : false;
    if (bad) E(`${path}/params/${k}`, `valor no válido para "${k}"`, d.type === 'enum' ? `uno de: ${d.opts.join(' ')}` : `${d.type}${d.min != null ? ` en [${d.min}, ${d.max}]` : ''}`); }
  for (const [k, v] of Object.entries(o.partes ?? {})) { const d = def.partes[k]; if (!d) { E(`${path}/partes/${k}`, `parte desconocida "${k}" en ${def.id}`, hint(k, Object.keys(def.partes))); continue; } if (!isExpr(v) && !(typeof v === 'number' && v >= d.min && v <= d.max)) E(`${path}/partes/${k}`, `valor no válido para "${k}"`, `número en [${d.min}, ${d.max}]`); }
  const es = o.estado; if (es != null && !isExpr(es)) { const names = Object.keys(def.estados), ok = (s) => typeof s === 'string' && names.includes(s);
    if (typeof es === 'string') { if (!ok(es)) E(`${path}/estado`, `estado desconocido "${es}" en ${def.id}`, hint(es, names)); } else if (Array.isArray(es) && es.length === 3) { if (!ok(es[0]) || !ok(es[1])) E(`${path}/estado`, `estado desconocido en ${JSON.stringify(es.slice(0, 2))}`, hint(String(ok(es[0]) ? es[1] : es[0]), names)); } else E(`${path}/estado`, 'estado: nombre o [a, b, u]', `estados de ${def.id}: ${names.join(' ')}`); }
}

// ── pintado ──
export function drawObjeto(ctx, id, o, E) {
  const def = OBJETOS[id]; if (!def) throw new Error(`objeto desconocido "${id}" — ${hint(id, Object.keys(OBJETOS))}`);
  const P = {}; for (const [k, d] of Object.entries(def.params)) P[k] = o.params?.[k] !== undefined ? o.params[k] : d.def;
  const stateVals = (n) => ({ ...(def.estados[n] ?? (() => { throw new Error(`estado desconocido "${n}" en ${id} — ${hint(n, Object.keys(def.estados))}`); })()) });
  const es = o.estado == null ? {} : Array.isArray(o.estado) ? (() => { const a = stateVals(o.estado[0]), b = stateVals(o.estado[1]), u = clamp(o.estado[2]), r = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) r[k] = lerp(a[k] ?? def.partes[k].def, b[k] ?? def.partes[k].def, u); return r; })() : stateVals(o.estado);
  const q = {}; for (const [k, d] of Object.entries(def.partes)) q[k] = clamp(o.partes?.[k] ?? es[k] ?? d.def, d.min, d.max);
  const col = (E._col ??= makeColor(E.pal)), k = E.k ?? 1, size = o.size, sx = size * (o.flip ? -1 : 1), rot = o.rot ?? 0;
  const S = { ink: col.hex(o.color ?? 'ink'), fill: col.hex(o.relleno ?? def.relleno), acc: col.hex(o.acento ?? 'accent'), acc2: col.hex('accent2'), paper: col.hex('paper'), shade: col.hex('shade'), hex: col.hex, k, t: E.t ?? 0, font: E.font ?? 'monospace', q, p: P,
    lw: clamp(size * 0.014, 1.3 * k, 5 * k) / size };
  const memo = new Map(), M = (a, b, u) => { const key = a + b + u.toFixed(3); let v = memo.get(key); if (!v) { v = mixHex(a, b, u); memo.set(key, v); } return v; };
  S.mix = M; S.lt = (c, u) => M(c, S.paper, u); S.dk = (c, u) => M(c, S.ink, u); S.A = (c, a) => rgba(/^#/.test(c) ? c : col.hex(c), a);
  ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(rot); ctx.scale(sx, size); if (o.alfa != null) ctx.globalAlpha *= clamp(o.alfa);
  const anc = def.draw(ctx, P, S) ?? {}; ctx.restore();
  const cr = Math.cos(rot), sr = Math.sin(rot), out = { x: o.x, y: o.y, w: def.caja[0] * size, h: def.caja[1] * size, rot };
  for (const [n, [lx, ly]] of Object.entries(anc)) { const X = lx * sx, Y = ly * size; out[n] = { x: o.x + X * cr - Y * sr, y: o.y + X * sr + Y * cr }; }
  return out;
}
