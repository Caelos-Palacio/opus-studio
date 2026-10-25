# 13. Estado de opus-studio y qué falta para finalizarlo (foco: gusto, estilo, anti-slop)

Fecha del análisis: 2026-10-25. Solo lectura. Método: leí yo mismo CLAUDE.md, spec 022, MODO-LIBRE, kit-libre/README,
ROADMAP §8, HANDOFF, `gusto` (worktree), `notas.json`, calibraciones y las hojas jpg de las entregas. No usé subagentes
haiku: la lectura cabía en contexto y el juicio visual debía ser mío.
Convención de evidencia: `N##` = posición en `data/notas.json` (N01 = primera nota); `hoja:X` = `out/entregas/X.jpg`.

## 0. Veredicto corto
- La **dirección v6 es correcta** (autónomo, gusto en el sistema, producción libre) pero está **sobre todo en papel**:
  no existe el comando v6 de punta a punta, ni el storyboard (grep: `consultar`/`storyboard` solo aparecen en la spec 022
  y en docs históricas; ningún `.mjs` de engine/ lo implementa), y `gusto`/panel siguen sin integrar a main.
- Lo que más falta no es infraestructura sino **gusto operativo**: el sistema sabe evitar el clip-art y el negro vacío
  (reglas negativas), pero no sabe **producir sorpresa**, y su kit y su brief empujan a una **monocultura** papel-crema +
  verde-agua + rojo sello (ver §2).
- El juez actual **no sirve todavía**: ρ = 0,338 (lote 1) y ≈ 0,27 solo con el director del lote 2 (calculado, §3).
  Falla en lo que más importa: no distingue lo que el usuario premia con 9,5.

## 1. Diagnóstico de gusto: qué separa lo valorado de lo demás
Piezas valoradas: Mate papel 9,5 «muy god» (N10), Mate terracota «está muy bien» (N15), Reel neón «bastante muy bien» (N18),
Botella libre v1 «genial» (N19, `hoja:botella_aislada`). No valoradas: «bien, no wow» (N04-N06), Potencias v1 5 «monótona,
apresurada» (N01), Botella motor (clip-art, spec 022), voz espeak «terrible» (N20).

Rasgos observables (con evidencia visual):
1. **Una sola idea con un objeto que ES la explicación.** Mate papel: un punto sobre una recta que gira y dibuja el
   semicírculo; nada más en pantalla (`hoja:ab_mate`, columna B). Botella v1: la tarjeta, el formulario, la moneda y el sello
   cuentan la deuda de un chelín. Spec 013 lo dice: «metáfora ES el objeto».
2. **Contención con un único acento.** Mate papel B = papel + tinta + un morado/terracota (N10 «tal vez el efecto del morado»,
   N14). Lo que alegró al usuario fue UN acento de color, no más color. Reel neón: magenta + cian sobre ladrillo oscuro
   (`hoja:neon`): también paleta cerrada con un acento que manda.
3. **Materia del soporte visible a 1×**, no solo en recortes: grano, fibras, manchas del papel (`hoja:ab_mate` B vs A: mismo
   contenido, el papel convierte «bien, no wow» (N06) en 9,5; es la prueba más limpia que tiene el repo del efecto
   soporte, aunque cambió también el acento, así que el 9,5 no es solo papel).
4. **Aire.** En Mate papel el sujeto ocupa una fracción mínima del cuadro y el resto es vacío con textura. Esto **choca con
   la regla del kit** «el sujeto ocupa ≥ 30 % del cuadro» y con la del brief «55–65 %» (MODO-LIBRE §5, kit auditoria
   `ocupacionSujeto`): el 9,5 las incumpliría. Primer síntoma de sobre-prescripción.
5. **Texto con voz, corto y exacto.** Botella v1: «Se debe un chelín» con subrayado a mano, «PAGADO» en sello, ficha
   «Contraída · Saldada · Plazo · Importe» con puntos de relleno (`hoja:botella_aislada`, últimos cuadros). Mate: frases de
   una línea («Si la velocidad apunta de lado, el punto gira»). Los rótulos que parecen interfaz fallan (ver rasgo 7).
