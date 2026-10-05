# Handoff — medios (spec 003)
Estado: sistema de medios implementado (engine/medium.mjs, styles/medios/papel_crema.json), integrado en seek/film/schema/cut/api (glowScale).
Film B: data/mate_papel/ (copia de mate + "medium":"papel_crema"). A/B: `node engine/ab.mjs --a data/mate/timeline.json --b data/mate_papel/timeline.json --out out/ab/mate.jpg`.
Tests: test/medios.mjs (M1–M8, en npm test). Pendiente: nota del usuario; más medios (kraft, pizarra, técnico = JSON nuevos); doc docs/MEDIOS.md.
Notas: en mediciones sin grade (lint/arc) erosión/temblor/desregistro/capas quedan estáticos para no inflar la energía de movimiento; el glow del film se vuelve sangrado de tinta y es el pico (arc SHIP 98).
Lint mate_papel: SHIP (7 avisos, los de mate v1 + "acento no aparece": el arc mide el acento por distancia de color en píxeles multiplicados sobre papel).
