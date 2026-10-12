#!/usr/bin/env node
// Escalera de verificación determinista (barata → cara). Sin VLM. Aplica el gusto del estilo activo.
//   node engine/lint.mjs [--only validate|determinism|layout|camera|transitions|beats|handoffs|contracts|motion|rhythm|arc|narr] [--shot ID] [--fps 12] [--style X] [--profile Y]
// Salida: out/lint.json (solo pasada completa) + out/lint/<film>/<ID>.json + veredicto SHIP / FIX (shot  t  problema  arreglo)
//   --shot ID: ID + vecinos inmediatos del timeline; escribe solo sus veredictos por shot. --only X: parcial, nunca el global.
import './summary.mjs';   // T2: --summary / OPUS_SUMMARY=1 / OPUS_AGENT=1
import './help.mjs';
import { announceFilm } from './filmid.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { makeRenderer } from './render.mjs';
import { ROOT, timelinePath } from './film.mjs';
import { validateTimeline, ENUMS } from './schema.mjs';
import { specOf, camStats, camState, camEnds } from './camera.mjs';
import { barHeight } from './grade.mjs';
import { checkPalette } from './styles.mjs';
import { luminance } from './color.mjs';
import { guardCtx, scanShots, scanFondoCodigo } from './guard.mjs';
import { activeShots } from './seek.mjs';
import { currentHashes, stamp, neighbors, lintDir, filmKey } from './verdict.mjs';
import { writeAtomic } from './lock.mjs';
import { record } from './ledger.mjs';
import { contractIssues } from './contract.mjs';
import { secPair } from './core.mjs';
import { incidencias as recetaIssues } from './recetas.mjs';
import { frameCache, frameKey, noCache, stats as FCS, pruneFrames } from './framecache.mjs';

// R3 (spec 009): lint corre con fxFast por defecto (−45 % ms/fotograma; PSNR ≈ 70 dB); OPUS_FXFAST=0 lo apaga. El master NO lo usa.
process.env.OPUS_FXFAST ??= '1';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const only = arg('--only');
const want = (k) => !only || only === k;
announceFilm();
const issues = [];
let CHECK = 'schema';                                                       // check que emite cada issue (el trinquete de orch compara por check)
const push = (level) => (shot, t, problem, remedy) => issues.push({ level, check: CHECK, shot, t: +(+t).toFixed(3), problem, remedy });
const fix = push('FIX'), warn = push('WARN');
const WHY = ENUMS.why, TRANS = ENUMS.transition;   // fuente única: data/timeline.schema.json
const WHY_MOVES = { approach: ['push'], reveal: ['pull', 'tilt'], follow: ['slide', 'pan', 'tilt', 'auto'], compare: ['slide', 'pan'], unease: ['rotate', 'push', 'pull', 'slide', 'pan', 'tilt'] };
const tOf = (s) => (s.transition_out ?? '').toLowerCase().trim();

// E8: esquema + referencias (ids, t, huecos, cobertura, handoffs, after, cam.why, estilo) ANTES que todo y con cualquier --only.
// Si la estructura está rota el resto no corre (asume la forma): lint.json con los FIX del esquema y exit 1.
{
  const tp = timelinePath(), tl = JSON.parse(fs.readFileSync(path.join(ROOT, tp), 'utf8'));
  const sch = validateTimeline(tl, { style: process.env.OPUS_STYLE });
  for (const x of sch) (x.level === 'FIX' ? fix : warn)(x.shot, x.t, x.problem, x.remedy);
  if (sch.some((x) => x.kind === 'schema' && x.level === 'FIX')) {
    fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
    // FIX sellado (F1): bloquea master/crítico también tras --only; nunca deja un SHIP viejo vigente.
    const H = currentHashes(), body = JSON.stringify({ style: tl.style ?? null, profile: tl.profile ?? null, checks: 'schema', verdict: 'FIX', partial: false, ...stamp(H), issues }, null, 2);
    writeAtomic(path.join(ROOT, 'out/lint.json'), body);
    record({ action: 'lint', target: `lint/${H.film}/schema`, hash_after: H.filmHash, verdict: 'FIX', why: 'timeline no valida el esquema' });
    for (const x of issues) console.log(`${x.level.padEnd(4)}  ${String(x.shot).padEnd(6)} ${x.t.toFixed(2).padStart(7)}s  ${x.problem}  →  ${x.remedy}`);
    console.log(`\nFIX (${issues.filter((x) => x.level === 'FIX').length})  [esquema: ${tp} no valida data/timeline.schema.json]`);
    process.exit(1);
  }
}

function validate(film) {
  const S = film.S, ids = new Set(), bans = S.bans.map((b) => b.toLowerCase());
  for (const p of checkPalette(S)) (p.level === 'FIX' ? fix : warn)('-', 0, `[estilo ${S.name}] ${p.problem}`, p.remedy);
  for (const s of film.shots) {
    ids.add(s.id);
    const len = s.t[1] - s.t[0], [lo, hi] = film.P.shotLen;
    if (len < lo || len > hi) warn(s.id, s.t[0], `duración ${len.toFixed(2)}s fuera de [${lo},${hi}] (${film.profileName})`, 'ajustar o justificar');
    const tr = (s.transition_out ?? '').toLowerCase();
    if (bans.some((b) => tr.includes(b))) fix(s.id, s.t[1], `transición prohibida en estilo ${S.name}: "${s.transition_out}"`, 'morph / wipe / iris / corte en beat');
    const sp = specOf(s, film);
    if (!s.cam && sp.move !== 'static' && !WHY.includes(sp.why)) fix(s.id, s.t[0], `cámara legada "${s.camera}" sin cam.why`, `migrar a cam {move, why: ${WHY.join('|')}}`);   // con cam, lo garantiza el esquema
    if (WHY.includes(sp.why) && sp.move !== 'static' && !WHY_MOVES[sp.why].includes(sp.move)) warn(s.id, s.t[0], `why "${sp.why}" no casa con move "${sp.move}"`, `${sp.why} → ${WHY_MOVES[sp.why].join('/')}`);
    if (film.P.requireCausality && s !== film.shots[0]) {
      if (!s.after || !ids.has(s.after)) fix(s.id, s.t[0], 'sin predecesor causal ("after")', 'enlazar con el shot cuya idea modifica');
      if (!s.anomaly && !s.premise) warn(s.id, s.t[0], 'sin premise/anomaly', 'declarar qué no encajaba');
    }
  }
  transitionsStatic(film);
  motifCheck(film);
  for (const x of recetaIssues(film.shots, ROOT)) warn(x.shot, x.t, x.problem, x.remedy);   // spec 016: receta.hueco / receta.repeticion (WARN; las recetas son opcionales)
  const violent = film.shots.filter((s) => { const sp = specOf(s, film); return sp.whip || sp.move === 'rotate' || sp.why === 'unease'; });
  if (violent.length > Math.max(1, Math.ceil(film.shots.length / 8))) warn(violent[1].id, violent[1].t[0], `${violent.length} planos violentos (whip/rotate/unease): "si todos gritan, ninguno"`, 'máximo 1 por acto (~8 shots)');
  const fp = path.join(ROOT, 'data/facts.json'), facts = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : {};
  for (const s of film.shots) for (const f of s.facts ?? []) {
    if (!facts[f]) fix(s.id, s.t[0], `hecho "${f}" no está en facts.json`, 'añadir con fuente');
    else if (!facts[f].source) fix(s.id, s.t[0], `hecho "${f}" sin fuente`, 'añadir source');
  }
  if (film.P.requireFacts) for (const s of film.shots) if ((s.text || s.year) && !(s.facts ?? []).length) warn(s.id, s.t[0], 'texto/fecha sin hecho asociado', 'referenciar facts');
}

