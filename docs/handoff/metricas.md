# Handoff — spec 005 métricas

Estado: implementado y con tests (test/metrics.mjs, en el bucle de test/run.mjs).

## Qué hay
- `engine/metrics/registry.mjs`: 65 métricas (fuente única) → `docs/METRICAS.md` se genera con `npm run metrics -- doc` (un test verifica que está al día).
- `engine/metrics/{mathx,colorimetry,audiox,units,measure,doc}.mjs`; CLI `engine/metrics.mjs` (`[film]`, `compare a b`, `table k…`, `calibrate`, `units`, `doc`).
- Salida `out/metrics/<film>.json|md` (esquema `opus-metrics/1`). Tabla de los 6 films: `docs/research/09-metricas-films.md`.
- `data/notas.json`: notas del usuario por versión (specs 001–003); `calibrate` queda preparado, hoy 0 notas medibles (n<4).

## Decisiones / límites
- Fuentes semánticas: timeline, cámara analítica (camState), paleta, memoria, story, audio; píxeles solo en `color.cutDeltaE`.
- Convenciones declaradas en `CONVENTIONS` (focal base 35 mm eq., visionado 3H, τ pulso 40 ms…) con sensibilidad.
- El render del motor cuesta ~0,1 s/fotograma: muestreo adaptativo (≤~400 muestras, 2–8 Hz); `--fps N` lo fuerza.
- `drama.*`: índice compuesto propio (PIT de cortes, cámara, movimiento, sonoridad, preguntas abiertas); IC = rango leave-one-out, no estadístico.
- Rangos típicos por género: orientativos, sin corpus propio; verificar contra la fuente.
- Audio: usa data/mix*.wav si su hash coincide; si no, `sound.build` y caché en out/metrics/cache.

## Pendiente
- Calibrar con más notas del usuario (rellenar `data/notas.json`, `medible:true`).
- Acelerar el render de muestreo (caché de cajas por hash de shot).