6. **Oficio en el detalle, repartido con criterio** (v1): moneda con relieve, red con nudos irregulares, botella con
   etiqueta, mapa con costas. Pero ese oficio no es suficiente: la v2 lo tiene y es peor (rasgo 7).
7. **Ausencia de elementos «de producto»**. `hoja:botella_libre_v2` cuadros 43,6 s: popup tipo macOS «Chelín · Comprar»
   con botón azul y cursor; v2 B7 de la botella-motor: buscador «chelín antiguo» con mano. Son el sello del slop
   corporativo y rompen el medio (spec 003 C06). La v1 resolvió esa misma escena con la moneda sola sobre el papel.
8. **Ritmo con respiro y un golpe.** Mate: 90 s con escenas largas y una revelación (N10; el panel lo midió plano, p90/p10 1,8,
   y aun así el usuario lo adoró: ver §3, el ritmo medido no explica la nota).

Lo que NO distingue (conviene saberlo): la complejidad técnica. El film más barato en ejecución (Mate papel, 1 punto y
2 curvas) tiene la nota más alta del repo.

## 2. Riesgo de slop en el sistema actual
### 2.1 Monocultura confirmada por las hojas
- Las 5 Botellas comparten paleta (beige papel + verde-agua profundo + azul mar + rojo sello) y secuencia (tarjeta → mapa → red →
  botella bajo el agua → playa → sobre → moneda → PAGADO). Pero eso es el tema; la prueba de monocultura son las
  **tres variantes de Haiku/Sonnet con prompts distintos que usan literalmente la misma gramática**: `hoja:botella_libre_v2`,
  `botella_v3_haiku_prompt`, `botella_v3_haiku_kit`: fondo crema moteado, verde submarino con viñeta, azul turquesa liso
  de playa, texto serif centrado, tarjeta con borde doble.
- `kit-libre/muestra.jpg`: las 30 muestras del kit usan LA MISMA paleta (crema, verde-azulado, terracota, azul-pizarra) y los
  mismos objetos (botella, sobre, sello, moneda, mapa). Cualquier agente que use el kit hereda esa paleta por defecto: el kit
  **tiene gusto, y es uno solo**.
- Entregas libres vs motor: `consta` (sepia monocromo oscuro, objetos diminutos, texto pequeño y de bajo contraste en
  `hoja:consta`), Mate, Reel, Potencias son otros mundos. Pero son del motor viejo, congelado. **El flujo nuevo (libre) solo ha
  demostrado un mundo**: papel-acuarela-sepia-sello. MODO-LIBRE §3 detalla recetas solo para papel, acuarela, agua, vidrio, tinta,
  metal y cuerda: ni neón, ni pizarra, ni recorte/collage, ni grabado, ni stop-motion, ni tipografía cinética, ni 3D.
  La frase de CLAUDE.md «asombro, épico/vibrante» no se parece a una gramática de papel viejo.

### 2.2 Reglas del brief/perfil que pueden PRODUCIR slop (prescriptivas y copiadas)
| regla | dónde | por qué es riesgo |
|---|---|---|
| «tarjeta/papel + sello PAGADO» como remate | no es regla, es lo que copian los 4 Botellas; la plantilla del kit trae mapa+tinta+sello | la plantilla `kit-libre/plantilla/frame.js` es el ejemplo único: todo agente la imita |
| Cifras fijas: fibras 200–600, 25–40 capas, alfa 0,02–0,05, grano 0,04–0,07, empuje 2–6 %, escalonar 80–200 ms | MODO-LIBRE §3–4 | todas las piezas salen con la misma «textura de fábrica»; el grano uniforme es el acabado de plantilla de 2026 |
| Sujeto ≥ 30 % (auditoría que SUSPENDE) y 55–65 % | kit auditoria; MODO-LIBRE §5 | penaliza el aire que explica el 9,5 de Mate (rasgo 4); empuja a sujetos «de póster» |
| «Un acento de luz», «paleta cerrada 1 neutro + 2 acentos» | gusto K01/K02 | bien como idea, pero sin obligar a que el acento sea **distinto film a film** el resultado es siempre crema + rojo |
| «Pocas notas de piano», «cama de agua/sala», foley gota/papel/moneda/sello | MODO-LIBRE §6 | un único idioma sonoro; el audio de todas las piezas libres será el mismo piano espaciado |
| Giro marcado con cambio de color; apertura sin «¿?»; cierre sin moraleja | gusto H03/H04, brief «Prohibido» | son anticlichés de ayer; en cuanto todos los agentes los cumplen, el cumplimiento es la nueva plantilla (Goodhart, ya advertido en spec 013 §Principios) |
| Fuentes: «una serif de libro para el cuerpo» | MODO-LIBRE §5 | todas las piezas en la misma serif humanista (se ve en las 5 Botellas y en la muestra) |
| Rúbrica del brief con 8 criterios 0–2 y «gusto» como un ítem de 8 | MODO-LIBRE §7 | el gusto es 1/8 de la autorevisión; el productor se optimiza para pasar los 7 criterios mecánicos |
Evidencia de que el anti-slop ya es plantilla: la v2 de Sonnet (con el brief completo) cumple casi todas las reglas y a
cambio mete el popup «Comprar» y mapas con cápsula de texto blanca estilo app (`hoja:botella_libre_v2`, 8,5 s y 40,5 s).

