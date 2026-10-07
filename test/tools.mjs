#!/usr/bin/env node
// Spec 015 (toolbox): registro al día, contrato meta, búsqueda (recall@3 ≥ 0,85), plan (estado → siguiente acción; sin master si el gate no pasa), brief ≤ 1 500 tokens.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './lib.mjs';
import { buildRegistry, serialize, validateMeta, search, synGroups, tokens, INDEX_FILE } from '../engine/toolbox.mjs';
import { nextSteps, renderPlan, readState, brief, fit, evaluate, find, nextOf, card } from '../engine/tools.mjs';

let n = 0, bad = 0;
const ok = (m, c, info = '') => { n++; console.log(`${c ? '✓' : '✗'} tools: ${m}${info ? '  ' + info : ''}`); if (!c) bad++; };
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

// ── 1. registro al día (como `dsl build --check`) ──
const { entries, warnings } = await buildRegistry();
const onDisk = fs.existsSync(path.join(ROOT, INDEX_FILE)) ? fs.readFileSync(path.join(ROOT, INDEX_FILE), 'utf8') : '';
ok('data/tools.index.json está al día (node engine/tools.mjs build)', onDisk === serialize(entries));
ok('sin avisos del registro (ids huérfanos, siguiente inexistente, meta inválido)', warnings.length === 0, warnings.slice(0, 2).join(' | '));
ok('ids únicos y ordenados', new Set(entries.map((e) => e.id)).size === entries.length && entries.every((e, i) => !i || entries[i - 1].id < e.id));
ok('toda entrada tiene id, kind, resumen, tags, cuándo, coste, ejemplo y fuente', entries.every((e) => e.id.startsWith(e.kind + ':') && e.resumen && e.tags.length && e.cuando && e.coste && e.ejemplo && e.src));
const kinds = (k) => entries.filter((e) => e.kind === k);
const pkg = rd('package.json'), P = await import('../engine/prims.mjs'), C = await import('../engine/dsl-core.mjs'), MR = await import('../engine/metrics/registry.mjs'), S = await import('../engine/sound.mjs');
await import('../engine/sakuga.mjs');
ok('cada script de package.json está en el registro', Object.keys(pkg.scripts).every((s) => entries.some((e) => e.id === `cli:${s}`)));
ok('cada primitiva de DOC (prims+sakuga) está', Object.keys(P.DOC).every((k) => entries.some((e) => e.id === `prim:${k}`)));
ok('cada tipo del DSL (TYPES) está', Object.keys(C.TYPES).every((k) => entries.some((e) => e.id === `dsl:${k}`)));
ok('cada métrica del registry está', MR.REGISTRY.every((m) => entries.some((e) => e.id === `metrica:${m.id}`)));
ok('cada voz de sonido está', Object.keys(S.VOICES).every((k) => entries.some((e) => e.id === `voz:${k}`)));
ok('medios, estilos de sonido y estilos salen de styles/', kinds('medio').length === fs.readdirSync(path.join(ROOT, 'styles/medios')).filter((f) => f.endsWith('.json')).length && kinds('sonido').length === fs.readdirSync(path.join(ROOT, 'styles/sound')).length && kinds('estilo').length >= 10);
ok('checks del lint (etapas+reglas), narr y arc salen del vocabulario', ['check:layout', 'check:fondo.vacio', 'check:cliche.apertura'].every((id) => entries.some((e) => e.id === id)));
const M = rd('data/tools.meta.json');
ok('los cmd de los extras apuntan a scripts que existen', Object.values(M.extra).every((x) => !x.script || fs.existsSync(path.join(ROOT, x.script))));
ok('las fases del meta cubren el pipeline y sus ids son únicos', M.fases.length >= 10 && new Set(M.fases.map((f) => f.id)).size === M.fases.length);

