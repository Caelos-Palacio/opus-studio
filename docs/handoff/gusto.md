# Handoff — perfil de gusto y panel de críticos (spec 022, rama `gusto`)

## Estado (2026-10-13, tras la 1.ª calibración)
- **Lote 1 FALLÓ: ρ = 0,338** (umbral 0,7), 7/8 pares; falla potencias_v2 > potencias_v3. Diagnóstico: los críticos solo miraron las hojas de contacto (el usuario juzga movimiento y sonido);
  el perfil castigaba lo didáctico (mate_papel 9,5 sale 5,1); el «vacío» sesgó potencias_v2; la botella con motor salió demasiado alta (el clip-art se ve a 1×/4× y en movimiento). (Que los críticos no abrieron los recortes lo admitieron ellos en el chat; no consta en los JSON.)
- **Cambios para el lote 2 (hechos):**
  - Paquete: 6 `tiras/tN.jpg` (8 fotogramas consecutivos a 5 fps, 4×2, con tiempo y Δ entre fotogramas; 1 en el giro —mayor cambio de luminancia hacia el 40–90 %— y 5 en los picos de actividad más separados);
    descriptor de audio (curva ASCII de sonoridad por tramos, golpes, silencios, cama/música; heurístico, a 8 kHz); «vacío» → «fondo oscuro/plano (%)» (`vis.oscuro_plano_pct`, `vacios_pct` queda como alias)
    + profundidad medida (`vis.profundidad`: espacial, textura, temporal, puntos de luz y nivel baja/media/alta, solo si domina el fondo oscuro; «n/a» en fondos claros).
  - Lectura obligatoria: el veredicto lleva `vistos` (≥ 7 archivos distintos, ≥ 4 `recortes/rN` y ≥ 3 `tiras/tN`); `registrar`/`registrar-lote` rechazan menos. Prompts (`PANEL.md`, `PANEL-CALIBRACION.md`) actualizados.
  - `data/gusto.md`: H09 (didáctico con materia; origen N10, spec 001), matiz en H04/A07/A08, C12 (oscuro con profundidad, PESO ALTO; spec 012, N09, N17) y refuerzo en C09/A01, nueva sección 7 «Movimiento» (M01–M06; origen `exp 2026-10-13` + notas).
    La rúbrica pasó a la sección 8 y las notas generadas a la 9. Director: criterio nuevo `movimiento` (4.º); ojo: materia con recortes 4×; escéptico: «enseñar no es genérico».
  - Lote 2 (`calibracion2`, semilla 7002 en `data/calibracion.json` → `semillas`): mapa nuevo (ninguna letra coincide con el lote 1). Es el lote por defecto de `prompt --calibracion`, `preparar-calibracion` y `calibrar`; el 1 sigue con `--lote calibracion`.
- **Pendiente (director):** lanzar los 3 críticos del lote 2 y `node engine/panel.mjs calibrar`. Si ρ < 0,7, mirar `out/panel/calibracion2-resultado.json`.
  Aviso: potencias_v1 y potencias_v2 comparten imagen (solo cambia el audio), por eso el descriptor de audio decide ese par; si el panel no lo separa, es un límite de la evidencia, no del perfil.

## Hecho
- `data/gusto.md`: 50 reglas observables (más 18 de las notas, generadas) con origen (`N##` = posición en `data/notas.json`, `spec ###`, `research ##`, `MODO-LIBRE`, `exp`), en 6 grupos
  (historia/voz, ritmo, composición/materia, color/tipografía, sonido, anti-patrones); rúbrica 0–10 de las 3 miradas; sección «Notas humanas» GENERADA.
- `engine/gusto.mjs`: `build` (regenera la sección de notas), `nota <film> "<texto>" [--nota N --dim d]` (G5: añade la nota a `notas.json` y regenera), `check`.
- `engine/panel.mjs` (comandos del lote 2: `prompt <mirada> --calibracion` → agente → `calibrar`): `preparar`, `registrar`, `veredicto`, `calibrar`, y los auxiliares `prompt`, `preparar-calibracion`, `registrar-lote`.
  - Paquete (`paquete.md` + `paquete.<mirada>.md`): `hoja.jpg`, `frames/f01–f12`, `recortes/r1–r6` (zona de 1/4×1/4 con más bordes por Sobel, ampliada 4×), audio (ebur128),
    % de fotogramas vacíos (≥ 97 % de un tono) y de fondo plano (marco sin textura ni degradado), cortes duros, CV y actividad por tramos, reglas y rúbrica de la mirada.
  - Con `--nombre X` el paquete es anónimo: sin ruta, sin nombre, sin notas humanas.
  - SHIP = media de las 3 miradas ≥ 8 y ninguna < 6. Exit: 0 SHIP, 3 FIX, 2 incompleto.
- `data/calibracion.json`: 12 películas con nivel ordinal 1–5 (deducido de las notas) y 8 pares de orden (4 de la spec + 4 deducidos de las notas); umbral ρ ≥ 0,7.
- Prompts en `docs/current/PANEL.md` (común + enfoque por mirada, autocontenidos) y `docs/current/PANEL-CALIBRACION.md` (prompt de pasada única + comandos).
- Paquetes del lote 2 en `/home/carlos/Documentos/MUltia/opus-studio-4/out/panel/calibracion2/{A..L}` (ignorado por git; se regeneran con `node engine/panel.mjs preparar-calibracion`, ~3 min). Mapa: `out/panel/calibracion2-mapa.json` (no lo leen los críticos). El lote 1 (`calibracion/`) se conserva.
- Test `test/gusto.mjs` (68 comprobaciones, incl. tiras, descriptor de audio, `vistos`, reetiquetado y lote 2; suite `test/suites.d/gusto.json`).

## NO hecho (a propósito)
- La calibración con críticos NO se ha ejecutado. La lanza el director con 3 agentes Sonnet: ver `docs/current/PANEL-CALIBRACION.md`
  (`node engine/panel.mjs prompt <director|ojo|esceptico> --calibracion` → agente Sonnet → `node engine/panel.mjs calibrar`).
- Integración del panel en el orquestador/gates y el storyboard (G1–G3): fuera de esta tarea.

## Decisiones y límites
- Las reglas se derivan de las mismas notas que luego calibran el panel: parte de la calibración es en muestra. Se mitiga ocultando notas y nombres; la prueba real son films y notas nuevos.
- Las mediciones de fondo oscuro/plano y profundidad son heurísticas de baja resolución (320×180): los umbrales de `profundidad()` se ajustaron mirando los 12 films (negro del mate v1 = baja; cosmos con estrellas = media); son pista, no sentencia.
- Los fotogramas pueden mostrar el título del film en pantalla: el anonimato cubre archivos y metadatos, no el contenido de la imagen.
- `world3d_datacenter` (6 s, sin audio) queda fuera de la calibración. `botella_libre_v2`, `botella_v3_haiku_*` no tienen nota humana.
- Ids de nota por posición: `notas.json` solo debe crecer por el final (`gusto.mjs nota` ya lo hace).
