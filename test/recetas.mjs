#!/usr/bin/env node
// Spec 016 (recetas): BDD R1–R7. El agente no escribe todo el código: elige una receta, `opus new shot` la copia (scaffold, sin herencia) y rellena huecos.
//   node test/recetas.mjs            tests R1–R7
//   node test/recetas.mjs --worker <ids,…>   (interno) renderiza los shots indicados y devuelve hash/vacío/determinismo
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ROOT, FONTS_CONF, copyRepo, rmrf, run } from './lib.mjs';

const argv = process.argv.slice(2);
if (argv[0] === '--worker') {
  const { makeRenderer } = await import(pathToFileURL(path.join(process.cwd(), 'engine/render.mjs')).href);
  const R = await makeRenderer({}), only = argv[1] ? argv[1].split(',') : null, out = {};
  const sha = () => crypto.createHash('sha256').update(R.ctx.getImageData(0, 0, R.W, R.H).data).digest('hex').slice(0, 16);
  for (const s of R.film.shots) {
    if (only && !only.includes(s.id)) continue;
    const [a, b] = s.t; out[s.id] = { hashes: [], vacio: [], determinista: true };
    for (const f of [0.1, 0.5, 0.95]) {
      const t = a + (b - a) * f; R.frame(t); const h1 = sha(), px = R.ctx.getImageData(0, 0, R.W, R.H).data, c0 = [px[0], px[1], px[2]];
      let diff = 0; for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - c0[0]) + Math.abs(px[i + 1] - c0[1]) + Math.abs(px[i + 2] - c0[2]) > 24) diff++;
      R.frame(a + (b - a) * 0.3); R.frame(t); const h2 = sha();   // mirar otro instante y volver: seek puro
      out[s.id].hashes.push(h1); out[s.id].vacio.push(diff / (px.length / 4) < 0.002); if (h1 !== h2) out[s.id].determinista = false;
    }
  }
  process.stdout.write(JSON.stringify(out)); process.exit(0);
}

let n = 0, bad = 0;
const ok = (m, c, info = '') => { n++; console.log(`${c ? '✓' : '✗'} recetas: ${m}${info ? '  ' + info : ''}`); if (!c) bad++; };
const R = await import('../engine/recetas.mjs').catch((e) => { ok('engine/recetas.mjs existe', false, String(e.message).slice(0, 120)); console.log(`\n${bad} fallos`); process.exit(1); });
const { validateScene } = await import('../engine/dsl-core.mjs');
const { buildRegistry, search, tokens } = await import('../engine/toolbox.mjs');
const env = { FONTCONFIG_FILE: FONTS_CONF, OPUS_LAYERS: 'none' };
const rd = (f) => fs.readFileSync(f, 'utf8');
const cli = (d, args) => run(['engine/opus.mjs', ...args], { cwd: d });
const mkFilm = (d, name, shots) => {
  fs.writeFileSync(path.join(d, `data/${name}.json`), JSON.stringify({ title: name, style: 'cosmos', profile: 'reel', fps: 30, width: 640, height: 360, duration: shots.length * 3, autoSfx: { morph: true, beat: 'pop', cut: true }, music: null, motif: null, handoffs: [],
    shots: shots.map((id, i) => ({ id, t: [i * 3, i * 3 + 3], size: 'WS', action: 'receta de prueba', text: '', cam: { move: 'static' }, transition_out: 'cut', sfx: [] })) }, null, 1));
  return { OPUS_TIMELINE: `data/${name}.json`, OPUS_WARM: '0' };
};
const lint = async (d, filmEnv) => { const r = await run(['engine/lint.mjs', '--only', 'validate'], { cwd: d, env: { ...env, ...filmEnv }, timeout: 300000 }); return { ...r, lines: r.stdout.split('\n') }; };

const CAT = R.catalogo();
const MOV = CAT.filter((r) => r.meta.grupo === 'movimiento'), PLANO = CAT.filter((r) => r.meta.grupo === 'plano'), TRANS = CAT.filter((r) => r.meta.grupo === 'transicion');

