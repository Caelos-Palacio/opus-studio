// Capas de overrides (F4, LIVRPS simplificado de USD) + JSON Patch (RFC 6902) + cookKey de un shot. Puro (sin builtins).
//   resolve(timeline, layers, {variants}) → { timeline (resuelto), trace (qué cambió cada capa), base }   — una vez por carga;
//   seek(t) trabaja sobre lo resuelto. Orden de fuerza (gana la última):  base (timeline) < variant < agent < user;
//   dentro de un mismo tipo: priority ascendente, luego name. Deshacer = quitar (o enabled:false) la capa.
// Las rutas de las capas apuntan a una VISTA del timeline donde shots es un mapa por id (no un array):
//   /shots/<id>/params/<nombre>   /shots/<id>/meta/...   /signals/<nombre>/...   /style   …
// Contrato completo: docs/PARAMS.md.
import { shotSignals } from './signal.mjs';

export const LAYER_KINDS = { variant: 1, agent: 2, user: 3 };
export class LayerError extends Error { constructor(msg, { layer = '', op = -1, path = '' } = {}) { super(`capa "${layer}"${op >= 0 ? ` op #${op}` : ''}${path ? ` (${path})` : ''}: ${msg}`); this.name = 'LayerError'; this.layer = layer; this.path = path; } }

// ── JSON Pointer / Patch ─────────────────────────────────────────────────────────────────────────────────────────
export const parsePointer = (p) => {
  if (p === '') return [];
  if (typeof p !== 'string' || p[0] !== '/') throw new Error(`ruta JSON Pointer inválida "${p}" (debe empezar por /)`);
  return p.slice(1).split('/').map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
};
export const toPointer = (keys) => keys.map((k) => '/' + String(k).replace(/~/g, '~0').replace(/\//g, '~1')).join('');
const isObj = (x) => x !== null && typeof x === 'object';
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
export const deepEqual = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
export function canon(x) { if (Array.isArray(x)) return x.map(canon); if (isObj(x)) return Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])])); return x; }

export function getPointer(doc, ptr) {
  let cur = doc;
  for (const k of parsePointer(ptr)) {
    if (Array.isArray(cur) && /^\d+$/.test(k) && +k < cur.length) cur = cur[+k];
    else if (isObj(cur) && !Array.isArray(cur) && Object.hasOwn(cur, k)) cur = cur[k];
    else return { found: false, value: undefined };
  }
  return { found: true, value: cur };
}
// Aplica ops RFC 6902 (add, remove, replace, move, copy, test) sobre una COPIA: atómico (si una op falla, nada cambia).
export function applyPatch(doc, ops, { layer = '' } = {}) {
  if (!Array.isArray(ops)) throw new LayerError('ops debe ser un array RFC 6902', { layer });
  let root = clone(doc);
  const E = (m, i, path) => new LayerError(m, { layer, op: i, path });
  const parent = (keys, i, path) => {
    let cur = root;
    for (const k of keys.slice(0, -1)) {
      const nx = Array.isArray(cur) ? (/^\d+$/.test(k) ? cur[+k] : undefined) : isObj(cur) && Object.hasOwn(cur, k) ? cur[k] : undefined;
      if (!isObj(nx)) throw E(`no existe el contenedor "${k}"`, i, path);
      cur = nx;
    }
    return cur;
  };
  const idx = (arr, k, i, path, add) => {
    if (add && k === '-') return arr.length;
    if (!/^(0|[1-9]\d*)$/.test(k)) throw E(`índice de array inválido "${k}"`, i, path);
    const n = +k; if (n > arr.length || (!add && n >= arr.length)) throw E(`índice ${n} fuera de rango (longitud ${arr.length})`, i, path);
    return n;
  };
  const add = (path, value, i) => {
    const keys = parsePointer(path); if (!keys.length) throw E('no se reemplaza el documento entero', i, path);
    const p = parent(keys, i, path), k = keys[keys.length - 1];
    if (Array.isArray(p)) p.splice(idx(p, k, i, path, true), 0, value); else p[k] = value;
  };
  const remove = (path, i) => {
    const keys = parsePointer(path); if (!keys.length) throw E('no se borra el documento entero', i, path);
    const p = parent(keys, i, path), k = keys[keys.length - 1];
    if (Array.isArray(p)) return p.splice(idx(p, k, i, path, false), 1)[0];
    if (!Object.hasOwn(p, k)) throw E(`no existe "${k}" (remove/replace exigen que exista)`, i, path);
    const v = p[k]; delete p[k]; return v;
  };
  ops.forEach((o, i) => {
    if (!isObj(o) || typeof o.path !== 'string') throw E('op sin path', i, '');
    const path = o.path;
    try { parsePointer(path); if (o.from !== undefined) parsePointer(o.from); } catch (e) { throw E(e.message, i, path); }
    switch (o.op) {
      case 'add': if (!('value' in o)) throw E('add sin value', i, path); add(path, clone(o.value), i); break;
      case 'remove': remove(path, i); break;
      case 'replace': if (!('value' in o)) throw E('replace sin value', i, path); remove(path, i); add(path, clone(o.value), i); break;
      case 'move': { if (path === o.from || path.startsWith(o.from + '/')) throw E('move dentro de sí mismo', i, path); add(path, remove(o.from, i), i); break; }
      case 'copy': { const g = getPointer(root, o.from); if (!g.found) throw E(`copy: no existe ${o.from}`, i, path); add(path, clone(g.value), i); break; }
      case 'test': { const g = getPointer(root, path); if (!g.found || !deepEqual(g.value, o.value)) throw E(`test falló: ${JSON.stringify(g.value)?.slice(0, 60)} ≠ ${JSON.stringify(o.value)?.slice(0, 60)}`, i, path); break; }
      default: throw E(`op desconocida "${o.op}" (add remove replace move copy test)`, i, path);
    }
  });
  return root;
}

