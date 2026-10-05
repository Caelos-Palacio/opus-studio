# 08 — Perfil del motor (R0) y primeras optimizaciones

Medido con `npm run profile -- [--timeline X | --fixture dir] [--frames N] [--fx-fast] [--no-encode] [--json f]`
(engine/profile.mjs + instrumentación apagada por defecto en engine/perf.mjs). Máquina: 12 CPUs, node 22, node-canvas 3.2.3 (cairo 1.16).
Tiempo EXCLUSIVO por categoría (el de un hijo no se suma al padre); `X+draw` / `X+px.read` = `drawImage` / `getImageData` ejecutados dentro de X.
Muestreo: ≥2 fotogramas por shot, proporcional a su duración. Un proceso, sin ffmpeg (el x264 se mide aparte, abajo).

## Línea base (antes de optimizar)

### timeline.json — 1280×720 @60, 361 fotogramas, 120 muestreados
media 3.0 ms/fotograma (p50 2.3, p95 5.6)

| categoría | ms/fotograma | % |
|---|---:|---:|
| shot | 1.49 | 49.5 |
| encode | 1.06 | 35.3 |
| other | 0.45 | 15.1 |
| grade.post | 0.01 | 0.2 |

Top-10 shots por coste estimado (ms medio × fotogramas)

| shot | ms/fotograma | fotogramas | est. s | dominantes (ms/fotograma) |
|---|---:|---:|---:|---|
| A1 | 4.4 | 120 | 0.5 | shot 1.7 |
| A3 | 2.5 | 120 | 0.3 | shot 1.7 |
| A2 | 2.1 | 120 | 0.2 | shot 1.1 |

Top fx / operaciones (ms/fotograma, exclusivo)

- grade.post: 0.01

Por familia (incluye sus lecturas de píxeles y drawImage): shot 1.5 ms (49 %) · encode 1.1 ms (35 %) · other 0.5 ms (15 %) · grade 0.0 ms (0 %)

### fixture showcase — 1280×720 @30, 526 fotogramas, 120 muestreados
media 122.4 ms/fotograma (p50 118.5, p95 174.2)

| categoría | ms/fotograma | % |
|---|---:|---:|
| fx.bloom+draw | 43.94 | 35.9 |
| grade.post | 23.95 | 19.6 |
| grade.color | 11.27 | 9.2 |
| fx.warp+draw | 9.58 | 7.8 |
| shot | 8.64 | 7.1 |
| fx.blur+draw | 4.34 | 3.5 |
| fx.chroma | 4.29 | 3.5 |
| fx.layer+draw | 2.74 | 2.2 |
| fx.chroma+px.read | 1.87 | 1.5 |
| tex | 1.74 | 1.4 |
| grade.color+px.read | 1.62 | 1.3 |
| fx.chroma+px.write | 1.26 | 1.0 |
| grade.color+px.write | 1.22 | 1.0 |
| fx.bloom | 1.14 | 0.9 |
| encode | 1.14 | 0.9 |
| other | 1.03 | 0.8 |
| grade.post+draw | 0.95 | 0.8 |
| fx.warp | 0.73 | 0.6 |
| fx.layer | 0.38 | 0.3 |
| fx.blur | 0.26 | 0.2 |
| fx.bloom+px.read | 0.18 | 0.1 |
| fx.bloom+px.write | 0.12 | 0.1 |

Top-10 shots por coste estimado (ms medio × fotogramas)

| shot | ms/fotograma | fotogramas | est. s | dominantes (ms/fotograma) |
|---|---:|---:|---:|---|
| S2 | 159.4 | 105 | 16.7 | fx.bloom+draw 43.7, fx.blur+draw 20.8, fx.layer+draw 13.3 |
| S1 | 131.8 | 105 | 13.8 | fx.bloom+draw 31.1, shot 7.8, fx.bloom 1.0 |
| S5 | 128.8 | 105 | 13.5 | fx.warp+draw 47.9, fx.warp 3.7, tex 2.7 |
| S3 | 103.3 | 105 | 10.8 | shot 25.7, tex 0.9 |
| S4 | 88.5 | 105 | 9.3 | tex 5.1, shot 3.6 |

Top fx / operaciones (ms/fotograma, exclusivo)

