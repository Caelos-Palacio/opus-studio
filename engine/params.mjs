#!/usr/bin/env node
// Parámetros promovidos + capas de overrides (F4), lado Node: carga de capas, variantes, validación contra los esquemas de
// los shots y CLI de auditoría. Lo puro vive en resolve.mjs (capas/patch/cookKey), signal.mjs (señales) y expr.mjs (DSL).
//   node engine/params.mjs list [shot]                     parámetros promovidos: esquema, valor resuelto y quién lo fija
//   node engine/params.mjs explain /shots/A1/params/size   qué capa ganó (default → base → variant → agent → user)
//   node engine/params.mjs diff [capa]                     rutas que cambia cada capa (o una) respecto a lo anterior
//   node engine/params.mjs check                           valida capas + parámetros (exit 1 si hay errores)
//   [--timeline data/x.json] [--variant 9x16,en] [--layers dir|none]   (o OPUS_TIMELINE / OPUS_VARIANT / OPUS_LAYERS)
// Capas: data/layers/*.json (film main), <carpeta del film>/layers/*.json (films con carpeta) o data/layers/<film>/*.json. Contrato: docs/PARAMS.md.
import './help.mjs';
import { isMain, rootFrom } from './paths.mjs';
import { announceFilm } from './filmid.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { resolve, explain, getPointer, toDoc, LayerError } from './resolve.mjs';
import { FIELD_PARAMS, PARAM_TYPES, isBinding, bindingDeps } from './signal.mjs';
import { validateLayer, assertTimeline, suggest } from './schema.mjs';
import { filmId, activeTimeline, filmFolder, filmDir } from './filmid.mjs';

for (const k of ['timeline', 'variant', 'layers']) { const i = process.argv.indexOf('--' + k); if (i >= 0 && process.argv[i + 1]) process.env['OPUS_' + k.toUpperCase()] = process.argv[i + 1]; }
export const ROOT = rootFrom(import.meta.url);

export const layersDir = (timeline = activeTimeline()) => {
  const e = process.env.OPUS_LAYERS; if (e === 'none') return null;
  if (e) return path.resolve(ROOT, e);
  // Convención: las capas viven en la carpeta del film (<carpeta>/layers) si el film tiene carpeta propia (data/<film>/timeline.json
  // o data/<film>/<film>.json) y esa carpeta existe; si no, data/layers/<film> (demo: data/layers). Un film suelto en una carpeta
  // compartida (data/stress/*.json) no la usa: heredaría capas ajenas.
  const f = filmId(timeline), d = filmFolder(timeline);
  if (f !== 'main' && d && (filmDir(timeline) || path.basename(d) === f) && fs.existsSync(path.join(ROOT, d, 'layers'))) return path.join(ROOT, d, 'layers');
  return path.join(ROOT, 'data/layers', f === 'main' ? '' : f);
};
export const selectedVariants = () => (process.env.OPUS_VARIANT ?? '').split(',').map((s) => s.trim()).filter(Boolean);
// Capas en disco, validadas ($defs.layer). name por defecto = nombre del archivo.
export function loadLayers(timeline) {
  const dir = layersDir(timeline); if (!dir || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_')).sort().map((f) => {
    const file = path.join(dir, f), rel = path.relative(ROOT, file); let L;
    try { L = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new LayerError(`JSON inválido: ${e.message}`, { layer: rel }); }
    const bad = validateLayer(L).filter((x) => x.level === 'FIX');
    if (bad.length) throw new LayerError(bad.map((x) => `${x.path}: ${x.message} → ${x.remedy}`).join('; '), { layer: rel });
    return { ...L, name: L.name ?? f.slice(0, -5), file: rel };
  });
}
// timeline crudo → resolución (capas + variantes). La estructura resultante se valida igual que la base.
export function resolveTimeline(raw, timeline) {
  const layers = loadLayers(timeline), R = resolve(raw, layers, { variants: selectedVariants() });
  if (R.trace.length) assertTimeline(R.timeline, `${timeline} + capas [${R.trace.map((s) => s.name).join(', ')}]`);
  return R;
}
// Para hashes sin cargar el film (verdict.mjs): el timeline efectivo; si las capas están rotas, el crudo + marca.
export function effectiveTimeline(raw, timeline) {
  try { return resolveTimeline(raw, timeline).timeline; } catch (e) { return { ...raw, __layersError: e.message }; }
}

