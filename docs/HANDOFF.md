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

## WIP (agente detenido), ver docs/handoff/ en cada rama
- `worktree-agent-a55c05dc1fd0f272f` — F3 orquestación (falta simulación de 4 agentes y verificar tests). NO integrada a propósito.

## Pendiente
- F6 rendimiento. `npm audit`: @xmldom/xmldom (vía mathjax-full).
- Del film de estrés: masterGate deja pasar sin veredicto del crítico; pops ignoran impactos declarados;
  redondeo engañoso en lint.mjs:200; ledger con agent "anon" sin aviso; lint por rango de tiempo.
- test/gov.mjs "lease vivo" fallaba bajo carga (el lease de 150 ms caducaba antes de que arrancara el proceso hijo): ahora
  usa 4 s. Si reaparece otro intermitente, repetir con `npm test -- --only <nombre>`.
- F5: falta `engine/arc.rubric.mjs` (lo no medible, para el crítico); `engine/arc.json` no entra en `ENGINE_DATA` de hash.mjs
  (cambiar un umbral no caduca veredictos); los pops del lint no ignoran los impactos declarados (`api.impact`).
- Memoria: exponer en A3 mandos para eco/hold/acento y poner `memoria capa --check` en un gate.
- Siguiente: F3 (rama aparte), F6 rendimiento, 3DD (docs/specs).
