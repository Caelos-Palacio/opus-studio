#!/usr/bin/env node
// R0 — Perfil del motor: ms por fotograma desglosado y top-10 shots / fx más caros.
//   node engine/profile.mjs [--timeline data/timeline.json] [--fixture test/fixtures/showcase] [--frames 120] [--size WxH] [--md out.md] [--no-encode]
// Muestrea N fotogramas repartidos por shot (≥2 por shot, proporcional a su duración) y mide tiempo EXCLUSIVO por categoría:
//   shot (código del shot + cairo/pango), tex, fx.* (blur/bloom/chroma/displace/warp/layer), grade.post, grade.color,
//   px.read/px.write (getImageData/putImageData), draw.image (drawImage nativo), encode (toBuffer raw + x264 medido con ffmpeg -benchmark).
// Instrumentación = engine/perf.mjs (apagada por defecto). Con --fixture se perfila una copia temporal del repo con el fixture.
import './help.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { announceFilm } from './filmid.mjs';
import { fileURLToPath } from 'node:url';

const hr = process.hrtime.bigint.bind(process.hrtime);
const argv = process.argv.slice(2), has = (k) => argv.includes(k), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function worker() {
  const { perf, enter, leave, reset } = await import('./perf.mjs');
  const { default: canvas } = await import('canvas');
  const { makeRenderer } = await import('./render.mjs');
  const proto = canvas.CanvasRenderingContext2D.prototype;
  for (const [m, cat] of [['getImageData', 'px.read'], ['putImageData', 'px.write'], ['drawImage', 'draw']]) {   // se atribuyen al padre: fx.blur+draw, grade.post+px.read…
    const orig = proto[m]; proto[m] = function (...a) { if (!perf.on) return orig.apply(this, a); enter(`${perf.stack[perf.stack.length - 1] ?? 'seek'}+${cat}`); try { return orig.apply(this, a); } finally { leave(); } };
  }
  const R = await makeRenderer({ size: arg('--size') }), { film, W, H, cv } = R, fps = film.fps, N = +arg('--frames', 120), last = Math.round(film.duration * fps);
  // muestreo: ≥2 fotogramas por shot, proporcional a su duración
  const picks = [], total = film.shots.reduce((a, s) => a + (s.t[1] - s.t[0]), 0);
  for (const s of film.shots) {
    const f0 = Math.round(s.t[0] * fps), f1 = Math.max(f0, Math.round(s.t[1] * fps) - 1), n = Math.max(2, Math.round((N * (s.t[1] - s.t[0])) / total));
    for (let i = 0; i < n; i++) picks.push([s.id, Math.min(last, Math.round(f0 + ((f1 - f0) * (i + 0.5)) / n))]);
  }
  R.frame(0);                                                                // calentamiento (fuentes, caché TeX, LUTs)
  reset(); perf.on = true;
  const per = {}, raw = [], t0 = hr(), frameMs = [];
  for (const [id, f] of picks) {
    const a = hr(); R.frame(Math.min(film.duration, f / fps));
    enter('encode'); const b = cv.toBuffer('raw'); leave(); if (raw.length < 24) raw.push(b);
    const ms = Number(hr() - a) / 1e6; frameMs.push(ms);
    (per[id] ??= { n: 0, ms: 0 }); per[id].n++; per[id].ms += ms;
  }
  perf.on = false;
  const wall = Number(hr() - t0) / 1e6, n = picks.length;
  // x264 (medium, crf 16) sobre los fotogramas crudos capturados, CPU medida con ffmpeg -benchmark (utime+stime)
  let enc = null;
  if (!has('--no-encode') && raw.length) {
    const tmp = path.join(os.tmpdir(), `opus-prof-${process.pid}.raw`); fs.writeFileSync(tmp, Buffer.concat([...raw, ...raw]));
    const r = spawnSync('ffmpeg', ['-benchmark', '-hide_banner', '-loglevel', 'info', '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', `${W}x${H}`, '-r', String(fps), '-i', tmp, '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-f', 'null', '-'], { encoding: 'utf8' });
    fs.rmSync(tmp, { force: true }); const m = /utime=([\d.]+)s stime=([\d.]+)s/.exec(r.stderr); if (m) enc = ((+m[1] + +m[2]) * 1000) / (raw.length * 2);
  }
  const acc = perf.acc, sum = Object.values(acc).reduce((a, b) => a + b, 0), cats = { ...acc, other: Math.max(0, wall - sum) };
  const shots = Object.entries(per).map(([id, v]) => { const s = film.shots.find((x) => x.id === id), fr = Math.round((s.t[1] - s.t[0]) * fps), by = perf.shots[id] ?? {};
    return { id, n: v.n, ms: v.ms / v.n, frames: fr, est_s: (v.ms / v.n * fr) / 1000, top: Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, x]) => `${k} ${(x / v.n).toFixed(1)}`).join(', ') }; }).sort((a, b) => b.est_s - a.est_s);
  frameMs.sort((a, b) => a - b);
  process.stdout.write(JSON.stringify({ film: path.basename(film.timelinePath), title: film.title, size: [W, H], fps, frames: last + 1, sampled: n, mean_ms: wall / n, p50: frameMs[n >> 1], p95: frameMs[Math.floor(n * 0.95)], enc_ms: enc,
    cats: Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, v / n])), shots }));
}

