#!/usr/bin/env node
// Spec 016 (recetas): esqueletos MUY cortos de .scene.json (plano, movimiento, transición). Son puntos de partida que el agente copia y edita;
// `new shot` ESCRIBE un scene propio del film (scaffold, sin herencia: cambiar la receta después no altera los films que ya la usaron).
//   node engine/opus.mjs new shot <id> --receta <r> [--objeto o] [--fondo f] [--mov a,b] [--a id,id] [--param k=v] [--llenar objeto.prop=texto] [--film f] [--force]
//   node engine/recetas.mjs list | show <receta> | audit [film …] | medir          (npm run new -- shot …)
// Receta = data/recetas/<id>.receta.json: { meta, scene } (plano/transición) o { meta, mod } (movimiento: modificador de cualquier objeto).
// Hueco = cadena "$hueco: qué va aquí" (literal: no rompe el esquema estricto); el lint da WARN receta.hueco mientras quede alguno.
import { isMain, rootFrom } from './paths.mjs';
import './help.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { TYPES, validateScene, assertScene } from './dsl-core.mjs';
import { validateMeta, tokens } from './toolbox.mjs';

export const ROOT = rootFrom(import.meta.url);
export const DIR = 'data/recetas', GRUPOS = ['plano', 'movimiento', 'transicion'], MAX_LINEAS = 25, MAX_PARAMS = 4;
const HUECO = '$hueco';
const isHueco = (v) => typeof v === 'string' && v.startsWith(HUECO);
const clone = (x) => JSON.parse(JSON.stringify(x));

// ── catálogo ─────────────────────────────────────────────────────────────────────────────────────────────────────
export function cargarRecetas(root = ROOT) {
  const d = path.join(root, DIR), out = new Map();
  if (!fs.existsSync(d)) return out;
  for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.receta.json')).sort()) {
    const text = fs.readFileSync(path.join(d, f), 'utf8'), j = JSON.parse(text);
    out.set(j.meta.id, { ...j, file: `${DIR}/${f}`, lineas: text.trimEnd().split('\n').length });
  }
  return out;
}
export const catalogo = (root = ROOT) => [...cargarRecetas(root).values()].filter((r) => !r.meta.id.startsWith('_'));
const sugerir = (id, ids) => { const s = ids.find((x) => x.includes(id) || id.includes(x)); return s ? `¿quisiste decir «${s}»?` : `válidas: ${ids.join(' ')}`; };

// R2: mínimas, ≤ 25 líneas, ≤ 4 params, ≥ 1 $hueco (en lo que se escribe), meta completo.
export function validarReceta(r, root = ROOT) {
  const p = [], m = r.meta ?? {};
  p.push(...validateMeta(m));
  if (!GRUPOS.includes(m.grupo)) p.push(`grupo "${m.grupo}" ∉ ${GRUPOS.join('|')}`);
  if (!!r.scene === !!r.mod) p.push('debe tener exactamente uno de scene (plano/transición) o mod (movimiento)');
  if (r.lineas > MAX_LINEAS) p.push(`${r.lineas} líneas (máx. ${MAX_LINEAS})`);
  const np = Object.keys(m.params ?? {}).length, def = Object.keys((r.scene ?? r.mod)?.params ?? {});
  if (np > MAX_PARAMS || def.length > MAX_PARAMS) p.push(`${Math.max(np, def.length)} params (máx. ${MAX_PARAMS})`);
  if (def.slice().sort().join() !== Object.keys(m.params ?? {}).sort().join()) p.push('meta.params no coincide con los params declarados');
  try { const s = scaffold(m.id, { id: 'T', root }).scene; if (!huecos(s).length) p.push('sin ningún $hueco'); const f = validateScene(s); if (f.length) p.push(`scaffold inválido: ${f[0].path} ${f[0].message}`); }
  catch (e) { p.push(`scaffold falla: ${e.message}`); }
  return p;
}
// Entradas para el registro del toolbox (kind receta). El toolbox las carga por import dinámico (tolerante).
export function entradasRegistro(root = ROOT) {
  return catalogo(root).map((r) => { const m = r.meta, ps = Object.entries(m.params).map(([k, t]) => `${k}:${t}`).join(', ');
    return { id: `receta:${m.id}`, kind: 'receta', resumen: m.resumen, tags: [...m.tags, m.grupo], cuando: m.cuando ?? m.resumen, entra: ps || '—', sale: 'shots/<id>.scene.json propio (scaffold con $hueco)',
      uso: `node engine/opus.mjs new shot <id> --receta ${m.id} [--objeto o] [--fondo f]${m.grupo === 'plano' ? ' [--mov temblor]' : ''}`, ejemplo: `node engine/opus.mjs new shot X1 --receta ${m.id}`, siguiente: ['check:receta.hueco', 'cli:dsl.build'], src: r.file }; });
}

