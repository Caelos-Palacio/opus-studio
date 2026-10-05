# 10 — Rosetta (compactación semántica): qué es y cuánto sirve a opus-studio

Fecha: 2026-10-05. Investigación solo lectura. Evidencia citada por ruta.

## 1. Qué es exactamente Rosetta

"Rosetta" son **dos cosas distintas** dentro del ecosistema Symbiaxis/NXS del autor. No hay nada público con ese nombre (no se buscó en web: es un artefacto propio).

**A. Protocolo Rosetta de compresión de contexto (el "semántico", -55 %).** Es un conjunto de reglas para que un LLM reempaque documentos "calientes" (MEMORY.md, CURRENT.md, handoffs, skills) sin resumir.
- Definición, de segunda mano: `~/.gemini/antigravity/brain/0982a867-…/artifacts/NXS3_ROSETTA_SECURITY_NANOAGENT.md`: "-55% tokens sin pérdida de datos (P1: reempacar, no resumir)", 7 patrones (tablas→rangos, listas→YAML plano, bugs→tabla densa, decisiones→pares…), 4 anti-patrones, P4 "S2 = Sprint 2, no Session 2" (abreviaturas desambiguadas por contexto), P7 "el LLM comprime y descomprime sin manual externo", P8 "wire-safe": nunca comprimir ids/claves/contexto de seguridad.
- Invariantes de seguridad: `<proyecto-externo>/docs/SYMBIAXIS_NXS_COMPENDIO.md` l.2041-2043: schema invariant, reference invariant (refs rotas), content checksum invariant (tokens críticos), "Rosetta Diff Guard"; pérdida → Tier1 reintentar con objetivo mayor, Tier2 otra estrategia, Tier3 abortar y avisar a humano. "Solo Opus o Sonnet. Haiku NUNCA (expande 75 %, alucina relaciones)."
- La especificación original (`rosetta-compression.md`, `kernel/ROSETTA_VOCAB.md`) **no existe en el equipo**: solo se la cita (`docs/FRANKE_08_auditoria-codigo.md` l.48; `~/.gemini/.../analisis_arquitectura_v2.md` l.26). Es decir, los números no son reproducibles aquí.

**B. Formato `.rosetta` de eventos de sesión (el "simbólico").** Codificación en una línea por evento, con vocabulario cerrado, de lo que pasó en una sesión.
- Código: `<proyecto-externo>/scripts/rosetta-analytics-lib.mjs` (parser) y `janitor-cycle.mjs` l.229-250 (escritor). Ejemplo real (`<backup>.tar.zst` → `backup_N003.rosetta`, 260 bytes):
  ```
  v=1 τ:impl N=#3
  verb:modify concept:#12   skill:implement Ψ5-HYGIENE E4-DRIFT
  metric:T_star=#40 metric:rho=#1.2   cut:1 … corte:recut
  ```
- Mecanismo: cabecera versionada `v=1 τ:<tipo> N=#<sesión>`; tokens `prefijo:valor` de vocabulario cerrado (`verb:`, `skill:`, `concept:#id`, `metric:k=#n`, códigos de error `E1-PRED…E9-HOOK`, mecanismos `Ψ1…Ψ6`, `corte:pass|recut`); los literales numéricos se abstraen (`#LIT`, `#X`) para minar n-gramas entre sesiones (`abstractLiterals`, `pattern-detector.mjs`, `lesson-extractor.mjs`, `memory-curator.mjs`). `ROSETTA_VOCAB.md` es el diccionario compartido y `rosetta-vocab-manager.mjs` lo mantiene (paso 2 del `janitor-cycle`, `abortOn2`). `rosetta-encode.mjs` serializa el estado de sesión en ≤3 KB.
- `context-hygiene.mjs` aplica además "compresión Rosetta (dedup de líneas/headers)" al mover ficheros warm (`FRANKE_08` l.17).

No es traducción entre ontologías ni punteros verificados: la parte de "punteros verificados con peso τ" que describe `02-sistemas-locales.md` (mecanismo 7) es **otra** pieza (compactador de GCC), ya resumida allí. Rosetta A es compresión léxica-estructural guiada por LLM; Rosetta B es un lenguaje de eventos con diccionario.

