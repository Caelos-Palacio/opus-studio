# 020 — Vectores y diagramas: SVG como elemento y láminas desde datos

## Intención (usuario, ola E5 del ROADMAP §8)
"Importar SVG como objeto/elemento para no dibujar a mano objetos pobres (secante, mosca de Consta). Recetas `diagrama_flujo`, `diagrama_capas`, `barras_antes_despues`, tipo `box` con rótulo y perfil de lint `lamina` (deuda del film `sistema`)."
Contexto de gusto (001–003, 013, 014): asombro y personalidad; el objeto concreto con peso es el ancla. Un SVG propio, bien dibujado, que se traza y se mueve con peso, vale más que un círculo con `$hueco`.
Deuda medida (docs/handoff/diagramas.md): una lámina del film `sistema` cuesta 450–700 líneas de JSON escritas a mano porque no hay caja con texto, ni receta de flujo/capas/barras, y el lint no entiende «lámina estática».

## Traducción a medibles
| pieza | medible |
|---|---|
| Parser SVG | `engine/svg.mjs`: paths (M L H V C S Q T A Z, abs/rel), `rect circle ellipse line polyline polygon`, grupos, `transform` (matrix translate scale rotate skewX skewY), `fill`/`stroke`/`stroke-width`/`opacity`/`fill-opacity`/`stroke-opacity`/`stroke-linecap/join`/`stroke-dasharray`/`fill-rule` (atributo, `style` en línea o heredado del grupo). Reutiliza `geom.parsePath` (arcos y cuadráticas ya se pasan a cúbicas); **sin dependencia npm nueva** (un tokenizador XML de lista blanca de ~60 líneas es más corto y más seguro que `@xmldom`/`svgson`, y no añade superficie de ataque ni un árbol de dependencias) |
| Lienzo | cada SVG se normaliza a un cuadro unidad (lado mayor = 1, centro en el origen); los transforms quedan HORNEADOS en la geometría (las Béziers son cerradas bajo afinidades) |
| Recoloreo | un color del archivo se mapea a un rol de paleta del medio: `data-fill="accent"` / `data-stroke="ink"` en el propio SVG (atributo válido, el archivo sigue viéndose en un navegador), `roles: {"#c0392b": "accent"}` por uso, o `mono: "ink"` (todo a un rol). Sin mapa, el hex del archivo se respeta. El resultado cambia con el medio |
| Trazado progresivo | `trazo` ∈ [0,1] por **longitud de path** acumulada (todos los paths cuentan, en orden de documento); los rellenos aparecen al terminar su path; `punta` = posición de la «pluma» (ancla para seguirla con otro objeto) |
| Morph | `morphTo` + `u`: mismo número de paths (si no, error claro con los dos recuentos); path i ↔ path i; color, grosor y opacidad interpolan; extremos exactos (u≈0 y u≈1 devuelven el SVG original, sin facetas) |
| Hash por contenido | el archivo vive en `assets/svg/`; `assetsSig()` (hash.mjs) lo digiere por CONTENIDO: tocar un SVG caduca los fragmentos, tocar solo la fecha no |
| Sanitización | falla con `SvgError` (mensaje en español con código y línea) ante: `<script>`, `<foreignObject>`, `<iframe> <embed> <object> <image> <audio> <video>`, `<animate*> <set>` (SMIL puede reasignar `href`), atributos `on…`, `href`/`xlink:href` que no sean `#interno`, `javascript:` o `data:` en cualquier valor, `url()` externo, `<!DOCTYPE>`/`<!ENTITY>` (XXE, billion laughs), tamaño > 512 KB, > 4000 elementos, profundidad > 48. Elementos ajenos al dibujo (`title desc metadata defs style sodipodi:*`) se ignoran con aviso (`doc.avisos`) |
| Ruta | `svg: "secante"` (→ `assets/svg/secante.svg`) o `"assets/svg/x.svg"`; nunca fuera de `assets/` (sin `..`, sin rutas absolutas) |
| Biblioteca | `assets/svg/`: secante, mosca, sobre, moneda, botella, sello, lupa, reloj, mano, hoja. Dibujados aquí, sin copyright de terceros, con `data-fill`/`data-stroke` por rol |
| API | `api.svg(id, {x,y,size,rot,flip,alfa,trazo,morphTo,u,roles,mono,label})` → `{x,y,w,h,rot,punta:{x,y},centro:{x,y}}`; registra foco y meta (`prim:'svg'`). DSL tipo `svg` (esquema estricto con «¿quisiste decir…?», `fields` publican `<id>_x|y|w|h|punta_x|punta_y`, deps de tiempo). Registrado en el toolbox (`dsl:svg`, `prim:svg` y una ficha `objeto:svg_<nombre>` por cada SVG de la biblioteca) |
| `box` con rótulo | el tipo DSL `box` (hasta hoy solo registraba un rectángulo para librerías) admite `label` (varias líneas con `\n`), `tag`, `color`, `fill`, `radius`, `lw`, `banda`, `sombra`, `alpha`, `role`. Sin ninguna propiedad visual se comporta como antes. Nueva primitiva `api.box` |
| Generadores (recetas de datos) | `engine/diagramas.mjs`: `diagrama_flujo` (nodos + aristas o cadena, disposición `serpiente|fila|columna`), `diagrama_capas` (capas con sus módulos y un contrato), `barras_antes_despues` (filas antes/después a su propia escala y la mejora). Entrada: `shots/<ID>.diagrama.json` corto; `node engine/diagramas.mjs build <archivo>` emite `.scene.json` (DSL nativo, con cabecera GENERADO) y el `.mjs`. `node engine/opus.mjs new shot <id> --receta diagrama_flujo` crea el ejemplo. Coordenadas por expresiones del área segura (independientes de la resolución) |
| Perfil `lamina` | `engine/profiles.json` + enum del esquema: `maxHold` 600 (un still no es un hold), `readCps` 40 (la lámina se lee a ritmo propio, no es subtítulo), `requireFocus:false`, `saliency:false`, `maxSizes` 5. Documentado en docs/current/LAMINAS.md y en el handoff |
| Rehacer S01 | `shots/S01.diagrama.json` genera la lámina 1 del film `sistema`; se mide la reducción de líneas escritas (464 → ≈ 25) y el lint sigue sin FIX |
| Demo | ≈ 10 s: mosca y secante trazan y se mueven con peso + una lámina de flujo, `out/entregas/vectores.mp4` y `.jpg` |

