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
  lint WARN `fondo.estatico` (> 60 % de la duración) y `fondo.preset_crudo` (> 50 % de shots) en `engine/fondo-lint.mjs`; `fondo_ok:{porque ≥ 20 car.}` en el timeline (esquema actualizado). Mate papel avisa y se justifica con `fondo_ok`.
- **E. Demo**: film `data/fondos_libres/` (shot `shots/FL01.mjs`, código `shots/fondos/burbujas.mjs`). Entrega `out/entregas/fondos_libres.mp4` (12 s, TP −1,9 dBFS) + `fondos_libres.jpg`. Lint SHIP; crítico escrito por el agente (sin nota del usuario).

## Límites
- Un `api.impact` dentro de un shot JS no se ve antes de pintar el fondo: declarar `eventos` con el mismo `at` (el demo lo hace).
- Eventos de objetos animados no existen: pasar x,y por `eventos`.
- `celular` y `acuarela` con parámetros animados recalculan su textura cada cuadro (caro); fbm/deformado/niebla no.
- `fondo.estatico`/`preset_crudo` miden solo lo que pinta `api.fondo` (sin él, el soporte del medio cuenta como fondo constante): TODOS los films sin fondo animado avisarán hasta que se justifiquen o animen.
- El sandbox hereda los huecos de `sandbox.mjs` (mismo realm/hilo; `process.env` se ve vacío, no bloqueado).
- `Math.random` en el código del fondo se rechaza en lint (guardia); en ejecución queda sembrado.

## Falta
- Nota de gusto del usuario sobre el demo y sobre presets/derivación.
- Rediseñar los films existentes (Consta, Veinticuatro, Botella) para derivar/animar sus fondos.
