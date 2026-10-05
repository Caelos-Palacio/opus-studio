#!/usr/bin/env node
// Sonido como datos, sincronizado por construcción: los eventos salen del MISMO timeline que la imagen.
//   node engine/sound.mjs --mix [--timeline X]   → data/mix.wav (48 kHz estéreo) + out/sfx.json (eventos con tiempo, tipo, origen)
//   node engine/sound.mjs --list                 → catálogo de voces
//   node engine/sound.mjs --mux <video.mp4> --out <salida.mp4>  → mezcla (si hace falta) y sustituye SOLO el audio (-c:v copy), sin recodificar el vídeo
// La mezcla queda sellada por el hash de sus ENTRADAS (timeline + contenido del archivo de música + cierre de imports de este
// módulo), guardado en out/sfx<sufijo>.json; ensureMix(tl) solo remezcla si ese hash cambió (no por mtime: un touch no remezcla).
// Fuentes de eventos:  shot.sfx [{at, type, gain, pan, dur}] (relativo al shot) · shot.cues (legado explainer)
//                      timeline.autoSfx: true | {morph, beat, cut, text}  → whoosh en morphs, acento en on_beat_at, click en cortes
// Música: timeline.music {file, gain(dB), duck(dB), fadeIn, fadeOut}; sin music se usa timeline.audio (click track) si existe.
// Soundtrack v2 (spec 002): timeline.sound {style, memoria, overrides} activa el sistema completo (build): partitura generativa
// (score.mjs) + diseño sonoro (sounddesign.mjs) + mezcla/master a −14 LUFS (mixer.mjs). Sin `sound` todo sigue como v1.
// Problemas que evita: SFX pegados a mano que se desincronizan al mover un shot; música que tapa los acentos (ducking);
// aleatoriedad no reproducible (ruido sembrado por evento); clipping (limitador suave + techo −1 dBFS).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, timelinePath } from './film.mjs';
import { rng, hashStr } from './core.mjs';
import { closure, fileDigest, sha } from './hash.mjs';
import { loadSoundStyle, soundStylePath, analyzeFilm, composeScore, renderScore } from './score.mjs';
import { designEvents, renderEvents } from './sounddesign.mjs';
import { mixdown } from './mixer.mjs';
import { wavBuffer } from './dsp.mjs';
import { filmId } from './filmid.mjs';

