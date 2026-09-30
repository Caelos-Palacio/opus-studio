#!/usr/bin/env node
// Sala de montaje. El film se trocea en FRAGMENTOS (segmentos entre cortes limpios) con hash de contenido:
// solo se re-renderiza lo que cambió. El master es un concat sin recodificar + audio.
//   node engine/cut.mjs [--review] [--fps N] [--size WxH] [--workers N] [--chunk 900] [--edit data/edit.json] [--plan]
//   --plan : muestra qué fragmentos están en caché y cuáles se renderizarían (no renderiza)
// Hash de un fragmento = motor (archivos que afectan píxeles) + estilo + perfil + tamaño/fps + entradas de timeline de sus shots
//   (+ la del shot previo si hay cam.chain) + código de sus shots y dependencias importadas + assets + duración/grade.
// Problemas que evita: re-render total por un cambio de 1 shot; concat roto por parámetros distintos (todos iguales, cada
// fragmento empieza en IDR); espacio de color sin etiquetar (bt709 explícito); fragmentos huérfanos (manifest por film).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { ROOT, loadFilm, timelinePath } from './film.mjs';
import { mix, mixName } from './sound.mjs';

const argv = process.argv.slice(2), has = (k) => argv.includes(k), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const sha = (...xs) => crypto.createHash('sha1').update(xs.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('\u0000')).digest('hex').slice(0, 12);
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const PIXEL_ENGINE = ['core', 'api', 'prims', 'geom', 'fx', 'scene', 'seek', 'camera', 'grade', 'styles', 'color', 'shapes', 'tex', 'film', 'render'];
export const filmName = (tlPath = timelinePath()) => (path.basename(tlPath, '.json') === 'timeline' ? 'main' : path.basename(tlPath, '.json'));

