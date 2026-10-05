#!/usr/bin/env node
// La música manda el tiempo: la rejilla de tempo que SALE de la partitura (score.mjs) se vuelca como audio.json del film, y de ella
// se derivan cortes, entradas y señales (película con tempo variable: `beats` explícitos, no bpm+offset).
//   node engine/grid.mjs [--timeline X] [--out data/<film>/audio.json] [--mix]
//     sin --mix : pulsos, subdivisiones, compases, secciones y onsets por instrumento tal como los compone la partitura (exactos, sin análisis)
//     con --mix : además rms y silencios medidos sobre la mezcla (data/mix<film>.wav, tras `sound.mjs --mix`) y los onsets DETECTADOS (para auditar)
//   node engine/grid.mjs --list [--from 0 --to 30]    imprime pulsos y compases (índice de pulso respecto al golpe: n=0)
// Formato extendido de audio.json (lo lee film.mjs/seek.mjs): beats [t…] (rejilla de pulsos; manda sobre bpm+offset), grid [t…] (subdivisiones donde
// puede caer un corte: lint beats), tracks {kick, snare, hat, tom, bass, pluck, lead, impact: [t…]} (señal audio con `track`), onsets, silences, rms.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, timelinePath } from './film.mjs';
import { filmId, sibling } from './filmid.mjs';
import { loadSoundStyle, analyzeFilm, composeScore } from './score.mjs';
import { analyze } from './audio.mjs';
import { mixName } from './sound.mjs';

const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; }, has = (k) => argv.includes(k);
const r3 = (x) => +x.toFixed(4), uniq = (a) => [...new Set(a.map(r3))].sort((x, y) => x - y);

