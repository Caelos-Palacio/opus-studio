#!/usr/bin/env node
// Sala de montaje. El film se trocea en FRAGMENTOS (segmentos entre cortes limpios) con hash de contenido:
// solo se re-renderiza lo que cambió. El master es un concat sin recodificar + audio.
//   node engine/cut.mjs [--review] [--fps N] [--size WxH] [--workers N] [--chunk 120] [--edit data/edit.json] [--plan]
//   --plan : muestra qué fragmentos están en caché y cuáles se renderizarían (no renderiza)
//   master (sin --review) exige lint SHIP vigente + crítico sin FIX (engine/gate.mjs); si no, falla salvo --force "razón" (queda en el ledger).
// Concurrencia (F1): cada fragmento se renderiza a un archivo de staging y SOLO se registra si el hash del plan sigue igual tras el
//   render (TOCTOU: otro agente pudo editar el shot mientras el worker lo importaba). Manifest, limpieza de huérfanos, list y concat
//   van bajo lock "fragments/<film>" y re-verifican el plan dentro del lock. Staging/.part.mp4 de procesos muertos se borran.
// Hash de un fragmento (E5, todo por contenido, engine/hash.mjs) = motor (cierre REAL de imports de render+autocam, mismo
//   cálculo que verdict.engineHash) + paquetes@versión + estilo + perfil + fuentes resueltas + assets + audio.json + tamaño/fps
//   + entradas de timeline de sus shots (+ la del previo si hay cam.chain) + su cámara auto horneada + cierre de imports de sus shots.
// Audio: la mezcla se regenera solo si cambia el hash de sus entradas (timeline, música, código de sound) — no por mtime.
// Problemas que evita: re-render total por un cambio de 1 shot; concat roto por parámetros distintos (todos iguales, cada
// fragmento empieza en IDR); espacio de color sin etiquetar (bt709 explícito); fragmentos huérfanos (manifest por film).
import './help.mjs';
import { isMain } from './paths.mjs';
import { announceFilm } from './filmid.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { ROOT, loadFilm, timelinePath } from './film.mjs';
import { ensureMix, mixName } from './sound.mjs';
import { sha, engineSig, assetsSig, fontSig, shotDeps, shotHash, world3dSig, usesWorld3d } from './hash.mjs';
import { withLock, writeAtomic } from './lock.mjs';
import { record } from './ledger.mjs';
import { masterGate } from './gate.mjs';
import { cookEntry } from './resolve.mjs';
import { filmId } from './filmid.mjs';
import { workerThreads } from './encode.mjs';
import { atempoChain } from './inputs.mjs';
import { shotImports } from './cookkey.mjs';

