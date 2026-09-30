// Primitivas puras. Nada aquí guarda estado entre frames.
export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, u) => a + (b - a) * u;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = (u) => u * u * (3 - 2 * u);

// Easing canónico: muelle amortiguado en forma cerrada (0 -> 1).
export function spring(t, { omega = 14, zeta = 0.62 } = {}) {
  if (t <= 0) return 0;
  if (zeta >= 1) return 1 - Math.exp(-omega * t) * (1 + omega * t);
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t));
}

// PRNG determinista (mulberry32). Prohibido Math.random en shots.
export function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ───────── v3: easings, ruido, muelle por estilo ─────────
export function bezier(x1, y1, x2, y2) {
  return (u) => {
    if (u <= 0) return 0; if (u >= 1) return 1;
    let t = u;
    for (let i = 0; i < 10; i++) {
      const x = 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3 - u;
      const dx = 3 * (1 - t) ** 2 * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
      if (Math.abs(dx) < 1e-6) break;
      t = Math.min(1, Math.max(0, t - x / dx));
    }
    return 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3;
  };
}
// Curvas con intención: `cinema` = arranque suave y aterrizaje muy largo (cámara real); `outExpo` = impacto.
export const ease = {
  linear: (u) => u,
  in: (u) => u * u * u,
  out: (u) => 1 - Math.pow(1 - u, 3),
  inOut: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  inOutQuint: (u) => (u < 0.5 ? 16 * u ** 5 : 1 - Math.pow(-2 * u + 2, 5) / 2),
  outExpo: (u) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u)),
  outBack: (u) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
  smooth,
  step: (u) => Math.floor(u * 8) / 8,
  cinema: bezier(0.25, 0, 0.05, 1),
};

export function hash2(i, seed = 0) {
  let h = (Math.imul(i | 0, 374761393) + Math.imul(seed | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Ruido de valor suave en [-1, 1], determinista. Base de la cámara "handheld".
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  return (lerp(hash2(i, seed), hash2(i + 1, seed), smooth(f))) * 2 - 1;
}
export function hashStr(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h | 0; }

// Muelle con los parámetros del estilo. kind: main | soft | snap
export function springS(t, film, kind = 'main') {
  const sp = film.S.motion.spring;
  const p = kind === 'soft' ? { omega: sp.omega * 0.6, zeta: Math.min(1, sp.zeta + 0.2) }
    : kind === 'snap' ? { omega: sp.omega * 1.5, zeta: sp.zeta * 0.85 } : sp;
  return spring(t, p);
}

// Stop-motion: cuantiza el tiempo SOLO para dibujar (el reloj sigue siendo determinista). stepFps 0 = continuo.
export const stepT = (t, film) => { const f = film.S.motion.stepFps; return f ? Math.floor(t * f + 1e-9) / f : t; };
