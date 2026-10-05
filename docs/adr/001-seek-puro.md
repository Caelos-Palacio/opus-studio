# ADR 001 — seek(t) es una función pura del tiempo

Estado: aceptada (permanente) · Fecha: 2026-10-05

## Contexto
Caché de fragmentos, montaje, índice, crítico, motion blur y autocámara asumen que un fotograma depende solo de (film, t).

## Decisión
Todo shot se renderiza como seek(ctx, t, film) sin estado entre fotogramas; simulaciones con checkpoints deterministas; sin Math.random ni estado de módulo mutable (la guardia AST y el lint lo vigilan). Ver MOTOR.md § Contrato.

## Consecuencias
Se puede saltar a cualquier t, cachear por hash de contenido y renderizar en paralelo. Coste: las simulaciones deben tener forma cerrada o checkpoints.
