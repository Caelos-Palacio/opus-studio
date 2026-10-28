# 11 — Autenticidad, voz y frescura: de "correcto" a "con personalidad"

Agente D1 · 2026-10-06 · solo investigación y propuesta (no toca el motor).
Alcance: oficio narrativo para piezas de 30–120 s, qué distingue lo auténtico de lo robótico, cómo generar conceptos frescos,
y cómo operar todo eso en un sistema de agentes sin matar la personalidad.

Convención: **[HECHO]** = afirmación con fuente citada · **[LECTURA]** = inferencia mía a partir de nuestros ficheros ·
**[HUMANO]** = lo decide el usuario (juez de gusto). Donde no pude verificar una fuente primaria lo digo.

---

## 0. Resumen (léelo si solo lees esto)

1. Nuestros 4 films comparten una **plantilla invisible** que ningún lint ve porque el lint la premia: pregunta con "¿" en el
   primer 10 %, giro entre el 72 % y el 86 % del metraje, beat 2 casi siempre "pero…", cierre que "vuelve" al inicio, y un `idea`
   en forma de aforismo ("lo pequeño y lo vasto son la misma cosa"). La corrección estructural se volvió un molde. Es el
   diagnóstico del usuario ("optimizamos corrección") con números (§1).
2. Lo que funcionó (mate 9,5; neón "bastante muy bien") tiene un **objeto concreto con física propia** (un letrero roto que
   zumba a 100 Hz, un punto que gira) y la metáfora ES el objeto. Lo que quedó "bien, no wow" tiene **criatura/rueda/punto
   genéricos** y la moraleja dicha en voz alta.
3. "Auténtico" = **especificidad + punto de vista que alguien podría discutir + una imperfección elegida**. No es un adorno
   de estilo: es información que un generador por defecto no produce porque va hacia lo más probable (§2.3, §2.4).
4. La frescura no se "inspira": se **fuerza** con (a) semillas concretas externas, (b) generar muchos candidatos pidiendo
   explícitamente los improbables, (c) un escéptico ciego que escribe la versión por defecto y se descarta lo que se le parece (§4).
5. Se puede lintear lo **negativo** (clichés, tríadas, simetría, falta de ancla concreta) y exigir **campos declarados**;
   no se puede lintear lo positivo (que algo sea gracioso, que tenga alma). Lint solo como suelo, siempre WARN en las dos
   primeras oleadas, y la nota del usuario como única verdad (Goodhart, §6, §7).

---

## 1. Diagnóstico con nuestros propios films

### 1.1 La plantilla medida (de los `story.json`)

| film | giro (`accommodation.t`) | % del metraje | pregunta respondida | `idea` (forma) | último beat |
|---|---|---|---|---|---|
| mate_papel | 64,8 s / 90 | 72 % | 66 s (73 %) | "Elevar es girar: …" (explicación) | "pero la media vuelta se deshace: el punto vuelve a uno" |
| potencias/stress | 58,1 s / 78 | 74 % | 58,1 s | "…tú eres el paso cero" (moraleja) | "volvemos a 10^0: tú eres el paso cero" |
| reel neón | 22,0 s / ≈30 | 73 % | 24,2 s (≈81 %) | "Lo roto no se pierde" (aforismo) | "lo roto vuelve a sonar" |
| regla | 47,2 s / ≈58 | ≈81 % | 50,6 s | "Lo que parecía daño era aprendizaje" (aforismo) | "pero si se adapta, ¿cómo se le gana?" |

[LECTURA] Cuatro films de temas y medios distintos tienen el giro en el 72–81 % y la pregunta cerrada justo después. Esto no
es casualidad: `engine/arc.mjs` (`questionBy`, `answerAfter`, `accomTol`, pico al 60–85 % de la spec 001) **exige** esa geometría.
Un espectador no lo formula, pero lo siente: "ya sé cuándo viene el giro". Predecibilidad estructural = robótico.

Otras repeticiones verificables en los ficheros:
- **Los 4 abren con "¿…?"**: "¿Cabe una escala en un punto?", "¿Qué suena cuando todo se rompe?", "¿Por qué gira la rueda?",
  "¿Cuántos pasos hasta el borde de lo visible?". [HECHO: está en los JSON.]
- **Los 4 cierran en retorno** ("vuelve a uno", "volvemos a 10^0", "vuelve a sonar", "vuelve intacta"). Viene de CRAFT.md
  ("El último frame dialoga con el primero"): regla de oficio válida convertida en tic. Cuatro de cuatro es plantilla.
- **El spine `pero/por lo tanto` solo comprueba la etiqueta** (`LINKS_OK`): es auto-declarado. Nada impide escribir
  "por lo tanto" delante de un "y luego". Y los films lo pasan con un metrónomo: regla = pero, pt, pt, pt, pero, pt, pero;
  stress = pt, pt, pero, pt, pero, pt, pt.
- **`accommodation.type` ∈ {regla, escala, idea}**: el giro está tipado como abstracción; no hay campo para "qué creía el
  espectador y por qué le dolía/gustaba creerlo".
- **No hay voz.** `narration` es opcional y está vacío en los films; el texto en pantalla es el único "narrador" y no tiene
  persona, actitud ni tics. `accent.means` es el único campo de "carácter", y es de color.

### 1.2 Frases reales que suenan a plantilla, y cómo sonarían con voz

| origen | frase actual | por qué suena robótica | con voz (propuesta) |
|---|---|---|---|
| stress `idea` | "Todo lo que existe cabe en 27 multiplicaciones por diez desde ti…" | superlativo vacío ("todo lo que existe"), aforismo, moraleja encadenada | "Se me acaba el universo en el paso 27. Lo he contado tres veces; sigue acabándose." |
| stress b8 | "volvemos a 10^0: tú eres el paso cero" | cierre moralizante + segunda persona de póster | Cortar en "27." y que el contador quede parpadeando. Sin explicar quién es el paso cero. |
| reel `idea` | "Lo roto no se pierde: cuando el letrero se rompe del todo, las piezas vuelven a encenderse" | enuncia la tesis antes de la pieza | La tesis no se enuncia: se ve que una letra (la O) NO vuelve a encender. |
| reel K22/K23 | "LO ROTO VUELVE A SONAR" | titular de motivación; la pieza se resolvió limpia | "LO R TO VUELVE A SONAR" (la O queda muerta): el final se concede, pero con cicatriz. |
| regla b1 | "Una criatura de placas, inmóvil bajo una rueda" | "criatura", "rueda", "placas": sin nombre, sin rasgo | "El gólem de Ávila, 4 placas, un tornillo suelto en el hombro, bajo una rueda de molino." (cualquier detalle propio) |
| regla b8 | "pero si se adapta, ¿cómo se le gana?" | cierre en pregunta retórica (patrón "¿…?" de apertura y de cierre) | Un hecho incómodo: "Lo único que no ha aprendido es a perder." |
| stress b6 | "pero choca con el borde: no hay un paso 28 observable" | abstracto ("el borde"), informativo, sin cuerpo | "Paso 28: no hay nada que enseñarte. No es que no exista; es que la luz no ha llegado." |
| mate b1 | "Un punto sobre la recta en uno y una pregunta" | descriptivo, tono de manual | "Hay un punto en el 1. Está muy tranquilo. No sabe lo que le espera." (humor seco, una sola vez) |
| `accommodation.text` stress | "los pasos desiguales eran iguales: la regla de 27 es un logaritmo" | jerga explicada en jerga | "Los 27 pasos que parecían saltos distintos, en fila, miden lo mismo." |

