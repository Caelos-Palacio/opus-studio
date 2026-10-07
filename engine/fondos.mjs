// FONDOS (spec 014) — núcleo PURO: resuelve un fondo declarado (preset + ajustes + capas) y lo pinta de forma determinista.
//   validateFondo(spec) → [{path, message, remedy}] · resolveFondo(spec) → { capas, porque } · drawFondo(ctx, spec, t, E)
//   E = { W, H, k, pal:{rol:hex}, canvas(w,h), cache:Map, depth(d, fn), u?, dur?, alfa? }   (api.fondo lo construye; las herramientas, a mano)
import { rng, clamp, hashStr } from './core.mjs';
import { luminance } from './color.mjs';
import { mix, hex2rgb } from './color.mjs';
import { compile } from './expr.mjs';
import { CAPAS, PAD, MEZCLAS, hint, validateCapa, colorOk } from './fondo-capas.mjs';
import { PRESETS } from './fondo-presets.mjs';
export { CAPAS, PRESETS, PAD };
export const FONDO_KEYS = ['preset', 'semilla', 'ajustes', 'sin', 'capas'];
const clone = (x) => JSON.parse(JSON.stringify(x));

// preset + ajustes + sin + capas extra → pila final de capas (cada una con id)
export function resolveFondo(spec) {
  const out = []; let porque = null;
  if (spec.preset != null) {
    const P = PRESETS[spec.preset]; if (!P) throw new Error(`fondo: preset desconocido "${spec.preset}" — ${hint(spec.preset, Object.keys(PRESETS))}`);
    porque = P.porque; for (const c of clone(P.capas)) out.push(c);
  }
  const byId = (id) => out.find((c) => c.id === id);
  for (const [id, patch] of Object.entries(spec.ajustes ?? {})) { const c = byId(id); if (!c) throw new Error(`fondo: ajustes de capa inexistente "${id}" — ${hint(id, out.map((x) => x.id))}`); Object.assign(c, clone(patch)); }
  for (const id of spec.sin ?? []) { const i = out.findIndex((c) => c.id === id); if (i < 0) throw new Error(`fondo: sin "${id}" no existe — ${hint(id, out.map((x) => x.id))}`); out.splice(i, 1); }
  for (const c of clone(spec.capas ?? [])) out.push(c);
  out.forEach((c, i) => { c.id ??= `${c.tipo}${i}`; });
  return { capas: out, porque };
}
export function validateFondo(spec, path = '', E = null) {
  const errs = [], add = E ?? ((p, message, remedy = '') => errs.push({ path: p, message, remedy }));
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) { add(path || '/', 'el fondo debe ser un objeto {preset?, capas?, ajustes?, sin?, semilla?}'); return errs; }
  for (const k of Object.keys(spec)) if (!FONDO_KEYS.includes(k)) add(`${path}/${k}`, `propiedad desconocida "${k}" en fondo`, hint(k, FONDO_KEYS));
  if (spec.preset == null && !(spec.capas ?? []).length) add(path || '/', 'fondo vacío: falta "preset" o "capas"', 'p. ej. {"preset":"cuba_oscura"} o {"capas":[{"tipo":"degradado"}]}');
  if (spec.preset != null && !PRESETS[spec.preset]) add(`${path}/preset`, `preset desconocido "${spec.preset}"`, hint(String(spec.preset), Object.keys(PRESETS)));
  if (spec.semilla != null && !Number.isInteger(spec.semilla)) add(`${path}/semilla`, 'semilla: entero');
  if (spec.capas != null && !Array.isArray(spec.capas)) add(`${path}/capas`, 'capas: lista');
  (Array.isArray(spec.capas) ? spec.capas : []).forEach((c, i) => validateCapa(c, `${path}/capas/${i}`, add));
  const base = spec.preset != null && PRESETS[spec.preset] ? PRESETS[spec.preset].capas : [], ids = base.map((c) => c.id);
  for (const [id, patch] of Object.entries(spec.ajustes ?? {})) {
    const c = base.find((x) => x.id === id);
    if (!c) { add(`${path}/ajustes/${id}`, `ajustes de capa inexistente "${id}"`, ids.length ? hint(id, ids) : 'ajustes solo retoca capas de un preset'); continue; }
    validateCapa({ ...c, ...patch }, `${path}/ajustes/${id}`, add);
  }
  for (const id of Array.isArray(spec.sin) ? spec.sin : []) if (!ids.includes(id)) add(`${path}/sin`, `sin: la capa "${id}" no existe en el preset`, ids.length ? hint(id, ids) : 'sin solo quita capas de un preset');
  return errs;
}

