#!/usr/bin/env node
// Cámara automática = problema de optimización, no keyframes a ojo.
//   shot.cam = { move: 'auto', subject?: 'label', fill?: 0.18, anchor?: 'thirds'|'center', why?: 'follow' }
//   node engine/autocam.mjs [--timeline X]   → data/autocam/<timeline>.json  (hash por shot: se invalida sola)
// 1) Se renderiza el shot con cámara identidad y se miden los focos (o el `subject`) a 12 fps: centroide c_i y área a_i.
// 2) Objetivo por muestra: zoom z_i = √(fill·A_vis / a_i) acotado; traslación que lleva c_i al punto de poder P (elegido UNA vez:
//    el más cercano al centroide medio → no salta entre tercios).  Pantalla = F + z(c − F) + x  ⇒  x_i = P − F − z_i(c_i − F).
// 3) Suavizado: min_s ‖s − s*‖² + λ‖D₂s‖² ⇒ (I + λD₂ᵀD₂)s = s*  (sistema pentadiagonal, eliminación en banda O(n)).
// 4) λ mínimo que cumple los límites de velocidad del estilo (zoom/s, paneo/s): bisección en log λ (la velocidad pico es
//    monótona decreciente en λ). Es decir: la cámara más fiel al sujeto que NO marea.
import './help.mjs';
import { announceFilm } from './filmid.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, timelinePath } from './film.mjs';
import { makeRenderer } from './render.mjs';
import { shotHash } from './hash.mjs';
import { barHeight } from './grade.mjs';
import { filmId } from './filmid.mjs';
const acName = (tl) => (filmId(tl) === 'main' ? path.basename(tl) : filmId(tl) + '.json');
import { withLock, writeAtomic } from './lock.mjs';

// (I + λ DᵀD) s = b con D = segunda diferencia: matriz simétrica de banda 2. Eliminación gaussiana en banda.
export function smooth2(b, lam, w = null) {                                  // w: pesos por muestra (0 = dato ausente)
  const n = b.length; if (n < 3 || (lam <= 0 && !w)) return [...b];
  const A = Array.from({ length: n }, () => new Float64Array(5)), r = Float64Array.from(b);   // A[i][k] ↔ columna i+k−2
  for (let k = 0; k < n - 2; k++) { const c = [1, -2, 1]; for (let p = 0; p < 3; p++) for (let q = 0; q < 3; q++) A[k + p][q - p + 2] += lam * c[p] * c[q]; }
  for (let i = 0; i < n; i++) { const wi = w ? w[i] : 1; A[i][2] += wi + 1e-9; r[i] *= wi; }
  for (let i = 0; i < n; i++) for (let d = 1; d <= 2 && i + d < n; d++) { const f = A[i + d][2 - d] / A[i][2]; for (let k = 0; k <= 2; k++) if (2 - d + k <= 4) A[i + d][2 - d + k] -= f * A[i][2 + k]; r[i + d] -= f * r[i]; }
  const s = new Float64Array(n); for (let i = n - 1; i >= 0; i--) { let v = r[i]; for (let k = 1; k <= 2 && i + k < n; k++) v -= A[i][2 + k] * s[i + k]; s[i] = v / A[i][2]; }
  return [...s];
}
const peak = (xs, fps, rel) => { let m = 0; for (let i = 1; i < xs.length; i++) m = Math.max(m, Math.abs(xs[i] - xs[i - 1]) * fps / (rel ? xs[i - 1] : 1)); return m; };