### 2.3 Mecanismos de diversidad que faltan
1. **Sin memoria de «lo ya hecho»**: no hay veto por archivo de entregas. `data/ideas.md` y `IDEACION.md` archivan conceptos,
   pero no hay un registro de **gramáticas visuales** (paleta, medio, familia tipográfica, vocabulario sonoro, forma de
   transición) por entrega, ni un veto automático («no repetir medio ni paleta dominante de las últimas 3»).
2. **Sin referencia externa por pieza.** Spec 003 analizó 4 posts de X una vez; ahí nació el estilo crayón/papel. Ninguna
   pieza nueva recibe una referencia nueva: el sistema se destila de sí mismo (efecto fotocopia de fotocopia).
3. **Sin medio obligatorio distinto**: N13 dice «cada vídeo debe tener libertad para elegir su medio» y C07 da una regla de
   elección; pero la libertad con un kit de una sola mano produce siempre el mismo medio.
4. **Sin «apuesta» registrada**: spec 013 introdujo `apuesta` y `imperfeccion` en el story v2, pero el flujo libre
   (MODO-LIBRE) no los exige; la sección «Historia» se la da el humano/orquestador.
5. **Sin «el humor/rareza» como entrega**: H05 (voz) existe como regla, nada la produce. Voz = una imperfección deliberada
   ahora solo se pide, no se ofrece un procedimiento (ver propuesta 2).

## 3. El juez (panel de críticos)
### 3.1 Estado de la calibración
- Lote 1: ρ = 0,338, 7/8 pares (falla potencias_v2 > v3). `out/panel/calibracion-resultado.json`: **Mate papel (9,5)
  media 5,1, séptimo**; Mate terracota 4,8; Mate v1 3,1 (último, correcto); botella_aislada 7,6 primero (correcto).
- Lote 2: solo `director.json` (12 paquetes) de 3 miradas. Cruzado con `calibracion2-mapa.json` y los niveles de
  `data/calibracion.json` (cálculo mío, no del repo): ordena botella_aislada 8,0 > regla_v2 7,0 = potencias_v3 7,0 >
  potencias_v2 6,5 = regla 6,5 = botella(motor) 6,5 > potencias_v1 6,3 = mate_papel 6,3 = mate_terracota 6,3 > reel_v2 6,0 >
  reel 5,5 > mate 4,8. **ρ del director solo = 0,27** (p = 0,40); el director no es el juez de nivel (era de historia/voz/ritmo),
  pero lo relevante es qué falla.
### 3.2 Dónde acierta el director
- Pone la botella_aislada (N19 «genial») la primera con margen (8,0 vs 7,0 máx. del resto) y la botella motor 1,5 puntos por
  debajo: reconoce el contraste clip-art/oficio (par estricto cumplido).
