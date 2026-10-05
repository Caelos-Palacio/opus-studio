#!/usr/bin/env node
// Consulta del índice (sin render). Pensado para agentes: salida corta, --json para máquinas.
//   node engine/q.mjs                 resumen del film (una línea por shot)
//   node engine/q.mjs shot A2         ficha del shot (sin muestras)
//   node engine/q.mjs at 3.2          qué hay en pantalla en t (cajas normalizadas, cámara, primitivas)
//   node engine/q.mjs find "texto"    busca en ids, acción, textos, TeX, nodos
//   node engine/q.mjs tag tex         shots con una etiqueta (tex, particles, fx:bloom, cam:push, size:CU, out:morph…)
//   node engine/q.mjs stale           shots cuyo código/timeline cambió desde el índice
//   node engine/q.mjs sym [q̇]         símbolos físicos (TeX semántico) y en qué shots/tiempos aparecen
//   node engine/q.mjs issues [A2]     avisos/FIX del último lint (filtrables por shot)
//   node engine/q.mjs memoria [t]     capa conceptual (data/memoria.json) junto a la observada, sin mezclarlas (docs/MEMORIA.md)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadFilm } from './film.mjs';
import { filmName, plan } from './cut.mjs';

const [cmd = 'film', a1] = process.argv.slice(2).filter((x) => !x.startsWith('--') && !/\.json$/.test(x)), J = process.argv.includes('--json');
const dir = path.join(ROOT, 'out/index', filmName() + (process.env.OPUS_EDIT ? '.edit' : '')), F = path.join(dir, 'film.json');
// memoria [t]: capa CONCEPTUAL (data/memoria.json) junto a la OBSERVADA (índice), en secciones separadas: nunca se mezclan.
// No exige índice: sin él solo se muestra la conceptual.
if (cmd === 'memoria') {
  const M = await import('./memoria.mjs'), { mem, file } = M.loadMemoria(), ctx = M.contexto(mem), t = a1 == null ? null : +a1;
  const conceptual = t == null ? M.final(mem, ctx) : M.estado(mem, t, ctx);
  const I0 = fs.existsSync(F) ? JSON.parse(fs.readFileSync(F, 'utf8')) : null;
  const observada = I0 ? I0.shots.filter((s) => t == null || (t >= s.t[0] && t < s.t[1])).map((s) => ({ id: s.id, t: s.t, text: s.text, tags: s.tags })) : null;
  if (J) { console.log(JSON.stringify({ t, observada, conceptual: { src: file, hash: M.memHash(mem), ...conceptual } }, null, 1)); process.exit(0); }
  console.log(`── observada (índice de píxeles${I0 ? '' : ': sin índice, npm run index'}) ──`);
  for (const s of observada ?? []) console.log(`  ${s.id} ${s.t[0].toFixed(2)}–${s.t[1].toFixed(2)}s "${s.text.join(' | ')}" [${s.tags.join(' ')}]`);
  console.log(`── conceptual (${file}${t == null ? ', memoria al final' : `, t=${t}s`}) ──`);
  for (const a of conceptual.activos) console.log(`  ${a.peso.toFixed(2)} ${a.kind.padEnd(10)} ${a.id.padEnd(14)} «${a.lectura ?? a.label}»${a.por ? ` (releído por ${a.por})` : ''}`);
  if (conceptual.preguntas.length) console.log('  preguntas abiertas: ' + conceptual.preguntas.map((q) => q.id).join(' '));
  for (const r of conceptual.recuerdo.filter((x) => x.por)) console.log(`  recuerda ${r.concepto} ${JSON.stringify(r.tramo)}: «${r.antes ?? '—'}» → «${r.lectura}»`);
  process.exit(0);
}
if (!fs.existsSync(F)) { console.error('Sin índice: npm run index'); process.exit(1); }
const I = JSON.parse(fs.readFileSync(F, 'utf8')), out = (o, txt) => console.log(J ? JSON.stringify(o, null, 1) : txt);
const fmtT = (t) => `${t[0].toFixed(2)}–${t[1].toFixed(2)}s`, fb = (b) => `${b.kind}${b.role ? '/' + b.role : ''} "${(b.label ?? '').slice(0, 28)}" @(${b.x},${b.y}) ${b.w}×${b.h}`;

