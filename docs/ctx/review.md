# Contexto: review
(generado por engine/ctx.mjs; no editar. Fuentes: roles.json, data/ctx.json, data/commands.json, package.json)

Escribes: out/**, docs/handoff/**, .trash/**  (roles.json, modo enforce)

Lee (puntero ruta@digest):
- CLAUDE.md@fdb70ee2
- docs/HANDOFF.md@0bfb99d6
- REVIEW.md@cc7a4f3f
- docs/MEDIOS.md@dcd506f8

Comandos (sin shell):
- peek=node engine/peek.mjs
- critic=node engine/critic.mjs
- metrics=node engine/metrics.mjs

Gates: validate → animatic → lint → master · K=3 intentos por shot, gateBudget=2, concurrencia 3

Trampas:
- Las CLIs apuntan al film activo: lee la 1.ª línea `film: <clave>`; fíjalo con `npm run use -- <film>`.
- Evidencias y criterios de gate sin shell: argv ["node","engine/x.mjs",…] o ID de data/commands.json.
- Nunca push; commits WIP + docs/handoff/<tarea>.md; `npm test -- --fast` mientras iteras.
- Solo diagnóstico `{shot, problem, evidence[]}` con `orch note`: nada de prescribir arreglos.
