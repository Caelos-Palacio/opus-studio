# Brief — «Regla» (film de memoria conceptual con reinterpretación retroactiva)

- Pieza: trailer-cortometraje de 60 s, 16:9 (1280×720, 30 fps), perfil `cinematic`. Una criatura abstracta (un bloque de placas bajo una
  rueda de 8 radios) recibe cinco golpes distintos y una ráfaga. Cada golpe parece daño y el atacante parece ganar. Un golpe final la
  borra del cuadro. Silencio. Vuelve intacta: **se adaptaba**. La memoria conceptual relee hacia atrás cada golpe (era una lección) y la
  rueda (era un contador). Referencia de esquema: Sukuna vs. Mahoraga (sin personajes ni copyright: todo geométrico).
- Estilo: nuevo pack `styles/hierro.json` (acero negro, hueso, rojo = golpe, oro = adaptación; tipo condensado, bloom + aberración + grano).
- Sonido: nuevo estilo `styles/sound/forja.json` (fa menor, tempo 44→152 bpm, armonía frigia, percusión pesada, vacío corto antes de cada golpe).
  No reutiliza `epico.json`: es la prueba de que un carácter sonoro nuevo es un JSON, no código.
- Gusto del usuario (specs 001/002): ÉPICO y VIBRANTE. Criticó lo monótono, lo apresurado y el audio pobre. Por tanto: cortes que aceleran
  (6 → 1,4 s) y vuelven a respirar (hold de 4,4 s), un solo pico al 69 %, crescendo largo, pre-silencio antes de cada impacto, leitmotiv de la
  rueda que se transforma en el giro, soundtrack completo (música + diseño + mezcla).
- Energía: contenida → creciente por golpes → pico (golpe final, 69 %) → silencio/hold → revelación → descenso.
- Modo: autónomo (gates cerrados por el propio agente).
- Una frase que debe entenderse mute: «Lo que parecía daño era aprendizaje.»
- Pregunta del gancho (antes del 10 %): «¿POR QUÉ GIRA LA RUEDA?» → respuesta tardía (84 %): «CADA GOLPE, UNA LECCIÓN».
- Arco causal (pero / por lo tanto): criatura quieta bajo una rueda → **pero** algo la golpea y parece herirla → **por lo tanto** los golpes
  se multiplican y ella cede → **por lo tanto** el golpe final la borra → **pero** vuelve intacta (modelo roto) → **por lo tanto** cada
  golpe era una lección y la rueda un contador → **pero** si se adapta, ¿cómo se le gana? (final abierto a propósito).
- Motivo: la **rueda** (estados del catálogo: `ring` mientras parece un adorno, `orbit` cuando cuenta, `frame` al cierre).
- Color con función: rojo = golpe/daño (el atacante); oro = adaptación (lo que la criatura aprendió); hueso = mundo/tipo; acero = placas.
- Memoria que dirige la edición (`data/regla/memoria.json` → `data/regla/layers/memoria.json`): la fuerza de cada golpe escala por la
  cadena de relaciones `escala`; el giro pide el eco de cada plano releído con fuerza = 1 − peso (lo más olvidado, lo más fuerte);
  sostiene 0,6 s; retiene la respuesta de la pregunta; el cierre rima con el primer plano.
- Lo que no haré: personajes con copyright, sangre, partículas decorativas, cámara falsa (el encuadre sale de la cámara del motor o de una
  proyección de mundo declarada), texto que duplica lo que ya se ve, un clímax que no sea medible.
- Viñetas: `storyboard/regla/<ID>.svg`.

## 5 líneas (salida de la etapa 1)
1. Pieza: una criatura de placas recibe 5 golpes y una ráfaga, parece caer, vuelve intacta; la memoria relee todo.
2. Arco mute: quieta bajo la rueda → golpes que parecen daño → golpe final y blanco → silencio → intacta, y los golpes en oro.
3. Look: acero negro, hueso, un rojo de golpe, un oro de adaptación, bloom/aberración/grano, tipo condensado en mayúsculas.
4. Ritmo: calma 6 s, golpes cada vez más cercanos (6 → 1,4 s), carga lenta de 6 s, pico al 69 %, hold 4,4 s, revelación al 79 %, cierre.
5. No haré: copyright, cámara falsa, partículas de relleno, un pico sin silencio.

## Estilo (etapa 1b)
Emoción: tensión, impotencia → asombro sombrío · Energía: alta (pero con vacíos) · Referencia: Sukuna/Mahoraga (esquema), brutalismo ·
Paleta: hierro (paper #0A0B0E, ink hueso, rojo golpe, oro adaptación, acero) · Cámara: pesada, `cinema`, handheld mínimo, patadas de impacto dentro del shot.
