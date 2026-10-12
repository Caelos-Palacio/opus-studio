// VALORES ANIMABLES de los fondos (spec 021 §A) — módulo PURO (sin fs ni reloj). Cualquier parámetro de una capa puede ser:
//   literal                       (como siempre)
//   {"expr":"0.3+0.2*sin(t*2)"}   expresión de t lt u dur beat + pulso/desde/hasta/paso/cuenta (eventos del film)
//   {"k":[[x,v],…], "ease":"smooth", "eje":"lt|t|u|beat", "en":"giro"}   keyframes (v: número, par, color, lista de colores, enum…)
// Los colores interpolan en OKLab (color.mix); `en` desplaza los keyframes al instante de un evento (ancla). Todo es función pura de
// (valor, entorno): sin estado entre cuadros. También reúne las utilidades de eventos (casa, evHelpers) que comparten expresiones,
// capas reactivas y la capa `codigo`.
import { clamp, lerp, smooth, ease as EASE } from './core.mjs';
import { mix } from './color.mjs';
import { compile } from './expr.mjs';

// ── pistas «¿quisiste decir…?» (se reexportan desde fondo-capas) ──
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
export const hint = (w, cs) => { let best = null, bd = 1e9; for (const c of cs) { const d = lev(String(w).toLowerCase(), String(c).toLowerCase()); if (d < bd) { bd = d; best = c; } }
  return best != null && bd <= Math.max(1, Math.floor(String(w).length / 3)) ? `¿quisiste decir "${best}"?` : `válidos: ${[...cs].join(' ')}`; };

export const EJES = ['lt', 't', 'u', 'beat'];
export const EV_FUNCS = ['pulso', 'desde', 'hasta', 'paso', 'cuenta'];
export const EXPR_VARS = ['beat'];
const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
export const esKeyframes = (v) => isObj(v) && Array.isArray(v.k);
export const esExpr = (v) => isObj(v) && typeof v.expr === 'string';
// ¿hay algún valor dinámico (en cualquier profundidad)?
export const esDinamico = (v) => (esKeyframes(v) || esExpr(v)) ? true : Array.isArray(v) ? v.some(esDinamico) : isObj(v) ? Object.values(v).some(esDinamico) : false;

// ── eventos ──
//   evento = { t (s del film), kind: 'impacto'|'cue'|'beat'|…, id, x?, y? (fracciones del cuadro), fuerza? }
//   sel: tipo (`impacto`), id (`giro`, `b4`, `K01:impacto0`) o prefijo con `*` final (`K01:*`); lista = cualquiera.
export const casa = (ev, sel) => {
  if (Array.isArray(sel)) return sel.some((s) => casa(ev, s));
  const s = String(sel); if (s.endsWith('*')) { const p = s.slice(0, -1); return String(ev.id ?? '').startsWith(p) || String(ev.kind ?? '').startsWith(p); }
  return ev.kind === s || ev.id === s;
};
export const selEventos = (eventos, sel) => eventos.filter((e) => casa(e, sel));
export function evHelpers(eventos, t) {
  const m = (sel) => selEventos(eventos, sel);
  return {
    pulso: (sel, tau = 0.5) => { let s = 0; for (const e of m(sel)) if (e.t <= t) s += (e.fuerza ?? 1) * Math.exp(-(t - e.t) / Math.max(1e-6, tau)); return s; },
    desde: (sel) => { let b = 999; for (const e of m(sel)) if (e.t <= t) b = Math.min(b, t - e.t); return b; },
    hasta: (sel) => { let b = 999; for (const e of m(sel)) if (e.t > t) b = Math.min(b, e.t - t); return b; },
    paso: (sel, dur = 1) => { const l = m(sel); if (!l.length) return 0; const t0 = Math.min(...l.map((e) => e.t)); return smooth(clamp((t - t0) / Math.max(1e-6, dur))); },
    cuenta: (sel) => m(sel).filter((e) => e.t <= t).length,
  };
}
export const anclaTiempo = (eventos, nombre) => {
  const l = selEventos(eventos, nombre); if (!l.length) throw new Error(`fondo: ancla "${nombre}" no existe entre los eventos del film — ${hint(nombre, [...new Set(eventos.flatMap((e) => [e.id, e.kind]).filter(Boolean))])}`);
  return Math.min(...l.map((e) => e.t));
};

