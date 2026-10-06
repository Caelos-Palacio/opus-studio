#!/usr/bin/env node
// Hojas de contacto A/B por medio (spec 003): el MISMO film (demo y Mate) sin medio | con medio, y una hoja comparativa de los medios.
//   node tools/medios-sheets.mjs [--media kraft,pizarra,tecnico,neon] [--w 480] [--outdir out/ab] [--no-compare] [--demo-times 0.8,3,5] [--mate-times 6,30,55,85]
//   → <outdir>/<medio>.jpg y <outdir>/comparativa.jpg (papel_crema + los demás). El medio se aplica con OPUS_MEDIUM (el timeline no se toca).
import fs from 'node:fs';
import path from 'node:path';
import canvasPkg from 'canvas';
import { ROOT } from '../engine/film.mjs';
const { createCanvas } = canvasPkg;
const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; }, has = (k) => argv.includes('--' + k);
const ALL = ['papel_crema', 'kraft', 'pizarra', 'tecnico', 'neon'];
const media = arg('media', 'kraft,pizarra,tecnico,neon').split(','), tw = +arg('w', 480), th = Math.round((tw * 9) / 16 / 2) * 2, outdir = path.resolve(ROOT, arg('outdir', 'out/ab'));
const FILMS = [{ id: 'demo', tl: 'data/timeline.json', times: arg('demo-times', '0.8,3,5').split(',').map(Number) }, { id: 'mate', tl: 'data/mate/timeline.json', times: arg('mate-times', '6,30,55,85').split(',').map(Number) }];
const { makeRenderer } = await import('../engine/render.mjs');
const cache = new Map();                                                   // `${film}:${medio}` → [canvas por instante]
async function tiles(F, medium) {
  const key = `${F.id}:${medium ?? '-'}`; if (cache.has(key)) return cache.get(key);
  process.env.OPUS_TIMELINE = F.tl; if (medium) process.env.OPUS_MEDIUM = medium; else delete process.env.OPUS_MEDIUM;
  const R = await makeRenderer({ size: `${tw}x${th}` }), out = F.times.map((t) => { R.frame(Math.min(t, R.film.duration - 1e-3)); const c = createCanvas(R.cv.width, R.cv.height); c.getContext('2d').drawImage(R.cv, 0, 0); return c; });
  cache.set(key, out); return out;
}
const rows = (cols) => cols[0].flatMap((F, fi) => F.times.map((t, ti) => ({ F, t, fi, ti })));
async function sheet(file, cols, title) {                                  // cols = [{label, medium}]
  const lab = 22, gap = 6, head = 34, R = FILMS.flatMap((F) => F.times.map((t, i) => ({ F, t, i }))), cv = createCanvas(cols.length * tw + gap * (cols.length + 1), head + R.length * (th + lab)), x = cv.getContext('2d');
  x.fillStyle = '#15130f'; x.fillRect(0, 0, cv.width, cv.height); x.fillStyle = '#ece4d0'; x.font = 'bold 15px monospace'; x.fillText(title, gap, 22);
  for (let c = 0; c < cols.length; c++) { x.font = '13px monospace'; x.fillStyle = '#b8ae94'; x.fillText(cols[c].label, gap + c * (tw + gap), head - 6); }
  for (let c = 0; c < cols.length; c++) {
    const imgs = new Map(); for (const F of FILMS) imgs.set(F.id, await tiles(F, cols[c].medium));
    R.forEach((r, ri) => { const y = head + ri * (th + lab); x.drawImage(imgs.get(r.F.id)[r.i], gap + c * (tw + gap), y, tw, th); if (c === 0) { x.fillStyle = '#b8ae94'; x.font = '12px monospace'; x.fillText(`${r.F.id} ${r.t.toFixed(1)} s`, gap, y + th + 15); } });
  }
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, cv.toBuffer('image/jpeg', { quality: 0.88 })); console.log('→', path.relative(ROOT, file));
}
for (const m of media) await sheet(path.join(outdir, `${m}.jpg`), [{ label: 'sin medio (v1 / editorial)', medium: null }, { label: `medio ${m}`, medium: m }], `A/B — ${m}: demo (editorial, 6 s) y Mate (nocturno, 90 s)`);
if (!has('no-compare')) await sheet(path.join(outdir, 'comparativa.jpg'), ALL.map((m) => ({ label: m, medium: m })), 'Comparativa de los 5 medios — mismo film (demo arriba, Mate abajo)');
