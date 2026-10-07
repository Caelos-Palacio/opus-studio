#!/usr/bin/env node
// Toolbox (spec 015): descubrimiento progresivo de herramientas. El agente NO lee el catálogo: lo consulta.
//   node engine/tools.mjs brief [--role director|td|animator|dp|review|investigador]   contexto mínimo (≤1 500 tokens)
//   node engine/tools.mjs find "<intención>" [--k 5] [--kind cli,prim,…] [--max-tokens N] [--json]   top-k, una línea por resultado
//   node engine/tools.mjs show <id>                        ficha completa de UNA herramienta
//   node engine/tools.mjs next <id|fase>                   qué suele seguir
//   node engine/tools.mjs plan ["<objetivo>"] [--max-tokens N] [--json]   3–5 pasos siguientes según el estado REAL del film
//   node engine/tools.mjs build [--check]                  regenera data/tools.index.json (--check: exit 1 si está caducado)
//   node engine/tools.mjs eval [--json]                    recall@3 sobre data/tools.eval.json
//   node engine/tools.mjs measure                          tokens de arranque: lista de lectura previa vs. brief
// Sin red ni LLM. Determinista. Registro: engine/toolbox.mjs (generado del código + data/tools.meta.json curado).
import './help.mjs';
import { isMain } from './paths.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, INDEX_FILE, META_FILE, EVAL_FILE, buildRegistry, serialize, makeIndex, search, synGroups, tokens } from './toolbox.mjs';

const rd = (p) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); } catch { return null; } };
const META = () => rd(META_FILE) ?? {};
export const loadIndex = () => rd(INDEX_FILE);
const clip = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1) + '…'; };
// Corta una lista de líneas al presupuesto de tokens (≈ chars/4), sin partir líneas.
export function fit(lines, maxTokens) {
  if (!maxTokens) return lines;
  const out = []; let used = 0;
  for (const l of lines) { const t = tokens(l + '\n'); if (used + t > maxTokens) { if (!out.length) out.push(clip(l, maxTokens * 4 - 2)); break; } out.push(l); used += t; }
  return out;
}

// ── find / show / next ───────────────────────────────────────────────────────────────────────────────────────────
export function line(e) { return `${e.id} · ${clip(e.resumen, 100)} · ${clip(e.uso ?? e.ejemplo, 80)}`; }
export function find(entries, q, { k = 5, kind = null } = {}) { return search(entries, q, { k, kind, groups: synGroups(META()) }); }
export function card(e) {
  const L = [`# ${e.id}  (${e.kind})`, e.resumen, '', `cuándo: ${e.cuando}`, `entra:  ${e.entra}`, `sale:   ${e.sale}`, `coste:  ${e.coste}`, `uso:    ${e.uso}`];
  if (e.ejemplo && e.ejemplo !== e.uso) L.push(`ej:     ${e.ejemplo}`);
  L.push(`tags:   ${e.tags.join(', ')}`);
  if (e.fases?.length) L.push(`fases:  ${e.fases.join(', ')}`);
  if (e.siguiente?.length) L.push(`siguiente: ${e.siguiente.join(' · ')}`);
  L.push(`fuente: ${e.src}`); return L.join('\n');
}
export function nextOf(entries, key) {
  const fases = META().fases ?? [], ix = fases.findIndex((f) => f.id === key);
  const by = new Map(entries.map((e) => [e.id, e]));
  if (ix >= 0) {
    const f = fases[ix], nx = fases[ix + 1], here = entries.filter((e) => e.fases?.includes(f.id)).map((e) => e.id).slice(0, 8);
    return [`fase ${f.id} (${f.nombre}): ${f.cmd} — ${f.porque}`, here.length ? `herramientas de la fase: ${here.join(' · ')}` : null, nx ? `siguiente fase: ${nx.id} → ${nx.cmd}` : 'última fase: tras el master, `peek`/`metrics` y la Lección en FUNDAMENTOS.md'].filter(Boolean);
  }
  const e = by.get(key); if (!e) return [`"${key}": no es un id ni una fase (fases: ${fases.map((f) => f.id).join(' ')})`];
  const L = [`tras ${e.id}:`, ...e.siguiente.map((s) => by.get(s) ? `  → ${line(by.get(s))}` : `  → ${s}`)];
  if (e.fases?.length) { const nx = fases[fases.findIndex((f) => f.id === e.fases[e.fases.length - 1]) + 1]; if (nx) L.push(`  fase siguiente: ${nx.id} → ${nx.cmd}`); }
  return L;
}

