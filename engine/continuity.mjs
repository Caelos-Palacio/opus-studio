// Continuidad de agentes (orquestación al límite): que un corte (límite de uso, watchdog, kill) nunca pierda trabajo ni contexto.
//   · latido   `orch beat <tarea> --step "…"`: ledger orch.beat + lease durable task/<tarea> + handoff tipado actualizado
//   · handoff  docs/handoff/<tarea>.json (esquema $defs.handoff de data/orch.schema.json) + .md legible; `orch handoff <f.json>`
//   · estado   por tarea, derivado del ledger: activo | cortado (lease caducado sin deliver/done) | hecho; cortes = huecos > TTL
//   · política ≥ maxCuts cortes → partir en subtareas o escalar; ≥ taskBudget → no reanudar (escalar al Director)
//   · worktrees: status / wip (commits WIP seguros: nunca en merge/rebase/conflictos/index.lock) / mensaje de reanudación ≤300 tokens
// Una sola implementación: `orch resume`, `orch beat`, `orch handoff` y la fachada tools/agentes.mjs (hook SubagentStop/Stop).
// Sin shell: git por execFileSync con argv.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, record, who, digest } from './ledger.mjs';
import { claim, releaseTarget, holder, writeAtomic } from './lock.mjs';
import { validate } from './schema.mjs';
import { resolveCommand } from './command.mjs';

