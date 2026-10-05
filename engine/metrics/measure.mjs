// Medición: film → métricas estándar (opus-metrics/1). Fuentes semánticas primero (timeline, cámara analítica, paleta, memoria, story,
// partitura/audio); los píxeles solo como método interno (color medio en los cortes). Ver registry.mjs para cada definición.
import fs from 'node:fs';
import { rootFrom } from '../paths.mjs';
import path from 'node:path';
import { REGISTRY, byId, SCHEMA, CONVENTIONS } from './registry.mjs';
import * as X from './mathx.mjs';
import * as C from './colorimetry.mjs';
import * as U from './units.mjs';
import * as A from './audiox.mjs';
import { camState } from '../camera.mjs';
import { filmFile } from '../filmid.mjs';

export const REF_FOCAL_MM = CONVENTIONS.refFocalMm.value, SENSOR_MM = CONVENTIONS.sensorWidthMm.value;
const R2D = 180 / Math.PI, BASE = { analítico: 0.95, semántico: 0.85, convención: 0.7, estimado: 0.6 };
const fin = (v) => Number.isFinite(v);

// ───── montaje (puro: testeable sin motor) ─────
export function boundariesOf(shots, D) {
  const b = [0, D]; for (const s of shots) { b.push(s.t[0], s.t[1]); } const u = [];
  for (const x of b.filter((v) => v >= -1e-9 && v <= D + 1e-9).sort((p, q) => p - q)) if (!u.length || x - u[u.length - 1] > 1e-6) u.push(Math.max(0, Math.min(D, x)));
  return u;
}
export function montage(shots, D, { fps = 30, beats = [], tolMs = CONVENTIONS.beatTolMs.value } = {}) {
  const b = boundariesOf(shots, D), l = b.slice(1).map((x, i) => x - b[i]), n = l.length, cuts = b.slice(1, -1);
  const asl = X.mean(l), tol = tolMs / 1000, q = 1 / (2 * fps);
  const hard = cuts.map((c) => { const s = shots.filter((s) => Math.abs(s.t[1] - c) < 1e-6).pop(); return ['cut', 'scale-cut', 'hold-cut'].includes((s?.transition_out ?? 'cut').toLowerCase()); });
  const per = beats.length > 1 ? X.median(beats.slice(1).map((x, i) => x - beats[i])) : null;
  const near = cuts.map((c) => (beats.length ? Math.min(...beats.map((x) => Math.abs(x - c))) : Infinity)), k = near.filter((d) => d <= tol + 1e-9).length;
  const p0 = per ? Math.min(1, (2 * tol) / per) : null;
  return { b, l, n, cuts, asl, msl: X.median(l), cv: n > 1 ? X.std(l) / asl : 0, rate: (60 * (n - 1)) / D, hard: cuts.length ? hard.filter(Boolean).length / cuts.length : null, hardN: hard.filter(Boolean).length,
    onBeat: beats.length && cuts.length ? k / cuts.length : null, onBeatK: k, p0, z: p0 && p0 < 1 && cuts.length ? (k - cuts.length * p0) / Math.sqrt(cuts.length * p0 * (1 - p0)) : null, quant: q };
}

// ───── cámara analítica ─────
function camSamples(film, dt, f0) {
  const W = film.width, Hh = U.visibleHeight(film), hs = SENSOR_MM / (W / Hh), S = [];
  for (const sh of film.shots) {
    const n = Math.max(3, Math.round((sh.t[1] - sh.t[0]) / dt)), h = (sh.t[1] - sh.t[0]) / n, c = [];
    for (let i = 0; i <= n; i++) c.push(camState(sh, sh.t[0] + i * h, film, { shake: false }));
    const th = (s) => [Math.atan(((s.x / W) * SENSOR_MM) / (f0 * s.z)) * R2D, Math.atan(((s.y / film.height) * hs) / (f0 * s.z)) * R2D];
    for (let i = 1; i < n; i++) { const a = th(c[i - 1]), b = th(c[i + 1]);
      S.push({ shot: sh.id, t: sh.t[0] + i * h, z: c[i].z, pan: Math.hypot(b[0] - a[0], b[1] - a[1]) / (2 * h), roll: Math.abs(c[i + 1].r - c[i - 1].r) / (2 * h), zoom: Math.abs(Math.log2(c[i + 1].z / c[i - 1].z)) / (2 * h), focal: f0 * c[i].z, fov: 2 * Math.atan(SENSOR_MM / (2 * f0 * c[i].z)) * R2D, hs }); }
  }
  return S;
}
export function cameraStats(film, { dt = 1 / 240, f0 = REF_FOCAL_MM } = {}) {
  const S = camSamples(film, dt, f0); if (!S.length) return null; const m = (k) => X.mean(S.map((s) => s[k])), q = (k) => X.quantile(S.map((s) => s[k]), 0.95);
  const th = CONVENTIONS.moveThreshold.value;
  return { focal: m('focal'), fov: m('fov'), pan: m('pan'), panP95: q('pan'), roll: m('roll'), zoom: m('zoom'), zoomP95: q('zoom'), n: S.length, S,
    moving: S.filter((s) => s.pan > th || s.roll > th || s.zoom > 0.05).length / S.length };
}
function shakeRMS(film) {
  const W = film.width, e = [];
  for (const sh of film.shots) { if (!((sh.cam?.shake ?? film.S.camera.shake ?? 0) > 0)) continue; for (let t = sh.t[0]; t <= sh.t[1]; t += 1 / 60) { const a = camState(sh, t, film), b = camState(sh, t, film, { shake: false }); e.push(Math.atan((((a.x - b.x) / W) * SENSOR_MM) / (REF_FOCAL_MM * b.z)) * R2D); } }
  return e.length ? Math.sqrt(X.mean(e.map((v) => v * v))) : 0;
}

