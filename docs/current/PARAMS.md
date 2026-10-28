# Parámetros, señales y capas (F4)

El vídeo como objetos paramétricos editables por metadatos. Un agente (o `engine/memoria.mjs`) cambia
"el tamaño del punto de la intro" **sin tocar JS**: escribe una capa JSON Patch; el motor la resuelve una vez,
valida tipos y rangos, y `cut` re-renderiza **solo** los fragmentos cuyo contenido resuelto cambió.
Deshacer = borrar la capa.

```
timeline.json ─┐
variants (sel.)├─ resolve() ──► film resuelto ──► seek(t) puro
data/layers/*  ┘   (una vez)        │
                                    └─► cookKey por shot (params resueltos + señales usadas, sin meta) ──► cut --plan
```

| pieza | archivo | puro |
|---|---|---|
| DSL de expresiones | `engine/expr.mjs` | sí (navegador/Node) |
| señales + evaluación de parámetros | `engine/signal.mjs` | sí |
| capas, JSON Patch, `resolve`, `explain`, `cookEntry` | `engine/resolve.mjs` | sí |
| carga de capas/variantes, validación contra esquemas, CLI | `engine/params.mjs` | Node |
| esquema | `data/timeline.schema.json` (`params`, `meta`, `signals`, `variants`, `$defs.layer`) | — |

## 1. Parámetros promovidos (HDA)

Un shot exporta su interfaz pública en `params`. Cada entrada:

```js
export default {
  params: {
    size: { type: 'number', range: [0.05, 0.4], unit: 'vh', default: 0.17, semantic: 'tamaño del punto' },
    glow: { type: 'color', default: 'accent', semantic: 'color del halo' },
    text: { type: 'string', semantic: 'título (default: shot.text)' },
  },
  draw(ctx, t, u, shot, film, api) { const P = api.params; /* P.size, P.glow … */ },
};
```

- `type`: `number | integer | string | color | boolean | enum` (`enum` exige `values: [...]`). `color` = rol de paleta o CSS.
- `range` (número): límite duro. Una constante fuera de rango es FIX; una expresión se recorta al rango al evaluarse
  (NaN/∞ → `default`). `integer` redondea.
- `default`: **constante** que reproduce el comportamiento sin overrides (el golden de píxel lo exige bit a bit).
  Sin enlaces a señales en los defaults: viven en el código del shot y el hash no vería la señal.
- `unit`, `semantic`: para humanos/agentes (`params list`) y para el índice semántico futuro.
- **Parámetros-campo**: `text` refleja `shot.text` (que leen lint, crítico e índice). Su default es el campo del
  timeline y su override (`/shots/<id>/params/text`) se escribe también en `shot.text`. Lista: `FIELD_PARAMS` en `signal.mjs`.

Lectura desde el shot:
- `api.param('size')` / `api.param('size', t)` y `api.params` (todos, evaluados en el `t` del fotograma).
- Sin `api` (entidades de handoff): `film.params('A1', t)` / `film.param('A1', 'size', t)`.

Valores en el timeline (`shots[i].params`): constante, `{ "$sig": "nombre" }` o `{ "$expr": "72 + 8*sig('pulse')" }`.
Solo `number`/`integer` admiten enlaces. Un nombre que el shot no promueve es FIX con "¿quisiste decir…?".

`meta` (en el shot y en el film) es libre (rol, emoción, beat, intención…). El motor la **retira** del shot antes de
dibujar (`film.meta[id]`): el código no puede depender de ella, por eso cambiarla no invalida ni píxeles ni veredictos.

## 2. Señales (CHOP)

Funciones puras de `t` (tiempo del film), declaradas por nombre en `timeline.signals`:

| op | campos | valor |
|---|---|---|
| `keys` | `keys: [{t, v, ease?}]` | interpola; `ease` (curvas de `core.ease`) del tramo que empieza en esa clave; fuera, mantiene |
| `lfo` | `freq, amp, offset, phase, shape: sine\|tri\|square\|saw` | `offset + amp·onda(freq·t + phase)` |
| `env` | `at: t\|[t…], attack, decay, sustain, hold, release, peak` | ADSR; varios disparos → máximo |
| `noise` | `freq, amp, offset, octaves, seed?` | ruido de valor fBm; semilla = hash del **nombre** (añadir señales no cambia otras) |
| `audio` | `feature: rms\|onsets\|beats, gain, decay, attack` | `onsets` de `data/audio.json`; `beats` = rejilla bpm; `rms` = `audio.json.rms {hop, values}` (de `audio.mjs --analyze`) interpolado (sin análisis → 0) |
| `expr` | `expr` | combina otras señales: `sig('a') * (1 + 0.2*sig('b'))` |

