# Modo libre v2: brief para un agente motion designer aislado

**Origen.** Experimento del 2026-10-11. Un agente Sonnet sin acceso al repo hizo Botella con `frame(ctx, t)` libre en
≈20 min y 178 000 tokens, y el usuario lo calificó de "genial". El mismo film con el motor completo pasó de 500 000
tokens y quedó peor.

Este brief traslada el GUSTO y los CONTROLES de opus-studio (specs 001–003, 005, 012 y 013, docs/research/12 sobre
Anatomy) sin obligar al agente a aprender el motor. Está escrito para que también lo siga un modelo pequeño: pasos
numerados, cifras concretas y una verificación en cada paso. Para usarlo, cópialo y añádele la sección «Historia» del
film.

---

## 0. Reglas de juego
- **Nada aleatorio no reproducible.** Cada fotograma es `frame(ctx, t)`, una función PURA de t, sin estado entre
  fotogramas. Usa un PRNG con semilla (p. ej. mulberry32) y nunca `Math.random` ni `Date`.
  - Las cachés solo guardan texturas o geometría deterministas.
  - El grano usa como semilla el índice de fotograma.
- **Una sola fuente de tiempos.** `timeline.js` exporta escenas `{id, t0, dur}` y eventos `{t, tipo, …}`. Imagen y
  sonido leen de ahí.
- **Las cifras reales en `hechos.js`.** Los textos y los movimientos salen de esos datos.
- **Bitácora.** Lleva `log.md` y ejecuta `date` al empezar y al terminar cada paso. Si un paso dura más del doble de su
  cuota, recorta alcance y anótalo.

- **La estructura sugerida del encargo es una GUÍA de contenido, nunca texto de pantalla.** Los textos en pantalla
  los escribes tú, con voz propia; no copies frases del encargo («Pronto: …», «Estructura…») tal cual.
- **Las cifras de este brief son puntos de partida, no fórmulas.** Varíalas según la pieza. Si todas las piezas salen
  con los mismos números, todas se parecen.

## 0b. Pliego de sorpresa (antes del plan)
1. Lee `data/entregas.json`, si te lo dan: las últimas entregas con su paleta, medio, tipografía, sonido y estructura.
   **No repitas 2 o más de esos 5 rasgos de ninguna de las 3 últimas.** Anota en `plan.md` los 5 rasgos de la tuya.
2. Elige el **medio** por el tema, no por costumbre (papel, tiza, neón, grabado, collage, cianotipia, tinta china,
   luz sobre negro, etc.). El `porque` nombra el tema; «para que se vea bonito» no vale.
3. Escribe una **referencia** (una obra, un oficio o un objeto real) y anota qué tomas de ella y qué evitas.
4. Decide una **rareza deliberada**: algo pequeño que nadie pediría y que vuelve la pieza única (un tic del objeto,
   un error que se queda, un sonido fuera de lugar).
5. Decide el **momento memorable**: unos 3 s sin texto donde gesto, sonido y luz coinciden (a ≤ 2 fotogramas).

## 1. Plan (cuota ≈ 10 % del tiempo) → `plan.md`
1. Escribe una frase con el objeto ancla: qué objeto es, qué se mueve y qué significa ese movimiento. **El objeto es la
   explicación.** Nada de cajas y flechas.
2. Haz una tabla por escena con:
   - inicio y duración;
   - objeto protagonista;
   - movimiento y su física (peso, flotación, inercia);
   - fondo y color (con su valor hex);
   - transición de salida y el objeto que la motiva;
   - sonidos;
   - texto exacto.
3. Haz una lista de piezas por objeto principal, con al menos 8–15 piezas pequeñas. Por ejemplo, para una botella:
   cuerpo, hombro, cuello, labio, corcho, lastre, tarjeta enrollada, burbuja, reflejo, sombra de contacto y algas
   adheridas. Cada pieza apoya en otra.
4. Comprueba el ritmo y la composición:
   - Las duraciones son irregulares: coeficiente de variación ≥ 0,3.
   - Hay UN pico claro.
   - Hay al menos un respiro de ≥ 4 s en el que casi nada pasa.
   - El giro de la historia se marca con un cambio de color o de luz.
5. **Verificación:** calcula el coeficiente de variación y anótalo. Ninguna escena puede durar menos de 2 s salvo un
   golpe buscado.

## 2. Esqueleto técnico (≈ 10 %)
- **Archivos:**
  - `timeline.js`;
  - `hechos.js`;
  - `lib.js`: PRNG, ruido de valor/fbm, easing, muelles, utilidades de texto;
  - `escenas/*.js`: una por escena, cada una con `draw(ctx, lt, u, G)`, donde `lt` es el tiempo local y `u` el
    progreso de 0 a 1;
  - `frame.js`: elige la escena, pinta el fondo, la escena, la transición y la post (viñeta y grano);
  - `render.js`: reparte porciones en N procesos, con N = número de núcleos menos 1;
  - `audio.js`;
  - `still.js` y `hoja.py`.
