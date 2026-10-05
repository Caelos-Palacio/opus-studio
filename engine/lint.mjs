#!/usr/bin/env node
// Escalera de verificación determinista (barata → cara). Sin VLM. Aplica el gusto del estilo activo.
//   node engine/lint.mjs [--only validate|determinism|layout|camera|transitions|beats|handoffs|motion|rhythm] [--fps 12] [--style X] [--profile Y]
// Salida: out/lint.json + veredicto SHIP / FIX (shot  t  problema  arreglo)
import fs from 'node:fs';
import path from 'node:path';
import { makeRenderer } from './render.mjs';
import { ROOT, timelinePath } from './film.mjs';
import { validateTimeline, ENUMS } from './schema.mjs';
import { specOf, camStats, camState, camEnds } from './camera.mjs';
import { barHeight } from './grade.mjs';
import { checkPalette } from './styles.mjs';
import { luminance } from './color.mjs';
import { guardCtx, scanShots } from './guard.mjs';
import { activeShots } from './seek.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const only = arg('--only');
const want = (k) => !only || only === k;
const issues = [];
const push = (level) => (shot, t, problem, remedy) => issues.push({ level, shot, t: +(+t).toFixed(3), problem, remedy });
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
    fs.writeFileSync(path.join(ROOT, 'out/lint.json'), JSON.stringify({ style: tl.style ?? null, profile: tl.profile ?? null, verdict: 'FIX', issues }, null, 2));
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
function determinism(R) {
  const f = R.film, ts = [0, 0.37, f.duration, ...f.shots.map((s) => (s.t[0] + s.t[1]) / 2)], seen = new Set();
  for (const t of ts) {
    R.frame(t); const a = R.cv.toBuffer('raw');
    R.frame(f.duration * 0.2); R.frame(t); const b = R.cv.toBuffer('raw');
    if (!a.equals(b)) for (const s of activeShots(f, f.timeMap ? f.timeMap(t) : t)) if (!seen.has(s.id)) { seen.add(s.id); fix(s.id, t, 'seek(t) no determinista en este shot', 'eliminar estado entre frames / Math.random / Date (ver avisos de escaneo)'); }
  }
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
function layout(R, fps) {
  const { film, W, H } = R, P = film.P, S = film.S, bar = barHeight(film) * (H / film.height), visH = H - 2 * bar;
  const minPx = (P.minFontPx * Math.min(W, H)) / 1080, seen = new Set(), once = (k, f) => { if (!seen.has(k)) { seen.add(k); f(); } };
  const safe = { x0: W * P.safe.side, x1: W * (1 - P.safe.side), y0: bar + H * P.safe.top, y1: H - bar - H * P.safe.bottom };
  const vis = new Map(); // etiqueta → {first,last,chars,shot}: tiempo de lectura
  for (let i = 0; i <= film.duration * fps; i++) {
    const t = i / fps, boxes = R.frame(t), texts = boxes.filter((b) => b.kind === 'text'), foci = boxes.filter((b) => b.kind === 'focus');
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
    if (dur < 0.6 * need) once('rd' + v.label, () => fix(v.shot, v.first, `"${v.label}" visible ${dur.toFixed(2)}s; leer pide ≥ ${need.toFixed(2)}s (${P.readCps} car/s)`, 'alargar o acortar el texto'));
    else if (dur < need) once('rd' + v.label, () => warn(v.shot, v.first, `"${v.label}" visible ${dur.toFixed(2)}s < ${need.toFixed(2)}s de lectura cómoda`, 'alargar un poco'));
  }
  // Composición por shot (fotograma central): bordes, anclaje a puntos de poder, espacio negativo.
  const cm = S.compose, m = cm.edgeMargin;
  for (const s of film.shots) {
    if (s.compose === 'free') continue;
    const tm = (s.t[0] + s.t[1]) / 2, all = R.frame(tm), foci = all.filter((b) => b.kind === 'focus' && b.shot === s.id);
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
      const px = R.ctx.getImageData(0, 0, W, H).data, pl = luminance(S.palette.paper) ** (1 / 2.2);
      for (const f of foci.filter((q) => q.weight >= 0.5 && !q.bleed)) {
        const df = [], x0 = Math.max(0, Math.floor(f.x)), x1 = Math.min(W, Math.ceil(f.x + f.w)), y0 = Math.max(0, Math.floor(f.y)), y1 = Math.min(H, Math.ceil(f.y + f.h));
        for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { const i = (y * W + x) * 4, d = Math.abs((0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255 - pl); if (d > 0.06) df.push(d); }
        df.sort((p, q) => p - q);
        if (df.length < 0.0015 * (f.w * f.h) / 4) warn(s.id, tm, `sujeto "${f.label}" casi invisible en grises`, 'subir contraste de valor con el papel');
        else if (df[Math.floor(df.length * 0.9)] < 0.3) warn(s.id, tm, `sujeto "${f.label}" no se separa del fondo en grises (Δ ${df[Math.floor(df.length * 0.9)].toFixed(2)} < 0.30)`, 'separar por valor, no solo por matiz');
      }
    }
    if (s.saliency !== false) {   // ¿el ojo va donde dice el foco? prominencia = contraste de valor con el papel, fuera del texto
      const px = R.ctx.getImageData(0, 0, W, H).data, pl = luminance(S.palette.paper) ** (1 / 2.2), txt = all.filter((b) => b.kind === 'text'), gx = 64, gy = 36, cells = [];
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

function transitions(R) {
  const { film, W, H } = R, P = film.P, bar = barHeight(film) * (H / film.height);
  const safe = { x0: W * P.safe.side, x1: W * (1 - P.safe.side), y0: bar + H * P.safe.top, y1: H - bar - H * P.safe.bottom };
  for (let i = 0; i < film.shots.length - 1; i++) {
    const A = film.shots[i];
    if (tOf(A) !== 'wipe-obj') continue;
    const t = A.t[1] - 1 / film.fps, foci = R.frame(t).filter((b) => b.kind === 'focus' && b.shot === A.id);
    const cov = foci.reduce((p, f) => p + Math.max(0, Math.min(f.x + f.w, safe.x1) - Math.max(f.x, safe.x0)) * Math.max(0, Math.min(f.y + f.h, safe.y1) - Math.max(f.y, safe.y0)), 0) / ((safe.x1 - safe.x0) * (safe.y1 - safe.y0));
    if (cov < 0.8) fix(A.id, A.t[1], `wipe-obj: el sujeto cubre ${(cov * 100).toFixed(0)}% del área segura en el corte (< 80%)`, 'que el objeto tape el cuadro antes de cortar');
  }
}

function beats(film) {
  if (!film.P.cutOnBeat || !film.beatTimes.length) return;
  const tol = 1 / film.fps + 1e-6;
  for (const s of film.shots) if (s.t[0] > 0 && !film.beatTimes.some((b) => Math.abs(b - s.t[0]) <= tol)) {
    const near = film.beatTimes.reduce((p, b) => (Math.abs(b - s.t[0]) < Math.abs(p - s.t[0]) ? b : p));
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
async function motion(fps, film) {
  const r2 = await makeRenderer({ size: `192x${Math.round((192 * film.height) / film.width / 2) * 2}`, grade: false });
  const n = Math.round(film.duration * fps), E = [];
  let prev = null;
  for (let i = 0; i <= n; i++) {
    r2.frame(i / fps);
    const d = r2.ctx.getImageData(0, 0, r2.W, r2.H).data;
    if (prev) { let s = 0; for (let k = 0; k < d.length; k += 4) s += Math.abs(d[k] - prev[k]) + Math.abs(d[k + 1] - prev[k + 1]) + Math.abs(d[k + 2] - prev[k + 2]); E.push(s / (d.length * 0.75 * 255)); }
    prev = Uint8ClampedArray.from(d);
  }
  const cuts = new Set(film.shots.map((s) => Math.round(s.t[0] * fps)));
  const silent = (t) => film.silences.some(([a, b]) => t >= a && t <= b);
  const holdOk = (t) => film.shots.some((s) => (s.hold_ok ?? []).some(([a, b]) => t >= s.t[0] + a && t <= s.t[0] + b));
  let run = 0;
  for (let i = 0; i < E.length; i++) {
    const t = (i + 1) / fps;
    if (E[i] < (film.S.rules.holdEnergy ?? film.P.holdEnergy) && !silent(t) && !holdOk(t)) run++; else run = 0;
    if (run / fps > film.P.maxHold && run / fps - 1 / fps <= film.P.maxHold) {
      const s = film.shots.find((x) => t >= x.t[0] && t < x.t[1]);
      fix(s?.id ?? '-', t - run / fps, `hold > ${film.P.maxHold}s sin silencio de audio`, 'añadir acción secundaria o declarar hold_ok');
    }
    const nb = [...E.slice(Math.max(0, i - 3), i), ...E.slice(i + 1, i + 4)].sort((a, b) => a - b), med = nb[Math.floor(nb.length / 2)] ?? 0;
    if (E[i] > 0.01 && E[i] > (film.S.rules.popRatio ?? film.P.popRatio) * Math.max(med, 0.001) && !cuts.has(i + 1) && !cuts.has(i)) {
      const s = film.shots.find((x) => t >= x.t[0] && t < x.t[1]);
      warn(s?.id ?? '-', t, `pop: energía ${(E[i] / Math.max(med, 1e-4)).toFixed(1)}× la mediana local`, 'suavizar con spring o repartir en 2–3 frames');
    }
  }
  { const nn = E.length, k = Math.max(2, Math.round(nn * 0.08)), last = E.slice(-k).reduce((a, b) => a + b, 0) / k, p70 = [...E].sort((a, b) => a - b)[Math.floor(nn * 0.7)];
    if (!film.end_hold_ok && last < p70) warn('-', film.duration * 0.92, `final apagado: energía del último 8% (${(last * 1000).toFixed(2)}) < p70 del film (${(p70 * 1000).toFixed(2)})`, 'peak-end: cerrar con energía o declarar end_hold_ok:true'); }
  fs.writeFileSync(path.join(ROOT, 'out/motion.json'), JSON.stringify({ fps, energy: E.map((e) => +e.toFixed(5)) }));
}

// Rima: el primer y el último frame dialogan (mismo tipo de masa/lugar) sin ser un clon.
function rima(R) {
  const { film, W, H } = R; if (film.rhyme === false) return;
  const pl = luminance(film.S.palette.paper) ** (1 / 2.2);
  const st = (t) => { R.frame(t); const d = R.ctx.getImageData(0, 0, W, H).data, hs = new Float64Array(32 * 18), hn = new Float64Array(32 * 18); let m = 0, sx = 0, sy = 0;
    for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) { const i = (y * W + x) * 4, L = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255, c = Math.floor((y / H) * 18) * 32 + Math.floor((x / W) * 32); hs[c] += L; hn[c]++; if (Math.abs(L - pl) > 0.15) { m++; sx += x; sy += y; } }
    return { m, cx: m ? sx / m : W / 2, cy: m ? sy / m : H / 2, h: hs.map((v, i) => v / Math.max(1, hn[i])) }; };
  const a = st(Math.min(0.6, film.duration * 0.1)), b = st(film.duration - 0.05);
  const hd = a.h.reduce((p, v, i) => p + Math.abs(v - b.h[i]), 0) / a.h.length, dc = Math.hypot(a.cx - b.cx, a.cy - b.cy) / W, ratio = (b.m + 1) / (a.m + 1);
  if (hd < 0.01) warn('-', film.duration, 'primer y último frame casi idénticos (clon perezoso)', 'el final debe ser el principio con otra función');
  else if (dc > 0.25 || ratio > 5 || ratio < 0.2) warn('-', film.duration, `sin rima: primer y último frame no dialogan (centroide Δ${(dc * 100).toFixed(0)}% del ancho, masa ×${ratio.toFixed(1)})`, 'devolver la masa al lugar del inicio, o rhyme:false');
}

// Firma de ritmo a 30 fps (solo alrededor de eventos): valle antes del beat, pico en el beat; cortes en la acción, no en el reposo; hold-cut.
async function rhythm(film) {
  const r2 = await makeRenderer({ size: `192x${Math.round((192 * film.height) / film.width / 2) * 2}`, grade: false }), holdE = film.S.rules.holdEnergy ?? film.P.holdEnergy;
  const series = (t0, t1, f) => { const out = []; let prev = null; for (let t = Math.max(0, t0 - 1 / f); t <= Math.min(film.duration, t1) + 1e-9; t += 1 / f) { r2.frame(t); const d = r2.ctx.getImageData(0, 0, r2.W, r2.H).data; if (prev) { let s = 0; for (let k = 0; k < d.length; k += 4) s += Math.abs(d[k] - prev[k]) + Math.abs(d[k + 1] - prev[k + 1]) + Math.abs(d[k + 2] - prev[k + 2]); out.push({ t, e: s / (d.length * 0.75 * 255) }); } prev = Uint8ClampedArray.from(d); } return out; };
  const mean = (a) => (a.length ? a.reduce((p, q) => p + q.e, 0) / a.length : 0), F = 30;
  const ev = film.shots.flatMap((s) => (s.on_beat_at ?? []).map((x) => [s.id, s.t[0] + x])), stepE = Math.max(1, Math.ceil(ev.length / 40));
  for (const [id, b] of ev.filter((_, i) => i % stepE === 0)) {
    const v = mean(series(b - 0.25, b - 0.06, F)), pk = Math.max(0, ...series(b - 1 / F, b + 0.15, F).map((q) => q.e));
    if (pk < 1.4 * Math.max(v, holdE * 0.5) || pk < holdE * 2) warn(id, b, `beat sin firma de ritmo (pico ${(pk * 1000).toFixed(2)} vs valle ${(v * 1000).toFixed(2)})`, 'anticipación → acento en el beat: valle antes, pico en on_beat_at');
  }
  for (let i = 0; i < film.shots.length - 1; i++) {
    const A = film.shots[i], c = A.t[1], tr = tOf(A);
    if (tr === 'cut' || tr === 'scale-cut') { const eb = mean(series(c - 0.1, c - 1 / F, F)), ep = mean(series(c - 0.6, c - 0.1, F)); if (ep > holdE * 2 && eb < 0.4 * ep) warn(A.id, c, 'corte en el reposo: la acción ya terminó antes del corte', 'cortar con la energía subiendo (en la acción), o hold-cut'); }
    if (tr === 'hold-cut') {
      const s = series(c - 10 / film.fps, c - 1 / film.fps, film.fps); let q = 0; for (let k = s.length - 1; k >= 0 && s[k].e < holdE * 1.5; k--) q++;
      if (q < 2 || q > 4) warn(A.id, c, `hold-cut con ${q} fotogramas quietos antes del corte (pide 2–4)`, 'congelar 2–4 fotogramas y cortar en la acción');
    }
  }
}

let R;
try { R = await makeRenderer({ size: arg('--size', undefined), grade: false }); } catch (e) { console.error('FIX  ' + e.message); process.exit(1); }
const lfps = +arg('--fps', 12);
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
if (want('validate')) { validate(R.film); for (const x of scanShots(ROOT, R.film.shots.map((s) => s.id))) (x.level === 'FIX' ? fix : warn)(x.shot, 0, x.problem, x.remedy); fonts(R); }
if (want('determinism')) determinism(await makeRenderer({ size: arg('--size', undefined), grade: true }));
if (want('layout')) { R.film.guard = guardCtx; R.film.guardLog = []; layout(R, Math.min(lfps, 8)); R.film.guard = null; guardReport(R.film); }
if (want('camera')) camera(R.film);
if (want('transitions')) transitions(R);
if (want('beats')) beats(R.film);
if (want('handoffs')) handoffs(R.film);
if (want('motion')) await motion(lfps, R.film);
if (want('rhythm')) { rima(R); await rhythm(R.film); }
const fixes = issues.filter((x) => x.level === 'FIX');
fs.writeFileSync(path.join(ROOT, 'out/lint.json'), JSON.stringify({ style: R.film.S.name, profile: R.film.profileName, verdict: fixes.length ? 'FIX' : 'SHIP', issues }, null, 2));
for (const x of issues) console.log(`${x.level.padEnd(4)}  ${String(x.shot).padEnd(6)} ${x.t.toFixed(2).padStart(7)}s  ${x.problem}  →  ${x.remedy}`);
console.log(fixes.length ? `\nFIX (${fixes.length})  [${R.film.S.name}/${R.film.profileName}]` : `\nSHIP${issues.length ? ` (${issues.length} avisos)` : ''}  [${R.film.S.name}/${R.film.profileName}]`);
process.exit(fixes.length ? 1 : 0);