// Plan + partitura del timeline (sin sintetizar): la fuente de la rejilla.
export function planOf(tl) {
  const sd = tl.sound ?? { style: 'epico' }, style = loadSoundStyle(sd.style ?? 'epico', sd.overrides ?? {});
  const mp = sd.memoria && fs.existsSync(path.join(ROOT, sd.memoria)) ? JSON.parse(fs.readFileSync(path.join(ROOT, sd.memoria), 'utf8')) : null;
  const plan = analyzeFilm(tl, mp, style), part = composeScore(plan, style);
  return { style, plan, part };
}
export function gridOf(tl) {
  const { style, plan, part } = planOf(tl), D = tl.duration;
  const pre = plan.beats.filter((b) => b.t >= -1e-6 && b.t <= plan.hit + 1e-9).map((b) => ({ t: Math.max(0, b.t), n: b.n })), post = plan.restBeats.filter((b) => b.t < D).map((b, i) => ({ t: b.t, n: i, post: true }));
  const P = 60 / plan.restBpm, mid = []; for (let t = plan.hit + P; t < plan.rev0 - 1e-6; t += P) mid.push({ t, n: 0, virtual: true });   // el compás sigue en el silencio (respiro): pulsos virtuales; el groove vuelve en rejilla si style.tempo.snapHold
  const beats = [...pre, ...mid, ...post], sub = [];
  beats.forEach((b, i) => { if (b.t >= plan.hit - 1e-9 && !b.post && !b.virtual) return;
    const len = b.post || b.virtual ? P : (beats[i + 1].t - b.t);
    for (const f of [0.25, 0.5, 0.75]) if (b.t + f * len < D) sub.push(b.t + f * len); });
  const down = [...part.bars.filter((q) => q.t0 >= 0 && q.t0 < D).map((q) => q.t0)];
  const by = (v) => part.notes.filter((n) => (Array.isArray(v) ? v : [v]).includes(n.v)).map((n) => n.t ?? n.t0);
  const tracks = { kick: uniq(by('kick')), snare: uniq(by('snare')), hat: uniq(by('hat')), tom: uniq(by('tom')), bass: uniq(by('bass')), pluck: uniq(by('pluck')), lead: uniq(by('lead')), impact: uniq(plan.impacts.map((q) => q.t)) };
  const onsets = uniq([...tracks.kick, ...tracks.snare, ...tracks.tom, ...tracks.impact]);
  const bpmHit = 60 / (plan.beats.find((b) => b.n === 0).t - plan.beats.find((b) => b.n === -1).t);   // pulso previo al golpe
  return {
    bpm: +bpmHit.toFixed(2), offset: 0, source: `score:${style.name}`, hit: r3(plan.hit), hold: plan.hold.map(r3), rev0: r3(plan.rev0), rev: r3(plan.rev), ret: r3(plan.ret),
    tempo: [0, plan.hit * 0.25, plan.hit * 0.5, plan.hit * 0.75, plan.hit].map((t) => ({ t: r3(t), bpm: +plan.bpmAt(t).toFixed(1) })).concat([{ t: r3(plan.rev0), bpm: +plan.restBpm.toFixed(1) }]),
    beats: uniq(beats.map((b) => b.t)), grid: uniq(sub), downbeats: uniq(down), sections: plan.sections.map((s) => ({ name: s.name, t0: r3(s.t0), t1: r3(s.t1) })),
    onsets, tracks, silences: [],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const tp = timelinePath(), tl = JSON.parse(fs.readFileSync(path.join(ROOT, tp), 'utf8'));
  if (!tl.sound) { console.error('el timeline no declara `sound`: no hay partitura de la que sacar la rejilla'); process.exit(1); }
  const G = gridOf(tl), out = path.resolve(ROOT, arg('--out', sibling('audio.json', 'data/audio.json', tp)));
  if (has('--list')) {
    const a = +arg('--from', 0), b = +arg('--to', tl.duration), { plan } = planOf(tl);
    console.log(`golpe ${G.hit} s · respiro ${G.hold.join('–')} · rev0 ${G.rev0} · regreso ${G.ret} · bpm en el golpe ${G.bpm}`);
    console.log('tempo:', G.tempo.map((x) => `${x.t.toFixed(1)}s=${x.bpm}`).join('  '));
    console.log('pulsos (n respecto al golpe | t | bpm local):');
    G.beats.filter((t) => t >= a && t <= b).forEach((t) => { const n = plan.beats.find((q) => Math.abs(q.t - t) < 1e-3)?.n; console.log(`  ${n === undefined ? '  ·' : String(n).padStart(3)}  ${t.toFixed(4)}  ${G.downbeats.some((d) => Math.abs(d - t) < 1e-3) ? '▌compás' : ''}`); });
    process.exit(0);
  }
  if (has('--mix')) {
    const wav = path.join(ROOT, `data/mix${mixName(tp)}.wav`); if (!fs.existsSync(wav)) { console.error(`falta ${path.relative(ROOT, wav)}: corre antes node engine/sound.mjs --mix`); process.exit(1); }
    const A = analyze(wav); G.rms = A.rms; G.silences = []; { const V = A.rms.values, h = A.rms.hop; let st = -1; for (let i = 0; i <= V.length; i++) { const q = i < V.length && V[i] < 0.004; if (q && st < 0) st = i; if (!q && st >= 0) { if ((i - st) * h >= 0.3) G.silences.push([+(st * h).toFixed(2), +(i * h).toFixed(2)]); st = -1; } } } G.detected = { bpm: A.bpm, onsets: A.onsets };   // silencios ≥ 0,3 s bajo −48 dBFS (el vacío del golpe y el respiro; audio.mjs --analyze exige ≥ 1 s) G.detected = { bpm: A.bpm, onsets: A.onsets };
  } else if (fs.existsSync(out)) { try { const prev = JSON.parse(fs.readFileSync(out, 'utf8')); if (prev.rms) { G.rms = prev.rms; G.silences = prev.silences ?? []; G.detected = prev.detected; } } catch {} }
  fs.writeFileSync(out, JSON.stringify(G));
  console.log(`→ ${path.relative(ROOT, out)}  [${filmId(tp)}] ${G.beats.length} pulsos · ${G.grid.length} subdivisiones · ${G.onsets.length} onsets (kick ${G.tracks.kick.length}, snare ${G.tracks.snare.length}, hat ${G.tracks.hat.length}) · golpe ${G.hit}s · bpm ${G.bpm}${G.rms ? ' · con rms' : ''}`);
}
