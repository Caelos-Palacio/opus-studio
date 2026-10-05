#!/usr/bin/env node
// Ledger de gobernanza, append-only y TAMPER-EVIDENT: out/ledger.jsonl. Una línea JSON por decisión; NUNCA contenido crudo, solo digests.
//   {id, ts, agent, role, action, target, hash_before, hash_after, verdict, why≤140, code, [tokens, ms], prev, h, [sig]}
//   agente y rol: env OPUS_AGENT / OPUS_ROLE (por defecto "anon" / "director").
// Cadena: prev = h de la entrada anterior; h = sha256(JSON de la entrada sin h/sig)[:32]. Editar, borrar, reordenar o insertar rompe la cadena.
//   out/ledger.head = {n, h} de la última entrada (detecta el borrado del final: una cadena no puede probar que no le falta la cola).
// Firma opcional por agente: out/keys/<agente> (secreto hex, fuera de git) → sig = HMAC-SHA256(clave, h)[:32]. Una vez que un agente tiene
//   clave (key.create o primera entrada firmada), TODA entrada suya posterior debe ir firmada: quitar la firma se detecta.
// Migración: un ledger heredado (sin h) se sella con una entrada ledger.genesis cuyo hash_after es el digest de los bytes anteriores.
// Límite honesto: quien reescribe TODO el ledger recalculando hashes y no tiene las claves no se detecta salvo por head/firmas.
// Concurrencia: leer-la-última + escribir va bajo un lock de fichero (out/ledger.lock, con robo si caduca); cada registro es UN write con O_APPEND.
//   node engine/ledger.mjs [--tail 20] [--action X] [--target X] [--agent X]
//   node engine/ledger.mjs verify [--require-sig] | migrate | keygen <agente> | stats | budget
import fs from 'node:fs';
import { rootFrom, isMain } from './paths.mjs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ROOT = rootFrom(import.meta.url);
export const LEDGER = path.join(ROOT, 'out/ledger.jsonl');
export const HEAD = path.join(ROOT, 'out/ledger.head');
const LOCK = path.join(ROOT, 'out/ledger.lock');
export const KEYS_DIR = process.env.OPUS_KEYS_DIR || path.join(ROOT, 'out/keys');
const MAX_LINE = 3800;

// ── Vocabulario cerrado de acción.veredicto (research/10 rec. 2). Fácil de mover a engine/vocab.mjs: es solo este bloque.
// '*' = cualquier veredicto de esa acción. Una entrada con action.verdict fuera de la tabla queda con code: null y cuenta como sin codificar.
export const ACTION_VERDICTS = {
  lint: ['SHIP', 'PASS', 'FIX'], master: ['ok'], review: ['ok'], 'master.force': ['forced'],
  'gate.close': ['closed', 'open', 'forced'], 'gate.force': ['forced'], 'gate.restore': ['restored'], 'gate.frozen': ['frozen'], 'gate.reopen': ['reopened'],
  claim: ['ok', 'denied'], release: ['ok', 'denied'], 'lock.steal': ['expired'], 'fragment.discard': ['stale'], trash: ['moved'],
  write: ['allow', 'deny', 'would_allow', 'would_deny'],
  'orch.state': ['*'], 'orch.decide': ['*'], 'orch.accept': ['*'], 'orch.freeze': ['frozen'], 'orch.unfreeze': ['unfrozen'], 'orch.escalate': ['director'],
  'orch.propose': ['pending'], 'orch.note': ['pending'], 'orch.deliver': ['accepted', 'rejected'], 'contract.freeze': ['frozen'],
  'ledger.genesis': ['ok'], 'key.create': ['ok'], usage: ['ok'], 'budget.warn': ['warn'], 'budget.block': ['block'], 'status.gen': ['ok'],
};
// Motivos cerrados (campo `code` explícito, opcional): sustituyen al texto libre de `why` para agregar y calibrar.
export const REASONS = ['schema.invalid', 'hash.stale', 'budget.exceeded', 'director.forced', 'frozen.k', 'role.denied', 'claim.held', 'critic.fix', 'lint.fix', 'oscillation'];
export const CODES = new Set(Object.entries(ACTION_VERDICTS).flatMap(([a, vs]) => vs.map((v) => `${a}.${v}`)));
export const codeOf = (action, verdict, explicit) => {
  if (explicit && REASONS.includes(explicit)) return explicit;
  const vs = ACTION_VERDICTS[action]; if (!vs) return null;
  if (vs.includes('*')) return `${action}.*`;
  return verdict != null && vs.includes(verdict) ? `${action}.${verdict}` : null;
};

