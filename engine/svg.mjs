// SVG como elemento (spec 020): importa un SVG, lo SANEA, lo normaliza a un cuadro unidad y lo pinta con los roles de paleta del medio.
//   parseSvg(texto, {nombre}) → doc      tokenizador XML de lista blanca (sin dependencias) + geom.parsePath (M L H V C S Q T A Z → cúbicas)
//   cargarSvg(id, root)       → doc      «mosca» → assets/svg/mosca.svg (o una ruta assets/…svg); cacheado por contenido; falla con SvgError
//   drawSvg(ctx, doc, o, E)   → {x,y,w,h,rot,punta,centro}   o: {x,y,size,rot,flip,alfa,trazo,morphTo,u,roles,mono}  E: {pal}
//   longitud(doc)             → longitud total de los trazos (cuadro unidad); el trazado progresivo reparte `trazo` ∈ [0,1] por longitud de path
//   validateSvg(o, path, E)   → valida los literales del tipo DSL `svg` (los {$expr} se comprueban aparte)
// Seguridad: nada de scripts, <foreignObject>, eventos on…, href que no sea «#interno», javascript:/data:, url() externo, DOCTYPE/ENTITY,
// animaciones SMIL, <image>/<iframe>/…: se rechaza con SvgError {codigo, línea}. Lo que no se dibuja (title, defs, style, use, texto…) se ignora y queda en doc.avisos.
// Determinista y puro: la geometría se hornea al parsear (los transforms entran en las Béziers); pintar solo depende de (doc, o, paleta).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { rootFrom } from './paths.mjs';
import { parsePath, shapes, mapPts, tracePath, traceTrim, tracePolys, morphPolys, flatten, resample, length as shapeLength, bbox } from './geom.mjs';
import { mix as mixHex } from './color.mjs';
import { clamp, lerp } from './core.mjs';
import { hint } from './fondo-capas.mjs';

const ROOT = rootFrom(import.meta.url);
export const MAX_BYTES = 512 * 1024, MAX_ELEMS = 4000, MAX_DEPTH = 48, DIR = 'assets/svg';
export class SvgError extends Error {
  constructor(codigo, msg, { nombre = '', linea = 0, remedio = '' } = {}) {
    super(`svg${nombre ? ` «${nombre}»` : ''} no se importa: ${msg}${linea ? ` (línea ${linea})` : ''}${remedio ? `. ${remedio}` : ''}`);
    this.name = 'SvgError'; this.codigo = codigo; this.linea = linea;
  }
}

