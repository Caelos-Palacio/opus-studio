# Mejoras de eficiencia (propuestas, 2026-10-05)

Medido en esta sesión: lint completo 50–150 s y se repite entero ante cualquier cambio de engine/; cada agente
redescubre que las herramientas apuntan al demo; 3 cortes por límite de uso con 6 Opus en paralelo; worktrees que
nacían de un commit viejo; agentes que entregan sin haber visto ni oído el resultado.

## Pipeline (motor)
| # | mejora | ahorro esperado |
|---|---|---|
| P1 ✅ | **Film activo explícito**: `opus use <film>` → out/.film; todas las herramientas lo leen, lo imprimen en la 1.ª línea y nunca caen al demo en silencio; `--help` real en todas | elimina la trampa nº1 de los 3 vídeos |
| P2 ✅ | `master` nombra la salida por film (`out/<film>.mp4`) | sin renombrados manuales |
| P3 | **Lint incremental**: caché por (check, shot, cookKey, hash del cierre de imports del check); solo re-corre lo afectado | 2,5 min → segundos al iterar un shot |
| P4 | engineHash por check (cierre de imports), no global: tocar sound.mjs no invalida el lint de layout | menos re-lints completos |
| P5 ✅ | **Preview barata**: `npm run peek -- <film> [t]` → hoja de contacto 4×3 baja resolución en <10 s; los agentes la MIRAN antes de entregar | feedback visual sin master |
| P6 | Checks del lint en worker_threads en paralelo | ~3× en máquina de 12 hilos |
| P7 | Caché de texturas procedurales (papel, grano) por seed/estilo en out/cache | el fondo no cuesta por frame |
| P8 ✅ | `npm audit` limpio (xmldom vía mathjax-full) | CI verde |

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
| R0 ✓ | **Perfilado** (hecho: engine/profile.mjs, docs/history/research/08-perfil.md) | `npm run profile -- <film>`: ms por fotograma desglosado en shot, fx/blur, TeX, grade/post, lectura de píxeles, codificación; top-10 shots/fx más caros. Sin esto no se optimiza nada |
| R1 | **Renderizar una vez, analizar muchas** | lint (determinism renderiza 2×, layout, motion), arc, index, critic y peek renderizan sus propios fotogramas: caché compartida de fotogramas de baja resolución por (cookKey, t, tamaño) |
| R2 | **Capas estáticas cacheadas** | fondo/papel/grano/TeX/rejillas que no cambian entre fotogramas se rasterizan una vez por cookKey de nodo y se componen; clave ahora que añadimos medios con textura |
| R3 ✓(opt-in) | **fx caros a media resolución** (hecho como `fxFast`: −45–50 % ms/fotograma, PSNR ≈70 dB; sin activar por defecto) | blur/glow/bloom en buffer ½ o ¼ y reescalado; presupuesto de fx por fotograma |
| R4 ~ | **Tubería de vídeo** (rawvideo y workers=CPUs ya existían; añadido preset/threads opt-in, −19 % CPU con faster+t1) | frames crudos (rawvideo RGBA) por pipe a ffmpeg sin PNG intermedio; usar todos los núcleos (workers = CPUs); codificación por hardware (VAAPI/NVENC) si existe, opcional |
| R5 ✓ | **Backend Skia** (medido, no migrado: test/bench-skia.mjs, docs/history/research/08-perfil.md) | benchmark @napi-rs/canvas vs node-canvas (Cairo): filter/Path2D nativos, suele ser 2–4× en blur y texto; migrar solo si el golden se puede re-basar con tolerancia |
| R6 | **Lint más barato** | resolución por check (layout no necesita 720p), fps adaptativo (más alto solo cerca de cortes/picos), `lint --shot` real en TODOS los checks (hoy motion/rhythm recorren el film entero) |
| R7 | **Audio cacheado** | stems de partitura y sfx por sección/hash: cambiar un shot no re-sintetiza todo (hoy 8–21 s por mezcla) |
| R8 | **Bucle de iteración** | preview con hot-reload (preview.html) para el humano; peek para agentes; objetivo: ver un cambio en < 5 s |
Objetivo F6: master en frío ≤ ⅓ del actual, lint iterativo de un shot ≤ 15 s, golden intacto.