// ── 2. contrato meta (fondos / objetos): tolerante a que aún no exista ──
const good = { id: 'niebla', resumen: 'niebla por capas con parallax y deriva', tags: ['niebla'], params: { densidad: 'number', color: 'color', modo: 'enum' } };
ok('validateMeta acepta un meta válido', validateMeta(good).length === 0);
ok('validateMeta rechaza resumen > 15 palabras', validateMeta({ ...good, resumen: 'a b c d e f g h i j k l m n o p' }).some((p) => /15/.test(p)));
ok('validateMeta rechaza tipo de param desconocido, tags vacíos e id mayúscula', validateMeta({ ...good, params: { x: 'float' } }).length === 1 && validateMeta({ ...good, tags: [] }).length === 1 && validateMeta({ ...good, id: 'Niebla' }).length === 1);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tools-'));
try {
  fs.mkdirSync(path.join(tmp, 'engine')); fs.writeFileSync(path.join(tmp, 'package.json'), '{"scripts":{}}');
  const r0 = await buildRegistry({ root: tmp });
  ok('sin módulos fondos/objetos el registro se construye (tolerante)', Array.isArray(r0.entries) && !r0.entries.some((e) => ['fondo', 'objeto'].includes(e.kind)));
  fs.writeFileSync(path.join(tmp, 'engine/fondos.mjs'), `export const META = [${JSON.stringify(good)}, {"id":"malo","resumen":"","tags":[],"params":{}}];`);
  fs.writeFileSync(path.join(tmp, 'engine/objetos.mjs'), `export const META = [{"id":"farola","resumen":"farola con halo","tags":["luz"],"params":{"altura":"number"}}];`);
  const r1 = await buildRegistry({ root: tmp }), f = r1.entries.find((e) => e.id === 'fondo:niebla'), o = r1.entries.find((e) => e.id === 'objeto:farola');
  ok('un META válido entra como fondo:<id> y objeto:<id> con sus params', !!f && !!o && /densidad:number/.test(f.entra) && o.kind === 'objeto');
  ok('un META inválido no entra y deja aviso', !r1.entries.some((e) => e.id === 'fondo:malo') && r1.warnings.some((w) => /malo/.test(w)));
  const hit = search(r1.entries, 'niebla con parallax', { k: 1 })[0];
  ok('el meta de fondos es buscable', hit?.entry.id === 'fondo:niebla');
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

// ── 3. búsqueda ──
const E = await evaluate(entries);
ok(`≥ 25 intenciones de evaluación`, E.n >= 25, `n=${E.n}`);
ok(`recall@3 ≥ 0,85`, E.recall >= 0.85, `${(E.recall * 100).toFixed(1)} % (${E.ok}/${E.n})${E.rows.filter((x) => !x.ok).map((x) => ' ✗«' + x.q + '»').join('')}`);
const a = JSON.stringify(find(entries, 'poner niebla en el fondo')), b = JSON.stringify(find(entries, 'poner niebla en el fondo'));
ok('búsqueda determinista', a === b);
ok('--kind filtra', find(entries, 'niebla', { k: 10, kind: 'prim' }).every((r) => r.entry.kind === 'prim'));
ok('los sinónimos del canon expanden (reveal → revelación)', synGroups(M).some((g) => g.includes('reveal'.slice(0, 6)) && g.includes('revela')) || find(entries, 'reveal', { k: 3 }).length > 0);
const lines = find(entries, 'mezclar sonido', { k: 8 }).map((r) => `${r.entry.id} · ${r.entry.resumen}`);
ok('--max-tokens se respeta', tokens(fit(lines, 60).join('\n')) <= 60 && fit(lines, 60).length < lines.length);
const cli = spawnSync(process.execPath, ['engine/tools.mjs', 'find', 'poner niebla en el fondo', '--k', '8', '--max-tokens', '50'], { cwd: ROOT, encoding: 'utf8' });
ok('CLI find respeta --max-tokens y acierta', cli.status === 0 && tokens(cli.stdout) <= 52 && /prim:atmos/.test(cli.stdout), `${tokens(cli.stdout)} tok`);
const sh = spawnSync(process.execPath, ['engine/tools.mjs', 'show', 'cli:peek'], { cwd: ROOT, encoding: 'utf8' });
ok('show devuelve la ficha completa de UNA herramienta', sh.status === 0 && /cuándo:/.test(sh.stdout) && /coste:/.test(sh.stdout) && /siguiente:/.test(sh.stdout) && sh.stdout.split('# ').length === 2 && card(entries.find((e) => e.id === 'cli:peek')) === sh.stdout.trimEnd());
ok('next: de una herramienta y de una fase', nextOf(entries, 'cli:lint').some((l) => /cli:critic/.test(l)) && nextOf(entries, 'lint').some((l) => /siguiente fase: review/.test(l)));

// ── 4. plan: estado → siguiente acción ──
const fases = M.fases;
const base = { film: { key: 'mate', timeline: 'data/mate/timeline.json', source: 'use', exists: true }, brief: true, styleSet: true, explainer: false, facts: true, audio: true, sound: true, nShots: 8, missing: [], story: 1, narrFix: 0, lint: { verdict: 'SHIP', fresh: true }, critic: { verdict: 'SHIP', fresh: true }, gates: {}, mixed: true, master: null, handoffs: 0 };
const txt = (R) => R.pasos.map((p) => p.cmd).join('\n'), withS = (o) => ({ ...base, ...o });
let R = nextSteps(withS({ lint: { verdict: null, fresh: false, why: 'sin out/lint.json' } }), 'hacer el master', { fases });
ok('sin lint vigente: pide lint y NO sugiere master', /npm run lint/.test(txt(R)) && !R.pasos.some((p) => p.master) && R.bloqueos.some((b) => /master BLOQUEADO/.test(b)));
R = nextSteps(withS({ critic: { verdict: 'FIX', fresh: true } }), 'master', { fases });
ok('crítico en FIX: no hay master; pide reparar y critic', !R.pasos.some((p) => p.master) && /critic/.test(txt(R)));
R = nextSteps(withS({ story: 2, narrFix: 3 }), 'master', { fases });
ok('story v2 con FIX narrativos: no hay master y nombra narr', !R.pasos.some((p) => p.master) && /narr/.test(txt(R)) && R.bloqueos.length > 0);
R = nextSteps(base, 'master', { fases });
ok('todo vigente: el siguiente paso es el master (gate verify → master)', R.pasos.length === 1 && R.pasos[0].master && /gate\.mjs verify/.test(R.pasos[0].cmd) && R.bloqueos.length === 0);
R = nextSteps(withS({ master: 'out/mate.mp4' }), 'master', { fases });
ok('con master hecho: nada pendiente', R.pasos.length === 0 && R.hecho);
R = nextSteps(withS({ missing: ['A1', 'A2', 'A3'], lint: { verdict: null, fresh: false, why: 'x' } }), '', { fases });
ok('shots sin código: orch plan (oleadas) antes que lint; lint espera a los shots', /orch\.mjs plan/.test(R.pasos[0].cmd) && !R.pasos.some((p) => p.fase === 'lint' && /npm run lint/.test(p.cmd)));
R = nextSteps(withS({ film: { ...base.film, source: 'demo' }, brief: false, styleSet: false, audio: false, nShots: 0, lint: null, critic: { verdict: null }, mixed: false }), '', { fases });
ok('film vacío sobre el demo: 3–5 pasos, empieza por use y sigue el orden del pipeline', R.pasos.length >= 3 && R.pasos.length <= 5 && R.pasos[0].fase === 'use' && R.pasos.map((p) => p.fase).join() === [...R.pasos.map((p) => p.fase)].sort((x, y) => fases.findIndex((f) => f.id === x) - fases.findIndex((f) => f.id === y)).join());
ok('explainer sin hechos: pide data/facts.json antes del audio', /facts\.json/.test(txt(nextSteps(withS({ explainer: true, facts: false, audio: false }), '', { fases }))));
ok('plan reproducible: mismo estado → misma salida', JSON.stringify(nextSteps(base, 'lint', { fases })) === JSON.stringify(nextSteps(base, 'lint', { fases })));
const real = await readState(), lp = renderPlan(real, 'producir un film hasta el master', entries);
ok('estado real legible (film activo, lint, gates) y plan con comando exacto', !!real.film?.key && lp[0].startsWith('film: ') && lp.some((l) => /^1\. \[/.test(l)), lp[0]);
ok('plan respeta --max-tokens', tokens(fit(lp, 40).join('\n')) <= 40);
ok('plan con gate roto no sugiere `npm run master` como paso', !(!real.lint?.fresh && lp.some((l) => /^\d\. \[master\]/.test(l))));

// ── 5. brief por rol ──
for (const role of ['director', 'td', 'animator', 'dp', 'review']) {
  const t = brief(role, entries);
  ok(`brief ${role} ≤ 1 500 tokens, con pipeline, reglas y find/show`, tokens(t) <= 1500 && /## Pipeline/.test(t) && /Reglas duras/.test(t) && /tools\.mjs find/.test(t) && /show <id>/.test(t) && /NUNCA push/.test(t), `${tokens(t)} tok`);
}
ok('brief determinista', brief('animator', entries) === brief('animator', entries));
ok('brief reduce el arranque ≥ 80 % frente a la lista de lectura previa', (() => { const sz = (p) => tokens(fs.readFileSync(path.join(ROOT, p), 'utf8')); const before = ['CLAUDE.md', '.claude/skills/opus-studio/SKILL.md', 'CRAFT.md', 'CINE.md', 'STYLES.md', 'MOTOR.md', 'docs/API.md', 'STATUS.md', 'docs/HANDOFF.md', 'docs/ROADMAP.md'].reduce((s, p) => s + sz(p), 0); return sz('CLAUDE.md') + tokens(brief('director', entries)) <= 0.2 * before; })());

console.log(`\ntools: ${n - bad}/${n}`);
process.exit(bad ? 1 : 0);