const hoOf = (film, a, b) => (film.handoffs ?? []).filter((h) => h.from === a.id && h.to === b.id);
// Taxonomía de transiciones: cada tipo exige un predicado (los que se miden sobre datos, aquí; sobre imagen, en transitions()).
function transitionsStatic(film) {
  for (let i = 0; i < film.shots.length - 1; i++) {
    const A = film.shots[i], B = film.shots[i + 1], tr = tOf(A), ho = hoOf(film, A, B);
    if (!tr) continue;
    if (!TRANS.includes(tr) && !film.S.bans.some((b) => tr.includes(b.toLowerCase()))) warn(A.id, A.t[1], `transición "${A.transition_out}" fuera de la taxonomía`, TRANS.join(' | '));
    if (tr === 'cut' && ho.length) fix(A.id, A.t[1], `cut con handoff ${A.id}→${B.id}: si hay identidad, no es un corte`, 'usar morph/match o quitar el handoff');
    if (tr === 'morph') {
      if (!ho.length) fix(A.id, A.t[1], `morph sin handoff de entidad ${A.id}→${B.id}`, 'declarar handoffs {from,to,entity,at}');
      const a = camEnds(A, film).b, b = camEnds(B, film).a;
      if (Math.abs(a.z - b.z) / a.z > 0.01 || Math.abs(a.x - b.x) > 0.01 * film.width || Math.abs(a.y - b.y) > 0.01 * film.height || Math.abs(a.r - b.r) > 0.3) fix(B.id, B.t[0], `morph con salto de cámara ${A.id}→${B.id}`, 'cam.chain:true en el segundo shot');
      const sb = specOf(B, film); if (sb.move !== 'static' && sb.delay < 0.4) warn(B.id, B.t[0], 'cámara en movimiento justo tras un morph', 'cam.delay 0.4–0.8 s: el cuerpo necesita asentar');
    }
    if (tr === 'match' && !ho.some((h) => h.kind === 'match')) fix(A.id, A.t[1], `match sin handoff {kind:"match"} ${A.id}→${B.id}`, 'declarar handoff kind:"match" (silueta, aspecto y color-rol)');
    if (tr === 'scale-cut') {
      const o = A.poi_out, n = B.poi_in;
      if (!o || !n) fix(A.id, A.t[1], 'scale-cut sin poi_out/poi_in', 'declarar [fx,fy] normalizado del punto de interés en ambos shots');
      else if (Math.hypot(o[0] - n[0], o[1] - n[1]) > 0.06) fix(A.id, A.t[1], `scale-cut: punto de interés no coincide (${Math.hypot(o[0] - n[0], o[1] - n[1]).toFixed(2)} > 0.06)`, 'alinear poi_out con poi_in');
      const big = ['ECU', 'CU'], wide = ['WS', 'EWS'];
      if (!((big.includes(A.size) && wide.includes(B.size)) || (wide.includes(A.size) && big.includes(B.size)))) warn(A.id, A.t[1], `scale-cut sin salto de escala (size ${A.size}→${B.size})`, 'ECU/CU ↔ WS/EWS');
    }
  }
}
// Motivo: el estado i+1 sale del i (o hay un cut explícito). El espectador apuesta; cada beat paga y cambia la apuesta.
function motifCheck(film) {
  const M = film.motif; if (!M?.states?.length) return;
  let prev = null;
  for (const s of film.shots) {
    if (!s.motifState) continue;
    const i = M.states.indexOf(s.motifState);
    if (i < 0) { fix(s.id, s.t[0], `motifState "${s.motifState}" no está en motif.states`, M.states.join(' → ')); continue; }
    if (prev && i !== prev.i && i !== prev.i + 1 && tOf(prev.s) !== 'cut') warn(s.id, s.t[0], `el motivo salta de "${M.states[prev.i]}" a "${s.motifState}"`, 'avanzar un estado por shot o cortar explícitamente');
    prev = { i, s };
  }
}

// Determinismo con atribución: se muestrea el centro de CADA shot (y extremos); el fallo nombra los shots activos.
// R6 (spec 009): solo se cachean las muestras que PASARON (clave = film+motor+shots activos+t+tamaño); cuando una muestra corre, renderiza
// dos veces de verdad (renderizador propio, SIN caché de fotogramas). OPUS_NOCACHE=1 fuerza todas.
const detFile = () => path.join(ROOT, 'out/cache/lint', filmKey(), 'determinism.json');
async function determinism(film) {
  const sc = film.lintScope, ts = sc ? film.shots.filter((s) => sc.ids.has(s.id)).map((s) => (s.t[0] + s.t[1]) / 2) : [0, 0.37, film.duration, ...film.shots.map((s) => (s.t[0] + s.t[1]) / 2)], seen = new Set();
  const size = arg('--size', undefined); let [W, H] = size ? size.split('x').map(Number) : [film.width, film.height]; W -= W % 2; H -= H % 2;
  let ok = new Set(); try { ok = new Set(JSON.parse(fs.readFileSync(detFile(), 'utf8'))); } catch {}
  const n0 = ok.size; let R = null;
  for (const t of ts) {
    const key = frameKey(film, t, { W, H, grade: true });
    if (!noCache() && ok.has(key)) { FCS.det.hit++; continue; }
    FCS.det.miss++;
    R ??= await makeRenderer({ size, grade: true });
    R.frame(t); const a = R.cv.toBuffer('raw');
    R.frame(film.duration * 0.2); R.frame(t); const b = R.cv.toBuffer('raw');
    if (!a.equals(b)) { for (const s of activeShots(film, film.timeMap ? film.timeMap(t) : t)) if (!seen.has(s.id)) { seen.add(s.id); fix(s.id, t, 'seek(t) no determinista en este shot', 'eliminar estado entre frames / Math.random / Date (ver avisos de escaneo)'); } }
    else ok.add(key);
  }
  if (!noCache() && ok.size !== n0) { try { fs.mkdirSync(path.dirname(detFile()), { recursive: true }); writeAtomic(detFile(), JSON.stringify([...ok].slice(-20000))); } catch {} }
}
// Fuentes: si la familia no está instalada/registrada, node-canvas cae al fallback EN SILENCIO y el navegador no → métricas distintas.
function fonts(R) {
  const tf = R.film.S.typeface, x = R.ctx, probe = 'Hamburgefonstiv 0123', w = (f) => { x.font = `40px ${f}`; return x.measureText(probe).width; };
  const a = w(`"${tf.family}", serif`), b = w(`"${tf.family}", monospace`);
  if (Math.abs(a - b) < 0.5 && !(tf.files ?? []).length) return;
  if (Math.abs(a - w('serif')) < 0.01 && Math.abs(b - w('monospace')) < 0.01) warn('-', 0, `fuente "${tf.family}" no disponible: se usa el fallback (métricas ≠ navegador)`, 'registrar typeface.files en el estilo o instalarla');
}
// Guardia: lo que el shot hizo con el ctx crudo (registrado por el Proxy durante layout).
function guardReport(film) {
  const seen = new Set(), byShot = new Map();
  for (const r of film.guardLog) {
    for (const v of r.violations) { const k = r.shot + v.op; if (seen.has(k)) continue; seen.add(k);
      const msg = { fillText: 'texto dibujado con ctx.fillText (sin api.text: no hay lint de tipo)', strokeText: 'texto con ctx.strokeText (sin api.text)', setTransform: 'ctx.setTransform en el shot (anula la cámara)', resetTransform: 'ctx.resetTransform en el shot (anula la cámara)', 'save/restore': 'save/restore desequilibrado', transform: 'fuga de transform' }[v.op] ?? v.op;
      fix(r.shot, r.t, `${msg}${v.detail ? ` — ${v.detail}` : ''}`, v.op.includes('Text') ? 'api.text / api.label / api.tex' : 'dibujar dentro de save/restore; cámara vía shot.cam o api.depth'); }
    if (r.scale) { if (!byShot.has(r.shot)) byShot.set(r.shot, []); byShot.get(r.shot).push(r); }
  }
  for (const [id, rs] of byShot) {
    const uni = rs.filter((r) => r.scale.frac >= 0.9), meds = uni.map((r) => r.scale.med);
    if (uni.length >= 0.6 * rs.length && meds.length > 2 && (Math.max(...meds) - Math.min(...meds)) / Math.min(...meds) > 0.08)
      warn(id, uni[0].t, `cámara falsa: todo el dibujo del shot escala a la vez (${Math.min(...meds).toFixed(2)}→${Math.max(...meds).toFixed(2)})`, 'mover el zoom a shot.cam (push/pull) para que el lint de cámara lo mida');
  }
}

