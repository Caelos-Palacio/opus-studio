// Diseño sonoro como sistema: los eventos salen del MISMO timeline que la imagen (sfx declarados + derivados de cortes, escala,
// cámara, revelaciones de la memoria) y se sintetizan con voces propias, deterministas, en capas y con variación.
//   designEvents(tl, plan, style) → eventos {t, type, bus, priority, gain, pan, p, lead, dur, speed?, seed, …}
//   renderEvents(events, plan, style, N) → buses {sfx, hit, amb} estéreo (+ envío a reverb) y renderEvent(e) mono (para medir)
// Reglas (docs/MUSICA.md §Diseño sonoro): impacto = pre-silencio (suck-back) + transitorio + cuerpo + sub-drop + cola; whoosh ∝ velocidad
// de escala/cámara; ambiente por escala (plano) y sección; risers que resuelven; tics del ×10 que ascienden por la escala del estilo y
// siguen la curva de intensidad, cada uno distinto (tono, caída y brillo sembrados por evento).
import { SR, TAU, clamp, lerp, mtof, db2lin, rng, hashStr, stereo, reverb } from './dsp.mjs';

const SIZE = { ECU: 0, CU: 0, MCU: 1, MS: 2, MWS: 2.5, WS: 3, EWS: 4 }, rank = (s) => SIZE[s?.size] ?? 2;
const TRANS = ['morph', 'cut', 'scale-cut', 'hold-cut'];
const BANDS = { impact: [1, 0.3, 0.3],   // el golpe cede solo los graves: el acorde del clímax canta por encima del sub
   bloom: [0.8, 1, 0.8], riser: [0.5, 1, 1], whoosh: [0.5, 1, 1], shimmer: [0.7, 0.8, 1], anom: [0.9, 1, 0.8], resolve: [1, 0.8, 0.7], accent: [1, 0.6, 0.4], tick: [0, 0.5, 1], pop: [0.3, 1, 0.6], click: [0, 0.4, 1] };
const GAIN = { impact: 1.25, bloom: 1.1, riser: 1, shimmer: 1.4, anom: 1, pop: 1.5, click: 1, drone: 0.4, air: 0.5 };   // escala sobre el gain declarado (calibra el banco propio frente al v1)
const SEND = { impact: 0.45, bloom: 0.65, riser: 0.3, whoosh: 0.18, shimmer: 0.6, anom: 0.4, resolve: 0.4, accent: 0.25, tick: 0.14, pop: 0.2, click: 0.1, drone: 0.1, air: 0.1 };
const keyMidi = (k) => { const pc = ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 })[k.root[0]] + (k.root[1] === '#' ? 1 : k.root[1] === 'b' ? -1 : 0); return (pc + 12) % 12; };   // clase de altura de la tónica