const SR = 48000, TAU = Math.PI * 2;
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));
// Cada voz escribe en (L,R) desde t0. Parámetros: g (ganancia lineal), pan (−1..1), dur, seed.
export const VOICES = {
  click: { doc: 'transitorio seco (cortes)', fn: (o, w) => { for (let i = 0; i < 0.03 * SR; i++) { const t = i / SR; w(i, Math.sin(TAU * 2400 * t) * env(t, 0.0005, 0.006)); } } },
  tick: { doc: 'tic agudo (texto, datos)', fn: (o, w) => { for (let i = 0; i < 0.12 * SR; i++) { const t = i / SR; w(i, 0.6 * Math.sin(TAU * 1320 * t) * env(t, 0.002, 0.03)); } } },
  pop: { doc: 'pop con caída de tono (aparición)', fn: (o, w) => { let ph = 0; for (let i = 0; i < 0.18 * SR; i++) { const t = i / SR, f = 900 * Math.exp(-t * 30) + 180; ph += (TAU * f) / SR; w(i, Math.sin(ph) * env(t, 0.002, 0.05)); } } },
  whoosh: { doc: 'ruido filtrado con barrido y paneo (morph, movimiento)', fn: (o, w) => { const R = rng(o.seed), d = o.dur ?? 0.6; let lp = 0, bp = 0;
    for (let i = 0; i < d * SR; i++) { const t = i / SR, u = t / d, fc = 300 + 5000 * Math.sin(Math.PI * u) ** 2, a = 1 - Math.exp((-TAU * fc) / SR); const n = R() * 2 - 1; lp += a * (n - lp); bp += a * (lp - bp); w(i, (lp - bp) * 2.2 * Math.sin(Math.PI * u) ** 1.5, (u - 0.5) * 1.4); } } },
  impact: { doc: 'golpe sub + ruido (acento fuerte)', fn: (o, w) => { const R = rng(o.seed); let ph = 0, lp = 0; for (let i = 0; i < 0.9 * SR; i++) { const t = i / SR, f = 38 + 90 * Math.exp(-t * 18); ph += (TAU * f) / SR; lp += 0.08 * (R() * 2 - 1 - lp); w(i, 0.9 * Math.sin(ph) * env(t, 0.003, 0.25) + 0.5 * lp * env(t, 0.001, 0.05)); } } },
  riser: { doc: 'subida de tensión (dur s, termina en el evento)', fn: (o, w) => { const R = rng(o.seed), d = o.dur ?? 1.5; let ph = 0, lp = 0; for (let i = 0; i < d * SR; i++) { const t = i / SR, u = t / d, f = 200 * Math.pow(8, u); ph += (TAU * f) / SR; lp += (0.02 + 0.3 * u) * (R() * 2 - 1 - lp); w(i, (0.35 * Math.sin(ph) + 0.6 * lp) * u * u); } }, lead: (o) => o.dur ?? 1.5 },
  shimmer: { doc: 'parciales agudos que se apagan (revelación)', fn: (o, w) => { for (let i = 0; i < 2.5 * SR; i++) { const t = i / SR; let s = 0; for (const [f, g] of [[1568, 1], [2093, 0.7], [2637, 0.5], [3136, 0.35]]) s += g * Math.sin(TAU * f * t + g); w(i, 0.25 * s * env(t, 0.02, 0.7)); } } },
  drone: { doc: 'lecho grave en quintas (dur s)', fn: (o, w) => { const d = o.dur ?? 4; for (let i = 0; i < d * SR; i++) { const t = i / SR, a = Math.min(1, t / 0.8, (d - t) / 0.8); w(i, 0.3 * a * (Math.sin(TAU * 55 * t) + 0.6 * Math.sin(TAU * 82.4 * t) + 0.2 * Math.sin(TAU * 110 * t + Math.sin(t)))); } } },
  rev: { doc: 'acorde de revelación (legado cues)', fn: (o, w) => { for (let i = 0; i < 2.8 * SR; i++) { const t = i / SR; w(i, (0.5 * Math.sin(TAU * 392 * t) + 0.35 * Math.sin(TAU * 587.3 * (t - 0.12)) * (t > 0.12) + 0.16 * Math.sin(TAU * 784 * (t - 0.24)) * (t > 0.24)) * env(t, 0.01, 0.9)); } } },
  anom: { doc: 'batido disonante (legado cues)', fn: (o, w) => { for (let i = 0; i < 2.2 * SR; i++) { const t = i / SR; w(i, 0.45 * (Math.asin(Math.sin(TAU * 146.8 * t)) + Math.asin(Math.sin(TAU * 155.6 * t))) * env(t, 0.01, 0.7)); } } },
};

