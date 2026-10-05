// Señales (CHOP de primera clase) y evaluación de parámetros promovidos (F4). Puro, compartido navegador/Node.
//   Señal = función pura de t declarada en timeline.signals:{ nombre: { op, ... } }. Ops: keys | lfo | env | noise | audio | expr.
//   Parámetro = valor resuelto de shots[i].params.<nombre> (tras capas) o, si falta, el default del esquema del shot.
//     constante | { "$sig": "nombre" } | { "$expr": "72 + 8*sig('pulse')" }.
// Contrato que hace sólido el hash por fragmento (cut.mjs): un shot SOLO ve señales a través de sus parámetros enlazados
// (no hay api.sig): así las señales de las que depende un fragmento se conocen sin ejecutar nada (deps del parser).
import { clamp, lerp, ease as EASE, noise1, hashStr } from './core.mjs';
import { compile as compileExpr, ExprError } from './expr.mjs';

export const SIGNAL_OPS = ['keys', 'lfo', 'env', 'noise', 'audio', 'expr'];
// Parámetros que reflejan un campo del shot en el timeline (lo leen lint/crítico/índice): el valor resuelto se escribe
// también en shot.<campo>. Default = el campo; override = /shots/<id>/params/<campo>.
export const FIELD_PARAMS = ['text'];
export const PARAM_TYPES = ['number', 'integer', 'string', 'color', 'boolean', 'enum', 'json'];   // json: lista/objeto sin enlaces (los callbacks eco/rima de la memoria)
export const isBinding = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && ('$sig' in v || '$expr' in v);
export const bindingSrc = (v) => ('$expr' in v ? String(v.$expr) : `sig('${String(v.$sig)}')`);
// Dependencias (nombres de señal) de un valor de parámetro. Lanza ExprError con ruta si la expresión no parsea.
export const bindingDeps = (v, path = '') => (isBinding(v) ? compileExpr(bindingSrc(v), { path }).deps : []);

const WAVES = {
  sine: (x) => Math.sin(2 * Math.PI * x),
  tri: (x) => { const f = x - Math.floor(x); return f < 0.25 ? 4 * f : f < 0.75 ? 2 - 4 * f : 4 * f - 4; },
  square: (x) => (x - Math.floor(x) < 0.5 ? 1 : -1),
  saw: (x) => 2 * (x - Math.floor(x)) - 1,
};
const trains = (times, t, f) => { let v = 0; for (const a of times) { if (a > t) break; v = Math.max(v, f(t - a)); } return v; };
function adsr(d) {
  const A = d.attack ?? 0.02, D = d.decay ?? 0.25, S = d.sustain ?? 0, H = d.hold ?? 0, R = d.release ?? 0.2, pk = d.peak ?? 1;
  return (x) => (x < 0 ? 0 : x < A ? (pk * x) / A : x < A + D ? lerp(pk, pk * S, (x - A) / D) : x < A + D + H ? pk * S : R > 0 && x < A + D + H + R ? pk * S * (1 - (x - A - D - H) / R) : 0);
}

// Compila las definiciones a funciones de t. ctx = { beatTimes, audioInfo, duration }. Ciclos y referencias rotas → error con ruta.
export function compileSignals(defs = {}, ctx = {}) {
  const fns = new Map(), deps = {}, P = (n, k = '') => `/signals/${n}${k ? '/' + k : ''}`;
  const err = (m, n, k) => { throw new ExprError(m, { path: P(n, k) }); };
  for (const [name, d] of Object.entries(defs)) {
    if (!d || typeof d !== 'object' || !SIGNAL_OPS.includes(d.op)) err(`op de señal desconocido '${d?.op}' (válidos: ${SIGNAL_OPS.join(' ')})`, name, 'op');
    deps[name] = d.op === 'expr' ? compileExpr(d.expr, { path: P(name, 'expr') }).deps : [];
    for (const x of deps[name]) if (!Object.hasOwn(defs, x)) err(`señal desconocida '${x}' en la expresión`, name, 'expr');
  }
  // ciclos (DFS): a→b→a
  const state = {};
  const visit = (n, stack) => {
    if (state[n] === 2) return; if (state[n] === 1) err(`ciclo de señales: ${[...stack, n].join(' → ')}`, n, 'expr');
    state[n] = 1; for (const x of deps[n]) visit(x, [...stack, n]); state[n] = 2;
  };
  for (const n of Object.keys(defs)) visit(n, []);
  const value = (name, t) => { const f = fns.get(name); if (!f) throw new ExprError(`señal desconocida '${name}'`, { path: '/signals' }); return f(t); };
  for (const [name, d] of Object.entries(defs)) fns.set(name, makeSignal(name, d, ctx, value));
  return { value, deps, has: (n) => fns.has(n) };
}

