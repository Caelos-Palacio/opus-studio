# Auditoría de gobernanza y harness (v4.0.0)

Rutas relativas a la raíz. Veredicto: sólido como verificador de un agente; como sistema multi-agente autónomo,
ownership, gates, presupuesto de iteraciones y auditoría existen solo en prosa.

## Borrados de archivos (pregunta sobre .mp4)
1. `engine/cut.mjs:82` borra fragmentos `out/fragments/<film>/*_{fps}_{size}.mp4` que no están en el plan actual (huérfanos por cambio de hash). Solo si todos los del plan existen. **Riesgo con concurrencia.**
2. `engine/cut.mjs:101` borra `out/<name>_raw.mp4` (concat intermedio) tras mezclar audio.
3. `engine/assets.mjs:17` hace `rmSync` recursivo de `assets/cache/footage/<id>` antes de re-extraer: destruye frames extraídos (ignorados por git).
4. `test/run.mjs:44,58` borra solo sus copias temporales.
5. `engine/render.mjs:110` renombra `.part.mp4`; si el proceso muere, los `.part.mp4` quedan huérfanos.

## Crítico
- **C1 Sin locks/ownership.** Salidas únicas: `out/lint.json` (`lint.mjs:351`), `out/motion.json` (`:301`), `data/autocam/<tl>.json` (`autocam.mjs:32,65`), `out/index/<film>/film.json` (`index.mjs:122`, RMW), `assets/cache/tex/index.json` (`tex.mjs:65`, RMW), `list.txt`/`manifest.json` (`cut.mjs:79-84`). TOCTOU `cut.mjs:67-73`: hash calculado al planificar, los workers re-importan shots; si otro agente edita en medio, el mp4 queda bajo el hash viejo para siempre.
- **C2 Roles y gates en prosa.** Sin hooks, settings ni CODEOWNERS. Un Animator puede editar timeline/estilos/engine (`hold_ok`, `profileOverrides` silencian el lint). `cut.mjs` no lee el veredicto. `out/gates.md` solo existe en docs. "2 fallos → detente" sin contador.
- **C3 SHIP falso.** `lint --only X` escribe `out/lint.json` con veredicto parcial. Sin hash de timeline/shots/motor. `lint.mjs:338`: si el render falla, no escribe y queda un JSON antiguo que parece válido.

## Alto
- **H1 Crítico**: respuesta inválida → `continue`; todas inválidas → "CRITIC SHIP" (`critic.mjs:257,276`). Fallo de coherencia tragado (`:266`). Caché solo por hash del plan, no modelo/rúbrica/prompt (`:254`). No rehúsa con lint en FIX. Sin `--api` siempre exit 0. Sin set dorado ni votación.
- **H2 Hash**: `PIXEL_ENGINE` manual sin `autocam` (`cut.mjs:21`); `data/autocam` fuera del hash; `shotDeps` solo sigue `./x.mjs`; `assetsSig` por size+mtime (falsos positivos y negativos); fuentes fuera; mezcla por mtime (`cut.mjs:88`); `render --mp4` legado sin hash (`render.mjs:124-127`).
- **H3 Tests**: 9 mutaciones + fixture + unidades; sin golden de píxel, sin e2e de cut/index/q/critic/sound/autocam; 300 s de timeout por mutación.
- **H4 Guardia**: regex por línea (`guard.mjs:35-43`); sin reglas para `eval`, `new Function`, `fs`, `child_process`, `process`, `globalThis`; estado de módulo solo `let/var` sin indentar y WARN; Proxy sin `getImageData`, `globalCompositeOperation`; sin sandbox.
  - **Estado (F2/E7)**: guardia por AST (`acorn`) con alias, acceso computado plegado y ámbitos; Proxy con `getImageData`/`putImageData`/composición destructiva y fuga de composición; `engine/sandbox.mjs`: hook de carga (un shot solo importa shots o el núcleo puro del motor) + globales sustituidos durante cada llamada del shot (`Math.random` sembrado, `Date`/`performance.now` congelados, `eval`/`Function`/`.constructor`/`process`/timers/red lanzan). **Huecos conocidos**: mismo realm e hilo (no es aislamiento de seguridad frente a un atacante que evada el AST); continuaciones asíncronas encoladas por el shot correrían fuera del sandbox (el AST prohíbe async/Promise/timers); objetos del motor que el shot recibe (`film`, `api`) son mutables; código del motor que importe un shot a mano (fuera de `loadFilm`/`film.mods`) no pasa por el sandbox; mutar objetos de módulo (`const cache = {}; cache.x++`) no lo detecta el AST (sí la prueba de determinismo si cambia píxeles). `worker_threads` descartado: node-canvas no cruza hilos (habría que mover el render entero al worker); `vm` descartado: ESM en vm exige `--experimental-vm-modules` y el ctx del host filtra `Function` del realm principal.

## Medio
- **M1 Semántica**: índice derivado de píxeles a 4 fps, no fuente de verdad; sin grafo de entidades/causalidad/ontología; sin parámetros editables (hay que editar JS). Sin JSON Schema (`lint.mjs:29-67` ifs ad hoc); campos mal escritos pasan; `must_read_mute`, `vignette` sin consumidor. `semantic.mjs`: `\frac` pierde estructura, `q_1`/`q_2` colapsan. `q.mjs:143` usa env en vez de `film.edit`.
- **M2 Dependencias**: sin `q deps/impact`; lint sin `--shot`; cambiar estilo invalida todo.
- **M3 Rollback**: sin snapshots ni trazabilidad por agente; veredictos del crítico se pierden con `out/`.

## Bajo
Detección de main por URL falla con espacios/symlinks; import circular film↔cut (`film.mjs:66`); flags → env heredado por workers (`film.mjs:13`); sin presupuesto de coste del crítico; `audio.mjs:79,85` ignora `--timeline`.