Lo que **sí** funciona y hay que proteger (nota alta del usuario):
- **Neón**: pregunta + objeto físico (un letrero) + una ley física real (balastro a 100 Hz) + un cierre en acto (reencendido
  uno a uno). El texto en pantalla ya tiene onomatopeyas con carácter ("CRAC TAC PUM CLIC BUM").
- **Mate papel (9,5)**: [LECTURA] un solo objeto (el punto), un solo movimiento (girar), sin adornos. La pieza es austera;
  su personalidad sale del *gusto del trazo y el ritmo*, no del texto.
- Moraleja: **la personalidad está en el objeto y el ritmo, no en la frase final**. Los films peor vistos son los que explican
  su propia idea.

---

## 2. Hallazgos de investigación

### 2.1 Oficio narrativo para piezas cortas

**But/Therefore (Parker/Stone).** Si entre dos beats cabe "y luego", es una secuencia, no una historia; la causalidad se marca con
"pero" o "por lo tanto". Es lo que ya usa el motor. [HECHO]
https://perell.com/note/but-therefore-rule/ · https://thehustle.co/the-storytelling-secrets-that-netted-matt-stone-and-trey-parker-600-million-dollars
Límite: es una regla de **causa**, no de **sorpresa ni de voz**. Un spine perfecto puede ser perfectamente soso. Y, aplicado
con metrónomo (ABAB), se convierte en el ritmo predecible de §1.1.

**Story spine (Kenn Adams, 1991; Pixar).** "Érase una vez… Cada día… Hasta que un día… Por eso… Por eso… Por eso… Hasta que
por fin… Y desde entonces." Ocho frases con arranque fijo. [HECHO]
https://www.sessionlab.com/methods/story-spine · https://www.npr.org/transcripts/nx-s1-5750619
Útil como andamio de **un** film. Lo valioso es el "Cada día" (la rutina concreta, con su manía) y el "Hasta que un día" (la
ruptura). Lo que debemos evitar es que sea la **misma** columna vertebral en todos.

**Kishōtenketsu (ki-shō-ten-ketsu).** Cuatro movimientos: presentar, desarrollar, *giro* (un elemento aparentemente sin
relación) y reconciliación que revela la conexión; **no requiere conflicto**. [HECHO]
https://en.wikipedia.org/wiki/Kish%C5%8Dtenketsu
Relevancia alta para nosotros: piezas contemplativas/poéticas (melancolía, ternura, asombro) NO necesitan un antagonista ni
un "pero" de choque. El `ten` es un *cambio de perspectiva*, y el `ketsu` puede ser una resonancia, no un "retorno". Hoy el
schema solo conoce el spine causal; añadir `forma: kisho | causal | espiral` desbloquea tonos distintos (§3).

**McKee: valor en juego, brecha, punto de giro.** Una escena es acción que gira un valor (vida/muerte, verdad/mentira,
amor/odio…) con una **brecha entre expectativa y resultado**; el turning point es el instante en que esa brecha se abre. [HECHO]
https://mckeestory.com/do-your-scenes-turn/ · https://www.goodreads.com/author_blog_posts/22839401-the-gap-in-stories-la-robert-mckee
Nuestro `accommodation` es un giro *de modelo* (cognitivo). Falta el **valor en juego**: ¿qué se pierde si el espectador no
cambia de idea? Un film sin apuesta es una lección; con apuesta es una escena.

**Brecha de información (Loewenstein, 1994).** La curiosidad nace al percibir un hueco concreto en lo que se sabe; exige algo
de conocimiento previo y que el hueco parezca cerrable. [HECHO]
https://www.pbs.org/wgbh/nova/article/how-to-stimulate-curiosity/ · https://concepts.dsebastien.net/concept/information-gap-theory/
Consecuencia práctica: la pregunta buena es la que el espectador **ya casi se había hecho** sin saberlo, ancladas en algo que
reconoce. "¿Cabe una escala en un punto?" no se apoya en nada reconocible; "¿Qué suena cuando todo se rompe?" sí (todos hemos
oído un letrero roto).

**Veritasium: empezar por la concepción errónea.** [HECHO, fuentes secundarias] La tesis de Derek Muller sugirió que los vídeos
expositivos pueden reforzar la confianza en ideas erróneas, y que funcionan mejor los que presentan la intuición equivocada
y dejan al espectador "fallar" antes del giro. https://en.wikipedia.org/wiki/Derek_Muller ·
https://tokenskeptic.org/2012/01/28/episode-one-hundred-and-three-on-science-videos-with-veritasium/
Aplicación: el giro debe **desmentir una creencia que el espectador sostiene de verdad**, no una que le atribuimos. Campo
`creencia_previa` (§3).

**Kurzgesagt: información + historia + emoción.** Dettmer: "el plan malvado es enseñar sin que lo parezca"; cada vídeo con
música compuesta ex profeso; >1000 h de trabajo por vídeo. [HECHO, secundario] https://kurzgesagt.org/youtube/ ·
https://phdnet.mpg.de/208764/episode-25-kurzgesagt-and-visual-science-ft-philipp-dettmer
Nota honesta: no obtuve fuentes primarias detalladas sobre cómo abren 3Blue1Brown ni Vox. [LECTURA propia, sin fuente, a
validar]: 3B1B abre con un **puzle concreto** y un "qué raro" antes de cualquier definición; Vox con un **objeto cotidiano
→ pregunta de "¿por qué es así?"**. Ambos usan voz con *primera persona y duda* ("no sé vosotros, pero…").

