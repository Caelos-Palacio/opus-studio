#!/usr/bin/env node
// 3DD · spec 002 (docs/specs/002-soundtrack.md): un test por medible del soundtrack, sobre el AUDIO GENERADO.
//   node test/sound.mjs [--fast] [--legacy] [--only <nombre>]
//   --fast   : fixture corto (Potencias comprimida a ×0,4, mismo código y mismas reglas) en vez de los 78 s.
//   --legacy : mide el estado v1 (sfx planos de sound.mjs + PoC de partitura de la rama del film + su mezcla). Es el "rojo inicial".
//              Si engine/sound.mjs aún no exporta build(), el test cae solo a este modo.
// Los medidores son INDEPENDIENTES del motor (RBJ biquads, envolventes y ebur128 de ffmpeg): el motor no se mide a sí mismo.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const argv = process.argv.slice(2), has = (k) => argv.includes(k), arg = (k) => (has(k) ? argv[argv.indexOf(k) + 1] : null);
const FAST = has('--fast'), only = arg('--only');
const SR = 48000, FRAME = 1 / 30;
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const TLP = 'data/stress/potencias.json', MEMP = 'data/stress/memoria.json';
const WT = path.join(ROOT, '.claude/worktrees/agent-a616aaafdca8853f3/out');

// ───────── medidores ─────────
const mono = (s) => { const x = new Float32Array(s.L.length); for (let i = 0; i < x.length; i++) x[i] = 0.5 * (s.L[i] + s.R[i]); return x; };
function decodeFile(f) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-ac', '2', '-ar', String(SR), '-f', 'f32le', 'pipe:1'], { maxBuffer: 2 ** 31 });
  if (r.status !== 0) throw new Error('ffmpeg no decodifica ' + f);
  const a = new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.length)), n = a.length >> 1, L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = a[2 * i]; R[i] = a[2 * i + 1]; }
  return { L, R };
}
function biquad(type, f, q = Math.SQRT1_2) {
  const w = (2 * Math.PI * f) / SR, c = Math.cos(w), al = Math.sin(w) / (2 * q); let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; } else { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
  const a0 = 1 + al; return [b0 / a0, b1 / a0, b2 / a0, (-2 * c) / a0, (1 - al) / a0];
}
function filt(x, [b0, b1, b2, a1, a2]) { const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; }
const BANDS = { full: (x) => x, sub: (x) => filt(filt(x, biquad('lp', 100)), biquad('lp', 100)), lo: (x) => filt(filt(x, biquad('lp', 250)), biquad('lp', 250)),
  mid: (x) => filt(filt(filt(filt(x, biquad('hp', 250)), biquad('hp', 250)), biquad('lp', 2500)), biquad('lp', 2500)), hi: (x) => filt(filt(x, biquad('hp', 2500)), biquad('hp', 2500)), hf: (x) => filt(filt(x, biquad('hp', 1500)), biquad('hp', 1500)),
  tr: (x) => filt(filt(x, biquad('hp', 2000)), biquad('hp', 2000)), body: (x) => filt(filt(filt(filt(x, biquad('hp', 100)), biquad('hp', 100)), biquad('lp', 2000)), biquad('lp', 2000)) };
