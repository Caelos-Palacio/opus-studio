#!/usr/bin/env node
// Perfil de gusto (spec 022): data/gusto.md = reglas observables con origen + rúbrica del panel + notas humanas (sección generada).
//   node engine/gusto.mjs build [--notas data/notas.json] [--gusto data/gusto.md]   regenera la sección «Notas humanas» desde notas.json
//   node engine/gusto.mjs nota <film> "<texto>" [--nota 8] [--dim visual] [--version v] [--voz si|no]   añade una nota humana y regenera (G5)
//   node engine/gusto.mjs check                                                      valida formato de reglas y rúbrica
// Las notas se identifican por su posición en notas.json (N01, N02, …): el archivo solo crece por el final.
import './help.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GUSTO = path.join(ROOT, 'data/gusto.md'), NOTAS = path.join(ROOT, 'data/notas.json');
export const BEGIN = '<!-- notas:begin -->', END = '<!-- notas:end -->';
export const MIRADAS = ['director', 'ojo', 'esceptico'];
export const MIRADA_NOMBRE = { director: 'director', ojo: 'ojo', esceptico: 'escéptico' };
export const ORIGEN_RE = /^(N\d{2,}|spec \d{3}|research \d{2}|MODO-LIBRE|exp \d{4}-\d{2}-\d{2})$/;

