#!/usr/bin/env node
// Motor (spec 009, docs/current/EFICIENCIA.md R1/R6/R7): caché compartida de fotogramas, lint incremental, fxFast por defecto, cut y audio por etapa.
// Corre en copias temporales del repo. Escenarios M1–M9 de docs/specs/009-motor.md.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ROOT, copyRepo, rmrf, run } from './lib.mjs';

const argv = process.argv.slice(2);
const sha = (x) => crypto.createHash('sha1').update(x).digest('hex').slice(0, 12);
const imp = (root, f) => import(pathToFileURL(path.join(root, f)).href);

// ── sondas: corren DENTRO de la copia (cwd = root) y escriben JSON en stdout ───────────────────────────────────────
if (argv[0] === '--probe') {
  const [, root, what] = argv, out = {};
  if (what === 'keys') {
    const { makeRenderer } = await imp(root, 'engine/render.mjs'), { frameKey } = await imp(root, 'engine/framecache.mjs'), R = await makeRenderer({ size: '192x108', grade: false }), f = R.film;
    out.keys = [1, 3, 5].map((t) => frameKey(f, t, { W: 192, H: 108, grade: false }));
    out.again = frameKey(f, 3, { W: 192, H: 108, grade: false });
    out.size = frameKey(f, 3, { W: 320, H: 180, grade: false }); out.grade = frameKey(f, 3, { W: 192, H: 108, grade: true }); out.guard = frameKey(f, 3, { W: 192, H: 108, grade: false, guard: true });
  } else if (what === 'frames') {
    const { makeRenderer } = await imp(root, 'engine/render.mjs'), { frameCache, stats } = await imp(root, 'engine/framecache.mjs');
    const R = await makeRenderer({ size: '192x108', grade: false }), FC = frameCache({ film: R.film, size: '192x108', grade: false, make: async () => R }), res = [];
    for (const t of [0.5, 3, 5.5]) {
      const direct = R.frame(t), dBoxes = JSON.stringify([...direct]), dMeta = JSON.stringify(direct.meta ?? []), dPx = sha(R.ctx.getImageData(0, 0, R.W, R.H).data);
      const a = await FC.get(t, { px: true }), b = await FC.get(t, { px: true });
      res.push({ t, same1: JSON.stringify([...a.boxes]) === dBoxes && JSON.stringify(a.boxes.meta ?? []) === dMeta && sha(a.data) === dPx, same2: JSON.stringify([...b.boxes]) === dBoxes && sha(b.data) === dPx, hit1: a.hit, hit2: b.hit });
    }
    out.res = res; out.stats = { hit: stats.hit, miss: stats.miss };
  } else if (what === 'fx') {
    const { loadFilm } = await imp(root, 'engine/film.mjs'), f = await loadFilm(); out.fxFast = f.P.fxFast ?? null;
  } else if (what === 'plan') {
    const { loadFilm } = await imp(root, 'engine/film.mjs'), { plan, DEFAULT_PRESET, DEFAULT_CHUNK } = await imp(root, 'engine/cut.mjs'), f = await loadFilm(), o = { fps: f.fps, size: `${f.width}x${f.height}` };
    const h = (x) => plan(f, x).jobs.map((j) => j.hash).join(',');
    out.def = DEFAULT_PRESET; out.chunk = DEFAULT_CHUNK; out.h0 = h(o); out.hFaster = h({ ...o, preset: 'faster' }); out.hMedium = h({ ...o, preset: 'medium' });
    out.jobs = plan(f, o).jobs.length; out.jobsBig = plan(f, { ...o, chunk: 20 }).jobs.length;
    f.P.fxFast = true; out.hFx = h(o);
  } else if (what === 'audio') {
    const SND = await imp(root, 'engine/sound.mjs'), { astats } = await imp(root, 'engine/audiocache.mjs'), tl = JSON.parse(fs.readFileSync(path.join(root, 'data/timeline.json'), 'utf8'));
    tl.sound = { style: 'epico' }; tl.shots[0].sfx = [{ at: 0.5, type: 'impact', gain: 0.9 }];
    const H = (b) => sha(Buffer.concat([Buffer.from(b.master.L.buffer), Buffer.from(b.master.R.buffer)]));
    const mut = JSON.parse(JSON.stringify(tl)); mut.shots[1].sfx = [{ at: 0.3, type: 'whoosh', gain: 0.5, dur: 0.6 }];
    const t0 = Date.now(), a = SND.build(tl, { tag: 'm9' }), t1 = Date.now(), b = SND.build(tl, { tag: 'm9' }), t2 = Date.now(), c = SND.build(mut, { tag: 'm9' });
    out.a = { h: H(a), cache: a.cache, ms: t1 - t0 }; out.b = { h: H(b), cache: b.cache, ms: t2 - t1 }; out.c = { h: H(c), cache: c.cache };
    out.leads = JSON.stringify(a.events.map((e) => e.lead)) === JSON.stringify(b.events.map((e) => e.lead));
    process.env.OPUS_NOCACHE = '1'; out.cNoCache = H(SND.build(mut, { tag: 'm9' })); out.aNoCache = H(SND.build(tl, { tag: 'm9' }));
  }
  process.stdout.write(JSON.stringify(out)); process.exit(0);
}

