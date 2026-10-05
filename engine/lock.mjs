#!/usr/bin/env node
// Claims con lease: un agente solo escribe lo que tiene reclamado; un proceso solo hace read-modify-write bajo lock.
//   out/locks/<target>.json = {target, agent, pid, host, token, ts, expires}
//   claim(target, agent?, ttlMs?)  → lock | null (ocupado)      release(lock) → bool
//   withLock(target, fn, opts)      async, con renovación del lease mientras fn corre
//   withLockSync(target, fn, opts)  síncrono (caché TeX dentro de seek)
//   node engine/lock.mjs claim shots/A2.mjs [--ttl 3600000] | release shots/A2.mjs | list
// Creación EXCLUSIVA y atómica: se escribe tmp y se enlaza (link falla si ya existe: nunca hay un lock a medias).
// Renovación: tmp + rename. Lease caducado (o proceso dueño muerto en este host) = liberable; el robo pasa por un guard exclusivo.
import fs from 'node:fs';
import { isMain } from './paths.mjs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, record, who } from './ledger.mjs';

export const LOCKS = path.join(ROOT, 'out/locks');
const HOST = os.hostname();
export const lockFile = (target) => path.join(LOCKS, String(target).replace(/[^\w.-]+/g, '_').slice(0, 80) + '-' + crypto.createHash('sha1').update(String(target)).digest('hex').slice(0, 6) + '.json');
const held = new Map();                                                     // target → {lock, depth}: reentrante en el mismo proceso
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rd = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

export function writeAtomic(file, data) {                                   // tmp + rename: el lector ve el archivo viejo o el nuevo, nunca uno a medias
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, data); fs.renameSync(tmp, file);
}
// durable = claim de un AGENTE (CLI): vive por su TTL aunque el proceso que lo creó termine. Si no, un dueño muerto libera el lock.
export const expired = (L, now = Date.now()) => !L || L.expires <= now || (!L.durable && L.host === HOST && L.pid !== process.pid && !alive(L.pid));
export function holder(target) { const L = rd(lockFile(target)); return L && !expired(L) ? L : null; }

function steal(f, seen) {                                                  // borra un lock caducado SOLO si sigue siendo el mismo que vimos
  const g = f + '.steal';
  try { fs.writeFileSync(g, String(process.pid), { flag: 'wx' }); } catch { try { if (Date.now() - fs.statSync(g).mtimeMs > 10000) fs.rmSync(g, { force: true }); } catch {} return false; }
  try { const cur = rd(f); if (cur && cur.token === seen.token && expired(cur)) { fs.rmSync(f, { force: true }); record({ action: 'lock.steal', target: seen.target, verdict: 'expired', why: `lease de ${seen.agent} (pid ${seen.pid}) caducado` }); return true; } return !cur; }
  finally { fs.rmSync(g, { force: true }); }
}

export function claim(target, agent = who().agent, ttlMs = 30000, { durable = false } = {}) {
  const f = lockFile(target), h = held.get(target);
  if (h) { h.depth++; return h.lock; }
  fs.mkdirSync(LOCKS, { recursive: true });
  for (let k = 0; k < 3; k++) {
    const L = { target: String(target), agent, pid: process.pid, host: HOST, token: crypto.randomBytes(8).toString('hex'), ts: Date.now(), expires: Date.now() + ttlMs, ttlMs, ...(durable ? { durable } : {}) };
    const tmp = `${f}.${L.token}.tmp`; fs.writeFileSync(tmp, JSON.stringify(L));
    try { fs.linkSync(tmp, f); held.set(target, { lock: L, depth: 1 }); return L; }
    catch (e) { if (e.code !== 'EEXIST') throw e; }
    finally { fs.rmSync(tmp, { force: true }); }
    const cur = rd(f);
    if (cur && !expired(cur)) { if (durable && cur.durable && cur.agent === agent) { renew(cur, ttlMs); return cur; } return null; }
    if (!cur) { try { if (Date.now() - fs.statSync(f).mtimeMs < 2000) return null; } catch { continue; } fs.rmSync(f, { force: true }); continue; }   // ilegible y viejo: basura
    if (!steal(f, cur)) return null;
  }
  return null;
}
export function renew(L, ttlMs = L.ttlMs) {
  const f = lockFile(L.target), cur = rd(f); if (!cur || cur.token !== L.token) return false;
  L.expires = Date.now() + ttlMs; writeAtomic(f, JSON.stringify(L)); return true;
}
export function release(L) {
  if (!L) return false;
  const h = held.get(L.target); if (h && h.lock.token === L.token && --h.depth > 0) return true;
  held.delete(L.target);
  const f = lockFile(L.target), cur = rd(f); if (!cur || cur.token !== L.token) return false;
  fs.rmSync(f, { force: true }); return true;
}
// Libera un lock por nombre si es de este agente (CLI) — o cualquiera caducado.
export function releaseTarget(target, agent = who().agent) {
  const f = lockFile(target), cur = rd(f); if (!cur) return false;
  if (cur.agent !== agent && !expired(cur)) return false;
  fs.rmSync(f, { force: true }); held.delete(target); return true;
}

