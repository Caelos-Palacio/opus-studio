#!/usr/bin/env node
// Lint dramático (F5): de "correcto" a "asombroso". Contrasta el spine declarado (data/story.json) con lo MEDIDO.
//   node engine/arc.mjs [--story data/story.json] [--timeline X] [--fps 12] [--record]   (npm run arc)
// Salida: out/arc.json {verdict, score 0–100, measures, thresholds, checks, issues} + líneas como el lint.
// Sin story.json: un WARN y los medibles como información (nunca FIX: el demo no cambia de veredicto sin intención).
// Umbrales: engine/arc.json (priors por perfil) + data/arc.calib.json (observaciones de obras aprobadas, --record)
// con calibración bayesiana con clamp (docs/research/02). Lo no medible va a engine/arc.rubric.mjs (crítico).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, timelinePath } from './film.mjs';
import { specOf, camState } from './camera.mjs';
import { collectEvents } from './sound.mjs';

const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine/arc.json'), 'utf8'));
export const LINKS_OK = ['pero', 'por lo tanto', 'but', 'therefore'];
const TRANSIENTS = ['impact', 'click', 'pop', 'tick'];
const mean = (a) => (a.length ? a.reduce((p, q) => p + q, 0) / a.length : 0);
const quant = (a, q) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1) + 0.5)))]; };
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').trim();
const words = (s) => norm(s).split(/\s+/).filter((w) => w.length >= 3);

// ───────── calibración bayesiana con clamp ─────────
// posterior = (1−w)·prior + w·MLE, w = min(0.5, N/60), posterior ∈ [prior/2, 2·prior]. MLE: p10 (umbral mínimo) | p90 (máximo).
export function calibrate(prior, obs = [], stat = 'lo') {
  const N = obs.length; if (!N) return prior;
  const w = Math.min(0.5, N / 60), mle = quant(obs, stat === 'lo' ? 0.1 : stat === 'hi' ? 0.9 : 0.5), p = (1 - w) * prior + w * mle;
  const a = Math.min(prior / 2, prior * 2), b = Math.max(prior / 2, prior * 2);
  return Math.min(b, Math.max(a, p));
}
export function thresholds(profile, calib = {}) {
  const prior = CFG.priors[profile] ?? CFG.priors.reel, T = JSON.parse(JSON.stringify(prior)), cal = {};
  for (const [k, stat] of Object.entries(CFG.stat)) {
    const obs = calib[profile]?.[k] ?? []; if (!obs.length || typeof prior[k] !== 'number') continue;
    T[k] = calibrate(prior[k], obs, stat); cal[k] = { prior: prior[k], N: obs.length, posterior: +T[k].toFixed(4) };
  }
  T._calibrated = cal; T._profile = CFG.priors[profile] ? profile : 'reel';
  return T;
}

// ───────── esquema (validador mínimo sin dependencias, alineado con data/story.schema.json) ─────────
export function validateStory(st) {
  const e = [], num = (v) => typeof v === 'number' && Number.isFinite(v);
  if (!st || typeof st !== 'object') return ['story.json no es un objeto'];
  if (typeof st.idea !== 'string' || st.idea.length < 3) e.push('falta idea (una frase)');
  const q = st.question;
  if (!q || typeof q.text !== 'string' || !num(q.posed_at) || !num(q.answered_at)) e.push('question {text, posed_at, answered_at} incompleta');
  if (!Array.isArray(st.beats) || st.beats.length < 2) e.push('beats: mínimo 2');
  else st.beats.forEach((b, i) => { if (!num(b?.t) || typeof b?.text !== 'string') e.push(`beats[${i}] sin t/text`); });
  const a = st.accommodation;
  if (!a || !num(a.t) || !['regla', 'escala', 'idea'].includes(a.type)) e.push('accommodation {t, type: regla|escala|idea} incompleta');
  for (const [i, s] of (st.scale ?? []).entries()) if (!num(s?.at)) e.push(`scale[${i}] sin at`);
  for (const [k, v] of Object.entries(st.sakuga ?? {})) if (!['hero', 'normal', 'simple'].includes(v)) e.push(`sakuga.${k} = "${v}" (hero|normal|simple)`);
  return e;
}
export function storyPath(film, explicit) {
  const argv = process.argv, i = argv.indexOf('--story');
  const p = explicit ?? (i >= 0 ? argv[i + 1] : null) ?? process.env.OPUS_STORY ?? film?.story ?? (path.normalize(timelinePath()) === path.normalize('data/timeline.json') ? 'data/story.json' : null);
  return p && fs.existsSync(path.join(ROOT, p)) ? p : null;
}

