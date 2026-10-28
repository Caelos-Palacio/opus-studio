// frame.js: frame(ctx,t) PURA. 1080x1920. Hoja de calculo (arriba, 1500 px) + banda de la noche con la voz (abajo, 420 px).
// Todo se calcula con tiempos ABSOLUTOS de timeline.js. Sin Math.random ni Date.
import { createCanvas } from 'canvas';
import { clamp, smoothstep, inOutCubic, rng } from '../../kit/base.mjs';
import { registrarFuentes } from '../../kit/texto.mjs';
import { vineta, grano } from '../../kit/materia.mjs';
import { fps, W, H, escenas, cruces, TLAND, TBAJA0, teclasT } from './timeline.js';
import { hechos, fecha } from './hechos.js';
export { W, H };

const F = registrarFuentes(), SH = 1920, RH = 88, HH = 72, CX = [0, 120, 680, 1080]; // alto hoja, alto fila, alto cabecera, bordes de columna
const CLARO = { hoja: '#f4f5ef', rej: '#b9bdb5', hdr: '#c0c0c0', hdrAct: '#a9aec8', luzH: '#ffffff', sombH: '#808080', tx: '#14161c', hdrTx: '#14161c', sel: '#000080', selTx: null, rojo: '#c8321f', palido: '#f9dcd6', gris: '#5f6676' };
const LOTUS = { hoja: '#07103f', rej: '#1c2a78', hdr: '#1c2a78', hdrAct: '#2de2e6', luzH: '#3a4bb0', sombH: '#060b2a', tx: '#e8ecff', hdrTx: '#c9d2ff', sel: '#2de2e6', selTx: '#04103a', rojo: '#ff8f7a', palido: '#2a1d5c', gris: '#9aa7e8' };
const ULT = { texto: [], objetos: [], sujeto: null };
const fuente = (tam, peso = 'normal', tipo = 'mono') => `${peso} ${tam}px ${tipo === 'mono' ? F.mono : F.sans}`;

