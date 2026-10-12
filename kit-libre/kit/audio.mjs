// audio.mjs: sintesis a wav PCM 16-bit 48 kHz estereo. Pistas {sr,n,L,R}; sin Math.random; todo con semilla.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { rng, clamp, lerp } from './base.mjs';

export const SR = 48000;
const TAU = Math.PI * 2, db = (x) => Math.pow(10, x / 20);
/** pista(dur): pista estereo vacia de dur segundos. */
export const pista = (dur) => { const n = Math.ceil(dur * SR); return { sr: SR, n, L: new Float32Array(n), R: new Float32Array(n) }; };
const poner = (p, t, buf, gan = 1, pan = 0) => { const o = Math.round(t * SR), a = Math.cos((pan + 1) * Math.PI / 4) * gan, b = Math.sin((pan + 1) * Math.PI / 4) * gan; for (let i = 0; i < buf.length && o + i < p.n; i++) if (o + i >= 0) { p.L[o + i] += buf[i] * a; p.R[o + i] += buf[i] * b; } };
const fundido = (b, ms = 6) => { const k = Math.min(Math.floor(ms * SR / 1000), b.length >> 1); for (let i = 0; i < k; i++) { b[i] *= i / k; b[b.length - 1 - i] *= i / k; } return b; };
const variar = (r) => [1 + (r() - 0.5) * 0.1, 1 + (r() - 0.5) * 0.1];
const ruido = (n, r) => Float32Array.from({ length: n }, () => r() * 2 - 1);
const lp = (x, fc) => { const a = 1 - Math.exp(-TAU * fc / SR); let y = 0; return x.map((v) => (y += a * (v - y))); };

/** cama(p,{fc,lfoHz,prof,gan,seed}): cama continua de ruido pasa-bajos con fc modulada por LFO lento, sin cortes (gan = rms). */
export function cama(p, { fc = 500, lfoHz = 0.08, prof = 0.5, gan = 0.12, seed = 1 } = {}) {
  for (const [ch, canal] of [[0, p.L], [1, p.R]]) {
    const r = rng(seed * 17 + ch); let y1 = 0, y2 = 0, e = 0;
    const o = new Float32Array(p.n);
    for (let i = 0; i < p.n; i++) { const a = 1 - Math.exp(-TAU * fc * (1 + prof * Math.sin(TAU * lfoHz * i / SR + ch * 1.7)) / SR); y1 += a * (r() * 2 - 1 - y1); y2 += a * (y1 - y2); o[i] = y2; e += y2 * y2; }
    const k = gan / Math.sqrt(e / p.n + 1e-12); for (let i = 0; i < p.n; i++) canal[i] += o[i] * k;
  }
}

