# Handoff — fondos generativos y biblioteca de objetos (spec 014)
Rama `fondos`, sin push. Spec: `docs/specs/014-fondos-objetos.md`. Test: `test/fondos.mjs` (31 comprobaciones, registrado en `test/run.mjs`). Hojas: `node tools/fondos-sheet.mjs` → `out/ab/fondos.jpg` y `out/ab/objetos.jpg`.

## Piezas (todo PURO salvo prims)
| archivo | qué |
|---|---|
| `engine/fondo-capas.mjs` | registro `CAPAS` (23 tipos), esquema estricto (`validateCapa`), `META_CAPAS` |
| `engine/fondo-presets.mjs` | `PRESETS` (10 fondos temáticos con `porque`), datos |
| `engine/fondos.mjs` | `resolveFondo` (preset+ajustes+sin+capas), `validateFondo`, `drawFondo(ctx, spec, t, E)` |
| `engine/objetos.mjs` | registro `OBJETOS` (25), `validateObjeto`, `drawObjeto`, `META_OBJETOS` |
| `engine/fondos-meta.mjs` | **agregador de meta para la rama toolbox** |
| `engine/prims.mjs` | `api.fondo(spec, {alfa})` y `api.objeto(id, opts)` (+ DOC → docs/API.md) |
| `engine/dsl-core.mjs` | tipos DSL `fondo` y `objeto` (validación estricta, deps, compilación) |

## Meta uniforme (para el índice de herramientas)
`import { metaFondosObjetos } from 'engine/fondos-meta.mjs'` → 58 entradas `{ id, kind, resumen (≤ 15 palabras), tags[], params:[{name,type,def}] }`.
`kind`: `capa-fondo` (23) · `preset-fondo` (10; extra `porque`, `medio`, `capas[]`) · `objeto` (25; extra `anclas[]`, `estados[]`; las partes salen como params `partes.<nombre>` con rango).
CLI: `node engine/fondos-meta.mjs [--json] [--kind objeto]`. Los términos están también en `data/vocab.json` (secciones `fondo.capa`, `fondo.preset`, `objeto`).

## Cómo crear un fondo nuevo (sin tocar el motor)
Un fondo = `{ preset?, semilla?, ajustes?, sin?, capas? }`. En un shot DSL (`shots/X.scene.json`), primer objeto de `objects`:
```json
{ "type": "fondo", "semilla": 5, "capas": [
  { "tipo": "degradado", "stops": ["#02060c", "#06202e"], "angulo": 90 },
  { "tipo": "deformado", "modo": "nube", "color": "#031018", "colorB": "#14506a", "alfa": 0.4, "mezcla": "pantalla", "deriva": [0.004, 0], "paralaje": 0.15 },
  { "tipo": "niebla", "color": "#0d4660", "densidad": 0.5, "anim": { "alfa": "0.8+0.2*sin(t*0.5)" }, "paralaje": 0.5 },
  { "tipo": "polvo", "n": 120, "paralaje": 1.05 },
  { "tipo": "vineta", "color": "#000306", "fuerza": 0.7 } ] }
```
Retocar un preset: `{"type":"fondo","preset":"cuba_oscura","ajustes":{"bruma":{"densidad":0.3}},"sin":["nieveMarina"],"capas":[…encima…]}`. En JS: `api.fondo({preset:'cosmos_profundo'})`. Colores: rol de la paleta (`paper ink accent accent2 shade`), `#hex`, `{"mezcla":["accent","paper",0.4]}` o `{"paleta":0.3}` (muestrea la paleta del medio de oscuro a claro). `anim` = expresiones de `t lt u dur` para `alfa`, `escala`, `dx`, `dy`. Param/tipo equivocado → FIX con «¿quisiste decir…?».
Los presets claros usan roles (se adaptan al medio; llevan `mezcla: "multiplicar"` para medios multiply); los oscuros usan tintas absolutas: la oscuridad es el tema (spec 012 Lección). Un fondo oscuro necesita ≥ 1 capa de atmósfera/textura: un `relleno` negro solo es vacío (`fondo.vacio`; test F8).

## Objetos
DSL: `{"type":"objeto","id":"llave","objeto":"llave_laton","x":…,"y":…,"size":…,"estado":"girada","partes":{"brillo":{"$expr":"lt*0.1"}},"fields":["punta.x","punta.y"]}` → otras expresiones leen `llave_punta_x`. `estado` = nombre o `["reposo","destello",u]`. Salidas fijas `<id>_x|y|w|h`. Registra `focus`. `size` = lado mayor del objeto en px (caja unidad). Colores: tinta `color` (def. `ink`), `relleno` (def. por objeto), `acento` (def. `accent`).

## Decisiones / límites honestos
- Texturas (ruido, celular, acuarela, niebla) se precalculan por (capa, semilla, paleta, tamaño) en `film._fondoE.cache` y se derivan con envoltura (ruido periódico): coste por fotograma ≈ unos `drawImage`; la 1.ª vez ≈ 50–150 ms por textura.
- En medios multiply la tinta se compone con multiply: capas de luz (`foco`, `rayos`) no aclaran sobre papel; usar `mezcla: "multiplicar"` y colores claros solo para velar. Los presets oscuros asumen sin medio o `neon`.
- `deformado` deforma el dominio de forma estática (deriva y respiración, no flujo 3D).
- La hoja de muestras pinta con módulos puros (sin film) y la paleta del medio del preset; el pintado real pasa por `api.depth` (cámara) y luego medio/grano.
- Rama deuda2/toolbox: de `test/run.mjs` solo se añadió `'fondos'` a la lista; `data/vocab.json` solo suma líneas (sin reformatear).
