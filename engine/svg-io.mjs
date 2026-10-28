#!/usr/bin/env node
// Lectura de SVG desde disco (Node): cargarSvg(id, root) → doc de svg.mjs, cacheado por (ruta, tamaño, mtime). El módulo puro (svg.mjs) no toca archivos.
//   node engine/svg-io.mjs manifest [--check]    regenera engine/svg-lib.mjs (nombre, nº de paths, título y tags de cada SVG de assets/svg/); --check falla si está desactualizado
//   node engine/svg-io.mjs list                  la biblioteca
import { isMain, rootFrom } from './paths.mjs';
import './help.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { parseSvg, SvgError, resolverRuta, sugerirSvg, DIR } from './svg.mjs';

export const ROOT = rootFrom(import.meta.url);
export const listaSvg = (root = ROOT) => { const d = path.join(root, DIR); return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.svg') && !f.startsWith('_')).map((f) => f.slice(0, -4)).sort() : []; };
const CACHE = new Map();
export function cargarSvg(id, root = ROOT) {
  const rel = resolverRuta(id), abs = path.join(root, rel);
  if (!fs.existsSync(abs)) throw new SvgError('inexistente', `no existe ${rel}. ${sugerirSvg(id)}`, { nombre: String(id) });
  const st = fs.statSync(abs), key = `${st.size}:${st.mtimeMs}`, hit = CACHE.get(abs);
  if (hit && hit.key === key) return hit.doc;
  const doc = parseSvg(fs.readFileSync(abs, 'utf8'), { nombre: path.basename(rel, '.svg') }); doc.archivo = rel;
  CACHE.set(abs, { key, doc }); return doc;
}
export function manifestText(root = ROOT) {
  const lib = Object.fromEntries(listaSvg(root).map((id) => { const d = cargarSvg(id, root); return [id, { paths: d.paths, titulo: d.titulo, tags: d.tags }]; }));
  return `// GENERADO por \`node engine/svg-io.mjs manifest\` (spec 020) desde assets/svg/*.svg: nombre, nº de paths, título y tags. No editar a mano.\n// Módulo PURO (lo importa dsl-core): permite validar «svg: "mosca"» y el morph sin leer disco. El contenido del SVG entra en el hash por assetsSig().\nexport const BIBLIOTECA = {\n${Object.entries(lib).map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n')}\n};\n`;
}
if (isMain(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2), f = path.join(ROOT, 'engine/svg-lib.mjs');
  try {
    if (cmd === 'manifest') { const txt = manifestText(), cur = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
      if (rest.includes('--check')) { console.log(cur === txt ? 'al día engine/svg-lib.mjs' : 'DESACTUALIZADO engine/svg-lib.mjs (node engine/svg-io.mjs manifest)'); process.exit(cur === txt ? 0 : 1); }
      fs.writeFileSync(f, txt); console.log(`${cur === txt ? 'al día' : 'generado'} engine/svg-lib.mjs (${listaSvg().length} SVG)`); }
    else if (cmd === 'list') for (const id of listaSvg()) { const d = cargarSvg(id); console.log(`${id.padEnd(10)} ${String(d.paths).padStart(2)} paths  ${d.titulo}`); }
    else console.log('uso: svg-io.mjs manifest [--check] | list');
  } catch (e) { console.error('✗ ' + e.message); process.exit(1); }
}