- fx.bloom+draw: 43.94
- grade.post: 23.95
- grade.color: 11.27
- fx.warp+draw: 9.58
- fx.blur+draw: 4.34
- fx.chroma: 4.29
- fx.layer+draw: 2.74
- fx.chroma+px.read: 1.87
- tex: 1.74
- grade.color+px.read: 1.62

Por familia (incluye sus lecturas de píxeles y drawImage): fx 70.8 ms (58 %) · grade 39.0 ms (32 %) · shot 8.6 ms (7 %) · tex 1.7 ms (1 %) · encode 1.1 ms (1 %) · other 1.0 ms (1 %)

### potencias.json — 1280×720 @30, 2341 fotogramas, 156 muestreados
media 128.2 ms/fotograma (p50 125.5, p95 183.3)

| categoría | ms/fotograma | % |
|---|---:|---:|
| fx.bloom+draw | 31.74 | 24.8 |
| grade.post | 27.55 | 21.5 |
| fx.blur+draw | 22.43 | 17.5 |
| shot | 15.08 | 11.8 |
| grade.color | 11.76 | 9.2 |
| fx.chroma | 5.03 | 3.9 |
| fx.chroma+px.read | 2.11 | 1.6 |
| grade.color+px.read | 1.70 | 1.3 |
| tex | 1.68 | 1.3 |
| fx.chroma+px.write | 1.52 | 1.2 |
| grade.color+px.write | 1.28 | 1.0 |
| fx.layer | 1.14 | 0.9 |
| grade.post+draw | 1.08 | 0.8 |
| encode | 1.05 | 0.8 |
| fx.bloom | 0.82 | 0.6 |
| fx.layer+draw | 0.81 | 0.6 |
| fx.blur | 0.78 | 0.6 |
| other | 0.44 | 0.3 |
| fx.bloom+px.read | 0.15 | 0.1 |
| fx.bloom+px.write | 0.10 | 0.1 |

Top-10 shots por coste estimado (ms medio × fotogramas)

| shot | ms/fotograma | fotogramas | est. s | dominantes (ms/fotograma) |
|---|---:|---:|---:|---|
| P10 | 117.9 | 285 | 33.6 | shot 20.2, fx.bloom+draw 7.1, tex 1.5 |
| P03 | 144.5 | 225 | 32.5 | fx.blur+draw 40.6, shot 9.3, tex 1.9 |
| P13 | 135.7 | 210 | 28.5 | fx.blur+draw 41.8, shot 5.1, fx.layer 1.9 |
| P02 | 141.4 | 165 | 23.3 | fx.blur+draw 44.7, shot 6.0, fx.layer 1.7 |
| P09 | 171.7 | 135 | 23.2 | shot 78.3, fx.layer 2.8, fx.layer+draw 2.5 |
| P12 | 94.7 | 240 | 22.7 | tex 4.0, shot 3.2 |
| P01 | 124.4 | 180 | 22.4 | fx.blur+draw 37.9, shot 3.9, fx.blur 1.2 |
| P08 | 150.2 | 135 | 20.3 | shot 34.7, fx.layer+draw 3.3, fx.layer 2.9 |
| P06 | 148.3 | 135 | 20.0 | fx.blur+draw 38.7, shot 25.0, tex 1.5 |
| P11 | 86.9 | 225 | 19.6 | shot 4.4, tex 1.4 |

Top fx / operaciones (ms/fotograma, exclusivo)

- fx.bloom+draw: 31.74
- grade.post: 27.55
- fx.blur+draw: 22.43
- grade.color: 11.76
- fx.chroma: 5.03
- fx.chroma+px.read: 2.11
- grade.color+px.read: 1.70
- tex: 1.68
- fx.chroma+px.write: 1.52
- grade.color+px.write: 1.28

Por familia (incluye sus lecturas de píxeles y drawImage): fx 66.6 ms (52 %) · grade 43.4 ms (34 %) · shot 15.1 ms (12 %) · tex 1.7 ms (1 %) · encode 1.1 ms (1 %) · other 0.4 ms (0 %)

### x264 (medium, crf 16, 1280×720), CPU por fotograma
- threads automáticos (como hasta ahora): **227–244 ms CPU/fotograma** (≥ lo que cuesta renderizar el fotograma: 120–130 ms).
- `-threads 1`: 122 ms (−46 %, +1 % de tamaño). `-preset faster -threads 1`: ver abajo. PSNR vs fuente: medium 50,24 dB · fast 50,55 · faster 50,49.

