# 021 — Fondos libres: parámetros animables, capa `codigo`, fondo reactivo y anti-menú

## Intención (usuario, 2026-10-11)
Preocupa la RIGIDEZ de los fondos (spec 014). Diagnóstico:
1. Los presets se escribieron para un film concreto (`porque`: «Consta es un expediente», «Botella es una carta»): los agentes eligen de un menú
   en vez de diseñar. Los 8 shots de Consta usan `expediente_kraft` y todo Veinticuatro `cuba_oscura`: un fondo único por film.
2. `anim` solo permite alfa, escala, dx y dy: no se animan colores ni parámetros por momento del relato. Botella pide pasar de gris-verde turbio a
   azul claro en el giro y hoy eso no se puede expresar.
3. El vocabulario está cerrado (23 tipos con rangos fijos) y no hay vía para escribir un fondo propio en función de t.
4. El fondo no reacciona a la escena: impactos, gotas o tinta no le afectan.
Contraste: un agente aislado que dibuja sus fondos con código libre. Esta spec da al motor esa libertad SIN perder determinismo, sandbox ni hash.

## Traducción a medibles
| pieza | medible |
|---|---|
| A. Valores animables | cualquier parámetro de capa (número, color, par, lista de colores, enum, bool) acepta `{"expr":"…"}` (variables `t lt u dur beat`; funciones `pulso desde hasta paso cuenta` además de las de expr.mjs) o keyframes `{"k":[[x,v],…],"ease":…,"eje":"lt\|t\|u\|beat","en":"ancla"}`. Colores interpolan en OKLab (`mix`). Todo determinista |
| Anclas | `en:"giro"` desplaza los keyframes al instante de un evento del film: beat del story (`b4`), cue de escena, impacto (sfx / nodo `impact`) o evento declarado en el fondo (`eventos:[{id:"giro",at:6}]`). Ancla inexistente = error con «¿quisiste decir…?» |
| B. Capa `codigo` | `{tipo:"codigo", archivo:"fondos/x.mjs", params:{…}, maxMs}`: función pura `(ctx, t, E)` (export default) en `shots/fondos/`. Carga en el sandbox de shots, pasa la misma guardia AST (`scanSource`), entra en el hash por contenido (`shotDeps`), sin sandbox ⇒ error (falla cerrada), coste medido: aviso `fondo.codigo_lento` si > `maxMs` por cuadro |
| C. Fondo reactivo | capas `onda`, `mancha`, `pulso` suscritas a eventos (`evento:"impacto"`); funciones de expresión `pulso('impacto',0.4)`… sirven para animar CUALQUIER capa con los eventos. Función pura de t y de la lista de eventos, sin estado entre cuadros |
| D. Anti-menú | `porque`/`resumen` de presets genéricos (tema, sin nombres de films) y rotulados «ejemplo de partida»; `tools show <preset>` enseña cómo derivarlo (ajustes, sin, capas, keyframes); lint WARN `fondo.estatico` (mismo fondo sin variación animada en > 60 % de la duración) y `fondo.preset_crudo` (preset sin ajuste en > 50 % de los shots), justificables con `fondo_ok:{porque}` en el timeline |
| E. Demo | clip ~12 s (`data/fondos_libres/`): fondo turbio → claro en el beat «giro», 2 impactos que lo sacuden, una capa `codigo`. Entrega `out/entregas/fondos_libres.mp4` + hoja `.jpg` |

## Diseño

### A. Valores
- Forma dinámica = objeto plano con `expr` (texto) o `k` (lista). No colisiona con los colores objeto (`{mezcla}`, `{paleta}`): `mezcla:[a,b,u]` admite `u` dinámico.
- `k:[[x,v],…]` con `x` ascendente. Eje `eje`: `lt` (s locales del shot, por defecto), `t` (s del film), `u` (0..1 del shot), `beat` (beats musicales del film).
  Con `en`, `x` es relativo al ancla (en la unidad del eje): `{"k":[[-1,"#6b7a68"],[1.5,"#bcd8ee"]],"en":"giro"}` = turbio hasta 1 s antes del giro, claro 1,5 s después.
  `ease` (core.mjs EASE; por defecto `smooth`) por tramo. Antes del primero y después del último se mantiene.
