#!/usr/bin/env node
// Regenera docs/media/demo.gif con el propio motor: seek(t) → fotogramas → ffmpeg (paleta optimizada, bucle infinito).
//   npm run demo:gif            (film: data/demo-gif/timeline.json · shots G01/G02 · estilo styles/suite.json)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.OPUS_TIMELINE = process.env.OPUS_TIMELINE || 'data/demo-gif/timeline.json';
const { makeRenderer } = await import('../engine/render.mjs');
const R = await makeRenderer({});
const { film } = R, n = Math.round(film.duration * film.fps);        // un ciclo exacto: el último fotograma enlaza con el primero
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opus-gif-'));
for (let i = 0; i < n; i++) { R.frame(i / film.fps); fs.writeFileSync(path.join(dir, `f${String(i).padStart(4, '0')}.png`), R.cv.toBuffer('image/png')); }
const out = path.join(ROOT, 'docs/media/demo.gif');
fs.mkdirSync(path.dirname(out), { recursive: true });
const vf = `split[a][b];[a]palettegen=max_colors=64:stats_mode=full[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(film.fps), '-i', path.join(dir, 'f%04d.png'), '-vf', vf, '-loop', '0', out], { stdio: 'inherit' });
fs.rmSync(dir, { recursive: true, force: true });
if (r.status) process.exit(r.status);
console.log(`→ ${path.relative(ROOT, out)}  ${n} fotogramas @ ${film.fps} fps, ${film.width}x${film.height}, ${(fs.statSync(out).size / 1e6).toFixed(2)} MB`);
