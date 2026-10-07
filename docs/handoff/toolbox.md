# Handoff — toolbox (spec 015: descubrimiento progresivo de herramientas)
Rama `toolbox`, sin push. Estado: implementado y con tests; falta solo integrar.

## Qué hay
- `engine/toolbox.mjs`: registro generado del código (`buildRegistry`), contrato `validateMeta` y búsqueda BM25 + sinónimos (`search`, `synGroups`).
- `engine/tools.mjs`: CLI `brief | find | show | next | plan | build [--check] | eval | measure`. `plan` lee el estado real (`readState`) y `nextSteps(S, objetivo)` es pura.
- `data/tools.meta.json`: capa CURADA (fases del pipeline, reglas duras, roles, sinónimos, cuándo/tags/siguiente de las herramientas clave, comandos con subcomando).
- `data/tools.index.json`: GENERADO (`node engine/tools.mjs build`). `data/tools.eval.json`: 51 intenciones con la herramienta esperada.
- `test/tools.mjs` (registrado en test/run.mjs: solo se añadió `'tools'` a la lista). Spec: `docs/specs/015-toolbox.md`. Medidas: `docs/current/EFICIENCIA.md` (§ Toolbox).
- SKILL.md y CLAUDE.md: empezar por `tools brief` y `tools plan`.

## Para integrar
1. Tras mergear ramas que cambien prims (DOC), TYPES del DSL, métricas, estilos o scripts de package.json: `node engine/tools.mjs build` y commitear `data/tools.index.json` (el test lo exige, como `dsl build --check`).
2. Rama `fondos`: debe exponer `META` en `engine/fondos.mjs` / `engine/objetos.mjs` (o `…/index.mjs`) con el contrato de la spec §4 `{id, resumen ≤15 palabras, tags[], params:{nombre: number|integer|string|color|boolean|enum|json}}`. Entra solo como `fondo:<id>` / `objeto:<id>`; si incumple, `build` avisa y el test falla (avisos = 0). Añade sus intenciones a `data/tools.eval.json`.
3. `data/vocab.json`: añadidos a mano `herramienta` e `intención` en `prose` (sin reformatear, sin subir version).
4. STATUS.md no se tocó.

## Decisiones / límites
- Búsqueda léxica pura: sin embeddings. El recall@3 depende de `tags`/`sinonimos` curados; una herramienta nueva sin tags se encuentra por su resumen/DOC.
- `plan` no ejecuta nada. No calcula la vigencia del crítico por plan de fragmentos (caro): si solo existe `out/review/<film>/verdict.json` lo trata como pendiente de `gate verify`, que es el árbitro.
