# 014 — Fondos generativos y biblioteca de objetos

## Intención (usuario, 2026-10-07)
"Dar más versatilidad a los fondos que cree el agente y más objetos."
Contexto de gusto (001, 003, 012 Lección, 013): asombro y personalidad; el fondo se elige por TEMA (oscuro con profundidad es válido, el negro vacío no);
lo que funciona en un film es un OBJETO concreto con física propia (ancla), y lo genérico ("criatura", "rueda", "punto") falla.
Los tres films que vienen lo piden ya: Consta (cartón kraft, expediente), Veinticuatro (cuba oscura con fotomultiplicadores) y Botella (papel de carta con acuarela, 1:1).

## Traducción a medibles
| pieza | medible |
|---|---|
| Fondo = DATOS | un fondo es una pila de capas declaradas `{tipo, …params}` con semilla; el agente crea uno nuevo combinando capas, sin tocar el motor. Tipo DSL `fondo` y `api.fondo(spec, opts)` |
| Capas | ≥ 22 tipos en 6 familias: degradado (lineal, radial, bandas, muestreo de la paleta), ruido (fbm, deformado, celular, flujo), atmósfera (niebla, polvo, rayos, bokeh, estrellas, orbes), motivos (retícula, trama, rayado, semitono, motivo repetido), luz (viñeta, foco, terminador) y temáticas (olas, acuarela, perfil) |
| Todo determinista | `seek(t)` puro: misma spec + semilla + t ⇒ mismos píxeles (hash idéntico en dos pasadas y en orden distinto); sin `Math.random`, sin reloj |
| Animación | cada capa acepta `anim` con expresiones de `t` (`lt`, `u`, `dur`) para alfa, escala y deriva; las texturas se precalculan una vez por (capa, semilla, tamaño) |
| Parallax | cada capa lleva `paralaje` (0 lejano … > 1 primer plano) y se mueve con la cámara según la ley de `api.depth` |
| Coherente con el medio | colores por rol de la paleta del medio (o hex) y muestreo de la paleta; grano, papel y tinta se aplican después, sin tocar el fondo |
| Presets temáticos | ≥ 10, cada uno con `porque` que nombra el tema: cosmos_profundo, cuba_oscura, expediente_kraft, papel_carta_acuarela, mar_acuarela, noche_ciudad, laboratorio, taller_madera, amanecer_niebla, plano_tecnico |
| Biblioteca de objetos | ≥ 25 objetos vectoriales paramétricos (no clip-art) que respetan el medio (trazo/tinta/relleno por rol), con `anclas` (puntos con nombre), `partes` animables (0..1) y `estados` con nombre |
| Objetos pedidos por los guiones | cilindro metálico, campana de cristal, llave de latón, balanza de cruz, sello/tampón, acta/cuaderno con renglones, pluma, fotomultiplicador, cuba, contador, papel continuo, lápiz, lámpara de mesa, botella con lastre, tarjeta postal, moneda, sobre con sello, red de pesca, mapa costero; genéricos: reloj, mano, puerta, ventana, mesa, libro |
| DSL | tipos `fondo` y `objeto` registrados en `TYPES` (esquema estricto con "¿quisiste decir…?", deps exactas, pureza). Un objeto publica sus anclas como variables `<id>_<ancla>_x|y` vía `fields` |
| Metadatos uniformes | cada capa, preset y objeto exporta `meta` = `{id, kind, resumen ≤ 15 palabras, tags, params[{name,type,def}]}`; agregador `engine/fondos-meta.mjs` (lo lee la rama toolbox) |
| Métrica | un fondo generativo oscuro con atmósfera pasa `fondo.vacio` (profundidad P ≥ 1,0 %); un fondo oscuro de una sola capa plana sigue fallando |
| Hojas de muestras | `tools/fondos-sheet.mjs` → `out/ab/fondos.jpg` (cada preset) y `out/ab/objetos.jpg` (cada objeto y sus estados) |

## Escenarios (BDD)
Marcados [M] = máquina (test/fondos.mjs); [H] = juicio humano.

