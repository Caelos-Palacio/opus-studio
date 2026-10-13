#!/usr/bin/env node
// Panel de críticos (spec 022): tres miradas independientes (director, ojo, escéptico) puntúan un film con la rúbrica de data/gusto.md.
//   node engine/panel.mjs preparar <mp4> --out <dir> [--nombre X]   12 fotogramas, hoja, 6 recortes a 4×, audio (ebur128), % vacíos/fondo plano → paquete.md
//                                                                   (con --nombre el paquete es ANÓNIMO: sin ruta ni notas humanas)
//   node engine/panel.mjs registrar <dir> <mirada> <json|archivo>   valida {mirada, puntos:{criterio:0–10}, total, arreglos:[3]} y lo guarda
//   node engine/panel.mjs veredicto <dir>                           agrega: SHIP si media ≥ 8 y ninguna mirada < 6; si no FIX con los arreglos
//   node engine/panel.mjs prompt <mirada> (--paquete <dir> | --calibracion)   imprime el prompt autocontenido del crítico (docs/current/PANEL*.md)
//   node engine/panel.mjs preparar-calibracion [--out <dir>]        paquetes ANÓNIMOS (A, B, …) de data/calibracion.json + mapa aparte
//   node engine/panel.mjs registrar-lote <dir-calibracion> <json>   registra los veredictos de un crítico sobre todos los paquetes
//   node engine/panel.mjs calibrar [--dir D] [--mapa M]             Spearman entre el total del panel y el nivel de las notas humanas
import './help.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, GUSTO, MIRADAS, MIRADA_NOMBRE, miradaKey, parseRubrica, reglasDeMirada, parseReglas, fmtRegla, BEGIN, END } from './gusto.mjs';

export const CAL = path.join(ROOT, 'data/calibracion.json');
export const NFRAMES = 12, NCROPS = 6, ZOOM = 4;
const r1 = (x) => Math.round(x * 10) / 10;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

/** Carpeta de entregas: OPUS_ENTREGAS > <ROOT>/out/entregas > (worktree) <repo>/out/entregas. */
export function entregasDir() {
  const c = [process.env.OPUS_ENTREGAS, path.join(ROOT, 'out/entregas'), path.join(ROOT, '../../../out/entregas')].filter(Boolean);
  return c.find((d) => fs.existsSync(d)) ?? c[1];
}
export const panelOut = () => process.env.OPUS_PANEL_OUT ?? path.join(path.dirname(entregasDir()), 'panel');

// ───────────────────────── veredictos ─────────────────────────
/** Valida un veredicto contra la rúbrica. Devuelve {ok, errores, v} (v normalizado). */
export function validarVeredicto(v, rubrica = parseRubrica(fs.readFileSync(GUSTO, 'utf8')), mirada = null) {
  const err = [];
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { ok: false, errores: ['el veredicto debe ser un objeto JSON'], v: null };
  const k = miradaKey(v.mirada);
  if (!k) err.push(`mirada inválida «${v.mirada}» (director | ojo | escéptico)`);
  if (mirada && k && miradaKey(mirada) !== k) err.push(`la mirada del JSON («${v.mirada}») no coincide con «${mirada}»`);
  const crit = k ? Object.keys(rubrica[k] ?? {}) : [];
  const p = v.puntos;
  if (!p || typeof p !== 'object' || Array.isArray(p)) err.push('«puntos» debe ser un objeto {criterio: 0–10}');
  else {
    for (const c of crit) if (!(c in p)) err.push(`falta el criterio «${c}»`);
    for (const c of Object.keys(p)) if (k && !crit.includes(c)) err.push(`criterio desconocido «${c}» (válidos: ${crit.join(', ')})`);
    for (const [c, x] of Object.entries(p)) if (typeof x !== 'number' || !Number.isFinite(x) || x < 0 || x > 10) err.push(`«${c}» debe ser un número de 0 a 10 (recibido ${JSON.stringify(x)})`);
  }
  const vals = p && typeof p === 'object' ? Object.values(p).filter((x) => typeof x === 'number' && Number.isFinite(x)) : [];
  if (typeof v.total !== 'number' || !Number.isFinite(v.total) || v.total < 0 || v.total > 10) err.push('«total» debe ser un número de 0 a 10');
  else if (vals.length && crit.length && vals.length === crit.length && Math.abs(v.total - mean(vals)) > 0.25) err.push(`«total» ${v.total} no es la media de los puntos (${r1(mean(vals))})`);
  if (!Array.isArray(v.arreglos) || v.arreglos.length !== 3 || v.arreglos.some((a) => typeof a !== 'string' || a.trim().length < 8)) err.push('«arreglos» debe tener exactamente 3 textos concretos (≥ 8 caracteres)');
  return { ok: !err.length, errores: err, v: err.length ? null : { mirada: MIRADA_NOMBRE[k], puntos: p, total: v.total, arreglos: v.arreglos.map((a) => a.trim()) } };
}

