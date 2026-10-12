#!/usr/bin/env node
// Film activo explícito (P1). Todas las herramientas leen out/.film; así ninguna cae en silencio al demo.
//   node engine/opus.mjs use <film>      fija el film activo: nombre (mate, reel, regla, potencias…), "demo" o ruta de un timeline
//   node engine/opus.mjs use             muestra el film activo y de dónde sale
//   node engine/opus.mjs use --clear     olvida out/.film (vuelve al demo)
//   node engine/opus.mjs new shot <id> --receta <r> [--objeto o] [--fondo f] [--mov a,b] [--param k=v] [--llenar objeto.prop=texto] [--film f] [--force]
//                                        escribe shots/<id>.scene.json desde una receta (scaffold propio, con $hueco; spec 016)
//   node engine/opus.mjs recetas [list|show <r>|medir|audit]   catálogo de recetas
//   node engine/opus.mjs boceto [film] [--shot X] [--desde t --hasta t]   boceto en segundos: mp4 a ¼ de resolución + hoja de contacto, sin gates (spec 019; engine/boceto.mjs)
//   node engine/opus.mjs preview [film] [--port N]                        preview en vivo en 127.0.0.1 con scrubber y recarga al guardar (spec 019; engine/livepreview.mjs)
//   (npm run use -- <film>)
// Prioridad al resolver: --timeline X (flag) > OPUS_TIMELINE (env) > out/.film (esto) > demo. Cada herramienta imprime en su
// 1.ª línea «film: <clave> (<ruta>, fuente: flag|env|use|demo)».
import './help.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { USE_FILE, findFilm, resolveFilm, filmId } from './filmid.mjs';

const SUB = { boceto: 'boceto.mjs', preview: 'livepreview.mjs' };               // spec 019: delegan en su script (su --help, su isMain)
if (SUB[process.argv[2]]) process.exit(spawnSync(process.execPath, [fileURLToPath(new URL(SUB[process.argv[2]], import.meta.url)), ...process.argv.slice(3)], { stdio: 'inherit' }).status ?? 1);

if (['new', 'recetas'].includes(process.argv[2])) { const { cli } = await import('./recetas.mjs'); process.exit(await cli(process.argv[2] === 'new' ? process.argv.slice(3) : process.argv.slice(3).length ? process.argv.slice(3) : ['list'])); }
const [cmd, name] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (cmd !== 'use') { console.error('uso: node engine/opus.mjs use <film> | use | use --clear   (--help)'); process.exit(cmd ? 1 : 0); }
if (process.argv.includes('--clear')) { fs.rmSync(USE_FILE, { force: true }); console.log('film activo olvidado → demo'); process.exit(0); }
if (!name) { const f = resolveFilm(); console.log(`film: ${f.key} (${f.timeline}, fuente: ${f.source})`); process.exit(0); }
const tl = findFilm(name);
if (!tl) { console.error(`no encuentro el film «${name}»: busqué data/${name}/timeline.json, data/${name}.json, data/${name}/${name}.json, data/*/${name}.json`); process.exit(1); }
fs.mkdirSync(path.dirname(USE_FILE), { recursive: true }); fs.writeFileSync(USE_FILE, tl + '\n');
console.log(`film activo: ${filmId(tl)} (${tl})  → out/.film`);
