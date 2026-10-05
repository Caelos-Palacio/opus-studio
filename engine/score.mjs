#!/usr/bin/env node
// Música por código derivada de la estructura del film (PoC). Determinista, Node puro, sin dependencias.
//   node engine/score.mjs [--timeline data/stress/potencias.json] [--video out/potencias.mp4]
//                         [--out out/potencias_musica.mp4] [--wav out/score-potencias.wav] [--lufs -14]
// Proceso: docs/MUSICA.md. Pasos: timeline → mapa de secciones → rejilla de tempo (aterriza en el impacto) →
// armonía → capas por intensidad → síntesis estéreo 48 kHz → reverb → compuerta de silencio → mezcla ffmpeg
// con ducking bajo los sfx → normalización → medición ebur128.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const TL = arg('--timeline', 'data/stress/potencias.json');
const VIDEO = arg('--video', 'out/potencias.mp4');
const OUT = arg('--out', 'out/potencias_musica.mp4');
const WAV = arg('--wav', 'out/score-potencias.wav');
const TARGET = +arg('--lufs', -14);
const SFX_DB = +arg('--sfx-db', -17); // el audio original del vídeo (sfx masterizados planos a −14 LUFS) pasa a ser capa de acentos
const SR = 48000, TAU = Math.PI * 2;

// ---------- 1. estructura del film ----------
const tl = JSON.parse(fs.readFileSync(TL, 'utf8'));
const DUR = tl.duration;
const sfxAbs = tl.shots.flatMap((s) => (s.sfx ?? []).map((e) => ({ ...e, t: s.t[0] + e.at, shot: s })));
const impact = sfxAbs.find((e) => e.type === 'impact');
const HIT = impact ? impact.t : 0.65 * DUR;               // golpe (≈ pico visual 51,0 s)
const HOLD = [HIT + 0.65, HIT + 3.65];                      // silencio musical (51,6–54,6)
const shotAfter = tl.shots.find((s) => s.t[0] >= HOLD[0]);
const REV0 = shotAfter ? shotAfter.t[0] : HOLD[1];          // inicio de la resolución (55,5)
const REV = sfxAbs.find((e) => e.type === 'rev')?.t ?? REV0 + 2.6; // floración de la revelación (58,1)
const RET = tl.shots.at(-1).t[0];                           // aterrizaje en casa (71)
const MID = tl.shots.find((s) => s.t[0] >= 0.3 * DUR)?.t[0] ?? 0.3 * DUR;

// ---------- utilidades ----------
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, u) => a + (b - a) * clamp(u);
const ramp = (t, t0, t1, a, b, pow = 1) => lerp(a, b, clamp((t - t0) / (t1 - t0)) ** pow);
let seed = 20260101;
const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const N = Math.ceil(DUR * SR);
const dL = new Float32Array(N), dR = new Float32Array(N), wL = new Float32Array(N), wR = new Float32Array(N);
function put(t0, i, v, pan = 0, send = 0.2) {
  const k = Math.floor(t0 * SR) + i; if (k < 0 || k >= N) return;
  const l = Math.cos((pan + 1) * Math.PI / 4), r = Math.sin((pan + 1) * Math.PI / 4);
  dL[k] += v * l; dR[k] += v * r; wL[k] += v * l * send; wR[k] += v * r * send;
}

// ---------- 2. intensidad (arco) ----------
// 0 calma · sube por tramos · 1 en el golpe · 0 en el silencio · segunda cima (revelación) más ancha que alta
const I = (t) => {
  if (t < HIT) {
    if (t < 11.5) return ramp(t, 0, 11.5, 0.10, 0.18);
    if (t < MID + 0.5) return ramp(t, 11.5, MID + 0.5, 0.18, 0.30);
    if (t < HIT - 21) return ramp(t, MID + 0.5, HIT - 21, 0.30, 0.42);
    return ramp(t, HIT - 21, HIT, 0.42, 1.0, 1.7);          // crescendo real en los ~21 s previos
  }
  if (t < HOLD[1]) return 0;
  if (t < REV0) return ramp(t, HOLD[1], REV0, 0.05, 0.35);
  if (t < REV) return ramp(t, REV0, REV, 0.45, 0.72);
  if (t < RET) return ramp(t, REV, RET, 0.62, 0.32);
  return ramp(t, RET, DUR, 0.32, 0.12);
};