// ── entorno de evaluación ──
//   env = { t, lt, u, dur, beat, t0, beatAt(t), eventos, hex(c), pal, fns }  (fondos.mjs lo construye una vez por cuadro)
export function makeEnv({ t, lt, u, dur, t0, beatAt, eventos, hex, pal }) {
  return { t, lt, u, dur, t0, beat: beatAt ? beatAt(t) : 0, beatAt: beatAt ?? (() => 0), eventos, hex, pal, sig: () => 0, fns: evHelpers(eventos, t) };
}
const isHex = (s) => /^#[0-9a-fA-F]{3,8}$/.test(s);
const evalExpr = (v, env) => { const r = compile(v.expr, { vars: EXPR_VARS, funcs: EV_FUNCS }).fn(env); return typeof r === 'boolean' ? (r ? 1 : 0) : r; };

function interpPar(a, b, x, tipo, env) {
  if (tipo === 'color') return x <= 0 ? a : x >= 1 ? b : mix(env.hex(a), env.hex(b), x);
  if (tipo === 'num') return lerp(a, b, x);
  if (tipo === 'int') return Math.round(lerp(a, b, x));
  if (tipo === 'enum' || tipo === 'bool' || tipo === 'string') return x >= 1 ? b : a;
  if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, x);
  if (typeof a === 'string' && typeof b === 'string') { const col = (s) => isHex(s) || env.pal?.[s]; return col(a) && col(b) ? (x <= 0 ? a : x >= 1 ? b : mix(env.hex(a), env.hex(b), x)) : (x >= 1 ? b : a); }
  return x >= 1 ? b : a;
}
// interpola dos valores de cualquier forma (números, pares, listas de colores…)
export function interp(a, b, x, tipo, env) {
  if (Array.isArray(a) && Array.isArray(b)) { const sub = tipo === 'colores' ? 'color' : tipo === 'par' ? 'num' : undefined, n = Math.max(a.length, b.length);
    return Array.from({ length: n }, (_, i) => interp(a[Math.min(i, a.length - 1)], b[Math.min(i, b.length - 1)], x, sub, env)); }
  return interpPar(a, b, x, tipo, env);
}
function evalKeyframes(v, tipo, env) {
  const ks = v.k, eje = v.eje ?? 'lt'; let ax = eje === 'lt' ? env.lt : eje === 't' ? env.t : eje === 'u' ? env.u : env.beat;
  if (v.en != null) { const te = anclaTiempo(env.eventos, v.en); ax -= eje === 'lt' ? te - env.t0 : eje === 't' ? te : eje === 'u' ? (te - env.t0) / Math.max(1e-6, env.dur) : env.beatAt(te); }
  if (ax <= ks[0][0]) return ks[0][1];
  for (let i = 0; i < ks.length - 1; i++) {
    const [x0, v0] = ks[i], [x1, v1] = ks[i + 1];
    if (ax < x1) { const f = (EASE[v.ease ?? 'smooth'] ?? EASE.smooth)(clamp((ax - x0) / Math.max(1e-9, x1 - x0))); return interp(v0, v1, f, tipo, env); }
  }
  return ks[ks.length - 1][1];
}
// Resuelve un valor (profundo) a su literal en este instante. Devuelve la MISMA referencia si no hay nada dinámico.
//   tipo: tipo del parámetro (num int par color colores enum bool string json) para saber cómo interpolar.
export function resolver(v, tipo, env) {
  if (v == null || typeof v !== 'object') return v;
  if (esKeyframes(v)) return evalKeyframes(v, tipo, env);
  if (esExpr(v)) return evalExpr(v, env);
  if (Array.isArray(v)) {
    if (!v.some(esDinamico)) return v;
    const sub = tipo === 'colores' ? 'color' : tipo === 'par' ? 'num' : undefined;
    return v.map((x) => resolver(x, sub, env));
  }
  if (!esDinamico(v)) return v;
  if (tipo === 'color' && v.mezcla) return { mezcla: [resolver(v.mezcla[0], 'color', env), resolver(v.mezcla[1], 'color', env), resolver(v.mezcla[2], 'num', env)] };
  if (tipo === 'color' && v.paleta != null) return { paleta: resolver(v.paleta, 'num', env) };
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolver(x, undefined, env)]));
}

