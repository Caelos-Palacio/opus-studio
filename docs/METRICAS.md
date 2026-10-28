# Métricas con sentido y estandarizables

> GENERADO por `npm run metrics -- doc` desde `engine/metrics/registry.mjs`. No editar a mano.

Esquema de salida: `opus-metrics/1` (`out/metrics/<film>.json`): `{ schema, film, params, metrics:[{id, name, domain, value, unit, ci, ciLevel, method, confidence, n, notes?, sensitivity?}], series }`.

**Principio (spec 005).** Cada magnitud tiene unidad reconocible por un director/músico/diseñador, definición formal, estimador, incertidumbre, invariancias y norma. Los píxeles son un método interno (solo `color.cutDeltaE`), nunca la métrica.

## Convenciones declaradas (todo lo convencional es explícito y se informa su sensibilidad)

| clave | valor | significado |
|---|---|---|
| refFocalMm | 35 | focal equivalente 35 mm del encuadre base (zoom 1×). FOV_h = 2·atan(36/(2f)) = 54,4° a 35 mm. Convención: la magnitud escala con f₀; se informa sensibilidad en 24–50 mm. |
| sensorWidthMm | 36 | ancho de sensor full-frame (equivalencia 35 mm) |
| viewingH | 3 | distancia de visionado = 3 alturas de pantalla (ITU-R BT.500, HDTV preferida) ⇒ alto de pantalla = 18,9° = 1135′ |
| xHeightEm | 0.5 | altura x ≈ 0,5 em (convención tipográfica; 0,48–0,53 en grotescas) |
| beatTolMs | 40 | tolerancia de "en el pulso": 40 ms ≈ 1 fotograma a 24–25 fps (fija, independiente del fps del film) |
| moveThreshold | 0.5 | °/s por encima del cual la cámara "se mueve" (convención; ≈ umbral de detección de movimiento global a esta escala) |
| workingMemory | 4 | capacidad de memoria de trabajo ≈ 4 elementos (Cowan 2001) |

## Confianza

`confianza = base(cls) · min(1, n/n_min) · (1 − min(½, semianchura(IC)/|valor|))`, con base: analítico 0,95 · semántico 0,85 · convención 0,70 · estimado 0,60. Valor `null` ⇒ confianza 0 y `notes` explica la falta de datos.

## Invariancias (verificadas en `test/metrics.mjs`)

- Resolución de render y de film: las magnitudes son razones de longitudes (anchos/alturas de pantalla, fracciones de encuadre) ⇒ invariantes.
- fps del film: los tiempos son segundos; la cuantización ±1/(2·fps) entra en el IC. Muestreo de cajas: se estima el error con Richardson (|v_h − v_2h|/3).
- Duración: tasas por minuto, tiempo normalizado τ = t/D para curvas, proporciones.

## Unidades y análisis dimensional

| símbolo | dimensión | nombre |
|---|---|---|
| 1 | 1 | adimensional |
| s | T^1 | segundo |
| ms | T^1 | milisegundo |
| cortes/min | T^-1 | cortes por minuto |
| % | 1 | porcentaje |
| :1 | 1 | razón |
| n | 1 | recuento |
| Lc | 1 | contraste APCA Lc |
| mm | L^1 | milímetro (equiv. 35 mm) |
| ° | A^1 | grado |
| arcmin | A^1 | minuto de arco |
| °/s | A^1·T^-1 | grados por segundo |
| stops/s | S^1·T^-1 | pasos (log2 de escala) por segundo |
| stops | S^1 | pasos (log2) |
| alturas/s | T^-1 | alturas de sujeto por segundo |
| anchos/s | T^-1 | anchos de pantalla por segundo |
| anchos/s² | T^-2 | anchos de pantalla por s² |
| anchos/s³ | T^-3 | anchos de pantalla por s³ |
| décadas/s | D^1·T^-1 | décadas (log10) por segundo |
| décadas | D^1 | décadas (log10) |
| ΔE00 | C^1 | diferencia de color CIEDE2000 |
| palabras/min | T^-1·W^1 | palabras por minuto |
| car/s | Ch^1·T^-1 | caracteres por segundo |
| elementos | N^1 | elementos simultáneos |
| conceptos/min | K^1·T^-1 | conceptos nuevos por minuto |
| ISO | ISO^1 | sensibilidad ISO equivalente |
| LUFS | dB^1 | LUFS (BS.1770) |
| LU | dB^1 | LU |
| dBTP | dB^1 | dB true peak |
| dB | dB^1 | decibelio |
| BPM | B^1·T^-1 | pulsos por minuto |
| categoría | 1 | categórica |
| 0–1 | 1 | índice normalizado |

Dimensiones base: T tiempo · A ángulo · L longitud · S log₂ de razón de longitudes (stop) · D log₁₀ de razón (década) · C diferencia de color · dB nivel relativo · B pulsos · W palabras · Ch caracteres · N elementos · K conceptos. Una razón de longitudes es adimensional; S y D se rastrean aparte para no confundir una velocidad de zoom con un ritmo.

## montaje

### `montaje.asl` — Duración media de plano (ASL)

- **Unidad**: s · **dimensión**: [T] = [T]/[1] · **clase**: analítico · **tipo**: scalar
- **Fuente**: timeline: límites de shot
- **Definición formal**: ASL = D / n,  con D = duración [s] y n = nº de segmentos entre fronteras únicas {t₀ᵢ, t₁ᵢ} ∩ [0,D]; lᵢ = bᵢ₊₁ − bᵢ
- **Estimador**: fronteras de shot deduplicadas (1 µs); media aritmética de lᵢ
- **Incertidumbre**: IC95 bootstrap percentil (B=400) sobre {lᵢ} ⊕ cuantización de fronteras ±1/(2·fps) por frontera (σ_ASL ≈ √n/(√12·fps)/n)
- **Invariancia / normalización**: independiente de resolución y fps (±1/(2fps)); la duración entra solo por n: ASL no depende de D si el ritmo es estacionario
- **Norma / referencia**: Salt 1974/2006 (Film Style and Technology); Cinemetrics (Tsivian); Cutting et al. 2011 (Psychol Sci 22)
- **Rango típico (indicativo)**: cine narrativo (2000s): 2.5–6 s; acción/videoclip: 1–3 s; documental: 5–12 s; explicativo / motion graphics: 4–15 s (orientativo: contrastar con la fuente; sin calibrar con corpus propio)

### `montaje.msl` — Duración mediana de plano

- **Unidad**: s · **dimensión**: [T] · **clase**: analítico · **tipo**: scalar
- **Fuente**: timeline
- **Definición formal**: MSL = mediana{lᵢ} (Salt: más robusta que ASL ante la cola larga)
- **Estimador**: mediana de lᵢ
- **Incertidumbre**: IC95 bootstrap; ±1/(2fps)
- **Invariancia / normalización**: idem ASL
- **Norma / referencia**: Salt 2006; Cinemetrics
- **Rango típico (indicativo)**: cine narrativo: 2–5 s (orientativo: contrastar con la fuente; sin calibrar con corpus propio)

