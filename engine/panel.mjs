#!/usr/bin/env node
// Panel de críticos (spec 022): tres miradas independientes (director, ojo, escéptico) puntúan un film con la rúbrica de data/gusto.md.
//   node engine/panel.mjs preparar <mp4> --out <dir> [--nombre X]   12 fotogramas, hoja, 6 recortes a 4×, 6 tiras de movimiento (8 fotogramas a 5 fps), audio (ebur128 + descriptor), fondo oscuro/plano y profundidad → paquete.md
//                                                                   (con --nombre el paquete es ANÓNIMO: sin ruta ni notas humanas)
//   node engine/panel.mjs registrar <dir> <mirada> <json|archivo>   valida {mirada, puntos:{criterio:0–10}, total, arreglos:[3]} y lo guarda
//   node engine/panel.mjs veredicto <dir>                           agrega: SHIP si media ≥ 8 y ninguna mirada < 6; si no FIX con los arreglos
//   node engine/panel.mjs prompt <mirada> (--paquete <dir> | --calibracion [--lote calibracion])   (el lote por defecto es calibracion2) imprime el prompt autocontenido del crítico (docs/current/PANEL*.md)
//   node engine/panel.mjs preparar-calibracion [--out <dir>]        paquetes ANÓNIMOS (A, B, …) de data/calibracion.json + mapa aparte
//   node engine/panel.mjs registrar-lote <dir-calibracion> <json>   registra los veredictos de un crítico sobre todos los paquetes
//   node engine/panel.mjs calibrar [--dir D] [--mapa M]             Spearman entre el total del panel y el nivel de las notas humanas
//   node engine/panel.mjs filtro <mp4> [--codigo <dir>] [--entrega <plan.md>] [--registro <json>]   FILTRO DE MÍNIMOS sin LLM (F1): fondo oscuro/plano sin profundidad, texto (si hay código: auditoría del kit-libre), audio (TP ≤ −1, I −20…−13), determinismo (con código); --entrega compara los rasgos de plan.md con data/entregas.json (veto ≥ 2 de 5 de las 3 últimas). PASA (0) / FALLA (3)
//   node engine/panel.mjs ab <mp4A> <mp4B> [--out lamina.jpg]       lámina comparativa ciega (hojas lado a lado + tira del momento clave de cada una) para elegir en 10 s; sin LLM
import './help.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, GUSTO, MIRADAS, MIRADA_NOMBRE, miradaKey, parseRubrica, reglasDeMirada, parseReglas, fmtRegla, BEGIN, END } from './gusto.mjs';