- Pone Mate v1 (negro, N06 «bien, no wow») último con 4,8 y critica correctamente «negro vacío (79 % plano)».
- Sus arreglos son concretos, accionables y casi siempre buenos (p. ej. «marcar el giro con luz», «alargar el respiro»).
### 3.3 Dónde falla
- **Mate papel 6,3 (empatado con potencias_v1, 5/10 del usuario).** Veredicto: «p90/p10 = 1,8, escenas 1,5–2,3, acortar
  escenas, dar voz» (arreglos F). El panel cuenta ritmo/giro/voz medidos; el usuario premia la **claridad y limpieza de
  una idea**, no el contraste de actividad. Sus criterios miden **tamaño del esfuerzo** (actividad, golpes), no **efecto**.
- **Potencias v3 (el técnico, N17 peor que v2) 7,0 > v2 6,5.** Sin ver vídeo ni oír, v1/v2 comparten imagen y solo cambia el audio
  (HANDOFF gusto): el panel visual no puede separarlos; la nota (8 vs 5) es sobre audio, otra dimensión (`notas.json`: `dim:"audio"`).
- **Compresión del rango:** 4,8–8,0 con casi todo en 6–7. Un juez con rango estrecho no discrimina; el umbral SHIP «media ≥ 8,
  ninguna < 6» solo lo cumple la mejor pieza del repo en una mirada (7,6–8,0). Con este juez nada llegará a SHIP salvo por azar.
- **Mezcla de dimensiones y niveles inferidos:** `data/calibracion.json` usa niveles 1–5 deducidos («nivel 2 = bien, no wow o
  superada»): `botella` motor = 2 y `reel` = 2 comparten nivel con tres notas sin número (N04–N06 `nota: null`). Solo hay **4 notas
  numéricas** en todo el repo (N01 5, N02 6,5, N03 5, N09 8, N10 9,5, N11 8) y dos son de audio. El «Spearman ≥ 0,7» se exige
  sobre una verdad de campo mayormente ordinal e inferida; hay empates y 7 de 12 nodos con una sola frase como evidencia.
- **Circularidad:** `gusto.md` se deriva de las mismas notas que calibran el panel (HANDOFF lo reconoce). Con 18 notas, cada
  regla nueva (H09, C12, M01–M06) se escribió para arreglar un par que falló (diagnóstico lote 1 → «el perfil castigaba lo
  didáctico»), no para predecir; el lote 2 mide en muestra, no fuera de ella.
### 3.4 ¿Puede detectar slop y premiar lo interesante?
- **Slop de superficie (clip-art, negro vacío, rótulos corporativos): sí, en parte**. El escéptico ya bajó la botella
  motor y potencias v3 (3,7 en lote 1, el más bajo que dio) y señala la plantilla; Mate v1 último en ambos lotes.
- **Slop «bien hecho» (cumple todas las reglas y no dice nada) y lo interesante: no.** La rúbrica pregunta «¿podría ser de cualquier
  otro tema?» (no_generico) pero el panel ve una película a la vez, anónima, **sin su contexto** (sin las otras entregas ni
  sin saber lo que ya hizo el estudio). «Genérico» solo es medible **comparando con un conjunto**: el juez debe ver las
  últimas N entregas junto a la candidata.
- **No ve el vídeo ni oye.** Ve hoja de 12 fotogramas, recortes 4× y tiras de 8 fotogramas a 5 fps; el audio llega como curva
  ASCII. No puede juzgar peso, timing de sello, calidad de piano, sorpresa del giro, ni que la transición «tinta» funcione.
  Todo lo que dependa de movimiento fino y música es opinión sobre un descriptor.
- **Rúbrica sin criterio de «interés/riesgo/delight»:** hay ritmo, color, tipografía, materia, no «¿hay un momento que te haga
  sonreír o te sorprenda?». El peor fallo: el juez premia lo que el productor ya sabe hacer.
### 3.5 Cómo cerrar el lote 2 y umbral realista
1. Lanzar ojo y escéptico del lote 2 (haikus no puntúan: Sonnet con visión, 3 miradas × 12 paquetes; los ficheros siguen en
   `out/panel/calibracion2/`). Coste estimado: ≈ 2 × 150 000 tokens, 1–2 h con paralelo.
