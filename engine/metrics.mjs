#!/usr/bin/env node
// Métricas con sentido y estandarizables (spec 005). Unidades reales (s, °/s, ΔE00, LUFS, WPM…), no estadísticas de píxeles.
//   npm run metrics -- [film] [--json] [--fps N (por defecto auto: ≤400 muestras, 2–8 Hz)] [--no-audio]   mide el film → out/metrics/<film>.json + ficha out/metrics/<film>.md
//   npm run metrics -- compare a b [--json]                     diferencias normalizadas (z con IC, rango típico) + distancia entre curvas (L2, DTW)
//   npm run metrics -- calibrate [--json]                       correlación nota del usuario ↔ métricas (data/notas.json; ADVERTENCIA: n pequeño)
//   npm run metrics -- units [film]                             parámetros promovidos de los shots con su unidad con sentido y conversión
//   npm run metrics -- table k1 k2 …                            tabla comparativa (markdown) desde out/metrics/<clave>.json
//   npm run metrics -- doc                                      regenera docs/METRICAS.md desde engine/metrics/registry.mjs
// Film activo: `npm run use -- <film>` (o el nombre como argumento). Esquema: opus-metrics/1 (engine/metrics/registry.mjs).
import './help.mjs';
import { rootFrom } from './paths.mjs';
import { assertNotas } from './inputs.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { findFilm, announceFilm, filmId } from './filmid.mjs';
import { REGISTRY, byId, CONVENTIONS, SCHEMA } from './metrics/registry.mjs';
import { UNITS, dimOf } from './metrics/units.mjs';
import * as X from './metrics/mathx.mjs';

const ROOT = rootFrom(import.meta.url), OUT = path.join(ROOT, 'out/metrics');
const argv = process.argv.slice(2), has = (k) => argv.includes(k), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const VALS = ['--fps', '--timeline'], pos = argv.filter((a, i) => !a.startsWith('--') && !VALS.includes(argv[i - 1]));
const CMDS = ['compare', 'calibrate', 'units', 'doc', 'table'], cmd = CMDS.includes(pos[0]) ? pos[0] : 'run', rest = cmd === 'run' ? pos : pos.slice(1);
const fmt = (v) => (v == null ? '—' : typeof v === 'number' ? (Math.abs(v) >= 1000 ? v.toFixed(0) : +v.toPrecision(4)).toString() : typeof v === 'object' ? Object.entries(v).map(([k, x]) => `${k} ${x}`).join(' · ') : String(v));
const ci = (m) => (m.ci ? `[${fmt(m.ci[0])}, ${fmt(m.ci[1])}]` : '—');
const SPARK = '▁▂▃▄▅▆▇█', spark = (v) => v.filter((_, i) => i % 2 === 0).map((x) => SPARK[Math.min(7, Math.floor(x * 8))]).join('');

async function measureFilm(name, { fresh = true } = {}) {
  const tl = name ? findFilm(name) : null; if (name && !tl) { console.error(`no encuentro el film «${name}»`); process.exit(1); }
  if (tl) process.argv.push('--timeline', tl);
  const { resolveFilm } = await import('./filmid.mjs'), f = resolveFilm(), key = f.key; announceFilm(); const file = path.join(OUT, `${key}.json`);
  if (!fresh && fs.existsSync(file)) return { key, res: JSON.parse(fs.readFileSync(file, 'utf8')), file };
  const { measureTimeline } = await import('./metrics/measure.mjs');
  const res = await measureTimeline(f.timeline, { sampleFps: arg('--fps') ? +arg('--fps') : 'auto', audio: has('--no-audio') ? false : 'auto' });
  fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(file, JSON.stringify(res, null, 1) + '\n'); fs.writeFileSync(path.join(OUT, `${key}.md`), card(key, res));
  return { key, res, file };
}
export function card(key, r) {
  const L = [`# Ficha de métricas — ${key}`, '', `Esquema \`${r.schema}\` · ${r.film.duration} s · ${r.film.width}×${r.film.height} @ ${r.film.fps} fps · estilo ${r.film.style}${r.film.medium ? ' · medio ' + r.film.medium : ''}`, `Convenciones: focal base ${r.params.refFocalMm} mm eq., visionado ${r.params.viewingH}H, tolerancia de pulso ${r.params.beatTolMs} ms, muestreo ${r.params.sampleFps} Hz. Los IC son al 95 % salvo que \`notes\` diga otra cosa.`, ''];
  for (const dom of [...new Set(r.metrics.map((m) => m.domain))]) {
    L.push(`## ${dom}`, '', '| métrica | valor | unidad | IC95 | conf. | n | método / notas |', '|---|---|---|---|---|---|---|');
    for (const m of r.metrics.filter((x) => x.domain === dom)) L.push(`| ${m.name} (\`${m.id}\`) | **${fmt(m.value)}** | ${m.unit} | ${ci(m)} | ${m.confidence} | ${m.n ?? ''} | ${(m.notes ?? '').replace(/\|/g, '/')} |`);
    L.push('');
  }
  if (Object.keys(r.series ?? {}).length) { L.push('## series (tiempo normalizado 0→1, 100 muestras)', ''); for (const [k, s] of Object.entries(r.series)) L.push(`- **${k}** \`${spark(s.v)}\`  ${s.components ? '(componentes: ' + s.components.join(', ') + ')' : s.unit}`); L.push(''); }
  return L.join('\n');
}