### `montaje.cutRate` — Ritmo de corte

- **Unidad**: cortes/min · **dimensión**: [T⁻¹] = 1/[T] · **clase**: analítico · **tipo**: scalar
- **Fuente**: timeline
- **Definición formal**: ρ = 60·(n−1)/D  [cortes/min]  (n−1 fronteras interiores)
- **Estimador**: recuento de fronteras interiores / duración
- **Incertidumbre**: IC95 de Poisson (Byar) sobre el recuento; el fps no interviene
- **Invariancia / normalización**: normalizado por duración (por minuto)
- **Norma / referencia**: Cinemetrics; Murch 2001 (In the Blink of an Eye)
- **Rango típico (indicativo)**: cine narrativo: 8–25 cortes/min; acción/videoclip: 20–60 cortes/min; explicativo: 3–15 cortes/min (orientativo: contrastar con la fuente; sin calibrar con corpus propio)

### `montaje.slCV` — Dispersión de duraciones (CV)

- **Unidad**: 1 · **dimensión**: [T]/[T] = 1 · **clase**: analítico · **tipo**: scalar
- **Fuente**: timeline
- **Definición formal**: CV = s_l / ASL (s_l: desviación típica muestral de lᵢ). 0 = metrónomo; ≳1 = ritmo muy desigual
- **Estimador**: desv. típica / media
- **Incertidumbre**: IC95 bootstrap
- **Invariancia / normalización**: adimensional: invariante a escala temporal
- **Norma / referencia**: Salt 2006 (distribución de longitudes); Cutting et al. 2010 (Psychol Sci 21)
- **Rango típico (indicativo)**: cine narrativo: 0.6–1.2 1 (orientativo: contrastar con la fuente; sin calibrar con corpus propio)

### `montaje.hardCutRatio` — Proporción de cortes duros

- **Unidad**: % · **dimensión**: 1 · **clase**: semántico · **tipo**: scalar
- **Fuente**: timeline: transition_out
- **Definición formal**: h = 100·#{fronteras con transition_out ∈ {cut, scale-cut, hold-cut}} / (n−1)
- **Estimador**: recuento por tipo de transición del shot saliente
- **Incertidumbre**: IC95 de Wilson (1927)
- **Invariancia / normalización**: adimensional
- **Norma / referencia**: Bordwell & Thompson, Film Art (transiciones)
- **Rango típico (indicativo)**: sin rango por género establecido

### `montaje.cutOnBeat` — Cortes en el pulso

- **Unidad**: % · **dimensión**: 1 · **clase**: semántico · **tipo**: scalar
- **Fuente**: timeline + rejilla de pulsos (audio.json / bpm)
- **Definición formal**: p = 100·#{cᵢ : min_b |cᵢ − b| ≤ τ} / (n−1),  τ = 40 ms (≈ 1 fotograma)
- **Estimador**: distancia del corte al pulso más próximo (beatTimes del film)
- **Incertidumbre**: IC95 de Wilson; τ fijo en ms ⇒ no depende del fps del film; ±1/(2fps) en cᵢ solo desplaza a quien roza τ
- **Invariancia / normalización**: fps y resolución: sí (τ en ms). Duración: proporción
- **Norma / referencia**: Murch 2001 (corte en el pulso); Lipscomb & Tolchinsky 2005 (congruencia AV)
- **Rango típico (indicativo)**: sin rango por género establecido

### `montaje.cutOnBeatZ` — Sincronía de corte vs. azar (z)

- **Unidad**: 1 · **dimensión**: 1 · **clase**: semántico · **tipo**: scalar
- **Fuente**: timeline + pulsos
- **Definición formal**: z = (k − n·p₀)/√(n·p₀(1−p₀)),  p₀ = min(1, 2τ/Tb), Tb = periodo mediano de pulso. z ≫ 2 ⇒ el corte NO es casual
- **Estimador**: aproximación normal del binomial de cortes aleatorios
- **Incertidumbre**: z es un estadístico; n pequeño ⇒ poco potente (se informa n)
- **Invariancia / normalización**: adimensional
- **Norma / referencia**: contraste binomial; Wilson 1927
- **Rango típico (indicativo)**: sin rango por género establecido

## plano

### `plano.scaleIndex` — Índice de escala de plano

- **Unidad**: 1 · **dimensión**: [L]/[L] = 1 · **clase**: estimado · **tipo**: scalar
- **Fuente**: cajas de foco registradas por el motor (api.morph/focus) con la cámara aplicada; no se leen píxeles
- **Definición formal**: f = h_sujeto / h_visible (unión de focos no sangrados; h_visible sin letterbox). Clase: ECU f≥1,0 · CU ≥0,6 · MCU ≥0,4 · MS ≥0,25 · MLS ≥0,15 · LS ≥0,08 · ELS <0,08. Índice = media ponderada por duración de ECU=0…ELS=6
- **Estimador**: mediana de f por shot sobre las muestras del shot → clase → índice
- **Incertidumbre**: IC95 bootstrap sobre shots; sensibilidad de umbral ±10 % de f
- **Invariancia / normalización**: f es relación de longitudes: invariante a resolución; el muestreo temporal solo añade ±½ muestra
- **Norma / referencia**: Bordwell & Thompson, Film Art; Salt 2006 (shot scale)
- **Rango típico (indicativo)**: sin rango por género establecido

### `plano.scaleMix` — Distribución de escalas de plano

- **Unidad**: % · **dimensión**: 1 · **clase**: estimado · **tipo**: distribution
- **Fuente**: idem plano.scaleIndex
- **Definición formal**: m_c = 100·Σ_{shots de clase c} lᵢ / D para c ∈ {ECU…ELS}
- **Estimador**: duración por clase
- **Incertidumbre**: frontera de clase: ±½ muestra
- **Invariancia / normalización**: idem
- **Norma / referencia**: Salt 2006
- **Rango típico (indicativo)**: sin rango por género establecido

### `plano.declaredAgreement` — Concordancia escala declarada–medida

- **Unidad**: % · **dimensión**: 1 · **clase**: estimado · **tipo**: scalar
- **Fuente**: timeline: size + medida
- **Definición formal**: a = 100·#{shots con |índice_medido − índice_declarado| ≤ 1} / #{shots con size}
- **Estimador**: índice declarado (CU, MS, WS…) vs medido
- **Incertidumbre**: IC95 de Wilson
- **Invariancia / normalización**: idem
- **Norma / referencia**: control de calidad propio (declaración = intención del director)
- **Rango típico (indicativo)**: sin rango por género establecido

## camara

### `camara.focalEq` — Focal equivalente media

- **Unidad**: mm · **dimensión**: [L] = [L]·[1] · **clase**: convención · **tipo**: scalar
- **Fuente**: cámara: camState(z) analítica
- **Definición formal**: f(t) = f₀·z(t),  f₀ = 35 mm eq. (convención);  media ponderada por duración
- **Estimador**: muestreo analítico de camState a 240 Hz, sin handheld
- **Incertidumbre**: numérica por Richardson (240 vs 120 Hz) ≪ convención; sensibilidad: f₀ ∈ [24, 50] mm ⇒ valor × f₀/35
- **Invariancia / normalización**: independiente de resolución y fps
- **Norma / referencia**: equivalencia 35 mm (ISO 12232); SMPTE: lente normal ≈ 35–50 mm eq. en cine
- **Rango típico (indicativo)**: cine narrativo: 24–85 mm (orientativo: contrastar con la fuente; sin calibrar con corpus propio)

