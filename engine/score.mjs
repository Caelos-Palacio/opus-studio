#!/usr/bin/env node
// Partitura generativa: la música se DERIVA de la estructura del film (timeline + energía + memoria conceptual + un estilo sonoro
// JSON en styles/sound/). Nada está escrito a mano por film: todo instante sale del timeline, todo parámetro musical del estilo.
//   analyzeFilm(tl, mem, style)  → plan: secciones, curva de intensidad I(t), rejilla de tempo anclada HACIA ATRÁS desde el golpe,
//                                  armonía por compás, conceptos con leitmotiv
//   composeScore(plan, style)    → partitura (lista de notas con voz, tiempo, concepto y transformación) + leitmotivs
//   renderScore(part, plan, style) → bus de música estéreo 48 kHz (con reverb), sin masterizar
//   node engine/score.mjs [--timeline X] [--memoria Y] [--style epico] [--wav out/score.wav] [--json out/score.json]
// Proceso y decisiones: docs/MUSICA.md. Spec: docs/specs/002-soundtrack.md.
import fs from 'node:fs';
import path from 'node:path';
import { SR, TAU, clamp, lerp, ramp, mtof, db2lin, rng, hashStr, reverb, wavBuffer, bq, filt } from './dsp.mjs';
import { contexto, peso, primeraVez } from './memoria.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
export const deepMerge = (a, b) => { if (!isObj(a) || !isObj(b)) return b === undefined ? a : b; const o = { ...a }; for (const k of Object.keys(b)) o[k] = deepMerge(a[k], b[k]); return o; };
export const soundStylePath = (name = 'epico') => path.join(ROOT, 'styles/sound', `${name}.json`);
export function loadSoundStyle(name = 'epico', overrides = {}) { return deepMerge(JSON.parse(fs.readFileSync(soundStylePath(name), 'utf8')), overrides); }

