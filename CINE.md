# CINE — gusto cinematográfico codificado

Lo que el director de fotografía (DP) decide *antes* de que exista una línea de código. Cada regla tiene número y, cuando se puede medir, lo comprueba `engine/lint.mjs`.
Los valores por defecto viven en el style pack (`styles/*.json`); aquí está el *porqué*.

Marca: **[lint]** = lo verifica el lint · **[ojo]** = solo el pase Review-Cine (hoja de contacto).

---

## 0. Por qué esto funciona (el gusto no es un adjetivo)
El gusto cinematográfico = **predicción + un foco + identidad + cuerpo + cierre**. Cada uno es una *sombra medible*; ninguno es el gusto completo.
| mecanismo | qué pasa | proxy en el estudio |
|---|---|---|
| **Predicción y sorpresa dosificada** | anticipación → incumplimiento pequeño → asentamiento; el easing lineal aburre y un pop asusta | `spring` con overshoot corto · firma de ritmo (valle→pico en el beat) · pop/hold **[lint]** |
| **Un foco** | fóvea y memoria de trabajo limitadas | ≤3 tamaños de tipo · un acento · competencia de focos · 60-30-10 **[lint]** |
| **Identidad de objeto** | el ojo sigue identidades, no formas: un objeto que cambia de significado no se reidentifica | `handoffs` + `motif` + `api.morph` **[lint]** |
| **Cuerpo simulado** | un push se siente como acercarse; sin razón, la cámara se siente falsa | `cam.why` en enum cerrado + un eje + velocidad máxima **[lint]** |
| **Cierre** (peak-end, rima) | se recuerda el máximo y el final | energía del último 8 % · primer/último frame dialogan **[lint aviso]** |
Lo que **no** se finge como número: "emoción", "premium", "cine". Eso se descompone o se deja al pase Review-Cine (hoja en grises + strips de los cortes). Si un FIX visual se repite en dos films, deja de ser gusto y pasa a `FUNDAMENTOS.md § Lecciones` y luego a `lint.mjs`.

---

## 1. Antes de cada shot: las 8 preguntas del DP
1. ¿Qué **una cosa** debe mirar el espectador? (sujeto)
2. ¿Qué **cambia** durante el shot? (si nada: es un hold, justifícalo)
3. ¿Qué **tamaño de plano** sirve a la idea? (§2)
4. ¿Dónde vive el sujeto en el encuadre y **hacia dónde mira/se mueve**? (§3)
5. ¿La cámara se mueve? Entonces: **¿por qué?** `cam.why` **[lint]** (§4)
6. ¿Qué queda **quieto** y qué es **violento**? (asimetría de movimiento)
7. ¿Cómo **entra** y cómo **sale**? (relevo por forma / movimiento / escala: `handoffs`) **[lint]**
8. ¿Se entiende **sin sonido y sin leer**? (`must_read_mute`)

---

## 2. Tamaño de plano
| plano | ocupa | dice | úsalo para |
|---|---|---|---|
| ECU (detalle) | 1 rasgo/mecanismo | obsesión, prueba | el dato decisivo, la anomalía |
| CU | el sujeto llena el cuadro | intimidad, foco | introducir la idea, una emoción |
| MS | sujeto + contexto cercano | conversación, relación | comparar dos cosas |
| WS | sujeto pequeño en su mundo | contexto, soledad, escala | revelar estructura, cierre |
| EWS | el mundo; el sujeto es un punto | insignificancia, cosmos | cambio de escala |

Regla: **no encadenes tres planos del mismo tamaño**; alterna (CU → WS = revelación; WS → CU = decisión).
Cambio de escala = *continuidad*, no zoom arbitrario: el objeto que se aleja sigue siendo el mismo (handoff).

---

