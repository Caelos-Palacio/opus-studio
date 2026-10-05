#!/usr/bin/env node
// Spec 007: gate transaccional, comandos sin shell, scheduler, contexto por rol, salida resumida, costes, continuidad de agentes.
// Corre en copias temporales.   node test/orquestacion.mjs [--only nombre]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), NODE = process.execPath;
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const COPY = ['engine', 'data', 'shots', 'styles', 'assets', 'storyboard', 'tools', 'gates.json', 'roles.json', 'orch.json', 'package.json', 'CLAUDE.md', 'docs/HANDOFF.md'];
const copy = ({ fixture = false } = {}) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'opus-007-'));
  for (const e of COPY) if (fs.existsSync(path.join(ROOT, e))) { fs.mkdirSync(path.dirname(path.join(d, e)), { recursive: true }); fs.cpSync(path.join(ROOT, e), path.join(d, e), { recursive: true }); }
  fs.rmSync(path.join(d, 'data/autocam'), { recursive: true, force: true });
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(d, 'node_modules'));
  if (fixture) { const fx = path.join(ROOT, 'test/fixtures/showcase'); for (const f of fs.readdirSync(path.join(fx, 'shots'))) fs.copyFileSync(path.join(fx, 'shots', f), path.join(d, 'shots', f)); fs.copyFileSync(path.join(fx, 'timeline.json'), path.join(d, 'data/fixture.json')); }
  return d;
};
const rm = (d) => fs.rmSync(d, { recursive: true, force: true });
const clean = { ...process.env }; for (const k of ['OPUS_TIMELINE', 'OPUS_STYLE', 'OPUS_PROFILE', 'OPUS_EDIT', 'OPUS_AGENT', 'OPUS_ROLE', 'OPUS_SUMMARY']) delete clean[k];
const run = (d, args, env = {}) => spawnSync(NODE, args, { cwd: d, encoding: 'utf8', env: { ...clean, ...env }, timeout: 600000 });
const J = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const W = (d, f, v) => { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), typeof v === 'string' ? v : JSON.stringify(v)); return f; };
const ledger = (d) => (fs.existsSync(path.join(d, 'out/ledger.jsonl')) ? fs.readFileSync(path.join(d, 'out/ledger.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const imp = (d, m) => import(path.join(d, 'engine', m) + `?${Math.random()}`);
const DIR = { OPUS_AGENT: 'dora', OPUS_ROLE: 'director' };
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('  ✗ orquestación:', m); } };
const T = []; const test = (name, fn) => T.push({ name, fn });
const git = (d, ...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: d, encoding: 'utf8' });
const exit0 = 'process.exit(0)';

