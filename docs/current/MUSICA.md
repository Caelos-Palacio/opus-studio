# Soundtrack como sistema (música + diseño sonoro + mezcla)

Spec: `docs/specs/002-soundtrack.md` · tests: `test/sound.mjs` (15 medibles sobre el audio generado) · estilo: `styles/sound/epico.json`.
Todo es Node puro, determinista (ruido sembrado por evento), 48 kHz estéreo, sin dependencias nuevas.

```
timeline.sound = { "style": "epico", "memoria": "data/stress/memoria.json", "overrides": { … } }   // activa el sistema (sin `sound`, sigue el v1)
OPUS_TIMELINE=data/stress/potencias.json node engine/sound.mjs --mix                // data/mix-potencias.wav + out/sfx-potencias.json
OPUS_TIMELINE=data/stress/potencias.json node engine/sound.mjs --mux <video.mp4> --out out/potencias_v2.mp4   // solo cambia el audio (-c:v copy)
node engine/score.mjs --timeline X [--memoria Y] [--style epico] --wav out/score.wav --json out/score.json    // solo la música + la partitura
node test/sound.mjs [--fast] [--legacy]                                              // --fast: Potencias ×0,6 · --legacy: mide el v1 (el "rojo")
```
`npm run master` (`cut.mjs`) usa la mezcla v2 tal cual (no vuelve a pasar `loudnorm`, que con LRA objetivo 7 la comprimiría).

## Arquitectura

| módulo | qué hace |
|---|---|
| `engine/dsp.mjs` | filtros RBJ, reverb, **sonoridad BS.1770** (integrada, short-term, LRA, true peak ×4), limitador de ladrillo con true peak, WAV |
| `engine/score.mjs` | `analyzeFilm` (plan) → `composeScore` (partitura) → `renderScore` (bus de música) |
| `engine/sounddesign.mjs` | `designEvents` (declarados + derivados) → `renderEvents` (buses `sfx`, `hit`, `amb`) |
| `engine/mixer.mjs` | `mixdown`: vacío, cola/silencio, sidechain por banda y prioridad, EQ, master a −14 LUFS |
| `engine/sound.mjs` | `build(tl)` orquesta; `mix`/`ensureMix` escriben el wav; `mixHash` sella entradas (timeline + **estilo + memoria por contenido** + cierre de imports) |

## 1. Partitura generativa (`score.mjs`)
Nada se escribe por film: todo instante sale del timeline y todo parámetro musical del estilo JSON (en fracciones del film, así que un film
más corto o más largo se reescala solo; el test lo comprueba con una perturbación ×0,6).

- **Estructura** (`analyzeFilm`): `hit` = impacto declarado de mayor ganancia (o el pico de `arc` si no hay, o una fracción del film);
  `hold` = `hold_ok` que sigue al golpe (si no, ventana del estilo); `rev` = sfx `rev` o la reinterpretación de la memoria; `ret` = último plano;
  secciones intro · exposición · construcción · crescendo · vacío · golpe · silencio · revelación · descenso · regreso. La curva de intensidad
  `I(t)` sale de esas secciones (+ la energía de `arc` si se aporta `opts.energy`, + la saliencia del concepto que provoca el giro).
- **Tempo**: la rejilla se construye **hacia atrás desde el golpe** (un pulso cae exactamente en `hit`); `bpm` va por puntos `[fracción de tiempo
  hasta el golpe, bpm]` del estilo (54 → 76 → 132, la última rampa con curva). Es el "beat de tensión" de la PoC, ahora parametrizado.
- **Armonía**: cifrado romano en el estilo (`i bVI iv V` → el golpe en `bVI/i` que no resuelve → la revelación en `I` mayor ancho). `chordNotes` voicea
  por intensidad (más capas = más intensidad).
- **Leitmotiv por concepto de la memoria**: cada concepto tiene un motivo derivado del hash de su id (contorno + ritmo, determinista). El concepto
  principal (`planta`, mayor saliencia) crece hacia el golpe (diminución, +3, +7 semitonos). Cuando un giro reinterpreta un concepto
  (`reinterpretaciones[].objetivo`), **su motivo reaparece transformado en `en`**: modo mayor + la bajada se despliega en subida (+ octava; en una
  `regla`, además acelerado y trepando en secuencia). El peso de memoria (`peso`) escala su volumen. Sin `memoria.json` se usa un único motivo `tema`.
