// Mezcla y master: buses (música, sfx, impactos, ambiente), vacío antes del golpe, cola/silencio, sidechain POR BANDA y por prioridad,
// bolsillo de EQ para el sfx, paneo (ya con movimiento en las voces) y master a −14 LUFS con limitador de true peak.
//   mixdown({plan, style, music, buses, events}) → {master, stems, mixer, report}
// Los buses se devuelven en la escala del master (antes del limitador) para que se midan tal como suenan.
import { SR, clamp, lerp, db2lin, lin2db, bq, filt, split3, limiter, loudness, truePeak } from './dsp.mjs';
import { holdGate } from './score.mjs';

const CR = 1000;   // tasa de las curvas de control (Hz)
const mul = (a, f) => { for (let i = 0; i < a.length; i++) a[i] *= f; return a; };

// curva de ganancia (por muestra) del vacío: silencio en [t−vac, t) con fundido corto; el golpe entra limpio
function vacuumCurve(plan, N) {
  const g = new Float32Array(N).fill(1), fo = Math.round(0.025 * SR);
  for (const q of plan.impacts) {
    const a = Math.round((q.t - plan.vac) * SR), b = Math.round((q.t - 0.012) * SR);
    for (let i = Math.max(0, a - fo); i < Math.min(N, b); i++) g[i] = Math.min(g[i], i < a ? (a - i) / fo : 0);
  }
  return g;
}
// curvas de cesión por banda [dB ≤ 0] a 1 kHz: cada evento recorta la música en las bandas donde suena, tanto más cuanto mayor su prioridad
function duckCurves(events, style, dur) {
  const NC = Math.ceil(dur * CR) + 2, cut = [0, 1, 2].map(() => new Float32Array(NC)), amb = new Float32Array(NC);
  for (const e of events) {
    const D = style.sfx.duckDb[e.priority]; if (!D || e.bus === 'amb') continue;
    const lead = e.type === 'impact' ? 0 : (e.lead ?? 0) * 0.85, t0 = e.t - lead - (e.type === 'impact' ? 0.03 : 0.02), t1 = e.t + Math.max(0.5, Math.min(1.2, (e.dur ?? 0.5) * 0.6)), att = 0.008, rel = e.priority >= 3 ? 0.9 : 0.35;
    for (let k = Math.max(0, Math.floor((t0 - att) * CR)); k < Math.min(NC, Math.ceil((t1 + rel) * CR)); k++) {
      const t = k / CR, sh = t < t0 ? (t - (t0 - att)) / att : t <= t1 ? 1 : 1 - (t - t1) / rel, s = clamp(sh) ** 1.2;
      for (let b = 0; b < 3; b++) cut[b][k] = Math.min(cut[b][k], -D * (e.priority >= 2 && e.type !== 'impact' ? Math.max(0.7, e.bands[b]) : e.bands[b]) * s);
      amb[k] = Math.min(amb[k], -D * 0.5 * s);
    }
  }
  return { cut, amb };
}
const applyCurve = (x, curve) => { const y = new Float32Array(x.length); for (let i = 0; i < x.length; i++) { const p = (i / SR) * CR, k = Math.floor(p), f = p - k, d = curve[k] * (1 - f) + curve[k + 1] * f; y[i] = d === 0 ? x[i] : x[i] * db2lin(d); } return y; };