/** gota(p,t,{pan,gan,seed}): seno de 1200 a 400 Hz en 40 ms con clic de ruido. */
export function gota(p, t, { pan = 0, gan = 0.5, seed = 1 } = {}) {
  const r = rng(seed), [kf, kg] = variar(r), b = new Float32Array(Math.floor(0.3 * SR)); let ph = 0;
  for (let i = 0; i < b.length; i++) { const s = i / SR, f = (400 + 800 * Math.exp(-s / 0.012)) * kf; ph += TAU * f / SR; b[i] = Math.sin(ph) * Math.exp(-s / 0.05) * 0.8 + (i < 0.003 * SR ? (r() * 2 - 1) * 0.4 : 0); }
  poner(p, t, fundido(b, 5), gan * kg, pan);
}
/** papel(p,t,{pan,gan,seed}): roce de papel, ruido pasa-banda con envolvente rapida y crujido. */
export function papel(p, t, { pan = 0, gan = 0.4, seed = 1 } = {}) {
  const r = rng(seed), [, kg] = variar(r), n = Math.floor(0.4 * SR), x = ruido(n, r), a = lp(x, 6000), c = lp(x, 700), m = lp(ruido(n, r), 300);
  const b = a.map((v, i) => { const s = i / SR; return (v - c[i]) * Math.min(1, s / 0.004) * Math.exp(-s / 0.09) * (0.4 + 3 * Math.abs(m[i])); });
  poner(p, t, fundido(b, 8), gan * kg * 2, pan);
}
/** clic(p,t,{pan,gan,seed}): chasquido seco de 3 ms con resonancia corta. */
export function clic(p, t, { pan = 0, gan = 0.5, seed = 1 } = {}) {
  const r = rng(seed), [kf, kg] = variar(r), b = new Float32Array(Math.floor(0.03 * SR));
  for (let i = 0; i < b.length; i++) { const s = i / SR; b[i] = (r() * 2 - 1) * Math.exp(-s / 0.0008) + 0.6 * Math.sin(TAU * 2200 * kf * s) * Math.exp(-s / 0.004); }
  poner(p, t, fundido(b, 1), gan * kg, pan);
}
/** moneda(p,t,{pan,gan,seed}): 5 parciales inarmonicos con caida larga y golpe inicial. */
export function moneda(p, t, { pan = 0, gan = 0.35, seed = 1 } = {}) {
  const r = rng(seed), [kf, kg] = variar(r), R = [1, 2.32, 4.25, 6.63, 9.38], A = [1, 0.7, 0.5, 0.35, 0.2], D = [1.2, 0.8, 0.55, 0.35, 0.2], b = new Float32Array(Math.floor(1.8 * SR));
  for (let i = 0; i < b.length; i++) { const s = i / SR; let v = i < 0.002 * SR ? (r() * 2 - 1) * 0.5 : 0; for (let k = 0; k < 5; k++) v += A[k] * Math.sin(TAU * 1900 * kf * R[k] * s) * Math.exp(-s / D[k]) * 0.3; b[i] = v; }
  poner(p, t, fundido(b, 6), gan * kg, pan);
}
/** golpe(p,t,{pan,gan,seed}): golpe grave de 60 Hz con caida de tono y rafaga de ruido. */
export function golpe(p, t, { pan = 0, gan = 0.8, seed = 1 } = {}) {
  const r = rng(seed), [kf, kg] = variar(r), n = Math.floor(0.9 * SR), nz = lp(ruido(n, r), 500), b = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const s = i / SR; ph += TAU * (55 + 55 * Math.exp(-s / 0.05)) * kf / SR; b[i] = Math.sin(ph) * Math.exp(-s / 0.3) + nz[i] * 3 * Math.exp(-s / 0.04); }
  poner(p, t, fundido(b, 6), gan * kg, pan);
}
/** piano(p,t,midi,{vel,dur,pan,gan,seed}): 8 armonicos con caida propia, 2 cuerdas desafinadas 1-3 cents, martillo de ruido. */
export function piano(p, t, midi, { vel = 0.7, dur = 4, pan = 0, gan = 0.25, seed = 1 } = {}) {
  const r = rng(seed * 13 + midi), f0 = 440 * Math.pow(2, (midi - 69) / 12), n = Math.floor(dur * SR), b = new Float32Array(n), tau1 = 2.6 * Math.pow(261 / f0, 0.35), cents = [(1 + 2 * r()) * (r() < 0.5 ? -1 : 1), (1 + 2 * r()) * (r() < 0.5 ? -1 : 1)];
  for (let k = 1; k <= 8; k++) {
    const fk = f0 * k * Math.sqrt(1 + 0.0004 * k * k), ak = Math.pow(k, -1.15) * (k > 1 ? 0.5 + vel : 1), tk = tau1 / (1 + 0.7 * (k - 1)), ph = r() * TAU;
    for (const c of cents) { const w = TAU * fk * Math.pow(2, c / 1200) / SR; for (let i = 0; i < n; i++) b[i] += Math.sin(w * i + ph) * ak * 0.5 * Math.exp(-i / SR / tk) * (1 - Math.exp(-i / SR / 0.002)); }
  }
  const h = lp(ruido(Math.floor(0.02 * SR), r), 2500); h.forEach((v, i) => { b[i] += v * 0.5 * vel * Math.exp(-i / SR / 0.004); });
  for (let i = 0; i < Math.min(n, 0.06 * SR); i++) b[n - 1 - i] *= i / (0.06 * SR);
  poner(p, t, b, gan * vel, pan);
}
/** pad(p,t,dur,notas,{gan,pan,seed}): colchon suave de osciladores desafinados con ataque y cola de ~1.5 s. */
export function pad(p, t, dur, notas, { gan = 0.06, pan = 0, seed = 1 } = {}) {
  const r = rng(seed), n = Math.floor(dur * SR), b = new Float32Array(n);
  for (const m of notas) for (const c of [-7, 0, 7]) { const f = 440 * Math.pow(2, (m - 69 + c / 100) / 12), ph = r() * TAU; for (let k = 1; k <= 5; k++) { const w = TAU * f * k / SR; for (let i = 0; i < n; i++) b[i] += Math.sin(w * i + ph * k) / (k * k); } }
  const a = 1.5 * SR; for (let i = 0; i < n; i++) b[i] *= gan / notas.length / 3 * Math.min(1, i / a, (n - i) / a) * (1 + 0.2 * Math.sin(TAU * 0.2 * i / SR));
  poner(p, t, b, 1, pan);
}

function fft(re, im, inv) {
  const n = re.length, cs = new Float64Array(n / 2), sn = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) { cs[i] = Math.cos(TAU * i / n); sn[i] = (inv ? 1 : -1) * Math.sin(TAU * i / n); }
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const h = len >> 1, st = n / len; for (let i = 0; i < n; i += len) for (let j = 0; j < h; j++) { const c = cs[j * st], s = sn[j * st], a = i + j, b = a + h, xr = re[b] * c - im[b] * s, xi = re[b] * s + im[b] * c; re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi; } }
  if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