// Cámara: un movimiento con razón, velocidades dentro del estilo, sin saltos en morphs.
function camera(film) {
  const C = film.S.camera;
  for (const s of film.shots) {
    if (s.cam?.move === 'auto' && !film.autocam?.[s.id]) fix(s.id, s.t[0], 'cam auto sin hornear (o desactualizada)', 'node engine/autocam.mjs');
    const sp = specOf(s, film), st = camStats(s, film), tag = `${sp.move}${s.cam?.amount != null ? ' ' + s.cam.amount : ''}`;
    if (sp.move !== 'static' && !sp.why) warn(s.id, s.t[0], `movimiento de cámara (${tag}) sin razón narrativa`, 'añadir cam.why: qué mira/sigue/revela');
    if (!sp.whip) {
      if (st.zoomPerSec > C.maxZoomPerSec) fix(s.id, s.t[0], `zoom demasiado rápido: ${(st.zoomPerSec * 100).toFixed(0)}%/s > ${(C.maxZoomPerSec * 100).toFixed(0)}%/s (${film.S.name})`, 'bajar amount, alargar el shot o cam.whip:true si es un latigazo intencional');
      if (st.panPerSec > C.maxPanPerSec) fix(s.id, s.t[0], `paneo demasiado rápido: ${(st.panPerSec * 100).toFixed(0)}% del cuadro/s > ${(C.maxPanPerSec * 100).toFixed(0)}%/s`, 'bajar amount o alargar el shot');
      if (st.rotPerSec > C.maxRotPerSec) fix(s.id, s.t[0], `giro demasiado rápido: ${st.rotPerSec.toFixed(1)}°/s > ${C.maxRotPerSec}°/s`, 'bajar amount o alargar');
    }
    if (sp.shake > (C.maxShake ?? 0.004)) fix(s.id, s.t[0], `handheld ${sp.shake} > ${C.maxShake ?? 0.004} (mareo)`, 'reducir cam.shake');
  }
  for (let i = 0; i < film.shots.length; i++) for (let j = i + 1; j < film.shots.length; j++) {
    const A = film.shots[i], B = film.shots[j], t0 = Math.max(A.t[0], B.t[0]);
    if (B.t[0] >= A.t[1] || t0 > Math.min(A.t[1], B.t[1])) continue;
    const a = camState(A, t0, film, { shake: false }), b = camState(B, t0, film, { shake: false });
    if (Math.abs(a.z - b.z) / a.z > 0.02 || Math.abs(a.x - b.x) > 0.02 * film.width || Math.abs(a.y - b.y) > 0.02 * film.height || Math.abs(a.r - b.r) > 0.5)
      warn(B.id, t0, `cámaras distintas durante el morph ${A.id}→${B.id} (el mismo mundo se ve desplazado)`, 'cam.chain:true en el segundo shot');
  }
}