function shotDeps(id, seen = new Set()) {
  if (seen.has(id)) return ''; seen.add(id);
  const f = path.join(ROOT, 'shots', id + '.mjs'); if (!fs.existsSync(f)) return '';
  const src = fs.readFileSync(f, 'utf8'); let out = src;
  for (const [, dep] of src.matchAll(/from\s+['"]\.\/([\w-]+)\.mjs['"]/g)) out += shotDeps(dep, seen);
  return out;
}
function assetsSig() {
  const d = path.join(ROOT, 'assets'); if (!fs.existsSync(d)) return '';
  const acc = []; const walk = (p) => { for (const e of fs.readdirSync(p, { withFileTypes: true })) { const q = path.join(p, e.name); if (e.isDirectory()) { if (!q.includes(path.join('cache', 'tex'))) walk(q); } else if (/meta\.json$|\.(png|jpe?g|webp|svg|json)$/.test(e.name) && !/\d{6}\.jpg$/.test(e.name)) { const s = fs.statSync(q); acc.push(q + s.size + s.mtimeMs); } } };
  walk(d); return sha(acc.sort());
}
// Segmentos: grupos de shots que se solapan (morphs) no se parten; cortes limpios sí.
// Hash del contenido de UN shot (su entrada + código + deps), independiente del motor: lo usa autocam para invalidarse.
export const shotHash = (film, id) => { const s = film.shots.find((x) => x.id === id), { cam, ...rest } = s; return sha(rest, cam?.move === 'auto' ? { ...cam } : cam, shotDeps(id), film.width, film.height, JSON.stringify(film.S.camera), JSON.stringify(film.P.safe)); };
export function plan(film, { fps, size, chunk = 900 }) {
  const engine = sha(...PIXEL_ENGINE.map((m) => rd(`engine/${m}.mjs`)), rd('engine/profiles.json'), JSON.stringify(film.S), JSON.stringify(JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/canvas/package.json'), 'utf8')).version));
  const glob = sha(engine, assetsSig(), film.width, film.height, film.duration, film.fps, film.motif, film.handoffs, film.profileName, film.P, fps, size, film.edit?.items ?? null);
  const N = Math.round(film.duration * fps) + 1, jobs = [];
  const entry = (s) => { const { t, ...rest } = s; return { ...rest, t }; };
  const push = (a, b, ids, extra) => {
    const shots = ids.map((id) => film.shots.find((s) => s.id === id)), prevChain = shots.flatMap((s) => { const i = film.shots.indexOf(s); return s.cam?.chain && i > 0 ? [entry(film.shots[i - 1])] : []; });
    const h = sha(glob, shots.map(entry), prevChain, ids.map((id) => shotDeps(id)), extra ?? '');
    for (let x = a; x < b; x += chunk) { const y = Math.min(b, x + chunk), id = `${ids.join('+')}${b - a > chunk ? '.' + Math.floor((x - a) / chunk) : ''}`; jobs.push({ id, shots: ids, a: x, b: y, hash: sha(h, x, y) }); }
  };
  if (film.edit) {                                                          // montaje: un fragmento por ítem de la EDL
    let f0 = 0; film.edit.items.forEach((it, i) => { const f1 = i === film.edit.items.length - 1 ? N : Math.round((it.a + it.len + it.hold) * fps);
      const ids = film.shots.filter((s) => s.t[0] < it.t1 && s.t[1] > it.t0).map((s) => s.id); push(f0, f1, ids, { item: i, it }); f0 = f1; });
    return { jobs, N, glob };
  }
  const groups = []; for (const s of film.shots) { const g = groups[groups.length - 1]; if (g && s.t[0] < g.t1 - 1e-6) { g.ids.push(s.id); g.t1 = Math.max(g.t1, s.t[1]); } else groups.push({ ids: [s.id], t0: s.t[0], t1: s.t[1] }); }
  groups.forEach((g, i) => push(Math.round(g.t0 * fps), i === groups.length - 1 ? N : Math.round(g.t1 * fps), g.ids));
  return { jobs, N, glob };
}

const ffEnc = (fps, crf) => ['-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-r', String(fps)];
export { ffEnc };
const sh = (a) => new Promise((res, rej) => spawn('ffmpeg', a, { stdio: ['ignore', 'inherit', 'inherit'] }).on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));

async function main() {
  const film = await loadFilm(), review = has('--review'), name = filmName() + (film.edit ? '.edit' : '');
  const fps = +arg('--fps', review ? 12 : film.fps), size = arg('--size', review ? `${Math.round((540 * film.width) / film.height / 2) * 2}x540` : `${film.width}x${film.height}`);
  const dir = path.join(ROOT, 'out/fragments', name); fs.mkdirSync(dir, { recursive: true });
  const P = plan(film, { fps, size, chunk: +arg('--chunk', 900) }), file = (j) => path.join(dir, `${j.id}_${j.hash}_${fps}_${size}.mp4`);
  const todo = P.jobs.filter((j) => !fs.existsSync(file(j)));
  console.log(`${film.edit ? 'montaje' : 'film'} "${name}" · ${P.N} frames @${fps} ${size} · ${P.jobs.length} fragmentos · ${P.jobs.length - todo.length} en caché · ${todo.length} por renderizar`);
  if (has('--plan')) { for (const j of P.jobs) console.log(`  ${fs.existsSync(file(j)) ? '✓' : '·'} ${j.id.padEnd(14)} [${j.a},${j.b})  ${j.hash}`); return; }
  const workers = +arg('--workers', Math.max(1, os.cpus().length)), q = [...todo], render = path.join(ROOT, 'engine/render.mjs');
  const run = (j) => new Promise((res, rej) => {
    const p = spawn(process.execPath, [render, '--range', `${j.a}:${j.b}`, '--fps', String(fps), '--size', size, '--out', file(j), '--crf', review ? '23' : '16'], { stdio: 'inherit', env: process.env });
    p.on('close', (c) => (c === 0 ? (console.log('  ✓', j.id, `[${j.a},${j.b})`), res()) : rej(new Error('fragmento falló ' + j.id))));
  });
  if (has('--max-chunks')) q.splice(+arg('--max-chunks'));
  await Promise.all(Array.from({ length: workers }, async () => { while (q.length) await run(q.shift()); }));
  if (P.jobs.some((j) => !fs.existsSync(file(j)))) return console.log('Fragmentos pendientes: relanza el mismo comando (los hechos se saltan).');
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ film: name, fps, size, frames: P.N, fragments: P.jobs.map((j) => ({ ...j, file: path.relative(ROOT, file(j)), t: [j.a / fps, j.b / fps] })) }, null, 1));
  // limpieza: fragmentos de este film/tamaño/fps que ya no pertenecen al plan
  const keep = new Set(P.jobs.map((j) => path.basename(file(j))));
  for (const f of fs.readdirSync(dir)) if (f.endsWith(`_${fps}_${size}.mp4`) && !keep.has(f)) fs.rmSync(path.join(dir, f));
  const list = path.join(dir, 'list.txt'); fs.writeFileSync(list, P.jobs.map((j) => `file '${file(j)}'`).join('\n'));
  const raw = path.join(ROOT, 'out', `${name}${review ? '.review' : ''}_raw.mp4`);
  await sh(['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', raw]);
  // audio: mezcla del timeline fuente (regenerada si el timeline es más nuevo); en montaje, recortada/re-temporizada por ítem
  const tlp = path.join(ROOT, timelinePath()), mixf = path.join(ROOT, `data/mix${mixName()}.wav`);
  if (!fs.existsSync(mixf) || fs.statSync(mixf).mtimeMs < fs.statSync(tlp).mtimeMs) mix(JSON.parse(fs.readFileSync(tlp, 'utf8')));
  let audio = mixf;
  if (film.edit) {
    const parts = film.edit.items.map((it, i) => { let f = `[0:a]atrim=${it.t0}:${it.t1 + 1e-4},asetpts=PTS-STARTPTS`; let s = it.sp; while (s > 2) { f += ',atempo=2'; s /= 2; } while (s < 0.5) { f += ',atempo=0.5'; s /= 0.5; } if (s !== 1) f += `,atempo=${s}`; if (it.reverse) f += ',areverse'; if (it.hold) f += `,apad=pad_dur=${it.hold}`; return f + `[a${i}]`; });
    audio = path.join(ROOT, 'out', `${name}_audio.wav`);
    await sh(['-y', '-loglevel', 'error', '-i', mixf, '-filter_complex', parts.join(';') + ';' + film.edit.items.map((_, i) => `[a${i}]`).join('') + `concat=n=${film.edit.items.length}:v=0:a=1[o]`, '-map', '[o]', audio]);
  }
  const final = path.join(ROOT, 'out', `${name === 'main' ? 'master' : name}${review ? '.review' : ''}.mp4`);
  const m = spawnSync('ffmpeg', ['-hide_banner', '-i', audio, '-af', 'loudnorm=I=-14:LRA=7:TP=-1:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
  const js = JSON.parse(m.stderr.slice(m.stderr.lastIndexOf('{'), m.stderr.lastIndexOf('}') + 1));
  const silent = !Number.isFinite(+js.input_i);
  const af = silent ? 'anull' : `loudnorm=I=-14:LRA=7:TP=-1:measured_I=${js.input_i}:measured_LRA=${js.input_lra}:measured_TP=${js.input_tp}:measured_thresh=${js.input_thresh}:offset=${js.target_offset}:linear=true`;
  await sh(['-y', '-loglevel', 'error', '-i', raw, '-i', audio, '-t', String(film.duration), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-af', af, '-movflags', '+faststart', final]);
  fs.rmSync(raw);
  console.log('→', path.relative(ROOT, final), silent ? '(audio silencioso)' : '(−14 LUFS)');
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
