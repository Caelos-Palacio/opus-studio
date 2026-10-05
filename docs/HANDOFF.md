# Estado del plan v5 (traspaso)

## En main (integrado, `npm test` Todo verde)
- F0: CI, golden de píxel, cut=render, test paralelo + `--fast`.
- F1: ledger, locks con lease, veredictos sellados por hash, lint por shot, gates ejecutables, roles, snapshots.
- F2: esquema del timeline (E8), crítico fail-closed (E4), guardia AST + sandbox (E7), hash por contenido (E5).
- F4 paramétrico: params promovidos, señales, DSL, capas JSON Patch, cookKey (docs/PARAMS.md).

## Terminado en rama, SIN integrar
- `worktree-agent-a049889bf20ebb2cd` — memoria conceptual (data/memoria.json, engine/memoria.mjs, docs/MEMORIA.md).
  Al integrar: mover 'memoria' al NON_PIXEL de engine/hash.mjs (su rama lo puso en verdict.mjs); reconciliar nombres
  de params provisionales (escala, eco, hold, acento, retardo_texto) con los params reales de A1–A3 (docs/PARAMS.md).
- `worktree-agent-a616aaafdca8853f3` — film de estrés "Potencias" (78 s, lint SHIP) + docs/research/06-estres.md.

## WIP (agente detenido), ver docs/handoff/ en cada rama
- `worktree-agent-a55c05dc1fd0f272f` — F3 orquestación (falta simulación de 4 agentes y verificar tests).
- `worktree-agent-aeb50bfa4294a3a73` — F5 dramaturgia (falta correr suite; base antigua: merge con main).

## Pendiente
- F6 rendimiento. `npm audit`: @xmldom/xmldom (vía mathjax-full).
- Del film de estrés: masterGate deja pasar sin veredicto del crítico; pops ignoran impactos declarados;
  redondeo engañoso en lint.mjs:200; ledger con agent "anon" sin aviso; lint por rango de tiempo.
- Test intermitente bajo carga en test/gov.mjs (54/55 una vez; pasa aislado y 3× en paralelo).
