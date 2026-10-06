// R7 (spec 009): caché por contenido de las etapas pesadas de la mezcla (música, buses de sfx). La mezcla entera se rehacía por cualquier cambio
// del timeline aunque la música (o los efectos) no cambiaran: ahora cada etapa tiene su clave y solo se re-sintetiza lo afectado.
//   memo(tag, kind, key, make) → { arrays: Float32Array[], meta, hit }      make() → { arrays, meta }
// Fichero: out/cache/audio/<tag>/<kind>-<clave>.bin = [u32 len meta][meta JSON][u32 n][u32 len_i…][f32 crudos]. Se conservan las KEEP más recientes por (tag, kind)
// (OPUS_AUDIO_KEEP, 2) y como mucho OPUS_AUDIO_CACHE_MB (2048) en total. OPUS_NOCACHE=1 no lee ni escribe.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT } from './film.mjs';
import { closure, fileDigest, sha } from './hash.mjs';

export const astats = { hit: 0, miss: 0, log: [] };
const dir = (tag) => path.join(ROOT, 'out/cache/audio', tag || '_');
const noCache = () => process.env.OPUS_NOCACHE === '1';

// firma de CÓDIGO de un módulo (cierre de imports por contenido, sin gobernanza/doc)
const CODE = new Map();
export function codeSig(file) {
  if (!CODE.has(file)) { const c = closure([file]); CODE.set(file, sha(c.files.map((f) => f + ':' + fileDigest(path.join(ROOT, f))), c.pkgs)); }
  return CODE.get(file);
}
// huella de un objeto con funciones/estructuras grandes que no cuentan (plan): JSON sin funciones + muestras de una función I(t) a 100 Hz
export function fingerprint(obj, { skip = [], fn = null, dur = 0, hz = 100 } = {}) {
  const h = crypto.createHash('sha1'), sk = new Set(skip);
  h.update(JSON.stringify(obj, (k, v) => (typeof v === 'function' || sk.has(k) ? undefined : v)));
  if (fn) { const a = new Float64Array(Math.ceil(dur * hz) + 1); for (let i = 0; i < a.length; i++) a[i] = fn(i / hz); h.update(Buffer.from(a.buffer)); }
  return h.digest('hex').slice(0, 16);
}

export function memo(tag, kind, key, make) {
  const file = path.join(dir(tag), `${kind}-${key}.bin`);
  if (!noCache()) {
    try {
      const b = fs.readFileSync(file); let o = 0; const ml = b.readUInt32LE(o); o += 4; const meta = JSON.parse(b.toString('utf8', o, o + ml)); o += ml;
      const n = b.readUInt32LE(o); o += 4; const lens = []; for (let i = 0; i < n; i++) { lens.push(b.readUInt32LE(o)); o += 4; }
      const arrays = lens.map((l) => { const a = new Float32Array(l); Buffer.from(a.buffer).set(b.subarray(o, o + 4 * l)); o += 4 * l; return a; });
      try { const t = new Date(); fs.utimesSync(file, t, t); } catch {}
      astats.hit++; astats.log.push(`${kind}:hit`); return { arrays, meta, hit: true };
    } catch {}
  }
  astats.miss++; astats.log.push(`${kind}:miss`);
  const r = make();
  if (!noCache()) {
    try {
      const m = Buffer.from(JSON.stringify(r.meta ?? null)), head = Buffer.alloc(8 + 4 * r.arrays.length + m.length - 0); let o = 0;
      head.writeUInt32LE(m.length, o); o += 4; m.copy(head, o); o += m.length; head.writeUInt32LE(r.arrays.length, o); o += 4; for (const a of r.arrays) { head.writeUInt32LE(a.length, o); o += 4; }
      fs.mkdirSync(dir(tag), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`; fs.writeFileSync(tmp, Buffer.concat([head.subarray(0, o), ...r.arrays.map((a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength))])); fs.renameSync(tmp, file);
      prune(tag, kind);
    } catch {}
  }
  return { arrays: r.arrays, meta: r.meta, hit: false };
}
function prune(tag, kind) {
  try {
    const keep = +(process.env.OPUS_AUDIO_KEEP ?? 2), fs_ = fs.readdirSync(dir(tag)).filter((f) => f.startsWith(kind + '-') && f.endsWith('.bin')).map((f) => [f, fs.statSync(path.join(dir(tag), f)).mtimeMs]).sort((a, b) => b[1] - a[1]);
    for (const [f] of fs_.slice(keep)) fs.rmSync(path.join(dir(tag), f), { force: true });
    const root = path.join(ROOT, 'out/cache/audio'), all = []; let tot = 0;
    for (const d of fs.readdirSync(root)) for (const f of fs.readdirSync(path.join(root, d))) { const p = path.join(root, d, f), st = fs.statSync(p); all.push([p, st.size, st.mtimeMs]); tot += st.size; }
    const cap = +(process.env.OPUS_AUDIO_CACHE_MB ?? 2048) * 2 ** 20; all.sort((a, b) => a[2] - b[2]);
    for (const [p, sz] of all) { if (tot <= cap) break; fs.rmSync(p, { force: true }); tot -= sz; }
  } catch {}
}