// ---------- 3. rejilla de tempo: aterriza exactamente en el golpe ----------
const bpmAt = (t) => t < 20 ? 54 : t < HIT - 15 ? ramp(t, 20, HIT - 15, 54, 76) : ramp(t, HIT - 15, HIT, 76, 132, 1.3);
const beats = []; // {t, n}  n=0 en el golpe; bar = floor(n/4)
for (let n = 0, t = HIT; t > -3; n--) { beats.push({ t, n }); t -= 60 / bpmAt(t); }
beats.reverse();
const preBeats = beats;
const RBPM = 60;
const postBeats = []; for (let n = 0, t = REV0; t < DUR + 2; n++, t += 60 / RBPM) postBeats.push({ t, n });

// ---------- 4. armonía ----------
const CH = {
  Dm: { pad: [38, 45, 50, 53, 57], bass: 26, arp: [50, 53, 57, 62] },
  Bb: { pad: [34, 41, 46, 50, 53], bass: 22, arp: [46, 50, 53, 58] },
  Gm: { pad: [43, 50, 53, 58], bass: 31, arp: [55, 58, 62, 65] },
  A: { pad: [33, 45, 49, 52, 57], bass: 21, arp: [49, 52, 57, 61] },     // dominante: tensión
  BbH: { pad: [34, 46, 53, 58, 62, 65, 70], bass: 22, arp: [58, 62, 65, 70] }, // golpe: bVI sobre pedal de re
  D: { pad: [38, 45, 50, 54, 57, 62, 66, 69, 76], bass: 26, arp: [50, 54, 57, 62] }, // resolución: re mayor ancho
  Bm: { pad: [35, 42, 50, 54, 59, 62], bass: 23, arp: [54, 57, 59, 62] },
  G: { pad: [31, 43, 50, 55, 59, 62], bass: 31, arp: [50, 55, 59, 62] },
  Dadd: { pad: [38, 45, 50, 57, 62, 64, 69, 74], bass: 26, arp: [50, 57, 62, 64] },
};
const CYC = ['Dm', 'Bb', 'Gm', 'A']; // la última (A) cae justo antes del golpe → el golpe no resuelve, la revelación sí
const preBars = []; // {t0,t1,ch}
{
  const starts = preBeats.filter((b) => ((b.n % 4) + 4) % 4 === 0);
  starts.forEach((b, i) => {
    const bar = Math.floor(b.n / 4);
    const t1 = starts[i + 1]?.t ?? HIT;
    preBars.push({ t0: b.t, t1, ch: bar === 0 ? 'BbH' : CYC[((bar % 4) + 4) % 4] });
  });
  preBars.unshift({ t0: -3, t1: starts[0].t, ch: CYC[(((Math.floor(starts[0].n / 4) - 1) % 4) + 4) % 4] });
}
const postBars = [
  { t0: REV0, t1: REV, ch: 'D' }, { t0: REV, t1: 63, ch: 'Dadd' },
  { t0: 63, t1: 66.5, ch: 'D' }, { t0: 66.5, t1: 69, ch: 'Bm' }, { t0: 69, t1: RET + 0.5, ch: 'G' },
  { t0: RET + 0.5, t1: RET + 3.5, ch: 'Dm' }, { t0: RET + 3.5, t1: DUR + 2, ch: 'Dadd' },
];
const chordAt = (t) => ([...preBars, ...postBars].find((b) => t >= b.t0 && t < b.t1) ?? postBars.at(-1)).ch;