const busy = (target, waitMs) => { const L = holder(target); return new Error(`lock "${target}" ocupado${L ? ` por ${L.agent} (pid ${L.pid})` : ''} tras ${waitMs} ms`); };
export async function withLock(target, fn, { agent, ttlMs = 30000, waitMs = 120000 } = {}) {
  const t0 = Date.now(); let L, d = 20;
  while (!(L = claim(target, agent, ttlMs))) { if (Date.now() - t0 > waitMs) throw busy(target, waitMs); await sleep(d + Math.random() * d); d = Math.min(500, d * 1.5); }
  const hb = setInterval(() => renew(L), Math.max(200, ttlMs / 3)); hb.unref?.();
  try { return await fn(L); } finally { clearInterval(hb); release(L); }
}
export function withLockSync(target, fn, { agent, ttlMs = 30000, waitMs = 60000 } = {}) {
  const t0 = Date.now(); let L, d = 5;
  while (!(L = claim(target, agent, ttlMs))) { if (Date.now() - t0 > waitMs) throw busy(target, waitMs); sleepSync(d + Math.random() * d); d = Math.min(200, d * 1.5); }
  try { return fn(L); } finally { release(L); }
}
export function listLocks() {
  if (!fs.existsSync(LOCKS)) return [];
  return fs.readdirSync(LOCKS).filter((f) => f.endsWith('.json')).map((f) => rd(path.join(LOCKS, f))).filter(Boolean).map((L) => ({ ...L, expired: expired(L) }));
}

if (isMain(import.meta.url)) {
  const [cmd, target] = process.argv.slice(2), argv = process.argv.slice(2), ttl = argv.includes('--ttl') ? +argv[argv.indexOf('--ttl') + 1] : 3600000;
  if (cmd === 'claim') {
    const L = claim(target, who().agent, ttl, { durable: true });
    if (!L) { const h = holder(target); console.error(`ocupado por ${h?.agent ?? '?'} hasta ${h ? new Date(h.expires).toISOString() : '?'}`); process.exit(1); }
    held.clear();                                                             // el claim del CLI sobrevive al proceso (lease por TTL)
    record({ action: 'claim', target, verdict: 'ok', why: `ttl ${ttl} ms` }); console.log(`✓ ${target} reclamado por ${L.agent} hasta ${new Date(L.expires).toISOString()}`);
  } else if (cmd === 'release') {
    const ok = releaseTarget(target); record({ action: 'release', target, verdict: ok ? 'ok' : 'denied' }); console.log(ok ? `✓ ${target} liberado` : `✗ ${target}: no es tuyo (o no existe)`); process.exit(ok ? 0 : 1);
  } else if (cmd === 'list') for (const L of listLocks()) console.log(`${L.expired ? '·' : '●'} ${L.target.padEnd(28)} ${String(L.agent).padEnd(12)} pid ${L.pid}  hasta ${new Date(L.expires).toISOString()}`);
  else console.log('Uso: node engine/lock.mjs claim <target> [--ttl ms] | release <target> | list');
}