/** Guarda <dir>/veredictos/<mirada>.json. `json` = texto JSON, objeto o ruta a un archivo. */
export function registrar(dir, mirada, json, rubrica) {
  const k = miradaKey(mirada); if (!k) throw new Error(`mirada inválida «${mirada}» (director | ojo | escéptico)`);
  let v = json;
  if (typeof json === 'string') { const t = fs.existsSync(json) ? fs.readFileSync(json, 'utf8') : json; try { v = JSON.parse(t); } catch (e) { throw new Error(`JSON ilegible: ${e.message}`); } }
  const r = validarVeredicto(v, rubrica, k); if (!r.ok) throw new Error('veredicto inválido:\n- ' + r.errores.join('\n- '));
  fs.mkdirSync(path.join(dir, 'veredictos'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'veredictos', `${k}.json`), JSON.stringify(r.v, null, 2) + '\n');
  return r.v;
}

/** Agrega los veredictos de un paquete. SHIP: media de las 3 miradas ≥ 8 y ninguna < 6. */
export function agregar(veredictos) {
  const faltan = MIRADAS.filter((m) => !veredictos[m]);
  if (faltan.length) return { estado: 'INCOMPLETO', faltan: faltan.map((m) => MIRADA_NOMBRE[m]), motivo: `faltan miradas: ${faltan.map((m) => MIRADA_NOMBRE[m]).join(', ')}` };
  const totales = Object.fromEntries(MIRADAS.map((m) => [m, veredictos[m].total])), media = mean(Object.values(totales)), minima = Math.min(...Object.values(totales));
  const ship = media >= 8 - 1e-9 && minima >= 6 - 1e-9, bajas = MIRADAS.filter((m) => totales[m] < 6 - 1e-9);
  const motivo = ship ? `media ${r1(media)} ≥ 8 y ninguna mirada < 6` : [media < 8 - 1e-9 ? `media ${r1(media)} < 8` : null, bajas.length ? `mirada(s) < 6: ${bajas.map((m) => `${MIRADA_NOMBRE[m]} ${totales[m]}`).join(', ')}` : null].filter(Boolean).join('; ');
  const arreglos = [...MIRADAS].sort((a, b) => totales[a] - totales[b]).flatMap((m) => veredictos[m].arreglos.map((texto) => ({ mirada: MIRADA_NOMBRE[m], texto })));
  return { estado: ship ? 'SHIP' : 'FIX', media: r1(media), media_exacta: media, totales, minima, motivo, arreglos: ship ? [] : arreglos };
}

export function leerVeredictos(dir) {
  const out = {};
  for (const m of MIRADAS) { const f = path.join(dir, 'veredictos', `${m}.json`); if (fs.existsSync(f)) out[m] = JSON.parse(fs.readFileSync(f, 'utf8')); }
  return out;
}

export function veredicto(dir) {
  const r = agregar(leerVeredictos(dir));
  fs.writeFileSync(path.join(dir, 'veredicto.json'), JSON.stringify(r, null, 2) + '\n');
  const L = [`# Veredicto del panel: ${r.estado}`, '', r.motivo, ''];
  if (r.totales) { L.push('| mirada | total |', '|---|---|', ...MIRADAS.map((m) => `| ${MIRADA_NOMBRE[m]} | ${r.totales[m]} |`), `| **media** | **${r.media}** |`, ''); }
  if (r.arreglos?.length) L.push('## Arreglos (de la mirada más baja a la más alta)', '', ...r.arreglos.map((a, i) => `${i + 1}. [${a.mirada}] ${a.texto}`), '');
  fs.writeFileSync(path.join(dir, 'veredicto.md'), L.join('\n'));
  return r;
}

// ───────────────────────── calibración ─────────────────────────
const ranks = (a) => {
  const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = new Array(a.length);
  for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const rk = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k][1]] = rk; i = j + 1; }
  return r;
};
/** Spearman = Pearson de los rangos (empates con rango medio). null si una serie es constante o n < 2. */
export function spearman(xs, ys) {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const a = ranks(xs), b = ranks(ys), ma = mean(a), mb = mean(b);
  let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return saa === 0 || sbb === 0 ? null : sab / Math.sqrt(saa * sbb);
}

