#!/usr/bin/env node
// Generadores de diagramas (spec 020): una lista CORTA de nodos/aristas o de filas → el JSON del escenario DSL (tipo `box` con rótulo, `arrow`, `text`, `focus`).
// Sustituye las 450–700 líneas de JSON a mano de una lámina: el agente escribe `shots/<ID>.diagrama.json` (≈ 25 líneas) y el motor emite `shots/<ID>.scene.json` + `.mjs`.
//   node engine/diagramas.mjs build <shots/X.diagrama.json> | --all [--check]     emite X.scene.json (y X.mjs); --check: falla si está desactualizado
//   node engine/diagramas.mjs new <id> --receta diagrama_flujo|diagrama_capas|barras_antes_despues [--force]   escribe un ejemplo editable (también: opus new shot <id> --receta …)
//   node engine/diagramas.mjs list | show <receta>
// Recetas: diagrama_flujo (nodos [título, línea1, línea2, rol] + aristas o cadena; disposición serpiente|fila|columna|cuadricula) ·
//          diagrama_capas (capas [nombre, resumen, rol, [módulos], contrato, [destacados]]) · barras_antes_despues (filas [nombre, sub, antes, después, unidad, prefijo]).
// Coordenadas por EXPRESIONES de W/H/k (independientes de la resolución; diseño 1920×1080). PURO y determinista: mismos datos → mismo JSON byte a byte.
import { isMain, rootFrom } from './paths.mjs';
import './help.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { validateScene } from './dsl-core.mjs';
import { validateMeta } from './toolbox.mjs';