## 3. Encuadre y composición
- **Puntos de poder**: centro (autoridad, simetría, tensión frontal) o intersecciones de tercios (dinamismo, narrativa). La masa visual (centroide de los `api.focus` ponderado por área) debe caer cerca de uno **[lint · `compose.anchor`]**. `free` para diagramas.
- **Aire**: el sujeto no toca el borde del encuadre útil salvo `bleed:true` **[lint · `edgeMargin` 4 %]**.
- **Espacio negativo**: el sujeto ocupa como máximo `1 − negativeSpace` del cuadro (0,3–0,5 según estilo) **[lint]**. El vacío es composición, no sobra.
- **Lead room**: deja más espacio *hacia donde mira o se mueve* el sujeto que detrás. Un objeto que avanza hacia el borde sin aire se siente atrapado **[ojo]**.
- **Headroom**: sujeto principal por encima de la mitad → deja ~10 % de aire arriba; no lo cortes **[ojo]**.
- **Tres planos**: fondo (`api.depth(0.2–0.35)`), sujeto (1), primer plano (`1.3–1.6`). Con cámara en movimiento el parallax da profundidad sin 3D.
- **Jerarquía de movimiento**: primario 1,0 · secundario 0,4 · ambiente 0,1. Si todo se mueve igual, nada se mueve.
- **Tipo nunca sobre detalle**; dentro de un vacío (`hollow`) sí **[lint]**.
- **Letterbox** reduce el encuadre útil: el layout siempre sale de `api.safe` / `api.at` **[lint · safe area incl. barras]**.

---

## 4. Gramática de cámara (un shot = UN movimiento, con razón)
| movimiento | dice | cuándo | `cam` |
|---|---|---|---|
| **static** | peso, quietud, decisión | tras una revelación; el sujeto ya se mueve | `{move:'static'}` |
| **push** (dolly in) | atención, intimidad, tensión | el dato importante; entrar en el problema | `{move:'push'}` |
| **pull** (dolly out) | contexto, revelación, aislamiento | la estructura que explica lo visto | `{move:'pull'}` |
| **slide / truck** | comparación, viaje, seguir | dos cosas en paralelo; persecución lateral | `{move:'slide',dir:[-1,0]}` |
| **pan** | seguir o revelar a lo largo de un eje | descubrir lo que hay al lado | `{move:'pan',dir:[1,0]}` |
| **tilt** | escala, poder, ascenso | de lo pequeño a lo enorme | `{move:'tilt',dir:[0,-1]}` |
| **rotate** (dutch) | inestabilidad, error | **raro**: cuando algo no encaja | `{move:'rotate'}` |
| **handheld** | urgencia, realismo, cuerpo | un temblor mínimo sobre un push/static | `cam.shake` (≤ 0,3–1 % del ancho) |
| **whip** | corte con movimiento | transición de energía | `cam.whip:true` (exime del límite) |

- **Motivada, con enum cerrado** **[lint]** (el texto libre no cuenta; sin `why` válido → FIX):
  `approach` → push · `reveal` → pull/tilt (el sujeto *encoge*: CU→WS) · `follow` → slide/pan (`dir` = rumbo del sujeto, lead room delante) · `compare` → slide/pan entre dos focos (nunca zoom) · `unease` → rotate/shake, raro.
- **Tras un morph grande, la cámara asienta**: `cam.delay` 0.4–0.8 s **[lint]**. **Un solo plano violento por acto** (whip/rotate/unease; ~8 shots) **[lint aviso]**.
- **Un eje** por shot: push O slide O rotate. Nunca los tres **[lint]**.
- **Continuidad**: `cam.chain:true` arranca donde acabó la cámara anterior (sin salto en el corte ni en un morph) **[lint]**. `cam.recenter:true` aterriza en el centro.
- **Velocidad máxima** (pico, con la curva real) por estilo **[lint]**: zoom `%/s`, paneo `% del cuadro/s`, giro `°/s`. Referencia: cine lento ≤ 10 %/s · editorial ≤ 25 %/s · kinetic ≤ 120 %/s.
- **Un push empuja el texto hacia los bordes**: coloca el tipo con margen o deja que el lint te lo diga (safe area).
- **Curva**: `inOut`/`cinema` para cámara real (arranca y aterriza); `outExpo` para impacto; `linear` solo mecánico/brutalista. Nunca `linear` en movimiento orgánico.

---

