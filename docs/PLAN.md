# Plan v5 — de verificador de un agente a estudio autónomo gobernable

Síntesis de 5 investigaciones (ver `docs/research/`): auditoría del código, sistemas locales (Symbiaxis, graphify),
TouchDesigner + edición por metadatos, proceso de creadores, y qué produce asombro.
Tesis: **v4 verifica bien un film hecho por un agente. No garantiza que N agentes converjan.** v5 pone la
gobernanza en código, convierte el vídeo en datos editables y añade dramaturgia medible.

> **Sobre los .mp4:** no se propone eliminar MP4. El código solo borra dos cosas: fragmentos huérfanos
> (`cut.mjs:82`, caché obsoleta) y el concat intermedio `_raw.mp4` (`cut.mjs:101`). Ambos son correctos en un
> solo agente, pero `cut.mjs:82` es **peligroso con varios agentes**: puede borrar fragmentos válidos de otro.
> El arreglo es hacer ese borrado bajo lock, no quitar MP4. Además `.part.mp4` de renders abortados quedan huérfanos.

## Los 10 errores (evidencia en `docs/research/01-auditoria.md`)

| # | error | severidad | dónde |
|---|---|---|---|
| E1 | Sin locks ni ownership: salidas únicas compartidas (`out/lint.json`, autocam, índice, caché TeX). Carrera TOCTOU: fragmento cacheado con código viejo **para siempre** | crítico | `lint.mjs:351`, `cut.mjs:67-84`, `tex.mjs:65` |
| E2 | Gates y roles solo en prosa: `npm run master` sale con FIX o sin lint; "2 fallos → detente" sin contador | crítico | `AGENTES.md`, `SKILL.md:53`, `cut.mjs` |
| E3 | `lint --only X` sobrescribe `lint.json` con SHIP parcial; veredictos sin hash (no se sabe si están caducados) | crítico | `lint.mjs:351`, `q.mjs:155` |
| E4 | Crítico: si todas las respuestas son inválidas → "CRITIC SHIP"; caché ignora modelo/rúbrica/prompt; sin evals | alto | `critic.mjs:254-276` |
| E5 | Hash incompleto: `PIXEL_ENGINE` manual sin `autocam`; assets por mtime; mezcla regenerada por mtime; `render --mp4` sin hash | alto | `cut.mjs:21,31-41,88`, `render.mjs:124` |
| E6 | Sin tests de píxel (golden) ni e2e de cut/index/q/critic/sound; suite lenta (copia el repo por mutación) | alto | `test/run.mjs` |
| E7 | Guardia evadible (`eval`, `new Function`, `fs`, `child_process`, `globalThis`); shots sin sandbox | alto | `guard.mjs:35-52` |
| E8 | Timeline sin esquema: campos mal escritos pasan; campos muertos (`must_read_mute`, `vignette`) | medio | `lint.mjs:29-67` |
| E9 | Sin grafo de dependencias ni `lint --shot`: un fix en A2 rompe A3 y nadie lo anticipa; cada iteración recorre todo el film | medio | `AGENTES.md:25`, `lint.mjs` |
| E10 | Sin snapshots/rollback ni trazabilidad; `assets.mjs:17` destruye metraje extraído sin copia | medio | `assets.mjs:17` |

## Fases

### F0 — Cimientos (el "pequeño plan")
- [x] Repo git público, MIT → github.com/Caelos-Palacio/opus-studio
- [x] CI (GitHub Actions: node 22 + ffmpeg + `npm test`; `.github/workflows/ci.yml`). Falta `npm audit` limpio (@xmldom/xmldom vía mathjax-full).
- [x] Golden tests (E6): hash de frames `in/mid/out` por shot del demo y del fixture en `test/golden/`, con tolerancia
      perceptual; test de que `cut` y `render` producen los mismos píxeles; modo `npm test -- --fast`.
- [x] Film de estrés de 60–90 s (explainer con TeX + escala tipo *Powers of Ten*) para medir coste real y fallos del lint ("Potencias", 78 s, `data/stress/potencias.json`, informe `docs/research/06-estres.md`).

