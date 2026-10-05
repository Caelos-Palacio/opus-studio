// Esquema del timeline (E8): validador JSON Schema mínimo, sin dependencias, + comprobaciones de referencias cruzadas.
//   node engine/schema.mjs [timeline.json ...]      → valida (por defecto el timeline activo); exit 1 si hay FIX
// Por qué propio y no ajv: el esquema usa un subconjunto pequeño (type, enum, const, properties, additionalProperties,
// required, items, min/maxItems, minimum/maximum/exclusiveMinimum, pattern, anyOf, $ref local, deprecated) y lo que
// importa aquí es el MENSAJE: ruta JSON + "¿quisiste decir…?" por distancia de edición, cosa que ajv no da. ~150 líneas,
// cero dependencias nuevas, puro (sirve también al crítico para validar sus respuestas).
// Niveles: estructura rota = FIX (y el lint no sigue: el resto asume la forma); campo deprecated = WARN.
import { activeTimeline } from './filmid.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { compileSignals, bindingDeps } from './signal.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const TIMELINE_SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/timeline.schema.json'), 'utf8'));
const D = TIMELINE_SCHEMA.$defs;
// Fuente única de los enums (lint.mjs los importa; test/schema.mjs comprueba que casan con el código).
export const ENUMS = {
  why: D.cam.properties.why.enum, move: D.cam.properties.move.enum, ease: D.cam.properties.ease.enum,
  transition: D.shot.properties.transition_out.enum, size: D.shot.properties.size.enum, voice: D.voice.enum, profile: TIMELINE_SCHEMA.properties.profile.enum,
};

// ── distancia de edición y sugerencias ──────────────────────────────────────────────────────────────────────────
// Damerau (OSA): una transposición ("mvoe" → "move") cuesta 1, como el error de tecleo que es.
export function lev(a, b) {
  a = String(a).toLowerCase(); b = String(b).toLowerCase();
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[m][n];
}
export function suggest(word, candidates) {
  let best = null, bd = Infinity;
  for (const c of candidates) { const d = lev(word, c); if (d < bd) { bd = d; best = c; } }
  const w = String(word).toLowerCase();
  if (best != null && bd <= Math.max(1, Math.floor(w.length / 3))) return best;
  return (w.length >= 3 && [...candidates].find((c) => String(c).toLowerCase().startsWith(w))) || null;   // "wipe" → "wipe-obj"
}

