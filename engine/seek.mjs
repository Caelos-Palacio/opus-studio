// Módulo compartido navegador/Node: compilación del timeline + seek(t) puro.
import { clamp, stepT, onT } from './core.mjs';
import { makeApi } from './api.mjs';
import { camState, applyCam } from './camera.mjs';
import { applyGrade } from './grade.mjs';
import { resolveStyle } from './styles.mjs';
import { releasePool } from './fx.mjs';
import { nodeWorld, drawScene } from './scene.mjs';
import { bindParams } from './signal.mjs';

export function compile(film, profiles, styles, audioInfo = null) {
  const pack = styles[film.style ?? 'editorial'];
  if (!pack) throw new Error(`estilo "${film.style}" no existe (styles/${film.style}.json). Disponibles: ${Object.keys(styles).join(', ')}`);
  film.S = resolveStyle(pack, film);
  film.palette = film.S.palette; film.typeface = film.S.typeface;
  film.profileName = film.profile ?? film.S.defaultProfile ?? 'reel';
  film.P = { ...profiles[film.profileName], ...(film.profileOverrides ?? {}) };
  film.shots = [...film.shots].sort((a, b) => a.t[0] - b.t[0] || (a.layer ?? 0) - (b.layer ?? 0));
  film.audioInfo = audioInfo;
  film.bpm = audioInfo?.bpm ?? film.bpm ?? 0;
  film.beatOffset = audioInfo?.offset ?? film.beatOffset ?? 0;
  film.beatTimes = [];
  if (audioInfo?.beats?.length) film.beatTimes = audioInfo.beats.filter((b) => b >= 0 && b <= film.duration + 1e-9);   // rejilla EXPLÍCITA (tempo variable: engine/grid.mjs); manda sobre bpm+offset
  else if (film.bpm > 0) for (let b = film.beatOffset; b <= film.duration + 1e-9; b += 60 / film.bpm) film.beatTimes.push(+b.toFixed(6));
  film.gridTimes = audioInfo?.grid?.length ? [...new Set([...film.beatTimes, ...audioInfo.grid.filter((b) => b >= 0 && b <= film.duration + 1e-9)])].sort((a, b) => a - b) : film.beatTimes;   // dónde puede caer un corte (pulsos + subdivisiones)
  film.silences = audioInfo?.silences ?? [];
  film.mods = film.mods ?? {};
  bindParams(film);                                                         // F4: film.meta aparte; film.param/params/signal
  return film;
}

export const activeShots = (film, t) => {
  const end = film.srcDuration ?? film.duration;
  return film.shots.filter((s) => t >= s.t[0] && (t < s.t[1] || (t >= end && s.t[1] >= end)));
};
export const shotBeats = (film, s) => film.beatTimes.filter((b) => b >= s.t[0] - 1e-6 && b < s.t[1] - 1e-6);

// Un frame. Cámara por shot (un movimiento, con parallax por profundidad; puede seguir un nodo) → grade global.
// Devuelve las cajas registradas (boxes.meta = metadatos de primitivas/nodos). tOut = tiempo de SALIDA (edición).
export function seek(ctx, tOut, film, { grade = true } = {}) {
  const tReal = film.timeMap ? film.timeMap(tOut) : tOut;                  // EDL: remapeo de tiempo sin pérdida (se re-renderiza)
  const tStep = stepT(tReal, film);                                        // stop-motion: solo el dibujo se cuantiza
  ctx.save();
  const m = ctx.getTransform(), B = { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f };
  ctx.fillStyle = film.palette.paper;
  ctx.fillRect(0, 0, film.width, film.height);
  const boxes = [], meta = []; boxes.meta = meta;
  for (const s of activeShots(film, tStep)) {
    const t = onT(tStep, s, film);                                         // shot.on: doses/treses solo en el dibujo (cámara a ones)
    const u = clamp((t - s.t[0]) / Math.max(1e-4, s.t[1] - s.t[0])), cam = camState(s, tStep, film), mod = film.mods[s.id];
    const tr = s.cam?.track;                                                // cámara sobre nodos: centra el nodo con inercia pura
    if (tr && mod?.scene) {
      const p = nodeWorld(sceneBuilder(mod, film), tr.node, t, film, tr.smooth ?? 0.25);
      if (p) { const kk = tr.k ?? 1; cam.tx = cam.fx * film.width + (p[0] - cam.fx * film.width) * kk; cam.ty = cam.fy * film.height + (p[1] - cam.fy * film.height) * kk; }
    }
    ctx.save();
    ctx.setTransform(B.a, B.b, B.c, B.d, B.e, B.f);
    applyCam(ctx, cam, film.width, film.height, 1);
    const rec = film.guard ? { violations: [], shot: s.id, t } : null, G = rec ? film.guard(ctx, rec) : null, dctx = G ? G.ctx : ctx;
    const api = makeApi(ctx, film, s, { t, u, cam, base: B, boxes, meta, rec });
    if (mod?.scene) drawScene(ctx, sceneBuilder(mod, film, api), t, film, api);
    if (mod?.draw) mod.draw(dctx, t, u, s, film, api);
    if (!mod?.draw && !mod?.scene) placeholder(ctx, t, u, s, film, api);
    if (G) { G.end(); film.guardLog?.push(rec); }
    ctx.restore();
  }
  if (grade) applyGrade(ctx, film, tOut);
  ctx.restore();
  releasePool(film);
  return boxes;
}

// Constructor estable por módulo (clave de memo): escena(t) sin estado; api solo se usa para dibujar, no para la estructura.
const BUILDERS = new WeakMap();
function sceneBuilder(mod, film, api) { let b = BUILDERS.get(mod); if (!b) { b = (tt) => mod.scene(tt, film, b.api); BUILDERS.set(mod, b); } b.api = api; return b; }

// Animatic: masas grises, acción, cámara, tick en cada beat. Sin grade (se lee mejor).
function placeholder(ctx, t, u, s, film, api) {
  const { safe } = api, [x, y] = api.at(0.5, 0.42);
  ctx.fillStyle = film.palette.shade; ctx.globalAlpha = 0.55;
  ctx.fillRect(safe.x0 + safe.w * 0.15, safe.y0 + safe.h * (0.3 + 0.04 * Math.sin(u * 3)), safe.w * 0.7 * (0.6 + 0.4 * u), safe.h * 0.28);
  ctx.globalAlpha = 1;
  api.text(s.id, x, safe.y0 + safe.h * 0.12, { role: 'h1' });
  if (s.action) api.text(s.action.slice(0, 48), x, safe.y0 + safe.h * 0.72, { role: 'label' });
  const c = s.cam ? `${s.cam.move}${s.cam.amount != null ? ' ' + s.cam.amount : ''}` : s.camera;
  if (c) api.text('cam: ' + c, x, safe.y0 + safe.h * 0.82, { role: 'label', color: 'shade' });
  for (const b of shotBeats(film, s)) { const d = t - b; if (d >= 0 && d < 0.12) { ctx.fillStyle = film.palette.accent; ctx.fillRect(0, film.height - 14, film.width, 14); } }
  ctx.fillStyle = film.palette.ink; ctx.fillRect(0, film.height - 4, film.width * u, 4);
}
