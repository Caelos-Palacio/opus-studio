#!/usr/bin/env node
// Fuzz determinista (seed) de TODA entrada que un agente puede escribir. Contrato de cada cargador/validador:
//   · nunca se cuelga (cada llamada acotada (<15 s bajo carga; detecta cuelgues, no rendimiento); el CLI, con timeout), nunca lanza una excepción cruda (devuelve errores),
//   · cada error lleva ruta JSON ("/a/b" o "/"), jamás undefined/NaN,
//   · inyectar NaN/Infinity/negativos en campos numéricos tipados da FIX,
//   · nunca contamina prototipos y nunca escribe fuera de out/ (CLI en copia temporal con centinela).
//   node test/fuzz.mjs [--seed N] [--n 150] [--no-cli]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, copyRepo, rmrf, run } from './lib.mjs';
import * as I from '../engine/inputs.mjs';
import { validateTimeline, validateLayer } from '../engine/schema.mjs';
import { validateMemoria } from '../engine/memoria.mjs';
import { validateStory } from '../engine/arc.mjs';
import { schemaErrors } from '../engine/orch.mjs';
import { checkResponse } from '../engine/critic.mjs';

const argv = process.argv.slice(2), arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const SEED = +arg('--seed', 20260101), N = +arg('--n', 150), CLI = !argv.includes('--no-cli');
const mulberry = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rnd = mulberry(SEED), pick = (a) => a[Math.floor(rnd() * a.length)], int = (n) => Math.floor(rnd() * n);
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; if (bad <= 40) console.log('  ✗ fuzz:', m); } };

// valores hostiles
const BIG = 'x'.repeat(200000);
const POOL = [() => Infinity, () => -Infinity, () => NaN, () => -1, () => 0, () => -0, () => 1e308, () => 2 ** 53, () => -1e-300, () => '', () => ' ', () => BIG, () => '../../etc/passwd', () => '..\\..\\x', () => '/abs/ruta', () => 'a\0b',
  () => null, () => [], () => ({}), () => [[]], () => [null], () => true, () => '__proto__', () => JSON.parse('{"__proto__":{"polluted":1}}'), () => JSON.parse('{"constructor":{"prototype":{"polluted":2}}}'),
  () => Array.from({ length: 5000 }, () => 1), () => { let o = []; for (let i = 0; i < 300; i++) o = [o]; return o; }, () => '${7*7}', () => '<script>', () => 'A1', () => 1e999];
const clone = (x) => JSON.parse(JSON.stringify(x));
const leaves = (v, p = [], out = []) => { if (v && typeof v === 'object') { out.push({ p, v, container: true }); for (const k of Object.keys(v)) leaves(v[k], [...p, k], out); } else out.push({ p, v }); return out; };
const getAt = (d, p) => p.reduce((o, k) => o?.[k], d);
function mutate(doc) {
  const d = clone(doc), L = leaves(d), kind = int(6), t = pick(L);
  if (!t.p.length) return kind < 3 ? pick(POOL)() : d;
  const parent = getAt(d, t.p.slice(0, -1)), k = t.p[t.p.length - 1];
  if (kind === 0 && Array.isArray(parent)) parent.splice(+k, 1);
  else if (kind === 1 && !Array.isArray(parent)) delete parent[k];
  else if (kind === 2 && Array.isArray(parent)) parent.push(clone(parent[+k]));
  else if (kind === 3 && t.container) { if (Array.isArray(t.v)) t.v.length = 0; else for (const x of Object.keys(t.v)) delete t.v[x]; }
  else if (kind === 4) parent[k] = (typeof t.v === 'number' ? pick([() => NaN, () => Infinity, () => -1, () => 0, () => -0, () => 1e308]) : pick(POOL))();
  else parent[k] = pick(POOL)();
  return d;
}

