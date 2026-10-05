// Identidad del film a partir de la ruta de su timeline (Node, sin dependencias del motor).
//   data/timeline.json        → "main"   (demo; rutas históricas: data/audio.json, data/layers/, data/story.json, out/master.mp4)
//   data/<film>.json          → "<film>"
//   data/<film>/timeline.json → "<film>" (el film vive en su carpeta: audio.json, story.json, memoria.json al lado)
// Antes cualquier `timeline.json` era "main" y un film en su carpeta heredaba las capas, el audio y el master del demo.
import path from 'node:path';
export const DEFAULT_TL = 'data/timeline.json';
export function filmId(tl = activeTimeline()) {
  const b = path.basename(tl, '.json'); if (b !== 'timeline') return b;
  const d = path.basename(path.dirname(path.normalize(tl)));
  return d === 'data' || d === '.' || d === '' ? 'main' : d;
}
// ¿El timeline vive en su propia carpeta (data/<film>/timeline.json)? → ruta relativa a esa carpeta, o null
export function filmDir(tl = activeTimeline()) {
  return path.basename(tl, '.json') === 'timeline' && filmId(tl) !== 'main' ? path.dirname(path.normalize(tl)) : null;
}
// Fichero hermano del film: data/<film>/<name> si el film tiene carpeta; si no, `fallback` (p. ej. data/audio.json para main).
export const sibling = (name, fallback, tl) => { const d = filmDir(tl); return d ? path.join(d, name) : fallback; };

// ───────── film ACTIVO (P1, docs/EFICIENCIA.md): UN resolvedor para todas las herramientas ─────────
// Prioridad: --timeline X (flag) > OPUS_TIMELINE (env) > out/.film (lo escribe `opus use <film>`) > demo.
// Antes cada CLI caía en silencio a data/timeline.json; ahora todas imprimen en su 1.ª línea qué film usan y por qué.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const FROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const USE_FILE = path.join(FROOT, 'out/.film');
const readUse = () => { try { return fs.readFileSync(USE_FILE, 'utf8').trim() || null; } catch { return null; } };
export function resolveFilm({ argv = process.argv, env = process.env } = {}) {
  const i = argv.indexOf('--timeline'), flag = i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
  const [timeline, source] = flag ? [flag, 'flag'] : env.OPUS_TIMELINE ? [env.OPUS_TIMELINE, 'env'] : readUse() ? [readUse(), 'use'] : [DEFAULT_TL, 'demo'];
  return { timeline, key: filmId(timeline), source };
}
export const activeTimeline = () => resolveFilm().timeline;
// Línea de cabecera de toda CLI. Con --json va a stderr para no romper la salida máquina.
export function announceFilm() {
  if (globalThis.__opusFilmAnnounced) return; globalThis.__opusFilmAnnounced = true;
  const f = resolveFilm(); (process.argv.includes('--json') ? console.error : console.log)(`film: ${f.key} (${f.timeline}, fuente: ${f.source})`);
}
// Carpeta del film: la del timeline si no es data/ (data/mate/timeline.json, data/regla/regla.json, data/stress/potencias.json).
export const filmFolder = (tl = activeTimeline()) => { const d = path.dirname(path.normalize(tl)); return d === 'data' || d === '.' || d === '' ? null : d; };
// Fichero de datos del film (story.json, memoria.json…): el de su carpeta si existe; si no `fallback` (el demo: data/story.json, data/memoria.json).
export const filmFile = (name, fallback, tl = activeTimeline()) => { const d = filmFolder(tl); return d && fs.existsSync(path.join(FROOT, d, name)) ? path.join(d, name) : fallback; };
// Nombre o ruta → ruta del timeline (para `opus use`): ruta existente | data/<f>/timeline.json | data/<f>.json | data/<f>/<f>.json | data/*/<f>.json
export function findFilm(name) {
  if (name === 'demo' || name === 'main') return DEFAULT_TL;
  const ex = (p) => fs.existsSync(path.join(FROOT, p)) && fs.statSync(path.join(FROOT, p)).isFile();
  const c = [name, `data/${name}/timeline.json`, `data/${name}.json`, `data/${name}/${name}.json`];
  for (const e of fs.readdirSync(path.join(FROOT, 'data'), { withFileTypes: true })) if (e.isDirectory()) c.push(`data/${e.name}/${name}.json`);
  return c.find(ex) ?? null;
}
