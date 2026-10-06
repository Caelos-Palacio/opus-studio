# Handoff — world3d v2 (rama world3d2, spec 009)
Estado: implementado y en verde (`node test/world3d.mjs --v`: 76 comprobaciones; entra en `npm test`). Falta SOLO el juicio del usuario ([HUMANO] H1: «tiene volumen, está en el escenario y el ángulo es el correcto», meta ≥ 9).
Entrega para calificar: `out/entregas/potencias-w3d-v2.mp4` (A original | B con 3D v2, lado a lado) + `potencias-w3d-v2-B.mp4` (solo B a 960×540 → ver MEDIDAS) + `potencias-w3d-v2.jpg` (hoja de contacto).

## Qué hay (por escenario de la spec 009)
- **S1 sombras** (`engine/world3d/shaders.mjs`, `backend-gl.mjs`): shadow map ortográfico desde la luz, profundidad empaquetada en RGBA8 (headless-gl/WebGL1 no tiene texturas de profundidad), PCF 3×3. Estilo toon = bandas duras (smoothstep estrecho), soft/ink = PCF suave. El centro del mapa se ancla a la rejilla de texeles (sin parpadeo entre fotogramas). Casters = sólidos con luz (`cast:false` lo quita; planos/flat/emissive no proyectan). El mapa se ajusta a lo visible: `min(radio de la escena, f(dist, fov, el))`.
  La luz con sombras es **fija en el mundo** (la dirección que S.light.az tiene en pantalla con la cámara de referencia del plano = scene.camera sin cam(t)); sin sombras (v1) sigue fija en pantalla.
  **Sombra al suelo 2D**: `ground: { catcher: true }` + `transparent: true` ⇒ el suelo solo dibuja la sombra (alfa) y la capa se compone sobre el suelo 2D (clear RGB = tono de sombra: sin halo).
- **AO de contacto**: degradado en altura sobre cada sólido (altura de banda ∝ alto del objeto, invariante de escala) + los discos de contacto de v1. `world3d.ao` 0..1.
- **Rim**: color de acento en el lado que da la espalda a la luz clave. Cajas = banda de `rim.width` px en las ARISTAS de la cara (en pantalla, con fundido si la cara es diminuta); esfera/cilindro = fresnel (cilindro: solo la pared). Un fresnel plano sobre cajas teñía caras enteras (descartado).
- **S4 bloom**: el backend NO hace bloom. `api.world3d(..., { bloom: true | {threshold,strength,radius} })` renderiza un pase de máscara (`pass:'emissive'`: solo `mat:'emissive'`, el resto negro como oclusor) y lo pasa por `fx.bloom` (el kernel del post 2D) con aditivo. Test: Δ medio 0/255 frente a un glow 2D del mismo color y radio.
- **S2/S3 cámara** (`engine/world3d/camera.mjs`, puro): `camera: { fromShot: true, scale, horizon, el, heroic, override, ppm, nearK/farK }`. Desplazamiento de lente (lens shift) para que el pie del sujeto caiga en `groundFy` (api.ground / `o.groundFy`, fracción del alto de la capa) y el horizonte en `horizon`; tres modos: (horizonte+suelo ⇒ elevación resuelta), (horizonte+el ⇒ suelo derivado: lo usa P03 con la línea de suelo del 2D), (suelo+el/regla ⇒ horizonte devuelto). fov = f(depth.focal del estilo). Reglas: PG [8°,20°] pref 14, PM [5°,15°] pref 9, PP [3°,12°], heroico [−12°,−4°]; la escala sale de `shot.size` (EWS/WS/LS→PG, MS→PM, CU/ECU→PP) o `o.scale`. El resultado (`horizonY`, `groundY`, `el`, `fov`) se devuelve de `api.world3d` para que el 2D dibuje su horizonte en el mismo sitio. Errores medidos: horizonte ≤ 1 px y suelo ≤ 1 px (umbral 2).
  **Aviso `w3d.angulo`**: el lint (check layout) emite WARN cuando la elevación sale de la regla y no hay `override` (término en `data/vocab.json` sección `lint.rule`; `node engine/vocab.mjs lint` = 0).
