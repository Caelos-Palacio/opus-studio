#!/usr/bin/env node
// Vocabulario controlado versionado (spec 006; research/10-rosetta.md: vocabulario cerrado + guardas deterministas, NO compresión por LLM).
//   node engine/vocab.mjs list [sección] | canon <palabra> | lint [--json] | sync | refs <original> <derivado>
// Fuente: data/vocab.json. Cada término = {id, def, forbid:[sinónimos prohibidos]}. Puro salvo carga/lint (fs).
import { isMain, rootFrom } from './paths.mjs';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = rootFrom(import.meta.url);
export const VOCAB = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/vocab.json'), 'utf8'));
export const VERSION = VOCAB.version;
const S = VOCAB.sections;
export const sections = () => Object.keys(S);
export const terms = (sec) => { if (!S[sec]) throw new Error(`vocab: sección desconocida "${sec}" (${sections().join(', ')})`); return S[sec].terms.map((t) => t.id); };
export const has = (sec, id) => !!S[sec]?.terms.some((t) => t.id === id);
export const group = (name) => { if (!VOCAB.groups[name]) throw new Error(`vocab: grupo desconocido "${name}"`); return VOCAB.groups[name]; };
const norm = (w) => String(w).toLowerCase().normalize('NFC').trim();
// palabra (canónica o prohibida) → id canónico, o null. sec opcional.
export function canon(word, sec) {
  const w = norm(word);
  for (const [name, s] of Object.entries(S)) { if (sec && name !== sec) continue;
    for (const t of s.terms) if (norm(t.id) === w || t.forbid?.some((f) => norm(f) === w)) return t.id; }
  return null;
}
export const suggestTerm = (word) => canon(word);

