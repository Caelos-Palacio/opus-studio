// Caja de herramientas de tipografía cinética del reel «Pulso» (compartida por shots/K*.mjs, como P_mundo.mjs en Potencias).
// Todo es función pura de t. La palabra es GEOMETRÍA (contornos de Lato Black → Bézier, shots/K_glifos.mjs), no texto del lienzo:
// así se puede cortar en tiras, romper en esquirlas, separar en canales y recomponer. Cada palabra registra su caja de texto con la
// api del motor (api._box: lint de área segura, tamaño mínimo, lectura y solape siguen vivos aunque el dibujo sea vectorial).
// El TIEMPO sale de la rejilla de tempo (film.beatTimes ← audio.json.beats ← engine/grid.mjs ← la partitura): los shots piden
// «en el pulso k + 0,75», nunca segundos.
import { clamp, lerp, seg, rng, hash2, noise1, TAU, spring } from '../engine/core.mjs';
import { parsePath, tracePath, affine } from '../engine/geom.mjs';
import { GLYPHS, KERN, CAP } from './K_glifos.mjs';

export { clamp, lerp, seg, rng, hash2, noise1, TAU, CAP };

// ───────── parámetros promovidos comunes (interfaz pública de cada shot; los enlaza el timeline a señales) ─────────
export const PARAMS = {
  kick: { type: 'number', range: [0, 2], default: 0, semantic: 'envolvente de los onsets del bombo: golpe de escala' },
  snare: { type: 'number', range: [0, 2], default: 0, semantic: 'envolvente de caja/palmas/toms: destello y corte de tiras' },
  hat: { type: 'number', range: [0, 2], default: 0, semantic: 'envolvente de hats: titileo' },
  tom: { type: 'number', range: [0, 2], default: 0, semantic: 'envolvente de toms: cuarta voz del secuenciador' },
  chaos: { type: 'number', range: [0, 1], default: 0.5, semantic: 'desorden: 1 = ruido (tiras y temblor), 0 = todo alineado' },
  lock: { type: 'number', range: [0, 1], default: 0, semantic: 'cuánto se pega el contenido a la rejilla visible' },
  shock: { type: 'number', range: [0, 2], default: 0, semantic: 'onda de choque tras el golpe (sacudida, canales, anillo)' },
  tension: { type: 'number', range: [0, 1.5], default: 0, semantic: 'tensión acumulada del crescendo (compresión, brillo del acento)' },
  drift: { type: 'number', range: [-1, 1], default: 0, semantic: 'deriva lenta (LFO): respiración en los respiros' },
  text: { type: 'string', semantic: 'texto principal del shot (default shot.text)' },
};

// ───────── rejilla de tempo ─────────
// Tiempo de un pulso fraccionario global x (0 = primer pulso de film.beatTimes): interpolación lineal entre pulsos vecinos.
export function beatT(film, x) {
  const B = film.beatTimes, n = B.length; if (!n) return x;
  if (x <= 0) return B[0] + x * (B[1] - B[0]);
  if (x >= n - 1) return B[n - 1] + (x - (n - 1)) * (B[n - 1] - B[n - 2]);
  const i = Math.floor(x); return lerp(B[i], B[i + 1], x - i);
}
// Índice (fraccionario) de un instante en la rejilla.
export function beatX(film, t) {
  const B = film.beatTimes, n = B.length; if (n < 2) return t;
  if (t <= B[0]) return (t - B[0]) / (B[1] - B[0]);
  if (t >= B[n - 1]) return n - 1 + (t - B[n - 1]) / (B[n - 1] - B[n - 2]);
  let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (B[m] <= t) lo = m; else hi = m; }
  return lo + (t - B[lo]) / (B[hi] - B[lo]);
}
// Pulso (entero) en el que EMPIEZA el shot: el más cercano a su inicio (los cortes caen en la rejilla ±1 fotograma).
export const shotBeat0 = (film, shot) => Math.round(beatX(film, shot.t[0]));
// Instante absoluto de «pulso k del shot + frac».
export const atBeat = (film, shot, k) => beatT(film, shotBeat0(film, shot) + k);
// Edad (s) desde un instante de la rejilla; negativa antes.
export const since = (film, shot, t, k) => t - atBeat(film, shot, k);

