# Spec 015 — toolbox: descubrimiento progresivo de herramientas

## 1. Intención (palabras del usuario)
«Un sistema de código que ayude al agente a orquestar, decidir y usar las herramientas sin ver todo el catálogo completo en su contexto.»

## 2. Problema medido
Un agente que produce un film lee hoy CLAUDE.md, SKILL.md, CRAFT, CINE, STYLES, MOTOR, API, STATUS, HANDOFF, ROADMAP…
≈ 15 k tokens (chars/4) solo para arrancar, y aun así no sabe qué herramienta toca en cada paso (cuál de ~45 comandos,
~20 primitivas, 40 tipos DSL, 9 medios, 4 estilos de sonido, 66 métricas, ~80 checks). El catálogo vive repartido
(package.json, commands.json, DOC de prims, TYPES del DSL, styles/, vocab, registry de métricas).

## 3. Traducción a medibles
| # | medible | umbral |
|---|---|---|
| M1 | registro único generado del código, determinista, con test de «al día» | `tools build --check` = 0 |
| M2 | búsqueda local (BM25 + sinónimos del canon), sin red ni LLM | recall@3 ≥ 0,85 en ≥ 25 intenciones |
| M3 | `tools plan` lee el estado real y devuelve 3–5 pasos con comando exacto y porqué; nunca sugiere master si el gate no pasa | test sobre estados sintéticos y real |
| M4 | `tools brief` reemplaza la lectura de docs | ≤ 1 500 tokens por rol |
| M5 | salida acotada | `--max-tokens` respetado (±0 líneas de exceso) |
| M6 | arranque de un agente | ≥ 80 % menos tokens que la lista de lectura previa (medido en EFICIENCIA.md §T-toolbox) |

## 4. Diseño
**Entrada del registro** (`data/tools.index.json`, generado por `node engine/tools.mjs build`):
`{id, kind, resumen, tags[], cuando, entra, sale, coste:{tiempo, tokens}, ejemplo, siguiente[], fases[], src}`.
`id = <kind>:<nombre>`. Kinds: `cli`, `prim` (api.*), `dsl` (tipos de objeto), `estilo`, `medio`, `sonido` (estilo de
sonido), `voz` (sfx), `metrica`, `check` (etapas y reglas del lint, narr, arc), `fondo`, `objeto`.
Fuentes (todo del código): `package.json` scripts + cabecera `//` del script (resumen), `data/commands.json`, `DOC` de
`prims.mjs`/`sakuga.mjs`, `TYPES` de `dsl-core.mjs`, `styles/*.json`, `styles/medios/*.json`, `styles/sound/*.json`,
`VOICES` de `sound.mjs`, `REGISTRY` de `metrics/registry.mjs`, `data/vocab.json` (definición de checks).
Lo que el código no puede saber (cuándo usarla, tags de intención, siguiente paso, coste, ejemplo, sinónimos, fases,
reglas duras) vive en **`data/tools.meta.json`** (curado, pequeño); el registro lo fusiona por id y el test exige que
cada id citado exista (nada huérfano).

**Contrato `meta` uniforme** (lo expondrá la rama `fondos`; el registro es tolerante a que aún no exista).
Un módulo `engine/fondos.mjs`, `engine/objetos.mjs` (o `engine/fondos/index.mjs`, `engine/objetos/index.mjs`) exporta
`META`: array de
```
{ id: "niebla",                       // kebab/snake, único dentro de su tipo
  resumen: "niebla por capas con parallax; densidad y deriva",   // ≤ 15 palabras
  tags: ["niebla","atmósfera","profundidad"],                    // ≥ 1, minúsculas
  params: { densidad: "number", color: "color", modo: "enum" },  // tipos ⊂ number|integer|string|color|boolean|enum|json
  cuando?, ejemplo?, siguiente?: [ids] }                         // opcionales
```
El tipo (`fondo`|`objeto`) sale del nombre del módulo (o del campo `kind` de la entrada). Una entrada que incumple el
contrato no entra al registro y `tools build` la lista como aviso. `validateMeta` es la referencia ejecutable.

**Búsqueda** (`tools find`): normaliza (minúsculas, sin acentos, stopwords es), raíz de 6 letras, expande con grupos de
sinónimos (curados + `forbid` del vocabulario controlado: `reveal` → `revelación`) con peso 0,5, BM25 (k1=1,2, b=0,75)
sobre campos ponderados (id/tags ×3, resumen ×2, cuando ×2, resto ×1). Salida: una línea por resultado
`id · resumen · uso` y corte por `--max-tokens` (≈ chars/4). `show <id>` = ficha completa de UNA herramienta.
`next <id|fase>` = qué suele seguir (grafo `siguiente` + orden de fases).

**Plan** (`tools plan "<objetivo>"`): lee estado real (film activo, brief, estilo, hechos, audio, shots, story v2,
lint vigente, narr, crítico, gates, master) → lista ordenada de pasos con estado hecho/pendiente/bloqueado →
devuelve los 3–5 siguientes con comando exacto y porqué. Si el objetivo nombra una fase (p. ej. «master»), recorta hasta
ella. `master` solo aparece si lint SHIP vigente ∧ 0 FIX narrativos (story v2) ∧ crítico sin FIX; si no, el paso es
«desbloquear» con las razones de `gate verify`. Integra `orch plan` (oleadas de shots) y `orch resume` (retomar).
Función pura `nextSteps(estado, objetivo)` → reproducible.

**Brief** (`tools brief --role director|td|animator|dp|review`): mapa del pipeline (fase → comando), reglas duras
(gusto, no push, 3DD, gates, sin shell), contratos de código del rol, y cómo pedir más (`find`/`show`/`plan`). Se
genera de `meta.reglas` + `data/ctx.json` + registro; ≤ 1 500 tokens (test).

## 5. Escenarios BDD
1. Dado el repo, cuando corro `tools build --check`, entonces sale 0; si cambio un DOC de prims y no regenero, sale 1. [máquina]
2. Dada la intención «poner niebla en el fondo», `find` devuelve en el top-3 la herramienta esperada; en las ≥ 25
   intenciones de `data/tools.eval.json`, recall@3 ≥ 0,85. [máquina]
3. Dado `--max-tokens 60`, la salida cabe en 60 tokens. [máquina]
4. Dado un estado sin lint, `plan "master"` no contiene `npm run master` y sí «lint». Dado un estado con todo vigente, sí. [máquina]
5. Dado un estado con story v2 y FIX narrativos, `plan` no sugiere master y nombra `narr`. [máquina]
6. Dado un `META` de fondos válido en un directorio temporal, entra al registro como `fondo:<id>`; inválido → aviso, no entra. [máquina]
7. `brief` de cada rol ≤ 1 500 tokens y determinista. [máquina]
8. El agente produce un film empezando por `tools brief` y consultando `find/show` sin releer los docs. [HUMANO: nota del usuario]

## 6. Fuera de alcance
Ejecutar las herramientas por el agente (solo recomienda el comando); embeddings o LLM; sustituir a `orch`/`gate`.
`tools plan` no cambia ningún estado.

## 7. Calificaciones
(pendiente de la nota del usuario)
