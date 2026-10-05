# ADR 007 — Ledger encadenado y roles aplicados

Estado: aceptada (permanente) · Fecha: 2026-10-05

## Contexto
La gobernanza de agentes necesita registro que no se pueda reescribir en silencio y alcance hecho cumplir (spec 008).

## Decisión
out/ledger.jsonl es append-only con cadena prev/h, head, firma HMAC opcional por agente y códigos cerrados; roles.json en modo enforce vía hook PreToolUse (activación manual del usuario); presupuestos en data/budgets.json.

## Consecuencias
Editar, borrar o reordenar se detecta (node engine/ledger.mjs verify). Límite: quien reescribe todo sin claves no se detecta salvo por head/firmas.
