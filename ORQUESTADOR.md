# Pegar esto en Claude Code (Opus, effort high)

Lee CRAFT.md, CINE.md, STYLES.md, storyboard/README.md y .claude/skills/opus-studio/SKILL.md.
Este repo es un estudio. Tú diriges y también fotografías. No codees el film hasta que el STRIP esté OK.

## Encargo
[UNA FRASE: qué es, para quién, duración, formato]

Estilo: [pack de styles/ | "elige tú" | describe la sensación en 3 adjetivos + referencia]
Perfil: [reel | explainer | cinematic | "elige tú"]
Modo: [con paradas humanas | autónomo]
Assets: [rutas o "ninguno"]
Audio: [archivo | "click track 120 BPM" | "sintetiza desde cues"]
Referencias: [qué copiar / qué prohibir]

Empieza por el BRIEF y luego el ESTILO (una etapa por mensaje hasta que yo diga OK, o hasta que el gate autónomo pase).
Si ningún pack encaja, compón uno con `node engine/style.mjs` y justifícalo en 5 líneas.
Tras timeline.json corre `node engine/lint.mjs --only validate`.
Luego genera las VIÑETAS de trazo (SVG barato, no frames), muéstrame el STRIP y espera.

## Varios agentes (F1)
Lanza cada subagente con `OPUS_AGENT=<nombre> OPUS_ROLE=<rol>` (ver AGENTES.md § Gobernanza). Antes de tocar un shot, el Animator lo reclama
(`node engine/lock.mjs claim shots/A2.mjs`). Cada etapa se cierra con `node engine/gate.mjs close <gate>`: nunca declares un GATE pasado
sin ese exit 0 (o un `--force "razón"` del Director). Itera con `node engine/lint.mjs --shot ID`; el master solo sale con SHIP vigente.

## Orquestación convergente (F3)
Un escritor por artefacto: el timeline lo escribe solo el Director; el resto **propone** un JSON Patch
(`node engine/orch.mjs propose data/timeline.json patch.json --why "…"`, queda en `out/proposals/`) y el Director decide
(`orch decide <id> accept|reject --why "…"`). Un cambio a tu shot se entrega con `orch accept cambio.json`: el **trinquete**
re-lintea el shot y sus vecinos y lo rechaza si algún check pasa de verde a rojo o sube el FIX global.
- Al cerrar el gate `animatic` se congelan los **contratos** entre shots (`out/contracts/<film>.json`: corte, cámara de salida y estado de la entidad de handoff). Romperlos da FIX (`lint --only contracts`) salvo `orch reopen animatic --why "…"` (solo Director).
- Planificar: `node engine/q.mjs deps` (niveles en paralelo) y `q impact <shot>` (qué re-lintear).
- Anti-oscilación: volver a un estado ya superado (A→B→A) o gastar K=3 intentos en un shot (2 en un gate) lo **congela** y escala al Director con el diff (`out/orch/escalations/`); solo el Director lo descongela (`orch unfreeze shot/A1 --why`).
- Críticos: `orch note` solo diagnostica (sin arreglo) y con evidencias; hay consenso con ≥2 revisores de evidencias independientes (Jaccard < θ).
- Contexto: `orch brief <agente> "<tarea>"` (≤500 tokens, punteros, nunca historial) y `orch run -- <cmd>` (veredicto + N líneas; el resto en `out/logs/`).
- Entrega: `orch deliver entrega.json` re-ejecuta la evidencia y rechaza si el exit no coincide.
- El master exige lint SHIP y veredicto del crítico vigentes (`out/critic.json` sellado o `out/review/<film>/verdict.json` con el plan de hoy), o `--force "razón"`.
- Firma: lanza siempre con `OPUS_AGENT` y `OPUS_ROLE`; sin ellos el ledger avisa y firma "anon".
Verificación: `node test/orch.mjs` (incluye la simulación de 4 agentes: la buena converge, el torpe es rechazado, el que oscila se congela).

## Orquestación al límite (spec 007)
- Gate transaccional: digest → criterios → freeze → verificación → commit; si algo falla no se cierra (`gate close`).
- Sin shell: evidencias y criterios = argv `["node","engine/x.mjs",…]` o ID de `data/commands.json` (`lint --only validate`).
- Reparto: `orch plan [--concurrency N --budget-tokens T --budget-minutes M]` → oleadas; `orch resume` tras un corte.
- Continuidad: `orch beat <tarea> --step "…"` (latido + lease), `orch handoff <f.json>` (esquema tipado), `orch resume [nombre]`; ≥2 cortes → partir, ≥3 → escalar. `tools/agentes.mjs` es fachada (hook Stop = `wip`).
- Contexto por rol: `node engine/ctx.mjs` → docs/ctx/<rol>.md (≤1,5 k tokens). Salida resumida: `--summary` | `OPUS_SUMMARY=1` | `OPUS_AGENT=1`. Costes: `orch cost`.