/** convolucion(x,ir): convolucion por FFT, devuelve Float32Array de longitud x.length. */
export function convolucion(x, ir) {
  let m = 1; while (m < x.length + ir.length) m <<= 1;
  const ar = new Float64Array(m), ai = new Float64Array(m), br = new Float64Array(m), bi = new Float64Array(m); ar.set(x); br.set(ir); fft(ar, ai, false); fft(br, bi, false);
  for (let i = 0; i < m; i++) { const r = ar[i] * br[i] - ai[i] * bi[i]; ai[i] = ar[i] * bi[i] + ai[i] * br[i]; ar[i] = r; }
  fft(ar, ai, true); return Float32Array.from(ar.subarray(0, x.length));
}
/** reverb(p,{tau,mezcla,grave,seed}): reverb por convolucion con IR sintetica (ruido*e^(-t/tau)); tau .25 bajo el agua (grave:true), .8-1.2 al aire. */
export function reverb(p, { tau = 0.8, mezcla = 0.25, grave = false, seed = 9 } = {}) {
  const n = Math.min(Math.floor(4 * tau * SR), 4 * SR), pre = Math.floor(0.012 * SR);
  for (const [ch, canal] of [[0, p.L], [1, p.R]]) {
    const r = rng(seed + ch); let ir = ruido(n, r).map((v, i) => v * Math.exp(-i / SR / tau)); if (grave) ir = lp(ir, 900);
    const e = Math.sqrt(ir.reduce((s, v) => s + v * v, 0)) || 1, full = new Float32Array(n + pre); full.set(ir.map((v) => v / e), pre);
    const w = convolucion(canal, full); for (let i = 0; i < p.n; i++) canal[i] = canal[i] * (1 - mezcla * 0.4) + w[i] * mezcla * 1.6;
  }
}
/** ducking(p,eventos,{db,ataque,soltar}): baja la pista (musica) `db` dB durante cada evento {t,dur}. */
export function ducking(p, eventos, { db: d = -5, ataque = 0.04, soltar = 0.5 } = {}) {
  const obj = new Float32Array(p.n).fill(1), g = db(d);
  for (const e of eventos) for (let i = Math.max(0, Math.floor(e.t * SR)); i < Math.min(p.n, Math.floor((e.t + (e.dur ?? 0.5)) * SR)); i++) obj[i] = g;
  let y = 1; const a = 1 - Math.exp(-1 / (ataque * SR)), s = 1 - Math.exp(-1 / (soltar * SR));
  for (let i = 0; i < p.n; i++) { y += (obj[i] < y ? a : s) * (obj[i] - y); p.L[i] *= y; p.R[i] *= y; }
}
/** mezcla(pistas): suma varias pistas en una nueva. */
export function mezcla(ps) { const o = pista(0); o.n = Math.max(...ps.map((p) => p.n)); o.L = new Float32Array(o.n); o.R = new Float32Array(o.n); for (const p of ps) for (let i = 0; i < p.n; i++) { o.L[i] += p.L[i]; o.R[i] += p.R[i]; } return o; }
/** nivelar(p,{rmsDb}): ajusta ganancia para un rms objetivo (aprox. LUFS -17 con rmsDb -18). */
export function nivelar(p, { rmsDb = -18 } = {}) { let e = 0; for (let i = 0; i < p.n; i++) e += p.L[i] ** 2 + p.R[i] ** 2; const k = db(rmsDb) / Math.sqrt(e / (2 * p.n) + 1e-12); for (let i = 0; i < p.n; i++) { p.L[i] *= k; p.R[i] *= k; } }