// ── R2. catálogo: mínimas, ≤ 25 líneas, ≤ 4 params, ≥ 1 $hueco, meta completo ──
ok(`catálogo inicial ≈ 15 (8 planos, 6 movimientos, 3 transiciones)`, PLANO.length === 8 && MOV.length === 6 && TRANS.length === 3, `${PLANO.length}/${MOV.length}/${TRANS.length}`);
for (const r of CAT) {
  const p = R.validarReceta(r);
  ok(`R2 ${r.meta.id}: ≤25 líneas, ≤4 params, ≥1 hueco (en el scaffold), meta completo`, p.length === 0, p.join(' | '));
}
{
  const { entries, warnings } = await buildRegistry();
  ok('R2 cada receta aparece en el registro del toolbox como receta:<id>', CAT.every((r) => entries.some((e) => e.id === `receta:${r.meta.id}` && e.kind === 'receta' && /new shot/.test(e.ejemplo))));
  ok('R2 el registro sigue sin avisos con las recetas', warnings.length === 0, warnings.slice(0, 2).join(' | '));
  const top = (q) => search(entries, q, { k: 3, kind: 'receta' }).map((x) => x.entry.id);
  ok('R2 «un contador que suba al ritmo real» → receta:contar', top('un contador que suba al ritmo real').includes('receta:contar'), top('un contador que suba al ritmo real').join(','));
  ok('R2 «un acta que se sella» → receta:documento', top('un acta que se sella').includes('receta:documento'), top('un acta que se sella').join(','));
  ok('R2 «el objeto cae con peso» → receta:caida_con_peso', top('el objeto cae con peso').includes('receta:caida_con_peso'), top('el objeto cae con peso').join(','));
  ok('R2 «dos cosas lado a lado» → receta:comparar', top('dos cosas lado a lado').includes('receta:comparar'), top('dos cosas lado a lado').join(','));
  const ev = JSON.parse(rd(path.join(ROOT, 'data/tools.eval.json')));
  ok('R2 data/tools.eval.json lleva ≥ 8 intenciones de recetas', ev.filter((x) => (x.esperado ?? []).some((e) => e.startsWith('receta:'))).length >= 8);
}