/** Orden de los pares: estricto → panel[mayor] > panel[menor]; débil → panel[mayor] ≥ panel[menor] − 0,25. */
export function evaluarPares(pares, puntos) {
  return pares.filter((p) => p.mayor in puntos && p.menor in puntos).map((p) => {
    const d = puntos[p.mayor] - puntos[p.menor], ok = p.fuerza === 'debil' ? d >= -0.25 : d > 0;
    return { ...p, diff: r1(d), ok };
  });
}

/** Mezcla determinista (mulberry32) y letras A, B, … */
export function anonimizar(claves, semilla = 1) {
  let s = semilla >>> 0; const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const a = [...claves]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  const letra = (i) => String.fromCharCode(65 + (i % 26)) + (i >= 26 ? String(Math.floor(i / 26)) : '');
  return Object.fromEntries(a.map((c, i) => [letra(i), c]));
}

export function calibrar({ cal = JSON.parse(fs.readFileSync(CAL, 'utf8')), dir = path.join(panelOut(), 'calibracion'), mapa = path.join(panelOut(), 'calibracion-mapa.json') } = {}) {
  const map = JSON.parse(fs.readFileSync(mapa, 'utf8')), nivel = Object.fromEntries(cal.peliculas.map((p) => [p.clave, p.nivel]));
  const filas = [], sin = [];
  for (const [letra, clave] of Object.entries(map)) {
    const r = agregar(leerVeredictos(path.join(dir, letra)));
    if (r.estado === 'INCOMPLETO') sin.push(`${letra}: ${r.motivo}`); else filas.push({ letra, clave, nivel: nivel[clave], media: r.media_exacta, estado: r.estado, totales: r.totales });
  }
  const rho = filas.length >= 3 ? spearman(filas.map((f) => f.media), filas.map((f) => f.nivel)) : null;
  const pares = evaluarPares(cal.pares, Object.fromEntries(filas.map((f) => [f.clave, f.media])));
  const umbral = cal.umbral_spearman ?? 0.7;
  return { rho, umbral, ok: rho != null && rho >= umbral, n: filas.length, filas: filas.sort((a, b) => b.media - a.media), pares, sin_veredicto: sin };
}

// ───────────────────────── medición del film ─────────────────────────
const sh = (c, a, o = {}) => execFileSync(c, a, { maxBuffer: 1 << 29, stdio: ['ignore', 'pipe', 'pipe'], ...o });

export function sonda(mp4) {
  const j = JSON.parse(sh('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', mp4]).toString());
  const v = j.streams.find((s) => s.codec_type === 'video'), a = j.streams.find((s) => s.codec_type === 'audio'), [n, d] = (v.r_frame_rate ?? '30/1').split('/').map(Number);
  return { dur: +j.format.duration, w: v.width, h: v.height, fps: r1(n / (d || 1)), audio: !!a, bytes: +j.format.size };
}

export function medirAudio(mp4) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', mp4, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 }), txt = r.stderr ?? '';
  const sum = txt.slice(txt.lastIndexOf('Summary:')), g = (re) => { const m = sum.match(re); return m ? +m[1] : null; };
  const I = g(/I:\s+(-?[\d.]+)\s+LUFS/), LRA = g(/LRA:\s+(-?[\d.]+)\s+LU/), TP = g(/Peak:\s+(-?[\d.]+)\s+dBFS/);
  return I == null ? null : { I, LRA, TP };
}