### `camara.fov` — Campo de visión horizontal medio

- **Unidad**: ° · **dimensión**: [A] · **clase**: convención · **tipo**: scalar
- **Fuente**: cámara
- **Definición formal**: FOV_h(t) = 2·atan(w / (2·f₀·z(t))),  w = 36 mm
- **Estimador**: idem
- **Incertidumbre**: idem; sensibilidad con f₀
- **Invariancia / normalización**: idem
- **Norma / referencia**: óptica geométrica; ISO 12232
- **Rango típico (indicativo)**: sin rango por género establecido

### `camara.panSpeed` — Velocidad angular de paneo (media)

- **Unidad**: °/s · **dimensión**: [A][T⁻¹] · **clase**: convención · **tipo**: scalar
- **Fuente**: cámara: x(t), y(t), z(t)
- **Definición formal**: θₓ = atan(a·w/(f₀z)), a = x/W (desplazamiento en anchos de pantalla); θ_y análogo con w/aspecto; ω = ‖(dθₓ/dt, dθ_y/dt)‖;  media temporal
- **Estimador**: diferencias centrales a 240 Hz
- **Incertidumbre**: Richardson (240 vs 120 Hz); sensibilidad con f₀ ∈ [24,50] mm
- **Invariancia / normalización**: independiente de resolución/fps; independiente de D (media temporal)
- **Norma / referencia**: convención de equivalencia 35 mm; Cutting 2015 (cámara móvil)
- **Rango típico (indicativo)**: cine narrativo: 0–8 °/s (orientativo: contrastar con la fuente; sin calibrar con corpus propio)

### `camara.panSpeedP95` — Velocidad angular de paneo (p95)

- **Unidad**: °/s · **dimensión**: [A][T⁻¹] · **clase**: convención · **tipo**: scalar
- **Fuente**: cámara
- **Definición formal**: cuantil 0,95 de ω(t)
- **Estimador**: idem
- **Incertidumbre**: idem
- **Invariancia / normalización**: idem
- **Norma / referencia**: idem
- **Rango típico (indicativo)**: sin rango por género establecido

### `camara.rollRate` — Velocidad de balanceo (roll)

- **Unidad**: °/s · **dimensión**: [A][T⁻¹] · **clase**: analítico · **tipo**: scalar
- **Fuente**: cámara: r(t)
- **Definición formal**: media temporal de |dr/dt|, r en grados
- **Estimador**: diferencias centrales
- **Incertidumbre**: Richardson
- **Invariancia / normalización**: idem
- **Norma / referencia**: unidades SI (grado/s)
- **Rango típico (indicativo)**: sin rango por género establecido

### `camara.zoomRate` — Velocidad de zoom (media)

- **Unidad**: stops/s · **dimensión**: [S][T⁻¹] (S = log₂ de razón de longitudes) · **clase**: analítico · **tipo**: scalar
- **Fuente**: cámara: z(t)
- **Definición formal**: s(t) = log₂ z(t) [stops de escala];  media temporal de |ds/dt|. 1 stop = duplicar el tamaño en pantalla
- **Estimador**: diferencias centrales
- **Incertidumbre**: Richardson
- **Invariancia / normalización**: idem
- **Norma / referencia**: stops: Ansel Adams/APEX; log-escala (Weber–Fechner)
- **Rango típico (indicativo)**: sin rango por género establecido

### `camara.zoomRateP95` — Velocidad de zoom (p95)

- **Unidad**: stops/s · **dimensión**: [S][T⁻¹] · **clase**: analítico · **tipo**: scalar
- **Fuente**: cámara
- **Definición formal**: cuantil 0,95 de |ds/dt|
- **Estimador**: idem
- **Incertidumbre**: idem
- **Invariancia / normalización**: idem
- **Norma / referencia**: idem
- **Rango típico (indicativo)**: sin rango por género establecido

### `camara.dollySpeed` — Velocidad de dolly equivalente

- **Unidad**: alturas/s · **dimensión**: [L]/[L]·[T⁻¹] · **clase**: convención · **tipo**: scalar
- **Fuente**: cámara + escala del sujeto
- **Definición formal**: Distancia cámara–sujeto en alturas de sujeto: Dₕ(t) = f₀/(h_s · f_s · z(t)), h_s = alto del sensor (36/aspecto), f_s = fracción de alto del sujeto a z=1. Velocidad = media de |dDₕ/dt|
- **Estimador**: z(t) analítico + f_s de plano.scaleIndex
- **Incertidumbre**: Richardson; depende de interpretar el zoom como dolly (convención) y de f₀
- **Invariancia / normalización**: idem
- **Norma / referencia**: óptica de la lente fina; Brown 2011 (Cinematography)
- **Rango típico (indicativo)**: sin rango por género establecido

### `camara.motionFraction` — Fracción del tiempo con cámara en movimiento

- **Unidad**: % · **dimensión**: 1 · **clase**: convención · **tipo**: scalar
- **Fuente**: cámara
- **Definición formal**: 100·|{t : ω(t) > 0,5 °/s ∨ |dr/dt| > 0,5 °/s ∨ |ds/dt| > 0,05 stops/s}| / D
- **Estimador**: medida de Lebesgue de un conjunto de nivel (240 Hz)
- **Incertidumbre**: Richardson; sensibilidad al umbral ×½…×2
- **Invariancia / normalización**: idem
- **Norma / referencia**: umbral por convención
- **Rango típico (indicativo)**: sin rango por género establecido

### `camara.shake` — Temblor handheld (RMS)

- **Unidad**: ° · **dimensión**: [A] · **clase**: convención · **tipo**: scalar
- **Fuente**: cámara: shake
- **Definición formal**: RMS de θ(t) con handheld − θ(t) sin él (componente x)
- **Estimador**: muestreo con y sin shake
- **Incertidumbre**: longitud de la señal (1,3 Hz): error ∝ 1/√(D·1,3)
- **Invariancia / normalización**: idem
- **Norma / referencia**: estabilización: ITU-R BT.2020 no define; magnitud física
- **Rango típico (indicativo)**: sin rango por género establecido

## movimiento

### `movimiento.speed` — Velocidad en pantalla (media)

- **Unidad**: anchos/s · **dimensión**: [L]/[L]·[T⁻¹] (anchos de pantalla por s) · **clase**: estimado · **tipo**: scalar
- **Fuente**: cajas de foco con identidad (shot, etiqueta) a lo largo de fotogramas muestreados
- **Definición formal**: v = ‖(dx/W, dy/W)‖/dt de cada foco (centro, cámara incluida), ponderada por el peso semántico del foco; media sobre muestras
- **Estimador**: diferencias centrales de las posiciones a la tasa de muestreo
- **Incertidumbre**: Richardson: ε ≈ |v_h − v_2h|/3; + bootstrap sobre muestras
- **Invariancia / normalización**: normalizada por ancho ⇒ invariante a resolución; el muestreo converge al reducir h
- **Norma / referencia**: Cinemetrics (motion); Cutting 2016
- **Rango típico (indicativo)**: sin rango por género establecido