// ---------- 5. voces ----------
// Pad: dientes de sierra desafinados, filtro paso bajo con brillo = f(intensidad)
function padSeg(t0, t1, notes, gain, atk, rel, bright) {
  const s0 = Math.max(0, Math.floor((t0 - atk) * SR)), s1 = Math.min(N, Math.floor((t1 + rel) * SR));
  const voices = notes.flatMap((m) => [[mtof(m) * 0.997, -0.6], [mtof(m) * 1.003, 0.6], [mtof(m), 0]]);
  const ph = voices.map(() => rnd());
  let lpL = 0, lpR = 0, lpL2 = 0, lpR2 = 0;
  for (let k = s0; k < s1; k++) {
    const t = k / SR;
    const e = Math.min(clamp((t - (t0 - atk)) / atk), clamp(((t1 + rel) - t) / rel)); const env = e * e * (3 - 2 * e);
    let l = 0, r = 0;
    for (let v = 0; v < voices.length; v++) {
      ph[v] += voices[v][0] / SR; if (ph[v] >= 1) ph[v] -= 1;
      const x = 2 * ph[v] - 1; const p = voices[v][1];
      l += x * (0.5 - 0.5 * p); r += x * (0.5 + 0.5 * p);
    }
    const fc = 180 + 3800 * bright(t) ** 1.5, a = 1 - Math.exp(-TAU * fc / SR);
    lpL += a * (l - lpL); lpL2 += a * (lpL - lpL2); lpR += a * (r - lpR); lpR2 += a * (lpR - lpR2);
    const g = gain * env / Math.sqrt(voices.length);
    const w = 0.5; dL[k] += lpL2 * g; dR[k] += lpR2 * g; wL[k] += lpL2 * g * w; wR[k] += lpR2 * g * w;
  }
}
function bass(t0, m, dur, g) {
  const f = mtof(m); let ph = 0;
  for (let i = 0; i < Math.min(dur, 3) * SR; i++) {
    const t = i / SR, e = clamp(t / 0.01) * Math.exp(-t / (dur * 0.7)) * clamp((dur - t) / 0.05);
    ph += f / SR; put(t0, i, g * e * (Math.sin(TAU * ph) + 0.35 * Math.sin(TAU * ph * 2 + 0.5) + 0.12 * Math.sin(TAU * ph * 3)), 0, 0.03);
  }
}
function pluck(t0, m, g, dur = 0.7, pan = 0, send = 0.45) {
  const f = mtof(m);
  for (let i = 0; i < dur * SR; i++) {
    const t = i / SR, a = clamp(t / 0.004);
    const v = Math.sin(TAU * f * t) * Math.exp(-t / (dur * 0.5)) + 0.4 * Math.sin(TAU * 2 * f * t) * Math.exp(-t / (dur * 0.2)) + 0.18 * Math.sin(TAU * 3 * f * t) * Math.exp(-t / (dur * 0.1));
    put(t0, i, g * a * v, pan, send);
  }
}
// Campana/lead del motivo: FM suave con vibrato lento; dur controla sostén
function lead(t0, m, dur, g, bright = 1, pan = 0, send = 0.55) {
  const f = mtof(m);
  for (let i = 0; i < (dur + 1.2) * SR; i++) {
    const t = i / SR;
    const a = clamp(t / 0.015), rl = t < dur ? 1 : Math.exp(-(t - dur) / 0.35);
    const dec = 0.35 + 0.65 * Math.exp(-t / (0.9 + dur * 0.5));
    const idx = (0.6 + 1.6 * bright) * Math.exp(-t / 0.6);
    const vib = 1 + 0.002 * Math.sin(TAU * 5.2 * t) * clamp(t / 0.4);
    const ph = TAU * f * vib * t;
    const v = Math.sin(ph + idx * Math.sin(ph)) * 0.8 + 0.25 * Math.sin(2 * ph);
    put(t0, i, g * a * rl * dec * v, pan, send);
  }
}
function kick(t0, g) { let ph = 0; for (let i = 0; i < 0.35 * SR; i++) { const t = i / SR; ph += (48 + 110 * Math.exp(-t * 28)) / SR; put(t0, i, g * Math.sin(TAU * ph) * Math.exp(-t / 0.12) * clamp(t / 0.002), 0, 0.05); } }
function tom(t0, g, f0 = 70) { let ph = 0; for (let i = 0; i < 0.9 * SR; i++) { const t = i / SR; ph += (f0 + 60 * Math.exp(-t * 14)) / SR; put(t0, i, g * (Math.sin(TAU * ph) * Math.exp(-t / 0.28) + 0.3 * (rnd() * 2 - 1) * Math.exp(-t / 0.015)), -0.2, 0.35); } }
function hat(t0, g) { let lp = 0; for (let i = 0; i < 0.06 * SR; i++) { const t = i / SR, n = rnd() * 2 - 1; const h = n - lp; lp += 0.35 * (n - lp); put(t0, i, g * h * Math.exp(-t / 0.012), 0.3, 0.1); } }
function snare(t0, g) { let lp = 0; for (let i = 0; i < 0.25 * SR; i++) { const t = i / SR, n = rnd() * 2 - 1; lp += 0.5 * (n - lp); put(t0, i, g * ((lp) * Math.exp(-t / 0.07) + 0.5 * Math.sin(TAU * 190 * t) * Math.exp(-t / 0.04)), 0, 0.3); } }
function noiseSwell(t0, t1, g, f0, f1) { // riser de ruido filtrado
  let lp = 0, bp = 0;
  for (let i = 0; i < (t1 - t0) * SR; i++) { const u = i / ((t1 - t0) * SR), fc = f0 * (f1 / f0) ** u, a = 1 - Math.exp(-TAU * fc / SR); const n = rnd() * 2 - 1; lp += a * (n - lp); bp += a * (lp - bp); put(t0, i, g * (lp - bp) * 4 * u ** 2.2, (u - 0.5) * 0.8, 0.3); }
}
function crash(t0, g, dur) { let lp = 0; for (let i = 0; i < dur * SR; i++) { const t = i / SR, n = rnd() * 2 - 1; const h = n - lp; lp += 0.2 * (n - lp); put(t0, i, g * h * Math.exp(-t / (dur * 0.3)), 0, 0.5); } }

