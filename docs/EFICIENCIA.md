# Mejoras de eficiencia (propuestas, 2026-10-05)

Medido en esta sesión: lint completo 50–150 s y se repite entero ante cualquier cambio de engine/; cada agente
redescubre que las herramientas apuntan al demo; 3 cortes por límite de uso con 6 Opus en paralelo; worktrees que
nacían de un commit viejo; agentes que entregan sin haber visto ni oído el resultado.

## Pipeline (motor)
| # | mejora | ahorro esperado |
|---|---|---|
| P1 | **Film activo explícito**: `opus use <film>` → out/.film; todas las herramientas lo leen, lo imprimen en la 1.ª línea y nunca caen al demo en silencio; `--help` real en todas | elimina la trampa nº1 de los 3 vídeos |
| P2 | `master` nombra la salida por film (`out/<film>.mp4`) | sin renombrados manuales |
| P3 | **Lint incremental**: caché por (check, shot, cookKey, hash del cierre de imports del check); solo re-corre lo afectado | 2,5 min → segundos al iterar un shot |
| P4 | engineHash por check (cierre de imports), no global: tocar sound.mjs no invalida el lint de layout | menos re-lints completos |
| P5 | **Preview barata**: `npm run peek -- <film> [t]` → hoja de contacto 4×3 baja resolución en <10 s; los agentes la MIRAN antes de entregar | feedback visual sin master |
| P6 | Checks del lint en worker_threads en paralelo | ~3× en máquina de 12 hilos |
| P7 | Caché de texturas procedurales (papel, grano) por seed/estilo en out/cache | el fondo no cuesta por frame |
| P8 | `npm audit` limpio (xmldom vía mathjax-full) | CI verde |

## Proceso (agentes)
| # | mejora |
|---|---|
| A1 | `CLAUDE.md` del proyecto con reglas y lecciones (rutas explícitas, techo TP −3, 3DD, sin push) → prompts cortos |
| A2 | Subagentes en `.claude/agents/` con modelo fijado (Sonnet por defecto): integrador, productor-de-vídeo, diseñador-sonoro, director-de-arte |
| A3 | Oleadas de ≤3 agentes; worktrees creados desde `main` actualizado; integrar cada rama al terminar |
| A4 | Commits WIP frecuentes + `docs/handoff/<tarea>.md` actualizado al avanzar → un corte no pierde contexto |
| A5 | Entrega = hoja de contacto (P5) + medidas; el usuario solo califica lo que pasó el filtro |