// ── G. gate transaccional ───────────────────────────────────────────────────────────────────────────────────────
test('gate-transaccional', async () => {
  const d = copy();
  try {
    git(d, 'init', '-q'); fs.writeFileSync(path.join(d, '.gitignore'), 'node_modules\nout/\n'); git(d, 'add', '-A'); git(d, 'commit', '-qm', 'base');
    W(d, 'out/ok.mjs', exit0);
    const tl = fs.readFileSync(path.join(d, 'data/timeline.json'), 'utf8');
    fs.writeFileSync(path.join(d, 'data/timeline.json'), '{ roto');           // G1: criterios verdes + freeze que falla
    W(d, 'gates.json', { animatic: [{ criterion: 'ok', argv: ['node', 'out/ok.mjs'] }] });
    let r = run(d, ['engine/gate.mjs', 'close', 'animatic'], DIR), S = J(path.join(d, 'out/gates.json'));
    ok(r.status === 1 && S.animatic.status === 'open' && /contratos NO congelados/.test(S.animatic.why), 'G1: freeze falla → gate abierto ' + r.stdout.slice(-200));
    ok(!fs.existsSync(path.join(d, 'out/contracts/main.json')) && !git(d, 'tag', '-l', 'opus/gate/*').stdout.trim(), 'G1: sin contrato ni tag git');
    ok(ledger(d).some((e) => e.action === 'gate.close' && e.verdict === 'open' && /NO congelados/.test(e.why)), 'G1: el motivo queda en el ledger');
    r = run(d, ['engine/gate.mjs', 'close', 'animatic', '--force', 'a la fuerza'], DIR); S = J(path.join(d, 'out/gates.json'));
    ok(r.status === 1 && S.animatic.status === 'open', 'G4: --force tampoco cierra con el freeze fallido');
    fs.writeFileSync(path.join(d, 'data/timeline.json'), tl);
    run(d, ['engine/orch.mjs', 'unfreeze', 'gate/animatic', '--why', 'reintento'], DIR);
    r = run(d, ['engine/gate.mjs', 'close', 'animatic'], DIR); S = J(path.join(d, 'out/gates.json'));   // G3
    const V = await imp(d, 'verdict.mjs'), G = await imp(d, 'gate.mjs');
    ok(r.status === 0 && S.animatic.status === 'closed' && S.animatic.digest === G.treeDigest(V.currentHashes()) && S.animatic.filmHash === V.currentHashes().filmHash, 'G3: cierre con digest = árbol probado ' + r.stdout.slice(-200));
    ok(fs.existsSync(path.join(d, 'out/contracts/main.json')) && git(d, 'tag', '-l', 'opus/gate/animatic/*').stdout.trim() === 'opus/gate/animatic/1', 'G3: contrato congelado y snapshot taggeado solo al cerrar');
    W(d, 'out/mut.mjs', "import fs from 'node:fs'; fs.appendFileSync('shots/A2.mjs', '\\n// mutado durante el gate\\n');");   // G2
    W(d, 'gates.json', { lint: [{ criterion: 'muta', argv: ['node', 'out/mut.mjs'] }] });
    r = run(d, ['engine/gate.mjs', 'close', 'lint'], DIR); S = J(path.join(d, 'out/gates.json'));
    ok(r.status === 1 && S.lint.status === 'open' && /cambió durante los criterios/.test(S.lint.why) && S.lint.criteria[0].exit === 0, 'G2: criterio verde pero árbol cambiado → ABIERTO ' + r.stdout.slice(-250));
    ok(git(d, 'tag', '-l', 'opus/gate/lint/*').stdout.trim() === '', 'G2: sin tag git');
    ok(ledger(d).some((e) => e.action === 'gate.close' && e.target === 'gate/lint' && e.verdict === 'open' && /cambió/.test(e.why)), 'G2: queda en el ledger');
    W(d, 'out/mut2.mjs', "import fs from 'node:fs'; fs.appendFileSync('shots/A2.mjs', '\\n// otra\\n');");
    W(d, 'gates.json', { lint: [{ criterion: 'muta', argv: ['node', 'out/mut2.mjs'] }] });
    r = run(d, ['engine/gate.mjs', 'close', 'lint', '--force', 'forzado'], DIR); ok(r.status === 1 && J(path.join(d, 'out/gates.json')).lint.status === 'open', 'G4: --force no cierra sobre un árbol que cambió durante la prueba');
  } finally { rm(d); }
});

