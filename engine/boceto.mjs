#!/usr/bin/env node
// Boceto (spec 019, E4): decidir un concepto en SEGUNDOS, antes de la producción gobernada. NO es un master y no lo sustituye.
//   node engine/opus.mjs boceto [film] [--shot X] [--desde t --hasta t] [--escala 0.25] [--sin-audio] [--sin-hoja] [--workers N]
//   → out/boceto/<film>[.<shot>].mp4 (¼ de resolución lineal, mín. 320 px de ancho, 12 fps, h264 ultrafast) + out/boceto/<film>[.<shot>].jpg (hoja de contacto 4×3)
//     + out/boceto/<film>[.<shot>].json (medidas: ms por etapa, fragmentos en caché, degradaciones aplicadas).
//   Degradación DECLARADA (engine/boceto-degrada.mjs): sin grano, sin post (bloom/cromática/color), sin textura viva de tinta, fx rápidos,
//   y lo que la escena marque con "boceto": "omitir" | "sin_fx" (objetos DSL y capas del medio). Sin lint, sin crítico, sin gates: solo el esquema del timeline
//   y de los .scene.json (se recompilan a shots/*.mjs antes de renderizar). Audio: SOLO la mezcla ya cacheada (data/mix-<film>.wav); nunca la sintetiza.
//   Fragmentos con hash de contenido en out/boceto/fragments/<film>/ (el hash incluye film.P.boceto: jamás se mezclan con los del master). Repetir = instantáneo.
//   Para ver mientras editas: `node engine/opus.mjs preview [film]`.
import './help.mjs';
import { isMain } from './paths.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { findFilm, announceFilm, filmId } from './filmid.mjs';

export const FPS = 12, ESCALA = 0.25, ANCHO_MIN = 320;
export const par = (n) => n - (n % 2);
// ¼ de resolución lineal, con un mínimo de ancho legible (sin superar el original); siempre par (yuv420p).
export function bocetoSize(w, h, escala = ESCALA) {
  const W = par(Math.min(w, Math.max(Math.round(w * escala), ANCHO_MIN))), H = par(Math.round((W * h) / w));
  return [W, H];
}
const sh = (a) => new Promise((res, rej) => { const p = spawn('ffmpeg', a, { stdio: ['ignore', 'ignore', 'inherit'] }); p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))); });

// Fija el film y el entorno del boceto ANTES de importar film.mjs (lee argv/env al cargar).
export function prepararEntorno(filmName) {
  if (filmName) {
    const tl = findFilm(filmName); if (!tl) throw new Error(`no encuentro el film «${filmName}» (¿npm run use -- <film>?)`);
    const i = process.argv.indexOf('--timeline'); if (i >= 0) process.argv.splice(i, 2);
    process.argv.push('--timeline', tl);
  }
  process.env.OPUS_BOCETO = '1'; process.env.OPUS_FXFAST = '1';
}
// Recompila los .scene.json de los shots del film → shots/*.mjs (esquema estricto del DSL; error = FIX de esquema). Devuelve los regenerados.
export async function compilarEscenas(film, root) {
  const { build } = await import('./dsl.mjs'), out = [];
  for (const s of film.shots) {
    const rel = `shots/${s.id}.scene.json`; if (!fs.existsSync(path.join(root, rel))) continue;
    const r = build(rel, { root }); if (r.changed) out.push(r.file);
  }
  return out;
}