**Every Frame a Painting.** Cada ensayo se reduce a un enunciado o pregunta simple que se prueba con gente de confianza antes
de producir; si no interesa pronto, la idea necesita refinarse; apuntar la idea, dejarla dormir, ver si sobrevive. [HECHO]
https://nofilmschool.com/2017/12/rip-every-frame-painting-farewell-advice-tony-zhou-and-taylor-ramos ·
https://en.wikipedia.org/wiki/Every_Frame_a_Painting
Es el **test de frescura humano** más barato que existe, y se puede imitar con agentes (§4: escéptico ciego + "dormir").

**Made to Stick (Heath & Heath): SUCCES.** Simple, Inesperado, **Concreto**, Creíble, Emocional, Historias. [HECHO]
https://en.wikipedia.org/wiki/Made_to_Stick — "concreto" y "inesperado" son los dos que nuestros guiones declaran menos.

### 2.2 Qué hace auténtico algo (síntesis operable)

No encontré un estudio único que defina "autenticidad narrativa"; lo siguiente es síntesis de oficio (McKee, Heath, Zhou/Ramos,
Eno) más las señales de detección de IA de §2.3. Cada punto es un **rasgo + cómo se declara + cómo se verifica**.

| rasgo | qué es | cómo se ve en un film de 60 s | verificable |
|---|---|---|---|
| **Especificidad** | nombre propio, cifra rara, lugar, material, fecha, unidad | "Sèvres, 1889, tres llaves" y no "un lugar antiguo" | léxico + regex (WARN) |
| **Punto de vista** | una afirmación que alguien podría rebatir | "esto es absurdo y tengo razón", no "esto es fascinante" | declarado; juicio [HUMANO] |
| **Imperfección elegida** | asimetría deliberada: un beat que se alarga, un chiste que no cae, una letra que no se enciende | la O muerta | declarada (`imperfeccion`) + presencia en timeline |
| **Ritmo irregular** | longitudes de frase y de beat no uniformes (alta "burstiness") | un beat de 2 s y otro de 14 s | CV de duraciones y longitud de frase |
| **Subtexto** | lo que se muestra ≠ de lo que va | un grifo que gotea (esperar) | declarado (`subtexto`); [HUMANO] |
| **Humor** | surge del choque entre registro y objeto | un funcionario que levanta acta de que el kilo adelgaza | solo [HUMANO] |
| **Riesgo** | algo que pudo salir mal | un final que no resuelve del todo | declarado (`riesgo`); [HUMANO] |
| **Contradicción** | tono ≠ imagen, o dos verdades a la vez | tierno y brutal | `tono.contradiccion` |
| **Por qué me importa** | alguien con nombre y motivo cuenta esto | "el que lo mide se jugó el puesto" | declarado (`apuesta.por_que_importa`) |

Eno sobre constraints: "Honor thy error as a hidden intention"; tarjetas Oblique Strategies; la libertad total no produce
obras inspiradas, las restricciones sí. [HECHO] https://en.wikipedia.org/wiki/Oblique_Strategies
→ la imperfección deliberada y las constraints de ideación (§4) son prácticas con tradición, no ocurrencias.

### 2.3 Señales de texto generado por IA (para evitarlas, no para detectar a nadie)

[HECHO] Wikipedia mantiene el catálogo más completo y revisado de "tells": énfasis indebido en la importancia ("marca un hito",
"testimonio de"), tono promocional, vaguedad en la atribución, **paralelismos negativos** ("no solo X, sino Y"), **regla de
tres**, evitar el verbo simple ("sirve como", "cuenta con"), conclusiones-resumen rígidas con "perspectivas de futuro" vagas.
https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing

[HECHO, resumen periodístico] Estudio de The Economist (≈56 000 frases, 1,2 M de palabras; ChatGPT, Claude, Gemini y Grok contra
sus propios artículos): "delve" ya no es fiable; lo delator es la **puntuación** (menos comas, punto y coma y paréntesis) y el
uso de "and", palabras largas, nominalizaciones y "not only…but also". Uniformidad de longitud de frase (poca "burstiness").
https://daringfireball.net/linked/2026/08/11/economist-ai-writing · https://thenote.app/post/en/the-economist-how-to-spot-ai-writing-46s3txunie
(Verificar en el artículo original; consulté solo resúmenes.) Lección: las listas de palabras caducan rápido; **las propiedades
estructurales (uniformidad, tríadas, paralelismos) son más estables** que el vocabulario.

[HECHO] Homogeneización: con ideas de un LLM, los relatos se evalúan como más creativos **a nivel individual**, pero son más
parecidos entre sí; "dilema social": cada autor gana, la variedad colectiva cae. Doshi & Hauser, Science Advances 2024.
https://pmc.ncbi.nlm.nih.gov/articles/PMC11244532 — Es exactamente nuestro caso (el mismo sistema escribe todos los films).

[HECHO] Causa y antídoto: el sesgo de tipicidad en los datos de preferencia empuja al "mode collapse"; pedir al modelo que
**verbalice una distribución de varias respuestas con su probabilidad** (Verbalized Sampling) multiplica la diversidad ×1,6–2,1
sin perder calidad factual. Zhang et al., arXiv:2510.01171. https://arxiv.org/html/2510.01171v1 — Base técnica del proceso de §4.

---

## 3. PROPUESTA A — `story.json` v2

Principios del diseño:
- **Compatible**: `v: 2` opcional; los campos v1 siguen valiendo (arc.mjs no se rompe). Los campos nuevos son `required` solo
  cuando `v: 2` (condicional en el schema).
- Cada campo nuevo **obliga a decidir** algo que hoy se deja por defecto, y casi todos son **cortos** (≤ 25 palabras) para que
  rellenar no sea otro molde.
- Los campos describen **intención**; el lint contrasta (presencia en pantalla, longitud, léxico). Declarar no basta.

### 3.1 Campos nuevos

| campo | contenido | por qué existe |
|---|---|---|
| `forma` | `causal` (pero/por lo tanto) · `kisho` (sin conflicto, giro lateral) · `espiral` (repetición con variación) · `cuenta_atras` | romper el molde único; kishōtenketsu para tonos tiernos/melancólicos |
| `voz` | `{ quien, actitud, persona, tiempo, registro[], tic, prohibido[] }` | el texto en pantalla y el sound design hablan "como alguien" |
| `punto_de_vista` | `{ tesis_discutible, contra }` | una opinión que alguien rebatiría; `contra` = la creencia que ataca |
| `ancla` | `{ objeto, detalle, dato:{valor,unidad,fuente}, en_pantalla_antes_de, tacto }` | el detalle concreto que sostiene el film y que se VE y se oye |
| `question` (ampliado) | + `creencia_previa`, `por_que_no_sabia` | la pregunta que el espectador no sabía que tenía |
| `giro` | `{ t, de, a, cambia_lo_visto }` | qué creía → qué cree; qué beat anterior se relee |
| `apuesta` | `{ valor, polo_inicial, polo_final, por_que_importa }` | valor en juego (McKee) y razón humana |
| `subtexto` | `{ dice, significa }` | superficie vs. lo que va por debajo |
| `tono` | `{ primario, secundario, contradiccion }` | tono de asombro/humor/melancolía; la tensión entre ambos |
| `imperfeccion` | `[{ t, que, porque }]` (≥1) | asimetría elegida |
| `cierre` | `{ tipo: corte\|eco\|golpe\|silencio\|abierto\|cicatriz, ultima_linea, sin_moraleja:true }` | evitar el retorno de plantilla; `eco` exige justificarlo |
| `frescura` | `{ puntos:{…}, descartados[], version_por_defecto, distancia }` | resultado del test de §4 (trazabilidad) |
| `beats[].concreto` | qué cosa física ocurre | un beat sin cosa física es abstracto |
| `beats[].peso` | `corto\|medio\|largo\|pausa` | ritmo irregular declarado |

