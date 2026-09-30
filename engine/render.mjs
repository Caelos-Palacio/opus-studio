#!/usr/bin/env node
// Render headless (node-canvas). Reloj = frame / fps. Nunca Date.now ni rAF.
//   --still 3.2                     un PNG
//   --stills --every 0.5            hoja de contacto (out/sheets/contact.png)
//   --shot A3 --stills              un frame por beat del shot (out/sheets/A3.png)
//   --strip --around-cuts 8         8 frames alrededor de cada corte y on_beat (out/strips/)
//   --mp4 [--review] [--fps 60] [--size WxH] [--workers N] [--chunk 1500]
//   --animatic                      ignora shots/*.mjs y dibuja placeholders
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import canvasPkg from 'canvas';
import { loadFilm, seek, activeShots, shotBeats, ROOT } from './film.mjs';
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
    '-c:v', 'libx264', '-preset', 'medium', '-crf', arg('--crf', '16'), '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', out + '.part.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
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

async function mp4() {
  const film = await loadFilm();
  const review = has('--review');
  const fps = +arg('--fps', review ? 12 : film.fps);
  const size = arg('--size', review ? `${Math.round((540 * film.width) / film.height)}x540` : `${film.width}x${film.height}`);
  const N = Math.round(film.duration * fps) + 1, chunk = +arg('--chunk', 1500);
  const workers = +arg('--workers', Math.max(1, os.cpus().length));
  const dir = path.join(OUT, review ? 'chunks_review' : 'chunks'); mk(dir);
  const jobs = [];
  for (let a = 0; a < N; a += chunk) jobs.push({ a, b: Math.min(N, a + chunk), out: path.join(dir, `c_${String(a).padStart(7, '0')}_${fps}_${size}.mp4`) });
  const todo = jobs.filter((j) => !fs.existsSync(j.out)); // reanudable: bloques hechos se saltan
  console.log(`${N} frames @${fps}fps ${size} · ${jobs.length} bloques (${todo.length} pendientes) · ${workers} workers`);
  const run = (j) => new Promise((res, rej) => {
    const p = spawn(process.execPath, [new URL(import.meta.url).pathname, '--range', `${j.a}:${j.b}`, '--fps', String(fps), '--size', size, '--out', j.out], { stdio: 'inherit' });
    p.on('close', (c) => (c === 0 ? (console.log('  ✓', path.basename(j.out)), res()) : rej(new Error('bloque falló ' + j.out))));
  });
  if (has('--max-chunks')) todo.splice(+arg('--max-chunks'));
  const q = [...todo];
  await Promise.all(Array.from({ length: workers }, async () => { while (q.length) await run(q.shift()); }));
  if (jobs.some((j) => !fs.existsSync(j.out))) return console.log('Bloques pendientes: vuelve a lanzar el mismo comando para continuar.');
  const list = path.join(dir, 'list.txt');
  fs.writeFileSync(list, jobs.map((j) => `file '${j.out}'`).join('\n'));
  const raw = path.join(OUT, review ? 'review_raw.mp4' : 'master_raw.mp4');
  await sh(['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', raw]);
  const final = path.join(OUT, review ? 'review.mp4' : 'master.mp4');
  const audio = film.audio && fs.existsSync(path.join(ROOT, film.audio)) ? path.join(ROOT, film.audio) : null;
  if (audio) {
    // loudnorm en dos pasadas: la primera mide, la segunda corrige linealmente hacia −14 LUFS
    const m = spawnSync('ffmpeg', ['-hide_banner', '-i', audio, '-af', 'loudnorm=I=-14:LRA=7:TP=-1:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
    const js = JSON.parse(m.stderr.slice(m.stderr.lastIndexOf('{'), m.stderr.lastIndexOf('}') + 1));
    const af = `loudnorm=I=-14:LRA=7:TP=-1:measured_I=${js.input_i}:measured_LRA=${js.input_lra}:measured_TP=${js.input_tp}:measured_thresh=${js.input_thresh}:offset=${js.target_offset}:linear=true`;
    await sh(['-y', '-loglevel', 'error', '-i', raw, '-i', audio, '-shortest', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-af', af, '-movflags', '+faststart', final]);
  }
  else fs.copyFileSync(raw, final);
  console.log('→', path.relative(ROOT, final), audio ? '(audio loudnorm −14 LUFS)' : '(sin audio)');
}
const sh = (a) => new Promise((res, rej) => spawn('ffmpeg', a, { stdio: 'inherit' }).on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));

async function one() {
  const R = await makeRenderer({ size: arg('--size'), animatic: has('--animatic') });
  const t = +arg('--still'); mk(path.join(OUT, 'sheets'));
  R.frame(t);
  const out = path.join(OUT, 'sheets', `still_${t.toFixed(2)}.png`);
  fs.writeFileSync(out, R.cv.toBuffer('image/png')); console.log('→', path.relative(ROOT, out));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const main = has('--range') ? rangeWorker : has('--still') ? one : has('--stills') ? stills : has('--strip') ? strips : has('--mp4') ? mp4 : null;
  if (!main) console.log('Uso: ver cabecera de engine/render.mjs');
  else main().catch((e) => { console.error(e.message); process.exit(1); });
}