## Escenarios (BDD) — `test/vectores.mjs`
Marcados [M] = máquina; [H] = juicio humano.

**Parse**
1. [M] Dado un SVG con path M L C Q A Z, rect, circle, grupo con transform, fill/stroke/opacidades, cuando se parsea, entonces los items traen geometría en cuadro unidad, color, grosor (escalado por el transform) y opacidades heredadas.
2. [M] Dados los arcos `A`, entonces se convierten a cúbicas y el bbox coincide con el esperado (±1 %).
3. [M] Las 10 SVG de la biblioteca parsean sin avisos de seguridad, tienen ≥ 3 paths y llevan `data-fill`/`data-stroke`.

**Sanitización**
4. [M] `<script>`, `<foreignObject>`, `onload=`, `href="http://…"`, `xlink:href="data:…"`, `javascript:`, `<!ENTITY>`, `<animate>`, `<image>` y `url(http…)` lanzan `SvgError` con código y mensaje en español; `href="#a"` interno y `<title>` no.
5. [M] Una ruta con `..` o fuera de `assets/` se rechaza; un nombre desconocido da «¿quisiste decir…?».

**Determinismo, trazo, recoloreo, morph**
6. [M] Dado el mismo SVG y t, dos pasadas (y una intercalada con otro trazo) dan los mismos píxeles.
7. [M] `trazo` 0 no pinta nada; 0,5 pinta menos píxeles que 1; es monótono creciente (0 < 0,25 < 0,5 < 1) y `punta` avanza.
8. [M] Con dos paletas distintas (roles) el mismo SVG da píxeles distintos; `roles` y `mono` cambian el color pedido y solo ese.
9. [M] `morphTo` con el mismo número de paths: u=0 ≡ A, u=1 ≡ B (píxeles idénticos), u=0,5 distinto de ambos; con distinto número de paths, error con los dos recuentos.
10. [M] El archivo entra en el hash: `assetsSig()` cambia al cambiar su contenido y no al tocar su fecha.

**DSL e integración**
11. [M] `{type:"svg", svg:"mosca", …}` valida, compila, pinta, publica `fields` y sus deps declaran tiempo; un svg o prop desconocidos fallan con «¿quisiste decir…?».
12. [M] `box` sin props visuales se comporta como antes (test C2 de dsl-cov intacto); con `label` pinta caja y registra texto.
13. [M] Toolbox: `tools find "mosca"` devuelve `objeto:svg_mosca`; `dsl:svg` y `prim:svg` existen; la cobertura DSL no baja (ratchet).

**Diagramas**
14. [M] `diagrama_flujo` con N nodos da N cajas y N−1 flechas (cadena) o las aristas pedidas; la disposición `serpiente` invierte el sentido en filas alternas; el escenario valida y compila.
15. [M] `diagrama_capas` da una caja por capa y una por módulo, dentro de su capa; `barras_antes_despues` da dos barras por fila a la escala de su fila y la mejora calculada (−50 %, ÷47, ×30).
16. [M] Un nodo/arista inexistente, una disposición desconocida o una fila sin cifras fallan con ruta y «¿quisiste decir…?».
17. [M] Determinismo: mismos datos → mismo `.scene.json` byte a byte.
18. [M] El perfil `lamina` existe, es válido en el esquema y relaja readCps/foco/hold; el film `sistema` con `lamina` lintea sin FIX y sin los avisos de lectura.
19. [M] S01 regenerada desde `S01.diagrama.json` lintea sin FIX y su fuente es ≥ 90 % más corta que el JSON escrito a mano.
20. [H] La mosca y el secante se reconocen sin etiqueta, no parecen clip-art y se mueven con peso; la lámina de flujo se lee de un vistazo.

## Fuera de alcance
- Degradados SVG (`linearGradient`), `<use>`, clipPath, máscaras, filtros, texto SVG y CSS `<style>`: se ignoran con aviso (el relleno de un degradado cae a su color base). Un SVG que los necesite se simplifica o se dibuja con `api.path`.
- Importar SVG de terceros sin revisar: la sanitización protege, la licencia es cosa del que lo trae.
- Auto-layout de grafos arbitrarios (ya existe `api.graph`): los generadores son cuadrículas ordenadas.

## Calificaciones
(sin nota todavía; la demo `out/entregas/vectores.mp4` espera la del usuario)
