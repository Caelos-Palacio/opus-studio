#!/usr/bin/env node
// Continuidad de agentes (sesión de Claude Code): que un corte (límite de uso, watchdog, kill) nunca pierda trabajo.
//   node tools/agentes.mjs status            estado de cada worktree de .claude/worktrees (rama, ahead de main, sucio, handoff)
//   node tools/agentes.mjs wip [--quiet]     commit WIP de cada worktree con cambios (lo usa el hook SubagentStop/Stop)
//   node tools/agentes.mjs resume [nombre]   mensaje de reanudación listo para enviar al agente (desde su handoff)
// Seguro para el hook: nunca toca un worktree en merge/rebase, con conflictos o con index.lock; nunca falla (exit 0).
// Sin shell: git se invoca con execFileSync y argv.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WT = path.join(ROOT, '.claude/worktrees');
const argv = process.argv.slice(2), cmd = argv[0] ?? 'status', quiet = argv.includes('--quiet');
const git = (cwd, ...a) => { try { return execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };

function worktrees() {
  if (!fs.existsSync(WT)) return [];
  return fs.readdirSync(WT).map((n) => path.join(WT, n)).filter((d) => fs.existsSync(path.join(d, '.git'))).map((dir) => {
    const name = path.basename(dir), gitDir = git(dir, 'rev-parse', '--git-dir');
    const gd = gitDir ? path.resolve(dir, gitDir) : null;
    const busy = !gd || ['MERGE_HEAD', 'REBASE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'index.lock'].some((f) => fs.existsSync(path.join(gd, f)));
    const dirty = (git(dir, 'status', '--porcelain') ?? '').split('\n').filter((l) => l && !/ node_modules\/?$/.test(l));
    const conflicts = dirty.some((l) => /^(UU|AA|DD|AU|UA|DU|UD) /.test(l));
    const handoffs = (git(dir, 'diff', '--name-only', 'main', '--', 'docs/handoff') ?? '').split('\n').filter((f) => f.endsWith('.md')).map((f) => path.basename(f));   // solo los suyos, no los heredados de main
    return { name, dir, branch: git(dir, 'branch', '--show-current') ?? '?', ahead: +(git(dir, 'rev-list', '--count', 'main..HEAD') ?? 0),
      merged: git(ROOT, 'merge-base', '--is-ancestor', git(dir, 'rev-parse', 'HEAD') ?? 'HEAD', 'main') !== null,
      dirty: dirty.length, busy: busy || conflicts, handoffs, last: git(dir, 'log', '-1', '--format=%cr · %s') ?? '' };
  });
}

function wip() {
  const done = [];
  for (const w of worktrees()) {
    if (!w.dirty || w.busy) continue;
    if (git(w.dir, 'add', '-A') === null) continue;
    git(w.dir, 'reset', '-q', '--', 'node_modules');
    const msg = `WIP ${w.branch}: guardado automático al detenerse un agente (tools/agentes.mjs)\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
    if (git(w.dir, 'commit', '-q', '--no-verify', '-m', msg) !== null) done.push(`${w.name} (${w.dirty} archivos)`);
  }
  if (!quiet) console.log(done.length ? `WIP guardado: ${done.join(', ')}` : 'nada que guardar');
  else if (done.length) console.log(JSON.stringify({ systemMessage: `WIP guardado en: ${done.join(', ')}` }));
}

function status() {
  const ws = worktrees(), active = ws.filter((w) => !w.merged || w.dirty);
  console.log(`${ws.length} worktrees · ${active.length} con trabajo sin integrar\n`);
  for (const w of active) console.log(`${w.busy ? '⚠' : w.dirty ? '●' : '○'} ${w.name.padEnd(28)} ${w.branch.padEnd(30)} +${w.ahead} commits  ${w.dirty ? w.dirty + ' sucios' : 'limpio'}  handoff: ${w.handoffs.join(',') || '—'}\n    ${w.last}`);
  const stale = ws.filter((w) => w.merged && !w.dirty).map((w) => w.name);
  if (stale.length) console.log(`\nIntegrados y limpios (se pueden borrar con \`git worktree remove\`): ${stale.length}`);
}

function resume(name) {
  for (const w of worktrees().filter((x) => (!name || x.name === name) && (!x.merged || x.dirty))) {
    const h = w.handoffs.map((f) => path.join(w.dir, 'docs/handoff', f));
    console.log(`── ${w.name} (rama ${w.branch})\nTe cortaron (límite de uso, watchdog o kill); tu trabajo está en commits WIP de la rama ${w.branch} en ${w.dir}.` +
      ` Lee primero ${h.length ? h.join(' y ') : 'git log main..HEAD'}, revisa git status/log y continúa la tarea donde la dejaste.` +
      ` Commits WIP frecuentes y handoff al día. Informe final ≤20 líneas.\n`);
  }
}

try {
  if (cmd === 'wip') wip(); else if (cmd === 'resume') resume(argv[1]); else if (cmd === 'status') status();
  else { console.log('uso: node tools/agentes.mjs status | wip [--quiet] | resume [nombre]'); }
} catch (e) { if (!quiet) console.error(e.message); }
process.exit(0);
