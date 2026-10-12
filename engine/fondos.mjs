// FONDOS (spec 014) — núcleo PURO: resuelve un fondo declarado (preset + ajustes + capas) y lo pinta de forma determinista.
//   validateFondo(spec) → [{path, message, remedy}] · resolveFondo(spec) → { capas, porque } · drawFondo(ctx, spec, t, E)
//   E = { W, H, k, pal:{rol:hex}, canvas(w,h), cache:Map, depth(d, fn), u?, dur?, alfa? }   (api.fondo lo construye; las herramientas, a mano)
import { rng, clamp, hashStr } from './core.mjs';
import { luminance } from './color.mjs';
import { mix, hex2rgb } from './color.mjs';
import { compile } from './expr.mjs';
import { CAPAS, PAD, MEZCLAS, hint, validateCapa, colorOk, paramsTB } from './fondo-capas.mjs';
import { PRESETS } from './fondo-presets.mjs';
import './fondo-libre.mjs';                                   // spec 021: capas reactivas (onda, mancha, pulso) y capa `codigo`
import { esDinamico, makeEnv, resolver } from './fondo-valor.mjs';
export { CAPAS, PRESETS, PAD };
export const FONDO_KEYS = ['preset', 'semilla', 'ajustes', 'sin', 'capas', 'eventos'];
export const EVENTO_KEYS = ['at', 'id', 'tipo', 'x', 'y', 'fuerza'];
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
  if (spec.eventos != null) {
    if (!Array.isArray(spec.eventos)) add(`${path}/eventos`, 'eventos: lista de {at, id?, tipo?, x?, y?, fuerza?}');
    else spec.eventos.forEach((e, i) => {
      if (!e || typeof e !== 'object' || Array.isArray(e)) { add(`${path}/eventos/${i}`, 'el evento debe ser un objeto {at, id?, tipo?, x?, y?, fuerza?}'); return; }
      for (const k of Object.keys(e)) if (!EVENTO_KEYS.includes(k)) add(`${path}/eventos/${i}/${k}`, `propiedad desconocida "${k}" en evento`, hint(k, EVENTO_KEYS));
      if (typeof e.at !== 'number' || !Number.isFinite(e.at)) add(`${path}/eventos/${i}/at`, 'at: segundos locales del shot (número)');
      for (const k of ['x', 'y', 'fuerza']) if (e[k] != null && (typeof e[k] !== 'number' || !Number.isFinite(e[k]))) add(`${path}/eventos/${i}/${k}`, `${k}: número`);
      for (const k of ['id', 'tipo']) if (e[k] != null && !/^[A-Za-z][\w:.-]*$/.test(String(e[k]))) add(`${path}/eventos/${i}/${k}`, `${k} no válido (letras, dígitos, _ : . -)`);
    });
  }
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
const SIN_EVENTOS = Object.freeze([]), COMUNES_K = new Set(['id', 'alfa', 'mezcla', 'paralaje', 'semilla', 'deriva', 'anim']);
// Eventos del cuadro: los del film (E.eventos, absolutos) + los que declara el propio fondo (`eventos`, `at` local al shot), ordenados por t.
export function eventosDe(spec, E, t, lt) {
  const t0 = t - lt, mios = (spec.eventos ?? []).map((e, i) => ({ t: t0 + e.at, kind: e.tipo ?? 'cue', id: e.id ?? `${e.tipo ?? 'evento'}${i}`, x: e.x, y: e.y, fuerza: e.fuerza ?? 1 }));
  return !mios.length && !(E.eventos?.length) ? SIN_EVENTOS : [...(E.eventos ?? []), ...mios].sort((a, b) => a.t - b.t);
}
// Entorno de valores animables de un cuadro (spec 021): lo usan drawFondo, las pruebas y el medidor de coste.
export function entornoFondo(spec, t, E) {
  const lt = E.lt ?? t, { hex } = (E._col ??= makeColor(E.pal));
  return makeEnv({ t, lt, u: E.u ?? 0, dur: E.dur ?? 0, t0: t - lt, beatAt: E.beatAt, eventos: eventosDe(spec, E, t, lt), hex, pal: E.pal });
}
const clampTipo = (d, v) => (typeof v === 'number' ? (d.type === 'num' ? clamp(v, d.min, d.max) : d.type === 'int' ? Math.round(clamp(v, d.min, d.max)) : v) : v);
export function drawFondo(ctx, spec, t, E) {
  const { capas } = resolveFondo(spec), seed0 = spec.semilla ?? 1, { W, H } = E, { hex, ord } = (E._col ??= makeColor(E.pal)), palKey = (E._palKey ??= JSON.stringify(E.pal));
  const cache = E.cache ?? (E.cache = new Map()), lt = E.lt ?? t, env0 = { t, lt, u: E.u ?? 0, dur: E.dur ?? 0 }, m = Math.min(W, H);
  while (cache.size > 192) cache.delete(cache.keys().next().value);                 // expulsa lo más antiguo (antes: clear() a los 64, que tiraba también las texturas caras)
  let ENV = null, animado = false; const codigos = []; const getEnv = () => (ENV ??= entornoFondo(spec, t, E));
  capas.forEach((c, i) => {
    const def = CAPAS[c.tipo]; if (!def) throw new Error(`fondo: tipo de capa desconocido "${c.tipo}" — ${hint(c.tipo, Object.keys(CAPAS))}`);
    const dyn = esDinamico(c), p = {};
    if (dyn || (c.anim && Object.keys(c.anim).length) || def.reactiva || c.tipo === 'codigo') animado = true;
    if (c.tipo === 'codigo') codigos.push({ archivo: c.archivo, maxMs: typeof c.maxMs === 'number' ? c.maxMs : 30, capa: c, eventos: spec.eventos ?? [] });
    for (const [k, d] of Object.entries(def.params)) { const raw = c[k] !== undefined ? c[k] : d.def; p[k] = dyn && k !== 'id' ? clampTipo(d, resolver(raw, d.type, getEnv())) : raw; }
    const ev = (k, dflt) => { const s = c.anim?.[k]; return s == null ? dflt : typeof s === 'number' ? s : compile(String(s)).fn({ sig: () => 0, ...env0 }); };
    const seed = (hashStr(`${seed0}:${c.id}`) + (c.semilla | 0) * 104729 + i * 31) | 0, par = p.paralaje ?? def.paralaje;
    const drv = p.deriva ?? [0, 0], dx = drv[0] * m * t + ev('dx', 0) * m, dy = drv[1] * m * t + ev('dy', 0) * m;
    const alpha = clamp((p.alfa ?? 1) * ev('alfa', 1) * (E.alfa ?? 1)), esc = ev('escala', 1);
    if (alpha <= 0.002) return;
    let spMemo = null;
    const L = {
      W, H, k: E.k ?? 1, t, lt, u: env0.u, X0: (-(PAD - 1) / 2) * W, Y0: (-(PAD - 1) / 2) * H, WW: PAD * W, HH: PAD * H, seed, dx, dy, alpha, palKey, hex, paletaOrdenada: () => ord, dyn,
      // clave ESTRUCTURAL de los params (sin colores ni comunes): los memos no se invalidan por cambiar de color o de opacidad
      get sp() { return spMemo ??= JSON.stringify(Object.entries(def.params).filter(([k]) => !COMUNES_K.has(k)).map(([k, d]) => (d.type === 'color' ? 0 : d.type === 'colores' ? (p[k] ?? []).length : p[k]))); },
      get env() { return getEnv(); }, get eventos() { return getEnv().eventos; }, codigo: E.codigo, capa: c, pal: E.pal, beat: () => getEnv().beat,
      tex(key, tw, th, build) { const kk = `${key}|${W}x${H}`; let cv = cache.get(kk); if (!cv) { cv = E.canvas(tw, th); build(cv.getContext('2d')); cache.set(kk, cv); } return cv; },
      texDin(tw, th, build) { const kk = `din|${i}|${c.id}|${W}x${H}|${tw}x${th}`; let cv = cache.get(kk); if (!cv) { cv = E.canvas(tw, th); cache.set(kk, cv); } const g = cv.getContext('2d'); g.clearRect(0, 0, tw, th); build(g); return cv; },
      memo(key, fn) { const kk = `m|${key}`; let v = cache.get(kk); if (!v) { v = fn(); cache.set(kk, v); } return v; },
    };
    E.depth(par, () => {
      ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = MEZCLAS[p.mezcla] ?? 'source-over';
      if (esc !== 1) { ctx.translate(W / 2, H / 2); ctx.scale(esc, esc); ctx.translate(-W / 2, -H / 2); }
      if (def.deriva === 'trans') ctx.translate(dx, dy);
      def.draw(ctx, p, L); ctx.restore();
    });
  });
  return { familia: familiaFondo(spec), preset: spec.preset ?? null, ajustado: ajustadoFondo(spec), animado, codigos };   // el lint (spec 021 §D) lo lee de api.meta
}
// ¿alguna capa/valor del fondo varía con el relato? (spec 021 §D: valores animados, anim, capas reactivas o código propio)
export function fondoAnimado(spec) {
  let capas; try { capas = resolveFondo(spec).capas; } catch { return false; }
  return capas.some((c) => esDinamico(c) || (c.anim && Object.keys(c.anim).length) || CAPAS[c.tipo]?.reactiva || c.tipo === 'codigo');
}
// Familia del fondo (para el lint): el preset, o la lista de tipos de capa si es propio.
export const familiaFondo = (spec) => spec.preset != null ? `preset:${spec.preset}` : `capas:${(spec.capas ?? []).map((c) => c.tipo).join('+')}`;
export const ajustadoFondo = (spec) => !!(Object.keys(spec.ajustes ?? {}).length || (spec.sin ?? []).length || (spec.capas ?? []).length || (spec.eventos ?? []).length);
export const listaPresets = () => Object.entries(PRESETS).map(([id, p]) => ({ id, ...p }));
// Receta de DERIVACIÓN de un preset (spec 021 §D): `tools show <preset>` enseña a cambiarlo, no solo a usarlo. Todo se genera de las capas reales del preset.
export function derivarPreset(id) {
  const P = PRESETS[id], ids = P.capas.map((c) => c.id), colorCapa = P.capas.find((c) => typeof c.color === 'string' && CAPAS[c.tipo]?.params.color) ?? P.capas.find((c) => CAPAS[c.tipo]?.params.alfa) ?? P.capas[0];
  const ref = typeof colorCapa.color === 'string' ? colorCapa.color : '#556677', ult = ids[ids.length - 1];
  return [
    `ajustes (retocar capas por id; ids: ${ids.join(' ')}): {"type":"fondo","preset":"${id}","ajustes":{"${colorCapa.id}":{"alfa":0.5}}}`,
    `keyframes (un color que cambia con el relato; "en" ancla al beat/cue/impacto): {"type":"fondo","preset":"${id}","ajustes":{"${colorCapa.id}":{"color":{"k":[[-1,"${ref}"],[1.5,"#bcd8ee"]],"en":"giro"}}}}`,
    `expresión (cualquier número en función de t, u, beat o de los eventos): "alfa":{"expr":"0.4+0.3*sin(t*2)"}  ·  "intensidad":{"expr":"0.2+0.8*pulso('impacto',0.4)"}`,
    `sin (quitar capas): {"type":"fondo","preset":"${id}","sin":["${ult}"]}`,
    `capas (añadir encima, también reactivas o código propio): {"type":"fondo","preset":"${id}","capas":[{"tipo":"onda","evento":"impacto"},{"tipo":"codigo","archivo":"fondos/mio.mjs"}]}`,
    'punto de partida, no destino: si el tema es otro, parte de {"capas":[…]} con tus propias capas',
  ];
}
// META para el índice de herramientas (spec 015 §4): capas + presets + la guía de fondos libres; subtipo distingue capa de preset
export const META = [
  ...Object.values(CAPAS).map((c) => ({ id: c.tipo, subtipo: 'capa', resumen: c.resumen, tags: c.tags, params: paramsTB(c.params), cuando: `capa de fondo (${c.familia}): ${c.resumen}`, ejemplo: c.tipo === 'codigo' ? '{"tipo":"codigo","archivo":"fondos/mio.mjs","params":{"n":40}}' : c.reactiva ? `{"tipo":"${c.tipo}","evento":"impacto"}` : `{"tipo":"${c.tipo}"}` })),
  ...Object.entries(PRESETS).map(([id, p]) => ({ id, subtipo: 'preset', resumen: p.resumen, tags: p.tags, params: { semilla: 'integer', ajustes: 'json', sin: 'json', capas: 'json' }, cuando: p.porque, ejemplo: `{"type":"fondo","preset":"${id}","ajustes":{…}}`, derivar: derivarPreset(id) })),
  { id: 'fondo_libre', subtipo: 'guia', resumen: 'Fondo que cambia con el relato: valores animados, capas reactivas y código propio.', tags: ['fondo', 'libre', 'animar', 'keyframes', 'reactivo', 'codigo', 'color', 'impacto'], params: { eventos: 'json', capas: 'json' },
    cuando: 'Cuando el vocabulario de capas no alcanza o el fondo debe vivir con el relato (turbio→claro en el giro, sacudirse con un impacto). Cualquier parámetro admite {expr} o keyframes {k,ease,eje,en}; capas onda/mancha/pulso reaccionan a eventos; codigo = función propia (ctx,t,E) en shots/fondos/.',
    ejemplo: '{"type":"fondo","capas":[{"tipo":"degradado","stops":[{"k":[[-1,"#6b7a68"],[1.5,"#bcd8ee"]],"en":"giro"},"paper"]},{"tipo":"onda","evento":"impacto"}],"eventos":[{"id":"giro","at":6}]}',
    derivar: ['valor animado: {"expr":"…"} o {"k":[[x,v],…],"ease":"smooth","eje":"lt|t|u|beat","en":"giro"}  (colores interpolan en OKLab)', 'eventos del film: sfx impact, nodos impact y cues de escena, beats del story (b1…), o fondo.eventos:[{id,tipo,at,x,y}]', 'capas reactivas: onda, mancha, pulso (parámetro evento); funciones pulso/desde/hasta/paso/cuenta en expresiones', 'código propio: shots/fondos/<n>.mjs, export default function (ctx, t, E); mismo sandbox y guardia que un shot'] },
];
