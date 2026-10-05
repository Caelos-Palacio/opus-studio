#!/usr/bin/env node
// E5: hash completo y por contenido (engine/hash.mjs). Cada bloque falla si se quita su pieza:
//   grafo-vivo      todo módulo que se CARGA al producir píxeles (render + autocam, trazado con un hook de carga) está en el
//                   cierre del hash (o es gobernanza/doc excluida). Con la lista manual antigua (sin autocam/sandbox) falla.
//   motor-unificado editar autocam.mjs/sandbox.mjs invalida fragmentos y engineHash; doc.mjs nada; lint.mjs solo engineHash.
//   autocam-data    la cámara horneada (data/autocam/*.json) entra en el hash del fragmento de su shot (y del encadenado).
//   assets          touch sin cambio de contenido NO invalida; cambio de contenido con mismo size+mtime SÍ (caché por ctime).
//   shot-indirecto  editar un módulo importado indirectamente por un shot (subcarpeta, ../engine) invalida su fragmento
//                   (y el de los shots que lo importan: A3 importa A2), no el de los demás.
//   fuentes         fuentes del sistema (fontconfig) y del proyecto por digest de contenido.
//   mezcla          la mezcla se regenera por hash de entradas (timeline, música, código), no por mtime.
//   render-mp4      `render --mp4` legado redirige a cut (no monta bloques sin hash).
// Corre en copias temporales (nunca toca tus archivos).   node test/hash.mjs [--only nombre]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { copyRepo, rmrf } from './lib.mjs';

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
for (const k of ['OPUS_TIMELINE', 'OPUS_STYLE', 'OPUS_PROFILE', 'OPUS_EDIT']) delete process.env[k];
const SETTLE = 300, ENV = { OPUS_HASH_SETTLE_MS: String(SETTLE) };
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('  ✗ hash:', m); } };
const T = [];
const test = (name, fn) => T.push({ name, fn });

// Script ESM en un proceso hijo con cwd = copia (cada paso ve el disco de nuevo, como un agente distinto).
const node = (d, code, env = {}, args = []) => {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code, ...args], { cwd: d, encoding: 'utf8', env: { ...process.env, ...ENV, ...env }, timeout: 300000 });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return r.stdout.trim().split('\n').pop();
};
// Plan (hash por fragmento) + engineHash + hash de shot del veredicto.
const snap = (d) => JSON.parse(node(d, `
  const { loadFilm } = await import('./engine/film.mjs'), { plan } = await import('./engine/cut.mjs'), V = await import('./engine/verdict.mjs');
  const f = await loadFilm({ animatic: true }), P = plan(f, { fps: 12, size: '64x36' }), cur = V.currentHashes();
  console.log(JSON.stringify({ jobs: Object.fromEntries(P.jobs.map((j) => [j.id, j.hash])), engine: cur.engineHash, shots: cur.shots }));`));
const changed = (a, b) => Object.keys(a.jobs).filter((k) => a.jobs[k] !== b.jobs[k]).sort().join(',');
const append = (d, f, s = '\n// edición\n') => fs.appendFileSync(path.join(d, f), s);