export const ROOT = rootFrom(import.meta.url);
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const fx = (px) => r4(px / 1920), fy = (px) => r4(px / 1080);
const E = (src) => ({ $expr: src });
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 0; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
const sugerir = (w, cs) => { let best = null, bd = 1e9; for (const c of cs) { const d = lev(String(w).toLowerCase(), String(c).toLowerCase()); if (d < bd) { bd = d; best = c; } } return best != null && bd <= Math.max(2, Math.floor(String(w).length / 2)) ? `¿quisiste decir "${best}"?` : `válidos: ${cs.join(' ')}`; };
class DiagramaError extends Error { constructor(receta, ruta, msg, ayuda) { super(`${receta} ${ruta}: ${msg}${ayuda ? ' → ' + ayuda : ''}`); this.name = 'DiagramaError'; } }
const ROL = /^(#[0-9a-fA-F]{3,8}|[a-z][a-z0-9]*)$/;

// ── piezas comunes ───────────────────────────────────────────────────────────────────────────────────────────────
const titulo = (spec) => ({ id: 'titulo', type: 'text', text: spec.titulo ?? { $shot: 'text' }, x: E('W / 2'), y: E(`H * ${fy(100)}`), role: 'h2', color: 'ink' });
function leyenda(items, x0 = 470, paso = 430, y = 162) {
  const out = [];
  items.forEach(([c, t], i) => {
    const px = x0 + i * paso;
    out.push({ type: 'shape', shape: 'rect', x: E(`W * ${fx(px)}`), y: E(`H * ${fy(y)}`), w: E('k * 22'), h: E('k * 22'), color: c },
      { type: 'text', text: t, x: E(`W * ${fx(px + 36)}`), y: E(`H * ${fy(y + 11)}`), role: 'label', color: 'ink', align: 'left' });
  });
  return out;
}
function checkLeyenda(R, L) {
  if (L == null) return;
  if (!Array.isArray(L)) throw new DiagramaError(R, '/leyenda', 'debe ser una lista [[rol, texto], …]');
  L.forEach((x, i) => { if (!Array.isArray(x) || typeof x[1] !== 'string' || !ROL.test(String(x[0]))) throw new DiagramaError(R, `/leyenda/${i}`, 'esperaba [rol de paleta, texto]'); });
}
function checkClaves(R, spec, ok) { for (const k of Object.keys(spec)) if (!ok.includes(k)) throw new DiagramaError(R, `/${k}`, `propiedad desconocida «${k}»`, sugerir(k, ok)); }
const scene = (spec, receta, objects) => ({ dsl: 1, id: spec.id, doc: `[receta:${receta}] ${spec.doc ? spec.doc + ' ' : ''}GENERADO desde shots/${spec.id}.diagrama.json por \`node engine/diagramas.mjs build\` (spec 020): edita ese archivo y regenera.`, objects });
const fmtNum = (n) => { const s = String(Math.round(n * 100) / 100).replace('.', ','), [e, d] = s.split(','); return e.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (d ? ',' + d : ''); };
const fmtVal = (v, unidad = '', pre = '') => `${pre}${fmtNum(v)}${unidad ? ' ' + unidad : ''}`;
const idOk = (R, spec) => { if (typeof spec.id !== 'string' || !/^[A-Za-z][A-Za-z0-9]*$/.test(spec.id)) throw new DiagramaError(R, '/id', 'falta «id» (letras y dígitos: el id del shot)'); };

// ── disposición ──────────────────────────────────────────────────────────────────────────────────────────────────
export const DISPOSICIONES = ['serpiente', 'fila', 'columna', 'cuadricula'];
// n nodos → [{c, f}] (columna y fila visuales). serpiente: filas alternas en sentido contrario; fila: 1 fila; columna: 1 columna.
export function disponer(n, modo = 'serpiente', cols = 4) {
  if (!DISPOSICIONES.includes(modo)) throw new Error(`disposición desconocida «${modo}»: ${sugerir(modo, DISPOSICIONES)}`);
  const C = modo === 'fila' ? n : modo === 'columna' ? 1 : Math.max(1, Math.min(cols, n));
  return Array.from({ length: n }, (_, i) => { const f = Math.floor(i / C), j = i % C; return { c: modo === 'serpiente' && f % 2 ? C - 1 - j : j, f }; });
}

// ── diagrama_flujo ───────────────────────────────────────────────────────────────────────────────────────────────
const FLUJO_KEYS = ['receta', 'id', 'doc', 'titulo', 'disposicion', 'cols', 'numerar', 'leyenda', 'nodos', 'aristas'];
function flujo(spec) {
  const R = 'diagrama_flujo'; checkClaves(R, spec, FLUJO_KEYS); idOk(R, spec); checkLeyenda(R, spec.leyenda);
  if (!Array.isArray(spec.nodos) || !spec.nodos.length) throw new DiagramaError(R, '/nodos', 'falta la lista «nodos» (no vacía): [[título, línea1, línea2, rol], …]');
  const nodos = spec.nodos.map((n, i) => {                                  // [título, línea1, línea2, rol] | {t, l:[…], c}
    const [t, l1, l2, c] = Array.isArray(n) ? n : [n?.t ?? n?.titulo, ...(n?.l ?? []).slice(0, 2), ...Array(Math.max(0, 2 - (n?.l ?? []).length)).fill(''), n?.c ?? n?.color];
    if (typeof t !== 'string' || !t) throw new DiagramaError(R, `/nodos/${i}`, 'el nodo necesita un título (texto): [título, línea1, línea2, rol]');
    if (c != null && !ROL.test(String(c))) throw new DiagramaError(R, `/nodos/${i}/3`, `rol «${c}» no válido (rol de paleta o hex)`);
    return { t, lab: [t, l1, l2].filter((x) => typeof x === 'string' && x !== '').join('\n'), c: c ?? 'ink' };
  });
  const N = nodos.length, modo = spec.disposicion ?? 'serpiente', pos = (() => { try { return disponer(N, modo, spec.cols ?? Math.min(4, N)); } catch (e) { throw new DiagramaError(R, '/disposicion', `disposición desconocida «${modo}»`, sugerir(modo, DISPOSICIONES)); } })();
  const C = Math.max(...pos.map((p) => p.c)) + 1, F = Math.max(...pos.map((p) => p.f)) + 1;
  const colW = 0.88 / C, rowH = 0.71 / F, bw = r4(Math.min(colW * 0.84, 0.3)), bh = r4(Math.min(0.17, rowH * 0.66));
  const x0 = 0.06, y0 = 0.225, cx = (c) => r4(x0 + colW * (c + 0.5)), cy = (f) => r4(y0 + rowH * (f + 0.5)), delay = (i) => r4(0.2 + i * 0.3);
  const ref = (v, ruta) => { const i = typeof v === 'number' ? v : nodos.findIndex((n) => n.t === v); if (!Number.isInteger(i) || i < 0 || i >= N) throw new DiagramaError(R, ruta, `nodo «${v}» no existe`, sugerir(String(v), nodos.map((n) => n.t))); return i; };
  const aristas = spec.aristas == null ? nodos.slice(1).map((_, i) => [i, i + 1]) : spec.aristas.map((a, j) => { if (!Array.isArray(a) || a.length < 2) throw new DiagramaError(R, `/aristas/${j}`, 'esperaba [origen, destino] (título o índice)'); return [ref(a[0], `/aristas/${j}/0`), ref(a[1], `/aristas/${j}/1`)]; });
  const numerar = spec.numerar !== false, pad = 0.004;
  const filas = nodos.map((n, i) => [cx(pos[i].c), cy(pos[i].f), bw, bh, numerar ? String(i + 1).padStart(2, '0') : '', n.lab, n.c, delay(i)]);
  const flechas = aristas.map(([a, b]) => {
    const A = filas[a], B = filas[b], dx = (B[0] - A[0]) * 1920, dy = (B[1] - A[1]) * 1080, L = Math.hypot(dx, dy) || 1;
    const sal = (w, h) => Math.min(dx ? (w * 1920 / 2) / Math.abs(dx) : Infinity, dy ? (h * 1080 / 2) / Math.abs(dy) : Infinity), ta = sal(A[2], A[3]) + pad * 1920 / L * 1.2, tb = sal(B[2], B[3]) + pad * 1920 / L * 1.2;
    return [r4(A[0] + (B[0] - A[0]) * ta), r4(A[1] + (B[1] - A[1]) * ta), r4(B[0] - (B[0] - A[0]) * tb), r4(B[1] - (B[1] - A[1]) * tb), A[6], r4(Math.max(A[7], B[7]) + 0.12)];
  });
  const objs = [titulo(spec), ...(spec.leyenda ? leyenda(spec.leyenda) : [])];
  objs.push({ id: 'b', type: 'repeat', items: filas, fields: ['x', 'y', 'w', 'h', 'n', 't', 'c', 'd'], children: [
    { type: 'box', x: E('(b_x - b_w / 2) * W'), y: E('(b_y - b_h / 2) * H'), w: E('b_w * W'), h: E('b_h * H'), label: E('b_t'), tag: E('b_n'), color: E('b_c'), fill: 'paper', banda: 9, lw: 3, sombra: true, alpha: E('seg(lt, b_d, b_d + 0.45)') }] });
  if (flechas.length) objs.push({ id: 'a', type: 'repeat', items: flechas, fields: ['x0', 'y0', 'x1', 'y1', 'c', 'd'], children: [
    { type: 'arrow', x0: E('a_x0 * W'), y0: E('a_y0 * H'), x1: E('a_x1 * W'), y1: E('a_y1 * H'), u: E('seg(lt, a_d, a_d + 0.4)'), color: E('a_c') }] });
  objs.push({ type: 'focus', x: E(`W * ${r4(x0 + 0.003)}`), y: E(`H * ${r4(y0)}`), w: E(`W * ${r4(0.88)}`), h: E(`H * ${r4(0.71)}`), label: 'diagrama', weight: 1, hollow: true });
  return scene(spec, R, objs);
}

// ── diagrama_capas ───────────────────────────────────────────────────────────────────────────────────────────────
const CAPAS_KEYS = ['receta', 'id', 'doc', 'titulo', 'leyenda', 'capas'];
function capas(spec) {
  const R = 'diagrama_capas'; checkClaves(R, spec, CAPAS_KEYS); idOk(R, spec); checkLeyenda(R, spec.leyenda);
  if (!Array.isArray(spec.capas) || !spec.capas.length) throw new DiagramaError(R, '/capas', 'falta la lista «capas» (no vacía): [[nombre, resumen, rol, [módulos], contrato, [destacados]], …]');
  const n = spec.capas.length, pitch = Math.min(122, 756 / n), top = 594 - ((n - 1) * pitch) / 2, chipH = Math.min(58, pitch * 0.44), L = [], CH = [], CT = [];
  spec.capas.forEach((c, i) => {
    if (!Array.isArray(c) || typeof c[0] !== 'string') throw new DiagramaError(R, `/capas/${i}`, 'esperaba [nombre, resumen, rol, [módulos], contrato, [destacados]]');
    const [nombre, resumen = '', rol = 'accent2', mods = [], contrato = '', dest = []] = c;
    if (!Array.isArray(mods) || mods.some((m) => typeof m !== 'string')) throw new DiagramaError(R, `/capas/${i}/3`, 'los módulos son una lista de textos');
    for (const d of dest) if (!mods.includes(d)) throw new DiagramaError(R, `/capas/${i}/5`, `destacado «${d}» no es un módulo de la capa`, sugerir(d, mods));
    const cy = top + i * pitch, d0 = r4(0.2 + i * 0.55);
    L.push([fy(cy), fy(pitch * 0.9), resumen ? `${nombre}\n${resumen}` : nombre, rol, d0]);
    let x = 490; mods.forEach((m, j) => { const w = Math.round(13.3 * [...m].length + 54); CH.push([fx(x + w / 2), fy(cy - 16), fx(w), fy(chipH), m, dest.includes(m) ? 'accent' : 'ink', r4(d0 + 0.25 + j * 0.12)]); x += w + 22; });
    if (contrato) CT.push([fx(490), fy(cy + 34), contrato, r4(d0 + 0.9)]);
  });
  const objs = [titulo(spec), ...(spec.leyenda ? leyenda(spec.leyenda, 1180, 430, 154) : [])];
  objs.push({ id: 'l', type: 'repeat', items: L, fields: ['y', 'h', 't', 'c', 'd'], children: [
    { type: 'box', x: E(`W * ${fx(115)}`), y: E('(l_y - l_h / 2) * H'), w: E(`W * ${fx(345)}`), h: E('l_h * H'), label: E('l_t'), color: E('l_c'), fill: 'paper', banda: 0, lw: 3, sombra: true, alpha: E('seg(lt, l_d, l_d + 0.45)') }] });
  if (CH.length) objs.push({ id: 'c', type: 'repeat', items: CH, fields: ['x', 'y', 'w', 'h', 't', 'c', 'd'], children: [
    { type: 'box', x: E('(c_x - c_w / 2) * W'), y: E('(c_y - c_h / 2) * H'), w: E('c_w * W'), h: E('c_h * H'), label: E('c_t'), color: E('c_c'), fill: 'paper', lw: 2, alpha: E('seg(lt, c_d, c_d + 0.4)') }] });
  if (CT.length) objs.push({ id: 't', type: 'repeat', items: CT, fields: ['x', 'y', 't', 'd'], children: [
    { type: 'text', text: E('t_t'), x: E('t_x * W'), y: E('t_y * H'), role: 'label', color: 'ink', alpha: E('0.8 * seg(lt, t_d, t_d + 0.5)'), align: 'left' }] });
  objs.push({ type: 'focus', x: E(`W * ${fx(115)}`), y: E(`H * ${fy(top - pitch * 0.45)}`), w: E(`W * ${fx(1450)}`), h: E(`H * ${fy(pitch * n * 0.97)}`), label: 'capas', weight: 1, hollow: true });
  return scene(spec, R, objs);
}

// ── barras_antes_despues ─────────────────────────────────────────────────────────────────────────────────────────
const BARRAS_KEYS = ['receta', 'id', 'doc', 'titulo', 'leyenda', 'etiquetas', 'filas'];
// mejora: −N % si baja (< ×20), ÷N si baja ≥ ×20; × N si sube ≥ ×20, +N % si sube menos
export function mejora(antes, despues) {
  const bajo = despues < antes, f = bajo ? antes / Math.max(despues, 1e-12) : despues / Math.max(antes, 1e-12);
  if (f >= 20) return `${bajo ? '÷' : '×'} ${Math.round(f)}`;
  return bajo ? `−${Math.round((1 - despues / antes) * 100)} %` : `+${Math.round((despues / antes - 1) * 100)} %`;
}
export const escalaFila = (antes, despues) => { const m = Math.max(antes, despues); return [antes / m, despues / m]; };
function barras(spec) {
  const R = 'barras_antes_despues'; checkClaves(R, spec, BARRAS_KEYS); idOk(R, spec); checkLeyenda(R, spec.leyenda);
  if (!Array.isArray(spec.filas) || !spec.filas.length) throw new DiagramaError(R, '/filas', 'falta la lista «filas» (no vacía): [[nombre, sub, antes, después, unidad, prefijo], …]');
  const n = spec.filas.length, pitch = Math.min(135, 760 / n), top = 636 - (n * pitch) / 2, barH = Math.min(36, pitch * 0.3), [eA, eD] = spec.etiquetas ?? ['antes', 'después'];
  const rows = spec.filas.map((f, i) => {
    const [nombre, sub = '', a, d, unidad = '', pre = ''] = Array.isArray(f) ? f : [];
    if (typeof nombre !== 'string' || !(typeof a === 'number' && a > 0) || !(typeof d === 'number' && d > 0)) throw new DiagramaError(R, `/filas/${i}`, 'esperaba [nombre, sub, antes > 0, después > 0, unidad?, prefijo?] con cifras numéricas');
    const [sa, sd] = escalaFila(a, d);
    return [fy(top + i * pitch), nombre, sub, r4(sa), r4(sd), fmtVal(a, unidad, pre), fmtVal(d, unidad, pre), mejora(a, d), r4(0.2 + i * 0.5)];
  });
  const X0 = 700, LONG = 700, bh = fy(barH), off = fy(Math.min(52, pitch * 0.43));
  const objs = [titulo(spec), ...leyenda(spec.leyenda ?? [['ink', eA], ['accent2', eD], ['accent', 'mejora']])];
  const A = (e) => E(`seg(lt, r_d, r_d + 0.4) * ${e}`), tx = (t, x, y, role, extra = {}) => ({ type: 'text', text: t, x, y, role, color: 'ink', alpha: A(extra.a ?? 1), align: extra.align ?? 'left' });
  objs.push({ id: 'r', type: 'repeat', items: rows, fields: ['y', 'n', 's', 'wa', 'wd', 'ta', 'td', 'f', 'd'], children: [
    tx(E('r_n'), E(`W * ${fx(125)}`), E(`(r_y + ${fy(26)}) * H`), 'body'), tx(E('r_s'), E(`W * ${fx(125)}`), E(`(r_y + ${fy(64)}) * H`), 'label', { a: 0.8 }),
    tx(eA, E(`W * ${fx(684)}`), E(`(r_y + ${fy(18)}) * H`), 'label', { a: 0.8, align: 'right' }), tx(eD, E(`W * ${fx(684)}`), E(`(r_y + ${off + fy(18)}) * H`), 'label', { a: 0.8, align: 'right' }),
    { type: 'box', x: E(`W * ${fx(X0)}`), y: E('r_y * H'), w: E(`W * ${fx(LONG)} * r_wa * seg(lt, r_d, r_d + 0.8)`), h: E(`H * ${bh}`), color: 'ink', fill: 'ink', fillAlpha: 0.35, lw: 2, alpha: A(1) },
    { type: 'box', x: E(`W * ${fx(X0)}`), y: E(`(r_y + ${off}) * H`), w: E(`W * ${fx(LONG)} * r_wd * seg(lt, r_d + 0.3, r_d + 1.1)`), h: E(`H * ${bh}`), color: 'accent2', fill: 'accent2', fillAlpha: 1, lw: 0, alpha: A(1) },
    tx(E('r_ta'), E(`W * ${fx(X0 + 14)} + W * ${fx(LONG)} * r_wa`), E(`(r_y + ${fy(18)}) * H`), 'label'), tx(E('r_td'), E(`W * ${fx(X0 + 14)} + W * ${fx(LONG)} * r_wd`), E(`(r_y + ${off + fy(18)}) * H`), 'label'),
    { type: 'text', text: E('r_f'), x: E(`W * ${fx(1716)}`), y: E(`(r_y + ${r4((off + bh) / 2 + fy(2))}) * H`), role: 'h2', color: 'accent', alpha: E('seg(lt, r_d + 1, r_d + 1.5)'), align: 'center' }] });
  objs.push({ type: 'focus', x: E(`W * ${fx(125)}`), y: E(`H * ${fy(top - 10)}`), w: E(`W * ${fx(1670)}`), h: E(`H * ${fy(pitch * n)}`), label: 'barras', weight: 1, hollow: true });
  return scene(spec, R, objs);
}

// ── catálogo ─────────────────────────────────────────────────────────────────────────────────────────────────────
export const RECETAS = [
  { meta: { id: 'diagrama_flujo', grupo: 'generador', resumen: 'diagrama de flujo en serpiente desde una lista de nodos y aristas', tags: ['diagrama', 'flujo', 'pipeline', 'proceso', 'cajas', 'flechas', 'lamina'], params: { nodos: 'json', aristas: 'json', disposicion: 'string' }, cuando: 'un proceso por etapas (pipeline, ciclo, cadena de pasos) que se lee de un vistazo, sin escribir 450 líneas de JSON' }, gen: flujo,
    ejemplo: { receta: 'diagrama_flujo', id: 'X01', doc: 'Qué pasa de la idea al resultado.', disposicion: 'serpiente', cols: 3, leyenda: [['accent2', 'lo decide una persona'], ['ink', 'lo hace el código']], nodos: [['idea', 'una frase', 'un porqué', 'accent2'], ['prueba', 'en rojo primero', '', 'ink'], ['código', 'lo mínimo', 'que la pase', 'ink'], ['nota', '1–10 y comentario', '', 'accent2']] } },
  { meta: { id: 'diagrama_capas', grupo: 'generador', resumen: 'arquitectura por capas: nombre, módulos y contrato de cada una', tags: ['diagrama', 'capas', 'arquitectura', 'modulos', 'sistema', 'lamina'], params: { capas: 'json' }, cuando: 'un sistema explicado de arriba abajo: cada capa con sus piezas y la regla que no se negocia' }, gen: capas,
    ejemplo: { receta: 'diagrama_capas', id: 'X02', doc: 'Capas del sistema.', leyenda: [['accent', 'invariante que no se negocia']], capas: [['gobierno', 'quién puede qué', 'accent2', ['ledger', 'gate', 'roles'], 'contrato: ningún master sin lint SHIP', ['gate']], ['render', 'tiempo → imagen', 'accent2', ['seek(t)', 'caché'], 'contrato: mismo t → mismos píxeles', ['seek(t)']]] } },
  { meta: { id: 'barras_antes_despues', grupo: 'generador', resumen: 'barras antes y después, cada fila a su escala, con la mejora calculada', tags: ['diagrama', 'barras', 'antes', 'despues', 'comparar', 'medida', 'lamina'], params: { filas: 'json', etiquetas: 'json' }, cuando: 'cifras medidas antes y después de un cambio; la mejora (−50 %, ÷47, ×30) sale de las cifras' }, gen: barras,
    ejemplo: { receta: 'barras_antes_despues', id: 'X03', doc: 'Lo medido, antes y después.', filas: [['master en frío', 'reloj de pared', 167, 84, 's'], ['cobertura DSL', 'shots en DSL nativo', 3.2, 95.2, '%']] } },
];
for (const r of RECETAS) { const p = validateMeta(r.meta); if (p.length) throw new Error(`receta ${r.meta.id}: ${p.join('; ')}`); }
export const GENERADORES = new Map(RECETAS.map((r) => [r.meta.id, r]));
export function generar(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new DiagramaError('diagrama', '/', 'el archivo debe ser un objeto {receta, id, …}');
  const r = GENERADORES.get(spec.receta); if (!r) throw new DiagramaError('diagrama', '/receta', `receta «${spec.receta}» desconocida`, sugerir(String(spec.receta), [...GENERADORES.keys()]));
  const sc = r.gen(spec), f = validateScene(sc); if (f.length) throw new DiagramaError(spec.receta, f[0].path, `el escenario generado no valida: ${f[0].message}`);
  return sc;
}
export function serializar(sc) {
  const J = JSON.stringify, L = [];
  for (const [k, v] of Object.entries(sc)) { if (k === 'objects') L.push(` "objects": [\n${v.map((o) => `  ${J(o)}`).join(',\n')}\n ]`); else L.push(` ${J(k)}: ${J(v)}`); }
  return '{\n' + L.join(',\n') + '\n}\n';
}
export const entradasRegistro = () => RECETAS.map((r) => { const m = r.meta, ps = Object.entries(m.params).map(([k, t]) => `${k}:${t}`).join(', ');
  return { id: `receta:${m.id}`, kind: 'receta', resumen: m.resumen, tags: m.tags, cuando: m.cuando, entra: ps, sale: 'shots/<id>.diagrama.json (≈ 25 líneas) → shots/<id>.scene.json generado',
    uso: `node engine/opus.mjs new shot <id> --receta ${m.id}   (edita shots/<id>.diagrama.json y: node engine/diagramas.mjs build shots/<id>.diagrama.json)`, ejemplo: `node engine/opus.mjs new shot X1 --receta ${m.id}`, siguiente: ['cli:lint'], src: 'engine/diagramas.mjs' }; });

// ── build / new ──────────────────────────────────────────────────────────────────────────────────────────────────
export async function build(rel, { root = ROOT, check = false } = {}) {
  const src = path.join(root, rel), spec = JSON.parse(fs.readFileSync(src, 'utf8')), out = rel.replace(/\.diagrama\.json$/, '.scene.json'), code = serializar(generar(spec));
  if (path.basename(rel, '.diagrama.json') !== spec.id) throw new DiagramaError(spec.receta, '/id', `el id «${spec.id}» no casa con el nombre del archivo «${path.basename(rel)}»`);
  const cur = fs.existsSync(path.join(root, out)) ? fs.readFileSync(path.join(root, out), 'utf8') : null, changed = cur !== code;
  if (changed && !check) fs.writeFileSync(path.join(root, out), code);
  const { build: buildShot } = await import('./dsl.mjs'), m = changed && check ? { changed: true } : buildShot(out, { root, check });
  return { scene: out, changed: changed || m.changed };
}
export const diagramaFiles = (root = ROOT) => fs.readdirSync(path.join(root, 'shots')).filter((f) => f.endsWith('.diagrama.json')).sort().map((f) => path.join('shots', f));
export async function nuevo(id, receta, { root = ROOT, force = false } = {}) {
  const r = GENERADORES.get(receta); if (!r) throw new DiagramaError('diagrama', '/receta', `receta «${receta}» desconocida`, sugerir(String(receta), [...GENERADORES.keys()]));
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(id)) throw new Error(`id «${id}» no válido para un diagrama (letras y dígitos)`);
  const rel = `shots/${id}.diagrama.json`, abs = path.join(root, rel);
  if (!force && (fs.existsSync(abs) || fs.existsSync(path.join(root, `shots/${id}.scene.json`)))) throw new Error(`${rel} (o shots/${id}.scene.json) ya existe: no se pisa; usa --force`);
  const ej = JSON.parse(JSON.stringify(r.ejemplo)); ej.id = id;
  const linea = (v) => JSON.stringify(v), L = Object.entries(ej).map(([k, v]) => Array.isArray(v) && v.length && Array.isArray(v[0]) ? `  ${linea(k)}: [\n${v.map((x) => `   ${linea(x)}`).join(',\n')}\n  ]` : `  ${linea(k)}: ${linea(v)}`);
  fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, '{\n' + L.join(',\n') + '\n}\n');
  const res = await build(rel, { root }); return { rel, ...res };
}
export async function cli(args) {
  const [cmd, ...rest] = args;
  try {
    if (cmd === 'build') {
      const check = rest.includes('--check'), files = rest.includes('--all') ? diagramaFiles() : rest.filter((x) => !x.startsWith('--')); let bad = 0;
      if (!files.length) { console.error('uso: diagramas.mjs build <shots/X.diagrama.json> | --all [--check]'); return 1; }
      for (const f of files) { const r = await build(f, { check }); console.log(`${r.changed ? (check ? 'DESACTUALIZADO' : 'generado') : 'al día'} ${r.scene}`); if (r.changed && check) bad++; }
      return bad ? 1 : 0;
    }
    if (cmd === 'new') {
      const id = rest.find((x, i) => !x.startsWith('--') && rest[i - 1] !== '--receta'), receta = rest[rest.indexOf('--receta') + 1];
      if (!id || !receta || rest.indexOf('--receta') < 0) { console.error(`uso: diagramas.mjs new <id> --receta ${[...GENERADORES.keys()].join('|')} [--force]`); return 1; }
      const r = await nuevo(id, receta, { force: rest.includes('--force') });
      console.log(`${r.rel} (ejemplo editable de ${receta}) → ${r.scene} + shots/${id}.mjs\nsiguiente: edita ${r.rel} → node engine/diagramas.mjs build ${r.rel} → añade el shot ${id} al timeline (perfil lamina) → npm run lint`); return 0;
    }
    if (cmd === 'list') { for (const r of RECETAS) console.log(`${r.meta.id.padEnd(22)} ${r.meta.resumen}`); return 0; }
    if (cmd === 'show') { const r = GENERADORES.get(rest[0]); if (!r) { console.error(`receta «${rest[0]}» no existe: ${sugerir(String(rest[0]), [...GENERADORES.keys()])}`); return 1; } console.log(JSON.stringify(r.ejemplo, null, 1)); return 0; }
  } catch (e) { console.error('✗ ' + e.message); return 1; }
  console.error('uso: diagramas.mjs build <f.diagrama.json>|--all [--check] | new <id> --receta r [--force] | list | show <receta>'); return cmd ? 1 : 0;
}
if (isMain(import.meta.url)) process.exit(await cli(process.argv.slice(2)));
