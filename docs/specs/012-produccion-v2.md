# 012 — Producción v2: Regla, Reel y Potencias

## Intención (usuario)
- Los videos de la v1 están "bien, no wow". El fondo era un espacio negro y monótono, y faltaba personalidad y gusto (spec 003).
- La meta es asombro, algo épico y vibrante. Mate papel sacó 9,5 y es la vara.
- 2026-10-06: "cada video debería tener libertad" para elegir su medio. El 3D "se ve pegado con cinta porque no está guionizado
  desde el principio".

## Principios
1. **El guion manda.** Cada film parte de `story.json` y de la memoria conceptual: tesis, beats y pico. Medio, 3D, soundtrack y
   cámara se eligen POR el guion y se justifican en él. Nada se añade a posteriori.
2. **Medio libre.** Cada film elige su medio, o ninguno, de entre papel_crema, kraft, pizarra, técnico, neón o uno nuevo si
   el tono lo pide. Lo escribe en `story.json` (`medium` + `porque`). Tienen que ser medios distintos entre sí.
3. **3D solo si el guion lo pide.** Si un film usa world3d, sus beats 3D se declaran en el guion con el concepto que encarnan
   (spec 009, S10). Si no aporta, no se usa.
4. **Soundtrack v2 completo** (spec 002): música más sound design más mezcla. Techo ≈ −3 dBTP y TP ≤ −1 medido sobre el mp4.
5. **Anti-patrones** (lint y critic): fondo negro vacío, monotonía, prisa, audio pobre, paleta por defecto (dorado sobre azul noche).

## Medibles
- `npm run lint` sin FIX. El critic da SHIP. Se mira `npm run peek` antes de entregar.
- Las métricas de la spec 005 están dentro de los objetivos del film: ritmo, densidad visual, contraste, arco.
- Cada film tiene un `story.json` con `medium.porque` y, si usa 3D, beats 3D con su concepto (test S10).
- El master pasa sus gates sin `--force`. El tamaño queda dentro del presupuesto del medio (compresión por medio).
- Para cada film se entrega el mp4, la hoja de contacto y un A/B frente a la v1.

## Escenarios (BDD)
- P1 Dado el film v2, el lint da 0 FIX y el critic da SHIP. El master pasa sin `--force`.
- P2 `story.json` declara el medio y su porqué. Los 3 films usan medios distintos.
- P3 Si hay world3d, todo shot 3D pertenece a un beat 3D del guion (sin `w3d.sin-guion`).
- P4 El audio da TP ≤ −1 dBTP y la sonoridad integrada está en el objetivo del estilo de sonido.
- P5 Ningún fotograma con más de 60 % de área con luminancia < 8 % sin textura (anti fondo negro vacío). Medido con `metrics`.
- [HUMANO] H1 Por film: nota ≥ 8 (meta 9). Comentario a Calificaciones.

## Calificaciones
| film | versión | nota | comentario |
|---|---|---|---|
| regla | v2 (pizarra) | — (2026-10-06) | "no es el mejor concepto pero está bien ejecutado" |
| reel | v2 (neón) | — (2026-10-06) | "bastante muy bien" |
| potencias | v3 (técnico) | — (2026-10-06) | "antes estaba mejor, sea el fondo negro": peor que v2 |
| mate_papel | terracota | — (2026-10-06) | "está muy bien" |

## Lección (2026-10-06): el negro no es el anti-patrón; el negro VACÍO sí
Potencias v3 (plano técnico) quedó peor que v2 (fondo oscuro). Un viaje por escalas hasta el cosmos PIDE la oscuridad:
el espacio es el tema, las estrellas, el globo y la órbita viven sobre negro. El anti-patrón es el negro sin profundidad
ni motivo (relleno por defecto), no el negro elegido. Regla de elección de medio/fondo:
- Oscuro cuando el tema es luz, noche, cosmos, vacío o escala inmensa, y el fondo aporta profundidad (estrellas, atmósfera, niebla, viñeta, parallax).
- Soporte con textura (papel, pizarra, kraft, técnico) cuando el tema es razonar, construir, medir o escribir, y el soporte es parte de la metáfora.
- Neón cuando la luz es el sujeto y hay ritmo o ruptura.
- El `porque` del medio en story.json debe nombrar el tema y por qué ese fondo lo sirve; si el porqué es "evitar el negro", está mal elegido.
Escenario nuevo (P6): el lint avisa `fondo.vacio` solo si el fondo oscuro no tiene profundidad medible (varianza espacial y temporal baja); un fondo oscuro con profundidad pasa.