const fmt = (D) => {
  const c = D.cats, tot = D.mean_ms, rows = Object.entries(c).sort((a, b) => b[1] - a[1]);
  let o = `### ${D.film} — ${D.size.join('×')} @${D.fps}, ${D.frames} fotogramas, ${D.sampled} muestreados\n`;
  o += `media ${D.mean_ms.toFixed(1)} ms/fotograma (p50 ${D.p50.toFixed(1)}, p95 ${D.p95.toFixed(1)})` + (D.enc_ms != null ? ` · x264 medium crf16: ${D.enc_ms.toFixed(1)} ms CPU/fotograma (proceso aparte)` : '') + `\n\n`;
  o += `| categoría | ms/fotograma | % |\n|---|---:|---:|\n` + rows.map(([k, v]) => `| ${k} | ${v.toFixed(2)} | ${((100 * v) / tot).toFixed(1)} |`).join('\n') + '\n\n';
  o += `Top-10 shots por coste estimado (ms medio × fotogramas)\n\n| shot | ms/fotograma | fotogramas | est. s | dominantes (ms/fotograma) |\n|---|---:|---:|---:|---|\n` + D.shots.slice(0, 10).map((s) => `| ${s.id} | ${s.ms.toFixed(1)} | ${s.frames} | ${s.est_s.toFixed(1)} | ${s.top} |`).join('\n') + '\n\n';
  const fx = rows.filter(([k]) => /^(fx|grade|tex|seek|shot\+)/.test(k)).slice(0, 10);
  o += `Top fx / operaciones (ms/fotograma, exclusivo)\n\n` + fx.map(([k, v]) => `- ${k}: ${v.toFixed(2)}`).join('\n') + '\n\n';
  const fam = {}; for (const [k, v] of rows) { const f = k.split(/[.+]/)[0]; fam[f] = (fam[f] ?? 0) + v; }
  o += `Por familia (incluye sus lecturas de píxeles y drawImage): ` + Object.entries(fam).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(1)} ms (${((100 * v) / tot).toFixed(0)} %)`).join(' · ') + '\n';
  return o;
};

async function main() {
  const tl = arg('--timeline'), fx = arg('--fixture');
  let cwd = HERE, tmp = null, env = { ...process.env };
  if (fx) {
    const { copyRepo } = await import(path.join(HERE, 'test/lib.mjs')); tmp = copyRepo({ fixture: path.resolve(fx), name: 'fixture' });
    fs.copyFileSync(path.join(HERE, 'engine/perf.mjs'), path.join(tmp, 'engine/perf.mjs')); cwd = tmp; env.OPUS_TIMELINE = 'data/fixture.json';
    const a = spawnSync(process.execPath, ['engine/autocam.mjs'], { cwd, env, encoding: 'utf8' }); if (a.status) { console.error(a.stderr.slice(-400)); process.exit(1); }
  } else { if (tl) process.env.OPUS_TIMELINE = env.OPUS_TIMELINE = tl; announceFilm(); }
  if (has('--fx-fast')) env.OPUS_FXFAST = '1';
  env.FONTCONFIG_FILE ??= path.join(HERE, 'test/golden/fonts.conf');
  const wargs = ['engine/profile.mjs', '--worker', ...argv.filter((a, i) => !['--timeline', '--fixture', '--md'].includes(a) && !['--timeline', '--fixture', '--md'].includes(argv[i - 1]))];
  const r = spawnSync(process.execPath, [path.join(cwd, 'engine/profile.mjs'), ...wargs.slice(1)], { cwd, env, encoding: 'utf8', maxBuffer: 1 << 28 });
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  if (r.status) { console.error(r.stderr.slice(-800)); process.exit(1); }
  const D = JSON.parse(r.stdout.slice(r.stdout.indexOf('{'))); D.film = fx ? 'fixture showcase' : D.film;
  const md = fmt(D); console.log(md); if (arg('--md')) fs.appendFileSync(arg('--md'), md + '\n'); if (has('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(D));
}
if (has('--worker')) worker().catch((e) => { console.error(e); process.exit(1); }); else main();