const bandCache = new WeakMap();
const band = (x, name) => { let m = bandCache.get(x); if (!m) bandCache.set(x, (m = {})); return (m[name] ??= BANDS[name](x)); };
const ms = (x, t0, t1) => { const a = Math.max(0, Math.round(t0 * SR)), b = Math.min(x.length, Math.round(t1 * SR)); let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return b > a ? s / (b - a) : 0; };
const dB = (p) => 10 * Math.log10(Math.max(p, 1e-14));
const rmsDb = (x, t0, t1, b = 'full') => dB(ms(band(x, b), t0, t1));
// envolvente RMS en dB con hop h (s)
const envDb = (x, t0, t1, h = 0.005, w = 0.01) => { const out = []; for (let t = t0; t < t1; t += h) out.push(dB(ms(x, t, t + w))); return out; };
// transitorios: saltos de ≥ thr dB entre envolventes (hop 5 ms), con refractario
function onsets(x, t0, t1, { thr = 5, floorDb = -60, refr = 0.08 } = {}) {
  const e = envDb(x, t0, t1), out = []; let last = -9;
  for (let i = 3; i < e.length; i++) { const t = t0 + i * 0.005; if (e[i] > floorDb && e[i] - e[i - 3] >= thr && e[i] >= e[i - 1] && t - last >= refr) { out.push(t); last = t; } }
  return out;
}
// instante del transitorio más brusco (mayor salto de nivel en 5 ms) dentro de [t−w, t+w]
function sharpest(x, t, w = 0.5) {
  const h = 0.001, e = []; for (let u = t - w; u < t + w; u += h) e.push(dB(ms(x, u, u + 0.002)));
  let best = 0, bi = 0; for (let i = 5; i < e.length; i++) { const d = e[i] - e[i - 5]; if (d > best) { best = d; bi = i; } }
  return { t: t - w + (bi - 2) * h, jump: best };
}
const spearman = (a, b) => {
  const rk = (v) => { const o = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]), r = new Array(v.length); let i = 0; while (i < o.length) { let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++; for (let k = i; k <= j; k++) r[o[k][1]] = (i + j) / 2; i = j + 1; } return r; };
  const x = rk(a), y = rk(b), n = a.length, mx = x.reduce((p, q) => p + q, 0) / n, my = y.reduce((p, q) => p + q, 0) / n;
  let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
};
function writeWav(file, s) {
  const n = s.L.length, pcm = Buffer.alloc(n * 4); for (let i = 0; i < n; i++) { pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s.L[i])) * 32767), 4 * i); pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s.R[i])) * 32767), 4 * i + 2); }
  const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, pcm]));
}
// ebur128 de ffmpeg (referencia): I, LRA, TP y serie short-term
function ebur(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-filter_complex', '[0:a]ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 }), s = r.stderr, sum = s.slice(s.lastIndexOf('Summary:'));
  const S = [...s.matchAll(/t:\s*([\d.]+)\s+TARGET:.*?M:\s*(-?[\d.]+|-inf)\s+S:\s*(-?[\d.]+|-inf)/g)].map((m) => ({ t: +m[1], S: +m[3] })).filter((x) => Number.isFinite(x.S));
  return { I: +/I:\s+(-?[\d.]+) LUFS/.exec(sum)?.[1], LRA: +/LRA:\s+(-?[\d.]+) LU/.exec(sum)?.[1], TP: +/Peak:\s+(-?[\d.]+) dBFS/.exec(sum)?.[1], S };
}

// ───────── timeline / fixtures ─────────
const clone = (x) => JSON.parse(JSON.stringify(x));
export function scaleTL(tl, k) {
  const t = clone(tl); t.duration *= k;
  for (const s of t.shots) { s.t = s.t.map((v) => v * k); s.on_beat_at = s.on_beat_at?.map((v) => v * k); s.hold_ok = s.hold_ok?.map((h) => h.map((v) => v * k));
    for (const e of s.sfx ?? []) { e.at *= k; if (e.dur) e.dur *= k; } }
  t.handoffs = t.handoffs?.map((h) => ({ ...h, at: h.at * k }));
  return t;
}
const scaleMem = (m, k) => { const x = clone(m); for (const g of x.reinterpretaciones ?? []) { g.en *= k; g.tramo = g.tramo.map((v) => v * k); } for (const c of x.conceptos) { if (c.abre != null) c.abre *= k; if (c.resuelve) c.resuelve.t *= k; for (const e of c.estados ?? []) e.t = e.t.map((v) => v * k); } for (const r of x.relaciones ?? []) if (r.t != null) r.t *= k; return x; };
const abs = (tl) => tl.shots.flatMap((s) => (s.sfx ?? []).map((e) => ({ ...e, t: s.t[0] + e.at, shot: s.id })));
const impactsOf = (tl) => abs(tl).filter((e) => e.type === 'impact');

