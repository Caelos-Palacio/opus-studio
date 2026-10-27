# test/suites.d

Una suite por archivo `.json` (mismo objeto que en `test/suites.mjs`; ver su cabecera).

## `"carga": true` (suite sensible a la carga)
- Qué es: una suite cuyo resultado depende de cuántos procesos comparten la máquina. Hoy solo `dsl-perf`
  (cociente de cronómetros DSL/JS ≤ 1,10 por film).
- Efecto: si falla, `npm test` imprime `⚠ AVISO` y la cuenta como aviso; NO suma a «N fallos» ni rompe `--full`.
- Criterio para marcarla: la suite mide TIEMPO (razones entre cronómetros, topes en ms). Una suite que compara
  píxeles, hashes o valores lógicos nunca lleva `carga`.
- Ante un aviso: repetirla en reposo con `npm test -- --full --only <name>`. Si también falla en reposo, es una
  regresión real y hay que tratarla como fallo.