## Lectura
1. El render NO es el cuello de botella por sí solo: x264 gasta más CPU que el dibujo, porque con 12 workers cada ffmpeg arranca ~18 hilos (lookahead + frame-threads) y compiten entre sí.
2. Dentro del dibujo, lo caro no es el código de los shots (8–15 ms) sino el **remuestreo de cairo**: toda `drawImage` que SUBE una capa a 1280×720 con bilinear cuesta ~15–22 ms (sin SIMD), y cada bloom/blur/capa con fx hace al menos una. Bajar ×4 de golpe cuesta ~11–15 ms; ×2 en cascada 0,6 ms.
3. `grade.post` (24–28 ms) era casi todo el **gradiente radial de la viñeta** a pantalla completa (17–25 ms por fotograma, idéntico en todos).
4. Lecturas de píxeles (getImageData/putImageData) y TeX son pequeñas (< 4 % cada una); la codificación `toBuffer('raw')` ~1 ms.

## Qué se implementó (todo con medida antes/después, golden bit a bit intacto)
| # | cambio | efecto por defecto | medida (ms/fotograma, mín de 3 pasadas × 40 fotogramas, mismo proceso, A/B contra HEAD) |
|---|---|---|---|
| — | **Viñeta cacheada** (grade.mjs): overlay rasterizado una vez, compuesto 1:1 | bit a bit idéntico | grade.post 24–28 → 7–11 ms; fixture 154–163 → 136–137 (−14 %); potencias 154–161 → 119–122 (−22 %) |
| R3 | **fx rápidos opt-in** (`OPUS_FXFAST=1`, `--fx-fast`, o `profileOverrides.fxFast` en el timeline; entra en el hash por `film.P`): bloom baja ×4 en 2 pasos ×2, y la subida de bloom/blur/capas a resolución completa pasa por ½-res bilinear + nearest | **desactivado**; sin él, píxeles idénticos | fixture 154–163 → 82–88 (−45 % vs base); potencias 154–161 → 74–78 (−50 %). Calidad: PSNR medio 69–71 dB vs exacto (MAD 0,01/255; máx 30–58 en algún borde) |
| R4 | **x264 sin sobresuscripción**: `cut` pasa `--threads CPUs/workers` (=1 con 12 workers) a cada `render --range`; `--preset`/`OPUS_PRESET` opt-in (por defecto medium; solo entra en el hash si ≠ medium); engine/encode.mjs | bytes de los fragmentos cambian solo por el reparto de hilos (misma calidad); preset por defecto sin cambios | ver tabla R4 |
| R1 | no se hizo | — | ver «Pendiente» |

### R4 — CPU total de 12 workers `render --range` (1200 fotogramas de Potencias, 1280×720; user+sys; la máquina era compartida, el reloj es ruidoso, la CPU no)
| configuración | CPU total (s) | por fotograma | vs hoy |
|---|---:|---:|---:|
| medium, threads auto (hoy) | 322 | 268 ms | — |
| medium, `--threads 1` | 304 | 253 ms | −5 % |
| faster, threads auto | 277 | 231 ms | −14 % |
| faster, `--threads 1` | 259 | 216 ms | −19 % |
El reloj (46→40 s con faster en la 1.ª tanda; otra tanda con carga ajena de 116 → 65 s) apunta en el mismo sentido pero no es concluyente. `faster` mantiene la calidad (PSNR 50,5 dB vs 50,2 de medium a igual crf) y es un 9–25 % menor en bytes. No se cambia el valor por defecto (los bytes de los master no se mueven sin pedirlo): `OPUS_PRESET=faster OPUS_THREADS=auto npm run master` (o `--preset faster --threads auto`).


