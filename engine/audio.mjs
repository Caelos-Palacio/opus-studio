#!/usr/bin/env node
// El audio es el reloj.
//   node engine/audio.mjs --analyze data/track.wav   → data/audio.json {bpm, offset, onsets, silences}  (film con carpeta: data/<film>/audio.json; --out X)
//   audio.json también admite `beats: [t…]` (rejilla explícita, p. ej. de engine/grid.mjs: tempo variable), `grid: [t…]` (subdivisiones donde se puede cortar)
//   y `tracks: {kick:[t…], …}` (señal audio con `track`).
//   node engine/audio.mjs --click [--bpm 120] [--duration 15] → data/audio.wav + data/audio.json
//   node engine/audio.mjs --cues                      → sintetiza data/audio.wav desde timeline.cues (explainer)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, timelinePath } from './film.mjs';
import { sibling } from './filmid.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SR = 22050;

function writeWav(file, f32, sr) {
  const pcm = Buffer.alloc(f32.length * 2);
  let peak = 0; for (const v of f32) peak = Math.max(peak, Math.abs(v));
  const g = peak > 0.95 ? 0.95 / peak : 1;
  f32.forEach((v, i) => pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * g)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, pcm]));
}
function tone(buf, sr, t0, f, dur, gain, type = 'sine') {
  const s = Math.floor(t0 * sr);
  for (let i = 0; i < dur * sr; i++) {
    const t = i / sr, env = t < 0.01 ? t / 0.01 : Math.exp(-(t - 0.01) * (6 / dur));
    const ph = 2 * Math.PI * f * t, w = type === 'tri' ? (2 / Math.PI) * Math.asin(Math.sin(ph)) : Math.sin(ph);
    if (s + i < buf.length) buf[s + i] += gain * env * w;
  }
}

function analyze(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', 'pipe:1'], { maxBuffer: 2 ** 30 });
  if (r.status !== 0) throw new Error('ffmpeg no pudo decodificar ' + file);
  const x = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4);
  const hop = 512, n = Math.floor(x.length / hop), env = new Float32Array(n), rms = new Float32Array(n);
  let prevE = 0;
  for (let i = 0; i < n; i++) {
    let e = 0; for (let k = 0; k < hop; k++) e += x[i * hop + k] ** 2;
    rms[i] = Math.sqrt(e / hop); const le = Math.log1p(1000 * e);
    env[i] = Math.max(0, le - prevE); prevE = le;
  }
  // suavizado [1,2,1]/4: los picos de 1 frame no deben depender del redondeo del lag
  const sm = env.map((v, i) => 0.25 * (env[i - 1] ?? 0) + 0.5 * v + 0.25 * (env[i + 1] ?? 0));
  const fr = SR / hop;
  let best = { bpm: 120, score: -1 };
  for (let bpm = 60; bpm <= 200; bpm += 0.5) {
    const lag = (60 / bpm) * fr; let s = 0;
    for (let i = 0; Math.round(i + lag) < n; i++) s += sm[i] * sm[Math.round(i + lag)];
    s /= n - lag; s *= Math.exp(-0.5 * Math.log2(bpm / 120) ** 2); // prior log-normal: evita errores de octava
    if (s > best.score) best = { bpm, score: s };
  }
  const P = (60 / best.bpm) * fr; let off = 0, offS = -1;
  for (let o = 0; o < P; o++) { let s = 0; for (let i = o; Math.round(i) < n; i += P) s += sm[Math.round(i)]; if (s > offS) { offS = s; off = o; } }
  const mean = env.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(env.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const onsets = []; for (let i = 1; i < n - 1; i++) if (env[i] > mean + 2 * sd && env[i] >= env[i - 1] && env[i] >= env[i + 1]) onsets.push(+(i / fr).toFixed(3));
  // refinamiento fino: regresión lineal de los onsets sobre la rejilla de beats (robusta a outliers)
  let T = 60 / best.bpm, o0 = +(off / fr);
  for (let it = 0; it < 3; it++) {
    const pts = onsets.map((o) => [Math.round((o - o0) / T), o]).filter(([k, o]) => Math.abs(o - (o0 + k * T)) < 0.25 * T);
    if (pts.length < 4) break;
    const m = pts.length, sk = pts.reduce((a, p) => a + p[0], 0), so = pts.reduce((a, p) => a + p[1], 0), skk = pts.reduce((a, p) => a + p[0] * p[0], 0), sko = pts.reduce((a, p) => a + p[0] * p[1], 0);
    T = (m * sko - sk * so) / (m * skk - sk * sk); o0 = (so - T * sk) / m;
  }
  o0 = ((o0 % T) + T) % T; if (o0 > T / 2) o0 -= T; // offset en (−T/2, T/2]
  best.bpm = +(60 / T).toFixed(2); off = o0 * fr;
  const silences = []; let st = -1; const thr = 0.01;
  for (let i = 0; i <= n; i++) { const q = i < n && rms[i] < thr; if (q && st < 0) st = i; if (!q && st >= 0) { if ((i - st) / fr >= 1.0) silences.push([+(st / fr).toFixed(2), +(i / fr).toFixed(2)]); st = -1; } }
  return { bpm: best.bpm, offset: +(off / fr).toFixed(3), onsets, silences, source: path.relative(ROOT, file), rms: { hop: +(hop / SR).toFixed(6), values: Array.from(rms, (v) => +v.toFixed(4)) } };   // rms: señal audio/rms (docs/PARAMS.md)
}