// motivo: 7 notas en re menor; vuelve transformado (aumentado, diminuido+octava, mayor, resuelto)
const MOTIF = [[62, 1], [65, 1], [69, 1.5], [67, 0.5], [65, 1], [64, 1], [62, 2.5]];
const MOTIF_MAJ = [[62, 1], [66, 1], [69, 1.5], [74, 0.5], [73, 1], [71, 1], [74, 3]]; // mayor y ascendente: se abre
function motif(t0, unit, tr, g, { notes = MOTIF, oct = false, bright = 1, pan = 0, send = 0.55, sust = 0.9, head = 7 } = {}) {
  let t = t0; notes.slice(0, head).forEach(([m, d], i) => {
    lead(t, m + tr, d * unit * sust, g, bright, pan, send);
    if (oct) lead(t, m + tr + 12, d * unit * sust, g * 0.5, bright, -pan, send);
    t += d * unit;
  });
  return t - t0;
}

// ---------- 6. composición ----------
const bpbar = (b) => b.t1 - b.t0;
// 6a. pad por compás (cruzado), bajo, brillo según intensidad
for (const b of [...preBars, ...postBars]) {
  if (b.t0 >= HIT && b.t0 < HOLD[1]) continue;
  if (b.t0 >= DUR) continue;
  const ch = CH[b.ch];
  const mid = (b.t0 + b.t1) / 2, inten = I(mid);
  const atk = Math.min(1.8, 0.5 + bpbar(b) * 0.3), rel = 0.9;
  const t1 = b.t0 < HIT && b.t1 >= HIT - 0.001 ? HIT - 0.12 : b.t1; // la última armonía se corta en la inspiración
  const end = b.t0 < HIT ? Math.min(t1, HIT - 0.12) : b.t1;
  const g = 0.16 + 0.22 * inten;
  padSeg(b.t0, end, ch.pad, g, atk, b.t0 < HIT && end >= HIT - 0.13 ? 0.04 : rel, (t) => 0.25 + 0.75 * I(t));
  if (b.t0 >= 11 || b.t0 >= HOLD[1]) bass(b.t0, ch.bass, Math.min(bpbar(b), 3), 0.20 + 0.25 * inten);
}
// drone de re muy grave desde el principio (la persona, la escala humana)
padSeg(0, 11.5, [26, 33, 38], 0.14, 2.5, 2.5, () => 0.15);

