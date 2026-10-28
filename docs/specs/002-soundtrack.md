# 002 — Soundtrack como sistema (no solo música)

## Intención (usuario, 2026-10-01, sobre potencias_musica.mp4)
"Falta refinarlo y sistematizarlo, incorpóralo al plan. Esa música es un claro 6–7, tal vez más el beat de
tensión, pero no te limites a la música: debes mejorar todo el soundtrack."

## Diagnóstico
- La PoC (engine/score.mjs) tiene arco, pero armonía, motivo y curva de intensidad están escritos a mano para este film.
- El beat de tensión (pulsos que aceleran 54→132 bpm hacia el golpe) es lo que mejor funciona → potenciarlo.
- Los sfx originales estaban planos a −14 LUFS y hubo que bajarlos 17 dB: el diseño sonoro no existe como capa propia.
- Timbres sintéticos simples: suena a demo.

## Medibles
| aspecto | medible |
|---|---|
| sistematización | 0 constantes por film en el código: todo sale de timeline + energía + memoria (+ un estilo sonoro JSON) |
| tensión | densidad rítmica y altura/brillo crecen de forma monótona los 10–20 s previos al pico; ≥1 "suck-back" (vacío ≥0,5 s) antes del golpe |
| impacto | transitorio + sub-drop + cola en cada impacto declarado; sincronía ≤2 fotogramas |
| diseño sonoro | cada evento visual relevante (corte de escala, revelación, entrada de objeto) tiene sonido; whoosh ∝ velocidad |
| variedad | ningún sample/voz idéntico repetido >4 veces seguidas (variación de tono/filtro/tiempo) |
| mezcla | enmascaramiento: en momentos de sfx, la música cede ≥3 dB en su banda; buses separados |
| master | −14 LUFS integrado, LRA ≥8 LU, true peak ≤ −1 dBTP, pico (ventana 3 s CENTRADA) ±0,5 s del pico visual |

## Escenarios (BDD)
- Dado el timeline de Potencias sin parámetros musicales escritos a mano, Cuando corre `score`, Entonces produce una partitura con arco que cumple los medibles.
- Dado un impacto declarado en t, Entonces hay ≥0,5 s de vacío relativo antes de t y transitorio a ≤2 fotogramas de t.
- Dado un concepto de la memoria que se reinterpreta en t, Entonces su leitmotiv reaparece transformado en t ±1 s.
- Dado un sfx repetido (tic ×10), Entonces cada repetición varía y su intensidad sigue la curva.
- Dado el master, Entonces −14 LUFS, LRA ≥8, TP ≤ −1, pico centrado ±0,5 s.
- [HUMANO] Dado Potencias v2, Cuando el usuario lo califica, Entonces nota ≥8 en soundtrack.

## TDD
test/sound.mjs: cada medible es un test; potencias v1 y la PoC deben FALLAR algunos (rojo) antes de implementar.

## Rojo inicial (2026-10-01, `node test/sound.mjs`, estado previo: sfx v1 de `engine/sound.mjs` + PoC de partitura de la rama del film)
Medido sobre el audio de Potencias: sfx v1 renderizados con `VOICES`, música = WAV de la PoC y mezcla = `potencias_musica.mp4` de la rama.

```
# sujeto: LEGACY: sfx v1 + PoC de partitura (estado previo)
✗ sound: sistematización: 0 constantes del film en el código  engine/score.mjs: nombra el film | engine/score.mjs: literal 11.5 (instante del film) | engine/score.mjs: literal 46 (instante del film) | engine/score.mjs: literal 63 (instante del film) | engine/score.mjs: literal 28 (instante del film) | engine/score.mjs: literal 71 (instante del film) … (+1)
✗ sound: sistematización: analyzeFilm sigue al timeline y al estilo JSON  engine/score.mjs no exporta analyzeFilm (la PoC es un script con constantes)
✗ sound: tensión: densidad y brillo monótonos crecientes antes del pico  ventanas de 4.0 s en [29.9, 49.9] · densidad ev/s 4.3 → 4.0 → 4.8 → 5.5 → 5.3 · brillo 1.11 → 0.27 → 1.85 → 2.15 → 4.69 %
```

