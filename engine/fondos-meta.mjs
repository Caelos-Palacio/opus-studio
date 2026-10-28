#!/usr/bin/env node
// Metadatos UNIFORMES de fondos y objetos (spec 014) para el índice/buscador de herramientas (rama toolbox).
//   import { metaFondosObjetos } from './fondos-meta.mjs'  →  [{ id, kind, resumen (≤ 15 palabras), tags[], params:[{name,type,def}], … }]
//   kind: 'capa-fondo' (23 tipos de capa) · 'preset-fondo' (fondos temáticos; extra: porque, medio, capas[]) · 'objeto' (extra: anclas[], estados[])
//   CLI: node engine/fondos-meta.mjs [--json] [--kind capa-fondo|preset-fondo|objeto]
import { isMain } from './paths.mjs';
import { CAPAS, metaCapa } from './fondo-capas.mjs';
import './fondo-libre.mjs';
import { PRESETS } from './fondo-presets.mjs';
import { META_OBJETOS } from './objetos.mjs';

const PARAMS_PRESET = [{ name: 'semilla', type: 'int', def: 1 }, { name: 'ajustes', type: 'json {idCapa:{param}}', def: null }, { name: 'sin', type: 'lista de idCapa', def: [] }, { name: 'capas', type: 'lista de capas extra', def: [] }];
export const META_PRESETS = Object.entries(PRESETS).map(([id, p]) => ({ id, kind: 'preset-fondo', resumen: p.resumen, tags: p.tags, params: PARAMS_PRESET, porque: p.porque, medio: p.medio, capas: p.capas.map((c) => c.id) }));
export const metaFondosObjetos = () => [...Object.values(CAPAS).map(metaCapa), ...META_PRESETS, ...META_OBJETOS];
if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2), kind = argv.includes('--kind') ? argv[argv.indexOf('--kind') + 1] : null, L = metaFondosObjetos().filter((m) => !kind || m.kind === kind);
  if (argv.includes('--json')) console.log(JSON.stringify(L, null, 1));
  else for (const m of L) console.log(`${m.kind.padEnd(12)} ${m.id.padEnd(22)} ${m.resumen}  [${m.tags.join(', ')}]`);
}
