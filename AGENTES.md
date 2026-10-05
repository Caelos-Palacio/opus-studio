# Roles

Regla de alcance: cada rol escribe solo en sus rutas. El lint es el árbitro común.

## Director (tú)
Etapas 1–8, 11 y 12. Brief, estilo, hechos, timeline, viñetas, animatic, style lock, veredicto final.
Único que edita `CRAFT.md`, `CINE.md`, `data/timeline.json`, `engine/profiles.json` y `styles/*.json`.

## DP (director de fotografía)
Decide por shot: tamaño de plano, encuadre, `cam` (movimiento + `why`), profundidad (`api.depth`), color y luz según `CINE.md`. Entrega `cam` en el timeline y la rejilla/flecha en la viñeta. Corre el pase Review-Cine.

## Investigador (solo `explainer`)
Escribe `data/facts.json`. Cada entrada: `claim`, `date`, `source`. No toca timeline.

## TD
Solo `engine/`. Tras tocar prims: `npm run docs`. Siempre: `npm test` en verde. No decide look. Si cambia el contrato de `seek`/`api`, actualiza MOTOR.md § Contrato y corre el demo (`npm run lint` → SHIP).

## Animator {IDs}
Input: CRAFT + CINE + STYLES + timeline + `storyboard/{ID}.svg` + los `entities` de los shots vecinos.
Output: `shots/{ID}.mjs` y `out/sheets/{ID}.png`.
```
Implementa solo {IDs}.
Lee CRAFT.md y data/timeline.json. La viñeta storyboard/{ID}.svg es la pose canónica del beat 1.
Si hay handoff entrante: arranca de Prev.entities.X(t_corte). Si hay saliente: exporta entities.X.
Layout solo con api.safe/api.at; texto solo con api.text/api.label/api.tex (TeX en String.raw); foco con api.focus o primitivas (docs/API.md). Estructura jerárquica → export scene(t). Antes de mirar vídeo, consulta: npm run q -- shot {ID} / at T / sym S. La cámara la aplica el motor (no escales el mundo); parallax con api.depth. Colores por rol. seek puro. Paleta, tipo y grade intocables.
Antes de entregar: npm run lint → sin FIX en tus IDs; node engine/render.mjs --shot {ID} --stills; npm run index -- --changed.
```

## Review-Ritmo
Ve `out/sheets/contact.png`, strips y `out/motion.json`. Solo juzga lo que el lint no mide: si el ritmo *sirve a la idea*.
Salida: `shot  t  problema  arreglo mínimo`. No reescribe estilo.

## Review-Demo
Ve la hoja. Marca look de template: gradiente + tipo centrado, partículas, glow, logo final, easing uniforme, 3D flip, blur-in.

## Review-Tipo
Lo que queda tras el lint: jerarquía, legibilidad real, créditos, first/last frame, loudness percibida.

## Review-Rigor (solo `explainer`)
Contrasta cada afirmación visible con `facts.json`. Marca analogías presentadas como literales y simplificaciones no declaradas.

## Review-Cine
Ve la hoja (también en **escala de grises**) y los strips. Solo juzga lo que el lint no mide, con `CINE.md`:
sujeto legible por valor, lead room y headroom, tamaño de plano que sirve a la idea (no tres iguales seguidos), la cámara ayuda a entender (no decora), temperatura/contraste entre planos, luz motivada (glow/viñeta/grano en su medida), rima primer/último frame.
Salida: `shot  t  problema  arreglo mínimo`.

## Gobernanza en código (F1)
La regla de alcance ya no es solo prosa. Cada agente se identifica por env: `OPUS_AGENT=<nombre> OPUS_ROLE=<rol>` (`animator:A1+A2` para IDs).
- **Ledger** `out/ledger.jsonl` (append-only, solo digests): lint, gates, force, claims, robos de lease, descartes, master. `node engine/ledger.mjs --tail 20`.
- **Claims**: `node engine/lock.mjs claim shots/A2.mjs [--ttl ms]` · `release` · `list`. Lease caducado = liberable. Los procesos usan `withLock` en montaje, índice, autocam, TeX y footage.
- **Roles**: `roles.json` (rol → globs; `mode: enforce` por defecto, `OPUS_ROLES_MODE=observer` lo baja a solo registrar `would_*`). `node engine/roles.mjs check <ruta> --role animator:A2`; `node engine/roles.mjs replay` mide falsos positivos sobre el historial git (hoy ~2 %, sobre commits no monolíticos; los denegados reales son ficheros `directorOnly`). Roles: director, dp, investigador, td (motor/tests/docs), productor (agentes de film), animator, review.
- **Ledger tamper-evident**: cada entrada lleva `prev`/`h` (cadena) y `code` (vocabulario cerrado); `node engine/ledger.mjs verify | migrate | stats | keygen <agente>`; firma HMAC por agente con clave en `out/keys/<agente>` (fuera de git). **Presupuestos**: `data/budgets.json`, `node engine/ledger.mjs budget`, `checkBudget()` en `engine/budget.mjs`.
- **Estado**: `STATUS.md` se genera con `node engine/status.mjs` y `npm test` falla si su parte estática está desactualizada.
- **Veredictos**: `out/lint.json` solo lo escribe un `npm run lint` completo; `lint --shot ID` escribe `out/lint/<film>/<ID>.json` (+ vecinos); `--only X` es parcial y nunca escribe el global. Todos llevan `{engineHash, filmHash, shotHash}`: si no coinciden con lo actual, **no existen**.
- **Gates**: `gates.json` = `criterio::comando`. `node engine/gate.mjs close <gate>` (exit 0 de todos o queda abierto; 2 fallos seguidos → detente y reporta) · `--force "razón"` (queda en el ledger) · `status` · `restore <gate> [n]` (snapshot git `opus/gate/<gate>/<n>`, sin tocar HEAD; antes guarda `opus/backup/*`).
- **Master**: `npm run master` exige lint SHIP vigente y crítico sin FIX vigente; si no, falla salvo `--force "razón"`.
- `assets --footage` sobre un id existente mueve lo anterior a `.trash/` (recuperable).

Hook opcional de Claude Code (NO activado): añade a `.claude/settings.json`
```json
{"hooks":{"PreToolUse":[{"matcher":"Write|Edit|MultiEdit|NotebookEdit","hooks":[{"type":"command","command":"node \"$CLAUDE_PROJECT_DIR/.claude/hooks/opus-roles.mjs\""}]}]}}
```
Aplica `roles.json` + claims de otros agentes; en enforce (por defecto) deniega fuera del rol; con `OPUS_ROLES_MODE=observer` nunca bloquea; ante cualquier error del hook, deja pasar. Cada sesión de agente debe lanzarse con `OPUS_AGENT=<nombre> OPUS_ROLE=<rol>`; sin ellos el rol es `director` (permite todo).
