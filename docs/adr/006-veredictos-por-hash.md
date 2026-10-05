# ADR 006 — Veredictos direccionados por contenido

Estado: aceptada (permanente) · Fecha: 2026-10-05

## Contexto
Un SHIP de ayer no vale si el motor, el timeline o un shot cambiaron.

## Decisión
Todo veredicto lleva {engineHash, filmHash, shotHash}; con hash distinto al actual no existe (engine/verdict.mjs). Hash por contenido, no por mtime.

## Consecuencias
Un touch no caduca nada; un cambio real sí. master y gates exigen veredicto vigente.
