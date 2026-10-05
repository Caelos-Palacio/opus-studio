# Handoff — world3d (rama world3d, spec 004)
Estado: implementado y en verde (`node test/world3d.mjs --v`: 37 comprobaciones; `npm test` incluye `world3d`). Falta SOLO el juicio del usuario ([HUMANO]: "no parece CG pegado").

## Qué hay
- `engine/world3d/` — interfaz aislada: `index.mjs` (`createWorld3d()` → `available/reason/sig()/render(scene, o)`), `backend-gl.mjs` (headless-gl + three r160, llvmpipe fijado; intercambiable),
  `shaders.mjs` (GLSL ES 1: toon/soft/ink, contorno por casco invertido, niebla, paleta suave, sombra de contacto), `metrics.mjs` (PSNR, ΔE Lab, escalera, grano… para tests).
- `api.world3d(scene, {rect, t, u, cam, overrides, step, motionBlur, transparent, ssaa, alpha})` en `engine/prims.mjs`. La escena es DATOS (`id, background, fog, ground, camera, objects[]`); `cam`/`overrides` pueden ser funciones de t.
  El resultado se dibuja con `ctx.drawImage` DENTRO del shot ⇒ antes del grade/post/medio. Un medio (rama `medios`) que se aplique en `applyGrade` cubre el 3D sin trabajo extra (test: grano 3D/2D ratio 1,02).
- Estilo: bloque `world3d` en `engine/styles.mjs` DEFAULTS (`shading toon|soft|ink, bands, outline{width,color}, snap, ssaa, light{az,el}, motionBlur`). La luz clave sale de `S.light.az` (misma que glow/sombras 2D). Contorno = tinta del estilo, grosor ×k (como `api.path` lw 3).
- Guardia: `THREE`, `WebGLRenderingContext`, `getContext('webgl')`, imports de `three`/`gl` ⇒ FIX. Sandbox intacto (los shots no importan engine/world3d: no es módulo puro).
- Degradación: sin gl/Mesa `film.world3d.available=false`; `api.world3d` pinta un marcador y registra meta `unavailable`; **lint (layout) da FIX «world3d no disponible: <motivo>»** solo si un shot lo llama de verdad. `OPUS_W3D_DISABLE=1` lo simula. `test/world3d.mjs` salta lo 3D con aviso (la guardia corre siempre).
- Hash: `engine/hash.mjs world3dSig()` (headless-gl@x three@x mesa@x llvmpipe) entra en el plan de `cut` solo si algún shot usa world3d (`usesWorld3d`).
- Demo: `shots/W_datacenter.mjs` (escena + cámara + HUD de regla log), `shots/D01.mjs`, film `data/world3d/timeline.json` (`npm run peek -- world3d`; mp4: `node engine/render.mjs --timeline data/world3d/timeline.json --range 0:180 --fps 30 --out out/world3d/datacenter.mp4`).
- A/B Potencias: variante `w3d` (data/stress/potencias.json) activa el parámetro `w3d` de P03: `OPUS_VARIANT=w3d npm run peek -- data/stress/potencias.json`. Sin variante P03 es el original píxel a píxel.

## Decisiones / gotchas
- El backend se PRECARGA en `loadFilm` (si algún shot usa `.world3d(`): el sandbox congela `process`/Date mientras corre un shot y `gl` no carga ahí.
- Los objetos NO declaran toon/soft/ink: lo decide el estilo (`mat` solo `flat|emissive` = sin luz). Escenas grandes: construir UNA vez (const de módulo/caché) — el backend cachea por identidad del objeto de escena.
- Cuantización a paleta SUAVE (fuerza por modo: toon .8, soft .25, ink .7; se relaja donde dos colores de paleta empatan, para no posterizar la niebla). Medible: p95 ΔE≈14 en la escena de prueba (umbral 16); sin cuantizar ≈27.
- Golden 3D: `test/golden/world3d/*.png` con PSNR ≥ 40 dB (regenera con `node test/world3d.mjs --update`). El golden 2D sigue bit a bit.
- headless-gl = WebGL1 ⇒ three ≤ r162; sin MSAA ⇒ SSAA 2× por render a 2× + resolución bilineal en GPU.

## Medidas (12 hilos, llvmpipe, 1280×720, SSAA 2×)
datacenter (≈14 000 instancias + 27 000 LED): 50–110 ms/fotograma el 3D sin motion blur; con motion blur de 6 subfotogramas ≈ 400 ms (D01 usa 6). Film D01 completo: ≈ 420 ms/fotograma.

## Limitaciones / pendientes
- Sin sombras proyectadas (solo contacto), sin bloom propio (usa el bloom 2D del grade), sin texturas/mallas importadas (primitivas e instancias sin rotación).
- Motion blur 3D = n renders (coste ×n); con `api.layer({motionBlur})` por fuera sería ×samples del 2D además.
- Determinismo: bit a bit en el mismo backend/Mesa; entre máquinas solo PSNR ≥ 40 dB (golden con tolerancia).
- Medio (rama `medios`): no implementado aquí; la capa pasa por `applyGrade`, ahí engancha. Si el medio actúa por capa de shot (api.layer) habrá que envolver api.world3d igual que el 2D.
- Pendiente humano: nota de gusto del datacenter (spec 004 §Calificaciones).
