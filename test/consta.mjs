#!/usr/bin/env node
// Spec 017 (film «Consta», E2a): foley de archivo, enganche objeto/fondo de las recetas, y el film consta íntegro (story v2, memoria, timeline, sonido).
//   node test/consta.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, run } from './lib.mjs';

let n = 0, bad = 0;
const ok = (m, c, info = '') => { n++; console.log(`${c ? '✓' : '✗'} consta: ${m}${info ? '  ' + info : ''}`); if (!c) bad++; };
const imp = (f) => import(pathToFileURL(path.join(ROOT, f)).href);
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

// ── foley (engine/foley.mjs) ──
{
  const { FOLEY, FOLEY_TYPES } = await imp('engine/foley.mjs'), { rng } = await imp('engine/core.mjs');
  const stats = (x) => { let pk = 0, e = 0; for (const v of x) { pk = Math.max(pk, Math.abs(v)); e += v * v; } return { pk, rms: Math.sqrt(e / x.length), finite: x.every(Number.isFinite) }; };
  const synth = (t, dur, seed = 7) => FOLEY[t].synth({ dur, gain: 1 }, rng(seed));
  ok('F1 hay 7 voces de foley con doc y dur por defecto', FOLEY_TYPES.length === 7 && FOLEY_TYPES.every((k) => FOLEY[k].doc && FOLEY[k].dur > 0), FOLEY_TYPES.join(','));
  const bad1 = FOLEY_TYPES.filter((t) => { const { x } = synth(t, FOLEY[t].dur), s = stats(x); return !s.finite || s.pk < 0.02 || s.pk > 4; });
  ok('F2 cada voz suena (no es silencio), es finita y no revienta', bad1.length === 0, bad1.join(','));
  const a = synth('sello', 0.5).x, b = synth('sello', 0.5).x, c = synth('sello', 0.5, 99).x;
  ok('F3 determinista por semilla; otra semilla suena distinta', a.length === b.length && a.every((v, i) => v === b[i]) && a.some((v, i) => v !== c[i]));
  ok('F4 el sello sin tinta es más corto y más flojo que el entintado', stats(synth('sello_seco', 0.4).x).rms < stats(synth('sello', 0.5).x).rms);
  ok('F5 la llave: dur corta = clin; dur ≥ 0,5 = giro (más larga)', synth('llave', 1.0).x.length > synth('llave', 0.4).x.length + 0.4 * 48000 * 0.9);
  ok('F6 tres llaves con semillas distintas no suenan igual (tres clics distintos)', (() => { const s = [1, 2, 3].map((k) => synth('llave', 1.0, k).x); return s[0].some((v, i) => v !== s[1][i]) && s[1].some((v, i) => v !== s[2][i]); })());
  { // reloj: un tic por segundo entero
    const { x } = synth('reloj', 5), SR = 48000, win = (k) => { let m = 0; for (let i = Math.round(k * SR) - 20; i < Math.round(k * SR) + 600; i++) m = Math.max(m, Math.abs(x[i] ?? 0)); return m; };
    ok('F7 el reloj tiene un tic en cada segundo entero y silencio entre ellos', [1, 2, 3, 4, 5].every((k) => win(k) > 0.1) && Math.max(...[1.4, 2.5, 3.6].map((k) => { let m = 0; for (let i = Math.round(k * SR); i < Math.round(k * SR) + 4800; i++) m = Math.max(m, Math.abs(x[i])); return m; })) < 0.02);
  }
  const sd = await imp('engine/sound.mjs');
  ok('F8 las voces del foley están también en la ruta legada (sound.VOICES) y en el esquema del timeline', FOLEY_TYPES.every((k) => sd.VOICES[k]?.fn) && FOLEY_TYPES.every((k) => J('data/timeline.schema.json').$defs.voice.enum.includes(k)));
}

// ── recetas: enganche con el tipo DSL genérico objeto/fondo (spec 014 + 016) ──
{
  const R = await imp('engine/recetas.mjs'), { TYPES } = await imp('engine/dsl-core.mjs');
  const entries = [{ id: 'objeto:cilindro_metalico', kind: 'objeto', resumen: 'cilindro' }, { id: 'fondo:expediente_kraft', kind: 'fondo', resumen: 'cartón de archivo', uso: '{"type":"fondo","preset":"expediente_kraft"}' }];
  const sc = R.scaffold('presentar_objeto', { id: 'T1', objeto: 'cilindro_metalico', fondo: 'expediente_kraft', entries, types: TYPES }).scene;
  const a = sc.objects.find((o) => o.id === 'ancla'), f = sc.objects.find((o) => o.id === 'fondo');
  ok('R1 --objeto/--fondo del catálogo producen {type:"objeto", objeto} y {type:"fondo", preset}', a.type === 'objeto' && a.objeto === 'cilindro_metalico' && f.type === 'fondo' && f.preset === 'expediente_kraft', JSON.stringify([a.type, a.objeto, f.type, f.preset]));
  ok('R2 el ancla conserva el movimiento de la receta (y la x/y de la receta)', !!a.y?.$expr && /spring/.test(a.y.$expr));
}