2. **No exigir ρ ≥ 0,7 sobre 12 niveles inferidos.** Con n = 12 y empates, un ρ de 0,7 es ruido de ±0,3. Umbral realista y
   más honesto, en tres capas:
   - **Pares duros** (los 4 estrictos con nota o decisión explícita del usuario): mate_papel > mate, botella_aislada > botella,
     mate_papel > potencias_v1, reel_v2 > reel: **≥ 4/4** con margen ≥ 1 punto.
   - **Mate papel en el top-3 de la media** (es la vara; si no, el juez no vale).
   - ρ global **≥ 0,5 informativo**, no puerta. Pasar de 0,7 con n = 12 no es creíble.
3. **Añadir dos cosas antes de repetir:** (a) una **prueba ciega de generalización**: pedir al usuario 6 notas numéricas
   rápidas (0–10) sobre films que el perfil no ha visto (p. ej. las 3 Botellas libres y 3 films nuevos); esa es la única
   calibración fuera de muestra; (b) normalizar el rango del panel (puntuar por **ranking relativo** en el lote: «ordena estos 4
   de más a menos interesante» y media de rangos, no puntos absolutos).
4. Si tras el lote 2 el ρ sigue < 0,5 o Mate papel queda en la mitad inferior: **rebajar el panel de juez a filtro de mínimos**
   (detecta lo malo: negro vacío, clip-art, texto ilegible, popup de interfaz) y dejar lo bueno al usuario (nota
   opcional). Es coherente con spec 013 «lo positivo no se lintea» (principio 1) y con spec 022 principio 1.

## 4. Lo que falta para finalizar la v6 (priorizado)
Estimaciones de esfuerzo en sesiones de agente Sonnet (1 sesión ≈ 1–2 h, ≈ 150–250 k tokens).

### P0 (sin esto no hay v6)
| # | tarea | evidencia de que falta | esfuerzo |
|---|---|---|---|
| P0.1 | **Comando v6 de punta a punta** `node engine/estudio.mjs <encargo.json>`: idea → hechos → guion v2 + escéptico → storyboard → producción libre → auditoría → panel → entrega + informe. Hoy cada paso es un agente humano-orquestado; no existe en `engine/` | `ls engine`: solo `panel.mjs`, `gusto.mjs`, `fondo-libre.mjs` en gusto; nada de orquestación v6 | 2–3 sesiones |
| P0.2 | **Integrar `gusto` a main.** Sin conflictos de texto (`git merge-tree`: 0 marcadores). El diff `main..gusto` muestra kit-libre «más viejo» porque `gusto` ramificó antes de kit v2; un merge conserva el de main, pero **hay que correr `npm test -- --full`** (obligatorio por CLAUDE.md) y regenerar STATUS | `git log gusto..main` = 2 commits de kit v2 | 0,5 sesión (+ 785 s de suite) |
| P0.3 | **Cerrar calibración** (§3.5) y decidir si el panel es juez o filtro | lote 2 incompleto: solo `director.json` | 1 sesión + 6 notas del usuario |
| P0.4 | **Storyboard modo `consultar`**: `storyboard.html` (un still por beat a res completa con tiempo, texto, paleta, movimiento, transición, sonido) + `plan.md` editable + espera/reanudación y `consultar:{espera}`; escenarios G2/G3 | nada implementado; spec 022 §Storyboard | 1,5–2 sesiones; MVP (solo `autonomo` + generar stills y `plan.md`) 0,5 |
### P1 (calidad y gusto)
| # | tarea | esfuerzo |
|---|---|---|
| P1.1 | **Registro de gramáticas** `data/entregas.json` (paleta, medio, tipografía, sonido, transición clave por entrega) + veto «ya lo hicimos» en el encargo (ver propuesta 1) | 0,5 sesión |
| P1.2 | **Panel con contexto comparativo** y criterio nuevo «interés/riesgo/delight» + ranking relativo (§3.4) | 1 sesión |
| P1.3 | **Aflojar o parametrizar las reglas que producen slop**: ocupación 30 % con excepción por `aire:{porque}`; cifras del brief como rangos «a elegir y registrar» (ver §2.2) | 0,5 sesión |
| P1.4 | **Ampliar kit y brief con 2–3 gramáticas alternativas** (neón sobre ladrillo, pizarra, recorte/collage, tipografía cinética; el motor viejo ya hizo neón y pizarra, N13, N18). Ahora el kit solo habla papel | 2 sesiones |
| P1.5 | `ver vídeo`: el panel debe recibir un fotograma a 25 fps en las transiciones y la forma de onda de audio (no solo curva ASCII) | 1 sesión |
| P1.6 | Producir **1–2 films v6 nuevos de tema distinto** (no botellas, no matemática) para probar generalización y obtener notas fuera de muestra | 2 sesiones |
### P2
- Voz de calidad (piper es-ES; N20 «la voz fuera, terrible»), verificar Kamiokande-II de Veinticuatro (ROADMAP §8 E2),
  eval ciega del toolbox, G5 (`gusto.mjs nota` ya existe), CI/push (solo con confirmación), refresco de `STATUS.md` y docs.
  Esfuerzo total P2 ≈ 2 sesiones.
