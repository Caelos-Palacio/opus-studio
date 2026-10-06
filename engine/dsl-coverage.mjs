// Inventario de cobertura del DSL de escenas (spec 010): clasifica cada shot de shots/ y calcula el %. PURO y determinista
// (solo lee ficheros; mismo árbol → mismo texto). `node engine/dsl.mjs coverage [--json]`; el resumen va a STATUS.md.
//   Clases:  dsl (hay .scene.json: nativo | respaldado por lib | custom → NO cuenta) · pendiente:<rama> · escape (JS con razón) ·
//            convertible (todos los rasgos del JS tienen tipo DSL) · falta:<rasgos> (hay rasgos sin tipo todavía).
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { TYPES } from './dsl-core.mjs';

const SPEC = JSON.parse(fs.readFileSync(new URL('../data/dsl-coverage.json', import.meta.url), 'utf8'));
// rasgo del JS → tipo DSL que lo cubre (si falta en TYPES, el rasgo cuenta como "falta:<tipo>")
const API_TYPE = { text: 'text', focus: 'focus', glow: 'glow', morph: 'morph', ground: 'ground', depth: 'group', tex: 'equation', gradient: 'gradient', world3d: 'world3d', layer: 'layer', impact: 'impact', color: null, spring: null, ease: null, at: null, safe: null, sizes: null, params: null, k: null, S: null, _box: null, tilt: 'camera', cam: 'camera' };
const CTX_TYPE = { fillRect: 'rect', rect: 'rect', strokeRect: 'rect', arc: 'path', ellipse: 'path', moveTo: 'path', lineTo: 'path', bezierCurveTo: 'path', quadraticCurveTo: 'path', stroke: 'path', beginPath: 'path', closePath: 'path', fill: 'path', clip: 'mask', save: 'transform', restore: 'transform', translate: 'transform', rotate: 'transform', scale: 'transform', setTransform: 'transform', createLinearGradient: 'gradient', createRadialGradient: 'gradient', fillText: 'text', strokeText: 'text', drawImage: 'image', setLineDash: 'path' };

export function analyzeSource(src) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' }), F = new Set(), imported = new Map();
  for (const n of ast.body) if (n.type === 'ImportDeclaration' && n.source.value.startsWith('./')) for (const s of n.specifiers) imported.set(s.local.name, `${n.source.value}#${s.imported?.name ?? 'default'}`);
  const used = new Set();
  walk.full(ast, (n) => {
    if (n.type === 'CallExpression') {
      const c = n.callee;
      if (c.type === 'MemberExpression' && c.object?.type === 'Identifier' && !c.computed) {
        if (c.object.name === 'ctx' || c.object.name === 'lctx') F.add(`ctx:${c.property.name}`);
        else if (c.object.name === 'api') F.add(`api:${c.property.name}`);
        else if (c.object.name === 'Math' && c.property.name === 'random') F.add('rng');
        else if (c.property.name === 'forEach' || c.property.name === 'map' || c.property.name === 'reduce') F.add('loop');
      } else if (c.type === 'MemberExpression' && !c.computed && ['forEach', 'map', 'reduce'].includes(c.property.name)) F.add('loop');
      else if (c.type === 'Identifier') used.add(c.name);
    }
    if (n.type === 'ForStatement' || n.type === 'ForOfStatement' || n.type === 'WhileStatement' || n.type === 'ForInStatement') F.add('loop');
    if (n.type === 'MemberExpression' && n.object.type === 'Identifier' && n.object.name === 'api' && !n.computed) F.add(`apiref:${n.property.name}`);
  });
  for (const [loc, from] of imported) if (used.has(loc)) F.add(`lib:${from.split('#')[1]}`);
  return [...F].sort();
}
// tipos que exige un rasgo (null = nada: son expresiones/lectura)
export function requiredType(feature, types = TYPES) {
  const [k, v] = [feature.slice(0, feature.indexOf(':')), feature.slice(feature.indexOf(':') + 1)];
  let t = null;
  if (feature === 'loop') t = 'repeat'; else if (feature === 'rng') t = 'particles';
  else if (k === 'api') t = API_TYPE[v] === undefined ? `api.${v}` : API_TYPE[v];
  else if (k === 'ctx') t = CTX_TYPE[v] ?? `ctx.${v}`;
  else if (k === 'lib') t = SPEC.libfn[v] ?? `lib.${v}`;
  return t && !(t in types) ? t : null;
}
export function coverage(root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')) {
  const dir = path.join(root, 'shots'), files = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort(), rows = [];
  for (const f of files) {
    const id = f.slice(0, -4), src = fs.readFileSync(path.join(dir, f), 'utf8');
    if (!/export default/.test(src)) continue;
    const sceneFile = path.join(dir, id + '.scene.json');
    if (fs.existsSync(sceneFile)) {
      const sc = JSON.parse(fs.readFileSync(sceneFile, 'utf8')), objs = [], rec = (l) => { for (const o of l ?? []) { objs.push(o); if (o.children) rec(o.children); } }; rec(sc.objects);
      const custom = objs.filter((o) => o.type === 'custom').length, backed = objs.filter((o) => o.lib && o.type !== 'custom').length;
      rows.push({ id, cls: custom ? 'custom' : 'dsl', via: custom ? `${custom} custom` : backed ? `respaldado(${backed})` : 'nativo', counts: !custom, native: !custom && !backed });
    } else if (SPEC.pendiente[id]) rows.push({ id, cls: `pendiente:${SPEC.pendiente[id]}`, counts: false });
    else if (SPEC.escape[id]) rows.push({ id, cls: 'escape', via: SPEC.escape[id], counts: false });
    else {
      const feats = analyzeSource(src), miss = [...new Set(feats.map((x) => requiredType(x)).filter(Boolean))].sort();
      rows.push({ id, cls: miss.length ? `falta:${miss.join(',')}` : 'convertible', counts: false, feats });
    }
  }
  const total = rows.length, dsl = rows.filter((r) => r.counts).length, native = rows.filter((r) => r.native).length, pend = rows.filter((r) => r.cls.startsWith('pendiente')).length;
  const freq = {}; for (const r of rows) if (r.cls.startsWith('falta:')) for (const m of r.cls.slice(6).split(',')) freq[m] = (freq[m] ?? 0) + 1;
  return { total, dsl, native, pendientes: pend, pct: total ? (100 * dsl) / total : 0, pctSinPendientes: total - pend ? (100 * dsl) / (total - pend) : 0, pctNativo: total ? (100 * native) / total : 0,
    freq: Object.entries(freq).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])), rows };
}
export function formatCoverage(C) {
  const L = C.rows.map((r) => `${r.id.padEnd(12)} ${r.cls}${r.via ? ` [${r.via}]` : ''}`);
  L.push('', `shots: ${C.total} · en DSL: ${C.dsl} (${C.pct.toFixed(1)} %) · sin los pendientes de otra rama (${C.pendientes}): ${C.pctSinPendientes.toFixed(1)} % · nativos puros: ${C.native} (${C.pctNativo.toFixed(1)} %)`);
  if (C.freq.length) L.push('falta (por nº de shots que lo necesitan): ' + C.freq.map(([k, n]) => `${k}×${n}`).join(' '));
  return L.join('\n');
}
export const coverageStatusLines = (root) => { const C = coverage(root); return [`- cobertura DSL (spec 010): **${C.pct.toFixed(1)} %** (${C.dsl}/${C.total} shots; ${C.pctSinPendientes.toFixed(1)} % sin los ${C.pendientes} pendientes de otra rama) · nativos puros ${C.native} · umbral ratchet en data/dsl-coverage.json`]; };
