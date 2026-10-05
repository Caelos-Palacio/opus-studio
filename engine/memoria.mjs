#!/usr/bin/env node
// Memoria conceptual: lo que un humano piensa cuando RECUERDA el film (no un resumen de fotogramas).
// Conceptos que coexisten, se refuerzan, se olvidan y se reinterpretan unos a otros. El índice de píxeles
// (engine/index.mjs) es la capa OBSERVADA; esta es la capa CONCEPTUAL y nunca se mezclan.
//
//   node engine/memoria.mjs en <t>            qué recuerda/cree/espera el espectador en t
//   node engine/memoria.mjs final             memoria al final (todas las reinterpretaciones aplicadas)
//   node engine/memoria.mjs por qué <id>      causas, lecturas (en vivo vs. recordada), giros, anclas y ops que genera
//   node engine/memoria.mjs reinterpreta      giros retroactivos: qué lectura del pasado cambia y cuándo
//   node engine/memoria.mjs lint              lint conceptual (exit 1 si hay FIX)
//   node engine/memoria.mjs capa [--write [ruta]] [--check]   dirección: estado conceptual → capa de overrides (JSON Patch)
//   opciones: --mem data/memoria.json  --timeline X  --json
//
// Todo es puro y determinista (sin reloj, sin azar): misma memoria + mismo timeline → mismos bytes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { validate, suggest } from './schema.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const MEMORIA_SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/memoria.schema.json'), 'utf8'));
export const ROLES = MEMORIA_SCHEMA.$defs.rol.enum;
const DEF = { vidaMedia: 2, piso: 0.08, umbral: 0.15 };
const EPS = 1e-6, r3 = (v) => Math.round(v * 1000) / 1000, clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmt = (x) => (Array.isArray(x) ? `[${x.map((v) => r3(v)).join(',')}]` : typeof x === 'number' ? String(r3(x)) : String(x));

// ── carga ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export function canonical(v) {                                       // JSON con claves ordenadas (hash/diff estables)
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
export const memHash = (mem) => crypto.createHash('sha256').update(canonical(mem)).digest('hex').slice(0, 16);
export function loadMemoria(file = process.env.OPUS_MEMORIA ?? 'data/memoria.json') {
  const f = path.resolve(ROOT, file);
  return { mem: JSON.parse(fs.readFileSync(f, 'utf8')), file: path.relative(ROOT, f) };
}
export const validateMemoria = (mem) => validate(mem, MEMORIA_SCHEMA).map((e) => ({ level: e.level, id: '-', problem: `${e.path}: ${e.message}`, remedy: e.remedy, kind: 'schema' }));

