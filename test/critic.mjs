#!/usr/bin/env node
// E4: crítico honesto. Cliente simulado (sin red): fail-closed, voto N≥3, caché con clave completa, veredicto manual con
// esquema, compuerta de lint y set dorado. Unidades puras + extremo a extremo en una copia temporal (critic.mjs real).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { judge, cacheKey, checkVerdict, verdictOf, lintGate, scoreEval, RUBRIC, RESPONSE_SCHEMA, COHERENCE_SCHEMA } from '../engine/critic.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let fail = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? '✓' : '✗'} critic: ${name}${cond ? '' : '  ' + extra}`); if (!cond) fail++; };
const S = (v = 4) => Object.fromEntries(Object.keys(RUBRIC).map((k) => [k, v]));
const good = (sev = null, v = 4) => ({ scores: S(v), issues: sev ? [{ t: 1, severity: sev, problem: 'p', fix: 'f' }] : [] });
const seq = (...xs) => { let i = 0; return async () => { const x = xs[i++ % xs.length]; if (x instanceof Error) throw x; return typeof x === 'function' ? x() : structuredClone(x); }; };
const J = (client, o = {}) => judge(client, { model: 'm', prompt: 'p', n: 3, retries: 0, ...o });

// 1) Fail-closed.
let r = await J(seq(new Error('red')));
ok('todas las respuestas fallan → FIX (nunca SHIP)', r.verdict === 'FIX' && r.invalid === 3 && r.issues.some((i) => i.severity === 'FIX' && /3\/3 respuestas inválidas/.test(i.problem)), JSON.stringify(r));
r = await J(seq({ scores: { framing: 9 }, issues: 'x' }));
ok('respuestas fuera de esquema → FIX', r.verdict === 'FIX' && r.invalid === 3 && /fuera de esquema/.test(r.samples[0].error));
r = await J(seq({ ...good(), extra: 1 }));
ok('campo extra en la respuesta = inválida', r.verdict === 'FIX' && r.invalid === 3);
r = await J(seq({ scores: S(7), issues: [] }));
ok('puntuación fuera de 1–5 = inválida', r.verdict === 'FIX');
r = await J(seq(good(), new Error('x'), new Error('y')));
ok('1 SHIP + 2 inválidas → FIX', r.verdict === 'FIX' && r.invalid === 2);
r = await J(seq(good(), good(), new Error('x')));
ok('2 SHIP + 1 inválida → SHIP con aviso visible', r.verdict === 'SHIP' && r.issues.some((i) => i.severity === 'WARN' && /1\/3/.test(i.problem)));
r = await J(seq(new Error('x'), good()), { retries: 1, n: 1 });
ok('reintento recupera una muestra transitoria', r.verdict === 'SHIP' && r.invalid === 0);

// 2) Voto y mediana.
r = await J(seq(good('FIX', 2), good('FIX', 3), good(null, 5)));
ok('2 FIX / 1 SHIP → FIX, mediana de puntuaciones', r.verdict === 'FIX' && r.scores.framing === 3 && Math.abs(r.agreement - 2 / 3) < 1e-3 && r.issues.length === 1);
r = await J(seq(good(null, 4), good(null, 5), good('FIX', 1)));
ok('2 SHIP / 1 FIX → SHIP, representante sin issues', r.verdict === 'SHIP' && r.scores.clarity === 4 && r.issues.length === 0);
r = await J(seq(good(), good('FIX')), { n: 2 });
ok('empate (n par) → FIX', r.verdict === 'FIX');
r = await J(seq(good('WARN')));
ok('solo WARN → SHIP', r.verdict === 'SHIP' && r.issues.length === 1);

// 3) Coherencia: su fallo no se traga.
r = await J(seq(new Error('timeout')), { schema: COHERENCE_SCHEMA, label: 'coherencia' });
ok('coherencia que falla → FIX', r.verdict === 'FIX' && /coherencia/.test(r.issues[0].problem));
r = await J(seq({ issues: [{ t: 1, severity: 'FIX', problem: 'p', fix: 'f' }] }), { schema: COHERENCE_SCHEMA });
ok('coherencia sin "shot" en el issue = inválida', r.invalid === 3 && r.verdict === 'FIX');