// ── estado real del film ─────────────────────────────────────────────────────────────────────────────────────────
export async function readState() {
  const S = { film: null, brief: false, styleSet: false, explainer: false, facts: false, audio: false, sound: false, nShots: 0, missing: [], story: null, narrFix: 0, lint: null, critic: null, gates: {}, mixed: false, master: null, handoffs: 0 };
  try {
    const { resolveFilm, filmFolder } = await import('./filmid.mjs'), f = resolveFilm(), tlp = path.join(ROOT, f.timeline);
    S.film = { key: f.key, timeline: f.timeline, source: f.source, exists: fs.existsSync(tlp) };
    const dir = filmFolder(f.timeline), has = (p) => fs.existsSync(path.join(ROOT, p));
    S.brief = has(dir ? path.join(dir, 'brief.md') : 'data/brief.md');
    let tl = null; try { tl = JSON.parse(fs.readFileSync(tlp, 'utf8')); } catch {}
    if (tl) {
      S.styleSet = !!tl.style; S.explainer = tl.profile === 'explainer' || tl.kind === 'explainer'; S.sound = !!tl.sound;
      S.audio = !!(tl.music || tl.sound || tl.audio || has(dir ? path.join(dir, 'audio.json') : 'data/audio.json'));
      const ids = (tl.shots ?? []).map((s) => s.id).filter(Boolean); S.nShots = ids.length;
      S.missing = ids.filter((id) => !has(`shots/${id}.mjs`) && !has(`shots/${id}.scene.json`));
    }
    try { const j = rd('data/facts.json'); S.facts = !!j && (Array.isArray(j) ? j.length : Object.keys(j).length) > 0; } catch {}
    S.mixed = has('out/sfx.json');
    S.master = has(f.key === 'main' ? 'out/master.mp4' : `out/${f.key}.mp4`) ? (f.key === 'main' ? 'out/master.mp4' : `out/${f.key}.mp4`) : null;
    try { const hf = path.join(ROOT, 'docs/handoff'); S.handoffs = fs.existsSync(hf) ? fs.readdirSync(hf).filter((x) => x.endsWith('.md') && Date.now() - fs.statSync(path.join(hf, x)).mtimeMs < 864e5).length : 0; } catch {}
    // veredictos (hash por contenido: barato, sin render)
    const V = await import('./verdict.mjs'), cur = V.currentHashes();
    S.lint = V.lintState(cur);
    const cv = V.readJSON(path.join(ROOT, 'out/critic.json')), rv = V.readJSON(path.join(ROOT, 'out/review', V.filmKey().replace(/\.edit$/, ''), 'verdict.json'));
    S.critic = cv && V.isFresh(cv, cur) ? { verdict: cv.verdict, fresh: true } : rv ? { verdict: rv.verdict, fresh: null } : { verdict: null, fresh: false };
    const GS = V.readJSON(path.join(ROOT, 'out/gates.json')) ?? {};
    for (const [g, s] of Object.entries(GS)) S.gates[g] = { status: s.status, fresh: V.isFresh(s, cur) };
    try {
      const sf = dir && has(path.join(dir, 'story.json')) ? path.join(dir, 'story.json') : has('data/story.json') ? 'data/story.json' : null;
      if (sf) {
        const st = rd(sf); S.story = st?.v === 2 ? 2 : 1;
        if (S.story === 2) { const N = await import('./narr.mjs'), r = N.analyzeOne(path.join(ROOT, sf), path.join(ROOT, f.timeline)); S.narrFix = r.issues.filter((i) => i.level === 'FIX').length; }
      }
    } catch {}
  } catch (e) { S.error = String(e.message).slice(0, 120); }
  return S;
}