// 6b. pulso/arpegio/percusión sobre la rejilla (tempo que acelera)
const arpSeq = [0, 1, 2, 3, 2, 1, 2, 3];
preBeats.forEach((b, bi) => {
  const nxt = preBeats[bi + 1]?.t ?? HIT; const len = nxt - b.t; const t = b.t;
  if (t < 5 || t >= HIT - 0.1) return;
  const inten = I(t), ch = CH[chordAt(t)];
  const sub = t < MID ? 0 : t < HIT - 22 ? 2 : t < HIT - 9 ? 4 : 4; // densidad de arpegio crece
  if (t >= 16 && t < MID && b.n % 2 === 0) pluck(t, ch.arp[0] + 12, 0.05 + 0.05 * inten, 1.0, -0.3); // primeras notas sueltas
  if (sub > 0) for (let j = 0; j < sub; j++) {
    const m = ch.arp[arpSeq[(bi * sub + j) % arpSeq.length]] + (inten > 0.65 ? 12 : 0);
    pluck(t + (j * len) / sub, m + 12, 0.045 + 0.11 * inten, 0.45, Math.sin(bi + j) * 0.5);
  }
  if (t >= HIT - 22) kick(t, 0.12 + 0.55 * clamp((t - (HIT - 22)) / 20) ** 1.2);
  if (t >= HIT - 12) { hat(t + len / 2, 0.05 + 0.1 * inten); if (t >= HIT - 8) { hat(t + len / 4, 0.04 + 0.06 * inten); hat(t + (3 * len) / 4, 0.04 + 0.06 * inten); } }
  if (t >= HIT - 12 && b.n % 2 === 0) tom(t + len / 2, 0.15 + 0.3 * inten, 62);
});
// redoble que se acelera hacia el golpe + riser
for (let k = 0, t = HIT - 4.5, step = 0.5; t < HIT - 0.15; k++) { snare(t, 0.07 + 0.3 * ((t - (HIT - 4.5)) / 4.5) ** 1.5); step = Math.max(0.045, step * 0.84); t += step; }
noiseSwell(HIT - 9, HIT - 0.12, 0.17, 400, 9000);

// 6c. motivo
motif(3.6, 0.95, 0, 0.17, { sust: 0.9, send: 0.8, head: 7 });                 // intro: solo, lento, minor, mucho aire
motif(MID + 0.6, 0.62, 0, 0.14, { oct: false, bright: 0.8, pan: 0.3 });        // 2.ª presentación, más cerca
motif(HIT - 21, 0.40, 0, 0.14, { oct: true, bright: 1.1, pan: -0.2 });          // diminución con octava
motif(HIT - 11.5, 0.24, 3, 0.15, { oct: true, bright: 1.4 });                    // sube una tercera menor
motif(HIT - 5.8, 0.17, 7, 0.17, { oct: true, bright: 1.6, head: 6 });            // sube una quinta: tensión máxima
// 6d. golpe
{
  const t = HIT;
  kick(t, 1.0); tom(t, 0.9, 45); tom(t + 0.02, 0.6, 38); snare(t, 0.5); crash(t, 0.45, 0.65);
  let ph = 0; for (let i = 0; i < 0.7 * SR; i++) { const x = i / SR; ph += (34 + 70 * Math.exp(-x * 14)) / SR; put(t, i, 0.9 * Math.sin(TAU * ph) * Math.exp(-x / 0.3), 0, 0.02); }
  for (const m of [34, 46, 53, 58, 62, 65, 70, 74]) pluck(t, m + 0, 0.16, 0.7, 0, 0.5);
  motif(t, 0.5, 0, 0.17, { oct: true, bright: 1.8, head: 3, sust: 0.6, send: 0.5 }); // cabeza del motivo, aumentada, a toda orquesta
}
// 6e. revelación: el mismo motivo, en mayor, ancho, sin prisa
{
  padSeg(HOLD[1] - 0.2, REV0 + 0.5, [38, 45], 0.1, 0.8, 0.8, (t) => ramp(t, HOLD[1], REV0, 0.1, 0.4)); // respiración previa
  motif(REV0 + 0.5, 0.95, 0, 0.19, { notes: MOTIF_MAJ, oct: true, bright: 1.0, send: 0.85, sust: 1.0 });
  for (const [m, dt] of [[86, 0], [90, 0.1], [93, 0.2], [98, 0.3]]) lead(REV + dt, m - 12, 2.2, 0.06, 1, dt * 3 - 0.5, 0.9); // floración a la altura del `rev`
  lead(REV, 74, 3.5, 0.12, 1.2, 0, 0.9);
  kick(REV0, 0.5);
}
// 6f. descenso (63–71): arpegio en pulso lento sobre la rejilla de 60 bpm, sin percusión
postBeats.forEach((b, i) => {
  const t = b.t; if (t < 63 || t >= RET) return;
  const ch = CH[chordAt(t)]; const len = 1;
  for (let j = 0; j < 2; j++) pluck(t + j * 0.5, ch.arp[arpSeq[(i * 2 + j) % 8]] + 12, 0.05 * (1 - 0.5 * clamp((t - 63) / 8)), 0.8, Math.sin(i) * 0.4, 0.6);
});
// 6g. regreso a casa: el motivo original (menor) que se resuelve al final en re mayor; cola que respira
motif(RET + 0.4, 0.72, 0, 0.15, { send: 0.85, sust: 1.0, head: 6 });
lead(RET + 5.1, 62, 1.9, 0.14, 0.8, 0, 0.9); lead(RET + 5.1, 66, 1.9, 0.10, 0.8, 0.3, 0.9); lead(RET + 5.1, 69, 1.9, 0.10, 0.8, -0.3, 0.9); lead(RET + 5.1, 74, 1.9, 0.07, 0.6, 0, 0.9);

