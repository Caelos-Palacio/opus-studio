# Vídeo «mate» — e^{iπ}: elevar es girar

Explainer contemplativo de 90 s (1280×720, 30 fps, 2701 fotogramas). Entregable local: `out/mate.mp4` (no versionado).
Sin voz: se entiende mudo con «elevar e a un número imaginario es girar; media vuelta te deja en −1».

## Concepto
- Modelo roto: «elevar = multiplicar e por sí mismo» (vale para exponentes enteros; con iπ no hay manera de multiplicar «iπ veces»). Reemplazo: elevar = dejar crecer (dz/dt = z); con tasa imaginaria la velocidad es perpendicular y el punto gira.
- Gancho: la pregunta «¿Qué significa elevar e a iπ?» en pantalla a los 3 s (primer 10 %). Respuesta tardía a los 66 s (73 %): el polígono (1+iπ/n)^n se redondea a semicircunferencia y el punto aterriza en −1. Después, 4 s de silencio (hold), la identidad, y regreso a la recta (final casi igual al principio, con otra función).
- Ocho shots M01–M08 de 9–13 s, entidad `z` compartida con handoffs de morph. Estilo `nocturno` (TeX con Latin Modern; ámbar = el punto, azul = real, violeta = imaginario, coral = modelo roto) y estilo de sonido `contemplativo` (piano y pads, 38→54 bpm, sin percusión).

## Pasos y resultados
| Paso | Resultado |
|---|---|
| lint completo | SHIP con 3 WARN (todos clasificados abajo); 2 min 36 s por pasada |
| arc | SHIP 98/100; pico 23,7× la mediana en 66,2 s (74 %); calma previa 0,76×; hold junto al pico 4,17 s; final 10 % del pico |
| memoria lint | PASS (pregunta abierta en el primer 10 %, resuelta tarde) |
| pedagogía (Mayer) | máx. 3 conceptos nuevos/min (límite 3); máx. 3 elementos animados a la vez (límite 4); spine (arco causal pero/por lo tanto) OK |
| master | `npm run master` sin --force → 709 s de CPU, 2 min 10 s reloj (8 fragmentos en paralelo); mp4 h264+aac 48 kHz estéreo, 90,03 s, 27 MB |
| audio del mp4 (ffmpeg ebur128) | −14,1 LUFS · LRA 9,9 LU · true peak −2,0 dBTP (≤ −1) |
| sonido | vacío de 0,59 s antes del aterrizaje (silencedetect 65,4–66,0 s); 41 eventos; techo de master −3 dBTP (−3,26 en el WAV; el AAC lo sube ~1,2 dB) |
| `npm test -- --fast` | verde (48 s); test/sound.mjs: 15 medibles en verde |

## Falsos positivos del lint
1. `M06 66,25 s pop: energía 3,3× la mediana local`: verdadero por construcción, no defecto. Es el aterrizaje en −1 (destello de luz), el único pico de la pieza; suavizarlo iría contra el pico declarado. Falso positivo.
2. `90,00 s primer y último frame casi idénticos (clon perezoso)`: falso positivo deliberado. M08 devuelve el punto a 1 sobre la recta (cierre circular): misma imagen, otra función (ahora sabemos que es media vuelta deshecha). Lo declara el brief.
3. `[arc] el acento no se concentra en el pico (×0,99 < ×1,5)`: falso positivo de la medida. El acento ámbar es el punto y su glow, que miden 0,02 % de los píxeles; el destello del aterrizaje existe (halo ×4,8 y anillo), pero es tan pequeño frente al fotograma que el cociente de píxeles ámbar dentro/fuera de la ventana del pico no lo distingue. Además el aviso sugiere «declarar story.accent.means», que ya estaba declarado: el chequeo no lo consulta (mejora pendiente del motor, no cambiada aquí).

## Qué del sistema funcionó
- TeX real con morph semántico y la entidad compartida `z`: el handoff entre shots fue limpio.
- Arc/pedagogía: guiaron la estructura (pregunta temprana, pero/por lo tanto, un solo pico, hold).
- El sistema de sonido de la spec 002 aguantó un estilo opuesto (piano sin percusión) casi solo con datos JSON + las parametrizaciones de abajo.

## Qué falló o costó (bugs del motor)
1. `filmKey()` (engine/verdict.mjs): cualquier `timeline.json` en subcarpeta se llamaba «main», así que los veredictos de lint del vídeo escribían en `out/lint/main` mezclados con los del demo (y el gate leía los equivocados). Corregido: `data/mate/timeline.json` → clave `mate`; `data/timeline.json` sigue siendo `main` (los tests del demo no cambian).
2. `mixName()` (engine/sound.mjs): mismo problema con la mezcla: pisaba `data/mix.wav` y `out/sfx.json` del demo. Ahora `data/mix-mate.wav`, `out/sfx-mate.json`.
3. `npm run master` escribe siempre `out/master.mp4` (etiqueta «film main» en el log), no `out/<film>.mp4`; renombrado a mano a `out/mate.mp4`. Sin arreglar (afecta a la CLI de cut, fuera de alcance).
4. `node engine/arc.mjs --help` y `npm run memoria -- --help` no son ayuda: ejecutan el análisis (con rutas por defecto si no se pasan).
5. Cada cambio en `engine/` invalida el lint (~2,5 min): tras tocar sound.mjs hubo que repetir el lint antes de que el gate dejase masterizar.

## Cambios del motor y justificación (todos conservan el comportamiento por defecto del estilo `epico`)
- `engine/score.mjs`: las capas y voces pasan a ser opcionales/parametrizables por estilo: `motif.voice` (voz del leitmotiv; piano en vez de campana FM), `layers.arp.voice/seq`, capas kick/hat/tom/roll/riser ausentes = apagadas, `style.hit`/`style.rev` (golpe y revelación sin metales ni coro: un acorde de piano), `layers.pad.{shift,atk,rel,fcMax}`, y una voz nueva `piano` (parciales inarmónicos, dos cuerdas, fieltro). Motivo: sin esto el estilo contemplativo era imposible sin percusión épica. Los valores por defecto reproducen el estilo `epico`; test/sound.mjs lo confirma (incluido el determinismo).
- `engine/sounddesign.mjs`: `sfx.derive.{whoosh,click,accent}` (factor de los sonidos derivados; 0 = silencio), `sfx.tickBase`, `impact.mix` y `sfx.bloom` (equilibrio del golpe/floración). Motivo: en un film contemplativo los whooshes y clics automáticos de los morphs rompían el ambiente; el aterrizaje debía ser un golpe suave, no un impacto.
- `engine/verdict.mjs` (`filmKey`) y `engine/sound.mjs` (`mixName`): ver bugs 1 y 2.
- `styles/sound/contemplativo.json`: `master.tp` de −2 a −3 dBTP para dejar margen a la recodificación AAC (−2,0 dBTP medidos en el mp4).

## Tiempos
lint completo ≈ 2 min 36 s (×3 en total: inicial, tras corregir filmKey, tras mixName); soundtrack 31 s; master 2 min 10 s; `npm test -- --fast` 48 s.

## Estado
No hay `--force`; el master pasó el gate con lint SHIP vigente. Frames revisados a mano en 6, 40, 65, 67,5 y 74 s: legibles, TeX nítido, aterrizaje con halo, sin solapes. En 74 s se ve el TeX en pleno morph (transición, no defecto).
