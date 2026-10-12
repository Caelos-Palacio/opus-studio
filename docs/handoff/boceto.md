# Handoff — boceto rápido y preview en vivo (spec 019, rama `boceto`)

## Hecho
- `opus boceto`, `opus preview` (+ `npm run boceto|preview`), degradación declarada, DSL `"boceto"`, test `test/boceto.mjs` (23 comprobaciones, suite `test/suites.d/boceto.json`),
  Fase 6b en `docs/current/IDEACION.md`, toolbox (`cli:boceto`, `cli:preview`), spec 019, ROADMAP E4.
- Tocado en el motor: `film.mjs` (hook `OPUS_BOCETO`), `medium.mjs` (erosión/grano opcionales), `dsl-core.mjs` (propiedad común `boceto`), `render.mjs` (sin `tune` del medio en boceto), `opus.mjs` (subcomandos).

## Cifras (misma máquina; reloj/CPU; frío salvo indicación)
| film | completo (`cut --force`) | boceto | ganancia |
|---|---|---|---|
| sistema (40 s, 1080p30) bajo carga ≈40 | 257 s / 723 s CPU | 19 s / 54 s CPU | 13× |
| mate_papel (90 s, 720p30) bajo carga ≈40 | 414 s / 1121 s CPU | 69 s / 194 s CPU | 6× |
| carga baja (≈2–17) | — | sistema 11,6 s · mate_papel 29 s | |
| caliente (fragmentos en caché) | 9 s (master caliente, ROADMAP) | sistema 3,8 s | |
- Preview: fotograma 10–200 ms (caché hit ≈ 1 ms), arranque ≈ 3 s, recarga tras guardar < 2 s.

## Hallazgo (fuera de alcance, no resuelto)
- En mate_papel el coste por fotograma NO baja con la resolución en shots con texto como «¿… e a iπ?»: ~175 ms/fotograma por `measureText`/`fillText` de Pango (probable búsqueda de glifo
  de reserva para «π»), igual en master y boceto. Memorizar `measureText` no ayuda (el coste pasa a `fillText`). Arreglo posible: registrar una fuente con Greek / cubrir el glifo, o cachear el texto rasterizado.
  Limita el boceto de mate_papel (≈ 6× en vez de ≈ 13×).

## Pendiente / decisiones
- H1 (nota del usuario) sobre si el boceto basta para decidir.
- `boceto` recompila `shots/*.mjs` generados si estaban desactualizados (cambia el árbol; es lo mismo que `dsl build`).
- Audio del boceto: solo mezcla cacheada; sin ella el mp4 sale mudo.
