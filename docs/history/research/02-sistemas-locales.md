# Sistemas reutilizables encontrados en el equipo del autor

> HISTÓRICO: documento fechado; puede no reflejar el estado actual (ver [STATUS.md](/STATUS.md)).

Fuente principal: Symbiaxis ("Franke Control Plane"), plugin de Claude Code con hooks + skills + estado por proyecto
(`policy.json`, `ledger.jsonl`, `workunits/`, `gcc/`, `memory/`, `snapshots/`). Advertencia del propio sistema:
poco uso real medido. **Adoptar mecanismos sueltos, no el andamiaje.**

## Mecanismos
1. **Policy gate + ledger** — reglas `{id, match, action: allow|deny|escalate, risk R0..R4}`, primera coincidencia gana; modo `observer|enforce` (en observer registra `would_decide` sin bloquear: mide falsos positivos antes de activar). Ledger append-only con `decision_id`, `input_digest` (sha256[:16]), `shape` (clase de acción por lista blanca, nunca la instancia: no filtra secretos) y clase de fallo cerrada (`interrupted|timeout|exit:N|…`). Presupuestos leídos del ledger. Los hooks nunca rompen la sesión (`exit 0` ante excepción).
2. **WorkUnit + checkpoint** — una tarea no puede crearse sin criterios `criterio::comando`; no se cierra si algún comando no da exit 0; `--force-close "razón"` queda grabado. Enforcer de Stop con guard anti-bucle (cede tras 2 bloqueos y lo registra).
3. **Pizarra compartida (GCC)** — JSON por tarea, escritura atómica (tmp + `os.replace`), `merge` por clave con política definida (unión por URL con max τ, promedio de probabilidades, dedupe). `summary()` determinista ≤500 tokens para subagentes. Los agentes solo escriben vía CLI.
4. **Quorum anti eco-cámara** — hay consenso si ≥k trayectorias comparten la hipótesis líder **y** sus evidencias son independientes por pares (Jaccard < θ). IPR (índice de investigación pendiente) decide si seguir, escalar o parar.
5. **Contratos tipados** — `HandoffContract {task, scope, allowed_capabilities, forbidden_actions, context_budget, acceptance_criteria, escalation_triggers}` y `OutputBundle {summary, evidence, changed_artifacts, risks, confidence, next}`.
6. **Eficiencia** — nunca compresión léxica sobre identificadores; comprimir estructura (tablas/TOON 25-46 %); referencia en vez de copia (5-20×); en fan-out no pasar contexto entre hermanos; determinista antes del LLM (truncar salida a head+tail+ruta, verificar con lint); índice grep-first de una línea por archivo.
7. **Compactación a punteros** — extraer identificadores literales por regex, verificar que existen en disco, guardarlos con peso τ (decay + refuerzo por uso) y un `why` ≤140 caracteres en decisiones. Sin resumen en prosa.
8. **Calibración bayesiana con clamp** — `posterior = (1−w)·prior + w·MLE`, `w = min(0.5, N/60)`, `posterior ∈ [prior/2, 2·prior]`. Para umbrales de gates.
9. **graphify** — grafo AST + semántico con `source_location`, relaciones dudosas marcadas AMBIGUOUS (nunca inventar aristas), actualización incremental por manifest, consultas con presupuesto de tokens.
10. **Enjambre solo cuando compensa** — medido: +0.79 de calidad a 2.61× de coste; router por entropía (un agente si la tarea es clara).

## Aplicación
Ledger + observer→enforce para gates (F1); criterios ejecutables por tarea (F1); escritura atómica y merge por clave para estado compartido (F1/F3); quorum Jaccard entre críticos (F3); punteros verificados para el índice (F4); calibración de umbrales del lint dramático (F5).