// ───────── medida (render a baja resolución, sin grade: misma energía que lint motion) ─────────
export function frameEnergy(d, prev) { let s = 0; for (let k = 0; k < d.length; k += 4) s += Math.abs(d[k] - prev[k]) + Math.abs(d[k + 1] - prev[k + 1]) + Math.abs(d[k + 2] - prev[k + 2]); return s / (d.length * 0.75 * 255); }
const rgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h ?? ''); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };

// Progreso normalizado de la cámara a lo largo de su eje dominante: lineal (sin inercia) y sobrepaso medibles.
export function camShape(shot, film) {
  const sp = specOf(shot, film); if (sp.move === 'static' || sp.move === 'auto') return null;
  const n = 48, t0 = shot.t[0] + sp.delay, t1 = shot.t[1], c = (t) => camState(shot, t, film, { shake: false }), A = c(t0), B = c(t1);
  const comps = [['z', (s) => Math.log(s.z)], ['x', (s) => s.x / film.width], ['y', (s) => s.y / film.height], ['r', (s) => s.r / 90]];
  const [, f] = comps.reduce((best, cc) => (Math.abs(cc[1](B) - cc[1](A)) > Math.abs(best[1](B) - best[1](A)) ? cc : best));
  const span = f(B) - f(A); if (Math.abs(span) < 1e-6) return null;
  let dev = 0, over = 0;
  for (let i = 0; i <= n; i++) { const u = i / n, p = (f(c(t0 + u * (t1 - t0))) - f(A)) / span; dev = Math.max(dev, Math.abs(p - u)); over = Math.max(over, p - 1, -p); }
  return { move: sp.move, ease: sp.ease, linearDev: +dev.toFixed(4), overshoot: +Math.max(0, over).toFixed(4) };
}

export async function measure({ fps = 12, story = null, width = 1280, height = 720 } = {}) {
  const { makeRenderer } = await import('./render.mjs');
  const R = await makeRenderer({ size: `192x${Math.round((192 * height) / width / 2) * 2}`, grade: false }), film = R.film, W = R.W, H = R.H;
  const n = Math.round(film.duration * fps), E = [], accent = [], frames = [], acc = rgb(film.S.palette.accent), impacts = new Map(), smear = {};
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const t = i / fps, boxes = R.frame(t), d = R.ctx.getImageData(0, 0, W, H).data;
    if (prev) E.push(frameEnergy(d, prev));
    prev = Uint8ClampedArray.from(d);
    let a = 0; if (acc) for (let k = 0; k < d.length; k += 4) { const dr = d[k] - acc[0], dg = d[k + 1] - acc[1], db = d[k + 2] - acc[2]; if (dr * dr + dg * dg + db * db < 45 * 45) a++; }
    accent.push(a / (W * H));
    const nb = (b) => ({ shot: b.shot, label: b.label, role: b.role, weight: b.weight, x: b.x / W, y: b.y / H, w: b.w / W, h: b.h / H });
    frames.push({ t, texts: boxes.filter((b) => b.kind === 'text').map(nb), foci: boxes.filter((b) => b.kind === 'focus').map(nb) });
    for (const m of boxes.meta ?? []) {
      if (m.prim === 'impact') impacts.set(`${m.shot}@${(+m.t).toFixed(4)}`, { shot: m.shot, t: +m.t, frames: m.frames });
      if (m.prim === 'smear') smear[m.shot] = (smear[m.shot] ?? 0) + 1 / fps;
    }
  }
  // Los cortes son montaje, no movimiento: la diferencia que cruza un corte se sustituye por la media de sus vecinas.
  const cuts = [...new Set(film.shots.map((s) => s.t[0]).filter((c) => c > 1e-6 && c < film.duration - 1e-6))].map((c) => Math.max(0, Math.ceil(c * fps - 1e-6) - 1));
  for (const k of cuts) if (k > 0 && k < E.length - 1) E[k] = (E[k - 1] + E[k + 1]) / 2;
  const transients = [...collectEvents(film).filter((e) => TRANSIENTS.includes(e.type)).map((e) => e.t), ...(film.audioInfo?.onsets ?? []).map((o) => (typeof o === 'number' ? o : o.t))].sort((a, b) => a - b);
  const tiers = story?.sakuga ?? {};
  return {
    title: film.title, profile: film.profileName, style: film.S.name, duration: film.duration, fps: film.fps, sampleFps: fps,
    holdEnergy: film.S.rules.holdEnergy ?? film.P.holdEnergy, E, accent, frames, cuts,
    impacts: [...impacts.values()].sort((a, b) => a.t - b.t), smear, transients, silences: film.silences ?? [],
    shots: film.shots.map((s) => ({ id: s.id, t: s.t, size: s.size ?? null, on: s.on ?? 1, sakuga: s.sakuga ?? tiers[s.id] ?? null, transition_out: s.transition_out ?? null, text: s.text ?? '', action: s.action ?? '', cam: camShape(s, film) })),
  };
}

