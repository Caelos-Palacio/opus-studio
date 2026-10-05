# Roadmap consolidado (2026-10-05)

Meta: estudio autónomo y gobernable que produce vídeo con ASOMBRO (juez: nota del usuario ≥ 8), barato en tiempo y tokens.
Método: 3DD (spec → escenarios → test rojo → código) · agentes Sonnet (≤3 en paralelo) · el usuario califica.

## Hecho
- F0 cimientos (CI, golden de píxel, film de estrés), F1 gobernanza, F2 harness (esquema, crítico honesto, guardia AST + sandbox, hash por contenido).
- F4 objetos paramétricos (params, señales, DSL, capas, cookKey) + memoria conceptual (grafo temporal, reinterpretaciones → capas).
- F5 dramaturgia (arc, story.json, A/B PowerPoint vs arco) · F5b soundtrack v1 (partitura generativa, diseño sonoro, mezcla; 15 medibles).
- 3 vídeos de espectro (regla, reel, mate): "bien, no wow" → spec 003 (mundo visual) con 4 referencias analizadas.
- CLAUDE.md, subagentes Sonnet, docs/EFICIENCIA.md.

## Por hacer (en orden)
| oleada | qué | agentes | gate |
|---|---|---|---|
| 1 (en curso) | Integrar los 3 vídeos; P1 film activo (`npm run use`), P2 master por film, P5 `peek`, P8 audit | 1 Sonnet | tests verdes |
| 2 | **Mundo visual** (spec 003): sistema de MEDIOS (papel/tinta, collage, técnico+acentos, neón tipográfico): soporte, textura, grano, paleta, composición, parallax; A/B de *Mate* · **Spike WebGL** (Three.js en el pipeline, shot "datacenter") | 2 Sonnet | **usuario califica A/B** y decide WebGL sí/no |
| 3 | **Eficiencia**: R0 perfilado → R1 caché de fotogramas, R2 capas estáticas, R3 fx a ½ res, R4 rawvideo→ffmpeg, R5 Skia, R6/P3/P4 lint incremental y por check, R7 audio cacheado · **Tokens** T1 contexto por rol, T2 salidas `--summary`, T9 contabilidad | 2 Sonnet | master ≤ ⅓, lint de un shot ≤ 15 s, golden intacto |
| 4 | **F3 orquestación** (rama WIP: simulación de 4 agentes, trinquete, anti-oscilación) + deuda: masterGate exige crítico, pops ignoran impactos, arc.json en hash, rúbrica de arc, mandos eco/hold/acento, redondeo del lint, ledger "anon" | 1–2 Sonnet | simulación converge |
| 5 | **Producción v2**: rehacer regla/reel/mate (y Potencias) con medios + soundtrack + memoria; un medio derivado del tema por film | 3 Sonnet (productor-video) | **usuario califica ≥ 8** |
| 6 | Iterar con las notas (recalibración bayesiana de umbrales); F4 pendiente (índice semántico v2/OTIO, grafo de operadores) y F6 alcance (TTS, preview hot-reload, export ProRes/alfa) | según notas | — |

## Calificaciones pendientes del usuario
- potencias_v2.mp4 (soundtrack sistematizado) · A/B de Mate (oleada 2) · vídeos v2 (oleada 5).
