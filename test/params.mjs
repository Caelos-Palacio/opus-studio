#!/usr/bin/env node
// F4: parámetros promovidos, señales, DSL, capas de overrides y cookKey fino. Cada bloque falla si falta su pieza.
//   unidades puras (expr, señales, JSON Patch, resolve/explain, cookEntry, esquema)
//   + píxeles en copias temporales (una capa cambia SOLO el shot al que apunta; meta no cambia nada; señal enlazada anima)
//   + e2e sobre `cut --plan`: un agente cambia un parámetro por capa y solo se re-renderiza el fragmento afectado.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ROOT, copyRepo, rmrf, run } from './lib.mjs';

const argv = process.argv.slice(2);
if (argv[0] === '--worker') {                                   // corre DENTRO de una copia: sha de los fotogramas pedidos
  const { makeRenderer } = await import(pathToFileURL(path.join(process.cwd(), 'engine/render.mjs')).href);
  const R = await makeRenderer({}), out = {};
  for (const t of argv.slice(1).map(Number)) { R.frame(t); out[t] = crypto.createHash('sha256').update(R.ctx.getImageData(0, 0, R.W, R.H).data).digest('hex').slice(0, 16); }
  process.stdout.write(JSON.stringify(out)); process.exit(0);
}

const { parse, compile, evaluate, ExprError } = await import('../engine/expr.mjs');
const { compileSignals, bindParams } = await import('../engine/signal.mjs');
const { applyPatch, resolve, explain, cookEntry, toDoc, fromDoc } = await import('../engine/resolve.mjs');
const { validateTimeline, validateLayer } = await import('../engine/schema.mjs');

