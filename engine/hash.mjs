// Hash por contenido (E5): UNA sola derivación para todo lo que decide si un fragmento o un veredicto sigue vigente.
//   closure(roots)   grafo REAL de imports (estáticos, re-exports e import('literal')) desde las raíces, siguiendo cualquier
//                    ruta relativa (shots, helpers, ../engine/*). Se corta en las herramientas de gobernanza/doc (NON_PIXEL),
//                    que no cambian píxeles ni el juicio del lint. Paquetes → nombre@versión (canvas, mathjax-full…).
//   engineSig(roots) digest del cierre + datos del motor. cut usa PIXEL_ROOTS; verdict.engineHash usa PIXEL_ROOTS+JUDGE_ROOTS.
//   shotDeps(id)     cierre de shots/<id>.mjs (otros shots, helpers en subcarpetas, módulos del motor que importe).
//   fileDigest(abs)  sha256 del CONTENIDO. Caché por (ruta, size, mtime, ctime, ino) en out/cache/digests.json: un touch no
//                    invalida; un cambio de contenido sí aunque se restaure size+mtime (ctime no se puede falsear con utimes).
//                    Un archivo modificado hace < OPUS_HASH_SETTLE_MS (1 s) no se cachea: los relojes de ctime/mtime son de
//                    grano grueso y dos escrituras en el mismo tick serían indistinguibles ("racily clean", como git).
//   assetsSig()      assets/ por contenido (menos cache/tex, derivada de shots + versión de mathjax).
//   fontSig(tfs)     fuentes que resuelve fontconfig (fc-list/fc-match, la misma vía que pango/node-canvas) para las familias
//                    del estilo + genéricas, y typeface.files del proyecto: todas por digest de contenido.
import fs from 'node:fs';
import { rootFrom } from './paths.mjs';
import path from 'node:path';
import crypto from 'node:crypto';
import { isBuiltin } from 'node:module';
import { spawnSync } from 'node:child_process';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

export const ROOT = rootFrom(import.meta.url);
// Herramientas de gobernanza/documentación: el cierre no las atraviesa (cambiarlas no re-renderiza ni caduca veredictos).
export const NON_PIXEL = new Set(['ledger', 'lock', 'gate', 'roles', 'verdict', 'doc', 'gallery', 'q', 'orch', 'memoria']);
// Lo que produce píxeles: el render (film → seek/api/… → shots) y la cámara automática (horneada a data/autocam).
export const PIXEL_ROOTS = ['engine/render.mjs', 'engine/autocam.mjs'];
// Lo que además decide un veredicto (lint + crítico).
export const JUDGE_ROOTS = ['engine/lint.mjs', 'engine/critic.mjs'];
const ENGINE_DATA = ['engine/profiles.json'];
const JUDGE_DATA = ['engine/arc.json'];                                       // umbrales del juicio (lint arc): caducan veredictos, no píxeles

export const sha = (...xs) => crypto.createHash('sha1').update(xs.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('\u0000')).digest('hex').slice(0, 12);
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const rel = (abs) => path.relative(ROOT, abs);