### `movimiento.speedP95` — Velocidad en pantalla (p95)

- **Unidad**: anchos/s · **dimensión**: [T⁻¹] · **clase**: estimado · **tipo**: scalar
- **Fuente**: idem
- **Definición formal**: cuantil 0,95 de v
- **Estimador**: idem
- **Incertidumbre**: idem
- **Invariancia / normalización**: idem
- **Norma / referencia**: idem
- **Rango típico (indicativo)**: sin rango por género establecido

### `movimiento.accel` — Aceleración en pantalla (RMS)

- **Unidad**: anchos/s² · **dimensión**: [T⁻²] · **clase**: estimado · **tipo**: scalar
- **Fuente**: idem
- **Definición formal**: RMS de la segunda diferencia central de la posición / h²
- **Estimador**: idem
- **Incertidumbre**: Richardson (error O(h²)), más sensible al ruido de muestreo que la velocidad
- **Invariancia / normalización**: idem
- **Norma / referencia**: cinemática
- **Rango típico (indicativo)**: sin rango por género establecido

### `movimiento.jerk` — Tirón (jerk) en pantalla (RMS)

- **Unidad**: anchos/s³ · **dimensión**: [T⁻³] · **clase**: estimado · **tipo**: scalar
- **Fuente**: idem
- **Definición formal**: RMS de la tercera diferencia / h³; menor jerk = movimiento más suave (Flash & Hogan 1985)
- **Estimador**: idem
- **Incertidumbre**: Richardson; poco fiable con muestreo < 8 Hz
- **Invariancia / normalización**: idem
- **Norma / referencia**: Flash & Hogan 1985 (minimum-jerk)
- **Rango típico (indicativo)**: sin rango por género establecido

## escala

### `escala.logRate` — Ritmo de cambio de escala

- **Unidad**: décadas/s · **dimensión**: [D][T⁻¹] (D = log₁₀ de razón de longitudes) · **clase**: estimado · **tipo**: scalar
- **Fuente**: tamaño de focos (altura) con identidad
- **Definición formal**: r = RMS de d log₁₀(h/h_visible)/dt, ponderada por peso. 1 década = ×10 en tamaño
- **Estimador**: diferencias centrales del log
- **Incertidumbre**: Richardson; bootstrap
- **Invariancia / normalización**: razón de longitudes ⇒ invariante a resolución
- **Norma / referencia**: Eames 1977 (Powers of Ten); escala logarítmica
- **Rango típico (indicativo)**: sin rango por género establecido

### `escala.cutJump` — Salto de escala en el corte (mediana)

- **Unidad**: décadas · **dimensión**: [D] · **clase**: estimado · **tipo**: scalar
- **Fuente**: tamaño del sujeto antes/después de cada corte
- **Definición formal**: J = mediana{ |log₁₀(f_después/f_antes)| } sobre cortes
- **Estimador**: muestras adyacentes al corte
- **Incertidumbre**: bootstrap sobre cortes; ±½ muestra
- **Invariancia / normalización**: idem
- **Norma / referencia**: regla de los 30°/escala de plano: continuidad (Bordwell & Thompson)
- **Rango típico (indicativo)**: sin rango por género establecido

## composicion

### `composicion.thirdsOffset` — Distancia a los puntos de tercios

- **Unidad**: % · **dimensión**: [L]/[L] = 1 · **clase**: estimado · **tipo**: scalar
- **Fuente**: centro del sujeto (cajas de foco)
- **Definición formal**: d = 100·min_p ‖c − p‖ / (diagonal/2), p ∈ {(⅓,⅓),(⅔,⅓),(⅓,⅔),(⅔,⅔)} en coordenadas de encuadre escaladas por el aspecto; media sobre muestras
- **Estimador**: centro de la unión de focos no sangrados
- **Incertidumbre**: bootstrap sobre muestras
- **Invariancia / normalización**: coordenadas de encuadre normalizadas
- **Norma / referencia**: regla de tercios (Thompson & Bowen, Grammar of the Shot); no es ley, es descriptor
- **Rango típico (indicativo)**: sin rango por género establecido

### `composicion.headroom` — Aire superior (headroom)

- **Unidad**: % · **dimensión**: 1 · **clase**: estimado · **tipo**: scalar
- **Fuente**: cajas de foco
- **Definición formal**: hr = 100·(y_arriba_sujeto − y_arriba_encuadre)/h_visible, media
- **Estimador**: tope de la unión de focos
- **Incertidumbre**: bootstrap
- **Invariancia / normalización**: idem
- **Norma / referencia**: Thompson & Bowen; Mascelli 1965 (Five C’s)
- **Rango típico (indicativo)**: sin rango por género establecido

### `composicion.leadRoom` — Aire de avance (lead room)

- **Unidad**: % · **dimensión**: 1 · **clase**: estimado · **tipo**: scalar
- **Fuente**: cajas de foco + velocidad
- **Definición formal**: lr = 100·espacio libre delante del sujeto en la dirección de vₓ / W, media sobre muestras con |vₓ| > 0,02 anchos/s
- **Estimador**: borde del sujeto al borde del encuadre en sentido del movimiento
- **Incertidumbre**: bootstrap; n = muestras con movimiento
- **Invariancia / normalización**: idem
- **Norma / referencia**: Mascelli 1965; Thompson & Bowen
- **Rango típico (indicativo)**: sin rango por género establecido

### `composicion.balance` — Desequilibrio de peso visual

- **Unidad**: % · **dimensión**: 1 · **clase**: estimado · **tipo**: scalar
- **Fuente**: cajas de foco y texto
- **Definición formal**: b = 100·‖Σ mᵢ(cᵢ − c₀)‖/(Σ mᵢ · diagonal/2), mᵢ = peso·área (foco), 0,5·área (texto); 0 = centro de masa en el centro
- **Estimador**: momento de primer orden
- **Incertidumbre**: bootstrap
- **Invariancia / normalización**: idem
- **Norma / referencia**: Arnheim 1954 (Art and Visual Perception) – peso visual
- **Rango típico (indicativo)**: sin rango por género establecido

## color

### `color.paletteNeutrals` — Nº de neutros de la paleta

- **Unidad**: n · **dimensión**: recuento · **clase**: analítico · **tipo**: scalar
- **Fuente**: paleta del film (estilo/medio)
- **Definición formal**: n_neutro = #{roles con croma C*ab < 8}
- **Estimador**: Lab D65 de cada rol
- **Incertidumbre**: umbral C*=8 (±4)
- **Invariancia / normalización**: independiente de resolución/fps/duración
- **Norma / referencia**: CIE 15:2004; regla 60-30-10 (diseño)
- **Rango típico (indicativo)**: sin rango por género establecido

### `color.paletteAccents` — Nº de acentos de la paleta

