# Handoff — film-consta (E2a, spec 017)
Rama `film-consta` (desde main), sin push. Entrega: `out/entregas/consta.mp4` y `consta.jpg` (hoja 4×3).

## Qué hay
- `data/consta/{story,timeline,memoria}.json` (story v2, desde docs/guiones/consta.story.json con cierre BIPM), estilo `styles/archivo.json`, medio `kraft`, sonido `styles/sound/archivo.json`.
- 8 shots `shots/C1..C8.scene.json` (+ .mjs generados) nacidos de recetas: presentar_objeto, comparar, documento×2, contar, pausa_sostenida, revelar, caida_con_peso. Objetos: cilindro_metalico, campana_cristal, llave_laton, mano, balanza_cruz, sello_tampon, acta_cuaderno, pluma, reloj. Fondo: preset expediente_kraft (ajustado: viñeta y soporte más claros).
- Código a mano: lo de los shots es JSON (el texto lleva fundidos de línea; helpers de generación en el scratchpad del agente, no versionados). Motor: `engine/foley.mjs` (nuevo, ~110 líneas), ~12 líneas en sounddesign/sound/recetas/prims/dsl-core/objetos (spans del buzz, flag derive.giro, hollow/focus, instanciar objeto/fondo genérico), ejemplo del esquema.
- Tests: `test/consta.mjs` (23). Ajuste en `test/dsl-cov.mjs`: los shots de receta (`[receta:`) son DSL nativo y no tienen JS legado.

## Estado
Lint SHIP (WARN: contraste del estilo, acomodación a 10 s del pico, focos). Crítico SHIP manual (láminas leídas). Master sin --force. Audio: −19,0 LUFS, LRA 19,6 LU, TP −3,2 dBTP (ebur128 sobre el mp4). Sin oído humano: el sonido se juzgó por medidas.

## Pendiente / riesgos
- Nota del usuario (¿tuvo voz?). El texto no se «escribe» letra a letra (el lint cuenta cada prefijo como etiqueta nueva): entra por fundido de línea.
- El secante es un rectángulo gris; la mosca es un punto. Pueden mejorarse.
- La acomodación (27 s) queda a 10 s del pico (WARN arc), a propósito: el pico es 2019.
