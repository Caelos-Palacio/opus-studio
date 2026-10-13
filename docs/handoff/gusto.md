# Handoff — perfil de gusto y panel de críticos (spec 022, rama `gusto`)

## Hecho
- `data/gusto.md`: 50 reglas observables (más 18 de las notas, generadas) con origen (`N##` = posición en `data/notas.json`, `spec ###`, `research ##`, `MODO-LIBRE`, `exp`), en 6 grupos
  (historia/voz, ritmo, composición/materia, color/tipografía, sonido, anti-patrones); rúbrica 0–10 de las 3 miradas; sección «Notas humanas» GENERADA.
- `engine/gusto.mjs`: `build` (regenera la sección de notas), `nota <film> "<texto>" [--nota N --dim d]` (G5: añade la nota a `notas.json` y regenera), `check`.
- `engine/panel.mjs`: `preparar`, `registrar`, `veredicto`, `calibrar`, y los auxiliares `prompt`, `preparar-calibracion`, `registrar-lote`.
  - Paquete (`paquete.md` + `paquete.<mirada>.md`): `hoja.jpg`, `frames/f01–f12`, `recortes/r1–r6` (zona de 1/4×1/4 con más bordes por Sobel, ampliada 4×), audio (ebur128),
    % de fotogramas vacíos (≥ 97 % de un tono) y de fondo plano (marco sin textura ni degradado), cortes duros, CV y actividad por tramos, reglas y rúbrica de la mirada.
  - Con `--nombre X` el paquete es anónimo: sin ruta, sin nombre, sin notas humanas.
  - SHIP = media de las 3 miradas ≥ 8 y ninguna < 6. Exit: 0 SHIP, 3 FIX, 2 incompleto.
- `data/calibracion.json`: 12 películas con nivel ordinal 1–5 (deducido de las notas) y 8 pares de orden (4 de la spec + 4 deducidos de las notas); umbral ρ ≥ 0,7.
- Prompts en `docs/current/PANEL.md` (común + enfoque por mirada, autocontenidos) y `docs/current/PANEL-CALIBRACION.md` (prompt de pasada única + comandos).
- Paquetes de calibración ya preparados en `/home/carlos/Documentos/MUltia/opus-studio-4/out/panel/calibracion/{A..L}` (ignorado por git; se regeneran con `node engine/panel.mjs preparar-calibracion`).
  El mapa letra → película está en `out/panel/calibracion-mapa.json` (no lo leen los críticos).
- Test `test/gusto.mjs` (54 comprobaciones; suite `test/suites.d/gusto.json`).

## NO hecho (a propósito)
- La calibración con críticos NO se ha ejecutado. La lanza el director con 3 agentes Sonnet: ver `docs/current/PANEL-CALIBRACION.md`
  (`node engine/panel.mjs prompt <director|ojo|esceptico> --calibracion` → agente Sonnet → `node engine/panel.mjs calibrar`).
- Integración del panel en el orquestador/gates y el storyboard (G1–G3): fuera de esta tarea.

## Decisiones y límites
- Las reglas se derivan de las mismas notas que luego calibran el panel: parte de la calibración es en muestra. Se mitiga ocultando notas y nombres; la prueba real son films y notas nuevos.
- Las mediciones de vacío/plano son heurísticas de baja resolución (320 px): un cosmos oscuro con pocas estrellas cuenta como «vacío»; los críticos las usan como pista, no como sentencia.
- Los fotogramas pueden mostrar el título del film en pantalla: el anonimato cubre archivos y metadatos, no el contenido de la imagen.
- `world3d_datacenter` (6 s, sin audio) queda fuera de la calibración. `botella_libre_v2`, `botella_v3_haiku_*` no tienen nota humana.
- Ids de nota por posición: `notas.json` solo debe crecer por el final (`gusto.mjs nota` ya lo hace).
