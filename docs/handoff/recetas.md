# Handoff — recetas (spec 016: el agente llena huecos, no escribe todo el código)
Rama `recetas`, sin push. Estado: implementado con tests (`node test/recetas.mjs`, registrado en test/run.mjs); falta integrar y el enganche con `fondos`.

## Qué hay
- `data/recetas/*.receta.json`: 17 recetas (8 plano, 6 movimiento, 3 transición) + `_base` interna. Formato `{meta, scene}` (plano/transición) o `{meta, mod}` (movimiento). ≤ 25 líneas, ≤ 4 params, `$hueco` como cadena `"$hueco: qué va aquí"` (literal: cabe en el esquema estricto del DSL, que no admite objetos `{"$hueco":…}`; desviación menor de la spec).
- `engine/recetas.mjs`: `scaffold`, `aplicarMov`, `huecos`, `incidencias` (lint), `repeticion`, `oleadaIgual`, `medirAhorro`, CLI (`shot|list|show|medir|audit`). `engine/opus.mjs new …` y `npm run new -- shot …` delegan en él.
- Comando: `node engine/opus.mjs new shot <id> --receta r [--objeto o] [--fondo f] [--mov a,b] [--a id,id] [--param k=v] [--llenar objeto.prop=texto] [--film f] [--force]`. Escribe `shots/<id>.scene.json` (scaffold, sin herencia; marca `[receta:r+mov]` al inicio de `doc`) y genera `shots/<id>.mjs`. No pisa sin `--force`.
- Movimientos = modificadores: envuelven `x/y/r/size/alpha…` de cualquier objeto que tenga esa propiedad con `{"$expr":"(orig) + temblorX"}`; por defecto actúan sobre `ancla` (+ `foco` si el movimiento traslada). `--a id` elige otro objeto. Se componen (`--mov caida_con_peso,temblor`). Una receta de movimiento sola = `_base` + modificador.
- Lint (etapa validate, solo WARN, términos en data/vocab.json añadidos a mano): `receta.hueco` (un aviso por shot con la ruta de cada hueco) y `receta.repeticion` (> 50 % de los shots del film con la misma receta, con ≥ 3 shots de esa receta). La regla de oleada (3 films con la misma secuencia) vive en `node engine/recetas.mjs audit film1 film2 film3`, no en el lint de un solo film.
- Toolbox: kind `receta` (`receta:<id>` en `tools find --kind receta`), `cli:new` curado en data/tools.meta.json, 10 intenciones nuevas en data/tools.eval.json, `tools.index.json` regenerado.
- Eficiencia: docs/current/EFICIENCIA.md § Recetas (−67…−71 % tokens de escritura; peor caso −53…−61 %).

## Punto de enganche con la rama `fondos` (spec 014/015 §4)
`scaffold()` resuelve `--objeto o` / `--fondo f` SIN dependencia dura (función `instanciar` en engine/recetas.mjs):
1. busca `objeto:<o>` / `fondo:<f>` en las `entries` del registro del toolbox (que `fondos` alimenta con `META` en engine/objetos.mjs / engine/fondos.mjs), Y
2. un tipo DSL del mismo nombre en `TYPES` de dsl-core (`types[o]`).
Si están las dos: sustituye el objeto `ancla` (o el fondo `fondo`) por `{id, type:<o>, x/y por defecto, resto de props requeridas como "$hueco: <prop> de objeto <o>", semantic: META.resumen}`. Si falta cualquiera: deja el `ancla`/`ground` por defecto con `semantic: "$hueco: objeto «o» aún no está en la biblioteca; sugerencia: node engine/tools.mjs find \"o\" --kind objeto"` y sigue (tolerante).
Al mergear `fondos`: (a) comprobar que los nombres de `META.id` coinciden con el nombre del tipo DSL que registren; (b) si sus tipos exigen props numéricas obligatorias distintas de x/y, el scaffold deja `$hueco` en cadena (pasa el esquema pero el render fallará hasta llenarlo: es intencionado, el WARN lo señala); (c) si prefieren otra forma de instanciar, solo hay que tocar `instanciar()` y su test «enganche» en test/recetas.mjs. `fondos` puede añadir sus propias recetas dejando `.receta.json` en data/recetas.

## Decisiones y límites
- Scaffold, no herencia: nada queda enlazado a la receta; solo la marca de `doc` (sirve para `receta.repeticion`).
- `dur` es nombre reservado del DSL: los params de las recetas usan `tarda`.
- `receta.repeticion` exige ≥ 3 shots de la misma receta para no avisar en films de 2–3 planos.
- `transition_out` de `morph_objeto` (morph) y `barrido_por_objeto` (wipe-obj) vive en el scene como pista (`transition.out`), pero el lint lo lee del timeline: hay que declararlo allí (el morph exige además un handoff).
- Las recetas NO fijan estilo/medio/audio: eso sale del brief y del timeline.
- No se tocó dsl-core, sandbox ni el ratchet de cobertura (los shots de recetas viven en copias temporales de los tests).
- H1 (que la oleada E2 no se sienta hecha con plantilla) es del usuario.