if (cmd === 'film') out(I, `${I.title} · ${I.style}/${I.profile} · ${I.duration}s @${I.fps} · lint ${I.lint?.verdict ?? '—'}\n` + I.shots.map((s) => `${s.id.padEnd(5)} ${fmtT(s.t).padEnd(13)} ${(s.size ?? '').padEnd(3)} ${s.cam?.move ?? 'static'}  "${s.text.join(' | ').slice(0, 40)}"  [${s.tags.join(' ')}]`).join('\n'));
else if (cmd === 'shot') {
  const s = I.shots.find((x) => x.id === a1); if (!s) throw new Error('no existe ' + a1); out(s, Object.entries(s).map(([k, v]) => `${k.padEnd(14)} ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n'));
  if (!J && fs.existsSync(path.join(ROOT, process.env.OPUS_MEMORIA ?? 'data/memoria.json'))) {   // capa conceptual aparte: conceptos anclados a este shot
    const { loadMemoria } = await import('./memoria.mjs'), { mem } = loadMemoria(), cs = mem.conceptos.filter((c) => (c.anclas ?? []).some((a) => a.shot === s.id || a.param?.startsWith(`/shots/${s.id}/`)));
    console.log('── conceptual (memoria) ──\n' + (cs.map((c) => `  ${c.kind.padEnd(10)} ${c.id}: ${c.label}`).join('\n') || '  (ningún concepto anclado)'));
  }
}
else if (cmd === 'at') {
  const t = +a1, act = I.shots.filter((s) => t >= s.t[0] && t < s.t[1]), res = act.map((s) => { const D = JSON.parse(fs.readFileSync(path.join(ROOT, s.detail), 'utf8')), smp = D.samples.reduce((p, q) => (Math.abs(q.t - t) < Math.abs(p.t - t) ? q : p)); return { id: s.id, ...smp }; });
  out(res, res.map((r) => `${r.id} (muestra t=${r.t}, u=${r.u})  cam z${r.cam.z} x${r.cam.x} y${r.cam.y} r${r.cam.r}  lum ${r.lum}\n` + r.boxes.map((b) => '  ' + fb(b)).join('\n') + (r.meta.length ? '\n' + r.meta.map((m) => `  ${m.prim} ${m.id ?? ''} @(${m.x},${m.y})`).join('\n') : '')).join('\n'));
} else if (cmd === 'find') { const q = String(a1).toLowerCase(), r = I.shots.filter((s) => [s.id, s.action, ...s.text, ...s.nodes].some((x) => String(x).toLowerCase().includes(q))); out(r.map((s) => s.id), r.map((s) => `${s.id} ${fmtT(s.t)}  ${s.action}`).join('\n') || '(nada)'); }
else if (cmd === 'tag') { const r = I.shots.filter((s) => s.tags.includes(a1)); out(r.map((s) => s.id), r.map((s) => `${s.id} ${fmtT(s.t)}`).join('\n') || '(nada)'); }
else if (cmd === 'stale') {
  const film = await loadFilm(), P = plan(film, { fps: film.fps, size: `${film.width}x${film.height}` }), cur = (id) => P.jobs.filter((j) => j.shots.includes(id)).map((j) => j.hash).join('.');
  const r = I.shots.filter((s) => cur(s.id) !== s.hash).map((s) => s.id), nuevos = film.shots.filter((s) => !I.shots.some((x) => x.id === s.id)).map((s) => s.id);
  out({ stale: r, new: nuevos }, r.length || nuevos.length ? `stale: ${r.join(' ') || '—'}   nuevos: ${nuevos.join(' ') || '—'}\n→ npm run index -- --changed` : 'índice al día');
} else if (cmd === 'sym') {                                                                // flujo semántico de la notación a lo largo del film
  const all = new Map(); for (const s of I.shots) for (const [k, t] of Object.entries(s.symbols ?? {})) { if (!all.has(k)) all.set(k, []); all.get(k).push([s.id, t]); }
  if (a1) { const r = all.get(a1) ?? []; out(r, r.length ? r.map(([id, t]) => `${a1} en ${id} desde t=${t}s`).join('\n') : '(no aparece)'); }
  else out(Object.fromEntries(all), [...all].sort((a, b) => a[1][0][1] - b[1][0][1]).map(([k, v]) => `${k.padEnd(4)} ${v.map(([id, t]) => `${id}@${t}`).join(' → ')}`).join('\n'));
} else if (cmd === 'issues') { const L = JSON.parse(fs.readFileSync(path.join(ROOT, 'out/lint.json'), 'utf8')), r = L.issues.filter((i) => !a1 || i.shot === a1); out(r, r.map((i) => `${i.level} ${i.shot} ${i.t}s ${i.problem} → ${i.remedy}`).join('\n') || '(sin avisos)'); }
else console.log('comandos: film | shot ID | at T | find TXT | tag TAG | sym [S] | stale | issues [ID] | memoria [T]   (--json)');
