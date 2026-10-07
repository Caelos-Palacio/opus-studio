# Handoff D4 — narr (spec 013)

Rama `narr`. Estado: completo y verificado contra la spec (falta solo el juicio humano H1).
- [x] data/story.schema.json v2 condicional (`v:2`); engine/schema.mjs soporta if/then/else y allOf.
- [x] test/narr.mjs (N1–N11 + anticliche excluida del vocab lint) registrado en test/run.mjs; 38 checks verdes.
- [x] engine/narr.mjs + data/anticliche.es.json + `npm run narr` (+ `frescura <story>`).
- [x] arc.mjs por forma (arc.json `formas`), accommodation.type `creencia`.
- [x] stage `narr` en lint.mjs; gate: FIX solo si v2 (v1 se degrada a WARN con effLevel).
- [x] docs/current/IDEACION.md, data/ideas.md.
- [x] notas.schema `voz`; vocab.json (v2: stage narr, narr.check, story.forma, story.cierre); `vocab lint` = 0.
      data/vocab.json conserva el formato original (diff = solo líneas añadidas + version).
- [x] story.template.json v2 con ejemplo completo; README.md (mapa) y CRAFT.md (eco = opción).
- [x] `npm run narr` sobre mate/mate_papel/reel/regla/stress: 0 FIX, WARN reproducen el diagnóstico.
- [ ] H1 (humano): 3 films con conceptos nuevos, nota ≥ 8 y "¿tuvo voz?" sí en 2 de 3.
