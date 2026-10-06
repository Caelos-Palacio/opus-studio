# Handoff D4 — narr (spec 013)

Rama `narr`. Estado (WIP):
- [x] data/story.schema.json v2 condicional (`v:2`); engine/schema.mjs soporta if/then/else y allOf.
- [ ] test/narr.mjs (N1–N11) + registro en test/run.mjs
- [ ] engine/narr.mjs + data/anticliche.es.json + `npm run narr` (+ `frescura`)
- [ ] arc.mjs por forma (arc.json `formas`), accommodation.type `creencia`
- [ ] stage `narr` en lint.mjs (solo registrar); gate: 0 FIX solo si v2 (v1 se degrada a WARN)
- [ ] docs/current/IDEACION.md, data/ideas.md
- [ ] notas.schema `voz`; vocab.json términos; vocab lint = 0
- [ ] story.template.json v2; README.md y CRAFT.md (eco = opción)

Diseño: el núcleo devuelve niveles nominales; v1 se rebaja a WARN al informar (effLevel).
