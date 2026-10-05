// Depuración: cajas registradas (texto y foco) en un instante. node data/reel/tools/cajas.mjs 10.38
import { makeRenderer } from '../../../engine/render.mjs';
const R = await makeRenderer({ grade: false }), t = +process.argv[2], b = R.frame(t), S = R.film.P.safe;
console.log('safe x', 1080 * S.side, 1080 * (1 - S.side), 'y', 1920 * S.top, 1920 * (1 - S.bottom));
for (const x of b) console.log(x.kind, x.label, 'x', x.x.toFixed(0), 'y', x.y.toFixed(0), 'w', x.w.toFixed(0), 'h', x.h.toFixed(0), 'x1', (x.x + x.w).toFixed(0), 'y1', (x.y + x.h).toFixed(0));
