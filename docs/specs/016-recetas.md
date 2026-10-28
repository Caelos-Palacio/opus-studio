# 016 — Recetas: el agente no escribe todo el código

## Intención (usuario, 2026-10-07)
"Que el agente no genere todo el código, sino elementos básicos y algunas plantillas muy simples, pero que no rigidicen el
proceso creativo, y hagan que el agente no deba generar todo el código."

## Capas
1. **Primitivas:** `api.*` y los tipos del DSL. Ya existen.
2. **Elementos:** capas de fondo y objetos concretos (spec 014, rama `fondos`).
3. **Recetas (esta spec):** esqueletos MUY cortos de `.scene.json` para patrones de plano, movimiento y transición. Son puntos de
   partida: el agente los copia y los edita.

## Principios (anti-rigidez)
- **Scaffold, no herencia.** `opus new shot <id> --receta <r> [--objeto o] [--fondo f]` ESCRIBE un `.scene.json` propio del
  film. No queda dependencia de la receta: cambiarla después no altera los films que ya la usaron.
- **Mínimas.** Una receta tiene ≤ 25 líneas de JSON, ≤ 4 params expuestos y huecos marcados `"$hueco": "…qué va aquí…"` que
  el agente debe llenar con lo concreto del film. El lint da WARN `receta.hueco` si queda alguno sin llenar.
- **Opcionales.** Ningún check exige recetas. Un film sin recetas es válido.
- **Anti-molde.** WARN `receta.repeticion` si una misma receta genera más del 50 % de los shots de un film, o si los 3 films
  de una oleada comparten la misma secuencia de recetas.
- **Descubribles.** Cada receta tiene `meta` (id, resumen ≤ 15 palabras, tags, params) y aparece en `tools find` (spec 015).

## Catálogo inicial (≈ 15; se amplía por demanda medida, no por anticipación)
- **Plano:**
  - presentar_objeto: el ancla entra y se asienta, con un detalle que se lee;
  - revelar: de un detalle al todo, o del todo al detalle;
  - comparar: dos cosas lado a lado y una diferencia que se marca;
  - contar: un contador con eventos al ritmo real;
  - pausa_sostenida: nada ocurre, el fondo respira y el silencio se sostiene;
  - escala: zoom entre órdenes de magnitud;
  - documento: un acta, una tarjeta o un listado en la que se escribe o se sella;
  - detalle: un primer plano con textura.
- **Movimiento** (también como modificadores de cualquier objeto): acercar, orbitar, caida_con_peso, temblor, parpadeo, deriva.
- **Transición:** morph_objeto, corte_eco (forma o sonido que continúa), barrido_por_objeto.

## Medibles y escenarios (BDD) — `test/recetas.mjs`
- R1 `opus new shot X --receta revelar --objeto botella` crea `shots/X.scene.json` válido para el schema estricto del DSL, que
  compila y renderiza. Volver a generarlo no pisa un archivo existente sin `--force`.
- R2 Cada receta tiene ≤ 25 líneas, ≤ 4 params y ≥ 1 `$hueco`. Su `meta` está completo y aparece en el registro del toolbox.
- R3 Un `$hueco` sin llenar da WARN `receta.hueco` con la ruta.
- R4 Un film con más del 50 % de shots de la misma receta da WARN `receta.repeticion`.
- R5 Las recetas de movimiento se aplican como modificadores a cualquier objeto o elemento sin código nuevo (composición).
- R6 Determinismo y sandbox intactos. La cobertura DSL no baja (ratchet).
- R7 (medida de eficiencia) Producir un shot nuevo típico desde una receta cuesta ≥ 50 % menos tokens de escritura del agente
  que escribirlo desde cero. Se mide con el tamaño del diff que escribe el agente en 3 shots de ejemplo.
- [HUMANO] H1 Los films de la oleada E2 no se sienten hechos con plantilla.

## Fuera de alcance
Recetas de film completo (estructuras de guion enteras): rigidizarían el proceso. La estructura sale del story v2 (spec 013).
