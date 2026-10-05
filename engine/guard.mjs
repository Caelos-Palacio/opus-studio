// Guardia del contrato v4. Cierra el hueco de v3.5: usar ctx crudo se saltaba tipografía, safe area y cámara.
// Dos capas: (1) Proxy del ctx durante lint (film.guard; en render no hay Proxy: coste cero);
//            (2) escaneo estático por AST (acorn) de shots/*.mjs, resistente a alias, acceso computado y comentarios.
// La tercera capa (sandbox en ejecución) vive en engine/sandbox.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import { fullAncestor } from 'acorn-walk';

const PAINT = new Set(['fill', 'stroke', 'fillRect', 'strokeRect', 'drawImage']);
// Modos que borran lo que ya había en el frame (otros shots, el papel): destructivos en el ctx principal.
const WIPE = new Set(['copy', 'source-in', 'source-out', 'destination-in', 'destination-atop']);
export function guardCtx(ctx, rec) {
  const m0 = ctx.getTransform(), det = (m) => Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)), base = det(m0) || 1, op0 = ctx.globalCompositeOperation;
  let depth = 0; const scales = [];
  const proxy = new Proxy(ctx, {
    get(target, prop) {
      const v = target[prop];
      if (typeof v !== 'function') return v;
      if (prop === 'fillText' || prop === 'strokeText') return (...a) => { rec.violations.push({ op: prop, detail: String(a[0]).slice(0, 40) }); return v.apply(target, a); };
      if (prop === 'setTransform' || prop === 'resetTransform') return (...a) => { rec.violations.push({ op: prop, detail: 'transform absoluta: ignora la cámara del motor' }); return v.apply(target, a); };
      if (prop === 'save') return () => { depth++; return v.call(target); };
      if (prop === 'restore') return () => { depth--; return v.call(target); };
      if (PAINT.has(prop)) return (...a) => { if (!rec.inApi) scales.push(det(target.getTransform()) / base); return v.apply(target, a); };
      // Píxeles en espacio de dispositivo: ignoran cámara, transform, alpha y composición (y leer el frame acopla shots).
      if (prop === 'getImageData') return (...a) => { if (!rec.inApi) rec.violations.push({ op: prop, detail: 'lectura de píxeles del frame (espacio de dispositivo: ignora la cámara; acopla shots)' }); return v.apply(target, a); };
      if (prop === 'putImageData') return (...a) => { if (!rec.inApi) rec.violations.push({ op: prop, detail: 'escritura de píxeles cruda: ignora cámara, transform, alpha y composición' }); return v.apply(target, a); };
      return v.bind(target);
    },
    set(target, prop, val) {
      if (prop === 'globalCompositeOperation' && !rec.inApi && WIPE.has(String(val))) rec.violations.push({ op: 'globalCompositeOperation', detail: `'${val}' en el ctx principal borra el frame (otros shots, papel): usar api.layer` });
      target[prop] = val; return true;
    },
  });
  return {
    ctx: proxy,
    end() {
      const m1 = ctx.getTransform(), moved = ['a', 'b', 'c', 'd', 'e', 'f'].some((k) => Math.abs(m1[k] - m0[k]) > 1e-6);
      if (depth !== 0) rec.violations.push({ op: 'save/restore', detail: `desequilibrio ${depth > 0 ? '+' : ''}${depth}` });
      else if (moved) rec.violations.push({ op: 'transform', detail: 'el shot deja el ctx transformado (fuga de estado)' });
      if (depth === 0 && ctx.globalCompositeOperation !== op0) rec.violations.push({ op: 'composite', detail: `el shot deja globalCompositeOperation='${ctx.globalCompositeOperation}' (fuga de estado)` });
      if (scales.length >= 8) { const s = [...scales].sort((a, b) => a - b), med = s[s.length >> 1], frac = s.filter((v) => Math.abs(v - med) / med < 0.03).length / s.length; rec.scale = { med, frac, n: s.length }; }
    },
  };
}

// ───────────────────────── Escaneo estático por AST ─────────────────────────
// Lo que rompe la pureza de seek(t) o escapa del contrato se detecta ANTES de renderizar, con archivo y línea.
const parseMod = (src) => parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowHashBang: true });
const REL = /^\.\.?\//;