export async function boceto(args = process.argv.slice(2)) {
  const t00 = performance.now(), has = (k) => args.includes(k), val = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
  const flagsConValor = new Set(['--shot', '--desde', '--hasta', '--escala', '--workers', '--timeline']);
  const pos = args.filter((a, i) => !a.startsWith('--') && !flagsConValor.has(args[i - 1]));
  prepararEntorno(pos[0]);
  announceFilm();
  const { ROOT, loadFilm, timelinePath, activeShots } = await import('./film.mjs');
  const { plan } = await import('./cut.mjs'), { sha } = await import('./hash.mjs');
  const { DEGRADACION } = await import('./boceto-degrada.mjs');
  const shotId = val('--shot', null), escala = +val('--escala', ESCALA);
  if (!(escala > 0 && escala <= 1)) throw new Error('--escala: entre 0 y 1 (por defecto 0.25)');

  const film = await loadFilm();                                         // esquema del timeline (assertTimeline): único guardia
  const regen = await compilarEscenas(film, ROOT);
  if (regen.length) { const f2 = await loadFilm(); Object.assign(film, f2); }   // shots/*.mjs regenerados: recarga los módulos
  const name = filmId(timelinePath()) + (shotId ? '.' + shotId : '');
  const [W, H] = bocetoSize(film.width, film.height, escala), size = `${W}x${H}`;
  const outDir = path.join(ROOT, 'out/boceto'), fdir = path.join(outDir, 'fragments', filmId(timelinePath()));
  fs.mkdirSync(fdir, { recursive: true });

  const chunk = 60, P = plan(film, { fps: FPS, size, chunk, preset: 'ultrafast', mode: 'boceto', shot: shotId });
  const a0 = P.a0 ?? 0, aEnd = a0 + P.N;
  const A = Math.max(a0, has('--desde') ? Math.round(+val('--desde') * FPS) : a0), B = Math.min(aEnd, has('--hasta') ? Math.round(+val('--hasta') * FPS) : aEnd);
  if (!(B > A)) throw new Error(`rango vacío: --desde/--hasta fuera de [${(a0 / FPS).toFixed(2)}, ${(aEnd / FPS).toFixed(2)}] s`);
  const jobs = P.jobs.filter((j) => j.b > A && j.a < B).map((j) => { const a = Math.max(j.a, A), b = Math.min(j.b, B); return { ...j, a, b, hash: a === j.a && b === j.b ? j.hash : sha(j.hash, 'v', a, b) }; });
  const file = (j) => path.join(fdir, `${j.id}_${j.hash}_${FPS}_${size}.mp4`);
  const todo = jobs.filter((j) => !fs.existsSync(file(j)));
  console.log(`boceto «${name}» · ${B - A} fotogramas @${FPS} fps ${size} (¼ lineal) · ${jobs.length} fragmentos · ${jobs.length - todo.length} en caché · ${todo.length} por renderizar${regen.length ? ` · escenas recompiladas: ${regen.join(' ')}` : ''}`);

  const t1 = performance.now();
  const workers = Math.max(1, Math.min(+val('--workers', os.cpus().length), todo.length || 1)), q = [...todo].sort((x, y) => (y.b - y.a) - (x.b - x.a)), render = path.join(ROOT, 'engine/render.mjs');
  const run = (j) => new Promise((res, rej) => {
    const stage = path.join(fdir, `.${j.id}_${j.hash}.stage-${process.pid}-${Math.random().toString(36).slice(2, 8)}.tmp.mp4`);
    const p = spawn(process.execPath, [render, '--range', `${j.a}:${j.b}`, '--fps', String(FPS), '--size', size, '--out', stage, '--crf', '30', '--preset', 'ultrafast', '--threads', '1'], { stdio: ['ignore', 'ignore', 'inherit'], env: process.env });
    p.on('close', (c) => { if (c !== 0) { fs.rmSync(stage, { force: true }); fs.rmSync(stage + '.part.mp4', { force: true }); return rej(new Error('fragmento falló ' + j.id)); } fs.renameSync(stage, file(j)); res(); });
  });
  const hoja = has('--sin-hoja') ? Promise.resolve(null) : hojaDeContacto({ film, W, H, A, B, name, outDir, ROOT, activeShots });
  await Promise.all([hoja, ...Array.from({ length: workers }, async () => { while (q.length) await run(q.shift()); })]);
  const tRender = performance.now() - t1;

  // montaje: concat sin recodificar + audio cacheado (si lo hay)
  const keep = new Set(jobs.map((j) => path.basename(file(j))));
  for (const f of fs.readdirSync(fdir)) if (f.endsWith(`_${FPS}_${size}.mp4`) && !keep.has(f)) fs.rmSync(path.join(fdir, f), { force: true });
  const list = path.join(fdir, `list.${process.pid}.txt`), raw = path.join(outDir, `.${name}.${process.pid}.raw.mp4`), final = path.join(outDir, `${name}.mp4`), tmp = path.join(outDir, `.${name}.${process.pid}.tmp.mp4`);
  fs.writeFileSync(list, jobs.map((j) => `file '${file(j)}'`).join('\n'));
  let audio = 'ninguno';
  try {
    await sh(['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', raw]);
    const { mixName, mixHash } = await import('./sound.mjs'), mix = path.join(ROOT, `data/mix${mixName()}.wav`);
    if (!has('--sin-audio') && fs.existsSync(mix)) {
      let rancio = false; try { const prev = JSON.parse(fs.readFileSync(path.join(ROOT, `out/sfx${mixName()}.json`), 'utf8')).inputs; rancio = prev !== mixHash(JSON.parse(fs.readFileSync(path.join(ROOT, timelinePath()), 'utf8'))); } catch { rancio = true; }
      audio = `caché data/mix${mixName()}.wav${rancio ? ' (puede estar desactualizada: npm run sound)' : ''}`;
      await sh(['-y', '-loglevel', 'error', '-i', raw, '-ss', String(A / FPS), '-i', mix, '-t', String((B - A) / FPS), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '64k', '-ar', '44100', '-movflags', '+faststart', tmp]);
    } else await sh(['-y', '-loglevel', 'error', '-i', raw, '-c', 'copy', '-movflags', '+faststart', tmp]);
    fs.renameSync(tmp, final);
  } finally { for (const f of [list, raw, tmp]) fs.rmSync(f, { force: true }); }

  const total = performance.now() - t00, bytes = fs.statSync(final).size, hojaFile = (await hoja) ? `out/boceto/${name}.jpg` : null;
  const stats = { film: filmId(timelinePath()), shot: shotId, frames: B - A, fps: FPS, size, desde: A / FPS, hasta: B / FPS, fragmentos: jobs.length, enCache: jobs.length - todo.length, renderMs: Math.round(tRender), totalMs: Math.round(total), bytes, audio, mp4: `out/boceto/${name}.mp4`, hoja: hojaFile, degradacion: DEGRADACION.map((d) => d.que) };
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(stats, null, 1));
  console.log(`→ ${stats.mp4} (${(bytes / 1024).toFixed(0)} KB, audio: ${audio})${hojaFile ? ` + ${hojaFile}` : ''}`);
  console.log(`  tiempos: render ${(tRender / 1000).toFixed(1)} s · total ${(total / 1000).toFixed(1)} s · ${((B - A) / (total / 1000)).toFixed(0)} fotogramas/s efectivos`);
  return stats;
}

