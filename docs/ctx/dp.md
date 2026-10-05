# Contexto: dp
(generado por engine/ctx.mjs; no editar. Fuentes: roles.json, data/ctx.json, data/commands.json, package.json)

Escribes: out/**, docs/handoff/**, .trash/**, storyboard/**  (roles.json, modo enforce)

Lee (puntero ruta@digest):
- CLAUDE.md@fdb70ee2
- docs/HANDOFF.md@0bfb99d6
- CINE.md@7f37c69c
- CRAFT.md@294b906c
- STYLES.md@7b04c1b9
- storyboard/README.md@5d7badb6

Comandos (sin shell):
- peek=node engine/peek.mjs
- lint=node engine/lint.mjs

Gates: validate → animatic → lint → master · K=3 intentos por shot, gateBudget=2, concurrencia 3

Trampas:
- Las CLIs apuntan al film activo: lee la 1.ª línea `film: <clave>`; fíjalo con `npm run use -- <film>`.
- Evidencias y criterios de gate sin shell: argv ["node","engine/x.mjs",…] o ID de data/commands.json.
- Nunca push; commits WIP + docs/handoff/<tarea>.md; `npm test -- --fast` mientras iteras.
- No codees el film hasta que el STRIP esté OK; mira `peek` antes de entregar.
