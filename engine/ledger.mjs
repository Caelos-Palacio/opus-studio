#!/usr/bin/env node
// Ledger append-only de gobernanza: out/ledger.jsonl. Una línea JSON por decisión; NUNCA contenido crudo, solo digests.
//   {id, ts, agent, role, action, target, hash_before, hash_after, verdict, why≤140}
//   agente y rol: env OPUS_AGENT / OPUS_ROLE (por defecto "anon" / "director").
//   node engine/ledger.mjs [--tail 20] [--action gate.close] [--target X]
// Concurrencia: cada registro es UN write con O_APPEND (< 4 KiB): en Linux/macOS locales las líneas no se intercalan.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const LEDGER = path.join(ROOT, 'out/ledger.jsonl');
const MAX_LINE = 3800;

export const digest = (x) => crypto.createHash('sha256').update(Buffer.isBuffer(x) ? x : typeof x === 'string' ? x : JSON.stringify(x) ?? '').digest('hex').slice(0, 16);
// Digest de un archivo (o null si no existe): lo que va en hash_before/hash_after.
export const fileDigest = (p) => { const f = path.isAbsolute(p) ? p : path.join(ROOT, p); try { return digest(fs.readFileSync(f)); } catch { return null; } };
export const who = () => ({ agent: process.env.OPUS_AGENT || 'anon', role: process.env.OPUS_ROLE || 'director' });
const clip = (s, n) => (s == null ? null : String(s).replace(/\s+/g, ' ').slice(0, n));
const isHash = (h) => h == null || /^[0-9a-f]{6,64}$/i.test(String(h));

let warned = false;
export function record({ action, target = null, hash_before = null, hash_after = null, verdict = null, why = null, agent, role } = {}) {
  if (!action) throw new Error('ledger: action requerido');
  // Solo digests: un hash que no parece un hash se reduce a su digest (nunca se guarda contenido).
  const hb = isHash(hash_before) ? hash_before : digest(hash_before), ha = isHash(hash_after) ? hash_after : digest(hash_after);
  const w = who(), ts = new Date().toISOString();
  if (!agent && !process.env.OPUS_AGENT && !warned) { warned = true; process.stderr.write('⚠ ledger: OPUS_AGENT no está definido: esta acción se firma como "anon" (lanza el agente con OPUS_AGENT=<nombre> OPUS_ROLE=<rol>)\n'); }
  const e = { id: `${Date.now().toString(36)}-${process.pid.toString(36)}-${crypto.randomBytes(3).toString('hex')}`, ts, agent: clip(agent ?? w.agent, 64), role: clip(role ?? w.role, 32),
    action: clip(action, 48), target: clip(target, 200), hash_before: hb, hash_after: ha, verdict: clip(verdict, 24), why: clip(why, 140) };
  let line = JSON.stringify(e) + '\n'; if (Buffer.byteLength(line) > MAX_LINE) { e.target = digest(target); line = JSON.stringify(e) + '\n'; }
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  const fd = fs.openSync(LEDGER, 'a'); try { fs.writeSync(fd, line); } finally { fs.closeSync(fd); }
  return e;
}

// Lectura tolerante: una línea rota (disco lleno, kill -9) se ignora y se cuenta, no rompe la lectura.
export function readLedger(filter = {}) {
  if (!fs.existsSync(LEDGER)) return [];
  const out = []; let bad = 0;
  for (const l of fs.readFileSync(LEDGER, 'utf8').split('\n')) { if (!l) continue; try { out.push(JSON.parse(l)); } catch { bad++; } }
  out.bad = bad;
  return out.filter((e) => Object.entries(filter).every(([k, v]) => v == null || e[k] === v));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const L = readLedger({ action: arg('--action'), target: arg('--target'), agent: arg('--agent') });
  for (const e of L.slice(-(+arg('--tail', 20)))) console.log(`${e.ts}  ${String(e.agent).padEnd(10)} ${String(e.role).padEnd(9)} ${String(e.action).padEnd(14)} ${String(e.target ?? '-').padEnd(24)} ${e.verdict ?? ''}${e.why ? '  · ' + e.why : ''}`);
}