async function main() {
  announceFilm();
                                                       // un horneado por timeline a la vez (salida única compartida)
  await withLock(`autocam/${acName(timelinePath())}`, bake, { ttlMs: 60000, waitMs: 1800000 });
}
async function bake() {
  const R = await makeRenderer({ size: '640x360', grade: false }), { film, W, H } = R, C = film.S.camera, fps = 12, out = {};
  const file = path.join(ROOT, 'data/autocam', acName(timelinePath())); fs.mkdirSync(path.dirname(file), { recursive: true });
  film.autocam = {};                                                          // identidad mientras se mide
  for (const s of film.shots.filter((x) => x.cam?.move === 'auto')) {
    const cam = s.cam, bar = barHeight(film) * (H / film.height), visH = H - 2 * bar, sc = film.width / W, raw = [], m = film.S.compose.edgeMargin ?? 0.04, PS = film.P.safe;
    for (let t = s.t[0]; t <= s.t[1] + 1e-9; t += 1 / fps) {
      const all = R.frame(Math.min(t, s.t[1] - 1e-4)).filter((b) => b.shot === s.id), f = all.filter((b) => b.kind === 'focus' && (cam.subject ? b.label === cam.subject : b.weight >= 0.5));
      const U = (bs) => bs.length ? [Math.min(...bs.map((b) => b.x)) * sc, Math.min(...bs.map((b) => b.y)) * sc, Math.max(...bs.map((b) => b.x + b.w)) * sc, Math.max(...bs.map((b) => b.y + b.h)) * sc] : null;
      const S0 = U(f), K = U(all.filter((b) => b.kind === 'text' || b.kind === 'focus' && b.weight >= 0.5));   // K: lo que DEBE seguir en cuadro
      const a = S0 ? (S0[2] - S0[0]) * (S0[3] - S0[1]) : 0;
      raw.push(S0 && a > 0.004 * film.width * film.height ? { cx: (S0[0] + S0[2]) / 2, cy: (S0[1] + S0[3]) / 2, a, K } : { K });
    }
    const valid = raw.filter((p) => p.cx != null); if (!valid.length) { console.log(`  ! ${s.id}: sin focos medibles; cámara identidad`); continue; }
    const wts = raw.map((p) => (p.cx != null ? 1 : 0)), pts = raw.map((p) => (p.cx != null ? p : { ...valid[0], K: p.K })), Wf = film.width, Hf = film.height, Fx = Wf / 2, Fy = Hf / 2, vis = Wf * visH * sc, top = bar * sc, bot = Hf - bar * sc;
    const mx = valid.reduce((a, p) => a + p.cx, 0) / valid.length, my = valid.reduce((a, p) => a + p.cy, 0) / valid.length;
    const cands = [[Fx, Fy], ...((cam.anchor ?? film.S.compose.anchor) === 'thirds' ? [[Wf / 3, Hf / 3], [2 * Wf / 3, Hf / 3], [Wf / 3, 2 * Hf / 3], [2 * Wf / 3, 2 * Hf / 3]] : [])];
    const [Px, Py] = cands.reduce((p, q) => (Math.hypot(q[0] - mx, q[1] - my) < Math.hypot(p[0] - mx, p[1] - my) ? q : p));
    const bx = [Wf * Math.max(m, PS.side), Wf * (1 - Math.max(m, PS.side))], by = [top + Hf * Math.max(m, PS.top), bot - Hf * Math.max(m, PS.bottom)];   // área segura del perfil
    // legibilidad: z ≤ lo que deja caber K con margen; x ∈ intervalo que mantiene K dentro (pantalla = F + z(k − F) + x)
    const zt = pts.map((p) => { let z = Math.min(cam.maxZoom ?? 1.5, Math.max(cam.minZoom ?? 0.9, Math.sqrt(((cam.fill ?? 0.18) * vis) / p.a)));
      if (p.K) z = Math.min(z, (bx[1] - bx[0]) / Math.max(1, p.K[2] - p.K[0]), (by[1] - by[0]) / Math.max(1, p.K[3] - p.K[1])); return Math.max(cam.minZoom ?? 0.9, z); });
    const clampK = (v, z, K, lo, hi, F, i0, i1) => (K ? Math.min(Math.max(v, lo - F - z * (K[i0] - F)), hi - F - z * (K[i1] - F)) : v);
    const xt = pts.map((p, i) => clampK(Px - Fx - zt[i] * (p.cx - Fx), zt[i], p.K, bx[0], bx[1], Fx, 0, 2)), yt = pts.map((p, i) => clampK(Py - Fy - zt[i] * (p.cy - Fy), zt[i], p.K, by[0], by[1], Fy, 1, 3));
    // proyección final sobre el conjunto factible (el suavizado puede salirse de él): z ≤ zmax_i y traslación en su intervalo
    const project = (S) => { const z = S.z.map((v, i) => Math.min(v, Math.max(zt[i], cam.minZoom ?? 0.9))); return { z, x: S.x.map((v, i) => clampK(v, z[i], pts[i].K, bx[0], bx[1], Fx, 0, 2)), y: S.y.map((v, i) => clampK(v, z[i], pts[i].K, by[0], by[1], Fy, 1, 3)) }; };
    const solve = (lam) => project({ z: smooth2(zt, lam, wts), x: smooth2(xt, lam, wts), y: smooth2(yt, lam, wts) });
    const ok = (S) => peak(S.z, fps, true) <= C.maxZoomPerSec * 0.95 && Math.max(peak(S.x, fps) / Wf, peak(S.y, fps) / Hf) <= C.maxPanPerSec * 0.95;
    let lo = -2, hi = 8, S = solve(10 ** hi);
    if (ok(solve(10 ** lo))) S = solve(10 ** lo); else for (let it = 0; it < 30; it++) { const mid = (lo + hi) / 2, Sm = solve(10 ** mid); if (ok(Sm)) { hi = mid; S = Sm; } else lo = mid; }
    // el objetivo arrastra la media del sujeto: si λ→∞ aún viola los límites (traslación constante grande), se atenúa hacia identidad
    let g = 1; while (!ok(S) && g > 0.05) { g *= 0.8; S = { z: S.z.map((v) => 1 + (v - 1) * g), x: S.x.map((v) => v * g), y: S.y.map((v) => v * g) }; }
    out[s.id] = { hash: shotHash(film, s.id), fps, lambda: +(10 ** hi).toPrecision(3), anchor: [Px / Wf, Py / Hf], samples: S.z.map((z, i) => [+(s.t[0] + i / fps).toFixed(4), +z.toFixed(4), +(S.x[i] / Wf).toFixed(5), +(S.y[i] / Hf).toFixed(5)]) };
    console.log(`  ✓ ${s.id}: λ=${out[s.id].lambda}  ancla (${(Px / Wf).toFixed(2)}, ${(Py / Hf).toFixed(2)})  zoom ${Math.min(...S.z).toFixed(2)}–${Math.max(...S.z).toFixed(2)} · ${wts.filter((w) => !w).length} muestras sin sujeto (peso 0)`);
  }
  writeAtomic(file, JSON.stringify(out));
  console.log('→', path.relative(ROOT, file));
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.stack); process.exit(1); });