// Módulos del motor importables desde un shot: los que (transitivamente) no importan builtins ni paquetes.
// Son el núcleo compartido navegador/Node (core, geom, api, prims, …); film/render/cut/tex… quedan fuera.
const PURE = new Map();
export function pureEngineModules(root) {
  const dir = path.join(root, 'engine'), key = path.resolve(dir);
  if (PURE.has(key)) return PURE.get(key);
  const deps = new Map();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.mjs')) continue;
    let ast; try { ast = parseMod(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { deps.set(f, null); continue; }
    const src = []; let dyn = false;
    fullAncestor(ast, (n) => { if (n.type === 'ImportExpression') dyn = true; else if ((n.type === 'ImportDeclaration' || n.type === 'ExportNamedDeclaration' || n.type === 'ExportAllDeclaration') && n.source) src.push(n.source.value); });
    deps.set(f, dyn || src.some((s) => !/^\.\/[\w.-]+\.mjs$/.test(s)) ? null : src.map((s) => s.slice(2)));
  }
  const pure = new Set([...deps].filter(([, d]) => d).map(([f]) => f));
  for (let changed = true; changed;) { changed = false; for (const f of [...pure]) if (deps.get(f).some((d) => !pure.has(d))) { pure.delete(f); changed = true; } }
  const out = new Set([...pure].map((f) => path.join(key, f)));
  PURE.set(key, out); return out;
}
// ¿Puede un shot (archivo `from`) importar el archivo resuelto `target`? Solo otros shots o el núcleo puro del motor.
export function shotImportAllowed(root, target) {
  const t = path.resolve(target), shots = path.resolve(root, 'shots') + path.sep;
  return (t.startsWith(shots) && t.endsWith('.mjs')) || pureEngineModules(root).has(t);
}

// Globales prohibidos (si el archivo no declara una variable con ese nombre).
const BANNED_IDS = {
  eval: ['eval', 'código desde string: prohibido en un shot'],
  Function: ['Function (código desde string)', 'nada de new Function / Function(): escribe el código en el shot'],
  process: ['acceso a process', 'el shot no ve el proceso (env, argv, getBuiltinModule…): parámetros por timeline'],
  globalThis: ['acceso a globalThis', 'nada de globales: todo llega por (ctx, t, u, shot, film, api)'],
  global: ['acceso a global', 'nada de globales: todo llega por (ctx, t, u, shot, film, api)'],
  window: ['acceso a window', 'nada de globales: todo llega por (ctx, t, u, shot, film, api)'],
  self: ['acceso a self', 'nada de globales: todo llega por (ctx, t, u, shot, film, api)'],
  require: ['require', 'solo import estático de ../engine/*.mjs puros o ./otro-shot.mjs'],
  module: ['acceso a module', 'solo import estático de ../engine/*.mjs puros o ./otro-shot.mjs'],
  Reflect: ['Reflect (acceso reflexivo)', 'acceso directo a lo que el shot necesita'],
  requestAnimationFrame: ['temporizador', 'nada asíncrono en un shot'],
  setTimeout: ['temporizador', 'nada asíncrono en un shot'],
  setInterval: ['temporizador', 'nada asíncrono en un shot'],
  setImmediate: ['temporizador', 'nada asíncrono en un shot'],
  queueMicrotask: ['temporizador', 'nada asíncrono en un shot'],
  Promise: ['asíncrono (Promise)', 'nada asíncrono en un shot: seek(t) es síncrono'],
  fetch: ['red en el shot', 'pre-cargar como asset (engine/assets.mjs)'],
  XMLHttpRequest: ['red en el shot', 'pre-cargar como asset (engine/assets.mjs)'],
  WebSocket: ['red en el shot', 'pre-cargar como asset (engine/assets.mjs)'],
};
const GLOBAL_OBJ = new Set(['globalThis', 'global', 'window', 'self']);
// Propiedades vigiladas, por objeto base (alias resueltos). null = cualquier objeto.
const PROP_RULES = [
  ['Math', 'random', 'Math.random', 'usar rng(seed) o hash2(i, seed)'],
  ['Date', 'now', 'Date', 'el reloj es t (frame/fps)'],
  ['performance', 'now', 'performance.now', 'el reloj es t'],
  [null, 'fillText', 'texto sin api.text', 'api.text / api.label / api.tex (registran cajas para el lint)'],
  [null, 'strokeText', 'texto sin api.text', 'api.text / api.label / api.tex (registran cajas para el lint)'],
  [null, 'setTransform', 'transform absoluta', 'la cámara la aplica el motor; usa api.depth / scene nodes'],
  [null, 'resetTransform', 'transform absoluta', 'la cámara la aplica el motor; usa api.depth / scene nodes'],
  [null, 'constructor', 'acceso a .constructor (escape a Function)', 'no hace falta en un shot'],
  [null, '__proto__', 'acceso a __proto__', 'no hace falta en un shot'],
  [null, 'getBuiltinModule', 'getBuiltinModule', 'el shot no carga módulos del sistema'],
];
const WATCHED = new Set(['Math', 'Date', 'performance']);   // bases cuyo acceso computado opaco es sospechoso
const FUNCS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

// Declaraciones en un nodo-ámbito (función o bloque), sin entrar en funciones anidadas. var sube a la función.
function patNames(p, out) {
  if (!p) return out;
  if (p.type === 'Identifier') out.push(p.name);
  else if (p.type === 'ObjectPattern') p.properties.forEach((q) => patNames(q.type === 'RestElement' ? q.argument : q.value, out));
  else if (p.type === 'ArrayPattern') p.elements.forEach((q) => patNames(q, out));
  else if (p.type === 'RestElement') patNames(p.argument, out);
  else if (p.type === 'AssignmentPattern') patNames(p.left, out);
  return out;
}
const SCOPES = new WeakMap();
const declNames = (d, s) => d.declarations.forEach((x) => patNames(x.id, []).forEach((n) => s.add(n)));
function varsIn(n, s) {                                  // var sube hasta la función: recorre sin cruzar funciones
  if (!n || typeof n.type !== 'string') return;
  if (n.type === 'VariableDeclaration' && n.kind === 'var') declNames(n, s);
  if (FUNCS.has(n.type) || n.type === 'ClassDeclaration' || n.type === 'ClassExpression') return;
  for (const k in n) { if (k === 'loc') continue; const c = n[k]; if (Array.isArray(c)) c.forEach((x) => varsIn(x, s)); else if (c && typeof c.type === 'string') varsIn(c, s); }
}
function directIn(stmts, s) {                            // let/const/class/function directos de un bloque
  for (const x of stmts) {
    const d = x.type === 'ExportNamedDeclaration' || x.type === 'ExportDefaultDeclaration' ? x.declaration : x;
    if (!d) continue;
    if (d.type === 'VariableDeclaration') declNames(d, s);
    else if ((d.type === 'FunctionDeclaration' || d.type === 'ClassDeclaration') && d.id) s.add(d.id.name);
    else if (x.type === 'ImportDeclaration') x.specifiers.forEach((sp) => s.add(sp.local.name));
  }
}
function declaredIn(scope) {
  let s = SCOPES.get(scope); if (s) return s; s = new Set();
  if (FUNCS.has(scope.type)) {
    scope.params.forEach((p) => patNames(p, []).forEach((n) => s.add(n)));
    if (scope.id && scope.type === 'FunctionExpression') s.add(scope.id.name);
    if (scope.body.type === 'BlockStatement') { directIn(scope.body.body, s); varsIn(scope.body, s); }
  } else if (scope.type === 'Program') { directIn(scope.body, s); varsIn(scope, s); }
  else if (scope.type === 'BlockStatement') directIn(scope.body, s);
  else if (scope.type === 'SwitchStatement') directIn(scope.cases.flatMap((c) => c.consequent), s);
  else if (scope.type === 'CatchClause') patNames(scope.param, []).forEach((n) => s.add(n));
  else if (scope.type === 'ForStatement' && scope.init?.type === 'VariableDeclaration') declNames(scope.init, s);
  else if ((scope.type === 'ForInStatement' || scope.type === 'ForOfStatement') && scope.left.type === 'VariableDeclaration') declNames(scope.left, s);
  SCOPES.set(scope, s); return s;
}
const isScope = (n) => FUNCS.has(n.type) || n.type === 'BlockStatement' || n.type === 'Program' || n.type === 'CatchClause' || /^For/.test(n.type) || n.type === 'SwitchStatement';
// Ámbito que declara `name` visto desde la cadena de ancestros (null = global / no declarado).
function bindingScope(name, anc) { for (let i = anc.length - 1; i >= 0; i--) if (isScope(anc[i]) && declaredIn(anc[i]).has(name)) return anc[i]; return null; }

// ¿Es este Identifier una REFERENCIA (no clave de propiedad, no etiqueta, no nombre declarado)?
function isRef(n, parent) {
  if (!parent) return true;
  switch (parent.type) {
    case 'MemberExpression': return parent.object === n || parent.computed;
    case 'Property': return parent.value === n || (parent.computed && parent.key === n);
    case 'PropertyDefinition': case 'MethodDefinition': return parent.computed && parent.key === n || parent.value === n;
    case 'LabeledStatement': case 'BreakStatement': case 'ContinueStatement': return false;
    case 'ImportSpecifier': case 'ImportDefaultSpecifier': case 'ImportNamespaceSpecifier': case 'ExportSpecifier': return false;
    case 'MetaProperty': return false;
    case 'VariableDeclarator': return parent.init === n;
    case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression': return parent.body === n;
    case 'ClassDeclaration': case 'ClassExpression': return parent.superClass === n;
    case 'CatchClause': return false;
    default: return true;
  }
}

export function scanSource(src, id) {
  const out = [], where = (line) => `shots/${id}.mjs:${line}`;
  const add = (level, line, what, fix) => out.push({ level, shot: id, line, problem: `${what} en ${where(line)}`, remedy: fix });
  let ast;
  try { ast = parseMod(src); } catch (e) { add('FIX', e.loc?.line ?? 0, `el shot no parsea (${e.message})`, 'corregir la sintaxis'); return out; }

  // Constantes de texto y alias (const E = eval; const M = Math; const { random } = Math; const k = 'ev' + 'al').
  const consts = new Map(), alias = new Map(), aliasProp = new Map();
  const fold = (e, seen = 0) => {                     // → lista de strings posibles, o null si es opaco
    if (!e || seen > 20) return null;
    if (e.type === 'Literal') return typeof e.value === 'string' || typeof e.value === 'number' ? [String(e.value)] : null;
    if (e.type === 'TemplateLiteral') { let acc = ['']; for (let i = 0; i < e.quasis.length; i++) { acc = acc.map((a) => a + e.quasis[i].value.cooked); if (i < e.expressions.length) { const v = fold(e.expressions[i], seen + 1); if (!v) return null; acc = acc.flatMap((a) => v.map((x) => a + x)); } } return acc.slice(0, 64); }
    if (e.type === 'BinaryExpression' && e.operator === '+') { const a = fold(e.left, seen + 1), b = fold(e.right, seen + 1); return a && b ? a.flatMap((x) => b.map((y) => x + y)).slice(0, 64) : null; }
    if (e.type === 'ConditionalExpression') { const a = fold(e.consequent, seen + 1), b = fold(e.alternate, seen + 1); return a && b ? [...a, ...b] : null; }
    if (e.type === 'LogicalExpression') { const a = fold(e.left, seen + 1), b = fold(e.right, seen + 1); return a && b ? [...a, ...b] : null; }
    if (e.type === 'SequenceExpression') return fold(e.expressions.at(-1), seen + 1);
    if (e.type === 'Identifier' && consts.has(e.name)) return fold(consts.get(e.name), seen + 1);
    if (e.type === 'CallExpression' && e.callee.type === 'MemberExpression' && !e.callee.computed && ['join', 'concat', 'toString', 'trim', 'toLowerCase', 'toUpperCase'].includes(e.callee.property.name)) {
      if (e.callee.object.type === 'ArrayExpression' && e.callee.property.name === 'join') { const parts = e.callee.object.elements.map((x) => fold(x, seen + 1)); const sep = e.arguments.length ? fold(e.arguments[0], seen + 1) : [',']; if (parts.every(Boolean) && sep) return [parts.map((p) => p[0]).join(sep[0])]; return null; }
      const b = fold(e.callee.object, seen + 1); if (!b) return null;
      if (e.callee.property.name === 'concat') { const rest = e.arguments.map((x) => fold(x, seen + 1)); return rest.every(Boolean) ? [b[0] + rest.map((r) => r[0]).join('')] : null; }
      return b.map((x) => ({ trim: x.trim(), toLowerCase: x.toLowerCase(), toUpperCase: x.toUpperCase() }[e.callee.property.name] ?? x));
    }
    if (e.type === 'CallExpression' && e.callee.type === 'MemberExpression' && !e.callee.computed && e.callee.object.type === 'Identifier' && e.callee.object.name === 'String' && e.callee.property.name === 'fromCharCode') {
      const cs = e.arguments.map((x) => fold(x, seen + 1)); return cs.every(Boolean) ? [String.fromCharCode(...cs.map((c) => +c[0]))] : null;
    }
    return null;
  };
  const baseOf = (e) => {                             // nombre global que representa la expresión (resolviendo alias)
    if (!e) return null;
    if (e.type === 'Identifier') return alias.get(e.name) ?? e.name;
    if (e.type === 'ThisExpression') return 'this';
    if (e.type === 'MemberExpression') { const b = baseOf(e.object), p = e.computed ? fold(e.property) : [e.property.name]; if (b && GLOBAL_OBJ.has(b) && p?.length === 1) return p[0]; }
    return null;
  };
  // Primera pasada: constantes, alias, módulo mutable.
  const moduleLets = new Map();                       // nombre → línea (let/var de nivel de módulo, a cualquier indentación)
  fullAncestor(ast, (n, _s, anc) => {
    if (n.type === 'VariableDeclarator') {
      if (n.id.type === 'Identifier' && n.init) {
        const kind = anc[anc.length - 2]?.kind;
        if (kind === 'const' && fold(n.init)) consts.set(n.id.name, n.init);
        const b = baseOf(n.init);
        if (b && (WATCHED.has(b) || GLOBAL_OBJ.has(b) || b in BANNED_IDS)) alias.set(n.id.name, b);
        if (n.init.type === 'MemberExpression') { const ob = baseOf(n.init.object), p = n.init.computed ? fold(n.init.property) : [n.init.property.name]; if (ob && p) aliasProp.set(n.id.name, [ob, p]); }
      }
      if (n.id.type === 'ObjectPattern' && n.init) { const b = baseOf(n.init); if (b) for (const q of n.id.properties) if (q.type === 'Property' && q.value.type === 'Identifier') { const k = q.computed ? fold(q.key) : [q.key.name ?? String(q.key.value)]; if (k) aliasProp.set(q.value.name, [b, k]); } }
    }
    if (n.type === 'VariableDeclaration' && n.kind !== 'const' && !anc.slice(0, -1).some((a) => FUNCS.has(a.type))) n.declarations.forEach((d) => patNames(d.id, []).forEach((x) => moduleLets.set(x, { line: n.loc.start.line, node: n })));
  });
  // Destructuring de objetos vigilados: const { random } = Math  /  const { eval: e } = globalThis
  for (const [name, [b, keys]] of aliasProp) {
    for (const k of keys) {
      if (GLOBAL_OBJ.has(b) && k in BANNED_IDS) alias.set(name, k);
      if (GLOBAL_OBJ.has(b) && WATCHED.has(k)) alias.set(name, k);
    }
  }

  const seen = new Set(), once = (line, what, level, fix) => { const k = line + what; if (!seen.has(k)) { seen.add(k); add(level, line, what, fix); } };
  const checkProp = (baseName, keys, line) => {
    for (const k of keys) for (const [ob, prop, what, fix] of PROP_RULES) if (prop === k && (ob === null || ob === baseName)) once(line, what, 'FIX', fix);
    if (baseName && GLOBAL_OBJ.has(baseName)) for (const k of keys) if (k in BANNED_IDS) once(line, BANNED_IDS[k][0], 'FIX', BANNED_IDS[k][1]);
  };

  fullAncestor(ast, (n, _s, anc) => {
    const line = n.loc.start.line, parent = anc[anc.length - 2];
    switch (n.type) {
      case 'Identifier': {
        if (!isRef(n, parent)) break;
        const b = alias.get(n.name) ?? n.name, local = bindingScope(n.name, anc);
        if (!local && n.name in BANNED_IDS) once(line, BANNED_IDS[n.name][0], 'FIX', BANNED_IDS[n.name][1]);
        else if (local && alias.has(n.name) && b in BANNED_IDS) once(line, `${BANNED_IDS[b][0]} (alias ${n.name})`, 'FIX', BANNED_IDS[b][1]);
        if (local && aliasProp.has(n.name)) { const [ob, keys] = aliasProp.get(n.name); checkProp(ob, keys, line); }
        break;
      }
      case 'ThisExpression': if (!anc.slice(0, -1).some((a) => a.type === 'FunctionExpression' || a.type === 'FunctionDeclaration' || a.type === 'ClassBody')) once(line, 'this de nivel de módulo', 'FIX', 'nada de globales'); break;
      case 'MemberExpression': {
        const b = baseOf(n.object), keys = n.computed ? fold(n.property) : [n.property.name];
        if (keys) checkProp(b, keys, line);
        else if (b && (WATCHED.has(b) || GLOBAL_OBJ.has(b) || b === 'this')) once(line, `acceso computado opaco a ${b}[…]`, 'FIX', 'acceso con nombre literal (el guardia no puede verificar un nombre calculado)');
        break;
      }
      case 'NewExpression': case 'CallExpression': {
        if (baseOf(n.callee) === 'Date') once(line, 'Date', 'FIX', 'el reloj es t (frame/fps)');
        break;
      }
      case 'ImportExpression': once(line, 'import() dinámico', 'FIX', 'solo import estático de ../engine/*.mjs puros o ./otro-shot.mjs'); break;
      case 'ImportDeclaration': case 'ExportNamedDeclaration': case 'ExportAllDeclaration': {
        if (!n.source) break; const s = String(n.source.value);
        if (!REL.test(s)) once(line, `import prohibido '${s}'`, 'FIX', 'un shot no importa módulos del sistema ni paquetes: solo ../engine/*.mjs puros o ./otro-shot.mjs');
        break;
      }
      case 'AwaitExpression': case 'ForOfStatement': if (n.type === 'AwaitExpression' || n.await) once(line, 'asíncrono (await)', 'FIX', 'nada asíncrono en un shot: seek(t) es síncrono'); break;
      case 'FunctionExpression': case 'FunctionDeclaration': case 'ArrowFunctionExpression': if (n.async) once(line, 'asíncrono (async)', 'FIX', 'nada asíncrono en un shot: seek(t) es síncrono'); break;
      case 'WithStatement': once(line, 'with', 'FIX', 'no'); break;
      case 'AssignmentExpression': case 'UpdateExpression': {
        const tgt = n.type === 'UpdateExpression' ? n.argument : n.left;
        for (const name of tgt.type === 'Identifier' ? [tgt.name] : patNames(tgt, [])) {
          if (!moduleLets.has(name)) continue;
          const sc = bindingScope(name, anc); if (!sc) continue;
          const i = anc.indexOf(sc);
          if (anc.slice(0, i + 1).some((a) => FUNCS.has(a.type))) continue;          // local de una función (sombreado)
          if (!anc.slice(i + 1).some((a) => FUNCS.has(a.type))) continue;            // asignación a nivel de módulo: no persiste entre frames
          moduleLets.get(name).mutated ??= line;
        }
        break;
      }
    }
  });
  for (const [name, m] of moduleLets) {
    if (m.mutated) out.push({ level: 'FIX', shot: id, line: m.mutated, problem: `estado de módulo mutable reasignado desde una función ('${name}' declarado en ${where(m.line)}, reasignado en la línea ${m.mutated})`, remedy: 'seek(t) debe ser puro: const, o memo derivado de t' });
    else out.push({ level: 'WARN', shot: id, line: m.line, problem: `estado de módulo mutable (${where(m.line)})`, remedy: 'const, o memo derivado de t' });
  }
  // Imports relativos: deben resolver a otro shot o al núcleo puro del motor (lo resuelve scanShots, que conoce ROOT).
  out.imports = ast.body.filter((n) => n.source && REL.test(String(n.source.value))).map((n) => ({ spec: String(n.source.value), line: n.loc.start.line }));
  return out;
}

export function scanShots(root, ids) {
  const out = [];
  for (const id of ids) {
    const f = path.join(root, 'shots', id + '.mjs'); if (!fs.existsSync(f)) continue;
    const r = scanSource(fs.readFileSync(f, 'utf8'), id);
    for (const { spec, line } of r.imports ?? []) if (!shotImportAllowed(root, path.resolve(path.dirname(f), spec)))
      r.push({ level: 'FIX', shot: id, line, problem: `import prohibido '${spec}' en shots/${id}.mjs:${line}`, remedy: 'un shot solo importa ./otro-shot.mjs o módulos puros del motor (core, geom, prims…), no film/render/tex/cut' });
    out.push(...r);
  }
  return out;
}