// ── huecos y marca ───────────────────────────────────────────────────────────────────────────────────────────────
export function huecos(sc) {
  const out = [], walk = (v, p) => { if (isHueco(v)) out.push({ path: p, text: v.slice(HUECO.length).replace(/^:\s*/, '') }); else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}/${i}`)); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${p}/${k}`); };
  for (const k of ['params', 'cues', 'objects']) walk(sc[k], `/${k}`);
  return out;
}
// "[receta:revelar+temblor] …" → 'revelar' (la receta primaria; lo que sigue a + son modificadores)
export const recetaOf = (sc) => /^\[receta:([a-z0-9_]+)(?:\+[a-z0-9_+]+)?\]/.exec(sc?.doc ?? '')?.[1] ?? null;

// ── modificadores de movimiento: envuelven props de CUALQUIER objeto que las tenga (composición, sin código nuevo) ─
const num = (v) => typeof v === 'number';
function aplicarMov(sc, mov, { targets, types }) {
  const M = mov.mod, objs = sc.objects, done = [];
  for (const k of Object.keys(M.params)) if (k in (sc.params ?? {})) throw new Error(`el param ${k} de «${mov.meta.id}» ya existe en el scene`);
  const ids = new Set(M.objects.map((o) => o.id)); for (const o of objs) if (ids.has(o.id)) throw new Error(`el id ${o.id} de «${mov.meta.id}» ya existe en el scene`);
  const todos = (list) => list.flatMap((o) => [o, ...(o.children ? todos(o.children) : [])]);
  for (const id of targets) {
    const o = todos(objs).find((x) => x.id === id); if (!o) throw new Error(`objeto «${id}» no existe en el scene (objetos: ${todos(objs).map((x) => x.id).filter(Boolean).join(' ')})`);
    const props = (types[o.type] ?? TYPES[o.type])?.props ?? [];
    for (const [prop, spec] of Object.entries(M.aplica)) {
      if (!props.includes(prop)) continue;
      const op = spec[0], X = spec.slice(1), cur = o[prop];
      if (cur === undefined) { if (op === '*' && prop === 'alpha') { o[prop] = { $expr: X }; done.push(`${id}.${prop}`); } continue; }
      const src = num(cur) ? String(cur) : cur && typeof cur === 'object' && '$expr' in cur ? String(cur.$expr) : null;
      if (src == null) continue;                                           // color, texto, $shot…: no se tocan
      o[prop] = { $expr: `${/^[\w.]+$/.test(src) ? src : `(${src})`} ${op} ${X}` }; done.push(`${id}.${prop}`);
    }
  }
  if (!done.length) throw new Error(`«${mov.meta.id}» no tiene propiedad aplicable en ${targets.join(', ')} (objeto sin ${Object.keys(M.aplica).join('/')})`);
  Object.assign(sc.params ??= {}, clone(M.params)); sc.objects = [...clone(M.objects), ...objs];
  return done;
}