Ciclos y referencias rotas son FIX con ruta (`/signals/a/expr: ciclo de señales: a → b → a`).
Un shot **solo** ve señales a través de sus parámetros enlazados (no hay `api.sig`): así sus dependencias se conocen
al parsear, sin ejecutar nada, y el cookKey es exacto.

## 3. DSL de expresiones

`72 + 8*sig('pulse')` · `lt < 0.5 ? 0.1 : 0.17` · `0.17 + 0.02*sin(tau*t) + 0.01*sig('beat', t - 0.1)`

- Parser propio (descenso recursivo → árbol de cierres). **Sin `eval`/`Function`**, sin acceso a propiedades (`.`/`[]`),
  sin identificadores libres: solo variables `t lt u dur`, constantes `pi tau e true false`, funciones de la lista
  cerrada `FUNCS` (`sin cos … min max clamp lerp mix smooth step fract ease('outBack', u)`) y `sig('nombre'[, t])`.
- Operadores: `?: || && == != < <= > >= + - * / % ^ !` (`^` potencia, asociativa a la derecha).
- `sig` exige nombre literal: las dependencias se extraen al parsear (`compile(src).deps`).
- Errores con ruta y columna: `/shots/A1/params/size: función desconocida 'foo' (col 5)`. Límites: 1000 caracteres, anidamiento 48.

## 4. Capas de overrides — CONTRATO (lo consume `engine/memoria.mjs`)

**Ruta de parámetro**: `/shots/<id>/params/<nombre>` (JSON Pointer, RFC 6901; `~1` = `/`, `~0` = `~`).
Las rutas se aplican sobre una **vista** del timeline donde `shots` es un **mapa por id** (no un array): un agente
direcciona shots por id, nunca por índice. Otras rutas válidas: `/shots/<id>/meta/...`, `/shots/<id>/<campo>`,
`/signals/<nombre>[/...]`, `/style`, `/meta/...` (cualquier campo del esquema; el resultado se valida igual que la base).

**Capa** = un archivo `data/layers/<nombre>.json` (film `main`; films con carpeta propia (`data/<film>/timeline.json`, `data/regla/regla.json`): `<carpeta>/layers/` si existe; otros films: `data/layers/<film>/`; `--layers dir|none`
u `OPUS_LAYERS`):

```json
{
  "name": "memoria-tension",
  "kind": "agent",
  "priority": 10,
  "author": "agent:memoria",
  "why": "el concepto 'semilla' gana peso en el clímax",
  "enabled": true,
  "ops": [
    { "op": "add", "path": "/signals/tension", "value": { "op": "keys", "keys": [{ "t": 3, "v": 0 }, { "t": 5, "v": 1, "ease": "out" }] } },
    { "op": "add", "path": "/shots/A3/params", "value": { "pulse": { "$expr": "0.2 + 0.3*sig('tension')" } } },
    { "op": "add", "path": "/shots/A3/meta", "value": { "concepto": "semilla", "peso": 0.8 } }
  ]
}
```

| campo | obligatorio | significado |
|---|---|---|
| `ops` | sí | RFC 6902: `add remove replace move copy test`. Atómico: si una op falla, la capa entera falla con `capa "x" op #i (ruta): …` |
| `name` | no (= nombre de archivo) | identidad en `explain`/`diff`; sin espacios ni `/` |
| `kind` | no (`agent`) | `variant < agent < user` |
| `priority` | no (0) | dentro del mismo `kind`, mayor gana; empate → orden por `name` |
| `enabled` | no (true) | `false` = capa apagada (deshacer sin borrar) |
| `author`, `why` | no | auditoría |

Notas para escritores de capas:
- `replace` exige que la ruta exista; para fijar un parámetro que quizá no esté en el timeline usa `add` sobre
  `/shots/<id>/params/<nombre>` **si `params` ya existe**, o `add` de `/shots/<id>/params` con un objeto (como arriba;
  ojo: sustituye el objeto `params` de capas anteriores). `test` sirve de guarda optimista (aborta si alguien cambió el valor).