// Fase 0..1 dentro del pulso en t, y fase 0..1 dentro del compás de 4 pulsos contado desde el inicio del shot.
export const bphase = (film, t) => { const x = beatX(film, t); return x - Math.floor(x); };
export const barPhase = (film, shot, t) => { const x = beatX(film, t) - shotBeat0(film, shot); return (((x % 4) + 4) % 4) / 4; };

// ───────── glifos ─────────
export const TRACK = -0.012;
const SH = new Map();
const glyphShape = (ch) => { let s = SH.get(ch); if (!s) { const g = GLYPHS[ch] ?? GLYPHS['?']; s = g.d ? parsePath(g.d) : { contours: [] }; SH.set(ch, s); } return s; };
const LAY = new Map();
export function layout(str, track = TRACK) {
  const key = str + '|' + track; let L = LAY.get(key); if (L) return L;
  const items = []; let x = 0, prev = null;
  for (const ch of String(str).toUpperCase()) { const g = GLYPHS[ch] ?? GLYPHS['?']; if (prev) x += (KERN[prev + ch] ?? 0) + track; items.push({ ch, x, adv: g.adv }); x += g.adv; prev = ch; }
  L = { items, w: x }; LAY.set(key, L); return L;
}
const WS = new Map();
export function wordShape(str, track = TRACK) {                                 // todos los glifos, en em, esquina izquierda en x=0
  const key = str + '|' + track; let S = WS.get(key); if (S) return S;
  S = { contours: layout(str, track).items.flatMap((it) => (it.ch === ' ' ? [] : affine(glyphShape(it.ch), { x: it.x }).contours)) }; WS.set(key, S); return S;
}
const PS = new Map();
export function pieces(str, track = TRACK) {                                    // un shape por letra, con su x y su ancho
  const key = str + '|' + track; let P = PS.get(key); if (P) return P;
  P = layout(str, track).items.map((it) => ({ ch: it.ch, x: it.x, adv: it.adv, shape: it.ch === ' ' ? { contours: [] } : affine(glyphShape(it.ch), { x: it.x }) })); PS.set(key, P); return P;
}
export const widthEm = (str, track = TRACK) => layout(str, track).w;
export const fit = (str, width, track = TRACK) => width / layout(str, track).w;   // tamaño (px) para que la palabra mida `width`
export const capPx = (size) => CAP * size;

// ───────── tubo de neón (medio neon_pulso: rules.tube = grosor del tubo en em) ─────────
// La letra deja de ser una mancha y pasa a ser un TUBO de vidrio: contorno con halo de color, núcleo caliente y cuerpo apenas
// encendido que se llena con el bombo. El color del halo cuenta el estado del letrero: magenta = roto (caos), lima = enganchado (lock).
// Un tubo apagado es vidrio oscuro: sigue viéndose (nunca desaparece del todo). Sin `rules.tube` todo sigue como siempre.
const hexRgb = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c)); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const mixHex = (a, b, u) => { const A = hexRgb(a), B = hexRgb(b); if (!A || !B) return a; return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(u))).toString(16).padStart(2, '0')).join(''); };
export const WHITE_HOT = '#FFFFFF';
// Encendido de la letra i en t (0..1): con caos el letrero tartamudea (caídas de ~0,1 s por letra); con orden queda estable.
export function litOf(i, t, chaos, seed = 1) {
  if (chaos <= 0.12) return 1;
  const f = Math.floor(t * 11), r = hash2(i * 17 + seed, f), hum = 0.9 + 0.1 * noise1(t * 23 + i, seed + 3);
  return (r < chaos * 0.3 ? 0.1 + 0.25 * hash2(i, f + 5) : 1) * hum;
}
// Un contorno de letra como tubo. ctx en em (ya escalado). o: {color, fringe, lit, body (0..1 relleno), w (em)}
export function tubeLetter(ctx, shape, o) {
  const w = o.w, L = o.lit ?? 1, core = mixHex(o.color, WHITE_HOT, 0.66), a0 = ctx.globalAlpha;
  const path = () => { ctx.beginPath(); tracePath(ctx, shape); };
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (L < 0.995) { ctx.globalAlpha = a0 * (1 - L) * 0.55; ctx.strokeStyle = o.glass ?? '#3A2E5C'; ctx.lineWidth = w * 0.7; path(); ctx.stroke(); }
  if (o.body > 0.01) { ctx.globalAlpha = a0 * o.body * L; ctx.fillStyle = mixHex(o.color, o.fringe, 0.3); path(); ctx.fill(); }
  ctx.globalAlpha = a0 * 0.4 * L; ctx.strokeStyle = o.fringe; ctx.lineWidth = w * 2.2; path(); ctx.stroke();      // vidrio incandescente (halo cercano)
  ctx.globalAlpha = a0 * L; ctx.strokeStyle = o.color; ctx.lineWidth = w; ctx.stroke();                              // tubo
  ctx.globalAlpha = a0 * L; ctx.strokeStyle = core; ctx.lineWidth = w * 0.4; ctx.stroke();                           // núcleo caliente
  ctx.globalAlpha = a0;
}