- **Render.** Cada proceso escribe RGBA crudo en la entrada de un `ffmpeg -f rawvideo` que codifica su porción; luego
  se concatenan las porciones y se añade el audio con `-c:v copy`.
- **Rendimiento:** objetivo ≤ 0,5 s por fotograma.
  - Calcula los campos de ruido a ¼–⅛ de resolución y escálalos.
  - Precalcula lo estático una sola vez por escena, guardado en un canvas en caché.
  - Nada de bucles por píxel a resolución completa en cada fotograma.
- **Verificación:** renderiza 3 fotogramas dos veces y compara su md5. Tienen que coincidir.

## 3. Materia y fondo: recetas que funcionan
- **Papel:**
  - base de color con fbm a ⅛ de resolución en `multiply` y alfa 0,15–0,3;
  - 200–600 fibras cortas, curvas y finas con alfa 0,04;
  - viñeta suave;
  - sombra de contacto bajo los objetos apoyados.
- **Acuarela:**
  - polígono base deformado recursivamente (subdivide cada arista y desplaza el punto medio con ruido gaussiano, 4–6
    niveles);
  - 25–40 capas a alfa 0,02–0,05, cada una deformada de nuevo;
  - borde más oscuro (stroke del contorno a alfa 0,1) y granulación (moteado multiplicativo).
  - Esto lava de verdad; un relleno plano no.
- **Agua o turbiedad:**
  - degradado vertical;
  - 2 capas de fbm que derivan a distinta velocidad (parallax);
  - partículas en suspensión con 3 tamaños y velocidades;
  - cáusticas como suma de 3–4 senos en líneas finas con `screen`, solo cerca de la superficie.
- **Vidrio:**
  - cuerpo semitransparente (alfa 0,35–0,55) con degradado lateral, más oscuro en los bordes;
  - una franja de brillo vertical estrecha y una secundaria tenue;
  - lo que hay detrás se ve desplazado unos píxeles;
  - borde de grosor variable.
- **Tinta que corre:** la mancha crece con radio que sigue `1 − e^(−k·lt)`, borde irregular por ruido y halo claro de
  agua.
- **Metal y moneda:**
  - degradado radial anisótropo;
  - relieve como dos trazos desplazados ±1 px (luz y sombra);
  - canto estriado con líneas radiales;
  - desgaste: el relieve pierde contraste hacia el centro.
- **Cuerda y red:**
  - polilínea con catenaria;
  - grosor modulado por ruido (±25 %);
  - dos pasadas, sombra y luz;
  - nudos como pequeñas elipses en los cruces;
  - nunca una rejilla perfecta.
- **Grano de película:**
  - ruido a ½ resolución, sembrado por fotograma, en `overlay` con alfa 0,04–0,07;
  - más un leve parpadeo de exposición (±1,5 %).
- **Reglas del fondo:**
  - Nunca plano ni vacío.
  - Cambia con la historia: tono, luz y densidad por escena, con continuidad entre una escena y la siguiente.
  - Oscuro solo si el tema lo pide (noche, profundidad, cosmos), y entonces con profundidad.
  - Paleta propia; prohibido el dorado sobre azul noche.

## 4. Movimiento y cámara
- **Easing siempre.** Lineal solo en lo mecánico. Usa `easeInOutCubic`, `easeOutBack` (sobreimpulso 1,2–1,7) y un
  muelle amortiguado: `x(t) = 1 − e^(−ζωt)·cos(ω√(1−ζ²)·t)`, con ζ 0,3–0,6 y ω 6–14.
- **Peso.** Lo pesado arranca y frena despacio. Lo que flota oscila: amplitud 1–3 % del cuadro y periodo de 2–4 s.
- **Acción secundaria:** sombra, reflejo, algas, polvo.
- **Anticipación** antes de un gesto fuerte: un 5–10 % en sentido contrario.
- **Cámara:**
  - empuje lento del 2–6 % por escena;
  - microderiva de 0,3–0,8 % con ruido lento;
  - parallax en 3 planos (fondo ×0,3, medio ×0,7, sujeto ×1).
- **Desenfoque de movimiento** solo en movimientos rápidos: promedia 3–4 submuestras de t.
- **Que no todo entre a la vez.** Escalona de 80 a 200 ms entre elementos.

## 5. Texto y composición
- **Fuentes.** Ejecuta `fc-list` y elige del sistema una serif de libro para el cuerpo y, si hace falta, una
  mono/máquina para documentos. Regístralas en node-canvas.
- **Tamaños a 1080 px de alto:**
  - cuerpo de 34 a 44 px;
  - titulares de 72 a 120 px;
  - nada por debajo de 28 px.
- **Contraste:** al menos 4,5:1 contra lo que tiene detrás. Si no llega, pon detrás un velo suave.
- **Lectura:**
  - Margen seguro del 6 %.
  - En pantalla, como mínimo 1 s + 0,3 s por palabra.
  - Los contadores, con cifras tabulares: dibuja cada dígito centrado en una celda de ancho fijo.
- **Caja de cada texto.** Regístrala mientras se lee y comprueba que ningún objeto la invada (prueba de intersección en
  `still.js`).