/** Muestrea el film a baja resolución (gris) y mide: fotogramas vacíos, fondo plano, cortes, actividad. */
export function analisisVisual(mp4, info) {
  const H = 180, W = Math.max(2, Math.round((H * info.w / info.h) / 2) * 2), fps = Math.min(4, Math.max(0.5, 600 / info.dur));
  const buf = sh('ffmpeg', ['-v', 'error', '-i', mp4, '-an', '-vf', `fps=${fps},scale=${W}:${H}:flags=area`, '-pix_fmt', 'gray', '-f', 'rawvideo', '-']), N = Math.floor(buf.length / (W * H));
  let vacios = 0, planos = 0; const dif = [];
  const mx = Math.round(W * 0.15), my = Math.round(H * 0.15);
  for (let f = 0; f < N; f++) {
    const o = f * W * H, px = buf.subarray(o, o + W * H), hist = new Uint32Array(256); for (const v of px) hist[v]++;
    let acc = 0, med = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= px.length / 2) { med = v; break; } }
    let cerca = 0; for (let v = Math.max(0, med - 6); v <= Math.min(255, med + 6); v++) cerca += hist[v];
    if (cerca / px.length >= 0.97) vacios++;
    let n = 0, s = 0, s2 = 0, t = 0;                        // marco exterior: desviación y ruido entre vecinos
    for (let y = 0; y < H; y++) for (let x = 0; x < W - 1; x++) if (x < mx || x >= W - mx || y < my || y >= H - my) { const v = px[y * W + x]; n++; s += v; s2 += v * v; t += Math.abs(px[y * W + x + 1] - v); }
    const sd = Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2));
    if (sd < 5 && t / n < 1.0) planos++;
    if (f > 0) { const p = buf.subarray(o - W * H, o); let d = 0; for (let i = 0; i < px.length; i += 3) d += Math.abs(px[i] - p[i]); dif.push(d / Math.ceil(px.length / 3)); }
  }
  const cortes = []; dif.forEach((d, i) => { if (d > 18) cortes.push((i + 1) / fps); });
  const lim = [0, ...cortes, info.dur], tramos = lim.slice(1).map((t, i) => t - lim[i]).filter((x) => x > 0), mt = mean(tramos);
  const cv = tramos.length > 1 ? Math.sqrt(mean(tramos.map((x) => (x - mt) ** 2))) / mt : null;
  const orden = [...dif].sort((a, b) => a - b), q = (p) => orden[Math.min(orden.length - 1, Math.floor(p * orden.length))] ?? 0;
  const dec = Array.from({ length: 10 }, (_, k) => { const a = dif.slice(Math.floor(k * dif.length / 10), Math.floor((k + 1) * dif.length / 10)); return a.length ? r1(mean(a)) : 0; });
  return { muestras: N, vacios_pct: r1(100 * vacios / N), plano_pct: r1(100 * planos / N), cortes: cortes.length, tramos: tramos.length, cv_tramos: cv == null ? null : Math.round(cv * 100) / 100, actividad_por_decil: dec, p90_p10: r1(q(0.9) / Math.max(q(0.1), 0.05)) };
}

// ───────────────────────── imágenes: fotogramas, hoja, recortes ─────────────────────────
async function lienzo() { const m = await import('canvas'); return m.default ?? m; }

/** Mapa de bordes (Sobel) a baja resolución → ventana de 1/4×1/4 con más bordes (detalle o texto). */
export function mejorVentana(gris, W, H) {
  const wv = Math.max(4, Math.floor(W / ZOOM)), hv = Math.max(4, Math.floor(H / ZOOM)), E = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, gx = -gris[i - W - 1] - 2 * gris[i - 1] - gris[i + W - 1] + gris[i - W + 1] + 2 * gris[i + 1] + gris[i + W + 1], gy = -gris[i - W - 1] - 2 * gris[i - W] - gris[i - W + 1] + gris[i + W - 1] + 2 * gris[i + W] + gris[i + W + 1];
    E[i] = Math.hypot(gx, gy) > 80 ? 1 : 0;
  }
  const S = new Uint32Array((W + 1) * (H + 1)); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) S[(y + 1) * (W + 1) + x + 1] = E[y * W + x] + S[y * (W + 1) + x + 1] + S[(y + 1) * (W + 1) + x] - S[y * (W + 1) + x];
  let best = { score: -1, x: 0, y: 0 };
  const sx = Math.max(1, Math.floor(wv / 4)), sy = Math.max(1, Math.floor(hv / 4));
  for (let y = 0; y + hv <= H; y += sy) for (let x = 0; x + wv <= W; x += sx) {
    const s = S[(y + hv) * (W + 1) + x + wv] - S[y * (W + 1) + x + wv] - S[(y + hv) * (W + 1) + x] + S[y * (W + 1) + x];
    if (s > best.score) best = { score: s, x, y };
  }
  return { ...best, fx: best.x / W, fy: best.y / H };
}