// ───────── la palabra ─────────
// word(ctx, api, str, cx, cy, size, o) — (cx, cy) = centro de la caja de mayúsculas (align:'center'|'left'|'right' mueve el ancla horizontal).
//   o: color, alpha, s | sx, sy, rot, track, label, reg:false (no registrar),
//      split (px: canales magenta/lima desplazados), slice {n, amp, t, seed} (tiras horizontales desplazadas, amp en px),
//      reveal [a,b] (recorte horizontal 0..1), per(i,n) → {dx,dy,rot,s,a,color} (animación por letra), vel [vx,vy] (smear), pad
// Devuelve la caja en coordenadas del mundo {x, y, w, h} (sin rotación) para colocar foco y compañeros.
export function word(ctx, api, str, cx, cy, size, o = {}) {
  const lay = layout(str, o.track ?? TRACK), wpx = lay.w * size, hpx = CAP * size, a = o.alpha ?? 1, sx = o.sx ?? o.s ?? 1, sy = o.sy ?? o.s ?? 1;
  const al = o.align ?? 'center', ox = al === 'left' ? 0 : al === 'right' ? -wpx : -wpx / 2, pad = o.pad ?? 0.02 * size;
  const col = api.color(o.color ?? 'ink'), TW = o.solid ? 0 : api.S?.rules?.tube ?? 0, PR = TW ? api.params ?? {} : null;
  const tubeKit = TW ? (() => {                                                // color/halo/encendido del tubo según el estado del letrero
    const isInk = !o.color || o.color === 'ink', fr = isInk ? mixHex(api.color('accent2'), api.color('accent'), Math.max(PR.lock ?? 0, clamp(((1 - (PR.chaos ?? 0)) - 0.15) * 2))) : col;
    const kick = Math.min(1.5, (PR.kick ?? 0) + (PR.shock ?? 0) * 0.5), body = Math.min(0.42, 0.06 + 0.3 * kick + 0.18 * (PR.tension ?? 0));
    return { color: isInk ? mixHex(api.color('ink'), fr, 0.28) : col, fringe: fr, body, kick, lit: (i) => litOf(i, api.t ?? 0, PR.chaos ?? 0, o.litSeed ?? 1) * (o.litMul ?? 1), w: TW * (1 + 0.1 * kick) };
  })() : null;
  const fill = (color, dx = 0) => {
    if (TW) {
      ctx.save(); ctx.translate(ox + dx, hpx / 2); ctx.scale(size, size);
      const sp = color !== col, K = tubeKit;                                    // pasada de canal (split): tubo fino del color pedido, sin cuerpo
      pieces(str, o.track ?? TRACK).forEach((p, i) => { if (p.ch === ' ') return; tubeLetter(ctx, p.shape, { ...K, color: sp ? color : K.color, fringe: sp ? color : K.fringe, body: sp ? 0 : K.body, lit: sp ? 1 : K.lit(i) }); });
      ctx.restore(); return;
    } ctx.save(); ctx.fillStyle = color; ctx.translate(ox + dx, hpx / 2); ctx.scale(size, size); ctx.beginPath(); tracePath(ctx, wordShape(str, o.track ?? TRACK)); ctx.fill(); ctx.restore(); };
  const draw = () => {
    ctx.save(); ctx.translate(cx, cy); if (o.rot) ctx.rotate(o.rot); ctx.scale(sx, sy); ctx.globalAlpha = a;
    if (o.reg !== false && (a > 0.2 || o.reg === 'only')) api._box(ctx.getTransform(), { x: ox - pad, y: -hpx / 2 - pad, w: wpx + 2 * pad, h: hpx + 2 * pad }, { kind: 'text', label: o.label ?? str, size, role: 'h1', chars: String(str).length });
    if (o.reg === 'only') { ctx.restore(); return; }
    if (TW && o.wash !== false && a > 0.05) {                                  // la luz del tubo baña el muro: pozo de color tras la palabra
      const R = Math.max(wpx, hpx) * 0.75, g = ctx.createRadialGradient(0, 0, 0, 0, 0, R), K = tubeKit; g.addColorStop(0, K.fringe); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * clamp(0.1 + 0.16 * K.kick); ctx.fillStyle = g; ctx.translate(ox + wpx / 2, 0); ctx.fillRect(-R, -R, 2 * R, 2 * R); ctx.restore();
    }
    const rv = o.reveal, clipRev = () => { if (rv) { ctx.beginPath(); ctx.rect(ox + wpx * rv[0] - 1, -hpx, wpx * (rv[1] - rv[0]) + 2, 2 * hpx); ctx.clip(); } };
    ctx.save(); clipRev();
    if (o.per) {                                                              // por letra: cada glifo con su propio transform
      const P = pieces(str, o.track ?? TRACK), n = P.length;
      P.forEach((p, i) => {
        if (p.ch === ' ') return; const q = o.per(i, n) ?? {}, gx = ox + (p.x + p.adv / 2) * size;
        ctx.save(); ctx.globalAlpha = a * (q.a ?? 1); ctx.translate(gx + (q.dx ?? 0), hpx / 2 + (q.dy ?? 0) - 0.5 * hpx * 0); ctx.rotate(q.rot ?? 0); ctx.scale(q.s ?? 1, q.s ?? 1);
        ctx.translate(-(p.x + p.adv / 2) * size, 0); ctx.scale(size, size); if (TW) { const K = tubeKit, qc = q.color ? api.color(q.color) : null; tubeLetter(ctx, p.shape, { ...K, color: qc ?? K.color, fringe: qc ?? K.fringe, lit: K.lit(i) * (q.lit ?? 1) }); } else { ctx.fillStyle = q.color ? api.color(q.color) : col; ctx.beginPath(); tracePath(ctx, p.shape); ctx.fill(); } ctx.restore();
      });
    } else if (o.slice && o.slice.amp > 0.01) {
      const S = o.slice, n = S.n ?? 5, R = rng(Math.floor((S.t ?? 0) * 24) * 131 + (S.seed ?? 1));
      for (let i = 0; i < n; i++) {
        const y0 = i === 0 ? -1e4 : -hpx / 2 + (hpx * i) / n, y1 = i === n - 1 ? 1e4 : -hpx / 2 + (hpx * (i + 1)) / n, d = (R() * 2 - 1) * S.amp;   // la 1.ª y la última tira llegan al infinito: acentos y rabos no se recortan
        ctx.save(); ctx.beginPath(); ctx.rect(ox - wpx, y0, wpx * 3, y1 - y0 + 0.5); ctx.clip();
        if (o.split) { ctx.globalCompositeOperation = 'lighter'; fill(api.color('accent2'), d - o.split); fill(api.color('accent'), d + o.split * 0.6); ctx.globalCompositeOperation = 'source-over'; }
        fill(col, d); ctx.restore();
      }
    } else {
      if (o.split) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; fill(api.color('accent2'), -o.split); fill(api.color('accent'), o.split * 0.6); ctx.restore(); }
      fill(col);
    }
    ctx.restore(); ctx.restore();
  };
  if (o.vel) api.smear(cx, cy, o.vel[0], o.vel[1], draw); else draw();
  const w2 = (wpx + 2 * pad) * sx, h2 = (hpx + 2 * pad) * sy, rt = Math.abs(Math.sin(o.rot ?? 0)) > 0.7, bw = rt ? h2 : w2, bh = rt ? w2 : h2, mid = cx + (ox + wpx / 2) * sx * (rt ? 0 : 1);
  return { x: mid - bw / 2, y: cy - bh / 2, w: bw, h: bh, cx, cy, size, wpx, hpx };
}