## 2. Problema y medidas

- Problema: contexto caliente que crece (MEMORY, handoffs, skills 250→100 líneas, `skills_deep_analysis.md` l.284) y necesidad de minar sesiones por máquina (B).
- Medidas disponibles: **-55 % tokens** (A); -73 % Brotli y -88 % combinado solo en el diseño A2A, diferido (COMPENDIO l.3035, 2952 "eliminada del MVP"). Pérdida: `P_ROSETTA_LOSS = 0.03` en el Monte Carlo del autor (3 % por compresión; "V4 pérdida de Rosetta" 4.233, puesto #2 de riesgos, 0.750 tras mitigación, COMPENDIO l.2214); el propio análisis crítico lo marca "el riesgo más real; el checksum semántico no es trivial y depende del LLM" (`analisis_arquitectura_v2.md` l.88).
- Verificabilidad: A depende de un LLM para descomprimir (no determinista); B es verificable por parser. **Todas las cifras son de simulación/diseño; el propio sistema avisa de poco uso real.** No hay medición propia antes/después con tokens reales. La muestra real de B son 5 ficheros de ~260 bytes.
- Dato local: `.symbiaxis/ledger.jsonl` de otro proyecto tiene 3350 eventos; los `.rosetta` reales solo existen en backups antiguos. En este proyecto no se usa Rosetta hoy.

## 3. Utilidad para opus-studio (0 = nula, 5 = alta)

Base de comparación: opus-studio ya hace lo esencial por otras vías: `orch brief` mide 595 bytes ≈ 150 tokens (límite 500) con estado por punteros/hashes; `deliver` re-ejecuta la evidencia; la memoria conceptual (`docs/MEMORIA.md` §2) ya es un grafo de ids con anclas verificables; ledger y gates existen. Docs totales: 121 KB (METRICAS 47 KB, MEMORIA 12 KB, EFICIENCIA 8.6 KB).

| eje | Rosetta A (-55 %) | Rosetta B (eventos+vocab) | Idea transferible: vocabulario común |
|---|---|---|---|
| (a) semántica | 1: comprimir MEMORIA.md no aporta; el matiz ES el producto (`04-asombro.md`) y la memoria no es contexto frío | 1 | **4** |
| (b) orquestación | 1: `brief` ya es determinista y 150 tok; un LLM en el bucle lo empeora | 2: formato de entrega ya tipado (`deliver`, schemas) | 3 |
| (c) gobernanza | 0: gate debe ser determinista (EFICIENCIA T6) | 2: el ledger ya tiene `action/target/verdict/why`; `E*` = clase cerrada de fallo ya recomendada en 02 §1 | 2 |
| (d) harness/tokens | **3**: solo sobre docs fríos largos (METRICAS.md 47 KB, PARAMS.md) y NO por LLM | 1 | 2 |

Detalle:
- (a) Lo valioso no es comprimir sino el **vocabulario cerrado con versión**. Hoy cada capa nombra lo mismo con términos propios: `kind` de concepto (entidad|regla|pregunta|…), `relacion.tipo` (causa|reinterpreta|…), ids de métrica (`montaje.asl`, `plano.scaleMix`…, `engine/metrics/registry.mjs`), códigos de lint del crítico, ids de shot/gate. Un `docs/VOCAB.md` + `engine/vocab.mjs` (fuente única, lista de términos, sinónimos prohibidos, versión) permitiría: lint que rechace términos fuera de vocab en memoria.json/crítico/notas; "puente" métrica↔concepto (p. ej. `camara.focalEq` anclado a `param` con rol); y consultas `q` coherentes. Puntuación 4 porque ataca una deriva real (varios dicts paralelos), con coste bajo y verificable.
- (b) Ya está cubierto; el único hueco es normalizar los motivos de rechazo/escalado a códigos cerrados (como `E*`): hoy `reasons` de `deliver` es texto libre; códigos permiten agregar y calibrar umbrales (mecanismo 8 de 02).
- (c) Un registro cerrado de códigos de veredicto (`verdict`, `fix key`) mejora estadísticas del ledger; no necesita Rosetta.
- (d) Un compresor semántico solo tiene sentido en docs fríos que un agente lee entero. T1 (contexto por rol ≤1,5 k tokens) gana más (-30–50 % estimado) y es curado a mano, sin riesgo de pérdida.

## 4. Riesgos

- Pérdida de matiz (3 % documentado; en opus-studio la gracia está en matices: lecturas, `why`, giros). Peor con Haiku (expande +75 %, alucina relaciones).
- Deriva del diccionario: `ROSETTA_VOCAB.md` exige gestor y janitor (10 scripts en `janitor-cycle`); el propio autor lo audita como sobreingeniería con "poco uso real".
- Descompresión no determinista → no auditable por gate; contradice T6 y el principio "nunca compresión léxica sobre identificadores" (02 §6).
- Especificación original inexistente en local: adoptar "Rosetta" sería reinventarla a ciegas.
- Mantenimiento: cada término nuevo toca docs, lint, tests.

## 5. Recomendación

**No adoptar Rosetta como compresor (A) ni como formato de sesión (B).** Adoptar solo estos mecanismos, en orden:

1. **Vocabulario controlado versionado** (valor 4/5, coste S): `engine/vocab.mjs` + sección en `docs/MEMORIA.md`/`METRICAS.md` que lo cite; enums de `kind`, `relacion.tipo`, clases de métrica, códigos de veredicto del crítico/lint, motivos de rechazo de `deliver`. Lint `vocab` en `npm test` que falle ante términos fuera de lista (mismo patrón que el lint conceptual de MEMORIA §5).
   - Test antes/después: contar (script) términos no canónicos / sinónimos distintos para el mismo concepto en `data/memoria.json`, notas de `out/notes/`, informes del crítico y docs (baseline N0 hoy; objetivo 0 y sin regresión en 5 films). Más: tasa de notas de agentes que `orch` agrupa en consenso (quorum Jaccard) antes vs después de normalizar términos (hoy dos críticos que dicen lo mismo con palabras distintas no coinciden).
2. **Códigos cerrados de fallo/veredicto en ledger** (3/5, S): `ledger.record` acepta `code` del vocab; informe `orch stats` por código. Test: el % de entradas del ledger con `why` libre sin código baja a <10 % y se pueden calibrar umbrales con el clamp bayesiano (02 §8).
3. **Reempaquetado determinista de docs fríos** (opcional, 2-3/5): script (sin LLM) que genere `docs/ctx/<rol>.md` por extracción de tablas/listas de METRICAS/PARAMS (T1). Test: tokens de arranque por rol (T9: registrar en ledger) antes/después, y prueba de que ningún id/ruta citado desaparece (reference invariant de Rosetta: set de identificadores del original ⊆ set del resultado).
4. **Rosetta B**: no. Si algún día se quiere minar sesiones de agentes, reutilizar el ledger.

Mecanismos de Rosetta que sí merecen copiarse tal cual (baratos, deterministas): *reference invariant* y *content checksum* como test de cualquier compactación; regla P8 "no tocar ids/hashes/rutas"; Tier3 "abortar y avisar" ante pérdida. No copiar: el LLM como descompresor, ni los ratios de -55 % como objetivo (sin medida propia).

## Fuentes revisadas
`<proyecto-externo>/{scripts/rosetta-analytics-lib.mjs, scripts/janitor-cycle.mjs, scripts/lesson-extractor.mjs, docs/SYMBIAXIS_NXS_COMPENDIO.md, docs/FRANKE_08_auditoria-codigo.md, docs/FRANKE_INV_scripts.md}`; `<backup>.tar.zst` (backup_N00x.rosetta); `~/.gemini/antigravity/brain/{0982a867…,bc747fc4…,d122d4a1…,fd721e81…}`; opus-studio-4 `docs/{MEMORIA,EFICIENCIA,METRICAS,ROADMAP}.md`, `engine/{orch,index,semantic}.mjs`. Búsqueda web no realizada (término propietario del autor).