async function imagenes(mp4, info, out) {
  const { createCanvas, loadImage } = await lienzo(), tmp = path.join(out, '.tmp');
  for (const d of ['frames', 'recortes', '.tmp']) fs.mkdirSync(path.join(out, d), { recursive: true });
  const ts = Array.from({ length: NFRAMES }, (_, i) => Math.min(info.dur - 0.05, ((i + 0.5) / NFRAMES) * info.dur));
  const cand = [], frames = [];
  for (const [i, t] of ts.entries()) {
    const png = path.join(tmp, `f${i}.png`); sh('ffmpeg', ['-v', 'error', '-y', '-ss', t.toFixed(3), '-i', mp4, '-frames:v', '1', png]);
    const img = await loadImage(png), k = Math.min(1, 1280 / Math.max(img.width, img.height)), c = createCanvas(Math.round(img.width * k), Math.round(img.height * k)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const name = `f${String(i + 1).padStart(2, '0')}.jpg`; fs.writeFileSync(path.join(out, 'frames', name), c.toBuffer('image/jpeg', { quality: 0.9 })); frames.push({ name, t, c });
    const sw = 192, sc = createCanvas(sw, Math.round(sw * img.height / img.width)), sx = sc.getContext('2d'); sx.drawImage(img, 0, 0, sc.width, sc.height);
    const d = sx.getImageData(0, 0, sc.width, sc.height).data, g = new Float32Array(sc.width * sc.height); for (let p = 0; p < g.length; p++) g[p] = 0.299 * d[p * 4] + 0.587 * d[p * 4 + 1] + 0.114 * d[p * 4 + 2];
    cand.push({ i, t, w: img.width, h: img.height, ...mejorVentana(g, sc.width, sc.height) });
  }
  // hoja de contacto 4×3
  const cols = 4, rows = NFRAMES / cols, cw = 480, ch = Math.round(cw * info.h / info.w), LH = 18, hoja = createCanvas(cols * cw, rows * (ch + LH)), hx = hoja.getContext('2d');
  hx.fillStyle = '#111'; hx.fillRect(0, 0, hoja.width, hoja.height); hx.font = '12px monospace';
  frames.forEach((f, i) => { const X = (i % cols) * cw, Y = Math.floor(i / cols) * (ch + LH); hx.drawImage(f.c, X, Y, cw, ch); hx.fillStyle = '#ddd'; hx.fillText(`${f.name.replace('.jpg', '')}  ${f.t.toFixed(1)}s`, X + 4, Y + ch + 13); });
  fs.writeFileSync(path.join(out, 'hoja.jpg'), hoja.toBuffer('image/jpeg', { quality: 0.85 }));
  // 6 recortes a 4×: las ventanas con más bordes, una por fotograma, ordenadas en el tiempo
  const elegidos = [...cand].sort((a, b) => b.score - a.score).slice(0, NCROPS).sort((a, b) => a.i - b.i), recortes = [];
  for (const [n, c] of elegidos.entries()) {
    const img = await loadImage(path.join(tmp, `f${c.i}.png`)), w = Math.floor(img.width / ZOOM), h = Math.floor(img.height / ZOOM), x = Math.min(img.width - w, Math.round(c.fx * img.width)), y = Math.min(img.height - h, Math.round(c.fy * img.height));
    const k = Math.min(ZOOM, 1920 / Math.max(w, h)), rc = createCanvas(Math.round(w * k), Math.round(h * k)), rx = rc.getContext('2d'); rx.imageSmoothingEnabled = true; rx.drawImage(img, x, y, w, h, 0, 0, rc.width, rc.height);
    const name = `r${n + 1}.png`; fs.writeFileSync(path.join(out, 'recortes', name), rc.toBuffer('image/png'));
    recortes.push({ name, frame: `f${String(c.i + 1).padStart(2, '0')}`, t: c.t, zona: `x ${Math.round(c.fx * 100)}–${Math.round((c.fx + 1 / ZOOM) * 100)} %, y ${Math.round(c.fy * 100)}–${Math.round((c.fy + 1 / ZOOM) * 100)} %`, bordes: c.score });
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  return { frames: frames.map((f) => ({ name: f.name, t: f.t })), recortes };
}

// ───────────────────────── paquete ─────────────────────────
const FORMATO = (k) => `{"mirada":"${MIRADA_NOMBRE[k]}","puntos":{${Object.keys(parseRubrica(fs.readFileSync(GUSTO, 'utf8'))[k]).map((c) => `"${c}":0`).join(',')}},"total":0.0,"arreglos":["…","…","…"]}`;

export function textoPaquete({ nombre, info, audio, vis, img, mirada, anonimo, gustoMd, fuente }) {
  const rub = parseRubrica(gustoMd), ks = mirada ? [mirada] : MIRADAS, L = [];
  L.push(`# Paquete de evaluación: ${nombre}`, '');
  L.push(mirada ? `Mirada asignada: **${MIRADA_NOMBRE[mirada]}**. Puntúa solo tus criterios.` : 'Paquete completo (las tres miradas).', '');
  L.push('## 1. Qué es', `- Duración ${r1(info.dur)} s · ${info.w}×${info.h} · ${info.fps} fps · ${r1(info.bytes / 1e6)} MB${fuente ? ` · fuente ${fuente}` : ''}.`, '- Estás viendo UNA película corta de animación de motion graphics. No la has visto en movimiento: la juzgas por estas imágenes y medidas.', '');
  L.push('## 2. Imágenes (ábrelas con Read, una a una)', '- `hoja.jpg`: hoja de contacto con 12 fotogramas repartidos por todo el metraje (4 columnas × 3 filas, en orden temporal). Mírala primero.',
    `- \`frames/f01.jpg\` … \`frames/f12.jpg\`: los mismos 12 fotogramas, más grandes. Tiempos: ${img.frames.map((f) => `${f.name.slice(0, 3)}=${f.t.toFixed(1)}s`).join(' ')}.`,
    `- \`recortes/r1.png\` … \`recortes/r6.png\`: ${NCROPS} recortes ampliados ${ZOOM}× de las zonas con más detalle o texto (para juzgar la materia y la tipografía a 1×):`, ...img.recortes.map((r) => `  - \`recortes/${r.name}\`: de ${r.frame} (${r.t.toFixed(1)} s), zona ${r.zona}.`), '');
  L.push('## 3. Mediciones automáticas');
  L.push(audio ? `- Audio (ebur128 sobre el mp4): ${audio.I} LUFS integrado · LRA ${audio.LRA} LU · true peak ${audio.TP} dBFS. (Objetivo del estudio: −14 ±0,5 LUFS, LRA ≥ 6, TP ≤ −1.)` : '- Audio: **el archivo no tiene pista de audio medible** (película muda o sin sonido).');
  L.push(`- Fotogramas vacíos (≥ 97 % del cuadro de un mismo tono): **${vis.vacios_pct} %** de ${vis.muestras} muestras.`, `- Fotogramas con fondo plano (marco exterior sin textura ni degradado): **${vis.plano_pct} %**.`,
    `- Cortes duros detectados: ${vis.cortes} (${vis.tramos} tramos; coeficiente de variación de su duración: ${vis.cv_tramos ?? 'n/d'}; el estudio pide ≥ 0,3). Los fundidos no cuentan como corte.`,
    `- Actividad visual (cambio medio entre muestras) en 10 tramos iguales del metraje: ${vis.actividad_por_decil.join(' · ')}. Relación p90/p10: ${vis.p90_p10} (el estudio pide ≥ 4).`, '');
  L.push('## 4. Reglas del perfil de gusto que aplican a tu mirada', '(Cada regla es algo observable. Cítalas por su id cuando justifiques un punto.)', '');
  for (const k of ks) { L.push(`### ${MIRADA_NOMBRE[k]}`, ...reglasDeMirada(gustoMd, k).map(fmtRegla), ''); }
  if (!anonimo) { const a = gustoMd.indexOf(BEGIN), b = gustoMd.indexOf(END); if (a >= 0 && b > a) L.push('## 5. Notas humanas previas (contexto)', gustoMd.slice(a + BEGIN.length, b).trim(), ''); }
  L.push('## 6. Rúbrica (0–10) y formato de respuesta', 'Anclas: 0 = ausente o roto; 5 = correcto pero olvidable; 8 = bueno, se defiende ante un profesional; 10 = asombroso. Usa todo el rango: un 8 es raro y un 10 casi nunca.', '');
  for (const k of ks) { L.push(`### ${MIRADA_NOMBRE[k]}`, ...Object.entries(rub[k]).map(([c, d]) => `- **${c}**: ${d}`), '', 'Responde con ESTE JSON (y nada más fuera de él):', '```json', FORMATO(k), '```', '`total` es la media de tus puntos (1 decimal). `arreglos`: exactamente 3, concretos y accionables (qué escena o recurso, qué cambiar y cómo se vería arreglado).', ''); }
  return L.join('\n');
}

export async function preparar(mp4, out, { nombre = null } = {}) {
  if (!fs.existsSync(mp4)) throw new Error(`no existe ${mp4}`);
  fs.mkdirSync(out, { recursive: true });
  const info = sonda(mp4), anonimo = !!nombre, nom = nombre ?? path.basename(mp4, path.extname(mp4));
  const img = await imagenes(mp4, info, out), audio = info.audio ? medirAudio(mp4) : null, vis = analisisVisual(mp4, info);
  const gustoMd = fs.readFileSync(GUSTO, 'utf8'), base = { nombre: anonimo ? `película ${nom}` : nom, info, audio, vis, img, anonimo, gustoMd, fuente: anonimo ? null : mp4 };
  fs.writeFileSync(path.join(out, 'paquete.md'), textoPaquete({ ...base, mirada: null }));
  for (const k of MIRADAS) fs.writeFileSync(path.join(out, `paquete.${k}.md`), textoPaquete({ ...base, mirada: k }));
  fs.writeFileSync(path.join(out, 'medidas.json'), JSON.stringify({ info: { dur: info.dur, w: info.w, h: info.h, fps: info.fps, audio: info.audio }, audio, vis, recortes: img.recortes }, null, 2) + '\n');
  return { out, info, audio, vis, recortes: img.recortes.length, frames: img.frames.length };
}

export async function prepararCalibracion({ cal = JSON.parse(fs.readFileSync(CAL, 'utf8')), out = path.join(panelOut(), 'calibracion'), mapa = path.join(path.dirname(out), 'calibracion-mapa.json'), log = console.log } = {}) {
  const ent = entregasDir(), map = anonimizar(cal.peliculas.map((p) => p.clave), cal.semilla ?? 1), mp4 = Object.fromEntries(cal.peliculas.map((p) => [p.clave, path.join(ent, p.mp4)]));
  const falta = Object.values(mp4).filter((f) => !fs.existsSync(f)); if (falta.length) throw new Error('faltan mp4: ' + falta.join(', '));
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  for (const [letra, clave] of Object.entries(map)) { const r = await preparar(mp4[clave], path.join(out, letra), { nombre: letra }); log(`  ${letra}  ${r.info.dur.toFixed(0)} s  vacíos ${r.vis.vacios_pct} %  plano ${r.vis.plano_pct} %  audio ${r.audio ? r.audio.I + ' LUFS' : 'no'}`); }
  fs.writeFileSync(mapa, JSON.stringify(map, null, 2) + '\n'); fs.mkdirSync(path.join(path.dirname(out), 'calibracion-veredictos'), { recursive: true });
  return { out, mapa, letras: Object.keys(map) };
}

export function registrarLote(dir, archivo, rubrica) {
  const j = JSON.parse(fs.readFileSync(archivo, 'utf8')), items = Array.isArray(j) ? j : Object.entries(j).map(([paquete, v]) => ({ paquete, ...v }));
  const ok = [], mal = [];
  for (const it of items) { const { paquete, ...v } = it; try { if (!paquete || !fs.existsSync(path.join(dir, paquete))) throw new Error(`paquete «${paquete}» inexistente`); registrar(path.join(dir, paquete), v.mirada, v, rubrica); ok.push(paquete); } catch (e) { mal.push(`${paquete}: ${e.message.replace(/\n/g, ' ')}`); } }
  return { ok, mal };
}

// ───────────────────────── prompts ─────────────────────────
export function plantilla(archivo, nombre) {
  const md = fs.readFileSync(path.join(ROOT, archivo), 'utf8'), re = new RegExp(`<!-- prompt:${nombre}:begin -->\\s*\`\`\`text\\n([\\s\\S]*?)\\n\`\`\`\\s*<!-- prompt:${nombre}:end -->`);
  const m = md.match(re); if (!m) throw new Error(`no encuentro el prompt «${nombre}» en ${archivo}`); return m[1];
}
export const rellenar = (t, v) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in v ? v[k] : `{{${k}}}`));