**Fondos**
1. [M] Dado un registro de capas, entonces cada capa tiene `meta` con resumen ≤ 15 palabras, tags y todos sus params con tipo y valor por defecto.
2. [M] Dado un fondo con una capa de tipo inexistente o un param desconocido, cuando se valida, entonces falla con ruta y «¿quisiste decir…?».
3. [M] Dado el mismo fondo y la misma semilla, cuando se pinta en t = 2,5 dos veces (y entre medias en otros t), entonces los píxeles son idénticos.
4. [M] Dadas dos semillas distintas, entonces los píxeles difieren.
5. [M] Dado un fondo con `anim` (deriva y parpadeo), entonces los fotogramas en t distintos difieren y en un mismo t coinciden.
6. [M] Dado un preset, cuando se pinta, entonces no lanza, cubre el cuadro (sin huecos transparentes salvo capas de luz) y cada preset tiene `porque`.
7. [M] Dados los presets oscuros (cosmos_profundo, cuba_oscura, noche_ciudad) sin sujeto, entonces `fondo.profundidad` P ≥ 1,0 % y no son «vacíos».
8. [M] Dado un negro plano (una capa `relleno` oscura), entonces la métrica lo marca vacío (P < 1,0 %).
9. [M] Dada la cámara en dos posiciones, entonces las capas con `paralaje` distinto se desplazan distinto (lejano menos que cercano).
10. [M] Dado un fondo en un medio multiply (papel/kraft), entonces el pintado respeta la paleta del medio: cambia con el medio y no usa colores fuera de la paleta salvo hex explícitos.
11. [M] Dado un shot DSL con `{type:"fondo", preset:"cuba_oscura"}`, entonces valida, compila, pinta y sus deps declaran dependencia del tiempo.
12. [M] Dado `ajustes` y `sin` sobre un preset, entonces se aplican por id de capa; un id inexistente es error.
13. [H] Los presets se ven con gusto y personalidad; ninguno parece plantilla de gradiente.

**Objetos**
14. [M] Cada objeto tiene `meta`, `anclas` nombradas, `partes` con rango y ≥ 1 estado; todo pintado por rol de paleta.
15. [M] Cada objeto se pinta sin lanzar en todos sus estados y con los valores extremos de sus partes; deja píxeles dentro de su caja.
16. [M] Dado un estado, cuando se interpola entre dos estados (u = 0,5), entonces las partes son la media y el dibujo cambia.
17. [M] Las anclas devueltas están dentro de la caja ampliada del objeto y se mueven con `x`, `y`, `size` y `rot`.
18. [M] Dado un shot DSL con `{type:"objeto", objeto:"llave_laton", fields:["punta.x"]}`, entonces el valor `<id>_punta_x` es legible por otros objetos.
19. [M] Un objeto o param desconocido en el DSL falla con «¿quisiste decir…?».
20. [M] Los objetos registran un `focus` (el tipo no lo tapa).
21. [H] Los objetos se reconocen sin etiqueta y no parecen clip-art.

**Integración**
22. [M] `api.fondo` y `api.objeto` están en `docs/API.md` (generado); `engine/fondos-meta.mjs` lista capas + presets + objetos con la misma forma.
23. [M] Ratchet de cobertura DSL (test/dsl-cov) intacto; `vocab lint` = 0.

## Fuera de alcance
- Animar la deformación de dominio de un ruido en 3D (la deriva y la respiración bastan; el ruido se precalcula).
- Física real de los objetos (cuerdas, telas, fluidos): las partes se animan por expresión de t o por simulación `api.sim` del shot.
- 3D (world3d) y vídeo real: este módulo es 2D vectorial/raster en el compositor del motor.
- Crear los medios nuevos (kraft ya existe; papel_carta_acuarela lo hace otra rama).
- Rediseñar los guiones: aquí solo se les da material.

## Calificaciones
(sin nota todavía; la hoja `out/ab/fondos.jpg` / `objetos.jpg` espera la del usuario)