// ───────── eventos ─────────
export function designEvents(tl, plan, style) {
  const shots = [...tl.shots].sort((a, b) => a.t[0] - b.t[0]), SX = style.sfx, I = plan.intensity, ev = [], vac = plan.vac;
  const push = (e) => ev.push({ pan: [0, 0], p: {}, ...e });
  const dec = (s) => { const m = [...(s?.action ?? '').matchAll(/10\^\{?(-?\d+(?:[.,]\d+)?)\}?/g)].map((x) => +x[1].replace(',', '.')); return m.length >= 2 ? Math.abs(m[m.length - 1] - m[0]) : 0; };   // décadas recorridas (si el texto las declara)
  const camAmt = (s) => (s?.cam && s.cam.move !== 'static' ? s.cam.amount ?? 0.03 : 0);
  // velocidad de la transición i→i+1 en [0,1]: salto de plano + décadas por segundo + cámara del plano que sale
  const speedOf = (i) => { const a = shots[i], b = shots[Math.min(i + 1, shots.length - 1)], d = Math.max(0.5, a.t[1] - a.t[0]); return clamp(0.2 + 0.22 * Math.abs(rank(b) - rank(a)) + 0.45 * Math.min(1, dec(a) / d) + 3 * camAmt(a)); };
  const shotIdx = (t) => Math.max(0, shots.findIndex((s) => t >= s.t[0] && t < s.t[1]));
  shots.forEach((s, si) => {
    for (const e of s.sfx ?? []) {
      const t = s.t[0] + e.at, base = { t, gain: e.gain ?? 0.8, pan: [e.pan ?? 0, e.pan ?? 0], src: `${s.id}.sfx`, decl: true };
      if (e.type === 'drone') push({ ...base, type: 'drone', bus: 'amb', priority: 0, dur: e.dur ?? 4, lead: 0, gain: (e.gain ?? 0.3) * GAIN.drone });
      else if (e.type === 'whoosh') push({ ...base, type: 'whoosh', bus: 'sfx', dur: e.dur ?? 0.8, speed: speedOf(si), gain: (e.gain ?? 0.5) * 1.2 });
      else { const ty = e.type === 'rev' ? 'bloom' : e.type; push({ ...base, type: ty, bus: ty === 'impact' ? 'hit' : 'sfx', dur: e.dur, gain: base.gain * (GAIN[ty] ?? 1) }); }
    }
    for (const b of s.on_beat_at ?? []) push({ t: s.t[0] + b, type: 'accent', bus: 'sfx', gain: 0.7, src: `${s.id}.on_beat_at`, derived: 'on_beat_at' });
  });
  // transiciones entre planos (cambio de escala): whoosh ∝ velocidad o golpe seco en un corte
  for (let i = 0; i < shots.length - 1; i++) {
    const tr = (shots[i].transition_out ?? '').toLowerCase(), t = shots[i].t[1]; if (!TRANS.includes(tr)) continue;
    const sp = speedOf(i), dr = Math.sign(rank(shots[i + 1]) - rank(shots[i])) || (i % 2 ? -1 : 1);
    if (tr === 'morph') { if (!ev.some((e) => e.type === 'whoosh' && Math.abs(e.t - t) < 0.9)) push({ t, type: 'whoosh', bus: 'sfx', dur: lerp(1.5, 0.6, sp), speed: sp, gain: 0.35 + 0.65 * sp, pan: [-0.7 * dr * sp, 0.7 * dr * sp], src: `${shots[i].id}.transition_out`, derived: 'transition' }); }
    else push({ t, type: 'click', bus: 'sfx', gain: 0.8, src: `${shots[i].id}.transition_out`, derived: 'transition' });
  }
  for (const e of ev) if (e.type === 'whoosh') e.pan = e.decl ? [-0.5 * (shotIdx(e.t) % 2 ? -1 : 1), 0.5 * (shotIdx(e.t) % 2 ? -1 : 1)] : e.pan;
  // revelaciones de la memoria sin sonido propio
  for (const g of plan.giros) if (!ev.some((e) => e.type === 'bloom' && Math.abs(e.t - g.en) < 0.4)) push({ t: g.en, type: 'bloom', bus: 'sfx', gain: 0.8, src: `giro:${g.id}`, derived: 'giro' });
  // risers que resuelven: el remate (suave) cae justo al terminar si no hay otro evento ahí
  for (const r of ev.filter((e) => e.type === 'riser')) if (!ev.some((e) => e !== r && e.type !== 'riser' && e.type !== 'drone' && e.t >= r.t - 0.1 && e.t <= r.t + 0.6)) push({ t: r.t, type: 'resolve', bus: 'sfx', gain: 0.8 * r.gain / 0.4, src: `${r.src}:resuelve`, derived: 'riser' });
  // ambientes por escala: una cama por plano (cruza 1 s con el vecino); los drones declarados son la cama grave
  shots.forEach((s) => push({ t: s.t[0] - 1, type: 'air', bus: 'amb', priority: 0, dur: s.t[1] - s.t[0] + 2, lead: 0, gain: GAIN.air, p: { rank: rank(s) }, src: `${s.id}.ambiente`, derived: 'ambiente' }));
  ev.sort((a, b) => a.t - b.t);
  // tics: ascienden por la escala del estilo dentro de cada racha; nivel y brillo siguen la intensidad
  const ticks = ev.filter((e) => e.type === 'tick'); let run = 0, last = -9;
  for (const e of ticks) {
    run = e.t - last <= SX.tickRunGap ? run + 1 : 0; last = e.t;
    const R = rng(hashStr(`${e.src}:${e.t.toFixed(3)}:tick`)), sc = SX.scale, deg = run % sc.length, oct = Math.min(2, Math.floor(run / sc.length)), it = I(e.t);
    e.p = { midi: 72 + keyMidi(style.key) + sc[deg] + 12 * oct + (R() - 0.5) * 0.16, decay: 0.05 + 0.07 * R(), bright: 0.45 + 0.9 * it + 0.15 * R(), run };
    e.gain = db2lin(lerp(SX.tickGainDb[0], SX.tickGainDb[1], it ** 0.9) + (R() - 0.5) * 1.6) * Math.sqrt(e.gain / 0.35);
    e.pan = [Math.sin(run * 1.9 + 0.7) * 0.5, Math.sin(run * 1.9 + 0.7) * 0.5];
  }
  ev.forEach((e, id) => {
    const R = rng(hashStr(`${e.src}:${e.type}:${e.t.toFixed(4)}`)); e.id = id; e.seed = hashStr(`${e.src}:${e.t.toFixed(4)}`);
    e.priority ??= e.type === 'whoosh' ? (e.speed >= 0.55 ? SX.priority.whoosh : 1) : SX.priority[e.type] ?? 1;
    e.bands = BANDS[e.type] ?? [0.5, 0.5, 0.5]; e.send = SEND[e.type] ?? 0.2; e.intensity = I(e.t);
    if (e.type === 'pop') e.p = { f0: 760 + 360 * R(), decay: 0.04 + 0.03 * R() };
    if (e.type === 'click') e.p = { f: 1800 + 900 * R(), decay: 0.004 + 0.004 * R() };
    if (e.type === 'accent') e.p = { f: 70 + 25 * R(), pf: 620 + 280 * R() };
    if (e.type === 'whoosh') { e.p = { fc: 1500 + 6500 * e.speed ** 1.2, tonal: 0.05 + 0.2 * e.speed, air: e.speed, jit: R() }; }
    if (e.type === 'impact') e.p = { inten: 0.85 + 0.15 * e.intensity, suck: style.impact.suck, vac };
    if (e.type === 'riser') e.p = { dur: e.dur ?? 1.5, endGap: plan.impacts.some((q) => Math.abs(q.t - e.t) < 0.15) ? vac : 0 };
    if (e.type === 'shimmer') e.p = { det: R(), oct: 0 };
    if (e.type === 'anom') e.p = { det: R() };
    if (e.type === 'bloom') e.p = { inten: 0.7 + 0.3 * e.intensity };
    e.dur = e.type === 'riser' ? e.p.dur : e.type === 'impact' ? 4.5 : e.type === 'bloom' ? 5 : e.type === 'shimmer' ? 2.8 : e.type === 'anom' ? 2.4 : e.dur ?? (e.type === 'tick' ? 0.35 : e.type === 'resolve' ? 0.6 : e.type === 'accent' ? 0.35 : 0.3);
  });
  return ev;
}