- **Señal referenciable por nombre**: una capa puede declarar `/signals/<nombre>` y enlazar parámetros a ella con
  `{"$sig": "<nombre>"}` o `sig('<nombre>')` en `$expr`. Las señales viven en el film: varias capas pueden compartirlas.
- Una capa inválida (JSON roto, campo desconocido, parámetro que el shot no promueve, valor fuera de rango, señal
  inexistente) hace fallar la carga con el FIX y el nombre de la capa: el film roto no se renderiza. Quitar la capa lo arregla.

**Orden de fuerza** (gana el último): `base (timeline) < variants < agent layers < user`.

**Variantes** (16:9/9:16, idioma, estilo): capas dentro del timeline, activadas por selección:

```json
"variants": { "v9x16": { "ops": [{ "op": "replace", "path": "/width", "value": 1080 }, { "op": "replace", "path": "/height", "value": 1920 }] },
              "en": { "ops": [{ "op": "add", "path": "/shots/A1/params", "value": { "text": "ONE IDEA" } }] } }
```
`--variant v9x16,en` u `OPUS_VARIANT=v9x16,en` (el orden de selección es su prioridad).

**API pura** (`engine/resolve.mjs`): `resolve(timeline, layers, {variants}) → {timeline, trace, base}`
(sin capas devuelve el **mismo** objeto), `explain(R, ruta) → {winner, value, steps}`, `applyPatch(doc, ops)`,
`cookEntry(film, shot)`. Node (`engine/params.mjs`): `loadLayers`, `resolveTimeline`, `checkParams`.

**CLI**:
```
node engine/params.mjs list [shot]                      # interfaz pública: tipo, rango, unidad, valor resuelto, quién lo fija
node engine/params.mjs explain /shots/A1/params/size    # default → base → variant → agent → user, y quién gana
node engine/params.mjs diff [capa]                      # rutas que cambia cada capa
node engine/params.mjs check                            # exit 1 si alguna capa/parámetro es inválido
```

## 5. cookKey e invalidación fina

- Hash de fragmento (`cut.mjs plan`): por cada shot del fragmento, su **entrada resuelta** (`cookEntry`: timeline tras
  capas, `params` resueltos, **sin `meta`**) + las definiciones de **solo** las señales que sus parámetros usan
  (transitivas) + la entrada de los shots cuyo código importa (A2 hereda el punto de A1: si cambia `A1.size`, A2 y A3
  cambian de verdad) + código. Los defaults del esquema van en el código del shot (ya hasheado): la clave es la misma
  con o sin módulos cargados (gate/animatic).
- Veredictos (`verdict.mjs`): `currentHashes` usa el timeline **efectivo** (con capas y variantes) y omite `meta`.
- Criterio de hecho de F4 (test `test/params.mjs`, e2e sobre `cut --plan`): una capa que cambia
  `/shots/A3/params/text` deja A1 y A2 en caché y solo A3 por renderizar; una capa de solo `meta` no invalida nada;
  quitar la capa devuelve todo a caché.

## 6. Pendiente (deliberadamente fuera)

- **Grafo de operadores TOP/CHOP/SOP/DAT** con puertos tipados y cook por nodo: hoy el "nodo" es el shot y la señal;
  no hay consumidor que lo justifique todavía (riesgo de sobre-ingeniería, PLAN.md).
- Dependencia fina entre shots: un shot que importa otro depende de **toda** su entrada resuelta, no solo de los
  parámetros que lee (cambiar `A1.text` invalida A2 aunque A2 no lo dibuje). Requeriría trazar lecturas en ejecución.
- Granularidad temporal: un cambio invalida el fragmento entero, no solo los fotogramas del rango que la señal afecta.
- `sound.mjs mix` y `audio.mjs` leen el timeline crudo: capas sobre `sfx`/`cues` aún no suenan.
- Índice semántico v2 sobre parámetros (`q` por `semantic`), export OTIO/EBUCore, markers temporales.
- Parámetros que se refieren a otros parámetros (`param('x')` en el DSL) y enlaces en tipos no numéricos (color por señal).
- `rms`: lo escribe `audio.mjs --analyze` (`data/audio.json.rms`); el `audio.json` del demo (click sintético) no lo trae y la señal vale 0.
- Preview en navegador (`engine/preview.html`): resuelve `params`/`signals` del timeline pero no carga `data/layers`.