// ── R1. opus new shot: scaffold propio, válido, compila y renderiza; no pisa sin --force ──
const D = copyRepo();
try {
  let r = await cli(D, ['new', 'shot', 'RX1', '--receta', 'revelar', '--objeto', 'botella']);
  const f = path.join(D, 'shots/RX1.scene.json');
  ok('R1 `opus new shot X --receta revelar --objeto botella` sale con 0 y escribe shots/X.scene.json', r.status === 0 && fs.existsSync(f), (r.stderr || r.stdout).slice(-200));
  const sc = fs.existsSync(f) ? JSON.parse(rd(f)) : null;
  ok('R1 el scene es válido para el schema estricto del DSL', !!sc && validateScene(sc).length === 0, sc ? validateScene(sc).map((x) => x.path + ' ' + x.message).join('; ') : '');
  ok('R1 scaffold, no herencia: sin referencia a la receta salvo la marca de doc', !!sc && sc.id === 'RX1' && /^\[receta:revelar\]/.test(sc.doc) && !JSON.stringify(sc).includes('$ID') && !('extends' in sc));
  ok('R1 compila: genera shots/X.mjs al día (dsl build --check)', fs.existsSync(path.join(D, 'shots/RX1.mjs')) && (await run(['engine/dsl.mjs', 'build', 'shots/RX1.scene.json', '--check'], { cwd: D })).status === 0);
  ok('R1 --objeto sin biblioteca deja $hueco explícito con la sugerencia (tolerante)', !!sc && /\$hueco[^"]*botella[^"]*tools\.mjs find/.test(JSON.stringify(sc)));
  const h0 = rd(f);
  r = await cli(D, ['new', 'shot', 'RX1', '--receta', 'contar']);
  ok('R1 repetir sin --force NO pisa el archivo existente (sale ≠ 0)', r.status !== 0 && rd(f) === h0 && /--force/.test(r.stderr + r.stdout));
  r = await cli(D, ['new', 'shot', 'RX1', '--receta', 'contar', '--force']);
  ok('R1 --force sí lo reescribe', r.status === 0 && /\[receta:contar\]/.test(rd(f)));
  r = await cli(D, ['new', 'shot', 'RX2', '--receta', 'no_existe']);
  ok('R1 receta desconocida: error con sugerencia', r.status !== 0 && /receta/.test(r.stderr + r.stdout));
  r = await cli(D, ['new', 'shot', 'RX3', '--receta', 'presentar_objeto', '--fondo', 'niebla', '--film', 'demo']);
  ok('R1 --fondo y --film aceptados (fondo ausente → $hueco)', r.status === 0 && /niebla/.test(rd(path.join(D, 'shots/RX3.scene.json'))), (r.stderr || '').slice(-160));
  r = await cli(D, ['new', 'shot', 'RX4', '--receta', 'contar', '--param', 'final=24', '--llenar', 'que=neutrinos', '--llenar', 'ancla.semantic=un destello', '--mov', 'parpadeo']);
  const s4 = r.status === 0 ? JSON.parse(rd(path.join(D, 'shots/RX4.scene.json'))) : null;
  ok('R1 --param fija defaults, --llenar llena huecos por objeto[.prop], --mov compone un movimiento', !!s4 && s4.params.final.default === 24 && s4.objects.find((o) => o.id === 'que').text === 'neutrinos' && R.huecos(s4).length === 0 && /\[receta:contar\+parpadeo\]/.test(s4.doc) && validateScene(s4).length === 0, (r.stderr || '').slice(-200));
  r = await cli(D, ['new', 'shot', 'RX5', '--receta', 'contar', '--llenar', 'nada=1']);
  ok('R1 --llenar de un hueco inexistente falla y lista los huecos válidos', r.status !== 0 && /que\.text/.test(r.stderr) && !fs.existsSync(path.join(D, 'shots/RX5.scene.json')));
  // todo el catálogo: cada receta (y cada movimiento sobre la base) compila y renderiza, no vacío, determinista
  const ids = [];
  for (const rc of CAT) { const id = 'Z' + rc.meta.id.replace(/_/g, ''); const q = await cli(D, ['new', 'shot', id, '--receta', rc.meta.id]); if (q.status !== 0) ok(`R1 scaffold ${rc.meta.id}`, false, q.stderr.slice(-200)); else ids.push(id); }
  const fenv = mkFilm(D, 'recetas-test', ids);
  const w = await run([path.join(ROOT, 'test/recetas.mjs'), '--worker'], { cwd: D, env: { ...env, ...fenv } });
  let W = {}; try { W = JSON.parse(w.stdout); } catch { ok('R1 el worker renderiza el catálogo', false, w.stderr.slice(-300)); }
  ok(`R1 las ${CAT.length} recetas del catálogo renderizan (no vacías en ningún instante)`, ids.every((id) => W[id] && W[id].vacio.every((v) => !v)), ids.filter((id) => !W[id] || W[id].vacio.some((v) => v)).join(','));
  ok('R6 render determinista: mismo fotograma tras mirar otro instante', ids.every((id) => W[id]?.determinista));
  ok('R1 las recetas con animación cambian de fotograma a lo largo del plano', ['Zpresentarobjeto', 'Zrevelar', 'Zcontar', 'Zescala', 'Zdocumento'].every((id) => new Set(W[id]?.hashes).size > 1));
  // R3 / R6: lint
  let L = await lint(D, fenv);
  const huecos = L.lines.filter((l) => /receta\.hueco/.test(l));
  ok('R3 un $hueco sin llenar da WARN receta.hueco con la ruta (un aviso por shot)', huecos.length >= ids.length - 6 && huecos.every((l) => /^WARN/.test(l)) && huecos.some((l) => /\/objects\/\d+\/semantic/.test(l)), `${huecos.length} avisos`);
  ok('R6 sandbox intacto: los shots generados no dan ningún FIX en el lint', !L.lines.some((l) => /^FIX/.test(l)), L.lines.filter((l) => /^FIX/.test(l)).slice(0, 2).join(' | '));
  // llenar los huecos de un shot quita el aviso
  const g = path.join(D, 'shots/Zcontar.scene.json'), txt = rd(g).replace(/\$hueco[^"]*/g, 'lo que se cuenta');
  fs.writeFileSync(g, txt); await run(['engine/dsl.mjs', 'build', 'shots/Zcontar.scene.json'], { cwd: D });
  L = await lint(D, fenv);
  ok('R3 al llenar los huecos de un shot su aviso desaparece', !L.lines.some((l) => /receta\.hueco/.test(l) && /Zcontar/.test(l)) && L.lines.some((l) => /receta\.hueco/.test(l) && /Zrevelar/.test(l)));
  // R4: repetición
  const same = []; for (let i = 0; i < 4; i++) { const id = 'Q' + i; await cli(D, ['new', 'shot', id, '--receta', 'detalle']); same.push(id); }
  await cli(D, ['new', 'shot', 'Q4', '--receta', 'contar']); same.push('Q4');
  let L4 = await lint(D, mkFilm(D, 'rep', same));
  ok('R4 un film con >50 % de shots de la misma receta da WARN receta.repeticion', L4.lines.some((l) => /^WARN/.test(l) && /receta\.repeticion/.test(l) && /detalle/.test(l)), L4.lines.filter((l) => /repeticion/.test(l)).join('|'));
  L4 = await lint(D, mkFilm(D, 'mix', ['Zdetalle', 'Zcontar', 'Zrevelar', 'Zescala', 'Zdocumento']));
  ok('R4 un film variado no avisa', !L4.lines.some((l) => /receta\.repeticion/.test(l)));
} finally { rmrf(D); }

// ── R4 (puro): umbral y oleada ──
{
  const sh = (...xs) => xs.map((x, i) => ({ id: 'S' + i, receta: x }));
  ok('R4 repeticion: 3 de 5 iguales avisa; 2 de 5 no; <3 recetas no avisa (muestra mínima)', R.repeticion(sh('a', 'a', 'a', 'b', 'c')).length === 1 && R.repeticion(sh('a', 'a', 'b', 'c', 'd')).length === 0 && R.repeticion(sh('a', 'a')).length === 0);
  ok('R4 los shots sin receta cuentan en el total (no se ocultan)', R.repeticion(sh('a', 'a', 'a', null, null, null)).length === 0 && R.repeticion(sh('a', 'a', 'a', null, null)).length === 1);
  ok('R4 oleada: tres films con la misma secuencia de recetas avisa; con una distinta no', R.oleadaIgual({ A: ['x', 'y', 'z'], B: ['x', 'y', 'z'], C: ['x', 'y', 'z'] }) && !R.oleadaIgual({ A: ['x', 'y', 'z'], B: ['x', 'y', 'z'], C: ['x', 'z', 'y'] }));
}

// ── R5. movimiento como modificador de cualquier objeto, sin código nuevo ──
{
  const base = R.scaffold('presentar_objeto', { id: 'M1' }).scene;
  const sc = (o) => JSON.stringify(o);
  let allOk = true, why = '';
  const kinds = { shape: 'ancla', text: 'detalle', focus: 'foco' };
  const SIN = ['acercar/text', 'parpadeo/focus'];   // propiedad que el tipo no tiene: falla claro, no en silencio
  for (const m of MOV) for (const [tipo, id] of Object.entries(kinds)) {
    let r = null, err = '';
    try { r = R.scaffold('presentar_objeto', { id: 'M2', mov: [m.meta.id], a: [id] }).scene; } catch (e) { err = e.message; }
    if (SIN.includes(`${m.meta.id}/${tipo}`)) { if (!/aplicable/.test(err)) { allOk = false; why += ` ${m.meta.id}→${tipo}:debía fallar`; } continue; }
    const p = r ? validateScene(r) : [{ message: err }], changed = r && sc(r.objects.find((o) => o.id === id)) !== sc(base.objects.find((o) => o.id === id));
    if (p.length || !changed) { allOk = false; why += ` ${m.meta.id}→${tipo}${p.length ? ':' + p[0].message : ':sin cambio'}`; }
  }
  ok('R5 los 6 movimientos se aplican a shape, text y focus: escena válida y objeto modificado', allOk, why);
  const two = R.scaffold('presentar_objeto', { id: 'M3', mov: ['caida_con_peso', 'temblor'] }).scene;
  ok('R5 los modificadores se componen (dos a la vez) y siguen siendo válidos', validateScene(two).length === 0 && /temblorX/.test(sc(two)) && /caidaY/.test(sc(two)));
  const alone = R.scaffold('temblor', { id: 'M4' }).scene;
  ok('R5 una receta de movimiento sola = base + modificador (válida, con hueco)', validateScene(alone).length === 0 && /temblorX/.test(sc(alone)) && R.huecos(alone).length >= 1);
  const bad = (() => { try { R.scaffold('presentar_objeto', { id: 'M5', mov: ['temblor'], a: ['fondo'] }); return 'no falla'; } catch (e) { return /fondo|aplicable/.test(e.message) ? '' : e.message; } })();
  ok('R5 aplicar un movimiento a un objeto sin propiedades afectables falla con mensaje claro', bad === '', bad);
}

// ── enganche con la rama fondos: tolerante, sin dependencia dura ──
{
  const entries = [{ id: 'objeto:botella', kind: 'objeto', resumen: 'botella de vidrio con corcho' }, { id: 'fondo:niebla', kind: 'fondo', resumen: 'niebla por capas' }];
  const types = { botella: { props: ['x', 'y', 'r', 'color'], req: ['x', 'y', 'r'] }, niebla: { props: ['densidad'], req: [] } };
  const r = R.scaffold('revelar', { id: 'E1', objeto: 'botella', fondo: 'niebla', entries, types }).scene;
  const a = r.objects.find((o) => o.id === 'ancla'), fo = r.objects.find((o) => o.id === 'fondo');
  ok('enganche: objeto/fondo presentes en el registro con tipo DSL sustituyen al ancla/fondo', a.type === 'botella' && fo.type === 'niebla' && a.x?.$expr && /\$hueco/.test(String(a.r)), JSON.stringify([a, fo]).slice(0, 200));
  const r2 = R.scaffold('revelar', { id: 'E2', objeto: 'farola', entries, types }).scene;
  ok('enganche: ausente → ancla por defecto con $hueco que sugiere `tools find`', r2.objects.find((o) => o.id === 'ancla').type === 'shape' && /farola.*tools\.mjs find/.test(JSON.stringify(r2)));
}

// ── R7. ahorro de escritura: receta vs. desde cero, en 3 shots de ejemplo (tokens ≈ caracteres/4) ──
{
  const M = R.medirAhorro();
  ok('R7 hay 3 shots de ejemplo (contar·Veinticuatro, documento·Consta, presentar_objeto·Botella)', M.length === 3 && ['contar', 'documento', 'presentar_objeto'].every((x) => M.some((m) => m.receta === x)));
  for (const m of M) ok(`R7 ${m.receta}: el agente escribe ≥ 50 % menos que desde cero (también reescribiendo líneas enteras)`, m.ahorro >= 0.5 && m.ahorroLineas >= 0.5, `${m.tokReceta} vs ${m.tokCero} tok (−${(m.ahorro * 100).toFixed(0)} %; peor caso −${(m.ahorroLineas * 100).toFixed(0)} %)`);
  ok('R7 los ejemplos terminados son escenas válidas, sin $hueco y distintos del scaffold', M.every((m) => m.valida && m.huecos === 0 && m.distinto));
  ok('R7 tokens() del toolbox y la medida usan la misma unidad', tokens('abcd') === 1);
}

console.log(`\n${bad ? bad + ' fallos' : 'recetas: todo verde'} (${n} comprobaciones)`);
process.exit(bad ? 1 : 0);
