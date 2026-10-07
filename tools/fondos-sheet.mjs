#!/usr/bin/env node
// Hojas de muestras de fondos y objetos (spec 014): pinta cada preset de fondo (3 instantes, el último con la cámara desplazada
// para ver el parallax) y cada objeto con sus estados, SIN montar un film (usa los módulos puros con una paleta de medio).
//   node tools/fondos-sheet.mjs [--only fondos|objetos] [--w 480] [--outdir out/ab] [--preset cuba_oscura,…]
//   → <outdir>/fondos.jpg y <outdir>/objetos.jpg
import fs from 'node:fs';
import path from 'node:path';
import canvasPkg from 'canvas';
import { ROOT } from '../engine/film.mjs';
import { DEFAULTS } from '../engine/styles.mjs';
import { drawFondo, PRESETS } from '../engine/fondos.mjs';
const { createCanvas } = canvasPkg;
const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const only = arg('only', 'todo'), tw = +arg('w', 480), th = Math.round((tw * 9) / 16), outdir = path.resolve(ROOT, arg('outdir', 'out/ab')), FW = 1280, FH = 720, K = tw / FW;
const medio = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'styles/medios', n + '.json'), 'utf8'));
// paleta y soporte con los que se ve cada preset: el medio que declara, o la paleta oscura del estilo cosmos
const MEDIOS = { kraft: 'kraft', papel_crema: 'papel_crema', tecnico: 'tecnico', pizarra: 'pizarra' };
export function contexto(medioId) {
  const m = MEDIOS[medioId] ? medio(MEDIOS[medioId]) : null;
  return m ? { pal: m.palette, base: m.support?.base ?? m.palette.paper, multiply: (m.blend ?? 'multiply') === 'multiply' }
    : { pal: { ...DEFAULTS.palette, paper: '#06080f', ink: '#e8ecf5', shade: '#1a2233' }, base: '#000000', multiply: false };
}
const label = (x, s, px, py, size = 13, c = '#cfc8b4') => { x.fillStyle = c; x.font = `${size}px monospace`; x.fillText(s, px, py); };

async function hojaFondos() {
  const ids = (arg('preset', '') || Object.keys(PRESETS).join(',')).split(',').filter(Boolean), gap = 6, lab = 24, cols = 3, head = 30;
  const cv = createCanvas(cols * tw + gap * (cols + 1), head + ids.length * (th + lab + gap)), x = cv.getContext('2d');
  x.fillStyle = '#15130f'; x.fillRect(0, 0, cv.width, cv.height); label(x, 'FONDOS GENERATIVOS (spec 014) — cada fila un preset: t=1 s · t=6 s · t=6 s con cámara desplazada (parallax)', gap, 20, 14, '#ece4d0');
  const T = [{ t: 1, cam: 0 }, { t: 6, cam: 0 }, { t: 6, cam: 180 }];
  ids.forEach((id, r) => {
    const { pal, base } = contexto((PRESETS[id].medio.split(' ')[0]));
    T.forEach((s, c) => {
      const ox = gap + c * (tw + gap), oy = head + r * (th + lab + gap), tile = createCanvas(tw, th), g = tile.getContext('2d');
      g.fillStyle = base; g.fillRect(0, 0, tw, th); g.scale(K, K);
      const E = { W: FW, H: FH, k: 1, pal, canvas: (w, h) => createCanvas(w, h), cache: (hojaFondos.cache ??= new Map()), depth: (d, fn) => { g.save(); g.translate(-s.cam * d, 0); fn(); g.restore(); } };
      drawFondo(g, { preset: id, semilla: 7 }, s.t, E);
      x.drawImage(tile, ox, oy);
    });
    label(x, `${id}  [${PRESETS[id].medio}]`, gap, head + r * (th + lab + gap) + th + 16);
  });
  fs.mkdirSync(outdir, { recursive: true }); const f = path.join(outdir, 'fondos.jpg'); fs.writeFileSync(f, cv.toBuffer('image/jpeg', { quality: 0.9 })); console.log('→', path.relative(ROOT, f));
}
if (only === 'todo' || only === 'fondos') await hojaFondos();
if (only === 'todo' || only === 'objetos') { const m = await import('./objetos-sheet.mjs').catch(() => null); if (m) await m.hojaObjetos({ tw, outdir, contexto }); }
