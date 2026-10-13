// Carga (Node): timeline, perfiles, estilos, audio.json, shots/*.mjs y ASSETS (TeX, imágenes, footage); delega en seek.mjs.
//   Overrides sin tocar archivos:  --style noir --profile cinematic --timeline data/showcase.json --edit data/edit.json
//   (o env OPUS_STYLE / OPUS_PROFILE / OPUS_TIMELINE / OPUS_EDIT)
//   --medium kraft / OPUS_MEDIUM: aplica un medio (styles/medios/) a cualquier film sin tocar su timeline (spec 003).
//   F4: capas de overrides data/layers/*.json + variantes (--variant 9x16 / OPUS_VARIANT; --layers dir|none / OPUS_LAYERS):
//   resolve(timeline, capas) UNA vez aquí; seek(t) trabaja sobre lo resuelto (docs/PARAMS.md).
import fs from 'node:fs';
import { rootFrom } from './paths.mjs';
import path from 'node:path';
import canvasPkg from 'canvas';
import { compile } from './seek.mjs';
import { makeSandbox } from './sandbox.mjs';
import { makeTexStore, texReady } from './tex.mjs';
import { assertTimeline, suggest as suggestName } from './schema.mjs';
import { assertEdit, assertAudio, assertMedio } from './inputs.mjs';
import { resolveTimeline, assertParams } from './params.mjs';
import { bindParams } from './signal.mjs';
import { degradar } from './boceto-degrada.mjs';
import { createWorld3d } from './world3d/index.mjs';
import { usesWorld3d } from './hash.mjs';
import { cargarSvg } from './svg-io.mjs';
import { filmId, sibling, activeTimeline, announceFilm, filmFile, resolveFilm } from './filmid.mjs';
export { seek, activeShots, shotBeats } from './seek.mjs';
const { createCanvas, Image } = canvasPkg;

for (const k of ['style', 'profile', 'timeline', 'edit', 'variant', 'layers', 'medium']) { const i = process.argv.indexOf('--' + k); if (i >= 0 && process.argv[i + 1]) process.env['OPUS_' + k.toUpperCase()] = process.argv[i + 1]; }

export const ROOT = rootFrom(import.meta.url);
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
export function loadStyles() {
  const o = {};
  for (const f of fs.readdirSync(path.join(ROOT, 'styles'))) if (f.endsWith('.json') && !f.startsWith('_')) o[f.slice(0, -5)] = rd('styles/' + f);
  return o;
}
export const timelinePath = () => activeTimeline();
export { announceFilm, filmFile, resolveFilm };

// LRU pequeño: el footage puede tener miles de fotogramas; nunca más de N decodificados en memoria.
function lru(n) { const m = new Map(); return { get(k, make) { if (m.has(k)) { const v = m.get(k); m.delete(k); m.set(k, v); return v; } const v = make(); m.set(k, v); if (m.size > n) m.delete(m.keys().next().value); return v; } }; }
const loadImg = (file) => { const im = new Image(); im.src = fs.readFileSync(file); return im; };   // síncrono en node-canvas
export function makeAssets(root) {
  const tex = makeTexStore(root), imgs = lru(32), frames = lru(48), metas = new Map();
  return {
    tex: (s, display = true) => tex.get(s, display),
    svg: (id) => cargarSvg(id, root),                                    // spec 020: SVG sanitizado de assets/ (síncrono, cacheado)
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
  assertEdit(edit, film.shots);                                       // frontera: speed>0 y finito, src1>src0, items no vacío, hold≥0, ids existentes
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
  const aj = path.join(ROOT, sibling('audio.json', 'data/audio.json', timeline)), R = resolveTimeline(assertTimeline(rd(timeline), timeline), timeline), tl = R.timeline;   // E8 + F4: capas resueltas
  tl.style = style ?? process.env.OPUS_STYLE ?? tl.style ?? 'editorial';
  if (profile ?? process.env.OPUS_PROFILE) tl.profile = profile ?? process.env.OPUS_PROFILE;
  if (process.env.OPUS_MEDIUM) {                                                         // override: cualquier film con cualquier medio (hojas A/B, pruebas); sin env, el timeline manda
    const ms = fs.readdirSync(path.join(ROOT, 'styles/medios')).filter((f) => f.endsWith('.json') && !f.startsWith('_')).map((f) => f.slice(0, -5));
    if (!ms.includes(process.env.OPUS_MEDIUM)) { const g = suggestName(process.env.OPUS_MEDIUM, ms); throw new Error(`OPUS_MEDIUM: medio "${process.env.OPUS_MEDIUM}" no existe en styles/medios/ — ${g ? `¿quisiste decir "${g}"?` : 'disponibles: ' + ms.join(' ')}`); }
    tl.medium = process.env.OPUS_MEDIUM;
  }
  if (tl.medium) tl.mediumDef = assertMedio(rd(`styles/medios/${tl.medium}.json`), `styles/medios/${tl.medium}.json`);                  // spec 003: el medio como datos (compile lo aplica)
  const film = compile(tl, rd('engine/profiles.json'), loadStyles(), fs.existsSync(aj) ? assertAudio(JSON.parse(fs.readFileSync(aj, 'utf8')), path.relative(ROOT, aj)) : null);
  film.timelinePath = timeline;
  if (process.env.OPUS_FXFAST === '1') film.P.fxFast = true; else if (process.env.OPUS_FXFAST === '0') film.P.fxFast = false;   // spec 009: lint/peek/review lo activan por defecto; 0 lo fuerza fuera                          // R3 opt-in (fx baratos): entra en el hash vía film.P; también por perfil/overrides
  if (process.env.OPUS_BOCETO === '1') degradar(film);                                   // spec 019: boceto = degradación declarada (engine/boceto-degrada.mjs); film.P.boceto entra en todos los hashes
  film.resolution = R;
  film.assets = makeAssets(ROOT);
  film.canvas = (w, h) => createCanvas(w, h);
  film.world3d = createWorld3d();                                                       // spec 004: backend 3D (gl/three solo se cargan si algún shot usa api.world3d)
  if (!animatic && usesWorld3d(tl.shots.map((s) => s.id))) { film.world3d.available; film.world3d.sig(); }   // precarga FUERA del sandbox de shots (que congela process/Date); si falta, api.world3d degrada y lint da FIX
  if (!animatic) {
    const sb = makeSandbox(ROOT); film.sandboxLog = sb.log;                         // carga y ejecución de shots en sandbox (engine/sandbox.mjs)
    for (const s of film.shots) {
      const f = path.join(ROOT, 'shots', `${s.id}.mjs`);
      if (fs.existsSync(f)) film.mods[s.id] = sb.wrap(await sb.importShot(f, s.id), s.id);
    }
    bindParams(film); assertParams(film);                                           // defaults de los esquemas promovidos + validación
  }
  const ac = path.join(ROOT, 'data/autocam', filmId(timeline) === 'main' ? path.basename(timeline) : filmId(timeline) + '.json');                 // cámaras 'auto' horneadas (válidas solo si el hash coincide)
  if (fs.existsSync(ac)) { const A = JSON.parse(fs.readFileSync(ac, 'utf8')), { shotHash } = await import('./hash.mjs'); film.autocam = {};
    for (const [id, v] of Object.entries(A)) if (film.shots.some((s) => s.id === id) && v.hash === shotHash(film, id)) film.autocam[id] = v; }
  if (edit) { const E = buildTimeMap(rd(edit), film); film.srcDuration = film.duration; film.timeMap = E.map; film.duration = E.duration; film.edit = E; }
  return film;
}
