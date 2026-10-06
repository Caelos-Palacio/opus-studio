#!/usr/bin/env node
// STATUS.md GENERADO desde el estado real (verdad documental). Nunca se edita a mano.
//   node engine/status.mjs           regenera STATUS.md
//   node engine/status.mjs --check   exit 1 si la parte ESTÁTICA (versionada: gates, specs, motor, tests) no coincide con STATUS.md
//   node engine/status.mjs --links   exit 1 si algún .md (raíz y docs/) tiene un enlace relativo roto
// Dos partes: ESTÁTICA (derivada de ficheros versionados: reproducible en CI, se verifica) y VIVA (veredictos, ramas, último run, ledger:
// depende de la máquina, se regenera pero no se compara). Un STATUS.md estático desfasado es un fallo de test.
import { isMain } from './paths.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, digest, verify, stats } from './ledger.mjs';
import { coverage, formatCoverageSummary } from './dsl-coverage.mjs';

const rd = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return null; } };
const rj = (f) => { try { return JSON.parse(rd(f)); } catch { return null; } };
const ls = (d) => { try { return fs.readdirSync(path.join(ROOT, d)).sort(); } catch { return []; } };
const git = (a) => spawnSync('git', ['-C', ROOT, ...a], { encoding: 'utf8' });
export const STATUS = path.join(ROOT, 'STATUS.md');
const B = ['<!-- estatico:inicio -->', '<!-- estatico:fin -->'];