test('grafo-vivo', () => {
  const d = copyRepo();
  try {
    const trace = path.join(d, 'loaded.txt');
    const hook = `import m from 'node:module'; import fs from 'node:fs'; const L = new Set();
      m.registerHooks({ load(u, c, nx) { L.add(u); return nx(u, c); } }); process.on('exit', () => fs.appendFileSync(${JSON.stringify(trace)}, [...L].join('\\n') + '\\n'));`;
    const run = (args) => spawnSync(process.execPath, ['--import', 'data:text/javascript,' + encodeURIComponent(hook), ...args], { cwd: d, encoding: 'utf8', env: { ...process.env, ...ENV } });
    const r1 = run(['engine/render.mjs', '--still', '1', '--size', '64x36']), r2 = run(['engine/autocam.mjs']);
    ok(r1.status === 0 && r2.status === 0, 'grafo-vivo: render/autocam corren ' + r1.stderr + r2.stderr);
    const loaded = [...new Set(fs.readFileSync(trace, 'utf8').split('\n').filter((u) => u.startsWith('file://')).map((u) => decodeURIComponent(new URL(u).pathname)))]
      .filter((f) => f.startsWith(d + path.sep) && !f.includes(`${path.sep}node_modules${path.sep}`)).map((f) => path.relative(d, f));
    const C = JSON.parse(node(d, `const H = await import('./engine/hash.mjs'), fs = await import('node:fs');
      const shots = fs.readdirSync('shots').filter((f) => f.endsWith('.mjs')).flatMap((f) => H.closure(['shots/' + f]).files);
      console.log(JSON.stringify({ pixel: H.engineFiles(), all: H.engineFiles([...H.PIXEL_ROOTS, ...H.JUDGE_ROOTS]), shots, stop: [...H.NON_PIXEL] }));`));
    const covered = new Set([...C.pixel, ...C.shots]), stop = (f) => f.startsWith('engine/') && C.stop.includes(path.basename(f).replace(/\.\w+$/, ''));
    const missing = loaded.filter((f) => /\.m?js$/.test(f) && !covered.has(f) && !stop(f));
    ok(loaded.some((f) => f.startsWith('shots/')) && loaded.includes('engine/sandbox.mjs'), 'grafo-vivo: la traza ve shots y sandbox ' + loaded.join(' '));
    ok(!missing.length, `grafo-vivo: módulos cargados al producir píxeles fuera del hash: ${missing.join(', ')}`);
    ok(['engine/autocam.mjs', 'engine/sandbox.mjs', 'engine/guard.mjs', 'engine/schema.mjs'].every((f) => C.pixel.includes(f)), 'grafo-vivo: autocam/sandbox/guard/schema en el hash de píxeles');
    ok(!C.pixel.some(stop) && C.pixel.every((f) => C.all.includes(f)), 'grafo-vivo: gobernanza fuera; píxeles ⊂ engineHash del veredicto');
  } finally { rmrf(d); }
});

test('motor-unificado', () => {
  const d = copyRepo();
  try {
    let a = snap(d), b;
    for (const f of ['engine/autocam.mjs', 'engine/sandbox.mjs']) {
      append(d, f); b = snap(d);
      ok(changed(a, b) === 'A1,A2,A3' && a.engine !== b.engine, `motor-unificado: editar ${f} invalida todos los fragmentos y engineHash (${changed(a, b)})`); a = b;
    }
    append(d, 'engine/doc.mjs'); append(d, 'engine/gallery.mjs'); b = snap(d);
    ok(!changed(a, b) && a.engine === b.engine, 'motor-unificado: doc/gallery (no píxeles) no invalidan nada'); a = b;
    append(d, 'engine/lint.mjs'); b = snap(d);
    ok(!changed(a, b) && a.engine !== b.engine, 'motor-unificado: lint.mjs caduca veredictos (engineHash) pero no fragmentos'); a = b;
    append(d, 'engine/profiles.json', ' '); b = snap(d);
    ok(changed(a, b) === 'A1,A2,A3' && a.engine !== b.engine, 'motor-unificado: profiles.json en ambos');
  } finally { rmrf(d); }
});

test('autocam-data', () => {
  const d = copyRepo();
  try {
    const a = snap(d);
    const bake = (z) => node(d, `const { loadFilm } = await import('./engine/film.mjs'), { shotHash } = await import('./engine/hash.mjs'), fs = await import('node:fs');
      const f = await loadFilm({ animatic: true }); fs.mkdirSync('data/autocam', { recursive: true });
      fs.writeFileSync('data/autocam/timeline.json', JSON.stringify({ A1: { hash: shotHash(f, 'A1'), fps: 12, lambda: 1, anchor: [0.5, 0.5], samples: [[0, ${z}, 0, 0], [2, ${z}, 0, 0]] } })); console.log('ok');`);
    bake(1); const b = snap(d);
    ok(changed(a, b) === 'A1,A2', `autocam-data: hornear A1 invalida A1 (+A2 encadenado), no A3 (${changed(a, b)})`);
    bake(1.2); const c = snap(d);
    ok(changed(b, c) === 'A1,A2', `autocam-data: cambiar la trayectoria horneada invalida (${changed(b, c)})`);
  } finally { rmrf(d); }
});