let fail = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? '✓' : '✗'} params: ${name}${cond ? '' : '  ' + extra}`); if (!cond) fail++; };
const throws = (f, re) => { try { f(); return false; } catch (e) { return re ? re.test(e.message) : true; } };
const clone = (x) => JSON.parse(JSON.stringify(x));
const TL = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/timeline.json'), 'utf8'));
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

// ── 1. DSL ──────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const c = compile("72 + 8*sig('pulse')");
  ok('expr: deps extraídas al parsear', JSON.stringify(c.deps) === '["pulse"]');
  ok('expr: evalúa con señales', c.fn({ t: 0, sig: (n) => (n === 'pulse' ? 0.5 : 0) }) === 76);
  ok('expr: precedencia y ^ asociativo a la derecha', evaluate('2 + 3*4 ^ 2 ^ 0.5 - -1') === 2 + 3 * 4 ** (2 ** 0.5) + 1 && evaluate('2^3^2') === 512);
  ok('expr: ?: && || comparaciones', evaluate('t > 1 && t < 3 ? 10 : 20', { t: 2 }) === 10 && evaluate('t > 1 || 0', { t: 0 }) === 0);
  ok('expr: variables t lt u dur y funciones', near(evaluate('lt + u*dur + clamp(2) + lerp(0, 10, 0.5) + ease(\'linear\', 0.25)', { lt: 1, u: 0.5, dur: 2 }), 1 + 1 + 1 + 5 + 0.25));
  ok('expr: sig(nombre, t) con tiempo propio (retardo)', evaluate("sig('a', t - 1)", { t: 3, sig: (n, tt) => tt }) === 2);
  const bad = ['constructor', 'this', 'a.b', "x['constructor']", 'process', 'eval(1)', 'Function(1)', "sig(n)", '1 +', '(1', '"\\x"', 'globalThis'];
  ok(`expr: rechaza ${bad.length} evasiones/errores (sin eval, sin propiedades, sin identificadores libres)`, bad.every((s) => throws(() => parse(s), null)), bad.filter((s) => !throws(() => parse(s))).join(' | '));
  let e; try { compile('1 + foo(2)', { path: '/shots/A1/params/size' }); } catch (x) { e = x; }
  ok('expr: error con ruta y columna', e instanceof ExprError && /^\/shots\/A1\/params\/size: función desconocida 'foo'/.test(e.message) && e.col === 4, e?.message);
  const src = fs.readFileSync(path.join(ROOT, 'engine/expr.mjs'), 'utf8').replace(/\/\/.*$/gm, '');
  ok('expr: el parser no usa eval ni Function', !/\beval\s*\(|new Function|Function\s*\(/.test(src));
}
// ── 2. señales ──────────────────────────────────────────────────────────────────────────────────────────────────
{
  const S = compileSignals({
    k: { op: 'keys', keys: [{ t: 0, v: 0, ease: 'smooth' }, { t: 2, v: 10 }] },
    l: { op: 'lfo', freq: 1, amp: 2, offset: 1 }, sq: { op: 'lfo', shape: 'square', freq: 1 },
    e: { op: 'env', at: [1, 3], attack: 0.1, decay: 0.2, sustain: 0.5, hold: 0.3, release: 0.4 },
    n: { op: 'noise', freq: 3 }, b: { op: 'audio', feature: 'beats', decay: 0.1 }, o: { op: 'audio', feature: 'onsets' },
    r: { op: 'audio', feature: 'rms' }, x: { op: 'expr', expr: "sig('k') + sig('l', 0.25)" },
  }, { beatTimes: [0, 0.5, 1], audioInfo: { onsets: [2], rms: { hop: 0.5, values: [0, 1, 0.5] } }, duration: 6 });
  ok('señal keys + ease (smooth a mitad = 5; mantiene fuera)', near(S.value('k', 1), 5) && S.value('k', -1) === 0 && S.value('k', 9) === 10);
  ok('señal lfo seno/cuadrada', near(S.value('l', 0.25), 3) && S.value('sq', 0.25) === 1 && S.value('sq', 0.75) === -1);
  ok('señal env ADSR con re-disparo', S.value('e', 0.9) === 0 && near(S.value('e', 1.05), 0.5) && near(S.value('e', 1.4), 0.5) && near(S.value('e', 1.8), 0.25) && S.value('e', 2.5) === 0 && near(S.value('e', 3.05), 0.5));
  const N1 = compileSignals({ n: { op: 'noise', freq: 3 } }), N2 = compileSignals({ a: { op: 'noise' }, n: { op: 'noise', freq: 3 }, z: { op: 'lfo' } });
  ok('señal noise determinista y sembrada por nombre (añadir señales no cambia su azar)', [0.1, 0.7, 2.3].every((t) => N1.value('n', t) === N2.value('n', t) && S.value('n', t) === N1.value('n', t)) && S.value('n', 0.7) !== S.value('n', 0.9));
  ok('señal audio beats/onsets (tren de envolventes) y rms (interpolado)', near(S.value('b', 0.505), 1, 0.01) && S.value('b', 0.6) < 0.5 && S.value('o', 1.9) === 0 && near(S.value('o', 2.005), 1, 0.01) && near(S.value('r', 0.75), 0.75));
  ok('señal expr compone señales por nombre', near(S.value('x', 1), 5 + 3));
  ok('señales: ciclo → error con ruta', throws(() => compileSignals({ a: { op: 'expr', expr: "sig('b')" }, b: { op: 'expr', expr: "1 + sig('a')" } }), /^\/signals\/a\/expr: ciclo de señales: a → b → a/));
  ok('señales: referencia rota → error con ruta', throws(() => compileSignals({ a: { op: 'expr', expr: "sig('nope')" } }), /^\/signals\/a\/expr: señal desconocida 'nope'/));
}
// ── 3. JSON Patch (RFC 6902) ────────────────────────────────────────────────────────────────────────────────────
{
  const d = { a: { 'x/y': 1, 'm~n': 2 }, l: [1, 2, 3] };
  const r = applyPatch(d, [{ op: 'replace', path: '/a/x~1y', value: 5 }, { op: 'add', path: '/l/-', value: 4 }, { op: 'add', path: '/l/0', value: 0 }, { op: 'remove', path: '/a/m~0n' },
    { op: 'copy', from: '/l/1', path: '/c' }, { op: 'move', from: '/c', path: '/a/c' }, { op: 'test', path: '/a/c', value: 1 }]);
  ok('patch: add/remove/replace/move/copy/test + escapes ~0 ~1 + "-"', JSON.stringify(r) === JSON.stringify({ a: { 'x/y': 5, c: 1 }, l: [0, 1, 2, 3, 4] }), JSON.stringify(r));
  ok('patch: inmutable (el original no cambia)', d.a['x/y'] === 1 && d.l.length === 3);
  ok('patch: atómico — test fallido o ruta inexistente lanzan con capa y op', throws(() => applyPatch(d, [{ op: 'replace', path: '/a/x~1y', value: 9 }, { op: 'test', path: '/l/0', value: 7 }], { layer: 'L' }), /capa "L" op #1 \(\/l\/0\): test falló/) && throws(() => applyPatch(d, [{ op: 'replace', path: '/zz', value: 1 }]), /no existe/));
}
// ── 4. capas: orden LIVRPS simplificado, deshacer, explain ──────────────────────────────────────────────────────
{
  const tl = { ...clone(TL), variants: { en: { ops: [{ op: 'add', path: '/shots/A1/params', value: { text: 'ONE IDEA', size: 0.2 } }] } } };
  const agent = { name: 'agente-tamaño', ops: [{ op: 'add', path: '/shots/A1/params/size', value: 0.25 }] };
  const user = { name: 'yo', kind: 'user', ops: [{ op: 'replace', path: '/shots/A1/params/size', value: 0.3 }] };
  const hi = { name: 'agente-b', priority: 5, ops: [{ op: 'replace', path: '/shots/A1/params/size', value: 0.28 }] };
  const R = resolve(tl, [user, hi, agent], { variants: ['en'] });
  ok('capas: orden base < variant < agent (priority) < user', JSON.stringify(R.trace.map((s) => s.name)) === '["variant:en","agente-tamaño","agente-b","yo"]' && R.timeline.shots[0].params.size === 0.3 && R.timeline.shots[0].params.text === 'ONE IDEA');
  const X = explain(R, '/shots/A1/params/size');
  ok('explain: qué capa ganó y la pila de valores', X.winner === 'yo' && X.value === 0.3 && JSON.stringify(X.steps.map((s) => s.value)) === '[0.2,0.25,0.28,0.3]');
  ok('explain: una capa que no toca la ruta no aparece', explain(R, '/shots/A1/params/text').steps.length === 1 && explain(R, '/shots/A1/params/text').winner === 'variant:en');
  ok('deshacer = quitar capa (sin capas: el MISMO objeto base)', resolve(tl, [], {}).timeline === tl && resolve(tl, [{ ...agent, enabled: false }]).timeline === tl);
  ok('capas: orden de shots preservado; shot nuevo por id al final', JSON.stringify(fromDoc(applyPatch(toDoc(TL), [{ op: 'add', path: '/shots/B9', value: { t: [6, 7] } }]), TL.shots.map((s) => s.id)).shots.map((s) => s.id)) === '["A1","A2","A3","B9"]');
  ok('capas: variante inexistente → error', throws(() => resolve(tl, [], { variants: ['fr'] }), /variante desconocida/));
  ok('capa: esquema $defs.layer (campo desconocido / op inválida = FIX)', !validateLayer(agent).length && validateLayer({ ...agent, prio: 1 }).some((x) => /prio/.test(x.path)) && validateLayer({ ops: [{ op: 'set', path: '/x' }] }).some((x) => x.level === 'FIX'));
}
// ── 5. cookEntry: meta fuera, params resueltos y señales usadas dentro ────────────────────────────────────────────
{
  const mk = (tl) => { const f = { ...clone(tl), shots: clone(tl.shots), beatTimes: [], duration: tl.duration }; bindParams(f); return f; };
  const base = { ...clone(TL), signals: { p: { op: 'lfo' }, q: { op: 'lfo', freq: 3 } } };
  const key = (tl, id) => { const f = mk(tl); return JSON.stringify(cookEntry(f, f.shots.find((s) => s.id === id))); };
  const withMeta = clone(base); withMeta.shots[0].meta = { emocion: 'calma', rol: 'gancho' };
  const withParam = clone(base); withParam.shots[0].params = { size: 0.2 };
  const bound = clone(base); bound.shots[0].params = { size: { $expr: "0.17 + 0.01*sig('p')" } };
  const boundQ = clone(bound); boundQ.signals.q.freq = 9;
  const boundP = clone(bound); boundP.signals.p.freq = 9;
  ok('cookEntry: meta no cuenta (ni llega al shot: film.meta aparte)', key(base, 'A1') === key(withMeta, 'A1') && mk(withMeta).meta.A1.rol === 'gancho' && mk(withMeta).shots[0].meta === undefined);
  ok('cookEntry: un parámetro cambia la clave', key(base, 'A1') !== key(withParam, 'A1'));
  ok('cookEntry: solo las señales que usa (cambiar otra no invalida; la usada sí)', key(bound, 'A1') === key(boundQ, 'A1') && key(bound, 'A1') !== key(boundP, 'A1') && key(base, 'A2') === key(boundP, 'A2'));
}
// ── 6. esquema del timeline extendido ────────────────────────────────────────────────────────────────────────────
{
  const fx = (tl) => validateTimeline(tl).filter((x) => x.level === 'FIX');
  const good = { ...clone(TL), meta: { serie: 'demo' }, signals: { pulse: { op: 'env', at: [1, 1.5] }, breath: { op: 'lfo', freq: 0.5, amp: 0.02, offset: 0.17 } }, variants: { v9x16: { ops: [{ op: 'replace', path: '/width', value: 720 }] } } };
  good.shots[0].params = { size: { $sig: 'breath' }, pulse: { $expr: "0.3 + 0.2*sig('pulse')" }, text: 'HOLA' }; good.shots[0].meta = { intent: 'gancho' };
  ok('esquema: params/signals/variants/meta válidos', !fx(good).length, JSON.stringify(fx(good)));
  const typo = clone(good); typo.signals.breath.frq = 1;
  ok('esquema: campo desconocido en una señal = FIX con sugerencia', fx(typo).some((x) => /\/signals\/breath\/frq/.test(x.problem) && /freq/.test(x.remedy)));
  const ghost = clone(good); ghost.shots[0].params.size = { $sig: 'breth' };
  ok('esquema: señal inexistente en un parámetro = FIX con "¿quisiste decir?"', fx(ghost).some((x) => /\/shots\/0\/params\/size: señal desconocida 'breth'/.test(x.problem) && /breath/.test(x.remedy)));
  const badx = clone(good); badx.shots[0].params.size = { $expr: '72 + * 2' };
  ok('esquema: expresión rota = FIX con ruta', fx(badx).some((x) => /^\/shots\/0\/params\/size: token inesperado/.test(x.problem) && x.kind === 'schema'));
  const obj = clone(good); obj.shots[0].params.size = { valor: 3 };
  ok('esquema: objeto que no es enlace = FIX; additionalProperties:false se mantiene', fx(obj).length > 0 && fx({ ...clone(TL), signalz: {} }).some((x) => /signals/.test(x.remedy)));
}

// ── 7. píxeles y CLI en copias temporales ─────────────────────────────────────────────────────────────────────────
const layer = (d, name, L) => { fs.mkdirSync(path.join(d, 'data/layers'), { recursive: true }); fs.writeFileSync(path.join(d, 'data/layers', name + '.json'), JSON.stringify(L, null, 1)); };
const T = [1.0, 1.5, 3.0, 5.0];                                   // A1 mid, A1 latido, A2 mid, A3 mid
async function frames(setup) {
  const d = copyRepo();
  try { setup?.(d); const r = await run([path.join(ROOT, 'test/params.mjs'), '--worker', ...T.map(String)], { cwd: d, env: { FONTCONFIG_FILE: path.join(ROOT, 'test/golden/fonts.conf') } }); if (r.status) throw new Error(r.stderr.slice(-500)); return JSON.parse(r.stdout); }
  finally { rmrf(d); }
}
const changed = (A, B) => T.filter((t) => A[t] !== B[t]).map((t) => (t < 2 ? 'A1' : t < 4 ? 'A2' : 'A3') + '@' + t).join(',');
const sigTl = (d) => { const f = path.join(d, 'data/timeline.json'), tl = JSON.parse(fs.readFileSync(f, 'utf8')); tl.signals = { breath: { op: 'lfo', freq: 0.75, amp: 0.04, offset: 0.17 } }; fs.writeFileSync(f, JSON.stringify(tl, null, 1)); };
// Los tres bloques con procesos corren en paralelo; sus líneas se imprimen en orden.
const deferred = (fn) => { const lines = []; return fn((...a) => lines.push(a)).then(() => lines, (e) => [...lines, ['bloque', false, e.stack]]); };
const pixels = deferred(async (ok) => {
  const [F0, F3, Fm, Fs, F1] = await Promise.all([
    frames(null),
    frames((d) => layer(d, 'agente-texto', { name: 'agente-texto', author: 'agent:editor', why: 'frase final más corta', ops: [{ op: 'add', path: '/shots/A3/params', value: { text: 'OTRA', hitColor: 'ink' } }] })),
    frames((d) => layer(d, 'agente-meta', { ops: [{ op: 'add', path: '/shots/A1/meta', value: { emocion: 'asombro' } }, { op: 'add', path: '/meta', value: { nota: 'solo metadatos' } }] })),
    frames((d) => { sigTl(d); layer(d, 'respira', { ops: [{ op: 'add', path: '/shots/A1/params', value: { size: { $sig: 'breath' } } }] }); }),
    frames((d) => layer(d, 'agente-tamaño', { ops: [{ op: 'add', path: '/shots/A1/params', value: { size: 0.25 } }] })),
  ]);
  ok('píxeles: capa sobre /shots/A3/params cambia SOLO A3', changed(F0, F3) === 'A3@5', changed(F0, F3));
  ok('píxeles: capa solo de meta no cambia ningún fotograma', changed(F0, Fm) === '', changed(F0, Fm));
  ok('píxeles: parámetro enlazado a una señal (lfo) anima A1 (y su herencia)', changed(F0, Fs).startsWith('A1@1,A1@1.5'), changed(F0, Fs));
  ok('píxeles: tamaño de A1 por capa cambia A1 y lo que hereda su punto (A2/A3)', changed(F0, F1) === 'A1@1,A1@1.5,A2@3,A3@5', changed(F0, F1));
});

// capa inválida: el cargador la rechaza con ruta, capa y sugerencia; explain/diff dicen quién gana
const cli = deferred(async (ok) => {
  const d = copyRepo();
  try {
    layer(d, 'agente-malo', { ops: [{ op: 'add', path: '/shots/A1/params', value: { sise: 0.2 } }] });
    let r = await run(['engine/params.mjs', 'check'], { cwd: d });
    ok('capa inválida: parámetro desconocido → FIX con capa y "¿quisiste decir?"', r.status === 1 && /\/shots\/A1\/params\/sise: parámetro desconocido \[fijado por la capa "agente-malo"\]/.test(r.stdout) && /size/.test(r.stdout), r.stdout + r.stderr);
    layer(d, 'agente-malo', { ops: [{ op: 'add', path: '/shots/A1/params', value: { size: 3 } }] });
    r = await run(['engine/params.mjs', 'check'], { cwd: d });
    ok('capa inválida: fuera de range → FIX', r.status === 1 && /3 fuera de range \[0.05,0.4\] vh/.test(r.stdout), r.stdout);
    layer(d, 'agente-malo', { name: 'agente-tamaño', ops: [{ op: 'add', path: '/shots/A1/params', value: { size: 0.25 } }] });
    layer(d, 'yo', { kind: 'user', ops: [{ op: 'replace', path: '/shots/A1/params/size', value: 0.3 }] });
    r = await run(['engine/params.mjs', 'explain', '/shots/A1/params/size'], { cwd: d });
    ok('CLI explain: pila default → agent → user y quién gana', /default\s+0\.17/.test(r.stdout) && /agent:agente-tamaño\s+0\.25/.test(r.stdout) && /user:yo\s+0\.3/.test(r.stdout) && /= 0\.3 .*gana yo/.test(r.stdout), r.stdout + r.stderr);
    r = await run(['engine/params.mjs', 'diff', 'agente-tamaño'], { cwd: d });
    ok('CLI diff: rutas que cambia una capa', /agente-tamaño/.test(r.stdout) && /\/shots\/A1\/params/.test(r.stdout), r.stdout + r.stderr);
  } finally { rmrf(d); }
});

// ── 8. e2e: cut --plan — solo se re-renderiza el fragmento afectado ───────────────────────────────────────────────
const e2e = deferred(async (ok) => {
  const d = copyRepo(), fps = 12, size = '320x180', dir = path.join(d, 'out/fragments/main');
  const plan = async () => { const r = await run(['engine/cut.mjs', '--plan', '--fps', String(fps), '--size', size], { cwd: d }); if (r.status) throw new Error(r.stderr.slice(-400));
    return r.stdout.split('\n').map((l) => /^\s+([✓·])\s+(\S+)\s+\[\d+,\d+\)\s+(\w+)/.exec(l)).filter(Boolean).map(([, c, id, h]) => ({ cached: c === '✓', id, h })); };
  const verdictShots = async () => JSON.parse((await run(['--input-type=module', '-e', "import('./engine/verdict.mjs').then((m) => process.stdout.write(JSON.stringify(m.currentHashes().shots)))"], { cwd: d })).stdout);
  const todo = (P) => P.filter((j) => !j.cached).map((j) => j.id).join(',');
  try {
    const P0 = await plan(), V0 = await verdictShots();
    fs.mkdirSync(dir, { recursive: true });
    for (const j of P0) fs.writeFileSync(path.join(dir, `${j.id}_${j.h}_${fps}_${size}.mp4`), '');   // "ya renderizados"
    ok('e2e plan: base completa en caché', P0.length === 3 && todo(await plan()) === '');
    layer(d, 'agente-texto', { ops: [{ op: 'add', path: '/shots/A3/params', value: { text: 'OTRA IDEA' } }] });
    const P1 = await plan(), V1 = await verdictShots();
    ok('e2e plan: un agente cambia /shots/A3/params/text por capa → solo A3 por renderizar', todo(P1) === 'A3', todo(P1));
    ok('e2e veredictos: solo caduca el shotHash de A3', Object.keys(V0).filter((k) => V0[k] !== V1[k]).join(',') === 'A3');
    fs.rmSync(path.join(d, 'data/layers/agente-texto.json'));
    ok('e2e plan: deshacer = quitar la capa → todo en caché otra vez', todo(await plan()) === '');
    layer(d, 'agente-meta', { ops: [{ op: 'add', path: '/shots/A2/meta', value: { emocion: 'tensión', beat: 'giro' } }, { op: 'add', path: '/meta', value: { tema: 'semilla' } }] });
    const Vm = await verdictShots();
    ok('e2e plan: cambio solo de meta → nada por renderizar ni veredictos caducados', todo(await plan()) === '' && JSON.stringify(Vm) === JSON.stringify(V0));
    layer(d, 'agente-tamaño', { ops: [{ op: 'add', path: '/shots/A1/params', value: { size: 0.25 } }] });
    ok('e2e plan: tamaño de A1 invalida A1 y a quien importa su punto (A2, A3)', todo(await plan()) === 'A1,A2,A3');
  } catch (e) { ok('e2e plan', false, e.message); }
  finally { rmrf(d); }
});
for (const lines of await Promise.all([pixels, cli, e2e])) for (const l of lines) ok(...l);

process.exit(fail ? 1 : 0);
