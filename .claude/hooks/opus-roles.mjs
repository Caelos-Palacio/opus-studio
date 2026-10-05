#!/usr/bin/env node
// Hook PreToolUse OPCIONAL para Claude Code: aplica roles.json (+ claims) a Write/Edit/MultiEdit/NotebookEdit.
// NO está activado. Para activarlo, añade a .claude/settings.json (ver AGENTES.md § Gobernanza):
//   {"hooks":{"PreToolUse":[{"matcher":"Write|Edit|MultiEdit|NotebookEdit","hooks":[{"type":"command","command":"node \"$CLAUDE_PROJECT_DIR/.claude/hooks/opus-roles.mjs\""}]}]}}
// Rol y agente por env (OPUS_ROLE / OPUS_AGENT). En modo observer solo registra would_decide; en enforce deniega.
// Nunca rompe la sesión: cualquier excepción → exit 0 sin salida (la herramienta sigue su curso normal).
import path from 'node:path';

try {
  let raw = ''; for await (const c of process.stdin) raw += c;
  const ev = JSON.parse(raw || '{}'), p = ev.tool_input?.file_path ?? ev.tool_input?.notebook_path;
  if (p) {
    const { decide } = await import(path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../engine/roles.mjs'));
    const d = decide({ path: p, tool: ev.tool_name });
    if (d.enforced && d.decision === 'deny')
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `opus-studio roles: ${d.reason}` } }));
  }
} catch { /* nunca bloquear por un fallo del propio hook */ }
process.exit(0);