function typicalOf(id) { const t = byId[id]?.typical; return t ? Object.entries(t)[0] : null; }
export function compareResults(a, b) {
  const rows = [];
  for (const ma of a.metrics) { const mb = b.metrics.find((m) => m.id === ma.id); if (!mb || typeof ma.value !== 'number' || typeof mb.value !== 'number') continue;
    const sg = (m) => (m.ci ? (m.ci[1] - m.ci[0]) / 2 / 1.96 : 0), d = mb.value - ma.value, se = Math.hypot(sg(ma), sg(mb)), z = se > 1e-12 ? d / se : Math.sign(d) * Infinity * (Math.abs(d) > 1e-9 ? 1 : 0);
    const t = typicalOf(ma.id), width = t ? t[1][1] - t[1][0] : null, norm = width ? d / width : d / ((Math.abs(ma.value) + Math.abs(mb.value)) / 2 || 1);
    rows.push({ id: ma.id, unit: ma.unit, a: ma.value, b: mb.value, delta: d, z: Number.isFinite(z) ? z : null, normalized: norm, normBy: width ? `rango típico «${t[0]}» (${width})` : 'media de ambos', significant: Math.abs(z) > 2 || (!se && Math.abs(d) > 1e-9) }); }
  const curves = []; for (const [k, sa] of Object.entries(a.series ?? {})) { const sb = b.series?.[k]; if (sb) curves.push({ series: k, l2: X.l2(sa.v, sb.v), dtw: X.dtw(sa.v, sb.v, 0.1), spearman: X.spearman(sa.v, sb.v) }); }
  return { schema: SCHEMA, a: a.film.title, b: b.film.title, rows, curves };
}

