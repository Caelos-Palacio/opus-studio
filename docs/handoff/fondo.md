# Handoff — fondo (spec 012 P6, métrica `fondo.profundidad` + lint `fondo.vacio`)
Rama `fondo`, sin push. Reemplaza P5 (regla de área) por P6: el negro ELEGIDO por el tema pasa; el negro VACÍO avisa.

## Definición (registro `engine/metrics/registry.mjs`, código `engine/metrics/fondo.mjs`)
- Fotograma a 384 px, con gradación, 4 fps; ventanas de 2 s (8 fotogramas). Y' = luma sRGB codificada en % de escala completa.
- Fondo = píxeles fuera de las cajas `focus`/`text` del motor, ensanchadas un 4 % del lado menor (el sujeto y el texto no cuentan como profundidad).
- `σ_esp` = RMS de la imagen MEDIA de la ventana respecto a la media de su bloque (ancho/6): estrellas, niebla fina, textura. Promediar 8 fotogramas atenúa el grano de la gradación ×1/√8.
- `σ_grad` = desviación típica de las medias de bloque (rejilla 6×3): viñeta, degradado, luz.
- `τ` = mediana de |Δ media de bloque (ancho/48)| entre fotogramas consecutivos: parpadeo, parallax, deriva.
- `P = σ_esp + σ_grad + τ` (%). Oscuro = mediana de Y' del fondo ≤ 18 %. Ventana vacía = oscura ∧ P < 1,0 %. Sin fondo visible (< 8 %): sin dato.
- Check `fondo.vacio` (solo film entero): WARN si ≥ 30 % de la duración medida es ventana vacía; FIX si ≥ 60 %. Escribe `out/fondo.json`.

## Umbrales y porqué
| umbral | valor | porqué |
|---|---|---|
| `dark` | 18 % | el negro de un cosmos ronda 2–10 %; Mate v1 5 %; pizarra/neón 10–20 %; soportes claros 25–80 % |
| `empty` | P < 1,0 % | Mate v1 (render real) 0,85 %; grano sin estructura ≈ 0,3–0,8 %; Potencias v2 oscuro 0,9–5 %; films buenos ≥ 1,7 (margen ≥ 1,5×) |
| `warnFrac` | 30 % | las calmas sueltas son dramaturgia (Potencias v2 tiene 15 % de ventanas de P≈0,9 en su tramo final) |
| `fixFrac` | 60 % | «la mayor parte»: el film ES negro vacío |

## Calibración (test/fondo.mjs; fixtures `test/fixtures/fondo/*.bin.gz`, 192 px, regenerables con `make.mjs`)
| caso | P | oscuro | vacío | veredicto |
|---|---|---|---|---|
| Potencias v2 (fixture del motor, 13 ventanas) | 1,72 | 100 % | 15 % | pasa |
| Mate papel (motor, 5 ventanas; lint real 9,95) | 10,5 | 0 % | 0 % | pasa |
| Reel neón (motor, 3 ventanas; lint real 5,37) | 5,26 | 100 % | 0 % | pasa |
| Regla pizarra (motor, 5 ventanas; lint real 14,87) | 13,9 | 0 % | 0 % | pasa |
| Potencias v1 (mp4, cada 6 s, 13 ventanas) | 1,34 | 100 % | 46 % | WARN |
| Mate v1 (lint REAL del motor, `data/mate`) | 0,85 | 100 % | 76 % | FIX |
| Sintético negro plano + objeto | 0,3 | 100 % | 100 % | FIX |
Sintéticos que pasan: estrellas (P 4,4), viñeta (2,5), niebla (2,0), respiración temporal (1,3), papel claro. Grano σ=1,2 % NO cuenta como profundidad.
Notas honestas: el mp4 de Potencias v1 no guarda las cajas del motor; `make.mjs --mp4` las estima (celdas de 8 px que superan la mediana en > 40/255, componentes conexas). Potencias v1 tiene viñeta y estrellas tenues: solo es «vacío» en sus tramos de calma (24, 36–42, 54–66 s), por eso WARN y no FIX. La sensibilidad a la resolución (estrellas finas +30 % de 192 a 1280 px) es la incertidumbre principal; el lint mide a 384 y los tests a 192.

## Tests y archivos
`test/fondo.mjs` (22 comprobaciones, registrado en `test/run.mjs`): registro, spec 012, sintéticos, fixtures reales. `data/vocab.json`: solo +10 líneas (`fondo` en lint.stage, `fondo.vacio` en lint.rule); el commit WIP anterior había reformateado el archivo entero y se restauró al formato de main.
Spec 012: P5 queda subsumido por P6.