test('assets', () => {
  const d = copyRepo();
  try {
    const f = path.join(d, 'assets/img/x.png'); fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, Buffer.alloc(4096, 1)); sleep(SETTLE + 100);
    const a = snap(d), db = JSON.parse(fs.readFileSync(path.join(d, 'out/cache/digests.json'), 'utf8'));
    ok(db[f]?.[1]?.length === 64, 'assets: digest sha256 cacheado por (size,mtime,ctime,ino) en out/cache/digests.json');
    const t = new Date(Date.now() + 3600e3); fs.utimesSync(f, t, t); sleep(SETTLE + 100);
    const b = snap(d); ok(!changed(a, b), 'assets: touch (mtime) sin cambio de contenido NO invalida');
    const st = fs.statSync(f); fs.writeFileSync(f, Buffer.alloc(4096, 2)); fs.utimesSync(f, st.atime, st.mtime);
    const s2 = fs.statSync(f); ok(s2.size === st.size && s2.mtimeMs === st.mtimeMs, 'assets: (control) mismo size y mtime');
    const c = snap(d); ok(changed(b, c) === 'A1,A2,A3', `assets: cambio de contenido con mismo size+mtime SÍ invalida (${changed(b, c)})`);
    fs.writeFileSync(f, Buffer.alloc(4096, 3)); fs.utimesSync(f, st.atime, st.mtime);    // recién escrito: no se cachea (racy)
    const e = snap(d); ok(changed(c, e) === 'A1,A2,A3', 'assets: dos cambios seguidos (mismo tick de reloj) también');
    fs.mkdirSync(path.join(d, 'assets/cache/tex'), { recursive: true }); fs.writeFileSync(path.join(d, 'assets/cache/tex/z.svg'), '<svg/>');
    ok(!changed(e, snap(d)), 'assets: cache/tex (derivada) no invalida');
  } finally { rmrf(d); }
});

test('shot-indirecto', () => {
  const d = copyRepo();
  try {
    fs.mkdirSync(path.join(d, 'shots/sub'), { recursive: true });
    fs.writeFileSync(path.join(d, 'shots/sub/util.mjs'), 'export const K = 1;\n');
    fs.writeFileSync(path.join(d, 'shots/helper.mjs'), "import { K } from './sub/util.mjs';\nimport '../engine/semantic.mjs';\nexport const H = K;\n");
    const A2 = path.join(d, 'shots/A2.mjs'); fs.writeFileSync(A2, "import { H } from './helper.mjs';\n" + fs.readFileSync(A2, 'utf8'));
    const a = snap(d);
    append(d, 'shots/sub/util.mjs', 'export const K2 = 2;\n'); const b = snap(d);
    ok(changed(a, b) === 'A2,A3' && a.shots.A2 !== b.shots.A2 && a.shots.A1 === b.shots.A1, `shot-indirecto: editar shots/sub/util.mjs (vía helper) invalida A2 y A3 (que importa A2), no A1 (${changed(a, b)})`);
    append(d, 'engine/semantic.mjs'); const c = snap(d);
    ok(changed(b, c) === 'A2,A3', `shot-indirecto: un módulo del motor que solo importa el shot entra en su hash (${changed(b, c)})`);
  } finally { rmrf(d); }
});