// ── vista con shots por id ↔ timeline ────────────────────────────────────────────────────────────────────────────
export function toDoc(tl) {
  const shots = {};
  for (const s of tl.shots ?? []) { if (Object.hasOwn(shots, s.id)) throw new LayerError(`id de shot duplicado "${s.id}": las capas direccionan shots por id`, { layer: 'base' }); shots[s.id] = s; }
  return { ...tl, shots };
}
export function fromDoc(doc, order) {
  const S = doc.shots ?? {}, ids = [...order.filter((id) => Object.hasOwn(S, id)), ...Object.keys(S).filter((id) => !order.includes(id))];
  return { ...doc, shots: ids.map((id) => { const s = S[id]; if (!isObj(s)) throw new LayerError(`/shots/${id} no es un objeto`); if (s.id !== undefined && s.id !== id) throw new LayerError(`/shots/${id}/id = "${s.id}" no casa con su clave`); return s.id === id ? s : { id, ...s }; }) };
}

// Hojas que difieren entre a y b (rutas JSON Pointer). Los arrays se comparan enteros (una ruta por array cambiado).
export function diffPaths(a, b, keys = [], out = []) {
  if (deepEqual(a, b)) return out;
  if (isObj(a) && isObj(b) && !Array.isArray(a) && !Array.isArray(b)) { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diffPaths(a[k], b[k], [...keys, k], out); return out; }
  out.push(toPointer(keys)); return out;
}

export function orderLayers(layers) {
  return [...layers].map((l, i) => ({ l, i })).sort((x, y) => (LAYER_KINDS[x.l.kind ?? 'agent'] ?? 2) - (LAYER_KINDS[y.l.kind ?? 'agent'] ?? 2) || (x.l.priority ?? 0) - (y.l.priority ?? 0) || String(x.l.name).localeCompare(String(y.l.name)) || x.i - y.i).map((x) => x.l);
}
// Variantes declaradas en timeline.variants (16:9/9:16, idioma, estilo…) → capas de tipo variant (orden = el de selección).
export function variantLayers(tl, names = []) {
  return names.filter(Boolean).map((n, i) => {
    const v = tl.variants?.[n];
    if (!v) throw new LayerError(`variante desconocida (disponibles: ${Object.keys(tl.variants ?? {}).join(' ') || 'ninguna'})`, { layer: 'variant:' + n });
    return { name: 'variant:' + n, kind: 'variant', priority: i, ops: v.ops ?? [] };
  });
}

// resolve: base < variants < agent < user. Sin capas devuelve el MISMO timeline (identidad: nada cambia).
export function resolve(timeline, layers = [], { variants = [] } = {}) {
  const stack = orderLayers([...variantLayers(timeline, variants), ...layers.filter((l) => l && l.enabled !== false)]);
  if (!stack.length) return { timeline, trace: [], base: null };
  const base = toDoc(timeline), order = (timeline.shots ?? []).map((s) => s.id), trace = [];
  let doc = base;
  for (const L of stack) {
    const next = applyPatch(doc, L.ops, { layer: L.name });
    trace.push({ name: L.name, kind: L.kind ?? 'agent', priority: L.priority ?? 0, file: L.file ?? null, changed: diffPaths(doc, next), doc: next });
    doc = next;
  }
  return { timeline: fromDoc(doc, order), trace, base };
}
// Qué capa ganó en una ruta: valor en la base y tras cada capa que la tocó (la ruta, un ancestro o un descendiente).
export function explain(R, ptr, base = R.base) {
  const touches = (c) => c === ptr || ptr.startsWith(c + '/') || c.startsWith(ptr + '/');
  const b = getPointer(base, ptr), steps = [];
  for (const s of R.trace) if (s.changed.some(touches)) steps.push({ name: s.name, kind: s.kind, priority: s.priority, file: s.file, ...getPointer(s.doc, ptr) });
  const last = steps[steps.length - 1];
  return { path: ptr, base: b, steps, winner: last ? last.name : 'base', value: last ? last.value : b.value, found: last ? last.found : b.found };
}

// cookKey de un shot: su entrada RESUELTA (params tras capas; sin meta) + las definiciones de las señales que sus
// parámetros usan (transitivas). Independiente de si los módulos están cargados (gate/animatic calculan lo mismo):
// los defaults del esquema viven en el código del shot, que el hash del fragmento ya incluye.
export function cookEntry(film, s) {
  const { meta, t, ...rest } = s, sig = shotSignals(film, s);
  return sig.length ? { ...rest, t, signals: sig.map((n) => [n, film.signals?.[n] ?? null]) } : { ...rest, t };
}
