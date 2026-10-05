#!/usr/bin/env node
// Render headless (node-canvas). Reloj = frame / fps. Nunca Date.now ni rAF.
//   --still 3.2                     un PNG
//   --stills --every 0.5            hoja de contacto (out/sheets/contact.png)
//   --shot A3 --stills              un frame por beat del shot (out/sheets/A3.png)
//   --strip --around-cuts 8         8 frames alrededor de cada corte y on_beat (out/strips/)
//   --mp4 → RETIRADO (E5): montaba bloques sin hash de contenido (caché obsoleta tras editar un shot, sin gate de lint).
//           Se redirige a `node engine/cut.mjs` con los mismos argumentos (fragmentos con hash, gate, mezcla sellada).
//   --animatic                      ignora shots/*.mjs y dibuja placeholders
import './help.mjs';
import { isMain } from './paths.mjs';
import { announceFilm } from './filmid.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import canvasPkg from 'canvas';
import { loadFilm, seek, activeShots, shotBeats, ROOT } from './film.mjs';
import { x264Args } from './encode.mjs';
const { createCanvas, registerFont } = canvasPkg;

const argv = process.argv.slice(2);
const has = (k) => argv.includes(k);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const OUT = path.join(ROOT, 'out');
const mk = (p) => fs.mkdirSync(p, { recursive: true });

export async function makeRenderer({ size, animatic = false, grade = !animatic, style, profile } = {}) {
  const film = await loadFilm({ animatic, style, profile });
  for (const f of film.typeface.files ?? []) registerFont(path.join(ROOT, f.path), { family: film.typeface.family, weight: String(f.weight) });
  let [W, H] = size ? size.split('x').map(Number) : [film.width, film.height];
  W -= W % 2; H -= H % 2;
  const cv = createCanvas(W, H), ctx = cv.getContext('2d');
  const sx = W / film.width, sy = H / film.height;
  const frame = (t) => { ctx.setTransform(sx, 0, 0, sy, 0, 0); return seek(ctx, t, film, { grade }); };
  return { film, cv, ctx, W, H, frame };
}

function sheet(tiles, cols, tw, th, labelH = 22) {
  const rows = Math.ceil(tiles.length / cols);
  const c = createCanvas(cols * tw, rows * (th + labelH));
  const x = c.getContext('2d');
  x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
  tiles.forEach((tl, i) => {
    const X = (i % cols) * tw, Y = Math.floor(i / cols) * (th + labelH);
    x.drawImage(tl.img, X, Y, tw, th);
    x.fillStyle = '#ddd'; x.font = '13px monospace'; x.fillText(tl.label, X + 6, Y + th + 16);
  });
  return c;
}
function snap(R, t, tw) {
  R.frame(t);
  const th = Math.round((tw * R.H) / R.W);
  const c = createCanvas(tw, th);
  c.getContext('2d').drawImage(R.cv, 0, 0, tw, th);
  return c;
}
const labelFor = (film, t) => {
  const s = activeShots(film, t).map((x) => x.id).join('+') || '-';
  const bi = film.beatTimes.findIndex((b) => b > t + 1e-6);
  return `${t.toFixed(2)}s  ${s}  b${bi < 0 ? film.beatTimes.length : bi}`;
};

async function stills() {
  const R = await makeRenderer({ size: arg('--size'), animatic: has('--animatic') });
  const { film } = R; mk(path.join(OUT, 'sheets'));
  const id = arg('--shot');
  let ts;
  if (id) {
    const s = film.shots.find((x) => x.id === id);
    if (!s) throw new Error(`shot ${id} no existe`);
    ts = shotBeats(film, s); if (!ts.length) ts = [s.t[0], (s.t[0] + s.t[1]) / 2, s.t[1] - 1e-3];
  } else {
    const every = +arg('--every', 0.5); ts = [];
    for (let t = 0; t <= film.duration + 1e-9; t += every) ts.push(+t.toFixed(4));
  }
  const tw = 320, tiles = ts.map((t) => ({ img: snap(R, Math.min(t, film.duration), tw), label: labelFor(film, t) }));
  const name = id ? `${id}.png` : has('--animatic') ? 'animatic.png' : 'contact.png';
  const out = path.join(OUT, 'sheets', name);
  fs.writeFileSync(out, sheet(tiles, id ? Math.min(tiles.length, 4) : 6, tw, Math.round((tw * R.H) / R.W)).toBuffer('image/png'));
  console.log('→', path.relative(ROOT, out), `(${tiles.length} frames)`);
}

