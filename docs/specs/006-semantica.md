# 006 — Semántica al límite: el vídeo como datos con significado

## Intención (ROADMAP paso 3, research/10-rosetta.md)
"Que el vídeo sea datos con significado": una sola lengua para film, memoria conceptual, métricas, crítico, índice y
orquestación; escenas declaradas como datos (no solo código); un índice que responde por conceptos y objetos, no por píxeles.
Rosetta se adopta SOLO como vocabulario cerrado con versión + guardas deterministas. NO compresión por LLM.

## Traducción a medibles
- Vocabulario controlado versionado (`engine/vocab.mjs` + `data/vocab.json`): cada término = id, definición, sinónimos
  prohibidos → canónico. Fuente única de: kinds y tipos de relación de la memoria, roles de ancla, ids de métricas,
  problemas (stages del lint, checks del arc, rúbrica del crítico, dominios del sound), códigos de orquestación, roles
  de gobernanza, escalas de plano, medios, prosa (glosario).
- Lint de vocabulario: términos NO canónicos en memoria.json (todos los films), notas, story y docs/specs. Baseline → 0.
- Guarda de referencias (Rosetta "reference invariant"): ids, rutas y hashes del original ⊆ derivado.
- DSL declarativo de escena v1 (`engine/dsl.mjs`): schema estricto, compila a draw/entities existentes (seek(t) puro),
  píxeles idénticos a los shots JS convertidos, `diff` semántico y `deps` exactas por objeto.
- Índice semántico v2 + export OTIO (OpenTimelineIO JSON) con markers semánticos.

## Escenarios (BDD) — cada uno es un test de `test/semantica.mjs`
### Vocabulario
- V1 Dado data/vocab.json, entonces tiene versión, y cada término tiene id único, definición y sinónimos prohibidos disjuntos de los canónicos.
- V2 Dado memoria.schema.json, entonces enums de kind, relación y rol == términos de vocab (y memoria.mjs importa de vocab).
- V3 Dado el registry de métricas, entonces todo id de métrica está en vocab y viceversa.
- V4 Dado `canon("clímax")` <!-- vocab-ok -->, entonces → `pico`; `canon('pico')` → `pico`; un término desconocido → null.
- V5 Dado un texto con un sinónimo prohibido, `lintText` lo reporta con línea, término y canónico propuesto; las citas «…», “…” y `<!-- vocab-ok -->` se respetan.
- V6 Dado el repo, el lint de vocabulario (memoria.json de todos los films, notas, story, docs/specs) da 0 hallazgos. (baseline medido antes: ver handoff)
- V7 Dado el vocabulario de lint/arc/crítico/roles/escalas del código, entonces coincide con vocab (el código no inventa términos).
- V8 `referenceInvariant(orig, deriv)`: ok si ids/rutas/hashes(≥8 hex) del original ⊆ derivado; si falta alguno → ok:false con la lista; ids añadidos no rompen.
- V9 `orch brief` conserva sus referencias esenciales (rutas, hash de engine/film, ids de gates) — usa la guarda.
### DSL
- D1 Esquema estricto: propiedad desconocida, tipo de objeto desconocido, id duplicado, expresión inválida, `sig()` dentro del DSL, param inexistente → error con ruta y "¿quisiste decir…?".
- D2 `compile(scene)` devuelve {params, entities, draw} y es puro: dos llamadas con el mismo t dan los mismos píxeles; no usa Date/Math.random.
- D3 Golden bit a bit: A3 (demo) y M08 (mate) convertidos al DSL dan el MISMO sha256 de píxeles que su versión JS (copias en test/fixtures/dsl-legacy/) en in/mid/out y 3 instantes más.
- D4 `dsl diff a b` es SEMÁNTICO: objetos añadidos/quitados/cambiados (con qué prop), params y cues; dos archivos que difieren solo en formato/orden de claves → "sin cambios".
- D5 `dsl deps <escena>` da por objeto sus dependencias exactas (params, entidades, objetos, libs, tiempo); un cambio en un param solo invalida los objetos que lo leen (transitivo por salidas de objeto).
- D6 Un cue enlazado a un param ({param}) cambia su ventana al cambiar el param (y no depende de señales salvo vía param bound).
- D7 `dsl build` genera shots/<id>.mjs desde shots/<id>.scene.json de forma determinista; un test verifica que lo generado está al día.
- D8 El sandbox/guardia siguen aceptando los shots DSL (lint --only validate sin FIX).
### Índice semántico v2 / OTIO
- I1 `semindex.build()` indexa conceptos, anclas, relaciones, objetos y params con ids canónicos (sin píxeles); es determinista.
- I2 `q where <concepto>`: dónde aparece (shots, t, anclas, objetos); acepta sinónimos (se canoniza); un término desconocido sugiere el canónico.
- I3 `q depends <param>`: objetos (y conceptos anclados) que dependen del param.
- I4 Export OTIO: `OTIO_SCHEMA` Timeline.1/Stack.1/Track.1/Clip.1/Gap.1/Marker.1, RationalTime/TimeRange coherentes (suma de duraciones == duración del film), markers con `metadata.opus` (concepto, kind, rol) en su t.
- I5 Dos exportaciones son idénticas byte a byte.

## Fuera de alcance
- Compilar TODO shot a DSL (el ~80 % es la meta; hoy: 2 shots de referencia + el motor). JS sigue como escape hatch.
- Compresión semántica por LLM (descartada por research/10-rosetta.md).
- Capa de overrides sobre objetos DSL (sigue siendo por params).

## Calificaciones
(pendiente: no hay output audiovisual nuevo; los golden garantizan píxeles idénticos)