// Foco que el tipo puede habitar (hollow): la unión de las cajas (mundo) ensanchada. Se llama con el ctx sin transformar (cámara aplicada).
export function focusOf(api, boxes, label = 'mensaje', grow = 0.22) {
  const bs = boxes.filter(Boolean); if (!bs.length) return;
  const x0 = Math.min(...bs.map((b) => b.x)), y0 = Math.min(...bs.map((b) => b.y)), x1 = Math.max(...bs.map((b) => b.x + b.w)), y1 = Math.max(...bs.map((b) => b.y + b.h));
  const w = x1 - x0, h = y1 - y0, gx = w * grow, gy = h * grow, hole = Math.min(0.97, Math.max((w + 0.9 * gx) / (w + 2 * gx), (h + 0.9 * gy) / (h + 2 * gy)));   // el hueco deja vivir al tipo con margen
  api.focus(x0 - gx, y0 - gy, w + 2 * gx, h + 2 * gy, label, { weight: 1, bleed: true, hollow: hole });
}

// Bloque justificado: cada línea se escala para ocupar el ancho (cartel). Si el bloque no cabe en alto, se reduce todo.
//   → [{str, size, cx, cy, cap}] centrados en (o.cx, o.cy); el shot los dibuja con word().
export function stack(api, lines, o = {}) {
  const W = o.width ?? api.safe.w * 0.9, gapK = o.gap ?? 0.22, maxH = o.maxH ?? api.safe.h * 0.97, L = lines.map((l) => (typeof l === 'string' ? { str: l } : l));
  let sizes = L.map((l) => Math.min(o.maxSize ?? 1e9, l.size ?? fit(l.str, W, o.track)));
  const total = (z) => z.reduce((a, s) => a + CAP * s, 0) + z.slice(0, -1).reduce((a, s, i) => a + gapK * Math.min(s, z[i + 1]), 0), T = total(sizes);
  if (T > maxH) sizes = sizes.map((s) => (s * maxH) / T);
  let y = (o.cy ?? api.safe.cy) - total(sizes) / 2;
  return L.map((l, i) => { const size = sizes[i], cap = CAP * size, cy = y + cap / 2; y += cap + (i < L.length - 1 ? gapK * Math.min(size, sizes[i + 1]) : 0); return { ...l, size, cap, cy, cx: o.cx ?? api.safe.cx }; });
}

