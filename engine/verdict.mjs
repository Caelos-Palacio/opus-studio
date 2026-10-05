// Veredictos direccionados por contenido: todo veredicto lleva {engineHash, filmHash, shotHash}. Un veredicto con hash distinto
// al actual NO EXISTE (isFresh = false). Se calcula desde los archivos fuente (sin render ni canvas): barato para gate y cut.
//   engineHash = engine/*.mjs|json (menos herramientas de gobernanza/documentación) + versión de canvas
//   filmHash   = timeline + estilos + audio/hechos + autocam horneada + EDL + overrides de env + código de TODOS los shots + assets
//   shotHash   = entrada del shot en el timeline + su código y dependencias importadas (./x.mjs)
//   ctxHash    = filmHash sin los shots (lo global que afecta a cualquier shot); un veredicto de shot también fija a sus vecinos.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, digest } from './ledger.mjs';

for (const k of ['style', 'profile', 'timeline', 'edit']) { const i = process.argv.indexOf('--' + k); if (i >= 0 && process.argv[i + 1]) process.env['OPUS_' + k.toUpperCase()] = process.argv[i + 1]; }
const NON_PIXEL = new Set(['ledger', 'lock', 'gate', 'roles', 'verdict', 'doc', 'gallery', 'q']);   // no cambian píxeles ni el juicio del lint
const rdB = (p) => { try { return fs.readFileSync(path.join(ROOT, p)); } catch { return ''; } };
const tlPath = () => process.env.OPUS_TIMELINE ?? 'data/timeline.json';
export const filmKey = () => { const b = path.basename(tlPath(), '.json'); return (b === 'timeline' ? 'main' : b) + (process.env.OPUS_EDIT ? '.edit' : ''); };
export const lintDir = () => path.join(ROOT, 'out/lint', filmKey());

function shotCode(id, seen = new Set()) {
  if (seen.has(id)) return ''; seen.add(id);
  const f = path.join(ROOT, 'shots', id + '.mjs'); if (!fs.existsSync(f)) return '';
  const src = fs.readFileSync(f, 'utf8'); let out = src;
  for (const [, dep] of src.matchAll(/from\s+['"]\.\/([\w-]+)\.mjs['"]/g)) out += shotCode(dep, seen);
  return out;
}
function assetsList() {
  const d = path.join(ROOT, 'assets'), acc = []; if (!fs.existsSync(d)) return acc;
  const walk = (p) => { for (const e of fs.readdirSync(p, { withFileTypes: true })) { const q = path.join(p, e.name); if (e.isDirectory()) { if (!q.includes(path.join('cache', 'tex'))) walk(q); } else if (!/\d{6}\.jpg$/.test(e.name)) { const s = fs.statSync(q); acc.push(path.relative(d, q) + ':' + s.size + ':' + s.mtimeMs); } } };
  walk(d); return acc.sort();
}
export function engineHash() {
  const ed = path.join(ROOT, 'engine'), fl = fs.readdirSync(ed).filter((f) => /\.(mjs|json)$/.test(f) && !NON_PIXEL.has(f.replace(/\.\w+$/, ''))).sort();
  let cv = ''; try { cv = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/canvas/package.json'), 'utf8')).version; } catch {}
  return digest(fl.map((f) => f + '\u0000' + digest(fs.readFileSync(path.join(ed, f)))).join('\n') + cv);
}
// Hashes actuales (lo que un veredicto debe igualar para existir).
export function currentHashes() {
  const tlRaw = rdB(tlPath()), tl = (() => { try { return JSON.parse(tlRaw); } catch { return { shots: [] }; } })(), shots = Array.isArray(tl.shots) ? tl.shots : [];
  const styles = fs.existsSync(path.join(ROOT, 'styles')) ? fs.readdirSync(path.join(ROOT, 'styles')).filter((f) => f.endsWith('.json')).sort().map((f) => f + digest(rdB('styles/' + f))) : [];
  const env = ['OPUS_STYLE', 'OPUS_PROFILE', 'OPUS_EDIT'].map((k) => process.env[k] ?? '');
  const byId = {}; for (const s of shots) if (s && s.id) byId[s.id] = digest(JSON.stringify(s) + '\u0000' + shotCode(s.id));
  const { shots: _, ...globals } = tl;
  const ctxHash = digest([JSON.stringify(globals), styles.join(','), digest(rdB('data/audio.json')), digest(rdB('data/facts.json')), digest(rdB(path.join('data/autocam', path.basename(tlPath())))), process.env.OPUS_EDIT ? digest(rdB(process.env.OPUS_EDIT)) : '', env.join('|'), assetsList().join('|')].join('\n'));
  const order = shots.map((s) => s?.id).filter(Boolean);
  return { engineHash: engineHash(), filmHash: digest(ctxHash + order.map((id) => id + byId[id]).join('|') + digest(tlRaw)), ctxHash, shots: byId, order, film: filmKey() };
}
export const neighbors = (cur, id) => { const i = cur.order.indexOf(id); return i < 0 ? [] : [cur.order[i - 1], cur.order[i + 1]].filter(Boolean); };
// Sello que se embebe en el JSON del veredicto.
export function stamp(cur, shot = null) {
  const base = { engineHash: cur.engineHash, filmHash: cur.filmHash, film: cur.film };
  if (!shot) return { scope: 'film', ...base };
  return { scope: 'shot', shot, ...base, shotHash: cur.shots[shot] ?? null, ctxHash: cur.ctxHash, neighbors: Object.fromEntries(neighbors(cur, shot).map((n) => [n, cur.shots[n]])) };
}
// Un veredicto sin hashes o con hashes distintos a los actuales no existe.
export function isFresh(v, cur = currentHashes()) {
  if (!v || typeof v !== 'object' || !v.engineHash || v.engineHash !== cur.engineHash) return false;
  if (v.film && v.film !== cur.film) return false;
  if (v.scope === 'shot') return !!v.shotHash && v.shotHash === cur.shots[v.shot] && v.ctxHash === cur.ctxHash && Object.entries(v.neighbors ?? {}).every(([n, h]) => cur.shots[n] === h);
  return !!v.filmHash && v.filmHash === cur.filmHash;
}
export const readJSON = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
export const lintFile = () => path.join(ROOT, 'out/lint.json');
// Estado del veredicto global del lint: {verdict, fresh, why}
export function lintState(cur = currentHashes()) {
  const v = readJSON(lintFile());
  if (!v) return { verdict: null, fresh: false, why: 'sin out/lint.json (corre npm run lint)' };
  if (v.partial) return { verdict: v.verdict, fresh: false, why: 'veredicto parcial (--only/--shot) no vale como global' };
  if (!isFresh(v, cur)) return { verdict: v.verdict, fresh: false, why: 'veredicto caducado: motor, timeline, estilo o shots cambiaron desde el lint' };
  return { verdict: v.verdict, fresh: true, why: v.verdict === 'SHIP' ? 'SHIP vigente' : `lint en ${v.verdict}` };
}
