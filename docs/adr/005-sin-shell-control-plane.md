# ADR 005 — Sin shell en el plano de control

Estado: aceptada (permanente) · Fecha: 2026-10-05

## Contexto
Gates y evidencias ejecutan comandos; un string interpolado a un shell es una vía de inyección entre agentes.

## Decisión
Las evidencias y criterios se expresan como argv / IDs de comando en allowlist; nunca string → shell (deuda: gates.json aún usa criterio::comando con shell, ver docs/ROADMAP.md paso 3).

## Consecuencias
El plano de control es auditable y no ejecutable por contenido de agente. Migración pendiente de los criterios heredados.