test('fuentes', () => {
  const src = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
  if (!fs.existsSync(src) || spawnSync('fc-list', ['--version']).status !== 0) return ok(true, '');   // sin fontconfig/DejaVu: omitido
  const d = copyRepo(), fd = fs.mkdtempSync(path.join(os.tmpdir(), 'opus-fonts-'));
  try {
    const font = path.join(fd, 'fonts/Probe.ttf'); fs.mkdirSync(path.dirname(font)); fs.copyFileSync(src, font);
    const conf = path.join(fd, 'fonts.conf');
    fs.writeFileSync(conf, `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${path.dirname(font)}</dir><cachedir>${path.join(fd, 'cache')}</cachedir></fontconfig>`);
    fs.mkdirSync(path.join(d, 'assets/fonts'), { recursive: true }); fs.writeFileSync(path.join(d, 'assets/fonts/own.ttf'), 'v1');
    const sig = () => node(d, "const H = await import('./engine/hash.mjs'); console.log(H.fontSig([{ family: 'DejaVu Sans', files: [{ path: 'assets/fonts/own.ttf' }] }]));", { FONTCONFIG_FILE: conf });
    const s0 = sig(); const t = new Date(Date.now() + 3600e3); fs.utimesSync(font, t, t);
    ok(sig() === s0, 'fuentes: touch de la fuente del sistema no cambia la firma');
    fs.appendFileSync(font, Buffer.from([0])); const s1 = sig();
    ok(s1 !== s0, 'fuentes: cambiar el contenido de la fuente resuelta por fontconfig cambia la firma');
    fs.writeFileSync(path.join(d, 'assets/fonts/own.ttf'), 'v2');
    ok(sig() !== s1, 'fuentes: typeface.files del proyecto por contenido');
  } finally { rmrf(d); rmrf(fd); }
});

test('mezcla', () => {
  const d = copyRepo();
  try {
    const ens = () => node(d, "const S = await import('./engine/sound.mjs'), fs = await import('node:fs'); console.log(S.ensureMix(JSON.parse(fs.readFileSync('data/timeline.json', 'utf8'))));");
    const tl = path.join(d, 'data/timeline.json'), wav = path.join(d, 'data/audio.wav');
    ok(ens() === 'true', 'mezcla: sin mezcla previa → mezcla');
    ok(ens() === 'false', 'mezcla: entradas iguales → no remezcla');
    const t = new Date(Date.now() + 3600e3); fs.utimesSync(tl, t, t);
    ok(ens() === 'false', 'mezcla: touch del timeline (más nuevo que el wav) NO remezcla');
    const st = fs.statSync(wav), b = fs.readFileSync(wav); b[b.length - 1000] ^= 0x55; fs.writeFileSync(wav, b); fs.utimesSync(wav, st.atime, st.mtime);
    ok(ens() === 'true', 'mezcla: música con contenido nuevo (mismo size+mtime) → remezcla');
    const j = JSON.parse(fs.readFileSync(tl, 'utf8')); j.autoSfx = true; fs.writeFileSync(tl, JSON.stringify(j, null, 2));
    ok(ens() === 'true', 'mezcla: timeline con contenido nuevo → remezcla');
    append(d, 'engine/sound.mjs');
    ok(ens() === 'true', 'mezcla: código de sound.mjs nuevo → remezcla');
  } finally { rmrf(d); }
});

test('render-mp4', () => {
  const d = copyRepo();
  try {
    const r = spawnSync(process.execPath, ['engine/render.mjs', '--mp4', '--review', '--max-chunks', '0'], { cwd: d, encoding: 'utf8' });
    ok(r.status === 0 && /retirado/.test(r.stdout) && /fragmentos/.test(r.stdout), 'render-mp4: --mp4 redirige a cut ' + r.stdout + r.stderr);
    ok(!fs.existsSync(path.join(d, 'out/chunks_review')) && !fs.existsSync(path.join(d, 'out/chunks')), 'render-mp4: no quedan bloques sin hash (out/chunks*)');
  } finally { rmrf(d); }
});

for (const t of T.filter((x) => !only || x.name === only)) {
  const b0 = bad, t0 = Date.now();
  try { t.fn(); } catch (e) { ok(false, `${t.name}: ${e.stack}`); }
  if (process.argv.includes('-v')) console.log(`  ${bad === b0 ? '·' : '✗'} ${t.name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
console.log(`${bad ? '✗' : '✓'} hash           ${n - bad}/${n}`); process.exit(bad ? 1 : 0);