// ── color y paleta ──
export function makeColor(pal) {
  const memo = new Map(), isHex = (s) => /^#[0-9a-fA-F]{3,8}$/.test(s);
  const ord = [...new Set(['paper', 'shade', 'accent2', 'accent', 'ink'].filter((r) => pal[r]).map((r) => pal[r]))].sort((a, b) => luminance(a) - luminance(b));
  const hex = (c) => {
    if (typeof c === 'string') { if (isHex(c)) return c; const v = pal[c]; if (!v) throw new Error(`fondo: rol de color desconocido "${c}" (roles de la paleta: ${Object.keys(pal).join(' ')})`); return v; }
    const key = JSON.stringify(c); let v = memo.get(key); if (v) return v;
    if (c?.paleta != null) { const u = clamp(c.paleta) * (ord.length - 1), i = Math.floor(u); v = i >= ord.length - 1 ? ord[ord.length - 1] : mix(ord[i], ord[i + 1], u - i); }
    else if (c?.mezcla) v = mix(hex(c.mezcla[0]), hex(c.mezcla[1]), c.mezcla[2]);
    else throw new Error(`fondo: color no válido ${key}`);
    memo.set(key, v); return v;
  };
  return { hex, ord };
}

// ── pintado ──
export function drawFondo(ctx, spec, t, E) {
  const { capas } = resolveFondo(spec), seed0 = spec.semilla ?? 1, { W, H } = E, { hex, ord } = (E._col ??= makeColor(E.pal)), palKey = (E._palKey ??= JSON.stringify(E.pal));
  const cache = E.cache ?? (E.cache = new Map()), lt = E.lt ?? t, env = { t, lt, u: E.u ?? 0, dur: E.dur ?? 0 }, m = Math.min(W, H);
  if (cache.size > 64) cache.clear();
  capas.forEach((c, i) => {
    const def = CAPAS[c.tipo]; if (!def) throw new Error(`fondo: tipo de capa desconocido "${c.tipo}" — ${hint(c.tipo, Object.keys(CAPAS))}`);
    const p = {}; for (const [k, d] of Object.entries(def.params)) p[k] = c[k] !== undefined ? c[k] : d.def;
    const ev = (k, dflt) => { const s = c.anim?.[k]; return s == null ? dflt : typeof s === 'number' ? s : compile(String(s)).fn({ sig: () => 0, ...env }); };
    const seed = (hashStr(`${seed0}:${c.id}`) + (c.semilla | 0) * 104729 + i * 31) | 0, par = c.paralaje ?? def.paralaje;
    const drv = c.deriva ?? [0, 0], dx = drv[0] * m * t + ev('dx', 0) * m, dy = drv[1] * m * t + ev('dy', 0) * m;
    const alpha = clamp((c.alfa ?? 1) * ev('alfa', 1) * (E.alfa ?? 1)), esc = ev('escala', 1);
    if (alpha <= 0.002) return;
    const L = {
      W, H, k: E.k ?? 1, t, lt, u: env.u, X0: (-(PAD - 1) / 2) * W, Y0: (-(PAD - 1) / 2) * H, WW: PAD * W, HH: PAD * H, seed, dx, dy, alpha, palKey, hex, paletaOrdenada: () => ord,
      tex(key, tw, th, build) { const kk = `${key}|${W}x${H}`; let cv = cache.get(kk); if (!cv) { cv = E.canvas(tw, th); build(cv.getContext('2d')); cache.set(kk, cv); } return cv; },
      memo(key, fn) { const kk = `m|${key}`; let v = cache.get(kk); if (!v) { v = fn(); cache.set(kk, v); } return v; },
    };
    E.depth(par, () => {
      ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = MEZCLAS[p.mezcla] ?? 'source-over';
      if (esc !== 1) { ctx.translate(W / 2, H / 2); ctx.scale(esc, esc); ctx.translate(-W / 2, -H / 2); }
      if (def.deriva === 'trans') ctx.translate(dx, dy);
      def.draw(ctx, p, L); ctx.restore();
    });
  });
}
export const listaPresets = () => Object.entries(PRESETS).map(([id, p]) => ({ id, ...p }));