let n = 0, bad = 0; const ok = (c, m) => { n++; if (!c) { bad++; console.log('  ✗ motor:', m); } };
const probe = async (d, what, env = {}) => { const r = await run([path.join(ROOT, 'test/motor.mjs'), '--probe', d, what], { cwd: d, env, timeout: 300000 }); try { return JSON.parse(r.stdout); } catch { console.log(`  ✗ motor: sonda ${what} falló: ${(r.stderr || r.stdout).slice(-300)}`); bad++; return {}; } };
const lintIssues = (d) => { try { return JSON.parse(fs.readFileSync(path.join(d, 'out/lint.json'), 'utf8')).issues.map((i) => `${i.level}|${i.check}|${i.shot}|${i.t}|${i.problem}`).sort(); } catch { return null; } };
const stats = (d) => { try { return JSON.parse(fs.readFileSync(path.join(d, 'out/cache/lint-stats.json'), 'utf8')); } catch { return null; } };
const ENV = { OPUS_TIMELINE: '', OPUS_STATS: '1' };
const d = copyRepo();
try {
  // M1 claves de fotograma
  const k0 = await probe(d, 'keys');
  ok(k0.again === k0.keys?.[1], 'M1: la clave es estable (mismo film, mismo t)');
  ok(new Set([k0.keys?.[1], k0.size, k0.grade, k0.guard]).size === 4, 'M1: tamaño, grade y guardia cambian la clave');
  const tlp = path.join(d, 'data/timeline.json'), tl = JSON.parse(fs.readFileSync(tlp, 'utf8')); tl.shots[1].text = 'OTRA IDEA'; fs.writeFileSync(tlp, JSON.stringify(tl, null, 2));
  const k1 = await probe(d, 'keys');
  ok(k1.keys?.[0] === k0.keys?.[0] && k1.keys?.[1] !== k0.keys?.[1] && k1.keys?.[2] !== k0.keys?.[2], 'M1: cambiar A2 cambia las claves donde A2 está activo y donde está A3 (A3 importa el código de A2, hereda su estado), no las de A1');
  // M2 acierto == render directo
  const fr = await probe(d, 'frames');
  ok(fr.res?.length === 3 && fr.res.every((r) => r.same1 && r.same2), 'M2: el fotograma servido (cajas, meta, píxeles) es idéntico al render directo, en fallo y en acierto');
  ok(fr.res?.every((r) => r.hit1 === false && r.hit2 === true), 'M2: el 2.º acceso es un acierto de caché');
  // M3 lint en caliente == frío == sin caché
  await run(['engine/lint.mjs'], { cwd: d, env: ENV, timeout: 600000 }); const cold = lintIssues(d), sc = stats(d);
  await run(['engine/lint.mjs'], { cwd: d, env: ENV, timeout: 600000 }); const warm = lintIssues(d), sw = stats(d);
  await run(['engine/lint.mjs'], { cwd: d, env: { ...ENV, OPUS_NOCACHE: '1' }, timeout: 600000 }); const nocache = lintIssues(d);
  ok(cold && JSON.stringify(cold) === JSON.stringify(warm) && JSON.stringify(cold) === JSON.stringify(nocache), 'M3: lint en frío = en caliente = con OPUS_NOCACHE=1 (mismos avisos)');
  ok(sc?.frames.miss > 0 && sw?.frames.miss === 0 && sw?.frames.hit > 0 && sw?.det.miss === 0 && sw?.det.hit > 0, `M3: la 2.ª pasada no renderiza nada (fallos ${sw?.frames.miss}, determinismo ${sw?.det.miss}; aciertos ${sw?.frames.hit}/${sw?.det.hit})`);
  // M4 cambiar A2 → lint --shot A2 solo renderiza donde A2 está activo
  const a2 = path.join(d, 'shots/A2.mjs'); fs.writeFileSync(a2, fs.readFileSync(a2, 'utf8') + '\n// toque\n');
  await run(['engine/lint.mjs', '--shot', 'A2'], { cwd: d, env: ENV, timeout: 600000 }); const s4 = stats(d);
  ok(s4 && s4.frames.miss > 0 && s4.frames.missT.every((t) => t >= 2 - 1e-6), `M4: lint --shot A2 tras cambiarlo: ningún fallo de caché en la ventana de A1 (A3 importa A2 y se re-renderiza con él) (${s4?.frames.miss} fallos)`);
  ok(s4 && s4.frames.hit > 0 && s4.det.hit >= 1 && s4.det.miss >= 1, `M4: A1 sale de caché (aciertos ${s4?.frames.hit}; determinismo ${s4?.det.hit} acierto / ${s4?.det.miss} fallo)`);
  // M6 --shot real en motion/rhythm: con OPUS_NOCACHE el nº de fotogramas renderizados es el de la ventana, no el del film
  await run(['engine/lint.mjs', '--shot', 'A3', '--only', 'motion'], { cwd: d, env: { ...ENV, OPUS_NOCACHE: '1' }, timeout: 600000 }); const s6 = stats(d);
  ok(s6 && s6.frames.miss > 0 && s6.frames.miss < 60 && Math.min(...s6.frames.missT) >= 1.5, `M6: lint --shot A3 --only motion recorre solo la ventana (${s6?.frames.miss} fotogramas de 73, desde ${Math.min(...(s6?.frames.missT ?? [0]))} s)`);
  // M5 determinismo: una muestra que falla no se cachea y se vuelve a detectar (renderiza dos veces de verdad)
  const mut = fs.readFileSync(a2, 'utf8').replace('export default {', 'let n = 0;\nexport default {').replace(/api\.text\(shot\.text,/, "ctx.fillStyle='#f00'; ctx.fillRect(50+(n++%2)*30,50,20,20); api.text(shot.text,");
  fs.writeFileSync(a2, mut);
  for (const i of [1, 2]) { const r = await run(['engine/lint.mjs', '--only', 'determinism'], { cwd: d, env: ENV, timeout: 600000 }); ok(/no determinista/.test(r.stdout), `M5: shot con estado entre fotogramas detectado también en la pasada ${i} (la caché solo guarda los OK)`); }
  // M7 fxFast por defecto en lint/peek/review, no en master; OPUS_FXFAST=0 lo apaga
  const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  ok(/OPUS_FXFAST \?\?= '1'/.test(read('engine/lint.mjs')) && /OPUS_FXFAST \?\?= '1'/.test(read('engine/peek.mjs')), "M7: lint y peek activan fxFast por defecto (process.env.OPUS_FXFAST ??= '1')");
  ok(/review && process\.env\.OPUS_FXFAST !== '0'/.test(read('engine/cut.mjs')), 'M7: cut --review activa fxFast; el master no');
  const f0 = await probe(d, 'fx', { OPUS_TIMELINE: '' }), f1 = await probe(d, 'fx', { OPUS_FXFAST: '1' }), f2 = await probe(d, 'fx', { OPUS_FXFAST: '0' });
  ok(f0.fxFast === null && f1.fxFast === true && f2.fxFast === false, `M7: loadFilm por defecto sin fxFast (master), OPUS_FXFAST=1 activo, =0 fuera (${f0.fxFast}/${f1.fxFast}/${f2.fxFast})`);
  // M8 cut: preset faster por defecto, en el hash; troceo
  const pl = await probe(d, 'plan');
  ok(pl.def === 'faster' && pl.h0 === pl.hFaster && pl.h0 !== pl.hMedium, 'M8: preset por defecto faster; entra en el hash del fragmento (medium da otro)');
  ok(pl.hFx !== pl.h0, 'M8: fxFast entra en el hash del fragmento (review ≠ master)');
  ok(pl.chunk === 120 && pl.jobsBig > pl.jobs, `M8: troceo por defecto ${pl.chunk} fotogramas; un chunk menor da más fragmentos (${pl.jobs} → ${pl.jobsBig})`);
  const src = read('engine/cut.mjs');
  ok(/OPUS_THREADS \?\? 'auto'/.test(src) && /q\.sort\(/.test(src), 'M8: hilos x264 auto por defecto y cola de fragmentos por longitud (LPT)');
  // M9 audio por etapas
  const au = await probe(d, 'audio');
  ok(au.a?.h && au.a.h === au.aNoCache && au.c?.h === au.cNoCache, 'M9: la mezcla con caché es bit a bit la de sintetizar de cero (OPUS_NOCACHE=1)');
  ok(au.a?.cache && !au.a.cache.music && !au.a.cache.events && au.b?.cache?.music && au.b.cache.events && au.b.h === au.a.h && au.leads, `M9: 2.ª mezcla idéntica y sin sintetizar (música ${au.b?.cache?.music}, efectos ${au.b?.cache?.events}; ${au.a?.ms} → ${au.b?.ms} ms)`);
  ok(au.c?.cache?.music === true && au.c.cache.events === false && au.c.h !== au.a.h, 'M9: añadir un sfx re-sintetiza solo los efectos (la música sale de caché)');
} finally { rmrf(d); }
console.log(`${bad ? '✗' : '✓'} motor            ${n - bad}/${n}`);
process.exit(bad ? 1 : 0);