// Contexto del film: shots, entidades y parámetros que existen (para verificar punteros). Solo lee datos y escanea
// el texto de los shots; nunca ejecuta su código (la guardia E7 sigue siendo la única puerta de ejecución).
export function contexto(mem, { timeline, root = ROOT } = {}) {
  const tf = timeline ?? mem.timeline ?? process.env.OPUS_TIMELINE ?? 'data/timeline.json';
  const tl = typeof tf === 'object' ? tf : JSON.parse(fs.readFileSync(path.resolve(root, tf), 'utf8'));
  const shots = (tl.shots ?? []).map((s) => ({ id: s.id, t: s.t }));
  const entities = new Set([...(tl.handoffs ?? []).map((h) => h.entity), ...(tl.motif?.states ?? []), ...(tl.shots ?? []).map((s) => s.motifState)].filter(Boolean));
  const params = new Map();                                            // shot → Map(nombre → {default})
  for (const s of tl.shots ?? []) {
    const m = new Map();
    for (const [k, v] of Object.entries(s.params ?? {})) m.set(k, { default: typeof v === 'number' ? v : v?.default });
    const src = path.join(root, 'shots', s.id + '.mjs');
    if (fs.existsSync(src)) { const code = fs.readFileSync(src, 'utf8'); for (const e of blockKeys(code, 'entities')) entities.add(e); for (const k of blockKeys(code, 'params')) if (!m.has(k)) m.set(k, {}); }
    if (m.size) params.set(s.id, m);
  }
  return { duration: mem.duracion ?? tl.duration ?? Math.max(0, ...shots.map((s) => s.t[1])), shots, entities, params, timeline: typeof tf === 'string' ? tf : '(objeto)' };
}
// Claves de primer nivel de `nombre: { … }` o `const nombre = { … }` en el código de un shot (escáner de llaves, sin evaluar).
function blockKeys(code, name) {
  const out = [], re = new RegExp(`\\b${name}\\s*[:=]\\s*\\{`, 'g'); let m;
  while ((m = re.exec(code))) {
    const segs = []; let depth = 1, cur = '';                           // trozos separados por comas de nivel 1
    for (let i = m.index + m[0].length; i < code.length && depth > 0; i++) {
      const c = code[i];
      if ('{[('.includes(c)) depth++; else if ('}])'.includes(c)) depth--;
      if (depth === 1 && c === ',') { segs.push(cur); cur = ''; } else if (depth > 0) cur += c;
    }
    segs.push(cur);
    for (const sg of segs) { const k = /^\s*['"]?([A-Za-z_$][\w$]*)['"]?\s*(?:[:(]|$)/.exec(sg); if (k) out.push(k[1]); }   // clave:, método(), shorthand
  }
  return [...new Set(out)];
}

// ── modelo ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const byId = (mem) => new Map(mem.conceptos.map((c) => [c.id, c]));
const cfg = (mem) => ({ ...DEF, ...(mem.memoria ?? {}) });
const shotOf = (ctx, id) => ctx?.shots.find((s) => s.id === id);
const paramShot = (p) => /^\/shots\/([^/]+)\/params\/([^/]+)$/.exec(p)?.slice(1) ?? [null, null];
// Presencia en pantalla: tramos de anclas (shot, t, entidad con shot). Los params son mandos, no presencia.
function presencia(c, ctx) {
  const out = [];
  for (const a of c.anclas ?? []) {
    if (a.param && !a.shot && !a.t) continue;
    const s = a.shot ? shotOf(ctx, a.shot) : null;
    if (a.t) out.push(s ? [Math.max(a.t[0], s.t[0]), Math.min(a.t[1], s.t[1])] : a.t);
    else if (s) out.push(s.t);
  }
  const iv = out.filter((x) => x[1] >= x[0]).sort((a, b) => a[0] - b[0]), u = [];      // unión: dos anclas al mismo plano son UNA huella
  for (const x of iv) { const l = u[u.length - 1]; if (l && x[0] <= l[1] + EPS) l[1] = Math.max(l[1], x[1]); else u.push([...x]); }
  return u;
}
// Instantes de refuerzo: explícitos + relaciones percibidas + giros (un giro hace RECORDAR el pasado: refuerza al objetivo).
function refuerzos(mem, c) {
  const pts = [...(c.refuerzos ?? [])];
  for (const r of mem.relaciones ?? []) if (r.t != null && (r.de === c.id || r.a === c.id)) pts.push(r.t);
  for (const g of mem.reinterpretaciones ?? []) if (g.objetivo === c.id || g.por === c.id) pts.push(g.en);
  if (c.resuelve) pts.push(c.resuelve.t);
  for (const q of mem.conceptos) if (q.resuelve?.por === c.id) pts.push(q.resuelve.t);
  return pts.sort((a, b) => a - b);
}
export function primeraVez(mem, c, ctx) {
  const ts = [...presencia(c, ctx).map((x) => x[0]), ...(c.refuerzos ?? []), ...(c.estados ?? []).map((e) => e.t[0])];
  if (c.abre != null) ts.push(c.abre);
  return ts.length ? Math.min(...ts) : null;
}
const abierta = (c, t) => (c.kind === 'pregunta' || c.kind === 'tensión') && c.abre != null && t >= c.abre && !(c.resuelve && t >= c.resuelve.t);

// Peso de memoria de un concepto en t ∈ [0,1]. Cada huella i aporta s·2^(−Δ/h) (Δ = tiempo desde la última vez que
// se vio/nombró); las huellas se combinan como probabilidades independientes de recordar: 1 − Π(1 − cᵢ).
// Por eso reaparecer REFUERZA (dos huellas pesan más que una) y el olvido es suave. Lo visto no baja de piso·s.
// Una pregunta abierta no decae (efecto Zeigarnik): pesa s mientras siga abierta.
export function peso(mem, id, t, ctx) {
  const c = typeof id === 'string' ? byId(mem).get(id) : id, K = cfg(mem), s = c.saliencia ?? 0.8, h = c.vidaMedia ?? K.vidaMedia;
  let keep = 1;
  for (const [a, b] of presencia(c, ctx)) if (t >= a - EPS) keep *= 1 - s * 2 ** (-(t - Math.min(t, b)) / h);
  for (const p of refuerzos(mem, c)) if (t >= p - EPS) keep *= 1 - s * 2 ** (-(t - p) / h);
  let w = 1 - keep;
  const f = primeraVez(mem, c, ctx);
  if (f != null && t >= f - EPS) w = Math.max(w, K.piso * s);
  if (abierta(c, t)) w = Math.max(w, s);
  return r3(clamp(w, 0, 1));
}

// Lecturas. `vivo` = lo que el espectador cree EN t; `recuerdo` = cómo relee en t cada tramo pasado, aplicando los
// giros ocurridos hasta t (con t = duración: la memoria al final).
function lecturaViva(mem, c, t) {
  const est = (c.estados ?? []).filter((e) => e.t[0] <= t + EPS).sort((a, b) => a.t[0] - b.t[0]).pop() ?? null;
  const giro = giros(mem).filter((g) => g.objetivo === c.id && g.en <= t + EPS && (!est || g.en >= est.t[0] - EPS)).pop();
  if (giro) return { lectura: giro.despues, por: giro.id };              // el giro sustituye lectura y expectativa viejas
  if (c.resuelve && t >= c.resuelve.t - EPS) return { lectura: `resuelta por «${c.resuelve.por}»${est ? ` (era: ${est.lectura})` : ''}` };
  if (!est) return { lectura: c.label };                                  // sin estados declarados: se recuerda por su nombre
  const vigente = t <= est.t[1] + EPS;                                     // la expectativa caduca con su tramo; la lectura se recuerda
  return { lectura: est.lectura, ...(vigente && est.siente ? { siente: est.siente } : {}), ...(vigente && est.espera ? { espera: est.espera } : {}) };
}
const giros = (mem) => [...(mem.reinterpretaciones ?? [])].sort((a, b) => a.en - b.en || a.id.localeCompare(b.id));
const solapa = (a, b) => a[0] < b[1] - EPS && b[0] < a[1] - EPS;
export function recuerdo(mem, t) {
  const out = [];
  for (const c of mem.conceptos) {
    const gs = giros(mem).filter((g) => g.objetivo === c.id && g.en <= t + EPS);
    for (const e of c.estados ?? []) {
      if (e.t[0] > t + EPS) continue;
      const g = gs.filter((x) => solapa(x.tramo, e.t)).pop();
      out.push({ concepto: c.id, tramo: e.t, lectura: g ? g.despues : e.lectura, ...(g ? { antes: e.lectura, por: g.id, en: g.en } : {}) });
    }
    for (const g of gs) if (!(c.estados ?? []).some((e) => solapa(g.tramo, e.t))) out.push({ concepto: c.id, tramo: g.tramo, lectura: g.despues, antes: g.antes ?? null, por: g.id, en: g.en });
  }
  return out.sort((a, b) => a.tramo[0] - b.tramo[0] || a.concepto.localeCompare(b.concepto));
}

// estado(t): qué recuerda/espera el espectador en t.
export function estado(mem, t, ctx) {
  const K = cfg(mem), activos = [];
  for (const c of mem.conceptos) {
    const w = peso(mem, c, t, ctx); if (w < K.umbral) continue;
    const v = lecturaViva(mem, c, t);
    activos.push({ id: c.id, label: c.label, kind: c.kind, peso: w, ...(v ?? {}) });
  }
  activos.sort((a, b) => b.peso - a.peso || a.id.localeCompare(b.id));
  const preguntas = mem.conceptos.filter((c) => abierta(c, t)).map((c) => ({ id: c.id, label: c.label, abre: c.abre, resuelve: c.resuelve?.t ?? null }));
  const espera = activos.filter((a) => a.espera).map((a) => ({ concepto: a.id, espera: a.espera }));
  const gs = giros(mem);
  return {
    t: r3(t), activos, preguntas, espera,
    recuerdo: recuerdo(mem, t).filter((r) => r.por),                    // solo lo releído (el resto = lectura en vivo)
    vigentes: gs.filter((g) => g.en <= t + EPS).map((g) => g.id),
    // lo que el espectador AÚN no sabe: giros futuros que cambiarán algo que ya vio (ironía dramática del director)
    pendientes: gs.filter((g) => g.en > t + EPS && g.tramo[0] <= t + EPS).map((g) => ({ id: g.id, en: g.en, objetivo: g.objetivo, despues: g.despues })),
  };
}
export const final = (mem, ctx) => ({ ...estado(mem, ctx?.duration ?? mem.duracion ?? 0, ctx), recuerdo: recuerdo(mem, ctx?.duration ?? mem.duracion ?? Infinity) });

// por qué <concepto>: cadena causal hacia atrás + giros + lecturas + anclas.
export function porQue(mem, id, ctx) {
  const C = byId(mem), c = C.get(id);
  if (!c) { const s = suggest(id, [...C.keys()]); throw new Error(`concepto "${id}" no existe${s ? ` (¿"${s}"?)` : ''}`); }
  const rel = mem.relaciones ?? [], causas = [], seen = new Set([id]), q = [id];
  while (q.length) { const x = q.shift(); for (const r of rel) if (r.a === x && ['causa', 'depende', 'prepara', 'escala'].includes(r.tipo) && !seen.has(r.de)) { seen.add(r.de); q.push(r.de); causas.push({ de: r.de, tipo: r.tipo, a: x, why: r.why ?? '' }); } }
  return {
    id, label: c.label, kind: c.kind, primeraVez: primeraVez(mem, c, ctx),
    causas, efectos: rel.filter((r) => r.de === id).map((r) => ({ tipo: r.tipo, a: r.a, why: r.why ?? '' })),
    giros: giros(mem).filter((g) => g.objetivo === id || g.por === id),
    lecturas: (c.estados ?? []).map((e) => ({ tramo: e.t, vivo: e.lectura, recordada: recuerdo(mem, Infinity).find((r) => r.concepto === id && r.tramo === e.t)?.lectura ?? e.lectura })),
    anclas: c.anclas ?? [], resuelve: c.resuelve ?? null,
  };
}

// ── lint conceptual (verificable, no juicio) ─────────────────────────────────────────────────────────────────────────
// Issues con la forma del lint del motor: {level, id, t, problem, remedy, kind}.
export function lintMemoria(mem, ctx) {
  const out = validateMemoria(mem); if (out.some((x) => x.level === 'FIX')) return out;
  const I = (level, id, t, problem, remedy, kind) => out.push({ level, id, t: t == null ? null : r3(t), problem, remedy, kind });
  const C = byId(mem), ids = [...C.keys()], dur = ctx.duration, shotIds = ctx.shots.map((s) => s.id);
  const ref = (id, where, owner) => { if (C.has(id)) return true; const s = suggest(id, ids); I('FIX', owner, null, `${where}: concepto "${id}" no existe`, s ? `¿quisiste decir "${s}"?` : 'declararlo en conceptos', 'ref'); return false; };
  const seenIds = new Set();
  for (const c of mem.conceptos) { if (seenIds.has(c.id)) I('FIX', c.id, null, 'id de concepto duplicado', 'renombrar', 'ref'); seenIds.add(c.id); }
  const inT = (t) => t >= -EPS && t <= dur + EPS, inTramo = (x) => inT(x[0]) && inT(x[1]) && x[1] >= x[0];
  // punteros (compactación a punteros: todo identificador debe existir)
  for (const c of mem.conceptos) {
    (c.anclas ?? []).forEach((a, i) => {
      const w = `${c.id}.anclas[${i}]`;
      if (!a.shot && !a.t && !a.entidad && !a.param) I('FIX', c.id, null, `${w}: ancla vacía`, 'apuntar a shot | t | entidad | param', 'ancla');
      if (a.shot && !shotIds.includes(a.shot)) { const s = suggest(a.shot, shotIds); I('FIX', c.id, null, `${w}: ancla rota, shot "${a.shot}" no existe`, s ? `¿quisiste decir "${s}"?` : `shots: ${shotIds.join(' ')}`, 'ancla'); }
      if (a.t && !inTramo(a.t)) I('FIX', c.id, a.t[0], `${w}: tramo ${fmt(a.t)} fuera del film [0,${dur}]`, 'corregir t', 'ancla');
      if (a.entidad && !ctx.entities.has(a.entidad)) { const s = suggest(a.entidad, [...ctx.entities]); I('FIX', c.id, null, `${w}: ancla rota, entidad "${a.entidad}" no existe`, s ? `¿quisiste decir "${s}"?` : `entidades: ${[...ctx.entities].join(' ') || '—'}`, 'ancla'); }
      if (a.param) {
        const [sid, name] = paramShot(a.param);
        if (!shotIds.includes(sid)) { const s = suggest(sid, shotIds); I('FIX', c.id, null, `${w}: ancla rota, ${a.param}: shot "${sid}" no existe`, s ? `¿quisiste decir "${s}"?` : 'corregir ruta', 'ancla'); }
        else if (ctx.params.has(sid)) { if (!ctx.params.get(sid).has(name)) { const s = suggest(name, [...ctx.params.get(sid).keys()]); I('FIX', c.id, null, `${w}: ancla rota, ${a.param}: el shot no expone "${name}"`, s ? `¿quisiste decir "${s}"?` : `params de ${sid}: ${[...ctx.params.get(sid).keys()].join(' ')}`, 'ancla'); } }
        else I('WARN', c.id, null, `${w}: ${a.param} no verificable: ${sid} aún no expone params`, 'exponer params en el shot (docs/PARAMS.md); hasta entonces la capa no se aplica ahí', 'ancla');
        if (a.rango && a.rango[0] > a.rango[1]) I('FIX', c.id, null, `${w}: rango invertido ${fmt(a.rango)}`, '[min,max]', 'ancla');
      }
    });
    for (const e of c.estados ?? []) if (!inTramo(e.t)) I('FIX', c.id, e.t[0], `estado ${fmt(e.t)} fuera del film`, 'corregir t', 'tiempo');
    // huérfano: nada en pantalla lo encarna ni nada lo conecta
    const conectado = (mem.relaciones ?? []).some((r) => r.de === c.id || r.a === c.id) || (mem.reinterpretaciones ?? []).some((g) => g.por === c.id || g.objetivo === c.id);
    if (!(c.anclas ?? []).length) I(conectado ? 'WARN' : 'FIX', c.id, null, `concepto huérfano: no está anclado a nada${conectado ? ' (solo vive en relaciones)' : ' ni relacionado'}`, 'anclarlo a un shot/tramo/entidad o quitarlo (coherencia: nada sin encarnación)', 'huerfano');
  }
  // relaciones y ciclos causales
  for (const r of mem.relaciones ?? []) { ref(r.de, `relación ${r.tipo}`, r.de); ref(r.a, `relación ${r.tipo}`, r.de); if (r.t != null && !inT(r.t)) I('FIX', r.de, r.t, `relación ${r.de}→${r.a} en t=${r.t} fuera del film`, 'corregir t', 'tiempo'); if (r.de === r.a) I('FIX', r.de, null, `relación ${r.tipo} de un concepto consigo mismo`, 'quitarla', 'ref'); }
  const causal = (mem.relaciones ?? []).filter((r) => ['causa', 'depende'].includes(r.tipo) && r.de !== r.a).map((r) => (r.tipo === 'depende' ? [r.a, r.de] : [r.de, r.a]));
  for (const cyc of ciclos(causal)) I('FIX', cyc[0], null, `ciclo causal: ${cyc.join(' → ')} → ${cyc[0]}`, 'romper el ciclo: una causa no puede depender de su efecto (usar "rima" o "reinterpreta" si es un eco)', 'ciclo');
  // reinterpretaciones = payoff: exigen un plant previo (el espectador vio el objetivo en el tramo, antes del giro)
  for (const g of giros(mem)) {
    if (!ref(g.por, `giro ${g.id}.por`, g.id) | !ref(g.objetivo, `giro ${g.id}.objetivo`, g.id)) continue;
    if (!inT(g.en) || !inTramo(g.tramo)) { I('FIX', g.objetivo, g.en, `giro ${g.id}: tiempos fuera del film`, 'corregir en/tramo', 'tiempo'); continue; }
    if (g.tramo[0] >= g.en - EPS) { I('FIX', g.objetivo, g.en, `giro ${g.id}: reinterpreta el futuro (tramo ${fmt(g.tramo)} no es anterior a t=${g.en})`, 'solo se relee lo ya visto: tramo < en', 'payoff'); continue; }
    const o = C.get(g.objetivo), vis = presencia(o, ctx).some((p) => solapa(p, [g.tramo[0], Math.min(g.tramo[1], g.en)])) || (o.refuerzos ?? []).some((p) => p >= g.tramo[0] - EPS && p < g.en) || (o.estados ?? []).some((e) => solapa(e.t, [g.tramo[0], Math.min(g.tramo[1], g.en)]));
    if (!vis) I('FIX', g.objetivo, g.en, `payoff sin setup: el giro ${g.id} (t=${g.en}) relee «${g.objetivo}» en ${fmt(g.tramo)}, pero el espectador nunca lo vio ahí`, `plantarlo antes: anclar «${g.objetivo}» a un shot/tramo dentro de ${fmt(g.tramo)}`, 'payoff');
    const pv = primeraVez(mem, C.get(g.por), ctx);
    if (pv != null && pv > g.en + EPS) I('WARN', g.por, g.en, `giro ${g.id}: «${g.por}» provoca el giro en t=${g.en} pero no aparece hasta t=${r3(pv)}`, `anclar «${g.por}» en t=${g.en}`, 'payoff');
  }
  // revelaciones sin setup
  for (const c of mem.conceptos.filter((x) => x.kind === 'revelación')) {
    const pv = primeraVez(mem, c, ctx) ?? Infinity, conSetup = giros(mem).some((g) => g.por === c.id) || (mem.relaciones ?? []).some((r) => r.de === c.id && ['revela', 'reinterpreta', 'resuelve'].includes(r.tipo) && C.has(r.a) && (primeraVez(mem, C.get(r.a), ctx) ?? Infinity) < pv);
    if (!conSetup) I('FIX', c.id, pv === Infinity ? null : pv, `payoff sin setup: revelación «${c.id}» no relee nada plantado antes`, 'declarar qué reinterpreta (reinterpretaciones) o qué revela (relación revela → concepto previo)', 'payoff');
  }
  // preguntas
  for (const c of mem.conceptos.filter((x) => x.kind === 'pregunta' || (x.kind === 'tensión' && x.abre != null))) {
    if (c.abre == null) { I('FIX', c.id, null, `pregunta «${c.id}» sin "abre"`, 'declarar cuándo se plantea', 'pregunta'); continue; }
    if (!c.resuelve) { if (!c.abiertaAPropósito) I('FIX', c.id, c.abre, `pregunta abierta nunca resuelta: «${c.label}» (abre t=${c.abre})`, 'declarar resuelve {t, por} o abiertaAPropósito: "<por qué>"', 'pregunta'); continue; }
    if (ref(c.resuelve.por, `pregunta ${c.id}.resuelve.por`, c.id)) {
      if (c.resuelve.t <= c.abre + EPS) I('FIX', c.id, c.abre, `pregunta «${c.id}» se resuelve antes de abrirse`, 'resuelve.t > abre', 'pregunta');
      if (c.resuelve.t > dur + EPS) I('FIX', c.id, c.abre, `pregunta abierta nunca resuelta: se resuelve en t=${c.resuelve.t}, después del final (${dur})`, 'resolver dentro del film', 'pregunta');
    }
  }
  // setups sin payoff (planta sin cosecha posterior)
  for (const c of mem.conceptos.filter((x) => x.planta)) {
    const pv = primeraVez(mem, c, ctx) ?? 0;
    const cosecha = giros(mem).some((g) => g.objetivo === c.id && g.en > pv) || (mem.relaciones ?? []).some((r) => (r.a === c.id || r.de === c.id) && ['revela', 'reinterpreta', 'resuelve', 'rima', 'prepara', 'escala'].includes(r.tipo) && (r.t == null || r.t > pv)) || mem.conceptos.some((q) => q.resuelve?.por === c.id);
    if (!cosecha) I('WARN', c.id, pv, `setup sin payoff: «${c.id}» está plantado y nada lo cosecha`, 'añadir un giro/rima/revelación posterior o quitar planta', 'setup');
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'FIX' ? -1 : 1) || String(a.id).localeCompare(String(b.id)) || a.problem.localeCompare(b.problem));
}
// Ciclos en un grafo dirigido (aristas [de,a]); cada ciclo una vez, rotado a su id mínimo → determinista.
function ciclos(edges) {
  const adj = new Map(); for (const [a, b] of edges) { if (!adj.has(a)) adj.set(a, []); adj.get(a).push(b); }
  for (const v of adj.values()) v.sort();
  const found = new Map(), color = new Map(), stack = [];
  const dfs = (u) => {
    color.set(u, 1); stack.push(u);
    for (const v of adj.get(u) ?? []) {
      if (color.get(v) === 1) { const cyc = stack.slice(stack.indexOf(v)), k = cyc.indexOf([...cyc].sort()[0]), rot = [...cyc.slice(k), ...cyc.slice(0, k)]; found.set(rot.join('>'), rot); }
      else if (!color.get(v)) dfs(v);
    }
    stack.pop(); color.set(u, 2);
  };
  for (const u of [...adj.keys()].sort()) if (!color.get(u)) dfs(u);
  return [...found.values()];
}

// ── dirección: estado conceptual → intenciones de edición → capa de overrides ─────────────────────────────────────
// Reglas DECLARATIVAS: datos (cuándo, a qué roles de parámetro, cuánto, por qué). El motor solo conoce 5 tipos de
// disparador cerrados; memoria.json puede re-parametrizar (mismo id), desactivar (off) o añadir reglas de esos tipos.
// Un concepto expone sus mandos con anclas {param, rol}; si una regla quiere actuar y no hay mando con ese rol, queda
// como INTENCIÓN sin parámetro (visible, nunca inventada).
export const REGLAS = [
  { id: 'escala-intensidad', cuando: 'escala', roles: ['intensidad', 'tamaño', 'ritmo'], ganancia: 0.5, prioridad: 20,
    why: '«{a}» escala «{de}» (paso {k}): {rol} ×{f} para que el salto se sienta' },
  { id: 'giro-eco', cuando: 'reinterpreta', roles: ['eco'], prioridad: 30,
    why: 'giro {giro} en t={en}: «{por}» relee «{objetivo}» {tramo} → callback visual a {shot} (fuerza {v}: el recuerdo había caído a {w})' },
  { id: 'giro-hold', cuando: 'reinterpreta', roles: ['hold'], valor: 0.6, prioridad: 25,
    why: 'giro {giro}: sostener {v}s para que el espectador relea «{objetivo}» antes de seguir' },
  { id: 'rima-eco', cuando: 'rima', roles: ['rima'], prioridad: 15,
    why: '«{a}» rima con «{de}»: repetir su forma/tiempo de {shot}' },
  { id: 'pregunta-retencion', cuando: 'pregunta', roles: ['retencion'], prioridad: 20,
    why: 'pregunta «{id}» abierta desde t={abre}: retener la respuesta hasta t={res} ({v}s dentro de {shot})' },
  { id: 'peso-enfasis', cuando: 'peso', roles: ['enfasis'], prioridad: 10,
    why: 'peso de memoria de «{id}» a mitad de {shot} = {v} (decae si no reaparece)' },
];
export function reglas(mem) {
  const m = new Map(REGLAS.map((r) => [r.id, { ...r }]));
  for (const r of mem.direccion?.reglas ?? []) m.set(r.id, { ...(m.get(r.id) ?? {}), ...r });
  return [...m.values()].filter((r) => !r.off && r.cuando && r.roles?.length && r.why).sort((a, b) => a.id.localeCompare(b.id));
}
const tpl = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v[k] == null ? `{${k}}` : fmt(v[k])));
const mandos = (c, roles) => (c?.anclas ?? []).filter((a) => a.param && roles.includes(a.rol)).sort((a, b) => a.param.localeCompare(b.param));
const shotEn = (ctx, t) => ctx.shots.filter((s) => t >= s.t[0] - EPS && t < s.t[1] - EPS).sort((a, b) => a.id.localeCompare(b.id))[0] ?? null;
function baseDe(a, ctx) { const [sid, n] = paramShot(a.param), d = ctx.params.get(sid)?.get(n)?.default; return a.base ?? (typeof d === 'number' ? d : 1); }