const inter = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
async function layout(R, fps, FC) {
  const { film, W, H } = R, P = film.P, S = film.S, bar = barHeight(film) * (H / film.height), visH = H - 2 * bar;
  const minPx = (P.minFontPx * Math.min(W, H)) / 1080, seen = new Set(), once = (k, f) => { if (!seen.has(k)) { seen.add(k); f(); } };
  const safe = { x0: W * P.safe.side, x1: W * (1 - P.safe.side), y0: bar + H * P.safe.top, y1: H - bar - H * P.safe.bottom };
  const vis = new Map(); // etiqueta → {first,last,chars,shot}: tiempo de lectura
  const sc = film.lintScope;                                                 // --shot: solo la ventana del shot y sus vecinos
  const frame = async (t, px = false) => { const f = await FC.get(t, { px, guard: guardCtx }); film.guardLog.push(...f.guardLog); lastPx = f.data; return f.boxes; };   // R1: fotogramas de la caché compartida (los registros de la guardia viajan con ellos)
  let lastPx = null;
  for (let i = 0; i <= film.duration * fps; i++) {
    if (sc && (i / fps < sc.t0 || i / fps > sc.t1)) continue;
    const t = i / fps, boxes = await frame(t);
    for (const m of boxes.meta ?? []) if (m.prim === 'world3d' && m.angulo) once('w3a' + m.shot, () => warn(m.shot, t, m.angulo, m.remedy));   // spec 009: w3d.angulo (ángulo fuera de la regla de la escala de plano, sin override)
    for (const m of boxes.meta ?? []) if (m.prim === 'world3d' && m.unavailable) once('w3' + m.shot, () => fix(m.shot, t, `world3d no disponible: ${m.reason}`, 'instalar el backend 3D (npm i gl three + Mesa libEGL/libGL con llvmpipe) o quitar api.world3d del shot'));   // spec 004
    const texts = boxes.filter((b) => b.kind === 'text'), foci = boxes.filter((b) => b.kind === 'focus');
    const sizes = [];
    for (let a = 0; a < texts.length; a++) {
      const A = texts[a], v = vis.get(A.label + A.shot) ?? { first: t, chars: A.chars ?? A.label.length, shot: A.shot, label: A.label }; v.last = t; vis.set(A.label + A.shot, v);
      if (!sizes.some((s) => Math.abs(s - A.sizePx) / s < 0.12)) sizes.push(A.sizePx);
      if (A.x < safe.x0 || A.x + A.w > safe.x1 || A.y < safe.y0 || A.y + A.h > safe.y1) once('safe' + A.label, () => fix(A.shot, t, `"${A.label}" fuera de safe area${bar ? ' (letterbox incluido)' : ''}`, 'mover hacia el interior (api.at / api.safe)'));
      const lim = minPx * (A.role === 'label' ? 0.6 : 1);
      if (A.sizePx && A.sizePx < lim - 0.5) once('min' + A.label, () => fix(A.shot, t, `"${A.label}" ${A.sizePx.toFixed(0)}px < ${lim.toFixed(0)}px`, 'usar role h2/h1 o subir tamaño'));
      for (let b = a + 1; b < texts.length; b++) {
        const B = texts[b], I = inter(A, B);
        if (A.label !== B.label && I > 0.02 * Math.min(A.w * A.h, B.w * B.h)) once('tt' + A.label + B.label, () => fix(A.shot, t, `texto "${A.label}" pisa "${B.label}"`, 'separar o escalonar en el tiempo'));
      }
      const inHole = (F) => { if (!F.hollow) return false; const iw = F.w * F.hollow, ih = F.h * F.hollow, ix = F.x + (F.w - iw) / 2, iy = F.y + (F.h - ih) / 2; return A.x >= ix && A.x + A.w <= ix + iw && A.y >= iy && A.y + A.h <= iy + ih; };
      for (const F of foci) if (!inHole(F) && inter(A, F) > 0.02 * A.w * A.h) once('tf' + A.label + F.label, () => fix(A.shot, t, `texto "${A.label}" sobre foco "${F.label}"`, 'tipo nunca sobre detalle'));
    }
    if (sizes.length > 3) once('lv' + film.shots.find((s) => t >= s.t[0] && t < s.t[1])?.id, () => warn(film.shots.find((s) => t >= s.t[0] && t < s.t[1])?.id ?? '-', t, `${sizes.length} tamaños de tipo a la vez (jerarquía difusa)`, 'máximo 3 niveles: h1/h2/body'));
  }
  for (const v of vis.values()) {
    const dur = v.last - v.first + 1 / fps, need = 0.4 + v.chars / P.readCps;
    if (dur < 0.6 * need) once('rd' + v.label, () => fix(v.shot, v.first, `"${v.label}" visible ${secPair(dur, need)[0]}s; leer pide ≥ ${secPair(dur, need)[1]}s (${P.readCps} car/s)`, 'alargar o acortar el texto'));
    else if (dur < need) once('rd' + v.label, () => warn(v.shot, v.first, `"${v.label}" visible ${secPair(dur, need)[0]}s < ${secPair(dur, need)[1]}s de lectura cómoda`, 'alargar un poco'));
  }
  // Composición por shot (fotograma central): bordes, anclaje a puntos de poder, espacio negativo.
  const cm = S.compose, m = cm.edgeMargin;
  for (const s of film.shots) {
    if (s.compose === 'free' || (sc && !sc.ids.has(s.id))) continue;
    const tm = (s.t[0] + s.t[1]) / 2, all = await frame(tm, true), px = lastPx, foci = all.filter((b) => b.kind === 'focus' && b.shot === s.id);
    if (!foci.length) { if (film.mods[s.id]) fix(s.id, tm, 'el shot no registra ningún foco (composición y tipo sobre sujeto no se pueden medir)', 'api.focus(...) o una primitiva que lo registre (morph, path, plot, tex…)'); continue; }
    for (const f of foci) if (!f.bleed && (f.x < W * m || f.x + f.w > W * (1 - m) || f.y < bar + visH * m || f.y + f.h > H - bar - visH * m))
      warn(s.id, tm, `sujeto "${f.label}" toca el borde del encuadre${bar ? ' útil (letterbox)' : ''}`, 'dar aire (margen ' + Math.round(m * 100) + '%) o focus(...,{bleed:true}) si es intencional');
    const area = foci.reduce((p, f) => p + f.w * f.h * f.weight, 0), cx = foci.reduce((p, f) => p + (f.x + f.w / 2) * f.w * f.h * f.weight, 0) / area, cy = foci.reduce((p, f) => p + (f.y + f.h / 2) * f.w * f.h * f.weight, 0) / area;
    if (cm.anchor !== 'free') {
      const pts = [[W / 2, bar + visH / 2]]; if (cm.anchor === 'thirds') for (const fx of [1 / 3, 2 / 3]) for (const fy of [1 / 3, 2 / 3]) pts.push([W * fx, bar + visH * fy]);
      const d = Math.min(...pts.map(([x, y]) => Math.hypot(cx - x, cy - y))), tol = cm.anchorTol * Math.min(W, visH);
      if (d > tol) warn(s.id, tm, `masa visual lejos de ${cm.anchor === 'center' ? 'el centro' : 'centro y tercios'} (${d.toFixed(0)}px > ${tol.toFixed(0)}px)`, 'recolocar el sujeto en un punto de poder o compose:"free"');
    }
    const main = foci.filter((f) => f.weight >= 0.5).map((f) => f.w * f.h).sort((x, y) => y - x);
    if (main.length > 1 && main[1] >= 0.6 * main[0] && main[1] / (W * visH) > 0.05) warn(s.id, tm, 'dos focos compiten por la atención (el segundo ≥ 0.6× el primero)', 'jerarquía: uno domina; el otro weight<0.5 o más pequeño');
    if (s.must_read_mute !== false) {     // en grises el sujeto debe separarse del papel
      const pl = luminance(S.palette.paper) ** (1 / 2.2);
      for (const f of foci.filter((q) => q.weight >= 0.5 && !q.bleed)) {
        const df = [], x0 = Math.max(0, Math.floor(f.x)), x1 = Math.min(W, Math.ceil(f.x + f.w)), y0 = Math.max(0, Math.floor(f.y)), y1 = Math.min(H, Math.ceil(f.y + f.h));
        for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { const i = (y * W + x) * 4, d = Math.abs((0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255 - pl); if (d > 0.06) df.push(d); }
        df.sort((p, q) => p - q);
        if (df.length < 0.0015 * (f.w * f.h) / 4) warn(s.id, tm, `sujeto "${f.label}" casi invisible en grises`, 'subir contraste de valor con el papel');
        else if (df[Math.floor(df.length * 0.9)] < 0.3) warn(s.id, tm, `sujeto "${f.label}" no se separa del fondo en grises (Δ ${df[Math.floor(df.length * 0.9)].toFixed(2)} < 0.30)`, 'separar por valor, no solo por matiz');
      }
    }
    if (s.saliency !== false) {   // ¿el ojo va donde dice el foco? prominencia = contraste de valor con el papel, fuera del texto
      const pl = luminance(S.palette.paper) ** (1 / 2.2), txt = all.filter((b) => b.kind === 'text'), gx = 64, gy = 36, cells = [];
      for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) { const x = Math.floor(((i + 0.5) * W) / gx), y = Math.floor(((j + 0.5) * H) / gy); if (y < bar || y > H - bar || txt.some((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)) continue;
        const q = (y * W + x) * 4; cells.push([x, y, Math.abs((0.299 * px[q] + 0.587 * px[q + 1] + 0.114 * px[q + 2]) / 255 - pl)]); }
      cells.sort((a, b) => b[2] - a[2]); const top = cells.slice(0, Math.max(8, Math.floor(cells.length * 0.05))).filter((c) => c[2] > 0.25);
      if (top.length >= 8) { const sx = top.reduce((a, c) => a + c[0], 0) / top.length, sy = top.reduce((a, c) => a + c[1], 0) / top.length, inF = top.filter((c) => foci.some((f) => c[0] >= f.x - 0.03 * W && c[0] <= f.x + f.w + 0.03 * W && c[1] >= f.y - 0.03 * H && c[1] <= f.y + f.h + 0.03 * H)).length / top.length;
        if (inF < 0.5) warn(s.id, tm, `el ojo va a otro sitio: solo ${(inF * 100).toFixed(0)}% de la zona más contrastada cae en los focos (centro de atención ≈ ${(sx / W).toFixed(2)}, ${(sy / H).toFixed(2)})`, 'bajar contraste del elemento secundario o declararlo con api.focus'); }
    }
    const cover = foci.filter((f) => f.weight >= 0.5).reduce((p, f) => p + f.w * f.h, 0) / (W * visH);   // el fondo (weight<0.5) no es sujeto
    if (cover > 1 - cm.negativeSpace) warn(s.id, tm, `el sujeto ocupa ${(cover * 100).toFixed(0)}% del encuadre; ${cm.negativeSpace * 100}% de aire mínimo (${S.name})`, 'reducir escala o aclarar el plano');
  }
}

async function transitions(R, FC) {
  const { film, W, H } = R, P = film.P, bar = barHeight(film) * (H / film.height);
  const safe = { x0: W * P.safe.side, x1: W * (1 - P.safe.side), y0: bar + H * P.safe.top, y1: H - bar - H * P.safe.bottom };
  for (let i = 0; i < film.shots.length - 1; i++) {
    const A = film.shots[i];
    if (tOf(A) !== 'wipe-obj' || (film.lintScope && !film.lintScope.ids.has(A.id))) continue;
    const t = A.t[1] - 1 / film.fps, foci = (await FC.get(t)).boxes.filter((b) => b.kind === 'focus' && b.shot === A.id);
    const cov = foci.reduce((p, f) => p + Math.max(0, Math.min(f.x + f.w, safe.x1) - Math.max(f.x, safe.x0)) * Math.max(0, Math.min(f.y + f.h, safe.y1) - Math.max(f.y, safe.y0)), 0) / ((safe.x1 - safe.x0) * (safe.y1 - safe.y0));
    if (cov < 0.8) fix(A.id, A.t[1], `wipe-obj: el sujeto cubre ${(cov * 100).toFixed(0)}% del área segura en el corte (< 80%)`, 'que el objeto tape el cuadro antes de cortar');
  }
}

function beats(film) {
  const G = film.gridTimes ?? film.beatTimes;
  if (!film.P.cutOnBeat || !G.length) return;
  const tol = 1 / film.fps + 1e-6;
  for (const s of film.shots) if (s.t[0] > 0 && !G.some((b) => Math.abs(b - s.t[0]) <= tol)) {
    const near = G.reduce((p, b) => (Math.abs(b - s.t[0]) < Math.abs(p - s.t[0]) ? b : p));
    fix(s.id, s.t[0], 'corte fuera de beat', `mover a ${near.toFixed(3)}s`);
  }
}

function handoffs(film) {
  for (const h of film.handoffs ?? []) {
    const nameA = h.entity, nameB = h.entityTo ?? h.entity;
    const A = film.mods[h.from]?.entities?.[nameA], B = film.mods[h.to]?.entities?.[nameB];
    if (!A || !B) { fix(h.to, h.at, `entidad "${!A ? nameA : nameB}" no exportada por ${!A ? h.from : h.to}`, 'exportar entities.' + (!A ? nameA : nameB)); continue; }
    const a = A(h.at, film), b = B(h.at, film), tol = h.tol ?? 2, tolA = h.tolAngle ?? 8;
    if (h.kind === 'match') {   // silueta: centro ± tol, aspecto ± 15 %, mismo color-rol; el id puede cambiar
      if (Math.hypot(a.x - b.x, a.y - b.y) > tol * 4) fix(h.to, h.at, `match: centros a ${Math.hypot(a.x - b.x, a.y - b.y).toFixed(0)}px`, 'alinear silueta en el corte');
      if (a.w && b.w && Math.abs(a.w / a.h - b.w / b.h) / (a.w / a.h) > 0.15) fix(h.to, h.at, `match: aspecto ${(a.w / a.h).toFixed(2)} → ${(b.w / b.h).toFixed(2)}`, 'igualar proporción');
      if (a.role && b.role && a.role !== b.role) fix(h.to, h.at, `match: color-rol ${a.role} → ${b.role}`, 'mismo rol de color');
      continue;
    }
    for (const k of Object.keys(a)) {
      if (k === 'role') { if (b.role !== a.role) fix(h.to, h.at, `salto de color-rol "${h.entity}": ${a.role} → ${b.role}`, 'mismo rol de color en el relevo'); continue; }
      if (k === 'heading' || k === 'rot') { const d = Math.abs(((a[k] - b[k] + 540) % 360) - 180); if (!(d <= tolA)) fix(h.to, h.at, `salto de rumbo "${h.entity}.${k}": ${a[k]}° → ${b[k]}°`, 'igualar rumbo en el corte'); continue; }
      if ((typeof a[k] === 'number' && Math.abs(a[k] - (b[k] ?? NaN)) > tol) || (typeof a[k] === 'number' && Number.isNaN(b[k])))
        fix(h.to, h.at, `salto de "${h.entity}.${k}": ${a[k]?.toFixed?.(2)} → ${b[k]?.toFixed?.(2)}`, `igualar estado en t=${h.at}`);
    }
  }
}

// Energía de movimiento a baja resolución (sin grade): holds y pops medibles, no opinados.
// R1/R6 (spec 009): fotogramas de la caché compartida; con --shot solo la ventana del shot y sus vecinos (±3 fotogramas de margen para la mediana local).
async function motion(fps, film, FC) {
  const sc = film.lintScope, n = Math.round(film.duration * fps), f0 = sc ? Math.max(0, Math.floor(sc.t0 * fps) - 3) : 0, f1 = sc ? Math.min(n, Math.ceil(sc.t1 * fps) + 3) : n, E = [];
  let prev = null; const metas = [];
  for (let i = f0; i <= f1; i++) {
    const F = await FC.get(i / fps, { px: true }), d = F.data; metas.push(...(F.boxes.meta ?? []));
    if (prev) { let s = 0; for (let k = 0; k < d.length; k += 4) s += Math.abs(d[k] - prev[k]) + Math.abs(d[k + 1] - prev[k + 1]) + Math.abs(d[k + 2] - prev[k + 2]); E.push(s / (d.length * 0.75 * 255)); }
    prev = d;
  }
  const { declaredImpacts, inImpact } = await import('./sakuga.mjs'), imps = declaredImpacts(film, metas);   // un impact declarado no es un pop
  const cuts = new Set(film.shots.map((s) => Math.round(s.t[0] * fps)));
  const silent = (t) => film.silences.some(([a, b]) => t >= a && t <= b);
  const holdOk = (t) => film.shots.some((s) => (s.hold_ok ?? []).some(([a, b]) => t >= s.t[0] + a && t <= s.t[0] + b));
  const inScope = (t) => !sc || (t >= sc.t0 - 1e-9 && t <= sc.t1 + 1e-9);
  let run = 0;
  for (let j = 0; j < E.length; j++) {
    const i = f0 + j, t = (i + 1) / fps;
    if (E[j] < (film.S.rules.holdEnergy ?? film.P.holdEnergy) && !silent(t) && !holdOk(t)) run++; else run = 0;
    if (inScope(t) && run / fps > film.P.maxHold && run / fps - 1 / fps <= film.P.maxHold) {
      const s = film.shots.find((x) => t >= x.t[0] && t < x.t[1]);
      fix(s?.id ?? '-', t - run / fps, `hold > ${film.P.maxHold}s sin silencio de audio`, 'añadir acción secundaria o declarar hold_ok');
    }
    const nb = [...E.slice(Math.max(0, j - 3), j), ...E.slice(j + 1, j + 4)].sort((a, b) => a - b), med = nb[Math.floor(nb.length / 2)] ?? 0;
    if (inScope(t) && E[j] > 0.01 && E[j] > (film.S.rules.popRatio ?? film.P.popRatio) * Math.max(med, 0.001) && !cuts.has(i + 1) && !cuts.has(i) && !inImpact(t, imps, fps)) {
      const s = film.shots.find((x) => t >= x.t[0] && t < x.t[1]);
      warn(s?.id ?? '-', t, `pop: energía ${(E[j] / Math.max(med, 1e-4)).toFixed(1)}× la mediana local`, 'suavizar con spring o repartir en 2–3 frames');
    }
  }
  if (sc) return;                                                            // el final apagado y out/motion.json son del film entero
  { const nn = E.length, k = Math.max(2, Math.round(nn * 0.08)), last = E.slice(-k).reduce((a, b) => a + b, 0) / k, p70 = [...E].sort((a, b) => a - b)[Math.floor(nn * 0.7)];
    if (!film.end_hold_ok && last < p70) warn('-', film.duration * 0.92, `final apagado: energía del último 8% (${(last * 1000).toFixed(2)}) < p70 del film (${(p70 * 1000).toFixed(2)})`, 'peak-end: cerrar con energía o declarar end_hold_ok:true'); }
  writeAtomic(path.join(ROOT, 'out/motion.json'), JSON.stringify({ fps, energy: E.map((e) => +e.toFixed(5)) }));
}

// Fondos libres (spec 021 §D): anti-menú. Las reglas puras viven en fondo-lint.mjs; aquí se recoge lo que cada shot dijo al pintar su fondo (meta `fondo`) y se mide el coste del código propio.
//   fondo.codigo_lento una capa `codigo` mide más de su `maxMs` por cuadro (mediana de N cuadros repartidos por el film, a la resolución real)
async function fondoLibre(film, fr) {
  const { analizarFondos, FONDO_LIBRE } = await import('./fondo-lint.mjs'), per = new Map(), cod = new Map();
  for (const f of fr) for (const m of f.boxes?.meta ?? []) if (m.prim === 'fondo') {
    const q = per.get(m.shot); if (!q) per.set(m.shot, { ...m }); else q.animado ||= m.animado;
    for (const c of m.codigos ?? []) if (!cod.has(c.archivo)) cod.set(c.archivo, { ...c, shot: m.shot });
  }
  for (const x of analizarFondos(film, per)) warn(x.shot, x.t, x.problem, x.remedy);
  if (cod.size) {
    const { drawFondo } = await import('./fondos.mjs'), { beatAtOf } = await import('./prims.mjs'), { hrtime } = await import('node:process');
    for (const [archivo, c] of cod) {
      const ms = [];
      for (let i = 0; i < FONDO_LIBRE.muestras; i++) {
        const t = (film.duration * (i + 0.5)) / FONDO_LIBRE.muestras, cv = film.canvas(film.width, film.height), g = cv.getContext('2d'), t0 = hrtime.bigint();
        drawFondo(g, { capas: [c.capa] }, t, { W: film.width, H: film.height, k: Math.min(film.width, film.height) / 1080, pal: film.S.palette, canvas: film.canvas, depth: (d, fn) => fn(), cache: new Map(), eventos: film.eventos, beatAt: beatAtOf(film), codigo: film.codigo, u: i / FONDO_LIBRE.muestras, dur: film.duration, lt: t });
        ms.push(Number(hrtime.bigint() - t0) / 1e6);
      }
      ms.sort((a, b) => a - b); const med = ms[ms.length >> 1];
      if (med > (c.maxMs ?? 30)) warn(c.shot, film.shots.find((s) => s.id === c.shot)?.t[0] ?? 0, `fondo.codigo_lento: shots/${archivo} tarda ${med.toFixed(0)} ms/cuadro (mediana de ${ms.length}; presupuesto ${c.maxMs ?? 30} ms)`, 'simplificar el bucle (menos elementos, cálculo fuera del bucle por cuadro) o subir maxMs si el coste es asumible');
    }
  }
}

// Fondo vacío (spec 012 P6): el negro ELEGIDO por el tema pasa; el negro VACÍO (oscuro y sin profundidad) avisa. Métrica fondo.profundidad.
// Cadencia/tamaño propios (4 fps, 384 px, CON gradación: lo que ve el espectador); fotogramas cacheados como los demás. Solo film entero.
async function fondo(film, FC) {
  if (film.lintScope || film.fondo === false) return;
  const { FONDO, fondoSeries, veredicto } = await import('./metrics/fondo.mjs'), n = Math.floor(film.duration * FONDO.fps), fr = [];
  for (let i = 0; i < n; i++) { const t = i / FONDO.fps, F = await FC.get(t, { px: true }); fr.push({ t, W: F.W, H: F.H, data: F.data, boxes: F.boxes }); }
  const S = fondoSeries(fr, { fps: FONDO.fps }), pct = (x) => Math.round(x * 100), long = [...S.runs].sort((a, b) => b.t1 - b.t0 - (a.t1 - a.t0))[0];
  writeAtomic(path.join(ROOT, 'out/fondo.json'), JSON.stringify({ P: S.P, darkFrac: S.darkFrac, emptyFrac: S.emptyFrac, runs: S.runs, wins: S.wins.map((w) => [+w.t0.toFixed(2), +(w.P ?? 0).toFixed(2), +(w.lum ?? 0).toFixed(1)]) }));
  await fondoLibre(film, fr);
  const V = veredicto(S); if (!V) return;
  const sh = film.shots.find((x) => long.t0 >= x.t[0] && long.t0 < x.t[1]);
  const lvl = V === 'FIX' ? fix : warn;
  lvl(sh?.id ?? '-', long.t0, `fondo.vacio: ${pct(S.emptyFrac)} % del film es fondo oscuro sin profundidad (fondo.profundidad ${S.P.toFixed(2)} % < ${FONDO.empty}; tramo mayor ${long.t0.toFixed(0)}–${long.t1.toFixed(0)} s)`, 'dar al fondo estrellas, niebla, viñeta, parallax o un soporte con textura (medio); o aclarar si el negro NO es del tema');
}

// Rima: el primer y el último frame dialogan (mismo tipo de masa/lugar) sin ser un clon.
async function rima(R, FC) {
  const { film, W, H } = R; if (film.rhyme === false) return;
  const pl = luminance(film.S.palette.paper) ** (1 / 2.2);
  const st = async (t) => { const d = (await FC.get(t, { px: true })).data, hs = new Float64Array(32 * 18), hn = new Float64Array(32 * 18); let m = 0, sx = 0, sy = 0;
    for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) { const i = (y * W + x) * 4, L = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255, c = Math.floor((y / H) * 18) * 32 + Math.floor((x / W) * 32); hs[c] += L; hn[c]++; if (Math.abs(L - pl) > 0.15) { m++; sx += x; sy += y; } }
    return { m, cx: m ? sx / m : W / 2, cy: m ? sy / m : H / 2, h: hs.map((v, i) => v / Math.max(1, hn[i])) }; };
  const a = await st(Math.min(0.6, film.duration * 0.1)), b = await st(film.duration - 0.05);
  const hd = a.h.reduce((p, v, i) => p + Math.abs(v - b.h[i]), 0) / a.h.length, dc = Math.hypot(a.cx - b.cx, a.cy - b.cy) / W, ratio = (b.m + 1) / (a.m + 1);
  if (hd < 0.01) warn('-', film.duration, 'primer y último frame casi idénticos (clon perezoso)', 'el final debe ser el principio con otra función');
  else if (dc > 0.25 || ratio > 5 || ratio < 0.2) warn('-', film.duration, `sin rima: primer y último frame no dialogan (centroide Δ${(dc * 100).toFixed(0)}% del ancho, masa ×${ratio.toFixed(1)})`, 'devolver la masa al lugar del inicio, o rhyme:false');
}