- **S5 niebla con degradado**: `background: {top,bottom}` | `{stops:[…]}` | `'sample'` (api.world3d muestrea 8 paradas del 2D ya pintado junto a los bordes de la capa). La niebla toma el color del degradado a la altura del FRAGMENTO (ΔE 0 medido). Con degradado la paleta se cuantiza ANTES de la niebla (si no, la niebla total no empata el fondo).
- **S6 parallax**: con `camera.fromShot` (o `parallax:true`) la capa se pega SIN la cámara 2D y la cámara 3D hace truck/dolly con cx.cam: desplazamiento a profundidad d = cam.x·d (error medido < 1 %). Límite: el suelo 2D de `api.ground` usa parallax 0.6 fijo, el suelo 3D es físico; con cámara quieta (P03) coinciden. Roll de la cámara 2D no se traslada.
- **S7 regresión**: `shadows:false, ao:0, rim:false` reproduce los goldens v1 (`test/golden/world3d/datacenter.png`, `esfera-toon.png`) y su coste. Los goldens v2 son `datacenter-v2.png`, `cubo-v2.png`.
- **S9 vídeo**: `npm run ab -- potencias w3d` → `out/ab/potencias-w3d.mp4` (A|B), `…-B.mp4` (solo B), `…jpg` (hoja). `--plan` imprime salidas sin renderizar; `--range a:b`, `--w`, `--times`, `--no-video`. Sin audio (comparación visual).

## Potencias P03 (variante `w3d`)
Reescrito con v2 (`shots/P03.mjs`, `shots/W_datacenter.mjs` → `datacenterSceneV2`): el horizonte 3D ES la línea de suelo del 2D (cada fotograma, desde Lof/ppm del reloj de escala); el suelo 3D tiene el color del suelo 2D y la niebla lleva a ese color (sin costura); cielo = el 2D (capa con alfa), el motivo de la ventana se dibuja encima; ángulo de plano general el 8,5°→14°; bloom de los LED por fx.bloom; entrada con fundido 11,5→12,1 y salida al 2D 13,9→14,8. Parámetro apagado = original píxel a píxel. P04 (órbita lunar) NO se toca: al usuario le gustó mucho en 2D y la Luna/Tierra son círculos planos del scene graph; un 3D ahí no aporta volumen real.

## Decisiones / gotchas
- headless-gl busca uniformes por PREFIJO: `uBg` y `uBgG` colisionaban (lectura 0). Nombres de uniformes sin prefijos comunes (`uGrad`, no `uBgG`).
- v2 por defecto en el estilo (`engine/styles.mjs` DEFAULTS.world3d). Cualquier film con world3d cambia de aspecto (más volumen); `world3d: { shadows:false, ao:0, rim:false }` en el estilo lo devuelve a v1.
- `scene.ground.lit` (charco de luz) y `ground.catcher` son datos de escena; `cam.ppm` (px por metro en el foco) hace que el zoom 3D siga el reloj de escala del 2D.
- El hash de fragmentos ya incluye backend (+ el estilo completo ⇒ los flags v2 entran solos).

## Medidas
1280×720, SSAA 2×, datacenter, máquina con carga ≈ 16–20 (12 núcleos, otros agentes): en aislamiento v1 ≈ 106 ms, v2 completo ≈ 107 ms (sombras 114, AO 101, rim 88); bajo carga en el test v1 57–175 y v2 80–231 ms. Límite spec 220 ms: cumplido en reposo. Vídeo A/B: 345 fotogramas (9,5–21 s) en 82 s de pared. Tests: world3d 76 comprobaciones; suite completa verde salvo STATUS.md (regenerado).

## Pendiente
- Juicio del usuario (H1). Si pide más «volumen»: subir `ao`, `groundLit`, o añadir luz de relleno hemisférica.
- Bloom: la máscara re-renderiza la escena entera (coste ≈ +40 % en el datacenter con bloom:true).
- Roll de cámara 2D → 3D, `ty` ≠ 0 con cam animada (el horizonte se mueve con la distancia).
- Audio: el vídeo A/B va sin sonido; no se renderizó master (no hubo que verificar ebur128).