`accommodation.type` gana `creencia` (cambio de lo que el espectador creía de algo concreto) además de regla/escala/idea.

### 3.2 Extracto del schema (JSON Schema, condicional a `v: 2`)

```jsonc
{
  "properties": {
    "v": { "const": 2 },
    "forma": { "enum": ["causal", "kisho", "espiral", "cuenta_atras"] },
    "voz": { "type": "object", "required": ["quien", "actitud", "persona", "registro"],
      "properties": {
        "quien": { "type": "string", "maxLength": 80, "description": "quién habla (oficio/estado de ánimo), no 'narrador'" },
        "actitud": { "type": "string", "maxLength": 80, "description": "su postura ante lo que cuenta (escéptico, escandalizado, cómplice…)" },
        "persona": { "enum": ["yo", "nosotros", "tu", "impersonal", "tercera"] },
        "tiempo": { "enum": ["presente", "pasado", "mixto"] },
        "registro": { "type": "array", "items": { "type": "string" }, "maxItems": 3 },
        "tic": { "type": "string", "description": "una costumbre verbal recurrente (p. ej. 'consta en acta')" },
        "prohibido": { "type": "array", "items": { "type": "string" } } } },
    "punto_de_vista": { "type": "object", "required": ["tesis_discutible", "contra"] },
    "ancla": { "type": "object", "required": ["objeto", "detalle", "dato"],
      "properties": { "dato": { "type": "object", "required": ["valor", "fuente"] },
        "en_pantalla_antes_de": { "type": "number", "description": "s; el ancla debe verse/leerse antes (lint)" } } },
    "giro": { "type": "object", "required": ["t", "de", "a", "cambia_lo_visto"] },
    "apuesta": { "type": "object", "required": ["valor", "polo_inicial", "polo_final", "por_que_importa"] },
    "subtexto": { "type": "object", "required": ["dice", "significa"] },
    "imperfeccion": { "type": "array", "minItems": 1, "items": { "required": ["t", "que", "porque"] } },
    "cierre": { "type": "object", "required": ["tipo", "ultima_linea"] }
  }
}
```

### 3.3 Ejemplo completo (concepto fresco n.º 1, "El kilo adelgaza")

Fuera de la tabla de §1, con voz propia. Hechos por verificar contra BIPM antes de producir (marcados).

```json
{
  "v": 2,
  "forma": "causal",
  "idea": "Si la cosa que define el kilo adelgaza, no pierde ella peso: lo gana todo lo demás.",
  "voz": {
    "quien": "un funcionario de archivo con 30 años de oficio y ninguna prisa",
    "actitud": "escrupulosamente impasible ante un absurdo que él ve perfectamente",
    "persona": "impersonal",
    "tiempo": "presente",
    "registro": ["acta", "deadpan"],
    "tic": "cada afirmación termina en 'consta'",
    "prohibido": ["fascinante", "increíble", "imagina", "al final"]
  },
  "punto_de_vista": {
    "tesis_discutible": "Que el patrón se desgaste no es un fallo del kilo sino del resto del mundo.",
    "contra": "que un patrón físico 'pesa' lo que pesa"
  },
  "ancla": {
    "objeto": "el cilindro de platino-iridio en el sótano de Sèvres, bajo tres campanas de cristal, con tres llaves en tres manos",
    "detalle": "tres llaves: ninguna persona puede abrirlo sola",
    "dato": { "valor": "≈ 50 microgramos de diferencia respecto a sus copias en un siglo", "unidad": "µg", "fuente": "BIPM (verificar)" },
    "en_pantalla_antes_de": 8,
    "tacto": "vidrio, platino, papel de acta, sello de tampón"
  },
  "question": {
    "text": "¿Cuánto pesa lo que define cuánto pesa todo?",
    "posed_at": 2.5, "answered_at": 33, "on_screen": true,
    "creencia_previa": "un kilo es un kilo, siempre fue un número fijo",
    "por_que_no_sabia": "nadie piensa en qué cosa concreta SE PESÓ para decidir el primer kilo"
  },
  "giro": {
    "t": 33,
    "de": "el cilindro está adelgazando",
    "a": "por definición el cilindro pesa 1 kg siempre; lo que cambia es todo lo demás: el mundo se ha vuelto más pesado",
    "cambia_lo_visto": "las tres llaves, las tres campanas: se protegía el patrón de lo único que no podía suceder: ser medido por otro."
  },
  "apuesta": {
    "valor": "verdad / convención",
    "polo_inicial": "el kilo es un hecho de la naturaleza",
    "polo_final": "el kilo era un pacto, y el pacto se rompió sin un solo culpable",
    "por_que_importa": "cada pesada de tu vida colgó de ese cilindro hasta 2019"
  },
  "subtexto": { "dice": "un cilindro pierde unas mil millonésimas", "significa": "la autoridad que no puede ser cuestionada también envejece" },
  "tono": { "primario": "vértigo", "secundario": "humor seco", "contradiccion": "la solemnidad de un acta para un hecho que no tiene remedio" },
  "beats": [
    { "id": "b1", "t": 0.5, "peso": "medio", "concreto": "tres llaves sobre un mantel, tres manos", "text": "Consta: hay un cilindro en Sèvres que es el kilo." },
    { "id": "b2", "t": 8,   "peso": "corto", "link": "pero", "concreto": "la balanza compara el cilindro con su copia", "text": "Consta también que ha adelgazado." },
    { "id": "b3", "t": 14,  "peso": "largo", "link": "por lo tanto", "concreto": "el sello 'SIN VARIACIÓN' sobre un acta con una cifra tachada", "text": "Consta que el cilindro no puede adelgazar: es el kilo por definición." },
    { "id": "b4", "t": 33,  "peso": "pausa", "link": "por lo tanto", "concreto": "una moneda, un pan, un gato en la balanza: todos con un grano más", "text": "Consta que todo lo demás ha engordado." },
    { "id": "b5", "t": 41,  "peso": "corto", "link": "pero", "concreto": "mayo de 2019: el cilindro baja de su pedestal", "text": "2019: se jubila. Ahora el kilo es una constante." }
  ],
  "accommodation": { "t": 33, "type": "creencia", "text": "lo que pesaba menos era el patrón, y por eso pesa más todo" },
  "imperfeccion": [
    { "t": 21, "que": "el acta se queda sin firma de uno de los tres: la cámara aguarda 3 s de más", "porque": "la burocracia no resuelve; solo registra" }
  ],
  "cierre": { "tipo": "cicatriz", "ultima_linea": "Consta que pesó lo que pesó.", "sin_moraleja": true },
  "medium": { "id": "kraft", "porque": "el kilo es un archivo: papel de embalaje, etiquetas, tampones, hilo y lacre; la pieza es un expediente. No es 'evitar el negro'." },
  "frescura": {
    "puntos": { "ancla": 2, "pregunta": 2, "hecho_raro": 2, "giro_relee": 2, "apuesta": 1, "distancia_default": 2, "distancia_archivo": 2 },
    "version_por_defecto": "'¿Y si el kilo cambiara? La historia del kilo patrón y la constante de Planck' (documental informativo, cierre: 'la ciencia siempre avanza')",
    "descartados": [{ "logline": "las 7 unidades SI y su historia", "razon": "enciclopédico, sin giro" }]
  }
}
```