// ── plan: estado → siguientes pasos (función pura) ───────────────────────────────────────────────────────────────
const PHASE_WORDS = {
  use: ['film activo', 'elegir film', 'fijar film', 'cambiar de film'], brief: ['brief', 'encargo'], estilo: ['estilo', 'look', 'paleta'], hechos: ['hechos', 'fuentes', 'datos'], audio: ['audio', 'pista', 'musica', 'beat'],
  timeline: ['timeline'], vinetas: ['vinetas', 'storyboard'], animatic: ['animatic'], shots: ['shots', 'shot', 'animar', 'producir', 'dibujar'], lint: ['lint', 'verificar', 'comprobar', 'validar', 'calidad'],
  review: ['critico', 'review', 'revision', 'revisar'], master: ['master', 'render final', 'exportar', 'entregar', 'terminar', 'mp4', 'film completo', 'producir un film', 'hacer el film'],
};
export function goalPhase(goal, fases) {
  const g = String(goal ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); if (!g.trim()) return null;
  let best = null; for (const f of fases) for (const w of PHASE_WORDS[f.id] ?? []) if (g.includes(w) && (!best || w.length > best.len)) best = { id: f.id, len: w.length };
  return best?.id ?? null;
}
const okGate = (S, g) => !!S.gates[g] && ['closed', 'forced'].includes(S.gates[g].status) && S.gates[g].fresh;
export function pipeline(S, key) {
  const lintOk = !!S.lint?.fresh && S.lint.verdict === 'SHIP', film = S.film?.key ?? '<film>', fix = S.lint?.fresh && S.lint.verdict === 'FIX';
  const shotsDone = S.nShots > 0 && !S.missing.length, criticOk = S.critic?.verdict === 'SHIP' && S.critic.fresh !== false, criticFix = S.critic?.verdict === 'FIX';
  const narrOk = !(S.story === 2 && S.narrFix > 0);
  const P = [
    { fase: 'use', done: S.film?.source !== 'demo', cmd: `npm run use -- <film>`, why: 'sin film activo las CLIs caen al demo en silencio' },
    { fase: 'brief', done: S.brief, cmd: 'completar data/<film>/brief.md (plantilla data/brief.template.md) y devolver 5 líneas', why: 'pieza, arco mute, look, ritmo y lo que no harás' },
    { fase: 'estilo', done: S.styleSet, cmd: 'node engine/style.mjs --list  (luego fija `style` y `profile` en el timeline)', why: 'el estilo sale del encargo: 3 adjetivos, energía, referencia' },
    ...(S.explainer ? [{ fase: 'hechos', done: S.facts, cmd: 'completar data/facts.json (cada afirmación con source)', why: 'explainer: sin fuente no entra' }] : []),
    { fase: 'audio', done: S.audio, cmd: 'node engine/audio.mjs --analyze <pista.wav>   (o --click / --cues)', why: 'el audio es el reloj del montaje' },
    { fase: 'timeline', done: S.nShots > 0, cmd: 'crear el timeline desde data/timeline.template.json y `npm run validate`', why: 'no hay shots en el timeline' },
    { fase: 'shots', done: shotsDone, cmd: S.missing.length > 1 ? `node engine/orch.mjs plan   (oleadas); falta código de: ${S.missing.slice(0, 6).join(' ')}${S.missing.length > 6 ? '…' : ''}` : `escribir shots/${S.missing[0] ?? '<ID>'}.mjs (o .scene.json) y \`node engine/lint.mjs --shot ${S.missing[0] ?? '<ID>'}\``, why: `${S.missing.length} de ${S.nShots} shots sin código` },
    { fase: 'lint', done: lintOk, cmd: fix ? 'OPUS_AGENT=1 npm run lint   (repara cada FIX en su shot; itera con lint --shot <ID>)' : 'OPUS_AGENT=1 npm run lint', why: fix ? 'el lint vigente está en FIX' : S.lint?.why ?? 'sin veredicto de lint', needs: ['shots'] },
    { fase: 'lint', done: narrOk, cmd: `OPUS_AGENT=1 npm run narr -- ${film}`, why: `story v2 con ${S.narrFix} FIX narrativos (el gate de master exige 0)`, needs: [] },
    { fase: 'review', done: criticOk, cmd: criticFix ? 'npm run critic   (hay FIX del crítico: repara los shots señalados y repite)' : 'npm run critic', why: criticFix ? 'crítico con FIX' : 'sin veredicto de crítico vigente (solo se pasa con lint SHIP)', needs: ['lint'] },
    { fase: 'master', done: !!S.mixed || !S.sound, cmd: 'npm run sound', why: 'mezcla sellada por hash antes del master', needs: ['review'], soft: true },
    { fase: 'master', done: !!S.master, cmd: 'node engine/gate.mjs verify  →  npm run master', why: 'el master exige lint SHIP vigente + 0 FIX narrativos (story v2) + crítico sin FIX; sin --force', needs: ['lint', 'review'], master: true },
  ];
  return P.map((p, i) => ({ ...p, n: i }));
}
// Devuelve {pasos, bloqueos, objetivo}. Nunca incluye `master` mientras el gate no pase.
export function nextSteps(S, goal = '', { fases = META().fases ?? [], max = 5 } = {}) {
  const P = pipeline(S, 'x'), target = goalPhase(goal, fases), tix = target ? fases.findIndex((f) => f.id === target) : fases.length;
  let pend = P.filter((p) => !p.done && fases.findIndex((f) => f.id === p.fase) <= tix);
  const pasos = [], bloqueos = [];
  const blockedBy = (p) => (p.needs ?? []).filter((nd) => P.some((q) => !q.done && q.fase === nd && !q.soft && q.n < p.n));
  for (const p of pend) {
    if (p.master) { const b = P.filter((q) => !q.done && !q.master && ['lint', 'review'].includes(q.fase) && !q.soft); if (b.length) { bloqueos.push(`master BLOQUEADO: ${b.map((q) => q.why).join(' · ')}`); continue; } if (!okGate(S, 'master') && S.lint?.fresh === false) { bloqueos.push('master BLOQUEADO: lint caducado'); continue; } }
    if (blockedBy(p).length) continue;
    pasos.push(p);
  }
  if (target === 'master' && !S.master && !pasos.some((p) => p.master) && !bloqueos.length) bloqueos.push('master aún no disponible');
  const fase = P.find((p) => !p.done)?.fase ?? 'master';
  return { fase, pasos: pasos.slice(0, max), bloqueos, objetivo: target, hecho: !pend.length };
}
export function renderPlan(S, goal, entries, { max = 5, maxTokens = 0 } = {}) {
  const R = nextSteps(S, goal, { max }), L = [];
  L.push(S.film ? `film: ${S.film.key} (${S.film.timeline}, fuente: ${S.film.source}) · fase: ${R.fase}` : 'film: ?');
  const g = (n) => (S.gates[n] ? `${S.gates[n].status}${S.gates[n].fresh ? '' : '(caducado)'}` : '—');
  L.push(`estado: brief ${S.brief ? '✓' : '✗'} · estilo ${S.styleSet ? '✓' : '✗'} · audio ${S.audio ? '✓' : '✗'} · shots ${S.nShots - S.missing.length}/${S.nShots} · lint ${S.lint?.verdict ? S.lint.verdict + (S.lint.fresh ? '' : '(caducado)') : '—'} · story ${S.story ? 'v' + S.story + (S.story === 2 ? ` (${S.narrFix} FIX narr)` : '') : '—'} · crítico ${S.critic?.verdict ?? '—'} · gates lint=${g('lint')} master=${g('master')} · master ${S.master ? '✓' : '—'}`);
  if (R.hecho && !R.bloqueos.length) L.push(S.master || R.objetivo !== 'master' ? 'Nada pendiente hasta ese objetivo. Siguiente: `npm run peek`, `npm run metrics`, y la Lección en FUNDAMENTOS.md.' : '');
  R.pasos.forEach((p, i) => { L.push(`${i + 1}. [${p.fase}] ${p.cmd}`); L.push(`   porque: ${p.why}`); });
  for (const b of R.bloqueos) L.push(`✗ ${b}`);
  if (S.handoffs) L.push(`↺ ${S.handoffs} handoff(s) recientes en docs/handoff: \`node engine/orch.mjs resume\` retoma sin releer.`);
  if (goal && entries?.length) { const hits = find(entries, goal, { k: 6 }).filter((h) => !(R.bloqueos.length && ['cli:master', 'cli:review', 'cli:plan'].includes(h.entry.id))).slice(0, 3); if (hits.length) { L.push(`herramientas para «${clip(goal, 50)}»:`); hits.forEach((h) => L.push('  ' + line(h.entry))); } }
  return fit(L.filter((x) => x !== ''), maxTokens);
}

