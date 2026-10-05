// Identidad del film a partir de la ruta de su timeline (Node, sin dependencias del motor).
//   data/timeline.json        → "main"   (demo; rutas históricas: data/audio.json, data/layers/, data/story.json, out/master.mp4)
//   data/<film>.json          → "<film>"
//   data/<film>/timeline.json → "<film>" (el film vive en su carpeta: audio.json, story.json, memoria.json al lado)
// Antes cualquier `timeline.json` era "main" y un film en su carpeta heredaba las capas, el audio y el master del demo.
import path from 'node:path';
export const DEFAULT_TL = 'data/timeline.json';
export function filmId(tl = process.env.OPUS_TIMELINE ?? DEFAULT_TL) {
  const b = path.basename(tl, '.json'); if (b !== 'timeline') return b;
  const d = path.basename(path.dirname(path.normalize(tl)));
  return d === 'data' || d === '.' || d === '' ? 'main' : d;
}
// ¿El timeline vive en su propia carpeta (data/<film>/timeline.json)? → ruta relativa a esa carpeta, o null
export function filmDir(tl = process.env.OPUS_TIMELINE ?? DEFAULT_TL) {
  return path.basename(tl, '.json') === 'timeline' && filmId(tl) !== 'main' ? path.dirname(path.normalize(tl)) : null;
}
// Fichero hermano del film: data/<film>/<name> si el film tiene carpeta; si no, `fallback` (p. ej. data/audio.json para main).
export const sibling = (name, fallback, tl) => { const d = filmDir(tl); return d ? path.join(d, name) : fallback; };
