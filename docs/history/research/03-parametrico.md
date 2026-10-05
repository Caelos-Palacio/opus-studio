# TouchDesigner y edición de vídeo dirigida por metadatos

> HISTÓRICO: documento fechado; puede no reflejar el estado actual (ver [STATUS.md](/STATUS.md)).

Nota: los datos de Cavalry, vvvv, Notch y Nuke son conocimiento general sin fuente verificada.

## Qué trasladar
| fuente | idea | en opus-studio |
|---|---|---|
| TouchDesigner (pull/cook) | un operador solo se cocina si alguien pide su dato y cambió una entrada | `seek(t)` recorre el grafo hacia atrás; `cookKey` por nodo |
| TD familias TOP/CHOP/SOP/DAT/COMP | tipos de dato | puertos `image`, `signal`, `geo`, `table`; lint de conexiones |
| TD CHOP | canales como señales | señales puras de `t` (keyframes, LFO, envolvente, ruido sembrado, audio) enlazadas por referencia |
| TD replicator / COMP | N copias desde tabla; módulos con parámetros promovidos | `repeat: {over, as}`; shot como módulo con interfaz pública |
| Houdini HDA | parámetros internos promovidos a la interfaz | el agente edita solo `params` públicos con esquema |
| OpenUSD (LIVRPS) | capas con opiniones, variants, orden de fuerza | `base < variants < agent layers < user`; deshacer = quitar capa |
| OpenTimelineIO | estructura separada de `metadata` con espacio de nombres; `effects`, `markers`, `enabled` | markers temporales; export OTIO |
| Blender fields/drivers | función evaluada por elemento; parámetro ligado a otro | `f(x,y,t,i)` por partícula o letra |
| Theatre.js | props tipadas con rango y default; keyframes como datos | esquema editable |
| Rive | máquinas de estado con inputs; data binding | estados deterministas si sus eventos derivan de `t` |
| Lottie | animación como JSON; expresiones fuera de la spec = riesgo | DSL propio mínimo y sandboxeado |
| Motion Canvas | señales perezosas con caché | igual, pero con hash de contenido persistente |
| Remotion | `inputProps`, `calculateMetadata` | capa de parámetros + fase `resolve` previa |
| EBUCore / MPEG-7 | segmentos temporales con facetas (acción, emoción, tema) | vocabulario del índice y exportación |

**Cuidado**: TD cocina con estado. En opus-studio, un nodo con estado declara `stateful` + `checkpointEvery`.

## Propuesta
- `pobj = {op, params, inputs, meta, schema, range}`; `resolve(timeline, layers) → grafo inmutable` (una vez); `seek(t)` puro sobre él.
- `cookKey = sha256(op@version, canonical(params), cookKeys(inputs), timeSlice)`; nodos `timeInvariant` sin `t`.
- Invalidación: patch en `/nodes/title/params/size` → marca `title` y consumidores; solo fragmentos que intersectan su `range`. Cambios de `meta` solo reindexan.
- Semilla por nodo `hash(seed, nodeId)`: añadir un nodo no cambia el azar de otros.
- Flujo del agente: `query("título de la intro") → nodes.title + schema` → patch en nueva capa → lint (tipos, rangos, ciclos) → re-render selectivo → si no gusta, quitar capa.

```json
{
  "signals": { "fadeIn": { "op": "sig.curve", "params": { "keys": [{"t":0,"v":0,"ease":"outCubic"},{"t":1.2,"v":1}] } } },
  "nodes": {
    "title": { "op": "img.text", "range": [0, 5],
      "params": { "text": "Hola", "size": { "$expr": "72 + 8*sig('pulse')", "deps": ["pulse"] }, "opacity": { "$ref": "signals.fadeIn" } },
      "schema": { "size": {"type":"number","range":[24,200],"unit":"px"} },
      "meta": { "role": "title", "tags": ["intro"], "intent": "título principal, entra con fundido" } }
  },
  "layers": [{ "id": "agent-001", "strength": 20, "author": "agent:editor",
    "patch": [{ "op": "replace", "path": "/nodes/title/params/text", "value": "Bienvenidos" }] }]
}
```
Migración: cada shot JS actual se envuelve como `op` con `schema` de parámetros, sin reescribirlo.

Fuentes: docs.derivative.ca/Terminology · derivative.ca/UserGuide/Cook · docs.nvidia.com/learn-openusd (LIVRPS) ·
github.com/AcademySoftwareFoundation/OpenTimelineIO · docs.re.video/signals · tech.ebu.ch/MetadataEbuCore ·
theatrejs.com/docs · rive.app/docs/runtimes/inputs · docs.lottiefiles.com · remotion.dev/docs/dynamic-metadata ·
sidefx.com/docs/houdini/assets/asset_ui · docs.blender.org (geometry nodes)