### F1 — Gobernanza en código (E1, E2, E3, E10)
Patrón tomado de Symbiaxis (Guardian + WorkUnit), sin su andamiaje.
1. **`engine/ledger.mjs`** — `out/ledger.jsonl` append-only:
   `{id, ts, agent, role, action, target, hash_before, hash_after, verdict, why≤140}`. Nunca contenido crudo, solo digests.
2. **Claims con lease**: `claim(shot, agent, ttl)` → escritura atómica (`tmp + rename`) de `out/locks/<target>.json`.
   Un agente solo escribe lo que tiene reclamado. Lease caducado = liberable. Locks también en `cut` (borrado de
   huérfanos), `autocam`, `index`, caché TeX.
3. **Salidas por shot**: `out/lint/<film>/<shot>.json`; `lint --shot ID` (+ vecinos por dependencia). `--only` nunca
   escribe el veredicto global.
4. **Veredictos direccionados por contenido**: todo `lint.json`/`critic.json` lleva `{engineHash, filmHash, shotHash}`.
   Un veredicto con hash distinto al actual **no existe**.
5. **Gates ejecutables** (`engine/gate.mjs`): cada gate = lista de `criterio::comando`; se cierra solo con exit 0;
   `--force "razón"` queda en el ledger. `cut.mjs` exige SHIP vigente + crítico sin FIX. Escribe `out/gates.json`.
6. **Roles aplicados**: `roles.json` (rol → globs escribibles) verificado por (a) el ledger antes de aceptar un cambio,
   (b) un hook PreToolUse opcional para Claude Code. Despliegue **observer → enforce** (primero solo registra `would_decide`).
7. **Snapshots**: commit/tag git automático al cerrar cada gate; `opus restore <gate>`; `assets` mueve a `.trash/` en vez de borrar.

### F2 — Harness fiable (E4, E5, E7, E8)
- **Esquema del timeline** (JSON Schema, `additionalProperties:false`, enums de `cam.why`, `transition_out`, tamaño de plano), validado antes que todo; errores con ruta JSON.
- **Hash completo**: `PIXEL_ENGINE` derivado del grafo de imports + test que lo comprueba; `autocam.mjs` y `data/autocam/*.json` en el hash; assets y fuentes por sha256 de contenido; mezcla por hash de entradas; retirar `render --mp4` legado.
- **Crítico honesto**: respuesta inválida = FIX (fail-closed); caché incluye modelo+rúbrica+prompt+schema; no corre con lint en FIX; N≥3 muestras y mediana; **set dorado** (shots buenos + defectos inyectados) para medir recall/estabilidad; el veredicto sin `--api` se persiste y valida.
- **Sandbox de shots**: ejecutar shots en `worker_threads` sin `fs`/`child_process`, globals congelados (`Math.random`, `Date`, `performance`); guard por AST (no regex).

### F3 — Orquestación que converge (no interferencia destructiva)
Reglas del protocolo (`ORQUESTADOR.md` v5 + `engine/orch.mjs`):
1. **Un escritor por artefacto.** Shots: su Animator. Timeline/estilo/perfil: solo el Director, y los demás
   **proponen** parches (capas, ver F4). Nadie reescribe lo que no reclamó.
2. **Contratos congelados en el animatic.** Las interfaces entre shots (`entities` de handoff, `t` de corte, `cam`
   de salida) quedan fijadas al cerrar el gate del animatic. Cambiarlas reabre ese gate: así un fix local no rompe al vecino.
3. **Planificación por dependencias.** `q deps/impact` da el grafo (handoffs, `after`, `cam.chain`, imports).
   Shots sin dependencias → paralelo; con dependencia → orden topológico; cambio en uno → re-lint de sus vecinos.
4. **Trinquete (ratchet) = convergencia.** Un cambio solo se acepta si: su shot mejora o iguala, **ningún check que
   estaba verde pasa a rojo** en ningún otro shot, y el número global de FIX no sube. Esto hace la calidad monótona.
5. **Anti-oscilación.** El ledger guarda el historial de `shotHash` y de problemas; si reaparece un estado (A→B→A)
   o se agota el presupuesto (K=3 por shot, 2 por gate), se congela y se escala al Director con el diff.