// ───── muestreo de cajas (render a baja resolución; coordenadas normalizadas) ─────
export async function sampleFilm(R, fs_, extra = []) {
  const { film, W, H } = R, bar = (film.S.grade.letterbox && film.width / film.S.grade.letterbox < film.height ? (film.height - film.width / film.S.grade.letterbox) / 2 : 0) * (H / film.height), Hv = H - 2 * bar, aspect = W / Hv;
  const grab = (t) => { const bx = R.frame(t), foci = [], texts = [], occ = {};
    for (const b of bx) { const k0 = `${b.shot}|${b.kind}|${b.label}`, k = k0 + '#' + (occ[k0] = (occ[k0] ?? -1) + 1);
      if (b.kind === 'focus') foci.push({ key: k, shot: b.shot, label: b.label, weight: b.weight ?? 1, bleed: !!b.bleed, x0: b.x / W, x1: (b.x + b.w) / W, y0: (b.y - bar) / Hv, y1: (b.y + b.h - bar) / Hv, cx: (b.x + b.w / 2) / W, cy: (b.y + b.h / 2) / W, h: b.h / Hv, w: b.w / W });
      else if (b.kind === 'text') texts.push({ key: k, shot: b.shot, label: String(b.label ?? ''), role: b.role, size: b.size, em: (b.sizePx ?? 0) / Hv, x: b.x / W, y: (b.y - bar) / Hv, w: b.w / W, h: b.h / Hv }); }
    return { t, foci, texts }; };
  const n = Math.floor(film.duration * fs_ - 1e-9), frames = []; for (let i = 0; i <= n; i++) frames.push(grab(Math.min(film.duration - 1e-4, i / fs_)));
  const meanLab = (t) => { R.frame(t); const d = R.ctx.getImageData(0, 0, W, H).data; let r = 0, g = 0, b = 0; const l = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    for (let k = 0; k < d.length; k += 4) { r += l(d[k]); g += l(d[k + 1]); b += l(d[k + 2]); } const N = d.length / 4; r /= N; g /= N; b /= N;
    const X_ = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b, Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b, Z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b, f = (v) => (v > 216 / 24389 ? Math.cbrt(v) : (24389 / 27 * v + 16) / 116);
    return [116 * f(Y) - 16, 500 * (f(X_ / 0.95047) - f(Y)), 200 * (f(Y) - f(Z / 1.08883))]; };
  const cutProbes = extra.map((c) => { const d = 0.5 / fs_, a = grab(Math.max(0, c - d)), b = grab(Math.min(film.duration - 1e-4, c + d)); return { c, a, b, la: meanLab(Math.max(0, c - d)), lb: meanLab(Math.min(film.duration - 1e-4, c + d)) }; });
  return { frames, cutProbes, W, H, Hv, aspect, bar, fs: fs_ };
}
const union = (fs) => { const o = fs.filter((f) => !f.bleed); if (!o.length) return null; const x0 = Math.min(...o.map((f) => f.x0)), x1 = Math.max(...o.map((f) => f.x1)), y0 = Math.min(...o.map((f) => f.y0)), y1 = Math.max(...o.map((f) => f.y1)); return { x0, x1, y0, y1, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }; };
const groupBy = (arr, f) => { const m = new Map(); for (const a of arr) { const k = f(a); if (!m.has(k)) m.set(k, []); m.get(k).push(a); } return m; };
// Derivadas por diferencias centrales con paso `st` muestras sobre pistas (identidad shot|etiqueta). → por muestra: v, a, j (ponderadas), rate de escala
export function trackKinematics(frames, fs_, aspect, st = 1) {
  const tr = new Map(); frames.forEach((fr, i) => { for (const f of fr.foci) { if (!tr.has(f.key)) tr.set(f.key, new Map()); tr.get(f.key).set(i, f); } });
  const h = st / fs_, acc = frames.map(() => ({ v: [0, 0], a: [0, 0], j: [0, 0], s: [0, 0] })), P = (T, i) => T.get(i);
  for (const T of tr.values()) for (const [i, f] of T) {
    const w = f.weight; if (!(w > 0)) continue; const p1 = P(T, i + st), m1 = P(T, i - st); if (!p1 || !m1) continue;
    const sp = Math.hypot(p1.cx - m1.cx, p1.cy - m1.cy) / (2 * h), a = acc[i]; a.v[0] += w * sp; a.v[1] += w;
    const ac = Math.hypot(p1.cx - 2 * f.cx + m1.cx, p1.cy - 2 * f.cy + m1.cy) / (h * h); a.a[0] += w * ac * ac; a.a[1] += w;
    if (f.h > 0 && p1.h > 0 && m1.h > 0) { const r = (Math.log10(p1.h) - Math.log10(m1.h)) / (2 * h); a.s[0] += w * r * r; a.s[1] += w; }
    const p2 = P(T, i + 2 * st), m2 = P(T, i - 2 * st); if (p2 && m2) { const jx = (p2.cx - 2 * p1.cx + 2 * m1.cx - m2.cx) / (2 * h ** 3), jy = (p2.cy - 2 * p1.cy + 2 * m1.cy - m2.cy) / (2 * h ** 3); a.j[0] += w * (jx * jx + jy * jy); a.j[1] += w; }
  }
  const col = (k, f) => acc.map((a) => (a[k][1] > 0 ? f(a[k][0] / a[k][1]) : null)).filter((v) => v !== null);
  return { v: col('v', (x) => x), a: col('a', Math.sqrt), j: col('j', Math.sqrt), s: col('s', Math.sqrt), vPerFrame: acc.map((a) => (a.v[1] > 0 ? a.v[0] / a.v[1] : null)) };
}

