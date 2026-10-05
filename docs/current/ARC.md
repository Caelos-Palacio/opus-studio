# ARC: lint dramático (F5)

`engine/arc.mjs` pasa de "el film es correcto" a "el film tiene un arco". Contrasta el **spine declarado**
(`data/story.json`, esquema `data/story.schema.json`) con lo que **mide** en el render. Criterio de hecho de F5:
el test A/B de `test/arc.mjs` da FIX a la versión "PowerPoint" y SHIP a la versión con arco, con la misma story.

```
npm run arc                                   # out/arc.json {verdict, score 0-100, measures, checks, issues}
node engine/arc.mjs --timeline X --story Y    # --fps 12, --record (apunta las medidas a data/arc.calib.json)
node engine/lint.mjs --only arc               # la misma etapa dentro del lint (los issues salen con prefijo [arc])
node test/arc.mjs [--quick]                   # unidades + A/B real (test/fixtures/arc/{flat,arc})
```

Sin `story.json` (`data/story.json` para el film `main`; otros films: `--story`, `OPUS_STORY` o `film.story`) arc emite
un único WARN y los medibles como información. **Nunca FIX**: el demo no cambia de veredicto sin intención declarada.
`data/story.template.json` es el punto de partida.

## Qué comprueba

| bloque | medible | nivel |
|---|---|---|
| spine causal | cada beat enlaza con `pero` o `por lo tanto`; "y luego" es FIX | FIX |
| gancho / brecha | la pregunta se plantea antes del 10 % y se cierra después del 60 % | FIX |
| acomodación | existe `accommodation {t, type}` y coincide con el pico de energía (±12 %) | FIX |
| escala | un salto de escala necesita una referencia humana previa | FIX |
| energía | pico ≥ 3× la mediana, al 60–85 % del film, con calma antes y final en descenso | FIX |
| hold | un silencio/hold ≥ umbral a ±ventana del pico | FIX |
| sincronía | `api.impact` frente al transitorio de audio (`impact`, `click`, `pop`, `tick`) ≤ 2 fotogramas; sin audio es FIX | FIX |
| sakuga | `hero` en el pico, `simple` en la calma, presupuesto de impactos y smear por escena | WARN |
| frame-rate | pico a doses o treses (`shot.on`) | WARN |
| cámara / planos | cámara lineal sin inercia; entropía de tamaños de plano | WARN |
| pedagogía (explainer) | Mayer: huérfano sin frase (FIX), señalización, contigüidad, carga, animados, segmentos, redundancia | FIX / WARN |

## Umbrales y calibración

`engine/arc.json` guarda **priors heurísticos** por perfil (`reel`, `explainer`, `cinematic`). No están validados. Con
obras aprobadas (`--record`) `data/arc.calib.json` los recalibra con un posterior bayesiano acotado:
`posterior = (1−w)·prior + w·MLE`, `w = min(0,5, N/60)`, dentro de `[prior/2, 2·prior]`.

## Primitivas

- `shot.on`: 1 (ones), 2 (doses) o 3 (treses). Solo el dibujo, la cámara sigue a ones (`core.onT`, `seek.mjs`).
- `shot.sakuga`: `hero | normal | simple` (o `story.sakuga[shotId]`). Ambos campos están en `data/timeline.schema.json`.
- `api.impact(at, {frames, mode, x, y, color, rays})` y `api.smear(x, y, vx, vy, fn)` (`engine/sakuga.mjs`) dejan metadatos
  que arc lee. Llamar a `impact` siempre, sin `if`: así el registro no depende del instante.

## Integración y límites

- `lint.mjs` importa `arc.mjs` con `import('./arc.mjs')` literal, así que entra en el cierre del hash de veredictos.
  `engine/arc.json` todavía no entra en `ENGINE_DATA` de `hash.mjs`: cambiar un umbral no caduca veredictos.
- Pendiente: `engine/arc.rubric.mjs` (lo no medible, para el crítico) y que los pops del lint ignoren los impactos declarados.