// ── 1 · XML de lista blanca ──────────────────────────────────────────────────────────────────────────────────────
const BAN = {
  script: ['script', 'Quita los scripts del archivo'], foreignobject: ['foreignObject', 'Quita el <foreignObject> (HTML embebido)'],
  iframe: ['embebido', 'Quita el elemento embebido'], embed: ['embebido', 'Quita el elemento embebido'], object: ['embebido', 'Quita el elemento embebido'], audio: ['embebido', 'Quita el elemento multimedia'], video: ['embebido', 'Quita el elemento multimedia'],
  image: ['imagen', 'Quita la <image>: un SVG importado solo lleva vectores (dibuja el contorno o usa api.image con un asset)'],
  animate: ['animacion', 'Quita la animación SMIL (el movimiento lo pone el motor: trazo, morphTo)'], animatetransform: ['animacion', 'Quita la animación SMIL'], animatemotion: ['animacion', 'Quita la animación SMIL'], animatecolor: ['animacion', 'Quita la animación SMIL'], set: ['animacion', 'Quita la animación SMIL'],
  handler: ['evento', 'Quita el manejador'], listener: ['evento', 'Quita el manejador'],
};
const IGNORADOS = new Set(['title', 'desc', 'metadata', 'style', 'use', 'text', 'tspan', 'symbol', 'clippath', 'mask', 'marker', 'pattern', 'filter', 'switch', 'namedview', 'view']);
const DEC = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
const dec = (s) => s.replace(/&(amp|lt|gt|quot|apos);/g, (m) => DEC[m]);
const local = (n) => n.replace(/^[^:]*:/, '');
function xml(txt, nombre) {
  const E = (codigo, msg, linea, remedio) => { throw new SvgError(codigo, msg, { nombre, linea, remedio }); };
  if (Buffer.byteLength(txt) > MAX_BYTES) E('tamano', `pesa ${(Buffer.byteLength(txt) / 1024).toFixed(0)} KB (máx. ${MAX_BYTES / 1024} KB)`, 0, 'Simplifica el dibujo');
  const dt = /<!\s*(DOCTYPE|ENTITY)/i.exec(txt); if (dt) E('entidad', `lleva <!${dt[1].toUpperCase()}> (entidades externas/expansivas: XXE, billion laughs)`, lineaDe(txt, dt.index), 'Quita el DOCTYPE y las entidades');
  const root = { tag: '#root', attrs: {}, kids: [], linea: 0 }, stack = [root]; let i = 0, elems = 0, ln = 1, lp = 0;
  const lineAt = (p) => { while (lp < p) if (txt.charCodeAt(lp++) === 10) ln++; return ln; };
  while (i < txt.length) {
    const j = txt.indexOf('<', i); if (j < 0) break; i = j;
    if (txt.startsWith('<!--', i)) { const e = txt.indexOf('-->', i + 4); i = e < 0 ? txt.length : e + 3; continue; }
    if (txt.startsWith('<![CDATA[', i)) { const e = txt.indexOf(']]>', i); i = e < 0 ? txt.length : e + 3; continue; }
    if (txt.startsWith('<?', i)) { const e = txt.indexOf('?>', i); i = e < 0 ? txt.length : e + 2; continue; }
    if (txt.startsWith('<!', i)) { const e = txt.indexOf('>', i); i = e < 0 ? txt.length : e + 1; continue; }
    if (txt.startsWith('</', i)) { const e = txt.indexOf('>', i); if (stack.length > 1) stack.pop(); i = e < 0 ? txt.length : e + 1; continue; }
    const m = /^<([A-Za-z_][\w:.-]*)/.exec(txt.slice(i, i + 80)); if (!m) E('sintaxis', 'etiqueta mal formada', lineAt(i));
    const linea = lineAt(i), tag = local(m[1]), low = tag.toLowerCase(); let k = i + m[0].length; const attrs = {};
    if (BAN[low]) E(BAN[low][0], `<${tag}> no permitido en un SVG importado`, linea, BAN[low][1]);
    for (;;) {
      while (k < txt.length && /\s/.test(txt[k])) k++;
      if (k >= txt.length) E('sintaxis', `<${tag}> sin cerrar`, linea);
      if (txt[k] === '>' || (txt[k] === '/' && txt[k + 1] === '>')) break;
      const a = /^([^\s=\/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/.exec(txt.slice(k, k + 400000)); if (!a) E('sintaxis', `atributo mal formado en <${tag}>`, linea);
      const name = a[1], val = dec(a[2] ?? a[3] ?? ''); k += a[0].length;
      if (/^on/i.test(local(name))) E('evento', `atributo de evento «${name}» en <${tag}>`, linea, 'Quita los manejadores de eventos');
      if (/^(xlink:)?href$/i.test(name) && !val.trim().startsWith('#')) E('href', `${name}="${val.slice(0, 40)}" apunta fuera del archivo (href externo)`, linea, 'Solo se admite href="#interno"; quita los enlaces');
      if (/(java|vb)script\s*:/i.test(val)) E('javascript', `«javascript:» en ${name}`, linea, 'Quita el código embebido');
      if (/data\s*:/i.test(val) && !/^data-/i.test(name)) E('data', `«data:» en ${name} (contenido embebido)`, linea, 'Quita el contenido embebido');
      for (const u of val.matchAll(/url\(\s*(['"]?)([^)'"]*)\1\s*\)/gi)) if (!u[2].trim().startsWith('#')) E('url', `url(${u[2].slice(0, 40)}) externo en ${name}`, linea, 'Solo se admite url(#interno)');
      attrs[name] = val;
    }
    const auto = txt[k] === '/'; i = k + (auto ? 2 : 1);
    if (++elems > MAX_ELEMS) E('elementos', `más de ${MAX_ELEMS} elementos`, linea, 'Simplifica el dibujo');
    const nodo = { tag, attrs: Object.fromEntries(Object.entries(attrs).map(([a, v]) => [local(a), v])), kids: [], linea };
    stack.at(-1).kids.push(nodo);
    if (!auto) { if (stack.length > MAX_DEPTH) E('profundidad', `anidado a más de ${MAX_DEPTH} niveles`, linea, 'Aplana los grupos'); stack.push(nodo); }
    if (low === 'style' && !auto) { const e = txt.indexOf('</', i), css = txt.slice(i, e < 0 ? txt.length : e); if (/@import|url\(\s*['"]?(?!#)/i.test(css)) E('url', '<style> con @import o url() externo', linea, 'Quita la hoja de estilos'); }
    if ((low === 'style' || low === 'title' || low === 'desc') && !auto) { const e = txt.indexOf('</', i); nodo.texto = txt.slice(i, e < 0 ? txt.length : e).replace(/<!\[CDATA\[|\]\]>/g, '').trim(); i = e < 0 ? txt.length : e; }
  }
  const svg = root.kids.find((n) => n.tag.toLowerCase() === 'svg'); if (!svg) E('sintaxis', 'no hay elemento raíz <svg>', 1);
  return svg;
}
function lineaDe(txt, idx) { return 1 + (txt.slice(0, idx).match(/\n/g)?.length ?? 0); }

// ── 2 · geometría y estilo ───────────────────────────────────────────────────────────────────────────────────────
const I = [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
function matriz(txt) {
  let M = I; if (!txt) return M;
  for (const [, name, args] of txt.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const a = (args.match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? []).map(Number), r = (d) => (d * Math.PI) / 180; let T;
    switch (name) {
      case 'matrix': T = a.length === 6 ? a : I; break;
      case 'translate': T = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0]; break;
      case 'scale': T = [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0]; break;
      case 'rotate': { const c = Math.cos(r(a[0] ?? 0)), s = Math.sin(r(a[0] ?? 0)), R = [c, s, -s, c, 0, 0]; T = a.length >= 3 ? mul(mul([1, 0, 0, 1, a[1], a[2]], R), [1, 0, 0, 1, -a[1], -a[2]]) : R; break; }
      case 'skewX': T = [1, 0, Math.tan(r(a[0] ?? 0)), 1, 0, 0]; break;
      case 'skewY': T = [1, Math.tan(r(a[0] ?? 0)), 0, 1, 0, 0]; break;
      default: T = I;
    }
    M = mul(M, T);
  }
  return M;
}
const NOMBRES = { black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', lime: '#00ff00', blue: '#0000ff', yellow: '#ffff00', orange: '#ffa500', gray: '#808080', grey: '#808080', silver: '#c0c0c0', brown: '#a52a2a', pink: '#ffc0cb', purple: '#800080', cyan: '#00ffff', magenta: '#ff00ff', navy: '#000080', gold: '#ffd700' };
const hex2 = (n) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');
function color(v, grad, avisos) {                                   // → '#rrggbb' | null (none) | undefined (no reconocido)
  v = String(v ?? '').trim().toLowerCase(); if (!v || v === 'inherit') return undefined;
  if (v === 'none' || v === 'transparent') return null;
  if (v === 'currentcolor') return '#000000';
  let m = /^#([0-9a-f]{3})$/.exec(v); if (m) return '#' + [...m[1]].map((c) => c + c).join('');
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(v); if (m) return '#' + m[1];
  m = /^rgba?\(([^)]*)\)/.exec(v); if (m) { const p = m[1].split(/[\s,\/]+/).filter(Boolean).slice(0, 3).map((x) => (x.endsWith('%') ? (parseFloat(x) * 255) / 100 : parseFloat(x))); if (p.length === 3 && p.every(Number.isFinite)) return '#' + p.map(hex2).join(''); }
  m = /^url\(\s*['"]?#([^)'"]+)/.exec(v); if (m) { avisos.add(`degradado «${m[1]}» no soportado: se usa su primer color`); return grad[m[1]] ?? '#808080'; }
  if (NOMBRES[v]) return NOMBRES[v];
  avisos.add(`color «${v}» no reconocido: se usa negro`); return '#000000';
}
function estilo(attrs) {
  const o = { ...attrs }; if (attrs.style) for (const d of attrs.style.split(';')) { const i = d.indexOf(':'); if (i > 0) o[d.slice(0, i).trim()] = d.slice(i + 1).trim(); }
  return o;
}
const num = (v, d = 0) => { const x = parseFloat(v); return Number.isFinite(x) ? x : d; };
const ROL = /^(#[0-9a-fA-F]{3,8}|[a-z][a-z0-9]*)$/;

function elementoShape(n, avisos) {
  const a = n.attrs, t = n.tag.toLowerCase();
  if (t === 'path') return a.d ? parsePath(a.d) : null;
  if (t === 'rect') { const x = num(a.x), y = num(a.y), w = num(a.width), h = num(a.height), r = Math.min(num(a.rx, num(a.ry)), w / 2, h / 2); return w > 0 && h > 0 ? shapes.rect(x, y, w, h, r) : null; }
  if (t === 'circle' || t === 'ellipse') { const cx = num(a.cx), cy = num(a.cy), rx = t === 'circle' ? num(a.r) : num(a.rx), ry = t === 'circle' ? num(a.r) : num(a.ry); return rx > 0 && ry > 0 ? parsePath(`M${cx + rx} ${cy}A${rx} ${ry} 0 1 1 ${cx - rx} ${cy}A${rx} ${ry} 0 1 1 ${cx + rx} ${cy}Z`) : null; }
  if (t === 'line') return parsePath(`M${num(a.x1)} ${num(a.y1)}L${num(a.x2)} ${num(a.y2)}`);
  if (t === 'polyline' || t === 'polygon') { const p = (a.points ?? '').match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g)?.map(Number) ?? []; if (p.length < 4) return null; let d = `M${p[0]} ${p[1]}`; for (let i = 2; i + 1 < p.length; i += 2) d += `L${p[i]} ${p[i + 1]}`; return parsePath(d + (t === 'polygon' ? 'Z' : '')); }
  return null;
}

export function parseSvg(texto, { nombre = '' } = {}) {
  const raiz = xml(String(texto), nombre), avisos = new Set(), grad = {}, items = []; let titulo = '', conteo = 0;
  const hijos = (n, ctx) => { for (const k of n.kids) nodo(k, ctx); };
  function nodo(n, P) {
    const t = n.tag.toLowerCase(), a = estilo(n.attrs);
    if (t === 'lineargradient' || t === 'radialgradient') { const st = n.kids.find((k) => k.tag.toLowerCase() === 'stop'); if (st && n.attrs.id) { const sa = estilo(st.attrs); grad[n.attrs.id] = color(sa['stop-color'] ?? '#808080', {}, avisos) ?? '#808080'; } avisos.add(`degradado «${n.attrs.id ?? '?'}» no soportado: se usa su primer color`); return; }
    if (t === 'defs') { for (const k of n.kids) if (/gradient/i.test(k.tag)) nodo(k, P); else if (!['path', 'g'].includes(k.tag.toLowerCase())) avisos.add(`elemento «${k.tag}» dentro de <defs> ignorado`); return; }
    if (t === 'title' && !titulo) titulo = n.texto ?? '';
    if (IGNORADOS.has(t)) { avisos.add(`elemento «${n.tag}» ignorado (no se dibuja)`); return; }
    if (a.display === 'none') return;
    const M = mul(P.M, matriz(a.transform)), c = { ...P, M };
    const f = color(a.fill, grad, avisos), s = color(a.stroke, grad, avisos); if (f !== undefined) { c.fill = f; c.fillRol = null; } if (s !== undefined) { c.stroke = s; c.strokeRol = null; }
    for (const [k, to] of [['data-fill', 'fillRol'], ['data-stroke', 'strokeRol']]) if (a[k] != null) { if (!ROL.test(a[k])) throw new SvgError('rol', `${k}="${a[k]}" no es un rol de paleta ni un hex`, { nombre, linea: n.linea, remedio: 'Usa p. ej. data-fill="accent"' }); c[to] = a[k]; }
    if (a['stroke-width'] != null) c.sw = num(a['stroke-width'], 1); if (a.opacity != null) c.opacity = P.opacity * clamp(num(a.opacity, 1)); if (a['fill-opacity'] != null) c.fo = clamp(num(a['fill-opacity'], 1)); if (a['stroke-opacity'] != null) c.so = clamp(num(a['stroke-opacity'], 1));
    if (a['stroke-linecap']) c.cap = a['stroke-linecap']; if (a['stroke-linejoin']) c.join = a['stroke-linejoin']; if (a['fill-rule']) c.rule = a['fill-rule']; if (a['stroke-dasharray']) c.dash = a['stroke-dasharray'] === 'none' ? null : (a['stroke-dasharray'].match(/[\d.]+/g) ?? []).map(Number);
    if (['g', 'a', 'svg'].includes(t)) { hijos(n, c); return; }
    const shape = elementoShape(n, avisos); if (!shape) { if (!['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'].includes(t)) avisos.add(`elemento «${n.tag}» ignorado (no se dibuja)`); return; }
    const sc = Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2])), g = mapPts(shape, (x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]]);
    const soloTrazo = t === 'line';
    items.push({ tipo: t, id: n.attrs.id ?? null, shape: g, fill: soloTrazo ? null : c.fill, fillRol: soloTrazo ? null : c.fillRol, stroke: c.stroke, strokeRol: c.strokeRol, sw: c.sw * sc, opacity: c.opacity, fillOpacity: c.fo, strokeOpacity: c.so, cap: c.cap, join: c.join, dash: c.dash ? c.dash.map((d) => d * sc) : null, rule: c.rule === 'evenodd' ? 'evenodd' : 'nonzero', linea: n.linea });
    conteo++;
  }
  const base = { M: I, fill: '#000000', fillRol: null, stroke: null, strokeRol: null, sw: 1, opacity: 1, fo: 1, so: 1, cap: 'butt', join: 'miter', rule: 'nonzero', dash: null };
  nodo({ ...raiz, tag: 'g' }, base);
  if (!items.length) throw new SvgError('vacio', 'no contiene ningún path dibujable', { nombre, remedio: 'Convierte el texto y las formas a paths' });
  // lienzo → cuadro unidad (lado mayor 1, centrado)
  let vb = (raiz.attrs.viewBox ?? raiz.attrs.viewbox ?? '').trim().split(/[\s,]+/).map(Number);
  if (vb.length !== 4 || vb.some((v) => !Number.isFinite(v)) || vb[2] <= 0 || vb[3] <= 0) { const w = num(raiz.attrs.width, 0), h = num(raiz.attrs.height, 0); if (w > 0 && h > 0) vb = [0, 0, w, h]; else { const b = items.map((i) => bbox(i.shape)), x0 = Math.min(...b.map((q) => q.x)), y0 = Math.min(...b.map((q) => q.y)), x1 = Math.max(...b.map((q) => q.x + q.w)), y1 = Math.max(...b.map((q) => q.y + q.h)); vb = [x0, y0, Math.max(1e-6, x1 - x0), Math.max(1e-6, y1 - y0)]; } }
  const s = 1 / Math.max(vb[2], vb[3]), cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2;
  for (const it of items) { it.shape = mapPts(it.shape, (x, y) => [(x - cx) * s, (y - cy) * s]); it.sw *= s; if (it.dash) it.dash = it.dash.map((d) => d * s); }
  const tags = (raiz.attrs['data-tags'] ?? '').split(/[\s,]+/).filter(Boolean);
  return { nombre, titulo, tags, w: vb[2] * s, h: vb[3] * s, items, paths: items.length, avisos: [...avisos].sort(), hash: crypto.createHash('sha1').update(String(texto)).digest('hex').slice(0, 12) };
}

// ── 3 · biblioteca y carga ───────────────────────────────────────────────────────────────────────────────────────
export const listaSvg = (root = ROOT) => { const d = path.join(root, DIR); return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.svg') && !f.startsWith('_')).map((f) => f.slice(0, -4)).sort() : []; };
export const SVG_LIB = listaSvg();
export function resolverSvg(id, root = ROOT) {
  const s = String(id ?? ''); let rel;
  if (/^[A-Za-z0-9_-]+$/.test(s)) rel = `${DIR}/${s}.svg`;
  else {
    const n = path.posix.normalize(s.replace(/\\/g, '/'));
    if (path.isAbsolute(s) || /(^|\/)\.\.(\/|$)/.test(s) || !n.startsWith('assets/') || !n.endsWith('.svg')) throw new SvgError('ruta', `«${s}» no es una ruta válida: solo un nombre de la biblioteca o una ruta assets/….svg (sin «..» ni rutas absolutas)`, { nombre: s });
    rel = n;
  }
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) throw new SvgError('inexistente', `no existe ${rel}. ${hint(s.replace(/^assets\/svg\/|\.svg$/g, ''), listaSvg(root))}`, { nombre: s });
  return { rel, abs };
}
const CACHE = new Map();
export function cargarSvg(id, root = ROOT) {
  const { rel, abs } = resolverSvg(id, root), st = fs.statSync(abs), key = `${abs}:${st.size}:${st.mtimeMs}`, hit = CACHE.get(abs);
  if (hit && hit.key === key) return hit.doc;
  const doc = parseSvg(fs.readFileSync(abs, 'utf8'), { nombre: path.basename(rel, '.svg') }); doc.archivo = rel;
  CACHE.set(abs, { key, doc }); return doc;
}

// ── 4 · pintado ──────────────────────────────────────────────────────────────────────────────────────────────────
export const longitud = (doc) => doc.items.reduce((a, it) => a + (it._len ??= shapeLength(it.shape)), 0);
const FASE_TRAZO = 0.85;                                           // el trazo ocupa el 85 % de `trazo`; el resto, los rellenos que aparecen
const roleHex = (pal, r) => { if (/^#/.test(r)) return r; if (!pal[r]) throw new SvgError('rol', `rol de paleta desconocido «${r}»`, { remedio: hint(r, Object.keys(pal)) }); return pal[r]; };
function resolver(pal, o) {
  return (hex, rol) => {
    if (hex == null && rol == null) return null;
    if (o.mono) return roleHex(pal, o.mono);
    const map = o.roles ?? {}, k = rol && rol in map ? map[rol] : hex && hex in map ? map[hex] : null;
    if (k) return roleHex(pal, k);
    return rol ? roleHex(pal, rol) : hex;
  };
}
function aplicarEstilo(ctx, it, sw) { ctx.lineWidth = sw; ctx.lineCap = it.cap === 'square' ? 'square' : it.cap === 'round' ? 'round' : 'butt'; ctx.lineJoin = it.join === 'round' ? 'round' : it.join === 'bevel' ? 'bevel' : 'miter'; ctx.miterLimit = 4; }
function pintaItem(ctx, it, R, pxu, alfa, { fillA = 1, strokeA = 1 } = {}) {
  const f = R(it.fill, it.fillRol), s = R(it.stroke, it.strokeRol), sw = Math.max(it.sw, 0.7 / pxu);
  ctx.save(); ctx.globalAlpha = alfa * it.opacity;
  ctx.beginPath(); tracePath(ctx, it.shape);
  if (f && fillA > 0) { ctx.globalAlpha = alfa * it.opacity * it.fillOpacity * fillA; ctx.fillStyle = f; ctx.fill(it.rule); }
  if (s && it.sw > 0 && strokeA > 0) { ctx.globalAlpha = alfa * it.opacity * it.strokeOpacity * strokeA; ctx.strokeStyle = s; aplicarEstilo(ctx, it, sw); if (it.dash?.length) ctx.setLineDash(it.dash); ctx.stroke(); }
  ctx.restore();
}
function morphItem(ctx, a, b, u, R, pxu, alfa) {
  const mixc = (ca, cb) => (ca && cb ? mixHex(ca, cb, u) : ca ?? cb), fa = R(a.fill, a.fillRol), fb = R(b.fill, b.fillRol), sa = R(a.stroke, a.strokeRol), sb = R(b.stroke, b.strokeRol);
  const f = mixc(fa, fb), s = mixc(sa, sb), fA = (fa && fb ? 1 : fa ? 1 - u : u) * lerp(a.fillOpacity, b.fillOpacity, u), sA = (sa && sb ? 1 : sa ? 1 - u : u) * lerp(a.strokeOpacity, b.strokeOpacity, u);
  const sw = Math.max(lerp(a.sw, b.sw, u), 0.7 / pxu), op = lerp(a.opacity, b.opacity, u);
  ctx.save(); ctx.globalAlpha = alfa * op; ctx.beginPath();
  const ca = a.shape.contours, cb = b.shape.contours;
  if (ca.length === cb.length && ca.some((c, i) => !c.closed || !cb[i].closed)) {
    ca.forEach((c, i) => { const d = cb[i]; if (c.closed && d.closed) tracePolys(ctx, morphPolys({ contours: [c] }, { contours: [d] }, u, { n: 64 })); else { const A = resample(flatten(c, 10), 48, false), B = resample(flatten(d, 10), 48, false); A.forEach((p, j) => { const x = lerp(p[0], B[j][0], u), y = lerp(p[1], B[j][1], u); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); } });
  } else tracePolys(ctx, morphPolys(a.shape, b.shape, u, { n: 64 }));
  if (f && fA > 0) { ctx.globalAlpha = alfa * op * fA; ctx.fillStyle = f; ctx.fill(a.rule); }
  if (s && sA > 0 && (a.sw > 0 || b.sw > 0)) { ctx.globalAlpha = alfa * op * sA; ctx.strokeStyle = s; aplicarEstilo(ctx, a, sw); ctx.stroke(); }
  ctx.restore();
}
// o: {x, y, size, rot, flip, alfa, trazo, morphTo (doc), u, roles, mono}
export function drawSvg(ctx, doc, o, E = {}) {
  const pal = E.pal ?? {}, R = resolver(pal, o), size = o.size, rot = o.rot ?? 0, sx = size * (o.flip ? -1 : 1), alfa = o.alfa != null ? clamp(o.alfa) : 1, pxu = size;
  let punta = null;
  ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(rot); ctx.scale(sx, size);
  const trazo = o.trazo == null ? 1 : clamp(o.trazo);
  if (o.morphTo) {
    const B = o.morphTo; if (B.items.length !== doc.items.length) throw new SvgError('morph', `morph exige el mismo número de paths: «${doc.nombre}» tiene ${doc.items.length} y «${B.nombre}» tiene ${B.items.length}`, { remedio: 'Reparte o une paths hasta que coincidan' });
    const u = clamp(o.u ?? 0);
    doc.items.forEach((it, i) => { if (u <= 1e-3) pintaItem(ctx, it, R, pxu, alfa); else if (u >= 1 - 1e-3) pintaItem(ctx, B.items[i], R, pxu, alfa); else morphItem(ctx, it, B.items[i], u, R, pxu, alfa); });
  } else if (trazo >= 1) doc.items.forEach((it) => pintaItem(ctx, it, R, pxu, alfa));
  else if (trazo > 0) {
    const L = doc.items.map((it) => (it._len ??= shapeLength(it.shape))), tot = L.reduce((a, b) => a + b, 0) || 1, q = clamp(trazo / FASE_TRAZO);
    let acc = 0;
    doc.items.forEach((it, i) => {
      const a = acc / tot, b = (acc + L[i]) / tot; acc += L[i];
      const u = clamp((q - a) / Math.max(1e-9, b - a)); if (u <= 0) return;
      const fillA = clamp((trazo - b * FASE_TRAZO) / (1 - FASE_TRAZO)), colS = R(it.stroke, it.strokeRol) ?? R(it.fill, it.fillRol);
      if (u >= 1) { pintaItem(ctx, it, R, pxu, alfa, { fillA: fillA * fillA * (3 - 2 * fillA) }); punta = it.shape.contours.at(-1).d.slice(-2); }
      else if (colS) {                                              // en curso: solo el contorno, trazado hasta u
        ctx.save(); ctx.globalAlpha = alfa * it.opacity; ctx.strokeStyle = colS; aplicarEstilo(ctx, it, Math.max(it.stroke ? it.sw : 0.012, 0.7 / pxu)); ctx.beginPath(); traceTrim(ctx, it.shape, 0, u); ctx.stroke(); ctx.restore();
        punta = puntoEn(it.shape, u);
      }
    });
    if (!punta) punta = [0, 0];
  }
  if (!punta) { const l = doc.items.at(-1).shape.contours.at(-1); punta = l.d.slice(-2); }
  const m = ctx.getTransform(); ctx.restore();
  const P = (p) => ({ x: m.a * p[0] + m.c * p[1] + m.e, y: m.b * p[0] + m.d * p[1] + m.f });
  return { x: o.x, y: o.y, w: doc.w * size, h: doc.h * size, rot, punta: P(punta), centro: { x: o.x, y: o.y } };
}
function puntoEn(S, u) {                                          // punto a fracción u de la longitud total (la «pluma»)
  const cs = S.contours.map((c) => flatten(c, 10)), Ls = cs.map((p) => p.reduce((a, q, i) => (i ? a + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0), 0)), tot = Ls.reduce((a, b) => a + b, 0); let want = u * tot;
  for (let k = 0; k < cs.length; k++) { if (want > Ls[k]) { want -= Ls[k]; continue; } const p = cs[k]; let acc = 0; for (let i = 1; i < p.length; i++) { const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (acc + d >= want) { const t = d ? (want - acc) / d : 0; return [lerp(p[i - 1][0], p[i][0], t), lerp(p[i - 1][1], p[i][1], t)]; } acc += d; } return p.at(-1); }
  return S.contours.at(-1).d.slice(-2);
}

// ── 5 · DSL: validación de literales ─────────────────────────────────────────────────────────────────────────────
export const SVG_KEYS = ['svg', 'x', 'y', 'size', 'rot', 'flip', 'alfa', 'trazo', 'morphTo', 'u', 'roles', 'mono', 'label', 'fields'];
const isExpr = (v) => v && typeof v === 'object' && !Array.isArray(v) && '$expr' in v;
export function validateSvg(o, p, E, root = ROOT) {
  const docs = {};
  for (const k of ['svg', 'morphTo']) {
    const v = o[k]; if (v == null || isExpr(v)) continue;
    if (typeof v !== 'string') { E(`${p}/${k}`, `${k}: nombre de la biblioteca o ruta assets/….svg`); continue; }
    try { docs[k] = cargarSvg(v, root); } catch (e) { E(`${p}/${k}`, e.message, e.codigo === 'inexistente' ? hint(v, listaSvg(root)) : e.codigo === 'ruta' ? 'la ruta debe ser assets/….svg sin «..»' : 'sanea o simplifica el archivo'); }
  }
  if (docs.svg && docs.morphTo && docs.svg.paths !== docs.morphTo.paths) E(`${p}/morphTo`, `morph exige el mismo número de paths: «${docs.svg.nombre}» tiene ${docs.svg.paths} y «${docs.morphTo.nombre}» tiene ${docs.morphTo.paths}`);
  if (o.morphTo != null && o.u == null) E(`${p}/u`, 'morphTo necesita u (0..1)');
  if (o.roles != null) { if (!o.roles || typeof o.roles !== 'object' || Array.isArray(o.roles)) E(`${p}/roles`, 'roles: objeto {"#hex o rol del archivo": "rol de paleta"}'); else for (const [k, v] of Object.entries(o.roles)) if (!isExpr(v) && !(typeof v === 'string' && ROL.test(v))) E(`${p}/roles/${k}`, 'el destino debe ser un rol de paleta o un hex'); }
  if (o.mono != null && !isExpr(o.mono) && !(typeof o.mono === 'string' && ROL.test(o.mono))) E(`${p}/mono`, 'mono: un rol de paleta o un hex');
}

// ── 6 · meta uniforme para el toolbox: una ficha por SVG de la biblioteca ────────────────────────────────────────
export const META = SVG_LIB.map((id) => {
  const doc = cargarSvg(id, ROOT);
  return { id: `svg_${id}`, kind: 'objeto', resumen: (doc.titulo || `SVG ${id}`).split(/\s+/).slice(0, 15).join(' '), tags: [...new Set(['svg', 'vector', id, ...doc.tags])].map((t) => t.toLowerCase()),
    params: { x: 'number', y: 'number', size: 'number', rot: 'number', trazo: 'number', roles: 'json', mono: 'string', morphTo: 'string' },
    cuando: `elemento vectorial «${id}» (assets/svg/${id}.svg, ${doc.paths} paths): se traza con trazo 0..1, se recolorea con los roles del medio y hace morph con otro SVG de igual nº de paths`,
    ejemplo: `{"type":"svg","svg":"${id}","x":{"$expr":"S_cx"},"y":{"$expr":"S_cy"},"size":320,"trazo":{"$expr":"seg(lt, 0, 2)"}}`, siguiente: ['cli:peek'] };
});
