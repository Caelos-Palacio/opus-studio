# Perfil de gusto de opus-studio

Versión 1 · spec 022 (estudio v6). Es la fuente del gusto: lo leen el panel de críticos (`engine/panel.mjs`) y el agente
productor. Cada regla es **observable** (se puede comprobar mirando la hoja de contacto, un recorte a 4× o una medida) y
cita su **origen**: una nota humana (`N##`, posición en `data/notas.json`), una spec o una referencia.

- Las reglas de las secciones 1–6 se escriben a mano y se versionan aquí.
- La sección «Notas humanas» es **generada**: `node engine/gusto.mjs build` la regenera desde `data/notas.json`.
- Una nota nueva (escenario G5): `node engine/gusto.mjs nota <film> "<texto>" [--nota 8] [--dim visual]`; añade la nota y regenera.
- Formato de regla: `- **ID** texto observable. _Origen: N10, spec 003_`. Orígenes válidos: `N##`, `spec ###`, `research ##`, `MODO-LIBRE`, `exp 2026-10-11`.
- Las reglas no nombran películas concretas: valen para cualquier film.

## 1. Historia y voz (mirada: director)
- **H01** Hay un objeto ancla concreto, con física propia (peso, flotación, inercia), y su movimiento ES la explicación; no hay cajas con flechas. _Origen: N10, N19, spec 013, MODO-LIBRE_
- **H02** La tesis cabe en una frase y se ve u oye antes del 30 % del metraje; el film la reinterpreta en el giro (el mismo objeto cambia de significado). _Origen: spec 013_
- **H03** El giro se marca con un cambio de luz o de color, no solo con un texto nuevo, y no cae siempre en el 72–81 % del metraje. _Origen: spec 013, MODO-LIBRE_
- **H04** La apertura no es la plantilla «¿…?» y el cierre no es «vuelve…» ni una moraleja explícita. _Origen: spec 013_
- **H05** Hay voz: un punto de vista reconocible (humor, una imperfección deliberada, un detalle personal) que distingue este film de otro cualquiera. _Origen: spec 013, N19_
- **H06** Un concepto flojo ejecutado con oficio queda en «bien»: el concepto pesa tanto como la ejecución en la nota. _Origen: N16_
- **H07** Todo recurso (3D, medio, sonido, cámara) está motivado por el guion desde el principio; nada se ve «pegado con cinta» a posteriori. _Origen: N12, spec 012_
- **H08** Los protagonistas tienen un rasgo propio (gesto, mascota, tic) que se repite y evoluciona. _Origen: spec 003_

## 2. Ritmo (mirada: director)
- **R01** Las duraciones de escena son irregulares (coeficiente de variación ≥ 0,3) y no hay 5 escenas seguidas de igual duración. _Origen: N01, spec 001, MODO-LIBRE_
- **R02** Hay un único pico claro hacia el 60–85 % del metraje, precedido de un crescendo de 10–20 s de energía creciente. _Origen: N01, spec 001_
- **R03** Hay al menos un respiro (≥ 1,5 s; ≥ 4 s en films de más de 40 s) en el que casi nada se mueve, y ningún tramo de más de 15 s sin respiro. _Origen: N01, spec 001, MODO-LIBRE_
- **R04** Cada texto nuevo permanece lo bastante para leerse (≈ 0,8 s + 0,25 s por palabra). _Origen: N01, spec 001_
- **R05** Ninguna escena dura menos de 2 s salvo un golpe buscado y marcado por el sonido. _Origen: MODO-LIBRE_
- **R06** El final respira: la última escena deja ≥ 2 s de calma o de cola antes del negro. _Origen: spec 001_
- **R07** La energía visual varía de verdad: los tramos de más movimiento son ≥ 4 veces los de menos (p90/p10). _Origen: spec 001_

## 3. Composición y materia (mirada: ojo)
- **C01** La textura del soporte (fibras, grano, manchas, luz) se ve a 1×: ningún fotograma tiene el fondo plano. _Origen: N10, spec 003, MODO-LIBRE_
- **C02** El sujeto es grande y suele ir descentrado, a veces cortado por el borde, y deja ≈ 2/3 de aire para el texto; el texto nunca tapa al sujeto. _Origen: spec 003_
- **C03** Hay profundidad: al menos 2 capas con desplazamiento distinto en cámara y sombra de contacto bajo lo que se apoya. _Origen: spec 003, MODO-LIBRE_
- **C04** El objeto principal tiene 8–15 piezas pequeñas que se apoyan unas en otras, y el micro-detalle se repite (ranuras, remaches, fibras). _Origen: MODO-LIBRE, spec 003_
- **C05** Hay grano animado y viñeta ligeros sobre todo el cuadro: ningún píxel «digital muerto». _Origen: N10, spec 003_
- **C06** Un solo medio coherente en TODO (fondo, objetos, texto y luz); la luz también está hecha con el material del medio. _Origen: spec 003, N13_
- **C07** El medio y el fondo los elige el tema: oscuro con profundidad si el tema es luz, noche, cosmos o escala inmensa; soporte con textura si es razonar, medir o escribir. _Origen: N17, N13, spec 012_
- **C08** Hay imperfección deliberada (trazo que tiembla, desregistro, mancha, borde irregular) en vez de vector limpio. _Origen: spec 003, MODO-LIBRE_
- **C09** Un fondo oscuro tiene profundidad que se ve (estrellas, bruma, niebla, viñeta, parallax); un oscuro sin motivo es relleno. _Origen: N17, spec 012_
- **C10** La cámara no es un plano frontal fijo: hay empuje, parallax o fuga con motivo. _Origen: spec 003_
- **C11** Los objetos añadidos (3D, sellos, recortes) comparten luz, sombra y grano con el fondo. _Origen: N11, N12_