export function dirigir(mem, ctx) {
  const C = byId(mem), props = [], intenciones = [];
  const want = (regla, concepto, mando, value, vars) => {
    const why = tpl(regla.why, vars).slice(0, 240);
    if (!mando) { intenciones.push({ regla: regla.id, concepto, quiere: regla.roles.join('|'), why, sinParam: true }); return; }
    props.push({ op: 'add', path: mando.param, value: typeof value === 'number' ? r3(mando.rango ? clamp(value, mando.rango[0], mando.rango[1]) : value) : value, why, concepto, regla: regla.id, prioridad: regla.prioridad ?? 0 });
  };
  const firstShot = (c, tramo) => { const ps = (c.anclas ?? []).filter((a) => a.shot).map((a) => shotOf(ctx, a.shot)).filter(Boolean).sort((a, b) => a.t[0] - b.t[0] || a.id.localeCompare(b.id)); return (tramo ? ps.find((s) => solapa(s.t, tramo)) : null) ?? ps[0] ?? (tramo ? shotEn(ctx, tramo[0]) : null); };
  const rel = [...(mem.relaciones ?? [])].sort((a, b) => (a.t ?? 0) - (b.t ?? 0) || a.de.localeCompare(b.de) || a.a.localeCompare(b.a));
  for (const R of reglas(mem)) {
    if (R.cuando === 'escala') {
      const esc = rel.filter((r) => r.tipo === 'escala'), paso = (id, seen = new Set()) => { if (seen.has(id)) return 0; seen.add(id); const p = esc.filter((r) => r.a === id); return p.length ? 1 + Math.max(...p.map((r) => paso(r.de, seen))) : 0; };
      for (const r of esc) { const k = paso(r.a), ms = mandos(C.get(r.a), R.roles); if (!ms.length) want(R, r.a, null, null, { a: r.a, de: r.de, k, rol: R.roles.join('|'), f: 1 + (R.ganancia ?? 0.5) * k });
        for (const m of ms) { const f = 1 + (R.ganancia ?? 0.5) * k; want(R, r.a, m, baseDe(m, ctx) * f, { a: r.a, de: r.de, k, rol: m.rol, f }); } }
    } else if (R.cuando === 'reinterpreta') {
      for (const g of giros(mem)) {
        const o = C.get(g.objetivo), p = C.get(g.por); if (!o || !p) continue;
        const ms = mandos(p, R.roles), aqui = shotEn(ctx, g.en), ms2 = ms.filter((m) => !aqui || paramShot(m.param)[0] === aqui.id), src = firstShot(o, g.tramo);
        const w = peso(mem, o, g.en - 1e-3, ctx), v = R.valor ?? r3(clamp(1 - w, 0.2, 1)), vars = { giro: g.id, en: g.en, por: g.por, objetivo: g.objetivo, tramo: g.tramo, shot: src?.id ?? '—', v, w };
        if (!ms2.length) want(R, g.por, null, null, vars);
        for (const m of ms2) want(R, g.por, m, R.valor != null ? R.valor : [{ ref: src ? `/shots/${src.id}` : null, tramo: g.tramo, concepto: g.objetivo, giro: g.id, fuerza: v }], vars);
      }
    } else if (R.cuando === 'rima') {
      for (const r of rel.filter((x) => x.tipo === 'rima')) {
        const src = firstShot(C.get(r.de)), ms = mandos(C.get(r.a), R.roles), vars = { a: r.a, de: r.de, shot: src?.id ?? '—' };
        if (!ms.length) want(R, r.a, null, null, vars);
        for (const m of ms) want(R, r.a, m, [{ ref: src ? `/shots/${src.id}` : null, concepto: r.de }], vars);
      }
    } else if (R.cuando === 'pregunta') {
      for (const q of mem.conceptos.filter((c) => c.resuelve && c.abre != null)) {
        const ms = mandos(q, R.roles); if (!ms.length) { want(R, q.id, null, null, { id: q.id, abre: q.abre, res: q.resuelve.t, shot: shotEn(ctx, q.resuelve.t)?.id ?? '—', v: r3(q.resuelve.t - (shotEn(ctx, q.resuelve.t)?.t[0] ?? 0)) }); continue; }
        for (const m of ms) { const s = shotOf(ctx, paramShot(m.param)[0]), v = s ? clamp(q.resuelve.t - s.t[0], 0, s.t[1] - s.t[0]) : q.resuelve.t; want(R, q.id, m, v, { id: q.id, abre: q.abre, res: q.resuelve.t, shot: s?.id ?? '—', v }); }
      }
    } else if (R.cuando === 'peso') {
      for (const c of mem.conceptos) for (const m of mandos(c, R.roles)) { const s = shotOf(ctx, paramShot(m.param)[0]); if (!s) continue; const v = peso(mem, c, (s.t[0] + s.t[1]) / 2, ctx); want(R, c.id, m, v, { id: c.id, shot: s.id, v }); }
    }
  }
  // Una ruta, un valor. Misma regla → se funden (callbacks: lista; mismo valor: se juntan los why). Reglas distintas en
  // la misma ruta = conflicto: gana más prioridad; empate → id de regla, concepto, why (determinista). El perdedor se informa.
  props.sort((a, b) => a.path.localeCompare(b.path) || b.prioridad - a.prioridad || a.regla.localeCompare(b.regla) || a.concepto.localeCompare(b.concepto) || a.why.localeCompare(b.why));
  const ops = [], conflictos = [];
  for (const p of props) {
    const { prioridad, ...op } = p, prev = ops.find((o) => o.path === p.path);
    if (!prev) { ops.push(op); continue; }
    if (prev.regla === op.regla && Array.isArray(prev.value) && Array.isArray(op.value)) { prev.value = [...prev.value, ...op.value]; prev.why = `${prev.why} | ${op.why}`.slice(0, 480); if (prev.concepto !== op.concepto) prev.concepto = `${prev.concepto}+${op.concepto}`; }
    else if (prev.regla === op.regla && canonical(prev.value) === canonical(op.value)) { if (!prev.why.includes(op.why)) prev.why = `${prev.why} | ${op.why}`.slice(0, 480); }
    else conflictos.push({ path: p.path, gana: prev.regla + ':' + prev.concepto, pierde: op.regla + ':' + op.concepto, why: op.why });
  }
  intenciones.sort((a, b) => a.regla.localeCompare(b.regla) || a.concepto.localeCompare(b.concepto) || a.why.localeCompare(b.why));
  return { capa: { name: 'memoria', priority: mem.direccion?.prioridad ?? 40, ops }, intenciones, conflictos };
}
export const capaJSON = (capa) => JSON.stringify(capa, null, 1) + '\n';

