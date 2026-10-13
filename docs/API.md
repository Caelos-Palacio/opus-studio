# API de shots — referencia generada

> No editar: `npm run docs` la regenera desde `engine/prims.mjs` (DOC), `sound.mjs` (VOICES), `geom.mjs` (WARPS) y `styles.mjs` (DEFAULTS).

## Primitivas (`api.*`)
Todas registran cajas (lint) y metadatos (índice). Todas son funciones puras de `t`.

| llamada | qué hace |
|---|---|
| `api.tex(tex, x, y, {size, align, color, write, stagger, morphTo, u, display})` | Ecuación TeX real (MathJax → contornos). write∈[0,1] = escritura trazo→relleno; morphTo+u = morph glifo a glifo. Registra caja de texto (role math). |
| `api.path(shape\|d, {x,y,s,rot, fill, stroke, lw, trim:[a,b], warp, morphTo, u, arc, label, focus})` | Cualquier forma vectorial (SVG d o Shape). trim = draw-on; warp = deformación vectorial (WARPS); morphTo = morph arbitrario. |
| `api.axes({x,y,w,h, xr:[a,b], yr:[a,b], ticks, xlabel, ylabel, u, grid}) → {X, Y, rect}` | Ejes científicos con draw-on; devuelve mapeadores dato→píxel. |
| `api.plot(fn\|[[x,y]], axes, {u, color, lw, n, fill, label})` | Curva de función o datos, draw-on por u. Registra foco. |
| `api.arrow(x0,y0,x1,y1, {u, color, lw, head})` | Flecha con draw-on. |
| `api.field(F(x,y)→[vx,vy], rect, {n, u, color, scale, mag})` | Campo vectorial en rejilla; color por magnitud. |
| `api.streamlines(F, rect, {seeds, steps, h, u, flow, color, key})` | Líneas de corriente RK4 memorizadas; flow = desplazamiento de guiones con t. |
| `api.trajectory(P(t)→[x,y], {t0, t1, trail, color, lw, head, fade})` | Trayectoria de un cuerpo con estela; P es función del tiempo (pura). |
| `api.particles({seed, rate, life, at(tb)→[x,y], speed, spread, angle, gravity, drag, turb, size, color, t0, t1, fps, blend})` | Partículas SIN estado: forma cerrada con arrastre y gravedad; emisor móvil vía at(tb). |
| `api.sim(key, {init, step(state,dt,k), dt}) → state(t)` | Simulación determinista con checkpoints cada 60 pasos: seek(t) cuesta ≤60 pasos aunque t sea grande. |
| `api.graph({nodes, edges, seed, rect, u, labels, r}) → pos` | Red con layout de fuerzas sembrado y memorizado; aristas con draw-on escalonado. |
| `api.globe({x,y,r, lon, lat, features, graticule, u})` | Proyección ortográfica girable con ocultación de cara trasera; features = polilíneas [lon,lat]. |
| `api.label(str, [x,y], {role, avoid, leader})` | Etiqueta que se coloca sola en 8 posiciones evitando focos y texto ya registrados. |
| `api.image(id, x, y, w, h, {fit, alpha})` | Imagen de assets/ (síncrona en Node). |
| `api.footage(id, tLocal, x, y, w, h, {loop, speed, fit})` | Vídeo real: fotogramas pre-extraídos (engine/assets.mjs --footage) con remapeo de tiempo. |
| `api.layer(spec, (ctx, t, api) => ...)` | Capa compuesta con efectos (blur, bloom, motionBlur, trail, dirBlur, chroma, displace, warp, mask, fps, blend). |
| `api.world3d(scene, {rect, t, u, cam, overrides, step, motionBlur, transparent, ssaa, alpha, groundFy, parallax, bloom, bg, scale, override}) → {horizonY, groundY, el, fov}` | 3D REAL como capa del compositor (backend aislado headless-gl+three): el shot declara la escena como DATOS ({id, background, fog, ground, camera, objects:[{shape|instances, size, pos, color, mat, outline}]}) y el motor la dibuja con el estilo (paleta forzada, luz clave S.light.az, bandas toon + contorno de tinta, niebla y sombra de contacto, SSAA; v2: sombras proyectadas (shadow map, bandas toon o PCF), AO de contacto, rim con el acento, bloom por el post 2D con bloom:true; ground:{catcher:true} proyecta la sombra sobre el suelo 2D). camera:{fromShot:true, scale, horizon} deriva elevación y lente del horizonte y la línea de suelo del shot (api.ground o groundFy) y de la escala de plano (shot.size): PG el∈[8°,20°], PM [5°,15°], heroico [−12°,−4°]; fuera de regla sin override ⇒ aviso w3d.angulo del lint; con fromShot el parallax de la cámara 2D mueve la cámara 3D con la ley de api.depth. background:{top,bottom}|'sample' hace que la niebla tome el degradado del fondo. cam/overrides pueden ser funciones de t (cam.ppm = px por metro en el foco); step:'auto' sigue los twos del film. Se dibuja ANTES del grade/post/medio. Sin gl/Mesa: lint FIX. |
| `api.p3(x, y, z) → [sx, sy, k]` | Proyección en perspectiva alrededor del foco de cámara (z>0 = lejos). k = escala. |
| `api.card3d({x,y,w,h, rx, ry, z}, (ctx, api) => ...)` | Tarjeta con giro 3D real (homografía por malla) — ≤ 60° legible. |
| `api.atmos(z) → {alpha, blur}` | Perspectiva atmosférica y DOF del estilo para una profundidad z. |
| `api.fondo({preset?, semilla?, ajustes?:{idCapa:{…}}, sin?:[idCapa], capas?:[{tipo, id?, alfa, mezcla, paralaje, deriva, anim:{alfa,escala,dx,dy}, …params}]}, {alfa})` | Fondo GENERATIVO como pila de capas declaradas (datos): degradados, ruido (fbm, deformado, celular, flujo), atmósfera (niebla, polvo, rayos, bokeh, estrellas, orbes), motivos (retícula, trama, rayado, semitono, motivo), luz (viñeta, foco, terminador) y temáticas (olas, acuarela, perfil). Presets temáticos con `porque` (cosmos_profundo, cuba_oscura, expediente_kraft, papel_carta_acuarela, mar_acuarela, noche_ciudad, laboratorio, taller_madera, amanecer_niebla, plano_tecnico). Determinista (semilla), con parallax por capa; colores por rol de la paleta del medio. Spec 021: CUALQUIER parámetro admite {expr:"…t lt u beat pulso('impacto',0.4)…"} o keyframes {k:[[x,v],…],ease,eje,en:"giro"} (colores en OKLab); capas reactivas a eventos (onda, mancha, pulso; `eventos:[{id,tipo,at,x,y}]`) y capa `codigo` ({tipo:"codigo",archivo:"fondos/x.mjs"}: función propia (ctx,t,E) en shots/fondos/, bajo sandbox). Los presets son ejemplos de partida: derívalos con ajustes/sin/capas. Pintar PRIMERO en el shot. Catálogo: node engine/fondos-meta.mjs. |
| `api.objeto(id, {x, y, size, rot, estado, partes, params, color, relleno, acento, flip, alfa, label}) → {x, y, w, h, <ancla>:{x,y}}` | Objeto vectorial paramétrico de la biblioteca (cilindro_metalico, campana_cristal, llave_laton, balanza_cruz, sello_tampon, acta_cuaderno, pluma, fotomultiplicador, cuba, contador, papel_continuo, lapiz, lampara_mesa, botella_vidrio, tarjeta_postal, moneda, sobre_sello, red_pesca, mapa_costero, reloj, mano, puerta, ventana, mesa, libro). `estado` = nombre o [a,b,u] (interpola), `partes` = valores animables, `params` = forma/cantidad/texto; devuelve las anclas con nombre en px. Registra foco. Trazo con la tinta del medio y relleno por rol. |
| `api.svg(id, {x, y, size, rot, flip, alfa, trazo, morphTo, u, roles, mono, label}) → {x, y, w, h, punta:{x,y}, centro:{x,y}}` | SVG importado (assets/svg/: botella, hoja, lupa, mano, moneda, mosca, reloj, secante, sello, sobre; o una ruta assets/….svg) como elemento: sanitizado (sin scripts/href externos/foreignObject), cuadro unidad de lado size, recoloreable por roles de paleta (data-fill/data-stroke, roles:{"#hex":"rol"}, mono:"rol"), trazo 0..1 = trazado progresivo por longitud de path (punta = la pluma) y morphTo+u entre dos SVG con el mismo número de paths. |
| `api.box(x, y, w, h, {label, tag, color, fill, fillAlpha, radius, lw, banda, sombra, alpha, role}) → {x, y, w, h}` | Caja con rótulo para diagramas: relleno (fill, def. paper), contorno (color), banda superior, sombra, etiqueta numerada (tag) y rótulo de varias líneas (label con saltos de línea: la 1.ª en role, las demás en label). Registra el texto para el lint; el foco lo pone el diagrama. |
| `api.impact(at, {frames, mode, x, y, color, rays})` | Impact frame: `frames` fotogramas (2 por defecto, a fps del film) desde `at` (s, relativo al shot). mode "invert" (negativo de todo el cuadro) | "burst" (rayos radiales desde x,y) | "both" (1.º invertido, resto rayos). Llamarlo SIEMPRE (no dentro de un if): fuera de su ventana no dibuja, pero registra el impacto para arc (presupuesto y sincronía con el audio). |
| `api.smear(x, y, vx, vy, fn)` | Smear: estira el dibujo de fn en el eje de la velocidad (px/s) según motion.smear del estilo; no hace nada si el estilo no lo pide. Cuando estira, lo registra (arc mide segundos de smear por escena). |

