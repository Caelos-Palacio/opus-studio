// Spec 015 (toolbox): registro único de herramientas GENERADO del código + búsqueda local (BM25 + sinónimos del canon).
// Puro salvo carga de archivos (y la importación dinámica de módulos en build). Sin red ni LLM. Determinista.
//   buildRegistry({root}) → {entries, warnings}      search(entries, query, {k, kind, syn}) → [{entry, score}]
//   validateMeta(m)       → [problemas]              contrato `meta` de fondos/objetos (ver docs/specs/015-toolbox.md §4)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { VOCAB } from './vocab.mjs';
import { rootFrom } from './paths.mjs';

export const ROOT = rootFrom(import.meta.url);
export const INDEX_FILE = 'data/tools.index.json', META_FILE = 'data/tools.meta.json', EVAL_FILE = 'data/tools.eval.json';
export const KINDS = ['cli', 'prim', 'dsl', 'estilo', 'medio', 'sonido', 'voz', 'metrica', 'check', 'fondo', 'objeto', 'receta'];
export const PARAM_TYPES = ['number', 'integer', 'string', 'color', 'boolean', 'enum', 'json'];
export const tokens = (s) => Math.ceil(String(s).length / 4);
const rd = (root, p) => { try { return JSON.parse(fs.readFileSync(path.join(root, p), 'utf8')); } catch { return null; } };
const words = (s) => String(s ?? '').trim().split(/\s+/).filter(Boolean);
const clipW = (s, n) => { const w = words(s); return w.length <= n ? w.join(' ') : w.slice(0, n).join(' ') + '…'; };
const firstSentence = (s) => String(s ?? '').replace(/\s+/g, ' ').split(/(?<=[.])\s/)[0].replace(/[.]$/, "");

// ── contrato meta (fondos / objetos) ─────────────────────────────────────────────────────────────────────────────
export function validateMeta(m) {
  const p = [];
  if (!m || typeof m !== 'object') return ['la entrada no es un objeto'];
  if (typeof m.id !== 'string' || !/^[a-z][a-z0-9_-]*$/.test(m.id)) p.push('id: kebab/snake en minúsculas');
  if (typeof m.resumen !== 'string' || !m.resumen.trim()) p.push('resumen: texto obligatorio');
  else if (words(m.resumen).length > 15) p.push(`resumen: ${words(m.resumen).length} palabras (máx. 15)`);
  if (!Array.isArray(m.tags) || !m.tags.length || m.tags.some((t) => typeof t !== 'string' || t !== t.toLowerCase())) p.push('tags: array no vacío de strings en minúsculas');
  if (!m.params || typeof m.params !== 'object' || Array.isArray(m.params)) p.push('params: objeto {nombre: tipo}');
  else for (const [k, t] of Object.entries(m.params)) if (!PARAM_TYPES.includes(t)) p.push(`params.${k}: tipo "${t}" ∉ ${PARAM_TYPES.join('|')}`);
  return p;
}
// Módulos que pueden exponer META (la rama `fondos` decide cuál usa; todos opcionales).
export const META_MODULES = [['fondo', 'engine/fondos.mjs'], ['fondo', 'engine/fondos/index.mjs'], ['objeto', 'engine/objetos.mjs'], ['objeto', 'engine/objetos/index.mjs']];
async function loadExt(root, warnings) {
  const out = [];
  for (const [kind, rel] of META_MODULES) {
    const f = path.join(root, rel); if (!fs.existsSync(f)) continue;
    let mod; try { mod = await import(pathToFileURL(f).href); } catch (e) { warnings.push(`${rel}: no se pudo importar (${String(e.message).slice(0, 80)})`); continue; }
    const META = mod.META ?? mod.default?.META; if (!Array.isArray(META)) { warnings.push(`${rel}: sin export META (array)`); continue; }
    for (const m of META) {
      const bad = validateMeta(m); if (bad.length) { warnings.push(`${rel}: meta "${m?.id ?? '?'}" inválido (${bad.join('; ')})`); continue; }
      const k = m.kind && KINDS.includes(m.kind) ? m.kind : kind, ps = Object.entries(m.params).map(([n, t]) => `${n}:${t}`).join(', ');
      out.push({ id: `${k}:${m.id}`, kind: k, resumen: m.resumen, tags: m.tags, cuando: m.cuando ?? m.resumen, entra: ps || '—', sale: 'capa/objeto en el shot', ejemplo: m.ejemplo ?? `${k} ${m.id} {${ps}}`, ...(m.derivar ? { derivar: m.derivar } : {}), siguiente: m.siguiente, src: rel });
    }
  }
  return out;
}