async function strips() {
  const R = await makeRenderer({ size: arg('--size') });
  const { film } = R; mk(path.join(OUT, 'strips'));
  const n = +arg('--around-cuts', 8), fps = film.fps;
  const cuts = [...new Set(film.shots.flatMap((s) => [s.t[0], s.t[1]]).filter((x) => x > 0 && x < film.duration))];
  const hits = film.shots.flatMap((s) => (s.on_beat_at ?? []).map((x) => s.t[0] + x));
  for (const c of [...cuts.map((t) => ['cut', t]), ...hits.map((t) => ['hit', t])]) {
    const ts = Array.from({ length: n }, (_, i) => c[1] + (i - n / 2) / fps).filter((t) => t >= 0 && t <= film.duration);
    const tw = 240, tiles = ts.map((t) => ({ img: snap(R, t, tw), label: `${c[0]} ${(t - c[1]) * fps >= 0 ? '+' : ''}${Math.round((t - c[1]) * fps)}f` }));
    const out = path.join(OUT, 'strips', `${c[0]}_${c[1].toFixed(2)}.png`);
    fs.writeFileSync(out, sheet(tiles, tiles.length, tw, Math.round((tw * R.H) / R.W)).toBuffer('image/png'));
    console.log('→', path.relative(ROOT, out));
  }
}

// Worker interno: renderiza [a,b) fotogramas a un mp4 sin audio.
async function rangeWorker() {
  const [a, b] = arg('--range').split(':').map(Number), fps = +arg('--fps'), out = arg('--out');
  const R = await makeRenderer({ size: arg('--size') });
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', `${R.W}x${R.H}`, '-r', String(fps), '-i', 'pipe:0',
    ...x264Args({ crf: arg('--crf', '16'), preset: arg('--preset', process.env.OPUS_PRESET ?? 'medium'), threads: +arg('--threads', 0) }), out + '.part.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
  let i = a;
  await new Promise((res) => {
    const pump = () => {
      while (i < b) {
        R.frame(Math.min(R.film.duration, i / fps));
        const ok = ff.stdin.write(R.cv.toBuffer('raw')); i++;
        if (!ok) return ff.stdin.once('drain', pump);
      }
      ff.stdin.end();
    };
    ff.on('close', (code) => { if (code === 0) fs.renameSync(out + '.part.mp4', out); res(code); });
    pump();
  });
}

// Legado: `render --mp4` ya no monta nada por su cuenta; delega en cut (única vía al master, con hash y gate).
function mp4() {
  const rest = argv.filter((x) => x !== '--mp4');
  console.log(`render --mp4 está retirado (sin hash de contenido): → node engine/cut.mjs ${rest.join(' ')}`.trimEnd());
  const r = spawnSync(process.execPath, [path.join(ROOT, 'engine/cut.mjs'), ...rest], { stdio: 'inherit', env: process.env });
  process.exitCode = r.status ?? 1;
  return Promise.resolve();
}

async function one() {
  const R = await makeRenderer({ size: arg('--size'), animatic: has('--animatic') });
  const t = +arg('--still'); mk(path.join(OUT, 'sheets'));
  R.frame(t);
  const out = path.join(OUT, 'sheets', `still_${t.toFixed(2)}.png`);
  fs.writeFileSync(out, R.cv.toBuffer('image/png')); console.log('→', path.relative(ROOT, out));
}

if (isMain(import.meta.url)) {
  announceFilm();
  const main = has('--range') ? rangeWorker : has('--still') ? one : has('--stills') ? stills : has('--strip') ? strips : has('--mp4') ? mp4 : null;
  if (!main) console.log('Uso: ver cabecera de engine/render.mjs');
  else main().catch((e) => { console.error(e.message); process.exit(1); });
}
