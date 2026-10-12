# 019 — Boceto rápido y preview en vivo (E4)

## Intención (usuario, 2026-10-12)
Frente a Remotion o Claude Design nuestro ciclo es lento: decidir un concepto exige lint, crítico y gates, y un film cuesta horas y cientos de miles de tokens.
"Un agente aislado que escribe todo en función de t lo haría mucho más rápido" (experimento en curso). Esta spec acorta el ciclo SIN tocar la gobernanza del master.

## Principios
- **El boceto no es un master.** Degradación declarada, hash propio (`film.P.boceto`), jamás mezclado con la caché del master; el gate no lo acepta.
- **Solo errores de esquema** (timeline y `.scene.json`) bloquean. Sin lint, crítico ni gates.
- **Determinista**: mismo film → mismos fotogramas (workers y caché no cambian el resultado).
- **Sin red hacia dentro**: el preview solo escucha en 127.0.0.1 y no ejecuta ni expone nada fuera del film.

## Diseño
1. `opus boceto [film] [--shot X] [--desde t --hasta t] [--escala 0.25] [--sin-audio] [--sin-hoja]` (`engine/boceto.mjs`)
   - ¼ de resolución lineal (mín. 320 px de ancho), 12 fps, h264 ultrafast; fragmentos con hash en `out/boceto/fragments/<film>/` (repetir = instantáneo).
   - Degradación (`engine/boceto-degrada.mjs`, tabla `DEGRADACION`): sin grano, sin post (bloom, cromática, color), sin erosión/temblor/desregistro del medio, fx rápidos;
     por capa u objeto: `"boceto": "omitir" | "sin_fx"` (propiedad común del DSL y de las capas del medio).
   - Audio: solo la mezcla ya cacheada (`data/mix-<film>.wav`, avisa si está desactualizada); nunca sintetiza.
   - Salida: `out/boceto/<film>[.<shot>].{mp4,jpg,json}`; recompila los `.scene.json` del film antes (esquema estricto).
2. `opus preview [film] [--port N]` (`engine/livepreview.mjs` + `preview-worker.mjs` + `preview-live.html`)
   - http de node + canvas; rutas GET `/`, `/info`, `/frame?t=&s=`, `/events` (SSE), `/f/<archivo>` (solo lectura, .json/.md/.txt dentro del film y `shots/`).
   - `fs.watch` + debounce + digest de contenido: recompila el DSL, lanza un worker fresco y la framecache se invalida por hash (solo cambian los shots tocados).
     Error de esquema: se muestra y se conserva el último render bueno.
   - Seguridad: bind 127.0.0.1 sin opción de otra interfaz; Host fuera de loopback → 403; métodos ≠ GET/HEAD → 405; rutas con `..`, NUL, `\`, ocultas, symlink de escape → 404.
3. Producción: paso «boceto» en `docs/current/IDEACION.md` (Fase 6b). Toolbox: `tools find "previsualizar rápido"` → `cli:boceto`, `cli:preview`.

## Escenarios (BDD) — `test/boceto.mjs`
- B1 boceto determinista (dos frío, distinto nº de workers), 320×180@12, caché de fragmentos, sin audio si no hay mezcla.
- B2 menor (≤ ¼ píxeles) y más rápido que el completo; degradación solo en boceto.
- B3 error de esquema falla; sin gates.
- B4 solo loopback (socket local y IP de red rechazada), Host ajeno 403, POST 405, parámetros inválidos 400.
- B5 recarga al guardar `.scene.json`; invalidación por hash (shot editado cambia, intacto sigue en caché); error de esquema informado.
- B6 path traversal (`..`, codificado, `\`, NUL, dotfiles, symlink, extensiones) rechazado.
- [HUMANO] H1 El boceto basta para decidir un concepto (nota del usuario sobre 2 films).