Nota: el texto de beat ya lleva voz; se ve como sello/etiqueta de expediente, sin narración hablada.

---

## 4. PROPUESTA B — Test de frescura y proceso de ideación

### 4.1 Test de frescura (7 criterios, 0–2 cada uno, máx. 14)

| # | criterio | 0 | 1 | 2 |
|---|---|---|---|---|
| 1 | **Ancla concreta** (objeto que se puede dibujar/tocar/oír) | abstracción ("escala", "tiempo") | objeto genérico ("una criatura") | objeto con nombre, material y rasgo ("cilindro de Sèvres, tres llaves") |
| 2 | **Pregunta que no sabía que tenía** | la habría hecho cualquiera / se googlea | interesante, pero esperable | ya la tenía a medias y no sabía; nadie la formula |
| 3 | **Hecho raro y verificable** | sin dato / dato famoso | dato correcto pero conocido | cifra/fecha/lugar con fuente que sorprende |
| 4 | **Giro que relee lo visto** | solo añade información | cambia la conclusión | cambia el sentido de beats ya vistos |
| 5 | **Apuesta humana** | sin nada en juego | "es bonito saberlo" | alguien pierde/gana algo concreto; importa por una razón nombrable |
| 6 | **Distancia a lo por defecto** (§4.2 fase 3) | ≈ versión por defecto | mismo tema, ángulo distinto | tema y ángulo distintos del por defecto |
| 7 | **Distancia al archivo propio** | repite tema/estructura de un film previo | mismo medio/tono que el anterior | nada en común con el archivo |

Umbral: **≥ 10/14 y ningún 0 en (1), (2), (3), (6)**. Dos criterios son **vetos**:
- No cabe en un póster ("la verdadera X era Y") → es moraleja, no concepto.
- Se resume en una frase sin sustantivo concreto → rechazado.

Además, el test humano barato (Zhou/Ramos): decir el logline en 15 s a alguien ajeno; **si pregunta "¿y entonces?" va bien; si
asiente educado, no**. Para agentes: un agente sin contexto lee solo el logline y responde "¿Quiero ver esto? ¿Qué espero
que pase?"; si adivina el giro, el giro es previsible.

### 4.2 Proceso de ideación (6 fases; ≤3 agentes en paralelo)

**Fase 0 — Constraints de la oleada (director).** Antes de generar: fijar 6 casillas que **deben quedar todas distintas**:
tema (familia), tono, duración, medio, formato (16:9/9:16/1:1), forma narrativa. Una casilla se rellena una vez por oleada:
la diversidad se impone por diseño y no se espera. Prohibidos: los temas del archivo (`data/**`) + lista de manidos (§5.3).

**Fase 1 — Semillas (no el modelo).** Tomar 3 semillas de **bancos externos**, de familias diferentes, y forzar el choque:
- Objetos con historia (patrones de medida, herramientas de oficio, un formulario, una cerradura).
- Hechos raros con cifra (récords, accidentes, errores heredados, cifras disputadas).
- Oficios y su jerga (afinador de pianos, fedatario, impresor).
- Fallos/accidentes y su corrección ("el bug que se quedó").
- Lugares exactos (una sala, un sótano, una esquina).
- Reglas de juego/burocracia (por qué se hace así).
Búsqueda con herramientas: cada semilla debe traer **una URL y un dato**. Sin fuente no es semilla.
(Oblique-style: "Remove ambiguities and convert to specifics"; "Honor thy error as a hidden intention".)

**Fase 2 — Generación en distribución (Verbalized Sampling).** Prompt tipo: *"Genera 20 conceptos para un film de {X} s con
estas semillas. Para cada uno devuelve: logline, objeto ancla, dato con fuente, la pregunta, el giro, y la probabilidad
(estimada) de que una IA lo propusiera por defecto. Quiero ≥12 con probabilidad < 0,1."* Sustento: arXiv:2510.01171.
Regla anti-sesgo: pedir también 5 conceptos **que alguien desaconsejaría**.

**Fase 3 — Escéptico ciego (agente separado, sin ver los 20).** Dado solo el tema de cada candidato, escribe "el video por
defecto" (logline + giro + cierre). Se compara con el candidato: si coinciden en giro o cierre → criterio 6 = 0. Este agente
también marca **frases-póster** (§5.3).

**Fase 4 — Filtro duro.** Puntuar con §4.1; descartar por vetos; **verificar hechos** (fuente primaria; si la cifra es
disputada, se convierte en material: p. ej. "24 o 25 neutrinos según la fuente", la duda ES el detalle).

**Fase 5 — Dormir y elegir.** 3 finalistas. Cada uno se guarda con fecha en `data/ideas.md`; la selección final **espera una
iteración** (Zhou/Ramos: "apunta, olvida, ve si sobrevive") o, si el director no puede esperar, un agente relee los tres
fríos al día siguiente (otro contexto). El director elige uno; los otros dos quedan en la reserva (no se reciclan films, pero
sí ideas guardadas con sus escritos).