// ── digests de contenido con caché persistente ──────────────────────────────────────────────────────────────────────────
const SETTLE_NS = BigInt(Math.round(+(process.env.OPUS_HASH_SETTLE_MS ?? 1000) * 1e6));
const dbFile = () => path.join(ROOT, 'out/cache/digests.json');
let DB = null, dirty = false;
const readDb = () => { try { return JSON.parse(fs.readFileSync(dbFile(), 'utf8')); } catch { return {}; } };
const loadDb = () => (DB ??= readDb());
export function flushDigests() {
  if (!dirty) return; dirty = false;
  try {
    const all = { ...readDb(), ...DB };                                    // otro proceso pudo escribir: se fusiona (es solo caché)
    for (const k of Object.keys(all)) if (!fs.existsSync(k)) delete all[k];
    fs.mkdirSync(path.dirname(dbFile()), { recursive: true });
    const tmp = `${dbFile()}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(all)); fs.renameSync(tmp, dbFile());
  } catch {}
}
let hooked = false;
export function fileDigest(abs) {
  let st; try { st = fs.statSync(abs, { bigint: true }); } catch { return null; }
  if (!st.isFile()) return null;
  const key = `${st.size}:${st.mtimeNs}:${st.ctimeNs}:${st.ino}`, db = loadDb(), e = db[abs];
  if (e && e[0] === key) return e[1];
  const h = sha256(fs.readFileSync(abs)), now = BigInt(Date.now()) * 1000000n, last = st.mtimeNs > st.ctimeNs ? st.mtimeNs : st.ctimeNs;
  if (now - last > SETTLE_NS) { db[abs] = [key, h]; dirty = true; if (!hooked) { hooked = true; process.on('exit', flushDigests); } }
  else if (e) { delete db[abs]; dirty = true; }
  return h;
}

// ── grafo de imports ────────────────────────────────────────────────────────────────────────────────────────────────────
const IMP = new Map();                                                     // digest → especificadores (el parseo se reutiliza)
function specifiers(abs) {
  const d = fileDigest(abs); if (!d) return [];
  if (IMP.has(d)) return IMP.get(d);
  const src = fs.readFileSync(abs, 'utf8'), out = [];
  try {
    walk.full(acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true }), (n) => {
      if (/^(ImportDeclaration|ExportAllDeclaration|ExportNamedDeclaration|ImportExpression)$/.test(n.type) && n.source?.type === 'Literal' && typeof n.source.value === 'string') out.push(n.source.value);
    });
  } catch {                                                                // archivo roto (el lint lo marcará): regex conservadora
    for (const m of src.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"\n]+)['"]/g)) out.push(m[1]);
  }
  IMP.set(d, out); return out;
}
const pkgName = (s) => (s.startsWith('@') ? s.split('/').slice(0, 2).join('/') : s.split('/')[0]);
const pkgVersion = (p) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', p, 'package.json'), 'utf8')).version; } catch { return '?'; } };
const stopped = (abs) => path.dirname(abs) === path.join(ROOT, 'engine') && NON_PIXEL.has(path.basename(abs).replace(/\.\w+$/, ''));

// Cierre transitivo desde las raíces (rutas relativas a ROOT). → { files: [rel…], pkgs: ['canvas@3.1.0', …] }
export function closure(roots) {
  const seen = new Set(), pkgs = new Set(), stack = roots.map((r) => path.resolve(ROOT, r)).filter((f) => fs.existsSync(f));
  while (stack.length) {
    const f = stack.pop(); if (seen.has(f)) continue; seen.add(f);
    if (!/\.(m?js|cjs)$/.test(f)) continue;                                // .json importado: hoja (entra por contenido)
    for (const s of specifiers(f)) {
      if (s.startsWith('.') || s.startsWith('/')) { const t = path.resolve(path.dirname(f), s); if (fs.existsSync(t) && !seen.has(t) && !stopped(t)) stack.push(t); }
      else if (!s.startsWith('node:') && !isBuiltin(s) && !s.includes('${')) pkgs.add(pkgName(s));
    }
  }
  return { files: [...seen].map(rel).sort(), pkgs: [...pkgs].sort().map((p) => `${p}@${pkgVersion(p)}`) };
}
const sigOf = ({ files, pkgs }) => sha256(files.map((f) => f + ':' + fileDigest(path.join(ROOT, f))).join('\n') + '\n' + pkgs.join('\n'));

// world3d (spec 004): firma del backend GL (headless-gl + three + versión de Mesa + rasterizador). Cambiar de backend o de Mesa
// invalida los fragmentos que usan 3D (los bits no son estables entre backends: ver docs/research/07-webgl.md).
import { backendSig } from './world3d/backend-gl.mjs';
export const world3dSig = () => backendSig();
// ¿algún shot de la lista (o lo que importa) llama a api.world3d? Solo entonces la firma del backend entra en el hash.
export function usesWorld3d(ids) {
  const seen = new Set(), stack = ids.map((id) => path.join(ROOT, 'shots', id + '.mjs'));
  while (stack.length) { const f = stack.pop(); if (seen.has(f) || !fs.existsSync(f)) continue; seen.add(f); const src = fs.readFileSync(f, 'utf8'); if (/\.world3d\s*\(/.test(src)) return true;
    for (const [, d] of src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) stack.push(path.resolve(path.dirname(f), d)); }
  return false;
}

// Firma del motor: cierre de las raíces + datos del motor. cut (fragmentos) y verdict (engineHash) llaman aquí.
export const engineFiles = (roots = PIXEL_ROOTS) => closure(roots).files;
export function engineSig(roots = PIXEL_ROOTS) {
  const c = closure(roots);
  const data = roots.some((r) => JUDGE_ROOTS.includes(r)) ? [...ENGINE_DATA, ...JUDGE_DATA] : ENGINE_DATA;
  return sha256(sigOf(c) + '\n' + data.map((f) => f + ':' + fileDigest(path.join(ROOT, f))).join('\n'));
}

// Código de un shot y TODO lo que importa (cualquier ruta relativa, también ../engine/*.mjs y su cierre).
export function shotDeps(id) {
  const f = path.join('shots', id + '.mjs'); if (!fs.existsSync(path.join(ROOT, f))) return '';
  return sigOf(closure([f]));
}
// Hash del contenido de UN shot (su entrada + código + deps), independiente del motor: lo usa autocam para invalidarse.
export const shotHash = (film, id) => { const s = film.shots.find((x) => x.id === id), { cam, ...rest } = s; return sha(rest, cam?.move === 'auto' ? { ...cam } : cam, shotDeps(id), film.width, film.height, JSON.stringify(film.S.camera), JSON.stringify(film.P.safe)); };

// ── assets y fuentes ────────────────────────────────────────────────────────────────────────────────────────────────────
export function assetsSig() {
  const d = path.join(ROOT, 'assets'), acc = []; if (!fs.existsSync(d)) return '';
  const walkDir = (p) => { for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const q = path.join(p, e.name);
    if (e.isDirectory()) { if (q !== path.join(d, 'cache', 'tex')) walkDir(q); } else acc.push(path.relative(d, q) + ':' + fileDigest(q));
  } };
  walkDir(d); return sha256(acc.sort().join('\n'));
}
let FC = null; const MATCH = new Map(), FONTS = new Map();
const fcList = () => FC ??= (() => {
  const r = spawnSync('fc-list', ['-f', '%{family}\t%{file}\n'], { encoding: 'utf8', maxBuffer: 1 << 26 }), m = new Map();
  if (r.status !== 0) return null;
  for (const l of r.stdout.split('\n')) { const [fams, file] = l.split('\t'); if (!file) continue; for (const f of fams.split(',')) { const k = f.trim().toLowerCase(); if (!m.has(k)) m.set(k, []); m.get(k).push(file); } }
  return m;
})();
const fcMatch = (pat) => { if (!MATCH.has(pat)) { const r = spawnSync('fc-match', ['-f', '%{file}', pat], { encoding: 'utf8' }); MATCH.set(pat, r.status === 0 ? r.stdout.trim() : ''); } return MATCH.get(pat); };
// typefaces: [{family, fallback, mono, files:[{path}]}] (S.typeface de cada estilo en juego).
export function fontSig(typefaces) {
  const fams = new Set(['sans-serif', 'monospace']), own = new Set();
  for (const tf of typefaces) { if (!tf) continue; for (const k of ['family', 'fallback', 'mono']) for (const f of String(tf[k] ?? '').split(',')) if (f.trim()) fams.add(f.trim().replace(/^["']|["']$/g, '')); for (const f of tf.files ?? []) if (f?.path) own.add(f.path); }
  const key = [...fams].sort().join('|') + '#' + [...own].sort().join('|');
  if (!FONTS.has(key)) {
    const L = fcList();
    FONTS.set(key, L ? [...fams].sort().map((f) => [f, [...new Set([...(L.get(f.toLowerCase()) ?? []), fcMatch(f), fcMatch(f + ':bold')])].filter(Boolean).sort()]) : null);
  }
  const sys = FONTS.get(key);
  return sha256(JSON.stringify([
    sys ? sys.map(([f, files]) => [f, files.map((x) => x + ':' + fileDigest(x))]) : 'sin-fontconfig',
    [...own].sort().map((p) => p + ':' + fileDigest(path.join(ROOT, p))),
  ]));
}
