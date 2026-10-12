// texto.mjs: fuentes del sistema, texto con caja medible, cifras tabulares, maquina de escribir y contraste WCAG.
import { registerFont, createCanvas } from 'canvas';
import { execFileSync } from 'node:child_process';
import { hexRgb, rgba } from './base.mjs';

let F = null;
const SERIF = ['Libertinus Serif', 'EB Garamond', 'Crimson Pro', 'Gentium Book Basic', 'Gentium', 'Noto Serif', 'DejaVu Serif', 'Liberation Serif'];
const MONO = ['Courier Prime', 'Liberation Mono', 'DejaVu Sans Mono', 'JetBrainsMono NFM'];
/** registrarFuentes(): busca con fc-list una serif y una mono del sistema, las registra como KitSerif/KitMono y devuelve {serif,mono}. */
export function registrarFuentes() {
  if (F) return F;
  F = { serif: 'serif', mono: 'monospace', usadas: [] };
  let items = [];
  try { items = execFileSync('fc-list', [':', 'file', 'family', 'style'], { encoding: 'utf8' }).split('\n').map((l) => l.match(/^(.+?): (.+?):style=(.*)$/)).filter(Boolean).map((m) => ({ file: m[1], fam: m[2].split(',').map((s) => s.trim().toLowerCase()), st: m[3].toLowerCase() })); } catch { return F; }
  for (const [lista, alias, k] of [[SERIF, 'KitSerif', 'serif'], [MONO, 'KitMono', 'mono']]) {
    for (const nombre of lista) {
      const mine = items.filter((i) => i.fam.includes(nombre.toLowerCase()) && !/italic|oblique/.test(i.st) && /\.(ttf|otf)$/i.test(i.file));
      const reg = mine.find((i) => /(^|,)(regular|book|roman)(,|$)/.test(i.st)), neg = mine.find((i) => /(^|,)bold(,|$)/.test(i.st));
      if (!reg) continue;
      try { registerFont(reg.file, { family: alias, weight: 'normal' }); if (neg) registerFont(neg.file, { family: alias, weight: 'bold' }); F[k] = alias; F.usadas.push(nombre); break; } catch { /* siguiente candidata */ }
    }
  }
  return F;
}

const MC = createCanvas(8, 8).getContext('2d'), TC = new Map();
const fuente = (peso, tam, mono) => { const f = registrarFuentes(); return `${peso} ${tam}px ${mono ? f.mono : f.serif}`; };
const WC = new Map();
const ancho = (font, s) => { const k = font + '|' + s; if (!WC.has(k)) { if (WC.size > 2000) WC.clear(); MC.font = font; WC.set(k, MC.measureText(s).width); } return WC.get(k); };
// Los textos se rasterizan UNA vez (cache): medir/pintar bajo una escala de camara cambiante cuesta ~300 ms por llamada en pango.
function sello(str, font, color, tam, inter, alinear) {
  const key = [str, font, color, inter, alinear].join('|'); let r = TC.get(key); if (r) return r;
  if (TC.size > 300) TC.clear();
  const L = String(str).split('\n'), lw = L.map((l) => ancho(font, l)), w = Math.max(...lw, 1), h = tam * inter * (L.length - 1) + tam, pad = Math.ceil(tam * 0.3), c = createCanvas(Math.ceil(w) + 2 * pad, Math.ceil(h) + 2 * pad), g = c.getContext('2d');
  g.font = font; g.textBaseline = 'top'; g.fillStyle = color; L.forEach((l, i) => g.fillText(l, pad + (alinear === 'center' ? (w - lw[i]) / 2 : alinear === 'right' ? w - lw[i] : 0), pad + i * tam * inter));
  r = { c, w, h, pad }; TC.set(key, r); return r;
}

/** texto(ctx,str,x,y,{tam,peso,color,alinear,fondoVelo,mono,alfa}): dibuja texto (y = borde superior, admite \n) y devuelve su caja {x,y,w,h}. */
export function texto(ctx, str, x, y, { tam = 40, peso = 'normal', color = '#1e1a17', alinear = 'left', fondoVelo = null, mono = false, alfa = 1, interlinea = 1.3 } = {}) {
  const r = sello(str, fuente(peso, tam, mono), color, tam, interlinea, alinear), x0 = alinear === 'center' ? x - r.w / 2 : alinear === 'right' ? x - r.w : x;
  ctx.save();
  if (fondoVelo) for (let k = 5; k >= 0; k--) { const p = tam * (0.3 + 0.18 * k); ctx.fillStyle = rgba(fondoVelo, 0.14); ctx.beginPath(); ctx.roundRect(x0 - p, y - p * 0.6, r.w + 2 * p, r.h + 1.2 * p, tam * 0.6); ctx.fill(); }
  ctx.globalAlpha = alfa; ctx.drawImage(r.c, x0 - r.pad, y - r.pad); ctx.restore();
  return { x: x0, y, w: r.w, h: r.h };
}

/** cifrasTabulares(ctx,numero,x,y,{tam,decimales,alinear,color,peso}): numero con cada digito centrado en celda de ancho fijo (sin bailes al contar); devuelve la caja. */
export function cifrasTabulares(ctx, n, x, y, { tam = 64, decimales = 0, alinear = 'left', color = '#1e1a17', peso = 'normal', mono = false } = {}) {
  const font = fuente(peso, tam, mono); let [ent, dec] = Math.abs(n).toFixed(decimales).split('.'); ent = ent.replace(/\B(?=(\d{3})+$)/g, '\u00a0'); const s = (n < 0 ? '-' : '') + ent + (dec ? ',' + dec : '');
  const celda = Math.max(...'0123456789'.split('').map((d) => ancho(font, d))), cs = [...s].map((c) => ({ r: sello(c, font, color, tam, 1, 'left'), a: /\d/.test(c) ? celda : ancho(font, c) })), W = cs.reduce((a, c) => a + c.a, 0);
  let cx = alinear === 'center' ? x - W / 2 : alinear === 'right' ? x - W : x; const x0 = cx;
  for (const { r, a } of cs) { ctx.drawImage(r.c, cx + a / 2 - r.w / 2 - r.pad, y - r.pad); cx += a; }
  return { x: x0, y, w: W, h: tam };
}

/** escribirse(str,lt,{cps,pausa}): parte de `str` ya escrita tras lt segundos (cps letras/s, pausa extra tras puntuacion). */
export function escribirse(str, lt, { cps = 18, pausa = 0.22 } = {}) {
  let t = 0, i = 0;
  for (; i < str.length; i++) { t += 1 / cps + (/[,;:.]/.test(str[i]) ? pausa : 0); if (t > lt) break; }
  return str.slice(0, i);
}

/** contraste(c1,c2): razon de contraste WCAG entre dos colores hex (>= 4.5 para texto de cuerpo). */
export function contraste(c1, c2) {
  const L = (h) => { const [r, g, b] = hexRgb(h).map((v) => (v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const a = L(c1), b = L(c2); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
