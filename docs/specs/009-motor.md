# 009 — Motor: renderizar una vez, analizar muchas, recalcular solo lo afectado

## Intención
"Iterar un shot debe costar segundos, no minutos; el master en frío, un tercio." (docs/current/EFICIENCIA.md, F6)

## Traducción a medibles
1. R1 caché compartida de fotogramas de análisis (lint, arc, peek, index): clave = (cookKey de los shots activos + firma global del film y del motor, t, tamaño, grade, guardia).
2. R6 lint incremental: determinismo cacheado por muestra (solo los OK; cuando corre, renderiza dos veces DE VERDAD, sin caché) y `--shot` real en todos los checks.
3. R7 audio: la síntesis (partitura y eventos sfx) se cachea por hash; cambiar un shot no re-sintetiza todo; la causa del ×3 de la síntesis queda medida y corregida.
4. Por defecto: `fxFast` en lint/peek/review (no master); preset `faster` + threads auto en cut (entra en el hash del fragmento).
5. Golden bit a bit intacto; `npm test` verde; medidas antes/después en docs/current/EFICIENCIA.md.

## Fuera de alcance
Migrar a Skia, workers de lint (P6), caché de texturas (P7), tocar critic/gate/memoria/medios (otros agentes).

## Escenarios (BDD) — test/motor.mjs
- M1 Dado el mismo film y t, la clave del fotograma es estable; cambiar el entry de A2 cambia la clave de los fotogramas donde A2 está activo y NO los de A1 en solitario; tamaño, grade y guardia cambian la clave.
- M2 Un fotograma servido desde caché es idéntico (cajas, meta, píxeles) al render directo; el segundo acceso es un acierto.
- M3 `lint` en caliente da exactamente los mismos avisos que en frío y que con `OPUS_NOCACHE=1`.
- M4 Tras cambiar A2, `lint --shot A2` solo renderiza fotogramas donde A2 está activo (fallos de caché ⊂ ventana de A2) y no re-renderiza los de A3 en solitario.
- M5 Determinismo: con la caché de fotogramas y de determinismo calientes, un shot que se vuelve no determinista (sin cambiar su código-clave) sigue detectándose: el check renderiza dos veces de verdad (`OPUS_NOCACHE=1` y la mutación `estado-global` lo prueban; la caché solo guarda los OK).
- M6 `--shot` real: motion y rhythm solo recorren la ventana del shot (nº de fotogramas ≪ film entero).
- M7 fxFast: activo por defecto en lint, peek y `cut --review`; apagado en master; `OPUS_FXFAST=0` lo fuerza fuera.
- M8 cut: preset por defecto `faster`, hilos `auto`, ambos en el hash del fragmento; `--preset medium` da otro hash.
- M9 Audio: dos `build` seguidos dan la misma mezcla bit a bit; con la caché de síntesis caliente la mezcla sale idéntica y sin re-sintetizar eventos; tocar un evento solo re-sintetiza ese evento.

## Calificaciones
(sin output audiovisual: no aplica nota de gusto)