// ── scaffold ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Enganche con la rama `fondos` (spec 014): objeto/fondo se resuelven contra el registro del toolbox (entries: kind objeto|fondo con id
// `objeto:<n>`) Y contra un tipo del DSL del mismo nombre (types). Si falta cualquiera de los dos queda un $hueco explícito (sin dependencia dura).
function instanciar(kind, name, slot, { entries, types }) {
  const e = (entries ?? []).find((x) => x.id === `${kind}:${name}`), t = types[name];
  if (!e || !t) { slot.semantic = `${HUECO}: ${kind} «${name}» aún no está en la biblioteca; sugerencia: node engine/tools.mjs find "${name}" --kind ${kind}`; return `${kind} «${name}»: sin biblioteca → $hueco`; }
  const nuevo = { id: slot.id, type: name };
  for (const p of t.req) nuevo[p] = p === 'x' || p === 'y' ? slot[p] ?? { $expr: p === 'x' ? 'S_cx' : 'S_cy' } : `${HUECO}: ${p} de ${kind} ${name}`;
  for (const p of ['x', 'y']) if (!(p in nuevo) && t.props.includes(p) && slot[p] !== undefined) nuevo[p] = slot[p];
  nuevo.semantic = e.resumen; for (const k of Object.keys(slot)) delete slot[k]; Object.assign(slot, nuevo);
  return `${kind} «${name}»: ${e.resumen}`;
}
export function scaffold(recetaId, { id, objeto, fondo, mov = [], a, param = {}, llenar = {}, entries, types = TYPES, root = ROOT } = {}) {
  const R = cargarRecetas(root), r = R.get(recetaId);
  if (!r || recetaId.startsWith('_')) throw new Error(`receta «${recetaId}» no existe: ${sugerir(recetaId, catalogo(root).map((x) => x.meta.id))}`);
  const notas = [], base = r.scene ? r : R.get('_base'), sc = clone(base.scene);
  const movs = [...(r.mod ? [recetaId] : []), ...mov].map((m) => { const x = R.get(m); if (!x?.mod) throw new Error(`«${m}» no es un movimiento: ${sugerir(m, catalogo(root).filter((q) => q.mod).map((q) => q.meta.id))}`); return x; });
  sc.id = id; sc.doc = sc.doc.replace(/^\[receta:[^\]]+\]/, `[receta:${[recetaId, ...mov].filter((x, i, A) => A.indexOf(x) === i).join('+')}]`);
  const slot = sc.objects.find((o) => o.id === 'ancla') ?? sc.objects.find((o) => isHueco(o.semantic) && (o.type === 'shape' || o.type === 'glow'));
  if (objeto) { if (!slot) throw new Error('esta receta no tiene objeto ancla donde poner --objeto'); notas.push(instanciar('objeto', objeto, slot, { entries, types })); }
  if (fondo) { const f = sc.objects.find((o) => o.id === 'fondo'); if (!f) throw new Error('esta receta no tiene capa de fondo donde poner --fondo'); notas.push(instanciar('fondo', fondo, f, { entries, types })); }
  for (const m of movs) {
    const dest = a?.length ? a : [slot?.id ?? 'ancla', ...(m.mod.acompana && sc.objects.some((o) => o.id === 'foco') ? ['foco'] : [])];
    notas.push(`${m.meta.id} → ${aplicarMov(sc, m, { targets: dest, types }).join(' ')}`);
  }
  for (const [k, v] of Object.entries(param)) {
    const d = sc.params?.[k]; if (!d) throw new Error(`param «${k}» no existe en el scene (params: ${Object.keys(sc.params ?? {}).join(' ')})`);
    const x = d.type === 'number' || d.type === 'integer' ? Number(v) : d.type === 'boolean' ? String(v) === 'true' : v;
    if ((typeof x === 'number' && Number.isNaN(x)) || (d.type === 'integer' && !Number.isInteger(x))) throw new Error(`param ${k}: «${v}» no es ${d.type}`);
    d.default = x; notas.push(`param ${k} = ${JSON.stringify(x)}`);
  }
  for (const [k, v] of Object.entries(llenar)) { const h = huecosClave(sc).find((x) => x.clave === k || x.id === k); if (!h) throw new Error(`hueco «${k}» no existe (huecos: ${huecosClave(sc).map((x) => x.clave).join(' ') || '—'})`); h.set(String(v)); notas.push(`hueco ${h.clave} llenado`); }
  return { scene: sc, notas };
}
// huecos direccionables por «objeto.propiedad» (o solo «objeto» si es el primero de ese objeto) para --llenar
export function huecosClave(sc) {
  const out = [];
  for (const o of sc.objects ?? []) for (const [k, v] of Object.entries(o)) if (isHueco(v)) out.push({ clave: `${o.id ?? o.type}.${k}`, id: out.some((x) => x.id === (o.id ?? o.type)) ? null : (o.id ?? o.type), texto: v.replace(/^\$hueco:\s*/, ''), set: (t) => { o[k] = t; } });
  return out;
}

// ── serialización legible: un param / un objeto por línea (diffs pequeños; lo que el agente edita) ──────────────────
export function serializar(sc) {
  const J = JSON.stringify, L = [];
  for (const [k, v] of Object.entries(sc)) {
    if (k === 'params') L.push(` "params": {\n${Object.entries(v).map(([n, d]) => `  ${J(n)}: ${J(d)}`).join(',\n')}\n }`);
    else if (k === 'objects' || k === 'cues') L.push(` "${k}": [\n${v.map((o) => `  ${J(o)}`).join(',\n')}\n ]`);
    else L.push(` ${J(k)}: ${J(v)}`);
  }
  return '{\n' + L.join(',\n') + '\n}\n';
}

