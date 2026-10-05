#!/usr/bin/env node
// Peek (P5): MIRAR el film sin master. Hoja de contacto 4×3 a baja resolución, render directo de fotogramas (sin ffmpeg ni fragmentos).
//   npm run peek -- [film] [--t 3,9.5,20]     (film = nombre | ruta; sin él, el film activo: `npm run use -- <film>`)
//   → out/peek/<film>.jpg   (12 instantes repartidos por el film, o los de --t; etiqueta: tiempo y shot activo)
// Pensado para que cada agente VEA el resultado antes de entregarlo (docs/EFICIENCIA.md, A5). Objetivo: < 10 s.
import './help.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { findFilm, announceFilm } from './filmid.mjs';

const argv = process.argv.slice(2), pos = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--t' && argv[i - 1] !== '--cols');
if (pos[0]) {                                                  // film explícito → actúa como --timeline (fuente: flag)
  const tl = findFilm(pos[0]); if (!tl) { console.error(`no encuentro el film «${pos[0]}» (¿npm run use -- <film>?)`); process.exit(1); }
  process.argv.push('--timeline', tl);
}
announceFilm();
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const t0 = Date.now(), { default: canvasPkg } = await import('canvas'), { createCanvas } = canvasPkg;
const { makeRenderer } = await import('./render.mjs'), { ROOT, activeShots } = await import('./film.mjs'), { filmId } = await import('./filmid.mjs');
const COLS = +arg('--cols', 4), N = 12;
const probe = await makeRenderer({ size: '64x36' }), { duration, width: FW, height: FH } = probe.film;
const ts = (arg('--t', '') ? arg('--t').split(',').map(Number).filter((x) => Number.isFinite(x)) : Array.from({ length: N }, (_, i) => ((i + 0.5) / N) * duration)).map((t) => Math.max(0, Math.min(duration, t)));
if (!ts.length) { console.error('--t: lista de segundos separados por comas (3,9.5,20)'); process.exit(1); }
const k = Math.min(400 / FW, 300 / FH), tw = Math.round((FW * k) / 2) * 2, th = Math.round((FH * k) / 2) * 2, LH = 18;
const R = await makeRenderer({ size: `${tw}x${th}` }), rows = Math.ceil(ts.length / COLS);
const sheet = createCanvas(COLS * tw, rows * (th + LH)), x = sheet.getContext('2d');
x.fillStyle = '#111'; x.fillRect(0, 0, sheet.width, sheet.height); x.font = '12px monospace';
ts.forEach((t, i) => {
  R.frame(t); const X = (i % COLS) * tw, Y = Math.floor(i / COLS) * (th + LH);
  x.drawImage(R.cv, X, Y, tw, th); x.fillStyle = '#ddd'; x.fillText(`${t.toFixed(2)}s  ${activeShots(R.film, t).map((s) => s.id).join('+') || '-'}`, X + 4, Y + th + 13);
});
const out = path.join(ROOT, 'out/peek', `${filmId()}.jpg`); fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, sheet.toBuffer('image/jpeg', { quality: 0.82 }));
console.log(`→ ${path.relative(ROOT, out)}  (${ts.length} fotogramas ${tw}×${th}, ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
