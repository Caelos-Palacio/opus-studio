# Modo libre: brief para un agente motion designer aislado

Origen: experimento del 2026-10-11. Un agente Sonnet sin acceso al repo hizo Botella con `frame(ctx, t)` libre en unos 20 min
y 178 000 tokens. El usuario lo calificó "genial". El film equivalente con el motor completo superó los 500 000 tokens.
Este brief traslada el GUSTO y los CONTROLES de opus-studio (specs 001–003, 005, 012, 013) sin obligar al agente a
aprender el motor. Se copia tal cual y se le añade la sección «Historia» de cada film.

---

## Marco técnico
- Formato: 1080×1080 (o el que pida la historia) a 30 fps, mp4 H.264 + AAC.
- Cada fotograma es `frame(ctx, t)`, una función PURA de t, sin estado entre fotogramas.
  - Las cachés solo se permiten para texturas deterministas.
  - El ruido usa semillas fijas. El grano usa una semilla derivada del índice de fotograma.
  - Prohibidos `Math.random` y `Date`.
- Render por porciones en paralelo, una por núcleo, con node-canvas → ffmpeg. Después se concatena y se añade el audio.
- Una sola fuente de tiempos (`timeline.js`): escenas, eventos de objetos y eventos de sonido salen del mismo sitio.
- Determinismo verificado: renderiza dos veces 3 fotogramas cualquiera y compara el hash. Tiene que coincidir.

## Método (por orden, sin saltarse pasos)
1. **Plan en tabla antes de escribir código.** Por cada escena:
   - inicio y duración;
   - objeto protagonista;
   - qué se mueve y con qué física;
   - fondo y color;
   - transición de salida y qué objeto la motiva;
   - sonidos;
   - texto exacto.

   Reglas del plan:
   - Las duraciones son irregulares, con un coeficiente de variación ≥ 0,3.
   - Hay UN pico claro y al menos un respiro largo donde casi nada pasa.
   - El giro de la historia lo marca un cambio de color o de luz.
2. **Boceto.** Stills a resolución completa en los instantes clave (mitad de cada escena y cada transición), más una
   previsualización a ¼ de resolución y 12 fps. Mira los stills como imágenes antes de seguir.
3. **Revisión con la lista de control** (abajo). Corrige y repite como mucho 2 rondas.
4. **Render final.** Luego hoja de contacto de 12 fotogramas y medida del audio SOBRE EL MP4 FINAL.
5. **Informe:**
   - tiempos (trabajo y render);
   - rondas;
   - líneas de código;
   - medidas de audio;
   - qué quedó flojo, con honestidad.

## Lista de control visual
- **Fondo.** Nunca plano ni vacío. Lleva textura (papel, fibra, grano, acuarela, agua) y una vida sutil: deriva, luz que
  respira, partículas.
  - El fondo CAMBIA con la historia: color, luz y densidad por escena, con continuidad entre una y otra.
  - Un fondo oscuro solo cuando el tema es noche, cosmos, profundidad o luz, y siempre con profundidad (niebla, partículas,
    viñeta, parallax).
- **Paleta.** Propia del tema. Prohibido el dorado sobre azul noche. Gradación de color por escena.
- **Texto.**
  - Tamaño mínimo: cuerpo ≥ 3,2 % de la altura del cuadro; titulares mucho mayores.
  - Contraste ≥ 4,5:1 con lo que tiene detrás.
  - Margen seguro del 6 %.
  - Tiempo en pantalla ≥ 1 s + 0,3 s por palabra.
  - NADA se superpone a un texto que se está leyendo; reserva su caja.
  - En los contadores, cifras tabulares (ancho fijo) para que nada baile.
  - Una idea por momento: un único foco de atención.
- **Movimiento.**
  - Easing siempre; lo lineal, solo en lo mecánico.
  - Anticipación, sobreimpulso y asentamiento, y acción secundaria (lo que cuelga, lo que flota, la sombra).
  - El peso se nota: lo pesado tarda en arrancar y en frenar; lo que flota oscila amortiguado.
  - Cámara con microderiva y parallax en 2–4 planos de profundidad. Para movimientos rápidos, desenfoque de movimiento
    barato: promedia 3–4 submuestras de t solo en esos tramos.
- **Materia.**
  - Acuarela con borde más oscuro, granulación y lavado desigual. Papel con fibra y sombra de contacto.
  - Vidrio con reflejo y refracción falsa (desplazamiento de lo que hay detrás).
  - Tinta que corre con difusión.
  - Grano de película sutil y animado.
  - Redes, cuerdas y telas con irregularidad: nada geométrico perfecto.
- **Precisión.** Si sale un mapa, se dibuja a partir de coordenadas reales (lat/lon, 60–120 puntos por costa) con una
  proyección simple. Los lugares van en su posición real.
- **Transiciones.** Motivadas por un objeto o un gesto: la gota que abre otra escena, el papel que se desliza, el agua que
  sube. Sin fundidos genéricos y sin costuras visibles entre hojas o planos.
- **Final.** Seco y limpio. El último texto se lee completo y sin obstáculos durante ≥ 2 s.

## Lista de control de audio (sintetizado, sin voz ni TTS)
- **Cama de ambiente** siempre presente (agua, sala, papel). Sin silencio digital, salvo un silencio buscado y breve antes
  de un golpe.
- **Foley sincronizado** con los eventos del mismo timeline: gota, papel, clic, moneda, golpe.
  - Fundidos de 5–10 ms para evitar clics.
  - Variación ligera entre repeticiones del mismo sonido.
- **Música.** Pocas notas, con timbre cálido (piano o cuerda sintetizados con envolvente y armónicos, nada de ondas
  cuadradas crudas). Entra en el giro y se retira antes del cierre. Ducking cuando suena un foley importante.
- **Espacio.** Reverb sencilla por convolución, con una respuesta al impulso sintetizada (ruido con caída exponencial), y
  distinta por escena: bajo el agua, apagada y grave; en la playa, abierta.
- **Medidas sobre el mp4 final:**

  ```
  ffmpeg -i final.mp4 -af ebur128=peak=true -f null -
  ```

  Objetivos:
  - true peak ≤ −1 dBTP; deja el máster en ≈ −3 dBTP, porque el AAC sube el pico;
  - sonoridad integrada entre −19 y −16 LUFS;
  - LRA ≥ 6 LU (la dinámica es parte del arco).

## Prohibido
- Voz, narración o TTS.
- Moralejas finales y signos de exclamación.
- Caras en primer plano.
- Clichés de apertura del tipo «¿Qué pasaría si…?».
- Fondos negros vacíos.
- Animación «de presentación corporativa»: todo entrando a la vez con el mismo easing.
