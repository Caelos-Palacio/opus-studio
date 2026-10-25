# Roadmap (2026-10-05, v2) — integra la auditoría externa (verificada: 7/7 hallazgos reales)

Meta: estudio autónomo, gobernable y verificable que produce vídeo con ASOMBRO (nota del usuario ≥ 8).
Método: 3DD · agentes Sonnet · el usuario califica. Las 4 capas de control (harness, semántica, orquestación,
gobernanza) se llevan AL LÍMITE: cada garantía que el sistema promete debe ser verdad, medida y con test adversarial.

## 1. Calificaciones del usuario  (bloquea 2 y la calibración)
potencias_v2 (soundtrack) · A/B Mate papel · world3d (demo + A/B Potencias).

## 2. Harness al límite  (lo que garantiza que el motor no miente ni se cuelga)
- Fronteras de entrada: `edit.schema.json` + asserts runtime (speed > 0 y finito, src1 > src0, EDL no vacío) — hoy speed=0 cuelga cut (cut.mjs:134). Esquemas para TODA entrada de agente (layers, notas, entregas, story, memoria, score) con tests adversariales (fuzz).
- Runtime: `engines: node >=22.15`; sandbox FAIL-CLOSED si falta registerHooks (`--unsafe-legacy-node` solo dev).
- `engine/paths.mjs` único con fileURLToPath (21 usos de .pathname).
- CI real en GitHub (nunca ejecutada) + matriz Linux/macOS; tests sin red.
- Determinismo y freshness ya fuertes; añadir prueba de reproducibilidad entre dos clones limpios.

## 3. Semántica al límite  (que el vídeo sea datos con significado)
- Vocabulario/ontología común (ver research/10-rosetta.md): una sola fuente de términos para film, memoria conceptual, métricas (spec 005), crítico, índice y orquestación.
- DSL declarativo de escenas (scene/objects/transitions/cues) para el ~80 % de shots; JS como escape hatch; semantic diff, dependencias exactas y validación por esquema.
- Índice semántico v2 (nodos y params, no píxeles) + export OTIO; memoria conceptual enlazada a métricas y crítica.
- Compactación semántica a punteros verificados para contexto de agentes (orch brief, handoffs).

## 4. Orquestación al límite
- Gate TRANSACCIONAL: snapshot con hash → criterios sobre ESE snapshot → freeze de contratos → verificación → commit atómico; si algo falla, no se cierra (hoy gate.mjs cierra y luego congela; TOCTOU al tomar hashes tras los criterios).
- Evidencias como `argv`/command-IDs en allowlist; jamás string → shell (orch.mjs:41, gate.mjs criterios con shell:true).
- Scheduler por dependencias reales (q deps/impact) con oleadas automáticas y reanudación tras corte (handoff continuo).
- Briefs por rol compactados (T1/T2), contabilidad de tokens (T9).

## 5. Gobernanza al límite
- Roles en modo ENFORCE (hoy observer) tras medir falsos positivos en el ledger.
- Ledger con cadena de hashes (tamper-evident) y firma por agente; replay/auditoría de cualquier decisión.
- Verdad documental: `STATUS.md` GENERADO desde el estado real (gates, veredictos, ramas, tests) y verificado en CI; docs/current · specs · adr · history. Docs obsoletas = estado falso en el control loop.
- Política de presupuesto (tokens, tiempo de render, iteraciones) aplicada por el orquestador.

## 6. Congelar la expansión horizontal del motor → Producción v2
3–5 films ambiciosos con lo existente (medios, world3d, soundtrack, memoria, métricas como objetivos), calificados
por el usuario. Registrar qué shots cuestan trabajo manual, qué primitivas faltan, qué se siente genérico.

## 7. Iterar desde la evidencia
Calibración (métricas ↔ notas), rendimiento sobre hotspots medidos (R1 caché de fotogramas, R6 lint incremental,
R7 audio cacheado, Skia tras capa film.canvas), y el siguiente subsistema SOLO si la producción lo pide.

Pendiente técnico conocido: caché del crítico vs gate (key/hash); capa de memoria de regla no se carga;
mp4 con grano pesa 10× (crf por medio); world3d sin sombras proyectadas/bloom/mallas; TeX dinámico bloqueado en sandbox.

## 8. Plan vigente (2026-10-08): ola E — producción con voz y velocidad
Contexto: comparación con Claude Code + Remotion Skills, Claude Design y Nyx Motion. Ellos ganan en velocidad y pulido
inmediato (ecosistema web, vectores, retoque humano); nosotros en guion → gobernanza → nota humana, determinismo y sonido.
Se adoptan sus ventajas sin perder el proceso.