export const digest = (x) => crypto.createHash('sha256').update(Buffer.isBuffer(x) ? x : typeof x === 'string' ? x : JSON.stringify(x) ?? '').digest('hex').slice(0, 16);
// Digest de un archivo (o null si no existe): lo que va en hash_before/hash_after.
export const fileDigest = (p) => { const f = path.isAbsolute(p) ? p : path.join(ROOT, p); try { return digest(fs.readFileSync(f)); } catch { return null; } };
export const who = () => ({ agent: process.env.OPUS_AGENT || 'anon', role: process.env.OPUS_ROLE || 'director' });
const clip = (s, n) => (s == null ? null : String(s).replace(/\s+/g, ' ').slice(0, n));
const isHash = (h) => h == null || /^[0-9a-f]{6,64}$/i.test(String(h));
const H = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 32);
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const keyFile = (agent) => path.join(KEYS_DIR, String(agent).replace(/[^\w.-]+/g, '_').slice(0, 64));
const keyOf = (agent) => { try { return fs.readFileSync(keyFile(agent), 'utf8').trim() || null; } catch { return null; } };
const sign = (key, h) => crypto.createHmac('sha256', key).update(h).digest('hex').slice(0, 32);

// Lock del ledger (propio: lock.mjs importa este módulo). Caduca a los 5 s (un proceso muerto no bloquea).
function withLedgerLock(fn) {
  fs.mkdirSync(path.dirname(LOCK), { recursive: true });
  const t0 = Date.now(); let fd = null;
  for (;;) {
    try { fd = fs.openSync(LOCK, 'wx'); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let age = 0; try { age = Date.now() - fs.statSync(LOCK).mtimeMs; } catch { continue; }
      if (age > 5000 || Date.now() - t0 > 15000) { try { fs.rmSync(LOCK, { force: true }); } catch {} continue; }
      sleepSync(2 + Math.random() * 8);
    }
  }
  try { return fn(); } finally { try { fs.closeSync(fd); } catch {} try { fs.rmSync(LOCK, { force: true }); } catch {} }
}

// Última entrada parseable (lee solo la cola) y si el fichero termina en salto de línea.
function tail() {
  let fd; try { fd = fs.openSync(LEDGER, 'r'); } catch { return { last: null, size: 0, nl: true }; }
  try {
    const size = fs.fstatSync(fd).size; if (!size) return { last: null, size: 0, nl: true };
    const len = Math.min(size, 32768), buf = Buffer.alloc(len); fs.readSync(fd, buf, 0, len, size - len);
    const ls = buf.toString('utf8').split('\n'); let last = null;
    for (let i = ls.length - 1; i >= 0 && !last; i--) { if (!ls[i]) continue; try { last = JSON.parse(ls[i]); } catch {} }
    return { last, size, nl: buf[len - 1] === 10 };
  } finally { fs.closeSync(fd); }
}
const writeHead = (n, h) => { const t = `${HEAD}.${process.pid}.tmp`; fs.writeFileSync(t, JSON.stringify({ n, h })); fs.renameSync(t, HEAD); };
const readHead = () => { try { return JSON.parse(fs.readFileSync(HEAD, 'utf8')); } catch { return null; } };

// Construye, encadena, firma y escribe UNA entrada. Debe llamarse con el lock tomado.
function append(base, prevH) {
  const e = { ...base, prev: prevH };
  if (Buffer.byteLength(JSON.stringify(e)) + 80 > MAX_LINE) e.target = digest(base.target);
  e.h = H(JSON.stringify(e));
  const key = keyOf(e.agent); if (key) e.sig = sign(key, e.h);
  const fd = fs.openSync(LEDGER, 'a'); try { fs.writeSync(fd, JSON.stringify(e) + '\n'); } finally { fs.closeSync(fd); }
  return e;
}
const mk = (o) => ({ id: `${Date.now().toString(36)}-${process.pid.toString(36)}-${crypto.randomBytes(3).toString('hex')}`, ts: new Date().toISOString(), ...o });
// Sella un ledger heredado (líneas sin h) con un génesis. Con el lock tomado.
function genesisIfLegacy(t = tail()) {
  if (!t.size) return null;
  if (!t.nl) fs.appendFileSync(LEDGER, '\n');                                  // línea a medias (kill -9): se cierra, verify la informa como corrupta
  if (t.last && t.last.h) return null;
  const raw = fs.readFileSync(LEDGER), n = raw.toString('utf8').split('\n').filter(Boolean).length;
  const w = who();
  return append(mk({ agent: 'ledger', role: w.role, action: 'ledger.genesis', target: 'out/ledger.jsonl', hash_before: null, hash_after: H(raw).slice(0, 16), verdict: 'ok', why: `sella ${n} entradas heredadas`, code: 'ledger.genesis.ok' }), null);
}

