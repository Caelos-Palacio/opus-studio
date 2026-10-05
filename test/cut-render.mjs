#!/usr/bin/env node
// e2e: `cut` (fragmentos con hash → concat → master.mp4) y `render` (seek directo) deben dar los MISMOS píxeles.
// Se monta el demo en una copia a 12 fps y 640×360, se extraen fotogramas del master con ffmpeg y se comparan con el render
// directo del mismo instante. Tolerancia = pérdida de compresión (x264 crf16 + yuv420p). Control: contra un fotograma
// equivocado la distancia debe ser muy superior (si no, el test no discrimina).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT, FONTS_CONF, copyRepo, rmrf, run } from './lib.mjs';

const FPS = 12, W = 640, H = 360, FRAMES = [3, 18, 30, 47, 66], WRONG = 6;       // WRONG: desfase (fotogramas) del control
const [TOL_MEAN, TOL_BLOCK] = (process.env.OPUS_CUT_TOL ?? '2,8').split(',').map(Number);   // Δ medio / peor bloque (0–255)

async function worker(root) {                                                    // render directo → rgb24 en base64 por fotograma
  const { makeRenderer } = await import(pathToFileURL(path.join(root, 'engine/render.mjs')).href);
  const R = await makeRenderer({ size: `${W}x${H}` }), out = {};
  for (const f of process.argv[4].split(',').map(Number)) {
    R.frame(Math.min(R.film.duration, f / FPS)); const d = R.ctx.getImageData(0, 0, W, H).data, b = Buffer.alloc(W * H * 3);
    for (let i = 0; i < W * H; i++) { b[i * 3] = d[i * 4]; b[i * 3 + 1] = d[i * 4 + 1]; b[i * 3 + 2] = d[i * 4 + 2]; }
    out[f] = b.toString('base64');
  }
  process.stdout.write(JSON.stringify(out));
}

// Decodifica fotogramas concretos a rgb24 respetando la matriz etiquetada del vídeo (como un reproductor).
function decode(mp4, frames) {
  const sel = frames.map((f) => `eq(n\\,${f})`).join('+');
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', mp4, '-vf', `select='${sel}'`, '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { maxBuffer: 1 << 28 });
  if (r.status) throw new Error('ffmpeg: ' + r.stderr);
  const n = W * H * 3; if (r.stdout.length !== n * frames.length) throw new Error(`ffmpeg devolvió ${r.stdout.length / n} fotogramas de ${frames.length}`);
  return Object.fromEntries(frames.map((f, i) => [f, r.stdout.subarray(i * n, (i + 1) * n)]));
}
// Δmedia global + peor bloque 20×20 (Δ medio del bloque): la compresión reparte error pequeño; un cambio real se concentra.
const dist = (a, b) => {
  if (a.length !== b.length) return { mean: Infinity, block: Infinity, bias: [] };
  let s = 0, block = 0; const bias = [0, 0, 0], B = 20;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += Math.abs(d); bias[i % 3] += d; }
  for (let by = 0; by < H; by += B) for (let bx = 0; bx < W; bx += B) { let t = 0; for (let y = by; y < by + B; y++) for (let x = bx; x < bx + B; x++) for (let c = 0; c < 3; c++) { const k = (y * W + x) * 3 + c; t += Math.abs(a[k] - b[k]); } block = Math.max(block, t / (B * B * 3)); }
  return { mean: s / a.length, block, bias: bias.map((v) => v / (a.length / 3)) };
};

async function main() {
  const d = copyRepo(), env = { FONTCONFIG_FILE: FONTS_CONF };
  try {
    const c = await run(['engine/cut.mjs', '--fps', String(FPS), '--size', `${W}x${H}`, '--workers', '2'], { cwd: d, env });
    const master = path.join(d, 'out/master.mp4'), man = path.join(d, 'out/fragments/main/manifest.json');
    if (c.status || !fs.existsSync(master) || !fs.existsSync(man)) throw new Error('cut falló: ' + (c.stderr || c.stdout).slice(-600));
    const M = JSON.parse(fs.readFileSync(man, 'utf8'));
    const need = [...new Set([...FRAMES, ...FRAMES.map((f) => (f + WRONG) % M.frames)])].sort((a, b) => a - b);
    const r = await run([path.join(ROOT, 'test/cut-render.mjs'), '--worker', d, need.join(',')], { cwd: d, env });
    if (r.status) throw new Error('render falló: ' + r.stderr.slice(-600));
    const R = Object.fromEntries(Object.entries(JSON.parse(r.stdout)).map(([k, v]) => [k, Buffer.from(v, 'base64')])), V = decode(master, FRAMES);
    // un fragmento suelto también (sin concat): su primer fotograma es M.fragments[i].a en el film
    const fr = M.fragments[Math.min(1, M.fragments.length - 1)], F0 = decode(path.join(d, fr.file), [0])[0];
    const rows = FRAMES.map((f) => ({ f, ok: dist(V[f], R[f]), wrong: dist(V[f], R[(f + WRONG) % M.frames]) }));
    rows.push({ f: `${fr.id}[0]=${fr.a}`, ok: dist(F0, R[fr.a] ?? Buffer.alloc(0)), wrong: null });
    const worst = (k) => Math.max(...rows.map((x) => x.ok[k])), ctl = Math.min(...rows.filter((x) => x.wrong).map((x) => x.wrong.block));
    const ok = worst('mean') <= TOL_MEAN && worst('block') <= TOL_BLOCK && ctl > 3 * worst('block');
    console.log(`${ok ? '✓' : '✗'} cut=render       ${FRAMES.length} fotogramas del master + 1 de fragmento: Δmedia ≤ ${worst('mean').toFixed(2)}, peor bloque ${worst('block').toFixed(2)} (tol ${TOL_MEAN}/${TOL_BLOCK}) · control ${ctl.toFixed(1)}`);
    if (!ok || process.env.OPUS_VERBOSE) for (const x of rows) console.log(`   ${String(x.f).padEnd(12)} Δmedia ${x.ok.mean.toFixed(3)} bloque ${x.ok.block.toFixed(2)} sesgo RGB ${x.ok.bias.map((v) => v.toFixed(2)).join('/')}   control bloque ${x.wrong ? x.wrong.block.toFixed(2) : '-'}`);
    process.exitCode = ok ? 0 : 1;
  } catch (e) { console.log(`✗ cut=render       ${e.message}`); process.exitCode = 1; }
  finally { rmrf(d); }
}

if (process.argv[2] === '--worker') await worker(process.argv[3]);
else await main();
