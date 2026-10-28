#!/usr/bin/env node
// Gobernanza (F1): ledger, locks, veredictos por shot y por hash, gates, master bloqueado, roles/hook, snapshots, .trash.
// Cada bloque falla si se quita su pieza. Corre en copias temporales (nunca toca tus archivos).   node test/gov.mjs [--only nombre]
import fs from 'node:fs';
import { rootFrom } from '../engine/paths.mjs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = rootFrom(import.meta.url);
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const NODE = process.execPath;
const COPY = ['engine', 'data', 'shots', 'styles', 'assets', 'storyboard', 'gates.json', 'roles.json', 'package.json', '.gitignore', '.claude/hooks'];
const copy = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'opus-gov-'));
  for (const e of COPY) if (fs.existsSync(path.join(ROOT, e))) fs.cpSync(path.join(ROOT, e), path.join(d, e), { recursive: true });
  fs.rmSync(path.join(d, 'data/autocam'), { recursive: true, force: true });
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(d, 'node_modules'));
  return d;
};
const run = (d, args, env = {}, input) => spawnSync(NODE, args, { cwd: d, encoding: 'utf8', env: { ...process.env, ...env }, input, timeout: 600000 });
const runP = (d, args, env = {}) => new Promise((res) => { const p = spawn(NODE, args, { cwd: d, env: { ...process.env, ...env } }); let out = ''; p.stdout.on('data', (b) => (out += b)); p.stderr.on('data', (b) => (out += b)); p.on('close', (status) => res({ status, out })); });
const J = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const ledger = (d) => fs.readFileSync(path.join(d, 'out/ledger.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const imp = (d, m) => import(path.join(d, 'engine', m) + `?${Math.random()}`);
for (const k of ['OPUS_TIMELINE', 'OPUS_STYLE', 'OPUS_PROFILE', 'OPUS_EDIT', 'OPUS_AGENT', 'OPUS_ROLE', 'OPUS_ROLES_MODE']) delete process.env[k];

let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('  ✗ gov:', m); } };
const T = [];
const test = (name, fn) => T.push({ name, fn });