- **Unidad**: n · **dimensión**: recuento · **clase**: analítico · **tipo**: scalar
- **Fuente**: paleta
- **Definición formal**: n_acento = #{roles distintos (ΔE00 > 5) con C*ab ≥ 8}
- **Estimador**: agrupación por ΔE00 > 5 entre cromáticos
- **Incertidumbre**: umbral
- **Invariancia / normalización**: idem
- **Norma / referencia**: CIEDE2000; JND ≈ 1 ΔE00
- **Rango típico (indicativo)**: sin rango por género establecido

### `color.harmony` — Esquema de armonía

- **Unidad**: categoría · **dimensión**: categórica · **clase**: analítico · **tipo**: categorical
- **Fuente**: paleta
- **Definición formal**: clasificación por el hueco angular de tono h* entre cromáticos: span<20° mono · ≤60° análoga · ≈180° complementaria · 3 gaps≥90° triádica
- **Estimador**: ángulos h*ab (CIELAB)
- **Incertidumbre**: frontera ±10°
- **Invariancia / normalización**: idem
- **Norma / referencia**: Itten 1961 (Kunst der Farbe); Matsuda 1995
- **Rango típico (indicativo)**: sin rango por género establecido

### `color.meanDeltaE` — Diversidad cromática de la paleta

- **Unidad**: ΔE00 · **dimensión**: [C] · **clase**: analítico · **tipo**: scalar
- **Fuente**: paleta
- **Definición formal**: ΔE̅ = media de ΔE00(cᵢ,cⱼ) para pares i<j (CIEDE2000, kL=kC=kH=1)
- **Estimador**: Sharma, Wu, Dalal 2005 (validada con sus 34 pares de prueba)
- **Incertidumbre**: exacta (determinista)
- **Invariancia / normalización**: idem
- **Norma / referencia**: CIE 142-2001; Sharma et al. 2005; JND ≈ 1
- **Rango típico (indicativo)**: sin rango por género establecido

### `color.inkPaperContrast` — Contraste tinta/papel (WCAG)

- **Unidad**: :1 · **dimensión**: 1 · **clase**: analítico · **tipo**: scalar
- **Fuente**: paleta: ink vs paper
- **Definición formal**: CR = (L₁+0,05)/(L₂+0,05), L luminancia relativa sRGB; ≥ 4,5 AA texto, ≥ 7 AAA
- **Estimador**: fórmula WCAG 2.2 SC 1.4.3
- **Incertidumbre**: exacta
- **Invariancia / normalización**: idem
- **Norma / referencia**: W3C WCAG 2.2
- **Rango típico (indicativo)**: sin rango por género establecido

### `color.inkPaperLc` — Contraste tinta/papel (APCA Lc)

- **Unidad**: Lc · **dimensión**: 1 · **clase**: analítico · **tipo**: scalar
- **Fuente**: paleta
- **Definición formal**: Lc = APCA-W3 0.0.98G-4g(texto=ink, fondo=paper); |Lc| ≥ 60 texto grande, ≥ 75 cuerpo
- **Estimador**: implementación de referencia (verificada: negro/blanco = 106,04)
- **Incertidumbre**: exacta
- **Invariancia / normalización**: idem
- **Norma / referencia**: APCA-W3 (Myndex), borrador WCAG 3
- **Rango típico (indicativo)**: sin rango por género establecido

### `color.accentContrast` — Contraste acento/papel (WCAG)

- **Unidad**: :1 · **dimensión**: 1 · **clase**: analítico · **tipo**: scalar
- **Fuente**: paleta
- **Definición formal**: CR(accent, paper)
- **Estimador**: WCAG
- **Incertidumbre**: exacta
- **Invariancia / normalización**: idem
- **Norma / referencia**: WCAG 2.2 (gráficos: 3:1, SC 1.4.11)
- **Rango típico (indicativo)**: sin rango por género establecido

### `color.cutDeltaE` — Salto cromático en los cortes (mediana)

- **Unidad**: ΔE00 · **dimensión**: [C] · **clase**: estimado · **tipo**: scalar
- **Fuente**: único uso de píxeles: color medio del fotograma (CIELAB) a ±1 muestra de cada corte
- **Definición formal**: ΔE = mediana_c ΔE00(Lab(media fotograma antes), Lab(media fotograma después))
- **Estimador**: media de sRGB lineal → Lab; render a baja resolución
- **Incertidumbre**: bootstrap sobre cortes; resolución del render: media de píxeles es consistente
- **Invariancia / normalización**: la media de color es invariante al remuestreo hasta ±1 ΔE00
- **Norma / referencia**: CIEDE2000; Sharma et al. 2005
- **Rango típico (indicativo)**: sin rango por género establecido

## texto

### `texto.xHeight` — Altura x mediana del texto

- **Unidad**: arcmin · **dimensión**: [A] = [1]·[A] · **clase**: convención · **tipo**: scalar
- **Fuente**: cajas de texto (tamaño aparente con cámara) registradas por api.text
- **Definición formal**: x = 0,5·(sizePx/h_visible)·θ_pantalla, θ_pantalla = 2·atan(1/(2·3)) = 1135′ (visionado 3H); mediana ponderada por exposición
- **Estimador**: tamaño aparente = size × escala de la matriz (incluye zoom)
- **Incertidumbre**: bootstrap sobre textos; sensibilidad a la distancia de visionado ∝ θ
- **Invariancia / normalización**: razón de longitudes ⇒ invariante a resolución
- **Norma / referencia**: ISO 9241-303 / ANSI-HFES 100: ≥ 16′ mín., 20–22′ recomendado; ITU-R BT.500 (3H)
- **Rango típico (indicativo)**: UI/subtítulos: 16–40 arcmin (orientativo: contrastar con la fuente; sin calibrar con corpus propio)

### `texto.belowMinFraction` — Texto por debajo de 16′

- **Unidad**: % · **dimensión**: 1 · **clase**: convención · **tipo**: scalar
- **Fuente**: idem
- **Definición formal**: 100·Σ(exposición con x < 16′)/Σ(exposición)
- **Estimador**: ponderación por tiempo visible
- **Incertidumbre**: Wilson sobre eventos
- **Invariancia / normalización**: idem
- **Norma / referencia**: ISO 9241-303
- **Rango típico (indicativo)**: sin rango por género establecido

### `texto.readingRate` — Ritmo de lectura exigido (p90)

- **Unidad**: palabras/min · **dimensión**: [W][T⁻¹] · **clase**: estimado · **tipo**: scalar
- **Fuente**: texto visible (cajas) y su duración en pantalla
- **Definición formal**: w/(Δt/60) por evento de texto (≥ 2 palabras, no matemático/ticks), Δt = muestras presentes / tasa; p90
- **Estimador**: eventos = (shot, etiqueta) contiguos en el muestreo
- **Incertidumbre**: ±1 muestra en Δt ⇒ ±1/(Δt·fs) relativo; bootstrap
- **Invariancia / normalización**: independiente de resolución; el muestreo ≥ 4 Hz basta
- **Norma / referencia**: Brysbaert 2019 (J Mem Lang 109): lectura silenciosa no ficción ≈ 238 wpm
- **Rango típico (indicativo)**: lectura cómoda: 0–240 palabras/min (orientativo: contrastar con la fuente; sin calibrar con corpus propio)

