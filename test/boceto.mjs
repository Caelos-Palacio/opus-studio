#!/usr/bin/env node
// Spec 019 (boceto + preview en vivo): BDD B1–B6 sobre una copia del repo (demo de 6 s).
//   node test/boceto.mjs            tests
//   node test/boceto.mjs --worker <boceto|completo>   (interno) renderiza 24 fotogramas y devuelve ms y tamaño medio del PNG
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { FONTS_CONF, copyRepo, rmrf, run } from './lib.mjs';

const argv = process.argv.slice(2);
if (argv[0] === '--worker') {
  if (argv[1] === 'boceto') { process.env.OPUS_BOCETO = '1'; process.env.OPUS_FXFAST = '1'; }
  const { makeRenderer } = await import(pathToFileURL(path.join(process.cwd(), 'engine/render.mjs')).href), { bocetoSize } = await import(pathToFileURL(path.join(process.cwd(), 'engine/boceto.mjs')).href);
  const f0 = await makeRenderer({ size: '64x36' }), [W, H] = argv[1] === 'boceto' ? bocetoSize(f0.film.width, f0.film.height) : [f0.film.width, f0.film.height];
  const R = await makeRenderer({ size: `${W}x${H}` }); R.frame(0.1);
  const t0 = performance.now(); let bytes = 0;
  for (let i = 0; i < 24; i++) { R.frame(0.2 + i * 0.25); bytes += R.cv.toBuffer('raw').length; }
  process.stdout.write(JSON.stringify({ ms: performance.now() - t0, W, H, bytes, grain: R.film.S.grade.grain, boceto: !!R.film.P.boceto }));
  process.exit(0);
}

