#!/usr/bin/env node
// Fachada de continuidad de agentes: la implementación vive en engine/continuity.mjs (la misma que `orch resume|beat|handoff`).
//   node tools/agentes.mjs status | wip [--quiet] | resume [nombre]
// Seguro para el hook SubagentStop/Stop: nunca falla (exit 0); nunca toca un worktree en merge/rebase/conflicto/index.lock.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), cmd = argv[0] ?? 'status', quiet = argv.includes('--quiet');
try {
  const C = await import('../engine/continuity.mjs');
  if (cmd === 'wip') {
    const { done, skipped } = C.wip(ROOT);
    if (!quiet) console.log(done.length ? `WIP guardado: ${done.join(', ')}` : 'nada que guardar', skipped.length ? `· sin tocar (merge/rebase/conflicto): ${skipped.join(', ')}` : '');
    else if (done.length) console.log(JSON.stringify({ systemMessage: `WIP guardado en: ${done.join(', ')}` }));
  } else if (cmd === 'resume') { for (const r of C.resumeAll(ROOT, argv[1])) console.log(`-- ${r.name} (${r.status})\n${r.message}\n`); }
  else if (cmd === 'status') console.log(C.statusText(ROOT));
  else console.log('uso: node tools/agentes.mjs status | wip [--quiet] | resume [nombre]   (= orch resume)');
} catch (e) { if (!quiet) console.error(e.message); }
process.exit(0);