## Deformaciones vectoriales (`WARPS`, en geom.mjs)
`wave` · `bulge` · `twist` · `bend` · `noise` · `quad` — se aplican a puntos de control (resolución infinita); `compose(w1,w2)`; raster: `api.layer({warp})` en px de dispositivo.

## Scene graph (`export default { scene: (t, film) => nodo }`)
Campos de nodo: `id x y z rot s sx sy ax ay opacity visible time{offset,speed,from,to,loop} fps props(tl) children draw(ctx,tl,api,node) clip(ctx) fx{…} focus w h follow{id,lag,k} lookAt attach{id,dx,dy} zsort`.
Cámara sobre nodo: `shot.cam.track = { node, k, smooth }`.

## Voces de sonido (`shot.sfx[].type`)
- `click` — transitorio seco (cortes)
- `tick` — tic agudo (texto, datos)
- `pop` — pop con caída de tono (aparición)
- `whoosh` — ruido filtrado con barrido y paneo (morph, movimiento)
- `impact` — golpe sub + ruido (acento fuerte)
- `riser` — subida de tensión (dur s, termina en el evento)
- `shimmer` — parciales agudos que se apagan (revelación)
- `drone` — lecho grave en quintas (dur s)
- `rev` — acorde de revelación (legado cues)
- `anom` — batido disonante (legado cues)