// ───────── 1. estructura del film → plan ─────────
const nearest = (arr, v) => arr.reduce((m, x) => (Math.abs(x - v) < Math.abs(m - v) ? x : m), arr[0]);
export function analyzeFilm(tl, mem, style, opts = {}) {
  const SE = style.sections, DUR = tl.duration, shots = [...tl.shots].sort((a, b) => a.t[0] - b.t[0]);
  const sfx = shots.flatMap((s) => (s.sfx ?? []).map((e) => ({ ...e, t: s.t[0] + e.at, shot: s.id })));
  const impacts = sfx.filter((e) => e.type === 'impact').map((e) => ({ t: e.t, gain: e.gain ?? 0.8 })).sort((a, b) => a.t - b.t);
  const main = impacts.reduce((m, e) => (!m || e.gain >= m.gain ? e : m), null);
  const hit = main?.t ?? opts.arc?.measures?.energy?.peakT ?? SE.peakFallback * DUR;
  const TP = style.tempo.points; let KT = 1;                                    // KT: escala global del tempo (solo con tempo.snapStart)
  const bpmAt = (t) => {
    const u = clamp((hit - t) / hit, 0, 1);
    if (u >= TP[0][0]) return TP[0][1] * KT;
    for (let i = 0; i < TP.length - 1; i++) { const [u0, b0] = TP[i], [u1, b1] = TP[i + 1]; if (u <= u0 && u >= u1) { const p = (u0 - u) / (u0 - u1); return (b0 + (b1 - b0) * (i === TP.length - 2 ? p ** style.tempo.curve : p)) * KT; } }
    return TP.at(-1)[1] * KT;
  };
  const beatsBack = (stopN = -Infinity) => { const o = []; for (let n = 0, t = hit; t > -style.tempo.preroll && n >= stopN; n--) { o.push({ t, n }); t -= 60 / bpmAt(t); } return o; };
  if (style.tempo.snapStart) {                                                  // el film empieza EN pulso: KT (≈ 1) tal que el primer pulso con t ≥ 0 caiga exactamente en 0
    const first = beatsBack().filter((b) => b.t >= -1e-9).at(-1), tN = (k) => { KT = k; return beatsBack(first.n).at(-1).t; };
    let lo = 0.8, hi = 1.25; for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (tN(mid) > 0) hi = mid; else lo = mid; }   // más rápido (KT↑) ⇒ pulsos más cortos ⇒ t_n sube
    KT = (lo + hi) / 2;
  }
  const restBpm = style.tempo.rest === 'hit' ? bpmAt(hit) : style.tempo.rest;   // 'hit': el reposo sigue al tempo del golpe (el groove del final no cambia de velocidad)
  const holds = shots.flatMap((s) => (s.hold_ok ?? []).map((h) => [s.t[0] + h[0], s.t[0] + h[1]]));
  const hold = holds.find((h) => h[1] > hit && h[0] >= hit - 1) ?? [hit + SE.holdFallback[0], hit + SE.holdFallback[1]];
  const rev0 = style.tempo.snapHold ? hit + Math.max(1, Math.round((hold[1] - hit) / (60 / restBpm))) * (60 / restBpm) : hold[1];   // snapHold: el respiro dura un número entero de pulsos del golpe y el groove vuelve EN rejilla
  if (!mem?.conceptos?.length) mem = { version: 1, titulo: tl.title ?? '', conceptos: [{ id: 'tema', label: tl.title ?? 'tema', kind: 'motivo', saliencia: 0.9, planta: true, anclas: [{ t: [0, DUR * SE.introFrac] }] }], reinterpretaciones: [] };
  const giros = (mem.reinterpretaciones ?? []).map((g) => ({ id: g.id, en: g.en, por: g.por, objetivo: g.objetivo, tramo: g.tramo }));
  const post = giros.filter((g) => g.en >= rev0 - 0.5).sort((a, b) => a.en - b.en)[0];
  const rev = sfx.find((e) => e.type === 'rev' && e.t >= rev0 - 0.5)?.t ?? post?.en ?? rev0 + SE.revDelay;
  const lastStart = shots.at(-1).t[0], descent = Math.min(shots.find((s) => s.t[0] >= rev + SE.revLen)?.t[0] ?? rev + SE.revLen, lastStart);
  const ret = Math.max(lastStart, descent + 0.5);
  const starts = shots.map((s) => s.t[0]).filter((t) => t > 0);
  const introEnd = nearest(starts, SE.introFrac * DUR), midT = nearest(starts, SE.midFrac * DUR);
  const II = style.intensity, crescWin = Math.max(1, Math.min(II.crescendo.maxSec, II.crescendo.frac * hit, hit - midT - 0.5)), crescStart = hit - crescWin;
  const por = (mem.conceptos ?? []).find((c) => c.id === post?.por), peak = lerp(II.revelation.peak[0], II.revelation.peak[1], por?.saliencia ?? 0.8);
  const lead = (mem.conceptos.filter((c) => c.planta).sort((a, b) => (b.saliencia ?? 0) - (a.saliencia ?? 0))[0] ?? mem.conceptos.slice().sort((a, b) => (b.saliencia ?? 0) - (a.saliencia ?? 0))[0])?.id;
  // intensidad 0..1: curva estructural (+ mezcla con la energía medida por arc si se aporta opts.energy = {hz, v:[…]})
  const base = (t) => {
    if (t < hit) {
      if (t < introEnd) return ramp(t, 0, introEnd, ...II.intro);
      if (t < midT + 0.5) return ramp(t, introEnd, midT + 0.5, ...II.exposition);
      if (t < crescStart) return ramp(t, midT + 0.5, crescStart, ...II.construction);
      return ramp(t, crescStart, hit, II.crescendo.from, II.crescendo.top, II.crescendo.pow);
    }
    if (t < rev0 - SE.breathLead) return t < hit + style.impact.tailKeep ? 1 : clamp(1 - (t - hit - style.impact.tailKeep) / style.impact.tailFade) ** 1.5;   // el golpe suena y se apaga en el silencio
    if (t < rev0) return ramp(t, rev0 - SE.breathLead, rev0, ...II.breath);
    if (t < rev) return ramp(t, rev0, rev, II.revelation.start, peak);
    if (t < ret) return ramp(t, rev, ret, ...II.descent);
    return ramp(t, ret, DUR, ...II.tail);
  };
  const E = opts.energy, intensity = E ? (t) => { const b = base(t), a = clamp(E.v[Math.min(E.v.length - 1, Math.max(0, Math.round(t * E.hz)))] ?? b); return t < hit ? lerp(b, a, II.arcWeight) : b; } : base;
  // tempo: puntos [fracción del tiempo hasta el golpe, bpm]; la última rampa (hacia el pico) lleva curva
  const beats = beatsBack(); beats.reverse();
  const restBeats = []; for (let n = 0, t = rev0; t < DUR + 2; n++, t += 60 / restBpm) restBeats.push({ t, n });
  // compases: cada 4 pulsos desde el golpe hacia atrás; la armonía cicla con el índice de compás (el último = dominante)
  const cyc = style.harmony.build, bars = [], bs = beats.filter((b) => ((b.n % 4) + 4) % 4 === 0), sym = (bar) => cyc[((bar % cyc.length) + cyc.length) % cyc.length];
  bs.forEach((b, i) => { const t1 = bs[i + 1]?.t ?? hit; if (t1 > b.t + 1e-6) bars.push({ t0: b.t, t1, ch: sym(Math.floor(b.n / 4)), sec: 'build' }); });
  if (bs.length) bars.unshift({ t0: -style.tempo.preroll, t1: bs[0].t, ch: sym(Math.floor(bs[0].n / 4) - 1), sec: 'build' });
  const H = style.harmony, post_ = [{ t0: rev0, t1: rev, ch: H.prelude, sec: 'revelation' }, { t0: rev, t1: descent, ch: H.bloom, sec: 'revelation' }];
  H.descent.forEach((ch, i) => { const w = (ret + 0.5 - descent) / H.descent.length; post_.push({ t0: descent + i * w, t1: descent + (i + 1) * w, ch, sec: 'descent' }); });
  post_.push({ t0: ret + 0.5, t1: ret + 0.5 + SE.returnMinorLen, ch: H.return[0], sec: 'return' }, { t0: ret + 0.5 + SE.returnMinorLen, t1: DUR + 2, ch: H.return[1], sec: 'return' });
  const ctx = contexto(mem, { timeline: tl });
  const concepts = mem.conceptos.map((c) => ({ id: c.id, kind: c.kind, saliencia: c.saliencia ?? 0.8, planta: !!c.planta, first: primeraVez(mem, c, ctx) ?? 0 }));
  const sections = [['intro', 0, introEnd], ['exposición', introEnd, midT], ['construcción', midT, crescStart], ['crescendo', crescStart, hit - style.impact.vacuum], ['vacío', hit - style.impact.vacuum, hit], ['golpe', hit, hold[0]], ['silencio', hold[0], rev0], ['revelación', rev0, descent], ['descenso', descent, ret], ['regreso', ret, DUR]].map(([name, t0, t1]) => ({ name, t0, t1 }));
  return { dur: DUR, hit, tempoScale: KT, restBpm, impacts, hold, rev0, rev, ret, descent, introEnd, midT, crescStart, crescWin, vac: style.impact.vacuum, intensity, bpmAt, beats, restBeats, bars: [...bars, ...post_], sections, giros, concepts, lead, mem, ctx, sfx, shots };
}

