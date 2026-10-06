// R1 (spec 009): caché COMPARTIDA de fotogramas para análisis. lint (layout/motion/rhythm/transitions), arc, peek e index renderizaban cada
// uno sus propios fotogramas; ahora se renderiza una vez y se analiza muchas.
//   const FC = frameCache({ film, size: '192x108', grade: false, make: async () => makeRenderer(...) });   // make solo corre en el 1.er fallo
//   const f = await FC.get(t, { px: true, guard: guardCtx });  →  { boxes (con .meta), guardLog, data (RGBA, si px), W, H, hit }
// Clave = sha(filmSig, entradas cocinadas de los shots ACTIVOS en t, t, tamaño, grade, guardia). Cambiar un shot solo invalida los
// fotogramas donde está activo. Se guarda en out/cache/frames/<xx>/<clave>.fr (v8.serialize + píxeles deflate). Los píxeles solo si se piden.
// OPUS_NOCACHE=1: no lee ni escribe (el determinismo y las medidas en frío lo usan). Poda: OPUS_FRAME_CACHE_MB (1024) por antigüedad.
import fs from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';
import zlib from 'node:zlib';
import { ROOT } from './film.mjs';
import { sha } from './hash.mjs';
import { filmSig, shotKey } from './cookkey.mjs';
import { activeShots } from './seek.mjs';

export const noCache = () => process.env.OPUS_NOCACHE === '1';
export const stats = { hit: 0, miss: 0, missT: [], getT: [], det: { hit: 0, miss: 0 } };
const dir = () => path.join(ROOT, 'out/cache/frames');
let wrote = 0, pruned = false;

export function frameKey(film, t, { W, H, grade, guard = false }) {
  const tt = +(+t).toFixed(6), act = activeShots(film, film.timeMap ? film.timeMap(tt) : tt);   // mismos shots que seek(): tiempo ya remapeado por la EDL
  return sha(filmSig(film), act.map((s) => s.id + ':' + shotKey(film, s)), tt, W, H, grade ? 1 : 0, guard ? 1 : 0);
}
const fileOf = (k) => path.join(dir(), k.slice(0, 2), k + '.fr');

function read(file, px) {
  let b; try { b = fs.readFileSync(file); } catch { return null; }
  try {
    const hl = b.readUInt32LE(0), h = v8.deserialize(b.subarray(4, 4 + hl));
    if (px && !h.hasPx) return null;
    const out = { boxes: h.boxes, guardLog: h.guardLog, data: null };
    out.boxes.meta = h.meta;
    if (px) { const raw = zlib.inflateSync(b.subarray(4 + hl)); out.data = new Uint8ClampedArray(raw.buffer, raw.byteOffset, raw.length); }
    try { const n = new Date(); fs.utimesSync(file, n, n); } catch {}
    return out;
  } catch { return null; }
}
function write(file, boxes, guardLog, data) {
  try {
    const meta = boxes.meta, arr = [...boxes];
    const head = v8.serialize({ boxes: arr, meta: meta ?? [], guardLog, hasPx: !!data }), len = Buffer.alloc(4); len.writeUInt32LE(head.length);
    const body = data ? zlib.deflateSync(Buffer.from(data.buffer, data.byteOffset, data.length), { level: 1 }) : Buffer.alloc(0);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
    fs.writeFileSync(tmp, Buffer.concat([len, head, body])); fs.renameSync(tmp, file); wrote++;
  } catch {}
}
// Poda por antigüedad cuando la caché supera el tope (una vez por proceso, solo si este proceso escribió).
export function pruneFrames(maxMB = +(process.env.OPUS_FRAME_CACHE_MB ?? 1024)) {
  if (pruned || !wrote) return; pruned = true;
  try {
    const all = []; let total = 0;
    for (const d of fs.readdirSync(dir())) for (const f of fs.readdirSync(path.join(dir(), d))) { const p = path.join(dir(), d, f), st = fs.statSync(p); all.push([p, st.size, st.mtimeMs]); total += st.size; }
    if (total <= maxMB * 2 ** 20) return;
    all.sort((a, b) => a[2] - b[2]);
    for (const [p, sz] of all) { if (total <= maxMB * 2 ** 20 * 0.8) break; fs.rmSync(p, { force: true }); total -= sz; }
  } catch {}
}
process.on('exit', () => pruneFrames());

export function frameCache({ film, size, grade = true, make }) {
  let R = null, WH = null;
  const rend = async () => (R ??= await make());
  const dims = () => {                                                       // tamaño de salida sin crear el renderizador (igual que makeRenderer)
    if (WH) return WH;
    let [W, H] = size ? size.split('x').map(Number) : [film.width, film.height]; W -= W % 2; H -= H % 2; return (WH = [W, H]);
  };
  return {
    stats,
    // ¿están TODOS esos fotogramas en disco? (lint --shot: arc solo corre si no hay que renderizar nada)
    hasAll(ts, { px = false } = {}) {
      if (noCache()) return false; const [W, H] = dims();
      return ts.every((t) => { const f = fileOf(frameKey(film, t, { W, H, grade })); try { if (!px) return fs.existsSync(f); const fd = fs.openSync(f, 'r'); const b = Buffer.alloc(4); fs.readSync(fd, b, 0, 4, 0); const hl = b.readUInt32LE(0), hb = Buffer.alloc(hl); fs.readSync(fd, hb, 0, hl, 4); fs.closeSync(fd); return v8.deserialize(hb).hasPx; } catch { return false; } });
    },
    get renderer() { return R; },
    // t → { boxes, guardLog, data, W, H, hit }. guard: función guardCtx (activa la guardia durante el render y devuelve los registros).
    async get(t, { px = false, guard = null } = {}) {
      const [W, H] = dims(), key = frameKey(film, t, { W, H, grade, guard: !!guard }), file = fileOf(key);
      if (!noCache()) { const h = read(file, px); if (h) { stats.hit++; return { ...h, W, H, hit: true }; } }
      stats.miss++; stats.missT.push(+(+t).toFixed(6));
      const r = await rend();
      const pg = r.film.guard, pl = r.film.guardLog;
      if (guard) { r.film.guard = guard; r.film.guardLog = []; }
      const boxes = r.frame(t), guardLog = guard ? r.film.guardLog : [];
      if (guard) { r.film.guard = pg; r.film.guardLog = pl; }
      const data = px ? r.ctx.getImageData(0, 0, r.W, r.H).data : null;
      if (!noCache()) write(file, boxes, guardLog, data);
      return { boxes, guardLog, data, W: r.W, H: r.H, hit: false };
    },
  };
}
