# opus-studio — reglas del proyecto

- Idioma: español (código, docs, commits). Commits terminan con la línea Co-Authored-By del modelo. NUNCA push sin preguntar.
- Proceso 3DD (docs/specs/README.md): Claude escribe specs desde la intención del usuario → escenarios BDD → tests en
  rojo → código. El usuario es el juez de gusto: ningún output audiovisual está "hecho" sin su nota.
- Gusto del usuario: asombro, épico/vibrante, con personalidad. Anti-patrones: monotonía, prisa, audio pobre,
  fondo negro vacío, paleta por defecto (dorado sobre azul noche). Ver docs/specs/001–003.
- Antes de tocar nada: STATUS.md (estado real, generado), docs/HANDOFF.md y docs/ROADMAP.md (rumbo); plan viejo en docs/history/PLAN.md. Memoria conceptual: docs/MEMORIA.md.
- Films ≠ demo: fija el film con `npm run use -- <film>` (out/.film; prioridad --timeline > OPUS_TIMELINE > use > demo). Toda CLI imprime en su
  1.ª línea `film: <clave> (<ruta>, fuente: …)`: léela. story/memoria se derivan de la carpeta del film. `npm run peek -- [film]` = hoja de contacto en segundos: míralo antes de entregar.
- Audio: master con techo ≈ −3 dBTP (el AAC sube el pico); verifica ebur128 sobre el mp4 final (TP ≤ −1).
- Tests: `npm test -- --fast` mientras iteras; `npm test` completo antes de integrar. `master` sin --force.
- Agentes: Sonnet por defecto; ≤3 en paralelo; worktree desde main actualizado; commits WIP + docs/handoff/<tarea>.md.
- Eficiencia: docs/current/EFICIENCIA.md. Mapa de docs: docs/current/README.md; decisiones: docs/adr/.