**Fase 6 — Voz antes que beats.** Una vez elegido: escribir `voz`, `ancla`, `giro`, `apuesta`, **luego** los beats. Los
beats nacen de las cinco líneas anteriores, no al revés. Se pasa el lint de §5 y después se escribe la spec 3DD.

### 4.3 Reglas anti-recaída (derivadas de la lección de Potencias v3)

- **Una hipótesis por oleada**: cada film de prueba cambia UNA cosa respecto al anterior (p. ej. añadir `voz`), y se mide la nota.
- **No sobrecorregir una crítica puntual**: toda crítica del usuario se traduce a hipótesis y se contrasta en ≥2 films antes
  de convertirla en regla del lint.
- **Registro de notas** con rasgos del guion (`data/notas.json` ya existe): tras 8–10 films con nota se ve qué rasgos
  correlacionan con nota alta; los checks que no correlacionan se eliminan.

---

## 5. PROPUESTA C — Lint narrativo

Nuevo módulo `engine/narr.mjs` (o ampliación de `arc.mjs`) con `npm run narr`. Entrada: `story.json` + textos en pantalla del
timeline (`shot.text`) + `narration`. Todo determinista, sin red, sin LLM.

### 5.1 Checks

| id | qué mide | umbral inicial | nivel |
|---|---|---|---|
| `schema.v2` | campos de §3 presentes si `v:2` | todos los `required` | FIX |
| `ancla.visible` | el `ancla.objeto`/`detalle` aparece (texto o shot/entidad) antes de `en_pantalla_antes_de` | sí | FIX |
| `ancla.dato` | `ancla.dato.valor` contiene cifra o nombre propio; `fuente` no vacía | regex `\d` o mayúscula interior | FIX |
| `abstracto.densidad` | nº de nombres abstractos del léxico de §5.3 por 100 palabras (idea+beats+pantalla) | > 4 | WARN |
| `concreto.ratio` | beats con `concreto` no vacío | < 80 % | WARN |
| `cliche.apertura` / `cliche.cierre` | coincidencia con lista §5.3 en grupo A/C | 1 | **FIX** (grupo A y C), WARN (resto) |
| `paralelismo.neg` | "no es/no solo X, (sino/es) Y" en pantalla+idea | ≥ 2 ocurrencias | WARN |
| `triada` | enumeraciones "A, B y C" o 3 adjetivos seguidos | ≥ 2 | WARN |
| `pregunta.plantilla` | pregunta abre con plantilla o es sí/no ("¿Cabe…?", "¿Es…?") | 1 | WARN |
| `pregunta.apertura_y_cierre` | la pregunta del gancho y el último beat son ambos "¿…?" | sí | WARN |
| `spine.metronomo` | alternancia ABAB estricta de `link` en ≥ 6 beats **o** > 70 % del mismo conector | sí | WARN |
| `ritmo.beats_cv` | CV de duraciones de beats | < 0,30 | WARN |
| `ritmo.frases_cv` | CV de nº de palabras por texto en pantalla (≥ 8 textos) | < 0,45 | WARN |
| `giro.posicion` | `giro.t / duración` dentro de [0,55 ; 0,92] y **distinto** de los 3 films previos ± 5 pts | fuera de rango o coincide | WARN |
| `cierre.eco` | solapamiento léxico último beat vs. primer beat > 0,5 sin `cierre.tipo:"eco"` | sí | WARN |
| `cierre.moraleja` | 2.ª persona + abstracto en el último beat ("tú eres", "todos somos", "siempre") | sí | FIX |
| `voz.coherencia` | pronombre/persona en pantalla ≠ `voz.persona`; aparecen `voz.prohibido` | sí | WARN |
| `voz.tic` | el `tic` declarado aparece ≥ 2 veces y ≤ 6 | fuera | WARN |
| `imperfeccion.presente` | cada `imperfeccion[].t` cae dentro de un shot y hay un evento (hold, desalineación) | no | WARN |
| `frescura.registro` | `frescura.puntos` suman ≥ 10 y no hay 0 vetados | no | FIX |
| `frescura.archivo` | solape de palabras clave `idea+ancla` con films previos (Jaccard) | > 0,3 | WARN |
| `diversidad.oleada` | en una oleada, medio/tono/forma/duración **no se repiten** | repetido | FIX (director) |

### 5.2 Qué no se lintea (queda para humano)

Que el chiste cause gracia; que la voz suene a alguien; que el punto de vista sea valiente; que el giro sorprenda; que el
detalle "se sienta" real; que la imperfección sea una gracia y no un fallo. Para todos: [HUMANO] y se pregunta en la nota.

### 5.3 Lista anti-cliché inicial (español) — `data/anticliche.es.json`


**A. Aperturas (FIX)**
- "que pasaria si", "y si te dijera", "alguna vez te has preguntado", "alguna vez has", "imagina (un|que)", "en un mundo (donde|en el que)",
  "desde (el principio de los tiempos|la antiguedad)", "hoy en dia", "en la era de", "sabias que", "te has parado a pensar".

**B. Estructuras (WARN)**
- "no es (solo )?[^.]{1,40}, (es|sino)", "no solo [^.]{1,40} sino", "mas que [^.]{1,30}, es", "la clave (esta|reside) en",
  "lo que (realmente|de verdad) importa", "y es que", "porque, en el fondo", "se trata de", "al fin y al cabo".

**C. Cierres moralizantes (FIX)**
- "al final(,| )(todos|somos)", "todos somos", "somos polvo de estrellas", "nada volvera a ser igual", "la verdadera [^.]{1,30} era",
  "(siempre|ha) estado ahi", "el viaje (continua|acaba de empezar)", "y tu, ?", "(lo|la) que (realmente|de verdad) (importa|cuenta)",
  "cambia tu (vida|forma de)", "quizas la respuesta", "tu eres (el|la) ".

**D. Vocabulario de póster (WARN)**
- "fascinante", "increible", "asombroso", "sorprendente" (decir asombro no lo produce), "un viaje (a|por|hacia)", "un universo de",
  "tapiz", "sinfonia de", "danza de", "susurro", "sumergirnos", "adentrarnos", "desentrañar", "navegar (por|entre)",
  "revolucionario", "crucial", "fundamental", "esencial(mente)?", "en esencia", "descubre como", "el poder de".

**E. Abstractos de relleno** (para `abstracto.densidad`, WARN al acumular)
- esencia, concepto, escala, idea, sistema, proceso, todo, nada, infinito, universo, vida, tiempo, realidad, existencia, mundo,
  verdad, sentido, misterio, profundo, inmenso.

