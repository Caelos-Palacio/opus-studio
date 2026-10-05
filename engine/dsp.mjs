// Núcleo DSP del soundtrack (Node puro, determinista, sin dependencias): utilidades, filtros, reverb, sonoridad BS.1770 y WAV.
// Lo comparten score.mjs (música), sounddesign.mjs (sfx/ambientes) y mixer.mjs (buses y master).
export { rng, hashStr } from './core.mjs';
export const SR = 48000, TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, u) => a + (b - a) * clamp(u);
export const ramp = (t, t0, t1, a, b, pow = 1) => lerp(a, b, clamp((t - t0) / (t1 - t0)) ** pow);
export const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
export const db2lin = (d) => 10 ** (d / 20);
export const lin2db = (x) => 20 * Math.log10(Math.max(x, 1e-12));
export const stereo = (n) => ({ L: new Float32Array(n), R: new Float32Array(n) });
export const panGains = (p) => { const a = ((clamp(p, -1, 1) + 1) * Math.PI) / 4; return [Math.cos(a), Math.sin(a)]; };

// ── biquads RBJ ─────────────────────────────────────────────────────────────────────────────────────────────────────
export function bq(type, f, q = Math.SQRT1_2, gainDb = 0) {
  const w = (TAU * f) / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q), A = 10 ** (gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
  else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
  else if (type === 'peak') { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; }
  else throw new Error('biquad desconocido ' + type);
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
export function filt(x, c, out = new Float32Array(x.length)) {
  const [b0, b1, b2, a1, a2] = c; let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; out[i] = v; }
  return out;
}
export const lp4 = (x, f) => filt(filt(x, bq('lp', f)), bq('lp', f));   // 24 dB/oct
// Tres bandas que suman EXACTAMENTE la señal: graves | medios | agudos.
export function split3(x, f1 = 250, f2 = 2500) {
  const lo = lp4(x, f1), rest = new Float32Array(x.length); for (let i = 0; i < x.length; i++) rest[i] = x[i] - lo[i];
  const mid = lp4(rest, f2), hi = new Float32Array(x.length); for (let i = 0; i < x.length; i++) hi[i] = rest[i] - mid[i];
  return [lo, mid, hi];
}

// ── reverb (Schroeder estéreo) ──────────────────────────────────────────────────────────────────────────────────────
const DL = [1687, 1801, 2053, 2251, 2399, 2551], DR = [1733, 1873, 2087, 2207, 2441, 2609];
export function reverb(inp, side, { fb = 0.86, damp = 0.35 } = {}) {
  const N = inp.length, out = new Float32Array(N);
  for (const d of side === 'L' ? DL : DR) {
    const buf = new Float32Array(d); let idx = 0, lp = 0;
    for (let i = 0; i < N; i++) { const y = buf[idx]; lp += damp * (y - lp); buf[idx] = inp[i] + lp * fb; out[i] += y; if (++idx >= d) idx = 0; }
  }
  for (const d of [225, 556]) { const buf = new Float32Array(d); let idx = 0; for (let i = 0; i < N; i++) { const y = buf[idx], x = out[i], v = x + 0.5 * y; buf[idx] = v; out[i] = y - 0.5 * v; if (++idx >= d) idx = 0; } }
  return out;
}

// ── sonoridad ITU-R BS.1770 / EBU R128 (medidor propio; los tests miden con ffmpeg ebur128, que es la referencia) ────
const KS1 = [[1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]];   // shelf agudo (48 kHz)
const KS2 = [[1, -2, 1], [1, -1.99004745483398, 0.99007225036621]];                                                  // paso alto
const kw = (x) => { const y = new Float64Array(x.length); let a1 = 0, a2 = 0, b1 = 0, b2 = 0, c1 = 0, c2 = 0, d1 = 0, d2 = 0; const [[p0, p1, p2], [, q1, q2]] = KS1, [[r0, r1, r2], [, s1, s2]] = KS2;
  for (let i = 0; i < x.length; i++) { const v = x[i], u = p0 * v + p1 * a1 + p2 * a2 - q1 * b1 - q2 * b2; a2 = a1; a1 = v; b2 = b1; b1 = u; const w = r0 * u + r1 * c1 + r2 * c2 - s1 * d1 - s2 * d2; c2 = c1; c1 = u; d2 = d1; d1 = w; y[i] = w; } return y; };