## R5 — @napi-rs/canvas (Skia) vs node-canvas (Cairo), solo medición (test/bench-skia.mjs)
| operación | node-canvas (cairo) ms | @napi-rs/canvas (skia) ms | speedup |
|---|---:|---:|---:|
| drawImage ↓2× (blur chain step) |     0.43 |     0.96 | 0.5× |
| drawImage ↓4× de golpe (bloom) |     8.39 |     0.24 | 35.3× |
| drawImage ↑2× a 1280×720 lighter |    11.68 |     4.01 | 2.9× |
| drawImage ↑4× a 1280×720 |    11.88 |     4.04 | 2.9× |
| drawImage 1:1 (capa compuesta) |     0.34 |     1.32 | 0.3× |
| gradiente radial pantalla completa |    13.93 |     4.29 | 3.2× |
| getImageData 1280×720 |     3.04 |     3.04 | 1.0× |
| putImageData 1280×720 |     1.45 |     2.73 | 0.5× |
| toBuffer raw (a ffmpeg) |     0.61 |     1.70 | 0.4× |
| fillRect ×1100 (grano) |     1.84 |     1.72 | 1.1× |
| paths: 400 curvas Bézier fill+stroke |    42.19 |    32.64 | 1.3× |
| paths: 40 polilíneas × 600 pts (plots) |    71.03 |    40.31 | 1.8× |
| texto: fillText ×150 (40 px) |    64.93 |     3.62 | 18.0× |
| texto: measureText ×300 |     8.69 |     5.22 | 1.7× |
| blur r≈16: cadena del motor (↓×4 ↑×4) |    16.16 |     8.27 | 2.0× |
| blur r=16: ctx.filter nativo |     0.34 |    13.10 | 0.0× |
| blur r=16 a ½ res nativo + subida |    10.68 |     6.82 | 1.6× |

node-canvas 3.2.3 cairo 1.16.0 · @napi-rs/canvas ? · node v22.22.2

Lectura (node-canvas 3.2.3/Cairo 1.16 vs @napi-rs/canvas 1.0.10/Skia, CPU raster; Skia difiere el dibujo hasta leer: se fuerza con getImageData 1×1 en ambos):
- Skia gana donde duele: texto 18× (fillText), bajada ×4 de golpe 35× (bloom), subidas bilinear a pantalla completa 2,9×, gradiente 3,2×, cadena de blur del motor 2×; paths 1,3–1,8×.
- Skia pierde en lo pequeño y repetitivo: composición 1:1 0,3×, putImageData 0,5×, toBuffer/lectura 0,4×, bajada ×2 0,5×. `ctx.filter='blur()'` existe pero cuesta 13 ms (no es un atajo).
- Estimación sobre el perfil actual (cairo): texto/paths/remuestreo = ~65–70 % del tiempo de fotograma → ≈ 1,6–2× en el render del fotograma, con la lectura y la tubería a ffmpeg algo peor (+2–3 ms). Con R3 fxFast el remuestreo ya cuesta poco y la ganancia de Skia baja a ≈1,3×.
- **Recomendación:** no migrar ahora. (1) Skia rasteriza distinto: hay que re-basar TODO el golden (los 24 fotogramas y la huella de plataforma) y las fuentes (fontconfig/pango → Skia/FreeType propio: métricas de texto cambian, lo que mueve el layout y el lint); (2) el 65–80 % de la ganancia alcanzable sin migrar ya está en R3 fxFast + viñeta (−45–50 %); (3) si se migra, hacerlo detrás de una capa `film.canvas` y comparar con tolerancia (PSNR), empezando por el texto (18×), que es donde Skia domina. Prioridad media-baja; vuelve a valorarse tras R1/R2.


## Pendiente / siguientes pasos medidos
- R1 (caché de fotogramas compartida) no se implementó: toca lint/arc/index/critic/peek (otro agente edita lint/CLIs en main) y la comprobación de determinismo de lint NO puede reutilizar caché por diseño. Hueco claro: lint (renderiza a 192 px grade=false en dos puntos del mismo proceso, motion y rhythm) y arc (192 px grade=false) repiten los mismos (t, tamaño); un `frameCache` en disco por (hash del film, t, tamaño, grade) con las cajas serializadas los unifica.
- R2 (capas estáticas): lo que queda caro tras esto es el remuestreo (bloom/blur con subida bilinear exacta): ahí R2 no ayuda; sí lo hace pasar a fxFast por defecto en preview/review/lint (no en master) — propuesta: `fxFast` activo en `--review` y peek.
- `grade.color` (11–18 ms, LUT + dither JS sobre 921 k px) es ahora el mayor coste del grade: candidato a WebAssembly/SIMD o a calcular a ½ de filas con dither idéntico (no bit a bit).