// ── validación contra los esquemas promovidos (necesita film.mods) ─────────────────────────────────────────────────
const typeOk = (sch, v) => {
  switch (sch.type) {
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'integer': return Number.isInteger(v);
    case 'string': case 'color': return typeof v === 'string';
    case 'boolean': return typeof v === 'boolean';
    case 'json': return v !== undefined && v !== null && typeof v === 'object';
    case 'enum': return (sch.values ?? []).includes(v);
  }
  return false;
};
const inRange = (sch, v) => !sch.range || typeof v !== 'number' || (v >= sch.range[0] && v <= sch.range[1]);
export function checkParams(film) {
  const out = [], E = (p, m, r = '') => out.push({ path: p, problem: m, remedy: r });
  const who = (p) => { const R = film.resolution; if (!R?.trace?.length) return ''; const x = explain(R, p); return x.winner !== 'base' ? ` [fijado por la capa "${x.winner}"]` : ''; };
  for (const s of film.shots) {
    const mod = film.mods?.[s.id], schema = mod?.params;
    if (schema) for (const [n, sch] of Object.entries(schema)) {
      const p = `shots/${s.id}.mjs params.${n}`;
      if (!sch || !PARAM_TYPES.includes(sch.type)) { E(p, `tipo "${sch?.type}" no válido`, `uno de: ${PARAM_TYPES.join(' ')}`); continue; }
      if (sch.type === 'enum' && !Array.isArray(sch.values)) E(p, 'enum sin values', 'values: [...]');
      if (!FIELD_PARAMS.includes(n) && !('default' in sch)) E(p, 'parámetro sin default', 'el default debe reproducir el comportamiento sin overrides');
      else if ('default' in sch && !FIELD_PARAMS.includes(n) && (isBinding(sch.default) || !typeOk(sch, sch.default) || !inRange(sch, sch.default))) E(p, `default ${JSON.stringify(sch.default)} no casa con su esquema`, 'default constante, del tipo y dentro de range');
    }
    for (const [n, v] of Object.entries(s.params ?? {})) {
      const p = `/shots/${s.id}/params/${n}`;
      if (!schema) { if (mod) E(p, `el shot ${s.id} no promueve parámetros`, `declarar params en shots/${s.id}.mjs`); continue; }
      const sch = schema[n];
      if (!sch) { const g = suggest(n, Object.keys(schema)); E(p, `parámetro desconocido${who(p)}`, g ? `¿quisiste decir "${g}"?` : `promovidos: ${Object.keys(schema).join(' ') || '(ninguno)'}`); continue; }
      if (isBinding(v)) {
        if (sch.type !== 'number' && sch.type !== 'integer') E(p, `enlace a señal/expresión en un parámetro ${sch.type}${who(p)}`, 'solo number/integer admiten $sig/$expr');
        for (const d of bindingDeps(v, p)) if (!Object.hasOwn(film.signals ?? {}, d)) E(p, `señal desconocida '${d}'${who(p)}`, 'declararla en signals (o en una capa: /signals/<nombre>)');
      } else if (!typeOk(sch, v)) E(p, `${JSON.stringify(v)} no es ${sch.type}${sch.values ? ' [' + sch.values.join('|') + ']' : ''}${who(p)}`, `default: ${JSON.stringify(sch.default)}`);
      else if (!inRange(sch, v)) E(p, `${v} fuera de range [${sch.range}]${sch.unit ? ' ' + sch.unit : ''}${who(p)}`, `dentro de [${sch.range}]`);
    }
  }
  return out;
}
export function assertParams(film) {
  const bad = checkParams(film);
  if (bad.length) throw new Error(`parámetros inválidos (docs/PARAMS.md):\n` + bad.map((x) => `  FIX  ${x.path}: ${x.problem}  →  ${x.remedy}`).join('\n'));
  return film;
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const show = (v) => (v === undefined ? '—' : JSON.stringify(v));
async function main() {
  const argv = process.argv.slice(2).filter((a, i, A) => !a.startsWith('--') && !(i > 0 && A[i - 1].startsWith('--'))), [cmd, a1] = argv;
  if (!['list', 'explain', 'diff', 'check'].includes(cmd)) { console.log('Uso: node engine/params.mjs list [shot] | explain <ruta> | diff [capa] | check'); process.exitCode = 1; return; }
  const { loadFilm } = await import('./film.mjs');
  let film; try { film = await loadFilm(); } catch (e) { console.log('FIX ', e.message); process.exitCode = 1; return; }
  const R = film.resolution ?? { trace: [] };
  if (cmd === 'check') { console.log(`OK  ${R.trace.length} capas (${R.trace.map((s) => s.name).join(', ') || '—'}) · parámetros válidos`); return; }
  if (cmd === 'diff') {
    const steps = R.trace.filter((s) => !a1 || s.name === a1 || s.file?.endsWith(a1));
    if (a1 && !steps.length) { console.log(`capa "${a1}" no está activa (activas: ${R.trace.map((s) => s.name).join(', ') || 'ninguna'})`); process.exitCode = 1; return; }
    for (const s of steps) { console.log(`${s.kind.padEnd(7)} ${s.name}${s.file ? '  (' + s.file + ')' : ''}  prioridad ${s.priority}`); for (const c of s.changed) console.log(`   ${c}`); if (!s.changed.length) console.log('   (sin efecto)'); }
    if (!steps.length) console.log('sin capas activas: el film es la base');
    return;
  }
  if (cmd === 'explain') {
    if (!a1?.startsWith('/')) { console.log('explain exige una ruta: /shots/<id>/params/<nombre>'); process.exitCode = 1; return; }
    const m = /^\/shots\/([^/]+)\/params\/([^/]+)$/.exec(a1), sch = m ? film.mods?.[m[1]]?.params?.[m[2]] : null;
    const rawDoc = toDoc(JSON.parse(fs.readFileSync(path.resolve(ROOT, film.timelinePath), 'utf8'))), b = getPointer(rawDoc, a1), X = R.trace.length ? explain(R, a1, rawDoc) : null;
    const row = (k, v, note = '') => console.log(`  ${k.padEnd(24)} ${v.padEnd(16)} ${note}`);
    console.log(a1);
    if (m) row('default', show(sch?.default), sch ? `(shots/${m[1]}.mjs: ${sch.type}${sch.range ? ' [' + sch.range + ']' : ''}${sch.unit ? ' ' + sch.unit : ''}${sch.semantic ? ' — ' + sch.semantic : ''})` : '(sin esquema en el shot)');
    if (m && FIELD_PARAMS.includes(m[2])) row(`campo shot.${m[2]}`, show(getPointer(rawDoc, `/shots/${m[1]}/${m[2]}`).value), '(el campo del timeline es el default)');
    row('base', b.found ? show(b.value) : '—', `(${film.timelinePath})`);
    for (const s of X?.steps ?? []) row(`${s.kind}:${s.name}`, s.found ? show(s.value) : '(borrado)', s.file ? `(${s.file})` : '');
    const winner = X?.steps?.length ? X.winner : b.found ? 'base' : m && FIELD_PARAMS.includes(m[2]) ? `campo shot.${m[2]}` : 'default';
    const sh = m && film.shots.find((s) => s.id === m[1]), val = sh ? film.param(m[1], m[2], sh.t[0]) : X ? X.value : b.value;
    console.log(`  = ${show(val)}${sh ? ` (en t=${sh.t[0]})` : ''}   ← gana ${winner}`);
    return;
  }
  // list
  for (const s of film.shots) {
    if (a1 && s.id !== a1) continue;
    const names = film.paramNames(s.id); if (!names.length) { console.log(`${s.id}  (sin parámetros promovidos)`); continue; }
    console.log(`${s.id}  [${s.t}]`);
    for (const n of names) {
      const sch = film.mods?.[s.id]?.params?.[n] ?? {}, p = `/shots/${s.id}/params/${n}`, v = s.params?.[n], from = R.trace.length ? explain(R, p).winner : 'base';
      const src = v === undefined ? (FIELD_PARAMS.includes(n) ? `campo ${n}` : 'default') : isBinding(v) ? `${from} ${'$expr' in v ? 'expr ' + v.$expr : 'sig ' + v.$sig}` : from;
      console.log(`  ${n.padEnd(12)} ${show(film.param(s.id, n, s.t[0])).padEnd(18)} ${(sch.type ?? '?').padEnd(7)} ${(sch.range ? '[' + sch.range + ']' : '').padEnd(12)} ${(sch.unit ?? '').padEnd(4)} ${src.padEnd(10)} ${sch.semantic ?? ''}`);
    }
  }
}
if (isMain(import.meta.url)) { announceFilm(); main().catch((e) => { console.error(e.message); process.exit(1); });  }
