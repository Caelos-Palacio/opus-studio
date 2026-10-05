# ADR 004 — La memoria conceptual no se comprime con un LLM

Estado: aceptada (permanente) · Fecha: 2026-10-05

## Contexto
La memoria viva son conceptos entrelazados con relaciones verificables (docs/current/MEMORIA.md); la compactación semántica tipo Rosetta se evaluó (docs/history/research/10-rosetta.md).

## Decisión
No se resume ni se comprime la memoria con un LLM. Se adopta solo el vocabulario cerrado versionado y los códigos cerrados de veredicto.

## Consecuencias
La memoria sigue siendo auditable y consultable (npm run q). El ahorro de tokens viene de resúmenes derivados deterministas, no de reescribir la fuente.