// ───────── esquirlas ─────────
// Triangulación de una malla jitterizada sobre la caja de la palabra. Cada triángulo = una esquirla (clip + el mismo contorno).
const TRI = new Map();
function mesh(cols, rows, w, h, seed) {
  const key = [cols, rows, Math.round(w), Math.round(h), seed].join(); let T = TRI.get(key); if (T) return T;
  const R = rng(seed), V = [];
  for (let j = 0; j <= rows; j++) { V.push([]); for (let i = 0; i <= cols; i++) { const edge = i === 0 || j === 0 || i === cols || j === rows; V[j].push([(i / cols) * w + (edge ? 0 : (R() - 0.5) * 0.7 * (w / cols)), (j / rows) * h + (edge ? 0 : (R() - 0.5) * 0.7 * (h / rows))]); } }
  T = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = V[j][i], b = V[j][i + 1], c = V[j + 1][i + 1], d = V[j + 1][i], flip = R() < 0.5;
    for (const tri of flip ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]]) { const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3; T.push({ tri, cx, cy, r1: R(), r2: R(), r3: R() }); }
  }
  TRI.set(key, T); return T;
}
// shatter(ctx, api, str, cx, cy, size, {u, seed, power, cols, rows, color, alpha, split, from}) — u=0 intacta, u=1 dispersa.
//   from:'out' (por defecto) las esquirlas salen del centro; 'in' llegan desde lejos (recomposición): se llama con u decreciente 1→0.
export function shatter(ctx, api, str, cx, cy, size, o = {}) {
  const wpx = layout(str, o.track ?? TRACK).w * size, hpx = CAP * size, u = clamp(o.u ?? 0), cols = o.cols ?? 16, rows = o.rows ?? 7, M = mesh(cols, rows, wpx, hpx, o.seed ?? 7);
  const col = api.color(o.color ?? 'ink'), pw = o.power ?? 1, D = Math.hypot(wpx, hpx), shape = wordShape(str, o.track ?? TRACK);
  const e = 1 - (1 - u) ** (o.curve ?? 3);                                  // arranque violento, frenado largo
  const al = (o.alpha ?? 1);
  for (const T of M) {
    const dx0 = T.cx - wpx / 2, dy0 = T.cy - hpx / 2, ang = Math.atan2(dy0, dx0) + (T.r1 - 0.5) * 1.1, dist = (0.25 + 1.1 * T.r2) * D * pw * e, rot = (T.r3 - 0.5) * 5 * e;
    const ox = Math.cos(ang) * dist, oy = Math.sin(ang) * dist - 0.12 * D * pw * e * e, fade = clamp(1 - (u - 0.55) / 0.45 * (o.fade ?? 0));
    ctx.save(); ctx.globalAlpha = al * fade; ctx.translate(cx + ox + dx0, cy + oy + dy0); ctx.rotate(rot); ctx.translate(-dx0, -dy0);
    ctx.save(); ctx.beginPath(); ctx.moveTo(T.tri[0][0] - wpx / 2, T.tri[0][1] - hpx / 2); ctx.lineTo(T.tri[1][0] - wpx / 2, T.tri[1][1] - hpx / 2); ctx.lineTo(T.tri[2][0] - wpx / 2, T.tri[2][1] - hpx / 2); ctx.closePath(); ctx.clip();
    const paint = (c, dx) => { ctx.fillStyle = c; ctx.save(); ctx.translate(-wpx / 2 + dx, hpx / 2); ctx.scale(size, size); ctx.beginPath(); tracePath(ctx, shape); ctx.fill(); ctx.restore(); };
    if (o.split) { ctx.globalCompositeOperation = 'lighter'; paint(api.color('accent2'), -o.split); paint(api.color('accent'), o.split * 0.6); ctx.globalCompositeOperation = 'source-over'; }
    paint(T.r1 > 0.9 ? api.color('accent2') : col, 0);
    ctx.restore(); ctx.restore();
  }
  return { x: cx - wpx / 2, y: cy - hpx / 2, w: wpx, h: hpx };
}