// ── CLI ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function cli() {
  const argv = process.argv.slice(2), opt = (k) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null; };
  const J = argv.includes('--json'), flags = new Set(['--mem', '--timeline', '--write']);
  const pos = argv.filter((a, i) => !a.startsWith('--') && !flags.has(argv[i - 1]));
  const { mem, file } = loadMemoria(opt('--mem') ?? undefined), sch = validateMemoria(mem).filter((x) => x.level === 'FIX');
  if (sch.length) { console.error(`${file} no valida data/memoria.schema.json:\n` + sch.map((x) => `  FIX  ${x.problem}  →  ${x.remedy}`).join('\n')); process.exit(1); }
  const ctx = contexto(mem, { timeline: opt('--timeline') ?? undefined }), say = (o, txt) => console.log(J ? JSON.stringify(o, null, 1) : txt);
  let [cmd = 'final', ...rest] = pos; if (cmd === 'por' && /^qu[eé]$/.test(rest[0] ?? '')) rest.shift(), (cmd = 'porque');
  const showEstado = (E) => [`t=${E.t}s · capa CONCEPTUAL (${file})`,
    ...E.activos.map((a) => `  ${String(a.peso.toFixed(2)).padStart(4)} ${a.kind.padEnd(10)} ${a.id.padEnd(12)} ${a.lectura ? `«${a.lectura}»` : ''}${a.por ? ` (releído por ${a.por})` : ''}${a.espera ? `  espera: ${a.espera}` : ''}`),
    E.preguntas.length ? '  preguntas abiertas: ' + E.preguntas.map((q) => `${q.id} (desde ${q.abre}s${q.resuelve != null ? `, se resuelve ${q.resuelve}s` : ''})`).join(' · ') : '  preguntas abiertas: —',
    ...E.recuerdo.filter((r) => r.por).map((r) => `  recuerda ${r.concepto} ${fmt(r.tramo)}: «${r.antes ?? '—'}» → «${r.lectura}»  [${r.por} @${r.en}s]`),
    ...E.pendientes.map((p) => `  aún no sabe: ${p.id} @${p.en}s cambiará «${p.objetivo}» → «${p.despues}»`)].join('\n');
  if (cmd === 'en') { const t = +rest[0]; if (!Number.isFinite(t)) throw new Error('uso: memoria en <t>'); const E = estado(mem, t, ctx); say(E, showEstado(E)); }
  else if (cmd === 'final') { const E = final(mem, ctx); say(E, showEstado(E) + '\n  memoria al final:\n' + E.recuerdo.map((r) => `    ${fmt(r.tramo).padEnd(10)} ${r.concepto.padEnd(12)} «${r.lectura}»${r.por ? `  (antes «${r.antes ?? '—'}», ${r.por})` : ''}`).join('\n')); }
  else if (cmd === 'porque' || cmd === 'por-que' || cmd === 'porqué') {
    const P = porQue(mem, rest[0], ctx), D = dirigir(mem, ctx), ops = D.capa.ops.filter((o) => o.concepto.split('+').includes(P.id)), it = D.intenciones.filter((i) => i.concepto === P.id), L = lintMemoria(mem, ctx).filter((i) => i.id === P.id);
    say({ ...P, ops, intenciones: it, lint: L }, [`${P.id} (${P.kind}) «${P.label}» · primera vez t=${P.primeraVez ?? '—'}`,
      ...P.causas.map((c) => `  ← ${c.tipo} ${c.de}${c.why ? `: ${c.why}` : ''}`), ...P.efectos.map((c) => `  → ${c.tipo} ${c.a}${c.why ? `: ${c.why}` : ''}`),
      ...P.lecturas.map((l) => `  ${fmt(l.tramo)} en vivo «${l.vivo}»${l.recordada !== l.vivo ? ` · recordado «${l.recordada}»` : ''}`),
      ...P.giros.map((g) => `  giro ${g.id} @${g.en}s: ${g.por} relee ${g.objetivo} ${fmt(g.tramo)}${g.why ? ` — ${g.why}` : ''}`),
      ...P.anclas.map((a) => `  ancla ${Object.entries(a).map(([k, v]) => `${k}=${fmt(v)}`).join(' ')}`),
      ...ops.map((o) => `  op ${o.path} = ${JSON.stringify(o.value)}  ← ${o.why}`), ...it.map((i) => `  intención sin parámetro (${i.quiere}): ${i.why}`),
      ...L.map((i) => `  ${i.level} ${i.problem}`)].join('\n'));
  } else if (cmd === 'reinterpreta') { const G = giros(mem); say(G, G.map((g) => `${g.id} @${g.en}s  «${g.por}» relee «${g.objetivo}» ${fmt(g.tramo)}\n    antes: «${g.antes ?? '—'}»\n    ahora: «${g.despues}»${g.why ? `\n    por qué: ${g.why}` : ''}`).join('\n') || '(sin reinterpretaciones)'); }
  else if (cmd === 'lint') { const L = lintMemoria(mem, ctx), nf = L.filter((x) => x.level === 'FIX').length; say({ verdict: nf ? 'FIX' : 'PASS', issues: L }, (L.map((i) => `${i.level.padEnd(4)} ${String(i.id).padEnd(12)} ${i.problem}  →  ${i.remedy}`).join('\n') || 'sin avisos') + `\nmemoria: ${nf ? `FIX (${nf})` : 'PASS'}`); process.exitCode = nf ? 1 : 0; }
  else if (cmd === 'capa') {
    const L = lintMemoria(mem, ctx).filter((x) => x.level === 'FIX'); if (L.length) { console.error(`lint conceptual en FIX (${L.length}): no se genera capa. node engine/memoria.mjs lint`); process.exit(1); }
    const D = dirigir(mem, ctx), txt = capaJSON(D.capa), wi = argv.indexOf('--write'), dest = wi >= 0 ? path.resolve(ROOT, opt('--write') ?? 'data/layers/memoria.json') : null;
    if (argv.includes('--check')) { const f = dest ?? path.join(ROOT, 'data/layers/memoria.json'), same = fs.existsSync(f) && fs.readFileSync(f, 'utf8') === txt; console.log(same ? `capa al día (${path.relative(ROOT, f)})` : `capa CADUCADA: ${path.relative(ROOT, f)} ≠ memoria actual → node engine/memoria.mjs capa --write`); process.exit(same ? 0 : 1); }
    if (dest) { const { writeAtomic } = await import('./lock.mjs'); fs.mkdirSync(path.dirname(dest), { recursive: true }); writeAtomic(dest, txt); }
    if (J) console.log(JSON.stringify(D, null, 1));
    else console.log([`capa "${D.capa.name}" prioridad ${D.capa.priority} · ${D.capa.ops.length} ops · hash memoria ${memHash(mem)}${dest ? ` → ${path.relative(ROOT, dest)}` : ''}`,
      ...D.capa.ops.map((o) => `  ${o.op} ${o.path} = ${JSON.stringify(o.value)}\n      ${o.regla} · ${o.concepto}: ${o.why}`),
      ...D.intenciones.map((i) => `  (intención sin parámetro) ${i.regla} · ${i.concepto}: ${i.why}`), ...D.conflictos.map((c) => `  conflicto ${c.path}: gana ${c.gana}, pierde ${c.pierde}`)].join('\n'));
  } else console.log('comandos: en <t> | final | por qué <id> | reinterpreta | lint | capa [--write [ruta]] [--check]   (--mem X --timeline X --json)');
}
if (import.meta.url === `file://${process.argv[1]}`) cli().catch((e) => { console.error(e.message); process.exit(1); });