let n = 0, bad = 0;
const ok = (m, c, info = '') => { n++; console.log(`${c ? '✓' : '✗'} boceto: ${m}${info ? '  ' + info : ''}`); if (!c) bad++; };
const d = copyRepo(), env = { FONTCONFIG_FILE: FONTS_CONF, OPUS_LAYERS: 'none' };
const sha = (b) => crypto.createHash('sha1').update(b).digest('hex');
const framemd5 = (f) => spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-f', 'framemd5', '-'], { encoding: 'utf8' }).stdout.split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split(',').pop().trim()).join('|');
const probe = (f) => JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,nb_frames', '-of', 'json', f], { encoding: 'utf8' }).stdout).streams[0];
const get = (port, p, { method = 'GET', headers = {} } = {}) => new Promise((res, rej) => {
  const r = http.request({ host: '127.0.0.1', port, path: p, method, headers }, (x) => { const c = []; x.on('data', (b) => c.push(b)); x.on('end', () => res({ status: x.statusCode, headers: x.headers, body: Buffer.concat(c) })); });
  r.on('error', rej); r.end();
});
let srv = null;
try {
  // ── B1 boceto determinista ──
  const b1 = await run(['engine/opus.mjs', 'boceto', '--desde', '0', '--hasta', '3', '--workers', '2'], { cwd: d, env });
  const mp4 = path.join(d, 'out/boceto/main.mp4'), jpg = path.join(d, 'out/boceto/main.jpg'), st = () => JSON.parse(fs.readFileSync(path.join(d, 'out/boceto/main.json'), 'utf8'));
  ok('B1 produce mp4 + hoja de contacto + medidas', b1.status === 0 && fs.existsSync(mp4) && fs.existsSync(jpg) && fs.existsSync(path.join(d, 'out/boceto/main.json')), b1.stderr.slice(-300));
  const h1 = framemd5(mp4), s1 = st();
  rmrf(path.join(d, 'out/boceto/fragments'));
  const b1b = await run(['engine/opus.mjs', 'boceto', '--desde', '0', '--hasta', '3', '--workers', '3'], { cwd: d, env });
  ok('B1 determinista: dos renders en frío (distinto nº de workers) dan los mismos fotogramas', b1b.status === 0 && h1 && h1 === framemd5(mp4));
  const b1c = await run(['engine/opus.mjs', 'boceto', '--desde', '0', '--hasta', '3'], { cwd: d, env });
  ok('B1 repetir con la caché de fragmentos no renderiza nada', b1c.status === 0 && st().enCache === st().fragmentos && /0 por renderizar/.test(b1c.stdout));
  const pr = probe(mp4);
  ok('B1 ¼ de resolución lineal a 12 fps, 36 fotogramas', pr.width === 320 && pr.height === 180 && pr.r_frame_rate === '12/1' && s1.frames === 36, `${pr.width}x${pr.height} ${pr.r_frame_rate} ${s1.frames}f`);
  ok('B1 sin audio si no hay mezcla en caché', s1.audio === 'ninguno');

  // ── B2 menor y más rápido que el completo ──
  const wk = (m) => run([path.join(d, 'test/boceto.mjs'), '--worker', m], { cwd: d, env }).catch(() => null);
  fs.mkdirSync(path.join(d, 'test'), { recursive: true }); fs.copyFileSync(new URL(import.meta.url), path.join(d, 'test/boceto.mjs'));
  fs.copyFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'lib.mjs'), path.join(d, 'test/lib.mjs'));
  const rb = await wk('boceto'), rc = await wk('completo');
  let B = null, C = null; try { B = JSON.parse(rb.stdout); C = JSON.parse(rc.stdout); } catch {}
  ok('B2 la degradación está activa (grano 0, film.P.boceto) y solo en boceto', !!B && B.boceto && B.grain === 0 && C && !C.boceto);
  ok('B2 menor: ≤ ¼ de los píxeles del completo', !!B && B.bytes * 12 <= C.bytes, B ? `${B.W}x${B.H} vs ${C.W}x${C.H}` : '');
  ok('B2 más rápido: 24 fotogramas de boceto cuestan menos que los del completo', !!B && B.ms < C.ms, B ? `${B.ms.toFixed(0)} ms vs ${C.ms.toFixed(0)} ms` : '');

  // ── B3 error de esquema = única barrera; sin gates ──
  const tl = JSON.parse(fs.readFileSync(path.join(d, 'data/timeline.json'), 'utf8'));
  fs.writeFileSync(path.join(d, 'data/malo.json'), JSON.stringify({ ...tl, fps: 'rápido' }));
  const b3 = await run(['engine/boceto.mjs', '--timeline', 'data/malo.json'], { cwd: d, env });
  ok('B3 un timeline que viola el esquema falla con exit ≠ 0', b3.status !== 0 && /✗/.test(b3.stderr));
  ok('B3 el boceto no exige gates (sin SHIP ni crítico en esta copia)', b1.status === 0 && !fs.existsSync(path.join(d, 'out/lint.json')));

  // ── servidor ──
  const arranque = () => new Promise((res, rej) => {
    const p = spawn(process.execPath, ['engine/opus.mjs', 'preview', '--port', '0'], { cwd: d, env: { ...process.env, ...env } });
    let out = ''; const k = setTimeout(() => rej(new Error('preview no arrancó: ' + out)), 120000);
    p.stdout.on('data', (b) => { out += b; const m = /http:\/\/127\.0\.0\.1:(\d+)\//.exec(out); if (m) { clearTimeout(k); res({ p, port: +m[1] }); } });
    p.on('exit', () => rej(new Error('preview terminó: ' + out)));
  });
  srv = await arranque();
  const info = JSON.parse((await get(srv.port, '/info')).body);
  ok('B4 sirve /info del film con duración y shots', info.duration === 6 && info.shots.length === 3 && info.error === null);
  // direcciones de escucha del puerto: `ss` (Linux; columna «dirección local») o `lsof` (macOS no trae ss; salida -F: líneas «n<dir>:<puerto>»)
  const ss = spawnSync('ss', ['-ltnH', `sport = :${srv.port}`], { encoding: 'utf8' });
  const ln = (ss.error ? spawnSync('lsof', ['-nP', `-iTCP:${srv.port}`, '-sTCP:LISTEN', '-Fn'], { encoding: 'utf8' }).stdout.split('\n').filter((l) => l.startsWith('n')).map((l) => l.slice(1))
    : ss.stdout.trim().split('\n').map((l) => l.trim().split(/\s+/)[3])).filter(Boolean);
  ok('B4 solo escucha en 127.0.0.1 (no 0.0.0.0, no otras interfaces)', ln.length > 0 && ln.every((a) => a === `127.0.0.1:${srv.port}`), ln.join(' '));
  const ext = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal);
  if (ext) { const rechazo = await new Promise((r) => { const s = net.connect(srv.port, ext.address); s.on('connect', () => { s.destroy(); r(false); }); s.on('error', () => r(true)); setTimeout(() => r(true), 3000); }); ok(`B4 la IP de red ${ext.address} rechaza la conexión`, rechazo); }
  ok('B4 Host ajeno a loopback → 403 (DNS rebinding)', (await get(srv.port, '/info', { headers: { Host: 'evil.example' } })).status === 403);
  ok('B4 POST → 405; nada ejecutable llega por la red', (await get(srv.port, '/frame?t=1', { method: 'POST' })).status === 405);
  ok('B4 t no numérico o escala fuera de lista → 400', (await get(srv.port, '/frame?t=abc')).status === 400 && (await get(srv.port, '/frame?t=1&s=9')).status === 400);

  // ── B5 recarga e invalidación por hash ──
  const T_A3 = 5.0, T_A1 = 0.5, fr = async (t) => get(srv.port, `/frame?t=${t}`);
  const a3 = await fr(T_A3), a1 = await fr(T_A1), a3b = await fr(T_A3);
  ok('B5 el fotograma sale en JPEG y el segundo pedido del mismo t es de caché', a3.status === 200 && a3.headers['content-type'] === 'image/jpeg' && a3b.headers['x-cache'] === 'hit' && sha(a3.body) === sha(a3b.body));
  const scene = path.join(d, 'shots/A3.scene.json'), v0 = info.version;
  { const J = JSON.parse(fs.readFileSync(scene, 'utf8')); J.objects.unshift({ type: 'shape', shape: 'circle', x: { $expr: 'S_cx' }, y: { $expr: 'S_cy' }, r: 90, color: 'accent' }); fs.writeFileSync(scene, JSON.stringify(J, null, 1)); }
  let v1 = v0; for (let i = 0; i < 100 && v1 === v0; i++) { await new Promise((r) => setTimeout(r, 300)); v1 = JSON.parse((await get(srv.port, '/info')).body).version; }
  ok('B5 guardar un .scene.json recompila el DSL y recarga (fs.watch)', v1 > v0, `v${v0} → v${v1}`);
  const a3n = await fr(T_A3), a1n = await fr(T_A1);
  ok('B5 el fotograma del shot editado cambia', sha(a3n.body) !== sha(a3.body));
  ok('B5 el de un shot intacto no cambia y sigue en la caché (invalidación por hash, no total)', sha(a1n.body) === sha(a1.body) && a1n.headers['x-cache'] === 'hit', a1n.headers['x-cache']);
  fs.writeFileSync(scene, fs.readFileSync(scene, 'utf8').replace('"type": "color"', '"type": "colour"'));   // esquema roto
  let inf = null; for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 300)); inf = JSON.parse((await get(srv.port, '/info')).body); if (inf.error) break; }
  ok('B5 un error de esquema se informa y se conserva el último render bueno', !!inf.error && (await fr(T_A1)).status === 200, (inf.error ?? '').slice(0, 80));

  // ── B6 path traversal ──
  fs.symlinkSync(path.join(d, 'package.json'), path.join(d, 'shots/fuga.json'));
  const malos = ['/f/../package.json', '/f/%2e%2e/package.json', '/f/..%2fpackage.json', '/f/%2e%2e%2f%2e%2e%2fetc/passwd', '/f//etc/passwd', '/f/..\\package.json', '/f/%5c..%5cpackage.json', '/f/A3.scene.json%00.png', '/f/.env.json', '/f/fuga.json', '/f/A3.scene.mjs', '/f/A1.mjs', '/engine/boceto.mjs', '/package.json', '/../package.json'];
  const res = []; for (const p of malos) { const r = await get(srv.port, p); res.push([p, r.status, r.body.toString().includes('"name": "opus')]); }
  ok('B6 traversal, NUL, \\, dotfiles, symlink de escape y extensiones no permitidas → 4xx sin contenido', res.every(([, s, leak]) => s >= 400 && s < 500 && !leak), res.filter(([, s, l]) => !(s >= 400 && s < 500) || l).map((x) => x[0]).join(' '));
  ok('B6 lo legítimo sí se sirve (/f/A3.scene.json, solo lectura)', (await get(srv.port, '/f/A3.scene.json')).status === 200);
} catch (e) { ok('la suite no debe lanzar', false, String(e.stack ?? e).slice(0, 400)); }
finally { srv?.p.kill('SIGKILL'); rmrf(d); }
console.log(bad ? `\n${bad} fallos de ${n}` : `\n${n} comprobaciones ✓`);
process.exit(bad ? 1 : 0);