## Verde (2026-10-01, `node test/sound.mjs`, sistema v2: `build()` sobre `data/stress/potencias.json` + memoria)
Mismo medidor, mismas ventanas. Rojo = PoC + sfx v1; verde = `engine/{score,sounddesign,mixer,sound,dsp}.mjs` + `styles/sound/epico.json`.

| medible | rojo (PoC + v1) | verde (v2) |
|---|---|---|
| 0 constantes del film en el código | `score.mjs` nombra el film y trae 7 instantes (11,5 · 28 · 46 · 63 · 71…) | 0 literales; `analyzeFilm` sigue una perturbación ×0,6 con error 0,00 s y el estilo gobierna el tempo (132 → 158 bpm = ×1,20) |
| tensión: densidad/brillo monótonos | densidad 4,3 → 4,0 → 4,8 → 5,5 → 5,3; brillo 1,1 → 0,3 → 1,9 → 2,2 → 4,7 % (no monótono) | ataques/s 4,8 → 5,3 → 7,3 → 9,8 → 21,3; centroide 844 → 6919 Hz |
| tensión: vacío ≥0,5 s | caída 0,7 dB (el golpe no se separa del crescendo) | 105 dB (vacío de 0,6 s) |
| impacto: transitorio + sub + cola | cola ausente (−126 dB) | transitorio 9,2 dB · sub −1,5 dB · cola −14,5 dB |
| impacto: sincronía ≤ 2 fotogramas | 7,4 fotogramas | 0,4 fotogramas |
| cobertura de eventos visuales | 64,1 % (50/78; sin sonido en los 12 cambios de escala) | 100 % (74/74) |
| whoosh ∝ velocidad | 0 whooshes con velocidad | 13 · ρ(velocidad, nivel) 0,81 · ρ(velocidad, brillo) 0,88 |
| risers que resuelven | 1/2 | 2/2 |
| variedad / tics siguen la intensidad | 21 tics idénticos seguidos · ρ indefinido | racha máxima 1 · ρ 0,64 sobre 33 tics |
| enmascaramiento (buses + cesión ≥3 dB) | sin buses; un solo sidechain de ffmpeg | 16 eventos prioridad ≥2: mediana 5,9 dB, p20 4,5 dB |
| master −14 ±0,5 / LRA ≥8 / TP ≤ −1 | −14,1 · 10,6 · −0,5 dBTP (TP en rojo) | −14,0 LUFS · 9,1 LU · −2,2 dBTP |
| pico ±0,5 s del pico (ventana 3 s centrada) | centro 49,40 s vs 50,92 s (−1,52 s) | centro 50,80 s (−0,12 s) |
| leitmotiv transformado en la reinterpretación | ninguno | 2/2 (`origen` y `pasos` @58,1 s: mayor + despliegue + octava / acelerado + secuencia) |
| determinismo | — | mismo hash en dos builds |