// Hoja de contacto 4×3 del rango (caché de fotogramas compartida con peek/preview: mismo tamaño → aciertos).
async function hojaDeContacto({ film, W, H, A, B, name, outDir, ROOT, activeShots }) {
  const { default: canvasPkg } = await import('canvas'), { createCanvas, ImageData } = canvasPkg;
  const { makeRenderer } = await import('./render.mjs'), { frameCache } = await import('./framecache.mjs');
  const FC = frameCache({ film, size: `${W}x${H}`, grade: true, make: () => makeRenderer({ size: `${W}x${H}` }) });
  const N = Math.min(12, B - A), COLS = 4, LH = 18, rows = Math.ceil(N / COLS);
  const sheet = createCanvas(COLS * W, rows * (H + LH)), x = sheet.getContext('2d');
  x.fillStyle = '#111'; x.fillRect(0, 0, sheet.width, sheet.height); x.font = '12px monospace';
  for (let i = 0; i < N; i++) {
    const t = Math.min(film.duration, (A + ((i + 0.5) / N) * (B - A)) / FPS), f = await FC.get(t, { px: true }), X = (i % COLS) * W, Y = Math.floor(i / COLS) * (H + LH);
    x.putImageData(new ImageData(f.data, W, H), X, Y); x.fillStyle = '#ddd'; x.fillText(`${t.toFixed(2)}s  ${activeShots(film, t).map((s) => s.id).join('+') || '-'}`, X + 4, Y + H + 13);
  }
  fs.writeFileSync(path.join(outDir, `${name}.jpg`), sheet.toBuffer('image/jpeg', { quality: 0.82 }));
  return true;
}

if (isMain(import.meta.url)) boceto().catch((e) => { console.error('✗ ' + e.message); process.exit(1); });
