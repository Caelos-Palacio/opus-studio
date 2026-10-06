# Contexto: director
(generado por engine/ctx.mjs; no editar. Fuentes: roles.json, data/ctx.json, data/commands.json, package.json)

Escribes: out/**, docs/handoff/**, .trash/**, **  (roles.json, modo enforce)

Lee (puntero ruta@digest):
- CLAUDE.md@fdb70ee2
- docs/HANDOFF.md@13d13053
- docs/ROADMAP.md@7eebe5a0
- ORQUESTADOR.md@55527209
- gates.json@b815789c
- orch.json@23bf44a6

Comandos (sin shell):
- gate=node engine/gate.mjs
- orch=node engine/orch.mjs
- lint=node engine/lint.mjs
- test=node test/run.mjs

Gates: validate → animatic → lint → master · K=3 intentos por shot, gateBudget=2, concurrencia 3

Trampas:
- Las CLIs apuntan al film activo: lee la 1.ª línea `film: <clave>`; fíjalo con `npm run use -- <film>`.
- Evidencias y criterios de gate sin shell: argv ["node","engine/x.mjs",…] o ID de data/commands.json.
- Nunca push; commits WIP + docs/handoff/<tarea>.md; `npm test -- --fast` mientras iteras.
- Solo el Director decide propuestas, reabre gates y descongela.
- `master` sin --force; el audio con techo −3 dBTP.