export function collectEvents(tl) {
  const ev = [], A = tl.autoSfx === true ? { morph: true, beat: true, cut: true } : tl.autoSfx || {}, shots = [...tl.shots].sort((a, b) => a.t[0] - b.t[0]);
  for (const s of shots) {
    for (const e of s.sfx ?? []) ev.push({ t: s.t[0] + e.at, type: e.type, gain: e.gain ?? 0.8, pan: e.pan ?? 0, dur: e.dur, src: `${s.id}.sfx` });
    for (const c of s.cues ?? []) ev.push({ t: s.t[0] + c.at, type: c.type, gain: 0.7, pan: 0, src: `${s.id}.cues` });
    if (A.beat) for (const b of s.on_beat_at ?? []) ev.push({ t: s.t[0] + b, type: A.beat === true ? 'pop' : A.beat, gain: 0.55, pan: 0, src: `${s.id}.on_beat_at` });
  }
  for (let i = 0; i < shots.length - 1; i++) {
    const tr = (shots[i].transition_out ?? '').toLowerCase(), c = shots[i].t[1];
    if (A.morph && tr === 'morph') ev.push({ t: c - 0.35, type: 'whoosh', dur: 0.7, gain: 0.5, pan: 0, src: `${shots[i].id}.transition_out` });
    if (A.cut && (tr === 'cut' || tr === 'scale-cut' || tr === 'hold-cut')) ev.push({ t: c, type: 'click', gain: 0.35, pan: 0, src: `${shots[i].id}.transition_out` });
  }
  return ev.sort((a, b) => a.t - b.t).map((e, i) => ({ ...e, id: i, seed: hashStr(`${e.src}:${e.t.toFixed(4)}`) }));
}
const db = (x) => Math.pow(10, x / 20);
function decode(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '2', '-ar', String(SR), '-f', 'f32le', 'pipe:1'], { maxBuffer: 2 ** 31 });
  if (r.status !== 0) throw new Error('ffmpeg no pudo decodificar ' + file);
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4);
}
export const mixName = (tlPath = timelinePath()) => (filmId(tlPath) === 'main' ? '' : '-' + filmId(tlPath));
const musicOf = (tl) => tl.music ?? (tl.audio && fs.existsSync(path.join(ROOT, tl.audio)) ? { file: tl.audio, gain: 0, duck: 0 } : null);
const memoriaOf = (tl) => (tl.sound?.memoria && fs.existsSync(path.join(ROOT, tl.sound.memoria)) ? JSON.parse(fs.readFileSync(path.join(ROOT, tl.sound.memoria), 'utf8')) : null);
export function mixHash(tl) {
  const M = musicOf(tl), code = closure(['engine/sound.mjs']), dig = (f) => (fs.existsSync(f) ? fileDigest(f) : null);
  const v2 = tl.sound ? [dig(soundStylePath(tl.sound.style ?? 'epico')), dig(path.join(ROOT, 'engine/memoria.mjs')), tl.sound.memoria ? dig(path.join(ROOT, tl.sound.memoria)) : null] : null;   // estilo sonoro y memoria entran por CONTENIDO
  return sha(tl, M ? fileDigest(path.join(ROOT, M.file)) : null, v2, code.files.map((f) => f + ':' + fileDigest(path.join(ROOT, f))), code.pkgs);
}
// v2: construye partitura, eventos y mezcla en memoria. Devuelve plan, partitura, eventos, buses/stems, master y medidas.
export function build(tl, { memoria } = {}) {
  const sd = tl.sound ?? { style: 'epico' }, style = loadSoundStyle(sd.style ?? 'epico', sd.overrides ?? {}), mem = memoria ?? memoriaOf(tl);
  const plan = analyzeFilm(tl, mem, style), part = composeScore(plan, style), N = Math.ceil((tl.duration + 1.5) * SR);
  const music = renderScore(part, plan, style, { N }), events = designEvents(tl, plan, style), { buses, renderEvent } = renderEvents(events, plan, style, N);
  return { sr: SR, plan, style, partitura: part, events, renderEvent, ...mixdown({ plan, style, music, buses, events }) };
}
// Remezcla solo si falta el wav o cambió el hash de entradas. → true si remezcló.
export function ensureMix(tl, suffix = mixName()) {
  let prev = null; try { prev = JSON.parse(fs.readFileSync(path.join(ROOT, `out/sfx${suffix}.json`), 'utf8')).inputs; } catch {}
  if (prev && prev === mixHash(tl) && fs.existsSync(path.join(ROOT, `data/mix${suffix}.wav`))) return false;
  mix(tl, suffix); return true;
}
export function mix(tl, suffix = mixName()) {
  if (tl.sound) {
    const b = build(tl), inputs = mixHash(tl);
    fs.writeFileSync(path.join(ROOT, `data/mix${suffix}.wav`), wavBuffer(b.master.L, b.master.R));
    fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
    const { S, ...rep } = b.report;
    fs.writeFileSync(path.join(ROOT, `out/sfx${suffix}.json`), JSON.stringify({ sr: SR, inputs, music: 'generativa:' + b.style.name, mastered: rep, plan: { hit: b.plan.hit, hold: b.plan.hold, rev: b.plan.rev, ret: b.plan.ret }, events: b.events.map(({ seed, ...e }) => e) }, null, 1));
    return { events: b.events.length, music: 'generativa:' + b.style.name, peak: 10 ** (rep.TP / 20), report: rep };
  }
  const dur = tl.duration + 1.5, N = Math.ceil(dur * SR), L = new Float32Array(N), R = new Float32Array(N), sL = new Float32Array(N), sR = new Float32Array(N), ev = collectEvents(tl);
  for (const e of ev) {
    const V = VOICES[e.type]; if (!V) { console.warn(`  ! voz desconocida "${e.type}" (${e.src})`); continue; }
    const t0 = e.t - (V.lead?.(e) ?? 0), s0 = Math.round(t0 * SR), g = e.gain;
    V.fn(e, (i, v, pan = 0) => { const k = s0 + i; if (k < 0 || k >= N) return; const p = Math.max(-1, Math.min(1, e.pan + pan)), a = ((p + 1) * Math.PI) / 4; sL[k] += g * v * Math.cos(a) * Math.SQRT2 * 0.5; sR[k] += g * v * Math.sin(a) * Math.SQRT2 * 0.5; });
  }
  const M = musicOf(tl), inputs = mixHash(tl);
  if (M) {
    const x = decode(path.join(ROOT, M.file)), g = db(M.gain ?? -6), duck = db(-(M.duck ?? 6));
    let envS = 0; const atk = Math.exp(-1 / (0.005 * SR)), rel = Math.exp(-1 / (0.25 * SR));
    for (let i = 0; i < N && 2 * i + 1 < x.length; i++) {
      const lvl = Math.abs(sL[i]) + Math.abs(sR[i]); envS = lvl > envS ? atk * envS + (1 - atk) * lvl : rel * envS + (1 - rel) * lvl;   // sidechain
      const t = i / SR, fi = M.fadeIn ? Math.min(1, t / M.fadeIn) : 1, fo = M.fadeOut ? Math.min(1, Math.max(0, (tl.duration - t) / M.fadeOut)) : 1;
      const dk = 1 - (1 - duck) * Math.min(1, envS * 4);
      L[i] += x[2 * i] * g * fi * fo * dk; R[i] += x[2 * i + 1] * g * fi * fo * dk;
    }
  }
  let peak = 0; for (let i = 0; i < N; i++) { L[i] += sL[i]; R[i] += sR[i]; peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
  const ceil = db(-1), soft = (v) => (Math.abs(v) < 0.7 * ceil ? v : Math.sign(v) * (0.7 * ceil + 0.3 * ceil * Math.tanh((Math.abs(v) - 0.7 * ceil) / (0.3 * ceil))));   // limitador suave
  const pcm = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) { pcm.writeInt16LE(Math.round(soft(L[i]) * 32767), i * 4); pcm.writeInt16LE(Math.round(soft(R[i]) * 32767), i * 4 + 2); }
  const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(path.join(ROOT, `data/mix${suffix}.wav`), Buffer.concat([h, pcm]));
  fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, `out/sfx${suffix}.json`), JSON.stringify({ sr: SR, inputs, music: M?.file ?? null, peak: +peak.toFixed(3), events: ev.map(({ seed, ...e }) => e) }, null, 1));
  return { events: ev.length, music: M?.file ?? null, peak };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const A = process.argv, ai = (k) => A[A.indexOf(k) + 1];
  if (A.includes('--mux')) {
    const tl = JSON.parse(fs.readFileSync(path.join(ROOT, timelinePath()), 'utf8')), rem = ensureMix(tl), out = ai('--out');
    if (!out) { console.error('uso: --mux <video.mp4> --out <salida.mp4>'); process.exit(1); }
    const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', ai('--mux'), '-i', path.join(ROOT, `data/mix${mixName()}.wav`), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', tl.sound ? '256k' : '192k', '-ar', '48000', '-t', String(tl.duration), '-movflags', '+faststart', out], { encoding: 'utf8' });
    if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
    console.log(`→ ${out} (${rem ? 'mezcla regenerada' : 'mezcla en caché'}; vídeo sin recodificar)`);
  } else if (process.argv.includes('--list')) for (const [k, v] of Object.entries(VOICES)) console.log(k.padEnd(9), v.doc);
  else { const tl = JSON.parse(fs.readFileSync(path.join(ROOT, timelinePath()), 'utf8')), r = mix(tl); console.log(`→ data/mix${mixName()}.wav  ${r.events} eventos · música: ${r.music ?? 'ninguna'} · pico ${r.peak.toFixed(2)}`); }
}
