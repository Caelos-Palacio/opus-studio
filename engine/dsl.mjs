#!/usr/bin/env node
// CLI del DSL de escenas (spec 006). El núcleo puro está en dsl-core.mjs (lo importan los shots generados).
//   node engine/dsl.mjs validate <escena>            esquema estricto (exit 1 si hay FIX)
//   node engine/dsl.mjs build <shots/X.scene.json> [--check]   genera shots/X.mjs (--check: falla si está desactualizado)
//   node engine/dsl.mjs build --all [--check]        todos los shots/*.scene.json
//   node engine/dsl.mjs diff <a> <b> [--json]        diff SEMÁNTICO (objetos/params/cues añadidos, quitados, cambiados)
//   node engine/dsl.mjs deps <escena> [--json] [param]   dependencias exactas por objeto (o: qué objetos leen ese param)
// <escena> = archivo .scene.json, o un shots/X.mjs generado/DSL (se importa y se lee su .dsl).
import { isMain } from './paths.mjs';
import './help.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateScene, assertScene, depsOf, objectsReading, diffScenes, formatDiff, generateShotSource } from './dsl-core.mjs';
export * from './dsl-core.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export async function loadScene(file) {
  const f = path.resolve(file);
  if (f.endsWith('.json')) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const m = (await import(pathToFileURL(f).href)).default;
  if (!m?.dsl) throw new Error(`${file}: no es un shot DSL (sin .dsl)`);
  return m.dsl;
}
export const sceneFiles = (root = ROOT) => fs.readdirSync(path.join(root, 'shots')).filter((f) => f.endsWith('.scene.json')).sort().map((f) => path.join('shots', f));
// build: .scene.json → shots/<id>.mjs. Devuelve {file, changed}; con check no escribe.
export function build(rel, { root = ROOT, check = false } = {}) {
  const src = path.join(root, rel), sc = JSON.parse(fs.readFileSync(src, 'utf8')), out = rel.replace(/\.scene\.json$/, '.mjs'), code = generateShotSource(sc, rel), cur = fs.existsSync(path.join(root, out)) ? fs.readFileSync(path.join(root, out), 'utf8') : null;
  const changed = cur !== code; if (changed && !check) fs.writeFileSync(path.join(root, out), code);
  return { file: out, changed };
}
if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2), [cmd, a, b] = argv, json = argv.includes('--json'), check = argv.includes('--check');
  try {
    if (cmd === 'validate') { const f = validateScene(await loadScene(a)); for (const x of f) console.log(`FIX ${x.path}: ${x.message}${x.remedy ? ' → ' + x.remedy : ''}`); console.log(f.length ? `${f.length} FIX` : 'escena válida'); process.exit(f.length ? 1 : 0); }
    else if (cmd === 'build') { const files = a === '--all' ? sceneFiles() : [a]; let bad = 0; for (const f of files) { const r = build(f, { check }); console.log(`${r.changed ? (check ? 'DESACTUALIZADO' : 'generado') : 'al día'} ${r.file}`); if (r.changed && check) bad++; } process.exit(bad ? 1 : 0); }
    else if (cmd === 'diff') { const R = diffScenes(await loadScene(a), await loadScene(b)); console.log(json ? JSON.stringify(R, null, 1) : formatDiff(R)); process.exit(0); }
    else if (cmd === 'deps') { const sc = assertScene(await loadScene(a)), param = argv.slice(2).find((x) => !x.startsWith('--'));
      if (param) { const r = objectsReading(sc, param); console.log(json ? JSON.stringify(r) : `exactos: ${r.exact.join(' ') || '—'}\nposibles (opacos): ${r.possible.join(' ') || '—'}`); }
      else { const D = depsOf(sc); if (json) console.log(JSON.stringify(D, null, 1)); else for (const d of D) console.log(`${(d.id ?? d.type).padEnd(12)} ${d.type.padEnd(9)} params[${d.inputs.join(',')}]${d.opaqueInputs ? '+opaco' : ''} entidades[${d.entities.join(',')}] objetos[${d.objects.join(',')}] libs[${d.libs.join(',')}] ${d.timeDependent ? 'f(t)' : 'estático'}`); } }
    else console.log('Uso: dsl.mjs validate <f> | build <f.scene.json>|--all [--check] | diff <a> <b> [--json] | deps <f> [param] [--json]');
  } catch (e) { console.error('✗ ' + e.message); process.exit(1); }
}