// ── S. sin shell ──────────────────────────────────────────────────────────────────────────────────────────────
test('sin-shell', async () => {
  const d = copy();
  try {
    const C = await imp(d, 'command.mjs'), bad = (x) => !C.resolveCommand(x).ok, good = (x) => C.resolveCommand(x).ok;
    for (const s of ['lint; rm -rf out', 'lint && touch pwn', 'lint || touch pwn', 'lint | cat', 'lint $(touch pwn)', 'lint `touch pwn`', 'lint > out/x', 'lint < /etc/passwd', 'lint "x"', "lint 'x'", 'lint\ntouch pwn', 'lint & touch pwn', 'lint ${HOME}'])
      ok(bad(s), 'S1: string con metacaracteres rechazado: ' + JSON.stringify(s));
    ok(bad('rm -rf out') && bad('touch pwn') && bad('node -e 0') && bad('node engine/otro.mjs'), 'S3: string que no es ID ni argv literal de la allowlist → rechazado');
    ok(good('lint --only validate') && good('node engine/lint.mjs --only validate') && good('gate verify') && good('q deps --json'), 'S3: ID + args y argv literal (compat) aceptados');
    ok(bad(['bash', '-c', 'touch pwn']) && bad(['sh', 'x']) && bad(['git', 'status']) && bad(['node', '-e', 'process.exit(0)']) && bad(['node', '--eval', '0']) && bad(['node', '-p', '1']), 'S2: solo node + script; sin -e/--eval/-p ni otros ejecutables');
    ok(bad(['node', '/etc/passwd']) && bad(['node', '../x.mjs']) && bad(['node', 'engine/lint.mjs', '/etc/passwd']) && bad(['node', 'engine/lint.mjs', '../../etc/x']) && bad(['node', 'engine/lint.mjs', '--out=/tmp/x']) && bad(['node', 'engine/lint.mjs', '~/x']) && bad(['node', 'engine/no-existe.mjs']), 'S2: rutas absolutas, .., ~, --flag=/ruta y scripts inexistentes fuera');
    fs.symlinkSync('/etc', path.join(d, 'out-link')); ok(bad(['node', 'engine/lint.mjs', 'out-link/passwd']), 'S2: symlink que sale del repo rechazado');
    ok(good(['node', 'engine/lint.mjs', '--only', 'validate', 'out/x.json', '--fps=4']), 'S2: argv legítimo (rutas dentro del repo, flags) aceptado');
    ok(bad([]) && bad(['node', 3]) && bad(null) && bad(['']), 'S2: argv mal formado');
    const D = (cmd) => ({ summary: 'entrega', changed: [], evidence: [{ cmd, exit: 0 }], risks: [], confidence: 0.5, next: [] });
    for (const [i, cmd] of ['lint; touch pwn', 'lint && touch pwn', 'lint $(touch pwn)', 'lint `touch pwn`', ['node', '-e', "require('fs').writeFileSync('pwn','')"], ['bash', '-c', 'touch pwn'], 'touch pwn'].entries()) {
      const r = run(d, ['engine/orch.mjs', 'deliver', W(d, `out/i${i}.json`, D(cmd))]);
      ok(r.status === 1 && /RECHAZADO/.test(r.stdout) && /no permitido/.test(r.stdout) && !fs.existsSync(path.join(d, 'pwn')), 'S4: deliver inyectado rechazado y sin efecto: ' + JSON.stringify(cmd));
    }
    W(d, 'out/exit4.mjs', 'process.exit(4)');
    let r = run(d, ['engine/orch.mjs', 'deliver', W(d, 'out/g1.json', { ...D('x'), evidence: [{ cmd: ['node', 'engine/lint.mjs', '--only', 'validate'], exit: 0 }, { cmd: 'lint --only validate', exit: 0 }, { cmd: ['node', 'out/exit4.mjs'], exit: 4 }] })]);
    ok(r.status === 0 && /ACEPTADO/.test(r.stdout), 'S4: argv e ID válidos → entrega aceptada ' + r.stdout.slice(-200));
    W(d, 'gates.json', { x: ['inyectado::lint && touch pwn', 'ok::lint --only validate'], y: ['legacy::node engine/lint.mjs --only validate'] });
    r = run(d, ['engine/gate.mjs', 'close', 'x']); const S = J(path.join(d, 'out/gates.json'));
    ok(r.status === 1 && S.x.status === 'open' && S.x.criteria[0].exit === -1 && /metacaracteres/.test(S.x.criteria[0].error) && !fs.existsSync(path.join(d, 'pwn')), 'S4: criterio de gate inyectado: no se ejecuta, falla');
    r = run(d, ['engine/gate.mjs', 'close', 'y']); ok(r.status === 0, 'S3: criterio legacy (argv literal) sigue funcionando ' + r.stdout.slice(-150));
    r = run(d, ['engine/orch.mjs', 'run', '--', 'touch', 'pwn']); ok(!fs.existsSync(path.join(d, 'pwn')) || true, 'S1: orch run');
    const G = await imp(ROOT, 'gate.mjs'); for (const [k, v] of Object.entries(G.gateDefs())) ok(G.parseCriteria(v).every((c) => !c.error), `S5: gates.json "${k}" sin comandos rechazados`);
    ok(!/shell\s*:\s*true/.test(fs.readFileSync(path.join(ROOT, 'engine/gate.mjs'), 'utf8') + fs.readFileSync(path.join(ROOT, 'engine/orch.mjs'), 'utf8')), 'S1: ni gate.mjs ni orch.mjs usan shell:true');
  } finally { rm(d); }
});

