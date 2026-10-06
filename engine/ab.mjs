#!/usr/bin/env node
// A/B lado a lado: mismos instantes de dos versiones de un film → hoja de contacto (jpg) y, con la forma corta, VÍDEO (mp4).
//   node engine/ab.mjs <film> <variante> [--range a:b] [--times t1,t2,…] [--w 960] [--fps 30] [--plan] [--no-video]
//       A = el film tal cual · B = el film con la variante (data/…json → variants.<variante>; OPUS_VARIANT)
//       → out/ab/<film>-<variante>.mp4 (A | B lado a lado, rótulos) · out/ab/<film>-<variante>-B.mp4 (solo B, a pantalla completa) · out/ab/<film>-<variante>.jpg (hoja)
//       npm run ab -- potencias w3d        (--plan imprime las salidas sin renderizar; --range por defecto = los shots que toca la variante ±2 s)
//   node engine/ab.mjs --a data/mate/timeline.json --b data/mate_papel/timeline.json --out out/ab/mate.jpg [--times 3,12,25] [--w 480]   (forma larga: dos films)
// El vídeo sale SIN audio (es una comparación visual); el master con sonido sigue siendo `npm run master`.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import canvasPkg from 'canvas';
import { ROOT } from './film.mjs';
import { x264Args } from './encode.mjs';
const { createCanvas } = canvasPkg;
const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; }, has = (k) => argv.includes('--' + k);
const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && !['plan', 'no-video'].includes(argv[i - 1].slice(2))));

// ── resolución de la forma corta ─────────────────────────────────────────────────────────────────────────────────────
const findFilm = (n) => [n, `data/${n}.json`, `data/stress/${n}.json`, `data/${n}/timeline.json`, `data/stress/${n}/timeline.json`].find((p) => fs.existsSync(path.join(ROOT, p)));
const short = pos.length >= 2 && !arg('a');
let A = arg('a'), B = arg('b'), name = null, variant = null;
if (short) {
  const f = findFilm(pos[0]); if (!f) { console.error(`ab: no encuentro el film «${pos[0]}» (data/stress/${pos[0]}.json, data/${pos[0]}/timeline.json)`); process.exit(2); }
  A = B = f; variant = pos[1]; name = `${path.basename(pos[0]).replace(/\.json$/, '')}-${variant}`;
}
if (!A || !B) { console.log('Uso: ver cabecera de engine/ab.mjs'); process.exit(1); }
const tw = +arg('w', short ? 960 : 480), th = Math.round((tw * 9) / 16 / 2) * 2, fps = +arg('fps', 30);
const outDir = path.join(ROOT, 'out/ab'), rel = (p) => path.relative(ROOT, p);
const outJpg = short ? path.join(outDir, `${name}.jpg`) : path.join(ROOT, arg('out', 'out/ab/ab.jpg'));
const outMp4 = short ? path.join(outDir, `${name}.mp4`) : null, outSolo = short ? path.join(outDir, `${name}-B.mp4`) : null;
const timelineOf = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

// rango por defecto: los shots que toca la variante (ops /shots/<ID>/…) ±2 s
function defaultRange() {
  const tl = timelineOf(B), v = tl.variants?.[variant], ids = new Set((v?.ops ?? []).map((o) => /^\/shots\/([^/]+)/.exec(o.path ?? '')?.[1]).filter(Boolean));
  const hit = (tl.shots ?? []).filter((s) => ids.has(s.id));
  if (!hit.length) return [0, Math.min(tl.duration ?? 12, 12)];
  return [Math.max(0, Math.min(...hit.map((s) => s.t[0])) - 2), Math.min(tl.duration ?? 1e9, Math.max(...hit.map((s) => s.t[1])) + 2)];
}
const range = arg('range') ? arg('range').split(':').map(Number) : short ? defaultRange() : null;
if (has('plan')) {
  console.log(`film: ${A}${short ? ` · variante ${variant}` : ''}`);
  if (short) console.log(`rango ${range[0]}–${range[1]} s a ${fps} fps (${Math.round((range[1] - range[0]) * fps)} fotogramas)`);
  if (short && !has('no-video')) console.log(`→ ${rel(outMp4)}\n→ ${rel(outSolo)}`);
  console.log(`→ ${rel(outJpg)}`); process.exit(0);
}