function lastNote(md) {
  const m = /^## Calificaciones\s*\n([\s\S]*?)(?=^## |\s*$(?![\s\S]))/m.exec(md); if (!m) return null;
  const L = m[1].split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('(') && !/^\|?[-| ]+\|?$/.test(l));
  return L.length ? L.at(-1).replace(/^[-*]\s*/, '').replace(/^\||\|$/g, '').replace(/\s*\|\s*/g, ' · ').trim().slice(0, 160) : null;
}
export function staticPart() {
  const o = [], gates = rj('gates.json') ?? {}, pkg = rj('package.json') ?? {};
  o.push('## Gates', '', 'Definición (gates.json); el estado de cierre está en la parte viva.', '', '| gate | criterios | digest |', '|---|---|---|');
  for (const [g, c] of Object.entries(gates).filter(([k, v]) => !k.startsWith('_') && Array.isArray(v))) o.push(`| ${g} | ${c.map((x) => String(x).split('::')[0]).join('; ')} | \`${digest(c)}\` |`);
  o.push('', '## Specs', '', '| spec | título | última nota humana |', '|---|---|---|');
  for (const f of ls('docs/specs').filter((f) => /^\d{3}-.*\.md$/.test(f))) { const md = rd('docs/specs/' + f); o.push(`| [${f}](docs/specs/${f}) | ${(/^#\s+(.*)$/m.exec(md)?.[1] ?? f).replace(/\|/g, '/')} | ${lastNote(md)?.replace(/\|/g, '/') ?? 'sin nota'} |`); }
  o.push('', '## Motor', '', `- versión: ${pkg.version ?? '?'} (package.json) · módulos engine/: ${ls('engine').filter((f) => f.endsWith('.mjs')).length}`);
  const R = rj('roles.json'); o.push(`- roles: modo \`${R?.mode ?? '?'}\` (${Object.keys(R?.roles ?? {}).join(', ')}) · digest \`${digest(R)}\``);
  o.push(`- presupuestos: data/budgets.json digest \`${digest(rj('data/budgets.json'))}\``);
  o.push('', '## DSL de escenas (spec 010)', '', ...formatCoverageSummary(coverage(ROOT)));
  o.push('', '## Tests', '', `Archivos (test/*.mjs): ${ls('test').filter((f) => f.endsWith('.mjs')).map((f) => '`' + f + '`').join(' ') || 'ninguno'}`);
  return o.join('\n');
}
export async function livePart() {
  const o = [];
  o.push('## Veredictos', '');
  try {
    const V = await import('./verdict.mjs'), cur = V.currentHashes(), rdv = (f) => V.readJSON(path.join(ROOT, f));
    o.push(`Film activo: \`${cur.film}\` · engineHash \`${cur.engineHash}\` · filmHash \`${cur.filmHash}\``, '');
    for (const f of ['out/lint.json', 'out/critic.json']) { const v = rdv(f); o.push(`- ${f}: ${v ? `${v.verdict}${v.partial ? ' (parcial)' : ''} · ${V.isFresh(v, cur) ? 'VIGENTE' : 'CADUCADO'}` : 'no existe'}`); }
    const dir = path.join(ROOT, 'out/lint', cur.film), shots = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_')) : [];
    const fr = shots.filter((f) => V.isFresh(V.readJSON(path.join(dir, f)), cur)); o.push(`- veredictos por shot: ${fr.length} vigentes, ${shots.length - fr.length} caducados`);
  } catch (e) { o.push(`(no evaluable: ${String(e.message).split('\n')[0]})`); }
  o.push('', '### Estado de gates (out/gates.json)', '');
  const G = rj('out/gates.json') ?? {}; o.push(Object.keys(G).length ? Object.entries(G).map(([g, s]) => `- ${g}: ${s.status}${s.fails ? ` (${s.fails} fallos seguidos)` : ''}${s.filmHash ? ` · filmHash ${s.filmHash}` : ''}`).join('\n') : '- sin cierres registrados');
  o.push('', '## Ramas sin integrar', '');
  const base = git(['rev-parse', '--verify', '-q', 'main']).status === 0 ? 'main' : null;
  if (!base) o.push('(sin git o sin rama main)'); else {
    const br = git(['branch', '--no-merged', base, '--format=%(refname:short)']).stdout.split('\n').filter(Boolean);
    o.push(br.length ? br.slice(0, 30).map((b) => `- \`${b}\` (+${git(['rev-list', '--count', `${base}..${b}`]).stdout.trim()} commits)`).join('\n') + (br.length > 30 ? `\n- … y ${br.length - 30} más` : '') : '- ninguna');
  }
  o.push('', '## Último run de tests', '');
  const T = rj('out/tests.json'); o.push(T ? `- ${T.ts}: ${T.fail ? `${T.fail} fallos` : 'todo verde'}${T.fast ? ' (--fast)' : ''}` : '- sin out/tests.json (lo escribe `npm test`)');
  o.push('', '## Ledger', '');
  const v = verify(), s = stats(); o.push(`- cadena: ${v.ok ? 'íntegra' : `ROTA (${v.problems.length} problemas)`} · ${v.n} entradas (${v.chained} encadenadas, ${v.legacy} heredadas, ${v.signed} firmadas) · códigos ${s.total ? (100 * s.coded / s.total).toFixed(0) : 0} %`);
  o.push('', '## Presupuestos', '');
  try {
    const { loadBudgets, checkBudget } = await import('./budget.mjs'), Bd = loadBudgets(), n0 = o.length;
    if (!Bd) o.push('- sin data/budgets.json');
    else { for (const r of Object.keys(Bd.tokens?.perRole ?? {})) { const c = checkBudget({ kind: 'tokens', role: r }, { log: false }); if (c.used) o.push(`- tokens ${r}: ${c.used}/${c.limit} (${c.level})`); } if (o.length === n0) o.push('- sin consumo registrado'); }
  } catch { o.push('- no evaluable'); }
  return o.join('\n');
}
export async function generate() {
  return `# STATUS\n\n> GENERADO por \`node engine/status.mjs\`; no se edita a mano. La parte estática se verifica en \`npm test\` (desactualizada = fallo).\n\n${B[0]}\n${staticPart()}\n${B[1]}\n\n---\n## Estado vivo (${new Date().toISOString().slice(0, 16)}Z, no verificado)\n\n${await livePart()}\n`;
}
export function checkStatic() {
  const cur = rd('STATUS.md'); if (cur === null) return { ok: false, why: 'STATUS.md no existe' };
  const a = cur.indexOf(B[0]), b = cur.indexOf(B[1]); if (a < 0 || b < 0) return { ok: false, why: 'STATUS.md sin marcadores estáticos' };
  return cur.slice(a + B[0].length + 1, b - 1) === staticPart() ? { ok: true } : { ok: false, why: 'la parte estática difiere del estado versionado' };
}
// Enlaces: [t](ruta) relativos y `docs/....md` / `X.md` entre comillas invertidas (rutas reales, sin <placeholders> ni globs).
export function brokenLinks() {
  const files = [...ls('.').filter((f) => f.endsWith('.md')), ...(function walk(d) { return ls(d).flatMap((f) => { const p = d + '/' + f; return fs.statSync(path.join(ROOT, p)).isDirectory() ? walk(p) : p.endsWith('.md') ? [p] : []; }); })('docs')];
  const bad = [];
  for (const f of files) {
    const md = rd(f).replace(/```[\s\S]*?```/g, ''), dir = path.dirname(f);
    const chk = (t, kind) => { t = t.split('#')[0].split('?')[0]; if (!t || /^[a-z]+:/i.test(t)) return; const p = t.startsWith('/') ? t.slice(1) : path.posix.join(dir, t); if (!fs.existsSync(path.join(ROOT, p))) bad.push(`${f}: ${kind} → ${t}`); };
    for (const m of md.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) chk(m[1], 'enlace');
    for (const m of md.matchAll(/`((?:docs\/)[\w./-]+\.md)`/g)) { const p = m[1]; if (!fs.existsSync(path.join(ROOT, p))) bad.push(`${f}: ruta → ${p}`); }
  }
  return bad;
}
if (isMain(import.meta.url)) {
  const a = process.argv.slice(2);
  if (a.includes('--links')) { const b = brokenLinks(); for (const x of b) console.log('✗ ' + x); console.log(b.length ? `✗ ${b.length} enlaces rotos` : '✓ sin enlaces rotos'); process.exit(b.length ? 1 : 0); }
  else if (a.includes('--check')) { const c = checkStatic(); console.log(c.ok ? '✓ STATUS.md al día' : `✗ STATUS.md desactualizado: ${c.why} → node engine/status.mjs`); process.exit(c.ok ? 0 : 1); }
  else if (a.includes('--print')) console.log(await generate());
  else { fs.writeFileSync(STATUS, await generate()); console.log('→ STATUS.md'); }
}