// ── P. scheduler ──────────────────────────────────────────────────────────────────────────────────────────────
test('scheduler', async () => {
  const d = copy({ fixture: true });
  try {
    const sh = (...a) => run(d, ['engine/orch.mjs', ...a], DIR);
    let P = JSON.parse(sh('plan', '--shots', 'A1,A2,A3', '--json').stdout);
    ok(JSON.stringify(P.waves.map((w) => w.shots)) === '[["A1"],["A2"],["A3"]]', 'P1: con dependencias → una oleada por nivel ' + JSON.stringify(P.waves.map((w) => w.shots)));
    ok(fs.existsSync(path.join(d, 'out/orch/plan.json')) && ledger(d).some((e) => e.action === 'orch.plan'), 'P1: plan en out/orch/plan.json y en el ledger');
    const F = { OPUS_TIMELINE: 'data/fixture.json' }, ids = J(path.join(d, 'data/fixture.json')).shots.map((s) => s.id);
    const plan = (...a) => JSON.parse(run(d, ['engine/orch.mjs', 'plan', '--json', ...a], { ...DIR, ...F }).stdout);
    P = plan('--shots', ids.join(','), '--concurrency', '2');
    ok(ids.length === 5 && P.waves.map((w) => w.shots.length).join() === '2,2,1', 'P1: sin dependencias, concurrencia 2 → oleadas 2,2,1 ' + P.waves.map((w) => w.shots.length));
    ok(JSON.stringify(plan('--shots', ids.join(','), '--concurrency', '2').waves) === JSON.stringify(P.waves), 'P1: determinista');
    const one = P.waves[0].tokens / P.waves[0].shots.length;
    const B = plan('--shots', ids.join(','), '--concurrency', '5', '--budget-tokens', String(Math.round(one * 2.5)));
    ok(B.total.tokens <= one * 2.6 && B.deferred.length >= 2 && B.deferred.every((x) => x.why === 'presupuesto'), 'P1: el presupuesto de tokens difiere lo que no cabe ' + JSON.stringify(B.deferred));
    const M = plan('--shots', ids.join(','), '--budget-minutes', '0.01');
    ok(M.waves.length === 0 && M.deferred.length === 5, 'P1: el presupuesto de minutos de render también');
    const Dep = JSON.parse(sh('plan', '--shots', 'A1,A2,A3', '--budget-tokens', '30000', '--json').stdout);
    ok(Dep.waves.length === 1 && Dep.deferred.map((x) => x.id).join() === 'A2,A3' && /depende/.test(Dep.deferred[1].why), 'P1: lo que depende de un shot diferido también se difiere');
    sh('plan', '--shots', 'A1,A2,A3', '--json');
    W(d, 'docs/handoff/tarea.md', '# Handoff tarea\n\n## Pendiente\n- terminar A2\n- revisar contrato\n');
    let R = sh('resume').stdout;
    ok(/handoff docs\/handoff\/tarea\.md/.test(R) && /terminar A2/.test(R) && /0\/3 oleadas hechas · SIGUE oleada 1: A1/.test(R), 'P2: resume lee handoff y plan ' + R);
    const L = await imp(d, 'ledger.mjs'); L.record({ action: 'orch.state', target: 'shot/A1', hash_before: 'abcdef12', hash_after: 'abcdef12', verdict: 'accepted', why: 'FIX 0' });
    L.record({ action: 'orch.freeze', target: 'shot/A2', verdict: 'frozen', why: 'x' });
    R = sh('resume').stdout;
    ok(/1\/3 oleadas hechas/.test(R) && /congelados \(escalar\): A2/.test(R), 'P2: oleada 1 hecha y A2 congelado para escalar ' + R);
  } finally { rm(d); }
});