export function mixdown({ plan, style, music, buses, events }) {
  const N = music.L.length, M = style.mix, vac = vacuumCurve(plan, N), hg = holdGate(plan, style), hold = new Float32Array(N);
  for (let i = 0; i < N; i++) hold[i] = hg(i / SR);
  const gate = (s, ...gs) => { const f = (x) => { const y = Float32Array.from(x); for (const g of gs) for (let i = 0; i < N; i++) y[i] *= g[i]; return y; }; return { L: f(s.L), R: f(s.R) }; };
  // macro-dinámica del film (la intensidad manda también sobre sfx y ambiente; los impactos no se atenúan)
  const macro = new Float32Array(N); for (let i = 0; i < N; i++) macro[i] = db2lin(M.macro.floorDb * (1 - plan.intensity(i / SR) ** M.macro.pow));
  // buses en bruto → con compuertas estructurales
  const musicPre = gate(music, vac, hold), ambG = gate(buses.amb, vac, hold, macro), sfxG = gate(buses.sfx, vac, macro), hitG = gate(buses.hit, vac);   // el golpe (y la reverb de su suck-back) también respeta el vacío
  // sidechain por banda (música) y fullband suave (ambiente)
  const dc = duckCurves(events, style, N / SR), mb = [musicPre.L, musicPre.R].map((x) => split3(x)), duckedBands = mb.map((bands) => bands.map((x, b) => applyCurve(x, dc.cut[b])));
  const sum = (bands) => { const y = new Float32Array(N); for (const x of bands) for (let i = 0; i < N; i++) y[i] += x[i]; return y; };
  let musicPost = { L: sum(duckedBands[0]), R: sum(duckedBands[1]) };
  const pocket = bq('peak', M.musicPocket.f, M.musicPocket.q, M.musicPocket.db);                  // bolsillo de presencia: el sfx vive ahí
  musicPost = { L: filt(musicPost.L, pocket), R: filt(musicPost.R, pocket) };
  const ambPost = { L: applyCurve(ambG.L, dc.amb), R: applyCurve(ambG.R, dc.amb) };
  const hp = bq('hp', 90), lpA = bq('lp', 6000);                                                  // el sfx no ensucia los graves de la música; el ambiente no compite en agudos
  const sfxPost = { L: filt(sfxG.L, hp), R: filt(sfxG.R, hp) }, ambF = { L: filt(filt(ambPost.L, lpA), bq('hp', 30)), R: filt(filt(ambPost.R, lpA), bq('hp', 30)) };
  const gm = db2lin(M.bus.music), gs = db2lin(M.bus.sfx), ga = db2lin(M.bus.amb);
  const pre = { L: new Float32Array(N), R: new Float32Array(N) };
  for (let i = 0; i < N; i++) for (const c of ['L', 'R']) pre[c][i] = musicPost[c][i] * gm + (sfxPost[c][i] + hitG[c][i]) * gs + ambF[c][i] * ga;
  { const sub = bq('hp', 32); pre.L = filt(pre.L, sub); pre.R = filt(pre.R, sub); }                 // filtro subsónico: el sub no cabe en la mayoría de altavoces y se come el techo del limitador
  if (M.saturation > 0) for (let i = 0; i < N; i++) { pre.L[i] = Math.tanh(pre.L[i] * (1 + M.saturation)) / (1 + M.saturation); pre.R[i] = Math.tanh(pre.R[i] * (1 + M.saturation)) / (1 + M.saturation); }
  // master: ganancia hasta −14 LUFS integrados bajo limitador de ladrillo con techo de true peak
  const target = style.master.lufs, tpT = style.master.tp; let s = 1, ceil = db2lin(tpT) * 0.97, out = pre, meas = null;
  for (let it = 0; it < 14; it++) {
    const L = Float32Array.from(pre.L, (v) => v * s), R = Float32Array.from(pre.R, (v) => v * s); out = limiter(L, R, ceil); meas = loudness(out.L, out.R);
    const tp = truePeak(out.L, out.R), eI = target - meas.I, eT = tp - tpT;
    if (Math.abs(eI) < 0.04 && eT <= 0.02) break;
    if (eT > 0.02) ceil *= db2lin(-(eT + 0.05)); if (Math.abs(eI) >= 0.04) s *= db2lin(eI * 0.9);
  }
  const gdb = lin2db(s), sc = (b) => ({ L: mul(Float32Array.from(b.L), s * gm), R: mul(Float32Array.from(b.R), s * gm) });
  const sfxAll = { L: new Float32Array(N), R: new Float32Array(N) }; for (let i = 0; i < N; i++) { sfxAll.L[i] = (sfxPost.L[i] + hitG.L[i]) * gs * s; sfxAll.R[i] = (sfxPost.R[i] + hitG.R[i]) * gs * s; }
  return {
    master: out, report: { I: meas.I, LRA: meas.LRA, TP: truePeak(out.L, out.R), gain_dB: +gdb.toFixed(2), ceil_dBFS: +lin2db(ceil).toFixed(2), S: meas.S },
    stems: { music: sc(musicPost), sfx: sfxAll, amb: { L: mul(Float32Array.from(ambF.L), s * ga), R: mul(Float32Array.from(ambF.R), s * ga) } },
    mixer: { musicPre: sc(musicPre), musicPost: sc(musicPost) },
  };
}
