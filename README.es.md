# opus-studio — motor de producción cinematográfica por código

[English](README.md) · **Español**

![demo](docs/media/demo.gif)

<sub>GIF renderizado con el propio motor (`npm run demo:gif`; fuente en `data/demo-gif/`, `shots/G_lib.mjs`, `styles/suite.json`).</sub>

Estudio para agentes (Claude Code / Opus), v5.0.0. v3.5 codificaba la **dirección** (cámara con razón, gramática de cortes, gusto medible).
v4 añadió el **motor gráfico y de producción**: geometría Bézier universal, TeX real, scene graph, 2.5D, compositor de efectos,
sonido, montaje por fragmentos, índice semántico y crítico visual. v5 añade gobernanza (ledger encadenado, roles, gates transaccionales, orquestación), DSL de escenas, índice semántico v2 + OTIO, 3D real opcional (`world3d`) y sandbox de shots. Todo sigue siendo `seek(t)` puro y verificable.
La documentación en inglés está en el [README](README.md) y en `docs/en/`.

| eje | qué decide | dónde |
|---|---|---|
| **proceso** | viñetas → animatic → shots → lint → crítico → master, con gates | `PROMPTS.md`, `AGENTES.md`, `REVIEW.md` |
| **perfil** | ritmo y exigencia: `reel` · `explainer` · `cinematic` | `engine/profiles.json` |
| **estilo** | paleta, tipo, muelle, cámara, grade, post, profundidad | `styles/*.json`, `STYLES.md` |
| **gobernanza** | ledger, roles, gates, orquestación, presupuestos | `engine/ledger.mjs`, `roles.json`, `gates.json`, `orch.json` |
| **motor** | primitivas, scene graph, fx, sonido, montaje, índice | `MOTOR.md`, `docs/API.md` (generada) |

```
brief → ESTILO → audio → timeline → VIÑETAS ⇐ GATE → animatic ⇐ GATE → shots (paralelo)
      → autocam* → LINT (+guardia) → índice → CRÍTICO ⇐ GATE → sonido → master (fragmentos) [→ EDL]
                    ↻ FIX: reparar solo ese shot; solo se re-renderiza su fragmento
```
`*` solo si algún shot usa `cam.move:"auto"`.

## Arranque
```bash
npm ci                                   # Node >= 22.15; node-canvas; requiere ffmpeg en PATH
node engine/audio.mjs --click            # audio del demo
npm run lint                             # SHIP con el demo (editorial)
npm run gallery                          # el mismo film en TODOS los estilos → out/gallery.png
OPUS_STYLE=noir npm run sheet            # cualquier comando con otro estilo (o --style noir)
npm test                                 # regresión (debe dar "Todo verde"; ver Límites: en un clon completo falla gov E9)
npm run master -- --force "demo local"   # fragmentos con caché + audio → out/master.mp4
```
`npm run master` sin `--force` se detiene en el gate hasta que el crítico visual tenga veredicto vigente (`npm run critic`, luego `critic --verdict v.json` o `--api`). Es intencional.
Luego pega `ORQUESTADOR.md` en Claude Code y rellena el encargo (incluye **Estilo**: un pack, "elige tú", o 3 adjetivos + referencia).

## Estilos incluidos
editorial · scientific · noir · kinetic · soft · brutalist · stopmo · cosmos (bloom físico, aberración radial, niebla/DOF, grade con dither) · hierro · nocturno · pulso · y `suite` (la usa el GIF de demo). Catálogo completo en `STYLES.md`.

## Novedades v4 (base del motor)
- **Geometría única** (`geom.mjs`): todo es Bézier cúbica (SVG completo con arcos, glifos, formas). Morph arbitrario con emparejamiento de contornos y agujeros, draw-on por longitud de arco, deformaciones vectoriales (wave, bulge, twist, bend, noise, homografía).
- **TeX real** (`tex.mjs`): MathJax en JS puro, síncrono y cacheado. Escritura trazo→relleno y **morph semántico**: LCS sobre glifos, los símbolos iguales viajan rígidos.
- **Primitivas semánticas** (`prims.mjs`): axes, plot, arrow, field, streamlines (RK4), trajectory, particles (forma cerrada, sin estado), sim (checkpoints), graph (fuerzas sembradas), globe, label (auto-colocación), image, footage, layer, p3, card3d, atmos.
- **Scene graph** (`scene.mjs`): jerarquía, clips, tiempo local y **fps por nodo**, constraints puras (`follow` con retardo = mundo en t−lag), cámara que sigue nodos con inercia sin estado.
- **2.5D**: perspectiva por z, niebla, DOF (subárboles agrupados en una capa), tarjetas con giro 3D real.
- **Compositor** (`fx.mjs`): blur por cadena de reducción, bloom con umbral, motion blur por supermuestreo temporal exacto, trails, blur direccional, aberración radial, displacement, mesh warp, grade LUT + dither TPDF.
- **Autocámara** (`autocam.mjs`): mínimos cuadrados ponderados con regularización de 2º orden, λ mínimo por bisección que cumple los límites del estilo y proyección que mantiene el texto en el área segura.
- **Montaje** (`cut.mjs`): fragmentos con hash de contenido (solo se re-renderiza lo que cambió) y EDL no destructiva: velocidad, reversa y congelado re-renderizados desde la fuente. OTIO: `npm run q -- otio`. El hash (`engine/hash.mjs`) sigue el grafo real de imports del motor y de cada shot, y mide assets, fuentes y mezcla por sha256 de contenido (un `touch` no invalida nada). `render --mp4` está retirado: redirige a `cut`.
- **Sonido** (`sound.mjs`): voces deterministas, auto-SFX desde el timeline, música con ducking, limitador.
- **Índice semántico** (`index.mjs`, `q.mjs`): cajas, cámara, primitivas, nodos, colores→rol, símbolos físicos (q̇ ≠ q), sfx, hashes de caducidad. Los agentes consultan en vez de re-mirar.
- **Guardia** (`guard.mjs`): escaneo estático con archivo:línea + Proxy de ctx en lint (texto crudo, transforms absolutas, fugas, cámara falsa). Foco obligatorio por shot, determinismo atribuido por shot, prominencia (“el ojo va a otro sitio”).
- **Crítico visual** (`critic.mjs`): láminas color/grises/anotadas, hechos medidos, rúbrica cerrada, `--api` con JSON validado y caché por hash.