export const audioJsonPath = () => path.resolve(ROOT, arg('--out', sibling('audio.json', 'data/audio.json', timelinePath())));
const out = (o) => { fs.writeFileSync(audioJsonPath(), JSON.stringify(o, null, 2)); console.log('→', path.relative(ROOT, audioJsonPath()), `bpm ${o.bpm}, offset ${o.offset}s, ${o.onsets?.length ?? 0} onsets, ${o.silences.length} silencios`); };

export { analyze };
const MAIN = import.meta.url === `file://${process.argv[1]}`;
if (!MAIN) { /* importado como módulo: sin CLI */ }
else if (argv.includes('--analyze')) out(analyze(path.resolve(arg('--analyze'))));
else if (argv.includes('--click')) {
  const tl = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/timeline.json'), 'utf8'));
  const bpm = +arg('--bpm', tl.bpm || 120), dur = +arg('--duration', tl.duration), sr = 48000, buf = new Float32Array(Math.ceil((dur + 1) * sr));
  let i = 0; for (let t = 0; t < dur; t += 60 / bpm, i++) tone(buf, sr, t, i % 4 === 0 ? 1760 : 1320, 0.05, i % 4 === 0 ? 0.5 : 0.3);
  writeWav(path.join(ROOT, 'data/audio.wav'), buf, sr);
  out({ bpm, offset: 0, onsets: [], silences: [], source: 'click' });
} else if (argv.includes('--cues')) {
  const tl = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/timeline.json'), 'utf8'));
  const sr = 48000, buf = new Float32Array(Math.ceil((tl.duration + 3) * sr));
  const S = { rev: (t) => { tone(buf, sr, t, 392, 2.6, 0.05); tone(buf, sr, t + 0.12, 587.3, 2.8, 0.035); tone(buf, sr, t + 0.24, 784, 2.4, 0.016); },
    anom: (t) => { tone(buf, sr, t, 146.8, 2.2, 0.045, 'tri'); tone(buf, sr, t, 155.6, 2.2, 0.035, 'tri'); }, tick: (t) => tone(buf, sr, t, 1320, 0.12, 0.018) };
  const cues = tl.shots.flatMap((s) => (s.cues ?? []).map((c) => [s.t[0] + c.at, c.type]));
  for (const [t, k] of cues) S[k]?.(t);
  writeWav(path.join(ROOT, 'data/audio.wav'), buf, sr);
  console.log(`→ data/audio.wav (${cues.length} cues)`);
} else console.log('Uso: ver cabecera de engine/audio.mjs');