// ── generación desde el código ──────────────────────────────────────────────────────────────────────────────────
function headerSummary(root, script) {
  try {
    const L = fs.readFileSync(path.join(root, script), 'utf8').split('\n').slice(1, 14);
    for (const l of L) { if (!l.startsWith('//')) break; const t = l.replace(/^\/\/\s*/, '').trim(); if (!t || /^(node|npm|--|\s*[→·])/.test(t) || /^[a-z-]+ ?\[/.test(t)) continue; return clipW(firstSentence(t), 22); }
  } catch {}
  return script;
}
function genCli(root) {
  const pkg = rd(root, 'package.json') ?? {}, cmds = rd(root, 'data/commands.json') ?? {}, out = [];
  for (const [name, val] of Object.entries(pkg.scripts ?? {})) {
    const m = /^node (\S+\.mjs)(.*)$/.exec(val), script = m?.[1] ?? null;
    out.push({ id: `cli:${name}`, kind: 'cli', resumen: script ? headerSummary(root, script) : val, tags: [name, ...(cmds[name] ? ['allowlist'] : [])], uso: `npm run ${name}${m && m[2].trim() ? '' : ''}`, cmd: `npm run ${name}`, src: 'package.json' });
  }
  return out;
}
async function genProms(root) {
  const out = [];
  try {
    const P = await import(pathToFileURL(path.join(root, 'engine/prims.mjs')).href); await import(pathToFileURL(path.join(root, 'engine/sakuga.mjs')).href).catch(() => {});
    for (const [name, d] of Object.entries(P.DOC)) out.push({ id: `prim:${name}`, kind: 'prim', resumen: clipW(firstSentence(d.text), 22), tags: [name], cuando: d.text, uso: d.sig, ejemplo: d.sig, src: 'engine/prims.mjs' });
  } catch (e) { return { out, warn: `prims: ${String(e.message).slice(0, 80)}` }; }
  return { out };
}
async function genDsl(root) {
  const out = [];
  try {
    const C = await import(pathToFileURL(path.join(root, 'engine/dsl-core.mjs')).href);
    for (const [name, t] of Object.entries(C.TYPES)) {
      const lib = t.props.includes('lib'), props = t.props.filter((p) => !['lib', 'fn', 'args', 'fields'].includes(p));
      out.push({ id: `dsl:${name}`, kind: 'dsl', resumen: `objeto DSL ${name}${lib ? ' (de librería: lib+fn)' : ''}: ${props.slice(0, 6).join(', ') || 'lib, fn'}`, tags: ['dsl', 'objeto', name], entra: `requeridas: ${t.req.join(', ') || '—'}; props: ${t.props.join(', ')}`, sale: t.out ? `publica ${t.out.join(', ')} como <id>_<campo>` : t.value ? 'valor' : 'dibuja', uso: `{"id":"x","type":"${name}",${t.req.slice(0, 3).map((r) => `"${r}":…`).join(',')}}`, ejemplo: `{"id":"x","type":"${name}",${t.req.slice(0, 3).map((r) => `"${r}":…`).join(',')}}`, src: 'engine/dsl-core.mjs' });
    }
  } catch (e) { return { out, warn: `dsl-core: ${String(e.message).slice(0, 80)}` }; }
  return { out };
}
function genJsonDir(root, dir, kind, skip = /^_/) {
  const d = path.join(root, dir); if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => f.endsWith('.json') && !skip.test(f)).sort().map((f) => {
    const j = rd(root, `${dir}/${f}`) ?? {}, id = path.basename(f, '.json');
    return { id: `${kind}:${id}`, kind, resumen: clipW(firstSentence(j.description ?? j.name ?? id), 22), tags: [id, ...(j.mood ?? [])], cuando: j.description ?? '', uso: kind === 'estilo' ? `style: "${id}" (timeline) · node engine/style.mjs --show ${id}` : kind === 'medio' ? `medio: "${id}"` : `sound.style: "${id}"`, src: `${dir}/${f}` };
  });
}
async function genVoces(root) {
  try { const S = await import(pathToFileURL(path.join(root, 'engine/sound.mjs')).href); return Object.entries(S.VOICES).map(([k, v]) => ({ id: `voz:${k}`, kind: 'voz', resumen: clipW(v.doc, 15), tags: [k, 'sfx', 'efecto'], cuando: v.doc, uso: `shot.sfx: [{at, type:"${k}", gain, pan, dur}]`, src: 'engine/sound.mjs' })); } catch { return []; }
}
async function genMetricas(root) {
  try { const R = await import(pathToFileURL(path.join(root, 'engine/metrics/registry.mjs')).href); return R.REGISTRY.map((m) => ({ id: `metrica:${m.id}`, kind: 'metrica', resumen: `${m.name} (${m.unit})`, tags: [m.domain, m.cls, ...m.id.split('.')], cuando: `${m.name}. ${m.source ?? ''}`, uso: 'npm run metrics', src: 'engine/metrics/registry.mjs' })); } catch { return []; }
}
function genChecks(root) {
  const V = rd(root, 'data/vocab.json')?.sections ?? {}, out = [];
  const spec = { 'lint.stage': (id) => `node engine/lint.mjs --only ${id}`, 'lint.rule': () => 'npm run lint', 'narr.check': () => 'npm run narr', 'arc.check': () => 'npm run arc' };
  for (const [sec, uso] of Object.entries(spec)) for (const t of V[sec]?.terms ?? []) out.push({ id: `check:${t.id}`, kind: 'check', resumen: clipW(firstSentence(t.def), 22), tags: [sec.split('.')[0], t.id], cuando: t.def, uso: uso(t.id), src: 'data/vocab.json' });
  return out;
}

