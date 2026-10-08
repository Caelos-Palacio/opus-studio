# Rama `diagramas`: el motor dibuja diagramas estáticos del propio sistema

Petición: «¿el sistema puede hacer visualizaciones estáticas? Haz gráficos del proceso y el sistema.» Respuesta: sí; film `sistema` (`npm run use -- sistema`, 5 láminas × 8 s, cada still final es un diagrama). Entrega: `out/entregas/diagramas/01-pipeline.png … 05-eficiencia.png` + `hoja.png`.

## Qué hay
- `data/sistema/timeline.json`: medio `tecnico_plano` (nuevo, `styles/medios/tecnico_plano.json`: cianotipia con cuadrícula milimetrada y HUD de lámina; elegido porque el tema es «el plano del sistema»), estilo soft, perfil cinematic con `maxHold` 8.
- `shots/S01..S05.scene.json` (DSL NATIVO; `.mjs` generados): S01 pipeline en serpiente (12 etapas), S02 ciclo 3DD con dos ejemplos reales (fondo negro → `fondo.vacio`; plantilla → lint narrativo), S03 arquitectura por capas (6 capas con sus módulos y contrato), S04 orquestación de agentes (director, escéptico ciego, 3 agentes Sonnet, WIP, handoff, integración, main, toolbox), S05 eficiencia (barras antes/después, cada fila a su escala).
- Motor (general, con test): tipo DSL `arrow` (envuelve `api.arrow`, test C2d en `test/dsl-cov.mjs`); lista `nativo` en `data/dsl-coverage.json` para shots nacidos en DSL (cuentan en la cobertura, sin JS legado; C3c impide usarla como puerta trasera); término `tecnico_plano` en `data/vocab.json`.
- Suite nueva `test/diagramas.mjs` (D1–D5, registrada en `test/suites.d/diagramas.json`): film nativo, lint sin FIX, stills no vacíos y deterministas, flechas/cajas del DSL, cifras de S05 presentes en la documentación.
- Cobertura DSL: 95,2 → 95,6 % (5 shots nuevos, todos DSL).

## Cifras de S05 (verificadas)
master 167→84 s, lint caliente 70→1,5 s, contexto 15 300→1 400, cobertura 3,2→95,2 %: `docs/current/EFICIENCIA.md`, `STATUS.md`, `docs/handoff/dsl80.md`. `npm test` quick 890→188 s: medido aquí (12 en paralelo) y añadido a EFICIENCIA.md (el «167 s» del encargo era el master). mp4 de Mate «292→83 MB»: NO se encontró en docs; se sustituyó por la cifra documentada de `docs/current/MEDIOS.md` (5 s de Mate: 15,9 → 3,8 MB, papel crf 16 → grano crf 24).

## Cómo regenerar
Edita `shots/S0N.scene.json` → `node engine/dsl.mjs build shots/S0N.scene.json` → `node engine/render.mjs --still 7.5` (finales en 7.5, 15.5, 23.5, 31.5, 39.5). `OPUS_DIAGRAMAS_OUT=<dir> node test/diagramas.mjs` guarda los stills del test.

## Qué faltó en el motor (deuda)
- No hay receta ni objeto de «caja con texto», «flecha entre cajas» ni «barras comparativas»: `tools find` solo ofrece `prim:arrow`; cada lámina se compuso con `repeat` + `shape` + `text`. Candidatas: recetas `diagrama_flujo`, `diagrama_capas`, `barras_antes_despues` (y un tipo `box` con texto, hoy `box` del DSL no lleva rótulo).
- Un `repeat` con campos posicionales hace los JSON largos (≈450–700 líneas por lámina): conviene un generador/receta que emita el JSON desde una lista de nodos y aristas.
- El lint no entiende «lámina estática»: pide foco, legibilidad (`readCps`) y avisa de 7 colores/4 tamaños; se declaró `hold_ok` y un `focus` por lámina. Un perfil `lamina` evitaría avisos como «visible 4 s < 5,7 s de lectura».
- El HUD del medio (REV, hoja) es texto fijo del medio, no del film.
