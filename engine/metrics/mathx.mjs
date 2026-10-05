// Matemática de las métricas: estadística, curvas funcionales y distancias. Puro, determinista (sin Math.random).
import { rng } from '../core.mjs';
export const sum = (a) => a.reduce((p, q) => p + q, 0);
export const mean = (a) => (a.length ? sum(a) / a.length : NaN);
export const variance = (a) => { if (a.length < 2) return 0; const m = mean(a); return sum(a.map((x) => (x - m) ** 2)) / (a.length - 1); };
export const std = (a) => Math.sqrt(variance(a));
export function quantile(a, p) {                       // tipo 7 (interpolación lineal, R/NumPy por defecto)
  if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y), h = (s.length - 1) * p, i = Math.floor(h);
  return s[i] + (s[Math.min(i + 1, s.length - 1)] - s[i]) * (h - i);
}
export const median = (a) => quantile(a, 0.5);
export const mad = (a) => { const m = median(a); return median(a.map((x) => Math.abs(x - m))); };
export function skewness(a) { const n = a.length; if (n < 3) return 0; const m = mean(a), s = Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / n); return s < 1e-12 ? 0 : sum(a.map((x) => ((x - m) / s) ** 3)) / n; }
export const pearson = (x, y) => { const mx = mean(x), my = mean(y); let a = 0, b = 0, c = 0; for (let i = 0; i < x.length; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) ** 2; c += (y[i] - my) ** 2; } return b * c < 1e-24 ? 0 : a / Math.sqrt(b * c); };
const rank = (a) => { const o = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]), r = new Array(a.length); for (let i = 0; i < o.length;) { let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++; for (let k = i; k <= j; k++) r[o[k][1]] = (i + j) / 2 + 1; i = j + 1; } return r; };
export const spearman = (x, y) => pearson(rank(x), rank(y));
// Intervalo bootstrap percentil (Efron 1979), semilla fija ⇒ reproducible.
export function bootstrapCI(vals, stat = mean, { B = 400, level = 0.95, seed = 7 } = {}) {
  if (vals.length < 2) return null; const r = rng(seed), est = [];
  for (let b = 0; b < B; b++) { const s = []; for (let i = 0; i < vals.length; i++) s.push(vals[Math.floor(r() * vals.length)]); est.push(stat(s)); }
  return [quantile(est, (1 - level) / 2), quantile(est, 1 - (1 - level) / 2)];
}
// Intervalo de Wilson (1927) para una proporción k/n.
export function wilson(k, n, z = 1.96) { if (!n) return null; const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [Math.max(0, (c - h) / d), Math.min(1, (c + h) / d)]; }
// Intervalo de Poisson (aproximación de Byar) para un recuento k.
export function poissonCI(k, z = 1.96) { const lo = k === 0 ? 0 : k * (1 - 1 / (9 * k) - z / (3 * Math.sqrt(k))) ** 3, k1 = k + 1, hi = k1 * (1 - 1 / (9 * k1) + z / (3 * Math.sqrt(k1))) ** 3; return [lo, hi]; }
// Entropía de Shannon normalizada de un vector no negativo tratado como pmf: 1 = uniforme, 0 = concentrada.
export function entropyNorm(v) { const s = sum(v); if (!(s > 0) || v.length < 2) return 0; let h = 0; for (const x of v) if (x > 0) { const p = x / s; h -= p * Math.log(p); } return h / Math.log(v.length); }
// Autocorrelación (sesgada, sin media) r[k], k = 0..maxLag.
export function autocorr(x, maxLag = Math.floor(x.length / 2)) {
  const m = mean(x), d = x.map((v) => v - m), c0 = sum(d.map((v) => v * v)), r = [];
  for (let k = 0; k <= maxLag; k++) { let s = 0; for (let i = 0; i + k < d.length; i++) s += d[i] * d[i + k]; r.push(c0 > 1e-12 ? s / c0 : 0); }
  return r;
}
// Periodicidad: primer máximo local de r tras su primer cruce por cero. → { lag, r } (lag en muestras) o null.
export function dominantPeriod(x, minLag = 2) {
  const r = autocorr(x); let k = 1; while (k < r.length && r[k] > 0) k++; let best = null;
  for (let i = Math.max(k, minLag); i < r.length - 1; i++) if (r[i] >= r[i - 1] && r[i] > r[i + 1] && (!best || r[i] > best.r)) best = { lag: i, r: r[i] };
  return best;
}
export const interp = (t, v, x) => { if (x <= t[0]) return v[0]; if (x >= t[t.length - 1]) return v[v.length - 1]; let lo = 0, hi = t.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (t[m] <= x) lo = m; else hi = m; } const u = (x - t[lo]) / (t[hi] - t[lo] || 1); return v[lo] + (v[hi] - v[lo]) * u; };
// Representación funcional: v(t) en [0,T] → N muestras en tiempo normalizado τ_i = (i+½)/N.
export const resample = (t, v, T, N = 100) => Array.from({ length: N }, (_, i) => interp(t, v, ((i + 0.5) / N) * T));
export function minmax(v) { const lo = Math.min(...v), hi = Math.max(...v); return hi - lo < 1e-12 ? v.map(() => 0) : v.map((x) => (x - lo) / (hi - lo)); }
export function gauss(t, v, sigma) { return t.map((ti) => { let s = 0, w = 0; for (let j = 0; j < t.length; j++) { const d = (t[j] - ti) / sigma; if (Math.abs(d) > 4) continue; const g = Math.exp(-0.5 * d * d); s += g * v[j]; w += g; } return s / w; }); }
// Transformada integral de probabilidad empírica (rango medio / n): cada componente a [0,1] sin unidades.
export function pit(v) { const r = rank(v); return r.map((x) => (x - 0.5) / v.length); }
// Prominencia topográfica de los máximos locales (≥ minProm), ordenados por altura.
export function peaks(v, minProm = 0.1) {
  const out = [];
  for (let i = 0; i < v.length; i++) {
    if (!((i === 0 || v[i] > v[i - 1]) && (i === v.length - 1 || v[i] >= v[i + 1]))) continue;
    let lm = v[i], j = i - 1; while (j >= 0 && v[j] <= v[i]) { lm = Math.min(lm, v[j]); j--; } const lb = j >= 0 ? lm : -Infinity;
    let rm = v[i]; j = i + 1; while (j < v.length && v[j] <= v[i]) { rm = Math.min(rm, v[j]); j++; } const rb = j < v.length ? rm : -Infinity;
    const base = Math.max(lb === -Infinity && rb === -Infinity ? Math.min(...v) : Math.max(lb, rb) === -Infinity ? Math.min(lm, rm) : Math.max(lb, rb), -Infinity), prom = v[i] - (Number.isFinite(base) ? base : Math.min(...v));
    if (prom >= minProm) out.push({ i, v: v[i], prom });
  }
  return out.sort((a, b) => b.v - a.v);
}
export function moments(v) {                          // sobre τ_i = (i+½)/N con v como densidad
  const N = v.length, s = sum(v) || 1, tau = v.map((_, i) => (i + 0.5) / N), c = sum(tau.map((x, i) => x * v[i])) / s, sd = Math.sqrt(sum(tau.map((x, i) => (x - c) ** 2 * v[i])) / s);
  return { centroid: c, spread: sd, skew: sd < 1e-12 ? 0 : sum(tau.map((x, i) => ((x - c) / sd) ** 3 * v[i])) / s };
}
export const l2 = (a, b) => Math.sqrt(mean(a.map((x, i) => (x - b[i]) ** 2)));      // RMS sobre el mismo τ
// DTW (Sakoe & Chiba 1978) con banda ±w·N, coste |a−b|, normalizado por la longitud del camino.
export function dtw(a, b, w = 0.1) {
  const n = a.length, m = b.length, W = Math.max(Math.ceil(w * Math.max(n, m)), Math.abs(n - m)), D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(Infinity)), L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  D[0][0] = 0;
  for (let i = 1; i <= n; i++) for (let j = Math.max(1, i - W); j <= Math.min(m, i + W); j++) {
    const c = Math.abs(a[i - 1] - b[j - 1]), opts = [[D[i - 1][j - 1], L[i - 1][j - 1]], [D[i - 1][j], L[i - 1][j]], [D[i][j - 1], L[i][j - 1]]].sort((p, q) => p[0] - q[0])[0];
    D[i][j] = c + opts[0]; L[i][j] = opts[1] + 1;
  }
  return D[n][m] / L[n][m];
}
// Bootstrap por bloques móviles (Künsch 1989): respeta la autocorrelación de series muestreadas (bloque en nº de muestras).
export function blockBootstrapCI(vals, stat = mean, { block = 8, B = 300, level = 0.95, seed = 11 } = {}) {
  const n = vals.length; if (n < 4) return null; const r = rng(seed), bl = Math.max(1, Math.min(block, n)), est = [];
  for (let b = 0; b < B; b++) { const s = []; while (s.length < n) { const st = Math.floor(r() * (n - bl + 1)); for (let k = 0; k < bl && s.length < n; k++) s.push(vals[st + k]); } est.push(stat(s)); }
  return [quantile(est, (1 - level) / 2), quantile(est, 1 - (1 - level) / 2)];
}
