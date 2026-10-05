// Carga (Node): timeline, perfiles, estilos, audio.json, shots/*.mjs y ASSETS (TeX, imágenes, footage); delega en seek.mjs.
//   Overrides sin tocar archivos:  --style noir --profile cinematic --timeline data/showcase.json --edit data/edit.json
//   (o env OPUS_STYLE / OPUS_PROFILE / OPUS_TIMELINE / OPUS_EDIT)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import canvasPkg from 'canvas';
import { compile } from './seek.mjs';
import { makeTexStore, texReady } from './tex.mjs';
import { assertTimeline } from './schema.mjs';
export { seek, activeShots, shotBeats } from './seek.mjs';
const { createCanvas, Image } = canvasPkg;

for (const k of ['style', 'profile', 'timeline', 'edit']) { const i = process.argv.indexOf('--' + k); if (i >= 0 && process.argv[i + 1]) process.env['OPUS_' + k.toUpperCase()] = process.argv[i + 1]; }

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
export function loadStyles() {
  const o = {};
  for (const f of fs.readdirSync(path.join(ROOT, 'styles'))) if (f.endsWith('.json') && !f.startsWith('_')) o[f.slice(0, -5)] = rd('styles/' + f);
  return o;
}
export const timelinePath = () => process.env.OPUS_TIMELINE ?? 'data/timeline.json';

// LRU pequeño: el footage puede tener miles de fotogramas; nunca más de N decodificados en memoria.
function lru(n) { const m = new Map(); return { get(k, make) { if (m.has(k)) { const v = m.get(k); m.delete(k); m.set(k, v); return v; } const v = make(); m.set(k, v); if (m.size > n) m.delete(m.keys().next().value); return v; } }; }
const loadImg = (file) => { const im = new Image(); im.src = fs.readFileSync(file); return im; };   // síncrono en node-canvas
export function makeAssets(root) {
  const tex = makeTexStore(root), imgs = lru(32), frames = lru(48), metas = new Map();
  return {
    tex: (s, display = true) => tex.get(s, display),
    image: (id) => { const f = [path.join(root, 'assets', id), path.join(root, id)].find((p) => fs.existsSync(p)); return f ? imgs.get(f, () => loadImg(f)) : null; },
    footage: (id) => {
      if (!metas.has(id)) { const mf = path.join(root, 'assets/cache/footage', id, 'meta.json'); metas.set(id, fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, 'utf8')) : null); }
      const M = metas.get(id); if (!M) return null;
      return { ...M, frame: (i) => { const k = Math.max(1, Math.min(M.frames, i + 1)), f = path.join(root, 'assets/cache/footage', id, String(k).padStart(6, '0') + '.jpg'); return frames.get(f, () => loadImg(f)); } };
    },
  };
}

// Edición no destructiva: la EDL remapea el tiempo de salida → tiempo fuente. Como seek es puro, cada fotograma editado
// se RE-RENDERIZA desde la fuente: cambios de velocidad, reversa y congelados sin interpolación ni pérdida.
export function buildTimeMap(edit, film) {
  let acc = 0; const items = edit.items.map((it) => {
    const src = typeof it.src === 'string' ? film.shots.find((s) => s.id === it.src)?.t : it.src; if (!src) throw new Error(`edit: fuente "${it.src}" no existe`);
    const sp = it.speed ?? 1, len = (src[1] - src[0]) / sp, hold = it.hold ?? 0, o = { ...it, a: acc, len, hold, t0: src[0], t1: src[1] - 1e-4, sp }; acc += len + hold; return o;
  });
  const map = (tau) => { const it = items.find((x) => tau < x.a + x.len + x.hold) ?? items[items.length - 1], l = Math.min(tau - it.a, it.len);
    return it.reverse ? Math.max(it.t0, it.t1 - l * it.sp) : Math.min(it.t1, it.t0 + l * it.sp); };
  return { map, duration: acc, items };
}

export async function loadFilm({ timeline = timelinePath(), animatic = false, style, profile, edit = process.env.OPUS_EDIT } = {}) {
  await texReady();
  const aj = path.join(ROOT, 'data/audio.json'), tl = assertTimeline(rd(timeline), timeline);   // E8: estructura rota no se renderiza
  tl.style = style ?? process.env.OPUS_STYLE ?? tl.style ?? 'editorial';
  if (profile ?? process.env.OPUS_PROFILE) tl.profile = profile ?? process.env.OPUS_PROFILE;
  const film = compile(tl, rd('engine/profiles.json'), loadStyles(), fs.existsSync(aj) ? JSON.parse(fs.readFileSync(aj, 'utf8')) : null);
  film.timelinePath = timeline;
  film.assets = makeAssets(ROOT);
  film.canvas = (w, h) => createCanvas(w, h);
  if (!animatic) for (const s of film.shots) {
    const f = path.join(ROOT, 'shots', `${s.id}.mjs`);
    if (fs.existsSync(f)) film.mods[s.id] = (await import(pathToFileURL(f).href)).default;
  }
  const ac = path.join(ROOT, 'data/autocam', path.basename(timeline));                 // cámaras 'auto' horneadas (válidas solo si el hash coincide)
  if (fs.existsSync(ac)) { const A = JSON.parse(fs.readFileSync(ac, 'utf8')), { shotHash } = await import('./cut.mjs'); film.autocam = {};
    for (const [id, v] of Object.entries(A)) if (film.shots.some((s) => s.id === id) && v.hash === shotHash(film, id)) film.autocam[id] = v; }
  if (edit) { const E = buildTimeMap(rd(edit), film); film.srcDuration = film.duration; film.timeMap = E.map; film.duration = E.duration; film.edit = E; }
  return film;
}
