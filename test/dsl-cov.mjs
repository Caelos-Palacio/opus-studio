#!/usr/bin/env node
// Spec 010 — DSL al ~80 %: cobertura (dsl coverage), goldens de píxeles contra el JS legado y rendimiento.
//   node test/dsl-cov.mjs [--fast]        tests (C1–C9)
//   node test/dsl-cov.mjs --worker <timeline> [ids,…]   (interno) sha de píxeles de cada shot en 6 instantes
//   node test/dsl-cov.mjs --gen            REGENERA test/fixtures/dsl-legacy/hashes.json (solo con el JS legado intacto)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ROOT, FONTS_CONF, run, FULL, PROFILE } from './lib.mjs';

export const FRACS = [0.02, 0.25, 0.4, 0.5, 0.75, 0.98];
export const FILMS = { demo: 'data/timeline.json', mate: 'data/mate/timeline.json', regla: 'data/regla/regla.json', potencias: 'data/stress/potencias.json', reel: 'data/reel/timeline.json' };
const HASHES = path.join(ROOT, 'test/fixtures/dsl-legacy/hashes.json');
const argv = process.argv.slice(2);

if (argv[0] === '--worker') {
  const { makeRenderer } = await import(pathToFileURL(path.join(process.cwd(), 'engine/render.mjs')).href);
  const R = await makeRenderer({}), only = argv[1] ? argv[1].split(',') : null, out = {}, tm = {};
  const perf = process.env.DSL_PERF ? Number(process.env.DSL_PERF) : 0;
  for (const s of R.film.shots) {
    if (only && !only.includes(s.id)) continue;
    const [a, b] = s.t; out[s.id] = {};   // en modo perf (C9) solo se cronometra: los hashes ya los comprueba C3
    if (!perf) for (const f of FRACS) { const t = a + (b - a) * f; R.frame(t); out[s.id][f] = crypto.createHash('sha256').update(R.ctx.getImageData(0, 0, R.W, R.H).data).digest('hex').slice(0, 20); }
    if (perf) { const ts = []; for (let r = 0; r < perf; r++) { const t0 = process.hrtime.bigint(); for (const f of FRACS) R.frame(a + (b - a) * f); ts.push(Number(process.hrtime.bigint() - t0) / 1e6 / FRACS.length); } ts.sort((x, y) => x - y); tm[s.id] = ts[Math.floor(ts.length / 2)]; }
  }
  process.stdout.write(JSON.stringify(perf ? { hashes: out, ms: tm } : out)); process.exit(0);
}
export const workerEnv = { FONTCONFIG_FILE: FONTS_CONF, OPUS_LAYERS: 'none' };
export async function renderFilm(film, { cwd = ROOT, ids, perf } = {}) {
  const r = await run([path.join(ROOT, 'test/dsl-cov.mjs'), '--worker', ...(ids ? [ids.join(',')] : [])], { cwd, env: { ...workerEnv, OPUS_TIMELINE: FILMS[film], ...(perf ? { DSL_PERF: String(perf) } : {}) } });
  if (r.status) throw new Error(`${film}: ${r.stderr.slice(-400)}`);
  return JSON.parse(r.stdout);
}
if (argv[0] === '--gen') {
  const H = fs.existsSync(HASHES) ? JSON.parse(fs.readFileSync(HASHES, 'utf8')) : {};
  for (const film of Object.keys(FILMS)) { const h = await renderFilm(film); Object.assign(H, h); console.log(`${film}: ${Object.keys(h).join(' ')}`); }
  fs.writeFileSync(HASHES, JSON.stringify(Object.fromEntries(Object.entries(H).sort(([a], [b]) => a.localeCompare(b))), null, 1) + '\n');
  process.exit(0);
}
export const refHashes = () => JSON.parse(fs.readFileSync(HASHES, 'utf8'));
export const dslShots = () => fs.readdirSync(path.join(ROOT, 'shots')).filter((f) => f.endsWith('.scene.json')).map((f) => f.replace('.scene.json', '')).filter((id) => /^\/\/ GENERADO/.test(fs.readFileSync(path.join(ROOT, 'shots', id + '.mjs'), 'utf8'))).sort();
if (argv[0] === '--check') {   // node test/dsl-cov.mjs --check [film|all] [id,id]  → compara los shots DSL con los hashes del JS legado
  const films = !argv[1] || argv[1] === 'all' ? Object.keys(FILMS) : [argv[1]], mine = dslShots(), H = refHashes(); let bad = 0, n = 0;
  for (const film of films) {
    const ids = (argv[2] ? argv[2].split(',') : mine), tl = JSON.parse(fs.readFileSync(path.join(ROOT, FILMS[film]), 'utf8')).shots.map((s) => s.id), want = ids.filter((i) => mine.includes(i) && tl.includes(i)); if (!want.length) continue;
    const got = await renderFilm(film, { ids: want });
    for (const id of want) { n++; const ok = JSON.stringify(got[id]) === JSON.stringify(H[id]); if (!ok) { bad++; console.log(`✗ ${id}: ${FRACS.filter((f) => got[id]?.[f] !== H[id]?.[f]).join(' ')}`); } else console.log(`✓ ${id}`); }
  }
  console.log(`${n} shots DSL, ${bad} difieren`); process.exit(bad ? 1 : 0);
}

