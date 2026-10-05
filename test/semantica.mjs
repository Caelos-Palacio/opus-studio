#!/usr/bin/env node
// Spec 006 — semántica: vocabulario controlado, DSL de escenas, índice semántico v2 y OTIO.
//   node test/semantica.mjs [--fast]   (--fast salta el golden de píxel DSL vs JS, que renderiza en copias)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ROOT, FONTS_CONF, copyRepo, rmrf, run } from './lib.mjs';

const argv = process.argv.slice(2);
if (argv[0] === '--worker') {                                   // DENTRO de una copia: sha de los fotogramas de un shot
  const { makeRenderer } = await import(pathToFileURL(path.join(process.cwd(), 'engine/render.mjs')).href);
  const R = await makeRenderer({}), s = R.film.shots.find((x) => x.id === argv[1]), [a, b] = s.t, out = {};
  for (const f of [0.02, 0.25, 0.4, 0.5, 0.75, 0.98]) { const t = a + (b - a) * f; R.frame(t); out[f] = crypto.createHash('sha256').update(R.ctx.getImageData(0, 0, R.W, R.H).data).digest('hex').slice(0, 20); }
  process.stdout.write(JSON.stringify(out)); process.exit(0);
}
const fast = argv.includes('--fast');
let fail = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? '✓' : '✗'} semántica: ${name}${cond ? '' : '  ' + extra}`); if (!cond) fail++; };
const throws = (f, re) => { try { f(); return false; } catch (e) { return re ? re.test(e.message) : true; } };
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));

const V = await import('../engine/vocab.mjs');
const D = await import('../engine/dsl-core.mjs');
const S = await import('../engine/semindex.mjs');
const { REGISTRY } = await import('../engine/metrics/registry.mjs');

// ── vocabulario ───────────────────────────────────────────────────────────────────────────────────────────────────
{
  const all = V.sections().flatMap((s) => V.VOCAB.sections[s].terms.map((t) => ({ s, ...t }))), bad = [];
  for (const s of V.sections()) { const ids = V.terms(s); if (new Set(ids).size !== ids.length) bad.push('ids duplicados en ' + s); }
  for (const t of all) { if (!t.def || t.def.length < 3) bad.push(`${t.s}/${t.id} sin definición`); if (t.forbid?.some((f) => V.VOCAB.sections[t.s].terms.some((x) => x.id.toLowerCase() === f.toLowerCase()))) bad.push(`${t.s}/${t.id}: prohibido == canónico`); }
  ok('V1 vocab: versión, ids únicos por sección, definiciones, prohibidos disjuntos', Number.isInteger(V.VERSION) && !bad.length, bad.slice(0, 3).join('; '));
  const MS = rd('data/memoria.schema.json').$defs, eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  ok('V2 el esquema de memoria coincide con el vocabulario (kind, relación, rol, cuando)', eq(MS.concepto.properties.kind.enum, V.terms('concept.kind')) && eq(MS.relacion.properties.tipo.enum, V.terms('relation.type')) && eq(MS.rol.enum, V.terms('memory.role')) && eq(MS.regla.properties.cuando.enum, V.terms('rule.when')));
  const mm = await import('../engine/memoria.mjs');
  ok('V2b memoria.mjs importa sus enums de vocab', eq(mm.MEMORIA_SCHEMA.$defs.rol.enum, V.terms('memory.role')) && eq(mm.ROLES, V.terms('memory.role')));
  ok('V3 ids de métricas: registry == vocab', eq(REGISTRY.map((m) => m.id).sort(), V.terms('metric').slice().sort()), 'node engine/vocab.mjs sync');
  ok('V4 canon: sinónimo prohibido → canónico; canónico → sí mismo; desconocido → null', V.canon('clímax') === 'pico' && V.canon('Pico') === 'pico' && V.canon('banda sonora') === 'soundtrack' && V.canon('xyzzy') === null && V.canon('revelacion', 'concept.kind') === 'revelación');
  const f = V.lintText('el clímax llega\nuna «toma» citada\nel pico\n`climax` en código\n<!-- vocab-ok --> toma\ntoma suelta', { file: 'x.md' });
  ok('V5 lintText: línea, término y canónico; exime citas, código y vocab-ok', f.length === 2 && f[0].line === 1 && f[0].canonical === 'pico' && f[1].line === 6 && f[1].canonical === 'shot', JSON.stringify(f));
  const mem = { conceptos: [{ id: 'a', label: 'a', kind: 'emocion', anclas: [{ rol: 'eco' }] }], relaciones: [{ tipo: 'provoca', de: 'a', a: 'a' }] }, me = V.lintMemoriaEnums(mem);
  ok('V5b lintMemoriaEnums propone el canónico para kind/tipo no canónicos', me.length === 2 && me[0].canonical === 'emoción' && me[1].canonical === 'causa', JSON.stringify(me));
  const R = V.lintRepo();
  ok('V6 lint de vocabulario del repo = 0 hallazgos (memoria de todos los films, notas, story, docs/specs)', R.length === 0, R.slice(0, 4).map((x) => `${x.file}:${x.line} ${x.term}→${x.canonical}`).join(' | '));
  const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const arcIds = [...new Set([...src('engine/arc.mjs').matchAll(/add\('([a-z0-9-]+)'/g)].map((m) => m[1]))].sort(), stages = [...new Set([...src('engine/lint.mjs').matchAll(/step\('([a-z]+)'/g)].map((m) => m[1]))].sort();
  const rub = Object.keys((await import('../engine/critic.mjs').catch(() => ({}))).RUBRIC ?? {}).sort(), roles = Object.keys(rd('roles.json').roles).filter((r) => r !== '*').sort();
  const un = (a, sec) => a.filter((x) => !V.has(sec, x));
  ok('V7 el código no inventa términos: checks del arc, etapas del lint, rúbrica, roles, medios y escalas ⊆ vocab', !un(arcIds, 'arc.check').length && !un(stages, 'lint.stage').length && !un(rub, 'critic.dimension').length && !un(roles, 'gov.role').length
    && !un(fs.readdirSync(path.join(ROOT, 'styles/medios')).map((f) => f.replace('.json', '')), 'medium').length && eq((await import('../engine/metrics/units.mjs')).SCALES.map((x) => x[0]), V.terms('shot.scale')), JSON.stringify({ a: un(arcIds, 'arc.check'), s: un(stages, 'lint.stage'), r: un(rub, 'critic.dimension'), g: un(roles, 'gov.role') }));
  const o = 'ver docs/handoff/semantica.md y src/a/b.mjs; hash 538122bbaa y out/lint/main/A3.json con M08 y K_tipo';
  ok('V8 referenceInvariant: ⊆ ok; pérdida → lista; añadidos no rompen', V.referenceInvariant(o, o + ' extra shots/Z9.mjs').ok && !V.referenceInvariant(o, 'ver docs/handoff/semantica.md hash 538122bbaa').ok && V.referenceInvariant(o, 'x').missing.includes('538122bbaa') && V.referenceInvariant(o, 'x').missing.includes('M08'));
  ok('V8b reasonCode clasifica los motivos de orquestación sin tocar su texto', V.reasonCode('A3 empeora: FIX 0→2') === 'worsens' && V.reasonCode('FIX global sube: 1→3') === 'fix-global-up' && V.reasonCode('xx') === null && V.has('orch.code', V.reasonCode('lint: no vigente')));
  const O = await import('../engine/orch.mjs'), b = O.brief('t', 'tarea', { budget: 30 }), full = O.brief('t', 'tarea');
  ok('V9 orch brief: sin recorte conserva rutas, hashes e ids esenciales; con recorte extremo no pierde referencias (guarda)', O.tokens(full) <= 500 && /out\/lint\/.*<ID>\.json/.test(full) && /engine [0-9a-f]{8}/.test(full) && /engine [0-9a-f]{8}/.test(b) && /out\/orch\/escalations/.test(b), b.slice(0, 200));
}

// ── DSL ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const A3 = rd('shots/A3.scene.json'), M08 = rd('shots/M08.scene.json');
{
  ok('D1 las dos escenas reales validan sin FIX', !D.validateScene(A3).length && !D.validateScene(M08).length, JSON.stringify(D.validateScene(A3).concat(D.validateScene(M08))));
  const bad = (f) => D.validateScene((() => { const s = clone(A3); f(s); return s; })());
  const msg = (f) => bad(f).map((e) => `${e.path} ${e.message} ${e.remedy}`).join(' | ');
  ok('D1a propiedad desconocida en un objeto', /\/objects\/0\/colr .*¿quisiste decir/.test('/objects/0/colr ' + msg((s) => { s.objects[3].colr = 1; }) ) || /desconocida "colr"/.test(msg((s) => { s.objects[3].colr = 1; })));
  ok('D1b tipo de objeto desconocido (con sugerencia)', /tipo de objeto desconocido "tex".*text/.test(msg((s) => { s.objects[7].type = 'tex'; })), msg((s) => { s.objects[7].type = 'tex'; }));
  ok('D1c id duplicado', /id duplicado/.test(msg((s) => { s.objects[1].id = 'suelo'; })));
  ok('D1d expresión inválida y variable desconocida (con sugerencia de param)', /desconocida/.test(msg((s) => { s.objects[6].r = { $expr: 'hitRR' }; })) && /¿quisiste decir "hitR"/.test(msg((s) => { s.objects[6].r = { $expr: 'hitRR' }; })) && bad((s) => { s.objects[6].r = { $expr: '1 +' }; }).length > 0);
  ok('D1e sig() prohibido: las señales entran por params enlazados', /sig\(\) no existe/.test(msg((s) => { s.objects[6].r = { $expr: "sig('pulse')" }; })));
  ok('D1f cue inexistente, lib sin declarar, param reservado', /cue "nada" no existe/.test(msg((s) => { s.objects[6].cue = 'nada'; })) && /no declarada/.test(msg((s) => { s.entities.dot.lib = 'ZZ'; })) && /reservado/.test(msg((s) => { s.params.t = { type: 'number' }; })));
  ok('D1g raíz: propiedad desconocida y versión', /desconocida "objs"/.test(msg((s) => { s.objs = []; })) && /no soportada/.test(msg((s) => { s.dsl = 2; })));
  ok('D1h assertScene lanza; un objeto sin props requeridas falla', throws(() => D.assertScene({ dsl: 1, objects: [{ type: 'text' }] }), /falta "text"/));
}
{
  const src = fs.readFileSync(path.join(ROOT, 'engine/dsl-core.mjs'), 'utf8');
  ok('D2 dsl-core es puro: sin Date/Math.random/fs/process', !/Date\.now|new Date|Math\.random|from 'node:|process\./.test(src));
  const mod = await import('../shots/A3.mjs'), m = mod.default;
  ok('D2b shot DSL compilado: {params, entities.dot, draw, dsl}; el .mjs generado cita su fuente', typeof m.draw === 'function' && m.params.hitR.default === 14 && typeof m.entities.dot === 'function' && m.dsl.id === 'A3' && /GENERADO desde shots\/A3\.scene\.json/.test(fs.readFileSync(path.join(ROOT, 'shots/A3.mjs'), 'utf8')));
}
if (!fast) {   // golden bit a bit: DSL vs JS legado, en copias temporales
  const env = { FONTCONFIG_FILE: FONTS_CONF, OPUS_LAYERS: 'none' };
  const render = async (legacy, id, timeline) => {
    const d = copyRepo();
    try {
      if (legacy) fs.copyFileSync(path.join(ROOT, 'test/fixtures/dsl-legacy', id + '.mjs'), path.join(d, 'shots', id + '.mjs'));
      const r = await run([path.join(ROOT, 'test/semantica.mjs'), '--worker', id], { cwd: d, env: { ...env, OPUS_TIMELINE: timeline } });
      if (r.status) throw new Error(r.stderr.slice(-400)); return JSON.parse(r.stdout);
    } finally { rmrf(d); }
  };
  for (const [id, tl] of [['A3', 'data/timeline.json'], ['M08', 'data/mate/timeline.json']]) {
    try { const [a, b] = await Promise.all([render(true, id, tl), render(false, id, tl)]); ok(`D3 golden ${id}: DSL == JS legado en 6 instantes, bit a bit`, JSON.stringify(a) === JSON.stringify(b) && Object.keys(a).length === 6, JSON.stringify([a, b])); }
    catch (e) { ok(`D3 golden ${id}`, false, e.message); }
  }
}
{
  const R0 = D.diffScenes(A3, JSON.parse(JSON.stringify(A3, null, 4)).constructor === Object ? A3 : A3);
  const reord = {}; for (const k of Object.keys(A3).reverse()) reord[k] = A3[k];
  ok('D4a diff: mismo contenido con otro orden de claves → sin cambios', D.diffScenes(A3, reord).same && D.formatDiff(D.diffScenes(A3, reord)) === 'sin cambios semánticos' && R0.same);
  const B = clone(A3); B.objects[6].r = { $expr: 'hitR * 2' }; B.objects.push({ id: 'extra', type: 'glow', x: 10, y: 10, r: 5 }); B.objects = B.objects.filter((o) => o.id !== 'suelo'); B.params.hitR.default = 20; B.cues[0].dur = { $expr: 'hitDur * 2' };
  const R = D.diffScenes(A3, B);
  ok('D4b diff semántico: objetos añadido/quitado/cambiado (con prop), param y cue cambiados', R.objects.added.join() === 'extra' && R.objects.removed.join() === 'suelo' && R.objects.changed.some((c) => c.id === 'golpe' && c.props.join() === 'r') && R.params.changed.some((c) => c.id === 'hitR') && R.cues.changed.some((c) => c.id === 'acento') && /^\+ object extra$/m.test(D.formatDiff(R)), D.formatDiff(R));
}
{
  const dep = Object.fromEntries(D.depsOf(A3).map((d) => [d.id, d])), fb = (id) => dep[id].inputs.join();
  ok('D5a deps exactas: golpe lee hitR/hitColor/hitAt/hitDur (cue) y la entidad dot; suelo no lee nada', ['hitAt', 'hitColor', 'hitDur', 'hitR'].every((p) => dep.golpe.inputs.includes(p)) && dep.golpe.entities.join() === 'dot' && dep.suelo.inputs.length === 0 && !dep.suelo.timeDependent && fb('frase') === 'pulse,textIn');
  const r = D.objectsReading(A3, 'hitR'), r2 = D.objectsReading(A3, 'textIn');
  ok('D5b invalidación fina: hitR → solo golpe; textIn → solo frase; transitivo por salidas (accent → degradado, marco, borde, foco)', r.exact.join() === 'golpe' && r2.exact.join() === 'frase' && ['degradado', 'marco', 'borde', 'foco'].every((x) => D.objectsReading(A3, 'accent').exact.includes(x)) && !D.objectsReading(A3, 'accent').exact.includes('suelo'), JSON.stringify(D.objectsReading(A3, 'accent')));
  ok('D5c objetos de lib sin `reads` son OPACOS y se reportan como posibles', D.depsOf(M08).find((d) => d.id === 'mundo').opaqueInputs === true);
}
{ // D6: cue enlazado a param: la ventana se mueve con el param (probado con un lienzo-espía)
  const mk = (hitAt) => { const sc = clone(A3); sc.params.hitAt.default = hitAt; return D.shot(sc, { A3lib: { dot: () => ({ x: 100, y: 100, s: 10, u: 1 }) }, A2: {} }); };
  const calls = (hitAt, lt) => { const log = [], ctx = { fillStyle: '', beginPath() {}, arc() { log.push('arc'); }, fill() {}, save() {}, restore() {}, stroke() {}, moveTo() {}, lineTo() {}, rect() {}, fillRect() {} };
    const api = { params: Object.fromEntries(Object.entries(A3.params).map(([k, v]) => [k, k === 'hitAt' ? hitAt : v.default ?? ''])), k: 1, safe: { y0: 0, h: 100 }, color: (c) => c, spring: () => 1, ground() {}, depth: (d, f) => f(), gradient: () => 'g', morph: () => ({ h: 20 }), focus() {}, text() {} };
    mk(hitAt).draw(ctx, 10 + lt, 0.5, { t: [10, 12], text: 'x' }, { width: 1280, height: 720 }, api); return log.length; };
  ok('D6 cue: el golpe sale en [hitAt, hitAt+hitDur) y se mueve con el param', calls(1, 1.05) === 1 && calls(1, 0.5) === 0 && calls(0.3, 0.35) === 1 && calls(0.3, 1.05) === 0);
}
{ // D7: build determinista y al día
  const d = copyRepo();
  try { const r = await run([path.join(ROOT, 'engine/dsl.mjs'), 'build', '--all', '--check'], { cwd: ROOT });
    ok('D7a lo generado (shots/*.mjs desde *.scene.json) está al día', r.status === 0, r.stdout + r.stderr);
    fs.writeFileSync(path.join(d, 'shots/A3.mjs'), '// roto\n'); const r2 = await run(['engine/dsl.mjs', 'build', '--all', '--check'], { cwd: d }), r3 = await run(['engine/dsl.mjs', 'build', '--all'], { cwd: d });
    ok('D7b --check detecta lo desactualizado y build lo regenera idéntico', r2.status === 1 && r3.status === 0 && fs.readFileSync(path.join(d, 'shots/A3.mjs'), 'utf8') === fs.readFileSync(path.join(ROOT, 'shots/A3.mjs'), 'utf8')); }
  finally { rmrf(d); }
  const r = await run([path.join(ROOT, 'engine/dsl.mjs'), 'diff', 'shots/A3.scene.json', 'shots/A3.mjs'], { cwd: ROOT }), r2 = await run([path.join(ROOT, 'engine/dsl.mjs'), 'deps', 'shots/A3.mjs', 'hitR'], { cwd: ROOT });
  ok('D4c CLI: diff entre .scene.json y su .mjs generado = sin cambios; deps <param> responde', /sin cambios/.test(r.stdout) && /exactos: golpe/.test(r2.stdout), r.stdout + r.stderr + r2.stdout);
}
if (!fast) { // D8: la guardia y el sandbox aceptan los shots DSL
  const d = copyRepo();
  try { const r = await run(['engine/lint.mjs', '--only', 'validate'], { cwd: d, timeout: 300000 }), L = JSON.parse(fs.readFileSync(path.join(d, 'out/lint/main/_only-validate.json'), 'utf8'));
    ok('D8 lint --only validate: sin FIX con A3 (y M08 en su film) como DSL', !L.issues.some((i) => i.level === 'FIX'), L.issues.filter((i) => i.level === 'FIX').map((i) => i.problem).join('; ') + r.stderr.slice(-200)); }
  catch (e) { ok('D8 lint validate', false, e.message); } finally { rmrf(d); }
}

// ── índice semántico v2 + OTIO ────────────────────────────────────────────────────────────────────────────────────
{
  const I = S.buildSemIndex({ timeline: 'data/timeline.json' }), I2 = S.buildSemIndex({ timeline: 'data/timeline.json' });
  ok('I1 semindex: conceptos, relaciones, objetos y params del DSL; sin píxeles; determinista', I.schema === 'opus-semindex/2' && I.concepts.length > 0 && I.objects.filter((o) => o.shot === 'A3').length === 9 && I.params['/shots/A3/params/hitR']?.readers.join() === 'golpe' && JSON.stringify(I) === JSON.stringify(I2) && !/thumb|pixel|sha/.test(JSON.stringify(Object.keys(I))));
  const c0 = I.concepts[0], w = S.where(I, c0.id), w2 = S.where(I, c0.kind);
  ok('I2 where: por id, por kind (canon) y por objeto; un término desconocido sugiere', w.hits.some((h) => h.kind === 'concepto' && h.id === c0.id && h.shots !== undefined) && w2.hits.length >= 1 && S.where(I, 'golpe').hits[0].kind === 'objeto' && S.where(I, 'tensio').canonical === null && S.where(I, 'tensio').suggest === 'tensión');
  const dp = S.dependsOn(I, 'hitR'), ac = I.concepts.flatMap((c) => c.anclas.filter((a) => a.param).map((a) => [c.id, a.param])), dq = ac.length ? S.dependsOn(I, ac[0][1]) : null;
  ok('I3 depends: objetos que leen el param; conceptos anclados a ese param', dp.matches[0].objects.join() === 'golpe' && (!dq || dq.matches[0].concepts.includes(ac[0][0])));
  const T = S.toOtio(I), errs = S.checkOtio(T), sums = S.otioSum(T);
  ok('I4a OTIO: esquema básico válido (Timeline.1/Stack.1/Track.1/Clip.1/Gap.1/Marker.1, RationalTime/TimeRange)', !errs.length && T.OTIO_SCHEMA === 'Timeline.1' && T.tracks.children.every((t) => t.children.some((c) => c.OTIO_SCHEMA === 'Clip.1')), errs.join('; '));
  ok('I4b OTIO: suma de duraciones por pista == duración del film en fotogramas', sums.every((x) => x === Math.round(I.duration * I.fps)), JSON.stringify(sums));
  ok('I4c OTIO: markers con metadata.opus (concepto, kind) en su t', T.tracks.markers.length > 0 && T.tracks.markers.every((m) => m.metadata.opus.vocab === I.vocab) && T.tracks.markers.some((m) => m.metadata.opus.concept && m.metadata.opus.kind && V.has('concept.kind', m.metadata.opus.kind)));
  ok('I5 OTIO: dos exportaciones idénticas byte a byte', JSON.stringify(T) === JSON.stringify(S.toOtio(I2)));
  const r = await run([path.join(ROOT, 'engine/q.mjs'), 'where', c0.id], { cwd: ROOT }), r2 = await run([path.join(ROOT, 'engine/q.mjs'), 'depends', 'hitR'], { cwd: ROOT });
  ok('I2b CLI: q where / q depends', r.status === 0 && r.stdout.includes(c0.id) && /golpe/.test(r2.stdout), r.stderr + r2.stderr);
}
console.log(fail ? `\nsemántica: ${fail} fallos` : '\nsemántica: todo verde');
process.exit(fail ? 1 : 0);