- **Foco y orden:**
  - Un solo foco de atención por momento.
  - Jerarquía tonal: soporte bajo, estructura media, sujeto alto y UN solo acento de luz.
  - El sujeto, en sus planos de detalle, suele ocupar bastante cuadro (orientativo: 40–65 %).
  - **Aire:** al menos una escena deja mucho espacio vacío con intención (sujeto < 20 %). Un punto sobre una recta
    puede ser la mejor imagen de la pieza. Decláralo como `aire` (si usas la auditoría del kit: `ocupacion_ok:{porque}`).
- **Nada se desborda:** todo texto cabe en su contenedor (tarjeta, casilla, cartel) con margen. Un texto cortado o
  que se sale es un fallo, no un detalle.
- **El último texto** se lee completo y sin estorbos durante al menos 2 s.

## 6. Audio (sintetizado; sin voz ni TTS)
- **Cama** que no se corta nunca: agua o sala con ruido filtrado pasa-bajos y un LFO lento. Sin silencio digital, salvo
  un hueco buscado de menos de 1 s antes de un golpe.
- **Foley** salido de los eventos del timeline:
  - **gota:** seno de 1 200 a 400 Hz en 40 ms, con un clic de ruido;
  - **papel:** ruido pasa-banda con envolvente rápida;
  - **moneda:** 3–4 parciales inarmónicos con caída larga;
  - **sello:** golpe de 60 Hz con ráfaga de ruido.

  Cada sonido lleva fundidos de 5–10 ms y una variación de ±5 % de tono y ganancia entre repeticiones.
- **Música:**
  - Piano: suma de 6–8 armónicos, cada uno con su caída, más una desafinación de 1–3 cents y ruido de martillo.
  - Pocas notas y mucho espacio.
  - Entra en el giro y sale antes del cierre.
  - Baja 4–6 dB cuando suena un foley importante.
- **Reverb** por convolución con una IR sintética (ruido · e^(−t/τ)): τ 0,25 s bajo el agua, filtrada a grave; τ 0,8–1,2 s
  en espacios abiertos.
- **Máster:**
  - Limitador suave con techo a −3 dBTP.
  - Mide sobre el mp4 FINAL con `ffmpeg -i final.mp4 -af ebur128=peak=true -f null -`.
  - Objetivo: TP ≤ −1 dBTP, entre −19 y −16 LUFS integrados, LRA ≥ 6 LU.

## 7. Revisión (≈ 25 %, como mucho 2 rondas)
1. Haz stills a resolución completa a mitad de cada escena y en cada transición. Míralos TODOS como imágenes.
2. Haz primeros planos a 4× de juntas, bordes, texto y materiales.
3. Puntúa en `log.md` de 0 a 2 cada criterio. Cualquier 0 hay que arreglarlo:

   | criterio | pregunta |
   |---|---|
   | objeto | ¿se lee al instante como algo real y con materia, no como clip-art? |
   | fondo | ¿tiene textura, vida y evolución? |
   | texto | ¿se lee, nada lo tapa, cumple contraste y tamaño? |
   | ritmo | ¿hay respiro y pico? ¿las duraciones son irregulares? |
   | transiciones | ¿salen de un objeto? ¿hay costuras? |
   | 4× | ¿alguna línea acaba en el aire, algo atraviesa algo, hay una cara desnuda o una esquina vacía? |
   | verdad | ¿cifras, lugares y fechas salen de `hechos.js`? |
   | gusto | ¿tiene personalidad o parece una presentación corporativa? |
   | sorpresa | ¿se distingue de las últimas entregas? ¿están la rareza y el momento memorable? |
   | desborde | ¿algún texto se sale de su contenedor o aparece cortado? |
   | costuras | al desplazar o repetir algo (rejillas, mapas, fondos en mosaico), ¿se ve una junta, una cabecera duplicada o un salto? |
   | tapado | ¿algún texto o nota tapa datos que se están leyendo? |
4. Antes del render final, haz una previsualización a ¼ de resolución y 12 fps.

## 8. Entrega e informe
- **Entrega:**
  - mp4 final;
  - `hoja.jpg` con 12 fotogramas del mp4 final;
  - `plan.md`, `log.md` y el código.
- **Informe:**
  - tiempo total (desde `date`) y tiempo de render;
  - número de rondas;
  - líneas de código;
  - medidas de audio: I, TP y LRA;
  - determinismo: sí/no;
  - puntuaciones de la rúbrica;
  - qué quedó flojo, con honestidad.

## Prohibido
- Voz, narración o TTS.
- Moralejas finales y signos de exclamación.
- Caras en primer plano.
- Clichés de apertura («¿Qué pasaría si…?»).
- Fondos negros vacíos.
- Todo entrando a la vez con el mismo easing.
- Iconos planos de clip-art.
- Elementos de interfaz o de producto: botones, cursores, ventanas, pop-ups, cápsulas de mapa o rótulos de app,
  salvo que el tema sea la interfaz.
- Texto copiado del encargo o de la estructura sugerida.
- Mapas inventados a mano: usa coordenadas lat/lon reales, de 60 a 120 puntos por costa, con proyección simple.