### `texto.readingCps` — Caracteres por segundo exigidos (p90)

- **Unidad**: car/s · **dimensión**: [Ch][T⁻¹] · **clase**: estimado · **tipo**: scalar
- **Fuente**: idem
- **Definición formal**: caracteres/Δt por evento; p90
- **Estimador**: idem
- **Incertidumbre**: idem
- **Invariancia / normalización**: idem
- **Norma / referencia**: Netflix Timed Text Style Guide: ≤ 17 car/s adultos
- **Rango típico (indicativo)**: subtitulado: 0–17 car/s (orientativo: contrastar con la fuente; sin calibrar con corpus propio)

## informacion

### `informacion.simultaneous` — Elementos simultáneos (media)

- **Unidad**: elementos · **dimensión**: [N] (recuento) · **clase**: estimado · **tipo**: scalar
- **Fuente**: cajas de foco y de texto por fotograma
- **Definición formal**: N(t) = #focos + #textos distintos (ticks de ≤ 2 caracteres cuentan como 1 grupo por shot); media y p95
- **Estimador**: recuento de identidades (shot, tipo, etiqueta) por muestra
- **Incertidumbre**: bootstrap sobre muestras
- **Invariancia / normalización**: independiente de resolución; muestreo ≥ 4 Hz
- **Norma / referencia**: Cowan 2001 (4±1 elementos); Mayer 2009 (coherencia/señalización); Sweller 1988
- **Rango típico (indicativo)**: aprendizaje multimedia: 2–5 elementos (orientativo: contrastar con la fuente; sin calibrar con corpus propio)

### `informacion.overload` — Tiempo con sobrecarga (> 4 elementos)

- **Unidad**: % · **dimensión**: 1 · **clase**: estimado · **tipo**: scalar
- **Fuente**: idem
- **Definición formal**: 100·|{t : N(t) > 4}|/D
- **Estimador**: fracción de muestras
- **Incertidumbre**: Wilson
- **Invariancia / normalización**: idem
- **Norma / referencia**: Cowan 2001
- **Rango típico (indicativo)**: sin rango por género establecido

### `informacion.conceptRate` — Conceptos nuevos por minuto

- **Unidad**: conceptos/min · **dimensión**: [K][T⁻¹] · **clase**: semántico · **tipo**: scalar
- **Fuente**: memoria.json (conceptos y su primera aparición)
- **Definición formal**: λ = 60·K/D, K = nº de conceptos; aparición = min(abre, inicio de estados, anclas)
- **Estimador**: recuento
- **Incertidumbre**: IC95 de Poisson (Byar)
- **Invariancia / normalización**: por minuto
- **Norma / referencia**: Mayer 2009 (segmentación); Guo, Kim & Rubin 2014 (L@S)
- **Rango típico (indicativo)**: explicativo: 1–6 conceptos/min (orientativo: contrastar con la fuente; sin calibrar con corpus propio)

### `informacion.openQuestions` — Preguntas abiertas simultáneas (media)

- **Unidad**: elementos · **dimensión**: [N] (recuento) · **clase**: semántico · **tipo**: scalar
- **Fuente**: memoria.json: abre/resuelve
- **Definición formal**: Q̄ = (1/D)∫ #{c : abre_c ≤ t < resuelve_c} dt
- **Estimador**: integral exacta de una función escalonada
- **Incertidumbre**: exacta dada la memoria
- **Invariancia / normalización**: idem
- **Norma / referencia**: Zeigarnik 1927 (tareas abiertas); Loewenstein 1994 (curiosidad)
- **Rango típico (indicativo)**: sin rango por género establecido

## fondo

### `fondo.profundidad` — Profundidad del fondo

- **Unidad**: % · **dimensión**: 1 (luma en % de escala completa) · **clase**: estimado · **tipo**: scalar
- **Fuente**: píxeles del fotograma (384 px, con gradación) y cajas focus/text (máscara de sujeto); ventanas de 2 s a 4 fps
- **Definición formal**: Y' = luma sRGB codificada en % de escala completa; fondo = píxeles fuera de las cajas focus/text ensanchadas 4 % del lado menor. P = σ_esp + σ_grad + τ, con σ_esp = RMS de la imagen integrada de la ventana respecto a la media de bloques de ancho/6 (estrellas, niebla, textura; el grano se promedia), σ_grad = desv. típica de las medias de bloque 6×3 (viñeta, degradado), τ = mediana de |Δ media de bloque ancho/48| entre fotogramas consecutivos (parpadeo, parallax, deriva). Fondo oscuro: mediana de Y' ≤ 18 %. fondo.vacio: oscuro ∧ P < 1,0 %
- **Estimador**: imagen media de ventana (8 fotogramas) + diferencias de bloque; mediana de τ
- **Incertidumbre**: grano de la gradación atenuado ×1/√8 en σ_esp (residuo ≈ 0,1 %); sensibilidad a la resolución: estrellas finas suben con los píxeles (+30 % de 192 a 1280)
- **Invariancia / normalización**: rejilla relativa al ancho ⇒ razonablemente invariante a resolución ≥ 384; no a fps (τ por fotograma a 4 fps)
- **Norma / referencia**: convención propia calibrada con films reales (docs/handoff/fondo.md); luma Rec.709 (ITU-R BT.709)
- **Rango típico (indicativo)**: negro vacío: 0–1 %; oscuro con profundidad: 1.5–10 %; soporte con textura: 8–40 % (orientativo: contrastar con la fuente; sin calibrar con corpus propio)

## drama

### `drama.peakPos` — Posición del clímax

- **Unidad**: % · **dimensión**: 1 · **clase**: convención · **tipo**: scalar
- **Fuente**: curva de tensión compuesta (series)
- **Definición formal**: τ* = argmax T(τ), τ = t/D ∈ [0,1]. T = min-max de la media de las componentes PIT (cortes, cámara, movimiento, sonoridad, preguntas abiertas)
- **Estimador**: curva remuestreada a N=100 sobre tiempo normalizado
- **Incertidumbre**: intervalo de robustez: mín–máx al quitar cada componente (leave-one-out) — no es un IC estadístico
- **Invariancia / normalización**: tiempo normalizado ⇒ invariante a la duración; resolución/fps no intervienen
- **Norma / referencia**: Freytag 1863; Field 1979; Cutting 2016 (Psychon Bull Rev 23)
- **Rango típico (indicativo)**: drama clásico: 60–85 % (orientativo: contrastar con la fuente; sin calibrar con corpus propio)

### `drama.peakProminence` — Prominencia del clímax

- **Unidad**: 0–1 · **dimensión**: 1 · **clase**: convención · **tipo**: scalar
- **Fuente**: curva de tensión
- **Definición formal**: prom = T(τ*) − max(mín T a la izquierda, mín T a la derecha) (prominencia topográfica)
- **Estimador**: idem
- **Incertidumbre**: leave-one-out
- **Invariancia / normalización**: idem
- **Norma / referencia**: prominencia topográfica (Kirmse & de Ferranti 2017)
- **Rango típico (indicativo)**: sin rango por género establecido