// ───────── análisis (puro: medidas + story + umbrales → veredicto). Testeable sin render. ─────────
export function smoothE(E, w = 3) { const h = Math.floor(w / 2); return E.map((_, i) => mean(E.slice(Math.max(0, i - h), i + h + 1))); }
export function energyArc(M, T) {
  const D = M.duration, f = M.sampleFps, Es = smoothE(M.E, Math.max(1, Math.round(0.25 * f)) | 1), tOf = (i) => (i + 1) / f;
  const med = Math.max(quant(Es, 0.5), M.holdEnergy), ip = Es.reduce((b, v, i) => (v > Es[b] ? i : b), 0), tp = tOf(ip), peak = Es[ip];
  // calma ANTES DE LA SUBIDA: arranque = último instante previo al pico con energía suavizada < 25 % del pico; se mide la energía cruda
  let on = ip; while (on > 0 && Es[on] >= 0.25 * peak) on--;
  const tOn = on > 0 ? tOf(on) : 0, calm = M.E.filter((_, i) => tOf(i) >= tOn - T.calmWin && tOf(i) <= tOn), last = M.E.slice(-Math.max(2, Math.round(M.E.length * 0.1)));
  const runs = []; let r0 = -1;                                              // holds: tramos de energía bajo el umbral de "quieto"
  for (let i = 0; i <= M.E.length; i++) { const low = i < M.E.length && M.E[i] < M.holdEnergy; if (low && r0 < 0) r0 = i; if (!low && r0 >= 0) { runs.push([r0 / f, i / f]); r0 = -1; } }
  const near = ([a, b]) => b >= tp - T.holdWin && a <= tp + T.holdWin;
  const holds = runs.filter((h) => h[1] - h[0] >= T.holdMin - 1e-9 && near(h)), sil = (M.silences ?? []).filter((s) => s[1] - s[0] >= T.holdMin && near(s));
  const peaks = []; for (let i = 1; i < Es.length - 1; i++) if (Es[i] >= Es[i - 1] && Es[i] > Es[i + 1] && Es[i] >= 0.6 * peak && peak > med * 1.5 && !peaks.some((p) => Math.abs(tOf(p) - tOf(i)) < 1)) peaks.push(i);
  return { tp: +tp.toFixed(3), onset: +tOn.toFixed(3), pos: +(tp / D).toFixed(3), peak, median: med, ratio: peak / med, calm: calm.length ? mean(calm) / med : Infinity,
    endDrop: peak > 0 ? mean(last) / peak : 1, holds, silences: sil, longestHold: Math.max(0, ...runs.filter(near).map((h) => h[1] - h[0])), peaks: peaks.length };
}