Salida completa:
```
# sujeto: v2 (build) Potencias completa · 16.3 s de síntesis
✓ sound: sistematización: 0 constantes del film en el código  5 archivos limpios
✓ sound: sistematización: analyzeFilm sigue al timeline y al estilo JSON  escala ×0,6: err hit/rev0/rev 0.00/0.00/0.00 s, hold 0.00 s · estilo: pico de tempo 132→158.4 bpm → bpm en el golpe 132.0→158.4 (×1.20)
✓ sound: tensión: densidad y brillo monótonos crecientes antes del pico  5 ventanas de 4.0 s en [29.9, 49.9] · ataques/s 4.8 → 5.3 → 7.3 → 9.8 → 21.3 (partitura) · centroide espectral 844.0 → 901.3 → 934.2 → 1626.9 → 6918.5 Hz · nivel -17.2 → -17.3 → -16.3 → -13.6 → -14.3 dB
✓ sound: tensión: vacío ≥0,5 s antes del golpe  golpe 50.9: -15.6 dB → -120.8 dB (105.1 dB de caída) · exige ≥15 dB
✓ sound: impacto: transitorio + sub-drop + cola por impacto declarado  golpe 50.9: transitorio 9.2 dB (≥6) · sub -1.5 dB (≥−6) · cola -14.5 dB (−40…−6)
✓ sound: impacto: sincronía ≤ 2 fotogramas  golpe 50.92: transitorio en 50.91 (0.4 fotogramas, salto 106.8 dB)
✓ sound: diseño: cada evento visual relevante tiene sonido (evento y audio)  74/74 cubiertos (100.0 %, exige ≥95 %)
✓ sound: diseño: whoosh proporcional a la velocidad  13 whooshes · ρ(velocidad, nivel) 0.81 · ρ(velocidad, brillo) 0.88 (exige ≥0,5)
✓ sound: diseño: risers que resuelven  2/2 terminan en un evento de resolución
✓ sound: variedad: ninguna voz idéntica >4 veces seguidas; los tics siguen la intensidad  racha máxima de "air" idénticos: 1 (exige ≤4) · ρ(intensidad, nivel del tic) 0.64 sobre 33 tics (exige ≥0,5)
✓ sound: mezcla: buses separados y la música cede ≥3 dB en la banda del sfx  16 eventos de prioridad ≥2 con música audible · cesión en su banda: mediana 5.9 dB, p20 4.5 dB (exige p20 ≥3)
✓ sound: master: −14 LUFS ±0,5, LRA ≥8, true peak ≤ −1 dBTP  I -14.0 LUFS · LRA 9.1 LU (exige ≥8) · TP -2.2 dBTP
✓ sound: master: pico (ventana 3 s centrada) a ±0,5 s del pico visual  máx short-term -10.4 LUFS en [49.3, 52.3] → centro 50.80 s vs pico visual 50.92 s (error -0.12 s)
✓ sound: memoria: el leitmotiv reaparece TRANSFORMADO en cada reinterpretación (±1 s)  origen (persona @58.1): 7 notas transformadas [major+unfold+oct+floracion] · pasos (regla @58.1): 6 notas transformadas [major+unfold+fast+climb]
✓ sound: determinismo: dos builds de un film corto dan el mismo audio  5dfddea62555 / 5dfddea62555
15 medibles en verde
```
Entregable: `out/potencias_v2.mp4` (vídeo `-c:v copy`, audio AAC 256 k medido con ebur128 sobre el mp4: −14,2 LUFS · LRA 9,2 LU · TP −1,7 dBFS).
`--fast` (Potencias ×0,6, mismo código): 15/15 en verde con LRA ≥6.

### Hallazgos de medición (para recalibrar la spec)
- "Densidad rítmica" no se puede medir fiablemente por detección de ataques en el audio con texturas sintéticas densas (el batido de sierras
  desafinadas da ~20 ataques/s constantes): se mide sobre la partitura (síntesis determinista) y el brillo sobre el audio (centroide por FFT).
- El máximo de sonoridad de 3 s coincide con el golpe solo si el anillo del golpe es de banda media y sostenido (el sub apenas pesa en K-weighting)
  y el crescendo previo y la revelación quedan ≥1,5 LU por debajo: el limitador aplana lo demás. Calibrado con `impact.tailKeep`, `crescendo.top` y `dynamics.revDb`.
- loudnorm con LRA objetivo 7 comprime una mezcla con LRA>7: `cut.mjs` respeta la mezcla v2 masterizada.
- AAC a 192 k añade ~1,5 dB de true peak sobre una mezcla limitada: 256 k y techo de mezcla −2 dBTP.

## Calificaciones
| versión | nota | comentario |
|---|---|---|
| sfx originales | ~5 | planos, monótonos |
| música PoC (score.mjs) | 6–7 | arco y tensión prometedores; falta refinar, sistematizar y el resto del soundtrack |
| potencias v2 | **8** (2026-10-05) | "algo mejor, sí": objetivo ≥ 8 alcanzado en soundtrack; música + diseño sonoro + mezcla sistematizados |