/** director | ojo | escéptico | esceptico → clave canónica (sin tildes) o null. */
export const miradaKey = (m) => {
  const k = String(m ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return MIRADAS.includes(k) ? k : null;
};

export const idNota = (i) => 'N' + String(i + 1).padStart(2, '0');

/** «001/002» → «spec 001, spec 002»; «exp» → «exp 2026-10-11». */
const origenFuente = (f, id) => {
  const specs = String(f ?? '').match(/\d{3}/g)?.map((s) => `spec ${s}`) ?? [];
  if (f === 'exp') specs.push('exp 2026-10-11');
  return [id, ...specs].join(', ');
};

/** Reglas del markdown: [{id, texto, origen:[…], grupo}]. Una línea `- **ID** texto. _Origen: a, b_`. */
export function parseReglas(md) {
  const out = []; let grupo = '';
  for (const raw of md.split('\n')) {
    const h = raw.match(/^##\s+(.+)/); if (h) { grupo = h[1].trim(); continue; }
    const m = raw.match(/^- \*\*([A-Z]{1,2}\d{2,})\*\*\s+(.*?)\s*(?:_Origen:\s*(.*?)_)?\s*$/);
    if (m) out.push({ id: m[1], texto: m[2], origen: (m[3] ?? '').split(',').map((s) => s.trim()).filter(Boolean), grupo });
  }
  return out;
}

/** Valida reglas: id único, texto no vacío, ≥1 origen y todos de un tipo válido. Devuelve lista de errores. */
export function validarReglas(reglas) {
  const err = [], vistos = new Set();
  if (!reglas.length) err.push('no hay reglas');
  for (const r of reglas) {
    if (vistos.has(r.id)) err.push(`${r.id}: id repetido`); vistos.add(r.id);
    if (r.texto.length < 15) err.push(`${r.id}: texto demasiado corto`);
    if (!r.origen.length) err.push(`${r.id}: sin origen`);
    for (const o of r.origen) if (!ORIGEN_RE.test(o)) err.push(`${r.id}: origen inválido «${o}»`);
  }
  return err;
}

/** Rúbrica: {director:{historia:desc,…}, ojo:{…}, esceptico:{…}} leída de la sección «Rúbrica» (### mirada, - **criterio**: desc). */
export function parseRubrica(md) {
  const i = md.indexOf('## 8. Rúbrica'); const rub = {};
  if (i < 0) return rub;
  const fin = md.indexOf(BEGIN); let mir = null;
  for (const raw of md.slice(i, fin < 0 ? undefined : fin).split('\n')) {
    const h = raw.match(/^###\s+(.+)/); if (h) { mir = miradaKey(h[1]); if (mir) rub[mir] = {}; continue; }
    const m = raw.match(/^- \*\*([a-z_]+)\*\*:\s*(.+)/); if (m && mir) rub[mir][m[1]] = m[2];
  }
  return rub;
}

/** Texto de las reglas por mirada: grupos de la sección → mirada que las usa. */
export const GRUPOS_DE = {
  director: [/^1\./, /^2\./, /^5\./, /^7\./],
  ojo: [/^3\./, /^4\./],
  esceptico: [/^6\./, /^1\./],
};
export function reglasDeMirada(md, mirada) {
  const k = miradaKey(mirada), pats = GRUPOS_DE[k] ?? [];
  return parseReglas(md).filter((r) => pats.some((p) => p.test(r.grupo)));
}
export const fmtRegla = (r) => `- **${r.id}** ${r.texto} _Origen: ${r.origen.join(', ')}_`;

/** Sección generada desde notas.json. Las notas sin información («pendiente de calificación») no generan regla. */
export function seccionNotas(notas) {
  const L = ['## 9. Notas humanas (generado: `node engine/gusto.mjs build`)', '',
    'Cada línea es una observación del usuario sobre un film concreto. Aplícala como criterio general, no como receta de ese film.', ''];
  notas.forEach((n, i) => {
    if (!n.texto || /^pendiente/i.test(n.texto)) return;
    const id = n.id ?? idNota(i), meta = [n.film, n.version && n.version !== n.film ? n.version : null, n.dim, n.nota != null ? `nota ${n.nota}` : null, n.voz ? `¿voz? ${n.voz}` : null].filter(Boolean).join(' · ');
    L.push(`- **${id}** Aplicar: «${n.texto}» (${meta}). _Origen: ${origenFuente(n.fuente === 'usuario' ? '' : n.fuente, id)}_`);
  });
  return L.join('\n');
}

export function build({ notas = NOTAS, gusto = GUSTO } = {}) {
  const data = JSON.parse(fs.readFileSync(notas, 'utf8')); let md = fs.readFileSync(gusto, 'utf8');
  const a = md.indexOf(BEGIN), b = md.indexOf(END);
  if (a < 0 || b < a) throw new Error(`faltan los marcadores ${BEGIN} / ${END} en ${gusto}`);
  md = md.slice(0, a + BEGIN.length) + '\n' + seccionNotas(data.notas) + '\n' + md.slice(b);
  fs.writeFileSync(gusto, md);
  return { notas: data.notas.length, reglas: parseReglas(md).length };
}

/** G5: añade una nota humana al final de notas.json y regenera gusto.md. */
export function agregarNota({ film, texto, nota = null, dim = 'general', version = null, voz = null, notas = NOTAS, gusto = GUSTO, fecha = new Date().toISOString().slice(0, 10) }) {
  if (!film || !texto) throw new Error('uso: gusto.mjs nota <film> "<texto>"');
  const data = JSON.parse(fs.readFileSync(notas, 'utf8')), id = idNota(data.notas.length);
  const n = { id, film, version: version ?? film, dim, nota: nota == null ? null : Number(nota), texto, fuente: 'usuario', fecha, medible: false };
  if (voz) n.voz = voz;
  data.notas.push(n); fs.writeFileSync(notas, JSON.stringify(data, null, 2) + '\n');
  return { id, ...build({ notas, gusto }) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), cmd = argv[0], flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const pos = argv.slice(1).filter((a, i, v) => !a.startsWith('--') && !(v[i - 1] ?? '').startsWith('--'));
  const opt = { notas: flag('--notas', NOTAS), gusto: flag('--gusto', GUSTO) };
  try {
    if (cmd === 'build') console.log('gusto.md regenerado:', JSON.stringify(build(opt)));
    else if (cmd === 'nota') console.log('nota añadida:', JSON.stringify(agregarNota({ film: pos[0], texto: pos[1], nota: flag('--nota', null), dim: flag('--dim', 'general'), version: flag('--version', null), voz: flag('--voz', null), ...opt })));
    else if (cmd === 'check') {
      const md = fs.readFileSync(opt.gusto, 'utf8'), e = validarReglas(parseReglas(md)), r = parseRubrica(md);
      for (const m of MIRADAS) if (!Object.keys(r[m] ?? {}).length) e.push(`rúbrica sin criterios para ${m}`);
      console.log(e.length ? e.join('\n') : `ok: ${parseReglas(md).length} reglas, rúbrica ${MIRADAS.map((m) => m + ':' + Object.keys(r[m]).length).join(' ')}`); process.exit(e.length ? 1 : 0);
    } else { console.error('uso: gusto.mjs build | nota <film> "<texto>" | check'); process.exit(2); }
  } catch (e) { console.error(e.message); process.exit(1); }
}