// Recetas (spec 016): catálogo de data/recetas/ → receta:<id>. Tolerante: sin engine/recetas.mjs o sin recetas no hay entradas.
async function loadRecetas(root, warnings) {
  const f = path.join(root, 'engine/recetas.mjs'); if (!fs.existsSync(f) || !fs.existsSync(path.join(root, 'data/recetas'))) return [];
  try { return (await import(pathToFileURL(f).href)).entradasRegistro(root); } catch (e) { warnings.push(`recetas: ${String(e.message).slice(0, 80)}`); return []; }
}

// Fusiona generado + curado (overlay) → entradas completas y ordenadas.
const DEFAULT_COSTE = { cli: '~5 s; ~300 tok', prim: 'por fotograma; 0 tok', dsl: 'por fotograma; 0 tok', estilo: '0', medio: '0', sonido: 'mezcla 10–20 s', voz: '0', metrica: '~10–60 s por film', check: 'incluido en el lint', fondo: 'por fotograma', objeto: 'por fotograma', receta: 'copia ≤25 líneas; el agente solo llena huecos' };
const DEFAULT_NEXT = { prim: ['cli:lint'], dsl: ['cli:dsl.build'], estilo: ['cli:lint'], medio: ['cli:peek'], sonido: ['cli:sound'], voz: ['cli:sound'], metrica: ['cli:metrics'], check: ['cli:lint'], fondo: ['cli:peek'], objeto: ['cli:peek'], receta: ['check:receta.hueco'], cli: [] };
export async function buildRegistry({ root = ROOT } = {}) {
  const warnings = [], meta = rd(root, META_FILE) ?? {}, by = new Map();
  const add = (e) => { if (e && !by.has(e.id)) by.set(e.id, e); };
  genCli(root).forEach(add);
  const P = await genProms(root); P.out.forEach(add); if (P.warn) warnings.push(P.warn);
  const D = await genDsl(root); D.out.forEach(add); if (D.warn) warnings.push(D.warn);
  [...genJsonDir(root, 'styles', 'estilo'), ...genJsonDir(root, 'styles/medios', 'medio'), ...genJsonDir(root, 'styles/sound', 'sonido'), ...await genVoces(root), ...await genMetricas(root), ...genChecks(root), ...await loadExt(root, warnings), ...await loadRecetas(root, warnings)].forEach(add);
  for (const [id, x] of Object.entries(meta.extra ?? {})) add({ id, kind: id.split(':')[0], resumen: x.resumen, tags: [], uso: x.cmd ?? x.uso, cmd: x.cmd, src: x.script ?? 'data/tools.meta.json' });
  for (const [id, o] of Object.entries(meta.tools ?? {})) {
    const e = by.get(id); if (!e) { warnings.push(`tools.meta.json: id desconocido "${id}"`); continue; }
    const tags = [...new Set([...(e.tags ?? []), ...(o.tags ?? [])])];
    by.set(id, { ...e, ...o, tags });
  }
  const entries = [...by.values()].map((e) => {
    const kind = e.kind;
    const base = { id: e.id, kind, resumen: e.resumen, tags: [...new Set([...(e.tags ?? []), ...e.id.slice(kind.length + 1).split(/[.:_-]/)].filter(Boolean).map((t) => String(t).toLowerCase()))].sort(), cuando: e.cuando ?? e.resumen, entra: e.entra ?? '—', sale: e.sale ?? '—', coste: e.coste ?? DEFAULT_COSTE[kind] ?? '—', ejemplo: e.ejemplo ?? e.uso ?? e.cmd ?? '—', uso: e.uso ?? e.cmd ?? e.ejemplo ?? '—', siguiente: e.siguiente ?? DEFAULT_NEXT[kind] ?? [], fases: e.fases ?? [], ...(e.derivar ? { derivar: e.derivar } : {}), src: e.src };
    return base;
  }).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const ids = new Set(entries.map((e) => e.id));
  for (const e of entries) for (const s of e.siguiente) if (!ids.has(s)) warnings.push(`${e.id}: siguiente "${s}" no existe`);
  return { entries, warnings };
}
// Serialización estable: una entrada por línea (diffs pequeños).
export const serialize = (entries) => '[\n' + entries.map((e) => JSON.stringify(e)).join(',\n') + '\n]\n';