### Riesgos
1. **Optimizar el panel y no el gusto (Goodhart):** el productor aprende a cumplir criterios; spec 013 ya lo vio con arc.mjs.
2. **Juez con verdad de campo pobre:** 4 notas numéricas; el usuario sigue siendo la única señal fiable (la «nota opcional»
   no debe volverse «innecesaria»).
3. **Autonomía total sin freno de gusto → monocultura** (§2): sin P1.1/P1.4, el sistema autónomo produce lo mismo cada vez.
4. **Coste:** panel de 3 miradas × 2 rondas + storyboard + producción libre supera los 200 k tokens/film de spec 022 (Botella libre
   v1 ya costó 178 k solo en producción). Medirlo en el primer film v6.
5. **Dependencia del Sonnet libre:** Haiku con brief+kit da «correcto pero sin ambición» (spec 022): `hoja:botella_v3_haiku_kit`
   (forma blanda, texto pequeño en rojo, esfera lisa) vs `hoja:botella_aislada`. El kit no sustituye al modelo.
6. **Integración:** `npm test -- --full` tarda ≈ 785 s y es sensible a la carga (HANDOFF); corre una a la vez.

## 5. Tres propuestas para que sea interesante y agradable, no solo correcto

### Propuesta 1. «Pliego de condiciones de sorpresa» por pieza (diversidad obligatoria)
Antes de producir, el orquestador genera un **pliego** (≈ 15 líneas) que el productor debe cumplir y el panel auditar:
- **Veto del registro** (`data/entregas.json`, nuevo): paleta dominante, medio, fuente, familia sonora, transición estrella de
  las últimas 3 entregas. El pliego prohíbe repetir ≥ 2 de esas 5 dimensiones. Medible: distancia de color OKLab entre
  paleta dominante de la candidata y la de las últimas 3 ≥ umbral; mismas fuentes = veto.
- **Un medio distinto obligatorio** de una lista de ≥ 6 (papel/acuarela, grafito sobre cuaderno, neón sobre ladrillo, recorte/
  collage, grabado/linograbado, proyección de retroproyector, tipografía cinética, plano 3D simple) — elegido por el tema y por el
  veto; **el `porque` debe nombrar el tema** (spec 012 ya lo exige, solo falta forzarlo).
- **Una referencia externa nueva por pieza**: 1–2 URLs/obras con 3 observaciones concretas (qué hace con la luz, el borde, el ritmo) y 1 cosa que se **roba** y 1 que se **evita** (spec 003 hizo esto una vez con 4 posts de X; hoy no se repite).
- **Prohibido copiar la plantilla**: el productor no recibe `plantilla/frame.js` completo, solo las piezas del kit; la plantilla
  deja de ser ejemplo único.
Coste ≈ 0,5–1 sesión (P1.1 + pliego). Éxito: 3 films seguidos con distancia de gramática > umbral y nota ≥ 8 en ≥ 2.

### Propuesta 2. «Una rareza deliberada» + «un momento memorable» como entregables, no como esperanzas
La voz (H05, ausente en las notas) y lo memorable se piden pero nunca se construyen. Cada film declara en `plan.md`:
- **Una rareza** (imperfección con intención): p. ej. un error corregido a mano en pantalla, un objeto que no encaja, un chiste de
  rotulación, un material que se rompe una vez (en Botella v1, el sello PAGADO tapando «Se debe un chelín» es justo eso);