6. **Críticos que diagnostican, no prescriben** (Pixar Braintrust). El Director decide qué nota aplicar; las
   rechazadas quedan con motivo. Consenso entre revisores solo cuenta si sus evidencias son **independientes**
   (quorum Jaccard de Symbiaxis: `|A∩B|/|A∪B| < θ`).
7. **Contexto por punteros.** Cada agente recibe su tarea + rutas + un resumen determinista ≤500 tokens del estado;
   nunca el historial. Salidas de herramientas truncadas a veredicto + primeras N líneas + ruta al log.
8. **Contrato de entrega tipado**: `{summary, changed, evidence(comandos+exit), risks, confidence, next}`; sin evidencia ejecutable, la entrega se rechaza.

### F4 — Semántica: el vídeo como objetos paramétricos (inspiración TouchDesigner/USD/Houdini)
- **Operadores tipados** con puertos `image | signal | geo | table` (TOP/CHOP/SOP/DAT). Un nodo = `{op, params, inputs, meta}`.
- **Señales (CHOP) de primera clase**: funciones puras de `t` (curva de keyframes, LFO, envolvente, ruido sembrado, audio RMS/onsets). Los parámetros se enlazan a señales por referencia, no por código.
- **Parámetros promovidos** (HDA): cada shot expone `params` públicos con esquema (`type, range, unit, semantic`). Un agente edita "el título de la intro, tamaño 84" sin tocar JS.
- **Capas de overrides** (USD LIVRPS): `base` (timeline) < `variants` (16:9/9:16, idioma, estilo) < `agent layers` (JSON Patch) < `user`. Deshacer = quitar capa. Diff y auditoría gratis.
- **Pull + cookKey**: `resolve(timeline, layers) → grafo` una vez; `seek(t)` sobre el grafo resuelto. `cookKey = hash(op@ver, params resueltos, cookKeys de entradas, t si depende del tiempo)`. Un cambio invalida solo el nodo, sus consumidores y los fragmentos que intersecan su rango temporal. Cambios de `meta` solo reindexan.
- **DSL de expresiones mínimo y sandboxeado** (`72 + 8*sig('pulse')`), dependencias extraídas al parsear.
- **Índice semántico v2**: apunta a nodos y parámetros (no a píxeles), grafo de entidades y causalidad, markers temporales estilo OTIO, facetas (rol, emoción, beat), exportable a OTIO/EBUCore. Punteros con peso y verificación de existencia (compactación semántica de Symbiaxis). Semántica TeX con estructura (`\frac`, subíndices: `q_1 ≠ q_2`).

### F5 — Dramaturgia: de "correcto" a "asombroso"
Capa nueva **`data/story.json`** (spine) y **`engine/arc.mjs`** (lint dramático). Ver `docs/research/04-asombro.md`.
- **Spine causal** (Parker/Stone): entre cada par de beats cabe "pero" o "por lo tanto"; "y luego" = FIX.
- **Brecha de información** (Loewenstein): el brief declara la pregunta del gancho; lint verifica que se plantea en el primer 10 % y se resuelve tarde.
- **Modelo roto** (Keltner/Haidt): cada pieza declara su momento de acomodación (regla que cambia, escala que se revela, idea que reorganiza). Mahoraga = regla que se adapta; *Powers of Ten* = escala con ritmo constante.
- **Medibles** (con umbrales calibrables, ver bayesiana con clamp en research/02):
  curva de energía con pico ≥ 3× mediana; calma antes del pico; pico principal al 60–85 %; final en descenso;
  ≥1 silencio/hold deliberado junto al pico; sincronía impacto–transitorio ≤ 2 fotogramas; variación de tamaño de
  plano (entropía mínima); paleta contenida + acento con función; detalle concentrado en picos; cambios de estilo solo
  en picos; cámara con inercia y sobrepaso (no lineal); **frame-rate por intensidad** (twos en calma, ones en el pico);
  impact/smear frames como primitivas (`api.impact`, `api.smear`) con presupuesto por escena; referencia de escala humana antes de un salto de escala.
