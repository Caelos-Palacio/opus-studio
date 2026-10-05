// Audio: lectura WAV, sonoridad (BS.1770 vía dsp.mjs), tempo (autocorrelación del flujo espectral), tonalidad (Krumhansl–Schmuckler),
// inicios y desfase AV. Entradas: Float32Array L/R a `sr`.
import fs from 'node:fs';
import { loudness, truePeak } from '../dsp.mjs';
import { mean, median, mad, quantile, pearson } from './mathx.mjs';

export function readWav(file) {                                         // PCM 16/24/32 o float32, estéreo/mono
  const b = fs.readFileSync(file); if (b.toString('ascii', 0, 4) !== 'RIFF') throw new Error('no es WAV: ' + file);
  let p = 12, fmt = null, data = null;
  while (p + 8 <= b.length) { const id = b.toString('ascii', p, p + 4), n = b.readUInt32LE(p + 4); if (id === 'fmt ') fmt = { tag: b.readUInt16LE(p + 8), ch: b.readUInt16LE(p + 10), sr: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) }; if (id === 'data') { data = b.subarray(p + 8, Math.min(b.length, p + 8 + n)); break; } p += 8 + n + (n & 1); }
  if (!fmt || !data) throw new Error('WAV sin fmt/data');
  const B = fmt.bits / 8, N = Math.floor(data.length / (B * fmt.ch)), L = new Float32Array(N), R = new Float32Array(N);
  const rd = (o) => (fmt.tag === 3 ? data.readFloatLE(o) : B === 2 ? data.readInt16LE(o) / 32768 : B === 3 ? data.readIntLE(o, 3) / 8388608 : data.readInt32LE(o) / 2147483648);
  for (let i = 0; i < N; i++) { L[i] = rd(i * B * fmt.ch); R[i] = fmt.ch > 1 ? rd(i * B * fmt.ch + B) : L[i]; }
  return { L, R, sr: fmt.sr };
}
export function loudnessOf(L, R) {                                      // dsp.loudness asume 48 kHz
  const m = loudness(L, R), tp = truePeak(L, R);
  return { I: m.I, LRA: m.LRA, TP: tp, PLR: tp - m.I, M: m.M, S: m.S };
}
const mono = (L, R) => { const x = new Float64Array(L.length); for (let i = 0; i < x.length; i++) x[i] = (L[i] + R[i]) / 2; return x; };
function fft(re, im) {                                                  // radix-2 in situ
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const u = i + k, v = u + len / 2, tr = re[v] * cr - im[v] * ci, ti = re[v] * ci + im[v] * cr; re[v] = re[u] - tr; im[v] = im[u] - ti; re[u] += tr; im[u] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } } }
}
// Flujo espectral (rectificado, log-comprimido): ventana 1024, salto 256. → { env, hop (s) }
export function onsetEnvelope(L, R, sr) {
  const x = mono(L, R), W = 1024, H = 256, win = Float64Array.from({ length: W }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / W)), n = Math.max(0, Math.floor((x.length - W) / H)), env = new Float64Array(n);
  let prev = new Float64Array(W / 2); const re = new Float64Array(W), im = new Float64Array(W);
  for (let f = 0; f < n; f++) { for (let i = 0; i < W; i++) { re[i] = x[f * H + i] * win[i]; im[i] = 0; } fft(re, im); let s = 0; const cur = new Float64Array(W / 2); for (let k = 1; k < W / 2; k++) { cur[k] = Math.log1p(100 * Math.hypot(re[k], im[k])); const d = cur[k] - prev[k]; if (d > 0) s += d; } env[f] = s; prev = cur; }
  return { env, hop: H / sr };
}
// Picos de la envolvente por encima de mediana + k·MAD, con refractario 50 ms. Tiempo del centro de la ventana (≈ inicio del evento).
export function onsets(L, R, sr, { k = 3, refractory = 0.05 } = {}) {
  const { env, hop } = onsetEnvelope(L, R, sr), th = median([...env]) + k * 1.4826 * mad([...env]) + 1e-9, out = []; let last = -1e9;
  for (let i = 1; i < env.length - 1; i++) if (env[i] > th && env[i] >= env[i - 1] && env[i] > env[i + 1]) { const t = i * hop + 512 / sr; if (t - last >= refractory) { out.push(t); last = t; } }
  return out;
}
// Tempo global: autocorrelación de la envolvente con prior log-gaussiano (Ellis 2007) centrado en 110 BPM, 60–200 BPM.
export function tempoBPM(L, R, sr, { win = 12 } = {}) {
  const { env, hop } = onsetEnvelope(L, R, sr), e = Array.from(env), m = mean(e), d = e.map((v) => Math.max(0, v - m));
  const est = (a) => { const lo = Math.round(60 / (200 * hop)), hi = Math.round(60 / (60 * hop)); let best = null; const r = [];
    for (let lag = lo - 1; lag <= hi + 1; lag++) { let s = 0; for (let i = 0; i + lag < a.length; i++) s += a[i] * a[i + lag]; r[lag] = s / Math.max(1, a.length - lag); }
    for (let lag = lo; lag <= hi; lag++) { const bpm = 60 / (lag * hop), w = Math.exp(-0.5 * (Math.log2(bpm / 110) / 1.0) ** 2), v = r[lag] * w; if (r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1] && (!best || v > best.v)) { const den = r[lag - 1] - 2 * r[lag] + r[lag + 1], off = den < 0 ? (0.5 * (r[lag - 1] - r[lag + 1])) / den : 0; best = { v, bpm: 60 / ((lag + off) * hop) }; } }
    return best; };
  const g = est(d); if (!g) return null; const wn = Math.round(win / hop), est2 = [];
  for (let s = 0; s + wn <= d.length; s += Math.round(wn / 2)) { const q = est(d.slice(s, s + wn)); if (q) est2.push(q.bpm); }
  const res = (g.bpm * g.bpm * hop) / 60, spread = est2.length >= 3 ? [quantile(est2, 0.025), quantile(est2, 0.975)] : [g.bpm - res, g.bpm + res];
  return { bpm: g.bpm, ci: [Math.min(spread[0], g.bpm - res), Math.max(spread[1], g.bpm + res)], n: est2.length, windows: est2 };
}
const KS_MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88], KS_MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
export const PITCH = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function chroma(L, R, sr, { N = 16384, step = 0.5 } = {}) {
  const x = mono(L, R), c = new Float64Array(12), re = new Float64Array(N), im = new Float64Array(N);
  for (let s = 0; s + N <= x.length; s += Math.round(step * sr)) {
    for (let i = 0; i < N; i++) { re[i] = x[s + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N)); im[i] = 0; } fft(re, im);
    for (let k = Math.ceil((100 * N) / sr); k < (2000 * N) / sr; k++) { const f = (k * sr) / N, midi = 69 + 12 * Math.log2(f / 440); c[((Math.round(midi) % 12) + 12) % 12] += Math.hypot(re[k], im[k]) ** 0.5 * Math.exp(-0.5 * ((midi - Math.round(midi)) / 0.25) ** 2); }
  }
  return c;
}
export function keyKS(L, R, sr) {
  const c = chroma(L, R, sr), cand = []; for (let r = 0; r < 12; r++) for (const [mode, P] of [['major', KS_MAJ], ['minor', KS_MIN]]) cand.push({ root: PITCH[r], mode, r: pearson(Array.from(c), P.map((_, i) => P[(i - r + 12) % 12])) });
  cand.sort((a, b) => b.r - a.r); return { root: cand[0].root, mode: cand[0].mode, r: cand[0].r, margin: cand[0].r - cand[1].r, name: `${cand[0].root} ${cand[0].mode}` };
}
// Desfase AV: para cada evento de referencia, el inicio de audio más cercano dentro de ±win. offset = t_audio − t_evento (ms; + = audio tarde).
export function syncOffsets(audioOnsets, events, { win = 0.25 } = {}) {
  const off = []; for (const e of events) { let b = null; for (const o of audioOnsets) if (Math.abs(o - e) <= win && (b === null || Math.abs(o - e) < Math.abs(b - e))) b = o; if (b !== null) off.push((b - e) * 1000); }
  return { offsets: off, n: off.length, median: off.length ? median(off) : null, mad: off.length ? mad(off) : null, matched: events.length ? off.length / events.length : 0 };
}
