// DSL declarativo de escenas v1 (spec 006). PURO (sin fs/builtins): lo importan los shots generados y las herramientas.
//   Un shot se declara como DATOS: params, entidades (de módulos auxiliares), objetos semánticos tipados, cues y expectativas
//   de cámara/transición. shot(scene, libs) compila a { params, entities, draw } — el mismo contrato que un shot JS —
//   y draw(t) es función pura de t (sin estado, sin reloj, sin azar): seek(t) sigue siendo puro.
//   Valores: literal | {"$expr":"…"} (lenguaje de engine/expr.mjs + vars del DSL) | {"$shot":"text"}.
//   Variables: t lt u dur W H k · cada param por nombre · <entidad>_<campo> · <objeto>_<salida> (morph: x y w h r th) · <let>.
//   Funciones extra: spring(x[,curva]) · seg(x,a,b) · at(fx,fy) · param(nombre,t) · color(rol) · vec(…) · str(x) · cat(…) · has(x) · len(x) · nil() · inkA(a[,rol]) · box(x,y,w,h) · set(obj,clave,valor) · item(lista,i[,clave]) · take(lista,n) · pget(nombre) (valor del param por nombre) · las de
//   `fns` (funciones PURAS de un módulo lib). sig() NO existe aquí: las señales llegan por params enlazados.
//   Valores estructurados (objetos/listas con hojas {"$expr"}) en `args` y en `let.value`: se resuelven hoja a hoja.
import { compile as compileExpr, FUNCS, ExprError } from './expr.mjs';
import { seg, ease, lerp, clamp } from './core.mjs';
import { rgba } from './color.mjs';

export const DSL_VERSION = 1;
const BUILTIN_TIME = ['t', 'lt', 'u', 'dur', 't0', 't1'], BUILTIN_FRAME = ['W', 'H', 'k', 'dt', 'S_x0', 'S_x1', 'S_y0', 'S_y1', 'S_w', 'S_h', 'S_cx', 'S_cy', 'boxes'], BUILTIN = [...BUILTIN_TIME, ...BUILTIN_FRAME];
const KIT = ['spring', 'seg', 'at', 'param', 'color', 'vec', 'str', 'cat', 'has', 'len', 'nil', 'inkA', 'box', 'set', 'item', 'take', 'pget'];
const ID_RE = /^[A-Za-z][A-Za-z0-9]*$/, CONST_NAMES = ['pi', 'tau', 'e', 'true', 'false'];
const COMMON = ['id', 'type', 'when', 'cue', 'semantic', 'reads'];
const LIBP = ['lib', 'fn', 'args', 'fields'];
// tipo → { props permitidas, requeridas, salidas (campos que publica como <id>_<campo>) }
export const TYPES = {
  ground: { props: ['fy', 'alpha'], req: ['fy'] },
  marks: { props: ['cols', 'rows', 'x0', 'dx', 'y0', 'dy', 'half', 'color', 'lineWidth'], req: ['cols', 'rows'] },
  gradient: { props: ['x0', 'y0', 'x1', 'y1', 'stops', 'fallback'], req: ['x0', 'y0', 'x1', 'y1', 'stops'], value: true },
  morph: { props: ['from', 'to', 'u', 'x', 'y', 'size', 'fill', 'color', 'label', 'lit', 'angle'], req: ['from', 'to', 'u', 'x', 'y', 'size'], out: ['x', 'y', 'w', 'h', 'r', 'th'] },
  focus: { props: ['x', 'y', 'w', 'h', 'label', 'weight', 'hollow', 'bleed'], req: ['x', 'y', 'w', 'h'] },
  shape: { props: ['shape', 'x', 'y', 'r', 'w', 'h', 'color', 'stroke', 'lineWidth', 'alpha', 'sweep'], req: ['shape', 'x', 'y', 'color'] },
  glow: { props: ['x', 'y', 'r', 'color', 'alpha'], req: ['x', 'y', 'r'] },
  text: { props: ['text', 'x', 'y', 'role', 'alpha', 'color', 'align'], req: ['text', 'x', 'y'] },
  equation: { props: ['steps', 'color', 'stagger'], req: ['steps'] },
  group: { props: ['depth', 'translate', 'children'], req: ['children'] },
  let: { props: ['value', ...LIBP], req: [], value: true },
  formula: { props: ['tex', 'x', 'y', 'size', 'align', 'color', 'write', 'morphTo', 'u', 'stagger'], req: ['tex', 'x', 'y'] },
  layer: { props: ['opts', 'children'], req: ['children'] },
  smear: { props: ['x', 'y', 'vx', 'vy', 'children'], req: ['x', 'y', 'vx', 'vy', 'children'] },
  word: { props: ['lib', 'fn', 'str', 'x', 'y', 'size', 'opts', 'per'], req: ['lib', 'str', 'x', 'y', 'size'], out: ['x', 'y', 'w', 'h'] },
  box: { props: ['x', 'y', 'w', 'h'], req: ['x', 'y', 'w', 'h'] },
  impact: { props: ['at', 'opts'], req: ['at'] },
  focusOf: { props: LIBP, req: ['lib', 'fn'] }, ring: { props: LIBP, req: ['lib', 'fn'] }, dot: { props: LIBP, req: ['lib', 'fn'] }, shatter: { props: LIBP, req: ['lib', 'fn'] },
  cracks: { props: LIBP, req: ['lib', 'fn'] }, gridlines: { props: LIBP, req: ['lib', 'fn'] }, playhead: { props: LIBP, req: ['lib', 'fn'] },
  curve: { props: ['n', 'x', 'y', 'color', 'lineWidth', 'alpha', 'cap'], req: ['n', 'x', 'y'] },
  lines: { props: ['segs', 'color', 'lineWidth', 'alpha'], req: ['segs'] },
  repeat: { props: ['n', 'items', 'fields', 'children'], req: ['children'] },
  plot: { props: LIBP, req: ['lib', 'fn'] }, axis: { props: LIBP, req: ['lib', 'fn'] }, world: { props: LIBP, req: ['lib', 'fn'] },
  hud: { props: LIBP, req: ['lib', 'fn'] }, caption: { props: LIBP, req: ['lib', 'fn'] },
  world3d: { props: LIBP, req: ['lib', 'fn'] }, custom: { props: LIBP, req: ['lib', 'fn'] },
};
const LIBBACKED = ['focusOf', 'ring', 'dot', 'shatter', 'cracks', 'gridlines', 'playhead', 'plot', 'axis', 'world', 'hud', 'caption', 'world3d', 'custom'];
const ARG_TOKENS = ['ctx', 'api', 'film', 't', 'u', 'shot', 'P'], BIND_TOKENS = ['film', 'shot', 't', 'api', 'P'];
const TOP = ['dsl', 'id', 'doc', 'libs', 'fns', 'params', 'entities', 'camera', 'transition', 'objects', 'cues'];
const PARAM_TYPES = ['number', 'integer', 'string', 'color', 'boolean', 'enum', 'json'];

