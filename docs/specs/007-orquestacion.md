# 007 · Orquestación al límite (paso 4 del roadmap)

## Intención
Cada garantía que la orquestación promete debe ser verdad, medida y con test adversarial: un gate que dice CERRADO
significa EXACTAMENTE lo probado; ninguna evidencia ejecuta texto en una shell; los agentes se reparten el trabajo por
dependencias reales y se reanudan tras un corte; y cuestan pocos tokens.

## Medibles
- Gate transaccional: digest candidato (engineHash + filmHash) → criterios → freeze → verificación → commit atómico.
- Cero `shell: true` en gate.mjs y orch.mjs. Comandos = argv o ID de `data/commands.json`.
- `orch plan` (oleadas, concurrencia, presupuesto) y `orch resume` (handoffs + ledger + plan).
- T1 `docs/ctx/<rol>.md` ≤ 1500 tokens, determinista. T2 salida resumida. T9 `out/costs.jsonl`.

## Escenarios (cada uno tiene test en test/orquestacion.mjs)
### Gate transaccional
- G1 Dado un gate de contratos con criterios verdes y un freeze que falla, Cuando se cierra, Entonces queda ABIERTO, sin
  snapshot ni contrato, y el ledger dice por qué.
- G2 Dado un criterio que modifica un shot mientras corre, Cuando se cierra, Entonces NO se cierra (el árbol ya no es el
  candidato), sin tag git, y queda en el ledger.
- G3 Dado un cierre correcto, Entonces `out/gates.json` lleva `digest` = hash del árbol probado y coincide con el actual;
  con git, el snapshot es el árbol candidato y el tag se crea solo al cerrar.
- G4 Un `--force` tampoco cierra sobre un árbol que cambió ni sobre un freeze fallido (la fuerza salta criterios, no integridad).
### Sin shell
- S1 `;`, `&&`, `|`, `$(…)`, backticks, redirecciones, comillas, saltos de línea en un string → rechazado (FIX), nunca ejecutado.
- S2 argv: solo `node` + script existente dentro del repo; nada de `-e`, `bash -c`, rutas absolutas, `..` ni symlinks fuera del repo, tampoco en `--flag=/ruta`.
- S3 Un string se acepta solo si es un ID de la allowlist (+ argumentos sin metacaracteres) o el argv literal de uno (compat).
- S4 Entregas (`deliver`) y gates con evidencia inyectada: no se ejecuta nada y se rechazan; con argv/ID válidos funcionan.
- S5 `gates.json` del repo y los gates migrados resuelven sin errores.
### Scheduler
- P1 `orch plan` parte los niveles topológicos de `q deps` en oleadas ≤ concurrencia; respeta presupuesto de tokens y de minutos de render (lo que no cabe queda `deferred`); determinista; escribe out/orch/plan.json.
- P2 `orch resume` lee docs/handoff/*.md + ledger + plan: dice qué oleada está hecha, cuál sigue, qué está congelado/abierto.
### Eficiencia
- E1 `engine/ctx.mjs` genera docs/ctx/<rol>.md ≤ 1500 tokens, idéntico en dos ejecuciones; `--check` falla si están caducados.
- E2 `--summary` / `OPUS_SUMMARY=1` / `OPUS_AGENT=1`: lint, arc, sound, metrics, memoria, test imprimen veredicto + conteos + top-5 + ruta al log completo. `npm test` en modo agente: solo ✗ y el total.
- E3 `orch cost` anota tokens/minutos por tarea en out/costs.jsonl y resume por film.

## Fuera de alcance
Firma de ledger y cadena de hashes (gobernanza), vocabulario común (semántica), `paths.mjs` (harness).
Nota: `OPUS_AGENT` ya es el NOMBRE del agente en el ledger; el modo resumido se activa con `OPUS_AGENT=1` exacto, `OPUS_SUMMARY=1` o `--summary`.

## Calificaciones
(sin output audiovisual: no aplica)