// ---------- 7. reverb (Schroeder estéreo) ----------
function reverb(inp, delays, fb, damp) {
  const out = new Float32Array(N);
  for (const d of delays) {
    const buf = new Float32Array(d); let idx = 0, lp = 0;
    for (let i = 0; i < N; i++) { const y = buf[idx]; lp += damp * (y - lp); buf[idx] = inp[i] + lp * fb; out[i] += y; if (++idx >= d) idx = 0; }
  }
  for (const d of [225, 556]) { const buf = new Float32Array(d); let idx = 0; for (let i = 0; i < N; i++) { const y = buf[idx], x = out[i]; const v = x + 0.5 * y; buf[idx] = v; out[i] = y - 0.5 * v; if (++idx >= d) idx = 0; } }
  return out;
}
const rvL = reverb(wL, [1687, 1801, 2053, 2251, 2399, 2551], 0.86, 0.35);
const rvR = reverb(wR, [1733, 1873, 2087, 2207, 2441, 2609], 0.86, 0.35);

// ---------- 8. master: suma, compuerta del silencio, cola ----------
const L = new Float32Array(N), R = new Float32Array(N);
// curva maestra de dinámica: calma baja, crescendo, golpe lleno, resolución ancha pero por debajo del golpe
const MG = (t) => t < 12 ? 0.55 : t < HIT - 21 ? ramp(t, 12, HIT - 21, 0.6, 0.75) : t < HIT ? ramp(t, HIT - 21, HIT, 0.75, 1.25, 1.5)
  : t < REV ? ramp(t, REV0, REV, 0.30, 0.40) : t < RET ? ramp(t, REV, RET, 0.40, 0.28) : 0.34;
let pk = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR; let g = MG(t);
  if (t >= HIT && t < HOLD[1] - 0.4) g *= clamp(1 - (t - (HIT + 0.2)) / (HOLD[0] - HIT - 0.2)); // cola del golpe: se apaga hacia 51,6; silencio hasta la respiración previa
  else if (t >= HOLD[1] - 0.4 && t < REV0) g = clamp((t - (HOLD[1] - 0.4)) / 0.9) * MG(REV0);
  if (t > DUR - 4.5) g *= clamp((DUR - t) / 4.5) ** 1.5;
  L[i] = (dL[i] + 0.55 * rvL[i]) * g; R[i] = (dR[i] + 0.55 * rvR[i]) * g;
  pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.9 / pk;
const pcm = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) { pcm.writeInt16LE(Math.round(clamp(L[i] * norm, -1, 1) * 32767) | 0, i * 4); pcm.writeInt16LE(Math.round(clamp(R[i] * norm, -1, 1) * 32767) | 0, i * 4 + 2); }
const hd = Buffer.alloc(44);
hd.write('RIFF', 0); hd.writeUInt32LE(36 + pcm.length, 4); hd.write('WAVEfmt ', 8); hd.writeUInt32LE(16, 16); hd.writeUInt16LE(1, 20); hd.writeUInt16LE(2, 22);
hd.writeUInt32LE(SR, 24); hd.writeUInt32LE(SR * 4, 28); hd.writeUInt16LE(4, 32); hd.writeUInt16LE(16, 34); hd.write('data', 36); hd.writeUInt32LE(pcm.length, 40);
fs.mkdirSync(path.dirname(WAV), { recursive: true });
fs.writeFileSync(WAV, Buffer.concat([hd, pcm]));
console.log(`→ ${WAV}  (${DUR}s; golpe ${HIT.toFixed(3)}s · silencio ${HOLD[0].toFixed(2)}–${HOLD[1].toFixed(2)} · resolución ${REV0}s · rev ${REV.toFixed(2)}s)`);