// ── brief por rol ────────────────────────────────────────────────────────────────────────────────────────────────
const ROLES = ['director', 'td', 'animator', 'dp', 'review', 'investigador'];
export function brief(role, entries) {
  const M = META(), ctx = rd('data/ctx.json') ?? {}, C = ctx.roles?.[role] ?? {}, pkg = rd('package.json')?.scripts ?? {}, cmds = rd('data/commands.json') ?? {};
  const kinds = {}; for (const e of entries) kinds[e.kind] = (kinds[e.kind] ?? 0) + 1;
  const cmdLine = (C.cmds ?? []).map((c) => (cmds[c] ? `${c}=${cmds[c].join(' ')}` : pkg[c] ? `npm run ${c}` : null)).filter(Boolean);
  const L = [`# opus-studio · brief del rol ${role}  (generado: \`node engine/tools.mjs brief --role ${role}\`)`, '', `Rol: ${M.roles?.[role] ?? '—'}`, '', '## Pipeline (fase → comando · porqué)',
    ...(M.fases ?? []).map((f) => `- ${f.id}: ${f.cmd}  — ${f.porque}`), '', '## Reglas duras', ...(M.reglas ?? []).map((r) => `- ${r}`), '',
    `## Comandos de tu rol`, cmdLine.length ? cmdLine.map((c) => `- ${c}`).join('\n') : '- —', '', '## Trampas', ...[...(ctx.common?.traps ?? []), ...(C.traps ?? [])].map((t) => `- ${t}`), '',
    `## Catálogo (${entries.length} herramientas: ${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(' · ')}). NO lo leas: consúltalo`,
    '- `node engine/tools.mjs plan "<objetivo>"` → los 3–5 pasos siguientes del film activo, con comando exacto',
    '- `node engine/tools.mjs find "<intención en español>" [--kind cli,prim,…] [--k 5]` → qué herramienta usar',
    '- `node engine/tools.mjs show <id>` → ficha completa de UNA herramienta · `next <id|fase>` → qué suele seguir',
    '- Docs (solo si find/show no bastan): CINE.md (gusto), STYLES.md (estilos), docs/API.md (firmas), MOTOR.md (motor).'];
  let text = L.join('\n') + '\n';
  if (tokens(text) > 1500) text = text.slice(0, 1500 * 4 - 2) + '…\n';
  return text;
}