// ───────── sujeto bajo medida ─────────
const SK = FAST ? 0.4 : 1;
const TL = SK === 1 ? rd(TLP) : scaleTL(rd(TLP), SK), MEM = SK === 1 ? rd(MEMP) : scaleMem(rd(MEMP), SK);
const soundMod = await import('../engine/sound.mjs'), scoreSrc = fs.readFileSync(path.join(ROOT, 'engine/score.mjs'), 'utf8');
const V2 = typeof soundMod.build === 'function' && !has('--legacy');
let S; // sujeto
if (V2) {
  const t0 = Date.now(); const b = soundMod.build({ ...TL, sound: { ...(TL.sound ?? { style: 'epico' }) } }, { memoria: MEM });
  S = { mode: 'v2', ...b, ms: Date.now() - t0 };
} else {
  // v1: sfx planos (VOICES de sound.mjs) + música PoC (wav de la rama del film) + la mezcla PoC (mp4)
  const need = ['score-potencias.wav', 'potencias_musica.mp4'].map((f) => path.join(WT, f));
  if (need.some((f) => !fs.existsSync(f))) { console.error('modo legacy: faltan ' + need.filter((f) => !fs.existsSync(f)).join(', ')); process.exit(2); }
  const events = soundMod.collectEvents(TL), N = Math.ceil((TL.duration + 1.5) * SR), sfx = { L: new Float32Array(N), R: new Float32Array(N) };
  for (const e of events) { const V = soundMod.VOICES[e.type]; if (!V) continue; const s0 = Math.round((e.t - (V.lead?.(e) ?? 0)) * SR);
    V.fn(e, (i, v, pan = 0) => { const k = s0 + i; if (k < 0 || k >= N) return; const a = ((Math.max(-1, Math.min(1, e.pan + pan)) + 1) * Math.PI) / 4; sfx.L[k] += e.gain * v * Math.cos(a) * Math.SQRT2 * 0.5; sfx.R[k] += e.gain * v * Math.sin(a) * Math.SQRT2 * 0.5; }); }
  const music = decodeFile(path.join(WT, 'score-potencias.wav'));
  S = { mode: 'legacy', events, stems: { music, sfx }, masterFile: path.join(WT, 'potencias_musica.mp4'), master: decodeFile(path.join(WT, 'potencias_musica.mp4')),
    renderEvent: (e) => { const V = soundMod.VOICES[e.type], d = []; V.fn({ ...e, seed: e.seed ?? 1 }, (i, v) => { d[i] = (d[i] ?? 0) + e.gain * v; }); return Float32Array.from(d, (v) => v ?? 0); } };
}
console.log(`# sujeto: ${S.mode === 'v2' ? `v2 (build) ${FAST ? 'fixture ×0,4' : 'Potencias completa'} · ${(S.ms / 1000).toFixed(1)} s de síntesis` : 'LEGACY: sfx v1 + PoC de partitura (estado previo)'}`);
const PK = Math.max(...impactsOf(TL).map((e) => e.t)), HITS = impactsOf(TL);
let masterEbur = null;
function masterMeasures() {
  if (masterEbur) return masterEbur;
  let file = S.masterFile, tmp = null;
  if (!file) { tmp = path.join(os.tmpdir(), `opus-sound-${process.pid}.wav`); writeWav(tmp, S.master); file = tmp; }
  masterEbur = ebur(file); if (tmp) fs.rmSync(tmp, { force: true }); return masterEbur;
}

// ───────── tests ─────────
const R = []; const T = (name, fn) => R.push({ name, fn });
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : String(x)), f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : String(x));

