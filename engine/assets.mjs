#!/usr/bin/env node
// Assets: todo lo externo se convierte ANTES en algo que seek puede leer de forma síncrona y determinista.
//   node engine/assets.mjs --footage clip.mp4 --id toma1 [--fps 24] [--width 1280]  → assets/cache/footage/toma1/{000001.jpg…, meta.json}
//   node engine/assets.mjs --tex                                                    → precompila todo TeX citado en shots/ y timeline (caché + manifiesto)
//   node engine/assets.mjs --list
// Re-extraer un id existente MUEVE la extracción anterior a .trash/<fecha>-footage-<id>/ (nunca rmSync): recuperable.
// Problemas que evita: decodificar vídeo dentro del render (lento, no determinista entre versiones de códec), metraje
// VFR (se fuerza fps constante), rutas relativas rotas (todo vive bajo assets/), TeX que falla a mitad de un master.
import './help.mjs';
import { announceFilm } from './filmid.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './film.mjs';
import { texReady, makeTexStore } from './tex.mjs';
import { withLockSync } from './lock.mjs';
import { record } from './ledger.mjs';

const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
if (argv.includes('--footage')) {
  const src = path.resolve(arg('--footage')), id = arg('--id') ?? path.basename(src).replace(/\.\w+$/, ''), fps = +arg('--fps', 24), w = +arg('--width', 1280);
  const dir = path.join(ROOT, 'assets/cache/footage', id);
  withLockSync(`footage/${id}`, () => {                                      // E10: lo extraído antes va a .trash/, nunca se destruye
    if (fs.existsSync(dir)) { const t = path.join(ROOT, '.trash', `${new Date().toISOString().replace(/[:.]/g, '-')}-footage-${id}`); fs.mkdirSync(path.dirname(t), { recursive: true }); fs.renameSync(dir, t);
      record({ action: 'trash', target: path.relative(ROOT, dir), verdict: 'moved', why: `→ ${path.relative(ROOT, t)}` }); console.log(`  (anterior → ${path.relative(ROOT, t)})`); }
    fs.mkdirSync(dir, { recursive: true });
    const r = spawnSync('ffmpeg', ['-v', 'error', '-i', src, '-vf', `fps=${fps},scale=${w}:-2:flags=lanczos`, '-q:v', '3', path.join(dir, '%06d.jpg')], { stdio: 'inherit' });
    if (r.status) process.exit(1);
    const frames = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).length, pr = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src], { encoding: 'utf8' }).stdout.trim().split(',').map(Number);
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ id, src: path.relative(ROOT, src), fps, frames, duration: frames / fps, srcSize: pr, width: w }, null, 1));
    console.log(`→ assets/cache/footage/${id}: ${frames} fotogramas @${fps} (${(frames / fps).toFixed(2)} s)`);
  }, { ttlMs: 600000, waitMs: 600000 });
} else if (argv.includes('--tex')) {
  await texReady(); const store = makeTexStore(ROOT), found = new Set();
  const grab = (src) => {   // literales en api.tex(…)/morphTo y todo String.raw`…` (convención: TeX va en String.raw)
    for (const m of src.matchAll(/(?:\b\w+\.tex\(|morphTo:\s*)('((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)")/g)) found.add((m[2] ?? m[3]).replace(/\\\\/g, '\\'));
    for (const m of src.matchAll(/String\.raw`([^`]+)`/g)) found.add(m[1]); };
  for (const f of fs.readdirSync(path.join(ROOT, 'shots'))) if (f.endsWith('.mjs')) grab(fs.readFileSync(path.join(ROOT, 'shots', f), 'utf8'));
  for (const f of fs.readdirSync(path.join(ROOT, 'data'))) if (f.endsWith('.json')) { const j = fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'); for (const m of j.matchAll(/"tex"\s*:\s*"((?:\\.|[^"\\])*)"/g)) found.add(JSON.parse(`"${m[1]}"`)); }
  let bad = 0; for (const t of found) { try { store.get(t); console.log('  ✓', t); } catch (e) { bad++; console.log('  ✗', t, '→', e.message); } }
  console.log(`→ ${found.size} expresiones · ${bad} con error`); process.exit(bad ? 1 : 0);
} else if (argv.includes('--list')) {
  const d = path.join(ROOT, 'assets/cache/footage'); for (const id of fs.existsSync(d) ? fs.readdirSync(d) : []) { const m = JSON.parse(fs.readFileSync(path.join(d, id, 'meta.json'), 'utf8')); console.log(`footage ${id.padEnd(12)} ${m.frames} f @${m.fps}  ${m.src}`); }
  const tx = path.join(ROOT, 'assets/cache/tex/index.json'); if (fs.existsSync(tx)) console.log(`tex: ${Object.keys(JSON.parse(fs.readFileSync(tx, 'utf8'))).length} expresiones en caché`);
} else console.log('Uso: ver cabecera de engine/assets.mjs');
