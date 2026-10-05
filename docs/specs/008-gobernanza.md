# 008 — Gobernanza al límite (roadmap paso 5)

## Intención
"Que el estudio no pueda mentirse a sí mismo": lo que un agente hizo queda registrado de forma que no se pueda
reescribir sin que se note, los roles se hacen cumplir, la documentación describe el estado REAL y el gasto tiene techo.

## Traducción a medibles
1. Ledger tamper-evident: cadena `prev`/`h` por entrada, firma HMAC opcional por agente, códigos cerrados.
2. Roles en enforce por defecto, con falsos positivos medidos y cerca de cero sobre el trabajo real.
3. `STATUS.md` generado (`node engine/status.mjs`); docs obsoletas o enlaces rotos fallan el test.
4. Presupuestos (`data/budgets.json`) leídos del ledger; informe y bloqueo exportable para gate/orch.

## Fuera de alcance
- Mover contenido a un servicio externo / firma asimétrica. Activar el hook en `.claude/settings.json` (lo hace el usuario).
- Editar `gate.mjs`/`orch.mjs`: se documenta el punto de enganche (docs/handoff/gobernanza.md).

## Escenarios (BDD) — cada uno es un test en `test/gov.mjs`
### Ledger
- E1 Dadas N entradas, `ledger verify` pasa y cada entrada lleva `prev` = `h` de la anterior.
- E2 Editar un campo de una entrada → verify falla en esa línea (`edit`).
- E3 Borrar una entrada intermedia → falla (`chain`); borrar la última → falla (`truncated`).
- E4 Reordenar dos entradas → falla. Insertar una entrada forjada (aun con `h` coherente) → falla.
- E5 Un ledger heredado (sin `h`) se migra con un génesis que sella su digest; editar lo heredado después → falla.
- E6 Con clave `out/keys/<agente>`: las entradas de ese agente llevan `sig`; alterar `sig` o quitarla → falla; sin la clave verify avisa "no verificable" pero no falla.
- E7 Dos procesos concurrentes escriben 240 entradas y la cadena sigue válida.
- E8 Códigos cerrados: ≥ 90 % de las entradas de los flujos reales llevan `code` del vocabulario; una acción desconocida queda `code: null` y cuenta en `ledger stats`.
### Roles
- E9 Se mide el modo observer sobre el historial real (`roles.mjs replay`): los denegados son solo escrituras que de verdad exceden el rol.
- E10 `roles.json` en `mode: "enforce"`; `OPUS_ROLES_MODE=observer` lo desactiva.
- E11 Hook: Animator A2 sobre `data/timeline.json` o `engine/*.mjs` → deny; Director → allow; animator sobre su shot → allow; error del hook → pasa.
### STATUS
- E12 `status.mjs` genera STATUS.md con gates, veredictos vigentes/caducados, ramas sin integrar, tests, versión de motor, specs y su última nota.
- E13 `status.mjs --check` falla si STATUS.md no coincide con el estado versionado (tocar gates.json, añadir una spec).
- E14 No hay enlaces rotos en los .md del repo.
### Presupuestos
- E15 Con `data/budgets.json`, `ledger budget` suma tokens por rol/tarea, minutos de render por film e iteraciones por shot/gate; avisa al 80 % y bloquea al 100 %.
- E16 `checkBudget()` exportado devuelve `{level:'ok'|'warn'|'block'}` y deja `budget.warn`/`budget.block` en el ledger.

## Calificaciones
(sin output audiovisual: no aplica nota de gusto)