const { makeRenderer } = await import('./render.mjs');
const load = (tl, v) => { process.env.OPUS_TIMELINE = tl; if (v) process.env.OPUS_VARIANT = v; else delete process.env.OPUS_VARIANT; return makeRenderer({ size: `${tw}x${th}` }); };
const RA = await load(A, null), RB = await load(B, variant);
const labA = short ? `A: ${pos[0]} (original)` : `A: ${path.basename(path.dirname(A))} (v1)`, labB = short ? `B: ${pos[0]} · ${variant}` : `B: ${path.basename(path.dirname(B))} (${RB.film.medium?.name ?? 'sin medio'})`;
fs.mkdirSync(path.dirname(outJpg), { recursive: true });

// ── hoja de contacto ─────────────────────────────────────────────────────────────────────────────────────────────────
const times = arg('times') ? arg('times').split(',').map(Number) : short ? Array.from({ length: 8 }, (_, i) => +(range[0] + ((range[1] - range[0]) * (i + 0.5)) / 8).toFixed(1)) : [3, 12, 25, 40, 52, 66.5, 75, 88];
const lab = 24, gap = 6, sh = createCanvas(tw * 2 + gap * 3, 30 + times.length * (th + lab)), x = sh.getContext('2d');
x.fillStyle = '#16120d'; x.fillRect(0, 0, sh.width, sh.height); x.fillStyle = '#e8dfc8'; x.font = '15px monospace';
x.fillText(labA, gap, 20); x.fillText(labB, tw + gap * 2, 20);
times.forEach((t, i) => {
  const y = 30 + i * (th + lab);
  RA.frame(t); x.drawImage(RA.cv, gap, y); RB.frame(t); x.drawImage(RB.cv, tw + gap * 2, y);
  x.fillStyle = '#e8dfc8'; x.font = '13px monospace'; x.fillText(`${t.toFixed(1)} s`, gap, y + th + 16);
});
fs.writeFileSync(outJpg, sh.toBuffer('image/jpeg', { quality: 0.9 })); console.log('→', rel(outJpg));

// ── vídeo: A | B lado a lado (con rótulos) y B solo ─────────────────────────────────────────────────────────────────
async function video() {
  const n = Math.round((range[1] - range[0]) * fps), gapV = 8, WW = tw * 2 + gapV, HH = th + 28;
  const enc = (file, w, h) => { const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', `${w}x${h}`, '-r', String(fps), '-i', '-', ...x264Args({ crf: 17, preset: 'medium' }), '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] }); const done = new Promise((res, rej) => p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c))))); return { p, done }; };
  fs.mkdirSync(outDir, { recursive: true });
  const side = enc(outMp4, WW, HH), solo = enc(outSolo, tw, th), cv = createCanvas(WW, HH), c = cv.getContext('2d');
  const write = (p, buf) => new Promise((res) => (p.stdin.write(buf) ? res() : p.stdin.once('drain', res)));
  for (let i = 0; i < n; i++) {
    const t = range[0] + i / fps;
    RA.frame(t); RB.frame(t);
    c.fillStyle = '#16120d'; c.fillRect(0, 0, WW, HH); c.drawImage(RA.cv, 0, 28); c.drawImage(RB.cv, tw + gapV, 28);
    c.fillStyle = '#e8dfc8'; c.font = '16px monospace'; c.fillText(labA, 6, 19); c.fillText(`${labB}   ${t.toFixed(1)} s`, tw + gapV + 6, 19);
    await write(side.p, cv.toBuffer('raw')); await write(solo.p, RB.cv.toBuffer('raw'));
    if (i % 60 === 0) process.stdout.write(`\r  ${i}/${n}`);
  }
  side.p.stdin.end(); solo.p.stdin.end(); await Promise.all([side.done, solo.done]); console.log(`\r→ ${rel(outMp4)}\n→ ${rel(outSolo)}`);
}
if (short && !has('no-video')) await video();