// ── búsqueda: BM25 + sinónimos ───────────────────────────────────────────────────────────────────────────────────
const STOP = new Set('de la el en y a los las un una unos unas para por con del al que se mi su sus lo es como qué cual cuál cómo hay sobre entre quiero necesito hacer me o u e no dice sé tu muy más mas cada tiene tengo'.split(' '));
export const fold = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const stem = (w) => { let x = fold(w).replace(/[^a-z0-9]/g, ''); if (x.length > 5) x = x.replace(/(aciones|iciones|ciones|cion|mente|ando|iendo|ados|idos|adas|idas|ado|ido|ar|er|ir|es|s)$/, (m) => (x.length - m.length >= 4 ? '' : m)); return x.slice(0, 6); };
export const tok = (s) => fold(s).split(/[^a-z0-9ñ]+/).filter((w) => w && !STOP.has(w)).map(stem).filter(Boolean);
// Grupos de sinónimos: curados (meta.sinonimos) + canon del vocabulario (id ↔ forbid).
export function synGroups(meta) {
  const G = (meta?.sinonimos ?? []).map((g) => g.map(String));
  for (const s of Object.values(VOCAB.sections)) for (const t of s.terms) if (t.forbid?.length) G.push([t.id, ...t.forbid]);
  return G.map((g) => [...new Set(g.flatMap((x) => tok(x)))]).filter((g) => g.length > 1);
}
export function makeIndex(entries) {
  const docs = entries.map((e) => {
    const parts = [[e.id.replace(/[:._-]/g, ' '), 3], [e.tags.join(' '), 3], [e.resumen, 2], [e.cuando, 2], [e.kind, 1], [e.entra, 1], [e.sale, 1], [e.ejemplo, 0.5]];
    const tf = new Map(); let len = 0;
    for (const [txt, w] of parts) for (const t of tok(txt)) { tf.set(t, (tf.get(t) ?? 0) + w); len += w; }
    return { e, tf, len };
  });
  const df = new Map(); for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  return { docs, df, N: docs.length, avg: docs.reduce((s, d) => s + d.len, 0) / Math.max(1, docs.length) };
}
export function search(entries, query, { k = 5, kind = null, groups = [], index = null } = {}) {
  const I = index ?? makeIndex(entries), q = new Map();
  for (const t of tok(query)) q.set(t, 1);
  for (const t of [...q.keys()]) for (const g of groups) if (g.includes(t)) for (const s of g) if (!q.has(s)) q.set(s, 0.5);
  const kinds = kind ? new Set(String(kind).split(',')) : null, K1 = 1.2, B = 0.75, out = [];
  for (const d of I.docs) {
    if (kinds && !kinds.has(d.e.kind)) continue;
    let sc = 0;
    for (const [t, w] of q) { const f = d.tf.get(t); if (!f) continue; const n = I.df.get(t) ?? 0, idf = Math.log(1 + (I.N - n + 0.5) / (n + 0.5)); sc += w * idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / I.avg))); }
    if (sc > 0) out.push({ entry: d.e, score: +sc.toFixed(4) });
  }
  return out.sort((a, b) => b.score - a.score || (a.entry.id < b.entry.id ? -1 : 1)).slice(0, k);
}