// ───── curva de tensión y descriptores funcionales ─────
export function curveDescriptors(v) {                                // v: N muestras en [0,1] sobre τ=(i+½)/N
  const N = v.length, pk = X.peaks(v, 0.15), ip = v.indexOf(Math.max(...v)), mo = X.moments(v), dp = X.dominantPeriod(v);
  const prom = (() => { const L = Math.min(...v.slice(0, ip + 1)), Rr = Math.min(...v.slice(ip)); return v[ip] - Math.max(L, Rr); })();
  let best = { rmse: Infinity, tc: 0.6 }; for (let tc = 0.3; tc <= 0.9001; tc += 0.01) { const f = v.map((_, i) => { const u = (i + 0.5) / N; return u <= tc ? 0.15 + (0.85 * u) / tc : 1 - (0.8 * (u - tc)) / (1 - tc); }); const r = X.l2(v, f); if (r < best.rmse) best = { rmse: r, tc }; }
  let on = ip; while (on > 0 && v[on] >= 0.25) on--; let off = ip; while (off < N - 1 && v[off] >= 0.25) off++;
  const tau = (i) => (i + 0.5) / N;
  return { peakPos: tau(ip), peakProm: prom, peaks: pk.length, centroid: mo.centroid, spread: mo.spread, skew: mo.skew, entropy: X.entropyNorm(v), periodicity: dp ? dp.r : 0, periodLag: dp ? dp.lag / N : null, freytag: best.rmse, freytagClimax: best.tc,
    phases: { exposicion: 100 * tau(on), ascenso: 100 * (tau(ip) - tau(on)), descenso: 100 * (tau(off) - tau(ip)), desenlace: 100 * (1 - tau(off)) } };
}
function tensionFrom(comps, T, N = 100) {                           // comps: {name: Float64Array|Array sobre grid tg}; → curva min-max
  const names = Object.keys(comps).filter((k) => { const c = comps[k]; return Math.max(...c) - Math.min(...c) > 1e-9; }); if (!names.length) return null;
  const P = names.map((k) => X.pit(comps[k])), m = comps[names[0]].map((_, j) => X.mean(P.map((p) => p[j])));
  return { names, v: X.resample(Array.from(m, (_, j) => j), X.minmax(X.gauss(m.map((_, j) => j), m, 1.5 * 0 + 6)), m.length - 1, N), raw: m };
}

// ───── audio ─────
export async function loadAudio(film, timeline, { audio = 'auto', cacheDir } = {}) {
  if (audio === false) return null; if (audio && audio !== 'auto') return audio;
  const ROOT = rootFrom(import.meta.url, 2), { resolveTimeline } = await import('../params.mjs'), { assertTimeline } = await import('../schema.mjs');
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, timeline), 'utf8')), tl = resolveTimeline(assertTimeline(raw, timeline), timeline).timeline;
  if (!tl.sound) { const f = tl.audio && path.join(ROOT, tl.audio); return f && fs.existsSync(f) ? { ...A.readWav(f), source: tl.audio } : null; }
  const S = await import('../sound.mjs'), { wavBuffer } = await import('../dsp.mjs'), suf = S.mixName(timeline), h = S.mixHash(tl), mixf = path.join(ROOT, `data/mix${suf}.wav`);
  let prev = null; try { prev = JSON.parse(fs.readFileSync(path.join(ROOT, `out/sfx${suf}.json`), 'utf8')).inputs; } catch {}
  if (prev === h && fs.existsSync(mixf)) return { ...A.readWav(mixf), source: `data/mix${suf}.wav` };
  const cd = cacheDir ?? path.join(ROOT, 'out/metrics/cache'), cf = path.join(cd, `${film.title ?? 'film'}-${h}.wav`.replace(/[^\w.-]/g, '_'));
  if (fs.existsSync(cf)) return { ...A.readWav(cf), source: 'cache:' + path.basename(cf) };
  const b = S.build(tl); fs.mkdirSync(cd, { recursive: true }); fs.writeFileSync(cf, wavBuffer(b.master.L, b.master.R)); return { ...A.readWav(cf), source: 'build:' + path.basename(cf), key: b.partitura?.meta?.key };
}

