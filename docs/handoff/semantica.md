# Handoff — spec 006 semántica al límite

Estado: implementado y con tests (`test/semantica.mjs`, en el bucle de `test/run.mjs`; `--fast` salta golden DSL vs JS y el lint e2e).

## Qué hay
- **Vocabulario** `data/vocab.json` + `engine/vocab.mjs` (`npm run vocab -- list|canon|lint|sync|refs`). Secciones: concept.kind, relation.type,
  memory.role, rule.when, lint.stage, arc.check, critic.dimension, severity, verdict, orch.code, gov.role, shot.scale, medium, metric (65), prose.
  - `memoria.mjs` y `metrics/units.mjs` IMPORTAN de vocab (enums de memoria, grupos de relación, escalas). El JSON del esquema de memoria debe coincidir (test V2).
  - Métricas: el registry sigue siendo la fuente de las definiciones; vocab.metric es su índice canónico (`vocab sync`; test V3).
  - arc/lint/critic/roles/medios: el código no importa de vocab (literales); un test (V7) falla si el código inventa un término.
  - Lint de prosa (`vocab lint`): sinónimos prohibidos en memoria.json de todos los films, notas, story y docs/specs. Exime citas «» “” "", `código` y `<!-- vocab-ok -->`.
    **Baseline 6 hallazgos (5× «clímax», 1× «wow» fuera de comillas) → 0.** Para añadir un término: editar data/vocab.json y subir `version`.
  - `referenceInvariant(orig, deriv)` (ids/rutas/hashes ⊆): usado en `orch brief` (si el recorte pierde referencias, degrada a head+tail sin lista de shots). `vocab refs a b` para handoffs.
  - `reasonCode(texto)`: clasifica los motivos de orquestación a códigos cerrados sin cambiar el texto (orch/gate no lo emiten aún: lo hace el agente de orquestación).
- **DSL** `engine/dsl-core.mjs` (puro, lo importan los shots) + `engine/dsl.mjs` (CLI: validate, build, diff, deps).
  - Autoría: `shots/<id>.scene.json` → `node engine/dsl.mjs build --all` genera `shots/<id>.mjs` (NO editar a mano; `--check` en test D7).
  - Tipos: ground marks gradient morph focus shape glow text equation group let + plot/axis/world3d/custom (respaldados por una función de un módulo `lib`; sin `reads` son opacos).
  - Valores: literal | `{"$expr"}` (engine/expr.mjs ahora admite `vars`/`funcs` extra; sig() prohibido) | `{"$shot":"text"}`. cues = ventanas temporales ligadas a params.
  - Convertidos: **A3** (demo; lógica de `dot` en `shots/A3_lib.mjs`, importa A2 para conservar la arista de dependencia) y **M08** (mate). Originales en `test/fixtures/dsl-legacy/`: el test D3 compara sha de píxeles en 6 instantes (bit a bit) y el golden demo sigue intacto.
  - Ajustes en tests por A3→DSL: golden-texto+1 y mutación texto-fuera editan ahora el objeto `frase` del .mjs generado. `memoria.contexto` y `assets --tex` leen también `.scene.json`.
- **Índice semántico v2** `engine/semindex.mjs`: `q where <X>`, `q depends <param>`, `q semindex`, `q otio [--out f]`; `index.mjs` escribe `out/index/<film>/semantic.json`.
  OTIO: Timeline.1/Stack.1/Track.1(Video, sin solapes)/Clip.1/Gap.1/Marker.1; markers con `metadata.opus {concept, kind, rol, vocab}`.

## Pendiente / límites
- Convertir más shots al DSL (meta ~80 %); `world3d` solo como objeto respaldado por lib, sin tipo nativo.
- `camera`/`transition` del DSL son expectativas documentadas (la cámara sigue en el timeline); aún sin check cruzado contra el timeline.
- La capa de overrides sigue siendo por params (no por objetos DSL).
- Emitir `reasonCode` en orch/gate/ledger (territorio de orquestación/gobernanza).
