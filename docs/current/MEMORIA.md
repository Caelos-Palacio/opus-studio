# MEMORIA — la capa conceptual que dirige la edición

`data/memoria.json` (esquema `data/memoria.schema.json`) · `engine/memoria.mjs` · tests `test/memoria.mjs` ·
fixture canónico `test/fixtures/memoria/` ("regla que se adapta").

## 1. Qué son aquí los "metadatos"

Son **lo que una persona piensa cuando recuerda un vídeo**. No son un resumen ni etiquetas de fotogramas. Son
conceptos que **conviven, se modifican entre sí y cambian con el tiempo**.

Ejemplo de referencia: **Sukuna contra Mahoraga**. Mientras mira, el espectador cree que cada corte de Sukuna
**hiere** a Mahoraga y que Sukuna va ganando. Sobre la cabeza de Mahoraga gira una rueda, que parece un adorno.
Después llega la revelación: *Mahoraga se adapta*. Ese concepto, que aparece en t≈40, **reinterpreta hacia atrás**
el tramo [5,20]. Lo que parecía daño era aprendizaje, y la rueda era un contador. Al final, el espectador no
recuerda los golpes tal como los vio, sino tal como los entiende ahora. Ese recuerdo final es lo que debe dirigir la
edición. El objetivo es el **asombro** (`docs/history/research/04-asombro.md`: un modelo mental que se rompe y se
reconstruye), no una animación correcta "tipo PowerPoint".

En el estudio hay dos capas que **nunca se mezclan**:

| capa | fuente | qué dice | quién la escribe |
|---|---|---|---|
| **observada** | `engine/index.mjs` → `out/index/<film>/` | qué hay en pantalla: cajas, textos, símbolos, cámara, paleta | se calcula a partir de los píxeles |
| **conceptual** | `data/memoria.json` | qué recuerda, cree, siente y espera el espectador, y cómo cambia | el Director (`roles.json`: solo `director` escribe `data/**`) |

El índice observado solo guarda un **puntero** a la memoria (`film.json → memoria: {src, hash, conceptos}`).
`q memoria [t]` muestra las dos capas en secciones separadas.

## 2. Modelo

```
concepto  {id, label, kind: entidad|regla|pregunta|tensión|revelación|emoción|motivo|tema,
           saliencia 0..1, vidaMedia?, planta?, anclas[], refuerzos[], estados[], abre?, resuelve?{t,por}}
estado    {t:[a,b], lectura, siente?, espera?}       ← lo que el espectador cree/siente/espera en ese tramo
ancla     {shot? | t? | entidad? | param? (/shots/<id>/params/<nombre>), rol?, base?, rango?}
relacion  {tipo: causa|depende|contradice|reinterpreta|revela|escala|rima|resuelve|prepara, de, a, t?, why}
giro      {id, en, por, objetivo, tramo:[a,b], antes, despues, why}   ← reinterpretación retroactiva
```

Las anclas son **punteros verificables**: un shot del timeline, un tramo de tiempo, una entidad (handoffs, estados
del motivo, `entities` de los shots) o un parámetro con la ruta del contrato de capas. Un ancla `param` con `rol` es un
**mando**: le dice a la dirección qué parámetro puede mover ese concepto.

### Peso de memoria (decaimiento y refuerzo)
Cada huella de un concepto aporta `s·2^(−Δ/h)`:
- `s` es la saliencia.
- `h` es la vida media, global o propia del concepto.
- `Δ` es el tiempo transcurrido desde la última vez que se vio. Mientras el concepto está en pantalla, `Δ = 0`.

Las huellas son las presencias en pantalla (unión de las anclas a shots y tramos), los `refuerzos`, las relaciones
percibidas en `t` y los giros. Se combinan como probabilidades independientes de recordar:
`peso = 1 − Π(1 − cᵢ)`. Por eso **volver a aparecer refuerza** y el olvido es gradual. Además:
- **Piso**: lo que ya se vio nunca baja de `piso·s`.
- **Zeigarnik**: una pregunta o tensión abierta **no decae** hasta que se resuelve.
- **Recordar**: un giro también es un recuerdo, así que refuerza al concepto que reinterpreta.

### Lecturas: en vivo y recordada
- **En vivo** (`estado(t).activos[].lectura`): lo que el espectador cree *en* t. Antes de un giro no hay spoilers.
  Después del giro, la lectura nueva sustituye a la vieja, y su expectativa también.