// ---------- 9. mezcla con ducking, normalización y medición ----------
const ff = (args) => spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
const graph = (gdb, lim) =>
  `[0:a]aresample=48000,aformat=channel_layouts=stereo,volume=${SFX_DB}dB,asplit=2[sfx][key];[1:a]aformat=channel_layouts=stereo[m];` +
  `[m][key]sidechaincompress=threshold=0.02:ratio=2.5:attack=20:release=450:makeup=1[md];` +
  `[sfx][md]amix=inputs=2:normalize=0:duration=first,volume=${gdb}dB${lim ? ',alimiter=limit=0.89:attack=5:release=60:level=false' : ''}[a]`;
function measure(file) {
  const r = ff(['-i', file, '-filter_complex', '[0:a]ebur128=peak=true', '-f', 'null', '-']);
  const s = r.stderr, sum = s.slice(s.lastIndexOf('Summary:'));
  return { I: +/I:\s+(-?[\d.]+) LUFS/.exec(sum)?.[1], LRA: +/LRA:\s+(-?[\d.]+) LU/.exec(sum)?.[1], TP: +/Peak:\s+(-?[\d.]+) dBFS/.exec(sum)?.[1] };
}
// serie de loudness de ventana 3 s (short-term) con ffmpeg ebur128 (log por tramos de 100 ms)
function shortTerm(file) {
  const r = ff(['-i', file, '-filter_complex', '[0:a]ebur128', '-f', 'null', '-']);
  const rows = [...r.stderr.matchAll(/t:\s*([\d.]+)\s+TARGET:.*?M:\s*(-?[\d.]+|-inf)\s+S:\s*(-?[\d.]+|-inf)/g)].map((m) => ({ t: +m[1], M: +m[2], S: +m[3] }));
  return rows.filter((x) => Number.isFinite(x.S));
}
const tmp = OUT.replace(/\.mp4$/, '.tmp.wav');
ff(['-y', '-i', VIDEO, '-i', WAV, '-filter_complex', graph(0, false).replace(/\[a\]$/, '[a]'), '-map', '[a]', '-t', String(DUR), tmp]);
let gdb = TARGET - measure(tmp).I;
const fin = OUT.replace(/\.mp4$/, '.final.wav');
for (let it = 0; it < 3; it++) {
  ff(['-y', '-i', VIDEO, '-i', WAV, '-filter_complex', graph(gdb.toFixed(2), true), '-map', '[a]', '-t', String(DUR), fin]);
  const m = measure(fin); const err = TARGET - m.I; if (Math.abs(err) < 0.05) break; gdb += err;
}
const r = ff(['-y', '-i', VIDEO, '-i', fin, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(DUR), OUT]);
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
const m = measure(OUT);
const st = shortTerm(fin);
const peakS = st.reduce((a, b) => (b.S > a.S ? b : a));
const rep = { out: path.resolve(OUT), gain_dB: +gdb.toFixed(2), integrated_LUFS: m.I, LRA_LU: m.LRA, truePeak_dBFS: m.TP, S3s_max_LUFS: peakS.S, S3s_max_window_end_s: peakS.t, S3s_max_window_center_s: +(peakS.t - 1.5).toFixed(2), visual_peak_s: 51.0, score: { HIT, HOLD, REV0, REV } };
fs.writeFileSync(WAV.replace(/\.wav$/, '.json'), JSON.stringify(rep, null, 1));
console.log(JSON.stringify(rep, null, 1));
fs.rmSync(tmp, { force: true }); fs.rmSync(fin, { force: true });
if (argv.includes('--curve')) console.log(st.filter((_, i) => i % 10 === 0).map((x) => `${x.t.toFixed(0)}:${x.S}`).join(' '));