## Rúbrica del crítico visual
- **framing** — sujeto legible, lead room/headroom, aire, tamaño de plano que sirve a la idea
- **hierarchy** — un foco domina; el ojo sabe dónde ir primero y segundo
- **aesthetic** — coherente con el estilo declarado; sin look de plantilla (gradiente+centrado, partículas decorativas, glow gratuito)
- **coherence** — continuidad con shots vecinos: color-rol, escala, dirección, motivo
- **clarity** — se entiende sin sonido; el texto se lee; la idea del shot es inequívoca

## Export para compositores externos (`cut --prores`, F6)
- `node engine/cut.mjs --prores` → `out/<film>.prores.mov`: ProRes 4444 (`prores_ks`, `yuva444p10le`, bt709) con el aspecto completo del film (opaco) y el audio en PCM 48 kHz.
- `--alpha` (implica `--prores`) → `out/<film>.alpha.mov`: **fondo transparente**. Se QUITA: papel/soporte del medio, capas de parallax y de primer plano del medio, y el post de pantalla (bloom, aberración, viñeta, fundido, letterbox, grade de color). Se QUEDA: lo que dibujan los shots (sujeto, texto, capas fx propias del shot) y la tinta del medio (erosión, temblor, halos, reflejo). `--alpha-grain` conserva además el grano del estilo, solo sobre el sujeto.
- `--shot ID` exporta solo ese shot (y los que se solapan con él) con el audio recortado: `out/<film>.<ID>.alpha.mov`.
- Pasa por el mismo gate que el master (`--force "razón"`); los fragmentos viven en `out/fragments/<film>.{prores|alpha}[.<ID>]/` y no tocan la caché del master mp4. Un shot que pinta su propio fondo a pantalla completa lo conserva: el alfa solo borra lo que el motor añade.

## Claves de estilo nuevas en v4
```json
{
 "grade": {
  "post": {
   "bloom": {
    "threshold": 0.62,
    "strength": 0.7,
    "radius": 26
   },
   "chroma": 2,
   "color": {
    "lift": 0.015,
    "gamma": 1.04,
    "gain": 1,
    "temp": 0.25,
    "sat": 1.05,
    "dither": 2
   }
  }
 },
 "depth": {
  "focal": 1.2,
  "fog": 0,
  "dof": 0,
  "focusZ": 0
 }
}
```
