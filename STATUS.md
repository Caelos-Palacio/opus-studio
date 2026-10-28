# STATUS

> GENERADO por `node engine/status.mjs`; no se edita a mano. La parte estática se verifica en `npm test` (desactualizada = fallo).

<!-- estatico:inicio -->
## Gates

Definición (gates.json); el estado de cierre está en la parte viva.

| gate | criterios | digest |
|---|---|---|
| validate | timeline válido y shots sin patrones prohibidos | `1d336c572b75cd9e` |
| animatic | cortes en beat; cámara dentro del estilo | `f9639b9a3f487c6b` |
| lint | lint completo en SHIP | `d89c1cce4b6920c0` |
| master | SHIP vigente y crítico sin FIX | `d8c9278b351beea0` |

## Specs

| spec | título | última nota humana |
|---|---|---|
| [001-epico-vibrante.md](docs/specs/001-epico-vibrante.md) | 001 — Del "correcto" al "épico y vibrante" | potencias + música PoC · 6–7 · la música mejora; quizá más el beat de tensión; falta refinar y sistematizar; mejorar TODO el soundtrack, no solo la música → spe |
| [002-soundtrack.md](docs/specs/002-soundtrack.md) | 002 — Soundtrack como sistema (no solo música) | potencias v2 · **8** (2026-10-05) · "algo mejor, sí": objetivo ≥ 8 alcanzado en soundtrack; música + diseño sonoro + mezcla sistematizados |
| [003-mundo-visual.md](docs/specs/003-mundo-visual.md) | 003 — Mundo visual: personalidad y gusto (no fondo negro) | regla / reel / mate v1 · "bien, no wow" · fondo negro monótono; falta personalidad y gusto |
| [004-world3d.md](docs/specs/004-world3d.md) | 004 — world3d: 3D real integrado sin costuras | world3d v1 (datacenter D01 + variante w3d de Potencias P03) · **8** (2026-10-05) · bien para demo, fluido, estilo acorde; PERO plano, falla la integración con e |
| [005-metricas.md](docs/specs/005-metricas.md) | 005 — Métricas con sentido: unidades reales y estandarizables | sin nota |
| [006-semantica.md](docs/specs/006-semantica.md) | 006 — Semántica al límite: el vídeo como datos con significado | sin nota |
| [007-orquestacion.md](docs/specs/007-orquestacion.md) | 007 · Orquestación al límite (paso 4 del roadmap) | sin nota |
| [008-gobernanza.md](docs/specs/008-gobernanza.md) | 008 — Gobernanza al límite (roadmap paso 5) | sin nota |
| [009-world3d-v2.md](docs/specs/009-world3d-v2.md) | 009 — world3d v2: profundidad, escenario y ángulo | S10 Dado un film que usa world3d, Entonces su story.json declara desde el guion qué beats son 3D y por qué (concepto de la memoria que el 3D encarna); el lint d |
| [010-dsl-80.md](docs/specs/010-dsl-80.md) | 010 — DSL de escenas al ~80 % de los shots | sin nota |
| [011-motor.md](docs/specs/011-motor.md) | 011 — Motor: renderizar una vez, analizar muchas, recalcular solo lo afectado | sin nota |
| [012-produccion-v2.md](docs/specs/012-produccion-v2.md) | 012 — Producción v2: Regla, Reel y Potencias | mate_papel · terracota · — (2026-10-06) · "está muy bien" |
| [013-storytelling.md](docs/specs/013-storytelling.md) | 013 — Storytelling auténtico: voz, ancla, frescura | (pendiente) ·  ·  ·  · |
| [014-fondos-objetos.md](docs/specs/014-fondos-objetos.md) | 014 — Fondos generativos y biblioteca de objetos | sin nota |
| [015-toolbox.md](docs/specs/015-toolbox.md) | Spec 015 — toolbox: descubrimiento progresivo de herramientas | sin nota |
| [016-recetas.md](docs/specs/016-recetas.md) | 016 — Recetas: el agente no escribe todo el código | sin nota |
| [017-consta-foley.md](docs/specs/017-consta-foley.md) | 017 — Consta: foley de archivo y film sin música | consta · (pendiente) ·  · |
| [019-boceto.md](docs/specs/019-boceto.md) | 019 — Boceto rápido y preview en vivo (E4) | sin nota |
| [020-vectores-diagramas.md](docs/specs/020-vectores-diagramas.md) | 020 — Vectores y diagramas: SVG como elemento y láminas desde datos | sin nota |
| [021-fondos-libres.md](docs/specs/021-fondos-libres.md) | 021 — Fondos libres: parámetros animables, capa `codigo`, fondo reactivo y anti-menú | sin nota |
| [022-estudio-v6.md](docs/specs/022-estudio-v6.md) | 022: Estudio v6, autónomo, con dirección propia y storyboard opcional | sin nota |