// ── motor: objeto con hollow/focus ──
{
  const { TYPES } = await imp('engine/dsl-core.mjs');
  ok('M1 el tipo DSL objeto admite hollow y focus (herramientas que tocan el texto a propósito)', TYPES.objeto.props.includes('hollow') && TYPES.objeto.props.includes('focus'));
}

// ── el film consta ──
{
  const story = J('data/consta/story.json'), tl = J('data/consta/timeline.json'), mem = J('data/consta/memoria.json');
  ok('C1 story v2 con cierre «cicatriz» sin moraleja y última línea del acta', story.v === 2 && story.cierre.tipo === 'cicatriz' && story.cierre.sin_moraleja === true && /equivocarse/.test(story.cierre.ultima_linea));
  ok('C2 el dato BIPM del cierre (u de IPK: 0 → 10 µg desde 2019) está en la fuente del story', /10 µg/.test(story.ancla.dato.fuente) && /BIPM/.test(story.ancla.dato.fuente));
  const r = await run(['engine/narr.mjs', 'data/consta/story.json', '--json'], { cwd: ROOT });
  let fix = -1; try { const o = JSON.parse(r.stdout); const f = (o.films ?? o.results ?? [o])[0]; fix = (f.issues ?? f.checks ?? []).filter((i) => i.level === 'FIX').length; } catch { /* salida distinta */ }
  ok('C3 lint narrativo: 0 FIX', fix === 0 || (fix === -1 && /FIX 0/.test(await run(['engine/narr.mjs', 'consta'], { cwd: ROOT }).stdout)), `fix=${fix}`);
  ok('C4 8 shots, 45 s, 16:9, medio kraft, cortes secos', tl.shots.length === 8 && tl.duration === 45 && tl.width / tl.height > 1.7 && tl.medium === 'kraft' && tl.shots.every((s) => s.transition_out === 'cut'));
  const recs = tl.shots.map((s) => JSON.parse(fs.readFileSync(path.join(ROOT, 'shots', s.id + '.scene.json'), 'utf8')).doc.match(/\[receta:([^\]+]+)/)?.[1]);
  const cnt = {}; for (const x of recs) cnt[x] = (cnt[x] ?? 0) + 1;
  ok('C5 todos los shots nacen de recetas y ninguna pasa del 50 %', recs.every(Boolean) && Math.max(...Object.values(cnt)) / recs.length <= 0.5, JSON.stringify(cnt));
  
  { const rs = await Promise.all(tl.shots.map((s) => run(['engine/dsl.mjs', 'build', `shots/${s.id}.scene.json`, '--check'], { cwd: ROOT }))); ok('C6 los shots .mjs están al día con su .scene.json', rs.every((q) => q.status === 0), rs.filter((q) => q.status).map((q) => q.stdout.slice(0, 80)).join('|')); }
  ok('C7 memoria: pregunta «quién se movió» abierta a propósito y 2 reinterpretaciones', mem.conceptos.some((c) => c.id === 'quien-se-movio' && c.abiertaAPropósito) && mem.reinterpretaciones.length === 2);
  const mr = await run(['engine/memoria.mjs', 'lint', '--timeline', 'data/consta/timeline.json'], { cwd: ROOT });
  ok('C8 lint de memoria PASS', mr.status === 0, (mr.stdout + mr.stderr).split('\n').slice(-2).join(' '));
  const vr = await run(['engine/lint.mjs', '--only', 'validate', '--timeline', 'data/consta/timeline.json'], { cwd: ROOT });
  ok('C9 validate del timeline sin FIX', vr.status === 0 && !/^FIX/m.test(vr.stdout), '');
  { // sonido: sin música, foley en su sitio, fluorescente por tramos y sin acorde de revelación
    const { build } = await imp('engine/sound.mjs'), b = build(tl, { memoria: mem, tag: 'consta-test' }), types = b.events.map((e) => e.type);
    const buzz = b.events.filter((e) => e.type === 'buzz');
    ok('S1 estilo archivo: foley de llave, sello, pluma, secante, reloj y mosca; sin acorde (bloom) ni whoosh', ['llave', 'sello', 'sello_seco', 'pluma', 'secante', 'reloj', 'mosca'].every((t) => types.includes(t)) && !types.includes('bloom') && !types.includes('whoosh'));
    ok('S2 el fluorescente suena en dos tramos y se corta en el silencio de «no consta» y en el del sello', buzz.length === 2 && buzz[0].t === 0 && buzz[0].t + buzz[0].dur < 26 && buzz[1].t >= 31 && buzz[1].t + buzz[1].dur <= 36.3);
    ok('S3 el master del estilo respeta el techo −3 dBTP', b.report.TP <= -2.9, `TP=${b.report.TP.toFixed(2)}`);
  }
}

console.log(`\nconsta: ${n - bad}/${n}`);
process.exit(bad ? 1 : 0);
