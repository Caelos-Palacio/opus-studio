# 3DD — SDD + BDD + TDD

Roles
- Usuario: da la intención y CALIFICA el output con gusto humano (nota 1–10 + comentario libre). Es el juez final.
- Claude: traduce intención + calificaciones en specs, escenarios y tests; decide si un agente o un enjambre;
  integra. Nunca da por buena una fase sin la nota del usuario cuando hay output audiovisual.
- Agentes: implementan contra los tests (Sonnet para lo mecánico, Opus para diseño/seguridad).

Ciclo por spec (docs/specs/NNN-nombre.md)
1. SDD  — Intención (palabras del usuario), traducción a medibles, fuera de alcance.
2. BDD  — Escenarios Dado/Cuando/Entonces, cada uno verificable por máquina o marcado [HUMANO].
3. TDD  — Cada escenario de máquina → test que falla primero (rojo), luego código (verde).
4. Render → el usuario califica → la nota y el comentario vuelven a la spec (sección Calificaciones)
   y recalibran umbrales (calibración bayesiana con clamp, research/02).

Regla: lo que el usuario critica y ningún test detecta es un falso negativo del sistema → nuevo escenario.