// ── utilidades ────────────────────────────────────────────────────────────────────────────────────────────────────
const isExprV = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && '$expr' in v;
const isLitV = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && '$lit' in v;
const isShotV = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && '$shot' in v;
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
const near = (w, cs) => { let best = null, bd = 1e9; for (const c of cs) { const d = lev(String(w).toLowerCase(), String(c).toLowerCase()); if (d < bd) { bd = d; best = c; } } return best != null && bd <= Math.max(1, Math.floor(String(w).length / 3)) ? best : null; };
const hint = (w, cs) => { const s = near(w, cs); return s ? `¿quisiste decir "${s}"?` : `válidos: ${[...cs].join(' ')}`; };
export const canonical = (v) => (Array.isArray(v) ? '[' + v.map(canonical).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}' : JSON.stringify(v));

// Recorre los valores de un objeto (props con valor expr/literal) → callback(path, valor)
function eachValue(o, f, p = '') {
  const spec = TYPES[o.type]; if (!spec) return;
  for (const k of spec.props) { if (!(k in o) || k === 'children') continue; f(`${p}/${k}`, o[k], k); }
  for (const k of ['when']) if (k in o) f(`${p}/${k}`, { $expr: o[k] }, k);
}
// fuentes de expresión de un valor, a cualquier profundidad (valores estructurados)
function exprSources(v, out = []) {
  if (isExprV(v)) out.push(String(v.$expr));
  else if (Array.isArray(v)) v.forEach((x) => exprSources(x, out));
  else if (v && typeof v === 'object' && !isShotV(v) && !isLitV(v)) Object.values(v).forEach((x) => exprSources(x, out));
  return out;
}
function* walkObjects(list, p = '/objects') { for (let i = 0; i < (list ?? []).length; i++) { const o = list[i]; yield [o, `${p}/${i}`]; if (o?.children) yield* walkObjects(o.children, `${p}/${i}/children`); } }
const entityVars = (E) => Object.entries(E ?? {}).flatMap(([n, e]) => (e.fields ?? []).map((f) => `${n}_${f}`));
const fieldVar = (f) => String(f).replace(/\./g, '_');
const outVars = (o) => (o.id ? (TYPES[o.type].out ?? []).concat(o.fields ?? []).map((f) => `${o.id}_${fieldVar(f)}`).concat(TYPES[o.type].value ? [o.id] : []) : []);
const repVars = (o) => (o.type === 'repeat' ? ['i', 'n', ...(o.fields ?? []).map((f) => `${o.id}_${f}`)] : []);

