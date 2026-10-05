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
| [002-soundtrack.md](docs/specs/002-soundtrack.md) | 002 — Soundtrack como sistema (no solo música) | potencias v2 · pendiente de calificación · soundtrack completo (música + diseño sonoro + mezcla); medibles en verde, falta el oído del usuario |
| [003-mundo-visual.md](docs/specs/003-mundo-visual.md) | 003 — Mundo visual: personalidad y gusto (no fondo negro) | regla / reel / mate v1 · "bien, no wow" · fondo negro monótono; falta personalidad y gusto |
| [004-world3d.md](docs/specs/004-world3d.md) | 004 — world3d: 3D real integrado sin costuras | world3d v1 (datacenter D01 + variante w3d de Potencias P03) · — · implementado (docs/handoff/world3d.md); pendiente de juicio de gusto |
| [005-metricas.md](docs/specs/005-metricas.md) | 005 — Métricas con sentido: unidades reales y estandarizables | sin nota |
| [007-orquestacion.md](docs/specs/007-orquestacion.md) | 007 · Orquestación al límite (paso 4 del roadmap) | sin nota |
| [008-gobernanza.md](docs/specs/008-gobernanza.md) | 008 — Gobernanza al límite (roadmap paso 5) | sin nota |

## Motor

- versión: 4.0.0 (package.json) · módulos engine/: 69
- roles: modo `enforce` (*, director, dp, investigador, td, productor, animator, review) · digest `35a737817acffefa`
- presupuestos: data/budgets.json digest `5290bbde06ea538a`

## Tests

Archivos (test/*.mjs): `arc.mjs` `bench-skia.mjs` `critic.mjs` `cut-render.mjs` `film.mjs` `fuzz.mjs` `golden.mjs` `gov.mjs` `guard.mjs` `harness.mjs` `hash.mjs` `lib.mjs` `medios.mjs` `memoria.mjs` `metrics.mjs` `orch.mjs` `orquestacion.mjs` `params.mjs` `perf.mjs` `run.mjs` `schema.mjs` `sound.mjs` `unit.mjs` `world3d.mjs`
<!-- estatico:fin -->

---
## Estado vivo (2026-10-05T21:09Z, no verificado)

## Veredictos

Film activo: `main` · engineHash `dcae96b470dff953f3775c2e924fdb52744d1754290c3051f1997d962dc1e6bc` · filmHash `8ac843059ba51e5f`

- out/lint.json: SHIP · CADUCADO
- out/critic.json: no existe
- veredictos por shot: 0 vigentes, 3 caducados

### Estado de gates (out/gates.json)

- sin cierres registrados

## Ramas sin integrar

- `orquestacion` (+10 commits)
- `semantica` (+11 commits)

## Último run de tests

- 2026-10-05T21:08:16.081Z: todo verde

## Ledger

- cadena: íntegra · 11 entradas (0 encadenadas, 11 heredadas, 0 firmadas) · códigos 100 %

## Presupuestos

- sin consumo registrado