- Interpolación según el tipo del parámetro: `num`/`par` lineal; `int` redondeado; `color`/`colores` OKLab (rol, #hex, {mezcla}, {paleta} se resuelven a hex y se mezclan);
  `enum`/`bool` escalón (valor del keyframe anterior).
- Expresiones: `t lt u dur beat` + `pulso(sel,tau)` (Σ e^(−edad/tau) de los eventos pasados), `desde(sel)` / `hasta(sel)` (s desde el último / hasta el próximo, 999 si no hay),
  `paso(sel,dur)` (0→1 suave desde el primer evento `sel`), `cuenta(sel)` (eventos ya ocurridos). `sel` = tipo (`impacto`, `cue`, `beat`) o id (`giro`, `b4`, `K01:impacto0`), con `*` final.
- Las texturas pesadas (ruido, niebla) se cachean SIN color: el campo se calcula una vez y el color se aplica por cuadro; los memos usan la clave estructural (sin colores).

### Eventos
`film.eventos` (loadFilm): sfx `impact` del timeline, nodos `impact` y `cues` numéricos de los `.scene.json`, beats del story (`id`, `t`). El fondo añade los suyos
(`eventos:[{id?, tipo?, at, x?, y?, fuerza?}]`, `at` en s locales del shot, x/y fracciones del cuadro): es la vía para shots JS (usar el mismo `at` que en `api.impact`).

### B. Capa `codigo`
- Fichero: `shots/fondos/<nombre>.mjs`, `export default function (ctx, t, E) {…}`. Solo importa núcleo puro (`../../engine/core.mjs`…).
- `E` (congelado): `W H k t lt u dur beat seed p` (params resueltos, animables) `pal hex(c) mix(a,b,u) eventos pulso desde hasta paso cuenta`.
- Corre bajo `sb.run`: `Date` congelado, `Math.random` sembrado, sin red/proceso/timers; la guardia rechaza en lint `fs`, `fetch`, `Date.now`, `Math.random`, `eval`…
  Un módulo rechazado NO se carga; dibujar su capa lanza el motivo (falla cerrada), igual que si falta el proveedor (`E.codigo`).
- Coste: `maxMs` (30 por defecto) por cuadro; lint mide 8 cuadros y avisa `fondo.codigo_lento`.

### C. Capas reactivas (`engine/fondo-reactivo.mjs`)
`onda` (anillos que se expanden desde x,y del evento), `mancha` (tinta/gota que crece y persiste), `pulso` (lavado o foco que se apaga). Parámetro `evento` = selector.

### D. Anti-menú
- Presets reescritos por TEMA; `resumen`/`porque` empiezan «Ejemplo de partida:» y no nombran films. `meta.derivar` y la ficha de `tools show` muestran 4 recetas de derivación.
- Lint (paso `fondo`, film entero): familia de fondo por shot (preset, o hash de tipos de capa; sin `api.fondo` = soporte del medio). Variación animada = algún valor dinámico, `anim`, capa reactiva o `codigo`.
  `fondo.estatico`: una familia sin variación en > 60 % de la duración. `fondo.preset_crudo`: preset sin `ajustes`/`sin`/`capas` en > 50 % de los shots con fondo.
  `fondo_ok:{porque}` (≥ 20 caracteres) en el timeline justifica ambos (Mate papel: el soporte constante ES la metáfora).

## Escenarios (BDD)
[M] máquina (`test/fondos-libres.mjs`); [H] juicio humano.
1. [M] Keyframes numéricos: valor en el medio de dos keyframes = lerp con la curva; antes/después se mantiene.
2. [M] Keyframes de color: el punto medio coincide con `mix` OKLab de los extremos (no con la media RGB) y admite roles de la paleta.
3. [M] `en:"giro"` desplaza los keyframes al instante del evento; ancla inexistente falla con «¿quisiste decir…?».
4. [M] `expr` con `t`, `u`, `beat`; rotas fallan en validación con ruta; `pulso/desde/paso/cuenta` leen eventos.
5. [M] Determinismo: mismo spec+semilla+eventos+t ⇒ mismos píxeles, también tras pintar otros t; un fondo con color animado cambia entre t y coincide en el mismo t.
6. [M] Un color animado en `fbm` no recalcula el campo de ruido por cuadro (caché estructural).
7. [M] Eventos: `onda`/`mancha`/`pulso` no pintan antes del evento, pintan tras él y se apagan; dos eventos ⇒ dos ondas; sin estado entre cuadros (orden de pintado irrelevante).
8. [M] `codigo`: pinta con el proveedor; sin proveedor lanza (falla cerrada); la guardia rechaza `node:fs`, `fetch`, `Math.random`, `Date.now`; el sandbox congela Date y bloquea red en ejecución.
9. [M] El hash del shot cambia al cambiar el contenido del fichero `codigo` referenciado.
10. [M] El coste se mide y `maxMs` excedido produce el aviso.
11. [M] Presets: sin nombres de films en `porque`/`resumen`; `resumen` ≤ 15 palabras; `tools show` enseña a derivar.
12. [M] Lint `fondo.estatico` y `fondo.preset_crudo`: se disparan con un film estático/crudo, no con uno animado/ajustado, y `fondo_ok` los justifica (Mate papel).
13. [M] Compatibilidad: todos los fondos de la spec 014 siguen validando y pintando los mismos píxeles (suite fondos); cobertura DSL intacta.
14. [H] El demo se lee como un fondo que VIVE con el relato (turbio→claro, golpes, código propio) y no como un menú.

## Fuera de alcance
- Estado entre cuadros (simulación de fluidos acumulativa): las capas reactivas son funciones cerradas de t y eventos.
- Eventos descubiertos en ejecución (un `api.impact` dentro de un shot JS no se ve antes de pintar el fondo): declarar `eventos` con el mismo `at`.
- Eventos de objetos animados (posiciones de `api.objeto`): se pasan como x,y en `eventos`.
- Aislamiento total (worker_threads): hereda los huecos documentados en sandbox.mjs.

## Calificaciones
(sin nota todavía; el demo `out/entregas/fondos_libres.mp4` espera la del usuario)