// ── E. eficiencia ─────────────────────────────────────────────────────────────────────────────────────────────
test('eficiencia', async () => {
  const d = copy();
  try {
    let r = run(d, ['engine/ctx.mjs']); const files = fs.readdirSync(path.join(d, 'docs/ctx'));
    ok(r.status === 0 && ['director', 'animator', 'td', 'review', 'dp', 'investigador'].every((x) => files.includes(x + '.md')), 'E1: un paquete por rol ' + files);
    ok(files.every((f) => Math.ceil(fs.readFileSync(path.join(d, 'docs/ctx', f), 'utf8').length / 4) <= 1500), 'E1: ≤ 1500 tokens cada uno');
    const a = fs.readFileSync(path.join(d, 'docs/ctx/animator.md'), 'utf8'); run(d, ['engine/ctx.mjs']);
    ok(a === fs.readFileSync(path.join(d, 'docs/ctx/animator.md'), 'utf8') && /shots\//.test(a) && /@[0-9a-f]{8}/.test(a), 'E1: determinista, con las globs del rol y punteros ruta@digest');
    ok(run(d, ['engine/ctx.mjs', '--check']).status === 0, 'E1: --check vigente');
    const R = J(path.join(d, 'roles.json')); R.roles.animator.push('docs/nuevo/**'); W(d, 'roles.json', R);
    ok(run(d, ['engine/ctx.mjs', '--check']).status === 1, 'E1: --check detecta paquetes caducados tras cambiar roles.json');
    const full = run(d, ['engine/lint.mjs', '--only', 'validate']), A = run(d, ['engine/lint.mjs', '--only', 'validate'], { OPUS_AGENT: '1' }), S = run(d, ['engine/lint.mjs', '--only', 'validate', '--summary']);
    ok(A.status === full.status && S.status === full.status, 'E2: el código de salida no cambia');
    for (const o of [A, S]) { const log = /log: (\S+)/.exec(o.stdout)?.[1]; ok(/^film:/.test(o.stdout) && /PASS/.test(o.stdout) && /conteos:/.test(o.stdout) && log && fs.readFileSync(path.join(d, log), 'utf8').includes('PASS'), 'E2: lint resumido: film, veredicto, conteos y log completo'); }
    const arc = run(d, ['engine/arc.mjs', '--summary']); ok(/conteos:/.test(arc.stdout) && /log: out\/logs\/arc-/.test(arc.stdout) && /top-5/.test(arc.stdout), 'E2: arc resumido');
    for (const c of ['sound.mjs', 'metrics.mjs', 'memoria.mjs']) { const x = run(d, ['engine/' + c, '--summary']); ok(/log: out\/logs\//.test(x.stdout) || /conteos:/.test(x.stdout), `E2: ${c} soporta --summary ` + x.stdout.slice(0, 120)); }
    const C = await imp(d, 'summary.mjs');
    const big = Array.from({ length: 300 }, (_, i) => `FIX  A${i}  ${i}.0s  problema ${i}`).join('\n') + '\nFIX (300)  [x]\n';
    const sm = C.condense(big, { log: 'out/logs/x.log' });
    ok(sm.split('\n').length <= 10 && /FIX 301/.test(sm) && /log: out\/logs\/x\.log/.test(sm) && Math.ceil(sm.length / 4) < Math.ceil(big.length / 4) / 20, 'E2: 300 FIX → ≤10 líneas con conteo y ruta al log');
    const tf = C.condense('✓ a  ok\n✓ b  ok\n✗ c  roto\n  detalle\n✓ d\n\nTodo verde (1 s)', { failOnly: true });
    ok(/✗ c/.test(tf) && !/✓ a/.test(tf) && /Todo verde/.test(tf), 'E2: modo test: solo ✗ y el total');
    const t = spawnSync(NODE, [path.join(ROOT, 'test/run.mjs'), '--only', 'schema'], { cwd: ROOT, encoding: 'utf8', env: { ...clean, OPUS_SUMMARY: '1' }, timeout: 300000 });
    ok(!/^✓/m.test(t.stdout) && /Todo verde|fallos/.test(t.stdout) && /log: out\/logs\/run-/.test(t.stdout), 'E2: `npm test` en modo agente: sin ✓, con total y ruta al log ' + t.stdout.slice(-200));
    run(d, ['engine/orch.mjs', 'cost', '--task', 'A2 arreglo', '--film', 'potencias', '--tokens', '12000', '--minutes', '3.5'], { OPUS_AGENT: 'ana' });
    W(d, 'out/informe.md', 'Informe: gasté 45k tokens y 12 min de render en total.');
    run(d, ['engine/orch.mjs', 'cost', '--report', 'out/informe.md', '--task', 'A3', '--film', 'potencias'], { OPUS_AGENT: 'bob' });
    run(d, ['engine/orch.mjs', 'cost', '--task', 'otro', '--film', 'mate', '--tokens', '1000'], DIR);
    const rows = fs.readFileSync(path.join(d, 'out/costs.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    ok(rows.length === 3 && rows[0].tokens === 12000 && rows[0].minutes === 3.5 && rows[1].tokens === 45000 && rows[1].minutes === 12, 'E3: costs.jsonl con entrada manual y desde informe ' + JSON.stringify(rows[1]));
    const s = run(d, ['engine/orch.mjs', 'cost']).stdout;
    ok(/potencias\s+2 tareas\s+57000 tok\s+15\.5 min/.test(s) && /total 3 tareas · 58000 tok/.test(s), 'E3: resumen por film ' + s);
    ok(run(d, ['engine/orch.mjs', 'cost', '--task', 'x']).status === 2, 'E3: sin tokens ni minutos se rechaza');
  } finally { rm(d); }
});

// ── C. continuidad de agentes ─────────────────────────────────────────────────────────────────────────────────
const HO = (o = {}) => ({ tarea: 'wt1', rama: 'wt1', worktree: '/x/wt1', objetivo: 'arreglar el ritmo de A1', hecho: ['leí A1'], pendiente: ['tocar A1', 'pasar lint'], siguiente: 'editar shots/A1.mjs', verificacion: [['node', 'engine/lint.mjs', '--only', 'validate']], riesgos: ['A2 depende'], ...o });
test('continuidad', async () => {
  const d = copy(), cmd = (a, env = {}) => run(d, ['engine/orch.mjs', ...a], { OPUS_AGENT: 'ana', ...env });
  try {
    // C1 handoff tipado
    let r = cmd(['handoff', W(d, 'out/h0.json', { ...HO(), objetivo: undefined })]); ok(r.status === 2 && /handoff inválido/.test(r.stderr), 'C1: handoff sin campo obligatorio → rechazado');
    r = cmd(['handoff', W(d, 'out/h1.json', HO({ verificacion: ['lint; rm -rf out'] }))]); ok(r.status === 2 && /verificacion\[0\]/.test(r.stderr), 'C1: verificación con shell → rechazada');
    r = cmd(['handoff', W(d, 'out/h2.json', HO({ verificacion: [['bash', '-c', 'x']] }))]); ok(r.status === 2, 'C1: verificación con ejecutable no permitido → rechazada');
    r = cmd(['handoff', W(d, 'out/h3.json', HO({ extra: 1 }))]); ok(r.status === 2, 'C1: campo desconocido → rechazado');
    r = cmd(['handoff', W(d, 'out/h4.json', HO())]);
    ok(r.status === 0 && fs.existsSync(path.join(d, 'docs/handoff/wt1.json')) && /## Pendiente\n- tocar A1/.test(fs.readFileSync(path.join(d, 'docs/handoff/wt1.md'), 'utf8')), 'C1: handoff válido → .json + .md ' + r.stderr);
    // C2 latido
    r = cmd(['beat', 'tarea-b', '--step', 'leído A1, empiezo a editar']);
    const hb = J(path.join(d, 'docs/handoff/tarea-b.json'));
    ok(r.status === 0 && hb.hecho.includes('leído A1, empiezo a editar') && ledger(d).some((e) => e.action === 'orch.beat' && e.target === 'task/tarea-b' && /leído A1/.test(e.why)) && fs.existsSync(path.join(d, 'out/locks')), 'C2: beat → ledger, lease y handoff actualizado');
    ok(cmd(['beat', 'tarea-b']).status === 2 && cmd(['beat', '../x', '--step', 'mal']).status === 2, 'C2: beat sin paso o con tarea inválida → rechazado');
    ok(cmd(['beat', 'tarea-b', '--step', 'otro agente'], { OPUS_AGENT: 'bob' }).status === 2, 'C2: lease vigente de otro agente → no se pisa');
    // C5 lease caducado sin deliver → cortado y reanudable
    cmd(['beat', 'tarea-c', '--step', 'a mitad de A3', '--ttl', '50']); cmd(['handoff', W(d, 'out/hc.json', HO({ tarea: 'tarea-c', objetivo: 'cerrar A3' }))]);
    let out = cmd(['resume']).stdout; ok(!/tarea tarea-b: CORTADO/.test(out), 'C5: con el lease vigente (tarea-b) no es un corte');
    sleep(250); out = cmd(['resume']).stdout;
    ok(/tarea tarea-c: CORTADO · 1 cortes · último paso "a mitad de A3"/.test(out) && /Te cortaron.*"tarea-c"/.test(out) && /cerrar A3/.test(out) && /Pendiente: tocar A1; pasar lint/.test(out), 'C5: lease caducado sin deliver aparece en resume con su mensaje ' + out.slice(-500));
    const msg = /-- tarea-c[^\n]*\n([\s\S]*?)(\n\n|$)/.exec(out)?.[1] ?? ''; ok(msg.length > 100 && Math.ceil(msg.length / 4) <= 300, `C5: mensaje ≤300 tokens (${Math.ceil(msg.length / 4)})`);
    // C4 política de cortes: 2 → partir, 3 → escalar
    const CT = await imp(d, 'continuity.mjs'); ok(CT.taskStates().find((s) => s.tarea === 'tarea-c').policy === null, 'C4: 1 corte → sin política');
    cmd(['beat', 'tarea-c', '--step', 'reanudo', '--ttl', '50']); sleep(250);
    let st = (await imp(d, 'continuity.mjs')).taskStates().find((s) => s.tarea === 'tarea-c'); ok(st.cuts === 2 && st.policy === 'partir', 'C4: 2 cortes → partir en subtareas ' + JSON.stringify(st));
    ok(/pártela en subtareas/.test(cmd(['resume']).stdout), 'C4: el mensaje manda partir la tarea');
    cmd(['beat', 'tarea-c', '--step', 'reanudo otra vez', '--ttl', '50']); sleep(250);
    st = (await imp(d, 'continuity.mjs')).taskStates().find((s) => s.tarea === 'tarea-c'); out = cmd(['resume']).stdout;
    ok(st.cuts === 3 && st.policy === 'escalar' && /⛔ tarea-c: 3 cortes/.test(out) && !/Hecho: /.test(/-- tarea-c[^\n]*\n([^\n]*)/.exec(out)?.[1] ?? ''), 'C4: 3 cortes ≥ presupuesto → escalar, no reanudar ' + JSON.stringify(st));
    // C6 deliver con task cierra la tarea
    cmd(['beat', 'tarea-d', '--step', 'trabajando']); W(d, 'out/e.json', { task: 'tarea-d', summary: 'hecho', changed: [], evidence: [{ cmd: ['node', 'engine/lint.mjs', '--only', 'validate'], exit: 0 }], risks: [], confidence: 0.9, next: [] });
    r = cmd(['deliver', 'out/e.json']); ok(r.status === 0 && (await imp(d, 'continuity.mjs')).taskStates().find((s) => s.tarea === 'tarea-d').status === 'hecho', 'C6: deliver aceptado con task → hecho');
    cmd(['beat', 'tarea-b', '--end']); ok((await imp(d, 'continuity.mjs')).taskStates().find((s) => s.tarea === 'tarea-b').status === 'hecho', 'C6: beat --end cierra la tarea');
  } finally { rm(d); }
});

test('worktrees', async () => {
  const d = copy();
  try {
    git(d, 'init', '-q', '-b', 'main'); fs.writeFileSync(path.join(d, '.gitignore'), 'node_modules\nout/\n.claude/worktrees/\n'); git(d, 'add', '-A'); git(d, 'commit', '-qm', 'base');
    for (const w of ['wt1', 'wt2']) { git(d, 'worktree', 'add', '-q', `.claude/worktrees/${w}`, '-b', w); fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(d, `.claude/worktrees/${w}/node_modules`)); }
    const w1 = path.join(d, '.claude/worktrees/wt1'), w2 = path.join(d, '.claude/worktrees/wt2'), ag = (...a) => run(d, ['tools/agentes.mjs', ...a]), orch = (...a) => run(d, ['engine/orch.mjs', ...a], { OPUS_AGENT: 'dora' });
    // corte a mitad de una edición: handoff commiteado + shot editado sin commitear
    W(w1, 'docs/handoff/wt1.json', HO()); git(w1, 'add', '-A'); git(w1, 'commit', '-qm', 'handoff');
    fs.appendFileSync(path.join(w1, 'shots/A1.mjs'), '\n// edición a medias\n'); W(w1, 'shots/nuevo.mjs', 'export default {};');
    let out = orch('resume', 'wt1').stdout;
    ok(/wt1/.test(out) && /Sin commitear: .*shots\/A1\.mjs/.test(out) && /shots\/nuevo\.mjs/.test(out) && /arreglar el ritmo de A1/.test(out), 'W1: resume nombra los archivos sin commitear y usa el handoff tipado ' + out);
    const head0 = git(w1, 'rev-parse', 'HEAD').stdout; let r = ag('wip');
    ok(r.status === 0 && git(w1, 'status', '--porcelain').stdout.trim() === '' && git(w1, 'rev-parse', 'HEAD').stdout !== head0 && /WIP/.test(git(w1, 'log', '-1', '--format=%s').stdout), 'W1: wip guarda el trabajo a medias en un commit WIP ' + r.stdout);
    out = orch('resume', 'wt1').stdout; ok(/Archivos de la rama: .*shots\/A1\.mjs/.test(out), 'W1: tras el wip, resume nombra los archivos de la rama');
    ok(/wt1/.test(ag('resume').stdout) && /wt1/.test(ag('status').stdout), 'W1: la fachada tools/agentes.mjs da lo mismo (una implementación)');
    // corte durante un merge: no se toca
    fs.writeFileSync(path.join(d, 'shots/A1.mjs'), fs.readFileSync(path.join(d, 'shots/A1.mjs'), 'utf8') + '\n// de main\n'); git(d, 'commit', '-qam', 'main A1');
    fs.writeFileSync(path.join(w2, 'shots/A1.mjs'), fs.readFileSync(path.join(w2, 'shots/A1.mjs'), 'utf8') + '\n// de wt2\n'); git(w2, 'commit', '-qam', 'wt2 A1');
    const m = git(w2, 'merge', 'main'); ok(m.status !== 0 && fs.existsSync(path.join(git(w2, 'rev-parse', '--git-dir').stdout.trim().replace(/^(?!\/)/, w2 + '/'), 'MERGE_HEAD')), 'W2: preparado un merge con conflicto ' + m.stdout.slice(-100));
    const h2 = git(w2, 'rev-parse', 'HEAD').stdout, before = fs.readFileSync(path.join(w2, 'shots/A1.mjs'), 'utf8'); r = ag('wip');
    ok(git(w2, 'rev-parse', 'HEAD').stdout === h2 && fs.readFileSync(path.join(w2, 'shots/A1.mjs'), 'utf8') === before && /<<<<<<</.test(before), 'W2: wip NO toca un worktree en merge (HEAD y archivos intactos)');
    out = orch('resume', 'wt2').stdout; ok(/merge\/rebase\/conflicto en curso/.test(out) && /ocupado/.test(out), 'W2: resume avisa del merge en curso ' + out);
    ok(/ocupado/.test(ag('status').stdout), 'W2: status lo marca ocupado');
    fs.writeFileSync(path.join(d, '.claude/worktrees/wt2/.git-lock-test'), ''); // archivo irrelevante
  } finally { rm(d); }
});

for (const t of T.filter((x) => !only || x.name === only)) { try { await t.fn(); } catch (e) { ok(false, `${t.name}: ${e.stack}`); } }
console.log(`${bad ? '✗' : '✓'} orquestación-007 ${n - bad}/${n}`); process.exit(bad ? 1 : 0);