if (cmd === 'doc') { const { renderDoc } = await import('./metrics/doc.mjs'); fs.writeFileSync(path.join(ROOT, 'docs/METRICAS.md'), renderDoc()); console.log(`→ docs/METRICAS.md (${REGISTRY.length} métricas)`); }
else if (cmd === 'table') {
  const R = rest.map((k) => JSON.parse(fs.readFileSync(path.join(OUT, `${k}.json`), 'utf8'))), L = [`| métrica | unidad | ${rest.join(' | ')} |`, `|---|---|${rest.map(() => '---').join('|')}|`];
  for (const m of REGISTRY) { const cells = R.map((r) => { const x = r.metrics.find((q) => q.id === m.id); return x?.value == null ? '—' : x.ci && typeof x.value === 'number' ? `${fmt(x.value)} ±${fmt((x.ci[1] - x.ci[0]) / 2)}` : fmt(x.value); }); L.push(`| \`${m.id}\` | ${m.unit} | ${cells.join(' | ')} |`); }
  L.push('', 'Distancia entre curvas de tensión (L2 / DTW, tiempo normalizado):', '', `| | ${rest.join(' | ')} |`, `|---|${rest.map(() => '---').join('|')}|`);
  rest.forEach((a, i) => L.push(`| ${a} | ${rest.map((b, j) => { const sa = R[i].series?.tension, sb = R[j].series?.tension; return sa && sb ? `${X.l2(sa.v, sb.v).toFixed(2)} / ${X.dtw(sa.v, sb.v, 0.1).toFixed(2)}` : '—'; }).join(' | ')} |`));
  console.log(L.join('\n'));
}
else if (cmd === 'units') {
  announceFilm(); if (rest[0]) process.argv.push('--timeline', findFilm(rest[0]));
  const { loadFilm } = await import('./film.mjs'), { describeParams } = await import('./metrics/units.mjs'), film = await loadFilm(), rows = describeParams(film);
  if (has('--json')) console.log(JSON.stringify(rows, null, 1)); else for (const r of rows) console.log(`${r.shot}.${r.name}`.padEnd(14), String(r.unit ?? '—').padEnd(5), String(r.default).padEnd(8), r.converted ? `→ ${+r.converted.value.toPrecision(4)} ${r.converted.unit} (${r.converted.note})` : r.known ? '' : '¡unidad desconocida!');
}
else if (cmd === 'compare') {
  if (rest.length < 2) { console.error('uso: metrics compare <filmA> <filmB> [--fresh]'); process.exit(1); }
  const A = await measureFilm(rest[0], { fresh: has('--fresh') }); process.argv.splice(process.argv.indexOf('--timeline'), 2); delete globalThis.__opusFilmAnnounced;
  const Bm = await measureFilm(rest[1], { fresh: has('--fresh') }), C = compareResults(A.res, Bm.res);
  if (has('--json')) console.log(JSON.stringify(C, null, 1)); else {
    console.log(`${A.key}  vs  ${Bm.key}\n`); console.log('métrica'.padEnd(30), 'A'.padStart(10), 'B'.padStart(10), 'Δ'.padStart(10), 'z'.padStart(7), '  norm.  unidad');
    for (const r of C.rows) console.log(r.id.padEnd(30), fmt(r.a).padStart(10), fmt(r.b).padStart(10), fmt(r.delta).padStart(10), (r.z == null ? '∞' : r.z.toFixed(1)).padStart(7), (r.normalized.toFixed(2)).padStart(7), ' ', r.unit, r.significant ? ' *' : '');
    console.log('\ncurvas (tiempo normalizado):'); for (const c of C.curves) console.log(' ', c.series.padEnd(12), `L2=${c.l2.toFixed(3)}  DTW=${c.dtw.toFixed(3)}  ρ_Spearman=${c.spearman.toFixed(2)}`);
    console.log('\n* |z| > 2 (diferencia mayor que la incertidumbre combinada). norm. = Δ / anchura del rango típico, o relativa.');
  }
}
else if (cmd === 'calibrate') {
  const nf = path.join(ROOT, 'data/notas.json'), N = assertNotas(JSON.parse(fs.readFileSync(nf, 'utf8'))), use = N.notas.filter((n) => n.medible && typeof n.nota === 'number'), byFilm = {};
  console.log(`calibración nota ↔ métricas — ${use.length} notas medibles de ${N.notas.length}  (data/notas.json)`);
  console.log('ADVERTENCIA: n pequeño. Con n < 8 una correlación de Spearman no es evidencia (IC95 de ρ cubre casi [−1,1]); úsese solo para generar hipótesis.');
  for (const n of use) { byFilm[n.film] ??= await measureFilm(n.film, { fresh: false }).then((x) => x.res); delete globalThis.__opusFilmAnnounced; process.argv.splice(process.argv.indexOf('--timeline'), 2); }
  const rows = []; if (use.length >= 4) for (const r of REGISTRY.filter((m) => m.kind === 'scalar')) { const pairs = use.map((n) => [byFilm[n.film].metrics.find((m) => m.id === r.id)?.value, n.nota]).filter(([v]) => typeof v === 'number'); if (pairs.length >= 4) rows.push({ id: r.id, n: pairs.length, rho: X.spearman(pairs.map((p) => p[0]), pairs.map((p) => p[1])) }); }
  rows.sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho));
  if (has('--json')) console.log(JSON.stringify({ n: use.length, rows }, null, 1)); else if (!rows.length) console.log(`n=${use.length} < 4: insuficiente para correlacionar. Añade notas en data/notas.json (campo medible:true cuando la versión calificada = la versión medida).`); else for (const r of rows.slice(0, 15)) console.log(r.id.padEnd(30), `ρ=${r.rho.toFixed(2)}`.padEnd(9), `n=${r.n}`);
}
else {
  const name = rest[0], { key, res, file } = await measureFilm(name); if (!name) announceFilm();
  if (has('--json')) console.log(JSON.stringify(res, null, 1)); else { announceFilm(); console.log(card(key, res).split('\n').slice(0, 4).join('\n')); console.log(`→ ${path.relative(ROOT, file)} y .md  (${res.metrics.filter((m) => m.value != null).length}/${res.metrics.length} métricas con valor)`); }
}
