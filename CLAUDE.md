# opus-studio — reglas del proyecto

- Idioma: español (código, docs, commits). Commits terminan con la línea Co-Authored-By del modelo. NUNCA push sin preguntar.
- Proceso 3DD (docs/specs/README.md): Claude escribe specs desde la intención del usuario → escenarios BDD → tests en
  rojo → código. El usuario es el juez de gusto: ningún output audiovisual está "hecho" sin su nota.
- Gusto del usuario: asombro, épico/vibrante, con personalidad. Anti-patrones: monotonía, prisa, audio pobre,
  fondo negro VACÍO (sin profundidad ni motivo; el oscuro elegido por el tema —cosmos, noche, luz— es válido: spec 012 Lección), paleta por defecto (dorado sobre azul noche). Ver docs/specs/001–003.
- Antes de tocar nada: STATUS.md (estado real, generado), docs/HANDOFF.md y docs/ROADMAP.md (rumbo); plan viejo en docs/history/PLAN.md. Memoria conceptual: docs/MEMORIA.md.
- Films ≠ demo: fija el film con `npm run use -- <film>` (out/.film; prioridad --timeline > OPUS_TIMELINE > use > demo). Toda CLI imprime en su
  1.ª línea `film: <clave> (<ruta>, fuente: …)`: léela. story/memoria se derivan de la carpeta del film. `npm run peek -- [film]` = hoja de contacto en segundos: míralo antes de entregar.
- Audio: master con techo ≈ −3 dBTP (el AAC sube el pico); verifica ebur128 sobre el mp4 final (TP ≤ −1).
- Tests: `npm test -- --fast` mientras iteras; `npm test` (rápido, < 240 s, todas las suites con fixtures reducidas); `npm test -- --full` (= `test:nightly`) OBLIGATORIO verde antes de integrar a main (qué pierde el rápido: docs/handoff/deuda2.md). La suite ignora `out/.film`. `master` sin --force.
- Agentes: Sonnet por defecto; varios en paralelo (más de 3 permitido; si el límite de uso corta, se reanudan); worktree desde main actualizado; commits WIP + docs/handoff/<tarea>.md.
  Subagentes de un agente (profundidad máx. 2, env en .claude/settings.json): SOLO con `model: "haiku"` (= Claude Haiku 5.5, fijado con ANTHROPIC_DEFAULT_HAIKU_MODEL), ≤2 a la vez,
  para tareas MECÁNICAS y acotadas que ahorran contexto al padre: correr suites/tests y resumir fallos, regenerar índices/STATUS,
  resolver conflictos de merge en archivos de datos (vocab, tools.index, suites.d), llenar `$hueco` de recetas con texto ya decidido,
  verificar un hecho con fuente, escéptico ciego, revisar hoja de contacto o diff, buscar en el repo. Nunca diseño de motor, decisiones
  creativas ni commits; el padre revisa e integra y responde de su resultado. Las hojas no delegan.
  Modo supervisor (pedido del usuario): un Sonnet que coordina puede tener hasta 4 haikus a la vez y darles también arreglos
  ACOTADOS de código/tests con instrucciones exactas; el supervisor revisa cada diff, corre las suites y hace los commits.
- Empieza por `node engine/tools.mjs brief --role <rol>` y `tools plan "<objetivo>"`; usa `tools find "<intención>"` / `show <id>` en vez de leer el catálogo (spec 015).
- Eficiencia: docs/current/EFICIENCIA.md. Mapa de docs: docs/current/README.md; decisiones: docs/adr/.
- Shots nuevos: no los escribas enteros; `node engine/opus.mjs new shot <id> --receta <r> [--param k=v] [--llenar objeto.prop=texto]` (spec 016; `tools find "…" --kind receta`) y llena los `$hueco`.