let CAB = true;
function bisel(g, P, x, y, w, h, on) { g.fillStyle = on ? P.hdrAct : P.hdr; g.fillRect(x, y, w, h); g.fillStyle = P.luzH; g.fillRect(x, y, w, 3); g.fillRect(x, y, 3, h); g.fillStyle = P.sombH; g.fillRect(x, y + h - 3, w, 3); g.fillRect(x + w - 3, y, 3, h); }
/** cabecera(g,P,col): la UNICA cabecera fija (esquina con el reloj + A B). */
function cabecera(g, P, col) {
  bisel(g, P, 0, 0, CX[1], HH, false); g.fillStyle = P.hdrTx; g.font = fuente(28, 'normal', 'sans'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('03:12', CX[1] / 2, HH / 2 + 2);
  ['A', 'B'].forEach((L, i) => { const on = col === i + 1; bisel(g, P, CX[i + 1], 0, CX[i + 2] - CX[i + 1], HH, on); g.fillStyle = on && P === LOTUS ? '#04103a' : P.hdrTx; g.font = fuente(34, on ? 'bold' : 'normal', 'sans'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(L, (CX[i + 1] + CX[i + 2]) / 2, HH / 2 + 2); });
}
/** hoja(g,o): rejilla de celdas. o = {P, scroll (filas, fraccion), cell(r,c)->{t,al,col,bg,it,b,dx,dy,a}, act:{r,c,fill}, fantasma}. Cabeceras fijas. */
function hoja(g, o) {
  const { P, scroll, cell, act } = o, r0 = Math.floor(scroll) + 1, n = 46, yR = (r) => HH + (r - 1 - scroll) * RH;
  g.save(); g.beginPath(); g.rect(0, 0, W, 2 * SH); g.clip();
  g.fillStyle = P.hoja; g.fillRect(0, 0, W, 2 * SH);
  for (let r = r0; r < r0 + n; r++) for (let c = 1; c <= 2; c++) {
    const d = cell(r, c); if (!d) continue; const y = yR(r) + (d.dy || 0), x0 = CX[c], x1 = CX[c + 1];
    g.save(); g.beginPath(); g.rect(x0, yR(r), x1 - x0, RH); g.clip(); g.globalAlpha = d.a ?? 1;
    if (d.bg) { g.fillStyle = d.bg; g.fillRect(x0, y, x1 - x0, RH); }
    g.fillStyle = d.col || P.tx; g.font = fuente(d.tam || 44, d.b ? 'bold' : 'normal', d.sans ? 'sans' : 'mono'); if (d.it) g.font = 'italic ' + g.font; g.textBaseline = 'middle';
    g.textAlign = d.al === 'r' ? 'right' : 'left'; g.fillText(d.t, (d.al === 'r' ? x1 - 26 : x0 + 26) + (d.dx || 0), y + RH / 2 + 3); g.restore();
  }
  g.strokeStyle = P.rej; g.lineWidth = 2; g.beginPath();
  for (let r = r0; r <= r0 + n; r++) { const y = Math.round(yR(r)); g.moveTo(CX[1], y); g.lineTo(W, y); }
  for (const x of [CX[2], CX[3] - 1]) { g.moveTo(x, HH); g.lineTo(x, 2 * SH); } g.stroke();
  if (act) { const x0 = CX[act.c], x1 = CX[act.c + 1], y = yR(act.r); g.save(); g.beginPath(); g.rect(CX[1], HH, W - CX[1], SH - HH); g.clip();
    if (act.fill) { g.fillStyle = P.sel; g.fillRect(x0, y, x1 - x0, RH); if (act.txt) { g.fillStyle = act.txtCol; g.font = fuente(44, 'bold'); g.textBaseline = 'middle'; g.textAlign = 'right'; g.fillText(act.txt, x1 - 26, y + RH / 2 + 3); } }
    g.strokeStyle = P.sel; g.lineWidth = 7; g.strokeRect(x0 + 2, y + 2, x1 - x0 - 4, RH - 4); if (!act.fill) { g.fillStyle = P.sel; g.fillRect(x1 - 14, y + RH - 14, 20, 20); } g.restore(); }
  // cabeceras fijas: fila superior y columna izquierda, biseladas (estilo 1997)
  const bis = (x, y, w, h, on) => { return bisel(g, P, x, y, w, h, on);
     g.fillStyle = on ? P.hdrAct : P.hdr; g.fillRect(x, y, w, h); g.fillStyle = P.luzH; g.fillRect(x, y, w, 3); g.fillRect(x, y, 3, h); g.fillStyle = P.sombH; g.fillRect(x, y + h - 3, w, 3); g.fillRect(x + w - 3, y, 3, h); };
  for (let r = r0; r < r0 + n; r++) { const y = yR(r); if (y + RH < HH) continue; const on = act && act.r === r; bis(0, y, CX[1], RH, on); g.fillStyle = on && P === LOTUS ? '#04103a' : P.hdrTx; g.font = fuente(34, on ? 'bold' : 'normal', 'sans'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(r), CX[1] / 2, y + RH / 2 + 2); }
  if (CAB) cabecera(g, P, act && act.c);
  g.restore();
}

// celdas "viejas": fechas de serie = fila, y tres notas de las 3 de la manana
const NOTAS = { 3: 'pendiente', 6: 'revisar luego', 9: 'no tocar' };
const cFecha = (P, r, extra = {}) => ({ t: fecha(r), al: 'r', ...extra });
const cSerie = (r, extra = {}) => ({ t: String(r), al: 'r', ...extra });

function sTecleo(g, t) {
  const n = teclasT.filter((x) => x <= t).length, enter = t >= 2.35, P = CLARO, txt = hechos.tecleo.slice(0, n), caret = Math.floor(t * 2.4) % 2 === 0;
  hoja(g, { P, scroll: 0, act: { r: 1, c: 1 }, cell: (r, c) => {
    if (r === 1 && c === 1) return enter ? { t: hechos.tecleo, al: 'r', b: true } : { t: txt + (caret ? '|' : ' '), al: 'l' };
    if (r === 1 && c === 2) return t >= 2.75 ? { t: '60', al: 'r', col: P.sel, b: true, a: smoothstep(2.75, 3.0, t) } : null;
    if (c === 2 && NOTAS[r]) return { t: NOTAS[r], it: true, col: P.gris, tam: 38, sans: true }; return null; } });
}
function sBisiesto(g, t) {
  const P = CLARO, L = hechos.divisores, a = [3.9, 4.4, 4.9, 5.4];
  hoja(g, { P, scroll: 0, act: null, cell: (r, c) => {
    if (r <= 3) { const [d, q] = L[r - 1], k = smoothstep(a[r - 1], a[r - 1] + 0.2, t), mal = r === 3; if (!k) return null;
      return c === 1 ? { t: `1900 ÷ ${d}`, al: 'l', a: k, bg: mal ? P.palido : null } : { t: String(q).replace('.', ','), al: 'r', a: k, col: mal ? P.rojo : P.tx, b: mal, bg: mal ? P.palido : null }; }
    if (r === 4 && t >= a[3]) return c === 1 ? { t: 'bisiesto', al: 'l', sans: true, a: smoothstep(a[3], a[3] + 0.2, t) } : { t: 'FALSO', al: 'r', col: P.rojo, b: true, a: smoothstep(a[3], a[3] + 0.2, t) };
    if (c === 2 && NOTAS[r + 4]) return { t: NOTAS[r + 4], it: true, col: P.gris, tam: 38, sans: true }; return null; } });
}
const OBJ = 52, DS = 56; // fila final: A60 queda en la fila 8 del cuadro
const celdaBase = (P, r, c, extra60 = {}) => (r > 130 ? null : c === 1 ? cFecha(P, r, r === 60 ? extra60 : {}) : cSerie(r, r === 60 ? { b: true } : { col: P.gris }));
function sBaja(g, t) {
  const P = CLARO, u = clamp((t - TBAJA0) / (TLAND - TBAJA0)), e = 1 - Math.pow(1 - u, 2.4), dt = Math.max(0, t - TLAND);
  const sc = OBJ * e + (u >= 1 ? 0.22 * Math.exp(-7 * dt) * Math.sin(26 * dt) : 0), v = Math.abs(OBJ * 2.4 * Math.pow(1 - u, 1.4)) / (TLAND - TBAJA0) * (u < 1 && u > 0 ? 1 : 0), sel = t >= TLAND;
  const nS = v > 6 ? 3 : 1, pulso = sel ? smoothstep(TLAND, TLAND + 0.25, t) : 0;
  for (let i = 0; i < nS; i++) { const ds = nS > 1 ? (i - 1) * Math.min(0.9, v * 0.035) : 0; g.globalAlpha = 1 / nS; hoja(g, { P, scroll: sc + ds, act: sel ? { r: 60, c: 1 } : { r: 1, c: 1 }, cell: (r, c) => celdaBase(P, r, c, sel ? { bg: P.palido, b: true } : {}) }); }
  g.globalAlpha = 1;
}
function sFijo(g, t, P, sc, estilo) { // respiro / cierre: A60 en la fila 8, casi quieta
  const s = OBJ + 0.12 * Math.sin(t * 0.5), cierre = estilo === 'cierre', k = cierre ? smoothstep(24.9, 25.9, t) : 0;
  hoja(g, { P, scroll: s, act: cierre && k > 0.5 ? { r: 60, c: 1, fill: true, txt: fecha(60), txtCol: '#ffffff' } : { r: 60, c: 1 },
    cell: (r, c) => (c === 1 && r === 60 && !(cierre && k > 0.5)) ? { t: fecha(60), al: 'r', b: true, bg: P.palido } : celdaBase(P, r, c) });
}
function sLotus(g, t) {
  const P = LOTUS, s = OBJ + 0.08 * Math.sin(t * 0.7);
  hoja(g, { P, scroll: s, act: { r: 60, c: 1, fill: true, txt: fecha(60), txtCol: '#04103a' }, cell: (r, c) => {
    if (r === 54) return c === 1 ? { t: 'Lotus 1-2-3', al: 'l', b: true, col: '#2de2e6' } : { t: String(hechos.lotus), al: 'r', b: true, col: '#2de2e6' };
    return celdaBase(P, r, c); } });
}
function sDesplaza(g, t) {
  const P = CLARO, t1 = 20.9;
  hoja(g, { P, scroll: DS, act: { r: 60, c: 1 }, cell: (r, c) => {
    if (c === 2 || r < 60) return celdaBase(P, r, c);
    const p = clamp((t - (t1 + (r - 60) * 0.16)) / 0.4), ease = inOutCubic(p); if (p <= 0) return celdaBase(P, r, c, { bg: P.palido, b: true });
    return { t: fecha(r + 1 > 60 ? r + 1 : 61), al: 'r', col: P.rojo, b: true, dy: -RH * (1 - ease), a: ease, bg: ease > 0.5 ? P.palido : null }; } });
  // la fecha vieja se hunde mientras llega la nueva (se dibuja encima, recortada a su fila)
  const sc = DS; g.save(); g.beginPath(); g.rect(CX[1], HH, W - CX[1], SH - HH); g.clip();
  for (let r = 60; r < 72; r++) { const p = clamp((t - (t1 + (r - 60) * 0.16)) / 0.4); if (p <= 0 || p >= 1) continue; const y = HH + (r - 1 - sc) * RH; g.save(); g.beginPath(); g.rect(CX[1], y, CX[2] - CX[1], RH); g.clip(); g.globalAlpha = 1 - p; g.fillStyle = P.tx; g.font = fuente(44); g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(fecha(r), CX[2] - 26, y + RH / 2 + 3 + RH * p); g.restore(); }
  g.restore();
}
const PAL = [CLARO, CLARO, CLARO, CLARO, LOTUS, CLARO, CLARO], COL = [1, 0, 1, 1, 1, 1, 1];
const ESC = [sTecleo, sBisiesto, sBaja, (g, t) => sFijo(g, t, CLARO, 0, 'respiro'), sLotus, sDesplaza, (g, t) => sFijo(g, t, CLARO, 0, 'cierre')];

// voz: ventanas ABSOLUTAS (s)
const VOZ = [['tecleo', 0.4, 3.7], ['bisiesto', 4.1, 6.2], ['baja', 10.0, 12.9], ['respiro', 13.4, 16.9], ['lotus', 17.3, 19.9], ['desplaza', 20.4, 24.3], ['cierre', 24.7, 27.6]];
function banda(g, t) { // la voz es una NOTA de celda (amarillo de comentario) sobre la columna A, abajo; la B queda libre
  for (const [id, a, b] of VOZ) {
    const al = Math.min(smoothstep(a, a + 0.35, t), 1 - smoothstep(b - 0.35, b, t)); if (al <= 0.01) continue;
    g.font = fuente(44, 'bold', 'sans'); const pal = hechos.voz[id].split(' '), L = []; let cur = '';
    for (const p of pal) { const q = cur ? cur + ' ' + p : p; if (g.measureText(q).width > 440 && cur) { L.push(cur); cur = p; } else cur = q; }
    L.push(cur); const bh = L.length * 58 + 44, y0 = 1860 - bh, wmax = Math.max(...L.map((s) => g.measureText(s).width));
    g.save(); g.globalAlpha = al; g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 16; g.shadowOffsetY = 7; g.fillStyle = '#fff3a8'; g.fillRect(128, y0, 544, bh); g.shadowColor = 'transparent';
    g.strokeStyle = '#14161c'; g.lineWidth = 3; g.strokeRect(128, y0, 544, bh); g.fillStyle = '#c8321f'; g.beginPath(); g.moveTo(672, y0); g.lineTo(672 - 30, y0); g.lineTo(672, y0 + 30); g.fill();
    g.fillStyle = '#14161c'; g.textAlign = 'left'; g.textBaseline = 'top'; L.forEach((s, i) => g.fillText(s, 150, y0 + 22 + i * 58)); g.restore();
    ULT.texto.push({ id: 'voz-' + id, x: 150, y: y0 + 22, w: wmax, h: L.length * 58 - 8, color: '#14161c', tam: 44, alfa: al, contenedor: { x: 128, y: y0, w: 544, h: bh } });
  }
}
function sala(g, t) {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#12161f'); gr.addColorStop(1, '#0a0c12'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
/** frame(ctx,t): fotograma del instante t (s). */
export function frame(ctx, t) {
  ULT.texto.length = 0; ULT.objetos.length = 0; ULT.sujeto = { x: 0, y: 0, w: W, h: SH };
  const w = ctx.canvas.width, h = ctx.canvas.height, k = w / W, fi = Math.round(t * fps), last = escenas.length - 1;
  ctx.save(); ctx.scale(k, k); sala(ctx, t);
  let i = escenas.findIndex((e) => t < e.t0 + e.dur); if (i < 0) i = last;
  const e = escenas[i], c0 = i < last ? cruces[i] : 0, enCruce = i < last && t > e.t0 + e.dur - c0;
  const lumi = 1 + 0.012 * Math.sin(t * 9.1) * (rng(fi)() > 0.97 ? 1.6 : 0.4); // parpadeo de refresco, sembrado por fotograma
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, SH); ctx.clip();
  if (enCruce) { const u = inOutCubic((t - (e.t0 + e.dur - c0)) / c0); CAB = false; ctx.save(); ctx.translate(0, -u * SH); ESC[i](ctx, t); ctx.restore(); ctx.save(); ctx.translate(0, (1 - u) * (SH - HH)); ctx.beginPath(); ctx.rect(0, HH, W, SH - HH); ctx.clip(); ESC[i + 1](ctx, t); ctx.restore(); CAB = true; const j = u < 0.5 ? i : i + 1; cabecera(ctx, PAL[j], COL[j]); }
  else ESC[i](ctx, t);
  ctx.globalAlpha = Math.max(0, lumi - 1) * 6; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, SH); ctx.globalAlpha = 1; ctx.restore();
  
  banda(ctx, t); ctx.restore();
  vineta(ctx, w, h, 0.38); grano(ctx, w, h, fi, 0.04);
}
export function cajas(t) { frame(createCanvas(108, 192).getContext('2d'), t); return { texto: ULT.texto.map((b) => ({ ...b })), objetos: ULT.objetos.map((b) => ({ ...b })), sujeto: ULT.sujeto && { ...ULT.sujeto } }; }