// ── validador ────────────────────────────────────────────────────────────────────────────────────────────────────
const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
const typeOk = (v, t) => { const a = typeOf(v); return t === a || (t === 'number' && a === 'integer'); };
const esc = (k) => String(k).replace(/~/g, '~0').replace(/\//g, '~1');
const show = (v) => JSON.stringify(v)?.slice(0, 60);
const list = (xs) => xs.map(String).join('|');

// Devuelve [{path, message, remedy, level}] (level FIX salvo deprecated → WARN).
export function validate(value, schema, root = schema, p = '') {
  const errs = [], E = (message, remedy = '', level = 'FIX') => errs.push({ path: p || '/', message, remedy, level });
  if (schema === true || schema == null) return errs;
  if (schema === false) { E('no permitido'); return errs; }
  if (schema.$ref) {
    const m = /^#\/\$defs\/(.+)$/.exec(schema.$ref); if (!m || !root.$defs?.[m[1]]) throw new Error(`esquema: $ref no soportado ${schema.$ref}`);
    return validate(value, root.$defs[m[1]], root, p);
  }
  if (schema.deprecated) E(`campo obsoleto (sin consumidor)`, schema['x-remedy'] ?? 'quitarlo', 'WARN');
  if (schema.anyOf) {
    const rs = schema.anyOf.map((s) => validate(value, s, root, p));
    if (rs.some((r) => !r.some((e) => e.level === 'FIX'))) return errs.concat(rs.find((r) => !r.some((e) => e.level === 'FIX')));
    // la rama cuyo tipo casa explica mejor el error; si ninguna, se listan los tipos aceptados
    const byType = rs.filter((r, i) => { const s = resolve(schema.anyOf[i], root); return !s.type || [].concat(s.type).some((t) => typeOk(value, t)) || (s.enum && typeof value === 'string'); });
    if (byType.length) return errs.concat(byType.sort((a, b) => a.length - b.length)[0]);
    E(`tipo ${typeOf(value)} no válido`, `usar ${schema.anyOf.map((s) => describe(resolve(s, root))).join(' o ')}`); return errs;
  }
  if (schema.type && ![].concat(schema.type).some((t) => typeOk(value, t))) { E(`se esperaba ${[].concat(schema.type).join(' o ')}, es ${typeOf(value)} (${show(value)})`, `usar ${[].concat(schema.type).join(' o ')}`); return errs; }
  if ('const' in schema && value !== schema.const) E(`${show(value)} ≠ ${show(schema.const)}`, `usar ${show(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) {
    const s = typeof value === 'string' ? suggest(value, schema.enum.filter((x) => typeof x === 'string')) : null;
    E(`${show(value)} no está en [${list(schema.enum)}]`, s ? `¿quisiste decir "${s}"?` : `usar uno de: ${list(schema.enum)}`);
  }
  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) E(`${value} < mínimo ${schema.minimum}`, `≥ ${schema.minimum}`);
    if (schema.maximum != null && value > schema.maximum) E(`${value} > máximo ${schema.maximum}`, `≤ ${schema.maximum}`);
    if (schema.exclusiveMinimum != null && value <= schema.exclusiveMinimum) E(`${value} ≤ ${schema.exclusiveMinimum}`, `> ${schema.exclusiveMinimum}`);
  }
  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) E(`texto vacío o corto (< ${schema.minLength})`, 'rellenar');
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) E(`${show(value)} no casa con ${schema.pattern}`, 'renombrar');
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) E(`${value.length} elementos < ${schema.minItems}`, `al menos ${schema.minItems}`);
    if (schema.maxItems != null && value.length > schema.maxItems) E(`${value.length} elementos > ${schema.maxItems}`, `como mucho ${schema.maxItems}`);
    if (schema.items) value.forEach((v, i) => errs.push(...validate(v, schema.items, root, `${p}/${i}`)));
  }
  if (typeOf(value) === 'object') {
    const props = schema.properties ?? {};
    for (const k of schema.required ?? []) if (!(k in value)) { const near = suggest(k, Object.keys(value)); E(`falta "${k}"`, near ? `¿"${near}" es "${k}" mal escrito?` : `añadir "${k}"`); }
    for (const [k, v] of Object.entries(value)) {
      if (props[k]) errs.push(...validate(v, props[k], root, `${p}/${esc(k)}`));
      else if (schema.additionalProperties === false) {
        const s = suggest(k, Object.keys(props));
        errs.push({ path: `${p}/${esc(k)}`, level: 'FIX', message: 'campo desconocido (nada lo lee)', remedy: s ? `¿quisiste decir "${s}"?` : `quitarlo; válidos: ${Object.keys(props).join(' ')}` });
      } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') errs.push(...validate(v, schema.additionalProperties, root, `${p}/${esc(k)}`));
    }
  }
  return errs;
}
function resolve(s, root) { while (s?.$ref) s = root.$defs[s.$ref.split('/').pop()]; return s ?? {}; }
const describe = (s) => (s.enum ? `[${list(s.enum)}]` : s.type ? [].concat(s.type).join('|') : 'valor');

// ── timeline: esquema + referencias cruzadas → issues con la forma del lint {level, shot, t, problem, remedy, kind} ──
const AXES = ['push', 'slide', 'rotate', 'pan', 'tilt', 'orbit'];
const available = (dir, ext) => { try { return fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(ext) && !f.startsWith('_')).map((f) => f.slice(0, -ext.length)); } catch { return []; } };
export function validateTimeline(tl, { style } = {}) {
  const out = [], at = (p) => { const m = /^\/shots\/(\d+)/.exec(p), s = m ? tl?.shots?.[+m[1]] : null; return { shot: m ? (typeof s?.id === 'string' ? s.id : `#${m[1]}`) : '-', t: typeof s?.t?.[0] === 'number' ? s.t[0] : 0 }; };
  for (const e of validate(tl, TIMELINE_SCHEMA)) out.push({ level: e.level, ...at(e.path), problem: `${e.path}: ${e.message}`, remedy: e.remedy, kind: 'schema' });
  if (out.some((x) => x.level === 'FIX')) return out;                       // referencias cruzadas solo sobre una forma válida
  // F4: señales y parámetros enlazados (expresiones que no parsean, señales inexistentes, ciclos) = estructura rota
  const sch = (problem, remedy, shot = '-', t = 0) => out.push({ level: 'FIX', shot, t, problem, remedy, kind: 'schema' });
  for (const n of Object.keys(tl.signals ?? {})) if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) sch(`/signals/${n}: nombre de señal inválido`, 'usar [A-Za-z_][A-Za-z0-9_]* (se cita en sig(\'nombre\'))');
  try { compileSignals(tl.signals ?? {}, {}); } catch (e) { sch(e.message.split('\n')[0], 'corregir la definición de la señal (docs/PARAMS.md)'); }
  tl.shots.forEach((s, i) => { for (const [k, v] of Object.entries(s.params ?? {})) {
    try { for (const d of bindingDeps(v, `/shots/${i}/params/${k}`)) if (!Object.hasOwn(tl.signals ?? {}, d)) { const g = suggest(d, Object.keys(tl.signals ?? {})); sch(`/shots/${i}/params/${k}: señal desconocida '${d}'`, g ? `¿quisiste decir "${g}"?` : 'declararla en timeline.signals', s.id, s.t[0]); } }
    catch (e) { sch(e.message.split('\n')[0], 'corregir la expresión (docs/PARAMS.md: DSL)', s.id, s.t[0]); }
  } });
  if (out.some((x) => x.level === 'FIX')) return out;
  const ref = (level, shot, t, problem, remedy) => out.push({ level, shot, t: +(+t).toFixed(3), problem, remedy, kind: 'ref' });
  const st = style ?? tl.style ?? 'editorial', styles = available('styles', '.json');
  if (styles.length && !styles.includes(st)) { const s = suggest(st, styles); ref('FIX', '-', 0, `/style: estilo "${st}" no existe en styles/`, s ? `¿quisiste decir "${s}"?` : `disponibles: ${styles.join(' ')}`); }
  const shots = [...tl.shots].sort((a, b) => a.t[0] - b.t[0] || (a.layer ?? 0) - (b.layer ?? 0)), ids = new Set(), all = new Set(tl.shots.map((s) => s.id));
  let covered = 0;
  for (const s of shots) {
    const i = tl.shots.indexOf(s);
    if (ids.has(s.id)) ref('FIX', s.id, s.t[0], 'id duplicado', 'renombrar');
    ids.add(s.id);
    if (!(s.t[1] > s.t[0])) ref('FIX', s.id, s.t[0], `/shots/${i}/t: t inválido [${s.t}]`, 't[1] > t[0]');
    if (s.t[0] > covered + 1e-6) ref('FIX', s.id, covered, `hueco ${covered.toFixed(2)}–${s.t[0].toFixed(2)}s sin shot`, 'extender shot previo o añadir uno');
    covered = Math.max(covered, s.t[1]);
    const mv = s.cam?.move;
    if (s.cam && mv !== 'static' && mv !== 'auto' && !s.cam.why) ref('FIX', s.id, s.t[0], `/shots/${i}/cam/why: falta (move "${mv}")`, `declarar por qué se mueve la cámara: ${ENUMS.why.join('|')}`);
    if (!s.cam && s.camera) { const n = AXES.filter((a) => s.camera.toLowerCase().includes(a)).length; if (n > 1) ref('FIX', s.id, s.t[0], `cámara con ${n} ejes: "${s.camera}"`, 'un solo eje por shot'); }
    if (s.after != null && !all.has(s.after)) { const g = suggest(s.after, [...all]); ref('FIX', s.id, s.t[0], `/shots/${i}/after: "${s.after}" no es un shot`, g ? `¿quisiste decir "${g}"?` : 'corregir id'); }
  }
  if (covered < tl.duration - 1e-6) ref('FIX', '-', covered, 'el film termina sin shot', 'cubrir hasta duration');
  (tl.handoffs ?? []).forEach((h, i) => { for (const k of ['from', 'to']) if (!all.has(h[k])) { const g = suggest(h[k], [...all]); ref('FIX', h[k], h.at, `/handoffs/${i}/${k}: handoff referencia shot inexistente "${h[k]}"`, g ? `¿quisiste decir "${g}"?` : 'corregir id'); } });
  return out;
}
// Capa de overrides (data/layers/*.json): misma validación de estructura que el timeline ($defs.layer).
export const validateLayer = (layer) => validate(layer, { $ref: '#/$defs/layer' }, TIMELINE_SCHEMA);
// Para cargadores (film.mjs → render/cut/autocam/critic): la estructura rota no se renderiza.
export function assertTimeline(tl, name = 'timeline') {
  const bad = validateTimeline(tl).filter((x) => x.kind === 'schema' && x.level === 'FIX');
  if (bad.length) throw new Error(`${name} no valida el esquema (data/timeline.schema.json):\n` + bad.map((x) => `  FIX  ${x.problem}  →  ${x.remedy}`).join('\n'));
  return tl;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  let fixes = 0;
  for (const f of files.length ? files : [activeTimeline()]) {
    const r = validateTimeline(JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8')));
    for (const x of r) console.log(`${x.level.padEnd(4)}  ${String(x.shot).padEnd(6)} ${x.problem}  →  ${x.remedy}`);
    const n = r.filter((x) => x.level === 'FIX').length; fixes += n;
    console.log(`${n ? 'FIX' : 'OK '}  ${f}${r.length - n ? ` (${r.length - n} avisos)` : ''}`);
  }
  process.exit(fixes ? 1 : 0);
}