export const CAL = path.join(ROOT, 'data/calibracion.json');
export const NFRAMES = 12, NCROPS = 6, ZOOM = 4, NTIRAS = 6, TIRA_N = 8, TIRA_FPS = 5, MIN_VISTOS = 7, MIN_RECORTES = 4, MIN_TIRAS = 3;
/** Lote de calibración en curso (los lotes anteriores se conservan: `--lote calibracion`). */
export const LOTE = 'calibracion2';
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
  const vistos = Array.isArray(v.vistos) ? [...new Set(v.vistos.filter((x) => typeof x === 'string').map((x) => x.trim().replace(/^\.?\//, '')).filter(Boolean))] : null;
  if (!vistos) err.push('falta «vistos»: la lista de archivos que abriste (≥ 7: al menos 4 recortes y 3 tiras)');
  else {
    const rec = new Set(vistos.map((x) => x.match(/(?:^|\/)recortes\/(r\d+)\.\w+$/)?.[1]).filter(Boolean)), tir = new Set(vistos.map((x) => x.match(/(?:^|\/)tiras\/(t\d+)\.\w+$/)?.[1]).filter(Boolean));
    if (vistos.length < MIN_VISTOS) err.push(`«vistos» tiene ${vistos.length} archivos distintos; se exigen ≥ ${MIN_VISTOS}`);
    if (rec.size < MIN_RECORTES) err.push(`«vistos» incluye ${rec.size} recortes; se exigen ≥ ${MIN_RECORTES} (recortes/rN.png)`);
    if (tir.size < MIN_TIRAS) err.push(`«vistos» incluye ${tir.size} tiras; se exigen ≥ ${MIN_TIRAS} (tiras/tN.jpg)`);
  }
  return { ok: !err.length, errores: err, v: err.length ? null : { mirada: MIRADA_NOMBRE[k], puntos: p, total: v.total, arreglos: v.arreglos.map((a) => a.trim()), vistos } };
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

/** Archivos hermanos de una carpeta de lote: <lote>-mapa.json, <lote>-veredictos/, <lote>-resultado.json. */
export const hermanos = (dir) => { const b = path.basename(dir), d = path.dirname(dir); return { mapa: path.join(d, `${b}-mapa.json`), veredictos: path.join(d, `${b}-veredictos`), resultado: path.join(d, `${b}-resultado.json`) }; };

export function calibrar({ cal = JSON.parse(fs.readFileSync(CAL, 'utf8')), dir = path.join(panelOut(), LOTE), mapa = hermanos(dir).mapa } = {}) {
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

/** Descriptor de audio legible: curva de sonoridad por tramos (ASCII), golpes (ataques), silencios y presencia de cama/música. null si no hay pista. */
export function perfilAudio(mp4, dur) {
  let raw; try { raw = sh('ffmpeg', ['-v', 'error', '-i', mp4, '-vn', '-ac', '1', '-ar', '8000', '-f', 's16le', '-']); } catch { return null; }
  const n = Math.floor(raw.length / 2); if (n < 800) return null;
  const smp = new Int16Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + n * 2)), WN = 400, nf = Math.floor(n / WN), db = new Float64Array(nf), pk = new Float64Array(nf);   // ventanas de 50 ms
  for (let f = 0; f < nf; f++) { let e = 0, m = 0; for (let i = f * WN; i < (f + 1) * WN; i++) { const v = smp[i] / 32768; e += v * v; if (Math.abs(v) > m) m = Math.abs(v); } db[f] = Math.max(-80, 10 * Math.log10(e / WN + 1e-12)); pk[f] = 20 * Math.log10(m + 1e-6); }
  const dB = (x) => Math.round(x * 10) / 10, t50 = (f) => f * 0.05, total = nf * 0.05;
  const nT = Math.max(8, Math.min(30, Math.round(total / 3))), per = nf / nT, curva = [];
  for (let k = 0; k < nT; k++) { const a = Math.floor(k * per), b = Math.max(a + 1, Math.floor((k + 1) * per)); let e = 0; for (let f = a; f < b; f++) e += 10 ** (db[f] / 10); curva.push({ t0: t50(a), t1: t50(b), db: dB(10 * Math.log10(e / (b - a) + 1e-12)) }); }
  const bar = (x) => '█'.repeat(Math.max(0, Math.round(((Math.max(-60, Math.min(0, x)) + 60) / 60) * 32)));
  const mmss = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const ascii = curva.map((c) => `${mmss(c.t0)}–${mmss(c.t1)} ${String(c.db.toFixed(1)).padStart(6)} dB ${bar(c.db)}`);
  // golpes: ventana de 50 ms que sube ≥ 9 dB sobre la media de los 0,5 s previos y supera −40 dB; se funden los que están a < 0,3 s
  const golpes = [];
  for (let f = 10; f < nf; f++) { let b = 0; for (let j = f - 10; j < f; j++) b += 10 ** (db[j] / 10); b = Math.max(-70, 10 * Math.log10(b / 10 + 1e-12)); const sube = db[f] - b; if (sube >= 9 && db[f] > -40) { const u = golpes.at(-1); if (u && t50(f) - u.t < 0.3) { if (sube > u.sube) { u.sube = sube; u.t = t50(f); u.db = db[f]; } } else golpes.push({ t: t50(f), sube, db: db[f] }); } }
  const top = [...golpes].sort((a, b) => b.sube - a.sube).slice(0, 14).sort((a, b) => a.t - b.t).map((g) => ({ t: r1(g.t), sube_db: r1(g.sube), nivel_db: r1(g.db) }));
  const silencios = []; for (let f = 0, ini = -1; f <= nf; f++) { const mudo = f < nf && db[f] < -55; if (mudo && ini < 0) ini = f; if (!mudo && ini >= 0) { if ((f - ini) * 0.05 >= 0.5) silencios.push({ t0: r1(t50(ini)), dur: r1((f - ini) * 0.05) }); ini = -1; } }
  const activo = 100 * [...db].filter((x) => x > -45).length / nf, s1 = []; for (let k = 0; k + 20 <= nf; k += 20) { let e = 0; for (let f = k; f < k + 20; f++) e += 10 ** (db[f] / 10); s1.push(10 * Math.log10(e / 20 + 1e-12)); }
  const o1 = [...s1].sort((a, b) => a - b), p10 = o1[Math.floor(o1.length * 0.1)] ?? -99, mediana = o1[Math.floor(o1.length / 2)] ?? -99;
  const cama = activo >= 85 && p10 >= -42 ? 'sí: sonido continuo casi todo el metraje (música o cama sostenida)' : activo >= 60 ? 'parcial: hay sonido sostenido en parte del metraje, con huecos' : 'no: solo sonidos puntuales (efectos) con mucho silencio entre ellos';
  const w3 = 60; let mejor = -1e9, mi = 0; for (let f = 0; f + w3 <= nf; f += 10) { let e = 0; for (let j = f; j < f + w3; j++) e += 10 ** (db[j] / 10); const v = 10 * Math.log10(e / w3 + 1e-12); if (v > mejor) { mejor = v; mi = f; } }
  const tercio = (a, b) => { let e = 0; const x = Math.floor(a * nf), y = Math.max(x + 1, Math.floor(b * nf)); for (let f = x; f < y; f++) e += 10 ** (db[f] / 10); return dB(10 * Math.log10(e / (y - x) + 1e-12)); };
  return { dur: r1(total), curva, ascii, golpes: top, n_golpes: golpes.length, silencios, activo_pct: r1(activo), p10_1s_db: dB(p10), mediana_1s_db: dB(mediana), cama, maximo: { t: r1(t50(mi) + 1.5), pct: Math.round(100 * (t50(mi) + 1.5) / total), db: dB(mejor) }, tercios_db: [tercio(0, 1 / 3), tercio(1 / 3, 2 / 3), tercio(2 / 3, 1)] };
}

/** Muestrea el film a baja resolución (gris) y mide: fondo oscuro/plano, profundidad (espacial y temporal), cortes, actividad. */
export function analisisVisual(mp4, info) {
  const H = 180, W = Math.max(2, Math.round((H * info.w / info.h) / 2) * 2), fps = Math.min(4, Math.max(0.5, 600 / info.dur));
  const buf = sh('ffmpeg', ['-v', 'error', '-i', mp4, '-an', '-vf', `fps=${fps},scale=${W}:${H}:flags=area`, '-pix_fmt', 'gray', '-f', 'rawvideo', '-']), N = Math.floor(buf.length / (W * H));
  let vacios = 0, planos = 0, oscuros = 0; const dif = [], luma = [], esp = [], tex = [], luces = [];
  const mx = Math.round(W * 0.15), my = Math.round(H * 0.15), P = W * H, sum = new Float64Array(P), sum2 = new Float64Array(P);
  for (let f = 0; f < N; f++) {
    const o = f * P, px = buf.subarray(o, o + P), hist = new Uint32Array(256); let sm = 0, sm2 = 0, tx = 0;
    for (let i = 0; i < P; i++) { const v = px[i]; hist[v]++; sm += v; sm2 += v * v; sum[i] += v; sum2[i] += v * v; if (i % W < W - 1) tx += Math.abs(px[i + 1] - v); }
    let acc = 0, med = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= P / 2) { med = v; break; } }
    let cerca = 0; for (let v = Math.max(0, med - 6); v <= Math.min(255, med + 6); v++) cerca += hist[v];
    if (cerca / P >= 0.97) vacios++;
    const m = sm / P; luma.push(m); esp.push(Math.sqrt(Math.max(0, sm2 / P - m * m))); tex.push(tx / P);
    if (med < 70) { oscuros++; let br = 0; for (let v = Math.min(255, med + 40); v < 256; v++) br += hist[v]; luces.push(100 * br / P); }   // «estrellas»: píxeles claramente más claros que el fondo
    let n = 0, s1 = 0, s2 = 0, t = 0;                        // marco exterior: desviación y ruido entre vecinos
    for (let y = 0; y < H; y++) for (let x = 0; x < W - 1; x++) if (x < mx || x >= W - mx || y < my || y >= H - my) { const v = px[y * W + x]; n++; s1 += v; s2 += v * v; t += Math.abs(px[y * W + x + 1] - v); }
    const sd = Math.sqrt(Math.max(0, s2 / n - (s1 / n) ** 2));
    if (sd < 5 && t / n < 1.0) planos++;
    if (f > 0) { const p = buf.subarray(o - P, o); let d = 0; for (let i = 0; i < P; i += 3) d += Math.abs(px[i] - p[i]); dif.push(d / Math.ceil(P / 3)); }
  }
  let tsd = 0; if (N > 1) { for (let i = 0; i < P; i++) { const mm = sum[i] / N; tsd += Math.sqrt(Math.max(0, sum2[i] / N - mm * mm)); } tsd /= P; }
  const cortes = []; dif.forEach((d, i) => { if (d > 18) cortes.push((i + 1) / fps); });
  const lim = [0, ...cortes, info.dur], tramos = lim.slice(1).map((t, i) => t - lim[i]).filter((x) => x > 0), mt = mean(tramos);
  const cv = tramos.length > 1 ? Math.sqrt(mean(tramos.map((x) => (x - mt) ** 2))) / mt : null;
  const orden = [...dif].sort((a, b) => a - b), q = (p) => orden[Math.min(orden.length - 1, Math.floor(p * orden.length))] ?? 0;
  const dec = Array.from({ length: 10 }, (_, k) => { const a = dif.slice(Math.floor(k * dif.length / 10), Math.floor((k + 1) * dif.length / 10)); return a.length ? r1(mean(a)) : 0; });
  const oscuro_plano_pct = r1(100 * vacios / N), prof = profundidad({ esp: mean(esp), tex: mean(tex), temporal: tsd, luces: luces.length ? mean(luces) : 0, oscuros_pct: 100 * oscuros / N });
  return { muestras: N, oscuro_plano_pct, vacios_pct: oscuro_plano_pct, plano_pct: r1(100 * planos / N), profundidad: prof, cortes: cortes.length, tramos: tramos.length, cv_tramos: cv == null ? null : Math.round(cv * 100) / 100, actividad_por_decil: dec, p90_p10: r1(q(0.9) / Math.max(q(0.1), 0.05)),
    serie: { fps, dif, luma } };
}

/** Profundidad medida: varianza espacial (desviación del gris en el cuadro), textura (cambio entre vecinos), varianza temporal (desviación de cada píxel en el tiempo)
 *  y puntos de luz sobre fondo oscuro. nivel (solo si domina el fondo oscuro) = «alta» | «media» | «baja»: distingue un oscuro con estrellas o bruma de un negro vacío. */
export function profundidad({ esp, tex, temporal, luces, oscuros_pct }) {
  const puntos = (esp >= 28 ? 1 : esp >= 12 ? 0.5 : 0) + (tex >= 6 ? 1 : tex >= 2 ? 0.5 : 0) + (temporal >= 18 ? 1 : temporal >= 7 ? 0.5 : 0) + (luces >= 0.15 ? 1 : luces >= 0.03 ? 0.5 : 0);
  return { espacial: r1(esp), textura: r1(tex), temporal: r1(temporal), puntos_luz_pct: Math.round(luces * 100) / 100, oscuros_pct: r1(oscuros_pct), nivel: oscuros_pct < 50 ? 'n/a (fondo claro: mira la textura del soporte en los recortes)' : puntos >= 2.5 ? 'alta' : puntos >= 1.25 ? 'media' : 'baja' };
}

/** Elige 6 instantes: los 5 picos de actividad más separados y el giro (mayor cambio de luminancia hacia el 40–90 % del metraje). */
export function momentosTiras(serie, dur, n = 6) {
  const { fps, dif, luma } = serie, sep = Math.max(1.5, dur / 14), giroT = (() => {
    const a = Math.floor(0.4 * dur * fps), b = Math.min(luma.length - 2, Math.floor(0.9 * dur * fps)), w = Math.max(1, Math.round(fps));
    let best = -1, bt = 0.75 * dur; for (let i = Math.max(w, a); i <= b - w; i++) { const d = Math.abs(mean(luma.slice(i, i + w)) - mean(luma.slice(i - w, i))); if (d > best) { best = d; bt = i / fps; } }
    return bt;
  })();
  const out = [{ t: giroT, tipo: 'giro' }];
  const idx = dif.map((d, i) => [d, (i + 1) / fps]).sort((x, y) => y[0] - x[0]);
  for (const [, t] of idx) { if (out.length >= n) break; if (out.every((o) => Math.abs(o.t - t) >= sep)) out.push({ t, tipo: 'actividad' }); }
  for (let k = 1; out.length < n && k < 40; k++) { const t = (k / 40) * dur; if (out.every((o) => Math.abs(o.t - t) >= 0.5)) out.push({ t, tipo: 'reparto' }); }
  return out.sort((a, b) => a.t - b.t);
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

/** 6 tiras de movimiento: 8 fotogramas consecutivos a 5 fps alrededor del giro y de los picos de actividad (hoja 4×2 + cambio medio entre fotogramas). */
export async function tiras(mp4, info, out, momentos) {
  const { createCanvas, loadImage } = await lienzo(), tmp = path.join(out, '.tmp-tiras'), dir = path.join(out, 'tiras'), res = [];
  fs.mkdirSync(dir, { recursive: true }); fs.mkdirSync(tmp, { recursive: true });
  const cols = 4, rows = TIRA_N / cols, cw = 480, ch = Math.round(cw * info.h / info.w), LH = 18, paso = 1 / TIRA_FPS;
  for (const [n, m] of momentos.entries()) {
    const ini = Math.max(0, Math.min(m.t - (TIRA_N / 2) * paso, info.dur - TIRA_N * paso - 0.05)), pat = path.join(tmp, `t${n}_%02d.png`);
    sh('ffmpeg', ['-v', 'error', '-y', '-ss', ini.toFixed(3), '-i', mp4, '-vf', `fps=${TIRA_FPS}`, '-frames:v', String(TIRA_N), pat]);
    const files = fs.readdirSync(tmp).filter((f) => f.startsWith(`t${n}_`)).sort(), imgs = []; for (const f of files) imgs.push(await loadImage(path.join(tmp, f)));
    while (imgs.length && imgs.length < TIRA_N) imgs.push(imgs.at(-1));
    const hoja = createCanvas(cols * cw, rows * (ch + LH)), hx = hoja.getContext('2d'), deltas = [], gris = [];
    hx.fillStyle = '#111'; hx.fillRect(0, 0, hoja.width, hoja.height); hx.font = '12px monospace';
    imgs.forEach((im, i) => { const sc = createCanvas(64, Math.max(2, Math.round(64 * im.height / im.width))), sx = sc.getContext('2d'); sx.drawImage(im, 0, 0, sc.width, sc.height); const d = sx.getImageData(0, 0, sc.width, sc.height).data, g = new Float32Array(sc.width * sc.height); for (let p = 0; p < g.length; p++) g[p] = 0.299 * d[p * 4] + 0.587 * d[p * 4 + 1] + 0.114 * d[p * 4 + 2]; gris.push(g); deltas.push(i ? r1(mean(Array.from(g, (v, p) => Math.abs(v - gris[i - 1][p])))) : null); });
    imgs.forEach((im, i) => { const X = (i % cols) * cw, Y = Math.floor(i / cols) * (ch + LH); hx.drawImage(im, X, Y, cw, ch); hx.fillStyle = '#ddd'; hx.fillText(`${i + 1}/${TIRA_N}  ${(ini + i * paso).toFixed(1)}s${deltas[i] != null ? `  Δ${deltas[i]}` : ''}`, X + 4, Y + ch + 13); });
    const name = `t${n + 1}.jpg`; fs.writeFileSync(path.join(dir, name), hoja.toBuffer('image/jpeg', { quality: 0.85 }));
    res.push({ name, tipo: m.tipo, t: r1(m.t), desde: r1(ini), hasta: r1(ini + (TIRA_N - 1) * paso), deltas: deltas.slice(1) });
    for (const f of files) fs.rmSync(path.join(tmp, f));
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  return res;
}

// ───────────────────────── paquete ─────────────────────────
const FORMATO = (k) => `{"mirada":"${MIRADA_NOMBRE[k]}","puntos":{${Object.keys(parseRubrica(fs.readFileSync(GUSTO, 'utf8'))[k]).map((c) => `"${c}":0`).join(',')}},"total":0.0,"arreglos":["…","…","…"],"vistos":["<ruta relativa de CADA archivo que abriste con Read, p. ej. recortes/rN.png o tiras/tN.jpg; mínimo 7: ≥ 4 recortes y ≥ 3 tiras>"]}`;

export function textoPaquete({ nombre, info, audio, perfil, vis, img, mirada, anonimo, gustoMd, fuente }) {
  const rub = parseRubrica(gustoMd), ks = mirada ? [mirada] : MIRADAS, L = [], pr = vis.profundidad;
  L.push(`# Paquete de evaluación: ${nombre}`, '');
  L.push(mirada ? `Mirada asignada: **${MIRADA_NOMBRE[mirada]}**. Puntúa solo tus criterios.` : 'Paquete completo (las tres miradas).', '');
  L.push('## 1. Qué es', `- Duración ${r1(info.dur)} s · ${info.w}×${info.h} · ${info.fps} fps · ${r1(info.bytes / 1e6)} MB${fuente ? ` · fuente ${fuente}` : ''}.`, '- Estás viendo UNA película corta de animación de motion graphics. No la has visto ni oído en movimiento: la juzgas por estas imágenes, tiras de movimiento y medidas. El usuario final juzga sobre todo el MOVIMIENTO y el SONIDO: las tiras (sección 2) y el descriptor de audio (sección 3) son tu evidencia principal, más que la hoja de contacto.', '');
  L.push('## 2. Imágenes (ábrelas con Read, una a una)', '- `hoja.jpg`: hoja de contacto con 12 fotogramas repartidos por todo el metraje (4 columnas × 3 filas, en orden temporal). Solo da una idea general; una hoja estática NO basta para juzgar movimiento ni materia.',
    `- \`frames/f01.jpg\` … \`frames/f12.jpg\`: los mismos 12 fotogramas, más grandes. Tiempos: ${img.frames.map((f) => `${f.name.slice(0, 3)}=${f.t.toFixed(1)}s`).join(' ')}.`,
    `- \`recortes/r1.png\` … \`recortes/r${NCROPS}.png\`: ${NCROPS} recortes ampliados ${ZOOM}× de las zonas con más detalle o texto (para juzgar la materia y la tipografía a 1×):`, ...img.recortes.map((r) => `  - \`recortes/${r.name}\`: de ${r.frame} (${r.t.toFixed(1)} s), zona ${r.zona}.`),
    `- \`tiras/t1.jpg\` … \`tiras/t${img.tiras.length}.jpg\`: ${img.tiras.length} tiras de movimiento, cada una de ${TIRA_N} fotogramas CONSECUTIVOS a ${TIRA_FPS} fps (paso de ${r1(1 / TIRA_FPS)} s, 4 columnas × 2 filas, en orden de lectura). Cada fotograma lleva su tiempo y «Δ» = cambio medio respecto al anterior (0 = quieto; saltos grandes y bruscos = corte; valores que crecen y decrecen = easing). Sirven para juzgar easing, peso, transiciones y si algo entra todo a la vez:`,
    ...img.tiras.map((t) => `  - \`tiras/${t.name}\`: ${t.tipo === 'giro' ? 'EL GIRO (mayor cambio de luz hacia el 40–90 %)' : 'uno de los momentos de mayor actividad'}, de ${t.desde.toFixed(1)} s a ${t.hasta.toFixed(1)} s. Δ entre fotogramas: ${t.deltas.join(' · ')}.`), '');
  L.push('## 3. Mediciones automáticas');
  L.push(audio ? `- Audio (ebur128 sobre el mp4): ${audio.I} LUFS integrado · LRA ${audio.LRA} LU · true peak ${audio.TP} dBFS. (Objetivo del estudio: −19…−16 LUFS, TP ≤ −1; el filtro de mínimos admite −20…−13.)` : '- Audio: **el archivo no tiene pista de audio medible** (película muda o sin sonido).');
  L.push(`- Fondo oscuro/plano (≥ 97 % del cuadro de un mismo tono): **${vis.oscuro_plano_pct} %** de ${vis.muestras} muestras. NO es un defecto por sí mismo: un cosmos o una noche elegidos por el tema son válidos. Lo que importa es la profundidad de abajo.`,
    `- Profundidad medida (fondos oscuros): **${pr.nivel}** · varianza espacial (desviación del gris en el cuadro) ${pr.espacial} · textura (cambio entre píxeles vecinos) ${pr.textura} · varianza temporal (desviación de cada píxel a lo largo del film) ${pr.temporal} · puntos de luz sobre fondo oscuro ${pr.puntos_luz_pct} % · muestras con fondo oscuro ${pr.oscuros_pct} %. (Un oscuro con estrellas, bruma o parallax sale «media» o «alta»; un negro vacío sale «baja».)`,
    `- Fotogramas con fondo plano (marco exterior sin textura ni degradado): **${vis.plano_pct} %**.`,
    `- Cortes duros detectados: ${vis.cortes} (${vis.tramos} tramos; coeficiente de variación de su duración: ${vis.cv_tramos ?? 'n/d'}; el estudio pide ≥ 0,3). Los fundidos no cuentan como corte.`,
    `- Actividad visual (cambio medio entre muestras) en 10 tramos iguales del metraje: ${vis.actividad_por_decil.join(' · ')}. Relación p90/p10: ${vis.p90_p10} (el estudio pide ≥ 4).`, '');
  L.push('### Descriptor de audio (lo que no puedes oír)');
  if (!perfil) L.push('- Sin pista de audio: no hay música, ni golpes, ni arco sonoro. Es una película muda.', '');
  else L.push(`- Música o cama sostenida: **${perfil.cama}** (sonido activo ${perfil.activo_pct} % del tiempo; nivel mediano por segundo ${perfil.mediana_1s_db} dB, el 10 % más bajo ${perfil.p10_1s_db} dB).`,
    `- Sonoridad media por tercios del metraje (dB): ${perfil.tercios_db.join(' → ')}. Máximo de sonoridad (ventana de 3 s) hacia ${perfil.maximo.t.toFixed(1)} s (${perfil.maximo.pct} % del metraje; ${perfil.maximo.db} dB).`,
    `- Golpes o ataques detectados: ${perfil.n_golpes}${perfil.golpes.length ? '. Los más fuertes (segundo: subida sobre el instante previo, en dB): ' + perfil.golpes.map((g) => `${g.t}s +${g.sube_db}`).join(' · ') : ''}.`,
    `- Silencios (≥ 0,5 s por debajo de −55 dB): ${perfil.silencios.length ? perfil.silencios.map((x) => `${x.t0}s (${x.dur}s)`).join(' · ') : 'ninguno'}.`,
    '- Curva de sonoridad por tramos (más barra = más fuerte; escala −60…0 dB):', '```', ...perfil.ascii, '```', '');
  L.push('## 4. Reglas del perfil de gusto que aplican a tu mirada', '(Cada regla es algo observable. Cítalas por su id cuando justifiques un punto.)', '');
  for (const k of ks) { L.push(`### ${MIRADA_NOMBRE[k]}`, ...reglasDeMirada(gustoMd, k).map(fmtRegla), ''); }
  if (!anonimo) { const a = gustoMd.indexOf(BEGIN), b = gustoMd.indexOf(END); if (a >= 0 && b > a) L.push('## 5. Notas humanas previas (contexto)', gustoMd.slice(a + BEGIN.length, b).trim(), ''); }
  L.push('## 6. Rúbrica (0–10) y formato de respuesta', 'Anclas: 0 = ausente o roto; 5 = correcto pero olvidable; 8 = bueno, se defiende ante un profesional; 10 = asombroso. Usa todo el rango: un 8 es raro y un 10 casi nunca.', '');
  for (const k of ks) { L.push(`### ${MIRADA_NOMBRE[k]}`, ...Object.entries(rub[k]).map(([c, d]) => `- **${c}**: ${d}`), '', 'Responde con ESTE JSON (y nada más fuera de él):', '```json', FORMATO(k), '```', `\`total\` es la media de tus puntos (1 decimal). \`arreglos\`: exactamente 3, concretos y accionables (qué escena o recurso, qué cambiar y cómo se vería arreglado). \`vistos\`: la lista REAL de archivos que abriste con Read, relativos a la carpeta (como «recortes/r2.png»): mínimo ${MIN_VISTOS}, de ellos al menos ${MIN_RECORTES} recortes y ${MIN_TIRAS} tiras. Un veredicto con menos se rechaza.`, ''); }
  return L.join('\n');
}

export async function preparar(mp4, out, { nombre = null } = {}) {
  if (!fs.existsSync(mp4)) throw new Error(`no existe ${mp4}`);
  fs.mkdirSync(out, { recursive: true });
  const info = sonda(mp4), anonimo = !!nombre, nom = nombre ?? path.basename(mp4, path.extname(mp4));
  const img = await imagenes(mp4, info, out), audio = info.audio ? medirAudio(mp4) : null, perfil = info.audio ? perfilAudio(mp4, info.dur) : null, visFull = analisisVisual(mp4, info), { serie, ...vis } = visFull;
  img.tiras = await tiras(mp4, info, out, momentosTiras(serie, info.dur, NTIRAS));
  const gustoMd = fs.readFileSync(GUSTO, 'utf8'), base = { nombre: anonimo ? `película ${nom}` : nom, info, audio, perfil, vis, img, anonimo, gustoMd, fuente: anonimo ? null : mp4 };
  fs.writeFileSync(path.join(out, 'paquete.md'), textoPaquete({ ...base, mirada: null }));
  for (const k of MIRADAS) fs.writeFileSync(path.join(out, `paquete.${k}.md`), textoPaquete({ ...base, mirada: k }));
  fs.writeFileSync(path.join(out, 'medidas.json'), JSON.stringify({ info: { dur: info.dur, w: info.w, h: info.h, fps: info.fps, audio: info.audio }, audio, perfil_audio: perfil ? { ...perfil, ascii: undefined } : null, vis, recortes: img.recortes, tiras: img.tiras }, null, 2) + '\n');
  return { out, info, audio, perfil, vis, recortes: img.recortes.length, tiras: img.tiras.length, frames: img.frames.length };
}

export async function prepararCalibracion({ cal = JSON.parse(fs.readFileSync(CAL, 'utf8')), out = path.join(panelOut(), LOTE), mapa = hermanos(out).mapa, semilla = cal.semillas?.[path.basename(out)] ?? cal.semilla ?? 1, log = console.log } = {}) {
  const ent = entregasDir(), map = anonimizar(cal.peliculas.map((p) => p.clave), semilla), mp4 = Object.fromEntries(cal.peliculas.map((p) => [p.clave, path.join(ent, p.mp4)]));
  const falta = Object.values(mp4).filter((f) => !fs.existsSync(f)); if (falta.length) throw new Error('faltan mp4: ' + falta.join(', '));
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  for (const [letra, clave] of Object.entries(map)) { const r = await preparar(mp4[clave], path.join(out, letra), { nombre: letra }); log(`  ${letra}  ${r.info.dur.toFixed(0)} s  oscuro/plano ${r.vis.oscuro_plano_pct} %  profundidad ${r.vis.profundidad.nivel}  tiras ${r.tiras}  audio ${r.audio ? r.audio.I + ' LUFS' : 'no'}`); }
  fs.writeFileSync(mapa, JSON.stringify(map, null, 2) + '\n'); fs.mkdirSync(hermanos(out).veredictos, { recursive: true });
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

export function prompt(mirada, { paquete = null, calibracion = false, dir = path.join(panelOut(), LOTE), salida = null } = {}) {
  const k = miradaKey(mirada); if (!k) throw new Error(`mirada inválida «${mirada}»`);
  const base = { MIRADA: MIRADA_NOMBRE[k], MIRADA_KEY: k, ENFOQUE: plantilla('docs/current/PANEL.md', `enfoque-${k}`) };
  if (calibracion) {
    const letras = fs.readdirSync(dir).filter((d) => fs.statSync(path.join(dir, d)).isDirectory()).sort(), out = salida ?? path.join(hermanos(dir).veredictos, `${k}.json`);
    return rellenar(plantilla('docs/current/PANEL-CALIBRACION.md', 'calibracion'), { ...base, DIR: dir, LETRAS: letras.join(', '), N: String(letras.length), SALIDA: out, FORMATO: FORMATO(k).replace('{"mirada"', '{"paquete":"A","mirada"') });
  }
  if (!paquete) throw new Error('falta --paquete <dir> (o --calibracion)');
  return rellenar(plantilla('docs/current/PANEL.md', 'comun'), { ...base, PAQUETE: path.resolve(paquete), SALIDA: salida ?? path.join(path.resolve(paquete), 'veredictos', `${k}.json`), FORMATO: FORMATO(k) });
}

// ───────────────────────── filtro de mínimos (F1, sin LLM) ─────────────────────────
// El panel de 3 críticos queda como herramienta opcional: la meta ρ ≥ 0,7 se abandonó (docs/current/PANEL.md). El juez es este filtro + la lámina A/B.
export const AUDIO_I = [-20, -13], AUDIO_TP = -1, REPITE_MAX = 2, ULTIMAS = 3, RASGOS = ['paleta', 'medio', 'tipografia', 'sonido', 'estructura'];
const sinTilde = (x) => String(x).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Rasgos declarados en plan.md: líneas «paleta: …», «- **medio:** …», etc. (los 5 de MODO-LIBRE §0b). */
export function rasgosDePlan(txt) {
  const o = {};
  for (const l of txt.split('\n')) { const m = sinTilde(l.replace(/[*`_]/g, '')).match(/^\s*(?:[-•]\s+)?(paleta|medio|tipografia|sonido|estructura)\s*:\s*(.+?)\s*$/); if (m && !(m[1] in o)) o[m[1]] = m[2]; }
  return o;
}
const fichas = (t) => new Set(sinTilde(t).split(/[^a-z0-9]+/).filter((w) => w.length >= 3));
/** Dos descripciones del mismo rasgo «se repiten» si comparten ≥ 60 % de las palabras de la más corta. */
export function seRepite(a, b) {
  const A = fichas(a), B = fichas(b); if (!A.size || !B.size) return false;
  let c = 0; for (const w of A) if (B.has(w)) c++;
  return c / Math.min(A.size, B.size) >= 0.6;
}
/** Veto de repetición: rechaza si la entrega repite ≥ 2 de los 5 rasgos de alguna de las 3 últimas del registro. */
export function vetoRepeticion(rasgos, registro) {
  const faltan = RASGOS.filter((k) => !rasgos[k]);
  if (faltan.length) return { estado: 'FALLA', msg: `plan.md no declara ${faltan.length === 5 ? 'ningún rasgo' : 'los rasgos'}: ${faltan.join(', ')} (pliego de sorpresa, MODO-LIBRE §0b)`, detalle: [] };
  const ult = (registro.entregas ?? []).slice(-ULTIMAS), detalle = ult.map((e) => ({ film: e.film, iguales: RASGOS.filter((k) => e[k] && seRepite(rasgos[k], e[k])) }));
  const malas = detalle.filter((d) => d.iguales.length >= REPITE_MAX);
  return malas.length ? { estado: 'FALLA', msg: `repite ≥ ${REPITE_MAX} de 5 rasgos de ${malas.map((d) => `${d.film} (${d.iguales.join(', ')})`).join('; ')}`, detalle } : { estado: 'OK', msg: `no repite ≥ ${REPITE_MAX} de 5 rasgos de las ${ult.length} últimas entregas (máx. ${Math.max(0, ...detalle.map((d) => d.iguales.length))})`, detalle };
}

/** Auditoría del kit-libre sobre un proyecto (texto, contraste, cuadro vacío, determinismo). */
export function auditarProyecto(dir) {
  const kit = path.join(ROOT, 'kit-libre/kit/auditoria.mjs');
  if (!fs.existsSync(kit)) return { ejecutada: false, error: 'falta kit-libre/kit/auditoria.mjs' };
  const r = spawnSync(process.execPath, [kit, path.resolve(dir)], { encoding: 'utf8', maxBuffer: 1 << 28, cwd: ROOT }), txt = r.stdout ?? '';
  if ((r.status !== 0 && r.status !== 1) || !/RESUMEN:/.test(txt)) return { ejecutada: false, error: ((r.stderr ?? '').trim().split('\n').slice(-2).join(' ') || `la auditoría terminó con estado ${r.status}`).slice(0, 300) };
  const graves = txt.split('\n').filter((l) => /^\s+! /.test(l)).map((l) => l.replace(/^\s+! /, '').trim());
  return { ejecutada: true, graves, texto: graves.filter((g) => /: (texto|contraste): /.test(g)), determinismo: graves.filter((g) => /^determinismo/.test(g)), otros: graves.filter((g) => !/: (texto|contraste): /.test(g) && !/^determinismo/.test(g)) };
}

/** Filtro de mínimos (todo medido, sin LLM). Devuelve {estado:'PASA'|'FALLA', checks:[{id,estado,msg}], motivos}. */
export function filtro(mp4, { codigo = null, plan = null, registro = path.join(ROOT, 'data/entregas.json') } = {}) {
  const checks = [], add = (id, estado, msg) => checks.push({ id, estado, msg });
  let medidas = null;
  if (mp4) {
    if (!fs.existsSync(mp4)) throw new Error(`no existe ${mp4}`);
    const info = sonda(mp4), { serie, ...vis } = analisisVisual(mp4, info), pr = vis.profundidad;
    medidas = { dur: info.dur, w: info.w, h: info.h, oscuro_plano_pct: vis.oscuro_plano_pct, plano_pct: vis.plano_pct, profundidad: pr.nivel };
    // 1. fondo oscuro/plano con profundidad baja (un oscuro con estrellas, bruma o movimiento es válido: spec 022 C12)
    if (pr.nivel === 'baja' && vis.oscuro_plano_pct >= 30) add('fondo', 'FALLA', `${vis.oscuro_plano_pct} % de cuadros de fondo oscuro/plano con profundidad baja (espacial ${pr.espacial}, textura ${pr.textura}, temporal ${pr.temporal})`);
    else if (vis.oscuro_plano_pct >= 60) add('fondo', 'FALLA', `${vis.oscuro_plano_pct} % de cuadros casi de un solo tono`);
    else add('fondo', 'OK', `fondo oscuro/plano ${vis.oscuro_plano_pct} %, profundidad ${String(pr.nivel).split(' ')[0]}`);
    if (vis.plano_pct >= 60) add('marco', 'AVISO', `${vis.plano_pct} % de cuadros con el marco exterior sin textura ni degradado`);
    // 2. audio
    if (!info.audio) add('audio', 'FALLA', 'el mp4 no tiene pista de audio');
    else {
      const a = medirAudio(mp4); medidas.audio = a;
      if (!a) add('audio', 'FALLA', 'no se pudo medir el audio (ebur128)');
      else {
        const mal = [a.TP != null && a.TP > AUDIO_TP ? `true peak ${a.TP} dBFS > ${AUDIO_TP}` : null, a.I < AUDIO_I[0] || a.I > AUDIO_I[1] ? `sonoridad ${a.I} LUFS fuera de ${AUDIO_I[0]}…${AUDIO_I[1]}` : null].filter(Boolean);
        add('audio', mal.length ? 'FALLA' : 'OK', mal.length ? mal.join('; ') : `${a.I} LUFS, true peak ${a.TP} dBFS`);
      }
    }
  }
  // 3. texto y determinismo (solo con código: auditoría del kit-libre)
  if (codigo) {
    const au = auditarProyecto(codigo);
    if (!au.ejecutada) add('auditoria', 'FALLA', `no se pudo auditar ${codigo}: ${au.error}`);
    else {
      add('texto', au.texto.length ? 'FALLA' : 'OK', au.texto.length ? `texto ilegible o desbordado: ${au.texto.slice(0, 3).join(' | ')}${au.texto.length > 3 ? ` (+${au.texto.length - 3})` : ''}` : 'sin texto desbordado, tapado ni de bajo contraste');
      add('determinismo', au.determinismo.length ? 'FALLA' : 'OK', au.determinismo.length ? au.determinismo[0] : 'mismo md5 al renderizar dos veces');
      if (au.otros.length) add('auditoria', 'FALLA', `${au.otros.length} fallos graves de la auditoría: ${au.otros.slice(0, 3).join(' | ')}`);
    }
  } else if (mp4) { add('texto', 'N/A', 'sin --codigo no hay cajas de texto que auditar'); add('determinismo', 'N/A', 'sin --codigo no se puede comprobar'); }
  // 4. veto de repetición contra el registro de entregas (modo --entrega)
  if (plan) {
    if (!fs.existsSync(plan)) throw new Error(`no existe ${plan}`);
    if (!fs.existsSync(registro)) add('repeticion', 'AVISO', `no hay registro de entregas (${registro}): sin veto`);
    else { const v = vetoRepeticion(rasgosDePlan(fs.readFileSync(plan, 'utf8')), JSON.parse(fs.readFileSync(registro, 'utf8'))); add('repeticion', v.estado, v.msg); }
  }
  if (!checks.length) throw new Error('nada que filtrar: pasa un <mp4> y/o --entrega <plan.md>');
  const motivos = checks.filter((c) => c.estado === 'FALLA').map((c) => `${c.id}: ${c.msg}`);
  return { estado: motivos.length ? 'FALLA' : 'PASA', checks, motivos, medidas };
}

// ───────────────────────── lámina A/B ─────────────────────────
const COLW = 960;
/** Hoja 4×3 y tira de 8 fotogramas (5 fps) del momento clave («giro»), una llamada de ffmpeg cada una. */
function laminaDe(mp4, tmp, tag) {
  const info = sonda(mp4), { serie } = analisisVisual(mp4, info), clave = momentosTiras(serie, info.dur, 1)[0].t, cw = COLW / 4;
  const hoja = path.join(tmp, `${tag}-hoja.jpg`), tira = path.join(tmp, `${tag}-tira.jpg`), paso = 1 / TIRA_FPS, ini = Math.max(0, Math.min(clave - (TIRA_N / 2) * paso, info.dur - TIRA_N * paso - 0.05));
  sh('ffmpeg', ['-v', 'error', '-y', '-ss', (info.dur / 24).toFixed(3), '-i', mp4, '-vf', `fps=${(NFRAMES / info.dur).toFixed(5)},scale=${cw}:-2,tile=4x3:padding=2:color=0x111111`, '-frames:v', '1', hoja]);
  sh('ffmpeg', ['-v', 'error', '-y', '-ss', ini.toFixed(3), '-i', mp4, '-vf', `fps=${TIRA_FPS},scale=${cw}:-2,tile=4x2:padding=2:color=0x111111`, '-frames:v', '1', tira]);
  return { info, clave, hoja, tira };
}
/** Lámina comparativa A|B (hojas arriba, tira del momento clave debajo). Ciega: la imagen solo dice A y B. */
export async function ab(mpA, mpB, out = path.join(panelOut(), 'ab.jpg')) {
  for (const f of [mpA, mpB]) if (!fs.existsSync(f)) throw new Error(`no existe ${f}`);
  const { createCanvas, loadImage } = await lienzo(), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opus-ab-'));
  try {
    const L = [laminaDe(mpA, tmp, 'a'), laminaDe(mpB, tmp, 'b')], img = [];
    for (const l of L) img.push({ hoja: await loadImage(l.hoja), tira: await loadImage(l.tira) });
    const M = 12, TH = 34, hH = Math.max(...img.map((i) => i.hoja.height)), tH = Math.max(...img.map((i) => i.tira.height)), W = 2 * COLW + 3 * M, H = TH + hH + 24 + tH + 2 * M;
    const c = createCanvas(W, H), x = c.getContext('2d'); x.fillStyle = '#0b0b0b'; x.fillRect(0, 0, W, H);
    L.forEach((l, i) => {
      const X = M + i * (COLW + M); x.fillStyle = '#fff'; x.font = 'bold 26px sans-serif'; x.fillText('AB'[i], X, 27);
      x.font = '14px monospace'; x.fillStyle = '#aaa'; x.fillText(`${l.info.dur.toFixed(0)} s · ${l.info.w}×${l.info.h}`, X + 40, 26);
      x.drawImage(img[i].hoja, X, TH); x.fillText(`momento clave ≈ ${l.clave.toFixed(1)} s (8 fotogramas a ${TIRA_FPS} fps)`, X, TH + hH + 18);
      x.drawImage(img[i].tira, X, TH + hH + 24);
    });
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(out, c.toBuffer('image/jpeg', { quality: 0.88 }));
    return { out, w: W, h: H, claves: L.map((l) => +l.clave.toFixed(2)), durs: L.map((l) => l.info.dur) };
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
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
      console.log(`paquete en ${r.out}: ${r.frames} fotogramas, hoja, ${r.recortes} recortes, ${r.tiras} tiras · audio ${r.audio ? `${r.audio.I} LUFS LRA ${r.audio.LRA} TP ${r.audio.TP}` : 'no'} · fondo oscuro/plano ${r.vis.oscuro_plano_pct} % (profundidad ${r.vis.profundidad.nivel}) · fondo plano ${r.vis.plano_pct} %`);
    } else if (cmd === 'registrar') {
      if (pos.length < 3) salir('uso: panel.mjs registrar <dir> <mirada> <json|archivo>');
      const v = registrar(pos[0], pos[1], pos[2]); console.log(`registrado ${v.mirada}: total ${v.total}`);
    } else if (cmd === 'veredicto') {
      const r = veredicto(pos[0] ?? salir('uso: panel.mjs veredicto <dir>')); console.log(`${r.estado}${r.media != null ? ` · media ${r.media}` : ''} · ${r.motivo}`); if (r.arreglos?.length) for (const a of r.arreglos) console.log(`  - [${a.mirada}] ${a.texto}`);
      process.exit(r.estado === 'SHIP' ? 0 : r.estado === 'FIX' ? 3 : 2);
    } else if (cmd === 'prompt') {
      console.log(prompt(pos[0] ?? salir('uso: panel.mjs prompt <mirada> (--paquete <dir> | --calibracion)'), { paquete: flag('--paquete', null), calibracion: argv.includes('--calibracion'), dir: flag('--dir', undefined) ?? path.join(panelOut(), flag('--lote', LOTE)) }));
    } else if (cmd === 'preparar-calibracion') {
      const r = await prepararCalibracion({ out: path.resolve(flag('--out', undefined) ?? path.join(panelOut(), flag('--lote', LOTE))) }); console.log(`${r.letras.length} paquetes anónimos en ${r.out}\nmapa (NO lo lea el crítico): ${r.mapa}`);
    } else if (cmd === 'registrar-lote') {
      const r = registrarLote(pos[0], pos[1]); console.log(`registrados ${r.ok.length}`); if (r.mal.length) { console.error('rechazados:\n- ' + r.mal.join('\n- ')); process.exit(1); }
    } else if (cmd === 'calibrar') {
      const dir = path.resolve(flag('--dir', undefined) ?? path.join(panelOut(), flag('--lote', LOTE))), hm = hermanos(dir), vd = hm.veredictos;
      if (!argv.includes('--no-lote') && fs.existsSync(vd)) for (const f of fs.readdirSync(vd).filter((x) => x.endsWith('.json'))) { const r = registrarLote(dir, path.join(vd, f)); console.log(`lote ${f}: ${r.ok.length} registrados${r.mal.length ? ', rechazados:\n- ' + r.mal.join('\n- ') : ''}`); }
      const r = calibrar({ dir, mapa: flag('--mapa', hm.mapa) });
      console.log(`\n${'película'.padEnd(18)} nivel  panel  dir/ojo/esc   estado`);
      for (const f of r.filas) console.log(`${f.clave.padEnd(18)} ${String(f.nivel).padStart(4)}  ${r1(f.media).toFixed(1).padStart(5)}  ${MIRADAS.map((m) => String(f.totales[m]).padStart(4)).join('/')}   ${f.estado}`);
      for (const s of r.sin_veredicto) console.log('sin veredicto completo:', s);
      console.log(`\nSpearman ρ = ${r.rho == null ? 'n/d' : r.rho.toFixed(3)} sobre ${r.n} películas (umbral ${r.umbral}) → ${r.ok ? 'CALIBRADO' : 'NO CALIBRADO: revisar data/gusto.md antes de usar el panel como juez'}`);
      console.log(`pares: ${r.pares.filter((p) => p.ok).length}/${r.pares.length} en el orden humano`); for (const p of r.pares.filter((p) => !p.ok)) console.log(`  ✗ ${p.mayor} > ${p.menor} (${p.fuerza}) diferencia ${p.diff}  [${p.origen}]`);
      fs.writeFileSync(hm.resultado, JSON.stringify(r, null, 2) + '\n'); process.exit(r.ok ? 0 : 3);
    } else if (cmd === 'filtro') {
      const r = filtro(pos[0] ? path.resolve(pos[0]) : null, { codigo: flag('--codigo', null), plan: flag('--entrega', null), registro: flag('--registro', undefined) });
      for (const c of r.checks) console.log(`  [${c.estado.padEnd(5)}] ${c.id.padEnd(12)} ${c.msg}`);
      console.log(`${r.estado}${r.motivos.length ? ' · ' + r.motivos.length + ' motivo(s)' : ''}`); process.exit(r.estado === 'PASA' ? 0 : 3);
    } else if (cmd === 'ab') {
      if (pos.length < 2) salir('uso: panel.mjs ab <mp4A> <mp4B> [--out lamina.jpg]');
      const r = await ab(path.resolve(pos[0]), path.resolve(pos[1]), path.resolve(flag('--out', path.join(panelOut(), 'ab.jpg')))); console.log(`lámina A|B en ${r.out} (${r.w}×${r.h}); A = ${pos[0]}, B = ${pos[1]}`);
    } else salir('uso: panel.mjs preparar | filtro | ab | registrar | veredicto | prompt | preparar-calibracion | registrar-lote | calibrar   (--help)');
  } catch (e) { salir(e); }
}