// ───── ensamblado ─────
export async function measureTimeline(timeline, { sampleFps = 'auto', renderW = 192, audio = 'auto', B = 300, memoria, story } = {}) {
  const prevEnv = process.env.OPUS_TIMELINE; process.env.OPUS_TIMELINE = timeline;
  try {
    const { makeRenderer } = await import('../render.mjs');
    const probe = await makeRenderer({ size: `${renderW}x${Math.max(2, Math.round((renderW * 9) / 16 / 2) * 2)}`, grade: false }), film0 = probe.film;
    const rh = Math.max(2, Math.round((renderW * film0.height) / film0.width / 2) * 2), R = renderW === 0 ? probe : await makeRenderer({ size: `${renderW}x${rh}`, grade: false }), film = R.film, D = film.duration;
    const fs_ = sampleFps === 'auto' ? Math.max(2, Math.min(8, Math.round((400 / D) * 10) / 10)) : sampleFps;   // el render del motor domina el coste (~0,1 s/fotograma): ≤ ~400 muestras
    return await assemble(R, film, timeline, { sampleFps: fs_, audio, B, memoria, story });
  } finally { if (prevEnv === undefined) delete process.env.OPUS_TIMELINE; else process.env.OPUS_TIMELINE = prevEnv; }
}
async function assemble(R, film, timeline, { sampleFps, audio, B, memoria, story }) {
  const D = film.duration, out = [], bb = (a, o = {}) => X.bootstrapCI(a, X.mean, { B, ...o });
  const put = (id, value, o = {}) => { const r = byId[id]; if (!r) throw new Error('métrica fuera de registro: ' + id);
    const ci = value == null || !o.ci ? null : o.ci.map((x) => +x.toFixed(6)); let conf = value == null ? 0 : BASE[r.cls] * Math.min(1, (o.n ?? 99) / (o.nmin ?? 4));
    if (ci && fin(value) && Math.abs(value) > 1e-9) conf *= 1 - Math.min(0.5, (ci[1] - ci[0]) / 2 / Math.abs(value)); if (o.conf != null) conf = Math.min(conf, o.conf);
    out.push({ id, name: r.name, domain: r.domain, value: typeof value === 'number' ? +value.toFixed(6) : value, unit: r.unit, ci, ciLevel: ci ? 0.95 : null, method: o.method ?? r.estimator, confidence: +conf.toFixed(3), n: o.n ?? null, ...(o.notes ? { notes: o.notes } : {}), ...(o.sens ? { sensitivity: o.sens } : {}) }); };
  const nd = (id, why) => put(id, null, { notes: 'sin datos: ' + why });
  const pad = (v, e) => [v - e, v + e];
  // montaje
  const mt = montage(film.shots, D, { fps: film.fps, beats: film.beatTimes });
  const lci = bb(mt.l, { seed: 1 }) ?? [mt.asl, mt.asl], qe = mt.quant / Math.sqrt(12) * Math.sqrt(2) / Math.sqrt(mt.n);
  put('montaje.asl', mt.asl, { ci: [lci[0] - qe, lci[1] + qe], n: mt.n, nmin: 3, notes: `D=${D} s, n=${mt.n}` });
  put('montaje.msl', mt.msl, { ci: (X.bootstrapCI(mt.l, X.median, { B, seed: 2 }) ?? [mt.msl, mt.msl]).map((x, i) => x + (i ? 1 : -1) * mt.quant), n: mt.n, nmin: 3 });
  put('montaje.cutRate', mt.rate, { ci: X.poissonCI(mt.n - 1).map((k) => (60 * k) / D), n: mt.n - 1, nmin: 3 });
  put('montaje.slCV', mt.cv, { ci: X.bootstrapCI(mt.l, (a) => (a.length > 1 ? X.std(a) / X.mean(a) : 0), { B, seed: 3 }), n: mt.n, nmin: 4 });
  mt.hard == null ? nd('montaje.hardCutRatio', 'sin cortes') : put('montaje.hardCutRatio', 100 * mt.hard, { ci: X.wilson(mt.hardN, mt.cuts.length).map((x) => 100 * x), n: mt.cuts.length });
  if (mt.onBeat == null) { nd('montaje.cutOnBeat', 'sin rejilla de pulsos'); nd('montaje.cutOnBeatZ', 'sin rejilla de pulsos'); }
  else { put('montaje.cutOnBeat', 100 * mt.onBeat, { ci: X.wilson(mt.onBeatK, mt.cuts.length).map((x) => 100 * x), n: mt.cuts.length, notes: `τ=${CONVENTIONS.beatTolMs.value} ms; azar esperado p₀=${mt.p0?.toFixed(3)}` });
    mt.z == null ? nd('montaje.cutOnBeatZ', 'pulso demasiado denso (p₀≥1) o sin cortes') : put('montaje.cutOnBeatZ', mt.z, { ci: [mt.z - 1, mt.z + 1], n: mt.cuts.length, notes: 'banda ±1 σ de la aproximación normal' }); }
  // cámara
  const c1 = cameraStats(film), c2 = cameraStats(film, { dt: 1 / 120 }), cs = (f, g) => f && g ? [Math.abs(f - g) / 3 + 1e-9] : [0];
  const sens = (k, f) => ({ refFocalMm: CONVENTIONS.refFocalMm.range.map((m) => { const c = cameraStats(film, { f0: m, dt: 1 / 60 }); return c ? +f(c).toFixed(5) : null; }) });
  if (c1) {
    const cp = (id, v, v2, f, extra) => put(id, v, { ci: pad(v, Math.abs(v - v2) / 3 + 1e-9), n: c1.n, sens: f ? sens(id, f) : undefined, ...extra });
    cp('camara.focalEq', c1.focal, c2.focal, (c) => c.focal); cp('camara.fov', c1.fov, c2.fov, (c) => c.fov); cp('camara.panSpeed', c1.pan, c2.pan, (c) => c.pan); cp('camara.panSpeedP95', c1.panP95, c2.panP95, (c) => c.panP95);
    cp('camara.rollRate', c1.roll, c2.roll); cp('camara.zoomRate', c1.zoom, c2.zoom); cp('camara.zoomRateP95', c1.zoomP95, c2.zoomP95);
    put('camara.motionFraction', 100 * c1.moving, { ci: pad(100 * c1.moving, Math.abs(c1.moving - c2.moving) * 100 / 3 + 0.01), n: c1.n });
    const sh = shakeRMS(film); put('camara.shake', sh, { ci: sh ? [sh * 0.8, sh * 1.2] : [0, 0], n: c1.n });
  } else for (const id of byId ? REGISTRY.filter((m) => m.domain === 'camara').map((m) => m.id) : []) nd(id, 'sin shots');
  // muestreo de cajas
  const cutsAll = mt.cuts, S = await sampleFilm(R, sampleFps, cutsAll.filter((_, i) => true).slice(0, 80)), fr = S.frames, fs_ = sampleFps;
  // plano
  const perShot = new Map(); for (const f of fr) for (const [sid, g] of groupBy(f.foci, (x) => x.shot)) { const u = union(g); if (u) { if (!perShot.has(sid)) perShot.set(sid, []); perShot.get(sid).push(u.h); } }
  const sc = film.shots.filter((s) => perShot.has(s.id)).map((s) => ({ s, f: X.median(perShot.get(s.id)), w: s.t[1] - s.t[0] })).map((o) => ({ ...o, i: U.scaleIndex(o.f) }));
  if (sc.length) {
    const W_ = X.sum(sc.map((o) => o.w)), idx = X.sum(sc.map((o) => o.i * o.w)) / W_, boot = X.bootstrapCI(sc.map((o) => o.i), X.mean, { B, seed: 4 }) ?? [idx, idx];
    put('plano.scaleIndex', idx, { ci: boot, n: sc.length, nmin: 3, notes: 'ECU=0 … ELS=6; ' + sc.map((o) => `${o.s.id}:${U.scaleName(o.f)}(${(o.f * 100).toFixed(0)}%)`).join(' '), sens: { umbralFx: [0.9, 1.1].map((k) => +(X.sum(sc.map((o) => U.scaleIndex(o.f * k) * o.w)) / W_).toFixed(3)) } });
    const mix = {}; for (const [n] of U.SCALES) mix[n] = 0; for (const o of sc) mix[U.scaleName(o.f)] += (100 * o.w) / W_; put('plano.scaleMix', Object.fromEntries(Object.entries(mix).map(([k, v]) => [k, +v.toFixed(2)])), { n: sc.length, nmin: 3 });
    const dc = sc.filter((o) => U.declaredScale(o.s.size) != null), ag = dc.filter((o) => Math.abs(o.i - U.declaredScale(o.s.size)) <= 1).length;
    dc.length ? put('plano.declaredAgreement', (100 * ag) / dc.length, { ci: X.wilson(ag, dc.length).map((x) => 100 * x), n: dc.length, notes: 'sujeto abstracto: la medida es del conjunto de focos no sangrados' }) : nd('plano.declaredAgreement', 'ningún shot declara size');
    // dolly: usa f del sujeto
    if (c1) { const dd = []; for (const o of sc) { const ss = c1.S.filter((s) => s.shot === o.s.id); if (ss.length < 3) continue; const zm = X.median(ss.map((s) => s.z)), fs0 = o.f / zm, hs = ss[0].hs; const D_ = ss.map((s) => REF_FOCAL_MM / (hs * fs0 * s.z)), dt = (o.s.t[1] - o.s.t[0]) / (ss.length + 1);
      for (let i = 1; i < D_.length - 1; i++) dd.push(Math.abs(D_[i + 1] - D_[i - 1]) / (2 * dt)); }
      dd.length ? put('camara.dollySpeed', X.mean(dd), { ci: X.blockBootstrapCI(dd, X.mean, { block: 20, B, seed: 5 }), n: dd.length, conf: 0.5, notes: 'asume zoom = dolly; depende de f₀ y de la escala del sujeto' }) : nd('camara.dollySpeed', 'sin sujeto');
    }
  } else for (const id of ['plano.scaleIndex', 'plano.scaleMix', 'plano.declaredAgreement', 'camara.dollySpeed']) if (!out.find((m) => m.id === id)) nd(id, 'el film no registra focos (api.morph/focus)');
  // movimiento / escala
  const K1 = trackKinematics(fr, fs_, S.aspect, 1), K2 = trackKinematics(fr, fs_, S.aspect, 2), blk = Math.max(2, Math.round(fs_));
  const agg = (id, a1, a2, f, o = {}) => { if (a1.length < 4) return nd(id, 'pocas pistas de foco (n<4)'); const v = f(a1), v2 = a2.length >= 4 ? f(a2) : v, bc = X.blockBootstrapCI(a1, f, { block: blk, B, seed: o.seed ?? 6 }) ?? [v, v], e = Math.abs(v - v2) / 3; put(id, v, { ci: [bc[0] - e, bc[1] + e], n: a1.length, notes: `ε Richardson = ${e.toExponential(1)}`, ...o }); };
  const rms = (a) => Math.sqrt(X.mean(a.map((x) => x * x)));
  agg('movimiento.speed', K1.v, K2.v, X.mean); agg('movimiento.speedP95', K1.v, K2.v, (a) => X.quantile(a, 0.95)); agg('movimiento.accel', K1.a, K2.a, rms); agg('movimiento.jerk', K1.j, K2.j, rms); agg('escala.logRate', K1.s, K2.s, rms);
  { const js = []; for (const p of S.cutProbes) { const a = union(p.a.foci), b = union(p.b.foci); if (a && b && a.h > 0 && b.h > 0) js.push(Math.abs(Math.log10(b.h / a.h))); }
    js.length ? put('escala.cutJump', X.median(js), { ci: X.bootstrapCI(js, X.median, { B, seed: 7 }), n: js.length, nmin: 3 }) : nd('escala.cutJump', 'sin cortes con sujeto a ambos lados'); }
  // composición
  const comp = { th: [], hr: [], lr: [], bal: [] }, diag2 = Math.hypot(S.aspect, 1) / 2, pts = [[1 / 3, 1 / 3], [2 / 3, 1 / 3], [1 / 3, 2 / 3], [2 / 3, 2 / 3]];
  const ush = fr.map((f) => groupBy(f.foci, (x) => x.shot)); const uni = ush.map((m) => new Map([...m].map(([k, g]) => [k, union(g)]).filter(([, u]) => u)));
  fr.forEach((f, i) => { for (const [sid, u] of uni[i]) { const X_ = u.cx * S.aspect, Y = u.cy; comp.th.push((100 * Math.min(...pts.map(([px, py]) => Math.hypot(X_ - px * S.aspect, Y - py)))) / diag2); comp.hr.push(100 * u.y0);
      const a = uni[i - 1]?.get(sid), b = uni[i + 1]?.get(sid); if (a && b) { const vx = (b.cx - a.cx) / (2 / fs_); if (Math.abs(vx) > 0.02) comp.lr.push(100 * (vx > 0 ? 1 - u.x1 : u.x0)); } }
    const ms = [...f.foci.filter((x) => !x.bleed).map((x) => ({ m: x.weight * x.w * x.h, X: ((x.x0 + x.x1) / 2) * S.aspect, Y: (x.y0 + x.y1) / 2 })), ...f.texts.map((x) => ({ m: 0.5 * x.w * x.h, X: (x.x + x.w / 2) * S.aspect, Y: x.y + x.h / 2 }))], M = X.sum(ms.map((q) => q.m));
    if (M > 0) comp.bal.push((100 * Math.hypot(X.sum(ms.map((q) => q.m * (q.X - S.aspect / 2))), X.sum(ms.map((q) => q.m * (q.Y - 0.5)))) / M) / diag2); });
  for (const [id, a] of [['composicion.thirdsOffset', comp.th], ['composicion.headroom', comp.hr], ['composicion.leadRoom', comp.lr], ['composicion.balance', comp.bal]]) a.length >= 4 ? put(id, X.mean(a), { ci: X.blockBootstrapCI(a, X.mean, { block: blk, B, seed: 8 }), n: a.length }) : nd(id, 'sin sujeto/movimiento suficiente');
  // color (paleta)
  const pal = film.palette, roles = Object.entries(pal).filter(([, v]) => /^#[0-9a-f]{6}$/i.test(v)), labs = roles.map(([, v]) => C.hex2lab(v)), chrom = roles.filter((_, i) => C.labC(labs[i]) >= 8).map(([, v]) => v);
  const distinct = []; for (const h of chrom) if (!distinct.some((d) => C.dE00(d, h) <= 5)) distinct.push(h);
  put('color.paletteNeutrals', roles.length - chrom.length, { n: roles.length, notes: roles.map(([k], i) => `${k}:C*=${C.labC(labs[i]).toFixed(1)}`).join(' '), ci: [roles.filter((_, i) => C.labC(labs[i]) < 4).length, roles.filter((_, i) => C.labC(labs[i]) < 12).length], nmin: 1 });
  put('color.paletteAccents', distinct.length, { n: roles.length, nmin: 1, ci: [distinct.length, distinct.length] }); put('color.harmony', C.harmony(distinct), { n: distinct.length, nmin: 1 });
  const prs = []; for (let i = 0; i < roles.length; i++) for (let j = i + 1; j < roles.length; j++) prs.push(C.deltaE2000(labs[i], labs[j])); put('color.meanDeltaE', X.mean(prs), { ci: X.bootstrapCI(prs, X.mean, { B, seed: 9 }), n: prs.length });
  put('color.inkPaperContrast', C.wcag(pal.ink, pal.paper), { ci: [C.wcag(pal.ink, pal.paper), C.wcag(pal.ink, pal.paper)], nmin: 1 }); put('color.inkPaperLc', C.apca(pal.ink, pal.paper), { ci: [C.apca(pal.ink, pal.paper), C.apca(pal.ink, pal.paper)], nmin: 1 });
  pal.accent ? put('color.accentContrast', C.wcag(pal.accent, pal.paper), { ci: [C.wcag(pal.accent, pal.paper), C.wcag(pal.accent, pal.paper)], nmin: 1 }) : nd('color.accentContrast', 'sin rol accent');
  { const dE = S.cutProbes.map((p) => C.deltaE2000(p.la, p.lb)); dE.length ? put('color.cutDeltaE', X.median(dE), { ci: X.bootstrapCI(dE, X.median, { B, seed: 10 }), n: dE.length, nmin: 3 }) : nd('color.cutDeltaE', 'sin cortes'); }
  // texto
  const THETA = 2 * Math.atan(1 / (2 * CONVENTIONS.viewingH.value)) * R2D * 60, xs = []; for (const f of fr) for (const t of f.texts) if (t.em > 0) xs.push(CONVENTIONS.xHeightEm.value * t.em * THETA);
  if (xs.length >= 4) { put('texto.xHeight', X.median(xs), { ci: X.blockBootstrapCI(xs, X.median, { block: blk, B, seed: 11 }), n: xs.length, notes: `θ_pantalla=${THETA.toFixed(0)}′` }); const below = xs.filter((x) => x < 16).length; put('texto.belowMinFraction', (100 * below) / xs.length, { ci: X.wilson(below, xs.length).map((x) => 100 * x), n: xs.length }); } else { nd('texto.xHeight', 'sin texto'); nd('texto.belowMinFraction', 'sin texto'); }
  const runs = new Map(); fr.forEach((f, i) => { for (const t of f.texts) { if (t.role === 'math' || t.label.trim().split(/\s+/).length < 2) continue; const r = runs.get(t.key) ?? []; (r.at(-1) && r.at(-1)[1] === i - 1 ? (r.at(-1)[1] = i) : r.push([i, i])); runs.set(t.key, r); } });
  const ev = []; for (const [k, rs] of runs) { const label = k.split('|')[2].replace(/#\d+$/, ''); for (const [a, b] of rs) { const dt = (b - a + 1) / fs_, w = label.trim().split(/\s+/).length; ev.push({ wpm: w / (dt / 60), cps: label.length / dt, dt }); } }
  if (ev.length >= 2) { for (const [id, k] of [['texto.readingRate', 'wpm'], ['texto.readingCps', 'cps']]) { const a = ev.map((e) => e[k]), v = X.quantile(a, 0.9), rel = 1 / (fs_ * X.median(ev.map((e) => e.dt))); put(id, v, { ci: [v * (1 - rel), v * (1 + rel)], n: ev.length, nmin: 3, notes: `Δt muestreado ±${(1 / fs_).toFixed(2)} s; ${ev.length} eventos` }); } } else { nd('texto.readingRate', 'menos de 2 eventos de texto con ≥ 2 palabras'); nd('texto.readingCps', 'menos de 2 eventos de texto'); }
  // información
  const Ns = fr.map((f) => { const ticks = f.texts.filter((t) => ['body', 'label'].includes(t.role) && t.label.length <= 2), reg = f.texts.length - ticks.length; return f.foci.length + reg + (ticks.length ? 1 : 0); });
  put('informacion.simultaneous', X.mean(Ns), { ci: X.blockBootstrapCI(Ns, X.mean, { block: blk, B, seed: 12 }), n: Ns.length, notes: `p95=${X.quantile(Ns, 0.95).toFixed(1)}` });
  { const k = Ns.filter((n) => n > CONVENTIONS.workingMemory.value).length; put('informacion.overload', (100 * k) / Ns.length, { ci: X.wilson(k, Ns.length).map((x) => 100 * x), n: Ns.length }); }
  const memf = memoria ?? filmFile('memoria.json', 'data/memoria.json', timeline), ROOT = rootFrom(import.meta.url, 2), mem = fs.existsSync(path.join(ROOT, memf)) ? JSON.parse(fs.readFileSync(path.join(ROOT, memf), 'utf8')) : null;
  let openF = null;
  if (mem?.conceptos?.length) {
    const shotT0 = (id) => film.shots.find((s) => s.id === id)?.t[0], intro = mem.conceptos.map((c) => Math.min(...[c.abre, ...(c.estados ?? []).map((e) => e.t?.[0]), ...(c.anclas ?? []).map((a) => (a.t ? a.t[0] : shotT0(a.shot)))].filter(fin))).filter(fin), K = intro.length;
    put('informacion.conceptRate', (60 * K) / D, { ci: X.poissonCI(K).map((k) => (60 * k) / D), n: K, nmin: 3, notes: `${K} conceptos` });
    const iv = mem.conceptos.filter((c) => fin(c.abre) && fin(c.resuelve?.t)).map((c) => [Math.max(0, c.abre), Math.min(D, c.resuelve.t)]); openF = (t) => iv.filter(([a, b]) => t >= a && t < b).length;
    put('informacion.openQuestions', X.sum(iv.map(([a, b]) => Math.max(0, b - a))) / D, { ci: [X.sum(iv.map(([a, b]) => Math.max(0, b - a))) / D, X.sum(iv.map(([a, b]) => Math.max(0, b - a))) / D], n: iv.length, nmin: 1, notes: `${iv.length} preguntas/tensiones abiertas` });
  } else { nd('informacion.conceptRate', 'sin memoria.json'); nd('informacion.openQuestions', 'sin memoria.json'); }
  // historia
  const stf = story ?? filmFile('story.json', film.timelinePath && /data\/timeline\.json$/.test(film.timelinePath) ? 'data/story.json' : null, timeline), st = stf && fs.existsSync(path.join(ROOT, stf)) ? JSON.parse(fs.readFileSync(path.join(ROOT, stf), 'utf8')) : null;
  if (st?.beats?.length > 1) { const k = st.beats.slice(1).filter((b) => ['pero', 'por lo tanto', 'but', 'therefore'].includes(String(b.link ?? '').toLowerCase())).length, n = st.beats.length - 1; put('historia.causalLinks', (100 * k) / n, { ci: X.wilson(k, n).map((x) => 100 * x), n, nmin: 4 }); } else nd('historia.causalLinks', 'sin story.json con ≥ 2 beats');
  // medio
  put('medio.type', film.medium?.support?.kind ?? 'digital procedural', { n: 1, nmin: 1 });
  { const g = film.medium?.grain?.amount ?? film.S.grade?.grain ?? 0, iso = 100 * (g / 0.02) ** 2; put('medio.grainISO', iso, { ci: [iso / 4, iso * 4], n: 1, nmin: 1, notes: `g=${g}; ancla g100=0,02 (×2 ⇒ ISO ×4)` }); }
  // audio
  const aud = await loadAudio(film, timeline, { audio }), series = {};
  const tg = Array.from({ length: Math.floor(D / 0.25) + 1 }, (_, j) => j * 0.25);
  let Mser = null;
  if (aud) {
    if (aud.sr !== 48000) throw new Error('el audio debe estar a 48 kHz (BS.1770 en dsp.mjs)');
    const ld = A.loudnessOf(aud.L, aud.R); Mser = ld.M;
    put('audio.loudness', ld.I, { ci: [ld.I - 0.05, ld.I + 0.05], n: ld.M.length, nmin: 10, notes: 'fuente: ' + aud.source }); put('audio.lra', ld.LRA, { ci: [Math.max(0, ld.LRA - 1), ld.LRA + 1], n: ld.S.length, nmin: 10 });
    put('audio.truePeak', ld.TP, { ci: [ld.TP - 0.3, ld.TP + 0.3], n: aud.L.length, nmin: 1 }); put('audio.plr', ld.PLR, { ci: [ld.PLR - 0.35, ld.PLR + 0.35], n: aud.L.length, nmin: 1 }); put('audio.r128dev', ld.I + 23, { ci: [ld.I + 22.95, ld.I + 23.05], n: ld.M.length, nmin: 10 });
    const tp = A.tempoBPM(aud.L, aud.R, aud.sr); tp ? put('audio.tempo', tp.bpm, { ci: tp.ci, n: Math.max(1, tp.n), nmin: 1, notes: `declarado en el film: ${film.bpm || 'n/d'} BPM` }) : nd('audio.tempo', 'sin pulso detectable');
    const ky = A.keyKS(aud.L, aud.R, aud.sr); put('audio.key', ky.name, { n: 1, nmin: 1, conf: Math.max(0.2, Math.min(0.8, ky.r)), notes: `r=${ky.r.toFixed(2)} margen=${ky.margin.toFixed(3)}${aud.key ? `; partitura declara ${aud.key.root} ${aud.key.mode}` : ''}` });
    const hardCuts = mt.cuts.filter((_, i) => { const c = mt.cuts[i], s = film.shots.filter((x) => Math.abs(x.t[1] - c) < 1e-6).pop(); return ['cut', 'scale-cut', 'hold-cut'].includes((s?.transition_out ?? 'cut').toLowerCase()); });
    const imp = film.shots.flatMap((s) => (s.sfx ?? []).filter((e) => e.type === 'impact').map((e) => s.t[0] + e.at)), sy = A.syncOffsets(A.onsets(aud.L, aud.R, aud.sr), [...hardCuts, ...imp]);
    sy.n >= 2 ? put('audio.avSync', sy.median, { ci: [sy.median - (1.4826 * sy.mad) / Math.sqrt(sy.n) - 5.3, sy.median + (1.4826 * sy.mad) / Math.sqrt(sy.n) + 5.3], n: sy.n, nmin: 3, notes: `${(100 * sy.matched).toFixed(0)} % de ${hardCuts.length + imp.length} eventos con onset a ±250 ms; MAD=${sy.mad.toFixed(1)} ms` }) : nd('audio.avSync', 'menos de 2 eventos visuales con onset cercano');
  } else for (const id of ['audio.loudness', 'audio.lra', 'audio.truePeak', 'audio.plr', 'audio.tempo', 'audio.key', 'audio.avSync', 'audio.r128dev']) nd(id, 'el film no tiene audio');
  // drama: componentes sobre rejilla 0,25 s
  const comps = {};
  { const sg = 2; comps.cortes = tg.map((t) => X.sum(mt.cuts.map((c) => Math.exp(-0.5 * ((t - c) / sg) ** 2) / (sg * Math.sqrt(2 * Math.PI))))); }
  if (c1) { const byT = (k) => tg.map((t) => { const s = c1.S.filter((q) => Math.abs(q.t - t) < 0.1); return s.length ? X.mean(s.map((q) => q[k])) : 0; }); const pp = X.pit(byT('pan')), pz = X.pit(byT('zoom')), has = (a) => Math.max(...a) - Math.min(...a) > 1e-9; const parts = [byT('pan'), byT('zoom'), byT('roll')].filter(has).map(X.pit); if (parts.length) comps.camara = tg.map((_, j) => X.mean(parts.map((p) => p[j]))); }
  { const vt = fr.map((_, i) => i / fs_), vv = K1.vPerFrame, ok = vv.map((v, i) => v !== null ? i : -1).filter((i) => i >= 0); if (ok.length > 8) comps.movimiento = tg.map((t) => X.interp(ok.map((i) => vt[i]), ok.map((i) => vv[i]), t)); }
  if (Mser) { const mt_ = Mser.map((_, j) => (j + 4) / 10); comps.sonoridad = tg.map((t) => X.interp(mt_, Mser.map((v) => Math.max(v, -70)), t)); }
  if (openF) comps.preguntas = tg.map(openF);
  const T = tensionFrom(comps, tg);
  if (T) {
    const d0 = curveDescriptors(T.v), loo = T.names.length > 1 ? T.names.map((n) => { const cc = { ...comps }; delete cc[n]; const t2 = tensionFrom(cc, tg); return t2 ? curveDescriptors(t2.v) : null; }).filter(Boolean) : [];
    const rng_ = (f, sc = 1) => { const a = [f(d0), ...loo.map(f)].map((x) => x * sc); return [Math.min(...a), Math.max(...a)]; }, nloo = loo.length, nt = T.names.length, nmeta = `componentes: ${T.names.join('+')}`;
    const pd = (id, v, f, sc = 1, extra = {}) => put(id, v * sc, { ci: rng_(f, sc), n: nt, nmin: 2, conf: 0.6, notes: `${nmeta}; IC = rango leave-one-out (${nloo} variantes)`, ...extra });
    pd('drama.peakPos', d0.peakPos, (d) => d.peakPos, 100); pd('drama.peakProminence', d0.peakProm, (d) => d.peakProm); pd('drama.peaks', d0.peaks, (d) => d.peaks); pd('drama.centroid', d0.centroid, (d) => d.centroid, 100); pd('drama.entropy', d0.entropy, (d) => d.entropy);
    pd('drama.periodicity', d0.periodicity, (d) => d.periodicity, 1, { notes: `${nmeta}; periodo ≈ ${d0.periodLag ? (d0.periodLag * D).toFixed(1) + ' s' : 'sin periodo'}` }); pd('drama.freytagFit', d0.freytag, (d) => d.freytag, 1, { notes: `${nmeta}; clímax óptimo τc=${d0.freytagClimax.toFixed(2)}` });
    put('drama.phases', Object.fromEntries(Object.entries(d0.phases).map(([k, v]) => [k, +v.toFixed(1)])), { n: nt, nmin: 2, conf: 0.6, notes: nmeta });
    series.tension = { unit: '0–1', components: T.names, tau: Array.from({ length: 100 }, (_, i) => +((i + 0.5) / 100).toFixed(4)), v: T.v.map((x) => +x.toFixed(4)), descriptors: { ...d0, phases: undefined } };
    const sp = (name, unit) => { if (!comps[name]) return; const v = X.minmax(X.resample(tg, X.gauss(tg, comps[name], 1), D, 100)); series[name === 'cortes' ? 'tempo' : name] = { unit: '0–1 normalizado (' + unit + ')', tau: series.tension.tau, v: v.map((x) => +x.toFixed(4)), descriptors: (({ peakPos, centroid, entropy, periodicity }) => ({ peakPos, centroid, entropy, periodicity }))(curveDescriptors(v)) }; };
    sp('cortes', 'densidad de cortes, cortes/s'); sp('movimiento', 'velocidad en pantalla, anchos/s'); sp('sonoridad', 'LUFS momentáneo'); sp('camara', 'actividad de cámara (PIT)');
  } else for (const id of REGISTRY.filter((m) => m.id.startsWith('drama.')).map((m) => m.id)) nd(id, 'sin componentes con variación');
  const ids = new Set(out.map((m) => m.id)); for (const r of REGISTRY) if (!ids.has(r.id)) nd(r.id, 'estimador no aplicable a este film');
  out.sort((a, b) => REGISTRY.findIndex((r) => r.id === a.id) - REGISTRY.findIndex((r) => r.id === b.id));
  return { schema: SCHEMA, film: { title: film.title ?? null, timeline, duration: D, fps: film.fps, width: film.width, height: film.height, style: film.S.name ?? film.style, medium: film.medium?.name ?? null },
    params: { refFocalMm: REF_FOCAL_MM, sampleFps, renderW: R.W, viewingH: CONVENTIONS.viewingH.value, beatTolMs: CONVENTIONS.beatTolMs.value }, metrics: out, series, params_units: U.describeParams(film).length };
}