const argv = process.argv.slice(2), has = (k) => argv.includes(k), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
export const filmName = (tlPath = timelinePath()) => filmId(tlPath);
export { shotHash };
// P2: el master se llama como el film (out/mate.mp4); el demo conserva out/master.mp4 por compatibilidad.
export const masterFile = (name, review = false) => `out/${name === 'main' ? 'master' : name}${review ? '.review' : ''}.mp4`;
// Segmentos: grupos de shots que se solapan (morphs) no se parten; cortes limpios sí.
// R4 (spec 009): preset por defecto `faster` (−19 % CPU a igual calidad, PSNR 50,49 dB vs 50,24 de medium) y threads automáticos por worker; entra en el hash del fragmento.
export const DEFAULT_PRESET = 'faster';
// Troceo (spec 009): un fragmento por shot de 285 fotogramas a 160 ms/fotograma era el camino crítico del master (46 s de 125 s con 12 núcleos casi ociosos). Con trozos de ≤120
// fotogramas el reparto es casi perfecto; se encolan los más largos primero (LPT). Los fragmentos se concatenan sin recodificar: mismos píxeles, el chunk entra en el hash.
export const DEFAULT_CHUNK = 120;
export function plan(film, { fps, size, chunk = DEFAULT_CHUNK, preset = DEFAULT_PRESET }) {
  const engine = sha(engineSig(), JSON.stringify(film.S), ...(film.medium ? [JSON.stringify(film.medium)] : []), fontSig([film.S.typeface]), ...(usesWorld3d(film.shots.map((s) => s.id)) ? [world3dSig()] : []));   // spec 004: backend GL + Mesa en el hash solo si el film usa world3d
  const glob = sha(engine, assetsSig(), film.audioInfo ?? null, film.width, film.height, film.duration, film.fps, film.motif, film.handoffs, film.profileName, film.P, fps, size, film.edit?.items ?? null, ...(preset !== 'medium' ? [preset] : []));
  const N = Math.round(film.duration * fps) + 1, jobs = [];
  // F4 cookKey: entrada RESUELTA del shot (params tras capas + señales que usa; sin meta) + la de los shots cuyo código
  // importa (sus entidades leen los parámetros de ese shot: A2 hereda el punto de A1).
  const entry = (s) => cookEntry(film, s);
  const push = (a, b, ids, extra) => {
    const shots = ids.map((id) => film.shots.find((s) => s.id === id)), ac = (s) => film.autocam?.[s.id] ?? null;
    const prevChain = shots.flatMap((s) => { const i = film.shots.indexOf(s); return s.cam?.chain && i > 0 ? [entry(film.shots[i - 1]), ac(film.shots[i - 1])] : []; });
    const imported = [...new Set(ids.flatMap((id) => shotImports(id)))].filter((id) => !ids.includes(id)).map((id) => film.shots.find((s) => s.id === id)).filter(Boolean).map(entry);
    const h = sha(glob, shots.map(entry), shots.map(ac), prevChain, imported, ids.map((id) => shotDeps(id)), extra ?? '');
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
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
// Registra un fragmento renderizado solo si su hash sigue siendo el del plan ACTUAL (recalculado desde disco tras el render).
export async function commitFragment(stage, final, j, opts, film = null) {
  const now = plan(film ?? (await loadFilm()), opts).jobs.find((x) => x.id === j.id && x.a === j.a && x.b === j.b);
  if (now?.hash === j.hash && fs.existsSync(stage)) { fs.renameSync(stage, final); return true; }
  fs.rmSync(stage, { force: true });
  record({ action: 'fragment.discard', target: path.relative(ROOT, final), hash_before: j.hash, hash_after: now?.hash ?? null, verdict: 'stale', why: 'el shot/timeline cambió durante el render' });
  return false;
}
// Staging y .part.mp4 huérfanos: de un pid muerto (este host) o, sin pid, con más de 1 h.
export function cleanPartials(dir) {
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (!/\.(part|tmp)\.mp4$/.test(f)) continue;
    const m = f.match(/\.stage-(\d+)-/), q = path.join(dir, f);
    try { if (m ? !alive(+m[1]) : Date.now() - fs.statSync(q).mtimeMs > 3600e3) fs.rmSync(q, { force: true }); } catch {}
  }
}

async function main() {
  const film = await loadFilm(), review = has('--review'), name = filmName() + (film.edit ? '.edit' : '');
  if (review && process.env.OPUS_FXFAST !== '0') { film.P.fxFast = true; process.env.OPUS_FXFAST = '1'; }   // R3 (spec 009): review/preview con fx rápidos (los workers lo heredan); el master NO
  const fps = +arg('--fps', review ? 12 : film.fps), size = arg('--size', review ? `${Math.round((540 * film.width) / film.height / 2) * 2}x540` : `${film.width}x${film.height}`);
  const dir = path.join(ROOT, 'out/fragments', name); fs.mkdirSync(dir, { recursive: true });
  const preset = arg('--preset', process.env.OPUS_PRESET ?? DEFAULT_PRESET), opts = { fps, size, chunk: +arg('--chunk', DEFAULT_CHUNK), preset }, P = plan(film, opts), file = (j) => path.join(dir, `${j.id}_${j.hash}_${fps}_${size}.mp4`);
  const todo = P.jobs.filter((j) => !fs.existsSync(file(j)));
  console.log(`${film.edit ? 'montaje' : 'film'} "${name}" · ${P.N} frames @${fps} ${size} · ${P.jobs.length} fragmentos · ${P.jobs.length - todo.length} en caché · ${todo.length} por renderizar`);
  if (has('--plan')) { for (const j of P.jobs) console.log(`  ${fs.existsSync(file(j)) ? '✓' : '·'} ${j.id.padEnd(14)} [${j.a},${j.b})  ${j.hash}`); return; }
  const gate = async () => { if (review) return; const g = await masterGate({ film, plan, force: has('--force') ? arg('--force', true) : null });
    if (!g.ok) throw new Error(`master bloqueado por el gate:\n  ${g.reasons.join('\n  ')}\n(npm run lint → SHIP; o --force "razón", que queda en out/ledger.jsonl)`);
    if (g.forced) console.log(`! master FORZADO: ${g.reasons.join(' · ')}`); };
  await gate();
  cleanPartials(dir);
  const threads = arg('--threads', process.env.OPUS_THREADS ?? 'auto'), workers = +arg('--workers', Math.max(1, os.cpus().length)), q = [...todo], render = path.join(ROOT, 'engine/render.mjs'); q.sort((a, b) => (b.b - b.a) - (a.b - a.a));   // LPT: lo más largo primero
  const run = (j) => new Promise((res, rej) => {
    const stage = path.join(dir, `.${j.id}_${j.hash}.stage-${process.pid}-${Math.random().toString(36).slice(2, 8)}.tmp.mp4`);
    const p = spawn(process.execPath, [render, '--range', `${j.a}:${j.b}`, '--fps', String(fps), '--size', size, '--out', stage, '--crf', review ? '23' : String(film.medium?.encode?.crf ?? 16), '--preset', preset, '--threads', String(threads === 'auto' ? workerThreads(Math.min(workers, todo.length)) : +threads || 0)], { stdio: 'inherit', env: process.env });
    p.on('close', async (c) => { if (c !== 0) { fs.rmSync(stage, { force: true }); fs.rmSync(stage + '.part.mp4', { force: true }); return rej(new Error('fragmento falló ' + j.id)); }
      try { if (await commitFragment(stage, file(j), j, opts)) console.log('  ✓', j.id, `[${j.a},${j.b})`); else console.log('  ✗', j.id, 'cambió durante el render: descartado (relanza)'); res(); } catch (e) { rej(e); } });
  });
  if (has('--max-chunks')) q.splice(+arg('--max-chunks'));
  await Promise.all(Array.from({ length: workers }, async () => { while (q.length) await run(q.shift()); }));
  if (P.jobs.some((j) => !fs.existsSync(file(j)))) return console.log('Fragmentos pendientes: relanza el mismo comando (los hechos se saltan).');
  const raw = path.join(ROOT, 'out', `${name}${review ? '.review' : ''}.${process.pid}_raw.mp4`);
  const stale = await withLock(`fragments/${name}`, async () => {                // manifest + huérfanos + list + concat: un agente a la vez
    const now = plan(await loadFilm(), opts);                                    // re-verificación DENTRO del lock
    if (now.jobs.length !== P.jobs.length || now.jobs.some((j, i) => j.hash !== P.jobs[i].hash)) return true;
    await gate();
    if (P.jobs.some((j) => !fs.existsSync(file(j)))) return true;
    writeAtomic(path.join(dir, 'manifest.json'), JSON.stringify({ film: name, fps, size, frames: P.N, fragments: P.jobs.map((j) => ({ ...j, file: path.relative(ROOT, file(j)), t: [j.a / fps, j.b / fps] })) }, null, 1));
    // limpieza: fragmentos de este film/tamaño/fps que ya no pertenecen al plan (vigente, verificado bajo lock)
    const keep = new Set(P.jobs.map((j) => path.basename(file(j))));
    for (const f of fs.readdirSync(dir)) if (f.endsWith(`_${fps}_${size}.mp4`) && !keep.has(f)) fs.rmSync(path.join(dir, f), { force: true });
    cleanPartials(dir);
    const list = path.join(dir, `list.${process.pid}.txt`); fs.writeFileSync(list, P.jobs.map((j) => `file '${file(j)}'`).join('\n'));
    try { await sh(['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', raw]); } finally { fs.rmSync(list, { force: true }); }
    return false;
  }, { waitMs: 600000 });
  if (stale) { console.log('El film cambió mientras se montaba (otro agente editó shots/timeline): relanza el mismo comando.'); process.exitCode = 1; return; }
  // audio: mezcla del timeline fuente (regenerada si cambia el hash de sus entradas); en montaje, recortada/re-temporizada por ítem
  const tlp = path.join(ROOT, timelinePath()), mixf = path.join(ROOT, `data/mix${mixName()}.wav`);
  await withLock(`mix${mixName()}`, () => ensureMix(JSON.parse(fs.readFileSync(tlp, 'utf8'))));
  let audio = mixf;
  if (film.edit) {
    const parts = film.edit.items.map((it, i) => { let f = `[0:a]atrim=${it.t0}:${it.t1 + 1e-4},asetpts=PTS-STARTPTS`; f += atempoChain(it.sp); if (it.reverse) f += ',areverse'; if (it.hold) f += `,apad=pad_dur=${it.hold}`; return f + `[a${i}]`; });
    audio = path.join(ROOT, 'out', `${name}.${process.pid}_audio.wav`);
    await sh(['-y', '-loglevel', 'error', '-i', mixf, '-filter_complex', parts.join(';') + ';' + film.edit.items.map((_, i) => `[a${i}]`).join('') + `concat=n=${film.edit.items.length}:v=0:a=1[o]`, '-map', '[o]', audio]);
  }
  const final = path.join(ROOT, masterFile(name, review));
  // Soundtrack v2 (spec 002): la mezcla ya sale masterizada (−14 LUFS, LRA ≥8, TP ≤ −1,5). loudnorm con LRA=7 la comprimiría (modo dinámico
  // cuando LRA > 7), así que se respeta tal cual. En montaje (EDL) el audio se recorta/re-temporiza y vuelve al camino clásico.
  let mastered = false; try { mastered = !film.edit && !!JSON.parse(fs.readFileSync(path.join(ROOT, `out/sfx${mixName()}.json`), 'utf8')).mastered; } catch {}
  let js = null, silent = false, af = 'anull';
  if (!mastered) {
    const m = spawnSync('ffmpeg', ['-hide_banner', '-i', audio, '-af', 'loudnorm=I=-14:LRA=7:TP=-1:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
    js = JSON.parse(m.stderr.slice(m.stderr.lastIndexOf('{'), m.stderr.lastIndexOf('}') + 1));
    silent = !Number.isFinite(+js.input_i);
    af = silent ? 'anull' : `loudnorm=I=-14:LRA=7:TP=-1:measured_I=${js.input_i}:measured_LRA=${js.input_lra}:measured_TP=${js.input_tp}:measured_thresh=${js.input_thresh}:offset=${js.target_offset}:linear=true`;
  }
  const tmpFinal = final.replace(/\.mp4$/, `.${process.pid}.tmp.mp4`);             // el master aparece completo o no aparece
  try { await sh(['-y', '-loglevel', 'error', '-i', raw, '-i', audio, '-t', String(film.duration), '-c:v', 'copy', '-c:a', 'aac', '-b:a', mastered ? '256k' : '192k', '-ar', '48000', '-af', af, '-movflags', '+faststart', tmpFinal]); fs.renameSync(tmpFinal, final); }
  finally { fs.rmSync(raw, { force: true }); fs.rmSync(tmpFinal, { force: true }); if (audio !== mixf) fs.rmSync(audio, { force: true }); }
  record({ action: review ? 'review' : 'master', target: path.relative(ROOT, final), hash_after: sha(P.jobs.map((j) => j.hash)), verdict: 'ok' });
  console.log('→', path.relative(ROOT, final), silent ? '(audio silencioso)' : mastered ? '(mezcla v2 masterizada, −14 LUFS)' : '(−14 LUFS)');
}
if (isMain(import.meta.url)) { announceFilm(); main().catch((e) => { console.error(e.message); process.exit(1); });  }
