#!/usr/bin/env node
// Harness al límite (docs/ROADMAP.md §2): fronteras de entrada, fuzz, runtime fail-closed, rutas, reproducibilidad.
// Cada sección es adversarial: la entrada mala debe dar FIX con ruta JSON, NUNCA colgarse ni escribir fuera de out/.
// Corre en copias temporales (copyRepo): no toca el repo.   node test/harness.mjs [--only edl|fuzz|runtime|paths|repro]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, copyRepo, rmrf, run } from './lib.mjs';

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
let n = 0, bad = 0;
export const ok = (c, m) => { n++; if (!c) { bad++; console.log('  ✗ harness:', m); } };
const sec = (name) => !only || only === name;
const timed = async (args, o) => { const t = Date.now(), r = await run(args, o); return { ...r, ms: Date.now() - t, killed: r.status === null }; };

// ── 1. EDL ───────────────────────────────────────────────────────────────────────────────────────
if (sec('edl')) {
  const d = copyRepo();
  try {
    const EDL = (items, extra = {}) => JSON.stringify({ items, ...extra });
    const cases = [
      ['speed=0', EDL([{ src: 'A3', speed: 0 }]), /items\/0\/speed/],
      ['speed negativo', EDL([{ src: 'A3', speed: -1 }]), /items\/0\/speed/],
      ['speed Infinity (1e999)', '{"items":[{"src":"A3","speed":1e999}]}', /items\/0\/speed/],
      ['speed string', EDL([{ src: 'A3', speed: '2' }]), /items\/0\/speed/],
      ['src1 <= src0', EDL([{ src: [3, 3] }]), /items\/0\/src/],
      ['src invertido', EDL([{ src: [4, 2] }]), /items\/0\/src/],
      ['src negativo', EDL([{ src: [-1, 2] }]), /items\/0\/src/],
      ['src no finito', '{"items":[{"src":[0,1e999]}]}', /items\/0\/src/],
      ['items vacío', EDL([]), /\/items/],
      ['sin items', '{}', /items/],
      ['hold negativo', EDL([{ src: 'A3', hold: -0.5 }]), /items\/0\/hold/],
      ['hold NaN-like', '{"items":[{"src":"A3","hold":1e999}]}', /items\/0\/hold/],
      ['id inexistente', EDL([{ src: 'ZZZ' }]), /items\/0\/src.*ZZZ/],
      ['campo desconocido', EDL([{ src: 'A3', velocidad: 2 }]), /items\/0\/velocidad/],
      ['raíz array', '[]', /\//],
    ];
    for (const [name, body, re] of cases) {
      fs.writeFileSync(path.join(d, 'data/edit_bad.json'), body);
      const r = await timed(['engine/cut.mjs', '--edit', 'data/edit_bad.json'], { cwd: d, timeout: 40000 });
      ok(!r.killed, `EDL ${name}: cut se colgó (${r.ms} ms)`);
      ok(r.status !== 0 && re.test(r.stderr + r.stdout), `EDL ${name}: debe fallar con ruta JSON ${re} («${(r.stderr + r.stdout).trim().split('\n').slice(0, 3).join(' | ').slice(0, 200)}»)`);
      ok(r.ms < 20000, `EDL ${name}: debe fallar de inmediato (${r.ms} ms)`);
    }
    // la EDL de ejemplo sigue siendo válida
    const m = await import(path.join(ROOT, 'engine/inputs.mjs').replace(/^/, 'file://')).catch(() => null);
    ok(m && m.validateEdit(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/edit.example.json'), 'utf8'))).filter((e) => e.level === 'FIX').length === 0, 'data/edit.example.json valida');
    // defensa en el bucle de atempo de cut: la cadena de filtros está acotada aunque llegue speed degenerado
    const m2 = await import('file://' + path.join(ROOT, 'engine/inputs.mjs')).catch(() => null);
    const chain = m2?.atempoChain;
    ok(typeof chain === 'function', 'atempoChain exportada');
    if (chain) for (const s of [0, -3, NaN, Infinity, 1e-300, 1e300]) { let r; const t = Date.now(); try { r = chain(s); } catch { r = 'throw'; } ok(Date.now() - t < 1000 && (r === 'throw' || (r.match(/atempo/g) ?? []).length <= 64), `atempoChain(${s}) acotada`); }
    if (chain) ok(chain(1) === '' && chain(0.25) === ',atempo=0.5,atempo=0.5' && chain(4) === ',atempo=2,atempo=2', 'atempoChain conserva el comportamiento válido');
  } finally { rmrf(d); }
}

// ── 3. runtime: sandbox FAIL-CLOSED sin module.registerHooks ─────────────────────────────────────
if (sec('runtime')) {
  const d = copyRepo(), stub = path.join(d, 'sin-registerhooks.mjs');
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    ok(pkg.engines?.node === '>=22.15', 'package.json engines.node >=22.15');
    fs.writeFileSync(stub, "import m from 'node:module'; m.registerHooks = undefined;\n");     // simula Node < 22.15
    for (const [name, args] of [['lint', ['engine/lint.mjs', '--shot', 'A1']], ['render', ['engine/render.mjs', '--stills', '--every', '4', '--size', '320x180']], ['cut', ['engine/cut.mjs']]]) {
      const r = await timed(['--import', stub, ...args], { cwd: d, timeout: 90000 });
      ok(!r.killed && r.status !== 0 && /registerHooks/.test(r.stderr + r.stdout) && /unsafe-legacy-node/.test(r.stderr + r.stdout), `${name} sin registerHooks debe fallar cerrado con mensaje claro (status ${r.status}): ${(r.stderr + r.stdout).slice(-200)}`);
    }
    const led = path.join(d, 'out/ledger.jsonl'), unsafeLines = () => (fs.existsSync(led) ? fs.readFileSync(led, 'utf8') : '').split('\n').filter((l) => /unsafe-legacy-node/.test(l));
    ok(unsafeLines().length === 0, 'fail-closed no escribe en el ledger');
    for (const [how, args, env] of [['flag', ['engine/lint.mjs', '--shot', 'A1', '--unsafe-legacy-node'], {}], ['env', ['engine/lint.mjs', '--shot', 'A1'], { OPUS_UNSAFE_LEGACY_NODE: '1' }]]) {
      const before = unsafeLines().length, r = await run(['--import', stub, ...args], { cwd: d, env, timeout: 120000 });
      ok(!/no tiene module\.registerHooks/.test(r.stderr + r.stdout) && unsafeLines().length === before + 1, `escape ${how}: pasa y queda en el ledger (status ${r.status}): ${(r.stderr + r.stdout).slice(-200)}`);
    }
  } finally { rmrf(d); }
}

// ── 4. rutas con espacios/acentos y symlinks ─────────────────────────────────────────────────────
if (sec('paths')) {
  const d = copyRepo(), base = fs.mkdtempSync(path.join(os.tmpdir(), 'opus ruta ñandú ')), dir = path.join(base, 'Películas y más', 'repo');
  try {
    fs.mkdirSync(path.dirname(dir), { recursive: true }); fs.renameSync(d, dir);
    const r = await run(['engine/schema.mjs', 'data/timeline.json'], { cwd: dir, timeout: 60000 });
    ok(r.status === 0 && /^OK\s+data\/timeline\.json/m.test(r.stdout), `schema.mjs (isMain) con espacios/acentos: ${r.stdout.slice(-120)}${r.stderr.slice(-200)}`);
    const l = await run(['engine/lint.mjs', '--only', 'validate'], { cwd: dir, timeout: 120000 });
    ok(l.status === 0 && !/%20|ENOENT/.test(l.stdout + l.stderr), `lint --only validate con espacios/acentos (${l.status}): ${(l.stderr + l.stdout).slice(-200)}`);
    ok(fs.existsSync(path.join(dir, 'out')) && !fs.existsSync(path.join(dir, '..', 'out')), 'escribe en out/ del repo, no fuera');
    // symlink al script: isMain compara rutas reales
    const link = path.join(base, 'enlace schema.mjs'); fs.symlinkSync(path.join(dir, 'engine/schema.mjs'), link);
    const s2 = await run([link, 'data/timeline.json'], { cwd: dir, timeout: 60000 });
    ok(s2.status === 0 && /^OK/m.test(s2.stdout), `isMain vía symlink: ${s2.stdout.slice(-100)}${s2.stderr.slice(-150)}`);
    const p = await import('file://' + path.join(ROOT, 'engine/paths.mjs'));
    ok(p.isMain('file://' + link.replace(/ /g, '%20'), link) && !p.isMain('file://' + link.replace(/ /g, '%20'), '/otra/cosa'), 'isMain robusto a espacios codificados');
  } finally { rmrf(base); rmrf(d); }
}

// ── 5. CI: el workflow cumple lo prometido (sin act disponible: validación estática del contrato) ──
if (sec('ci')) {
  const y = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8'), pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  ok(/ubuntu-24\.04/.test(y) && /macos-/.test(y), 'matriz ubuntu + macos');
  ok(y.indexOf('npm ci') > 0 && y.indexOf('npm ci') < y.indexOf('npm test'), 'npm ci antes de npm test');
  ok(!/\bcurl\b|wget/.test(y.split('npm ci')[1] ?? ''), 'nada de red tras npm ci (salvo audit informativo)');
  ok(/node-version:\s*22\.(1[5-9]|[2-9]\d)/.test(y) || /node-version:\s*2[3-9]/.test(y), 'node >= engines (22.15)');
  ok(/xvfb/.test(y) && /mesa/i.test(y), 'Linux instala Mesa+xvfb para world3d');
  ok(!/^\s*continue-on-error:/m.test(y.split('steps:')[0]), 'ningún job de la matriz es opcional (macOS bloquea igual que Linux)');
  ok(!/\t/.test(y), 'YAML sin tabuladores');
  ok(pkg.engines?.node === '>=22.15', 'engines coherente');
}

// ── 6. reproducibilidad: dos copias limpias (solo archivos versionados, rutas distintas) → mismos píxeles bit a bit ──
if (sec('repro')) {
  const { execFileSync } = await import('node:child_process'), crypto = await import('node:crypto');
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT }).toString().split('\0').filter((f) => f && fs.existsSync(path.join(ROOT, f)) && !f.startsWith('.claude/'));
  const clean = (tag) => {            // «clon limpio»: working tree versionado, sin out/, sin caches, sin untracked; ruta distinta por copia
    const d = fs.mkdtempSync(path.join(os.tmpdir(), `opus-repro-${tag}-`));
    for (const f of tracked) { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), path.join(d, f)); }
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(d, 'node_modules')); return d;
  };
  const A = clean('a'), B = clean('b');
  try {
    const env = { FONTCONFIG_FILE: path.join(ROOT, 'test/golden/fonts.conf'), OPUS_LAYERS: 'none', OPUS_TIMELINE: 'data/timeline.json' };
    const [ra, rb] = await Promise.all([A, B].map((d) => run([path.join(d, 'test/golden.mjs'), '--worker', d], { cwd: d, env: { ...env, FONTCONFIG_FILE: path.join(d, 'test/golden/fonts.conf') }, timeout: 600000 })));
    ok(ra.status === 0 && rb.status === 0, `render en clones limpios: ${ra.stderr.slice(-200)}${rb.stderr.slice(-200)}`);
    if (ra.status === 0 && rb.status === 0) {
      const fa = JSON.parse(ra.stdout).frames, fb = JSON.parse(rb.stdout).frames;
      ok(fa.length > 0 && fa.length === fb.length, `mismo nº de fotogramas (${fa.length}/${fb.length})`);
      const diff = fa.filter((f, i) => f.sha !== fb[i]?.sha || f.t !== fb[i]?.t).map((f) => `${f.shot}_${f.at}`);
      ok(diff.length === 0, `fotogramas distintos entre clones: ${diff.join(' ')}`);
      ok(crypto.createHash('sha256').update(JSON.stringify(fa.map((f) => f.sha))).digest('hex') === crypto.createHash('sha256').update(JSON.stringify(fb.map((f) => f.sha))).digest('hex'), 'hash agregado idéntico');
    }
  } finally { rmrf(A); rmrf(B); }
}

console.log(`${bad ? '✗' : '✓'} harness${only ? ':' + only : ''}  ${n - bad}/${n}`);
process.exit(bad ? 1 : 0);