### `drama.peaks` — Nº de picos de tensión

- **Unidad**: n · **dimensión**: recuento · **clase**: convención · **tipo**: scalar
- **Fuente**: curva de tensión
- **Definición formal**: #{máximos locales con prominencia ≥ 0,15}
- **Estimador**: idem
- **Incertidumbre**: leave-one-out
- **Invariancia / normalización**: idem
- **Norma / referencia**: idem
- **Rango típico (indicativo)**: sin rango por género establecido

### `drama.centroid` — Centro de masa temporal de la tensión

- **Unidad**: % · **dimensión**: 1 · **clase**: convención · **tipo**: scalar
- **Fuente**: curva de tensión
- **Definición formal**: τ̄ = ∫τ T dτ/∫T dτ (primer momento); disponibles segundo y tercero (spread, skew) en series
- **Estimador**: suma de Riemann N=100
- **Incertidumbre**: leave-one-out
- **Invariancia / normalización**: idem
- **Norma / referencia**: momentos de una densidad
- **Rango típico (indicativo)**: sin rango por género establecido

### `drama.entropy` — Entropía de la curva de tensión

- **Unidad**: 0–1 · **dimensión**: 1 · **clase**: convención · **tipo**: scalar
- **Fuente**: curva de tensión
- **Definición formal**: H = −Σ pᵢ ln pᵢ / ln N, pᵢ = T(τᵢ)/ΣT. 1 = plana (monótona), 0 = un solo pico
- **Estimador**: Shannon normalizada
- **Incertidumbre**: leave-one-out
- **Invariancia / normalización**: idem
- **Norma / referencia**: Shannon 1948
- **Rango típico (indicativo)**: sin rango por género establecido

### `drama.periodicity` — Periodicidad de la tensión

- **Unidad**: 0–1 · **dimensión**: 1 · **clase**: convención · **tipo**: scalar
- **Fuente**: curva de tensión
- **Definición formal**: ρ = r(k*) con r autocorrelación de T − T̄ y k* el primer máximo local tras el primer cruce por cero; periodo = k*/N·D [s] en notes
- **Estimador**: ACF sesgada
- **Incertidumbre**: leave-one-out; N=100 ⇒ resolución D/100
- **Invariancia / normalización**: idem
- **Norma / referencia**: Cutting et al. 2010 (periodicidad de la atención)
- **Rango típico (indicativo)**: sin rango por género establecido

### `drama.freytagFit` — Ajuste a la pirámide de Freytag (RMSE)

- **Unidad**: 0–1 · **dimensión**: 1 · **clase**: convención · **tipo**: scalar
- **Fuente**: curva de tensión
- **Definición formal**: RMSE mín sobre τ_c ∈ [0,3; 0,9] entre T y la plantilla F(τ; τ_c): 0,15 en τ=0 → 1 en τ_c → 0,2 en τ=1 (lineal a tramos). Menor = más piramidal
- **Estimador**: búsqueda en rejilla de τ_c (paso 0,01)
- **Incertidumbre**: leave-one-out
- **Invariancia / normalización**: idem
- **Norma / referencia**: Freytag 1863 (Die Technik des Dramas); Reagan et al. 2016 (EPJ Data Sci 5)
- **Rango típico (indicativo)**: sin rango por género establecido

### `drama.phases` — Fases dramáticas

- **Unidad**: % · **dimensión**: 1 · **clase**: convención · **tipo**: distribution
- **Fuente**: curva de tensión
- **Definición formal**: exposición [0,τ_on) · ascenso [τ_on,τ*] · descenso (τ*,τ_off] · desenlace (τ_off,1], con τ_on = último τ<τ* con T<0,25 y τ_off = primer τ>τ* con T<0,25
- **Estimador**: umbrales 0,25
- **Incertidumbre**: leave-one-out
- **Invariancia / normalización**: idem
- **Norma / referencia**: Freytag 1863
- **Rango típico (indicativo)**: drama clásico: 0–100 % (orientativo: contrastar con la fuente; sin calibrar con corpus propio)

### `historia.causalLinks` — Proporción de enlaces causales (pero/por lo tanto)

- **Unidad**: % · **dimensión**: 1 · **clase**: semántico · **tipo**: scalar
- **Fuente**: story.json: beats[].link
- **Definición formal**: 100·#{beats con link ∈ {pero, por lo tanto}}/(#beats−1)
- **Estimador**: recuento
- **Incertidumbre**: Wilson
- **Invariancia / normalización**: adimensional
- **Norma / referencia**: regla "pero/por lo tanto" (Parker & Stone 2011); Trabasso & van den Broek 1985 (cadena causal)
- **Rango típico (indicativo)**: sin rango por género establecido

## audio

### `audio.loudness` — Sonoridad integrada

- **Unidad**: LUFS · **dimensión**: [dB] (relativa al fondo de escala) · **clase**: analítico · **tipo**: scalar
- **Fuente**: audio mezclado (data/mix o render en memoria)
- **Definición formal**: I = −0,691 + 10·log₁₀(media con puerta de z), z energía K-ponderada por bloques de 400 ms al 75 %; puertas −70 LUFS y −10 LU
- **Estimador**: ITU-R BS.1770-5 / EBU R128 (dsp.loudness; verificada con tono 997 Hz a −23 dBFS ⇒ −23,0 LUFS)
- **Incertidumbre**: tolerancia R128 ±0,5 LU; resolución del bloque 100 ms; exactitud del estimador < 0,05 LU
- **Invariancia / normalización**: independiente del vídeo; duración: sí (integrada con puerta)
- **Norma / referencia**: ITU-R BS.1770-5; EBU R128 (−23 LUFS ±0,5); streaming ≈ −14
- **Rango típico (indicativo)**: broadcast: -23.5–-22.5 LUFS; streaming: -16–-13 LUFS (orientativo: contrastar con la fuente; sin calibrar con corpus propio)

### `audio.lra` — Rango de sonoridad

- **Unidad**: LU · **dimensión**: [dB] · **clase**: analítico · **tipo**: scalar
- **Fuente**: audio
- **Definición formal**: LRA = P95 − P10 de la sonoridad a corto plazo (3 s) con puertas −70 LUFS y −20 LU
- **Estimador**: EBU Tech 3342
- **Incertidumbre**: ±1 LU para materiales < 60 s
- **Invariancia / normalización**: idem
- **Norma / referencia**: EBU Tech 3342
- **Rango típico (indicativo)**: cine: 10–20 LU; broadcast: 5–10 LU (orientativo: contrastar con la fuente; sin calibrar con corpus propio)

### `audio.truePeak` — Pico verdadero