// energía media K-ponderada por subbloque de 100 ms
function subEnergies(L, R) {
  const n = Math.floor(L.length / 4800), kl = kw(L), kr = kw(R), z = new Float64Array(n);
  for (let j = 0; j < n; j++) { let s = 0; for (let i = j * 4800; i < (j + 1) * 4800; i++) s += kl[i] * kl[i] + kr[i] * kr[i]; z[j] = s / 4800; }
  return z;
}
const lufs = (e) => -0.691 + 10 * Math.log10(Math.max(e, 1e-14));
export function loudness(L, R) {
  const z = subEnergies(L, R), win = (k) => { const out = []; for (let j = 0; j + k <= z.length; j++) { let s = 0; for (let i = j; i < j + k; i++) s += z[i]; out.push(s / k); } return out; };
  const M = win(4), S = win(30), gate = (arr, rel) => { const a = arr.filter((e) => lufs(e) > -70); if (!a.length) return []; const m = a.reduce((p, q) => p + q, 0) / a.length, th = lufs(m) + rel; return a.filter((e) => lufs(e) > th); };
  const g = gate(M, -10), I = g.length ? lufs(g.reduce((p, q) => p + q, 0) / g.length) : -Infinity;
  const gs = gate(S, -20).map(lufs).sort((a, b) => a - b), pct = (p) => gs[Math.min(gs.length - 1, Math.floor(p * (gs.length - 1) + 0.5))];
  return { I, LRA: gs.length ? pct(0.95) - pct(0.1) : 0, S: S.map(lufs), M: M.map(lufs) };       // S[j]: ventana de 3 s que termina en (j+30)/10 s
}
// true peak: sobremuestreo ×4 con sinc ventaneada (12 muestras por fase)
const TPK = Array.from({ length: 4 }, (_, ph) => Array.from({ length: 24 }, (_, k) => { const u = 11 + ph / 4 - k; return (u === 0 ? 1 : Math.sin(Math.PI * u) / (Math.PI * u)) * (0.5 + 0.5 * Math.cos((Math.PI * u) / 12)); }));
export function truePeak(L, R) {
  let pk = 0;
  for (const x of [L, R]) for (let i = 12; i < x.length - 12; i++) {
    if (Math.abs(x[i]) < pk * 0.7 && Math.abs(x[i + 1]) < pk * 0.7) continue;
    for (let ph = 0; ph < 4; ph++) { let s = 0; const h = TPK[ph]; for (let k = 0; k < 24; k++) s += h[k] * x[i - 11 + k]; if (Math.abs(s) > pk) pk = Math.abs(s); }
    if (Math.abs(x[i]) > pk) pk = Math.abs(x[i]);
  }
  return lin2db(pk);
}
// Limitador "ladrillo" offline con lookahead (mínimo móvil + media móvil: nunca supera el techo) y liberación exponencial.
export function limiter(L, R, ceil, { look = 144, release = 0.09 } = {}) {
  const N = L.length, need = new Float32Array(N), mn = new Float32Array(N);
  const th = ceil * 0.45;   // pico VERDADERO (×4): solo se interpola donde hay riesgo de superar el techo
  for (let i = 0; i < N; i++) {
    let p = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    if ((p > th || Math.max(Math.abs(L[i + 1] ?? 0), Math.abs(R[i + 1] ?? 0)) > th) && i >= 11 && i < N - 12) for (const x of [L, R]) for (let ph = 1; ph < 4; ph++) { let q = 0; const h = TPK[ph]; for (let k = 0; k < 24; k++) q += h[k] * x[i - 11 + k]; if (Math.abs(q) > p) p = Math.abs(q); }
    need[i] = p > ceil ? ceil / p : 1;
  }
  const dq = new Int32Array(N + 1); let h = 0, t = 0;                         // mínimo móvil de need[i..i+look−1]
  for (let i = N - 1; i >= 0; i--) { while (t > h && need[dq[t - 1]] >= need[i]) t--; dq[t++] = i; while (dq[h] > i + look - 1) h++; mn[i] = need[dq[h]]; }
  const a = Math.exp(-1 / (release * SR)), rr = new Float32Array(N); let g = 1;
  for (let i = 0; i < N; i++) { g = Math.min(mn[i], g * a + (1 - a)); rr[i] = g; }
  let acc = 0; const outL = new Float32Array(N), outR = new Float32Array(N);
  for (let i = 0; i < N; i++) { acc += rr[i]; if (i >= look) acc -= rr[i - look]; const k = i < look ? acc / (i + 1) : acc / look, gg = Math.min(k, need[i]); outL[i] = L[i] * gg; outR[i] = R[i] * gg; }
  return { L: outL, R: outR };
}

// ── WAV ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function wavBuffer(L, R) {
  const n = L.length, pcm = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) { pcm.writeInt16LE(Math.round(clamp(L[i], -1, 1) * 32767), 4 * i); pcm.writeInt16LE(Math.round(clamp(R[i], -1, 1) * 32767), 4 * i + 2); }
  const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
