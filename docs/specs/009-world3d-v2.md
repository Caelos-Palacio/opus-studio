# 009 — world3d v2: profundidad, escenario y ángulo

## Intención (usuario, 2026-10-05, nota 8 a world3d v1)
"Se ve bien para ser una demo pero es plano… todo está fluido y se siente bien, me hubiera gustado en vídeo… falla un
poco la integración con el escenario y el ángulo, pero el estilo está muy bien y acorde."

## Diagnóstico
- **Plano:** solo hay luz clave y bandas toon. No hay sombras proyectadas, ni oclusión ambiental, ni luz de borde (rim), ni bloom. Los
  volúmenes no se separan entre sí ni del fondo.
- **Escenario:** el objeto 3D no se apoya en el mundo 2D. El suelo 3D no coincide con la línea de suelo (`ground.fy`) del shot,
  no hay sombra sobre el suelo 2D, la niebla no empata con el degradado del fondo y no hay parallax compartido.
- **Ángulo:** la cámara 3D se eligió a ojo (el=15°, fov=34). No respeta la escala de plano ni el horizonte del 2D, y la
  perspectiva no coincide con el punto de fuga del escenario dibujado.
- **Entrega:** hubo solo una hoja de contacto, sin vídeo.

## Principio (se mantiene el de 004)
El 3D es una capa del compositor 2D y el estilo manda. Lo que se añade aquí es la geometría compartida: un solo horizonte, una sola
línea de suelo, un solo punto de fuga y una sola luz para las dos capas.

## Medibles
| aspecto | medible |
|---|---|
| sombra proyectada | shadow map (PCF suave o bandas toon) del objeto sobre el suelo 3D Y proyectada al 2D: luminancia bajo el objeto < entorno en ≥ 12 % |
| oclusión | AO de contacto/SSAO barato: contraste de luminancia en uniones ≥ umbral; desactivable por estilo |
| rim / separación | contorno + luz de borde del color de acento: ΔE objeto–fondo en el borde ≥ 15 |
| bloom | bloom del MISMO post 2D (fx.mjs) sobre emisivos 3D; nada de bloom propio del backend |
| horizonte | `camera` puede derivarse de `horizon` (fy del horizonte 2D) y `ground.fy`: error del horizonte proyectado ≤ 2 px |
| suelo | el plano y=0 3D proyecta sobre `ground.fy` del shot: error ≤ 2 px en el centro y ≤ 4 px en los bordes |
| ángulo | reglas por escala de plano (vocab: escalas): PG el ∈ [8°,20°], PM [5°,15°], contrapicado heroico el ∈ [−12°,−4°]; fov ligado a la focal del estilo; el crítico avisa si el ángulo está fuera de la regla sin `override` |
| parallax | la cámara 3D y las capas 2D de profundidad (`group.depth`) se mueven con la misma ley: desplazamiento relativo coherente ±5 % |
| niebla | color de la niebla = color del fondo muestreado a la altura del objeto (degradado, no plano): ΔE ≤ 3 |
| vídeo | `npm run ab -- potencias w3d` entrega mp4 (A/B lado a lado o consecutivo) además de la hoja de contacto |
| coste | ≤ 220 ms/fotograma a 1280×720 con sombras + SSAA 2× en CPU |
| determinismo / golden | igual que 004 (PSNR ≥ 40 dB en 3D; bit a bit en 2D; hash incluye backend) |

## Escenarios (BDD)
- S1 Dado un cubo sobre el suelo y luz con az=135°, Cuando se renderiza, Entonces hay sombra proyectada del lado opuesto a la luz y la región bajo el cubo es más oscura que el suelo libre (≥ 12 %).
- S2 Dado un shot con `ground.fy=0.78` y una escena world3d con `camera: { fromShot: true }`, Entonces el plano y=0 cae en 0,78·H ± 2 px.
- S3 Dado `camera: { scale: 'PG' }` sin `el`, Entonces la elevación resuelta está en [8°,20°]; con `el: 40` sin `override`, el crítico emite aviso `w3d.angulo`.
- S4 Dado un objeto emisivo, Entonces el bloom procede del post 2D (el mismo kernel que para un glow 2D del mismo color y radio, Δ ≤ 2/255).
- S5 Dado un fondo con degradado vertical, Entonces la niebla en el objeto lejano adopta el color del degradado a su altura (ΔE ≤ 3).
- S6 Dado un movimiento de cámara del shot (`cam.x` de 0 a 1), Entonces el desplazamiento 3D del objeto a profundidad d coincide con el de una capa 2D `depth=d` (±5 %).
- S7 Dado el estilo con `world3d.shadows: false`, Entonces no hay sombras y el coste vuelve al de v1 (regresión).
- S8 Igual t dos veces → fotograma idéntico; un shot con GL directo → FIX de la guardia (sin cambios respecto a 004).
- S9 `npm run ab -- potencias w3d` produce `out/ab/potencias-w3d.mp4` y la hoja de contacto.
- [HUMANO] H1 Dado el A/B de Potencias en vídeo, Cuando el usuario lo ve, Entonces "tiene volumen, está en el escenario y el ángulo es el correcto". Meta: nota ≥ 9.

## Fuera de alcance
- Mallas importadas (glTF): se queda en primitivas + composición. Va a F6 si el usuario lo pide.
- GPU real (sigue llvmpipe, determinista).
- PBR.

## Calificaciones
| versión | nota | comentario |
|---|---|---|
| world3d v2 (A/B Potencias P03, vídeo) | — (2026-10-06) | "bueno": la integración visual es buena, pero "se ve pegado con cinta porque no está guionizado desde el principio" |

### Lección (falso negativo → escenario nuevo)
El 3D añadido a un film ya guionizado se lee como parche aunque los píxeles casen. Escenario:
- S10 Dado un film que usa world3d, Entonces su story.json declara desde el guion qué beats son 3D y por qué (concepto de la memoria que el 3D encarna); el lint de arc avisa `w3d.sin-guion` si un shot usa world3d sin beat 3D declarado.
