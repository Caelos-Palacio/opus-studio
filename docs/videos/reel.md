# Reel «Pulso» — ¿Qué suena cuando todo se rompe?

Master: `out/reel.mp4` (no versionado). 1080x1920 (9:16), 30 fps, 30,0 s, H.264 + AAC 48 kHz estéreo.
Se reproduce con: `node data/reel/build.mjs` (timeline desde la rejilla) → `node engine/grid.mjs` → lint/arc/memoria/sonido/master con `--timeline data/reel/timeline.json`.

## Concepto
Tipografía cinética de un mensaje corto: una pregunta que se rompe en ruido, se engancha a una rejilla de tempo (secuenciador), se tensa, estalla en un golpe (impact frame) y se recompone como respuesta.
Arco: pregunta (0-5 s, 97,7 bpm) · ruido fuera de compás (5-10 s) · enganche a rejilla y cuenta atrás de filas (10-18 s, el tempo acelera a 117 bpm) · crescendo y aire retenido (18-22 s, 136,8 bpm) · golpe en 22,0 s · respiro (22,9-24,2 s) · recomposición «LO ROTO VUELVE A SONAR» y punto de cierre que rima con la ¿.
Acento lima = el pulso y la respuesta; magenta = la rotura.

## Decisiones
- La música manda: `data/reel/build.mjs` declara los 24 shots en PULSOS (índices de `beats` en `data/reel/audio.json`), no en segundos. Cortes cuantizados al fotograma posterior al pulso (el sonido nunca llega después de la imagen).
- Tempo con rampa (97,7 → 136,8 bpm) para que el crescendo se sienta; el golpe cae en un pulso de la rejilla y el regreso, 2,19 s después, en otro.
- Ritmo de cortes variado (0,4 a 2,5 s): ráfaga de palabras sueltas al principio, ritmo regular durante el secuenciador, aceleración TODO / SE / ROMPE, silencio de K17 y respiro de K19.
- Señales enlazadas a parámetros: kick/snare/hat/tom (envolventes de las pistas de audio por instrumento), `chaos`, `lock`, `tension`, `shock`, `drift` (lfo), `nivel` (rms). Cada fila del secuenciador reacciona a su instrumento.
- Sonido: estilo `electro` con la memoria conceptual `data/reel/memoria.json` (leitmotiv que reaparece transformado tras la reinterpretación); vacío (`impact.vacuum`) calculado desde la rejilla.
- Transiciones: todo corte duro; hero solo en K18, simple en el vacío/respiro/cierre.

## Qué del sistema funcionó
- Rejilla de tempo (`engine/grid.mjs`) + timeline generado: el cambio de un golpe o de estilo sonoro se propaga rehaciendo `grid` y `build`; imagen y audio no se desincronizan (impacto a 0 fotogramas del transitorio).
- Lint de arco (arc 98/100): pico 14,75x la mediana en 22,08 s (74 %), calma previa 0,48x, final al 7 % del pico, 1 solo pico, hold de 0,33 s junto al pico.
- Memoria lint PASS; `npm test -- --fast` verde (52 s) tras los cambios del motor (incluye los 15 medibles de sonido).

## Qué falló o costó
- Todas las herramientas leen por defecto el film demo (`data/timeline.json`, `data/story.json`, `data/memoria.json`). Sin `--timeline data/reel/timeline.json` el lint dio 4 FIX de arc que eran del demo (duración ~5,4 s, pregunta fuera del 10 %...), no del reel. Con `--timeline` + `--story` / `--mem` explícitos, SHIP. Lección: pasar siempre las rutas explícitas (o exportar `OPUS_TIMELINE`).
- `npm run memoria -- --help` no es ayuda: ejecuta el modo por defecto sobre el demo. El comando es `node engine/memoria.mjs lint --mem ... --timeline ...`.
- El true peak tras AAC sube respecto a la mezcla (mezcla −2,2 dBTP, mp4 −1,8 dBTP): el margen es justo; ver Métricas.

## Falsos positivos del lint (SHIP con 48 avisos, 0 FIX)
- «el sujeto ocupa 79-138 % del encuadre» (K04-K14, K21-K23): tipografía a sangre es el estilo (ECU/CU deliberado); la regla de aire está pensada para sujetos fotográficos.
- «pop: energía Nx la mediana local» (K07, K08, K11, K13, K14): son los golpes percusivos de las onomatopeyas, buscados. K16 (80x y 901x): la palabra se contrae a un punto y se hace negro, la «mediana local» es ~0.
- «corte en el reposo» (K07/K08/K15/K17/K18/K20-K23): los cortes caen en el pulso por construcción; la acción termina justo antes porque la siguiente entra a golpe en el pulso (el corte es el golpe).
- K18 «el ojo va a otro sitio: 0 %»: el impact frame es un negativo blanco/negro con esquirlas; no hay foco único por diseño.
- `[arc]` «el acento no se concentra en el pico (x0,50)»: el acento lima es la respuesta del final y el pulso; en el golpe domina el blanco/negro. Declarado en `story.accent.means`. Se mantiene como WARN.
- memoria: «pregunta: setup sin payoff» — la propia memoria la da por resuelta por «sonar» (leitmotiv y capa conceptual del final); el lint no cuenta ese cierre.
- Posible verdadero positivo menor: K20 «beat sin firma de ritmo» (pico 89 vs valle 129), el acento del beat de K20 podría anticiparse con un valle; no se tocó.

## Métricas
- Arc: 98/100 · pico 22,083 s (73,6 %) · ratio 14,75x · calma previa 0,479x · final 7,4 % del pico · hold 0,33 s · impact K18 a 0 fotogramas · sizeEntropy 2,14.
- Sonido (mezcla `data/mix-reel.wav`, 73 eventos, música generativa electro): −14,0 LUFS · LRA 8,1 LU · TP −2,2 dBFS.
- mp4 final (ffmpeg ebur128 sobre el contenedor): I −14,1 LUFS · LRA 7,2 LU · true peak −1,8 dBTP (cumple ≤ −1). Clímax de volumen: short-term máximo en la ventana que acaba en 22,7 s, es decir el golpe.

## Tiempos
Lint completo ~12-20 s; arc ~10 s; mezcla 7 s; master (render 900 fotogramas por fragmentos en paralelo, sin caché) 40 s; `npm test -- --fast` 53 s.

## Cambios del motor (commit 8a8a6ec) y por qué
- `engine/filmid.mjs` + film.mjs/lint/verdict/arc/params/seek/signal/autocam/cut/sound: la identidad de un film sale de la carpeta del timeline (`data/reel/`), de modo que sus archivos hermanos (audio.json, story.json, memoria.json, veredictos, caché de fragmentos, `out/sfx-reel.json`, `data/mix-reel.wav`) no pisan los del demo.
- `engine/grid.mjs`: genera la rejilla de tempo (beats, subdivisiones, tempo variable) desde la partitura, y los onsets por instrumento; permite cortar y enlazar señales al compás.
- `engine/audio.mjs` / `score.mjs`: pistas de audio por instrumento (kick/snare/hat/tom) como features `onsets` con `track`; la partitura admite tempo variable y el golpe/vacío configurable.