let warned = false;
export function record({ action, target = null, hash_before = null, hash_after = null, verdict = null, why = null, agent, role, code, tokens, ms } = {}) {
  if (!action) throw new Error('ledger: action requerido');
  // Solo digests: un hash que no parece un hash se reduce a su digest (nunca se guarda contenido).
  const hb = isHash(hash_before) ? hash_before : digest(hash_before), ha = isHash(hash_after) ? hash_after : digest(hash_after);
  const w = who();
  if (!agent && !process.env.OPUS_AGENT && !warned) { warned = true; process.stderr.write('⚠ ledger: OPUS_AGENT no está definido: esta acción se firma como "anon" (lanza el agente con OPUS_AGENT=<nombre> OPUS_ROLE=<rol>)\n'); }
  const base = mk({ agent: clip(agent ?? w.agent, 64), role: clip(role ?? w.role, 32), action: clip(action, 48), target: clip(target, 200), hash_before: hb, hash_after: ha, verdict: clip(verdict, 24), why: clip(why, 140) });
  base.code = codeOf(base.action, base.verdict, code);
  if (Number.isFinite(tokens)) base.tokens = Math.round(tokens);
  if (Number.isFinite(ms)) base.ms = Math.round(ms);
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  return withLedgerLock(() => {
    let t = tail(); genesisIfLegacy(t); if (t.size) t = tail();
    const prevN = (readHead()?.n ?? 0), e = append(base, t.last?.h ?? null);
    writeHead(prevN + 1, e.h);
    return e;
  });
}
// Consumo (tokens / minutos de render): lo lee engine/budget.mjs. target = film/<f>/task/<t>.
export const recordUsage = ({ tokens, minutes, role, task, film, agent, why } = {}) =>
  record({ action: 'usage', verdict: 'ok', target: [film && `film/${film}`, task && `task/${task}`].filter(Boolean).join('/') || null, tokens, ms: Number.isFinite(minutes) ? minutes * 60000 : undefined, role, agent, why });
export const migrate = () => withLedgerLock(() => { const g = genesisIfLegacy(); if (g) writeHead((readHead()?.n ?? 0) + 1, g.h); return g; });