- **Pedagogía (explainer)** — Mayer: coherencia (0 elementos huérfanos sin frase), señalización (≥90 % de términos nuevos resaltados al nombrarlos), contigüidad (etiqueta junto al objeto ±0,5 s), ≤3 conceptos nuevos/min, ≤4 elementos animados a la vez, segmentos de 20–90 s.
- **Audio manda el timing**: narración bloqueada antes de animar (±3 %), como Kurzgesagt/Arcane. Source sheet obligatoria.
- **Presupuesto sakuga**: shots `hero | normal | simple`; los hero reciben más iteraciones y más post.
- **Juicio**: lo no medible (¿emociona el pico?, ¿se siente la escala?) va al crítico con rúbrica cerrada, nunca al lint.

### F5b — Soundtrack como sistema (spec docs/specs/002-soundtrack.md)
El sonido es la mitad del asombro. No solo música: diseño sonoro completo derivado de la estructura del film.
- **Partitura generativa** (de la PoC `engine/score.mjs`, rama del film de estrés, nota 6–7): secciones desde
  timeline + curva de energía + memoria conceptual; rejilla de tempo anclada hacia atrás desde los impactos;
  armonía con tensión que resuelve en la revelación; motivo (leitmotiv) por concepto de la memoria que se
  transforma cuando el concepto cambia/se reinterpreta; capas por intensidad. Sistematizar: nada escrito a mano por film.
- **Diseño sonoro**: sfx con capas (transitorio + cuerpo + cola), sub-drop e impactos con *pre-silencio*,
  whooshes ligados a velocidad real de cámara/objetos, ambientes por escala/lugar, risers que se resuelven,
  "suck-back" antes del golpe. Banco de síntesis propio, determinista.
- **Mezcla y master**: buses (música, sfx, ambiente, voz), sidechain/ducking por prioridad, ecualización por
  espacio de frecuencia (sin enmascaramiento), espacialización estéreo con el movimiento, master a −14 LUFS con
  rango dinámico (LRA ≥ 8), true peak ≤ −1 dBTP.
- **Medibles** en `arc`/`sound lint`: LRA, clímax sonoro ±0,5 s del visual (ventana centrada), sincronía
  impacto–transitorio ≤ 2 fotogramas, vacío ≥ 0,5 s antes del golpe, enmascaramiento sfx/música, densidad de
  eventos por sección, variedad tímbrica (nada se repite idéntico > N veces).
- **Juez humano**: cada versión se califica (1–10) y la nota recalibra umbrales; objetivo ≥ 8.

### F6 — Rendimiento y alcance
Workers reales por fragmento; evaluar `@napi-rs/canvas` (Skia: `filter`, `Path2D` nativos); preview con imágenes/metraje y hot-reload; TTS; export ProRes/alfa.

## Orden y criterio de hecho
| fase | depende de | hecho cuando |
|---|---|---|
| F0 | — | CI verde; golden detecta un cambio de 1 px; film de 60 s renderizado y medido |
| F1 | F0 | test de 2 agentes concurrentes sin corrupción; `master` falla con FIX o veredicto caducado |
| F2 | F1 | mutaciones nuevas (eval, fs, esquema, crítico inválido) dan FIX; golden del crítico con recall medido |
| F3 | F1, F2 | simulación de 4 agentes sobre el film de estrés converge sin regresiones ni oscilación |
| F4 | F2 | un agente cambia un parámetro por metadatos y solo se re-renderiza el fragmento afectado |
| F5 | F4 | `arc` distingue la versión "PowerPoint" del demo de la versión con arco (test A/B) |
| F5b | F4, F5 | soundtrack de Potencias v2 calificado ≥ 8 por el usuario; medibles de la spec 002 en verde |
| F6 | F3 | coste/frame medido antes y después |

Riesgo principal (lección de Symbiaxis, PENSA): **sobre-ingeniería sin uso real**. Cada pieza entra solo con un test
que demuestra que falla sin ella, y el film de estrés de F0 es la vara de medir de todo lo demás.