- **Unidad**: dBTP · **dimensión**: [dB] · **clase**: analítico · **tipo**: scalar
- **Fuente**: audio
- **Definición formal**: TP = 20·log₁₀ max|x₄ₓ|, x₄ₓ sobremuestreo ×4 (sinc ventaneada)
- **Estimador**: BS.1770 Anexo 2
- **Incertidumbre**: ±0,3 dB (interpolador de 24 taps); el AAC añade ≈ +1,5 dB
- **Invariancia / normalización**: idem
- **Norma / referencia**: ITU-R BS.1770-5; EBU R128 (≤ −1 dBTP)
- **Rango típico (indicativo)**: broadcast: -6–-1 dBTP (orientativo: contrastar con la fuente; sin calibrar con corpus propio)

### `audio.plr` — Razón pico/sonoridad (PLR)

- **Unidad**: dB · **dimensión**: [dB] · **clase**: analítico · **tipo**: scalar
- **Fuente**: audio
- **Definición formal**: PLR = TP − I
- **Estimador**: diferencia
- **Incertidumbre**: ⊕ de las dos incertidumbres
- **Invariancia / normalización**: idem
- **Norma / referencia**: EBU Tech 3341; Katz 2007 (Mastering Audio)
- **Rango típico (indicativo)**: música moderna: 6–12 dB; cine: 15–25 dB (orientativo: contrastar con la fuente; sin calibrar con corpus propio)

### `audio.tempo` — Tempo medido

- **Unidad**: BPM · **dimensión**: [B][T⁻¹] · **clase**: estimado · **tipo**: scalar
- **Fuente**: audio (flujo espectral); el tempo declarado se informa en notes
- **Definición formal**: BPM* = argmax_lag R(lag)·w(lag), R autocorrelación de la envolvente de onsets (STFT 1024/256), w prior log-gaussiano en 110 BPM, 60–200 BPM; refinado parabólico
- **Estimador**: Ellis 2007; Scheirer 1998
- **Incertidumbre**: IC = mín(resolución de lag = BPM²·hop/60, cuantiles 2,5–97,5 % de ventanas de 12 s)
- **Invariancia / normalización**: independiente del vídeo; film con rubato ⇒ valor global poco informativo
- **Norma / referencia**: Ellis 2007 (JNMR 36); Scheirer 1998 (JASA 103)
- **Rango típico (indicativo)**: sin rango por género establecido

### `audio.key` — Tonalidad medida

- **Unidad**: categoría · **dimensión**: categórica · **clase**: estimado · **tipo**: categorical
- **Fuente**: audio (cromagrama); la tonalidad declarada de la partitura va en notes
- **Definición formal**: tonalidad = argmax_{raíz,modo} corr(cromagrama, perfil K–S rotado); confianza = r y margen sobre el 2.º
- **Estimador**: perfiles de Krumhansl–Kessler sobre cromagrama FFT 16384 (100–2000 Hz)
- **Incertidumbre**: margen r₁ − r₂ < 0,05 ⇒ ambigua
- **Invariancia / normalización**: idem
- **Norma / referencia**: Krumhansl 1990; Krumhansl & Schmuckler 1986
- **Rango típico (indicativo)**: sin rango por género establecido

### `audio.avSync` — Desfase audio–imagen (mediana)

- **Unidad**: ms · **dimensión**: [T] · **clase**: estimado · **tipo**: scalar
- **Fuente**: audio + eventos visuales (cortes duros, impactos)
- **Definición formal**: δ = mediana(t_onset_audio − t_evento), emparejando el onset más próximo en ±250 ms; + = audio tarde
- **Estimador**: flujo espectral (resolución 10,7 ms, refinada)
- **Incertidumbre**: resolución del salto 5,3 ms; IC = ±1,4826·MAD/√n
- **Invariancia / normalización**: independiente de resolución/fps
- **Norma / referencia**: ITU-R BT.1359-1: detectable si audio temprano > 45 ms o tarde > 125 ms (δ < −45 o δ > +125); aceptable −90…+185 ms
- **Rango típico (indicativo)**: sincronía percibida: -45–125 ms (orientativo: contrastar con la fuente; sin calibrar con corpus propio)

### `audio.r128dev` — Desviación de la sonoridad objetivo

- **Unidad**: LU · **dimensión**: [dB] · **clase**: analítico · **tipo**: scalar
- **Fuente**: audio
- **Definición formal**: ΔL = I − (−23 LUFS)
- **Estimador**: diferencia
- **Incertidumbre**: idem audio.loudness
- **Invariancia / normalización**: idem
- **Norma / referencia**: EBU R128
- **Rango típico (indicativo)**: broadcast: -0.5–0.5 LU (orientativo: contrastar con la fuente; sin calibrar con corpus propio)

## medio

### `medio.type` — Soporte / medio

- **Unidad**: categoría · **dimensión**: categórica · **clase**: semántico · **tipo**: categorical
- **Fuente**: timeline.medium y estilo
- **Definición formal**: medium.support.kind (papel…) o "digital procedural" sin medio
- **Estimador**: lectura directa
- **Incertidumbre**: exacta
- **Invariancia / normalización**: idem
- **Norma / referencia**: docs/MEDIOS.md
- **Rango típico (indicativo)**: sin rango por género establecido

### `medio.grainISO` — Grano (ISO equivalente)

- **Unidad**: ISO · **dimensión**: [ISO] · **clase**: convención · **tipo**: scalar
- **Fuente**: estilo.grade.grain o medio.grain.amount
- **Definición formal**: ISO_eq = 100·(g/0,02)², con g = intensidad de grano. Ley de Selwyn: σ_grano ∝ √ISO ⇒ ISO ∝ σ². g = 0,02 ≡ ISO 100
- **Estimador**: lectura + mapeo
- **Incertidumbre**: el ancla g₁₀₀ = 0,02 es convención (×2 ⇒ ISO ×4)
- **Invariancia / normalización**: idem
- **Norma / referencia**: Selwyn 1935 (granularidad); ISO 6:1993
- **Rango típico (indicativo)**: cine 35 mm: 50–500 ISO (orientativo: contrastar con la fuente; sin calibrar con corpus propio)

## Series temporales (tensión, tempo, movimiento, sonoridad, cámara)

Cada serie se entrega como `v(τ)` en [0,1], τ = (i+½)/100, tras min-max: la **forma** es comparable entre films, la amplitud absoluta no (está en las métricas con unidades). `tension` = media de las transformadas integrales de probabilidad (PIT) de sus componentes disponibles (densidad de cortes σ=2 s, actividad de cámara, velocidad en pantalla, sonoridad momentánea, preguntas abiertas de la memoria), suavizada 1,5 s. Es un **índice compuesto propio, no una norma**; su robustez se acota con leave-one-out. Descriptores: momentos (centroide, dispersión, asimetría), posición y prominencia del pico, nº de picos, entropía normalizada, periodicidad (ACF), ajuste a Freytag, fases. Distancia entre films: L2 (RMS sobre τ) y DTW con banda ±10 % (Sakoe & Chiba 1978), más ρ de Spearman.

## Parámetros de shot

`npm run metrics -- units [film]` lista cada parámetro promovido (F4) con su `unit` y la conversión a magnitud con sentido: `vh` → alto visible (y escala de plano si es un tamaño), `w`/`px` → anchos de pantalla, `s` → s y fotogramas, `safe` → alto visible, `×` → factor.
