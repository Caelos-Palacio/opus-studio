# Handoff — orquestación al límite (spec 007)

Rama `orquestacion`. Spec: docs/specs/007-orquestacion.md. Tests: test/orquestacion.mjs (+ test/orch.mjs y test/gov.mjs migrados a argv).

## Hecho
- engine/command.mjs + data/commands.json: comandos sin shell (argv / ID allowlist; rutas dentro del repo; sin -e). gates.json migrado.
- gate.mjs transaccional (digest = engineHash+filmHash; snapshot git sin tag hasta cerrar; freeze con undo; --force no salta integridad).
- orch.mjs: runLogged/deliver sin shell; `plan`, `resume`, `cost`, `beat`, `handoff`, `wip`.
- engine/continuity.mjs: latido+lease, handoff tipado (data/orch.schema.json $defs.handoff), estado/cortes por tarea desde el ledger, mensaje ≤300 tokens, worktrees (wip seguro). tools/agentes.mjs = fachada.
- engine/ctx.mjs + data/ctx.json → docs/ctx/<rol>.md; engine/summary.mjs (T2) importado por lint, arc, sound, metrics, memoria, test/run.mjs.

## Pendiente
- Cuando se integre: regenerar docs/ctx (`node engine/ctx.mjs`), resolver cabeceras (paths.mjs) en orch.mjs/gate.mjs.
- `OPUS_AGENT=1` literal activa el resumen (OPUS_AGENT=<nombre> sigue siendo el nombre del agente).

## Siguiente
`npm test` completo y revisar medidas del informe.
