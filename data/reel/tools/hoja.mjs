// Hoja de contacto a medida del reel (vertical): node data/reel/tools/hoja.mjs out/hoja.png 0.05 0.5 1.2 …  [--w 270] [--cols 6] [--grade]
import fs from 'node:fs';
import canvasPkg from 'canvas';
import { makeRenderer } from '../../../engine/render.mjs';
const A = process.argv.slice(2), arg = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; }, w = +arg('--w', 270), cols = +arg('--cols', 6);
const out = A[0], ts = A.slice(1).filter((x) => !x.startsWith('--') && !isNaN(+x) && !['--w', '--cols'].includes(A[A.indexOf(x) - 1])).map(Number);
const R = await makeRenderer({ size: `${w * 2}x${Math.round(w * 2 * 1920 / 1080 / 2) * 2}`, grade: !A.includes('--nograde') }), h = Math.round((w * 1920) / 1080), rows = Math.ceil(ts.length / cols);
const sh = canvasPkg.createCanvas(cols * w, rows * (h + 16)), x = sh.getContext('2d'); x.fillStyle = '#222'; x.fillRect(0, 0, sh.width, sh.height); x.font = '12px sans-serif';
ts.forEach((t, i) => { R.frame(t); const X = (i % cols) * w, Y = Math.floor(i / cols) * (h + 16); x.drawImage(R.cv, X, Y, w, h); x.fillStyle = '#9f9'; x.fillText(`${t.toFixed(2)}  ${R.film.shots.filter((s) => t >= s.t[0] && t < s.t[1]).map((s) => s.id).join('+')}`, X + 3, Y + h + 12); });
fs.writeFileSync(out, sh.toBuffer('image/png')); console.log('→', out, ts.length, 'fotogramas');