export const DEF = { beatTtlMs: 900000, maxCuts: 2, taskBudget: 3 };
const rdJ = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
export const cfg = (root = ROOT) => ({ ...DEF, ...(rdJ(path.join(root, 'orch.json')) ?? {}) });
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const gitRaw = (cwd, ...a) => { try { return execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
export const git = (cwd, ...a) => gitRaw(cwd, ...a)?.trim() ?? null;
class CErr extends Error {}
const die = (m) => { throw new CErr(m); };
export { CErr };

// ── handoff tipado ─────────────────────────────────────────────────────────────────────────────────────────────────
const SCHEMA = () => rdJ(path.join(ROOT, 'data/orch.schema.json'));
export function handoffErrors(H) {
  const S = SCHEMA(), errs = validate(H, S.$defs.handoff, S).filter((e) => e.level === 'FIX').map((e) => `${e.path}: ${e.message}`);
  if (!errs.length) for (const [i, v] of H.verificacion.entries()) { const r = resolveCommand(v); if (!r.ok) errs.push(`verificacion[${i}]: ${r.why}`); }   // argv/ID permitidos, nunca shell
  return errs;
}
export const handoffFile = (tarea, root = ROOT, ext = 'json') => path.join(root, 'docs/handoff', `${tarea}.${ext}`);
export const readHandoff = (tarea, root = ROOT) => rdJ(handoffFile(tarea, root));
export function renderMd(H) {
  const L = (a) => (a.length ? a.map((x) => `- ${x}`) : ['- —']);
  return ['# Handoff — ' + H.tarea, '', `Rama \`${H.rama}\` · worktree \`${H.worktree}\``, '', '## Objetivo', H.objetivo, '', '## Hecho', ...L(H.hecho), '', '## Pendiente', ...L(H.pendiente), '', '## Siguiente', H.siguiente || '—', '',
    '## Verificación (argv, sin shell)', ...L(H.verificacion.map((v) => '`' + (Array.isArray(v) ? v.join(' ') : v) + '`')), '', '## Riesgos', ...L(H.riesgos), '', '_Generado por `orch handoff` (esquema $defs.handoff); edita el .json._', ''].join('\n');
}
export function writeHandoff(H, root = ROOT) {
  const bad = handoffErrors(H); if (bad.length) die('handoff inválido: ' + bad.join('; '));
  writeAtomic(handoffFile(H.tarea, root), JSON.stringify(H, null, 1) + '\n'); writeAtomic(handoffFile(H.tarea, root, 'md'), renderMd(H));
  record({ action: 'orch.handoff', target: `task/${H.tarea}`, hash_after: digest(H), verdict: 'written', why: clip(H.siguiente || H.objetivo, 100) });
  return handoffFile(H.tarea, root);
}

// ── latido y estado por tarea ──────────────────────────────────────────────────────────────────────────────────────
export function beat(tarea, step, { ttl = cfg().beatTtlMs, end = false } = {}) {
  if (!/^[\w.-]{1,40}$/.test(tarea ?? '')) die('uso: orch beat <tarea> --step "…" [--ttl ms] | --end   (tarea: letras, números, . _ -)');
  const target = `task/${tarea}`, me = who().agent;
  if (end) { releaseTarget(target); record({ action: 'orch.done', target, verdict: 'done', why: clip(step || 'tarea terminada', 140) }); return { tarea, done: true }; }
  if (!step || step.trim().length < 3) die('falta el paso: --step "qué acabas de hacer / vas a hacer"');
  const L = claim(target, me, ttl, { durable: true });
  if (!L) { const h = holder(target); die(`${target} con lease vigente de ${h?.agent ?? '?'} hasta ${h ? new Date(h.expires).toISOString() : '?'}: otra sesión la lleva`); }
  record({ action: 'orch.beat', target, verdict: `ttl${ttl}`, why: clip(step, 140) });
  const H = readHandoff(tarea) ?? { tarea, rama: git(ROOT, 'branch', '--show-current') || '?', worktree: ROOT, objetivo: '(sin declarar: orch handoff)', hecho: [], pendiente: [], siguiente: '', verificacion: [], riesgos: [] };
  if (H.hecho[H.hecho.length - 1] !== clip(step, 140)) H.hecho = [...H.hecho, clip(step, 140)].slice(-30);
  writeHandoff(H); return { tarea, lease: L.expires };
}
export function ledgerAt(root = ROOT) {
  const f = path.join(root, 'out/ledger.jsonl'); if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
// Estado por tarea derivado del ledger: huecos entre latidos > su TTL = cortes; sin cierre y TTL vencido = cortado.
export function taskStates(root = ROOT, now = Date.now()) {
  const C = cfg(root), T = new Map();
  for (const e of ledgerAt(root)) {
    if (!/^orch\.(beat|done)$/.test(e.action) || !String(e.target).startsWith('task/')) continue;
    const id = e.target.slice(5), ts = Date.parse(e.ts); let t = T.get(id);
    if (e.action === 'orch.done') { if (t) { t.closed = true; t.doneAt = e.ts; } continue; }
    const ttl = +/^ttl(\d+)$/.exec(e.verdict ?? '')?.[1] || C.beatTtlMs;
    if (!t || t.closed) { t = { tarea: id, cuts: 0, beats: 0, closed: false, last: null }; T.set(id, t); }
    else if (ts - t.last.ts > t.last.ttl) t.cuts++;
    t.beats++; t.last = { ts, iso: e.ts, ttl, step: e.why, agent: e.agent };
  }
  return [...T.values()].map((t) => {
    const lapsed = !t.closed && now - t.last.ts > t.last.ttl, cuts = t.cuts + (lapsed ? 1 : 0), lease = holder(`task/${t.tarea}`);
    const policy = cuts >= C.taskBudget ? 'escalar' : cuts >= C.maxCuts ? 'partir' : null;
    return { tarea: t.tarea, status: t.closed ? 'hecho' : lapsed ? 'cortado' : 'activo', cuts, beats: t.beats, lastStep: t.last.step, lastAt: t.last.iso, lastAgent: t.last.agent, lease: !!lease, policy };
  });
}

// ── mensaje de reanudación ≤ 300 tokens ────────────────────────────────────────────────────────────────────────────
export const pointer = (p, root = ROOT) => { try { return `${p}@${digest(fs.readFileSync(path.join(root, p))).slice(0, 8)}`; } catch { return `${p}@—`; } };   // referenceInvariant local mínimo
export function resumeMessage(H, st = null, { dirty = [], changed = [], root = ROOT, maxTokens = 300 } = {}) {
  const C = cfg(root), L = [];
  if (st?.policy === 'escalar') return `⛔ ${H.tarea}: ${st.cuts} cortes ≥ presupuesto ${C.taskBudget}. No la reanudes: escala al Director (orch handoff con el estado y pide que la parta). Handoff: ${pointer(`docs/handoff/${H.tarea}.json`, root)}`;
  L.push(`Te cortaron (límite de uso/kill) en la tarea "${H.tarea}" · rama ${H.rama} · ${H.worktree}.`, `Objetivo: ${clip(H.objetivo, 160)}`);
  if (H.hecho.length) L.push('Hecho: ' + H.hecho.slice(-4).map((x) => clip(x, 80)).join('; '));
  if (H.pendiente.length) L.push('Pendiente: ' + H.pendiente.slice(0, 5).map((x) => clip(x, 80)).join('; '));
  if (H.siguiente) L.push('Siguiente: ' + clip(H.siguiente, 140));
  if (st) L.push(`Último paso registrado: "${clip(st.lastStep, 100)}" (${st.lastAt}) · cortes: ${st.cuts}.`);
  if (dirty.length) L.push(`Sin commitear: ${dirty.slice(0, 6).join(', ')}${dirty.length > 6 ? ` +${dirty.length - 6}` : ''}.`);
  else if (changed.length) L.push(`Archivos de la rama: ${changed.slice(0, 6).join(', ')}${changed.length > 6 ? ` +${changed.length - 6}` : ''}.`);
  if (H.verificacion.length) L.push('Verifica: ' + H.verificacion.slice(0, 3).map((v) => (Array.isArray(v) ? v.join(' ') : v)).join(' · '));
  if (H.riesgos.length) L.push('Riesgos: ' + H.riesgos.slice(0, 3).map((x) => clip(x, 60)).join('; '));
  if (st?.policy === 'partir') L.push(`⚠ ${st.cuts} cortes en esta tarea: no la reanudes tal cual; pártela en subtareas (orch handoff con un pendiente acotado) o escala al Director.`);
  L.push(`Handoff: ${pointer(`docs/handoff/${H.tarea}.json`, root)}. Latido: orch beat ${H.tarea} --step "…". Informe final ≤20 líneas.`);
  let t = L.join('\n'); if (t.length > maxTokens * 4) t = t.slice(0, maxTokens * 4 - 1) + '…'; return t;
}

// ── worktrees ──────────────────────────────────────────────────────────────────────────────────────────────────────
const WTSEG = `${path.sep}.claude${path.sep}worktrees${path.sep}`;
export const mainRoot = (root = ROOT) => (root.includes(WTSEG) ? root.slice(0, root.indexOf(WTSEG)) : root);
export function worktrees(root = ROOT) {
  const M = mainRoot(root), WT = path.join(M, '.claude/worktrees');
  if (!fs.existsSync(WT)) return [];
  return fs.readdirSync(WT).map((n) => path.join(WT, n)).filter((d) => fs.existsSync(path.join(d, '.git'))).map((dir) => {
    const gitDir = git(dir, 'rev-parse', '--git-dir'), gd = gitDir ? path.resolve(dir, gitDir) : null;
    const busy = !gd || ['MERGE_HEAD', 'REBASE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'index.lock'].some((f) => fs.existsSync(path.join(gd, f)));
    const files = (gitRaw(dir, 'status', '--porcelain') ?? '').split('\n').filter((l) => l && !/ node_modules\/?$/.test(l)), conflicts = files.some((l) => /^(UU|AA|DD|AU|UA|DU|UD) /.test(l));
    const diff = (a) => (git(dir, ...a) ?? '').split('\n').filter(Boolean);
    return { name: path.basename(dir), dir, branch: git(dir, 'branch', '--show-current') ?? '?', ahead: +(git(dir, 'rev-list', '--count', 'main..HEAD') ?? 0),
      merged: git(M, 'merge-base', '--is-ancestor', git(dir, 'rev-parse', 'HEAD') ?? 'HEAD', 'main') !== null, dirty: files.length, dirtyFiles: files.map((l) => l.slice(3)),
      busy: busy || conflicts, changed: diff(['diff', '--name-only', 'main']), handoffs: diff(['diff', '--name-only', 'main', '--', 'docs/handoff']).filter((f) => /\.(json|md)$/.test(f)).map((f) => path.basename(f)), last: git(dir, 'log', '-1', '--format=%cr · %s') ?? '' };
  });
}
export function wip(root = ROOT) {
  const done = [], skipped = [];
  for (const w of worktrees(root)) {
    if (!w.dirty) continue;
    if (w.busy) { skipped.push(w.name); continue; }                                  // merge/rebase/conflicto/index.lock: no se toca
    if (git(w.dir, 'add', '-A') === null) continue; git(w.dir, 'reset', '-q', '--', 'node_modules');
    const msg = `WIP ${w.branch}: guardado automático al detenerse un agente (tools/agentes.mjs)\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
    if (git(w.dir, 'commit', '-q', '--no-verify', '-m', msg) !== null) done.push(`${w.name} (${w.dirty} archivos)`);
  }
  return { done, skipped };
}
export function statusText(root = ROOT) {
  const ws = worktrees(root), active = ws.filter((w) => !w.merged || w.dirty), L = [`${ws.length} worktrees · ${active.length} con trabajo sin integrar`, ''];
  for (const w of active) L.push(`${w.busy ? '⚠ ocupado (merge/rebase/conflicto)' : w.dirty ? '●' : '○'} ${w.name.padEnd(28)} ${w.branch.padEnd(30)} +${w.ahead} commits  ${w.dirty ? w.dirty + ' sucios' : 'limpio'}  handoff: ${w.handoffs.join(',') || '—'}\n    ${w.last}`);
  const stale = ws.filter((w) => w.merged && !w.dirty).length; if (stale) L.push('', `Integrados y limpios (git worktree remove): ${stale}`);
  return L.join('\n');
}
// Reanudación unificada: worktrees con trabajo sin integrar + tareas cortadas del propio checkout.
export function resumeAll(root = ROOT, name = null) {
  const out = [];
  for (const w of worktrees(root).filter((x) => (name ? x.name === name || x.branch === name : x.dir !== root) && (!x.merged || x.dirty))) {
    const sts = taskStates(w.dir), hf = w.handoffs.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')), H = hf.map((t) => readHandoff(t, w.dir)).filter(Boolean)[0];
    const st = H ? sts.find((s) => s.tarea === H.tarea) ?? null : null;
    let msg;
    if (w.busy) msg = `⚠ ${w.name}: merge/rebase/conflicto en curso en ${w.dir}. Resuélvelo primero (git status); wip no la toca.`;
    else if (H) msg = resumeMessage(H, st, { dirty: w.dirtyFiles, changed: w.changed, root: w.dir });
    else msg = `Te cortaron; tu trabajo está en commits WIP de la rama ${w.branch} en ${w.dir}.${w.dirty ? ` Sin commitear: ${w.dirtyFiles.slice(0, 6).join(', ')}.` : ''} Lee ${w.handoffs.length ? w.handoffs.map((f) => path.join(w.dir, 'docs/handoff', f)).join(' y ') : 'git log main..HEAD'} y continúa. Escribe un handoff tipado (orch handoff) y latidos (orch beat).`;
    out.push({ name: w.name, branch: w.branch, busy: w.busy, dirty: w.dirty, status: st?.status ?? (w.busy ? 'ocupado' : 'desconocido'), cuts: st?.cuts ?? 0, policy: st?.policy ?? null, message: msg });
  }
  if (!name || name === path.basename(root)) for (const s of taskStates(root).filter((x) => x.status === 'cortado')) {
    const H = readHandoff(s.tarea, root); if (H) out.push({ name: s.tarea, branch: H.rama, busy: false, dirty: 0, status: 'cortado', cuts: s.cuts, policy: s.policy, message: resumeMessage(H, s, { root }) });
  }
  return out;
}