// ── validación estructural de un valor dinámico ──
//   okValor(x) → '' | mensaje (valida un literal contra el tipo del parámetro). add(path, message, remedy)
export function validarDinamico(v, tipo, path, add, okValor) {
  if (esKeyframes(v)) {
    for (const k of Object.keys(v)) if (!['k', 'ease', 'eje', 'en'].includes(k)) add(`${path}/${k}`, `propiedad desconocida "${k}" en keyframes`, hint(k, ['k', 'ease', 'eje', 'en']));
    if (v.ease != null && !EASE[v.ease]) add(`${path}/ease`, `curva desconocida "${v.ease}"`, hint(String(v.ease), Object.keys(EASE)));
    if (v.eje != null && !EJES.includes(v.eje)) add(`${path}/eje`, `eje desconocido "${v.eje}"`, hint(String(v.eje), EJES));
    if (v.en != null && typeof v.en !== 'string') add(`${path}/en`, '"en": nombre de un evento (texto)', 'p. ej. "giro", "b4", "impacto"');
    if (!v.k.length) add(`${path}/k`, 'keyframes vacíos', '[[x, valor], …]');
    let prev = -Infinity;
    v.k.forEach((p, i) => {
      if (!Array.isArray(p) || p.length !== 2 || typeof p[0] !== 'number' || !Number.isFinite(p[0])) { add(`${path}/k/${i}`, 'keyframe mal formado', '[x, valor] con x numérico'); return; }
      if (p[0] <= prev) add(`${path}/k/${i}`, 'los keyframes deben ir en x ascendente estricto');
      prev = p[0];
      if (esDinamico(p[1])) add(`${path}/k/${i}`, 'un keyframe no puede contener otro valor dinámico'); else { const bad = okValor(p[1], tipo); if (bad) add(`${path}/k/${i}`, 'valor de keyframe no válido', bad); }
    });
    return;
  }
  if (esExpr(v)) {
    for (const k of Object.keys(v)) if (k !== 'expr') add(`${path}/${k}`, `propiedad desconocida "${k}" en expr`, 'solo {"expr":"…"}');
    if (!['num', 'int', 'bool', undefined].includes(tipo) && tipo !== 'json') add(path, `una expresión da un número: no vale para parámetros de tipo ${tipo}`, tipo === 'color' || tipo === 'colores' ? 'usa keyframes {"k":[…]} o {"mezcla":[a,b,{"expr":"…"}]}' : 'usa keyframes {"k":[…]}');
    try { compile(v.expr, { path, vars: EXPR_VARS, funcs: EV_FUNCS }); } catch (e) { add(path, e.reason ?? e.message, 'expresión de t lt u dur beat + pulso/desde/hasta/paso/cuenta (engine/fondo-valor.mjs)'); }
    return;
  }
  if (Array.isArray(v)) { const sub = tipo === 'colores' ? 'color' : tipo === 'par' ? 'num' : undefined; v.forEach((x, i) => { if (esDinamico(x)) validarDinamico(x, sub, `${path}/${i}`, add, okValor); }); return; }
  if (isObj(v)) { if (v.mezcla) { v.mezcla.forEach((x, i) => { if (esDinamico(x)) validarDinamico(x, i === 2 ? 'num' : 'color', `${path}/mezcla/${i}`, add, okValor); }); } else if (v.paleta != null && esDinamico(v.paleta)) validarDinamico(v.paleta, 'num', `${path}/paleta`, add, okValor);
    else for (const [k, x] of Object.entries(v)) if (esDinamico(x)) validarDinamico(x, undefined, `${path}/${k}`, add, okValor); }
}
