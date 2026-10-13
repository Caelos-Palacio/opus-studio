#!/usr/bin/env node
// Suite de regresión del propio verificador: cada mutación rompe el contrato y el lint DEBE detectarla.
// Corre en copias temporales mínimas del repo (node_modules enlazado): nunca toca tus archivos.
//   npm test                   perfil QUICK (por defecto, < 240 s en una máquina de 12 núcleos): TODAS las suites con fixtures reducidas
//   npm test -- --full         perfil FULL (= npm run test:nightly): todo, incl. renders pesados. OBLIGATORIO antes de integrar a main
//   npm test -- --fast         perfil FAST (iterar): unidades + golden + cada mutación con solo la etapa del lint que la detecta; sin fixture ni cut
//   npm test -- --only nombre  una sola suite o mutación (nombres: test/suites.mjs y MUT)   ·   --jobs N  tareas en paralelo   ·   --times  tabla de tiempos por tarea
// Qué pierde cada perfil (detalle en docs/handoff/deuda2.md): ver SUITES (test/suites.mjs, columna args/skip) y los `FULL` de cada suite.
// Las tareas corren en paralelo con límite de CPU (--jobs, por defecto nº de CPUs); la salida sale en orden fijo.
// Aislamiento: la suite NUNCA lee tu film fijado (out/.film → OPUS_USE_FILE a una ruta inexistente) ni OPUS_TIMELINE heredado.
import '../engine/summary.mjs';   // T2: modo agente = solo ✗ y el total
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, CPUS, copyRepo, rmrf, run, pool } from './lib.mjs';
import { SUITES } from './suites.mjs';

