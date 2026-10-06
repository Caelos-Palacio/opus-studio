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

## Medios disponibles y parámetros nuevos (medios2)
`papel_crema` · `kraft` · `pizarra` · `tecnico` · `neon` (+ variantes del acento `papel_crema_ciruela`, `papel_crema_terracota`). Cualquier film: `OPUS_MEDIUM=kraft npm run peek` o `--medium kraft`.
- `blend: "screen"` (medios oscuros: capas, tinta y grano son luz aditiva); por defecto `multiply`.
- Primitivas de capa/soporte (`support.decor`): `grid`, `bricks`, `creases`, `ghost`, `smudge`, `haze`, `bokeh`, `dims`, `marks`, `text` (HUD, posiciones relativas al cuadro), `stamps`; `support.wet` (suelo mojado).
- Tinta: `halo [{lv,a}]` (desenfoque por pirámide: polvo de tiza, luz de neón), `flicker {amount,fps,hum,dropout}` (`flickerAt`), `reflection {y,alpha,fade,ripple,band}`.
- Grano: `mode` (multiply|screen), `scale` (>1 = grano a menor resolución), `fps`.
- `encode {crf, tune}`: lo usan `cut`/`render --range` (sin medio: crf 16 de siempre). Medido en 5 s de Mate 1280×720: v1 1,4 MB; papel crf16 15,9 MB (11,6×); tune grain crf 24 = 3,8 MB (2,8×, grano visible 84 %, PSNR 33,9 dB).
- Hojas: `node tools/medios-sheets.mjs` (out/ab/<medio>.jpg + comparativa.jpg), `node tools/medios-variantes.mjs` (acento morado).

## Límites
Faltan más medios (el motor admite sus parámetros con JSON nuevo). El desregistro es una pasada fantasma, no separación real de placas. El hatching es decoración de fondo, no sombreado del sujeto. Sin WebGL. El glow de los shots se convierte en mancha de tinta translúcida (ink bleed).
