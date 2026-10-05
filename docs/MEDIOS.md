# MEDIOS (spec 003)

Un medio es la superficie y la materia de todo el film. Se elige en el timeline: `"medium": "papel_crema"` (datos en `styles/medios/<nombre>.json`).
Sin `medium` el motor se comporta como siempre (golden bit a bit). Código: `engine/medium.mjs`; integración mínima en `seek.mjs`.

## Qué define un medio (JSON)
- `support`: papel (tono base, mottle de luz/manchas, diente, microfibras). Precalculado una vez por (medio, seed, tamaño).
- `layers`: capas de parallax con `depth` (0 = fija; <1 detrás del sujeto; >1 primer plano con `over:true`). Cada una puede llevar `stains`, `hatch`, `fibers`, `specks`. Se mueven con la cámara del shot activo con la ley de `applyCam` (`layerOffsets`).
- `ink`: los shots dibujan en una capa transparente que se compone con multiply: `erosion` (agujeritos de grano riso, máscara precalculada, desplazada por fotograma), `misregister` (pasada fantasma desplazada), `jitter` (temblor por bandas, "line boil"), `alpha`.
- `grain` (N teselas de multiply, índice y desplazamiento deterministas por fotograma) y `vignette` cálida; solo con grade.
- `palette` + `accents`: 1 neutro (tinta) + ≤2 acentos; los roles del estilo se remapean (en papel_crema: punto/imaginario = violeta, real = cobalto, modelo roto = tinta). `grade`, `rules` (glow = sangrado de tinta) y `composition` se funden en el estilo; `styleOverrides` del timeline manda sobre el medio.

## Uso
1. Copiar el film (`data/<film>/`) y añadir `"medium"`; mate_papel es el ejemplo.
2. `node engine/ab.mjs --a data/mate/timeline.json --b data/mate_papel/timeline.json --out out/ab/mate.jpg` → hoja A/B.
3. `node test/medios.mjs` (en `npm test`): M1–M8 (fondo no plano, paleta, grano, parallax, precálculo, v1 falla, sin medio intacto, esquema).

## Límites
Solo medio papel_crema (kraft, pizarra, técnico = nuevos JSON; el motor ya admite sus parámetros). El desregistro es una pasada fantasma, no separación real de placas. El hatching es decoración de fondo, no sombreado del sujeto. Sin WebGL. El glow de los shots se convierte en mancha de tinta translúcida (ink bleed).
