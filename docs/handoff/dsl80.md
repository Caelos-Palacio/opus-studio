# Handoff — dsl80 (spec 010: DSL de escenas al ~80 %)
Rama `dsl80` (worktree .claude/worktrees/dsl80). Sin push. Estado: **hecho**; `npm test` completo verde.

## Resultado
- Cobertura honesta **3,2 % → 92,1 %** (2 → 58 de 63 shots; el denominador real son 63 shots con `export default`, no 67). Sin los 3 pendientes de otra rama: 96,7 %.
- No convertidos: **D01, P03, P04** (`pendiente:world3d2`, siguen contando en contra) y **A1, A2** (`escape`: son el objetivo de las mutaciones de test/run.mjs, golden.mjs, gov.mjs y orch, que editan su JS por texto; convertirlos obliga a reescribir esos tests).
- Conversión 1:1: sha256 de píxeles idéntico al JS legado en 6 instantes por shot (in 0,02 / 0,25 / 0,4 / mid 0,5 / 0,75 / out 0,98). Legado en `test/fixtures/dsl-legacy/<id>.mjs`; hashes de referencia (sacados del JS intacto, determinista) en `test/fixtures/dsl-legacy/hashes.json` (`node test/dsl-cov.mjs --gen` solo con el JS legado intacto).
- Honestidad: solo 1 shot (A3) es 100 % nativo; el resto usa objetos **respaldados por una función de módulo** (plot/axis/world/hud/caption/word/ring…) con semántica, params y deps declarados. `custom` cuenta como NO convertido (ningún shot lo usa). La lógica de dibujo sigue en `M_mundo/R_mundo/P_mundo/K_tipo`.

## Qué se añadió (engine/dsl-core.mjs, engine/dsl-coverage.mjs)
- `node engine/dsl.mjs coverage [--json]`: clasifica cada shot (dsl/pendiente/escape/convertible/falta:<rasgos>) por análisis AST; determinista; entrada `data/dsl-coverage.json` (pendientes, escapes con razón, mapa libfn→tipo, `ratchet.min`). Resumen en STATUS.md (parte estática).
- Valores estructurados (`args`, `let.value`, `opts`), `{"$lit"}`, `fns` (funciones puras de lib; `bind: [film|shot|t|api|P]`, `reads`), `let` de lib con `fields`, entidades con `make`.
- Tipos: `curve`, `lines`, `repeat` (`i`,`n`, `items` literal o expr, `fields`), `formula` (api.tex), `layer`, `smear`, `impact`, `box`, `particles` (semilla, rng sembrado; `ra rb rc`), `world3d` nativo (`scene` como datos + `cam` en `t3`; diff semántico `obj.3d.<id>`), `shape` con stroke/alpha, `group.translate`, `world/hud/caption` (respaldados), `word/focusOf/ring/dot/shatter/cracks/gridlines/playhead` (tipografía cinética; `word` publica x,y,w,h, acumula `boxes`, `per`).
- Variables: `t0 t1 dt S_x0..S_cy boxes`; funciones kit `at param color vec str cat has len nil inkA box set item take pget chr`. Ids no pueden ser constantes (`e`, `pi`…): ¡`e` es Euler!
- Libs nuevas: `R_eco`, `P_dsl`, `K_dsl` (+ `runStart` en M_mundo). Entidades de relevo de P11–P13 en P_dsl.
- Tests: `test/dsl-cov.mjs` (C1–C9; registrado en run.mjs; `--fast` salta C3b/C8/C9). Ratchet C7 (umbral 92 %).

## Riesgos / notas
- P shots dependen de exports de `P_mundo.mjs` (ride, hud, caption, geo, ruler, sqdot, person, proj, Lof…) que toca world3d2: si renombran, rompen P01/P02/P05–P13 (el test C3 lo detecta).
- Los R `world` son opacos a propósito (leen la fuerza de golpes de OTROS planos).
- Perf (C9): ×0,99–1,01 vs JS por film.
- Editar un shot DSL = editar `shots/X.scene.json` y `node engine/dsl.mjs build --all` (el .mjs es generado). Mutaciones de test sobre A3 ya apuntan al JSON generado.
