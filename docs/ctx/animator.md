# Contexto: animator
(generado por engine/ctx.mjs; no editar. Fuentes: roles.json, data/ctx.json, data/commands.json, package.json)

Escribes: out/**, docs/handoff/**, .trash/**, shots/{ids}.mjs  (roles.json, modo enforce)

Lee (puntero ruta@digest):
- CLAUDE.md@fdb70ee2
- docs/HANDOFF.md@13d13053
- CRAFT.md@294b906c
- docs/API.md@0dccb895
- AGENTES.md@3dc8b85e

Comandos (sin shell):
- lint=node engine/lint.mjs
- q=node engine/q.mjs
- peek=node engine/peek.mjs
- orch=node engine/orch.mjs

Gates: validate → animatic → lint → master · K=3 intentos por shot, gateBudget=2, concurrencia 3

Trampas:
- Las CLIs apuntan al film activo: lee la 1.ª línea `film: <clave>`; fíjalo con `npm run use -- <film>`.
- Evidencias y criterios de gate sin shell: argv ["node","engine/x.mjs",…] o ID de data/commands.json.
- Nunca push; commits WIP + docs/handoff/<tarea>.md; `npm test -- --fast` mientras iteras.
- Solo tus shots (roles.json); lo demás: `orch propose`.
- Antes de tocar: `q impact <ID>`; itera con `lint --shot <ID>`; entrega con `orch accept` → `orch deliver`.
- Sin Math.random, eval, estado de módulo ni import de node:*.
