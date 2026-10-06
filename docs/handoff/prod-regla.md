# prod-regla (C1, spec 012): Regla v2

Estado: hecho, falta nota del usuario (H1).
- Medio: **pizarra** (timeline `medium` + `story.json` `medium{name,porque}`). Borrador = olvido/memoria; la criatura "borrada" vuelve; amarillo tiza = golpe, azul tiza = adaptación.
- Guion: sin cambios de beats (el arco ya era sólido); se declara medio y el sentido del acento. Sin world3d (no aporta).
- Soundtrack: forja sin cambios musicales; `master.tp` -2,0 → -4,5 (el AAC sobrepasaba +1,2 dBTP en el golpe final; con -4,5 el mp4 da TP -3,0, I -14,2, LRA 9,4). Ojo: la respuesta del limitador no es monótona (-4 y -6 dan peor LRA/TP).
- Shots: ningún .scene.json tocado (los colores salen de los roles del medio); hashes dsl-cov intactos.
- Crítico: veredicto manual (SHIP) con 2 WARN (R11 rueda tenue en el hold; R12 respuesta con poco contraste).
- Entregas: out/entregas/regla_v2.mp4, regla_v2.jpg, regla_ab.jpg (arriba v1, abajo v2).
- Hashes dsl-cov: regenerados SOLO R01–R14 (`node test/dsl-cov.mjs --gen`; 84 líneas = 14 shots × 6 instantes) porque el cambio de medio (pizarra) cambia los píxeles a propósito; el JS legado y el DSL siguen coincidiendo.
- Tests: `npm test` deja 2 fallos de medios (mate_papel→terracota, ya fallaban en main, ajenos a Regla). Con `out/.film`=regla, semantica I2b falla (usa el film activo): borrar out/.film antes de testear.
