// Fronteras de entrada (harness): TODO lo que un agente puede escribir se valida aquí (esquema + asserts runtime) ANTES de usarse.
// Principio: entrada mala → FIX con ruta JSON y salida ≠ 0, nunca un cuelgue, un NaN silencioso ni una escritura fuera de out/.
// Cada validador devuelve [{level, path, message, remedy}] (misma forma que schema.validate); assertX lanza con todas las rutas.
import fs from 'node:fs';
import path from 'node:path';
import { validate } from './schema.mjs';
import { ROOT } from './paths.mjs';

const loadSchema = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));
export const EDIT_SCHEMA = loadSchema('edit.schema.json');
const fmt = (errs) => errs.filter((e) => e.level === 'FIX').map((e) => `  FIX  ${e.path}: ${e.message}  →  ${e.remedy}`).join('\n');
export const failOn = (name, errs, schemaFile) => { const t = fmt(errs); if (t) throw new Error(`${name} no valida${schemaFile ? ` ${schemaFile}` : ''}:\n${t}`); };

// ── EDL ───────────────────────────────────────────────────────────────────────────────────────────
// shots: lista [{id, t:[a,b]}] del film (opcional; sin ella solo se valida la forma y los rangos).
export function validateEdit(edit, shots = null) {
  const errs = validate(edit, EDIT_SCHEMA);
  if (errs.some((e) => e.level === 'FIX')) return errs;
  const E = (p, message, remedy) => errs.push({ level: 'FIX', path: p, message, remedy });
  let total = 0;
  edit.items.forEach((it, i) => {
    const p = `/items/${i}`; let src = it.src;
    if (typeof src === 'string') {
      if (shots) { const s = shots.find((x) => x.id === src); if (!s) { E(`${p}/src`, `fuente "${src}" no existe (ids: ${shots.map((x) => x.id).join(' ')})`, 'usar un id de shot o [t0, t1]'); return; } src = s.t; }
      else return;
    } else if (!(src[1] > src[0])) { E(`${p}/src`, `rango [${src}] con src1 ≤ src0`, 'src1 > src0'); return; }
    total += (src[1] - src[0]) / (it.speed ?? 1) + (it.hold ?? 0);
  });
  if (!errs.length && !(Number.isFinite(total) && total > 0 && total <= 86400)) E('/items', `duración total ${total} s fuera de (0, 86400]`, 'revisar speed/hold');
  return errs;
}
export const assertEdit = (edit, shots) => { failOn('EDL', validateEdit(edit, shots), 'data/edit.schema.json'); return edit; };

// Cadena de atempo (ffmpeg solo admite 0.5…2 por filtro). Cota de iteraciones: el bucle original no terminaba con speed=0.
export function atempoChain(speed) {
  if (!(Number.isFinite(speed) && speed > 0)) throw new Error(`atempo: speed ${speed} inválido (debe ser > 0 y finito)`);
  let f = '', s = speed, guard = 0;
  while (s > 2 || s < 0.5) { if (++guard > 64) throw new Error(`atempo: speed ${speed} fuera de rango práctico`); if (s > 2) { f += ',atempo=2'; s /= 2; } else { f += ',atempo=0.5'; s /= 0.5; } }
  if (s !== 1) f += `,atempo=${s}`;
  return f;
}

// ── resto de entradas que un agente puede escribir ──────────────────────────────────────────────────────
export const SCHEMAS = Object.fromEntries(['notas', 'audio', 'medio', 'facts', 'sound-style', 'world3d.scene'].map((k) => [k, loadSchema(`${k}.schema.json`)]));
const by = (k) => (doc) => validate(doc, SCHEMAS[k]);
export const validateStorySchema = (doc) => validate(doc, loadSchema('story.schema.json'));
export const validateNotas = by('notas'), validateAudio = by('audio'), validateMedio = by('medio'), validateFacts = by('facts'), validateSoundStyle = by('sound-style');
// Escena 3D: los typed arrays (Float32Array en `data`) se sustituyen por arrays vacíos antes de validar (su contenido lo acota el backend).
export function validateScene(scene) {
  let deep = false;
  const strip = (v, d = 0) => { if (d > 32) { deep = true; return null; } return ArrayBuffer.isView(v) ? [] : Array.isArray(v) ? v.map((x) => strip(x, d + 1)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, strip(x, d + 1)])) : v; };
  const s = strip(scene);
  return deep ? [{ level: 'FIX', path: '/', message: 'anidamiento > 32 niveles', remedy: 'aplanar la escena' }] : validate(s, SCHEMAS['world3d.scene']);
}
export const assertNotas = (d, n = 'data/notas.json') => { failOn(n, validateNotas(d), 'data/notas.schema.json'); return d; };
export const assertAudio = (d, n = 'audio.json') => { failOn(n, validateAudio(d), 'data/audio.schema.json'); return d; };
export const assertMedio = (d, n = 'medio') => { failOn(n, validateMedio(d), 'data/medio.schema.json'); return d; };
export const assertSoundStyle = (d, n = 'estilo de sonido') => { failOn(n, validateSoundStyle(d), 'data/sound-style.schema.json'); return d; };
const sceneOk = new WeakSet();
export const assertScene = (s) => { if (s && typeof s === 'object' && sceneOk.has(s)) return s; failOn('escena world3d', validateScene(s), 'data/world3d.scene.schema.json'); if (s && typeof s === 'object') sceneOk.add(s); return s; };

// Ruta confinada: resuelve `rel` dentro de `base` y rechaza ../, absolutas y NUL. Lanza con la ruta pedida.
export function safeJoin(base, rel) {
  if (typeof rel !== 'string' || !rel || rel.includes('\0')) throw new Error(`ruta inválida: ${JSON.stringify(rel)?.slice(0, 80)}`);
  const b = path.resolve(base), p = path.resolve(b, rel);
  if (path.isAbsolute(rel) || (p !== b && !p.startsWith(b + path.sep))) throw new Error(`ruta fuera de ${path.basename(b)}/: ${rel.slice(0, 80)}`);
  return p;
}
