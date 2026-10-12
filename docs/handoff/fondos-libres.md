# Handoff — fondos libres (spec 021)

Rama `fondos-libres` (desde main). Spec: `docs/specs/021-fondos-libres.md`. Suite: `test/fondos-libres.mjs` (67 comprobaciones, registrada en `test/suites.d/fondos-libres.json`).

## Qué cambió
- **A. Valores animables** (`engine/fondo-valor.mjs`, puro): cualquier parámetro de capa acepta `{"expr":"…"}` (`t lt u dur beat` + `pulso/desde/hasta/paso/cuenta`)
  o keyframes `{"k":[[x,v],…],"ease","eje":"lt|t|u|beat","en":"ancla"}`. Colores en OKLab (`color.mix`), enum/bool escalón, int redondeado. `en` ancla a eventos
  (beat del story, cue de escena, impacto, o `eventos:[{id,at}]` del fondo). Ancla inexistente = error con «¿quisiste decir…?».
  Caché: en capas con valores animados el campo de ruido/niebla se memoriza SIN color (`L.memo`) y el lienzo se repinta (`L.texDin`); los memos usan `L.sp` (clave estructural sin colores).
  La caché del fondo ya no hace `clear()` a 64 entradas: expulsa las más antiguas hasta 192. Píxeles de los fondos 014 idénticos (comprobado A/B contra main en los 10 presets).
- **B. Capa `codigo`** (`engine/fondo-libre.mjs`): `{tipo:"codigo", archivo:"fondos/x.mjs", params, maxMs}`; fichero `shots/fondos/x.mjs` con `export default function (ctx, t, E)`.
  `film.mjs#cargarCodigoFondos`: pasa `scanSource` (FIX ⇒ no se carga), se importa con el hook del sandbox y corre bajo `sb.run`; sin proveedor (`E.codigo`) la capa lanza (falla cerrada).
  Hash: `shotDeps` incluye los ficheros `archivo:` referenciados (y el story si hay anclas/eventos). Guardia en lint: `scanFondoCodigo`. Coste: medido en ejecución (`film.codigoCoste`) y en lint (`fondo.codigo_lento`, mediana de 8 cuadros a resolución real).
- **C. Reactivo**: capas `onda`, `mancha`, `pulso` + funciones de expresión sobre eventos. `film.eventos` (`engine/fondo-eventos.mjs`): sfx `impact`, nodos `impact` y cues numéricos de `.scene.json`, beats del story; `fondo.eventos` añade los suyos.
- **D. Anti-menú**: presets reescritos por tema («Ejemplo de partida: …», sin films); `tools show <preset>` muestra `derivar:` (ajustes, keyframes con ancla, expr, sin, capas); guía `fondo_libre`;
  lint WARN suave `fondo.estatico` (> 80 % de la duración, solo si el film declaró fondo) y `fondo.preset_crudo` (> 50 % de shots) en `engine/fondo-lint.mjs`; `fondo_ok:{porque ≥ 20 car.}` en el timeline (esquema actualizado). Mate papel avisa y se justifica con `fondo_ok`.
- **E. Demo**: film `data/fondos_libres/` (shot DSL `shots/FL01.scene.json` → FL01.mjs, nativo en dsl-coverage; código `shots/fondos/burbujas.mjs`). Entrega `out/entregas/fondos_libres.mp4` (12 s, TP −1,9 dBFS) + `fondos_libres.jpg`. Lint SHIP; crítico escrito por el agente (sin nota del usuario).

## Arreglos tras `--full` (4 fallos)
1. hash/grafo-vivo: `closure()` sigue las referencias `archivo:"fondos/x.mjs"` de los shots (burbujas.mjs ya está en el cierre y en `shotDeps`).
2. dsl-cov C7: FL01 reescrito como escena DSL y declarado `nativo` (94,2 % → 95,7 %).
3. dsl-cov C8b: cambio intencional de guard.mjs (`scanFondoCodigo`); el test se afina, no se silencia (ver spec 021, «Cambios en líneas base»).
4. motor M10 (lint en frío con precalentamiento): la máquina estaba a carga 35–40 (otras ramas corriendo suites); se vuelve a correr sola, ver resultado abajo.
- `eventosDeFilm` fusiona un nodo `impact` con el sfx `impact` del mismo shot a < 50 ms (un solo evento por golpe).

## Ronda 2 (flexibilizar + arreglos de `--full`)
- `fondo.estatico`: umbral 80 %, solo con fondo declarado, texto «sugerencia / considera animar…»; `fondo.preset_crudo` también como sugerencia. Tests E3/E4/E5 y F1 adaptados.
- orquestación `orch: sim` volvía a 74/74 (el FIX venía de `fondo.estatico` sobre el medio por defecto, que ya no aplica).
- dsl-cov C8b: `git diff --numstat` vacío (sandbox sin cambios) daba `undefined`; ahora cuenta 0/0.
- fondos-libres D5: el detalle del check ya no imprime líneas `✗ sandbox:` (se rotulan `·`).
- STATUS.md regenerado con `node engine/status.mjs`; demo re-renderizada tras la reescritura de FL01.

## Límites
- Un `api.impact` dentro de un shot JS no se ve antes de pintar el fondo: declarar `eventos` con el mismo `at` (el demo lo hace).
- Eventos de objetos animados no existen: pasar x,y por `eventos`.
- `celular` y `acuarela` con parámetros animados recalculan su textura cada cuadro (caro); fbm/deformado/niebla no.
- `fondo.estatico`/`preset_crudo` son SUGERENCIAS (petición del usuario: «no seas tan rígido con el fondo estático»): WARN, nunca FIX, no bloquean gate/master/orquestación. Miden solo lo que pinta `api.fondo`; sin fondo declarado (medio por defecto) no aplican.
- El sandbox hereda los huecos de `sandbox.mjs` (mismo realm/hilo; `process.env` se ve vacío, no bloqueado).
- `Math.random` en el código del fondo se rechaza en lint (guardia); en ejecución queda sembrado.

## Falta
- Nota de gusto del usuario sobre el demo y sobre presets/derivación.
- Rediseñar los films existentes (Consta, Veinticuatro, Botella) para derivar/animar sus fondos.