## 4. Color y tipografía (mirada: ojo)
- **K01** La paleta es cerrada: 1 neutro + 2 acentos como máximo, y ≥ 92 % de los píxeles saturados caen cerca de un acento. _Origen: N10, N14, spec 003_
- **K02** Un solo acento de luz o de color manda en cada escena, y el acento cambia en el giro. _Origen: N14, N15, MODO-LIBRE_
- **K03** La paleta es propia del film y justificada por su tema; no es la de siempre (dorado sobre azul noche). _Origen: spec 003, spec 012_
- **T01** Hay jerarquía tipográfica: al menos 3 tamaños con razón ≥ 1,5 entre niveles y un titular legible a 1×. _Origen: spec 003_
- **T02** El texto se lee a 1×: contraste texto/fondo ≥ 4,5:1 y cuerpo ≥ 3 % de la altura del cuadro; nada de gris sobre gris diminuto. _Origen: spec 003_
- **T03** La tipografía tiene el carácter del medio (mono técnico en un HUD, trazo manuscrito en papel); no hay una sans por defecto en todo. _Origen: spec 003, N13_

## 5. Sonido (mirada: director)
- **S01** La música tiene arco (intro, construcción, pico, resolución) y la loudness varía (LRA ≥ 6 LU en el mp4). _Origen: N02, N09, spec 002_
- **S02** Cada evento visual relevante (corte, revelación, entrada de objeto) suena, el whoosh crece con la velocidad y el golpe cae a ≤ 2 fotogramas de la imagen. _Origen: N03, spec 002_
- **S03** Ningún efecto idéntico se repite más de 4 veces seguidas; varían tono, filtro o tiempo. _Origen: N03, spec 002_
- **S04** Hay ≥ 0,5 s de vacío relativo justo antes del golpe principal. _Origen: spec 001, spec 002_
- **S05** El master mide −14 LUFS ±0,5 y true peak ≤ −1 dBTP sobre el mp4 final. _Origen: spec 002, MODO-LIBRE_
- **S06** Sin narración con voz sintética robótica: es mejor el silencio o el texto que una voz de baja calidad. _Origen: N20_
- **S07** El máximo de sonoridad coincide con el pico visual (±0,5 s). _Origen: spec 002_

## 6. Anti-patrones (mirada: escéptico)
- **A01** Fondo negro VACÍO: oscuro sin profundidad ni motivo. (El oscuro elegido por el tema y con profundidad es válido.) _Origen: spec 003, N17, spec 012_
- **A02** Monotonía: escenas de igual duración, mismo zoom, mismo gesto repetido. _Origen: N01, spec 001_
- **A03** Prisa: conceptos que aparecen y desaparecen sin tiempo de lectura. _Origen: N01_
- **A04** Audio pobre: efectos planos, sin música con arco. _Origen: N01, N03_
- **A05** Paleta por defecto: dorado tímido sobre azul noche. _Origen: spec 003_
- **A06** Clip-art: siluetas planas de contorno limpio, iconos vectoriales sin textura ni sombra de contacto, mismo grosor de línea en todo. _Origen: exp 2026-10-11, N19, research 12_
- **A07** Presentación corporativa: cajas con flechas, listas con viñetas, titulares centrados con icono, aspecto de plantilla de diapositivas. _Origen: exp 2026-10-11, spec 022_
- **A08** Plantilla narrativa visible: tríadas, simetría exacta, moraleja final. _Origen: spec 013_
- **A09** Texto diminuto y gris sobre un fondo casi igual de gris. _Origen: spec 003_
- **A10** Vacío decorado con efectos (brillos, partículas) en lugar de un mundo con objetos. _Origen: spec 003_
- **A11** Sobrecorregir: aplicar una crítica a todo (por ejemplo prohibir el negro o imponer un medio único). _Origen: N17, N13, spec 013_

## 7. Rúbrica del panel (0–10)
Cada mirada puntúa sus criterios de 0 a 10 con estas anclas (0 = ausente o roto; 5 = correcto pero olvidable; 8 = bueno,
se defiende ante un profesional; 10 = asombroso, se recordaría). La puntuación total de la mirada es la media de sus criterios.
SHIP exige media de las tres miradas ≥ 8 y ninguna mirada por debajo de 6.

