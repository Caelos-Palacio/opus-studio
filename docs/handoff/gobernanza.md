# Handoff — gobernanza (rama `gobernanza`, spec docs/specs/008-gobernanza.md)

## Hecho
- `engine/ledger.mjs`: cadena `prev`/`h`, `out/ledger.head` (detecta borrado de cola), firma HMAC opcional (`out/keys/<agente>`), génesis de migración,
  códigos cerrados (`ACTION_VERDICTS`/`REASONS`/`CODES`; bloque fácil de mover a `engine/vocab.mjs` cuando exista en main), `stats`, `recordUsage`, CLI `verify|migrate|keygen|stats|budget`.
- `roles.json` en **enforce** + `directorOnly`; roles nuevos `productor`; `engine/roles.mjs replay` (FP ≈ 2 %, medido sobre el historial git: los ledgers existentes no tenían ninguna entrada `write` porque el hook nunca estuvo activo).
- `engine/status.mjs` → `STATUS.md` (parte estática verificada por `npm test`, viva regenerable) y `--links` (enlaces rotos). `test/run.mjs` escribe `out/tests.json` (último run).
- `engine/budget.mjs` + `data/budgets.json`. Docs: `docs/current|adr|history`, redirecciones en `docs/{PLAN,EFICIENCIA,ARC,MUSICA,PARAMS,MEMORIA,MEDIOS}.md` y `docs/research/README.md`.
- Tests: bloques nuevos en `test/gov.mjs` (E1–E16).

## Para el usuario: activar el hook (NO activado)
En `.claude/settings.json`: `{"hooks":{"PreToolUse":[{"matcher":"Write|Edit|MultiEdit|NotebookEdit","hooks":[{"type":"command","command":"node \"$CLAUDE_PROJECT_DIR/.claude/hooks/opus-roles.mjs\""}]}]}}`
y lanzar cada agente con `OPUS_AGENT=<n> OPUS_ROLE=<rol>` (sin rol = director = todo permitido). Firmas: `node engine/ledger.mjs keygen <agente>`.

## Puntos de enganche (no editados aquí)
- `gate.mjs` antes de ejecutar criterios y `orch.mjs` antes de otra iteración: `import { checkBudget } from './budget.mjs'; const b = checkBudget({kind:'iterations', gate|shot}); if (b.level==='block') …`. Tokens: `recordUsage({tokens, role, task})`; render: `recordUsage({minutes, film})`.
- Los ficheros nuevos tras integrar (specs, tests, gates) desfasan la parte estática de STATUS.md: tras fusionar, `node engine/status.mjs`.
- Si semántica trae `engine/vocab.mjs`, mover `ACTION_VERDICTS/REASONS` allí.
- Pendiente de mover a docs/current tras integrar (en uso por otras ramas): API.md, METRICAS.md (generadas), HANDOFF.md, ROADMAP.md.
