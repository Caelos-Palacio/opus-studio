# ADR 003 — world3d es una capa, no el motor

Estado: aceptada (permanente) · Fecha: 2026-10-05

## Contexto
El 3D real (headless-gl + three) es caro y opcional; el motor 2D es determinista y portable.

## Decisión
world3d se integra como capa compuesta dentro del pipeline 2D (grano, grade y cámara compartidos), con dependencias opcionales. Ver docs/specs/004-world3d.md.

## Consecuencias
El film nunca depende de WebGL para existir; sin gl/three el resto funciona. El 3D hereda grade y grano del film para no verse pegado.
