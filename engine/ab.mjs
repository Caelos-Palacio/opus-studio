#!/usr/bin/env node
// Hoja de contacto A/B lado a lado: mismos instantes de dos films (p. ej. v1 y la versión con medio).
//   node engine/ab.mjs --a data/mate/timeline.json --b data/mate_papel/timeline.json --out out/ab/mate.jpg [--times 3,12,25,40,52,66.5,75,88] [--w 480]
import fs from 'node:fs';
import path from 'node:path';
import canvasPkg from 'canvas';
import { ROOT } from './film.mjs';
const { createCanvas } = canvasPkg;
const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const A = arg('a'), B = arg('b'), out = path.join(ROOT, arg('out', 'out/ab/ab.jpg')), tw = +arg('w', 480);
if (!A || !B) { console.log('Uso: ver cabecera de engine/ab.mjs'); process.exit(1); }
const times = arg('times', '3,12,25,40,52,66.5,75,88').split(',').map(Number);
const { makeRenderer } = await import('./render.mjs');
const load = (tl) => { process.env.OPUS_TIMELINE = tl; return makeRenderer({ size: `${tw}x${Math.round((tw * 9) / 16 / 2) * 2}` }); };
const RA = await load(A), RB = await load(B), th = RA.H, lab = 24, gap = 6;
const cv = createCanvas(tw * 2 + gap * 3, 30 + times.length * (th + lab)), x = cv.getContext('2d');
x.fillStyle = '#16120d'; x.fillRect(0, 0, cv.width, cv.height); x.fillStyle = '#e8dfc8'; x.font = '15px monospace';
x.fillText(`A: ${path.basename(path.dirname(A))} (v1)`, gap, 20); x.fillText(`B: ${path.basename(path.dirname(B))} (${RB.film.medium?.name ?? 'sin medio'})`, tw + gap * 2, 20);
times.forEach((t, i) => {
  const y = 30 + i * (th + lab);
  RA.frame(t); x.drawImage(RA.cv, gap, y); RB.frame(t); x.drawImage(RB.cv, tw + gap * 2, y);
  x.fillStyle = '#e8dfc8'; x.font = '13px monospace'; x.fillText(`${t.toFixed(1)} s`, gap, y + th + 16);
});
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, cv.toBuffer('image/jpeg', { quality: 0.9 })); console.log('→', path.relative(ROOT, out));