- **Recordada** (`estado(t).recuerdo`, `final()`): cómo relee en t cada tramo pasado, con los giros ocurridos hasta t
  ya aplicados. Con t igual a la duración se obtiene la **memoria al final**.
- **Pendientes** (`estado(t).pendientes`): los giros futuros que cambiarán algo que el espectador ya vio. Es lo que el
  director sabe y el espectador todavía no (ironía dramática).

## 3. CLI

```
npm run memoria -- en 15                   # qué recuerda/cree/espera el espectador en t=15
npm run memoria -- final                   # memoria al final (todas las reinterpretaciones aplicadas)
npm run memoria -- por qué golpes          # causas (←), efectos (→), lectura en vivo vs recordada, giros, anclas, ops
npm run memoria -- reinterpreta            # giros: antes → ahora, y por qué
npm run memoria -- lint                    # lint conceptual; exit 1 si hay FIX
npm run memoria -- capa                    # capa de dirección (stdout); --write [ruta] la escribe (por defecto data/layers/memoria.json)
npm run memoria -- capa --write --check    # ¿la capa en disco está al día con la memoria? (exit 1 si está caducada)
node engine/q.mjs memoria [t]              # capa observada y capa conceptual, en secciones separadas
node engine/q.mjs shot A3                  # ficha observada, más los conceptos anclados a A3 (sección aparte)
# opciones: --mem <memoria.json> (o env OPUS_MEMORIA)  --timeline <timeline.json>  --json
```

## 4. Cómo dirige la edición

La memoria **produce intenciones de edición**, y estas se convierten en una **capa de overrides** con el contrato de
`docs/PARAMS.md`: `{name, priority?, ops: RFC6902[]}` en `data/layers/*.json`. Las reglas son **declarativas**. El
motor solo conoce cinco disparadores cerrados. `memoria.json → direccion.reglas` puede cambiar sus parámetros (mismo
`id`), desactivarlas (`off`) o añadir reglas de esos tipos.

| regla | disparador | rol del mando | qué pide |
|---|---|---|---|
| `escala-intensidad` | relación `escala` | intensidad / tamaño / ritmo | `base·(1+ganancia·k)`, donde k es el paso en la cadena de escaladas (S5 ×1,5 → S6 ×2) |
| `giro-eco` | reinterpretación | eco | un callback visual a los planos releídos, `[{ref:/shots/S2, tramo, concepto, giro, fuerza}]`. La fuerza es `1 − peso` del objetivo justo antes del giro: **cuanto más olvidado, más fuerte** |
| `giro-hold` | reinterpretación | hold | sostener 0,6 s para que el espectador relea |
| `rima-eco` | relación `rima` | rima | repetir la forma o el tiempo del plano anterior |
| `pregunta-retencion` | pregunta con `resuelve` | retencion | no revelar la respuesta antes de `resuelve.t` (segundos dentro del shot) |
| `peso-enfasis` | peso con decaimiento | enfasis | el énfasis sigue el peso de memoria a mitad del shot |

Garantías:
- **Explicable**: cada op lleva `why` (sin plantillas sin rellenar), `concepto` (el origen) y `regla`. RFC 6902 ignora
  los miembros extra, así que la op sigue siendo válida.
- **Determinista**: no usa reloj ni azar y ordena por claves estables. Barajar el orden de la memoria da los mismos
  bytes (lo comprueba un test golden: `test/fixtures/memoria/adapta.layer.json`).
- **Nunca inventa**: si una regla quiere actuar y el concepto no tiene un mando con ese rol, aparece como
  **intención sin parámetro**, visible en `capa` y en `por qué`, pero no genera op.
- **Conflictos**: si dos reglas apuntan a la misma ruta, gana la de mayor prioridad. Si empatan, decide el orden de
  id, luego el de concepto y luego el de why. La perdedora se informa. Si la misma regla apunta dos veces a la misma
  ruta, los valores se funden: los callbacks se acumulan en una lista.
- **Gobernanza**: `capa` no genera nada si el lint conceptual está en FIX, y `--check` detecta si la capa en disco
  está caducada. Las ops son `add` (crea o reemplaza el miembro), y su padre `/shots/<id>/params` debe existir.