export function prompt(mirada, { paquete = null, calibracion = false, dir = path.join(panelOut(), 'calibracion'), salida = null } = {}) {
  const k = miradaKey(mirada); if (!k) throw new Error(`mirada inválida «${mirada}»`);
  const base = { MIRADA: MIRADA_NOMBRE[k], MIRADA_KEY: k, ENFOQUE: plantilla('docs/current/PANEL.md', `enfoque-${k}`) };
  if (calibracion) {
    const letras = fs.readdirSync(dir).filter((d) => fs.statSync(path.join(dir, d)).isDirectory()).sort(), out = salida ?? path.join(path.dirname(dir), 'calibracion-veredictos', `${k}.json`);
    return rellenar(plantilla('docs/current/PANEL-CALIBRACION.md', 'calibracion'), { ...base, DIR: dir, LETRAS: letras.join(', '), N: String(letras.length), SALIDA: out, FORMATO: FORMATO(k).replace('{"mirada"', '{"paquete":"A","mirada"') });
  }
  if (!paquete) throw new Error('falta --paquete <dir> (o --calibracion)');
  return rellenar(plantilla('docs/current/PANEL.md', 'comun'), { ...base, PAQUETE: path.resolve(paquete), SALIDA: salida ?? path.join(path.resolve(paquete), 'veredictos', `${k}.json`), FORMATO: FORMATO(k) });
}