// ───────── grietas ─────────
// Línea quebrada que crece desde (x0,y0) con ramas; deterministas por semilla. u 0..1 = cuánto han avanzado.
export function cracks(ctx, api, x0, y0, reach, u, o = {}) {
  const R = rng(o.seed ?? 3), n = o.n ?? 5; ctx.save(); ctx.strokeStyle = api.color(o.color ?? 'paper'); ctx.lineWidth = o.lw ?? Math.max(5, reach * 0.016); ctx.lineCap = 'round'; ctx.lineJoin = 'miter';
  for (let k = 0; k < n; k++) {
    let a = (k / n) * TAU + (R() - 0.5) * 0.8, x = x0, y = y0; const steps = 9, len = reach * (0.35 + 0.65 * R()), pts = [[x, y]];
    for (let s = 0; s < steps; s++) { a += (R() - 0.5) * 1.1; const d = (len / steps) * (0.6 + 0.8 * R()); x += Math.cos(a) * d; y += Math.sin(a) * d; pts.push([x, y]); }
    const m = Math.max(1, Math.floor(clamp(u) * (pts.length - 1)) + 1), f = clamp(u) * (pts.length - 1) - Math.floor(clamp(u) * (pts.length - 1));
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let s = 1; s < m; s++) ctx.lineTo(pts[s][0], pts[s][1]);
    if (m < pts.length && u < 1) ctx.lineTo(lerp(pts[m - 1][0], pts[m][0], f), lerp(pts[m - 1][1], pts[m][1], f));
    ctx.stroke();
  }
  ctx.restore();
}

// ───────── rejilla visible y motivos ─────────
// Líneas finas de rejilla (el «compás» hecho visible). lit 0..1 las enciende en lima.
export function gridlines(ctx, api, o = {}) {
  const S = api.safe, cols = o.cols ?? 4, rows = o.rows ?? 8, a = o.alpha ?? 0.5, lit = o.lit ?? 0; if (a <= 0.01) return;
  ctx.save(); ctx.lineWidth = 2; ctx.globalAlpha = a; ctx.strokeStyle = api.color('shade');
  ctx.beginPath(); for (let i = 0; i <= cols; i++) { const x = lerp(S.x0, S.x1, i / cols); ctx.moveTo(x, S.y0); ctx.lineTo(x, S.y1); } for (let j = 0; j <= rows; j++) { const y = lerp(S.y0, S.y1, j / rows); ctx.moveTo(S.x0, y); ctx.lineTo(S.x1, y); } ctx.stroke();
  if (lit > 0.01) { ctx.globalAlpha = a * clamp(lit); ctx.strokeStyle = api.color('accent'); ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i <= cols; i++) { const x = lerp(S.x0, S.x1, i / cols); ctx.moveTo(x, S.y0); ctx.lineTo(x, S.y1); } ctx.stroke(); }
  ctx.restore();
}
export function dot(ctx, api, x, y, r, color = 'accent', a = 1) { if (r <= 0.3) return; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = api.color(color); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore(); }
export function ring(ctx, api, x, y, r, lw, color = 'accent', a = 1) { if (r <= 0.5 || a <= 0.01) return; ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = api.color(color); ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.restore(); }