## Archivos
| ruta | qué es |
|---|---|
| `CRAFT.md` · `CINE.md` · `STYLES.md` | principios, gusto cinematográfico con números, estilos |
| `MOTOR.md` | arquitectura v4, algoritmos y problemas de sistemas parecidos que se parchean |
| `docs/API.md` | referencia de primitivas **generada** (`npm run docs`) |
| `STATUS.md` | estado real **generado** (`node engine/status.mjs`); mapa de docs en `docs/current/README.md` |
| `ORQUESTADOR.md` · `AGENTES.md` · `PROMPTS.md` · `REVIEW.md` | arranque, roles, prompts por etapa, checklist |
| `FUNDAMENTOS.md` | por qué este diseño |
| `data/` | `timeline.json` (demo), `timeline.template.json` (vacío), `edit.example.json` (EDL) |
| `engine/` | núcleo (core, geom, tex, semantic, prims, scene, fx, api, seek, camera, grade, styles) + herramientas (render, lint, guard, autocam, cut, sound, index, q, critic, assets, doc) + gobernanza (ledger, roles, gate, orch, lock, budget) + `world3d/` |
| `shots/` | un `.mjs` por shot (demo A1–A3, GIF G01/G02, más films) |
| `test/` | mutaciones del verificador, unidades, golden, fuzz y fixtures |
| `docs/en/` | guías en inglés: flujo y roles, arquitectura, estilos |
| `assets/` | imágenes; `cache/tex` (precompilado, lo usa el navegador) y `cache/footage` (fotogramas extraídos) |

## Comandos
Cualquier comando acepta `--timeline X --style Y --profile Z --edit E` (o env `OPUS_*`).

| comando | salida |
|---|---|
| `npm test` | regresión del verificador (debe dar “Todo verde”) |
| `npm run lint [-- --only validate\|determinism\|layout\|camera\|…]` | `out/lint.json`, SHIP/FIX |
| `npm run autocam` | `data/autocam/<timeline>.json` (se invalida sola por hash) |
| `npm run sheet` · `npm run strips` · `npm run animatic` | hojas de contacto y tiras |
| `npm run plan` | qué fragmentos están en caché y cuáles se renderizarían |
| `npm run review` · `npm run master` | `out/master.review.mp4` · `out/master.mp4` (fragmentos + audio −14 LUFS, bt709) |
| `node engine/cut.mjs --edit data/edit.example.json` | montaje EDL → `out/main.edit.mp4` |
| `npm run sound` · `node engine/sound.mjs --list` | `data/mix.wav` + `out/sfx.json` · catálogo de voces |
| `npm run index` · `npm run q -- at 3.2 \| shot A2 \| sym q̇ \| tag tex \| stale \| deps \| impact A2` | índice y consultas sin render |
| `npm run critic [-- --api]` | `out/review/<film>/` láminas + packet.md (+ veredicto VLM) |
| `npm run assets -- --tex \| --footage clip.mp4 --id x` | precompilar TeX · extraer metraje |
| `npm run docs` | `docs/API.md` |
| `npm run gallery` · `npm run styles` | el mismo film en todos los estilos · listar packs |
| `npm run use -- <film>` · `npm run peek` | fijar film activo · hoja de contacto rápida |
| `npm run golden` · `npm run metrics` · `npm run profile` | miniaturas golden · métricas medibles · perfil de coste por frame |
| `npm run demo:gif` | regenera `docs/media/demo.gif` con el motor |
| `npx serve .` → `/engine/preview.html?timeline=…&style=…` | scrubber en navegador (mismo `seek`) |

## Límites honestos
- Canvas 2D primero: sin shaders. El 2.5D es perspectiva, niebla, DOF y homografías; el 3D real es la capa opcional `world3d` (headless-gl + three; en Linux requiere Mesa/xvfb, y sin ella el lint da FIX en los shots que la usan). El warp raster opera en píxeles de dispositivo.
- La cámara falsa es un **aviso**, no un error: un objeto que escala es legítimo y no siempre se distingue del mundo escalado.
- La detección de fuente ausente depende de fontconfig: si sustituye por un equivalente métrico, no avisa.
- El crítico con `--api` no se ha probado aquí (no hay clave). Sin `--api` genera las láminas para un agente con visión.
- `footage` no se ha probado con un clip real en esta sesión. En el navegador, imágenes y metraje se muestran como marcador.
- Coste medido: ~100–165 ms/frame a 720p con todo el post activo (bloom, aberración, grade) en 1 núcleo. Los estilos sin post rinden como v3.5.
- `npm test` en un clon completo da 1 fallo hoy (`gov: E9`, tasa de falsos positivos de roles medida sobre el historial git); en CI (checkout superficial) pasa.
- La documentación profunda está en español; hay guías en inglés en `docs/en/`.
- El suavizador de la autocámara (Whittaker, 2º orden) sobreoscila ~3 % ante escalones. La proyección factible lo acota en zoom y encuadre.

Sin GATE cerrado (humano o autónomo) no hay código de film, ni master.
