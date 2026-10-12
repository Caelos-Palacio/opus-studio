# Rama `vectores` (spec 020, E5): SVG como elemento y láminas desde datos

## Qué hay
- **`engine/svg.mjs`** (PURO, sin fs; lo importa dsl-core): tokenizador XML de lista blanca + `geom.parsePath` (M L H V C S Q T A Z) → doc normalizado a cuadro unidad con transforms horneados; sanitización (`SvgError` con código y línea: script, foreignObject, on…, href no `#`, javascript:/data:, url() externo, DOCTYPE/ENTITY, SMIL, image/iframe…, límites 512 KB/4000 elementos/48 niveles); `drawSvg` con recoloreo por roles (`data-fill`/`data-stroke` en el archivo, `roles:{"#hex":"rol"}`, `mono`), trazado progresivo `trazo` 0..1 por longitud de path (+ `punta`), `morphTo`+`u` (mismo nº de paths). **Sin dependencia npm nueva**: un parser de lista blanca es más corto y seguro que añadir xmldom/svgson.
- **`engine/svg-io.mjs`** (Node): `cargarSvg` cacheado; `node engine/svg-io.mjs manifest [--check]` regenera **`engine/svg-lib.mjs`** (manifiesto puro: nombre, nº de paths, título, tags) — así dsl-core valida `svg:"mosca"` y el morph sin leer disco (la guardia exige que dsl-core sea puro). `film.assets.svg(id)` lo expone a `api.svg`.
- **Hash por contenido**: los SVG viven en `assets/svg/` y `assetsSig()` ya digiere `assets/` por contenido (test V4: contenido cambia → firma cambia; solo la fecha → no).
- **Biblioteca `assets/svg/`** (10, dibujados aquí): secante, mosca, sobre, moneda, botella, sello, lupa, reloj, mano, hoja.
- **`api.svg`, `api.box`** (prims) y tipos DSL **`svg`** y **`box` con rótulo** (`label` multilínea, `tag`, `color`, `fill`, `fillAlpha`, `radius`, `lw`, `banda`, `sombra`, `alpha`, `role`; sin props visuales `box` se comporta como antes). Toolbox: `dsl:svg`, `prim:svg`, `prim:box`, `objeto:svg_<nombre>` ×10, 3 recetas.
- **`engine/diagramas.mjs`**: generadores `diagrama_flujo` (serpiente|fila|columna|cuadricula), `diagrama_capas`, `barras_antes_despues` (mejora calculada: −50 %, ÷47, ×30). `shots/<ID>.diagrama.json` → `node engine/diagramas.mjs build <f>` (o `--all [--check]`) → `.scene.json` + `.mjs`. `opus new shot <id> --receta diagrama_flujo` crea el ejemplo. Coordenadas por expresiones de W/H/k.
- **Perfil `lamina`** (profiles.json, esquema, lint: `requireFocus`, `saliency`, `maxSizes`): docs/current/LAMINAS.md. El film `sistema` ya lo usa (sin `profileOverrides` ni `hold_ok`).
- **S01 rehecha**: `shots/S01.diagrama.json` = 22 líneas escritas frente a 464 del JSON a mano (−95 %); lint del film sistema sin FIX. S03 y S05 no se migran (3 de 5 shots de la misma receta dispararían `receta.repeticion`); los generadores capas/barras reproducen sus datos (probados en V6).
- **Demo**: film `vectores` (`data/vectores`, V01 mosca+secante trazan y se mueven con peso —muelle 'snap', inercia—, V02 lámina de flujo). `out/entregas/vectores.mp4` y `.jpg` (en el repo principal). Master con `--force` (crítico visual sin veredicto; lint SHIP). **Espera la nota del usuario.**

## Tests
`test/vectores.mjs` (V1–V7, registrado en `test/suites.d/vectores.json`): parse, sanitización, determinismo, trazo, recoloreo, morph, hash, DSL/toolbox, diagramas, perfil y S01. Cobertura DSL 95,6 % (ratchet intacto).

## Cuidado
- Dentro de `drawSvg` el relleno de un path aparece al terminar su trazo (fase 85/15). Degradados, `<use>`, clipPath, filtros y texto SVG se ignoran con aviso en `doc.avisos`.
- Si cambias un SVG de la biblioteca: `node engine/svg-io.mjs manifest` (el test V1g lo exige).
- Tocar `engine/` caduca veredictos: relintea una vez.
