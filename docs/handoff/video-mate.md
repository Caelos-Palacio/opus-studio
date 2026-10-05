# Traspaso — explainer contemplativo de matemáticas con TeX (agente cortado por límite de uso)

Encargo: perfil explainer, ~90 s, 16:9, estilo propio (nocturno), idea matemática bella con "modelo roto" y
revelación visual; TeX real con morph semántico; respiros generosos con un pico claro de revelación; música mínima
que crece (piano/pads, sin percusión épica); Mayer (≤3 conceptos nuevos/min, ≤4 elementos animados a la vez,
coherencia, señalización, contigüidad); memoria con pregunta abierta en el primer 10 % resuelta tarde.
Entregables: out/mate.mp4 (npm run master SIN --force) y docs/videos/mate.md (concepto, decisiones, qué
funcionó/falló, falsos positivos del lint, métricas arc/sound, tiempos).

Estado: data/mate/ (brief, story, memoria, timeline, env.sh), shots M01–M08 + M_mundo, styles/nocturno.json,
styles/sound/contemplativo.json, caché TeX; cambios en engine/score.mjs y engine/sounddesign.mjs (~100 líneas:
revisar con `git diff HEAD~1 -- engine/`, deben seguir pasando test/sound.mjs y npm test) y data/facts.json.
No consta lint ejecutado. Seguir: lint SHIP → arc → memoria lint → master → doc.