## 4b. Transiciones = cambio de significado (taxonomía cerrada, cada una con predicado)
| `transition_out` | qué es | predicado **[lint]** |
|---|---|---|
| `cut` | cambio de idea; el objeto NO cruza | prohíbe handoff del mismo id |
| `morph` | mismo objeto, otra función | handoff declarado + cámara sin salto (`cam.chain`) + `cam.delay` ≥ 0.4 tras él |
| `match` | misma silueta/eje/color-rol, otro objeto | handoff `kind:"match"`: centro, aspecto ±15 %, mismo `role` |
| `wipe-obj` | el sujeto cubre el cuadro y al destaparse es otra cosa | `api.focus` cubre ≥ 80 % del área segura en el último frame |
| `scale-cut` | ECU de un detalle ↔ WS del mundo | `poi_out`/`poi_in` coinciden ±0.06 y hay salto de `size` |
| `hold-cut` | 2–4 fotogramas quietos y corte en la acción | energía quieta 2–4 fotogramas antes del corte |
Cortar en la acción (energía subiendo), no en el reposo **[lint aviso]**. Prohibidas: crossfade, blur-in, brillo que revela, flip 3D (`bans` del estilo).
**Un motivo, tres oficios**: el `motif` del film (`states: [dot, ring, frame]`) avanza un estado por shot o se corta explícitamente **[lint]**. El espectador apuesta ("esto es un punto"); cada beat paga y cambia la apuesta. Si cada shot trae un objeto nuevo, hay catálogo, no historia.
**Morph honesto**: se interpola en el *espacio de la forma*, no en píxeles: `api.morph(from, to, u, {x,y,size})` con catálogo `dot | ring | bar | frame | card | orbit` (dot→ring abre el hueco; ring→frame endereza el radio).

---

## 5. Movimiento de los objetos (oficio)
- **Anticipación → acción → asentamiento**: un muelle con overshoot corto (`ζ≈0,5–0,7` enérgico · `0,8–0,95` sereno). `api.spring(t, 'main'|'soft'|'snap')`.
- **Personalidad = parámetros**: `omega` (velocidad) y `zeta` (rebote). Sereno: ω 8–10, ζ ≥ 0,9 · editorial: ω 14, ζ 0,62 · enérgico: ω 24, ζ 0,48.
- **Stagger**: escalona elementos 35–120 ms (`api.stagger(i)`); nunca todo a la vez.
- **Arcos, no rectas**, salvo mecánico. **Follow-through**: lo secundario llega un poco después.
- **Duraciones** guía: micro 0,2–0,4 s · principal 0,6–1,2 s · revelación de cámara ≥ 1,5 s.
- **Sin muertos**: si el sujeto se queda quieto, algo secundario se mueve (o declara `hold_ok`) **[lint · hold]**. Un pico aislado > 3× la mediana local es un *pop* **[lint]**.
- **Reloj**: en `reel` algo ocurre en cada beat y los cortes caen en downbeat (±1 frame) **[lint]**; en `explainer`/`cinematic` las pausas son parte del ritmo.

- **Firma de ritmo**: valle antes del beat, pico en `on_beat_at` (±1 f) **[lint aviso]**. Un beat que coincide con la entrada por muelle no tiene valle: muévelo.

---

## 6. Ritmo y montaje
- **Cortar en la acción o en el beat**, no en el reposo.
- **Match cut** = mismo objeto/forma/movimiento cruza el corte (`handoffs`) **[lint]**. La transición ideal es que el objeto cambie de significado.
- **Longitud de shot** según perfil **[lint aviso]**: `reel` 1,5–3 s · `explainer` 3–40 s · `cinematic` 2,5–20 s.
- **Respira**: tras una transformación grande, pausa. Después de un clímax, silencio visual.
- **Peak-end y rima** **[lint aviso]**: el último 8 % del film no puede estar más apagado que el percentil 70 (o `end_hold_ok:true`); primer y último frame dialogan (mismo tipo de masa y lugar) sin ser clones (o `rhyme:false`).
- **Tiempo de lectura**: un texto visible necesita `0,4 s + caracteres / cps` (reel 17 · explainer 13 · cinematic 12) **[lint]**. Si no cabe, acorta el texto o alarga el shot; no aceleres la lectura.

---

## 7. Color
- **Valor antes que matiz**: pasa la hoja a escala de grises; el sujeto debe leerse. **[ojo]**
- **60 – 30 – 10**: 60 % papel · 30 % tinta/sombra · 10 % acento. Un solo acento por escena.
- **Un acento principal** + un segundo solo si *significa* otra cosa. En `explainer` el color es lenguaje: una categoría = un color durante todo el film.
- **Neutros teñidos**: nunca `#000`/`#fff` puros como superficie (papel oscuro L≈0,06–0,16, claro L≈0,95–0,97) **[lint aviso]**.
- **Contraste**: tinta/papel ≥ 7:1 (mín. 4,5) · acentos ≥ 3:1 **[lint]**.
- **Croma acotado** por estilo (`rules.maxChroma`): en oscuro, croma más bajo y luminosidad más alta; el neón es la excepción declarada **[lint aviso]**.
- **Temperatura**: sujeto cálido sobre fondo frío (o al revés) separa planos sin más contraste.
- **Armonías** (`style.mjs --palette --scheme`): *complementary* (tensión, marca fuerte) · *analogous* (calma) · *split* (viveza controlada) · *triad* (juego) · *mono* (elegancia).
- **Semántica persistente**: la anomalía siempre del mismo color.