// ── medición: arranque antes/después ─────────────────────────────────────────────────────────────────────────────
export const BEFORE = ['CLAUDE.md', '.claude/skills/opus-studio/SKILL.md', 'CRAFT.md', 'CINE.md', 'STYLES.md', 'MOTOR.md', 'docs/API.md', 'STATUS.md', 'docs/HANDOFF.md', 'docs/ROADMAP.md'];
export function measure(entries) {
  const sz = (p) => { try { return tokens(fs.readFileSync(path.join(ROOT, p), 'utf8')); } catch { return 0; } };
  const before = BEFORE.map((p) => [p, sz(p)]), tb = before.reduce((s, [, t]) => s + t, 0);
  const ta = Math.max(...ROLES.slice(0, 5).map((r) => tokens(brief(r, entries)))), claude = sz('CLAUDE.md');
  return { before, totalBefore: tb, briefMax: ta, claude, after: claude + ta, catalogTokens: tokens(serialize(entries)) };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2), cmd = argv[0], has = (k) => argv.includes(k), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
  const VALS = new Set(['--k', '--kind', '--max-tokens', '--role', '--timeline']), pos = argv.slice(1).filter((a, i, A) => !a.startsWith('--') && !VALS.has(A[i - 1]));
  const maxTokens = +(arg('--max-tokens', 0)), print = (L) => console.log(fit(L, maxTokens).join('\n'));
  if (cmd === 'build') {
    const { entries, warnings } = await buildRegistry(), text = serialize(entries), cur = fs.existsSync(path.join(ROOT, INDEX_FILE)) ? fs.readFileSync(path.join(ROOT, INDEX_FILE), 'utf8') : null;
    for (const w of warnings) console.error('aviso: ' + w);
    if (has('--check')) { const ok = cur === text && !warnings.length; console.log(ok ? `OK  ${entries.length} herramientas vigentes` : `NO  ${cur === text ? 'avisos del registro' : 'data/tools.index.json caducado'} (node engine/tools.mjs build)`); process.exit(ok ? 0 : 1); }
    fs.writeFileSync(path.join(ROOT, INDEX_FILE), text); console.log(`✓ ${INDEX_FILE}: ${entries.length} herramientas (${tokens(text)} tokens en disco)`); return;
  }
  const idx = loadIndex() ?? (await buildRegistry()).entries;
  if (cmd === 'find') {
    const q = pos.join(' '); if (!q) { console.error('uso: tools find "<intención>"'); process.exit(2); }
    const R = find(idx, q, { k: +(arg('--k', 5)), kind: arg('--kind', null) });
    if (has('--json')) return console.log(JSON.stringify(R.map((r) => ({ id: r.entry.id, score: r.score, resumen: r.entry.resumen, uso: r.entry.uso })), null, 1));
    print(R.length ? R.map((r) => line(r.entry)) : [`sin resultados para «${q}»: prueba otros términos, o --kind (${[...new Set(idx.map((e) => e.kind))].join(',')})`]);
  } else if (cmd === 'show') {
    const e = idx.find((x) => x.id === pos[0]) ?? idx.find((x) => x.id.endsWith(':' + pos[0]));
    if (!e) { const h = find(idx, pos.join(' '), { k: 3 }); console.error(`no existe «${pos[0]}».${h.length ? ' ¿Quizá?\n' + h.map((x) => '  ' + x.entry.id).join('\n') : ''}`); process.exit(1); }
    print(card(e).split('\n'));
  } else if (cmd === 'next') print(nextOf(idx, pos[0] ?? ''));
  else if (cmd === 'plan') {
    const S = await readState();
    if (has('--json')) return console.log(JSON.stringify({ estado: S, ...nextSteps(S, pos.join(' ')) }, null, 1));
    print(renderPlan(S, pos.join(' '), idx));
  } else if (cmd === 'brief') {
    const role = arg('--role', 'director'); if (!ROLES.includes(role)) { console.error(`rol desconocido «${role}» (${ROLES.join(', ')})`); process.exit(2); }
    process.stdout.write(brief(role, idx));
  } else if (cmd === 'eval') {
    const R = await evaluate(idx); if (has('--json')) return console.log(JSON.stringify(R, null, 1));
    for (const x of R.rows) if (!x.ok) console.log(`✗ «${x.q}» esperado ${x.esperado.join('|')} · top3: ${x.top.join(' ')}`);
    console.log(`recall@3 = ${(R.recall * 100).toFixed(1)} % (${R.ok}/${R.n})`);
  } else if (cmd === 'measure') {
    const M = measure(idx); console.log(M.before.map(([p, t]) => `${String(t).padStart(6)}  ${p}`).join('\n'));
    console.log(`antes: ${M.totalBefore} tokens (lista de lectura de arranque)\ndespués: CLAUDE.md ${M.claude} + brief ≤${M.briefMax} = ${M.after} tokens (−${(100 - (100 * M.after) / M.totalBefore).toFixed(0)} %)\ncatálogo en disco (no se lee): ${M.catalogTokens} tokens`);
  } else console.log('Uso: node engine/tools.mjs brief|find|show|next|plan|build|eval|measure  (ver --help)');
}
export async function evaluate(entries = loadIndex() ?? [], file = EVAL_FILE) {
  const set = rd(file) ?? [], rows = set.map((c) => {
    const top = find(entries, c.q, { k: 3 }).map((r) => r.entry.id), esperado = c.esperado;
    const ok = top.some((id) => esperado.some((x) => (x.endsWith('*') ? id.startsWith(x.slice(0, -1)) : id === x)));
    return { q: c.q, esperado, top, ok };
  });
  const ok = rows.filter((r) => r.ok).length; return { n: rows.length, ok, recall: rows.length ? ok / rows.length : 0, rows };
}
if (isMain(import.meta.url)) main().catch((e) => { console.error('✗ ' + e.message); process.exit(2); });