// Firma de ritmo a 30 fps (solo alrededor de eventos): valle antes del beat, pico en el beat; cortes en la acción, no en el reposo; hold-cut.
async function rhythm(film, FC) {
  const holdE = film.S.rules.holdEnergy ?? film.P.holdEnergy, sc = film.lintScope;
  const series = async (t0, t1, f) => { const out = []; let prev = null; for (let t = Math.max(0, t0 - 1 / f); t <= Math.min(film.duration, t1) + 1e-9; t += 1 / f) { const d = (await FC.get(t, { px: true })).data; if (prev) { let s = 0; for (let k = 0; k < d.length; k += 4) s += Math.abs(d[k] - prev[k]) + Math.abs(d[k + 1] - prev[k + 1]) + Math.abs(d[k + 2] - prev[k + 2]); out.push({ t, e: s / (d.length * 0.75 * 255) }); } prev = d; } return out; };
  const mean = (a) => (a.length ? a.reduce((p, q) => p + q.e, 0) / a.length : 0), F = 30;
  const ev = film.shots.flatMap((s) => (s.on_beat_at ?? []).map((x) => [s.id, s.t[0] + x])), stepE = Math.max(1, Math.ceil(ev.length / 40));
  for (const [id, b] of ev.filter((_, i) => i % stepE === 0).filter(([id]) => !sc || sc.ids.has(id))) {
    const v = mean(await series(b - 0.25, b - 0.06, F)), pk = Math.max(0, ...(await series(b - 1 / F, b + 0.15, F)).map((q) => q.e));
    if (pk < 1.4 * Math.max(v, holdE * 0.5) || pk < holdE * 2) warn(id, b, `beat sin firma de ritmo (pico ${(pk * 1000).toFixed(2)} vs valle ${(v * 1000).toFixed(2)})`, 'anticipación → acento en el beat: valle antes, pico en on_beat_at');
  }
  for (let i = 0; i < film.shots.length - 1; i++) {
    const A = film.shots[i], c = A.t[1], tr = tOf(A);
    if (sc && !sc.ids.has(A.id)) continue;
    if (tr === 'cut' || tr === 'scale-cut') { const eb = mean(await series(c - 0.1, c - 1 / F, F)), ep = mean(await series(c - 0.6, c - 0.1, F)); if (ep > holdE * 2 && eb < 0.4 * ep) warn(A.id, c, 'corte en el reposo: la acción ya terminó antes del corte', 'cortar con la energía subiendo (en la acción), o hold-cut'); }
    if (tr === 'hold-cut') {
      const s = await series(c - 10 / film.fps, c - 1 / film.fps, film.fps); let q = 0; for (let k = s.length - 1; k >= 0 && s[k].e < holdE * 1.5; k--) q++;
      if (q < 2 || q > 4) warn(A.id, c, `hold-cut con ${q} fotogramas quietos antes del corte (pide 2–4)`, 'congelar 2–4 fotogramas y cortar en la acción');
    }
  }
}

