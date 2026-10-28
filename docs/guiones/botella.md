# Botella (C6) — "Se debe un chelín"

50 s · 1:1 · papel_carta_acuarela (medio nuevo) · forma kisho · tono ternura + espera · giro al 49 % (24,4 s) · story: `botella.story.json`

TÍTULO: "Botella 1904" no se sostiene; la botella del récord se lanzó el 30-nov-1906. 1904 es el inicio del experimento. Sugerencia: "Botella" o "Botella 1906". La clave de film se queda en `botella`.

## 1. Hechos verificados (el research erraba en año y en recompensa)
| afirmación | resultado | fuente |
|---|---|---|
| Caso real: George Parker Bidder (presidente de la Marine Biological Association, Plymouth) lanzó 1 020 botellas al Mar del Norte entre 1904 y 1906 | confirmado | https://www.guinnessworldrecords.com/news/2016/3/mysterious-postcard-found-on-german-shore-is-confirmed-as-oldest-message-in-a-bot-420594 · https://globalnews.ca/news/2653757/worlds-oldest-message-in-a-bottle-found-after-108-years |
| La botella del récord: lanzada el 30-NOV-1906 (no 1904), hallada en Amrum (Alemania) en abril de 2015 (17-abr), 108 años y 138 días | CORRECCIÓN: año 1906, no 1904 | Guinness (arriba) |
| Quien la halló: Marianne Winkler, jubilada, de vacaciones con su marido | confirmado | Guinness · Global News (arriba) · https://www.smithsonianmag.com/smart-news/vacation-goer-spots-message-bottle-century-old-experiment-180956407/ (403 al leerla; título confirmado por búsqueda) |
| Recompensa: UN CHELÍN, no "unos peniques" | CORRECCIÓN | Guinness |
| La tarjeta: inglés, alemán y neerlandés; pide devolverla a la MBA con dónde y cómo se halló; dice "BREAK THE BOTTLE" | confirmado (Global News lo sitúa en el vidrio; Guinness en la tarjeta) | Guinness · Global News |
| La botella era un instrumento: "bottom-trailer", flota unos dos pies sobre el fondo para que la recojan las redes de arrastre. Servía para medir el flujo profundo (este→oeste) y la migración de la solla | confirmado | Guinness (arriba) · resumen NPR vía búsqueda https://www.npr.org/transcripts/435273225 |
| La MBA pagó: compró un chelín antiguo en eBay y se lo envió con una carta de agradecimiento | confirmado | Guinness · Global News |
| Bidder anotó ~55 % de devolución (Guinness: "55 % per annum") | confirmado con ambigüedad; no se usa en pantalla | Guinness |
| NUEVO: el récord ya fue superado: botella de 1886 (12-jun-1886), 131 años 223 días, hallada el 21-ene-2018 en Wedge Island (Australia Occidental) por Tonya y Kym Illman | confirmado; por eso el film no habla de "récord" | https://www.guinnessworldrecords.com/world-records/oldest-message-in-a-bottle |
Sin verificar: que Winkler rellenase a mano las casillas (las fuentes dicen que "la devolvió"); por eso el film solo dice "la devuelve". El año de acuñación del chelín pagado no consta (solo "antiguo").
Lo que el research sí acertó: el giro "no era un mensaje, era un instrumento" es verdad y mejor que el research mismo.

## 2. Versión por defecto (escrita antes)
"La botella más antigua del mundo: 108 años a la deriva, una mujer de vacaciones encuentra un mensaje del pasado; a veces los mensajes llegan." Emotivo, cierre esperanzado, romanticismo del mar. Distancia: el film niega el mensaje (es un formulario), se mueve por la deuda (el chelín), y cierra con un recibo seco, no con esperanza. Pero el tema es el por defecto: distancia_default = 1.

## 3. Test de frescura: 12/14, sin ceros
ancla 2 (la tarjeta trilingüe con chelín) · pregunta 2 ("qué se le debe...") · hecho_raro 2 (eBay, bottom-trailer, "BREAK THE BOTTLE") · giro_relee 2 (las botellas pasan de gritos a instrumentos; el chelín de premio a precio) · apuesta 1 (un chelín; la palabra dada) · distancia_default 1 · distancia_archivo 2. Veto de póster: no (último verso es un recibo). Lint: 0 FIX / 0 WARN; frescura APTO. Cierre `eco` con `porque` declarado: es el único del trío que "vuelve"; lo justifico por contrato, pero es el riesgo más claro de caer en la plantilla de los films v1.

## 4. Nota de dirección
- Objeto ancla: la tarjeta postal. Física: papel de carta con sal cristalizada en una esquina, tinta sepia que corre cuando cae agua, acuarela que se diluye con el borde húmedo. Todo cuadrado 1:1, como una postal.
- b1 (4,6 s): la tarjeta, con la frase del chelín en tinta. Ancla visible desde 0,4 s. b2 (8,4 s): mapa del Mar del Norte en acuarela, 1 020 botellas flotando en fila a dos pies del fondo; flechas este→oeste que se dibujan solas. b3 (2 s, el más corto): red de arrastre, moneda en un muelle.
- b4 (15,4–24,4, nueve segundos): la botella sola, bajo el agua turbia. Una gota cae sobre la tarjeta y la tinta de la fecha se corre; la fecha de 1906 queda ilegible y no se limpia. Casi sin texto. La espera ES el tema.
- b5 (24,4, el giro): Amrum en acuarela clara, abril; la mujer se agacha; el reverso de la tarjeta, casillas. El color cambia de gris-verde turbio a un azul claro.
- b6: el sobre cruza el mapa. b7 (7,5 s): un dedo en la pantalla de un portátil, una moneda de plata; un cajón con monedas de otro siglo. b8: el sobre llega; el chelín gastado en una palma; el sello de tinta PAGADO (la única tinta firme).
- Ritmo: 4,6 / 8,4 / 2,0 / 9,0 / 7,0 / 4,6 / 7,5 / 6,5 s (CV 0,39). Kisho: sin conflicto; el "pero" de b4 y b5 son giros suaves, no choques.
- Sonido: agua lejana, papel, plumilla, gotas, olas bajas; en b7 un clic de ratón (el único sonido moderno). Música: una cuerda o piano suave que entra en b5 y se retira antes de b8. Cierre: papel y sello.
- Texto: tercera persona, carta contable; "Se debe" 3 veces (b1, b7, b8). Sin firma, sin signos de exclamación.
- Imperfección: la fecha borrada por una gota (t≈19) que no se rescata; la pausa de nueve segundos.
- NO hacer: no poner a una mujer sentimental en primer plano ni cara; no violines; no "mensajes que llegan"; no mencionar el récord ni el de 2018; no pretender que escribió la tarjeta (no consta); no hacer la botella con aspecto de ornamento (es un trozo de vidrio con lastre).

## Ajustes tras el escéptico ciego (2026-10-07)
El escéptico adivinó "botella científica con recompensa". El centro pasa a lo que no previó: la deuda contable de 108 años, la
asociación comprando un chelín viejo por internet y el sello PAGADO. La revelación "era un formulario" se dice antes (beat 2) y
deja de ser giro: el giro es que alguien cumplió el formulario y alguien pagó.