// ───────────────────────── CLI ─────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), cmd = argv[0], flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const pos = argv.slice(1).filter((a, i, v) => !a.startsWith('--') && !(v[i - 1] ?? '').startsWith('--'));
  const salir = (e) => { console.error(e.message ?? e); process.exit(1); };
  try {
    if (cmd === 'preparar') {
      if (!pos[0] || !flag('--out')) salir('uso: panel.mjs preparar <mp4> --out <dir> [--nombre X]');
      const r = await preparar(path.resolve(pos[0]), path.resolve(flag('--out')), { nombre: flag('--nombre', null) });
      console.log(`paquete en ${r.out}: ${r.frames} fotogramas, hoja, ${r.recortes} recortes · audio ${r.audio ? `${r.audio.I} LUFS LRA ${r.audio.LRA} TP ${r.audio.TP}` : 'no'} · vacíos ${r.vis.vacios_pct} % · fondo plano ${r.vis.plano_pct} %`);
    } else if (cmd === 'registrar') {
      if (pos.length < 3) salir('uso: panel.mjs registrar <dir> <mirada> <json|archivo>');
      const v = registrar(pos[0], pos[1], pos[2]); console.log(`registrado ${v.mirada}: total ${v.total}`);
    } else if (cmd === 'veredicto') {
      const r = veredicto(pos[0] ?? salir('uso: panel.mjs veredicto <dir>')); console.log(`${r.estado}${r.media != null ? ` · media ${r.media}` : ''} · ${r.motivo}`); if (r.arreglos?.length) for (const a of r.arreglos) console.log(`  - [${a.mirada}] ${a.texto}`);
      process.exit(r.estado === 'SHIP' ? 0 : r.estado === 'FIX' ? 3 : 2);
    } else if (cmd === 'prompt') {
      console.log(prompt(pos[0] ?? salir('uso: panel.mjs prompt <mirada> (--paquete <dir> | --calibracion)'), { paquete: flag('--paquete', null), calibracion: argv.includes('--calibracion'), dir: flag('--dir', undefined) ?? path.join(panelOut(), 'calibracion') }));
    } else if (cmd === 'preparar-calibracion') {
      const r = await prepararCalibracion({ out: flag('--out', undefined) ? path.resolve(flag('--out')) : undefined }); console.log(`${r.letras.length} paquetes anónimos en ${r.out}\nmapa (NO lo lea el crítico): ${r.mapa}`);
    } else if (cmd === 'registrar-lote') {
      const r = registrarLote(pos[0], pos[1]); console.log(`registrados ${r.ok.length}`); if (r.mal.length) { console.error('rechazados:\n- ' + r.mal.join('\n- ')); process.exit(1); }
    } else if (cmd === 'calibrar') {
      const dir = flag('--dir', path.join(panelOut(), 'calibracion')), vd = path.join(path.dirname(dir), 'calibracion-veredictos');
      if (!argv.includes('--no-lote') && fs.existsSync(vd)) for (const f of fs.readdirSync(vd).filter((x) => x.endsWith('.json'))) { const r = registrarLote(dir, path.join(vd, f)); console.log(`lote ${f}: ${r.ok.length} registrados${r.mal.length ? ', rechazados:\n- ' + r.mal.join('\n- ') : ''}`); }
      const r = calibrar({ dir, mapa: flag('--mapa', path.join(path.dirname(dir), 'calibracion-mapa.json')) });
      console.log(`\n${'película'.padEnd(18)} nivel  panel  dir/ojo/esc   estado`);
      for (const f of r.filas) console.log(`${f.clave.padEnd(18)} ${String(f.nivel).padStart(4)}  ${r1(f.media).toFixed(1).padStart(5)}  ${MIRADAS.map((m) => String(f.totales[m]).padStart(4)).join('/')}   ${f.estado}`);
      for (const s of r.sin_veredicto) console.log('sin veredicto completo:', s);
      console.log(`\nSpearman ρ = ${r.rho == null ? 'n/d' : r.rho.toFixed(3)} sobre ${r.n} películas (umbral ${r.umbral}) → ${r.ok ? 'CALIBRADO' : 'NO CALIBRADO: revisar data/gusto.md antes de usar el panel como juez'}`);
      console.log(`pares: ${r.pares.filter((p) => p.ok).length}/${r.pares.length} en el orden humano`); for (const p of r.pares.filter((p) => !p.ok)) console.log(`  ✗ ${p.mayor} > ${p.menor} (${p.fuerza}) diferencia ${p.diff}  [${p.origen}]`);
      fs.writeFileSync(path.join(path.dirname(dir), 'calibracion-resultado.json'), JSON.stringify(r, null, 2) + '\n'); process.exit(r.ok ? 0 : 3);
    } else salir('uso: panel.mjs preparar | registrar | veredicto | prompt | preparar-calibracion | registrar-lote | calibrar   (--help)');
  } catch (e) { salir(e); }
}