/** picoVerdadero(p): pico verdadero en dB (sobremuestreo x4 con sinc ventaneada). */
export function picoVerdadero(p) {
  let mx = 0; const H = [1, 2, 3].map((k) => Array.from({ length: 16 }, (_, j) => { const d = j - 7 - k / 4; return (Math.sin(Math.PI * d) / (Math.PI * d)) * (0.5 + 0.5 * Math.cos(Math.PI * d / 8.5)); }));
  for (const c of [p.L, p.R]) for (let i = 0; i < p.n; i++) { const a = Math.abs(c[i]); if (a > mx) mx = a; }
  let tp = mx;
  for (const c of [p.L, p.R]) for (let i = 8; i < p.n - 8; i++) if (Math.abs(c[i]) > mx * 0.6) for (const h of H) { let s = 0; for (let j = 0; j < 16; j++) s += c[i - 7 + j] * h[j]; if (Math.abs(s) > tp) tp = Math.abs(s); }
  return 20 * Math.log10(tp + 1e-12);
}
/** limitador(p,{techo}): limitador suave con anticipacion de 2 ms y suavizado; techo en dBTP (-3); asegura el pico verdadero. */
export function limitador(p, { techo = -3 } = {}) {
  const c0 = db(techo) * 0.93, W = Math.floor(0.002 * SR), g = new Float32Array(p.n).fill(1);
  for (let i = 0; i < p.n; i++) { const a = Math.max(Math.abs(p.L[i]), Math.abs(p.R[i])); if (a > c0) { const need = c0 / a; for (let j = Math.max(0, i - 2 * W); j <= i; j++) if (g[j] > need) g[j] = need; } }
  const rel = 1 - Math.exp(-1 / (0.08 * SR));
  const q = new Float32Array(p.n + 1); for (let i = 0; i < p.n; i++) q[i + 1] = q[i] + g[i];
  let y = 1; for (let i = 0; i < p.n; i++) { const lo = Math.max(0, i - W), hi = Math.min(p.n, i + W + 1), m = (q[hi] - q[lo]) / (hi - lo), v = Math.min(m, g[i]); y = Math.min(v, y + (1 - y) * rel); const k = Math.min(y, g[i]); p.L[i] *= k; p.R[i] *= k; }
  const tp = picoVerdadero(p); if (tp > techo) { const k = db(techo - tp); for (let i = 0; i < p.n; i++) { p.L[i] *= k; p.R[i] *= k; } }
  return picoVerdadero(p);
}
/** escribirWav(p,ruta): escribe wav PCM 16-bit estereo a 48 kHz. */
export function escribirWav(p, ruta) {
  const d = Buffer.alloc(44 + p.n * 4); d.write('RIFF', 0); d.writeUInt32LE(36 + p.n * 4, 4); d.write('WAVEfmt ', 8); d.writeUInt32LE(16, 16); d.writeUInt16LE(1, 20); d.writeUInt16LE(2, 22); d.writeUInt32LE(SR, 24); d.writeUInt32LE(SR * 4, 28); d.writeUInt16LE(4, 32); d.writeUInt16LE(16, 34); d.write('data', 36); d.writeUInt32LE(p.n * 4, 40);
  for (let i = 0; i < p.n; i++) { d.writeInt16LE(Math.round(clamp(p.L[i], -1, 1) * 32767), 44 + i * 4); d.writeInt16LE(Math.round(clamp(p.R[i], -1, 1) * 32767), 46 + i * 4); }
  fs.writeFileSync(ruta, d);
}
/** medir(archivo): ffmpeg ebur128 sobre un mp4/wav; devuelve {I (LUFS), TP (dBTP), LRA (LU)}. */
export function medir(f) {
  const o = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr, s = o.slice(o.lastIndexOf('Summary:'));
  const g = (re) => { const m = s.match(re); return m ? parseFloat(m[1]) : NaN; };
  return { I: g(/I:\s+(-?[\d.]+) LUFS/), LRA: g(/LRA:\s+(-?[\d.]+) LU\b/), TP: g(/Peak:\s+(-?[\d.]+) dBFS/) };
}

const VOCES = { gota, papel, clic, moneda, golpe };
/** componer(eventos,dur,{cama,tau,grave,notas,pads}): audio completo desde eventos {t,tipo,pan,gan} del timeline; notas [{t,midi,dur}], pads [{t,dur,notas}]; masterizado a -3 dBTP. */
export function componer(eventos, dur, { cama: cm = {}, tau = 0.8, grave = false, notas = [], pads = [] } = {}) {
  const bed = pista(dur), fx = pista(dur), mu = pista(dur);
  cama(bed, cm);
  eventos.forEach((e, i) => VOCES[e.tipo]?.(fx, e.t, { seed: i + 1, pan: e.pan ?? ((i % 5) - 2) * 0.25, ...(e.gan ? { gan: e.gan } : {}) }));
  notas.forEach((n, i) => piano(mu, n.t, n.midi, { dur: n.dur ?? 4, seed: i + 1, pan: lerp(-0.3, 0.3, (i % 4) / 3) }));
  pads.forEach((q, i) => pad(mu, q.t, q.dur, q.notas, { seed: i + 1 }));
  ducking(mu, eventos.filter((e) => e.tipo === 'golpe' || e.tipo === 'moneda').map((e) => ({ t: e.t - 0.05, dur: 0.9 })));
  reverb(fx, { tau, grave, mezcla: 0.25 }); reverb(mu, { tau: tau * 1.2, grave, mezcla: 0.3, seed: 21 });
  const m = mezcla([bed, fx, mu]); nivelar(m, { rmsDb: -19 }); limitador(m); return m;
}