// 4) Caché: la clave cambia con cualquier ingrediente.
const k0 = { model: 'm', prompt: 'p', plan: 'h', n: 3 }, key = cacheKey(k0);
ok('clave estable', key === cacheKey({ ...k0 }));
ok('caché invalidada al cambiar rúbrica', key !== cacheKey({ ...k0, rubric: { ...RUBRIC, clarity: RUBRIC.clarity + '.' } }));
ok('… modelo, prompt, plan, N, esquema, sistema', [{ model: 'm2' }, { prompt: 'p2' }, { plan: 'h2' }, { n: 5 }, { schema: COHERENCE_SCHEMA }, { system: 's' }].every((d) => cacheKey({ ...k0, ...d }) !== key));
ok('esquema por defecto = el de respuesta', cacheKey({ ...k0, schema: RESPONSE_SCHEMA }) === key);

// 5) Veredicto manual/externo con esquema.
const V = { plan: 'P', reviewer: 'agente-vision', shots: [{ shot: 'A1', ...good() }, { shot: 'A2', ...good('FIX') }], coherence: { issues: [] } };
let c = checkVerdict(V, { plan: 'P', shots: ['A1', 'A2'] });
ok('veredicto manual válido → FIX si algún shot tiene FIX', c.ok && verdictOf(V) === 'FIX', c.errors?.join());
ok('veredicto manual sin FIX → SHIP', verdictOf({ ...V, shots: [V.shots[0]] }) === 'SHIP');
ok('plan de otra versión → inválido', !checkVerdict(V, { plan: 'Q', shots: ['A1', 'A2'] }).ok);
ok('falta un shot → inválido', !checkVerdict(V, { plan: 'P', shots: ['A1', 'A2', 'A3'] }).ok);
c = checkVerdict({ ...V, shots: [{ shot: 'A1', scores: S(), issues: [{ t: 0, severity: 'BLOCKER', problem: 'p', fix: 'f' }] }] }, { plan: 'P', shots: ['A1'] });
ok('severidad fuera del enum → inválido con ruta', !c.ok && /\/shots\/0\/issues\/0\/severity/.test(c.errors[0]), c.errors?.join());

// 6) Compuerta de lint.
{
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'opus-gate-')), w = (p, x) => { fs.mkdirSync(path.dirname(path.join(d, p)), { recursive: true }); fs.writeFileSync(path.join(d, p), typeof x === 'string' ? x : JSON.stringify(x)); };
  try {
    w('data/timeline.json', '{}');
    ok('sin lint.json → no corre', !lintGate(d, 'data/timeline.json').ok);
    w('out/lint.json', { verdict: 'FIX', issues: [{ level: 'FIX' }] });
    ok('lint en FIX → no corre', /FIX/.test(lintGate(d, 'data/timeline.json').reason ?? ''));
    w('out/lint.json', { verdict: 'SHIP', issues: [] });
    ok('lint SHIP vigente → corre', lintGate(d, 'data/timeline.json').ok);
    const later = new Date(Date.now() + 5000); fs.utimesSync(path.join(d, 'data/timeline.json'), later, later);
    ok('timeline más nuevo que el lint → caducado', /caducado/.test(lintGate(d, 'data/timeline.json').reason ?? ''));
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
}

// 7) Métricas del set dorado.
const E = scoreEval([{ expect: 'FIX', verdict: 'FIX', rubric: ['framing'], scores: S(2), agreement: 1 }, { expect: 'FIX', verdict: 'SHIP', rubric: ['clarity'], scores: S(4), agreement: 2 / 3 }, { expect: 'SHIP', verdict: 'SHIP', agreement: 1 }]);
ok('scoreEval: recall, especificidad, rúbrica, estabilidad', E.recall === 0.5 && E.specificity === 1 && E.rubricHit === 0.5 && Math.abs(E.stability - 0.889) < 1e-3, JSON.stringify(E));
const cases = JSON.parse(fs.readFileSync(path.join(ROOT, 'test/critic-golden/cases.json'), 'utf8'));
ok('set dorado: buenos y defectos con módulo existente', cases.some((x) => x.expect === 'SHIP') && cases.filter((x) => x.expect === 'FIX').length >= 4 && cases.every((x) => !x.module || fs.existsSync(path.join(ROOT, 'test/critic-golden', x.module))));

