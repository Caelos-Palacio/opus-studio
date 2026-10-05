# Vídeo «Regla · lo que parecía daño era aprendizaje»

Salida: `out/regla.mp4` (no versionado). 60,03 s, 1280×720, 30 fps, h264 + aac, 1801 fotogramas, perfil `cinematic`, estilo visual `hierro`,
estilo sonoro `forja`. Se generó con `OPUS_TIMELINE=data/regla/regla.json npm run master` (sin `--force`).

## Concepto
Una criatura de placas bajo una rueda de 8 radios recibe cinco golpes y una ráfaga. Cada uno parece daño. El golpe final la borra, hay
silencio y vuelve intacta: se adaptaba. La memoria conceptual (`data/regla/memoria.json`) relee hacia atrás cada golpe como una lección y la
rueda como un contador. Un solo pico al 70 % y un hold de 4,4 s. Cierre abierto: «¿CÓMO SE LE GANA?». Todo es geométrico, sin personajes con
copyright. El brief completo está en `data/regla/brief.md`.

## Decisiones
- La memoria dirige la edición mediante la capa `data/regla/layers/memoria.json`, generada y comprobada con `memoria.mjs capa --check`.
  La fuerza de cada golpe escala por la cadena `escala`. El giro pide el eco de cada plano releído con fuerza = 1 − peso. El cierre rima con R01.
- Cortes que aceleran (de 6 a 1,4 s), un hold que vuelve a respirar y un pre-silencio antes de cada impacto: respuesta a la crítica de
  «monótono y apresurado».
- Color con función: rojo = golpe, oro = adaptación, hueso = mundo y tipo, acero = placas.
- `styles/sound/forja.json`: fa menor, tempo 44→152 bpm, armonía frigia, percusión pesada. Demuestra que un carácter sonoro nuevo es un JSON.
  Plan sonoro medido: golpe final en 41,6 s, hold 42,0–46,4 s, revelación en 47,2 s, retorno en 56,5 s.

## Cambios en el motor (2 mínimos, un mismo propósito)
- `engine/signal.mjs` (lista PARAM_TYPES) y `engine/params.mjs` (validador): nuevo tipo de parámetro `json` (objeto o lista sin enlaces). Los callbacks eco/rima de la memoria
   son listas de `{ref, concepto}` y ninguno de los 6 tipos existentes las admitía. `params.mjs` añade el `case 'json'` al validador de tipos.
- Aparte, `shots/R14.mjs`: el texto del cierre se subió a y = 0,955 porque el lint lo marcaba sobre el foco «criatura» (cambio de shot, no del motor).

## Bugs del motor encontrados (no corregidos)
- `filmKey()` (`engine/verdict.mjs`) devuelve `main` para cualquier timeline llamado `timeline.json`. `data/regla/timeline.json` colisionaba
  con el demo: `out/lint/main` mezclaba veredictos. Solución aplicada: renombrar a `data/regla/regla.json`. Arreglo propuesto:
  usar el directorio padre cuando el basename es `timeline` y la ruta no es `data/timeline.json`.
- `arc.mjs` solo busca `data/story.json` por defecto cuando el timeline es el del demo. Con otro timeline hay que pasar `--story data/regla/story.json`
  o declarar `story` en el film. Sin ello solo avisa y se salta el arco.
- `memoria.mjs lint` y `capa --check` necesitan `--mem data/regla/memoria.json`; sin él comprueban la memoria por defecto.

## Lint (SHIP, 12 avisos, 0 FIX)
Las causas de los falsos positivos están inferidas del diseño de los shots, no verificadas fotograma a fotograma.
El único FIX inicial (R14, texto sobre foco) se corrigió moviendo el texto. Quedan:
- WARN «el ojo va a otro sitio» en R05 (50 %) y R11 (24 %): falso positivo. En R05 el contraste secundario es el destello del golpe y en R11 el
  barrido de la hoja es lo que se quiere mirar durante el pico; ambos son foco dramático deliberado, no un secundario por error.
- WARN «sujeto casi invisible en grises» en R07 (Δ 0,29 frente a 0,30) y R11: falso positivo. La criatura se separa por matiz (hueso sobre acero con
  oro/rojo) y por una caída intencionada de valor en el borrado y la penumbra. El umbral se roza, no se incumple de verdad.
- WARN «pop» en R02, R05, R07 y R11 (energía 8–16× la mediana local): verdadero pero intencionado. Son los impact frames de los golpes, que se
  quieren secos; suavizarlos iría contra el pre-silencio y el impacto.
- WARN «corte en el reposo» en R07 (30,40 s): falso positivo. Es el hold-cut tras la ráfaga, que cae a propósito justo cuando la acción acaba.

## Arco y memoria
- `arc` SHIP, 89/100: pico 70 % (41,75 s), calma previa 0,59×, final 0 % del pico, hold junto al pico 0,92 s.
- 11 WARN «impacto lejos del pico»: falsos positivos por diseño. El esquema son cinco golpes que escalan con un único pico (el golpe final); los
  impact frames anteriores son los golpes que construyen el crescendo, no picos rivales.
- `memoria lint`: PASS, sin avisos. Capa al día.

## Sonido
Generado con `node engine/sound.mjs --mix` (79 eventos, música `generativa:forja`) y masterizado dentro de `npm run master`.
- Engine: integrado −14,03 LUFS, LRA 14,5 LU, TP −2,26 dBFS (mezcla WAV).
- Medido con ffmpeg `ebur128` sobre el mp4 final: −14,2 LUFS, LRA 14,1 LU, true peak **+1,2 dBFS**. El AAC reintroduce sobrepico respecto al WAV;
  es una limitación de la cadena de mux y conviene bajar el techo de master unos 3 dB si se publica.

## Qué funcionó y qué falló del sistema
- Funcionó: un estilo visual y uno sonoro nuevos son solo JSON; la memoria dirige parámetros por capa sin tocar shots; el lint cazó un problema
  real de composición (texto sobre foco); el render salió a la primera (14 fragmentos, ~64 s de pared con caché fría).
- Falló: `filmKey` con timelines no estándar, el descubrimiento de `story.json` y `--mem` (ver arriba), y el sobrepico del AAC.

## Tiempos
Lint completo ≈ 52 s · arc ≈ unos segundos · mezcla ≈ 21 s · master (render + mux) ≈ 64 s.