function makeSignal(name, d, ctx, value) {
  switch (d.op) {
    case 'keys': {                                       // keys: [{t, v, ease?}] — ease del tramo que EMPIEZA en esa clave; fuera: mantiene
      const K = [...(d.keys ?? [])].sort((a, b) => a.t - b.t);
      if (!K.length) return () => 0;
      return (t) => {
        if (t <= K[0].t) return K[0].v; const L = K[K.length - 1]; if (t >= L.t) return L.v;
        let i = 0; while (K[i + 1].t < t) i++;
        const a = K[i], b = K[i + 1], f = EASE[a.ease ?? 'linear'] ?? EASE.linear;
        return lerp(a.v, b.v, f(clamp((t - a.t) / Math.max(1e-9, b.t - a.t))));
      };
    }
    case 'lfo': { const w = WAVES[d.shape ?? 'sine'] ?? WAVES.sine, f = d.freq ?? 1, A = d.amp ?? 1, o = d.offset ?? 0, ph = d.phase ?? 0; return (t) => o + A * w(f * t + ph); }
    case 'env': { const at = [].concat(d.at ?? 0).sort((a, b) => a - b), e = adsr(d); return (t) => trains(at, t, e); }
    case 'noise': {                                      // semilla por NOMBRE: añadir otra señal no cambia el azar de esta
      const seed = d.seed ?? hashStr('signal:' + name), f = d.freq ?? 1, A = d.amp ?? 1, o = d.offset ?? 0, oct = Math.max(1, Math.min(6, d.octaves ?? 1));
      return (t) => { let v = 0, amp = 1, fr = f, norm = 0; for (let i = 0; i < oct; i++) { v += amp * noise1(t * fr, seed + i * 7919); norm += amp; amp *= 0.5; fr *= 2; } return o + (A * v) / norm; };
    }
    case 'audio': {                                      // rasgos de data/audio.json (engine/audio.mjs --analyze) o la rejilla de beats
      const g = d.gain ?? 1, dec = d.decay ?? 0.15, A = ctx.audioInfo ?? {};
      if (d.feature === 'rms') {
        const R = A.rms; if (!R?.values?.length) return () => 0;   // sin análisis: silencio (documentado en docs/PARAMS.md)
        const h = R.hop, V = R.values; return (t) => { const x = t / h, i = Math.floor(x); if (i < 0) return g * V[0]; if (i >= V.length - 1) return g * V[V.length - 1]; return g * lerp(V[i], V[i + 1], x - i); };
      }
      const times = [...(d.feature === 'beats' ? ctx.beatTimes ?? [] : d.track ? A.tracks?.[d.track] ?? [] : A.onsets ?? [])].sort((a, b) => a - b), att = d.attack ?? 0.005;   // track: lista nombrada de audio.json.tracks (kick, hat…)
      return (t) => g * trains(times, t, (x) => (x < att ? x / att : Math.exp(-(x - att) / dec)));
    }
    case 'expr': { const c = compileExpr(d.expr, { path: `/signals/${name}/expr` }); return (t) => c.fn({ t, lt: t, u: ctx.duration ? t / ctx.duration : 0, dur: ctx.duration ?? 0, sig: value }); }
  }
  return () => 0;
}

// ── parámetros ───────────────────────────────────────────────────────────────────────────────────────────────────
// Instala en el film: film.meta (sacado de los shots: el código de un shot no puede depender de él → no invalida píxeles),
// film.signal(name, t), film.param(id, name, t), film.params(id, t). Idempotente; rebind tras cargar los módulos.
export function bindParams(film) {
  film.meta = film.meta ?? {};
  if (film.shots.some((s) => s.meta !== undefined)) film.shots = film.shots.map(({ meta, ...s }) => { if (meta !== undefined) film.meta[s.id] = meta; return s; });
  for (const s of film.shots) for (const f of FIELD_PARAMS) if (s.params && Object.hasOwn(s.params, f) && !isBinding(s.params[f])) s[f] = s.params[f];
  const S = compileSignals(film.signals ?? {}, { beatTimes: film.beatTimes, audioInfo: film.audioInfo, duration: film.duration });
  const memo = new Map(), byId = new Map(film.shots.map((s) => [s.id, s]));
  const schemaOf = (id) => film.mods?.[id]?.params ?? {};
  const make = (s, name) => {
    const sch = schemaOf(s.id)[name], own = s.params && Object.hasOwn(s.params, name);
    const v = own ? s.params[name] : FIELD_PARAMS.includes(name) && s[name] !== undefined ? s[name] : sch?.default;
    if (!isBinding(v)) return () => v;
    const c = compileExpr(bindingSrc(v), { path: `/shots/${s.id}/params/${name}` }), t0 = s.t[0], dur = Math.max(1e-4, s.t[1] - s.t[0]);
    const lo = sch?.range?.[0] ?? -Infinity, hi = sch?.range?.[1] ?? Infinity, int = sch?.type === 'integer', def = sch?.default ?? 0;
    return (t) => {
      let x = c.fn({ t, lt: t - t0, u: clamp((t - t0) / dur), dur, sig: S.value });
      if (typeof x === 'number') { if (!Number.isFinite(x)) x = def; x = clamp(x, lo, hi); if (int) x = Math.round(x); }
      return x;
    };
  };
  film.signal = (name, t) => S.value(name, t);
  film.param = (id, name, t = 0) => {
    const k = id + '\u0000' + name; let f = memo.get(k);
    if (!f) { const s = byId.get(id); if (!s) throw new Error(`param: shot desconocido "${id}"`); f = make(s, name); memo.set(k, f); }
    return f(t);
  };
  film.paramNames = (id) => { const s = byId.get(id); return [...new Set([...Object.keys(schemaOf(id)), ...Object.keys(s?.params ?? {})])]; };
  film.params = (id, t = 0) => { const o = {}; for (const n of film.paramNames(id)) o[n] = film.param(id, n, t); return o; };
  film.signalDeps = S.deps;
  return film;
}

// Señales de las que depende un shot (transitivas, por sus parámetros enlazados). Para el cookKey.
export function shotSignals(film, s) {
  const out = new Set(), D = film.signalDeps ?? {}, walk = (n) => { if (out.has(n)) return; out.add(n); for (const x of D[n] ?? []) walk(x); };
  for (const [name, v] of Object.entries(s.params ?? {})) for (const d of bindingDeps(v, `/shots/${s.id}/params/${name}`)) walk(d);
  return [...out].sort();
}