// 8) Extremo a extremo: critic.mjs real sobre una copia, cliente simulado.
{
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'opus-critic-'));
  for (const e of fs.readdirSync(ROOT)) if (!['node_modules', 'out', '.git'].includes(e)) fs.cpSync(path.join(ROOT, e), path.join(d, e), { recursive: true });
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(d, 'node_modules'));
  const lint = (verdict) => { fs.mkdirSync(path.join(d, 'out'), { recursive: true }); fs.writeFileSync(path.join(d, 'out/lint.json'), JSON.stringify({ verdict, issues: [] })); };
  const run = (args, mock) => spawnSync(process.execPath, ['engine/critic.mjs', ...args], { cwd: d, encoding: 'utf8', timeout: 300000, env: { ...process.env, ANTHROPIC_API_KEY: '', OPUS_CRITIC_CLIENT: 'test/critic-golden/mock-client.mjs', OPUS_MOCK: mock ?? 'ship' } });
  try {
    lint('FIX'); let p = run(['--api']);
    ok('e2e: lint en FIX → exit 2, no juzga', p.status === 2 && /NO CORRE/.test(p.stderr), p.stdout + p.stderr);
    lint('SHIP'); p = run(['--api'], 'invalid');
    ok('e2e: respuestas inválidas → CRITIC FIX exit 1', p.status === 1 && /CRITIC FIX/.test(p.stdout) && !/CRITIC SHIP/.test(p.stdout), p.stdout.slice(-500) + p.stderr);
    p = run(['--api'], 'throw');
    ok('e2e: API caída → FIX (y lo inválido no se cachea)', p.status === 1 && !/\(caché\)/.test(p.stdout));
    p = run(['--api'], 'ship');
    ok('e2e: 3 muestras SHIP → CRITIC SHIP exit 0', p.status === 0 && /CRITIC SHIP/.test(p.stdout), p.stdout.slice(-500) + p.stderr);
    p = run(['--api'], 'fix');
    ok('e2e: misma clave → caché (el cliente no se consulta)', p.status === 0 && (p.stdout.match(/\(caché\)/g) ?? []).length === 3, p.stdout.slice(-500));
    const cf = path.join(d, 'engine/critic.mjs'); fs.writeFileSync(cf, fs.readFileSync(cf, 'utf8').replace("clarity: 'se entiende sin sonido", "clarity: 'se entiende SIN sonido"));
    p = run(['--api'], 'fix');
    ok('e2e: rúbrica cambiada → caché invalidada, nuevo juicio', p.status === 1 && !/\(caché\)/.test(p.stdout) && /CRITIC FIX/.test(p.stdout), p.stdout.slice(-500));
    const vf = path.join(d, 'out/review/main/verdict.json'); fs.rmSync(vf, { force: true });
    p = run([]);
    ok('e2e: sin --api ni veredicto → pendiente (exit 3), no SHIP', p.status === 3 && /PENDIENTE/.test(p.stdout), p.stdout.slice(-300) + p.stderr);
    const plan = /plan: `([0-9a-f]+)`/.exec(fs.readFileSync(path.join(d, 'out/review/main/packet.md'), 'utf8'))?.[1];
    const mv = (x) => { fs.writeFileSync(path.join(d, 'v.json'), JSON.stringify(x)); return run(['--verdict', 'v.json']); };
    p = mv({ plan, shots: [{ shot: 'A1', ...good() }] });
    ok('e2e: veredicto manual incompleto → FIX exit 1', p.status === 1 && /falta el shot A2/.test(p.stdout), p.stdout.slice(-300));
    p = mv({ plan, reviewer: 'x', shots: ['A1', 'A2', 'A3'].map((shot) => ({ shot, ...good() })) });
    ok('e2e: veredicto manual válido → persistido, SHIP exit 0', p.status === 0 && fs.existsSync(vf) && JSON.parse(fs.readFileSync(vf, 'utf8')).source === 'manual', p.stdout.slice(-300));
    p = run([]);
    ok('e2e: sin --api con veredicto vigente → exit según veredicto', p.status === 0 && /CRITIC SHIP/.test(p.stdout), p.stdout.slice(-300));
    p = run(['--eval', '--n', '3'], 'fix');
    const ev = fs.existsSync(path.join(d, 'out/critic-eval.json')) ? JSON.parse(fs.readFileSync(path.join(d, 'out/critic-eval.json'), 'utf8')) : null;
    ok('e2e: --eval con cliente simulado mide recall/especificidad', p.status === 0 && ev?.recall === 1 && ev?.specificity === 0 && ev.cases === cases.length, p.stdout.slice(-400) + p.stderr);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
}

console.log(fail ? `critic: ${fail} fallos` : 'critic: ok');
process.exit(fail ? 1 : 0);