---

## 8. Tipografía
- **Una familia, 1–2 pesos** **[lint aviso en `style --check`]**. Escala modular: `scale` 1,25–1,8 → roles `label · body · h2 · h1 · display` (`api.text(..., {role})`).
- **Máx. 3 tamaños a la vez** **[lint]**.
- **Tracking**: mayúsculas +0,06–0,15 em · titulares enormes −0,01 a −0,03 em · cuerpo 0.
- **Serif** = editorial/lujo/rigor · **sans** = neutral/producto · **mono** = técnico/crudo.
- **El texto es un objeto del mundo**: entra con su sujeto, se mueve con la cámara (o `screen:true` si es HUD). Nunca subtítulo permanente.
- Mínimos legibles por perfil **[lint]**; `label` puede bajar un 40 %.

---

## 9. Luz y atmósfera en 2D
- **Viñeta** 0,3–0,55 en estilos oscuros dirige la mirada al centro.
- **Grano** 0,02–0,07 unifica capas y quita el aspecto "vector"; cambia cada fotograma a 24 fps, determinista.
- **Glow** solo como *fuente de luz* del sujeto (`api.glow`), no como decoración. Se desactiva solo si el estilo lo prohíbe.
- **Degradado** solo si el estilo lo permite (`api.gradient` devuelve sólido si no).
- **Letterbox** 2,0–2,39 da sensación de cine; reduce el cuadro útil (el lint lo tiene en cuenta).
- **Fundidos** de entrada/salida de la *pieza* (no entre shots) en estilos cinematográficos.
- **No apiles**: máximo dos de {viñeta, grano, glow, letterbox} protagonistas; el resto, sutil.

---

## 9b. Pseudo-3D con imagen 2D (relieve fingido; no hay motor 3D)
Capas, no escena, y siempre registrando `api.focus` en 2D (el lint de composición entiende cajas, no mundos):
1. **Parallax** `api.depth` (fondo 0.25 · sujeto 1 · primer plano 1.4).
2. **Luz como vector**: `light.az` (en el style pack) es UN azimut para todo el film. Con `light.enabled`, `api.morph` añade **sombra de contacto** (cae opuesta a la luz) y **brillo de borde** del lado de la luz. Sin sombra el objeto flota.
3. **Suelo** `api.ground(fy)`: plano que ancla y se mueve distinto (parallax 0.6).
4. **Billboard** `api.billboard(x,y,θ,fn)`: giro en Y fingido con `scaleX = cos θ`, tope 35°.
No construyas cubos con puntos de fuga por shot. *No implementado (a pedido del motivo):* turntable de 8–12 ángulos y dolly-zoom.

## 9c. Stop-motion = cuantizar el tiempo, no otro motor
`motion.stepFps` (12 = tráiler táctil, 8 = muñeco, 4 = flipbook) cuantiza `t` **solo en el dibujo** (el reloj sigue siendo determinista); el muelle rebota a saltos. `motion.smear` (0.04–0.08) estira 1 frame el sujeto en el eje de su velocidad (`api.smear`). Grano y viñeta algo más altos, cámara con trípode humano (`shake` ≈ 0.0008). El "muerto" de 2 frames *es* el estilo: `rules.holdEnergy`/`popRatio` se ajustan **por pack**, no por shot. Si el morph es un lerp de alpha, el fps bajo solo se ve barato: el motivo debe ser sólido.

---

## 10. Anti-patrones (los detecta el lint o el Review-Demo)
Crossfade entre ideas · blur-in · brillo que "revela" · flip 3D · partículas de stock · glow decorativo · tipo centrado sobre degradado · easing uniforme en todo · zoom constante · cámara sin razón · texto que no da tiempo a leer · sujeto pegado al borde · cuatro tamaños de tipo · paleta de veinte colores · el mismo plano tres veces · un "logo final" sobre degradado.
