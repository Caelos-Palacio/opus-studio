# Traspaso — reel «Pulso» de tipografía cinética (agente cortado por límite de uso)

Encargo: perfil reel, ~30 s, VERTICAL 9:16, estilo kinetic propio, energía alta con arco (build, drop, respiro,
final). Mensaje corto en español cuyas palabras se mueven, rompen y recomponen al compás. La música MANDA el timing
(cortes y entradas desde la rejilla de tempo); señales (lfo/env/onsets) enlazadas a parámetros; variación rítmica;
transiciones duras; impact/smear frames. Entregables: out/reel.mp4 (npm run master SIN --force) y docs/videos/reel.md
(concepto, decisiones, qué funcionó/falló, falsos positivos del lint, métricas arc/sound, tiempos).

Estado: commit 8a8a6ec ya trae el film (24 shots K, estilo pulso, sonido electro) y cambios de motor: identidad de
film por carpeta, rejilla de tempo (engine/grid.mjs), pistas de audio por instrumento. Después había ajustes sin
commitear en data/reel/{audio.json,build.mjs,timeline.json} y styles/sound/electro.json (commiteados en este WIP).
Se cortó haciendo ediciones puntuales; revisar el último out/lint.json y seguir: lint SHIP → arc → master → doc.
