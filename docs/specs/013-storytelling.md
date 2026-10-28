# 013 — Storytelling auténtico: voz, ancla, frescura

## Intención (usuario, 2026-10-06)
"Las pruebas deberían ser con conceptos frescos, storytelling. Deberías darle una mejora, pero centrada en que tenga
autenticidad, personalidad y no parezca robótico."
Antecedentes: Regla, "no es el mejor concepto pero está bien ejecutado"; la v1 de los films, "bien, no wow". Lo que funcionó
(Mate 9,5 y el Reel neón) tiene un objeto concreto con física propia, y en ellos la metáfora ES el objeto.

## Diagnóstico (docs/research/11-storytelling.md §1)
Los 4 films comparten una plantilla invisible, y `arc.mjs` la PREMIA:
- el giro cae entre el 72 y el 81 % del metraje;
- los 4 abren con "¿…?" y cierran con un retorno ("vuelve…");
- `idea` sale como aforismo;
- el spine se marca a sí mismo con una etiqueta que sigue un metrónomo;
- `accommodation.type` solo admite abstracciones;
- no hay voz.

Hoy medimos corrección, y la corrección se volvió un molde.

## Principios
1. **Lo positivo no se lintea.** El lint solo marca un suelo de cosas negativas: clichés, tríadas, simetría, falta de un ancla
   visible. Lo bueno (que algo dé gracia, que tenga alma) lo juzga el usuario. Las 2 primeras oleadas el lint es solo WARN,
   salvo los FIX listados abajo. No hay score global (Goodhart).
2. **Hay más de una forma.** `forma` puede ser causal, kisho, espiral o cuenta_atras. La geometría del arco (dónde cae el pico
   y el giro) depende de la forma; no hay un molde único.
3. **La voz va antes que los beats.** Primero se escriben voz, ancla, giro y apuesta; de ahí salen los beats.
4. **La frescura se fuerza, no se espera:** semillas externas con fuente, generación en distribución y un escéptico ciego.
5. **Una hipótesis por oleada.** Una crítica se contrasta en al menos 2 films antes de volverse regla (lección de Potencias v3).

## Medibles
| pieza | medible |
|---|---|
| story.json v2 | schema condicional a `v:2` (research §3): `forma`, `voz`, `punto_de_vista`, `ancla`, `question.creencia_previa`, `giro`, `apuesta`, `subtexto`, `tono`, `imperfeccion`, `cierre`, `frescura`, `beats[].concreto`, `beats[].peso`. Un story v1 sigue siendo válido |
| arco por forma | `arc.mjs` lee `forma`. La ventana del pico y la del giro dependen de la forma (kisho: el giro es lateral, sin conflicto; cuenta_atras: el pico va al final). `giro.posicion` avisa si coincide (±5 pts) con los 3 films anteriores |
| lint narrativo | `engine/narr.mjs` (`npm run narr`) con los 21 checks de research §5.1. Es determinista, sin red ni LLM. FIX solo en: `schema.v2`, `ancla.visible`, `ancla.dato`, `cliche.apertura`/`cierre` (grupos A y C), `cierre.moraleja`, `frescura.registro`, `diversidad.oleada`. Las excepciones van con `narr_ok:{check,porque}`; una excepción sin porqué es FIX |
| anti-cliché | `data/anticliche.es.json` con los grupos A–F, versionado. Caduca: una entrada se retira si pasa 3 oleadas sin saltar |
| ideación | `docs/current/IDEACION.md` (las 6 fases) más `node engine/narr.mjs frescura <story>`, que suma los 7 criterios y aplica los vetos. Los conceptos se archivan en `data/ideas.md` |
| integración | `npm run lint` incluye `narr` (stage `narr`). El gate de master exige 0 FIX narrativos cuando el film es v2 |
| notas | la nota humana gana la casilla "¿tuvo voz?" (sí/no + comentario) en `data/notas.json` |

## Escenarios (BDD) — `test/narr.mjs`
- N1 Un story v1 actual sigue pasando el schema (compatibilidad). Un v2 sin `voz` da FIX `schema.v2`.
- N2 Un ancla que no aparece en pantalla antes de `en_pantalla_antes_de` da FIX. Si aparece, pasa.
- N3 La apertura "¿Qué pasaría si…?" da FIX `cliche.apertura`. Una cita entre «…» o con `narr_ok` justificada pasa.
- N4 Un último beat "tú eres el paso cero" da FIX `cierre.moraleja`.
- N5 Beats con CV de duraciones < 0,30 dan WARN `ritmo.beats_cv`. Beats irregulares pasan.
- N6 Un spine ABAB estricto en ≥ 6 beats da WARN `spine.metronomo`.
- N7 Sobre los 4 films actuales (v1), `narr` reproduce el diagnóstico de research §1: retorno en los 4 cierres, pregunta de
  apertura de plantilla y giro en el 72–81 %. Así se valida que el lint ve la plantilla.
- N8 En `arc` con `forma:"kisho"`, el giro lateral sin "pero" no da FIX. Con `forma:"causal"`, se mantiene la regla actual.
- N9 La diversidad de una oleada (3 stories con el mismo medio o tono) da FIX `diversidad.oleada`.
- N10 `frescura` con un 0 en ancla, pregunta, dato o distancia queda vetado aunque sume ≥ 10.
- N11 El lint es determinista: dos ejecuciones dan una salida idéntica.
- [HUMANO] H1 Los 3 films de prueba con conceptos nuevos: nota ≥ 8 y "¿tuvo voz?" = sí en al menos 2 de 3.

## Fuera de alcance
- Usar un LLM dentro del lint (la frescura la puntúan agentes en el proceso; el lint solo verifica lo declarado).
- TTS o narración con voz. Es F6; aquí "voz" es el registro del texto, el sound design y el ritmo.

## Calificaciones
| oleada | film | nota | ¿voz? | comentario |
|---|---|---|---|---|
| (pendiente) | | | | |