// ── lint (R3, R4) ──────────────────────────────────────────────────────────────────────────────────────────────
// shots: [{id, receta}] (receta = id primario o null). Una receta que genera >50 % de los shots (≥ 3 shots) es un molde.
export function repeticion(shots) {
  const c = new Map(); for (const s of shots) if (s.receta) c.set(s.receta, (c.get(s.receta) ?? 0) + 1);
  const [top, n] = [...c.entries()].sort((x, y) => y[1] - x[1])[0] ?? [];
  return top && n >= 3 && n / shots.length > 0.5 ? [{ receta: top, n, total: shots.length }] : [];
}
// {film: [recetas en orden]} → true si ≥ 3 films comparten la MISMA secuencia (≥ 3 pasos): la oleada sale de un molde.
export const oleadaIgual = (seqs) => { const S = Object.values(seqs).filter((q) => q.length >= 3).map((q) => q.join('>')); return S.length >= 3 && S.every((x) => x === S[0]); };
export function escenaReceta(root, id) {
  const f = path.join(root, 'shots', `${id}.scene.json`); if (!fs.existsSync(f)) return { receta: null, huecos: [] };
  try { const sc = JSON.parse(fs.readFileSync(f, 'utf8')); return { receta: recetaOf(sc), huecos: huecos(sc) }; } catch { return { receta: null, huecos: [] }; }
}
// → [{shot, t, level:'WARN', problem, remedy}] para un film (shots del timeline con id y t)
export function incidencias(shots, root = ROOT) {
  const out = [], info = shots.map((s) => ({ s, ...escenaReceta(root, s.id) }));
  for (const x of info) if (x.huecos.length) out.push({ shot: x.s.id, t: x.s.t[0], level: 'WARN', problem: `receta.hueco: ${x.huecos.length} sin llenar en shots/${x.s.id}.scene.json (${x.huecos.slice(0, 3).map((h) => h.path).join(', ')}${x.huecos.length > 3 ? ', …' : ''}): «${x.huecos[0].text.slice(0, 60)}»`, remedy: 'llenar con lo concreto del film y regenerar (node engine/dsl.mjs build)' });
  for (const r of repeticion(info.map((x) => ({ id: x.s.id, receta: x.receta })))) { const first = info.find((x) => x.receta === r.receta); out.push({ shot: first.s.id, t: first.s.t[0], level: 'WARN', problem: `receta.repeticion: ${r.n} de ${r.total} shots (${Math.round((100 * r.n) / r.total)} %) salen de la receta «${r.receta}»`, remedy: 'variar el patrón: cambiar de receta o escribir el shot a mano; la plantilla no puede ser el molde del film' }); }
  return out;
}