// ══════════════════════════════════════ tests (C1–C9) ══════════════════════════════════════
const fast = argv.includes('--fast');
let fail = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? '✓' : '✗'} dsl-cov: ${name}${cond ? '' : '  ' + extra}`); if (!cond) fail++; };
const D = await import('../engine/dsl-core.mjs');
const CV = await import('../engine/dsl-coverage.mjs');
const clone = (x) => JSON.parse(JSON.stringify(x));
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dsl-coverage.json'), 'utf8'));

// ── C1: inventario determinista ──
{
  const a = await run([path.join(ROOT, 'engine/dsl.mjs'), 'coverage']), b = await run([path.join(ROOT, 'engine/dsl.mjs'), 'coverage']);
  const C = CV.coverage(ROOT), shotFiles = fs.readdirSync(path.join(ROOT, 'shots')).filter((f) => f.endsWith('.mjs') && /export default/.test(fs.readFileSync(path.join(ROOT, 'shots', f), 'utf8')));
  ok('C1 dsl coverage lista todos los shots con su clase y el %; dos ejecuciones dan el mismo texto', a.status === 0 && a.stdout === b.stdout && C.rows.length === shotFiles.length && C.rows.every((r) => a.stdout.includes(r.id.padEnd(12) + ' ' + r.cls)) && /\d+\.\d %/.test(a.stdout), a.stderr);
  ok('C1b pendientes de otra rama y escapes con razón declarados (data/dsl-coverage.json) y visibles; cada escape lleva razón', C.rows.filter((r) => r.cls.startsWith('pendiente:')).length === Object.keys(SPEC.pendiente).length && Object.values(SPEC.escape).every((r) => typeof r === 'string' && r.length > 10) && C.rows.filter((r) => r.cls === 'escape').length === Object.keys(SPEC.escape).length);
  ok('C1c custom cuenta como NO convertido', !C.rows.some((r) => r.cls === 'dsl' && r.via?.includes('custom')) && C.rows.filter((r) => r.cls === 'custom').every((r) => !r.counts));
}

// ── C2: tipos nuevos — schema con «¿quisiste decir…?», pureza y deps exactas ──
const NEW = ['curve', 'lines', 'repeat', 'formula', 'layer', 'smear', 'word', 'box', 'impact', 'particles', 'world3d', 'let', 'focusOf', 'ring', 'dot', 'shatter', 'cracks', 'gridlines', 'playhead', 'world', 'hud', 'caption', 'arrow'];
{
  const base = (o) => ({ dsl: 1, id: 'T', libs: { L: './L.mjs' }, params: { a: { type: 'number', default: 1 }, b: { type: 'number', default: 2 } }, objects: [o] });
  const good = { curve: { type: 'curve', n: 4, x: { $expr: 'i' }, y: { $expr: 'a' } }, lines: { type: 'lines', segs: [[0, 0, 1, 1]] }, repeat: { type: 'repeat', n: 2, children: [] }, formula: { type: 'formula', tex: 'x', x: 1, y: 1 },
    layer: { type: 'layer', children: [] }, smear: { type: 'smear', x: 1, y: 1, vx: 1, vy: 1, children: [] }, word: { type: 'word', lib: 'L', str: 'A', x: 1, y: 1, size: 9 }, box: { type: 'box', x: 1, y: 1, w: 1, h: 1 }, impact: { type: 'impact', at: 0 },
    particles: { type: 'particles', n: 3, seed: 1, x: 1, y: 1, r: 1 }, world3d: { type: 'world3d', scene: { objects: [] } }, let: { type: 'let', value: 1 }, focusOf: { type: 'focusOf', lib: 'L', fn: 'f' }, ring: { type: 'ring', lib: 'L', fn: 'f' }, dot: { type: 'dot', lib: 'L', fn: 'f' },
    shatter: { type: 'shatter', lib: 'L', fn: 'f' }, cracks: { type: 'cracks', lib: 'L', fn: 'f' }, gridlines: { type: 'gridlines', lib: 'L', fn: 'f' }, playhead: { type: 'playhead', lib: 'L', fn: 'f' }, world: { type: 'world', lib: 'L', fn: 'f' }, hud: { type: 'hud', lib: 'L', fn: 'f' }, caption: { type: 'caption', lib: 'L', fn: 'f' }, arrow: { type: 'arrow', x0: 0, y0: 0, x1: 1, y1: 1 } };
  const bad = [];
  for (const T of NEW) {
    const g = good[T], v = D.validateScene(base(g));
    if (v.length) { bad.push(`${T} válido da FIX: ${v[0].message}`); continue; }
    const prop = D.TYPES[T].props.find((p) => p in g) ?? D.TYPES[T].props[0], g2 = { ...g, [prop + 'z']: 1 }, m = D.validateScene(base(g2)).map((e) => e.path + ' ' + e.message + ' ' + e.remedy).join('|');
    if (!new RegExp(`/objects/0/${prop}z.*desconocida.*¿quisiste decir`).test(m)) bad.push(`${T}: sin sugerencia (${m})`);
    const miss = D.TYPES[T].req.find((r) => r in g); if (miss) { const g3 = { ...g }; delete g3[miss]; if (!D.validateScene(base(g3)).some((e) => e.path === `/objects/0/${miss}` || e.path === '/objects/0')) bad.push(`${T}: no exige ${miss}`); }
  }
  ok('C2a cada tipo nuevo: schema estricto con ruta y «¿quisiste decir…?», requeridas exigidas', !bad.length && NEW.every((T) => T in D.TYPES), bad.join('; '));
  // pureza: lienzo-espía; el mismo t da la misma secuencia de llamadas, también tras dibujar otros instantes
  const spy = (log) => new Proxy({}, { get: (_, k) => (k === 'getTransform' ? () => ({}) : (...a) => { log.push(k + JSON.stringify(a)); }), set: (_, k, v) => { log.push(k + '=' + v); return true; } });
  const mkApi = (log) => ({ params: { a: 1, b: 2 }, k: 1, dt: 0.04, safe: { x0: 0, x1: 100, y0: 0, y1: 50, w: 100, h: 50, cx: 50, cy: 25 }, color: (c) => c, spring: (x) => Math.min(1, Math.max(0, x)), at: (x, y) => [x, y], param: () => 0, text: (...a) => log.push('text' + JSON.stringify(a)), arrow: (...a) => log.push('arrow' + JSON.stringify(a)), focus: (...a) => log.push('focus' + JSON.stringify(a)), glow: (...a) => log.push('glow' + JSON.stringify(a)), morph: () => ({}), depth: (d, f) => f(), ground() {}, impact: (...a) => log.push('impact' + JSON.stringify(a)), smear: (x, y, vx, vy, f) => f(), layer: (o, f) => f(spy(log), 0, mkApi(log)), tex() {}, world3d: (sc, o) => log.push('w3d' + JSON.stringify([sc, { t: o.t, cam3: o.cam?.(3), mb: o.motionBlur }])), _box() {}, sizes: {} });
  const scene = { dsl: 1, id: 'PU', params: { a: { type: 'number', default: 1 }, b: { type: 'number', default: 2 } }, objects: [
    { id: 'c', type: 'curve', n: { $expr: '4' }, x: { $expr: 'i * a * 10' }, y: { $expr: 'lt * 5' }, color: 'ink' },
    { id: 'l', type: 'lines', segs: [[0, 0, { $expr: 'b * 10' }, 5]] },
    { id: 'r', type: 'repeat', n: { $expr: 'b' }, children: [{ type: 'text', text: 'x', x: { $expr: 'i * 10' }, y: { $expr: 'n' } }] },
    { id: 'p', type: 'particles', n: 4, seed: 7, x: { $expr: 'ra * 100' }, y: { $expr: 'rb * 50 + lt' }, r: { $expr: '1 + rc' } },
    { id: 'm', type: 'smear', x: 1, y: 2, vx: 3, vy: 4, children: [{ type: 'impact', at: 0, opts: { frames: 2 } }] }] };
  const mod = D.shot(clone(scene), {}), frame = (t) => { const log = []; mod.draw(spy(log), t, 0.5, { t: [0, 4], text: 'x' }, { width: 100, height: 50 }, mkApi(log)); return JSON.stringify(log); };
  const f1 = frame(1), f2 = frame(2), f1b = frame(1);
  ok('C2b pureza: mismo t → mismas llamadas (también tras otros instantes); distinto t → distinto', f1 === f1b && f1 !== f2 && f1.length > 50);
  const dep = Object.fromEntries(D.depsOf(scene).map((d) => [d.id, d]));
  ok('C2c deps exactas: curve lee a (y el tiempo); lines solo b y es estática; particles no lee params', dep.c.params.join() === 'a' && dep.c.time && dep.l.params.join() === 'b' && !dep.l.time && dep.p.params.length === 0 && dep.p.time, JSON.stringify([dep.c, dep.l, dep.p]));
  // C2d (spec 017): arrow nativo = api.arrow(x0,y0,x1,y1,{u,color,lw,head}); u/lw/head son expresiones; deps exactas
  { const sa = { dsl: 1, id: 'AR', params: { a: { type: 'number', default: 1 }, b: { type: 'number', default: 2 } }, objects: [{ id: 'f', type: 'arrow', x0: 1, y0: 2, x1: { $expr: 'a * 10' }, y1: 4, u: { $expr: 'seg(lt, 0, 4)' }, color: 'accent', lw: 3, head: { $expr: 'b * 4' } }] };
    const log = []; D.shot(clone(sa), {}).draw(spy(log), 2, 0.5, { t: [0, 4], text: 'x' }, { width: 100, height: 50 }, mkApi(log));
    const call = JSON.parse(log.find((x) => x.startsWith('arrow')).slice(5)), dA = D.depsOf(sa)[0];
    ok('C2d arrow: api.arrow con args evaluados (x1 = a*10, u = seg(lt), head = b*4) y deps exactas (a, b y el tiempo)', call[0] === 1 && call[2] === 10 && call[4].u === 0.5 && call[4].color === 'accent' && call[4].lw === 3 && call[4].head === 8 && dA.params.join() === 'a,b' && dA.time, JSON.stringify([call, dA.params])); }
  // C4: particles con semilla
  const ps = (seed) => { const sc = clone(scene); sc.objects = [sc.objects[3]]; sc.objects[0].seed = seed; const m2 = D.shot(sc, {}), log = []; m2.draw(spy(log), 1, 0.5, { t: [0, 4], text: 'x' }, { width: 100, height: 50 }, mkApi(log)); return JSON.stringify(log); };
  ok('C4 particles: misma semilla → mismos píxeles (llamadas); otra semilla → distintos; sin Math.random en el núcleo', ps(7) === ps(7) && ps(7) !== ps(8) && !/Math\.random/.test(fs.readFileSync(path.join(ROOT, 'engine/dsl-core.mjs'), 'utf8')));
  // C5: repeat expone i y n
  { const log = []; const m5 = D.shot(clone({ ...scene, objects: [scene.objects[2]] }), {}); m5.draw(spy(log), 1, 0.5, { t: [0, 4], text: 'x' }, { width: 100, height: 50 }, mkApi(log));
    const texts = log.filter((x) => x.startsWith('text')).map((x) => JSON.parse(x.slice(4)));
    const sc2 = { dsl: 1, id: 'R5', params: { cnt: { type: 'integer', default: 3 }, other: { type: 'number', default: 1 } }, objects: [{ id: 'r', type: 'repeat', n: { $expr: 'cnt' }, children: [{ id: 'h', type: 'text', text: 'x', x: { $expr: 'i * 10' }, y: { $expr: 'n' } }, { id: 'h2', type: 'text', text: 'y', x: 1, y: { $expr: 'other' } }] }] };
    const d5 = Object.fromEntries(D.depsOf(sc2).map((d) => [d.id, d]));
    ok('C5 repeat expone i y n (n = param b = 2 → textos en x=0,10, y=2) y deps del hijo incluyen el param que fija n', texts.length === 2 && texts[0][1] === 0 && texts[1][1] === 10 && texts.every((x) => x[2] === 2) && d5.h.params.join() === 'cnt' && d5.h2.params.join() === 'other', JSON.stringify([texts, d5.h.params, d5.h2.params])); }
  // C6: world3d nativo
  { const s3 = { dsl: 1, id: 'W3', objects: [{ id: 'mundo', type: 'world3d', scene: { id: 'dc', background: 'x', objects: [{ id: 'rack1', kind: 'box', size: [1, 2, 1] }, { id: 'rack2', kind: 'box', size: [1, 2, 1] }] }, cam: { dist: { $expr: '10 - t3' }, az: 0, el: 20 }, opts: { motionBlur: { samples: 6 } } }] };
    const s3b = clone(s3); s3b.objects[0].scene.objects[1].size = [3, 2, 1]; s3b.objects[0].scene.objects.push({ id: 'rack3', kind: 'box' });
    const R = D.diffScenes(s3, s3b), txt = D.formatDiff(R), log = []; D.shot(clone(s3), {}).draw(spy(log), 2, 0.5, { t: [0, 4], text: 'x' }, { width: 100, height: 50 }, mkApi(log));
    const call = JSON.parse(log.find((x) => x.startsWith('w3d')).slice(3));
    ok('C6 world3d nativo: la escena 3D vive en el JSON; dsl diff muestra los cambios de objetos 3D como cambios semánticos; la cámara es expresión de t3', !D.validateScene(s3).length && /~ object mundo\.3d\.rack2/.test(txt) && /\+ object mundo\.3d\.rack3/.test(txt) && call[0].objects.length === 2 && call[1].t === 2 && call[1].cam3.dist === 7 && call[1].mb.samples === 6, txt + JSON.stringify(call).slice(0, 200));
    ok('C6b world3d: scene y lib son excluyentes y hace falta uno', D.validateScene({ ...s3, libs: { L: './L.mjs' }, objects: [{ type: 'world3d', scene: { objects: [] }, lib: 'L', fn: 'f' }] }).length > 0 && D.validateScene({ ...s3, objects: [{ type: 'world3d' }] }).length > 0); }
}

// ── C3: píxeles idénticos al JS legado (in/mid/out + 3 instantes) en TODOS los shots convertidos ──
{
  const mine = dslShots(), H = refHashes(), sample = (ids) => (FULL ? ids : ids.filter((_, i) => i % 3 === 0)), fix = fs.readdirSync(path.join(ROOT, 'test/fixtures/dsl-legacy')).filter((f) => f.endsWith('.mjs')).map((f) => f.slice(0, -4));
  ok('C3a todo shot convertido (que existía en JS) tiene su JS legado en test/fixtures/dsl-legacy y sus hashes de referencia', mine.every((id) => fix.includes(id) && H[id] && Object.keys(H[id]).length === FRACS.length), mine.filter((id) => !fix.includes(id)).join(' '));
  const bad = [], t0 = Date.now();
  const films = await Promise.all(Object.keys(FILMS).map(async (film) => { const tl = JSON.parse(fs.readFileSync(path.join(ROOT, FILMS[film]), 'utf8')).shots.map((s) => s.id); const ids = sample(tl.filter((i) => mine.includes(i))); return ids.length ? [film, ids, await renderFilm(film, { ids })] : null; }));   // solo los shots DSL (antes se renderizaba el film entero); perfil quick: 1 de cada 3, full: todos
  let n = 0; for (const f of films.filter(Boolean)) for (const id of f[1]) { n++; if (JSON.stringify(f[2][id]) !== JSON.stringify(H[id])) bad.push(id); }
  ok(`C3 ${n} shots DSL${FULL ? '' : ' (muestra 1/3, perfil ' + PROFILE + ')'}: sha256 de píxeles == JS legado en 6 instantes (${((Date.now() - t0) / 1000).toFixed(0)} s)`, !bad.length && n > 0, 'difieren: ' + bad.join(' '));
  if (!fast) {   // el JS legado de los fixtures reproduce los mismos hashes (los hashes no se han contaminado)
    const { copyRepo, rmrf } = await import('./lib.mjs'), badL = [];
    await Promise.all(Object.keys(FILMS).map(async (film) => {
      const tl = JSON.parse(fs.readFileSync(path.join(ROOT, FILMS[film]), 'utf8')).shots.map((s) => s.id), ids = sample(tl.filter((i) => mine.includes(i))); if (!ids.length) return;
      const d = copyRepo(); try { for (const id of ids) { fs.copyFileSync(path.join(ROOT, 'test/fixtures/dsl-legacy', id + '.mjs'), path.join(d, 'shots', id + '.mjs')); fs.rmSync(path.join(d, 'shots', id + '.scene.json'), { force: true }); }
        const g = await renderFilm(film, { cwd: d, ids }); for (const id of ids) if (JSON.stringify(g[id]) !== JSON.stringify(H[id])) badL.push(id); } finally { rmrf(d); } }));
    ok('C3b el JS legado (fixtures) renderiza exactamente los hashes de referencia', !badL.length, badL.join(' '));
  }
}

// ── C7: ratchet de cobertura ──
{
  const C = CV.coverage(ROOT);
  ok(`C7 cobertura ${C.pct.toFixed(1)} % ≥ 80 % y ≥ umbral ratchet ${SPEC.ratchet.min} % (el umbral solo sube)`, C.pct >= 80 && C.pct + 1e-9 >= SPEC.ratchet.min, `${C.pct.toFixed(1)} % < ${SPEC.ratchet.min} %: ¿un shot volvió a JS?`);
  ok('C7b el % honesto cuenta los pendientes de otra rama en el denominador', Math.abs(C.pct - (100 * C.dsl) / C.total) < 1e-9 && C.total === C.rows.length);
}

if (!fast) {
  // ── C8: validate sin FIX en todos los films; el sandbox no cambia ──
  const { copyRepo, rmrf } = await import('./lib.mjs'), d = copyRepo(), errs = [];
  try {
    await Promise.all(Object.entries(FILMS).map(async ([film, tl]) => { const r = await run(['engine/lint.mjs', '--only', 'validate'], { cwd: d, env: { OPUS_TIMELINE: tl, OPUS_LAYERS: 'none' }, timeout: 300000 }); const f = glob(d, film); if (f) { const L = JSON.parse(fs.readFileSync(f, 'utf8')); for (const i of L.issues.filter((x) => x.level === 'FIX')) errs.push(film + ': ' + i.problem); } else errs.push(film + ': sin resultado ' + r.stderr.slice(-120)); }));
  } finally { rmrf(d); }
  ok('C8 lint --only validate: sin FIX en los 5 films con sus shots DSL', !errs.length, errs.slice(0, 3).join('; '));
  const { spawnSync } = await import('node:child_process'), g = (spawnSync('git', ['diff', '--stat', '4373007', '--', 'engine/sandbox.mjs', 'engine/guard.mjs'], { cwd: ROOT, encoding: 'utf8' }).stdout ?? '');
  ok('C8b el sandbox y la guardia no cambian por el DSL (git diff vs el punto de partida vacío)', g.trim() === '', g);
  // ── C9: rendimiento ── (solo perfil full: 3 pasadas por film con cronómetro; es lo más caro de la suite)
  if (FULL) {
  const { copyRepo: cp2, rmrf: rm2 } = await import('./lib.mjs'), slow = [];
  await Promise.all(Object.keys(FILMS).map(async (film) => {   // films en paralelo: el cociente DSL/JS compara dos renders bajo la misma carga
    const tl = JSON.parse(fs.readFileSync(path.join(ROOT, FILMS[film]), 'utf8')).shots.map((s) => s.id), ids = tl.filter((i) => dslShots().includes(i)); if (!ids.length) return;
    const dd = cp2(); try { for (const id of ids) { fs.copyFileSync(path.join(ROOT, 'test/fixtures/dsl-legacy', id + '.mjs'), path.join(dd, 'shots', id + '.mjs')); fs.rmSync(path.join(dd, 'shots', id + '.scene.json'), { force: true }); }
      let best = 9; for (let tries = 0; tries < 3 && best > 1.1; tries++) { const a = await renderFilm(film, { perf: 3, ids }), b = await renderFilm(film, { cwd: dd, perf: 3, ids }); const sa = ids.reduce((s, i) => s + a.ms[i], 0), sb = ids.reduce((s, i) => s + b.ms[i], 0); best = Math.min(best, sa / sb); }
      if (best > 1.1) slow.push(`${film} ×${best.toFixed(3)}`); console.log(`  perf ${film}: DSL/JS = ×${best.toFixed(3)} (${ids.length} shots)`); } finally { rm2(dd); }
  }));
  ok('C9 rendimiento: un shot DSL no es más de 10 % más lento que su JS legado (tiempo por fotograma, por film)', !slow.length, slow.join(' '));
  }
}
function glob(d, film) { const dir = path.join(d, 'out/lint'); if (!fs.existsSync(dir)) return null; const sub = fs.readdirSync(dir).filter((x) => fs.existsSync(path.join(dir, x, '_only-validate.json'))); return sub.length ? path.join(dir, sub[sub.length - 1], '_only-validate.json') : null; }
console.log(fail ? `\ndsl-cov: ${fail} fallos` : '\ndsl-cov: todo verde');
process.exit(fail ? 1 : 0);