// ───────── 2. armonía y motivos ─────────
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }, SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11] }, NUM = { I: 0, II: 2, III: 4, IV: 5, V: 7, VI: 9, VII: 11 };
const keyPc = (k) => (PC[k.root[0]] + (k.root[1] === '#' ? 1 : k.root[1] === 'b' ? -1 : 0) + 12) % 12;
// acorde romano ("i", "bVI/i", "Iadd9") → bajo, pad por capas (más voces = más intensidad), arpegio
export function chordNotes(sym, key, inten = 0.5) {
  const m = /^([b#]?)([ivIV]+)([a-z0-9]*)(?:\/([b#]?[ivIV]+))?$/.exec(sym); if (!m) throw new Error('acorde desconocido: ' + sym);
  const off = (a, n) => ((a === 'b' ? -1 : a === '#' ? 1 : 0) + NUM[n.toUpperCase()] + 12) % 12, tp = keyPc(key);
  const root = (tp + off(m[1], m[2])) % 12, third = m[2] === m[2].toLowerCase() ? 3 : 4, bassPc = m[4] ? (tp + off(m[4][0] === 'b' || m[4][0] === '#' ? m[4][0] : '', m[4].replace(/^[b#]/, ''))) % 12 : root;
  const low = (pc) => 21 + ((pc - 21) % 12 + 12) % 12, bass = low(bassPc), r2 = low(root) + 12;
  const tiers = [0, 7, 12, 12 + third, 19, 24, 24 + third, 31, 36]; if (m[3] === 'add9') tiers.splice(3, 0, 26);
  const n = clamp(3 + Math.round(inten * 5), 3, tiers.length);
  return { bass, pad: tiers.slice(0, n).map((x) => r2 + x), arp: [r2 + 12, r2 + 12 + third, r2 + 19, r2 + 24], root, third };
}
const CONTOURS = [[0, 2, 4, 3, 2, 1, 0], [0, 1, 2, 4, 2, 1, 0], [0, 2, 1, 4, 3, 2, 0], [0, 3, 2, 4, 3, 1, 0]], RHYTHMS = [[1, 1, 1.5, 0.5, 1, 1, 2.5], [1, 0.5, 0.5, 1, 1, 1, 3], [1.5, 0.5, 1, 1, 1, 1, 2], [1, 1, 1, 1, 1, 1, 2]];
const toMidi = (d, mode, key) => { const base = 57 + ((keyPc(key) - 57) % 12 + 12) % 12, o = Math.floor(d / 7), i = ((d % 7) + 7) % 7; return base + 12 * o + SCALES[mode][i]; };
// leitmotiv de un concepto: contorno y ritmo elegidos por el hash de su id (determinista); así cada idea de la memoria tiene voz propia
export function deriveMotif(id, key) {
  const h = hashStr(id) >>> 0, degrees = CONTOURS[h % CONTOURS.length], durs = RHYTHMS[(h >>> 3) % RHYTHMS.length], mode = key.mode;
  return { degrees, durs, mode, midi: degrees.map((d) => toMidi(d, mode, key)) };
}
// Transformaciones del leitmotiv cuando su concepto se reinterpreta: se abre (modo mayor, la bajada se despliega en subida),
// se dobla en octava, se acelera y trepa en secuencia.
export function transformMotif(mo, ops, key) {
  let degrees = [...mo.degrees], durs = [...mo.durs], mode = mo.mode, oct = false;
  for (const op of ops) {
    if (op === 'major') mode = 'major';
    else if (op === 'unfold') { const p = degrees.indexOf(Math.max(...degrees)); degrees = degrees.map((d, i) => (i > p ? degrees[p] + (degrees[p] - d) : d)); }
    else if (op === 'oct') oct = true;
    else if (op === 'fast') durs = durs.map((d) => d * 0.25);
    else if (op === 'climb') { const d0 = degrees, u0 = durs; degrees = [0, 1, 2].flatMap((k) => d0.map((d) => d + 2 * k)); durs = [0, 1, 2].flatMap(() => u0); }
  }
  return { degrees, durs, mode, oct, midi: degrees.map((d) => toMidi(d, mode, key)) };
}

// ───────── 3. partitura ─────────
export function composeScore(plan, style) {
  const { hit, hold, rev0, rev, ret, descent, introEnd, midT, crescStart, crescWin, vac, intensity: I, dur } = plan;
  const L = style.layers, M = style.motif, key = style.key, notes = [], add = (n) => notes.push(n), mem = plan.mem, ctx = plan.ctx;
  const LV = M.voice ?? 'lead';                                   // voz del leitmotiv (epico: campana FM; contemplativo: piano). Capas ausentes en el estilo = apagadas.
  const tonic = chordNotes(style.harmony.build[0], key, 0.2);
  const motifs = Object.fromEntries(plan.concepts.map((c) => [c.id, { kind: c.kind, original: deriveMotif(c.id, key) }]));
  const w = (id, t) => 0.65 + 0.7 * peso(mem, id, Math.min(t, dur), ctx);                       // el leitmotiv suena más si el concepto está vivo en la memoria
  // presentación de un motivo (original o transformado) sobre notas del leitmotiv del concepto
  function motif(concept, t0, unit, { ops = [], tr = 0, oct = false, bright = 1, pan = 0, send = 0.55, sust = 0.9, head = 99, g = 0.15, voice = LV } = {}) {
    const mo = ops.length ? transformMotif(motifs[concept].original, ops, key) : motifs[concept].original, label = ops.length ? ops.join('+') : 'original';
    let t = t0; const gg = g * w(concept, t0), n = Math.min(head, mo.degrees.length);
    for (let i = 0; i < n; i++) {
      const d = mo.durs[i] * unit, m = mo.midi[i] + tr;
      add({ v: voice, t, d: d * sust, m, g: gg, bright, pan, send, concept, transform: label });
      if (oct || mo.oct) add({ v: voice, t, d: d * sust, m: m + 12, g: gg * 0.5, bright, pan: -pan, send, concept, transform: label });
      t += d;
    }
    return t - t0;
  }
  // 3a. pad/bajo por compás + drón inicial
  add({ v: 'pad', t0: 0, t1: introEnd, notes: [tonic.bass, tonic.bass + 7, tonic.bass + 12], g: L.drone.gain, atk: 2.5, rel: 2.5, bright: 0.15 });
  for (const b of plan.bars) {
    if (b.t0 >= dur || b.t1 <= b.t0) continue;
    const mid = (b.t0 + b.t1) / 2, inten = I(mid), ch = chordNotes(b.ch, key, inten), len = b.t1 - b.t0, end = Math.min(b.t1, hit - vac);
    if (end <= b.t0) continue;
    add({ v: 'pad', t0: b.t0, t1: end, notes: ch.pad.map((m) => m + (L.pad.shift ?? 0)), g: L.pad.gain[0] + L.pad.gain[1] * inten, atk: Math.min(L.pad.atk ?? 1.8, 0.5 + len * 0.3), rel: L.pad.rel ?? 0.9, bright: 'I', fcMax: L.pad.fcMax });
    if (b.t0 >= introEnd || b.t0 >= rev0) add({ v: 'bass', t: b.t0, d: Math.min(len, 3), m: ch.bass, g: L.bass.gain[0] + L.bass.gain[1] * inten });
  }
  // 3b. pulso/arpegio/percusión sobre la rejilla (tempo que acelera hacia el golpe): capas que entran por intensidad
  const rollWin = (L.roll?.frac ?? 0) * crescWin, riseWin = (L.riser?.frac ?? 0) * crescWin, stepsFor = (x) => (L.arp?.steps ?? []).reduce((s, [thr, n]) => (x >= thr ? n : s), 0), AV = L.arp?.voice ?? 'pluck', ASEQ = L.arp?.seq ?? [0, 1, 2, 3];
  plan.beats.forEach((b, bi) => {
    const t = b.t, len = (plan.beats[bi + 1]?.t ?? hit) - t; if (t < 0 || t >= hit - vac - 0.02) return;
    const inten = I(t), ch = chordNotes(plan.bars.find((q) => t >= q.t0 && t < q.t1)?.ch ?? style.harmony.build[0], key, inten), sub = stepsFor(inten);
    if (sub === 1 && b.n % 2 === 0) add({ v: AV, t, d: 1.0, m: ch.arp[0] + 12, g: 0.05 + 0.05 * inten, pan: -0.3, send: 0.45 });
    else if (sub > 1) for (let j = 0; j < sub; j++) add({ v: AV, t: t + (j * len) / sub, d: AV === 'piano' ? 1.2 : 0.45, m: ch.arp[ASEQ[(bi * sub + j) % ASEQ.length]] + (inten > 0.65 ? 12 : 0) + 12, g: L.arp.gain[0] + L.arp.gain[1] * inten, pan: Math.sin(bi + j) * 0.5, send: 0.45 });
    if (L.bass?.pulse && inten >= L.bass.pulse.thr) add({ v: 'bass', t: t + len / 2, d: len * 0.42, m: ch.bass, g: L.bass.pulse.gain * (0.6 + 0.6 * inten) });   // bajo en el contratiempo (estilos percusivos)
    if (L.kick && inten >= L.kick.thr) add({ v: 'kick', t, g: lerp(L.kick.gain[0], L.kick.gain[1], clamp((t - crescStart) / crescWin) ** 1.2) });
    if (L.kick?.ghost && inten >= L.kick.thr && b.n % 2 !== 0) add({ v: 'kick', t: t + len * 0.75, g: L.kick.ghost * lerp(L.kick.gain[0], L.kick.gain[1], clamp((t - crescStart) / crescWin) ** 1.2) });   // síncopa: kick fantasma (estilos percusivos)
    if (L.hat && inten >= L.hat.thr) { add({ v: 'hat', t: t + len / 2, g: L.hat.gain[0] + L.hat.gain[1] * inten }); if (inten >= L.hat.thr2) { add({ v: 'hat', t: t + len / 4, g: 0.04 + 0.06 * inten }); add({ v: 'hat', t: t + (3 * len) / 4, g: 0.04 + 0.06 * inten }); } }
    if (L.tom && inten >= L.tom.thr && b.n % 2 === 0) add({ v: 'tom', t: t + len / 2, g: L.tom.gain[0] + L.tom.gain[1] * inten, f0: mtof(tonic.bass + 12) });
  });
  if (L.roll) for (let t = hit - vac - rollWin, step = 0.5; t < hit - vac - 0.05; step = Math.max(0.045, step * 0.84), t += step) add({ v: 'snare', t, g: L.roll.gain[0] + L.roll.gain[1] * ((t - (hit - vac - rollWin)) / rollWin) ** 1.5 });
  if (L.riser) add({ v: 'swell', t0: hit - vac - riseWin, t1: hit - vac, g: L.riser.gain, f0: 400, f1: 9000 });
  // 3c. leitmotiv del concepto principal: presentaciones que crecen hacia el golpe (diminución, +3, +7 semitonos)
  const lead = plan.lead, first = plan.concepts.find((c) => c.id === lead)?.first ?? 0;
  if (lead) {
    motif(lead, first + M.introDelay, M.intro.unit, { g: M.intro.g, send: M.intro.send, head: M.intro.head });
    motif(lead, midT + M.mid.delay, M.mid.unit, { g: M.mid.g, bright: M.mid.bright, pan: M.mid.pan });
    const kk = clamp(crescWin / M.refWin, 0.4, 1);   // films cortos: los motivos de construcción se acortan con la ventana
    for (const b of M.build) motif(lead, hit - b.f * crescWin, b.unit * kk, { tr: b.tr, oct: b.oct, bright: b.bright, g: b.g, pan: b.pan ?? 0, head: b.head ?? 99 });
  }
  // 3d. golpe (parte musical: el cuerpo percusivo y el sub los pone el diseño sonoro): acorde grande que NO resuelve
  {
    const ch = chordNotes(style.harmony.climax, key, 1), HT = { kick: 0.6, crash: 0.3, brass: 0.6, choir: 0.7, pluck: 0.13, piano: 0, ...(style.hit ?? {}) };   // epico: percusión, metales y coro; contemplativo: un acorde de piano
    if (HT.kick) add({ v: 'kick', t: hit, g: HT.kick }); if (HT.crash) add({ v: 'crash', t: hit, g: HT.crash, d: 1.4 });
    if (HT.brass) add({ v: 'brass', t: hit, d: 2.2, dec: 4, notes: [...ch.pad, ...ch.pad.slice(2).map((m) => m + 12)], g: HT.brass, bright: 1 }); if (HT.choir) add({ v: 'choir', t: hit, d: 2.2, dec: 4, notes: ch.pad.slice(2), g: HT.choir });
    if (HT.pluck) for (const m of ch.pad) add({ v: 'pluck', t: hit, d: 0.7, m: m + 12, g: HT.pluck, send: 0.5 });
    if (HT.piano) ch.pad.forEach((m, i) => add({ v: 'piano', t: hit + i * (HT.spread ?? 0.06), d: HT.pianoD ?? 3.5, m: m + 12, g: HT.piano / Math.sqrt(ch.pad.length) * 1.6, bright: 0.9, pan: ((i % 3) - 1) * 0.3, send: 0.75 }));
    if (lead) motif(lead, hit, M.climax.unit, { g: M.climax.g, bright: M.climax.bright, head: M.climax.head, sust: M.climax.sust, send: M.climax.send, oct: true });
  }
  // 3e. revelación: respiración, restart suave, el MISMO leitmotiv transformado en cada reinterpretación (en t), floración
  {
    const pre = chordNotes(style.harmony.prelude, key, 0.2), bl = chordNotes(style.harmony.bloom, key, 1);
    add({ v: 'pad', t0: rev0 - style.sections.breathLead, t1: rev0 + 0.5, notes: [pre.bass + 12, pre.bass + 19], g: 0.1, atk: 0.8, rel: 0.8, bright: 0.25 });
    const RV = { kick: 0.5, choir: 0.07, brass: 0.05, piano: 0, ...(style.rev ?? style.revel ?? {}) };
    if (RV.kick) add({ v: 'kick', t: rev0, g: RV.kick });
    for (const g of plan.giros.filter((q) => q.en >= rev0 - 0.5 && q.en <= descent)) {
      const c = plan.concepts.find((q) => q.id === g.objetivo); if (!c) continue;
      const bk = M.byKind[c.kind] ?? M.byKind.default;
      motif(c.id, g.en, M.reinterpret.unit, { ops: bk.ops, voice: bk.voice, g: M.reinterpret.g * (bk.voice === 'pluck' ? 0.5 : 1), bright: M.reinterpret.bright, send: M.reinterpret.send });
    }
    if (RV.choir) add({ v: 'choir', t: rev, d: 4.5, notes: bl.pad.slice(0, 6), g: RV.choir }); if (RV.brass) add({ v: 'brass', t: rev, d: 3.2, notes: bl.pad.slice(2, 6), g: RV.brass, bright: 0.9 });
    if (RV.piano) bl.pad.slice(0, 6).forEach((m, i) => add({ v: 'piano', t: rev + i * 0.07, d: 4.5, m: m + 12, g: RV.piano, bright: 0.8, pan: ((i % 3) - 1) * 0.35, send: 0.85 }));
    const run = [0, 2, 4, 7].map((d) => toMidi(d, 'major', key) + 12); run.forEach((m, i) => add({ v: LV, t: rev + i * 0.1, d: 2.2, m, g: 0.04, bright: 1, pan: i * 0.3 - 0.5, send: 0.9, concept: lead, transform: 'floracion' }));
    add({ v: LV, t: rev, d: 3.5, m: toMidi(7, 'major', key), g: 0.08, bright: 1.2, send: 0.9, concept: lead, transform: 'floracion' });
  }
  // 3f. descenso: arpegio lento sobre la rejilla de reposo, sin percusión
  plan.restBeats.forEach((b, i) => {
    const t = b.t; if (t < descent || t >= ret) return;
    const ch = chordNotes(plan.bars.find((q) => t >= q.t0 && t < q.t1)?.ch ?? style.harmony.bloom, key, 0.4);
    for (let j = 0; j < 2; j++) add({ v: AV, t: t + j * 0.5, d: AV === 'piano' ? 1.4 : 0.8, m: ch.arp[ASEQ[(i * 2 + j) % ASEQ.length]] + 12, g: 0.05 * (1 - 0.5 * clamp((t - descent) / (ret - descent))), pan: Math.sin(i) * 0.4, send: 0.6 });
  });
  // 3f'. groove opcional (estilos percusivos): tras el respiro la rejilla de reposo vuelve con pulso (kick, hats, palmas, bajo) y la intensidad
  //      I(t) lo dosifica; sin `style.groove` (épico) el descenso es solo el arpegio de arriba.
  if (style.groove) {
    const Gv = style.groove, nbeat = plan.restBeats.filter((b) => b.t >= rev0 && b.t < dur);
    nbeat.forEach((b, i) => {
      const t = b.t, len = 60 / plan.restBpm, inten = I(t), ch = chordNotes(plan.bars.find((q) => t >= q.t0 && t < q.t1)?.ch ?? style.harmony.bloom, key, inten), gk = Gv.kick?.gain ?? 0.3, down = i % 4 === 0;
      if (Gv.kick && (Gv.kick.every === 1 || i % (Gv.kick.every ?? 1) === 0)) add({ v: 'kick', t, g: gk * (0.6 + 0.6 * inten) * (down ? 1.15 : 1) });
      if (Gv.hat && inten >= (Gv.hat.thr ?? 0)) { add({ v: 'hat', t: t + len / 2, g: Gv.hat.gain * (0.6 + 0.6 * inten) }); if (Gv.hat.sub) add({ v: 'hat', t: t + len * 0.75, g: Gv.hat.gain * 0.45 }); }
      if (Gv.clap && i % 2 === 1) add({ v: 'snare', t, g: Gv.clap.gain * (0.6 + 0.6 * inten) });
      if (Gv.bass && i % (Gv.bass.every ?? 2) === 0) add({ v: 'bass', t, d: Math.min(len * (Gv.bass.every ?? 2) * 0.9, 1.2), m: ch.bass, g: Gv.bass.gain * (0.6 + 0.6 * inten) });
      if (Gv.arp && inten >= (Gv.arp.thr ?? 0)) for (let j = 0; j < (Gv.arp.sub ?? 2); j++) add({ v: 'pluck', t: t + (j * len) / (Gv.arp.sub ?? 2), d: 0.4, m: ch.arp[L.arp.seq[(i * (Gv.arp.sub ?? 2) + j) % L.arp.seq.length]] + 12, g: Gv.arp.gain * (0.6 + 0.6 * inten), pan: Math.sin(i + j) * 0.5, send: 0.4 });
    });
  }
  // 3g. regreso a casa: el motivo ORIGINAL (menor) y, al final, la resolución en mayor
  if (lead) {
    const len = motif(lead, ret + M.return.delay, M.return.unit, { g: M.return.g, send: M.return.send, sust: 1, head: M.return.head }), tf = ret + M.return.delay + len + 0.4;
    [0, 2, 4, 7].forEach((d, i) => add({ v: LV, t: tf, d: 1.9, m: toMidi(d, 'major', key), g: [0.14, 0.1, 0.1, 0.07][i], bright: 0.8, pan: [0, 0.3, -0.3, 0][i], send: 0.9, concept: lead, transform: 'resolucion' }));
  }
  const bpmAtHit = 60 / (plan.beats.find((b) => b.n === 0).t - plan.beats.find((b) => b.n === -1).t);
  return { meta: { style: style.name, hit, rev, ret, key: style.key }, bpmAtHit, bars: plan.bars, beats: plan.beats.map((b) => b.t), motifs, notes };
}

// ───────── 4. síntesis ─────────
export function renderScore(part, plan, style, { N = Math.ceil((plan.dur + 1.5) * SR) } = {}) {
  // Un corte por impacto en (t − vacío): lo anterior no escribe más allá (ni su reverb) → el vacío es de verdad vacío.
  const cuts = plan.impacts.map((q) => Math.round((q.t - plan.vac) * SR)).sort((a, b) => a - b), nseg = cuts.length + 1;
  const dL = new Float32Array(N), dR = new Float32Array(N), W = Array.from({ length: nseg }, () => ({ L: new Float32Array(N), R: new Float32Array(N) }));
  const R = rng(hashStr('score:' + part.meta.style + ':' + N)), I = plan.intensity;
  let seg = 0, lim = N;
  const put = (t0, i, v, pan = 0, send = 0.2) => { const k = Math.floor(t0 * SR) + i; if (k < 0 || k >= lim) return; const l = Math.cos(((pan + 1) * Math.PI) / 4), r = Math.sin(((pan + 1) * Math.PI) / 4); dL[k] += v * l; dR[k] += v * r; W[seg].L[k] += v * l * send; W[seg].R[k] += v * r * send; };
  const V = {
    pad(n) { // dientes de sierra desafinados con filtro paso bajo cuyo brillo sigue a la intensidad
      const s0 = Math.max(0, Math.floor((n.t0 - n.atk) * SR)), s1 = Math.min(lim, Math.floor((n.t1 + n.rel) * SR)), brightF = n.bright === 'I' ? (t) => 0.25 + 0.75 * I(t) : () => n.bright;
      const voices = n.notes.flatMap((m) => [[mtof(m) * 0.997, -0.6], [mtof(m) * 1.003, 0.6], [mtof(m), 0]]), ph = voices.map(() => R());
      let l1 = 0, r1 = 0, l2 = 0, r2 = 0;
      for (let k = s0; k < s1; k++) {
        const t = k / SR, e = Math.min(clamp((t - (n.t0 - n.atk)) / n.atk), clamp((n.t1 + n.rel - t) / n.rel)), env = e * e * (3 - 2 * e); let l = 0, r = 0;
        for (let v = 0; v < voices.length; v++) { ph[v] += voices[v][0] / SR; if (ph[v] >= 1) ph[v] -= 1; const x = 2 * ph[v] - 1, p = voices[v][1]; l += x * (0.5 - 0.5 * p); r += x * (0.5 + 0.5 * p); }
        const fc = 180 + (n.fcMax ?? 3800) * brightF(t) ** 1.5, a = 1 - Math.exp((-TAU * fc) / SR); l1 += a * (l - l1); l2 += a * (l1 - l2); r1 += a * (r - r1); r2 += a * (r1 - r2);
        const g = (n.g * env) / Math.sqrt(voices.length); dL[k] += l2 * g; dR[k] += r2 * g; W[seg].L[k] += l2 * g * 0.5; W[seg].R[k] += r2 * g * 0.5;
      }
    },
    bass(n) { const f = mtof(n.m); let ph = 0; for (let i = 0; i < Math.min(n.d, 3) * SR; i++) { const t = i / SR, e = clamp(t / 0.01) * Math.exp(-t / (n.d * 0.7)) * clamp((n.d - t) / 0.05); ph += f / SR; put(n.t, i, n.g * e * (Math.sin(TAU * ph) + 0.35 * Math.sin(TAU * ph * 2 + 0.5) + 0.12 * Math.sin(TAU * ph * 3)), 0, 0.03); } },
    pluck(n) { const f = mtof(n.m), d = n.d; for (let i = 0; i < d * SR; i++) { const t = i / SR, a = clamp(t / 0.004), v = Math.sin(TAU * f * t) * Math.exp(-t / (d * 0.5)) + 0.4 * Math.sin(TAU * 2 * f * t) * Math.exp(-t / (d * 0.2)) + 0.18 * Math.sin(TAU * 3 * f * t) * Math.exp(-t / (d * 0.1)); put(n.t, i, n.g * a * v, n.pan ?? 0, n.send ?? 0.45); } },
    lead(n) { // campana FM suave con vibrato lento
      const f = mtof(n.m), bright = n.bright ?? 1; for (let i = 0; i < (n.d + 1.2) * SR; i++) {
        const t = i / SR, a = clamp(t / 0.015), rl = t < n.d ? 1 : Math.exp(-(t - n.d) / 0.35), dec = 0.35 + 0.65 * Math.exp(-t / (0.9 + n.d * 0.5)), idx = (0.6 + 1.6 * bright) * Math.exp(-t / 0.6), vib = 1 + 0.002 * Math.sin(TAU * 5.2 * t) * clamp(t / 0.4), ph = TAU * f * vib * t;
        put(n.t, i, n.g * a * rl * dec * (Math.sin(ph + idx * Math.sin(ph)) * 0.8 + 0.25 * Math.sin(2 * ph)), n.pan ?? 0, n.send ?? 0.55);
      }
    },
    piano(n) { // piano suave sintético (estilo contemplativo): parciales algo inarmónicos con decaimiento propio, dos cuerdas, fieltro y pedal
      const f = mtof(n.m), br = n.bright ?? 1, len = Math.min(8, n.d * 1.2 + 1.8), tau0 = 0.9 + 5.5 * Math.exp(-(n.m - 36) / 20), K = Math.max(3, Math.min(14, Math.floor((4200 + 3200 * br) / f))), hold = n.d * 1.15;
      const parts = []; for (let k = 1; k <= K; k++) { const a = (1 / k ** 1.12) * Math.exp(-(((f * k) / (1400 + 2300 * br)) ** 2)) * (k === 2 ? 1.1 : 1), tau = tau0 / (1 + 0.5 * (k - 1)); if (a > 0.004) parts.push([f * k * Math.sqrt(1 + 0.00018 * k * k), a, tau, R() * TAU, Math.min(len, tau * 5 * 9.2 * 0.5)]); }
      const ph2 = R() * TAU, N = Math.floor(len * SR);
      for (let i = 0; i < N; i++) {
        const t = i / SR, rel = t < hold ? 1 : Math.exp(-(t - hold) / 0.9); let v = 0;
        for (const [fk, a, tau, ph, tmax] of parts) { if (t > tmax) continue; v += a * (0.62 * Math.exp(-t / tau) + 0.38 * Math.exp(-t / (5 * tau))) * Math.sin(TAU * fk * t + ph); }
        v += 0.42 * parts[0][1] * (0.62 * Math.exp(-t / parts[0][2]) + 0.38 * Math.exp(-t / (5 * parts[0][2]))) * Math.sin(TAU * f * 1.0006 * t + ph2);   // segunda cuerda
        v += 0.05 * br * (R() * 2 - 1) * Math.exp(-t / 0.014);                                                                                         // fieltro
        put(n.t, i, n.g * 0.5 * v * rel * clamp(t / 0.0025), n.pan ?? 0, n.send ?? 0.6);
      }
    },
    kick(n) { let ph = 0; for (let i = 0; i < 0.35 * SR; i++) { const t = i / SR; ph += (48 + 110 * Math.exp(-t * 28)) / SR; put(n.t, i, n.g * Math.sin(TAU * ph) * Math.exp(-t / 0.12) * clamp(t / 0.002), 0, 0.05); } },
    tom(n) { let ph = 0; const f0 = n.f0 ?? 70; for (let i = 0; i < 0.9 * SR; i++) { const t = i / SR; ph += (f0 + 60 * Math.exp(-t * 14)) / SR; put(n.t, i, n.g * (Math.sin(TAU * ph) * Math.exp(-t / 0.28) + 0.3 * (R() * 2 - 1) * Math.exp(-t / 0.015)), -0.2, 0.35); } },
    hat(n) { let lp = 0; for (let i = 0; i < 0.06 * SR; i++) { const t = i / SR, x = R() * 2 - 1, h = x - lp; lp += 0.35 * (x - lp); put(n.t, i, n.g * h * Math.exp(-t / 0.012), 0.3, 0.1); } },
    snare(n) { let lp = 0; for (let i = 0; i < 0.25 * SR; i++) { const t = i / SR, x = R() * 2 - 1; lp += 0.5 * (x - lp); put(n.t, i, n.g * (lp * Math.exp(-t / 0.07) + 0.5 * Math.sin(TAU * 190 * t) * Math.exp(-t / 0.04)), 0, 0.3); } },
    crash(n) { let lp = 0; for (let i = 0; i < n.d * SR; i++) { const t = i / SR, x = R() * 2 - 1, h = x - lp; lp += 0.2 * (x - lp); put(n.t, i, n.g * h * Math.exp(-t / (n.d * 0.3)), 0, 0.5); } },
    swell(n) { let lp = 0, bp = 0; const d = n.t1 - n.t0; for (let i = 0; i < d * SR; i++) { const u = i / (d * SR), fc = n.f0 * (n.f1 / n.f0) ** u, a = 1 - Math.exp((-TAU * fc) / SR), x = R() * 2 - 1; lp += a * (x - lp); bp += a * (lp - bp); put(n.t0, i, n.g * (lp - bp) * 4 * u ** 2.2, (u - 0.5) * 0.8, 0.3); } },
    brass(n) { // metales: sierras con filtro que se abre en el ataque, vibrato tardío
      const len = Math.ceil((n.d + 0.8) * SR), seg_ = new Float32Array(len), voices = n.notes.flatMap((m) => [mtof(m) * 0.998, mtof(m) * 1.002]), ph = voices.map(() => R());
      for (let i = 0; i < len; i++) { const t = i / SR, e = clamp(t / 0.09) * (t < n.d ? Math.exp(-t / (n.d * (n.dec ?? 1.4))) : Math.exp(-(t - n.d) / 0.3) * Math.exp(-1 / (n.dec ?? 1.4))), vib = 1 + 0.003 * Math.sin(TAU * 5.5 * t) * clamp((t - 0.3) / 0.5); let s = 0; for (let v = 0; v < voices.length; v++) { ph[v] += (voices[v] * vib) / SR; if (ph[v] >= 1) ph[v] -= 1; s += 2 * ph[v] - 1; } seg_[i] = (s / Math.sqrt(voices.length)) * e; }
      const lo = filt(filt(seg_, bq('lp', 700 + 2600 * n.bright)), bq('lp', 700 + 2600 * n.bright)); for (let i = 0; i < len; i++) put(n.t, i, lo[i] * n.g, 0, 0.4);
    },
    choir(n) { // "ah": sierras a través de tres formantes
      const len = Math.ceil((n.d + 1.0) * SR), seg_ = new Float32Array(len), voices = n.notes.flatMap((m) => [mtof(m + 12) * 0.996, mtof(m + 12) * 1.004]), ph = voices.map(() => R());
      for (let i = 0; i < len; i++) { const t = i / SR, e = clamp(t / 0.35) * (t < n.d ? 1 : Math.exp(-(t - n.d) / 0.5)) * Math.exp(-t / (n.d * (n.dec ?? 1.6))), vib = 1 + 0.004 * Math.sin(TAU * 5 * t); let s = 0; for (let v = 0; v < voices.length; v++) { ph[v] += (voices[v] * vib) / SR; if (ph[v] >= 1) ph[v] -= 1; s += 2 * ph[v] - 1; } seg_[i] = (s / Math.sqrt(voices.length)) * e; }
      const f1 = filt(seg_, bq('bp', 800, 5)), f2 = filt(seg_, bq('bp', 1150, 6)), f3 = filt(seg_, bq('bp', 2900, 8)); for (let i = 0; i < len; i++) put(n.t, i, (f1[i] + 0.7 * f2[i] + 0.35 * f3[i]) * n.g * 1.6, 0, 0.7);
    },
  };
  for (const n of part.notes.slice().sort((a, b) => (a.t ?? a.t0) - (b.t ?? b.t0))) {
    const t = n.t ?? n.t0, k = Math.round(t * SR); seg = cuts.filter((c) => k >= c).length; lim = cuts[seg] ?? N; V[n.v](n);
  }
  const D = style.dynamics, SE = style.sections, Lb = new Float32Array(N), Rb = new Float32Array(N);
  W.forEach((w, si) => {                                              // reverb por tramo; su cola no cruza el corte siguiente
    const rl = reverb(w.L, 'L'), rr = reverb(w.R, 'R'), end = cuts[si] ?? N;
    for (let i = 0; i < Math.min(N, end + 1); i++) { const f = si < cuts.length ? clamp((end - i) / (0.025 * SR)) : 1; Lb[i] += 0.55 * rl[i] * f; Rb[i] += 0.55 * rr[i] * f; }
  });
  for (let i = 0; i < N; i++) {
    const t = i / SR; let g = db2lin(D.floorDb * (1 - I(t) ** D.pow) + (D.revDb ?? 0) * clamp((t - plan.rev0) / 0.3) * clamp((plan.ret + 1 - t) / 1));   // la revelación es ancha pero queda por debajo del golpe if (t > plan.dur - SE.endFade) g *= clamp((plan.dur - t) / SE.endFade) ** 1.5;
    Lb[i] = (dL[i] + Lb[i]) * g; Rb[i] = (dR[i] + Rb[i]) * g;
  }
  return { L: Lb, R: Rb };
}
// Compuerta de la cola del golpe y del silencio (música y ambientes): el golpe rebota un instante, se apaga y vuelve con una respiración.
export const holdGate = (plan, style) => (t) => {
  const SE = style.sections, b = plan.rev0 - SE.breathLead - 0.4;
  if (t < plan.hit) return 1;
  if (t < b) return t < plan.hit + style.impact.tailKeep ? 1 : clamp(1 - (t - plan.hit - style.impact.tailKeep) / style.impact.tailFade) ** 1.5;
  return clamp((t - b) / 0.9);
};

// ───────── CLI ─────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const tl = JSON.parse(fs.readFileSync(path.resolve(ROOT, arg('--timeline', process.env.OPUS_TIMELINE ?? 'data/timeline.json')), 'utf8'));
  const mp = arg('--memoria', tl.sound?.memoria ?? null), mem = mp && fs.existsSync(path.resolve(ROOT, mp)) ? JSON.parse(fs.readFileSync(path.resolve(ROOT, mp), 'utf8')) : null;
  const style = loadSoundStyle(arg('--style', tl.sound?.style ?? 'epico'), tl.sound?.overrides ?? {}), plan = analyzeFilm(tl, mem, style), part = composeScore(plan, style), out = renderScore(part, plan, style);
  const wav = arg('--wav', 'out/score.wav'); fs.mkdirSync(path.dirname(path.resolve(ROOT, wav)), { recursive: true }); fs.writeFileSync(path.resolve(ROOT, wav), wavBuffer(out.L, out.R));
  if (arg('--json')) fs.writeFileSync(path.resolve(ROOT, arg('--json')), JSON.stringify({ ...part, plan: { ...plan, intensity: undefined, bpmAt: undefined, mem: undefined, ctx: undefined } }, null, 1));
  console.log(`→ ${wav} (${plan.dur}s) · golpe ${plan.hit.toFixed(3)} s · silencio ${plan.hold.map((x) => x.toFixed(2)).join('–')} · revelación ${plan.rev.toFixed(2)} s · ${part.notes.length} notas · estilo ${style.name}`);
}