const argv = process.argv.slice(2), has = (k) => argv.includes(k), arg = (k) => (has(k) ? argv[argv.indexOf(k) + 1] : null);
const PROFILE = has('--full') ? 'full' : has('--fast') ? 'fast' : (arg('--profile') ?? 'quick');
if (!['fast', 'quick', 'full'].includes(PROFILE)) { console.error(`perfil «${PROFILE}» desconocido (fast | quick | full)`); process.exit(2); }
delete process.env.OPUS_TIMELINE;                 // film activo del usuario: fuera. Los tests pasan el suyo explícito.
process.env.OPUS_TEST_PROFILE = PROFILE;          // lo heredan todas las suites (test/lib.mjs: PROFILE, FULL)
const only = arg('--only'), fast = PROFILE === 'fast', full = PROFILE === 'full', stageOnly = !full, jobs = Math.max(1, +(arg('--jobs') ?? CPUS));
const inject = (code) => (src) => src.replace(/api\.text\(shot\.text,/, `${code} api.text(shot.text,`);
// quick: etapa del lint que basta para detectarla en modo --fast (la suite completa corre siempre el lint entero).
const MUT = [
  { name: 'base-ship', file: null, expect: { verdict: 'SHIP' }, quick: 'layout' },
  { name: 'impact-sin-pop', file: 'shots/A2.mjs', edit: inject("api.impact(1, { frames: 2, mode: 'invert' });"), expect: { nowarn: /pop:/ }, quick: 'motion' },   // deuda F3: un impact declarado no es un pop
  // deuda 3: TeX generado por el shot (una cadena por década, no literal) se compila en el servicio síncrono del motor, fuera del sandbox del shot.
  { name: 'tex-dinamico', file: 'shots/A2.mjs', edit: inject("{ const dec = 4200 + Math.floor(t * 2); api.tex(String.raw`\\approx 10^{${dec}}\\,\\mathrm{m}`, 640, 120, { size: 40 }); }"), expect: { verdict: 'SHIP', nofix: /sandbox|process/ }, quick: 'validate' },
  { name: 'math-random', file: 'shots/A2.mjs', edit: inject("ctx.fillStyle='#f00'; ctx.fillRect(50+Math.random()*30,50,20,20);"), expect: { fix: /Math\.random en shots\/A2/ }, quick: 'validate' },
  { name: 'estado-global', file: 'shots/A2.mjs', edit: (s) => inject("ctx.fillStyle='#f00'; ctx.fillRect(50+(n++%2)*30,50,20,20);")(s.replace('export default {', 'let n = 0;\nexport default {')), expect: { fix: /no determinista en este shot/, shot: 'A2' }, quick: 'determinism' },
  { name: 'filltext-crudo', file: 'shots/A2.mjs', edit: inject("ctx.font='8px sans-serif'; ctx.fillStyle='#000'; ctx['fill'+'Text']('OCULTO', 300, 300);"), expect: { fix: /ctx\.fillText/ }, quick: 'layout' },
  { name: 'settransform', file: 'shots/A2.mjs', edit: inject("ctx.save(); ctx['set'+'Transform'](1,0,0,1,0,0); ctx.restore();"), expect: { fix: /setTransform/ }, quick: 'layout' },
  { name: 'fuga-transform', file: 'shots/A2.mjs', edit: inject('ctx.translate(3,0);'), expect: { fix: /fuga de transform/ }, quick: 'layout' },
  { name: 'sin-foco', file: 'shots/A1.mjs', edit: (s) => s.replace(/api\.morph\([^;]*\);/, "ctx.fillStyle=api.color('ink'); ctx.beginPath(); ctx.arc(d.x,d.y,d.s/2,0,6.28); ctx.fill();"), expect: { fix: /no registra ningún foco/, shot: 'A1' }, quick: 'layout' },
  { name: 'camara-falsa', file: 'shots/A2.mjs', edit: (s) => s.replace("api.glow(d.x", "ctx.save(); const zz = 1 + 0.4 * u; ctx.translate(640,360); ctx.scale(zz,zz); ctx.translate(-640,-360); for (let q = 0; q < 10; q++) { ctx.fillStyle = api.color('shade'); ctx.fillRect(100 + q * 90, 600, 30, 30); } ctx.restore(); api.glow(d.x"), expect: { warn: /cámara falsa/ }, quick: 'layout' },
  // E7: evasiones de la guardia (AST + sandbox). Todas FIX; en ejecución el sandbox las bloquea sin tumbar el lint.
  { name: 'eval', file: 'shots/A2.mjs', edit: inject("eval('0');"), expect: { fix: /^eval en shots\/A2/ }, quick: 'validate' },
  { name: 'new-function', file: 'shots/A2.mjs', edit: inject("new Function('return 0')();"), expect: { fix: /Function \(código desde string\) en shots\/A2/ }, quick: 'validate' },
  { name: 'import-fs', file: 'shots/A2.mjs', edit: (s) => "import fs from 'node:fs';\n" + s, expect: { fix: /import prohibido 'node:fs' en shots\/A2/ }, quick: 'validate' },
  { name: 'globalthis-comp', file: 'shots/A2.mjs', edit: inject("globalThis['ev'+'al']('0');"), expect: { fix: /globalThis en shots\/A2/ }, quick: 'validate' },
  { name: 'alias-eval', file: 'shots/A2.mjs', edit: (s) => inject("E('0');")(s.replace('export default {', 'const E = eval;\nexport default {')), expect: { fix: /eval \(alias E\) en shots\/A2/ }, quick: 'validate' },
  { name: 'estado-indentado', file: 'shots/A2.mjs', edit: (s) => inject('n++;')(s.replace('export default {', '    let n = 0;\nexport default {')), expect: { fix: /estado de módulo mutable reasignado/, shot: 'A2' }, quick: 'validate' },
  { name: 'texto-fuera', file: 'shots/A3.mjs', edit: (s) => s.replace(/("\$shot": "text"\s*\},\s*"x": )\{\s*"\$expr": "dot_x"\s*\}/, '$1 20'), expect: { fix: /fuera de safe area/ }, quick: 'layout' },
];
const sel = (name) => !only || only === name;

async function mutation(m) {
  const d = copyRepo(), lint = ['engine/lint.mjs', ...(stageOnly ? ['--only', m.quick] : [])];
  try {
    if (m.file) { const f = path.join(d, m.file), a = fs.readFileSync(f, 'utf8'), b = m.edit(a); if (a === b) throw new Error('la mutación no se aplicó'); fs.writeFileSync(f, b); }
    const r = await run(lint, { cwd: d, timeout: 300000 }), lf = path.join(d, stageOnly ? `out/lint/main/_only-${m.quick}.json` : 'out/lint.json');   // --only nunca escribe el global (F1)
    if (!fs.existsSync(lf)) throw new Error('lint no escribió out/lint.json: ' + (r.stderr || r.stdout).slice(-400));
    const L = JSON.parse(fs.readFileSync(lf, 'utf8')), e = m.expect, fx = L.issues.filter((i) => i.level === 'FIX'), wn = L.issues.filter((i) => i.level === 'WARN');
    let ok = true;
    if (e.verdict) ok &&= L.verdict === (stageOnly && e.verdict === 'SHIP' ? 'PASS' : e.verdict);
    if (e.fix) ok &&= fx.some((i) => e.fix.test(i.problem) && (!e.shot || i.shot === e.shot));
    if (e.warn) ok &&= wn.some((i) => e.warn.test(i.problem));
    if (e.nofix) ok &&= !fx.some((i) => e.nofix.test(i.problem));
    if (e.nowarn) ok &&= !wn.some((i) => e.nowarn.test(i.problem));
    return { ok, line: `${ok ? '✓' : '✗'} ${m.name.padEnd(16)} ${L.verdict}${stageOnly ? `  (lint --only ${m.quick})` : ''}  ${ok ? '' : r.stdout.split('\n').slice(-12).join('\n   ')}` };
  } catch (err) { return { ok: false, line: `✗ ${m.name}: ${err.message}` }; }
  finally { rmrf(d); }
}