// ── lint de prosa: sinónimos prohibidos → canónico ──────────────────────────────────────────────────────────────
const FORBID = Object.entries(S).flatMap(([sec, s]) => s.terms.flatMap((t) => (t.forbid ?? []).map((f) => ({ sec, id: t.id, f: norm(f) }))));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const FORBID_RE = FORBID.map((x) => ({ ...x, re: new RegExp(`(?<![\\p{L}\\p{N}_])${esc(x.f)}(?![\\p{L}\\p{N}_])`, 'giu') }));
// Exentos: citas «…» “…” "…", código `…`, bloques ``` y líneas/trechos con <!-- vocab-ok -->.
function strip(line) {
  return line.replace(/`[^`]*`/g, (m) => ' '.repeat(m.length)).replace(/«[^»]*»|“[^”]*”|"[^"\n]*"/g, (m) => ' '.repeat(m.length));
}
export function lintText(text, { file = '-' } = {}) {
  const out = []; let fence = false;
  text.split('\n').forEach((raw, i) => {
    if (/^\s*```/.test(raw)) { fence = !fence; return; }
    if (fence || raw.includes('vocab-ok')) return;
    const line = strip(raw);
    for (const x of FORBID_RE) { x.re.lastIndex = 0; let m; while ((m = x.re.exec(line))) out.push({ file, line: i + 1, term: m[0], canonical: x.id, section: x.sec }); }
  });
  return out;
}
const SKIP_KEYS = new Set(['texto', 'id', 'shot', 'entidad', 'param', 'film', 'fuente', 'version', 'timeline', 'por', 'objetivo', 'de', 'a', 'kind', 'tipo', 'rol', 'cuando']);
function strings(v, key, acc) { if (typeof v === 'string') { if (!SKIP_KEYS.has(key)) acc.push(v); } else if (Array.isArray(v)) v.forEach((x) => strings(x, key, acc)); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) strings(x, k, acc); return acc; }
export function lintJson(obj, { file = '-' } = {}) { return strings(obj, '', []).flatMap((s) => lintText(s, { file })); }
// Valores enumerados de memoria con término no canónico (además del esquema: da el canónico propuesto).
export function lintMemoriaEnums(mem, { file = '-' } = {}) {
  const out = [], chk = (sec, v, where) => { if (v != null && !has(sec, v)) out.push({ file, line: 0, term: String(v), canonical: canon(v, sec) ?? canon(v), section: sec, where }); };
  for (const c of mem.conceptos ?? []) chk('concept.kind', c.kind, `conceptos/${c.id}`);
  for (const r of mem.relaciones ?? []) chk('relation.type', r.tipo, `relaciones/${r.id ?? ''}`);
  for (const c of mem.conceptos ?? []) for (const a of c.anclas ?? []) chk('memory.role', a.rol, `conceptos/${c.id}/anclas`);
  for (const r of mem.direccion?.reglas ?? []) { chk('rule.when', r.cuando, `reglas/${r.id}`); for (const x of r.roles ?? []) chk('memory.role', x, `reglas/${r.id}`); }
  return out;
}
const listFiles = (dir, re) => { const d = path.join(ROOT, dir); return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => re.test(f)).map((f) => path.join(dir, f)) : []; };
// Exentos del lint de vocab A PROPOSITO: data/anticliche.es.json (lista de sinonimos prohibidos y frases de poster) y data/ideas.md; ninguno esta en el corpus.
export const EXEMPT = ['data/anticliche.es.json', 'data/ideas.md'];
export function corpus(root = ROOT) {
  const dataDirs = ['data', ...fs.readdirSync(path.join(root, 'data'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => 'data/' + e.name)];
  const files = [...dataDirs.flatMap((d) => ['memoria.json', 'story.json'].map((f) => `${d}/${f}`)), 'data/notas.json', 'data/story.template.json'].filter((f) => fs.existsSync(path.join(root, f)));
  return [...files, ...listFiles('docs/specs', /\.md$/)];
}
export function lintRepo(root = ROOT) {
  const out = [];
  for (const f of corpus(root)) {
    const txt = fs.readFileSync(path.join(root, f), 'utf8');
    if (f.endsWith('.md')) out.push(...lintText(txt, { file: f }));
    else { let j; try { j = JSON.parse(txt); } catch { continue; } out.push(...lintJson(j, { file: f })); if (f.endsWith('memoria.json')) out.push(...lintMemoriaEnums(j, { file: f })); }
  }
  return out;
}

// ── guarda de referencias (Rosetta "reference invariant") ───────────────────────────────────────────────────────
// refs = ids de shot/puerta (A3, M08, K_tipo…), rutas (a/b.ext), hashes hex ≥8, y /ruta/de/param.
export function refsOf(text) {
  const s = String(text), R = new Set();
  for (const m of s.matchAll(/\b[0-9a-f]{8,64}\b/g)) if (/\d/.test(m[0])) R.add(m[0]);
  for (const m of s.matchAll(/(?<![\w/.])(?:[\w.-]+\/)+[\w.<>-]*[\w>]/g)) R.add(m[0]);
  for (const m of s.matchAll(/\b[A-Z][A-Z]?_?[A-Za-z]*\d{1,3}\b|\b[A-Z]_[a-z]\w*/g)) R.add(m[0]);
  return R;
}
export function referenceInvariant(original, derived, { ignore = [] } = {}) {
  const d = refsOf(derived), skip = new Set(ignore), missing = [...refsOf(original)].filter((r) => !skip.has(r) && !d.has(r)).sort();
  return { ok: !missing.length, missing, kept: d.size };
}

// ── clasificador de motivos de orquestación (texto libre → código cerrado; no cambia el texto) ──────────────────
const REASONS = [[/empeora/, 'worsens'], [/de verde a rojo/, 'check-regression'], [/FIX global sube/, 'fix-global-up'], [/no eres su escritor|no puede escribir/, 'not-writer'],
  [/dijo exit/, 'evidence-mismatch'], [/^inválida/, 'delivery-invalid'], [/^lint:/, 'lint-not-ship'], [/^crítico:/, 'critic-not-ship'], [/--force exige/, 'force-no-reason'], [/oscila|oscillation/, 'oscillation']];
export const reasonCode = (text) => REASONS.find(([re]) => re.test(String(text)))?.[1] ?? null;

// ── sync: regenera la sección metric desde el registry conservando definiciones/sinónimos editados ──────────────
export async function syncMetrics() {
  const { REGISTRY } = await import('./metrics/registry.mjs'), old = new Map(S.metric.terms.map((t) => [t.id, t]));
  S.metric.terms = REGISTRY.map((m) => ({ id: m.id, def: old.get(m.id)?.def ?? m.name, forbid: old.get(m.id)?.forbid ?? [] }));
  const f = path.join(ROOT, 'data/vocab.json'), txt = fs.readFileSync(f, 'utf8'), out = spliceTerms(txt, 'metric', S.metric.terms);
  if (out !== txt) fs.writeFileSync(f, out); return S.metric.terms.length;
}
// Reescribe SOLO el arreglo "terms" de una sección (indent 2, como el resto del archivo): el resto de bytes (líneas compactadas a mano) queda intacto.
export function spliceTerms(txt, sec, termList) {
  const a = txt.indexOf(`\n    "${sec}": {`), b = a < 0 ? -1 : txt.indexOf('\n      "terms": [', a), c = b < 0 ? -1 : txt.indexOf('\n      ]', b);
  if (c < 0) throw new Error(`vocab sync: no encuentro "terms" de la sección ${sec}`);
  const body = JSON.stringify(termList, null, 2).split('\n').map((l) => '      ' + l).join('\n').trimStart();
  return txt.slice(0, b) + '\n      "terms": ' + body + txt.slice(c + '\n      ]'.length);
}

if (isMain(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2), json = process.argv.includes('--json');
  if (cmd === 'list') { for (const sec of a ? [a] : sections()) console.log(`${sec} (${terms(sec).length}): ${terms(sec).join(' ')}`); }
  else if (cmd === 'canon') { const c = canon(a); console.log(c ?? '(no canónico)'); process.exit(c ? 0 : 1); }
  else if (cmd === 'lint') { const f = lintRepo(); if (json) console.log(JSON.stringify(f, null, 1)); else { for (const x of f) console.log(`${x.file}:${x.line}  «${x.term}» → ${x.canonical}`); console.log(`vocab v${VERSION}: ${f.length} hallazgos`); } process.exit(f.length ? 1 : 0); }
  else if (cmd === 'sync') console.log(`${await syncMetrics()} métricas`);
  else if (cmd === 'refs') { const r = referenceInvariant(fs.readFileSync(a, 'utf8'), fs.readFileSync(b, 'utf8')); console.log(r.ok ? 'OK referencias conservadas' : 'PÉRDIDA ' + r.missing.join(' ')); process.exit(r.ok ? 0 : 1); }
  else console.log('Uso: vocab.mjs list [sec] | canon <w> | lint [--json] | sync | refs <orig> <deriv>');
}
