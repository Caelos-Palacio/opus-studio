// Hoja de objetos (spec 014): cada objeto de la biblioteca en sus 3 primeros estados, con las anclas marcadas (puntos rojos).
//   La invoca tools/fondos-sheet.mjs; también: node tools/objetos-sheet.mjs [--ids a,b] [--outdir out/ab]
import fs from 'node:fs';
import path from 'node:path';
import canvasPkg from 'canvas';
import { ROOT } from '../engine/film.mjs';
import { OBJETOS, drawObjeto } from '../engine/objetos.mjs';
import { pathToFileURL } from 'node:url';
const { createCanvas } = canvasPkg;
export async function hojaObjetos({ outdir, contexto, ids, cell = 210 }) {
  ids ??= Object.keys(OBJETOS); const { pal, base } = contexto('papel_crema'), per = 2, gap = 6, lab = 22, head = 28, rows = Math.ceil(ids.length / per), cw = 3 * cell + gap;
  const cv = createCanvas(per * cw + gap * (per + 1), head + rows * (cell + lab + gap)), x = cv.getContext('2d');
  x.fillStyle = '#15130f'; x.fillRect(0, 0, cv.width, cv.height); x.fillStyle = '#ece4d0'; x.font = '14px monospace'; x.fillText('OBJETOS (spec 014) — cada uno en sus estados; puntos rojos = anclas', gap, 19);
  ids.forEach((id, n) => {
    const def = OBJETOS[id], ox = gap + (n % per) * (cw + gap), oy = head + Math.floor(n / per) * (cell + lab + gap), est = Object.keys(def.estados).slice(0, 3); while (est.length < 3) est.push(est[est.length - 1]);
    est.forEach((e, i) => {
      const tile = createCanvas(cell, cell), g = tile.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, cell, cell);
      const r = drawObjeto(g, id, { x: cell / 2, y: cell / 2, size: cell * 0.78, estado: e, relleno: undefined }, { pal, k: cell / 400, t: 1.3 + i * 0.4, font: 'DejaVu Sans' });
      g.fillStyle = '#d02020'; for (const a of def.anclas) if (r[a]) { g.beginPath(); g.arc(r[a].x, r[a].y, 2.5, 0, 6.3); g.fill(); }
      x.drawImage(tile, ox + i * cell, oy);
    });
    x.fillStyle = '#cfc8b4'; x.font = '12px monospace'; x.fillText(`${id}  [${est.join(' · ')}]`, ox, oy + cell + 15);
  });
  fs.mkdirSync(outdir, { recursive: true }); const f = path.join(outdir, 'objetos.jpg'); fs.writeFileSync(f, cv.toBuffer('image/jpeg', { quality: 0.9 })); console.log('→', path.relative(ROOT, f));
}