// ── R7: ahorro de escritura (receta vs. desde cero), en tokens ≈ caracteres/4 ─────────────────────────────────────
// Con receta el agente escribe: el comando + una edición por cada región que cambia (old_string con 16 caracteres de contexto a cada lado +
// new_string + OVERHEAD de la llamada). Desde cero escribe el scene entero (+ OVERHEAD de la llamada Write). Se publica además el peor caso:
// reescribir líneas enteras (lo que mide un diff por líneas).
export const OVERHEAD = 15, CONTEXTO = 16;
export function ediciones(scaf, fin) {
  const A = scaf.split('\n'), B = fin.split('\n'), out = [];
  if (A.length !== B.length) return B.filter((l) => !A.includes(l)).map((l) => ({ viejo: '', nuevo: l, lineaCompleta: true }));
  for (let i = 0; i < A.length; i++) {
    if (A[i] === B[i]) continue;
    let p = 0; while (p < A[i].length && p < B[i].length && A[i][p] === B[i][p]) p++;
    let q = 0; while (q < A[i].length - p && q < B[i].length - p && A[i].at(-1 - q) === B[i].at(-1 - q)) q++;
    const c0 = Math.max(0, p - CONTEXTO), viejo = A[i].slice(c0, A[i].length - q + Math.min(q, CONTEXTO)), nuevo = B[i].slice(c0, B[i].length - q + Math.min(q, CONTEXTO));
    out.push({ viejo, nuevo, linea: B[i] });
  }
  return out;
}
// Tres shots inspirados en los guiones (docs/guiones). `param`/`llenar` son lo que el agente pasa en el comando; `residual`, lo que aún edita a mano.
export const EJEMPLOS = [
  { receta: 'contar', film: 'veinticuatro', id: 'V01', param: { final: 24, tarda: 6.5, inicio: 0.6 }, llenar: { 'ancla.semantic': 'cada destello de un fotomultiplicador suma uno', 'que.text': 'neutrinos en 13 segundos' }, residual: [['"color":"accent","semantic":"cada', '"color":"accent2","semantic":"cada']] },
  { receta: 'documento', film: 'consta', id: 'C01', param: { sellaEn: 4.5 }, llenar: { 'hoja.semantic': 'acta de comparación del prototipo del kilo', 'l1.text': 'Cilindro de platino-iridio, 39 mm', 'l2.text': 'Consta: 50 µg de diferencia' }, residual: [['"color":"anom"}', '"color":"anom","semantic":"sello de las tres llaves"}']] },
  { receta: 'presentar_objeto', film: 'botella', id: 'B01', param: { tam: 120, detalleEn: 2.2 }, llenar: { 'ancla.semantic': 'tarjeta postal de 1906 con la oferta de un chelín', 'detalle.text': 'Se ruega anotar dónde y cómo se halló' }, residual: [['"color":"accent","semantic":"tarjeta', '"color":"ink","semantic":"tarjeta']] },
];
const q = (v) => (/^[\w.+-]+$/.test(String(v)) ? String(v) : JSON.stringify(String(v)));
export function medirAhorro(root = ROOT) {
  return EJEMPLOS.map((e) => {
    const cmd = ['node engine/opus.mjs new shot', e.id, '--receta', e.receta, ...Object.entries(e.param).flatMap(([k, v]) => ['--param', `${k}=${v}`]), ...Object.entries(e.llenar).flatMap(([k, v]) => ['--llenar', q(`${k}=${v}`)])].join(' ');
    const salida = serializar(scaffold(e.receta, { id: e.id, param: e.param, llenar: e.llenar, root }).scene), vacio = serializar(scaffold(e.receta, { id: e.id, root }).scene);
    let fin = salida; for (const [a, b] of e.residual) { if (!fin.includes(a)) throw new Error(`${e.id}: residual no aplica: ${a}`); fin = fin.replace(a, b); }
    const sc = JSON.parse(fin), eds = ediciones(salida, fin);
    const tokReceta = tokens(cmd) + OVERHEAD + eds.reduce((s, x) => s + tokens(x.viejo) + tokens(x.nuevo) + OVERHEAD, 0), tokCero = tokens(fin) + OVERHEAD;
    const tokLineas = tokens(cmd) + OVERHEAD + eds.reduce((s, x) => s + tokens(x.linea ?? x.nuevo) + OVERHEAD, 0);
    return { ...e, cmd, tokReceta, tokCero, tokLineas, ahorro: 1 - tokReceta / tokCero, ahorroLineas: 1 - tokLineas / tokCero, ediciones: eds.length, lineas: fin.trimEnd().split('\n').length, valida: validateScene(sc).length === 0, huecos: huecos(sc).length, distinto: fin !== vacio };
  });
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const opt = (args, k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const VALOR = ['--receta', '--objeto', '--fondo', '--film', '--mov', '--a', '--llenar', '--param'];
const todos = (args, k) => args.flatMap((x, i) => (args[i - 1] === k ? [x] : [])).map((kv) => { const j = kv.indexOf('='); if (j < 1) throw new Error(`${k} espera nombre=valor (recibí «${kv}»)`); return [kv.slice(0, j), kv.slice(j + 1)]; });
const lista = (v) => (v ? String(v).split(',').filter(Boolean) : []);
export async function cli(args) {
  const [cmd, ...rest] = args;
  if (cmd === 'shot') {
    const id = rest.find((x, i) => !x.startsWith('--') && !(i && VALOR.includes(rest[i - 1])));
    if (!id || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)) { console.error('uso: opus new shot <id> --receta <r> [--objeto o] [--fondo f] [--mov a,b] [--a id,id] [--param k=v] [--llenar objeto.prop=texto] [--film f] [--force]   (id: letras, dígitos, - _)'); return 1; }
    const receta = opt(rest, '--receta'); if (!receta) { console.error(`falta --receta (${catalogo().map((r) => r.meta.id).join(' ')}; node engine/recetas.mjs list)`); return 1; }
    const rel = `shots/${id}.scene.json`, abs = path.join(ROOT, rel), force = rest.includes('--force');
    if (!force && (fs.existsSync(abs) || fs.existsSync(path.join(ROOT, `shots/${id}.mjs`)))) { console.error(`✗ ${rel} (o shots/${id}.mjs) ya existe: no se pisa; usa --force para reescribirlo`); return 1; }
    let entries, filmNote = '';
    const objeto = opt(rest, '--objeto'), fondo = opt(rest, '--fondo'), film = opt(rest, '--film');
    if (objeto || fondo) { try { const { buildRegistry } = await import('./toolbox.mjs'); entries = (await buildRegistry({ root: ROOT })).entries; } catch { entries = []; } }
    if (film) { const { findFilm } = await import('./filmid.mjs'), tl = findFilm(film); if (!tl) { console.error(`✗ no encuentro el film «${film}» (node engine/opus.mjs use)`); return 1; }
      const t = JSON.parse(fs.readFileSync(path.join(ROOT, tl), 'utf8')); filmNote = t.shots?.some((s) => s.id === id) ? `el shot ${id} ya está en ${tl}` : `añade el shot ${id} a ${tl} (id, t, size, action, cam, transition_out)`; }
    let res; try { res = scaffold(receta, { id, objeto, fondo, mov: lista(opt(rest, '--mov')), a: lista(opt(rest, '--a')), param: Object.fromEntries(todos(rest, '--param')), llenar: Object.fromEntries(todos(rest, '--llenar')), entries }); assertScene(res.scene, rel); } catch (e) { console.error('✗ ' + e.message); return 1; }
    fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, serializar(res.scene));
    const { build } = await import('./dsl.mjs'); build(rel, { root: ROOT });
    const H = huecos(res.scene);
    console.log(`scaffold ${rel} (receta ${receta}; ${res.scene.objects.length} objetos, ${H.length} huecos) + shots/${id}.mjs`);
    for (const n of res.notas) console.log(`  · ${n}`);
    for (const h of huecosClave(res.scene)) console.log(`  $hueco ${h.clave}: ${h.texto}   (--llenar ${h.clave}="…")`);
    console.log(`siguiente: llenar los $hueco → node engine/dsl.mjs build ${rel} → ${filmNote || 'añadir el shot al timeline'} → npm run lint`);
    return 0;
  }
  if (cmd === 'list') { for (const r of catalogo()) console.log(`${r.meta.id.padEnd(20)} ${r.meta.grupo.padEnd(11)} ${r.meta.resumen}`); return 0; }
  if (cmd === 'show') { const r = cargarRecetas().get(rest[0]); if (!r) { console.error(`receta «${rest[0]}» no existe`); return 1; } console.log(fs.readFileSync(path.join(ROOT, r.file), 'utf8').trimEnd()); return 0; }
  if (cmd === 'medir') { for (const m of medirAhorro()) console.log(`${m.receta.padEnd(18)} (${m.film}) receta ${String(m.tokReceta).padStart(4)} tok · desde cero ${String(m.tokCero).padStart(4)} tok · ahorro ${(m.ahorro * 100).toFixed(0)} %  (comando + ${m.ediciones} edición/es residual/es; peor caso reescribiendo líneas enteras: ${(m.ahorroLineas * 100).toFixed(0)} %)`); return 0; }
  if (cmd === 'audit') {
    const { findFilm } = await import('./filmid.mjs'), seqs = {};
    for (const name of rest) { const tl = findFilm(name); if (!tl) { console.error(`no encuentro el film «${name}»`); return 1; }
      const t = JSON.parse(fs.readFileSync(path.join(ROOT, tl), 'utf8')); seqs[name] = (t.shots ?? []).map((s) => escenaReceta(ROOT, s.id).receta).filter(Boolean); console.log(`${name}: ${seqs[name].join(' > ') || '—'}`); }
    if (oleadaIgual(seqs)) console.log('WARN receta.repeticion: los films de la oleada comparten la misma secuencia de recetas'); else console.log('secuencias distintas: sin aviso');
    return 0;
  }
  console.error('uso: recetas.mjs shot <id> --receta r … | list | show <r> | medir | audit [film …]'); return cmd ? 1 : 0;
}
if (isMain(import.meta.url)) process.exit(await cli(process.argv.slice(2)));