export function analyze(M, story, T) {
  const checks = [], D = M.duration, fr = 1 / M.fps;
  const add = (id, pass, level, problem, remedy, shot = '-', t = 0, weight) => checks.push({ id, pass: !!pass, level, problem, remedy, shot, t: +(+t).toFixed(3), weight: weight ?? (level === 'FIX' ? 3 : 1) });
  const A = energyArc(M, T), shotAt = (t) => M.shots.find((s) => t >= s.t[0] && t < s.t[1]) ?? M.shots[M.shots.length - 1];
  const measures = { energy: { peakT: A.tp, peakPos: A.pos, ratio: +A.ratio.toFixed(2), calm: Number.isFinite(A.calm) ? +A.calm.toFixed(3) : null, onset: A.onset, endDrop: +A.endDrop.toFixed(3), longestHoldNearPeak: +A.longestHold.toFixed(2), peaks: A.peaks, median: +A.median.toFixed(5) } };
  if (!story) {
    return { verdict: 'SHIP', skipped: true, score: null, measures, checks: [], issues: [{ level: 'WARN', shot: '-', t: 0, problem: 'sin story.json: arc omitido (los medibles se informan sin veredicto)', remedy: 'copiar data/story.template.json a data/story.json y declarar spine, pregunta y acomodación' }] };
  }
  const err = validateStory(story);
  for (const e of err) add('schema', false, 'FIX', `story.json: ${e}`, 'ver data/story.schema.json');
  const beats = [...(story.beats ?? [])].filter((b) => typeof b?.t === 'number');
  // 1 · spine causal (Parker/Stone)
  beats.forEach((b, i) => {
    if (!i) return;
    const l = norm(b.link ?? ''), ok = LINKS_OK.includes(l);
    add('spine', ok, 'FIX', ok ? '' : `beat ${b.id ?? i} → "${b.text}": conector "${b.link ?? '(ninguno)'}" con el anterior = "y luego"`, 'reescribir para que quepa "pero" o "por lo tanto" (causa o giro)', b.shot ?? shotAt(b.t)?.id, b.t);
  });
  for (let i = 1; i < beats.length; i++) if (beats[i].t < beats[i - 1].t) add('spine-order', false, 'WARN', `beats desordenados en el tiempo (${beats[i - 1].t} → ${beats[i].t})`, 'ordenar por t', '-', beats[i].t);
  for (const b of beats) if (b.shot && !M.shots.some((s) => s.id === b.shot)) add('spine-shot', false, 'WARN', `beat referencia shot inexistente "${b.shot}"`, 'corregir id', b.shot, b.t);
  // 2 · brecha de información (Loewenstein)
  const q = story.question;
  if (q && typeof q.posed_at === 'number') {
    add('gap-posed', q.posed_at <= T.questionBy * D + 1e-9, 'FIX', `la pregunta del gancho se plantea en ${q.posed_at}s (${((q.posed_at / D) * 100).toFixed(0)}%) > ${(T.questionBy * 100).toFixed(0)}%`, 'plantear la pregunta en el primer 10 %', shotAt(q.posed_at)?.id, q.posed_at);
    add('gap-late', q.answered_at >= T.answerAfter * D - 1e-9 && q.answered_at > q.posed_at, 'FIX', `la pregunta se resuelve en ${q.answered_at}s (${((q.answered_at / D) * 100).toFixed(0)}%) < ${(T.answerAfter * 100).toFixed(0)}%: la brecha se cierra pronto`, 'retrasar la respuesta (progreso visible, cierre tardío)', shotAt(q.answered_at)?.id, q.answered_at);
    if (q.on_screen) {
      const ws = words(q.text).filter((w) => w.length >= 4), seen = M.frames.some((f) => f.t <= T.questionBy * D + 1e-9 && f.texts.some((x) => ws.some((w) => norm(x.label).includes(w))));
      add('gap-screen', seen, 'FIX', `la pregunta "${q.text}" no aparece en pantalla en el primer ${(T.questionBy * 100).toFixed(0)}%`, 'api.text con la pregunta (o on_screen:false si la plantea la voz)', M.shots[0]?.id, 0);
    }
  }
  // 3 · modelo roto (Keltner/Haidt)
  const ac = story.accommodation;
  if (ac && typeof ac.t === 'number') {
    add('accommodation-peak', Math.abs(ac.t - A.tp) <= T.accomTol * D, 'WARN', `la acomodación declarada (${ac.t}s, ${ac.type}) está a ${Math.abs(ac.t - A.tp).toFixed(2)}s del pico medido (${A.tp}s)`, 'que el modelo se rompa en el pico de energía (o mover el pico)', shotAt(ac.t)?.id, ac.t);
    if (ac.type === 'escala' && !(story.scale ?? []).length) add('accommodation-scale', false, 'WARN', 'acomodación de escala sin salto de escala declarado (story.scale)', 'declarar scale [{at, ref_at, ref}]', shotAt(ac.t)?.id, ac.t);
  }
  // 4 · curva de energía
  add('peak-ratio', A.ratio >= T.peakRatio, 'FIX', `pico de energía ${A.ratio.toFixed(2)}× la mediana < ${T.peakRatio}× (energía plana: "PowerPoint")`, 'línea base contenida + un pico claro (más movimiento/cambio en el pico, menos en el resto)', shotAt(A.tp)?.id, A.tp);
  add('peak-pos', A.pos >= T.peakPos[0] && A.pos <= T.peakPos[1], 'FIX', `pico principal al ${(A.pos * 100).toFixed(0)}% (fuera de ${T.peakPos.map((x) => x * 100 + '%').join('–')})`, 'mover el clímax al 60–85 % del film', shotAt(A.tp)?.id, A.tp);
  add('calm-before', A.calm <= T.calmRatio, 'FIX', (Number.isFinite(A.calm) ? `sin calma antes del pico: energía previa ${A.calm.toFixed(2)}× la mediana (> ${T.calmRatio})` : 'sin calma antes del pico: la energía ya es alta desde el inicio (no hay línea base que lo haga sentir)'), `bajar la energía en los ${T.calmWin}s previos a la subida del pico (anticipación)`, shotAt(A.onset)?.id, Math.max(0, A.onset - T.calmWin));
  add('end-descent', A.endDrop <= T.endDrop, 'WARN', `final sin descenso: energía final ${(A.endDrop * 100).toFixed(0)}% del pico (> ${(T.endDrop * 100).toFixed(0)}%)`, 'peak-end: cerrar en descenso con un elemento de cierre (y end_hold_ok:true en el timeline)', '-', D * 0.9);
  add('hold-near-peak', A.holds.length + A.silences.length > 0, 'FIX', `ningún hold/silencio ≥ ${T.holdMin}s a ±${T.holdWin}s del pico (máx. ${A.longestHold.toFixed(2)}s)`, 'congelar el plano o silenciar el audio junto al pico (el silencio hace sentir el golpe)', shotAt(A.tp)?.id, A.tp);
  if (A.peaks > Math.max(2, Math.ceil(D / 10))) add('few-peaks', false, 'WARN', `${A.peaks} picos comparables: "si todos gritan, ninguno"`, 'pocos picos bien espaciados; uno principal', '-', A.tp);
  // 5 · impactos: sincronía con transitorios de audio, solo en el pico, presupuesto por escena
  const imps = [...M.impacts, ...(story.impacts ?? []).map((x) => ({ shot: x.shot ?? shotAt(x.t)?.id, t: x.t }))];
  const sync = imps.map((im) => { const d = M.transients.length ? Math.min(...M.transients.map((x) => Math.abs(x - im.t))) : Infinity; return { ...im, dFrames: d / fr }; });
  for (const s of sync) {
    add('impact-sync', s.dFrames <= T.syncFrames + 1e-6, 'FIX', Number.isFinite(s.dFrames) ? `impacto a ${s.t.toFixed(3)}s desincronizado del transitorio de audio: ${s.dFrames.toFixed(1)} fotogramas > ${T.syncFrames}` : `impacto a ${s.t.toFixed(3)}s sin transitorio de audio`, 'shot.sfx {at, type:"impact"} en el mismo instante que api.impact', s.shot, s.t);
    if (Math.abs(s.t - A.tp) > 0.15 * D) add('impact-peak', false, 'WARN', `impacto a ${s.t.toFixed(2)}s lejos del pico (${A.tp}s)`, 'impact frames solo en el pico', s.shot, s.t);
  }
  measures.impacts = sync.map((s) => ({ shot: s.shot, t: +s.t.toFixed(3), dFrames: Number.isFinite(s.dFrames) ? +s.dFrames.toFixed(2) : null }));
  // 6 · presupuesto sakuga (hero|normal|simple)
  const declared = M.shots.some((s) => s.sakuga), peakShot = shotAt(A.tp), tier = (s) => s.sakuga ?? 'normal';
  if (!declared) add('sakuga-declared', false, 'WARN', 'sin presupuesto sakuga (ningún shot hero|normal|simple)', 'shot.sakuga o story.sakuga: hero en el pico, simple en la calma');
  else {
    add('sakuga-peak', tier(peakShot) === 'hero', 'WARN', `el shot del pico (${peakShot?.id}) no es hero (${tier(peakShot)})`, 'el esfuerzo (iteraciones, post, impactos) va al pico', peakShot?.id, A.tp);
    const hero = M.shots.filter((s) => tier(s) === 'hero').reduce((p, s) => p + s.t[1] - s.t[0], 0) / D;
    add('sakuga-share', hero <= T.heroShare, 'WARN', `${(hero * 100).toFixed(0)}% del film es hero (> ${(T.heroShare * 100).toFixed(0)}%): si todo es hero, nada lo es`, 'reservar hero para el pico', '-', 0);
  }
  for (const s of M.shots) {
    const B = T.budget[tier(s)] ?? T.budget.normal, ni = imps.filter((x) => x.shot === s.id).length, sm = M.smear[s.id] ?? 0;
    if (ni > B.impacts) add('budget-impact', false, 'WARN', `${ni} impactos en ${s.id} (${tier(s)}: máx ${B.impacts})`, 'menos impactos o subir el shot a hero', s.id, s.t[0]);
    if (sm > B.smear + 1e-9) add('budget-smear', false, 'WARN', `${sm.toFixed(2)}s de smear en ${s.id} (${tier(s)}: máx ${B.smear}s)`, 'smear solo en la acción rápida del pico', s.id, s.t[0]);
  }
  measures.sakuga = M.shots.map((s) => ({ id: s.id, tier: s.sakuga, impacts: imps.filter((x) => x.shot === s.id).length, smear: +(M.smear[s.id] ?? 0).toFixed(2) }));
  // 7 · tamaños de plano (entropía de Shannon, bits)
  const sizes = M.shots.map((s) => s.size).filter(Boolean);
  if (sizes.length >= 3) {
    const cnt = {}; for (const z of sizes) cnt[z] = (cnt[z] ?? 0) + 1;
    const Hs = -Object.values(cnt).reduce((p, c) => p + (c / sizes.length) * Math.log2(c / sizes.length), 0); measures.sizeEntropy = +Hs.toFixed(3);
    add('size-entropy', Hs >= T.sizeEntropy, 'WARN', `tamaños de plano monótonos: entropía ${Hs.toFixed(2)} bits < ${T.sizeEntropy}`, 'alternar WS/MS/CU según la función del plano', '-', 0);
  }
  // 8 · paleta contenida + acento con función (fracción de píxeles del color acento)
  const accAll = mean(M.accent), inPk = M.accent.filter((_, i) => Math.abs(i / M.sampleFps - A.tp) <= 0.1 * D), outPk = M.accent.filter((_, i) => Math.abs(i / M.sampleFps - A.tp) > 0.1 * D);
  const focus = mean(inPk) / Math.max(1e-4, mean(outPk)); measures.accent = { share: +accAll.toFixed(4), peakFocus: +focus.toFixed(2), means: story.accent?.means ?? null };
  if (accAll > T.accentShare) add('accent-contained', false, 'WARN', `el acento cubre ${(accAll * 100).toFixed(1)}% del film (> ${(T.accentShare * 100).toFixed(0)}%)`, 'paleta contenida: el acento es escaso para que signifique');
  if (accAll < 1e-4) add('accent-used', false, 'WARN', 'el acento no aparece nunca', 'reservar el acento para lo que importa (el pico, el concepto)');
  else add('accent-function', focus >= T.accentFocus, 'WARN', `el acento no se concentra en el pico (×${focus.toFixed(2)} < ×${T.accentFocus})`, 'que el color acento marque el momento clave (o declarar story.accent.means)', shotAt(A.tp)?.id, A.tp);
  // 9 · cámara con peso (inercia, sobrepaso) · frame-rate por intensidad
  for (const s of M.shots) if (s.cam && s.cam.linearDev < T.linearDev) add('camera-inertia', false, 'WARN', `cámara ${s.cam.move} lineal (desviación ${s.cam.linearDev} < ${T.linearDev}): sin inercia`, 'ease cinema/inOut, o outBack para sobrepaso con decaimiento', s.id, s.t[0]);
  measures.camera = M.shots.filter((s) => s.cam).map((s) => ({ id: s.id, ...s.cam }));
  if (M.shots.some((s) => s.on > 1)) add('fps-intensity', !(peakShot?.on > 1), 'WARN', `el pico (${peakShot?.id}) se anima a ${peakShot?.on === 2 ? 'doses' : 'treses'}`, 'ones en el pico, doses en la calma (shot.on)', peakShot?.id, A.tp);
  measures.frameRate = M.shots.map((s) => ({ id: s.id, on: s.on }));
  // 10 · referencia de escala humana antes del salto
  for (const s of story.scale ?? []) add('scale-ref', typeof s.ref_at === 'number' && s.ref_at < s.at, 'FIX', `salto de escala en ${s.at}s sin referencia humana previa${typeof s.ref_at === 'number' ? ` (ref en ${s.ref_at}s)` : ''}`, 'mostrar antes algo de escala humana (una mano, una persona) y declarar ref_at', shotAt(s.at)?.id, s.at);
  for (const s of M.shots) if ((s.transition_out ?? '').toLowerCase() === 'scale-cut' && !(story.scale ?? []).some((x) => Math.abs(x.at - s.t[1]) < 0.5)) add('scale-declared', false, 'WARN', `scale-cut en ${s.t[1]}s sin story.scale`, 'declarar el salto con su referencia humana', s.id, s.t[1]);
  // 11 · pedagogía (Mayer), solo explainer
  if (M.profile === 'explainer') pedagogy(M, story, T, add, measures);
  const issues = checks.filter((c) => !c.pass).map(({ level, shot, t, problem, remedy }) => ({ level, shot, t, problem, remedy }));
  const wsum = checks.reduce((p, c) => p + c.weight, 0), score = wsum ? Math.round((100 * checks.reduce((p, c) => p + (c.pass ? c.weight : 0), 0)) / wsum) : 100;
  return { verdict: issues.some((i) => i.level === 'FIX') ? 'FIX' : 'SHIP', skipped: false, score, measures, checks: checks.map(({ id, pass, level }) => ({ id, pass, level })), issues };
}