**F. Nuestros propios tics (WARN; añadidos del §1)**
- Último beat con "vuelve", "volvemos", "regresa" **y** `cierre.tipo != eco`; "pero si .+, ¿" al cierre; "tú eres" / "somos" en cierre;
  "criatura", "cosa", "algo" como sujeto de beat (falta objeto concreto).

Mantenimiento: la lista **caduca** (la Economist ya no encuentra "delve"). Cada oleada: añadir lo que el usuario critique y
**retirar** entradas que lleven 3 oleadas sin saltar. Excepciones: `narr_ok: { check, porque }` en el story (con justificación
visible en el reporte; una excepción sin porqué es FIX).

---

## 6. Riesgos: Goodhart y cómo no matar la personalidad

[HECHO] "Cuando una medida se convierte en objetivo, deja de ser buena medida" (Goodhart 1975; formulación de Strathern 1997);
Campbell: cuanto más se usa un indicador cuantitativo para decidir, más presión de corrupción recibe.
https://en.wikipedia.org/wiki/Goodhart%27s_law — Ya nos pasó: el pico al 60–85 % se cumple en cuatro films y los cuatro
suenan iguales (§1.1).

Salvaguardas propuestas:
1. **Lint solo del suelo (negativo).** Un film que pasa el lint no es bueno; uno que no lo pasa tiene un problema probable.
   Sin puntuación global ni "narr score 87/100" (el `score` de arc ya invita al juego).
2. **WARN, no FIX, durante 2 oleadas.** FIX solo para campos obligatorios, ancla visible y los dos clichés de apertura/cierre.
3. **Rotar y variar umbrales**: umbrales con un rango y una semilla por oleada, para que no se "aprendan"; los checks con
   efecto de molde (posición del giro) se comparan con films previos, **no con una constante**.
4. **Lo declarado se contrasta**: nada que un agente pueda aprobar escribiendo la palabra correcta (`ancla.visible`
   exige presencia en pantalla; `imperfeccion.presente` exige evento).
5. **Excepción con razón**: `narr_ok` permite romper un check si el film lo pide (la voz de un funcionario SÍ puede abusar de
   "consta"). Reglas que no admiten excepción se convierten en dogma.
6. **Validar contra el juez**: registrar la nota del usuario junto a los rasgos; con n=4 hoy no hay estadística (mate 9,5,
   neón "bastante bien", regla "bien ejecutado", potencias v3 peor), pero tras 10 notas se descartan los checks sin relación.
7. **El agente que escribe no es el que valida** y el escéptico ciego no ve los candidatos: reduce el autoengaño.
8. **No sobreajustar al gusto declarado**: "épico/vibrante" no es sinónimo de "ruidoso". La personalidad del film puede ser
   quieta (mate 9,5 es austera).

---

## 7. [HUMANO] — lo que queda para el usuario

- Elegir el concepto entre 3 finalistas **solo si lo desea**; si no, el director decide y el usuario puntúa tras ver.
- Calificar con **una nota y una frase** (como hasta ahora) y, nuevo, una casilla: "¿tuvo voz?" (sí/no/algo).
- Juicio de: humor, voz, riesgo, "me importó", si el giro sorprendió, si la imperfección quedó como gracia.
- Veto sobre el uso de un tema ("manido para mí").
- Decidir qué rasgos del §3 son esenciales y cuáles estorban (sobre campos del story v2).

---

## 8. PROPUESTA D — Seis conceptos frescos para la próxima oleada

Diseñados con la Fase 0: temas, tonos, duraciones, medios y formas distintos. Ninguno repite temas del archivo (potencias,
e^iπ, regla/adaptación, letrero roto, giro/escala). **Los hechos están por verificar contra fuente primaria antes de producir**;
los marco con (v). Soy consciente de que algunos temas existen en YouTube; lo fresco es el **ángulo + ancla + giro**, no el
tema.

### C1 — "Consta" (el kilo que adelgaza) · vértigo + humor seco · 45 s · 16:9
- **Logline**: un funcionario levanta acta de que el cilindro que define el kilo ha perdido peso; por definición no puede.
- **Pregunta**: "¿Cuánto pesa lo que define cuánto pesa todo?"
- **Ancla**: el cilindro de platino-iridio de Sèvres, 3 campanas, 3 llaves (v); ≈ 50 µg de pérdida en un siglo (v).
- **Giro**: no adelgazó el kilo: engordó el mundo. Y las tres llaves protegían de lo único imposible: medirlo con otro.
- **Voz**: funcionario de archivo impasible; todo termina en "consta". Cierre: cicatriz, no moraleja.
- **Medio**: **kraft** (expediente, tampón, lacre). Justificación temática: el tema es un archivo.
- **No manido**: no es "historia de las unidades" ni "la constante de Planck explicada"; es la paradoja de la autorreferencia
  contada como acta. Forma `causal`.

### C2 — "425 hercios" · melancolía · 60 s · 16:9
- **Logline**: el tono de marcar fue la forma que tuvo una máquina de decir "adelante, habla"; nadie lo oye ya y suena igual.
- **Pregunta**: "¿Por qué un sonido sin palabras te hacía callar y esperar?"
- **Ancla**: una sola onda a 425 Hz (tono de invitación a marcar en España; v) dibujada por una pluma sobre papel de registrador;
  la línea nunca cambia durante 60 s mientras en el sonido entra "gente" (marcar pulso/tonos, voz de fondo).
- **Giro**: no era para ti, era para la central: te estaba diciendo que la línea ya era tuya. Hoy nadie está al otro lado.
- **Voz**: tercera persona, muy suave, presente; casi no habla (sound design como voz).
- **Medio**: **técnico/papel de registrador** (tira de papel milimetrado crema con pluma; sustituto del plano cian ya probado).
  Una línea que avanza es el medio y el tema.
- **No manido**: no es nostalgia de "los 90"; es un solo objeto físico (una onda) y una pregunta de oído. Forma `kisho`
  (sin conflicto; el giro es lateral).

### C3 — "Todo seguro, caballeros" (Otis, 1854) · tensión + showmanship · 35 s · 16:9
- **Logline**: un hombre se sube a una plataforma de 15 m (v), pide que le corten la cuerda y vende lo único que importa:
  el momento en que la cuerda falla.
