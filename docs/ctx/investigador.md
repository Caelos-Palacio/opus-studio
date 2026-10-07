# Contexto: investigador
(generado por engine/ctx.mjs; no editar. Fuentes: roles.json, data/ctx.json, data/commands.json, package.json)

Escribes: out/**, docs/handoff/**, .trash/**, data/facts.json  (roles.json, modo enforce)

Lee (puntero ruta@digest):
- CLAUDE.md@b116fe2c
- docs/HANDOFF.md@13d13053
- docs/MEMORIA.md@fcd5a7ec

Comandos (sin shell):
- memoria=node engine/memoria.mjs
- q=node engine/q.mjs

Gates: validate → animatic → lint → master · K=3 intentos por shot, gateBudget=2, concurrencia 3

Trampas:
- Las CLIs apuntan al film activo: lee la 1.ª línea `film: <clave>`; fíjalo con `npm run use -- <film>`.
- Evidencias y criterios de gate sin shell: argv ["node","engine/x.mjs",…] o ID de data/commands.json.
- Nunca push; commits WIP + docs/handoff/<tarea>.md; `npm test -- --fast` mientras iteras.
- Solo data/facts.json es tuyo; cita fuentes.
