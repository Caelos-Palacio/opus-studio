# Contexto: td
(generado por engine/ctx.mjs; no editar. Fuentes: roles.json, data/ctx.json, data/commands.json, package.json)

Escribes: out/**, docs/handoff/**, .trash/**, engine/**, test/**, docs/**, MOTOR.md, README.md, CLAUDE.md, AGENTES.md, ORQUESTADOR.md, STATUS.md, PROMPTS.md, FUNDAMENTOS.md, REVIEW.md, package.json, package-lock.json, .gitignore, .claude/**, .github/**, spike/**, assets/**, data/*.schema.json, data/*.template.*, data/*.example.*, data/world3d/**, styles/*/**, data/notas.json  (roles.json, modo enforce)

Lee (puntero ruta@digest):
- CLAUDE.md@fdb70ee2
- docs/HANDOFF.md@13d13053
- MOTOR.md@b7bc5a44
- docs/API.md@0dccb895
- docs/EFICIENCIA.md@af889db4

Comandos (sin shell):
- test=node test/run.mjs
- lint=node engine/lint.mjs
- arc=node engine/arc.mjs
- metrics=node engine/metrics.mjs

Gates: validate → animatic → lint → master · K=3 intentos por shot, gateBudget=2, concurrencia 3

Trampas:
- Las CLIs apuntan al film activo: lee la 1.ª línea `film: <clave>`; fíjalo con `npm run use -- <film>`.
- Evidencias y criterios de gate sin shell: argv ["node","engine/x.mjs",…] o ID de data/commands.json.
- Nunca push; commits WIP + docs/handoff/<tarea>.md; `npm test -- --fast` mientras iteras.
- Todo cambio de motor exige test en rojo primero (3DD).
- Tocar engine/ caduca los veredictos: relintea una vez, no por cambio.