- **Pregunta**: "¿Qué compra la gente cuando compra un ascensor?"
- **Ancla**: el hacha, la cuerda, la leva de seguridad con dientes (v: Crystal Palace, Nueva York, 1854).
- **Giro**: lo que se vendió no fue subir, fue que **la caída está prevista**; la ciudad vertical nace de un fallo planificado.
- **Voz**: pregonero de feria, orgulloso y teatral; cuenta atrás en la cadencia.
- **Medio**: **grabado/litografía de época** (tinta sepia, papel crema) — medio nuevo; el aguafuerte es la estética de 1854.
- **No manido**: no "historia del ascensor"; es una **apuesta física** (hacha, silencio, golpe) y una frase real ("All safe,
  gentlemen", v). Forma `cuenta_atras`.

### C4 — "Veinticuatro" (SN 1987A) · asombro por escasez · 75 s · 16:9
- **Logline**: de una estrella que explotó, a la Tierra llegaron decenas de billones de billones de neutrinos; los detectores
  vieron veinticuatro. Con eso bastó.
- **Pregunta**: "¿Cuántas partículas hacen falta para saber que ha explotado una estrella?"
- **Ancla**: veinticuatro destellos (cifra disputada: 24–25, v) en un tanque de agua de Kamioka, uno a uno en 13 segundos (v), unas horas
  antes de que llegara la luz (v). El número es el motivo visual: cada destello suma al contador.
- **Giro**: la escasez es la prueba. Lo vasto no se ve; se detectan 24 y se reconstruye la muerte de una estrella. La duda
  24/25 se queda en pantalla (imperfección).
- **Voz**: física que cuenta despacio y sin adjetivos; primera persona del plural contenida ("hemos contado").
- **Medio**: **oscuro con profundidad** (cuba de agua negra con fotomultiplicadores como pequeñas lunas; niebla; parallax). Válido por
  el tema (luz, noche, detector). No es relleno: cada destello viene de una profundidad.
- **No manido**: no es "agujeros negros ni Big Bang"; su asombro viene de un número **pequeño**, no de uno enorme. Forma `espiral`
  (cuenta creciente).

### C5 — "29 de febrero de 1900" · humor ágil · 25 s · 9:16
- **Logline**: tu hoja de cálculo cree que 1900 fue bisiesto; no lo fue; se quedó así por compatibilidad con un programa de 1983 (v).
- **Pregunta**: "¿Por qué existe un día que no existió, en la celda A60?"
- **Ancla**: la celda con "29/02/1900", la fecha que Excel acepta y la realidad rechaza (v).
- **Giro**: no es un error: es una decisión mantenida a propósito. Un error fosilizado cuatro décadas por no romper nada.
- **Voz**: alguien despierto a las 3 de la mañana, en primera persona, irritado y cómplice, frases cortas irregulares.
- **Medio**: **retícula de celdas** (UI gris clara, tipografía de hoja de cálculo; medio nuevo, claro): el tema es una rejilla.
- **No manido**: nadie hace un reel sobre un bug de calendario heredado; el humor viene del choque de lo trivial con lo inamovible. Forma `causal`.

### C6 — "Botella 1904" · ternura + espera · 50 s · 1:1
- **Logline**: una botella lanzada al mar por un científico para medir corrientes aparece 108 años después, y la persona que
  la encuentra hace justo lo que pedía el papel: devolverla por la recompensa (v: 1904, Marine Biological Association; Amrum, 2015).
- **Pregunta**: "¿Qué se le debe a alguien que cumple una petición 108 años tarde?"
- **Ancla**: una tarjeta postal con una recompensa de unos peniques y una dirección de Plymouth (v).
- **Giro**: no era un mensaje: era un instrumento de medida. Y aun así el gesto de ella cierra un contrato que nadie recordaba.
- **Voz**: tercera persona, cálida y seca; tono de carta.
- **Medio**: **papel de carta con tinta y acuarela diluida** (medio nuevo: manchas de agua, sal). El agua es el tema.
- **No manido**: "mensaje en una botella" es cliché; lo fresco es el dato real (la botella era un termómetro de corrientes) y la
  recompensa de peniques. Forma `kisho` (ten = "no era un mensaje").

### Cobertura
| | tema | tono | duración | formato | medio | forma |
|---|---|---|---|---|---|---|
| C1 | metrología/archivo | vértigo+humor | 45 | 16:9 | kraft | causal |
| C2 | sonido/telefonía | melancolía | 60 | 16:9 | técnico (registrador) | kisho |
| C3 | historia/ingeniería | tensión | 35 | 16:9 | grabado (nuevo) | cuenta atrás |
| C4 | astrofísica | asombro | 75 | 16:9 | oscuro con profundidad | espiral |
| C5 | informática | humor | 25 | 9:16 | celdas (nuevo, claro) | causal |
| C6 | oceanografía/historia | ternura | 50 | 1:1 | papel carta + acuarela | kisho |

Todos los medios son distintos; hay 2 cortos (reel) y 1 largo; 3 formas distintas de spine; solo C4 es oscuro, y por su tema.

---

## 9. Fuentes

- But/Therefore: https://perell.com/note/but-therefore-rule/ · https://thehustle.co/the-storytelling-secrets-that-netted-matt-stone-and-trey-parker-600-million-dollars
- Story spine: https://www.sessionlab.com/methods/story-spine · https://www.npr.org/transcripts/nx-s1-5750619
- Kishōtenketsu: https://en.wikipedia.org/wiki/Kish%C5%8Dtenketsu
- McKee: https://mckeestory.com/do-your-scenes-turn/ · https://www.goodreads.com/author_blog_posts/22839401-the-gap-in-stories-la-robert-mckee
- Loewenstein (brecha de información): https://www.pbs.org/wgbh/nova/article/how-to-stimulate-curiosity/ · https://concepts.dsebastien.net/concept/information-gap-theory/
- Veritasium / Muller: https://en.wikipedia.org/wiki/Derek_Muller · https://tokenskeptic.org/2012/01/28/episode-one-hundred-and-three-on-science-videos-with-veritasium/
- Kurzgesagt: https://kurzgesagt.org/youtube/ · https://phdnet.mpg.de/208764/episode-25-kurzgesagt-and-visual-science-ft-philipp-dettmer
- Every Frame a Painting: https://nofilmschool.com/2017/12/rip-every-frame-painting-farewell-advice-tony-zhou-and-taylor-ramos · https://en.wikipedia.org/wiki/Every_Frame_a_Painting
- Made to Stick (SUCCES): https://en.wikipedia.org/wiki/Made_to_Stick
- Señales de escritura IA: https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing · https://daringfireball.net/linked/2026/08/11/economist-ai-writing
- Homogeneización por IA: https://pmc.ncbi.nlm.nih.gov/articles/PMC11244532
- Verbalized Sampling: https://arxiv.org/html/2510.01171v1
- Oblique Strategies: https://en.wikipedia.org/wiki/Oblique_Strategies
- Goodhart/Campbell: https://en.wikipedia.org/wiki/Goodhart%27s_law

Lagunas: sin fuente primaria sobre 3Blue1Brown/Vox ([LECTURA]); Economist solo vía resúmenes; los hechos (v) de §8 están por verificar.