test('ledger', async () => {
  const d = copy();
  try {
    const L = await imp(d, 'ledger.mjs');
    const e = L.record({ action: 'x', target: 't', hash_before: 'CONTENIDO SECRETO no es un hash', why: 'y'.repeat(300) });
    const line = fs.readFileSync(path.join(d, 'out/ledger.jsonl'), 'utf8');
    ok(!line.includes('SECRETO') && /^[0-9a-f]{16}$/.test(e.hash_before), 'ledger: solo digests, nunca contenido crudo');
    ok(e.why.length === 140 && ['id', 'ts', 'agent', 'role', 'action', 'target', 'hash_before', 'hash_after', 'verdict', 'why'].every((k) => k in e), 'ledger: esquema completo y why ≤ 140');
    const e2 = await runP(d, ['-e', "import('./engine/ledger.mjs').then(m=>m.record({action:'y'}))"], { OPUS_AGENT: 'ana', OPUS_ROLE: 'td' });
    ok(e2.status === 0 && ledger(d).some((x) => x.agent === 'ana' && x.role === 'td'), 'ledger: agente y rol por env');
    const e3 = await runP(d, ['-e', "import('./engine/ledger.mjs').then(m=>{m.record({action:'z'});m.record({action:'z2'})})"], { OPUS_AGENT: '' }), e4 = await runP(d, ['-e', "import('./engine/ledger.mjs').then(m=>m.record({action:'w'}))"], { OPUS_AGENT: 'ana' });
    ok(e3.status === 0 && (e3.out.match(/⚠ ledger/g) ?? []).length === 1 && /anon/.test(e3.out) && !/⚠ ledger/.test(e4.out), 'ledger: sin OPUS_AGENT avisa UNA vez por proceso de que firma como "anon"; con él, silencio');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

// Dos procesos (agentes) concurrentes: RMW de un contador y del manifiesto TeX bajo lock + ledger. Sin lock se pierden escrituras.
test('concurrencia', async () => {
  const d = copy();
  try {
    fs.writeFileSync(path.join(d, 'w.mjs'), `
      import fs from 'node:fs';
      import { withLockSync, writeAtomic } from './engine/lock.mjs';
      import { record } from './engine/ledger.mjs';
      import { texReady, makeTexStore } from './engine/tex.mjs';
      const me = process.env.OPUS_AGENT, f = 'out/counter.json';
      await texReady(); const store = makeTexStore(process.cwd());
      fs.writeFileSync('out/ready-' + me, ''); while (fs.readdirSync('out').filter((f) => f.startsWith('ready-')).length < 2) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2);   // arranque simultáneo
      for (let i = 0; i < 120; i++) {
        withLockSync('counter', () => { let c = 0; try { c = JSON.parse(fs.readFileSync(f, 'utf8')).n; } catch {} for (let k = 0; k < 2e4; k++); writeAtomic(f, JSON.stringify({ n: c + 1 })); });
        record({ action: 'test.write', target: me + '/' + i, why: 'x'.repeat(100) });
        if (i % 8 === 0) store.get('x_{' + me + '}^{' + i + '}');
      }`);
    fs.mkdirSync(path.join(d, 'out'), { recursive: true });
    const [a, b] = await Promise.all([runP(d, ['w.mjs'], { OPUS_AGENT: 'A' }), runP(d, ['w.mjs'], { OPUS_AGENT: 'B' })]);
    ok(a.status === 0 && b.status === 0, 'concurrencia: ambos agentes terminan ' + (a.out + b.out).slice(0, 300));
    ok(J(path.join(d, 'out/counter.json')).n === 240, `concurrencia: sin escrituras perdidas bajo lock (${J(path.join(d, 'out/counter.json')).n}/240)`);
    const L = ledger(d).filter((e) => e.action === 'test.write');
    ok(L.length === 240 && L.filter((e) => e.agent === 'A').length === 120, 'concurrencia: ledger íntegro (240 líneas JSON válidas)');
    { const v = (await imp(d, 'ledger.mjs')).verify(); ok(v.ok, 'concurrencia: la cadena del ledger verifica tras escrituras concurrentes ' + JSON.stringify(v.problems.slice(0, 2))); }
    const I = J(path.join(d, 'assets/cache/tex/index.json')), mine = Object.values(I).filter((v) => /x_\{[AB]\}/.test(v.tex));
    ok(mine.length === 30, `concurrencia: manifiesto TeX sin entradas perdidas (${mine.length}/30)`);
    ok(!(fs.existsSync(path.join(d, 'out/locks')) ? fs.readdirSync(path.join(d, 'out/locks')) : []).some((f) => f.endsWith('.json')), 'concurrencia: no quedan locks');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('lease', async () => {
  const d = copy();
  try {
    const K = await imp(d, 'lock.mjs');
    const a = K.claim('shot/A2', 'A', 4000);
    ok(!!a, 'lease: claim concedido');   // en el mismo proceso el lock es reentrante: la exclusión se prueba desde otro proceso
    const c1 = await runP(d, ['-e', "import('./engine/lock.mjs').then(m=>process.exit(m.claim('shot/A2','B',150)?0:1))"]);
    ok(c1.status === 1, 'lease: otro proceso no puede reclamar un lease vivo');
    await new Promise((r) => setTimeout(r, 4400));
    const c2 = await runP(d, ['-e', "import('./engine/lock.mjs').then(m=>{const L=m.claim('shot/A2','B',5000);process.exit(L?0:1)})"]);
    ok(c2.status === 0 && ledger(d).some((e) => e.action === 'lock.steal'), 'lease: caducado = liberable (y queda en el ledger)');
    ok(!K.release(a), 'lease: el dueño viejo ya no puede liberar el lock robado');
    const c3 = await runP(d, ['-e', "import('./engine/lock.mjs').then(m=>{m.claim('muerto','Z',600000)})"]);
    ok(c3.status === 0 && K.claim('muerto', 'Y', 1000) !== null, 'lease: lock de un proceso muerto es liberable');
    const c4 = run(d, ['engine/lock.mjs', 'claim', 'shots/A2.mjs', '--ttl', '600000'], { OPUS_AGENT: 'ana' });
    ok(c4.status === 0 && K.holder('shots/A2.mjs')?.agent === 'ana', 'lease: claim de agente (CLI) sobrevive al proceso');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('veredictos', async () => {
  const d = copy();
  try {
    let r = run(d, ['engine/lint.mjs', '--only', 'validate']);
    ok(!fs.existsSync(path.join(d, 'out/lint.json')) && J(path.join(d, 'out/lint/main/_only-validate.json')).partial === true, '--only no escribe el veredicto global');
    const V = await imp(d, 'verdict.mjs'), cur = V.currentHashes();
    const fake = JSON.stringify({ verdict: 'SHIP', partial: false, ...V.stamp(cur), issues: [] });
    fs.writeFileSync(path.join(d, 'out/lint.json'), fake);
    run(d, ['engine/lint.mjs', '--only', 'camera']);
    ok(fs.readFileSync(path.join(d, 'out/lint.json'), 'utf8') === fake, '--only deja intacto out/lint.json');
    r = run(d, ['engine/lint.mjs', '--shot', 'A1']);
    ok(r.status === 0 && fs.existsSync(path.join(d, 'out/lint/main/A1.json')) && fs.existsSync(path.join(d, 'out/lint/main/A2.json')) && !fs.existsSync(path.join(d, 'out/lint/main/A3.json')), 'lint --shot A1 → A1 + vecino A2, no A3 ' + r.stdout.slice(-200));
    ok(fs.readFileSync(path.join(d, 'out/lint.json'), 'utf8') === fake, 'lint --shot no escribe el veredicto global');
    const A1 = J(path.join(d, 'out/lint/main/A1.json')), A2 = J(path.join(d, 'out/lint/main/A2.json'));
    ok(A1.engineHash && A1.filmHash && A1.shotHash && V.isFresh(A1) && V.isFresh(A2), 'veredicto por shot lleva {engineHash, filmHash, shotHash} y está vigente');
    fs.appendFileSync(path.join(d, 'shots/A3.mjs'), '\n// edición\n');
    ok(!V.isFresh(J(path.join(d, 'out/lint.json'))) && V.isFresh(A1) && !V.isFresh(A2), 'isFresh: editar A3 caduca el global y el de su vecino A2, no el de A1');
    fs.writeFileSync(path.join(d, 'out/lint.json'), JSON.stringify({ verdict: 'SHIP', issues: [] }));
    ok(!V.isFresh(J(path.join(d, 'out/lint.json'))), 'isFresh: veredicto sin hash no existe');
    fs.writeFileSync(path.join(d, 'shots/A2.mjs'), 'export default { draw( };');     // el film no carga
    fs.writeFileSync(path.join(d, 'out/lint.json'), fake);
    r = run(d, ['engine/lint.mjs']);
    ok(r.status === 1 && J(path.join(d, 'out/lint.json')).verdict === 'FIX', 'render fallido: el veredicto viejo se sustituye por FIX (no queda un SHIP antiguo)');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('master', async () => {
  const d = copy();
  try {
    const cut = (...a) => run(d, ['engine/cut.mjs', '--max-chunks', '0', ...a]);
    let r = cut();
    ok(r.status === 1 && /bloqueado/.test(r.stderr), 'master sin lint.json falla');
    const V = await imp(d, 'verdict.mjs'), w = (v, extra = {}) => fs.writeFileSync(path.join(d, 'out/lint.json'), JSON.stringify({ verdict: v, partial: false, ...V.stamp(V.currentHashes()), issues: [], ...extra }));
    w('FIX'); r = cut(); ok(r.status === 1 && /lint en FIX/.test(r.stderr), 'master con lint FIX falla');
    w('SHIP'); r = cut(); ok(r.status === 1 && /crítico: sin veredicto/.test(r.stderr), 'master con lint SHIP pero SIN veredicto del crítico vigente falla (deuda F3) ' + r.stderr.slice(0, 200));
    const cs = () => fs.writeFileSync(path.join(d, 'out/critic.json'), JSON.stringify({ verdict: 'SHIP', ...V.stamp(V.currentHashes()) }));
    cs(); r = cut(); ok(r.status === 0 && /pendientes/.test(r.stdout), 'master con SHIP vigente del lint y del crítico pasa el gate ' + r.stderr.slice(0, 200));
    fs.rmSync(path.join(d, 'out/critic.json'));
    w('SHIP', { partial: true }); r = cut(); ok(r.status === 1, 'master con veredicto parcial falla');
    w('SHIP'); fs.appendFileSync(path.join(d, 'shots/A1.mjs'), '\n// cambio\n'); r = cut(); ok(r.status === 1 && /caducado/.test(r.stderr), 'master con veredicto caducado falla');
    w('SHIP'); fs.writeFileSync(path.join(d, 'out/critic.json'), JSON.stringify({ verdict: 'FIX', ...V.stamp(V.currentHashes()) })); r = cut(); ok(r.status === 1 && /crítico/.test(r.stderr), 'master con crítico FIX (vigente) falla');
    fs.rmSync(path.join(d, 'out/critic.json'));
    const hs = spawnSync(NODE, ['--input-type=module', '-e', "const {loadFilm}=await import('./engine/film.mjs');const {plan}=await import('./engine/cut.mjs');const f=await loadFilm();const P=plan(f,{fps:f.fps,size:f.width+'x'+f.height});console.log(P.jobs.filter(j=>j.shots.includes('A2')).map(j=>j.hash).join('.'))"], { cwd: d, encoding: 'utf8' }).stdout.trim();
    fs.mkdirSync(path.join(d, 'out/review/main'), { recursive: true });
    fs.writeFileSync(path.join(d, 'out/review/main/critic.json'), JSON.stringify({ A2: { hash: hs, result: { issues: [{ severity: 'FIX', problem: 'x' }] } } }));
    r = cut(); ok(r.status === 1 && /A2/.test(r.stderr), 'master con FIX del crítico en caché (hash vigente) falla');
    r = cut('--force'); ok(r.status === 1 && /razón/.test(r.stderr), '--force sin razón no pasa');
    r = cut('--force', 'demo urgente'); ok(r.status === 0 && ledger(d).some((e) => e.action === 'master.force' && e.why === 'demo urgente'), '--force "razón" pasa y queda en el ledger');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('gates', async () => {
  const d = copy();
  try {
    for (const c of [0, 3]) { fs.mkdirSync(path.join(d, 'out'), { recursive: true }); fs.writeFileSync(path.join(d, `out/exit${c}.mjs`), `process.exit(${c})`); }   // sin shell ni -e: scripts dentro del repo
    fs.writeFileSync(path.join(d, 'gates.json'), JSON.stringify({ si: [{ criterion: 'siempre', argv: ['node', 'out/exit0.mjs'] }], no: [{ criterion: 'bien', argv: ['node', 'out/exit0.mjs'] }, { criterion: 'nunca', argv: ['node', 'out/exit3.mjs'] }] }));
    for (const [k, v] of Object.entries({ GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' })) process.env[k] = v;
    const g = (a) => spawnSync('git', a, { cwd: d, encoding: 'utf8' });
    const hasGit = g(['init', '-q']).status === 0 && g(['add', '-A']).status === 0 && g(['commit', '-qm', 'init']).status === 0;
    let r = run(d, ['engine/gate.mjs', 'close', 'si']), S = J(path.join(d, 'out/gates.json'));
    ok(r.status === 0 && S.si.status === 'closed' && S.si.filmHash, 'gate se cierra con exit 0 y escribe out/gates.json');
    r = run(d, ['engine/gate.mjs', 'close', 'no']); S = J(path.join(d, 'out/gates.json'));
    ok(r.status === 1 && S.no.status === 'open' && S.no.criteria[1].exit === 3, 'gate con un criterio en exit≠0 queda abierto');
    run(d, ['engine/gate.mjs', 'close', 'no']); ok(J(path.join(d, 'out/gates.json')).no.fails === 2, 'gate cuenta fallos seguidos');
    r = run(d, ['engine/gate.mjs', 'close', 'no', '--force']); ok(r.status === 2, '--force sin razón se rechaza');
    r = run(d, ['engine/gate.mjs', 'close', 'no', '--force', 'aceptado por el Director']); S = J(path.join(d, 'out/gates.json'));
    ok(r.status === 0 && S.no.status === 'forced' && ledger(d).some((e) => e.action === 'gate.force' && e.why === 'aceptado por el Director'), '--force "razón" cierra y queda en el ledger');
    if (hasGit) {
      const tags = g(['tag', '-l', 'opus/gate/*']).stdout.split('\n').filter(Boolean);
      ok(tags.includes('opus/gate/si/1') && tags.includes('opus/gate/no/1'), 'snapshot: tag opus/gate/<gate>/<n> al cerrar');
      ok(g(['status', '--porcelain']).stdout.trim() === '' || !g(['diff', '--cached', '--name-only']).stdout.trim(), 'snapshot: no toca índice ni HEAD');
      const f = path.join(d, 'shots/A1.mjs'), before = fs.readFileSync(f, 'utf8');
      fs.writeFileSync(f, '// roto\n');
      r = run(d, ['engine/gate.mjs', 'restore', 'si']);
      ok(r.status === 0 && fs.readFileSync(f, 'utf8') === before, 'restore <gate> devuelve el árbol al snapshot ' + r.stderr);
      ok(g(['tag', '-l', 'opus/backup/*']).stdout.trim() !== '', 'restore guarda antes un backup del estado actual');
    } else ok(false, 'git no disponible para probar snapshots');
  } finally { for (const k of ['GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL']) delete process.env[k]; fs.rmSync(d, { recursive: true, force: true }); }
});

test('roles', async () => {
  const d = copy();
  try {
    const R = await imp(d, 'roles.mjs');
    ok(R.canWrite('animator:A2', 'shots/A2.mjs').allow && !R.canWrite('animator:A2', 'shots/A1.mjs').allow && !R.canWrite('animator:A2', 'data/timeline.json').allow, 'roles: animator:A2 solo escribe shots/A2.mjs');
    ok(R.canWrite('animator:A2', 'out/sheets/A2.png').allow && R.canWrite('director', 'data/timeline.json').allow && !R.canWrite('td', 'styles/noir.json').allow, 'roles: globs comunes y por rol');
    ok(!R.canWrite('fantasma', 'shots/A1.mjs').allow, 'roles: rol desconocido no escribe');
    const link = d + '-link'; fs.symlinkSync(d, link);                    // macOS: tmp por symlink (/var → /private/var); el motor ve la ruta real
    try { ok(R.rel(path.join(link, 'shots/A1.mjs')) === 'shots/A1.mjs' && R.rel(path.join(link, 'shots/NUEVO.mjs')) === 'shots/NUEVO.mjs' && R.rel(path.join(os.tmpdir(), 'fuera.txt')) === null, 'roles: ruta por symlink hacia el proyecto = ruta relativa (no "fuera del proyecto")'); } finally { fs.rmSync(link, { force: true }); }
    const hook = (env, input) => spawnSync(NODE, [path.join(d, '.claude/hooks/opus-roles.mjs')], { cwd: d, encoding: 'utf8', input, env: { ...process.env, ...env } });
    const ev = JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: path.join(d, 'shots/A1.mjs') } });
    let h = hook({ OPUS_ROLE: 'animator:A2', OPUS_AGENT: 'bob', OPUS_ROLES_MODE: 'observer' }, ev);
    ok(h.status === 0 && h.stdout === '' && ledger(d).some((e) => e.verdict === 'would_deny' && e.target === 'shots/A1.mjs'), 'hook observer: no bloquea, registra would_deny');
    h = hook({ OPUS_ROLE: 'animator:A2', OPUS_AGENT: 'bob', OPUS_ROLES_MODE: 'enforce' }, ev);
    ok(h.status === 0 && JSON.parse(h.stdout).hookSpecificOutput.permissionDecision === 'deny', 'hook enforce: deniega fuera de sus globs');
    run(d, ['engine/lock.mjs', 'claim', 'shots/A2.mjs'], { OPUS_AGENT: 'ana' });
    h = hook({ OPUS_ROLE: 'animator:A2', OPUS_AGENT: 'bob', OPUS_ROLES_MODE: 'enforce' }, JSON.stringify({ tool_name: 'Write', tool_input: { file_path: path.join(d, 'shots/A2.mjs') } }));
    ok(/reclamado por ana/.test(h.stdout), 'hook enforce: deniega un archivo reclamado por otro agente');
    h = hook({}, 'no es json'); ok(h.status === 0 && h.stdout === '', 'hook: nunca rompe la sesión');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('cut-concurrente', async () => {
  const d = copy();
  try {
    const args = ['engine/cut.mjs', '--review', '--fps', '4', '--size', '128x72', '--workers', '1'];
    const [a, b] = await Promise.all([runP(d, args, { OPUS_AGENT: 'A' }), runP(d, args, { OPUS_AGENT: 'B' })]);
    ok(a.status === 0 && b.status === 0, 'cut concurrente: ambos terminan ' + (a.out + b.out).slice(-400));
    const dir = path.join(d, 'out/fragments/main'), M = J(path.join(dir, 'manifest.json'));
    ok(M.fragments.length === 3 && M.fragments.every((f) => fs.existsSync(path.join(d, f.file))), 'cut concurrente: manifest válido y todos sus fragmentos existen');
    ok(!fs.readdirSync(dir).some((f) => /\.(tmp|part)\.mp4$|list\.\d+\.txt/.test(f)) && fs.existsSync(path.join(d, 'out/master.review.mp4')), 'cut concurrente: sin staging/.part huérfanos; master.review.mp4 presente');
    // TOCTOU: un fragmento renderizado con código que cambió después de planificar NO se registra
    const { loadFilm } = await import(path.join(d, 'engine/film.mjs')), C = await import(path.join(d, 'engine/cut.mjs'));
    const opts = { fps: 4, size: '128x72' }, film = await loadFilm(), j = C.plan(film, opts).jobs[0], stage = path.join(dir, 'x.stage-1-a.tmp.mp4'), fin = path.join(dir, 'x_final.mp4');
    fs.writeFileSync(stage, 'v'); fs.appendFileSync(path.join(d, 'shots', j.shots[0] + '.mjs'), '\n// otro agente\n');
    ok(!(await C.commitFragment(stage, fin, j, opts, await loadFilm())) && !fs.existsSync(fin) && !fs.existsSync(stage), 'TOCTOU: fragmento con hash viejo se descarta');
    const j2 = C.plan(await loadFilm(), opts).jobs[0]; fs.writeFileSync(stage, 'v');
    ok(await C.commitFragment(stage, fin, j2, opts, await loadFilm()) && fs.existsSync(fin), 'TOCTOU: fragmento con hash vigente se registra');
    fs.writeFileSync(path.join(dir, 'y.stage-999999-a.tmp.mp4.part.mp4'), 'x'); C.cleanPartials(dir);
    ok(!fs.existsSync(path.join(dir, 'y.stage-999999-a.tmp.mp4.part.mp4')), '.part.mp4 de un proceso muerto se limpia');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('trash', async () => {
  const d = copy();
  try {
    const clip = path.join(d, 'clip.mp4');
    if (spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=64x36:rate=4', '-t', '1', clip]).status) return ok(false, 'ffmpeg no disponible');
    run(d, ['engine/assets.mjs', '--footage', clip, '--id', 'toma', '--fps', '4', '--width', '64']);
    const r = run(d, ['engine/assets.mjs', '--footage', clip, '--id', 'toma', '--fps', '4', '--width', '64']);
    const tr = fs.existsSync(path.join(d, '.trash')) ? fs.readdirSync(path.join(d, '.trash')) : [];
    ok(r.status === 0 && tr.length === 1 && fs.readdirSync(path.join(d, '.trash', tr[0])).some((f) => f.endsWith('.jpg')), 'assets: re-extraer mueve lo anterior a .trash/ (no rmSync)');
    ok(fs.existsSync(path.join(d, 'assets/cache/footage/toma/meta.json')), 'assets: la extracción nueva queda en su sitio');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});


// ───────── spec 008: gobernanza al límite ─────────
const lines = (d) => fs.readFileSync(path.join(d, 'out/ledger.jsonl'), 'utf8').split('\n').filter(Boolean);
const putLines = (d, a) => fs.writeFileSync(path.join(d, 'out/ledger.jsonl'), a.join('\n') + '\n');
const kinds = (v) => v.problems.map((p) => p.kind);
async function chained(d, n = 6) {
  const L = await imp(d, 'ledger.mjs');
  for (let i = 0; i < n; i++) L.record({ action: 'lint', target: 'lint/main/' + i, verdict: i % 2 ? 'FIX' : 'SHIP', why: 'caso ' + i, agent: 'ana', role: 'td' });
  return L;
}
test('ledger-cadena', async () => {
  const d = copy();
  try {
    const L = await chained(d), E = ledger(d);
    ok(E[0].prev === null && E.every((e, i) => i === 0 || e.prev === E[i - 1].h) && E.every((e) => /^[0-9a-f]{32}$/.test(e.h)), 'E1 cadena: cada entrada lleva prev = h de la anterior');
    ok(L.verify().ok && /verify/.test(run(d, ['engine/ledger.mjs', 'verify']).stdout + 'verify'), 'E1 verify pasa');
    ok(run(d, ['engine/ledger.mjs', 'verify']).status === 0, 'E1 CLI verify exit 0');
    const orig = lines(d), vf = () => run(d, ['engine/ledger.mjs', 'verify']);
    const e2 = orig.slice(); e2[2] = e2[2].replace('"FIX"', '"SHIP"').replace('caso 2', 'caso 9'); putLines(d, e2);
    let v = L.verify(); ok(!v.ok && kinds(v).includes('edit') && v.problems[0].line === 3 && vf().status === 1, 'E2 editar una entrada se detecta en su línea');
    putLines(d, orig.filter((_, i) => i !== 3)); v = L.verify(); ok(!v.ok && kinds(v).includes('chain'), 'E3 borrar una entrada intermedia rompe la cadena');
    putLines(d, orig.slice(0, -1)); v = L.verify(); ok(!v.ok && kinds(v).includes('truncated'), 'E3 borrar la última se detecta (head)');
    const sw = orig.slice(); [sw[1], sw[2]] = [sw[2], sw[1]]; putLines(d, sw); v = L.verify(); ok(!v.ok && kinds(v).includes('chain'), 'E4 reordenar se detecta');
    const forged = JSON.parse(orig[1]); forged.why = 'forjada'; delete forged.h; delete forged.sig;
    forged.h = crypto.createHash('sha256').update(JSON.stringify(forged)).digest('hex').slice(0, 32);
    const ins = orig.slice(); ins.splice(2, 0, JSON.stringify(forged)); putLines(d, ins); v = L.verify(); ok(!v.ok && kinds(v).includes('chain'), 'E4 insertar una entrada forjada (con h coherente) se detecta');
    putLines(d, orig); ok(L.verify().ok, 'ledger restaurado vuelve a verificar');
    fs.appendFileSync(path.join(d, 'out/ledger.jsonl'), '{"action":"x" ROTA\n'); v = L.verify(); ok(!v.ok && kinds(v).includes('corrupt'), 'una línea rota se informa como corrupta');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});
test('ledger-migracion', async () => {
  const d = copy();
  try {
    fs.mkdirSync(path.join(d, 'out'), { recursive: true });
    const old = [1, 2, 3].map((i) => JSON.stringify({ id: 'x' + i, ts: '2026-01-0' + i + 'T00:00:00Z', agent: 'anon', role: 'director', action: 'lint', target: 't' + i, hash_before: null, hash_after: null, verdict: 'SHIP', why: null }));
    putLines(d, old);
    const L = await imp(d, 'ledger.mjs');
    ok(L.verify().ok && L.verify().legacy === 3, 'E5 ledger heredado sin génesis: verify lo acepta como heredado');
    L.record({ action: 'lint', verdict: 'FIX', agent: 'ana', role: 'td' });
    let E = ledger(d); ok(E[3].action === 'ledger.genesis' && E[3].prev === null && E[4].prev === E[3].h, 'E5 la primera escritura añade un génesis que sella lo heredado');
    ok(L.verify().ok, 'E5 verify pasa tras migrar');
    const o = lines(d); o[1] = o[1].replace('"t2"', '"t9"'); putLines(d, o);
    const v = L.verify(); ok(!v.ok && kinds(v).includes('genesis'), 'E5 editar lo heredado después de migrar se detecta (digest del génesis)');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});
test('ledger-firma', async () => {
  const d = copy();
  try {
    const L = await imp(d, 'ledger.mjs');
    L.record({ action: 'lint', verdict: 'SHIP', agent: 'ana', role: 'td' });
    L.keygen('ana');
    const keyf = path.join(d, 'out/keys/ana'); ok(fs.existsSync(keyf) && (fs.statSync(keyf).mode & 0o077) === 0, 'E6 keygen crea out/keys/<agente> con permisos 0600');
    L.record({ action: 'lint', verdict: 'FIX', agent: 'ana', role: 'td' }); L.record({ action: 'lint', verdict: 'SHIP', agent: 'bob', role: 'td' });
    const E = ledger(d); ok(E.at(-2).sig && !E.at(-1).sig, 'E6 solo las entradas del agente con clave llevan sig');
    ok(L.verify().ok && L.verify().signed >= 2, 'E6 verify con firmas pasa');
    const o = lines(d), i = o.length - 2, bad = JSON.parse(o[i]); bad.sig = 'f'.repeat(32); const keep = o.slice(); keep[i] = JSON.stringify(bad); putLines(d, keep);
    ok(kinds(L.verify()).includes('sig'), 'E6 sig alterada se detecta');
    const un = JSON.parse(o[i]); delete un.sig; keep[i] = JSON.stringify(un); putLines(d, keep);
    ok(kinds(L.verify()).includes('unsigned'), 'E6 quitar la firma a un agente con clave se detecta');
    putLines(d, o); fs.renameSync(keyf, keyf + '.off'); const v = L.verify();
    ok(v.ok && v.warnings.some((w) => /no verificable/.test(w)), 'E6 sin la clave: avisa "no verificable" pero no falla');
    fs.renameSync(keyf + '.off', keyf);
    ok(run(d, ['engine/ledger.mjs', 'verify', '--require-sig']).status === 1, 'verify --require-sig falla con entradas sin firmar');
    ok(!fs.readFileSync(path.join(d, 'out/ledger.jsonl'), 'utf8').includes(fs.readFileSync(keyf, 'utf8').trim()), 'la clave nunca aparece en el ledger');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});
test('ledger-codigos', async () => {
  const d = copy();
  try {
    const L = await imp(d, 'ledger.mjs');
    const real = [['lint', 'SHIP'], ['lint', 'FIX'], ['lint', 'PASS'], ['master', 'ok'], ['review', 'ok'], ['gate.close', 'closed'], ['gate.close', 'open'], ['gate.force', 'forced'], ['gate.restore', 'restored'], ['gate.frozen', 'frozen'], ['master.force', 'forced'], ['claim', 'ok'], ['release', 'ok'], ['lock.steal', 'expired'], ['fragment.discard', 'stale'], ['trash', 'moved'], ['orch.accept', 'accepted'], ['orch.decide', 'blocked'], ['orch.deliver', 'rejected'], ['write', 'would_deny'], ['write', 'deny'], ['write', 'allow']];
    for (const [a, v] of real) L.record({ action: a, verdict: v, agent: 'ana' });
    L.record({ action: 'accion.inventada', verdict: 'rarisimo', agent: 'ana' });
    const E = ledger(d), S = L.stats();
    ok(E.filter((e) => e.code).length / E.length > 0.9 && E[0].code === 'lint.SHIP', 'E8 más del 90 % de las entradas reales llevan code cerrado (' + (100 * S.coded / S.total).toFixed(0) + ' %)');
    ok(E.at(-1).code === null && S.uncoded.some((u) => u.action === 'accion.inventada'), 'E8 una acción desconocida queda sin código y se lista en stats');
    ok(L.CODES.has('lint.FIX') && !L.CODES.has('accion.inventada'), 'E8 CODES es el vocabulario cerrado exportado');
    ok(/codificadas/.test(run(d, ['engine/ledger.mjs', 'stats']).stdout), 'E8 CLI stats informa el % codificado');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});
test('ledger-concurrente-cadena', async () => {
  const d = copy();
  try {
    fs.mkdirSync(path.join(d, 'out'), { recursive: true });
    fs.writeFileSync(path.join(d, 'w2.mjs'), `import { record } from './engine/ledger.mjs'; const me = process.env.OPUS_AGENT; for (let i = 0; i < 60; i++) record({ action: 'lint', verdict: 'SHIP', target: me + '/' + i, why: 'x'.repeat(100) });`);
    const rs = await Promise.all(['A', 'B', 'C', 'D'].map((a) => runP(d, ['w2.mjs'], { OPUS_AGENT: a })));
    const L = await imp(d, 'ledger.mjs'), v = L.verify();
    ok(rs.every((r) => r.status === 0) && v.ok && v.chained === 240, 'E7 4 procesos concurrentes: 240 entradas y cadena válida ' + JSON.stringify(v.problems.slice(0, 2)) + rs.map((r) => r.out).join('').slice(0, 200));
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});
test('roles-enforce', async () => {
  const d = copy();
  try {
    const R = await imp(d, 'roles.mjs');
    ok(J(path.join(ROOT, 'roles.json')).mode === 'enforce', 'E10 roles.json en mode enforce por defecto');
    const hook = (env, file, tool = 'Edit') => spawnSync(NODE, [path.join(d, '.claude/hooks/opus-roles.mjs')], { cwd: d, encoding: 'utf8', input: JSON.stringify({ tool_name: tool, tool_input: { file_path: path.join(d, file) } }), env: { ...process.env, ...env } });
    const deny = (h) => { try { return JSON.parse(h.stdout).hookSpecificOutput.permissionDecision === 'deny'; } catch { return false; } };
    ok(deny(hook({ OPUS_ROLE: 'animator:A2', OPUS_AGENT: 'bob' }, 'data/timeline.json')), 'E11 Animator A2 → data/timeline.json = deny (sin OPUS_ROLES_MODE)');
    ok(deny(hook({ OPUS_ROLE: 'animator:A2', OPUS_AGENT: 'bob' }, 'engine/core.mjs', 'Write')), 'E11 Animator A2 → engine/core.mjs = deny');
    ok(deny(hook({ OPUS_ROLE: 'animator:A2', OPUS_AGENT: 'bob' }, 'shots/A1.mjs', 'MultiEdit')), 'E11 Animator A2 → shot ajeno = deny');
    ok(!deny(hook({ OPUS_ROLE: 'animator:A2', OPUS_AGENT: 'bob' }, 'shots/A2.mjs')) && !deny(hook({ OPUS_ROLE: 'animator:A2', OPUS_AGENT: 'bob' }, 'out/sheets/A2.png')), 'E11 Animator A2 → su shot y out/ = allow');
    ok(!deny(hook({ OPUS_ROLE: 'director', OPUS_AGENT: 'dir' }, 'data/timeline.json')) && !deny(hook({ OPUS_ROLE: 'director' }, 'engine/core.mjs')), 'E11 Director → allow');
    ok(!deny(hook({ OPUS_ROLE: 'td', OPUS_AGENT: 't' }, 'engine/ledger.mjs')) && !deny(hook({ OPUS_ROLE: 'td', OPUS_AGENT: 't' }, 'README.md')) && !deny(hook({ OPUS_ROLE: 'td', OPUS_AGENT: 't' }, 'docs/handoff/x.md')), 'E9 TD escribe motor, tests, docs y README (falsos positivos medidos y corregidos)');
    ok(deny(hook({ OPUS_ROLE: 'td', OPUS_AGENT: 't' }, 'data/timeline.json')) && deny(hook({ OPUS_ROLE: 'td' }, 'styles/noir.json')), 'E11 TD no toca timeline ni estilos');
    ok(!deny(hook({ OPUS_ROLE: 'animator:A2', OPUS_ROLES_MODE: 'observer' }, 'data/timeline.json')), 'E10 OPUS_ROLES_MODE=observer desactiva el bloqueo');
    ok(hook({}, 'x').stdout === '' && spawnSync(NODE, [path.join(d, '.claude/hooks/opus-roles.mjs')], { cwd: d, input: '}{', encoding: 'utf8' }).stdout === '', 'hook: error de entrada → pasa');
    const rp = run(d, ['engine/roles.mjs', 'replay', '--json', '--repo', ROOT]);
    let rep = null; try { rep = JSON.parse(rp.stdout); } catch {}
    ok(rep && rep.commits > 0 && typeof rep.falsePositiveRate === 'number', 'E9 roles replay mide el historial git: ' + (rep ? `${rep.commits} commits, ${rep.files} ficheros, FP ${(100 * rep.falsePositiveRate).toFixed(1)} %` : rp.stderr.slice(0, 200)));
    // Historial congelado: el replay del checkout vivo depende de la profundidad del clon (CI superficial = 1 commit pasaba trivial; clon completo = 29 → otra cifra). El fixture fija la medida.
    const fr = R.replay({ log: fs.readFileSync(path.join(ROOT, 'test/fixtures/roles-history.log'), 'utf8') }), fn = fr.falsePositives.length, fpct = (100 * fr.falsePositiveRate).toFixed(1);
    ok(fr.commits === 29 && fn <= 36, `E9 replay del historial congelado (test/fixtures/roles-history.log): ${fr.commits} commits, FP ${fn}/${fr.files} (${fpct} %) ≤ 36 (trinquete; objetivo 5 %: recalibrar roles.json lo decide el Director)`);
    // E11 macOS: os.tmpdir() cuelga de un symlink (/var → /private/var); el hook recibe la ruta por el symlink y ROOT es el realpath.
    const lnk = d + '-link';
    try {
      fs.symlinkSync(d, lnk);
      const hookAbs = (env, abs, tool = 'Edit') => spawnSync(NODE, [path.join(d, '.claude/hooks/opus-roles.mjs')], { cwd: d, encoding: 'utf8', input: JSON.stringify({ tool_name: tool, tool_input: { file_path: abs } }), env: { ...process.env, ...env } });
      const A2 = { OPUS_ROLE: 'animator:A2', OPUS_AGENT: 'bob' };
      ok(deny(hookAbs(A2, path.join(lnk, 'data/timeline.json'))) && !deny(hookAbs(A2, path.join(lnk, 'shots/A2.mjs'))), 'E11 ruta bajo symlink (macOS /var → /private/var) = misma decisión');
    } finally { fs.rmSync(lnk, { force: true }); }
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});
test('status', async () => {
  const d = copy();
  try {
    for (const e of ['docs', 'README.md', 'CLAUDE.md', 'AGENTES.md', 'ORQUESTADOR.md', 'MOTOR.md', 'orch.json']) if (fs.existsSync(path.join(ROOT, e))) fs.cpSync(path.join(ROOT, e), path.join(d, e), { recursive: true });
    fs.mkdirSync(path.join(d, 'test'), { recursive: true }); for (const f of ['gov.mjs', 'unit.mjs']) fs.copyFileSync(path.join(ROOT, 'test', f), path.join(d, 'test', f));
    let r = run(d, ['engine/status.mjs']), S = fs.existsSync(path.join(d, 'STATUS.md')) ? fs.readFileSync(path.join(d, 'STATUS.md'), 'utf8') : '';
    ok(r.status === 0 && S.length > 500, 'E12 status.mjs genera STATUS.md ' + r.stderr.slice(0, 200));
    for (const k of ['Gates', 'Veredictos', 'Ramas sin integrar', 'Tests', 'Motor', 'Specs', 'Ledger', 'Presupuestos']) ok(new RegExp('^## ' + k, 'm').test(S), 'E12 STATUS.md tiene la sección ' + k);
    ok(/008-gobernanza/.test(S) && /validate/.test(S), 'E12 lista specs y gates reales');
    ok(run(d, ['engine/status.mjs', '--check']).status === 0, 'E13 --check pasa recién generado');
    const g = J(path.join(d, 'gates.json')); g.nuevo = ['x::node -e "0"']; fs.writeFileSync(path.join(d, 'gates.json'), JSON.stringify(g));
    r = run(d, ['engine/status.mjs', '--check']); ok(r.status === 1 && /desactualizado/.test(r.stderr + r.stdout), 'E13 un gate nuevo deja STATUS.md desactualizado = fallo');
    run(d, ['engine/status.mjs']); ok(run(d, ['engine/status.mjs', '--check']).status === 0, 'E13 regenerar lo arregla');
    fs.writeFileSync(path.join(d, 'docs/specs/099-nueva.md'), '# 099 nueva\n\n## Calificaciones\n- 7/10 "suena bien"\n');
    ok(run(d, ['engine/status.mjs', '--check']).status === 1, 'E13 una spec nueva deja STATUS.md desactualizado');
    run(d, ['engine/status.mjs']); ok(/suena bien/.test(fs.readFileSync(path.join(d, 'STATUS.md'), 'utf8')), 'E12 la última nota humana de la spec aparece');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});
test('docs-enlaces', async () => {
  const r = run(ROOT, ['engine/status.mjs', '--links']);
  ok(r.status === 0, 'E14 sin enlaces rotos en los .md del repo: ' + r.stdout.slice(0, 600));
  ok(run(ROOT, ['engine/status.mjs', '--check']).status === 0, 'E13 STATUS.md del repo está al día (regenera con node engine/status.mjs)');
  for (const dir of ['current', 'specs', 'adr', 'history']) ok(fs.existsSync(path.join(ROOT, 'docs', dir)), 'docs/' + dir + ' existe');
  ok(fs.readdirSync(path.join(ROOT, 'docs/adr')).filter((f) => /^\d{3}-.*\.md$/.test(f)).length >= 6, 'docs/adr tiene los ADR de decisiones permanentes');
  const d = copy();
  try {
    fs.mkdirSync(path.join(d, 'docs'), { recursive: true }); fs.writeFileSync(path.join(d, 'docs/a.md'), 'ver [roto](nada.md) y [ok](a.md#x)\n');
    const x = run(d, ['engine/status.mjs', '--links']); ok(x.status === 1 && /nada\.md/.test(x.stdout), 'E14 el verificador detecta un enlace roto');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});
test('presupuestos', async () => {
  const d = copy();
  try {
    fs.writeFileSync(path.join(d, 'data/budgets.json'), JSON.stringify({ warnAt: 0.8, tokens: { perRole: { animator: 1000 }, perTask: { 'A2': 500 } }, renderMinutes: { perFilm: { main: 10 }, default: 30 }, iterations: { perShot: 3, perGate: 4 } }));
    const L = await imp(d, 'ledger.mjs'), B = await imp(d, 'budget.mjs');
    ok(B.checkBudget({ kind: 'tokens', role: 'animator' }).level === 'ok', 'E15 sin consumo = ok');
    L.recordUsage({ tokens: 850, role: 'animator', task: 'A2', agent: 'bob' });
    let c = B.checkBudget({ kind: 'tokens', role: 'animator' }); ok(c.level === 'warn' && c.used === 850 && c.limit === 1000, 'E15 al 85 % avisa');
    ok(B.checkBudget({ kind: 'tokens', task: 'A2' }).level === 'block', 'E15 tarea A2 sobre 500 tokens → block');
    L.recordUsage({ tokens: 200, role: 'animator', task: 'A3', agent: 'bob' });
    c = B.checkBudget({ kind: 'tokens', role: 'animator' }); ok(c.level === 'block', 'E15 al superar el 100 % bloquea');
    L.recordUsage({ minutes: 9, film: 'main', agent: 'x' }); ok(B.checkBudget({ kind: 'render', film: 'main' }).level === 'warn', 'E15 minutos de render por film');
    for (let i = 0; i < 3; i++) L.record({ action: 'lint', target: 'lint/main/A1', verdict: 'FIX', agent: 'x' });
    ok(B.checkBudget({ kind: 'iterations', shot: 'A1' }).level === 'block', 'E15 iteraciones por shot (3 lints seguidos sobre A1 = tope)');
    for (let i = 0; i < 2; i++) L.record({ action: 'gate.close', target: 'gate/validate', verdict: 'open', agent: 'x' });
    ok(B.checkBudget({ kind: 'iterations', gate: 'validate' }).level === 'ok', 'E15 gate por debajo del tope = ok');
    ok(L.readLedger().some((e) => e.action === 'budget.block') && L.readLedger().some((e) => e.action === 'budget.warn'), 'E16 los avisos y bloqueos quedan en el ledger');
    ok(!B.checkBudget({ kind: 'tokens', role: 'director' }).limit && B.checkBudget({ kind: 'tokens', role: 'director' }).level === 'ok', 'rol sin tope = ok');
    const r = run(d, ['engine/ledger.mjs', 'budget']);
    ok(r.status === 1 && /animator/.test(r.stdout) && /block|BLOQUEO/i.test(r.stdout), 'E15 CLI budget informa y sale con 1 si hay bloqueo ' + r.stdout.slice(0, 300));
    ok(L.verify().ok, 'la cadena sigue válida tras usos y avisos');
    fs.rmSync(path.join(d, 'data/budgets.json')); ok(B.checkBudget({ kind: 'tokens', role: 'animator' }).level === 'ok', 'sin budgets.json: nada se bloquea');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

for (const t of T.filter((x) => !only || x.name === only)) {
  const b0 = bad, t0 = Date.now();
  try { await t.fn(); } catch (e) { ok(false, `${t.name}: ${e.stack}`); }
  if (process.argv.includes('-v')) console.log(`  ${bad === b0 ? '·' : '✗'} ${t.name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
console.log(`${bad ? '✗' : '✓'} gobernanza     ${n - bad}/${n}`); process.exit(bad ? 1 : 0);
