// cookKey de un shot y firma global del film (R1/R6, spec 009): UNA derivación para todo lo que cachea píxeles o análisis por contenido.
//   shotKey(film, s)   = entrada RESUELTA del shot (cookEntry) + cámara auto horneada + la del previo si cam.chain + entradas de los shots
//                        cuyo código importa + cierre de imports de su código. Mismos ingredientes que el hash de fragmentos de cut.
//   filmSig(film)      = lo global que afecta a cualquier fotograma: cierre REAL de imports de render+autocam (engineSig), estilo, medio,
//                        fuentes, assets, audio.json, tamaño del film, perfil (film.P: incluye fxFast), motivo, handoffs y EDL.
// El tamaño de salida, el grade y la guardia NO están aquí: los añade quien cachea (engine/framecache.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './film.mjs';
import { sha, engineSig, assetsSig, fontSig, shotDeps, world3dSig, usesWorld3d } from './hash.mjs';
import { cookEntry } from './resolve.mjs';

// ids de los shots que el código de `id` importa (transitivo, sin él mismo).
export function shotImports(id, seen = new Set()) {
  if (seen.has(id)) return []; seen.add(id);
  const f = path.join(ROOT, 'shots', id + '.mjs'); if (!fs.existsSync(f)) return [];
  for (const [, dep] of fs.readFileSync(f, 'utf8').matchAll(/from\s+['"]\.\/([\w-]+)\.mjs['"]/g)) shotImports(dep, seen);
  return [...seen].filter((x) => x !== id);
}

const SIG = new WeakMap(), KEYS = new WeakMap();
export function filmSig(film) {
  if (!SIG.has(film)) SIG.set(film, sha(engineSig(), JSON.stringify(film.S), ...(film.medium ? [JSON.stringify(film.medium)] : []), fontSig([film.S.typeface]),
    ...(usesWorld3d(film.shots.map((s) => s.id)) ? [world3dSig()] : []), assetsSig(), film.audioInfo ?? null, film.width, film.height, film.duration, film.fps,
    film.motif, film.handoffs, film.profileName, film.P, film.edit?.items ?? null));
  return SIG.get(film);
}
export function shotKey(film, s) {
  let m = KEYS.get(film); if (!m) KEYS.set(film, (m = new Map()));
  if (!m.has(s.id)) {
    const ac = (x) => film.autocam?.[x.id] ?? null, i = film.shots.indexOf(s);
    const prev = s.cam?.chain && i > 0 ? [cookEntry(film, film.shots[i - 1]), ac(film.shots[i - 1])] : [];
    const imported = shotImports(s.id).map((id) => film.shots.find((x) => x.id === id)).filter(Boolean).map((x) => cookEntry(film, x));
    m.set(s.id, sha(cookEntry(film, s), ac(s), prev, imported, shotDeps(s.id)));
  }
  return m.get(s.id);
}
