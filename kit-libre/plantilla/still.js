// still.js: node still.js [t ...] [--escala 1]. Sin t: un still a mitad de cada escena y en cada transicion. Guarda PNG en salida/stills.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createCanvas } from 'canvas';
import { frame, cajas } from './frame.js';
import { W, H, escenas, cruce } from './timeline.js';
import { textoTapado } from '../kit/auditoria.mjs';

const A = process.argv.slice(2), k = A.includes('--escala') ? parseFloat(A[A.indexOf('--escala') + 1]) : 1, dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'salida', 'stills');
const ts = A.filter((x) => !isNaN(x) && !A.includes('--escala') || (!isNaN(x) && A[A.indexOf('--escala') + 1] !== x)).map(Number);
const lista = ts.length ? ts : escenas.flatMap((e, i) => [e.t0 + e.dur / 2, ...(i < escenas.length - 1 ? [e.t0 + e.dur - cruce / 2] : [])]);
fs.mkdirSync(dir, { recursive: true });
for (const t of lista) {
  const c = createCanvas(Math.round(W * k), Math.round(H * k)); frame(c.getContext('2d'), t);
  const f = path.join(dir, `t${t.toFixed(2)}.png`); fs.writeFileSync(f, c.toBuffer('image/png')); const cj = cajas(t), tt = textoTapado(cj.texto, cj.objetos);
  console.log(f, tt.length ? 'TEXTO TAPADO: ' + tt.map((x) => `${x.texto.id}/${x.objeto.id}`) : 'ok');
}