const R = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const asPaths = (r) => (Array.isArray(r) ? r : [r]).flat().map((e) => (typeof e === 'string' ? e : e.path ?? e.problem ?? e.message));
const pathy = (s) => typeof s === 'string' && /^\/|^[\w.\[\]-]+[:\[]|\//.test(s) && !/undefined|NaN/.test(s.slice(0, 60));
const scene = (await import('../shots/W_datacenter.mjs')).datacenterScene(), sceneSmall = { ...clone({ ...scene, objects: [] }), objects: [{ shape: 'box', size: [1, 1, 1], pos: [0, 0, 0], color: 'ink' }] };
const TARGETS = [
  { name: 'edit', doc: R('data/edit.example.json'), fn: (d) => I.validateEdit(d, [{ id: 'A1', t: [0, 3] }, { id: 'A3', t: [3, 6] }]) },
  { name: 'timeline', doc: R('data/timeline.json'), fn: (d) => validateTimeline(d).filter((e) => e.kind === 'schema') },
  { name: 'layer', doc: R('data/layers/memoria.json'), fn: validateLayer },
  { name: 'memoria', doc: R('data/memoria.json'), fn: validateMemoria },
  { name: 'story', doc: R('data/mate/story.json'), fn: validateStory },
  { name: 'notas', doc: R('data/notas.json'), fn: I.validateNotas },
  { name: 'audio', doc: R('data/audio.json'), fn: I.validateAudio },
  { name: 'medio', doc: R('styles/medios/papel_crema.json'), fn: I.validateMedio },
  { name: 'sound-style', doc: R('styles/sound/epico.json'), fn: I.validateSoundStyle },
  { name: 'facts', doc: R('data/facts.json'), fn: I.validateFacts },
  { name: 'world3d-scene', doc: sceneSmall, fn: I.validateScene },
  { name: 'orch-note', doc: { shot: 'A1', problem: 'algo falla', evidence: ['lint.json#/x'] }, fn: (d) => schemaErrors('note', d) },
  { name: 'orch-delivery', doc: { summary: 'hecho', changed: [], evidence: [{ cmd: 'node -v', exit: 0 }], risks: [], confidence: 0.5, next: 'nada' }, fn: (d) => schemaErrors('delivery', d) },
  { name: 'orch-change', doc: { files: { 'a.json': '{}' }, why: 'prueba' }, fn: (d) => schemaErrors('change', d) },
  { name: 'orch-patch', doc: [{ op: 'add', path: '/a', value: 1 }], fn: (d) => schemaErrors('patch', d) },
  { name: 'critic-response', doc: { scores: { a: 3 }, issues: [] }, fn: (d) => { const r = checkResponse(d); return r.ok ? [] : r.errors ?? ['/: inválido']; } },
];
// Campos numéricos tipados: Infinity/NaN ahí DEBE dar FIX (el resto del documento puede ser libre por diseño).
const STRICT_NUM = { edit: [['items', 0, 'speed'], ['items', 1, 'speed'], ['items', 0, 'hold']], notas: [['notas', 0, 'nota']], audio: [['bpm'], ['offset']] };

for (const T of TARGETS) {
  const base = T.fn(clone(T.doc)), baseFix = asPaths(base.filter?.((e) => (e.level ?? 'FIX') === 'FIX') ?? base).length;
  ok(T.name.startsWith('orch') || T.name === 'critic-response' || baseFix === 0, `${T.name}: el documento válido de partida no debe dar FIX (${JSON.stringify(asPaths(base).slice(0, 2))})`);
  for (let i = 0; i < N; i++) {
    const m = mutate(T.doc); let r, err = null; const t0 = performance.now();
    try { r = T.fn(m); } catch (e) { err = e; }
    const ms = performance.now() - t0;
    ok(!err, `${T.name} #${i}: lanzó ${err?.message?.slice(0, 100)}`);
    ok(ms < 15000, `${T.name} #${i}: lento (${ms | 0} ms)`);
    if (!err) for (const s of asPaths(r)) if (!pathy(s)) { ok(false, `${T.name} #${i}: error sin ruta JSON: ${String(s).slice(0, 100)}`); break; }
    if (err) break;
  }
  for (const p of STRICT_NUM[T.name] ?? []) {
    if (getAt(T.doc, p) === undefined) continue;
    for (const v of [Infinity, -Infinity, NaN, -1e308, '3', ...(T.name === 'notas' ? [] : [null])]) {
      const d = clone(T.doc); getAt(d, p.slice(0, -1))[p.at(-1)] = v;
      const r = T.fn(d), fx = asPaths(r.filter?.((e) => (e.level ?? 'FIX') === 'FIX') ?? r);
      ok(fx.some((s) => s.includes('/' + p.join('/'))) , `${T.name}: /${p.join('/')} = ${v} debe dar FIX con su ruta (${fx.slice(0, 2)})`);
    }
  }
}
// Contaminación de prototipo por cualquiera de las mutaciones anteriores
ok(({}).polluted === undefined && Object.prototype.polluted === undefined, 'prototipo contaminado');
// escena: typed arrays y profundidad hostil no revientan el validador
ok(I.validateScene({ objects: [{ shape: 'box', data: new Float32Array(10) }] }).length === 0, 'escena con Float32Array valida');
{ let deep = []; for (let i = 0; i < 100000; i++) deep = [deep]; let thrown = null; try { I.validateScene({ objects: [{ data: deep }] }); } catch (e) { thrown = e; } ok(!thrown, `escena con anidamiento 100000 no debe lanzar (${thrown?.message})`); }
// safeJoin: confina rutas
for (const p of ['../x', '../../etc/passwd', '/etc/passwd', 'a/../../b', '', '\0', 5, null]) { let t = false; try { I.safeJoin('/tmp/base', p); } catch { t = true; } ok(t, `safeJoin rechaza ${JSON.stringify(p)}`); }
ok(I.safeJoin('/tmp/base', 'a/b.json') === '/tmp/base/a/b.json', 'safeJoin acepta relativa legítima');

// ── CLI: procesos reales con timeout, FIX con ruta y nada escrito fuera de out/ ───────────────────
if (CLI) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'opus-fuzz-')), d = path.join(base, 'repo');
  const src = copyRepo(); fs.renameSync(src, d);
  fs.writeFileSync(path.join(base, 'centinela.txt'), 'intacto');
  const sig = () => { const h = crypto.createHash('sha256'); const walk = (p) => { for (const e of fs.readdirSync(p, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) { const f = path.join(p, e.name); if (f === path.join(d, 'out') || f === path.join(d, 'node_modules')) continue; h.update(f.slice(base.length)); if (e.isDirectory()) walk(f); else if (e.isFile()) h.update(fs.readFileSync(f)); } }; walk(base); return h.digest('hex'); };
  try {
    // schema.mjs sobre timelines mutados (CLI real)
    const tl = R('data/timeline.json'); let before = sig();
    for (let i = 0; i < 12; i++) {
      const m = mutate(tl), f = path.join(d, 'data/fz.json'); fs.writeFileSync(f, JSON.stringify(m)); before = sig();
      const r = await run(['engine/schema.mjs', 'data/fz.json'], { cwd: d, timeout: 30000 });
      ok(r.status === 0 || r.status === 1, `CLI schema #${i}: terminó mal (status ${r.status}) ${r.stderr.slice(-150)}`);
      ok(r.status === 0 || /^(FIX|OK|WARN)/m.test(r.stdout) && /\//.test(r.stdout), `CLI schema #${i}: FIX sin ruta JSON: ${r.stdout.slice(-150)}`);
      ok(sig() === before, `CLI schema #${i}: escribió fuera de out/`);
    }
    // EDL inválidas por cut: fallo inmediato
    let k = 0;
    for (let i = 0; i < 400 && k < 14; i++) {
      const m = mutate(R('data/edit.example.json')), f = path.join(d, 'data/fz_edit.json'); fs.writeFileSync(f, JSON.stringify(m) ?? 'null');
      if (!I.validateEdit(m, [{ id: 'A1', t: [0, 3] }, { id: 'A3', t: [3, 6] }]).some((e) => e.level === 'FIX')) continue; k++;
      before = sig(); const t0 = Date.now(), r = await run(['engine/cut.mjs', '--edit', 'data/fz_edit.json'], { cwd: d, timeout: 40000 });
      ok(r.status !== null && r.status !== 0 && Date.now() - t0 < 30000, `CLI cut EDL #${i}: colgado o aceptó basura (status ${r.status}, ${Date.now() - t0} ms)`);
      ok(/\//.test(r.stderr + r.stdout), `CLI cut EDL #${i}: sin ruta JSON: ${(r.stderr + r.stdout).slice(-120)}`);
      ok(sig() === before, `CLI cut EDL #${i}: escribió fuera de out/`);
    }
    // orch accept con rutas que escapan: rechazado y sin escribir fuera
    for (const p of ['../fuera.txt', '../../fuera.txt', '/tmp/fuera-opus.txt', 'a/../../fuera.txt', 'out/../../fuera.txt']) {
      fs.writeFileSync(path.join(d, 'data/fz_change.json'), JSON.stringify({ files: { [p]: 'x' }, why: 'fuzz de rutas' })); before = sig();
      const r = await run(['engine/orch.mjs', 'accept', 'data/fz_change.json'], { cwd: d, timeout: 60000, env: { OPUS_ROLE: 'director', OPUS_AGENT: 'fuzz' } });
      ok(r.status !== null && r.status !== 0, `CLI orch accept ${p}: debe rechazarse (status ${r.status})`);
      ok(!fs.existsSync(path.join(base, 'fuera.txt')) && !fs.existsSync(path.join(path.dirname(base), 'fuera.txt')) && !fs.existsSync('/tmp/fuera-opus.txt') && sig().length === before.length && sig() === before, `CLI orch accept ${p}: escribió fuera del proyecto`);
    }
  } finally { rmrf(base); }
}
console.log(`${bad ? '✗' : '✓'} fuzz (seed ${SEED}, n=${N})  ${n - bad}/${n}`);
process.exit(bad ? 1 : 0);
