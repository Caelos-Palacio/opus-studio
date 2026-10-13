// render.mjs: render en paralelo (N-1 procesos -> rawvideo -> ffmpeg), concat + audio, y hoja de contacto de 12 fotogramas.
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createCanvas, loadImage } from 'canvas';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const par = (n) => (n % 2 ? n + 1 : n);
async function trabajador({ modulo, w, h, fps, a, b, parte }) {
  const { frame } = await import(pathToFileURL(modulo).href), c = createCanvas(w, h), g = c.getContext('2d');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', `${w}x${h}`, '-r', String(fps), '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', parte], { stdio: ['pipe', 'inherit', 'inherit'] });
  const fin = once(ff, 'close');
  for (let i = a; i < b; i++) { g.clearRect(0, 0, w, h); frame(g, i / fps); if (!ff.stdin.write(c.toBuffer('raw'))) await once(ff.stdin, 'drain'); }
  ff.stdin.end(); const [code] = await fin; process.exit(code);
}

/** renderizar({modulo,W,H,fps,dur,escala,salida,audio,procesos}): reparte los fotogramas de modulo.frame(ctx,t) en N-1 procesos, concatena y mezcla el audio; devuelve la ruta del mp4. */
export async function renderizar({ modulo, W = 1920, H = 1080, fps = 30, dur, escala = 1, salida, audio = null, procesos = Math.max(1, os.cpus().length - 1) }) {
  const w = par(Math.round(W * escala)), h = par(Math.round(H * escala)), total = Math.round(dur * fps), n = Math.min(procesos, total), dir = path.join(path.dirname(salida), 'partes');
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const trozos = Array.from({ length: n }, (_, i) => ({ modulo, w, h, fps, a: Math.floor(total * i / n), b: Math.floor(total * (i + 1) / n), parte: path.join(dir, `p${i}.mp4`) }));
  const t0 = Date.now();
  await Promise.all(trozos.map((z) => new Promise((ok, no) => spawn(process.execPath, [fileURLToPath(import.meta.url), '--trabajador', JSON.stringify(z)], { stdio: 'inherit' }).on('close', (c) => c ? no(new Error('trabajador fallo ' + c)) : ok()))));
  fs.writeFileSync(path.join(dir, 'lista.txt'), trozos.map((z) => `file '${z.parte}'`).join('\n'));
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'lista.txt'), ...(audio ? ['-i', audio, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : ['-c:v', 'copy']), salida], { stdio: 'inherit' });
  if (r.status) throw new Error('ffmpeg concat fallo');
  fs.rmSync(dir, { recursive: true, force: true }); console.log(`render: ${total} fotogramas ${w}x${h} en ${((Date.now() - t0) / 1000).toFixed(1)} s con ${n} procesos -> ${salida}`); return salida;
}

/** hojaContacto(mp4,salida,{n,cols,ancho}): hoja jpg con n fotogramas equiespaciados del mp4, con su tiempo. */
export async function hojaContacto(mp4, salida, { n = 12, cols = 4, ancho = 480 } = {}) {
  const dur = parseFloat(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4], { encoding: 'utf8' }).stdout), tmp = path.join(path.dirname(salida), '_hoja.png'), imgs = [];
  for (let i = 0; i < n; i++) { const t = dur * (i + 0.5) / n; spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(t), '-i', mp4, '-frames:v', '1', '-vf', `scale=${ancho}:-2`, tmp]); imgs.push([t, await loadImage(fs.readFileSync(tmp))]); }
  const h = imgs[0][1].height, filas = Math.ceil(n / cols), c = createCanvas(cols * ancho, filas * h), g = c.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
  imgs.forEach(([t, im], i) => { const x = (i % cols) * ancho, y = Math.floor(i / cols) * h; g.drawImage(im, x, y); g.font = '16px sans-serif'; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x, y, 70, 22); g.fillStyle = '#fff'; g.fillText(t.toFixed(1) + ' s', x + 6, y + 16); });
  fs.writeFileSync(salida, c.toBuffer('image/jpeg', { quality: 0.88 })); fs.rmSync(tmp, { force: true }); return salida;
}

if (process.argv[2] === '--trabajador') trabajador(JSON.parse(process.argv[3]));
