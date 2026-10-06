# Estado del plan v5 (traspaso)

## En main (integrado, `npm test` Todo verde)
- F0: CI, golden de píxel, cut=render, test paralelo + `--fast`.
- F1: ledger, locks con lease, veredictos sellados por hash, lint por shot, gates ejecutables, roles, snapshots.
- F2: esquema del timeline (E8), crítico fail-closed (E4), guardia AST + sandbox (E7), hash por contenido (E5).
- F4 paramétrico: params promovidos, señales, DSL, capas JSON Patch, cookKey (docs/PARAMS.md).

- Memoria conceptual (`engine/memoria.mjs`, `data/memoria.json`, `docs/MEMORIA.md`, `test/memoria.mjs`). Mandos del demo
  reconciliados con A3 (`pulse`, `textIn`); capa `data/layers/memoria.json` generada y válida (`params check`). Los mandos
  eco/hold/acento no tienen param numérico real: salen como "intención sin parámetro". `'memoria'` está en `NON_PIXEL` de `hash.mjs`.
  El golden corre con `OPUS_LAYERS=none` (película base), porque la capa de memoria cambia el demo a propósito (`pulse` 0,2 → 0,3).
- Film de estrés "Potencias" (78 s, `OPUS_TIMELINE=data/stress/potencias.json`: validate OK, lint SHIP con 16 avisos) y
  PoC de partitura (`engine/score.mjs`, `docs/MUSICA.md`).
- F5 dramaturgia (`engine/arc.mjs`, `engine/sakuga.mjs`, `data/story.schema.json`, `docs/ARC.md`, `test/arc.mjs`):
  A/B "PowerPoint" FIX frente a arco SHIP, golden intacto. El esquema del timeline admite `shot.on` y `shot.sakuga`.
  `lint --only arc` está enganchado; `data/story.template.json` es la plantilla.

- F5b soundtrack como sistema (spec `docs/specs/002-soundtrack.md`, doc `docs/MUSICA.md`): `engine/{dsp,score,sounddesign,mixer}.mjs`,
  `build()` en `sound.mjs`, estilo `styles/sound/epico.json`, campo `sound` del timeline (esquema), `data/stress/memoria.json`, `test/sound.mjs`
  (15 medibles, en `npm test`; `--fast` = Potencias ×0,6). Render: `OPUS_TIMELINE=data/stress/potencias.json node engine/sound.mjs --mux <video.mp4> --out out/potencias_v2.mp4`
  (solo cambia el audio). Pendiente solo la nota del usuario (fila "potencias v2" de la spec). `cut.mjs` respeta la mezcla v2 masterizada (sin loudnorm).

## Integrado el 2026-10-05 (main, `npm test` completo verde, golden bit a bit)
- Tres films y su motor, `git merge --no-ff`: **mate** (data/mate/, shots M*, estilo nocturno, sonido contemplativo), **reel** «Pulso» 9:16 (data/reel/,
  K*, estilo pulso, sonido electro, `engine/grid.mjs` rejilla de tempo, pistas de audio por instrumento) y **regla** (data/regla/regla.json, R*, estilo hierro,
  sonido forja, parámetro `json`). Los tres dan lint SHIP con su timeline explícito (mate 3 avisos, reel 48, regla 23).
- Identidad de film UNIFICADA en `engine/filmid.mjs` (la de reel; mate tenía otra copia en verdict.mjs/sound.mjs: eliminada). `score.mjs` combina ambas
  parametrizaciones (estilo `rev` o `revel`, capas opcionales kick/hat/tom/bass.pulse/kick.ghost, golpe con piano).
- Eficiencia P1/P2/P5/P8 hechas (docs/EFICIENCIA.md): **`npm run use -- <film>`**, línea `film:` en toda CLI, `--help` real, `npm run peek -- [film]`,
  `npm audit` limpio. Los tests de memoria/critic ya no dependen de out/.film (pasan con cualquier film activo).
- (RESUELTO en rama deuda) las capas de un film con carpeta se cargan de `<carpeta>/layers/`; el cookKey de regla cambia (ver docs/handoff/deuda.md).
- Los masters de mate/reel/regla NO se re-renderizaron: tras tocar el motor sus veredictos caducan (relanzar lint antes de `npm run master`).

## WIP (agente detenido), ver docs/handoff/ en cada rama
- `worktree-agent-a55c05dc1fd0f272f` — F3 orquestación (falta simulación de 4 agentes y verificar tests). NO integrada a propósito.

## Pendiente
- F5b: calificación humana de potencias v2 (objetivo ≥ 8) y recalibrar umbrales con la nota. Límites: síntesis simple (sin convolución ni muestras),
  un solo estilo sonoro, densidad rítmica medida sobre la partitura, `--fast` exige LRA ≥6. `data/stress/potencias.json` ganó el campo `sound`: el veredicto
  del lint de Potencias caduca (relanzar `npm run lint` con `OPUS_TIMELINE` antes de un `master`). El mp4 de v2 reutiliza el vídeo de la rama del film.
- F6 rendimiento. `npm audit`: @xmldom/xmldom (vía mathjax-full).
- Del film de estrés: masterGate deja pasar sin veredicto del crítico; pops ignoran impactos declarados;
  redondeo engañoso en lint.mjs:200; ledger con agent "anon" sin aviso; lint por rango de tiempo.
- test/gov.mjs "lease vivo" fallaba bajo carga (el lease de 150 ms caducaba antes de que arrancara el proceso hijo): ahora
  usa 4 s. Si reaparece otro intermitente, repetir con `npm test -- --only <nombre>`.
- F5: falta `engine/arc.rubric.mjs` (lo no medible, para el crítico); `engine/arc.json` no entra en `ENGINE_DATA` de hash.mjs
  (cambiar un umbral no caduca veredictos); los pops del lint no ignoran los impactos declarados (`api.impact`).
- Memoria: exponer en A3 mandos para eco/hold/acento y poner `memoria capa --check` en un gate.
- Siguiente: F3 (rama aparte), F6 rendimiento, 3DD (docs/specs).
