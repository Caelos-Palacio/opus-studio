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
| [009-motor.md](docs/specs/009-motor.md) | 009 — Motor: renderizar una vez, analizar muchas, recalcular solo lo afectado | sin nota |

## Motor

- versión: 5.0.0 (package.json) · módulos engine/: 77
- roles: modo `enforce` (*, director, dp, investigador, td, productor, animator, review) · digest `35a737817acffefa`
- presupuestos: data/budgets.json digest `5290bbde06ea538a`

## Tests

Archivos (test/*.mjs): `arc.mjs` `bench-skia.mjs` `critic.mjs` `cut-render.mjs` `film.mjs` `fuzz.mjs` `golden.mjs` `gov.mjs` `guard.mjs` `harness.mjs` `hash.mjs` `lib.mjs` `medios.mjs` `memoria.mjs` `metrics.mjs` `motor.mjs` `orch.mjs` `orquestacion.mjs` `params.mjs` `perf.mjs` `run.mjs` `schema.mjs` `semantica.mjs` `sound.mjs` `unit.mjs` `world3d.mjs`
<!-- estatico:fin -->

---
## Estado vivo (2026-10-06T07:38Z, no verificado)

## Veredictos

Film activo: `main` · engineHash `ebc374a380a6d28d1082ed67baa699b007e5ca0934b7c90896ecb2ccab3f8443` · filmHash `2ba9a9d721cb4a06`

- out/lint.json: SHIP · CADUCADO
- out/critic.json: no existe
- veredictos por shot: 0 vigentes, 3 caducados

### Estado de gates (out/gates.json)

- sin cierres registrados

## Ramas sin integrar

- `backup/pre-limpieza` (+136 commits)
- `dsl80` (+3 commits)
- `gobernanza` (+96 commits)
- `harness` (+101 commits)
- `medios` (+57 commits)
- `metricas` (+76 commits)
- `motor` (+10 commits)
- `orquestacion` (+101 commits)
- `perf` (+53 commits)
- `semantica` (+101 commits)
- `video-mate` (+33 commits)
- `video-reel` (+34 commits)
- `video-regla` (+34 commits)
- `webgl` (+54 commits)
- `worktree-agent-a049889bf20ebb2cd` (+13 commits)
- `worktree-agent-a1f3f4cce9534ba97` (+13 commits)
- `worktree-agent-a351ba6d1439c5e43` (+1 commits)
- `worktree-agent-a45af98f7a4cfb3f6` (+2 commits)
- `worktree-agent-a55c05dc1fd0f272f` (+60 commits)
- `worktree-agent-a616aaafdca8853f3` (+16 commits)
- `worktree-agent-ab093d854c5aaefeb` (+13 commits)
- `worktree-agent-abde1344f4aeba643` (+1 commits)
- `worktree-agent-aeb50bfa4294a3a73` (+1 commits)
- `worktree-agent-aeecba00c45e50119` (+2 commits)
- `world3d` (+75 commits)
- `world3d2` (+8 commits)

## Último run de tests

- 2026-10-06T07:38:34.748Z: todo verde

## Ledger

- cadena: íntegra · 25 entradas (25 encadenadas, 0 heredadas, 0 firmadas) · códigos 92 %

## Presupuestos

- sin consumo registrado