Ejemplo del fixture (`npm run memoria -- capa --mem test/fixtures/memoria/adapta.memoria.json`):
```
add /shots/S5/params/eco = [{"ref":"/shots/S2",…,"giro":"aprendizaje","fuerza":0.282},{"ref":"/shots/S1",…,"giro":"reloj","fuerza":0.689}]
    giro-eco · adaptacion: giro aprendizaje en t=40: «adaptacion» relee «golpes» [5,20] → callback visual a S2 (fuerza 0.282: …)
add /shots/S5/params/escala = 1.5      escala-intensidad · adaptacion: «adaptacion» escala «golpes» (paso 1): intensidad ×1.5 …
add /shots/S5/params/revelar_en = 8    pregunta-retencion · por-que-gira: … retener la respuesta hasta t=40 (8s dentro de S5)
add /shots/S6/params/intensidad = 2    escala-intensidad · amenaza: «amenaza» escala «adaptacion» (paso 2) …
```
La rueda (saliencia 0,5, poco reforzada) está más olvidada que los golpes, así que su callback es más fuerte.

## 5. Lint conceptual (verificable, no juicio)

| problema | nivel |
|---|---|
| ancla rota: shot, entidad o param inexistente (con "¿quisiste decir…?") | FIX |
| param de un shot que aún no expone params (no se puede verificar) | WARN |
| concepto huérfano (sin anclas; FIX si además no tiene relaciones) | FIX / WARN |
| **payoff sin setup**: el giro relee un tramo donde el objetivo nunca se vio, o relee el futuro; o una `revelación` que no relee nada plantado | FIX |
| pregunta abierta nunca resuelta, o resuelta después del final (salvo `abiertaAPropósito: "<por qué>"`) | FIX |
| **setup sin payoff**: `planta: true` sin giro, rima ni revelación posterior | WARN |
| ciclo causal (`causa`, y `depende` invertido) | FIX |
| relaciones o giros que apuntan a conceptos inexistentes, tiempos fuera del film | FIX |

## 6. El demo (A1–A3)

"UNA IDEA → CAMBIA DE FORMA → Y REVELA OTRA". Lo que el espectador **recuerda** al final no es "un punto, un anillo y
un marco". Es esto: *la idea no era una cosa, era una manera de mirar*. El giro `semilla` (t=4,7, provocado por
`marco`) relee el punto de A1. El giro `hueco` relee el anillo de A2: no se estaba deformando, se estaba abriendo para
dejar sitio. La pregunta `identidad` ("¿sigue siendo la misma idea?") se abre en t=2,3 y la resuelve el marco.
`latido` es una rima: el tick de acento de A3 repite el pulso del punto en A1.

Mandos reales (params de `shots/A3.mjs`, ver `docs/PARAMS.md`), reconciliados con los nombres provisionales:

| concepto | rol | param real | antes (provisional) |
|---|---|---|---|
| `marco` | intensidad | `/shots/A3/params/pulse` (base 0,2, rango [0,2 · 0,6]) | `escala` |
| `identidad` | retencion | `/shots/A3/params/textIn` (base 0,7 s) | `retardo_texto` |
| `marco` | eco, hold, rima | ninguno todavía: A3 no expone un param numérico equivalente | `eco`, `hold`, `acento` |

Los params del contrato son numéricos, de color, texto o enum, y aceptan constantes, `$sig` o `$expr`. Los callbacks de
`eco` y `rima` son listas, así que no caben. Esos mandos se retiraron del demo para no inventar nada. Sus reglas aparecen
como **intención sin parámetro** en `capa` y en `por qué`. Cuando A3 exponga p. ej. `hitAt` o un hold, basta con volver
a anclarlos en `memoria.json`.

La capa `data/layers/memoria.json` está generada (`npm run memoria -- capa --write`), `node engine/params.mjs check` la
acepta y `capa --write --check` la da por vigente. Para que la capa pueda hacer `add` de params, A3 declara
`"params": {}` en `data/timeline.json`. Las ops llevan `why`, `concepto` y `regla`, y `data/timeline.schema.json` ya
los admite en las ops de capa. El golden de píxel se renderiza con `OPUS_LAYERS=none` (película base): la capa de
memoria cambia a propósito el demo (`pulse` 0,2 → 0,3 en A3) sin mover el golden del motor.

## 7. Pendiente
- Exponer en A3 mandos para `eco`, `hold` y `acento` (hoy son intenciones sin parámetro) y poner `capa --check` en un gate.
- Lint dramático (F5, `engine/arc.mjs`): cruzar la curva de energía observada con el peso conceptual. Por ejemplo,
  comprobar que el pico de asombro coincide con el giro de mayor peso.
- Que el crítico (juicio) reciba `memoria final` como contexto: debe juzgar si el giro se siente, no si existe.