- **Un momento en 3 s que se recordaría** con su gesto, su sonido y su luz y **sin texto**, anclado a un instante del timeline que
  la auditoría verifica (existe un evento visual y uno sonoro a ≤ 2 fotogramas, S02). Equivalente a la regla «un pico» pero sobre
  el gesto y no sobre la actividad.
- **Contención como regla estética**: añadir a gusto.md **R-aire**: en al menos una escena, el sujeto ocupa < 20 % y el
  resto es soporte vivo (Mate papel). Cambiar la auditoría de ocupación a «≥ 30 % salvo `aire` declarado con `porque`», no «≥ 30 %
  siempre». Evita el póster (§1.4).
- **Lista de rótulos de interfaz prohibidos** (botón, cursor, ventana, barra, tarjeta con sombra de app, cápsula blanca de mapa):
  el escéptico las busca por nombre (sale en `botella_libre_v2`). Coste ≈ 0,5 sesión y 5–8 líneas en gusto.md.

### Propuesta 3. Juez en dos tiempos: filtro de mínimos + torneo de 3 candidatas
- **Fase 1 (filtro, barato, Haiku/auditoría):** sin clip-art, sin negro vacío, sin texto ilegible, sin rótulos de interfaz,
  true peak, determinismo. Suspender o pasar. No puntúa gusto.
- **Fase 2 (torneo, Sonnet con visión):** el productor genera **3 variantes de la escena o del film más importante** (p. ej. tres
  maneras de la escena del giro, con medios o acentos distintos, 6–10 s a baja resolución, coste ≈ 1/10 del film) y el panel las
  **ordena por pares** («cuál es más interesante, cuál tiene más voz») viendo las **últimas 3 entregas** al lado para que
  «genérico» tenga sentido. Gana la mejor; se produce solo esa. Es el esquema que ya funcionó informalmente (A/B de acentos
  violeta/ciruela/terracota, N14; A/B de medios, N13).
- **Nota humana opcional pero barata:** un botón de preferencia de 10 s sobre las variantes (par A/B), que alimenta `gusto.mjs
  nota` automáticamente. El usuario no tiene que puntuar 0–10 todo; elegir A/B es más fiable que una nota (4 numéricas en
  20 notas lo demuestra).
Coste ≈ 1,5 sesiones (P1.2 + torneo). Éxito: Mate papel gana siempre su torneo contra su versión negra; el juez deja de comprimir
el rango (media de rangos, no de puntos).

## 6. Siguiente paso recomendado (orden)
1. Merge de `gusto` + suite `--full` (P0.2). 2. Lote 2: ojo + escéptico por ranking relativo (P0.3). 3. Pliego + registro
(P1.1/Propuesta 1) antes de producir el próximo film. 4. Storyboard MVP (P0.4) en paralelo. 5. Un film v6 de tema nuevo con medio
distinto y 6 notas A/B del usuario para ver si el sistema, no solo el modelo, genera algo que se recuerda.

## Anexo: evidencia consultada
CLAUDE.md; docs/specs/022-estudio-v6.md; docs/current/MODO-LIBRE.md (204 l.); kit-libre/README.md, muestra.jpg; docs/ROADMAP.md §8; docs/HANDOFF.md;
data/notas.json (N01–N20); docs/specs/001/003/012(Lección)/013; worktree gusto: data/gusto.md, docs/handoff/gusto.md,
data/calibracion.json; out/panel/calibracion-resultado.json, calibracion-mapa.json, calibracion2-mapa.json,
calibracion2-veredictos/director.json; hojas: botella_aislada, botella_libre_v2, botella, botella_v3_haiku_prompt,
botella_v3_haiku_kit, consta, ab_mate, neon. No vi: veinticuatro, fondos_libres, vectores, diagramas (no cambia las conclusiones;
revisar si P1.4 se apoya en ellos). Los cálculos de Spearman del director del lote 2 son míos (scipy) sobre `calibracion.json`.
