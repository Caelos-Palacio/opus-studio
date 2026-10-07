# Ideación de conceptos frescos (spec 013)

Proceso de 6 fases operable por agentes (research 11 §4.2). Objetivo: que el concepto no salga del modo por defecto del modelo.
La frescura se **fuerza**, no se espera. Lo bueno lo juzga el usuario; el lint (`npm run narr`) solo marca el suelo negativo.
Máximo 3 agentes en paralelo. Todo concepto se archiva en [data/ideas.md](../../data/ideas.md).

Herramientas: `node engine/narr.mjs frescura <story|film>` (suma los 7 criterios y aplica los vetos), `npm run narr` (lint),
`data/anticliche.es.json` (lista de clichés), `data/story.template.json` (ejemplo v2 completo).

## Fase 0 — Constraints de la oleada (director)
Fijar 6 casillas que **deben quedar todas distintas** entre los films de la oleada: tema (familia), tono, duración, medio,
formato (16:9/9:16/1:1), forma (`causal`, `kisho`, `espiral`, `cuenta_atras`). Prohibidos: los temas de `data/**` y los de `data/ideas.md`
marcados "usado". Cada story de la oleada lleva `"oleada": "<id>"`; `narr` da FIX `diversidad.oleada` si se repite medio o tono.
Una hipótesis por oleada: cada film cambia UNA cosa respecto al anterior.

Prompt (director):
> Oleada `<id>`: {N} films. Rellena la tabla tema/tono/duración/medio/formato/forma sin repetir ningún valor de medio ni de tono.
> Lee `data/ideas.md` y los `data/*/story.json` y prohíbe sus temas. Devuelve solo la tabla y la hipótesis única que se prueba.

## Fase 1 — Semillas (no el modelo)
Tomar 3 semillas de bancos externos de familias distintas (objetos con historia, hechos raros con cifra, oficios y su jerga,
fallos corregidos, lugares exactos, reglas de juego/burocracia). Cada semilla trae **una URL y un dato**; sin fuente no es semilla.

Prompt (investigador, con búsqueda web):
> Busca 9 semillas para la casilla de tema `<familia>`: 3 objetos con historia, 3 hechos raros con cifra, 3 fallos o accidentes
> corregidos. Para cada una: nombre, dato exacto, URL de fuente primaria o seria, y por qué es raro. Descarta lo que sale en el
> primer resultado de un buscador. Sin URL, no la incluyas.

## Fase 2 — Generación en distribución (Verbalized Sampling)
Prompt (generador, sin ver los films previos salvo el archivo de temas):
> Con estas semillas: {semillas}. Genera 20 conceptos para un film de {X} s, forma {forma}. Para cada uno devuelve: logline,
> objeto ancla (nombre, material, un rasgo), dato con fuente, la pregunta, el giro, y la probabilidad estimada (0–1) de que una IA lo
> propusiera por defecto. Quiero al menos 12 con probabilidad < 0,1. Incluye 5 conceptos que alguien desaconsejaría.

## Fase 3 — Escéptico ciego (agente separado, sin ver los 20)
Prompt (escéptico), recibe solo el **tema** de cada candidato:
> Para el tema «{tema}» escribe el vídeo por defecto: logline, giro y cierre, como lo haría un modelo sin más contexto. Marca además
> las frases de póster ("la verdadera X era Y", "todo es …") que se te ocurran para cerrarlo.
Se compara con el candidato: si coincide en giro o cierre, `distancia_default` = 0.
**Obligatorio y ANTES de escribir beats** (lección 2026-10-07: en la primera oleada el escéptico corrió al final y adivinó los 3
giros). Al escéptico se le da el tema SIN pistas del giro (no "la diferencia con sus copias", sino "el kilo patrón").
**Meta-molde a evitar:** "el hecho verificado desinfla lo romántico y lo cambia por una limitación metodológica". Es el giro por
defecto de un guionista que verifica hechos: si los 3 giros de una oleada tienen esa forma, la oleada falla `diversidad.oleada`
(juicio del director). Busca giros de otra especie: un dato que agranda en vez de desinflar, un cambio de punto de vista, una
consecuencia práctica, una coincidencia documentada, un detalle que reordena lo visto. Lo que el escéptico NO adivina
(detalles concretos, tiempos reales, objetos, la voz) es donde vive la personalidad: súbelo al centro.

## Fase 4 — Filtro duro
Puntuar los 7 criterios (0–2) de research §4.1: ancla, pregunta, hecho_raro, giro_relee, apuesta, distancia_default, distancia_archivo.
Umbral: ≥ 10/14 y **ningún 0** en ancla, pregunta, hecho_raro y distancia_default. Vetos: cabe en un póster; sin sustantivo concreto.
Verificar los hechos contra fuente primaria; si la cifra es disputada, la duda es material (se queda en pantalla).

Prompt (revisor, distinto del generador):
> Puntúa este candidato con la rúbrica de 7 criterios (0–2, justifica cada uno en una línea). Lee solo el logline: ¿quieres verlo?
> ¿Qué esperas que pase? Si adivinas el giro, `giro_relee` ≤ 1. Verifica el dato en la fuente y dime si coincide.
Luego: `node engine/narr.mjs frescura <story>` contrasta la suma y detecta si `distancia_archivo` declarada no casa con el solape medido.

## Fase 5 — Dormir y elegir
3 finalistas, guardados con fecha en `data/ideas.md`. La selección espera una iteración, o un agente en otro contexto relee los tres
en frío. El director elige uno; los otros dos quedan en reserva (no se reciclan films, sí ideas guardadas).

Prompt (lector en frío):
> Lee solo estos 3 loglines, sin más contexto. Ordénalos por ganas de verlos y di, de cada uno, qué esperas que pase.

## Fase 6 — Voz antes que beats
Escribir en este orden en el story v2: `voz`, `ancla`, `giro`, `apuesta`, y **después** los beats (nacen de esas cuatro líneas).
Luego `npm run narr` (suelo), spec 3DD y producción. El agente que escribe no es el que valida.

Prompt (guionista):
> Parte de `data/story.template.json`. Escribe primero voz (quién habla, actitud, persona, tic), ancla (objeto, detalle, dato con
> fuente, `en_pantalla_antes_de`), giro (de → a, qué beat se relee) y apuesta. Después escribe los beats con `concreto` (qué cosa
> física ocurre) y `peso`. Cierre: elige entre corte, golpe, silencio, abierto, cicatriz; el eco solo con `porque`. Sin moraleja.

## Reglas anti-recaída
- Una crítica del usuario se traduce a hipótesis y se contrasta en ≥ 2 films antes de volverse regla del lint (lección Potencias v3).
- Los umbrales y la lista anti-cliché caducan: una entrada sin saltar en 3 oleadas se retira.
- Tras 8–10 notas con la casilla `voz` en `data/notas.json`, descartar los checks que no correlacionen con la nota.
- Una excepción al lint va con `narr_ok: [{check, porque}]`; sin porqué es FIX.