## Uso de IA: tokens (medido en la sesión 2026-09-29 → 10-05)
Línea base (tokens por subagente): Opus oleadas F1–F4 150–260 k c/u (~1,6 M en total); Sonnet soundtrack 392 k;
Sonnet terminar un vídeo 80–107 k; Sonnet integración 150 k; Sonnet análisis de 2 enlaces ~72 k.
Dónde se va: (1) cada agente relee 8–12 docs largos para orientarse; (2) salidas verbosas de herramientas
(lint con 48 avisos, npm test con ~150 líneas ✓); (3) imágenes leídas una a una; (4) agentes nuevos que redescubren
lo que otro ya sabía; (5) Opus usado en tareas mecánicas; (6) informes largos que el orquestador re-resume.
| # | mejora | ahorro esperado |
|---|---|---|
| T1 | **Paquetes de contexto por rol** (docs/ctx/<rol>.md ≤ 1,5 k tokens: qué leer, comandos, contratos, trampas) en vez de listas de 12 docs | −30–50 % en arranque de cada agente |
| T2 | **Salidas para agentes**: `--summary`/`OPUS_AGENT=1` → veredicto + conteos + top-5 problemas + ruta al log completo (lint, test, arc, sound, memoria); `npm test` solo imprime ✗ y el total | −50–80 % de tokens de herramientas |
| T3 | **Imágenes**: una hoja de contacto (peek) en vez de N fotogramas; resolución mínima legible; recortar a la zona en duda | −70 % en revisión visual |
| T4 | **Ruteo por modelo**: Haiku para mecánico (correr tests, renombrar, merges triviales, extraer métricas), Sonnet para producir, Opus solo para diseño, seguridad y juicio difícil | coste/token 3–15× menor en esas tareas |
| T5 | **Reanudar, no relanzar**: continuar el mismo agente (SendMessage) mientras viva la sesión; si no, traspaso en docs/handoff y el nuevo arranca leyendo SOLO eso | evita redescubrir |
| T6 | **Determinista antes que LLM**: métricas, lints, mezcla y A/B numérico por código; el LLM solo decide lo que el código no puede | — |
| T7 | **Prefijo estable** (CLAUDE.md + ctx de rol al inicio, igual entre agentes) para aprovechar la caché de prompts | −coste de entrada repetida |
| T8 | **Informes con formato fijo y corto** (≤ 25 líneas: resultado, ruta, medidas, pendientes) | menos re-resumen del orquestador |
| T9 | **Contabilidad**: registrar tokens por tarea/film en docs/costes.md (o el ledger) para medir cada mejora | sin medida no hay mejora |
| T10 | Crítico por API: hojas de contacto en baja resolución, solo shots hero, caché por hash (ya existe) | — |

## Hecho (2026-10-05, tras integrar mate + reel + regla en main)
- **P1**: `npm run use -- <film>` (engine/opus.mjs) escribe out/.film. Resolvedor único en `engine/filmid.mjs` (`resolveFilm`, `activeTimeline`,
  `announceFilm`, `filmFile`): `--timeline` > `OPUS_TIMELINE` > out/.film > demo. lint, arc, memoria, sound, cut, critic, index, q, autocam, params,
  render (y grid, score) imprimen `film: <clave> (<ruta>, fuente: flag|env|use|demo)` (con `--json` va a stderr). arc/memoria derivan
  story.json/memoria.json de la carpeta del film. `--help` real vía `engine/help.mjs` (primer import: imprime la cabecera y sale sin ejecutar nada).
  Test: `test/film.mjs`. Consecuencia: regla ahora encuentra su `data/regla/story.json` y el lint ejecuta el arco (12 → 23 avisos, sigue SHIP).
- **P2**: ya lo hacía reel (`out/<film>.mp4`, demo `out/master.mp4`); ahora es `masterFile()` exportado y con test.
- **P5**: `npm run peek -- [film] [--t a,b,c]` → out/peek/<film>.jpg (12 instantes, 4×3, tile ≤ 400×300, render directo). Medido: mate 3,0 s,
  demo 2,7 s, regla 1,3 s, reel 0,9 s (objetivo < 10 s). Antes: ~1–2 min (master o `sheet` a resolución completa).
- **P8**: `overrides: {"@xmldom/xmldom": "^0.9.12"}` en package.json (speech-rule-engine lo fija a 0.9.10, vulnerable): `npm audit` → 0 vulnerabilidades;
  TeX, golden y `npm test` verdes.
- Pendiente de la tabla: P3, P4, P6, P7 (lint incremental, hash por check, workers, caché de texturas) y los de proceso A2–A5.
- Nota: modificar engine/lint.mjs/filmid.mjs caduca los veredictos de todos los films (hash del motor): relanzar `npm run lint` tras `use <film>`.