// Salidas (F1): veredicto global out/lint.json SOLO en una pasada completa; por shot en out/lint/<film>/<ID>.json.
// Todo veredicto lleva los hashes tomados ANTES de los checks (si algo cambia durante el lint, nace caducado: isFresh=false).
const shotArg = arg('--shot'), H0 = currentHashes(), partial = !!(only || shotArg);
const emit = (film, error) => {
  const fixes = issues.filter((x) => x.level === 'FIX'), meta = { style: film?.S?.name ?? null, profile: film?.profileName ?? null, checks: only ?? 'all' };
  const ids = shotArg ? [shotArg, ...neighbors(H0, shotArg)] : H0.order, perShot = (id) => issues.filter((x) => x.shot === id);
  if (only) writeAtomic(path.join(lintDir(), `_only-${only}.json`), JSON.stringify({ partial: true, ...meta, verdict: fixes.length ? 'FIX' : 'PASS', ...stamp(H0), issues }, null, 1));
  else {
    for (const id of ids) { const mine = perShot(id), v = error || mine.some((x) => x.level === 'FIX') ? 'FIX' : 'SHIP'; writeAtomic(path.join(lintDir(), `${id}.json`), JSON.stringify({ ...meta, verdict: v, ...stamp(H0, id), issues: error ? [...mine, ...issues.filter((x) => x.shot === '-')] : mine }, null, 1)); }
    if (!shotArg) writeAtomic(path.join(ROOT, 'out/lint.json'), JSON.stringify({ ...meta, verdict: fixes.length ? 'FIX' : 'SHIP', partial: false, ...stamp(H0), issues }, null, 2));
  }
  record({ action: 'lint', target: `lint/${H0.film}${shotArg ? '/' + shotArg : ''}${only ? '/only:' + only : ''}`, hash_after: H0.filmHash, verdict: fixes.length ? 'FIX' : only ? 'PASS' : 'SHIP', why: error ? 'lint abortado: ' + error : null });
  return fixes;
};
let R;
try { R = await makeRenderer({ size: arg('--size', undefined), grade: false }); } catch (e) { console.error('FIX  ' + e.message); CHECK = 'load'; fix('-', 0, `el film no carga: ${e.message}`.slice(0, 300), 'arreglar el error y relanzar'); emit(null, e.message); process.exit(1); }
if (shotArg && !R.film.shots.some((s) => s.id === shotArg)) { console.error(`FIX  --shot ${shotArg}: no existe en el timeline`); process.exit(1); }
if (shotArg) { const sc = R.film.shots.filter((s) => s.id === shotArg || neighbors(H0, shotArg).includes(s.id)); R.film.lintScope = { ids: new Set(sc.map((s) => s.id)), t0: Math.min(...sc.map((s) => s.t[0])), t1: Math.max(...sc.map((s) => s.t[1])) }; }
const lfps = +arg('--fps', 12);
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
let aborted = null;
// R1: dos cachés de fotogramas compartidas por los checks (tamaño del lint para layout/transiciones/rima; 192 px para energía, ritmo y arco).
const SMALL = `192x${Math.round((192 * R.film.height) / R.film.width / 2) * 2}`;
let R2 = null, R3 = null;
const FCL = frameCache({ film: R.film, size: arg('--size', undefined), grade: false, make: async () => R });
const FCS_ = frameCache({ film: R.film, size: SMALL, grade: false, make: async () => (R2 ??= await makeRenderer({ size: SMALL, grade: false })) });
const FCF = frameCache({ film: R.film, size: '384x' + Math.round((384 * R.film.height) / R.film.width / 2) * 2, grade: true, make: async () => (R3 ??= await makeRenderer({ size: '384x' + Math.round((384 * R.film.height) / R.film.width / 2) * 2, grade: true })) });
const stepMs = {};
let warmP = null;                                                            // R6: relleno de la caché en paralelo (solo en frío y si merece la pena); corre MIENTRAS validate y determinismo (que no usan la caché)
{ const { prewarm } = await import('./framewarm.mjs'), t0 = Date.now(); warmP = prewarm({ film: R.film, FCL, FCS_, FCF, needFondo: want('fondo'), lfps, scope: R.film.lintScope ?? null, needLayout: want('layout') || want('rhythm'), needSmall: want('motion') || want('arc') || want('rhythm') }).then((n) => { if (n) { stepMs.prewarm = Date.now() - t0; stepMs.warmFrames = n; } }); }
const step = async (k, f) => { if (want(k)) { if (warmP && k !== 'validate' && k !== 'determinism') { await warmP; warmP = null; } CHECK = k; const t0 = Date.now(); try { await f(); } finally { stepMs[k] = Date.now() - t0; } } };
try {
await step('validate', () => { validate(R.film); for (const x of [...scanShots(ROOT, R.film.shots.map((s) => s.id)), ...scanFondoCodigo(ROOT)]) (x.level === 'FIX' ? fix : warn)(x.shot, 0, x.problem, x.remedy); fonts(R); });
await step('determinism', () => determinism(R.film));
await step('layout', async () => { R.film.guard = guardCtx; R.film.guardLog = []; await layout(R, Math.min(lfps, 8), FCL); R.film.guard = null; guardReport(R.film); });
await step('camera', () => camera(R.film));
await step('transitions', () => transitions(R, FCL));
await step('beats', () => beats(R.film));
await step('handoffs', () => handoffs(R.film));
await step('contracts', () => { for (const x of contractIssues(R.film)) (x.level === 'FIX' ? fix : warn)(x.shot, x.t, x.problem, x.remedy); });   // F3: contratos congelados en el animatic
await step('motion', () => motion(lfps, R.film, FCS_));
await step('rhythm', async () => { if (!R.film.lintScope) await rima(R, FCL); await rhythm(R.film, FCS_); });
await step('fondo', () => fondo(R.film, FCF));
await step('arc', async () => {                                             // F5: lint dramático, solo si hay story.json (sin story no cambia nada)
  const A = await import('./arc.mjs');
  if (A.storyPath(R.film)) { const r = await A.runArc({ fps: lfps, film: R.film, fc: FCS_, cacheOnly: !!R.film.lintScope }); /* --shot: el arco es del film entero; solo corre si todos sus fotogramas ya están en caché */ for (const x of r.issues) push(x.level)(x.shot, x.t, `[arc] ${x.problem}`, x.remedy); }
});
await step('narr', async () => {                                            // spec 013: lint narrativo (FIX solo si el story es v2; v1 = WARN)
  const [A, N, F] = await Promise.all([import('./arc.mjs'), import('./narr.mjs'), import('./film.mjs')]), sp = A.storyPath(R.film);
  if (sp) { const r = N.analyzeOne(sp, F.timelinePath()); for (const x of r.issues) { const l = N.effLevel(x, r.story); if (l !== 'EXC') push(l)('-', x.t ?? 0, `[narr] ${x.check}: ${x.problem}`, x.remedy); } }
});
} catch (e) { aborted = e.message; CHECK = 'lint'; fix('-', 0, `lint abortado: ${e.message}`.slice(0, 300), 'arreglar el error y relanzar'); }
const fixes = emit(R.film, aborted);
if (process.env.OPUS_STATS === '1') {                                         // medidas del propio lint (docs/current/EFICIENCIA.md; test/motor.mjs)
  try { fs.mkdirSync(path.join(ROOT, 'out/cache'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'out/cache/lint-stats.json'), JSON.stringify({ frames: { hit: FCS.hit, miss: FCS.miss, missT: FCS.missT }, det: FCS.det, ms: stepMs })); } catch {}
  console.log(`cache: fotogramas ${FCS.hit} acierto / ${FCS.miss} fallo · determinismo ${FCS.det.hit} acierto / ${FCS.det.miss} fallo · ms ${JSON.stringify(stepMs)}`);
}
for (const x of issues) console.log(`${x.level.padEnd(4)}  ${String(x.shot).padEnd(6)} ${x.t.toFixed(2).padStart(7)}s  ${x.problem}  →  ${x.remedy}`);
const tag = `[${R.film.S.name}/${R.film.profileName}]${only ? ` (parcial: --only ${only}; no escribe out/lint.json)` : shotArg ? ` (shot ${shotArg} + vecinos → out/lint/${H0.film}/)` : ''}`;
console.log(fixes.length ? `\nFIX (${fixes.length})  ${tag}` : `\n${only ? 'PASS' : 'SHIP'}${issues.length ? ` (${issues.length} avisos)` : ''}  ${tag}`);
process.exit(fixes.length ? 1 : 0);
