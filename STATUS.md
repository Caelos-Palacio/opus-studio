# STATUS

> GENERADO por `node engine/status.mjs`; no se edita a mano. La parte estática se verifica en `npm test` (desactualizada = fallo).

<!-- estatico:inicio -->
## Gates

Definición (gates.json); el estado de cierre está en la parte viva.

| gate | criterios | digest |
|---|---|---|
| validate | timeline válido y shots sin patrones prohibidos | `a93cc59d483e0c67` |
| animatic | cortes en beat; cámara dentro del estilo | `be26d3a3071c7b85` |
| lint | lint completo en SHIP | `b28987b62f7088d2` |
| master | SHIP vigente y crítico sin FIX | `4f2848111ace06b4` |

## Specs

| spec | título | última nota humana |
|---|---|---|
| [001-epico-vibrante.md](docs/specs/001-epico-vibrante.md) | 001 — Del "correcto" al "épico y vibrante" | potencias + música PoC · 6–7 · la música mejora; quizá más el beat de tensión; falta refinar y sistematizar; mejorar TODO el soundtrack, no solo la música → spe |
| [002-soundtrack.md](docs/specs/002-soundtrack.md) | 002 — Soundtrack como sistema (no solo música) | potencias v2 · pendiente de calificación · soundtrack completo (música + diseño sonoro + mezcla); medibles en verde, falta el oído del usuario |
| [003-mundo-visual.md](docs/specs/003-mundo-visual.md) | 003 — Mundo visual: personalidad y gusto (no fondo negro) | regla / reel / mate v1 · "bien, no wow" · fondo negro monótono; falta personalidad y gusto |
| [004-world3d.md](docs/specs/004-world3d.md) | 004 — world3d: 3D real integrado sin costuras | world3d v1 (datacenter D01 + variante w3d de Potencias P03) · — · implementado (docs/handoff/world3d.md); pendiente de juicio de gusto |
| [005-metricas.md](docs/specs/005-metricas.md) | 005 — Métricas con sentido: unidades reales y estandarizables | sin nota |
| [008-gobernanza.md](docs/specs/008-gobernanza.md) | 008 — Gobernanza al límite (roadmap paso 5) | sin nota |

## Motor

- versión: 4.0.0 (package.json) · módulos engine/: 63
- roles: modo `enforce` (*, director, dp, investigador, td, productor, animator, review) · digest `35a737817acffefa`
- presupuestos: data/budgets.json digest `5290bbde06ea538a`

## Tests

Archivos (test/*.mjs): `arc.mjs` `bench-skia.mjs` `critic.mjs` `cut-render.mjs` `film.mjs` `golden.mjs` `gov.mjs` `guard.mjs` `hash.mjs` `lib.mjs` `medios.mjs` `memoria.mjs` `metrics.mjs` `orch.mjs` `params.mjs` `perf.mjs` `run.mjs` `schema.mjs` `sound.mjs` `unit.mjs` `world3d.mjs`
<!-- estatico:fin -->

---
## Estado vivo (2026-10-05T20:51Z, no verificado)

## Veredictos

Film activo: `main` · engineHash `538122bb31bdb781bb39d6764406e5174aa1f364d50752146f93cc26c176d46b` · filmHash `8ac843059ba51e5f`

- out/lint.json: SHIP · CADUCADO
- out/critic.json: no existe
- veredictos por shot: 0 vigentes, 3 caducados

### Estado de gates (out/gates.json)

- sin cierres registrados

## Ramas sin integrar

- `harness` (+9 commits)
- `orquestacion` (+10 commits)
- `semantica` (+10 commits)

## Último run de tests

- sin out/tests.json (lo escribe `npm test`)

## Ledger

- cadena: íntegra · 11 entradas (0 encadenadas, 11 heredadas, 0 firmadas) · códigos 100 %

## Presupuestos

- sin consumo registrado