// 1) sistematización: ninguna constante de ESTE film en el código
T('sistematización: 0 constantes del film en el código', () => {
  const full = rd(TLP), times = new Set();
  for (const s of full.shots) { times.add(s.t[0]); times.add(s.t[1]); for (const h of s.hold_ok ?? []) h.forEach((v) => times.add(+(s.t[0] + v).toFixed(3))); for (const e of s.sfx ?? []) times.add(+(s.t[0] + e.at).toFixed(3)); for (const b of s.on_beat_at ?? []) times.add(+(s.t[0] + b).toFixed(3)); }
  for (const g of rd(MEMP).reinterpretaciones) times.add(g.en);
  const bounds = new Set(full.shots.flatMap((s) => s.t));   // enteros: solo fronteras de shot (los tics cada 1,5 s darían falsos positivos)
  const film = [...times].filter((v) => v >= 10 && v % 10 !== 0 && (Number.isInteger(v) ? v >= 19 && bounds.has(v) : true));
  const files = ['score', 'sounddesign', 'mixer', 'sound', 'dsp'].map((n) => `engine/${n}.mjs`).filter((f) => fs.existsSync(path.join(ROOT, f)));
  const bad = [];
  for (const f of files) {
    const code = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    if (/potencias/i.test(code)) bad.push(`${f}: nombra el film`);
    if (/['"`]P\d{2}['"`]/.test(code)) bad.push(`${f}: ids de shots del film`);
    for (const m of code.matchAll(/(?<![\w.])(\d+(?:\.\d+)?)(?![\w.])/g)) if (film.includes(+m[1])) bad.push(`${f}: literal ${m[1]} (instante del film)`);
  }
  const uniq = [...new Set(bad)];
  return { ok: !uniq.length, detail: uniq.length ? uniq.slice(0, 6).join(' | ') + (uniq.length > 6 ? ` … (+${uniq.length - 6})` : '') : `${files.length} archivos limpios` };
});
// 2) sistematización: la partitura se deriva de timeline+memoria+estilo (perturbación)
T('sistematización: analyzeFilm sigue al timeline y al estilo JSON', async () => {
  if (!/export\s+(async\s+)?function\s+analyzeFilm/.test(scoreSrc)) return { ok: false, detail: 'engine/score.mjs no exporta analyzeFilm (la PoC es un script con constantes)' };
  const sc = await import('../engine/score.mjs'), st = sc.loadSoundStyle('epico'), full = rd(TLP), mem = rd(MEMP), k = 0.6;
  const a = sc.analyzeFilm(full, mem, st), b = sc.analyzeFilm(scaleTL(full, k), scaleMem(mem, k), st);
  const err = ['hit', 'rev', 'rev0'].map((n) => Math.abs(b[n] - k * a[n])), holdErr = Math.abs(b.hold[0] - k * a.hold[0]) + Math.abs(b.hold[1] - k * a.hold[1]);
  const fast = sc.loadSoundStyle('epico', { tempo: { peak: 160 } }), c = sc.composeScore(sc.analyzeFilm(full, mem, fast), fast), d = sc.composeScore(a, st);
  const bpmA = d.bpmAtHit, bpmC = c.bpmAtHit;
  const ok = err.every((e) => e < 0.05) && holdErr < 0.1 && Math.abs(bpmC / bpmA - 160 / st.tempo.peak) < 0.05;
  return { ok, detail: `escala ×0,6: err hit/rev0/rev ${err.map(f2).join('/')} s, hold ${f2(holdErr)} s · estilo tempo.peak ${st.tempo.peak}→160: bpm en el golpe ${f1(bpmA)}→${f1(bpmC)}` };
});
// 3) tensión: densidad rítmica y brillo crecen monótonos antes del pico
T('tensión: densidad y brillo monótonos crecientes antes del pico', () => {
  const m = mono(S.stems.music), W = Math.min(20, 0.4 * PK), n = Math.max(3, Math.min(5, Math.floor(W / 2.5))), a = PK - 1.0 - W, step = W / n, dens = [], bri = [];
  for (let i = 0; i < n; i++) { const t0 = a + i * step, t1 = t0 + step; dens.push(onsets(m, t0, t1, { thr: 4, floorDb: -65 }).length / step); bri.push(ms(band(m, 'hf'), t0, t1) / Math.max(ms(m, t0, t1), 1e-12)); }
  const mon = (v, tol) => v.every((x, i) => i === 0 || x >= v[i - 1] * (1 - tol));
  const ok = mon(dens, 0.05) && mon(bri, 0.05) && dens.at(-1) >= 1.5 * Math.max(dens[0], 0.2) && bri.at(-1) >= 1.5 * bri[0];
  return { ok, detail: `ventanas de ${f1(step)} s en [${f1(a)}, ${f1(a + W)}] · densidad ev/s ${dens.map(f1).join(' → ')} · brillo ${bri.map((x) => f2(x * 100)).join(' → ')} %` };
});
// 4) tensión: vacío ≥0,5 s antes del golpe (suck-back)
T('tensión: vacío ≥0,5 s antes del golpe', () => {
  const m = mono(S.master); let worst = Infinity, det = [];
  for (const h of HITS) { const pre = rmsDb(m, h.t - 3.0, h.t - 1.0), gap = rmsDb(m, h.t - 0.55, h.t - 0.05), d = pre - gap; worst = Math.min(worst, d); det.push(`golpe ${f1(h.t)}: ${f1(pre)} dB → ${f1(gap)} dB (${f1(d)} dB de caída)`); }
  return { ok: worst >= 15, detail: det.join(' · ') + ' · exige ≥15 dB' };
});
// 5) impacto: transitorio + sub + cola, y sincronía ≤ 2 fotogramas
T('impacto: transitorio + sub-drop + cola por impacto declarado', () => {
  const x = mono(S.stems.sfx), det = []; let ok = true;
  for (const h of HITS) {
    const trans = rmsDb(x, h.t - 0.005, h.t + 0.05, 'tr') - rmsDb(x, h.t + 0.4, h.t + 0.7, 'tr'), sub = rmsDb(x, h.t + 0.05, h.t + 0.6, 'sub') - rmsDb(x, h.t + 0.05, h.t + 0.6),
      peakDb = Math.max(...[0, 0.1, 0.2, 0.3, 0.4].map((d) => rmsDb(x, h.t + d, h.t + d + 0.1))), tail = rmsDb(x, h.t + 1.2, h.t + 2.2) - peakDb;
    const good = trans >= 6 && sub >= -6 && tail >= -40 && tail <= -6; ok &&= good;
    det.push(`golpe ${f1(h.t)}: transitorio ${f1(trans)} dB (≥6) · sub ${f1(sub)} dB (≥−6) · cola ${f1(tail)} dB (−40…−6)`);
  }
  return { ok, detail: det.join(' · ') };
});
T('impacto: sincronía ≤ 2 fotogramas', () => {
  const x = mono(S.master), det = []; let ok = true;
  for (const h of HITS) { const o = sharpest(x, h.t, 0.4), e = Math.abs(o.t - h.t) / FRAME; ok &&= e <= 2; det.push(`golpe ${f2(h.t)}: transitorio en ${f2(o.t)} (${f1(e)} fotogramas, salto ${f1(o.jump)} dB)`); }
  return { ok, detail: det.join(' · ') };
});
// 6) cobertura de eventos visuales
const visualEvents = () => {
  const ev = [], sh = [...TL.shots].sort((a, b) => a.t[0] - b.t[0]);
  for (let i = 0; i < sh.length - 1; i++) if (['morph', 'cut', 'scale-cut', 'hold-cut'].includes((sh[i].transition_out ?? '').toLowerCase())) ev.push({ t: sh[i].t[1], what: `corte/escala ${sh[i].id}→${sh[i + 1].id}` });
  for (const s of sh) for (const b of s.on_beat_at ?? []) ev.push({ t: s.t[0] + b, what: `revelación/entrada ${s.id}@${b}` });
  for (const h of TL.handoffs ?? []) ev.push({ t: h.at, what: `handoff ${h.from}→${h.to}` });
  for (const g of MEM.reinterpretaciones ?? []) ev.push({ t: g.en, what: `reinterpretación ${g.id}` });
  for (const e of abs(TL)) ev.push({ t: e.t, what: `sfx declarado ${e.type}@${e.shot}` });
  return ev;
};
T('diseño: cada evento visual relevante tiene sonido (evento y audio)', () => {
  const V = visualEvents(), x = mono(S.stems.sfx), amb = S.stems.amb ? mono(S.stems.amb) : null, miss = [];
  for (const v of V) {
    const e = S.events.find((q) => Math.abs(q.t - v.t) <= 0.3 && q.type !== 'drone'), heard = e && (rmsDb(x, v.t - 0.15, v.t + 0.25) > -70);
    if (!e || !heard) miss.push(`${f1(v.t)} ${v.what}`);
  }
  const cov = 1 - miss.length / V.length;
  return { ok: cov >= 0.95, detail: `${V.length - miss.length}/${V.length} cubiertos (${f1(cov * 100)} %, exige ≥95 %)${miss.length ? ' · sin sonido: ' + miss.slice(0, 4).join('; ') + (miss.length > 4 ? '…' : '') : ''}` };
});
T('diseño: whoosh proporcional a la velocidad', () => {
  const W = S.events.filter((e) => e.type === 'whoosh' && e.speed != null);
  if (W.length < 6) return { ok: false, detail: `${W.length} whooshes con velocidad declarada (<6): el whoosh no depende de la cámara/escala` };
  const lv = [], br = [];
  for (const e of W) { const d = S.renderEvent(e), t = { L: d, R: d }, m = mono(t); lv.push(dB(ms(m, 0, m.length / SR))); br.push(ms(band(m, 'hf'), 0, m.length / SR) / Math.max(ms(m, 0, m.length / SR), 1e-14)); }
  const r1 = spearman(W.map((e) => e.speed), lv), r2 = spearman(W.map((e) => e.speed), br);
  return { ok: r1 >= 0.5 && r2 >= 0.5, detail: `${W.length} whooshes · ρ(velocidad, nivel) ${f2(r1)} · ρ(velocidad, brillo) ${f2(r2)} (exige ≥0,5)` };
});
T('diseño: risers que resuelven', () => {
  const Rr = S.events.filter((e) => e.type === 'riser'); if (!Rr.length) return { ok: false, detail: 'sin risers' };
  const un = Rr.filter((r) => { const end = r.t + (r.leadOut ?? 0); return !S.events.some((q) => q !== r && q.type !== 'riser' && q.type !== 'drone' && q.t >= end - 0.1 && q.t <= end + 0.6); });
  return { ok: !un.length, detail: `${Rr.length - un.length}/${Rr.length} terminan en un evento de resolución${un.length ? ' · sin resolver: ' + un.map((r) => f1(r.t)).join(', ') : ''}` };
});
// 7) variedad
T('variedad: ninguna voz idéntica >4 veces seguidas; los tics siguen la intensidad', () => {
  const byType = {}; for (const e of S.events) (byType[e.type] ??= []).push(e);
  let maxRun = 0, who = '';
  for (const [type, list] of Object.entries(byType)) {
    let run = 1, prev = null;
    for (const e of list) {
      const d = S.renderEvent(e), cur = d.subarray(0, Math.round(0.25 * SR));
      if (prev) { let sxy = 0, sxx = 0, syy = 0; const n = Math.min(prev.length, cur.length); for (let i = 0; i < n; i++) { sxy += prev[i] * cur[i]; sxx += prev[i] ** 2; syy += cur[i] ** 2; }
        const c = sxy / Math.sqrt(sxx * syy || 1), same = c > 0.995 && Math.abs(dB(sxx) - dB(syy)) < 0.5; run = same ? run + 1 : 1; }
      if (run > maxRun) { maxRun = run; who = type; } prev = Float32Array.from(cur);
    }
  }
  const ticks = S.events.filter((e) => e.type === 'tick'); let rho = NaN;
  if (ticks.length >= 6 && S.plan?.intensity) { const lv = ticks.map((e) => { const d = S.renderEvent(e); return dB(ms(d, 0, d.length)); }); rho = spearman(ticks.map((e) => S.plan.intensity(e.t)), lv); }
  return { ok: maxRun <= 4 && rho >= 0.5, detail: `racha máxima de "${who}" idénticos: ${maxRun} (exige ≤4) · ρ(intensidad, nivel del tic) ${f2(rho)} sobre ${ticks.length} tics (exige ≥0,5)` };
});
// 8) mezcla: enmascaramiento
T('mezcla: buses separados y la música cede ≥3 dB en la banda del sfx', () => {
  if (!S.mixer?.musicPre || !S.mixer?.musicPost || !S.stems.amb) return { ok: false, detail: 'sin buses separados (música/sfx/ambiente) ni sidechain por banda y prioridad: la PoC mezcla con un único sidechaincompress de ffmpeg' };
  const pre = mono(S.mixer.musicPre), post = mono(S.mixer.musicPost), sx = mono(S.stems.sfx), det = []; let n = 0, cedes = [];
  for (const e of S.events.filter((q) => (q.priority ?? 0) >= 2 && q.type !== 'riser')) {
    const t0 = e.t - 0.02, t1 = e.t + Math.min(0.5, e.dur ?? 0.5); if (rmsDb(sx, t0, t1) < -45) continue;
    const bs = ['lo', 'mid', 'hi'], dom = bs.map((b) => rmsDb(sx, t0, t1, b)).reduce((m, v, i, a) => (v > a[m] ? i : m), 0), bn = bs[dom];
    if (rmsDb(pre, t0, t1, bn) < -70) continue; // la música calla de todos modos: no hay enmascaramiento que medir
    cedes.push(rmsDb(pre, t0, t1, bn) - rmsDb(post, t0, t1, bn)); n++;
  }
  cedes.sort((a, b) => a - b); const med = cedes[Math.floor(cedes.length / 2)] ?? 0, p20 = cedes[Math.floor(cedes.length * 0.2)] ?? 0;
  return { ok: n >= 3 && p20 >= 3, detail: `${n} eventos de prioridad ≥2 con música audible · cesión en su banda: mediana ${f1(med)} dB, p20 ${f1(p20)} dB (exige p20 ≥3)` };
});
// 9) master
T('master: −14 LUFS ±0,5, LRA ≥8, true peak ≤ −1 dBTP', () => {
  const m = masterMeasures(), ok = Math.abs(m.I + 14) <= 0.5 && m.LRA >= 8 && m.TP <= -1;
  return { ok, detail: `I ${f1(m.I)} LUFS · LRA ${f1(m.LRA)} LU · TP ${f1(m.TP)} dBTP` };
});
T('master: clímax (ventana 3 s centrada) a ±0,5 s del pico visual', () => {
  const m = masterMeasures(), top = m.S.reduce((a, b) => (b.S > a.S ? b : a)), c = top.t - 1.5, err = c - PK;
  return { ok: Math.abs(err) <= 0.5, detail: `máx short-term ${f1(top.S)} LUFS en [${f1(c - 1.5)}, ${f1(c + 1.5)}] → centro ${f2(c)} s vs pico visual ${f2(PK)} s (error ${err >= 0 ? '+' : ''}${f2(err)} s)` };
});
// 10) leitmotif de la memoria
T('memoria: el leitmotiv reaparece TRANSFORMADO en cada reinterpretación (±1 s)', () => {
  const notes = S.partitura?.notes; if (!notes) return { ok: false, detail: 'la PoC no tiene leitmotivs por concepto (motivo único escrito a mano)' };
  const det = []; let ok = true;
  for (const g of MEM.reinterpretaciones ?? []) {
    const orig = S.partitura.motifs?.[g.objetivo]?.original, tr = notes.filter((n) => n.concept === g.objetivo && n.transform && n.transform !== 'original' && Math.abs(n.t - g.en) <= 1);
    const iv = (arr) => arr.slice(1).map((v, i) => v - arr[i]).join(','), cur = tr.slice().sort((a, b) => a.t - b.t).slice(0, orig?.length ?? 7).map((n) => n.m);
    const good = !!orig && tr.length >= 3 && iv(cur) !== iv(orig.midi); ok &&= good;
    det.push(`${g.id} (${g.objetivo} @${f1(g.en)}): ${tr.length} notas transformadas [${[...new Set(tr.map((n) => n.transform))].join('+')}]${good ? '' : ' ✗'}`);
  }
  return { ok, detail: det.join(' · ') };
});
// 11) determinismo (mismo timeline → mismos bytes)
T('determinismo: dos builds de un film corto dan el mismo audio', () => {
  if (S.mode !== 'v2') return { ok: false, detail: 'sin build()' };
  const tiny = scaleTL(rd(TLP), 0.22), mem = scaleMem(rd(MEMP), 0.22), h = () => { const b = soundMod.build({ ...tiny, sound: { style: 'epico' } }, { memoria: mem }); return crypto.createHash('sha1').update(Buffer.from(b.master.L.buffer)).update(Buffer.from(b.master.R.buffer)).digest('hex').slice(0, 12); };
  const a = h(), b = h(); return { ok: a === b, detail: `${a} / ${b}` };
});

// ───────── ejecución ─────────
let fail = 0;
for (const t of R) {
  if (only && !t.name.includes(only)) continue;
  let r; try { r = await t.fn(); } catch (e) { r = { ok: false, detail: 'excepción: ' + (e.stack ?? e.message).split('\n').slice(0, 3).join(' ') }; }
  console.log(`${r.ok ? '✓' : '✗'} sound: ${t.name}  ${r.detail}`); if (!r.ok) fail++;
}
console.log(`${fail ? `${fail} de ${R.length} medibles en ROJO` : `${R.length} medibles en verde`}`);
process.exit(fail ? 1 : 0);