export function keygen(agent) {
  if (!agent) throw new Error('keygen: agente requerido');
  fs.mkdirSync(KEYS_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(keyFile(agent), crypto.randomBytes(32).toString('hex') + '\n', { mode: 0o600, flag: 'wx' });
  return record({ action: 'key.create', target: 'agent/' + agent, verdict: 'ok', why: 'clave HMAC creada (out/keys, fuera de git)', agent });
}

// Lectura tolerante: una línea rota (disco lleno, kill -9) se ignora y se cuenta, no rompe la lectura.
export function readLedger(filter = {}) {
  if (!fs.existsSync(LEDGER)) return [];
  const out = []; let bad = 0;
  for (const l of fs.readFileSync(LEDGER, 'utf8').split('\n')) { if (!l) continue; try { out.push(JSON.parse(l)); } catch { bad++; } }
  out.bad = bad;
  return out.filter((e) => Object.entries(filter).every(([k, v]) => v == null || e[k] === v));
}

// Verificación de la cadena. problems[].kind: corrupt | edit | chain | genesis | truncated | sig | unsigned.
export function verify({ requireSig = false } = {}) {
  const R = { ok: true, n: 0, legacy: 0, chained: 0, signed: 0, problems: [], warnings: [] };
  const bad = (line, kind, msg) => R.problems.push({ line, kind, msg });
  if (!fs.existsSync(LEDGER)) return R;
  const lines = fs.readFileSync(LEDGER, 'utf8').split('\n'); if (lines.at(-1) === '') lines.pop();
  let prevH = null, started = false, lastH = null; const armed = new Set(), noKey = new Set();
  lines.forEach((raw, i) => {
    const ln = i + 1; if (!raw) return;
    let e; try { e = JSON.parse(raw); } catch { return bad(ln, 'corrupt', 'línea no parseable'); }
    R.n++;
    if (e.h === undefined) { if (!started) { R.legacy++; return; } return bad(ln, 'chain', 'entrada sin h dentro de la cadena (insertada)'); }
    const { h, sig, ...rest } = e;
    if (!started) {
      started = true;
      if (R.legacy) {
        if (e.action !== 'ledger.genesis' || e.prev !== null) bad(ln, 'chain', 'tras entradas heredadas falta el génesis');
        else if (e.hash_after !== H(Buffer.from(lines.slice(0, i).join('\n') + '\n')).slice(0, 16)) bad(ln, 'genesis', 'las entradas heredadas no coinciden con el digest sellado');
      } else if (e.prev !== null) bad(ln, 'chain', 'la primera entrada debe tener prev null (faltan entradas anteriores)');
    } else if (e.prev !== prevH) bad(ln, 'chain', 'prev no coincide con la entrada anterior (borrado, reordenación o inserción)');
    if (H(JSON.stringify(rest)) !== h) bad(ln, 'edit', 'h no coincide: la entrada fue editada');
    R.chained++; prevH = h; lastH = h;
    const a = e.agent;
    if (sig !== undefined) {
      R.signed++; armed.add(a); const key = keyOf(a);
      if (!key) noKey.add(a); else if (sign(key, h) !== sig) bad(ln, 'sig', `firma inválida de ${a}`);
    } else if (e.action === 'key.create' && e.target === 'agent/' + a) armed.add(a);
    else if (armed.has(a)) bad(ln, 'unsigned', `${a} tiene clave y esta entrada no está firmada`);
    else if (requireSig) bad(ln, 'unsigned', 'firma requerida (--require-sig)');
  });
  for (const a of noKey) R.warnings.push(`firmas de ${a}: no verificable (sin out/keys/${a})`);
  const head = readHead();
  if (head && lastH !== null && head.h !== lastH) bad(lines.length, 'truncated', 'out/ledger.head no coincide con la última entrada (cola borrada o ledger reemplazado)');
  else if (!head && R.chained) R.warnings.push('sin out/ledger.head: no se puede detectar el borrado de la cola');
  if (R.legacy && !R.chained) R.warnings.push(`${R.legacy} entradas heredadas sin sellar (node engine/ledger.mjs migrate)`);
  R.ok = R.problems.length === 0; return R;
}

// % de entradas con código cerrado.
export function stats() {
  const E = readLedger(), un = new Map(); let coded = 0; const byCode = {};
  for (const e of E) {
    const c = e.code !== undefined ? e.code : codeOf(e.action, e.verdict);
    if (c) { coded++; byCode[c] = (byCode[c] ?? 0) + 1; } else { const k = `${e.action}|${e.verdict ?? ''}`; un.set(k, (un.get(k) ?? 0) + 1); }
  }
  return { total: E.length, coded, uncoded: [...un].map(([k, n]) => ({ action: k.split('|')[0], verdict: k.split('|')[1] || null, n })), byCode };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; }, cmd = argv[0];
  if (cmd === 'verify') {
    const v = verify({ requireSig: argv.includes('--require-sig') });
    for (const p of v.problems.slice(0, 20)) console.log(`✗ línea ${p.line} [${p.kind}] ${p.msg}`);
    for (const w of v.warnings) console.log(`⚠ ${w}`);
    console.log(`${v.ok ? '✓' : '✗'} ledger: ${v.n} entradas (${v.chained} encadenadas, ${v.legacy} heredadas, ${v.signed} firmadas)${v.ok ? ' · cadena íntegra' : ` · ${v.problems.length} problemas`}`);
    process.exit(v.ok ? 0 : 1);
  } else if (cmd === 'migrate') { const g = migrate(); console.log(g ? `✓ génesis ${g.h} (${g.why})` : 'nada que migrar'); }
  else if (cmd === 'keygen') { try { keygen(argv[1]); console.log(`✓ clave de ${argv[1]} en ${path.relative(ROOT, keyFile(argv[1]))} (no la subas a git)`); } catch (e) { console.error('✗', e.code === 'EEXIST' ? 'ya existe una clave para ese agente' : e.message); process.exit(1); } }
  else if (cmd === 'stats') {
    const s = stats(); console.log(`${s.coded}/${s.total} codificadas (${s.total ? (100 * s.coded / s.total).toFixed(1) : 0} %)`);
    for (const [c, n] of Object.entries(s.byCode).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${c}`);
    for (const u of s.uncoded) console.log(`  sin código: ${u.action} ${u.verdict ?? '-'} ×${u.n}`);
  } else if (cmd === 'budget') { const { spawnSync } = await import('node:child_process'); process.exit(spawnSync(process.execPath, [path.join(ROOT, 'engine/budget.mjs')], { stdio: 'inherit' }).status ?? 1); }   // budget.mjs importa este módulo: se lanza aparte (evita el ciclo con el await)
  else {
    const L = readLedger({ action: arg('--action'), target: arg('--target'), agent: arg('--agent') });
    for (const e of L.slice(-(+arg('--tail', 20)))) console.log(`${e.ts}  ${String(e.agent).padEnd(10)} ${String(e.role).padEnd(9)} ${String(e.action).padEnd(14)} ${String(e.target ?? '-').padEnd(24)} ${e.verdict ?? ''}${e.why ? '  · ' + e.why : ''}`);
  }
}
