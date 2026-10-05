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

## Motor: rendimiento de opus-studio (medir primero, optimizar por impacto medido)
Línea base medida: Potencias master en frío 282 s reloj / 747 s CPU (120 ms reloj, 319 ms CPU por fotograma, 2341
fotogramas); mate master 130 s, lint 156 s; reel master 40 s; caliente (todo en caché) 9 s.
| # | mejora | idea |
|---|---|---|
| R0 | **Perfilado** | `npm run profile -- <film>`: ms por fotograma desglosado en shot, fx/blur, TeX, grade/post, lectura de píxeles, codificación; top-10 shots/fx más caros. Sin esto no se optimiza nada |
| R1 | **Renderizar una vez, analizar muchas** | lint (determinism renderiza 2×, layout, motion), arc, index, critic y peek renderizan sus propios fotogramas: caché compartida de fotogramas de baja resolución por (cookKey, t, tamaño) |
| R2 | **Capas estáticas cacheadas** | fondo/papel/grano/TeX/rejillas que no cambian entre fotogramas se rasterizan una vez por cookKey de nodo y se componen; clave ahora que añadimos medios con textura |
| R3 | **fx caros a media resolución** | blur/glow/bloom en buffer ½ o ¼ y reescalado; presupuesto de fx por fotograma |
| R4 | **Tubería de vídeo** | frames crudos (rawvideo RGBA) por pipe a ffmpeg sin PNG intermedio; usar todos los núcleos (workers = CPUs); codificación por hardware (VAAPI/NVENC) si existe, opcional |
| R5 | **Backend Skia** | benchmark @napi-rs/canvas vs node-canvas (Cairo): filter/Path2D nativos, suele ser 2–4× en blur y texto; migrar solo si el golden se puede re-basar con tolerancia |
| R6 | **Lint más barato** | resolución por check (layout no necesita 720p), fps adaptativo (más alto solo cerca de cortes/picos), `lint --shot` real en TODOS los checks (hoy motion/rhythm recorren el film entero) |
| R7 | **Audio cacheado** | stems de partitura y sfx por sección/hash: cambiar un shot no re-sintetiza todo (hoy 8–21 s por mezcla) |
| R8 | **Bucle de iteración** | preview con hot-reload (preview.html) para el humano; peek para agentes; objetivo: ver un cambio en < 5 s |
Objetivo F6: master en frío ≤ ⅓ del actual, lint iterativo de un shot ≤ 15 s, golden intacto.