function pedagogy(M, story, T, add, measures) {
  const D = M.duration, corpus = norm([story.idea, ...(story.narration ?? []).map((n) => n.text), ...(story.beats ?? []).map((b) => b.text), ...(story.concepts ?? []).map((c) => c.term), ...M.shots.flatMap((s) => [s.text, s.action])].join(' '));
  // coherencia: todo sujeto (foco con peso) se nombra en alguna frase
  const labels = new Map(); for (const f of M.frames) for (const x of f.foci) if ((x.weight ?? 1) >= 0.5 && !labels.has(x.label)) labels.set(x.label, { t: f.t, shot: x.shot });
  const orphans = [...labels].filter(([l]) => !['focus', 'motivo'].includes(l) && words(l).length && !words(l).some((w) => corpus.includes(w)));
  for (const [l, v] of orphans) add('mayer-coherence', false, 'FIX', `elemento huérfano "${l}": ninguna frase del guion lo nombra`, 'quitarlo o nombrarlo (coherencia: 0 elementos sin frase)', v.shot, v.t);
  if (!orphans.length) add('mayer-coherence', true, 'FIX');
  const textAt = (term, a, b) => M.frames.find((f) => f.t >= a && f.t <= b && f.texts.some((x) => norm(x.label).includes(norm(term))));
  const C = story.concepts ?? [];
  // señalización: el término aparece resaltado (texto en pantalla) al nombrarlo (±contigüidad)
  if (C.length) { const sig = C.filter((c) => textAt(c.term, c.t - T.contiguity, c.t + T.contiguity)).length / C.length; measures.signal = +sig.toFixed(2);
    add('mayer-signal', sig >= T.signal, 'WARN', `solo ${(sig * 100).toFixed(0)}% de los términos nuevos se resaltan al nombrarlos (< ${T.signal * 100}%)`, 'api.text/api.label con el término en el instante en que se nombra'); }
  // contigüidad: etiqueta junto al objeto, ±0,5 s y cerca en el espacio
  for (const c of C.filter((x) => x.focus)) {
    const ft = M.frames.find((f) => f.foci.some((x) => x.label === c.focus)), tt = M.frames.find((f) => f.texts.some((x) => norm(x.label).includes(norm(c.term))));
    if (!ft || !tt) { add('mayer-contiguity', false, 'WARN', `concepto "${c.term}": ${!ft ? `foco "${c.focus}"` : 'etiqueta'} nunca visible`, 'registrar el foco y la etiqueta', '-', c.t); continue; }
    const fb = ft.foci.find((x) => x.label === c.focus), tb = tt.texts.find((x) => norm(x.label).includes(norm(c.term)));
    const gap = Math.max(0, Math.max(fb.x, tb.x) - Math.min(fb.x + fb.w, tb.x + tb.w)) + Math.max(0, Math.max(fb.y, tb.y) - Math.min(fb.y + fb.h, tb.y + tb.h));
    add('mayer-contiguity', Math.abs(ft.t - tt.t) <= T.contiguity + 1e-9 && gap <= 0.2, 'WARN', `"${c.term}": etiqueta a ${Math.abs(ft.t - tt.t).toFixed(2)}s y ${(gap * 100).toFixed(0)}% del cuadro de su objeto`, 'etiqueta junto al objeto (≤ 0,5 s, cerca): api.label', fb.shot, ft.t);
  }
  // carga: ≤ N conceptos nuevos por minuto (ventana deslizante de 60 s)
  const ts = C.map((c) => c.t).sort((a, b) => a - b); let mx = 0; for (const t of ts) mx = Math.max(mx, ts.filter((x) => x >= t && x < t + 60).length); measures.conceptsMaxPerMin = mx;
  if (C.length) add('mayer-load', mx <= T.conceptsPerMin, 'WARN', `${mx} conceptos nuevos en un minuto (> ${T.conceptsPerMin})`, 'repartir o pre-entrenar (presentar los términos antes)');
  // ≤ N elementos animados a la vez (focos cuya caja cambia entre muestras)
  let anim = 0, at = 0;
  for (let i = 1; i < M.frames.length; i++) { const P = new Map(M.frames[i - 1].foci.map((x) => [x.shot + x.label, x])); const k = M.frames[i].foci.filter((x) => { const p = P.get(x.shot + x.label); return p && Math.abs(p.x - x.x) + Math.abs(p.y - x.y) + Math.abs(p.w - x.w) + Math.abs(p.h - x.h) > 0.004; }).length; if (k > anim) { anim = k; at = M.frames[i].t; } }
  measures.maxAnimated = anim;
  add('mayer-animated', anim <= T.maxAnimated, 'WARN', `${anim} elementos animados a la vez (> ${T.maxAnimated})`, 'escalonar: el ojo sigue ≤ 4 cosas', shotOfT(M, at), at);
  // segmentación: segmentos de una idea de 20–90 s
  if (D >= T.segment[0]) {
    if (!(story.segments ?? []).length) add('mayer-segments', false, 'WARN', 'sin segmentos declarados (story.segments)', `segmentos de una idea de ${T.segment.join('–')} s`);
    for (const [a, b] of story.segments ?? []) add('mayer-segments', b - a >= T.segment[0] && b - a <= T.segment[1], 'WARN', `segmento ${a}–${b}s dura ${(b - a).toFixed(0)}s (fuera de ${T.segment.join('–')} s)`, 'partir o fusionar', shotOfT(M, a), a);
  }
  // redundancia: texto en pantalla que duplica literalmente una frase larga de la narración
  const long = (story.narration ?? []).map((n) => norm(n.text)).filter((s) => s.split(' ').length >= 6), seen = new Set();
  for (const f of M.frames) for (const x of f.texts) { const l = norm(x.label); if (!seen.has(l) && long.includes(l)) { seen.add(l); add('mayer-redundancy', false, 'WARN', `el texto "${x.label}" duplica la narración`, 'en pantalla solo palabras clave', x.shot, f.t); } }
}
const shotOfT = (M, t) => (M.shots.find((s) => t >= s.t[0] && t < s.t[1]) ?? M.shots[M.shots.length - 1])?.id ?? '-';

