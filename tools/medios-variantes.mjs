#!/usr/bin/env node
// Hoja A/B del acento morado de mate_papel: por defecto | A ciruela (violeta profundo) | B terracota. Mismo film, mismos instantes.
//   node tools/medios-variantes.mjs [--w 480] [--out out/ab/mate_papel_acento.jpg] [--times 6,30,55,70,85]
import fs from 'node:fs';
import path from 'node:path';
import canvasPkg from 'canvas';
import { ROOT } from '../engine/film.mjs';
const { createCanvas } = canvasPkg;
const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const tw = +arg('w', 480), th = Math.round((tw * 9) / 16 / 2) * 2, times = arg('times', '6,30,55,70,85').split(',').map(Number), out = path.resolve(ROOT, arg('out', 'out/ab/mate_papel_acento.jpg'));
const V = [['por defecto (violeta #6A2CB8)', 'papel_crema'], ['A ciruela (#4A2F7A, más profundo y menos saturado)', 'papel_crema_ciruela'], ['B terracota (#B4532A en lugar del violeta)', 'papel_crema_terracota']];
const { makeRenderer } = await import('../engine/render.mjs'), gap = 6, lab = 20, head = 34;
const cv = createCanvas(V.length * tw + gap * (V.length + 1), head + times.length * (th + lab)), x = cv.getContext('2d');
x.fillStyle = '#15130f'; x.fillRect(0, 0, cv.width, cv.height); x.fillStyle = '#ece4d0'; x.font = 'bold 15px monospace'; x.fillText('mate_papel — acento morado: elige', gap, 20);
for (let c = 0; c < V.length; c++) {
  process.env.OPUS_TIMELINE = 'data/mate_papel/timeline.json'; process.env.OPUS_MEDIUM = V[c][1];
  const R = await makeRenderer({ size: `${tw}x${th}` }); x.fillStyle = '#b8ae94'; x.font = '12px monospace'; x.fillText(V[c][0], gap + c * (tw + gap), head - 6);
  times.forEach((t, i) => { R.frame(t); x.drawImage(R.cv, gap + c * (tw + gap), head + i * (th + lab)); if (!c) { x.fillStyle = '#b8ae94'; x.fillText(`${t.toFixed(1)} s`, gap, head + i * (th + lab) + th + 14); } });
}
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, cv.toBuffer('image/jpeg', { quality: 0.9 })); console.log('→', path.relative(ROOT, out));