- **E2 films de prueba (spec 013 H1).** Consta (spec 017) y Veinticuatro ✓ integradas en main; esperan nota. Veinticuatro: verificar contra
  Hirata et al. 1987 qué evento de Kamiokande‑II queda fuera de los 11 (¿6.º o 12.º?) y corregir guion/film. Botella: producir.
- **E3 voz y sincronía (spec 018).** TTS congelada como asset con hash (determinismo) + **timeline sincronizado a
  transcripción con tiempos** (palabra/frase → cue): la animación sigue el argumento hablado, como el flujo de Claude Design.
  La narración es opcional por film (el guion decide, spec 012 P1).
- **E4 boceto rápido (spec 019) ✓ integrado en main (falta nota del usuario, H1).** Modo `boceto`: previsualización baja (resolución/fps reducidos, sin gates) para decidir el
  concepto en minutos antes de la producción gobernada; live preview con recarga al editar `.scene.json`.
- **E5 vectores y diagramas (spec 020) ✓ integrado en main (2026-10-12).** Importar SVG como objeto/elemento (paths a canvas, recoloreable por medio, con hash),
  para no dibujar a mano objetos pobres (secante, mosca de Consta). Recetas `diagrama_flujo`, `diagrama_capas`,
  `barras_antes_despues`, tipo `box` con rótulo y perfil de lint `lamina` (deuda del film `sistema`).
- **E6 fondos libres (spec 021) ✓ integrado en main (2026-10-12).**
- **Deuda viva.** (`npm test -- --full` en main: ✓ verde el 2026-10-12.) Eval ciega del toolbox (intenciones escritas por un agente sin contexto); pulir presets cosmos_profundo,
  papel_carta_acuarela, laboratorio; `npm test -- --full` en main; push a GitHub (solo con confirmación).
- **Bugs vistos por E3:** (RESUELTO bf078d4) un film de un solo plano con `timeline.sound` daba NaN en la mezcla. Voz de calidad: piper + modelo es-ES (hoy espeak-ng, robótico).

## 9. Plan de cierre v6, económico (2026-10-25)
Principios: el menor número de agentes y tokens posible. Edits pequeños los hace el director directamente; un único
agente Sonnet por fase y Haiku solo para correr tests. SIN vídeos completos intermedios: se valida con stills,
storyboard y clips de ≤ 5 s. Como mucho UNA película completa al final, y es opcional. Ver docs/research/13.

- **F0 (director, sin agentes).**
  - Identidad noreply en los commits (hecho).
  - Brief MODO-LIBRE:
    - la estructura sugerida es guía y nunca texto de pantalla;
    - el texto desbordado es un fallo;
    - excepción «aire» a la ocupación del sujeto;
    - prohibidos los elementos de interfaz (botón, cursor, ventana);
    - una rareza deliberada y un momento memorable sin texto;
    - las cifras fijas pasan a ser rangos o ejemplos.
  - Pliego de sorpresa: `data/entregas.json` (paleta, medio, tipo, sonido, estructura) y veto de repetir ≥ 2 de 5
    rasgos de las últimas 3 entregas.
  - Archivar `film-botella` con un tag.
  - Congelar y anotar como no prioritario: π lento, presets flojos, eval del toolbox, voz piper, rehacer Consta,
    defectos de Botella v2.
- **F1 (1 Sonnet, ≈ 1 sesión).**
  - Integrar `gusto` y bajar el panel a filtro de mínimos (auditoría automática sin LLM: clip-art, negro vacío, texto
    ilegible, audio, determinismo) más una comparación A/B opcional.
  - Se abandona la meta ρ ≥ 0,7.
  - `dsl-perf` queda marcado como sensible a la carga.
  - Una sola `--full`, corrida por Haiku.
- **F2 (1 Sonnet, ≈ 1–2 sesiones).**
  - `opus v6 <encargo>`: idea → guion v2 → `storyboard.html` (solo stills) → `consultar` (pausa y cambios en `plan.md`)
    → producción libre → auditoría → filtro.
  - Se prueba con stills y con un clip de 5 s.
- **F3 (1 Sonnet, ≈ 1 sesión).**
  - Kit: 2 gramáticas nuevas (neón y tiza/pizarra) para romper la monocultura sepia.
  - Arreglos: barrido por objeto, busto de la moneda, sello ≥ 10 piezas, contraste con alfa, tinta.
  - Se valida con `muestra.jpg`.
- **F4 (opcional).** Una película v6 completa con tema y medio nuevos, en modo `consultar`.
- **F5.** Push a GitHub, solo con confirmación del usuario.

Presupuesto estimado: F1 ≈ 150k, F2 ≈ 250k, F3 ≈ 150k y F4 ≈ 200k tokens (≈ 0,6–0,8 M en total).