// Integración: el fixture showcase ejercita TeX+morph semántico, scene graph+constraints+fps por nodo, 2.5D/DOF, capas fx,
// partículas, campos, grafo, globo, card3d y autocámara. Debe dar SHIP. (Es un fixture de prueba, no contenido del estudio.)
async function fixture() {
  const d = copyRepo({ fixture: path.join(ROOT, 'test/fixtures/showcase') }), env = { OPUS_TIMELINE: 'data/fixture.json' };
  try {
    await run(['engine/autocam.mjs'], { cwd: d, env });
    await run(['engine/lint.mjs'], { cwd: d, env, timeout: 900000 });
    const L = JSON.parse(fs.readFileSync(path.join(d, 'out/lint.json'), 'utf8')), ok = L.verdict === 'SHIP';
    return { ok, line: `${ok ? '✓' : '✗'} fixture-v4       ${L.verdict}  ${ok ? '' : L.issues.filter((i) => i.level === 'FIX').map((i) => i.shot + ' ' + i.problem).join(' | ')}` };
  } catch (err) { return { ok: false, line: `✗ fixture-v4: ${err.message}` }; }
  finally { rmrf(d); }
}
// Scripts autónomos (imprimen sus propias líneas ✓/✗; el código de salida decide).
const script = (file, args = [], { stderr = true, timeout } = {}) => async () => { const r = await run([path.join(ROOT, file), ...args], timeout ? { timeout } : {}); return { ok: r.status === 0, line: (r.stdout + (stderr || r.status ? r.stderr : '')).trimEnd() }; };

// Suites del manifiesto (test/suites.mjs) + drop-ins test/suites.d/*.json (una suite por archivo, sin conflictos de merge entre ramas).
const dropins = fs.existsSync(path.join(ROOT, 'test/suites.d')) ? fs.readdirSync(path.join(ROOT, 'test/suites.d')).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'test/suites.d', f), 'utf8'))) : [];
const ALL = [...SUITES, ...dropins], names = ALL.map((x) => x.name);
if (new Set(names).size !== names.length) { console.error('suites duplicadas en el manifiesto: ' + names.filter((n, i) => names.indexOf(n) !== i).join(', ')); process.exit(2); }
const argsFor = (S) => (Array.isArray(S.args) ? S.args : S.args?.[PROFILE] ?? []);
const timed = (name, fn) => async () => { const t = Date.now(), r = await fn(); r.name = name; r.ms = Date.now() - t; return r; };
const t0 = Date.now(), P = pool(jobs), plan = [];   // plan = [{ w, name, fn }]: se encola por peso (lo pesado primero), la salida sigue ese mismo orden fijo
for (const m of MUT) if (sel(m.name) && (!fast || m.quick)) plan.push({ w: full ? 3 : 2, name: 'mut:' + m.name, fn: () => mutation(m) });
if (!fast && sel('fixture')) plan.push({ w: 6, name: 'fixture', fn: fixture });
for (const S of ALL) if (sel(S.name) && !S.skip?.includes(PROFILE)) plan.push({ w: S.w ?? 1, name: S.name, fn: script(S.file, argsFor(S), { stderr: S.stderr !== false, timeout: S.timeout }) });
const tasks = plan.map((p, i) => ({ ...p, i })).sort((a, b) => b.w - a.w || a.i - b.i).map((p) => P(timed(p.name, p.fn)));
let fail = 0;
for (const t of tasks) { const r = await t; console.log(r.line); if (!r.ok) fail++; }
const secs = (ms) => (ms / 1000).toFixed(1);
if (has('--times')) { console.log('\ntiempos por tarea (reloj de pared dentro del pool, no CPU):'); for (const r of (await Promise.all(tasks)).sort((a, b) => b.ms - a.ms)) console.log(`  ${secs(r.ms).padStart(7)} s  ${r.name}`); }
console.log(`\n${fail ? `${fail} fallos` : 'Todo verde'}  (${secs(Date.now() - t0)} s, ${jobs} en paralelo, perfil ${PROFILE})`);
try { fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'out/tests.json'), JSON.stringify({ ts: new Date().toISOString(), fail, fast, profile: PROFILE, only })); } catch {}   // lo lee engine/status.mjs (STATUS.md)
process.exit(fail ? 1 : 0);