// ── validación estricta ───────────────────────────────────────────────────────────────────────────────────────────
// → [{level:'FIX', path, message, remedy}]. Nada desconocido pasa: propiedades, tipos, ids, expresiones, params, libs.
export function validateScene(sc) {
  const errs = [], E = (path, message, remedy = '') => errs.push({ level: 'FIX', path, message, remedy });
  if (!sc || typeof sc !== 'object' || Array.isArray(sc)) { E('/', 'la escena debe ser un objeto'); return errs; }
  if (sc.dsl !== DSL_VERSION) E('/dsl', `versión de DSL ${JSON.stringify(sc.dsl)} no soportada`, `"dsl": ${DSL_VERSION}`);
  for (const k of Object.keys(sc)) if (!TOP.includes(k)) E(`/${k}`, `propiedad desconocida "${k}"`, hint(k, TOP));
  const libs = sc.libs ?? {}, params = sc.params ?? {}, ents = sc.entities ?? {}, fns = sc.fns ?? {}, funcs = [...KIT, ...Object.keys(fns)];
  for (const [n, spec] of Object.entries(libs)) if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(n) || typeof spec !== 'string' || !/^\.\/[\w.-]+\.mjs$/.test(spec)) E(`/libs/${n}`, 'lib: nombre alfanumérico → "./modulo.mjs"', '"libs": {"M_mundo": "./M_mundo.mjs"}');
  for (const [n, f] of Object.entries(fns)) {
    const p = `/fns/${n}`; if (!ID_RE.test(n) || BUILTIN.includes(n) || Object.hasOwn(FUNCS, n) || KIT.includes(n)) E(p, `nombre de función "${n}" no válido o reservado`, 'renombrar');
    for (const k of Object.keys(f ?? {})) if (!['lib', 'fn', 'bind', 'reads'].includes(k)) E(`${p}/${k}`, `propiedad desconocida "${k}"`, hint(k, ['lib', 'fn', 'bind', 'reads']));
    for (const r of f?.reads ?? []) if (!(r in params)) E(`${p}/reads`, `param "${r}" no existe`, hint(r, Object.keys(params)));
    for (const b of f?.bind ?? []) if (!BIND_TOKENS.includes(b)) E(`${p}/bind`, `bind "${b}" no válido`, `uno de: ${BIND_TOKENS.join(' ')}`);
    if (!f || !(f.lib in libs)) E(`${p}/lib`, `lib "${f?.lib}" no declarada en libs`, hint(f?.lib ?? '', Object.keys(libs))); if (!f?.fn) E(`${p}/fn`, 'falta fn');
  }
  for (const [n, d] of Object.entries(params)) {
    if (BUILTIN.includes(n) || CONST_NAMES.includes(n) || Object.hasOwn(FUNCS, n) || funcs.includes(n)) E(`/params/${n}`, `nombre de param reservado "${n}"`, 'renombrar');
    if (!d || !PARAM_TYPES.includes(d.type)) E(`/params/${n}/type`, `tipo "${d?.type}" no válido`, `uno de: ${PARAM_TYPES.join(' ')}`);
  }
  for (const [n, e] of Object.entries(ents)) {
    const p = `/entities/${n}`; if (!ID_RE.test(n)) E(p, 'nombre de entidad alfanumérico');
    for (const k of Object.keys(e ?? {})) if (!['lib', 'fn', 'fields', 'reads', 'make'].includes(k)) E(`${p}/${k}`, `propiedad desconocida "${k}"`, hint(k, ['lib', 'fn', 'fields', 'reads', 'make']));
    if (!e || !(e.lib in libs)) E(`${p}/lib`, `lib "${e?.lib}" no declarada en libs`, hint(e?.lib ?? '', Object.keys(libs)));
    if (!e?.fn) E(`${p}/fn`, 'falta fn');
    if (e?.make != null && (!Array.isArray(e.make) || exprSources(e.make).length)) E(`${p}/make`, 'make: lista de literales JSON (argumentos de la fábrica; sin expresiones)');
    for (const r of e?.reads ?? []) if (!(r in params)) E(`${p}/reads`, `param "${r}" no existe`, hint(r, Object.keys(params)));
  }
  const names = new Set([...BUILTIN, ...Object.keys(params), ...entityVars(ents)]), ids = new Set(), cues = new Map();
  for (const [i, c] of (sc.cues ?? []).entries()) {
    const p = `/cues/${i}`;
    for (const k of Object.keys(c ?? {})) if (!['id', 'at', 'dur', 'semantic'].includes(k)) E(`${p}/${k}`, `propiedad desconocida "${k}"`, hint(k, ['id', 'at', 'dur', 'semantic']));
    if (!c?.id || !ID_RE.test(c.id)) E(`${p}/id`, 'cue sin id válido'); else if (cues.has(c.id)) E(`${p}/id`, `cue duplicado "${c.id}"`); else cues.set(c.id, c);
    for (const k of ['at', 'dur']) exprCheck(c?.[k], `${p}/${k}`, names, E, true, k, funcs);
  }
  const STRUCT = ['args', 'value', 'segs', 'items'];
  const check = (list, base, scope) => {
    if (!Array.isArray(list)) { E(base, 'debe ser una lista'); return; }
    list.forEach((o, i) => {
      const p = `${base}/${i}`;
      if (!o || typeof o !== 'object') { E(p, 'objeto inválido'); return; }
      const spec = TYPES[o.type];
      if (!spec) { E(`${p}/type`, `tipo de objeto desconocido "${o.type}"`, hint(o.type ?? '', Object.keys(TYPES))); return; }
      const ok = [...COMMON, ...spec.props];
      for (const k of Object.keys(o)) if (!ok.includes(k)) E(`${p}/${k}`, `propiedad desconocida "${k}" en ${o.type}`, hint(k, ok));
      for (const k of spec.req) if (!(k in o)) E(`${p}/${k}`, `falta "${k}" en ${o.type}`);
      if (o.type === 'let' && !('value' in o) && !(o.lib && o.fn)) E(p, 'let: falta "value" (o "lib"+"fn")');
      if (o.type === 'let' && 'value' in o && (o.lib || o.fn)) E(p, 'let: "value" y "lib/fn" son excluyentes');
      if (o.type === 'repeat' && !('n' in o) && !('items' in o)) E(p, 'repeat: falta "n" (o "items")');
      if (o.type === 'repeat' && o.items != null && !Array.isArray(o.items) && !isExprV(o.items)) E(`${p}/items`, 'items: lista de filas (listas de literales) o {"$expr"} que da una lista');
      if (o.fields && !Array.isArray(o.fields)) E(`${p}/fields`, 'fields: lista de nombres');
      if (o.type === 'repeat' && (o.fields ?? []).length && !o.id) E(p, 'repeat con fields necesita id');
      if (o.id != null) { if (!ID_RE.test(o.id) || CONST_NAMES.includes(o.id)) E(`${p}/id`, `id "${o.id}" no válido (letras y dígitos, sin "_"; ni constantes: ${CONST_NAMES.join(' ')})`); else if (ids.has(o.id)) E(`${p}/id`, `id duplicado "${o.id}"`); else ids.add(o.id); }
      if (o.cue != null && !cues.has(o.cue)) E(`${p}/cue`, `cue "${o.cue}" no existe`, hint(o.cue, [...cues.keys()]));
      for (const r of o.reads ?? []) if (!(r in params)) E(`${p}/reads`, `param "${r}" no existe`, hint(r, Object.keys(params)));
      if (o.when != null) exprCheck({ $expr: o.when }, `${p}/when`, scope, E, false, undefined, funcs);
      for (const k of spec.props) { if (!(k in o)) continue; const v = o[k];
        if (k === 'children') { const inner = o.type === 'repeat' ? new Set([...scope, ...repVars(o)]) : scope; check(v, `${p}/children`, inner); }
        else if (k === 'steps') { if (!Array.isArray(v) && !(v && v.lib in libs && v.export)) E(`${p}/steps`, 'steps: lista de {t,d,tex,x,y,s} o {lib, export}'); }
        else if (k === 'lib') { if (!(v in libs)) E(`${p}/lib`, `lib "${v}" no declarada en libs`, hint(v, Object.keys(libs))); }
        else if (k === 'fn' || k === 'fields') { /* literal */ }
        else if (k === 'args') { for (const [j, a] of (v ?? []).entries()) if (typeof a === 'string' && !ARG_TOKENS.includes(a)) E(`${p}/args/${j}`, `argumento "${a}" no válido`, `uno de: ${ARG_TOKENS.join(' ')} o {"$expr":…}`); else if (typeof a !== 'string') structCheck(a, `${p}/args/${j}`, scope, E, funcs); }
        else if (k === 'per') { if (!v || typeof v !== 'object') E(`${p}/per`, 'per: objeto {dy,dx,s,a,rot,color} de expresiones'); else structCheck(v, `${p}/per`, new Set([...scope, 'pk', 'pn']), E, funcs); }
        else if (k === 'translate') structCheck(v, `${p}/translate`, scope, E, funcs);
        else if (k === 'at' && o.type === 'impact') exprCheck(v, `${p}/at`, scope, E, false, undefined, funcs);
        else if (k === 'value' || k === 'segs' || k === 'opts') structCheck(v, `${p}/${k}`, scope, E, funcs);
        else if (k === 'items') { if (isExprV(v)) exprCheck(v, `${p}/items`, scope, E, false, undefined, funcs); }
        else if (k === 'stops') { if (!Array.isArray(v) || v.length < 2) E(`${p}/stops`, 'stops: lista de ≥2 colores'); else v.forEach((s, j) => exprCheck(s, `${p}/stops/${j}`, scope, E, false, undefined, funcs)); }
        else if (k === 'shape') { if (!['circle', 'rect'].includes(v)) E(`${p}/shape`, `forma "${v}" no válida`, 'circle | rect'); }
        else if (['from', 'to', 'role', 'label', 'fallback', 'align', 'cap', 'morphTo'].includes(k) && typeof v === 'string') { /* literal */ }
        else exprCheck(v, `${p}/${k}`, o.type === 'curve' && (k === 'x' || k === 'y') ? new Set([...scope, 'i', 'n']) : scope, E, false, undefined, funcs);
      }
      if (LIBBACKED.includes(o.type) && !o.reads) { /* opaco: se declara en deps */ }
      for (const v of outVars(o)) scope.add(v);
    });
  };
  check(sc.objects, '/objects', names);
  return errs;
}
function structCheck(v, path, names, E, funcs) {
  if (Array.isArray(v)) v.forEach((x, j) => structCheck(x, `${path}/${j}`, names, E, funcs));
  else if (isLitV(v)) { /* literal verbatim */ }
  else if (v && typeof v === 'object' && !isExprV(v) && !isShotV(v)) for (const [k, x] of Object.entries(v)) structCheck(x, `${path}/${k}`, names, E, funcs);
  else exprCheck(v, path, names, E, false, undefined, funcs);
}
function exprCheck(v, path, names, E, requireExpr, key, funcs = KIT) {
  if (v === undefined) { if (requireExpr) E(path, `falta "${key}"`); return; }
  if (isShotV(v)) { if (typeof v.$shot !== 'string') E(path, '$shot debe ser texto'); return; }
  if (isLitV(v)) return;
  if (!isExprV(v)) { if (v && typeof v === 'object') E(path, 'valor no válido (literal, {"$expr"} o {"$shot"})'); else if (requireExpr && typeof v !== 'number') E(path, 'se esperaba número o {"$expr"}'); return; }
  const src = String(v.$expr);
  if (/\bsig\s*\(/.test(src)) { E(path, 'sig() no existe en el DSL de escenas', 'enlaza la señal a un param ({"$sig":…} en el timeline) y léelo por su nombre'); return; }
  try { const c = compileExpr(src, { path, vars: [...names], funcs }); for (const x of c.vars) if (!names.has(x) && !BUILTIN.includes(x)) E(path, `variable desconocida "${x}"`, hint(x, names)); }
  catch (e) { if (e instanceof ExprError) { const m = /identificador desconocido '(\w+)'/.exec(e.reason); E(path, m ? `variable desconocida "${m[1]}"` : e.reason, m ? hint(m[1], names) : 'ver engine/expr.mjs'); } else throw e; }
}
export function assertScene(sc, where = 'escena') { const f = validateScene(sc); if (f.length) throw new Error(`${where}: ${f.map((x) => `${x.path}: ${x.message}${x.remedy ? ' → ' + x.remedy : ''}`).join('; ')}`); return sc; }

// ── dependencias exactas por objeto ──────────────────────────────────────────────────────────────────────────────
export function depsOf(sc) {
  const params = new Set(Object.keys(sc.params ?? {})), ents = sc.entities ?? {}, fns = sc.fns ?? {}, entOf = new Map(Object.entries(ents).flatMap(([n, e]) => (e.fields ?? []).map((f) => [`${n}_${f}`, n])));
  const outOf = new Map(), cues = new Map((sc.cues ?? []).map((c) => [c.id, c])), res = [], funcs = [...KIT, ...Object.keys(fns)];
  const exprs = (o) => { const L = []; eachValue(o, (p, v) => exprSources(v, L)); return L; };
  const scan = (list, inRep = []) => { for (const o of list ?? []) {
    const d = { id: o.id ?? null, type: o.type, time: false, frame: false, params: new Set(), entities: new Set(), objects: new Set(), libs: new Set(), shot: new Set(), opaque: false };
    const srcs = exprs(o); if (o.cue) { const c = cues.get(o.cue); for (const k of ['at', 'dur']) if (isExprV(c?.[k])) srcs.push(c[k].$expr); d.cue = o.cue; }
    const local = [...inRep, ...(o.type === 'repeat' ? repVars(o) : []), ...(o.type === 'curve' ? ['i', 'n'] : []), ...(o.type === 'word' ? ['pk', 'pn'] : [])];
    for (const s of srcs) { const c = compileExpr(s, { vars: [...BUILTIN, ...params, ...entOf.keys(), ...outOf.keys(), ...local], funcs });
      for (const x of c.vars) { if (BUILTIN_TIME.includes(x)) d.time = true; else if (BUILTIN_FRAME.includes(x)) d.frame = true; else if (params.has(x)) d.params.add(x); else if (entOf.has(x)) d.entities.add(entOf.get(x)); else if (outOf.has(x)) d.objects.add(outOf.get(x)); }
      for (const f of Object.keys(fns)) if (new RegExp(`\\b${f}\\s*\\(`).test(s)) { d.libs.add(fns[f].lib); d.time ||= (fns[f].bind ?? []).includes('t') || (fns[f].bind ?? []).includes('film'); for (const r of fns[f].reads ?? []) d.params.add(r); if ((fns[f].bind ?? []).includes('P') && !fns[f].reads) d.opaque = true; }
      if (/\bparam\s*\(/.test(s)) { d.time = true; for (const m of s.matchAll(/\bparam\s*\(\s*['"](\w+)['"]/g)) if (params.has(m[1])) d.params.add(m[1]); } }
    for (const [, v] of Object.entries(o)) if (isShotV(v)) d.shot.add(v.$shot);
    for (const k of ['text', 'x', 'y', 'alpha']) if (isShotV(o[k])) d.shot.add(o[k].$shot);
    if (d.entities.size) for (const e of d.entities) { d.libs.add(ents[e].lib); for (const r of ents[e].reads ?? []) d.params.add(r); if (!ents[e].reads) d.opaque = true; d.time = true; }
    if (o.lib) { d.libs.add(o.lib); const toks = (o.args ?? (o.type === 'let' ? [] : ['ctx', 'api', 'film', 't'])).filter((a) => typeof a === 'string'), pureCall = !toks.some((a) => ['film', 'shot', 'P'].includes(a)); if (toks.includes('t') || toks.includes('u') || o.type !== 'let') d.time = true; if (o.reads) o.reads.forEach((r) => d.params.add(r)); else if (!pureCall) d.opaque = true; }
    if (o.type === 'equation') { d.time = true; d.frame = true; if (o.steps?.lib) d.libs.add(o.steps.lib); }
    if (o.type === 'text' || o.type === 'let') d.time ||= false;
    for (const x of o.reads ?? []) d.params.add(x);
    if (o.children) { d.children = (o.children ?? []).map((c) => c.id ?? c.type); }
    for (const v of outVars(o)) outOf.set(v, o.id);
    res.push(d); if (o.children) scan(o.children, local);
  } };
  scan(sc.objects);
  const byId = new Map(res.filter((d) => d.id).map((d) => [d.id, d]));
  for (const d of res) {   // cierre transitivo: lo que lee a través de otros objetos
    const P = new Set(d.params), seen = new Set(), st = [...d.objects]; let opaque = d.opaque, time = d.time;
    while (st.length) { const id = st.pop(); if (seen.has(id)) continue; seen.add(id); const q = byId.get(id); if (!q) continue; q.params.forEach((x) => P.add(x)); opaque ||= q.opaque; time ||= q.time; q.objects.forEach((x) => st.push(x)); }
    d.inputs = [...P].sort(); d.opaqueInputs = opaque; d.timeDependent = time;
  }
  return res.map((d) => ({ id: d.id, type: d.type, ...(d.cue ? { cue: d.cue } : {}), time: d.time, frame: d.frame, params: [...d.params].sort(), entities: [...d.entities].sort(), objects: [...d.objects].sort(), libs: [...d.libs].sort(), shot: [...d.shot].sort(), opaque: d.opaque, inputs: d.inputs, opaqueInputs: d.opaqueInputs, timeDependent: d.timeDependent }));
}
// ¿qué objetos dependen de este param? (exacto + posibles por opacidad)
export const objectsReading = (sc, param) => { const D = depsOf(sc); return { exact: D.filter((d) => d.inputs.includes(param)).map((d) => d.id ?? d.type), possible: D.filter((d) => d.opaqueInputs && !d.inputs.includes(param)).map((d) => d.id ?? d.type) }; };

// ── diff semántico ────────────────────────────────────────────────────────────────────────────────────────────────
function flatObjs(sc) { const m = new Map(); let n = 0; for (const [o] of walkObjects(sc.objects)) { const { children, ...rest } = o; m.set(o.id ?? `#${o.type}${n++}`, rest); } return m; }
const delta = (a, b) => { const out = []; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (canonical(a[k]) !== canonical(b[k])) out.push(k); return out.sort(); };
export function diffScenes(A, B) {
  const R = { objects: { added: [], removed: [], changed: [] }, params: { added: [], removed: [], changed: [] }, cues: { added: [], removed: [], changed: [] }, entities: { added: [], removed: [], changed: [] }, meta: [] };
  const cmp = (a, b, into, withDetail = true) => { for (const k of Object.keys(b)) if (!(k in a)) into.added.push(k); for (const k of Object.keys(a)) if (!(k in b)) into.removed.push(k);
    for (const k of Object.keys(a)) if (k in b && canonical(a[k]) !== canonical(b[k])) into.changed.push(withDetail && a[k] && b[k] && typeof a[k] === 'object' ? { id: k, props: delta(a[k], b[k]) } : { id: k }); };
  cmp(Object.fromEntries(flatObjs(A)), Object.fromEntries(flatObjs(B)), R.objects);
  // hijos de un grupo: la lista de ids cambia → el grupo cambia
  const order = (sc) => [...walkObjects(sc.objects)].map(([o]) => o.id ?? o.type).join(','); if (order(A) !== order(B)) R.meta.push('orden/estructura de objetos');
  cmp(A.params ?? {}, B.params ?? {}, R.params); cmp(Object.fromEntries((A.cues ?? []).map((c) => [c.id, c])), Object.fromEntries((B.cues ?? []).map((c) => [c.id, c])), R.cues);
  cmp(A.entities ?? {}, B.entities ?? {}, R.entities);
  for (const k of ['camera', 'transition', 'libs']) if (canonical(A[k]) !== canonical(B[k])) R.meta.push(k);
  for (const g of Object.values(R)) if (g && g.added) { g.added.sort(); g.removed.sort(); g.changed.sort((x, y) => x.id.localeCompare(y.id)); }
  R.same = ['objects', 'params', 'cues', 'entities'].every((k) => !R[k].added.length && !R[k].removed.length && !R[k].changed.length) && !R.meta.length;
  return R;
}
export function formatDiff(R) {
  if (R.same) return 'sin cambios semánticos';
  const L = [];
  for (const k of ['objects', 'params', 'cues', 'entities']) { const g = R[k];
    for (const a of g.added) L.push(`+ ${k.slice(0, -1)} ${a}`); for (const a of g.removed) L.push(`- ${k.slice(0, -1)} ${a}`);
    for (const c of g.changed) L.push(`~ ${k.slice(0, -1)} ${c.id}${c.props ? ` (${c.props.join(', ')})` : ''}`); }
  for (const m of R.meta) L.push(`~ ${m}`);
  return L.join('\n');
}

// ── compilación → módulo de shot ──────────────────────────────────────────────────────────────────────────────────
function eqAt(EQ, t) {
  let i = -1; for (let k = 0; k < EQ.length; k++) if (EQ[k].t <= t) i = k; if (i < 0) return null;
  const eio = (u) => ease.inOut(Math.min(1, Math.max(0, u))), e = EQ[i], u = (t - e.t) / e.d;
  if (i === 0) return { tex: e.tex, x: e.x, y: e.y, s: e.s, write: eio(u), morphTo: undefined, u: 0 };
  const p = EQ[i - 1], k = eio(u), same = p.tex === e.tex;
  if (k >= 1 - 1e-9) return { tex: e.tex, x: e.x, y: e.y, s: e.s, write: 1, morphTo: undefined, u: 0 };
  return { tex: p.tex, x: lerp(p.x, e.x, k), y: lerp(p.y, e.y, k), s: lerp(p.s, e.s, k), write: 1, morphTo: same ? undefined : e.tex, u: same ? 0 : k };
}
const pick = (o, ks, ev) => { const r = {}; for (const k of ks) if (k in o) r[k] = ev(o[k], k); return r; };
const pathGet = (obj, p) => String(p).split('.').reduce((a, k) => a?.[k], obj);

export function shot(scene, libs = {}) {
  assertScene(scene, `escena ${scene?.id ?? '?'}`);
  const names = new Set([...BUILTIN, ...Object.keys(scene.params ?? {}), ...entityVars(scene.entities)]), cache = new Map(), fnDefs = scene.fns ?? {}, funcs = [...KIT, ...Object.keys(fnDefs)];
  const ce = (src) => { let c = cache.get(src); if (!c) { c = compileExpr(src, { vars: [...names, ...allOut(scene), 'i', 'n'], funcs }); cache.set(src, c); } return c; };
  const ents = scene.entities ?? {}, getFn = (lib, fn) => { const f = pathGet(libs[lib], fn); if (typeof f !== 'function') throw new Error(`dsl: ${lib}.${fn} no es una función (¿lib sin pasar a shot()?)`); return f; };
  const entities = Object.fromEntries(Object.entries(ents).map(([n, e]) => { let made = null; return [n, e.make ? (...a) => (made ??= getFn(e.lib, e.fn)(...e.make))(...a) : (...a) => getFn(e.lib, e.fn)(...a)]; }));
  const libFns = (cur, shotDef, film, env) => Object.fromEntries(Object.entries(fnDefs).map(([n, f]) => [n, (...a) => getFn(f.lib, f.fn)(...(f.bind ?? []).map((b) => ({ film, shot: shotDef, t: env.t, api: cur.api, P: cur.api.params })[b]), ...a)]));
  function draw(ctx0, t, u, shotDef, film, api0) {
    const cur = { ctx: ctx0, api: api0 }, P = api0.params, env = { t, lt: t - shotDef.t[0], u, dur: shotDef.t[1] - shotDef.t[0], t0: shotDef.t[0], t1: shotDef.t[1], W: film.width, H: film.height, k: api0.k, dt: api0.dt, ...P };
    env.boxes = [];
    for (const [kk, vv] of Object.entries({ x0: 'x0', x1: 'x1', y0: 'y0', y1: 'y1', w: 'w', h: 'h', cx: 'cx', cy: 'cy' })) env[`S_${kk}`] = api0.safe[vv];
    env.fns = { ...libFns(cur, shotDef, film, env), spring: (x, name) => cur.api.spring(x, name), seg: (x, a, b) => seg(x, a, b), at: (fx, fy) => cur.api.at(fx, fy), param: (n, tt) => cur.api.param(n, tt), color: (c) => cur.api.color(c), vec: (...a) => a, str: (x) => String(x), cat: (...a) => a.join(''), has: (x) => x != null, len: (x) => x?.length ?? 0, nil: () => null, box: (x, y, w, h) => ({ x, y, w, h }), set: (o, k, v) => ({ ...o, [k]: v }), item: (a, i, k) => (k === undefined ? a?.[i] : a?.[i]?.[k]), take: (a, n) => a.slice(0, n), pget: (name) => cur.api.params[name],
      inkA: (a, role = 'ink') => (a >= 0.999 ? role : rgba(cur.api.color(role), clamp(a))) };
    env.sig = () => { throw new Error('sig() no existe en el DSL'); };
    for (const [n, e] of Object.entries(ents)) if (e.fields?.length) { const r = entities[n](t, film, api0); for (const f of e.fields) env[`${n}_${f}`] = r[f]; }
    const cueOn = (id) => { const c = (scene.cues ?? []).find((x) => x.id === id), at = val(c.at), du = val(c.dur); return env.lt >= at && env.lt < at + du; };
    const val = (v) => (isExprV(v) ? ce(String(v.$expr)).fn(env) : isShotV(v) ? shotDef[v.$shot] : isLitV(v) ? v.$lit : Array.isArray(v) ? v.map(val) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, val(x)])) : v);
    const publish = (o, r) => { if (o.id) { if (TYPES[o.type].value || o.fields) env[o.id] = r; for (const f of o.fields ?? []) env[`${o.id}_${fieldVar(f)}`] = pathGet(r, f); } };
    const run = (list) => { const ctx = cur.ctx, api = cur.api; for (const o of list) {
      if (o.when != null && !ce(String(o.when)).fn(env)) continue; if (o.cue != null && !cueOn(o.cue)) continue;
      switch (o.type) {
        case 'ground': api.ground(val(o.fy), ...(o.alpha != null ? [val(o.alpha)] : [])); break;
        case 'marks': { const c = val(o.color ?? 'shade'), x0 = val(o.x0 ?? 0), dx = val(o.dx ?? 0.1), y0 = val(o.y0 ?? 0), dy = val(o.dy ?? 0.25), h = val(o.half ?? 7); ctx.strokeStyle = api.color(c); ctx.lineWidth = val(o.lineWidth ?? 2);
          for (let i = 0; i < val(o.cols); i++) for (let j = 0; j < val(o.rows); j++) { const x = film.width * (x0 + i * dx), y = api.safe.y0 + api.safe.h * (y0 + j * dy); ctx.beginPath(); ctx.moveTo(x - h, y); ctx.lineTo(x + h, y); ctx.moveTo(x, y - h); ctx.lineTo(x, y + h); ctx.stroke(); } break; }
        case 'gradient': env[o.id] = api.gradient(val(o.x0), val(o.y0), val(o.x1), val(o.y1), o.stops.map(val), o.fallback ?? 'ink'); break;
        case 'morph': { const m = api.morph(o.from, o.to, val(o.u), pick(o, ['x', 'y', 'size', 'fill', 'color', 'label', 'lit', 'angle'], val)); if (o.id) for (const f of TYPES.morph.out) env[`${o.id}_${f}`] = m[f]; break; }
        case 'focus': api.focus(val(o.x), val(o.y), val(o.w), val(o.h), o.label ?? 'focus', pick(o, ['weight', 'hollow', 'bleed'], val)); break;
        case 'shape': {
          const styled = o.alpha != null || o.stroke || o.lineWidth != null; if (styled) ctx.save();
          if (o.stroke) { ctx.strokeStyle = api.color(val(o.color)); if (o.lineWidth != null) ctx.lineWidth = val(o.lineWidth); } else ctx.fillStyle = api.color(val(o.color));
          if (o.alpha != null) ctx.globalAlpha = val(o.alpha);
          if (o.shape === 'circle') { ctx.beginPath(); ctx.arc(val(o.x), val(o.y), val(o.r), 0, o.sweep != null ? val(o.sweep) : Math.PI * 2); o.stroke ? ctx.stroke() : ctx.fill(); }
          else if (o.stroke) ctx.strokeRect(val(o.x), val(o.y), val(o.w), val(o.h)); else { ctx.beginPath(); ctx.rect(val(o.x), val(o.y), val(o.w), val(o.h)); ctx.fill(); }
          if (styled) ctx.restore(); break; }
        case 'glow': api.glow(val(o.x), val(o.y), val(o.r), ...(o.color != null ? [val(o.color)] : []), ...(o.alpha != null ? [val(o.alpha)] : [])); break;
        case 'text': api.text(val(o.text), val(o.x), val(o.y), pick(o, ['role', 'alpha', 'color', 'align'], val)); break;
        case 'equation': { const EQ = Array.isArray(o.steps) ? o.steps : pathGet(libs[o.steps.lib], o.steps.export), q = eqAt(EQ, t); if (q) api.tex(q.tex, q.x * film.width, q.y * film.height, { size: q.s * film.height, align: 'center', color: o.color ?? 'ink', write: q.write, morphTo: q.morphTo, u: q.u, stagger: o.stagger ?? 0.55 }); break; }
        case 'group': { const body = () => { if (o.translate) { const [tx, ty] = val(o.translate); ctx.save(); ctx.translate(tx, ty); try { run(o.children); } finally { ctx.restore(); } } else run(o.children); }; if (o.depth != null) api.depth(val(o.depth), body); else body(); break; }
        case 'word': { const opts = { ...(val(o.opts ?? {})) }; if (o.per) opts.per = (kk, nn) => { const sk = [env.pk, env.pn]; env.pk = kk; env.pn = nn; const q = {}; for (const [key, ex] of Object.entries(o.per)) { const v = val(ex); if (v !== undefined) q[key] = v; } [env.pk, env.pn] = sk; return q; };
          const b = getFn(o.lib, o.fn ?? 'word')(ctx, api, val(o.str), val(o.x), val(o.y), val(o.size), opts); env.boxes.push(b); if (o.id) for (const f of TYPES.word.out) env[`${o.id}_${f}`] = b[f]; break; }
        case 'box': env.boxes.push({ x: val(o.x), y: val(o.y), w: val(o.w), h: val(o.h) }); break;
        case 'impact': api.impact(val(o.at), val(o.opts ?? {})); break;
        case 'let': if (o.lib) { const A = { ctx, api, film, t: env.t, u, shot: shotDef }; publish(o, getFn(o.lib, o.fn)(...(o.args ?? []).map((a) => (typeof a === 'string' ? A[a] : val(a))))); } else publish(o, val(o.value)); break;
        case 'formula': api.tex(val(o.tex), val(o.x), val(o.y), pick(o, ['size', 'align', 'color', 'write', 'morphTo', 'u', 'stagger'], val)); break;
        case 'layer': api.layer(val(o.opts ?? {}), (c, tt, A) => { const sv = [cur.ctx, cur.api, env.t, env.lt]; cur.ctx = c; cur.api = A; env.t = tt; env.lt = tt - shotDef.t[0]; try { run(o.children); } finally { [cur.ctx, cur.api, env.t, env.lt] = sv; } }); break;
        case 'smear': api.smear(val(o.x), val(o.y), val(o.vx), val(o.vy), () => run(o.children)); break;
        case 'curve': { const n = val(o.n), sI = env.i, sN = env.n; ctx.save(); ctx.strokeStyle = api.color(val(o.color ?? 'ink')); ctx.lineWidth = val(o.lineWidth ?? 2); ctx.globalAlpha = val(o.alpha ?? 1); if (o.cap) ctx.lineCap = o.cap; ctx.beginPath(); env.n = n;
          for (let i = 0; i <= n; i++) { env.i = i; const x = val(o.x), y = val(o.y); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } env.i = sI; env.n = sN; ctx.stroke(); ctx.restore(); break; }
        case 'lines': { ctx.save(); ctx.strokeStyle = api.color(val(o.color ?? 'ink')); ctx.globalAlpha = val(o.alpha ?? 1); ctx.lineWidth = val(o.lineWidth ?? 1); ctx.beginPath(); for (const sg of o.segs) { const [x0, y0, x1, y1] = val(sg); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); } ctx.stroke(); ctx.restore(); break; }
        case 'repeat': { const sI = env.i, sN = env.n, rows = isExprV(o.items) ? val(o.items) : o.items ?? null, n = rows ? rows.length : val(o.n); env.n = n;
          for (let i = 0; i < n; i++) { env.i = i; if (rows) (o.fields ?? []).forEach((f, j) => { env[`${o.id}_${f}`] = (Array.isArray(rows[i]) ? rows[i][j] : rows[i][f]); }); run(o.children); } env.i = sI; env.n = sN; break; }
        default: { const f = getFn(o.lib, o.fn), A = { ctx, api, film, t: env.t, u, shot: shotDef }, r = f(...(o.args ?? ['ctx', 'api', 'film', 't']).map((a) => (typeof a === 'string' ? A[a] : val(a)))); if (o.fields) publish(o, r); }
      } } };
    run(scene.objects ?? []);
  }
  const mod = { draw, dsl: scene };
  if (scene.params) mod.params = scene.params;
  if (Object.keys(entities).length) mod.entities = entities;
  return mod;
}
const allOut = (sc) => [...walkObjects(sc.objects)].flatMap(([o]) => [...outVars(o), ...repVars(o)]);

// ── generación del shot .mjs desde .scene.json ────────────────────────────────────────────────────────────────────
export function generateShotSource(scene, srcName) {
  assertScene(scene, srcName);
  const libs = Object.entries(scene.libs ?? {}), imports = libs.map(([n, f]) => `import * as ${n} from '${f}';`).join('\n');
  return `// GENERADO desde ${srcName} por \`node engine/dsl.mjs build\` (spec 006). No editar a mano: edita el .scene.json y regenera.\nimport { shot } from '../engine/dsl-core.mjs';\n${imports ? imports + '\n' : ''}export default shot(${JSON.stringify(scene, null, 1)}, { ${libs.map(([n]) => n).join(', ')} });\n`;
}