- **Capas por intensidad** (umbrales en el estilo): drón → pad → bajo → pulso/arpegio (4 pasos de densidad creciente) → bombo → hats/toms → redoble
  acelerado y riser de ruido; metales y coro en el golpe y la revelación. Reverb por tramo: la cola **no cruza** el vacío.

## 2. Diseño sonoro (`sounddesign.mjs`)
Eventos = `shot.sfx` declarados + derivados: whoosh en cada transición, golpe seco en cada corte, acento en `on_beat_at` sin sonido, `bloom` en cada
giro de la memoria, `resolve` al final de un riser sin resolución y una **cama de ambiente por plano** (`air`; los `drone` declarados son la cama grave).

- **Impacto en capas**: suck-back (barrido que se cierra) → **vacío de 0,6 s** (el mixer lo vacía de verdad) → transitorio + cuerpo + sub-drop (27 Hz) +
  brillo + retumbo de cola (4,5 s). Sincronía medida: 0,4 fotogramas.
- **Whoosh ∝ velocidad** de escala/cámara: velocidad = salto de plano + décadas/s (si el texto declara `10^a–10^b`) + cámara; sube nivel, brillo y
  acorta la duración; el paneo se mueve según el sentido del salto.
- **Tics del ×10**: cada racha asciende por la escala pentatónica del estilo; nivel y brillo siguen `I(t)`; tono, caída y brillo sembrados por evento
  (nunca dos iguales seguidos).
- **Risers que resuelven** (pila tonal que sube una octava hasta la tónica) y ambientes por escala: CU cálido e íntimo → EWS amplio y frío con destellos.

## 3. Mezcla y master (`mixer.mjs`)
Buses `música · sfx · hit · ambiente`; **vacío** y **cola/silencio** estructurales; **sidechain por banda (graves/medios/agudos) y por prioridad**
(`duckDb` por prioridad × peso de banda del evento; el golpe cede solo los graves para que el acorde cante por encima del sub); bolsillo de EQ
−2 dB a 3 kHz en la música, HP 90 Hz en sfx, LP 6 kHz en ambiente; macro-dinámica de `I(t)` también sobre sfx y ambiente; HP subsónico a 32 Hz;
master a −14 LUFS integrados bajo limitador con **pico verdadero** (techo −2 dBTP: el AAC a 256 kb/s añade ~0,5 dB).

## Medidas finales (Potencias, `node test/sound.mjs`)
Ver la tabla rojo → verde en `docs/specs/002-soundtrack.md`. mp4 entregado (`out/potencias_v2.mp4`, AAC 256 k): −14,2 LUFS · LRA 9,2 LU · TP −1,7 dBFS.

## Para otro film
Basta el timeline (impacto, `hold_ok`, `rev`, `motifState`, `transition_out`, `size`, `cam`) y, si se quiere leitmotiv, una `memoria.json`; el carácter
lo pone `styles/sound/<estilo>.json` (clave, tempo, armonía, capas, motivos, vacío, prioridades, master). Un estilo nuevo es un JSON, no código.

## Historia
La PoC (rama del film de estrés, nota 6–7: "el beat de tensión funciona; falta refinar y sistematizar; mejora TODO el soundtrack") era un
script con constantes por film (armonía, motivo, curva I(t), tiempos 63/66,5/69…) y sfx planos bajados 17 dB. Este documento describe su sustituto.

## Límites conocidos
- Síntesis aditiva/FM simple: suena a "banda sonora sintética" de calidad media; falta convolución (reverb real), muestras y humanización.
- Densidad rítmica medida sobre la **partitura** (el onset por envolvente no es fiable con texturas densas y sintéticas); brillo y sonoridad, sobre el audio.
- Un solo estilo (`epico`) y un solo film calibrado; los umbrales son priors hasta que las notas del usuario los recalibren (spec 002, Calificaciones).
- `--fast` usa Potencias comprimida ×0,6 y exige LRA ≥6 (la ventana de 3 s pesa más en un film corto); el film completo exige ≥8.