// ───────── voces ─────────
// Cada voz devuelve {x: mono, lead: segundos antes del instante de sincronía en que empieza x}.
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));
const mk = (sec) => new Float32Array(Math.max(1, Math.round(sec * SR)));
const VOICE = {
  tick(e) { const p = e.p, f = mtof(p.midi), x = mk(0.35); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = e.gain * 0.6 * env(t, 0.0015, p.decay) * (Math.sin(TAU * f * t) + 0.35 * p.bright * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t / (p.decay * 0.4)) + 0.2 * p.bright * Math.sin(TAU * f * 5.4 * t) * Math.exp(-t / (p.decay * 0.2))); } return { x, lead: 0 }; },
  pop(e, R) { const p = e.p, x = mk(0.2); let ph = 0; for (let i = 0; i < x.length; i++) { const t = i / SR; ph += (TAU * (p.f0 * Math.exp(-t * 30) + 180)) / SR; x[i] = e.gain * Math.sin(ph) * env(t, 0.002, p.decay + 0.01); } void R; return { x, lead: 0 }; },
  click(e, R) { const p = e.p, x = mk(0.05); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = e.gain * (0.6 * Math.sin(TAU * p.f * t) + 0.5 * (R() * 2 - 1)) * env(t, 0.0004, p.decay); } return { x, lead: 0 }; },
  accent(e, R) { const p = e.p, x = mk(0.4); let ph = 0, ph2 = 0; for (let i = 0; i < x.length; i++) { const t = i / SR; ph += (TAU * (p.f * (1 + 0.8 * Math.exp(-t * 25)))) / SR; ph2 += (TAU * p.pf * Math.exp(-t * 20)) / SR; x[i] = e.gain * (0.8 * Math.sin(ph) * env(t, 0.003, 0.12) + 0.5 * Math.sin(ph2) * env(t, 0.002, 0.04) + 0.1 * (R() * 2 - 1) * env(t, 0.001, 0.01)); } return { x, lead: 0 }; },
  whoosh(e, R) {
    const p = e.p, d = e.dur, x = mk(d); let lp = 0, bp = 0, hp = 0, ph = 0;
    for (let i = 0; i < x.length; i++) {
      const u = i / x.length, sh = u < 0.62 ? (u / 0.62) ** 1.6 : Math.cos(((u - 0.62) / 0.38) * Math.PI / 2) ** 2, fc = 300 + (p.fc - 300) * sh ** 0.8, a = 1 - Math.exp((-TAU * fc) / SR), n = R() * 2 - 1;
      lp += a * (n - lp); bp += a * (lp - bp); hp += 0.3 * (n - hp); ph += (TAU * (120 + (200 + 900 * e.speed) * u * u)) / SR;
      x[i] = e.gain * sh * (2.2 * (lp - bp) * (0.5 + 0.8 * e.speed) + p.air * 0.5 * (n - hp) * 0.3 + p.tonal * Math.sin(ph));
    }
    return { x, lead: 0.62 * d };
  },
  impact(e, R) { // pre-silencio: suck-back → vacío; golpe: transitorio + cuerpo + sub-drop + brillo + cola (retumbo)
    const p = e.p, lead = p.suck + p.vac, x = mk(lead + 4.5), m = Math.round(lead * SR), ns = Math.round(p.suck * SR);
    let lp = 0, bp = 0, ph = 0;
    for (let i = 0; i < ns; i++) { const u = i / ns, fc = 5000 * Math.exp(-u * Math.log(5000 / 350)), a = 1 - Math.exp((-TAU * fc) / SR), n = R() * 2 - 1; lp += a * (n - lp); bp += a * (lp - bp); ph += (TAU * (420 * Math.exp(-u * 2))) / SR; x[i] = e.gain * 0.5 * u ** 1.6 * (3 * (lp - bp) + 0.4 * Math.sin(ph)) * clamp((ns - i) / (0.006 * SR)); }
    let sub = 0, body = 0, l1 = 0, l2 = 0, lr = 0, hh = 0;
    for (let i = 0; i < 4.5 * SR; i++) {
      const t = i / SR, n = R() * 2 - 1;
      sub += (TAU * (27 + 40 * Math.exp(-t / 0.4))) / SR; body += (TAU * (52 + 130 * Math.exp(-t * 22))) / SR;
      l1 += 0.2 * (n - l1); l2 += 0.04 * (n - l2); lr += 0.012 * (n - lr); hh += 0.15 * (n - hh);
      const sd = Math.tanh(1.5 * Math.sin(sub)) * env(t, 0.003, 0.75), bd = Math.sin(body) * env(t, 0.002, 0.2), nz = l1 * env(t, 0.001, 0.07), trn = (n - hh) * Math.exp(-t / 0.006), air = (n - hh) * (1 - Math.exp(-t / 0.02)) * Math.exp(-t / 0.9), rb = lr * 4 * (1 - Math.exp(-t / 0.05)) * Math.exp(-t / 1.4);
      x[m + i] = e.gain * p.inten * (0.75 * sd + 0.9 * bd + 0.7 * nz + 1.3 * trn + 0.24 * air + 0.4 * rb + 0.08 * l2 * env(t, 0.001, 0.3));
    }
    return { x, lead };
  },
  riser(e, R, C) { // ruido que sube + pila tonal que sube una octava hasta la tónica (resuelve) + trémolo que se acelera
    const p = e.p, x = mk(p.dur), f0 = mtof(36 + keyMidi(C.style.key)), ph = [R(), R(), R()]; let lp = 0, bp = 0;
    for (let i = 0; i < x.length; i++) {
      const t = i / SR, u = i / x.length, fc = 300 * Math.pow(30, u), a = 1 - Math.exp((-TAU * fc) / SR), n = R() * 2 - 1; lp += a * (n - lp); bp += a * (lp - bp);
      let s = 0; const f = f0 * 2 ** u; [1, 1.5, 2].forEach((m, k) => { ph[k] += (f * m * (1 + 0.003 * (k - 1))) / SR; if (ph[k] >= 1) ph[k] -= 1; s += (2 * ph[k] - 1) / (k + 1); });
      const am = 0.7 + 0.3 * Math.sin(TAU * (4 * t + (8 * t * t) / Math.max(p.dur, 0.5)));
      x[i] = e.gain * u ** 2.2 * am * (3.2 * (lp - bp) + 0.35 * s) * clamp((x.length - i) / (0.008 * SR));
    }
    return { x, lead: p.dur + p.endGap };
  },
  shimmer(e, R, C) { const p = e.p, x = mk(2.8), base = mtof(84 + keyMidi(C.style.key) - 12), parts = [0, 4, 7, 14, 16].map((s, k) => [base * 2 ** (s / 12) * (1 + 0.002 * (R() - 0.5)), 1 / (1 + 0.35 * k), R() * TAU]); for (let i = 0; i < x.length; i++) { const t = i / SR; let s = 0; for (const [f, g, ph] of parts) s += g * Math.sin(TAU * f * t + ph); x[i] = e.gain * 0.3 * s * env(t, 0.02, 0.7 + 0.3 * p.det); } return { x, lead: 0 }; },
  anom(e, R, C) { const p = e.p, x = mk(2.4), f1 = mtof(48 + keyMidi(C.style.key)), f2 = f1 * 2 ** ((6.3 + 0.4 * p.det) / 12); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = e.gain * 0.45 * (Math.asin(Math.sin(TAU * f1 * t)) + Math.asin(Math.sin(TAU * f2 * t))) * env(t, 0.01, 0.7) * (0.8 + 0.2 * Math.sin(TAU * 3 * t)); } void R; return { x, lead: 0 }; },
  bloom(e, R, C) { // revelación: barrido inverso que se abre, acorde mayor ancho (sierras desafinadas), destello, golpe suave grave
    const p = e.p, lead = 0.35, x = mk(lead + 5), m = Math.round(lead * SR), key = keyMidi(C.style.key), notes = [0, 4, 7, 12, 16, 19].map((s) => 36 + key + s), ph = notes.flatMap(() => [R(), R(), R()]);
    let lp = 0, bp = 0, l1 = 0, l2 = 0, sph = 0;
    for (let i = 0; i < lead * SR; i++) { const u = i / (lead * SR), a = 1 - Math.exp((-TAU * (500 + 5500 * u)) / SR), n = R() * 2 - 1; lp += a * (n - lp); bp += a * (lp - bp); x[i] = e.gain * 0.5 * u ** 2 * 3 * (lp - bp); }
    for (let i = 0; i < 5 * SR; i++) {
      const t = i / SR; let s = 0, v = 0;
      notes.forEach((nn, k) => { for (const dt of [0.996, 1, 1.004]) { ph[v] += (mtof(nn) * dt) / SR; if (ph[v] >= 1) ph[v] -= 1; s += (2 * ph[v] - 1) / (1 + 0.15 * k); v++; } });
      const fc = 500 + 3000 * (1 - Math.exp(-t / 0.5)) * Math.exp(-t / 3), a = 1 - Math.exp((-TAU * fc) / SR); l1 += a * (s - l1); l2 += a * (l1 - l2);
      sph += (TAU * mtof(36 + key) * (1 + 0.8 * Math.exp(-t * 18))) / SR;
      x[m + i] = e.gain * p.inten * (0.16 * l2 * clamp(t / 0.04) * Math.exp(-t / 2.4) + 0.5 * Math.sin(sph) * env(t, 0.004, 0.25));
    }
    void bp; return { x, lead };
  },
  resolve(e, R) { const x = mk(0.6); let ph = 0, lp = 0, bp = 0; for (let i = 0; i < x.length; i++) { const t = i / SR, n = R() * 2 - 1, a = 1 - Math.exp((-TAU * (3000 * Math.exp(-t * 4))) / SR); ph += (TAU * (85 - 35 * (1 - Math.exp(-t * 12)))) / SR; lp += a * (n - lp); bp += a * (lp - bp); x[i] = e.gain * (0.8 * Math.sin(ph) * env(t, 0.004, 0.14) + 1.6 * (lp - bp) * env(t, 0.01, 0.18)); } return { x, lead: 0 }; },
  drone(e, R, C) { // cama grave en quinta y octava de la tónica, con deriva lenta; sigue la intensidad
    const d = e.dur, x = mk(d), f = mtof(24 + keyMidi(C.style.key)); const ph0 = R() * TAU;
    for (let i = 0; i < x.length; i++) { const t = i / SR, a = Math.min(1, t / 0.8, (d - t) / 0.8), it = C.I(e.t + t); x[i] = e.gain * a * (0.5 + 0.9 * it) * (Math.sin(TAU * f * t + ph0) + 0.6 * Math.sin(TAU * f * 1.5 * t + 0.6 * Math.sin(0.3 * t)) + 0.2 * Math.sin(TAU * f * 2 * t + Math.sin(t))); }
    return { x, lead: 0 };
  },
  air(e, R, C) { // aire/ambiente por escala del plano: íntimo y cálido (CU) → amplio y frío con destellos de estrellas (EWS)
    const d = e.dur, x = mk(d), rk = e.p.rank, wide = clamp(rk / 4); let l1 = 0, l2 = 0, b1 = 0, b2 = 0; const tw = [];
    if (rk >= 3) for (let t = R() * 1.5; t < d; t += 1 / (0.3 + 0.9 * wide) * (0.5 + R())) tw.push([t, 2000 + 3500 * R(), 0.3 + 0.7 * R()]);
    for (let i = 0; i < x.length; i++) {
      const t = i / SR, n = R() * 2 - 1, fa = Math.min(1, t / 1, (d - t) / 1), it = C.I(e.t + t), amp = fa * (0.35 + 0.65 * it);
      const fcLo = 220 - 150 * wide, fcBp = 450 + 350 * Math.sin(0.4 * t + wide), al = 1 - Math.exp((-TAU * fcLo) / SR), ab = 1 - Math.exp((-TAU * fcBp) / SR);
      l1 += al * (n - l1); l2 += al * (l1 - l2); b1 += ab * (n - b1); b2 += ab * (b1 - b2);
      let v = (1 - wide) * l2 * 5 + wide * 0.8 * (b1 - b2) * 4 + (rk >= 4 ? 0.9 * l2 * 6 : 0);
      for (const [t0, f, g] of tw) { const q = t - t0; if (q > 0 && q < 0.6) v += 0.05 * g * Math.sin(TAU * f * q) * Math.exp(-q / 0.15); }
      x[i] = e.gain * amp * v;
    }
    return { x, lead: 0 };
  },
};
export function renderEvents(events, plan, style, N) {
  const mkBus = () => ({ ...stereo(N), wL: new Float32Array(N), wR: new Float32Array(N) }), buses = { sfx: mkBus(), hit: mkBus(), amb: mkBus() }, C = { I: plan.intensity, style };
  const dry = (e) => { const R = rng(e.seed); return VOICE[e.type](e, R, C); };
  for (const e of events) {
    if (!VOICE[e.type]) continue; const { x, lead } = dry(e); e.lead = lead; const b = buses[e.bus], s0 = Math.round((e.t - lead) * SR), n = x.length, dl = Math.round(0.011 * SR), wd = e.type === 'bloom' || e.type === 'shimmer' || e.bus === 'amb' ? 0.5 : e.type === 'impact' ? 0.25 : 0.1;
    for (let i = 0; i < n; i++) {
      const k = s0 + i; if (k < 0 || k >= N) continue; const u = i / n, pan = clamp(lerp(e.pan[0], e.pan[1], u * u * (3 - 2 * u)), -1, 1), a = ((pan + 1) * Math.PI) / 4, v = x[i], v2 = i >= dl ? x[i - dl] : 0;
      const l = v * Math.cos(a) * Math.SQRT2 * 0.5 * (1 - 0.3 * wd) + v2 * wd * 0.35, r = v * Math.sin(a) * Math.SQRT2 * 0.5 * (1 - 0.3 * wd) - v2 * wd * 0.35;
      b.L[k] += l; b.R[k] += r; b.wL[k] += l * e.send; b.wR[k] += r * e.send;
    }
  }
  for (const b of Object.values(buses)) { const rl = reverb(b.wL, 'L', { fb: 0.82, damp: 0.4 }), rr = reverb(b.wR, 'R', { fb: 0.82, damp: 0.4 }); for (let i = 0; i < N; i++) { b.L[i] += 0.5 * rl[i]; b.R[i] += 0.5 * rr[i]; } delete b.wL; delete b.wR; }
  return { buses, renderEvent: (e) => dry(e).x };
}