### director
- **historia**: ¿hay una idea con un objeto ancla, un giro y un cierre propios? 0 = sin idea; 5 = idea correcta de plantilla; 10 = idea fresca cuyo objeto ES la explicación.
- **voz**: ¿tiene un punto de vista reconocible y no robótico? 0 = impersonal; 5 = tono neutro correcto; 10 = voz inconfundible, con humor o imperfección propia.
- **ritmo**: variación, respiros, un pico y un final que respira (más el arco del sonido). 0 = constante o apresurado; 5 = variado pero sin pico claro; 10 = crescendo, golpe, respiro y cierre medidos.

### ojo
- **composicion**: sujeto, aire, profundidad y cámara. 0 = plano frontal vacío; 5 = ordenado pero estático; 10 = sujeto grande, capas con parallax y aire para el texto.
- **materia**: textura del soporte, grano, imperfección, integración de capas, visible a 1×. 0 = fondo plano; 5 = textura presente pero tímida; 10 = el material se siente táctil en todo.
- **color**: paleta cerrada, acento por escena, coherencia con el tema. 0 = colores sin criterio; 5 = paleta correcta pero de manual; 10 = paleta propia y cambio de color con sentido.
- **tipografia**: jerarquía, legibilidad a 1×, carácter. 0 = ilegible o sin jerarquía; 5 = legible pero por defecto; 10 = jerarquía clara y carácter del medio.

### escéptico
- **no_generico**: ¿podría ser de cualquier otro tema? 0 = plantilla intercambiable; 5 = tiene algo propio pero previsible; 10 = solo podría ser este film.
- **no_clipart**: ¿hay materia y detalle o iconos planos? 0 = clip-art puro; 5 = vector limpio con algo de textura; 10 = ilustración con oficio y detalle.
- **no_corporativo**: ¿parece una presentación de empresa? 0 = diapositivas con viñetas y cajas; 5 = limpio pero institucional; 10 = nada institucional, con riesgo y personalidad.

<!-- notas:begin -->
## 8. Notas humanas (generado: `node engine/gusto.mjs build`)

Cada línea es una observación del usuario sobre un film concreto. Aplícala como criterio general, no como receta de ese film.

- **N01** Aplicar: «monótona, apresurada, audio pobre, no épica» (stress/potencias · potencias v1 · general · nota 5). _Origen: N01, spec 001_
- **N02** Aplicar: «6–7» (stress/potencias · potencias + música PoC · audio · nota 6.5). _Origen: N02, spec 001, spec 002_
- **N03** Aplicar: «planos, monótonos» (stress/potencias · sfx originales · audio · nota 5). _Origen: N03, spec 002_
- **N04** Aplicar: «bien, no wow» (regla · regla v1 · general). _Origen: N04, spec 003_
- **N05** Aplicar: «bien, no wow» (reel · reel v1 · general). _Origen: N05, spec 003_
- **N06** Aplicar: «bien, no wow» (mate · mate v1 (nocturno) · general). _Origen: N06, spec 003_
- **N09** Aplicar: «algo mejor, sí» (stress/potencias · potencias v2 · audio · nota 8). _Origen: N09, spec 002_
- **N10** Aplicar: «muy god; tal vez el efecto del morado» (mate_papel · visual · nota 9.5). _Origen: N10, spec 003_
- **N11** Aplicar: «fluido y estilo acorde; plano; falla integración con escenario y ángulo» (world3d · world3d v1 · visual · nota 8). _Origen: N11, spec 004_
- **N12** Aplicar: «bueno; la integración visual es buena, pero se ve pegado con cinta porque no está guionizado desde el principio» (stress/potencias · world3d v2 (A/B P03) · visual). _Origen: N12, spec 009_
- **N13** Aplicar: «los 4 están bien; cada vídeo debe tener libertad para elegir su medio» (medios · kraft, pizarra, técnico, neón · visual). _Origen: N13, spec 003_
- **N14** Aplicar: «cualquiera de los 3 está bien, tal vez terracota → se adopta terracota» (mate_papel · acento morado: violeta / ciruela / terracota · visual). _Origen: N14, spec 003_
- **N15** Aplicar: «está muy bien» (mate_papel · terracota · general). _Origen: N15, spec 012_
- **N16** Aplicar: «no es el mejor concepto pero está bien ejecutado» (regla · v2 pizarra · general). _Origen: N16, spec 012_
- **N17** Aplicar: «antes estaba mejor, sea el fondo negro: hay que saber distinguir cuándo usar cada uno» (stress/potencias · v3 técnico · general). _Origen: N17, spec 012_
- **N18** Aplicar: «bastante muy bien» (reel · v2 neón · general). _Origen: N18, spec 012_
- **N19** Aplicar: «genial» (botella · aislada v1 (agente sin motor, frame(t) libre) · general). _Origen: N19, exp 2026-10-11_
- **N20** Aplicar: «la voz fuera, terrible» (voz_demo · espeak-ng · voz). _Origen: N20, spec 018_
<!-- notas:end -->