## Motor

- versión: 5.0.0 (package.json) · módulos engine/: 104
- roles: modo `enforce` (*, director, dp, investigador, td, productor, animator, review) · digest `35a737817acffefa`
- presupuestos: data/budgets.json digest `5290bbde06ea538a`

## DSL de escenas (spec 010)

- cobertura: **94.6 %** (88/93 shots en DSL; honesta: los 1 pendientes de otra rama cuentan en contra; sin ellos 95.7 %) · umbral ratchet 95 %
- clases: dsl 88 · escape 2 · falta 2 · pendiente:world3d2 1 · shots 100 % nativos 29 · el resto usa objetos respaldados por una función de módulo (plot/axis/world/hud/word…) con semántica y deps declaradas
- escapes: A1 (objetivo de las mutaciones de test/run.mjs, golden.mjs, gov.mjs y orch: esos tests editan su JS por texto); A2 (objetivo de las mutaciones de test/run.mjs, golden.mjs, gov.mjs y orch: esos tests editan su JS por texto)
- pendientes: D01 (world3d2)

## Tests

Archivos (test/*.mjs): `arc.mjs` `bench-skia.mjs` `boceto.mjs` `consta.mjs` `critic.mjs` `cut-render.mjs` `diagramas.mjs` `dsl-cov.mjs` `film.mjs` `fondo.mjs` `fondos-libres.mjs` `fondos.mjs` `fuzz.mjs` `golden.mjs` `gov.mjs` `guard.mjs` `gusto.mjs` `harness.mjs` `hash.mjs` `lib.mjs` `medios.mjs` `memoria.mjs` `metrics.mjs` `motor.mjs` `narr.mjs` `orch.mjs` `orquestacion.mjs` `params.mjs` `perf.mjs` `prores.mjs` `recetas.mjs` `run.mjs` `schema.mjs` `semantica.mjs` `sound.mjs` `suites.mjs` `tools.mjs` `unit.mjs` `v6.mjs` `vectores.mjs` `veinticuatro.mjs` `world3d.mjs`
<!-- estatico:fin -->

---
## Estado vivo (2026-10-28T04:47Z, no verificado)

## Veredictos

Film activo: `main` · engineHash `ac53f4628f2426c76bf7df7b12ba01d4b315d08104e6bcb2fd47eb6859382145` · filmHash `6ec52381bb16a11c`

- out/lint.json: SHIP · CADUCADO
- out/critic.json: SHIP · CADUCADO
- veredictos por shot: 0 vigentes, 3 caducados

### Estado de gates (out/gates.json)

- sin cierres registrados

## Ramas sin integrar

- `backup/pre-limpieza` (+138 commits)
- `boceto` (+164 commits)
- `deuda` (+34 commits)
- `deuda2` (+127 commits)
- `diagramas` (+152 commits)
- `dsl80` (+54 commits)
- `film-botella` (+169 commits)
- `film-consta` (+234 commits)
- `film-veinticuatro` (+170 commits)
- `fondo` (+107 commits)
- `fondos` (+130 commits)
- `fondos-libres` (+220 commits)
- `gobernanza` (+98 commits)
- `harness` (+103 commits)
- `kit-v2` (+237 commits)
- `medios` (+59 commits)
- `medios2` (+35 commits)
- `metricas` (+78 commits)
- `motor` (+40 commits)
- `narr` (+106 commits)
- `orquestacion` (+103 commits)
- `perf` (+55 commits)
- `prod-potencias` (+87 commits)
- `prod-reel` (+82 commits)
- `prod-regla` (+82 commits)
- `recetas` (+129 commits)
- `semantica` (+103 commits)
- `toolbox` (+122 commits)
- `vectores` (+203 commits)
- `video-mate` (+35 commits)
- … y 21 más

## Último run de tests

- 2026-10-27T18:52:59.099Z: 1 fallos (perfil full)

## Ledger

- cadena: íntegra · 16 entradas (5 encadenadas, 11 heredadas, 0 firmadas) · códigos 100 %

## Presupuestos

- sin consumo registrado