// ───────── etapa completa ─────────
const rdJ = (p, d) => (fs.existsSync(path.join(ROOT, p)) ? JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')) : d);
export async function runArc({ fps = 12, story: sp, record = false, write = true } = {}) {
  const { loadFilm } = await import('./film.mjs'), film = await loadFilm({ animatic: true }), spath = storyPath(film, sp);
  let story = null; if (spath) { try { story = JSON.parse(fs.readFileSync(path.join(ROOT, spath), 'utf8')); } catch (e) { story = { _parseError: e.message }; } }
  const M = await measure({ fps, story, width: film.width, height: film.height }), calib = rdJ('data/arc.calib.json', {}), T = thresholds(M.profile, calib);
  const res = story?._parseError ? { verdict: 'FIX', score: 0, measures: {}, checks: [], issues: [{ level: 'FIX', shot: '-', t: 0, problem: `story.json ilegible: ${story._parseError}`, remedy: 'JSON válido' }] } : analyze(M, story, T);
  const out = { title: M.title, story: spath, profile: M.profile, style: M.style, ...res, thresholds: T, energy: { fps, E: M.E.map((e) => +e.toFixed(5)) } };
  if (record && story && !res.skipped) {                                       // esta pieza es referencia aprobada: sus medidas alimentan la calibración
    const e = res.measures.energy, obs = { peakRatio: e.ratio, calmRatio: e.calm, endDrop: e.endDrop, holdMin: e.longestHoldNearPeak, sizeEntropy: res.measures.sizeEntropy, accentShare: res.measures.accent?.share, accentFocus: res.measures.accent?.peakFocus,
      questionBy: story.question.posed_at / M.duration, answerAfter: story.question.answered_at / M.duration, accomTol: Math.abs(story.accommodation.t - e.peakT) / M.duration, syncFrames: Math.max(0, ...(res.measures.impacts ?? []).map((i) => i.dFrames ?? 0)) };
    const C = rdJ('data/arc.calib.json', {}); C[M.profile] ??= {};
    for (const [k, v] of Object.entries(obs)) if (typeof v === 'number' && Number.isFinite(v)) (C[M.profile][k] ??= []).push(+v.toFixed(4));
    fs.writeFileSync(path.join(ROOT, 'data/arc.calib.json'), JSON.stringify(C, null, 1)); out.recorded = obs;
  }
  if (write) { fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'out/arc.json'), JSON.stringify(out, null, 1)); }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const r = await runArc({ fps: +arg('--fps', 12), record: argv.includes('--record') });
  const e = r.measures.energy;
  if (e) console.log(`energía: pico ${e.ratio}× mediana en ${e.peakT}s (${(e.peakPos * 100).toFixed(0)}%) · calma previa ${e.calm}× · final ${(e.endDrop * 100).toFixed(0)}% del pico · hold junto al pico ${e.longestHoldNearPeak}s`);
  for (const x of r.issues) console.log(`${x.level.padEnd(4)}  ${String(x.shot).padEnd(6)} ${x.t.toFixed(2).padStart(7)}s  ${x.problem}  →  ${x.remedy}`);
  console.log(r.skipped ? `\nARC omitido (sin story.json)  [${r.profile}]` : `\n${r.verdict === 'FIX' ? `FIX (${r.issues.filter((i) => i.level === 'FIX').length})` : 'SHIP'}  arco ${r.score}/100  [${r.profile}]`);
  process.exit(r.verdict === 'FIX' ? 1 : 0);
}