// ───────── pequeñas utilidades de movimiento ─────────
// Entrada de impacto: muelle seco del estilo; age en s desde el pulso. Devuelve {s (escala), a (alfa)} — antes del pulso: invisible.
export function pop(api, age, o = {}) {
  if (age < -1e-6) return { s: 0, a: 0, e: 0 };
  const e = api.spring(age, o.kind ?? 'snap'), s = lerp(o.from ?? 1.35, 1, e); return { s, a: 1, e };
}
// Sacudida con caída exponencial: valor en px (dos ejes decorrelados), determinista en t.
export function jolt(t, amp, decay, seed = 1) { const k = Math.exp(-decay * Math.max(0, t)); return [amp * k * noise1(t * 38, seed), amp * k * noise1(t * 41, seed + 5)]; }
// Posición en la rejilla visible: ajusta (x,y) hacia el nodo más cercano con fuerza lock 0..1.
export function snapTo(api, x, y, lock, cols = 4, rows = 8) {
  const S = api.safe, gx = S.x0 + Math.round(((x - S.x0) / S.w) * cols) * (S.w / cols), gy = S.y0 + Math.round(((y - S.y0) / S.h) * rows) * (S.h / rows);
  return [lerp(x, gx, lock), lerp(y, gy, lock)];
}
// Cuadrícula de «casillas»: devuelve el centro de la casilla (c, r) del área segura.
export const cell = (api, c, r, cols = 4, rows = 8) => [api.safe.x0 + ((c + 0.5) / cols) * api.safe.w, api.safe.y0 + ((r + 0.5) / rows) * api.safe.h];
// Temblor de ruido (24 Hz, decorrelado en x/y) proporcional al desorden.
export const shake = (P, t, amp = 14, seed = 1) => [amp * P.chaos * noise1(Math.floor(t * 24) * 0.73, seed), amp * P.chaos * noise1(Math.floor(t * 24) * 0.71, seed + 9)];
// Tiras de glitch: amplitud (px) = desorden × destello; se aplican con word(..., {slice}).
export const glitch = (P, t, size, seed = 1, k = 0.12) => ({ n: 5, amp: size * k * P.chaos * Math.min(1, 0.25 + P.snare + P.kick * 0.5), t, seed });
export { spring };

// Secuenciador: las cuatro filas del reel (palabra, pista de audio que las enciende, color de reposo).
export const ROWS = [['PUM', 'kick'], ['TIC', 'hat'], ['CLAC', 'snare'], ['TOC', 'tom']];
// Playhead lima: una línea fina que recorre el ancho una vez por compás (4 pulsos); deja una estela corta.
export function playhead(ctx, api, ph, o = {}) {
  const S = api.safe, x = S.x0 + S.w * ph; ctx.save(); ctx.fillStyle = api.color('accent');
  for (let i = 0; i < 6; i++) { ctx.globalAlpha = (o.alpha ?? 1) * 0.5 ** (i + 0.3) * (i ? 0.7 : 1); ctx.fillRect(x - 5 - i * 14, S.y0 - 20, 10, S.h + 40); }
  ctx.restore();
}

// Composición final (cartel justificado de 4 líneas; tamaños iguales en las dos últimas). Mismas posiciones en K20–K24.
export const FINAL = ['LO', 'ROTO', 'VUELVE', 'A SONAR'];
export function finalStack(api) {
  const L0 = stack(api, FINAL, { cy: api.safe.cy, gap: 0.14, maxSize: 700 }), z = Math.min(L0[2].size, L0[3].size);
  return stack(api, FINAL.map((str, i) => ({ str, size: i > 1 ? z : L0[i].size })), { cy: api.safe.cy, gap: 0.14 });
}
