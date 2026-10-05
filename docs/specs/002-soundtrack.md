# 002 — Soundtrack como sistema (no solo música)

## Intención (usuario, 2026-10-01, sobre potencias_musica.mp4)
"Falta refinarlo y sistematizarlo, incorpóralo al plan. Esa música es un claro 6–7, tal vez más el beat de
tensión, pero no te limites a la música: debes mejorar todo el soundtrack."

## Diagnóstico
- La PoC (engine/score.mjs) tiene arco, pero armonía, motivo y curva de intensidad están escritos a mano para este film.
- El beat de tensión (pulsos que aceleran 54→132 bpm hacia el golpe) es lo que mejor funciona → potenciarlo.
- Los sfx originales estaban planos a −14 LUFS y hubo que bajarlos 17 dB: el diseño sonoro no existe como capa propia.
- Timbres sintéticos simples: suena a demo.

## Medibles
| aspecto | medible |
|---|---|
| sistematización | 0 constantes por film en el código: todo sale de timeline + energía + memoria (+ un estilo sonoro JSON) |
| tensión | densidad rítmica y altura/brillo crecen de forma monótona los 10–20 s previos al pico; ≥1 "suck-back" (vacío ≥0,5 s) antes del golpe |
| impacto | transitorio + sub-drop + cola en cada impacto declarado; sincronía ≤2 fotogramas |
| diseño sonoro | cada evento visual relevante (corte de escala, revelación, entrada de objeto) tiene sonido; whoosh ∝ velocidad |
| variedad | ningún sample/voz idéntico repetido >4 veces seguidas (variación de tono/filtro/tiempo) |
| mezcla | enmascaramiento: en momentos de sfx, la música cede ≥3 dB en su banda; buses separados |
| master | −14 LUFS integrado, LRA ≥8 LU, true peak ≤ −1 dBTP, clímax (ventana 3 s CENTRADA) ±0,5 s del pico visual |

## Escenarios (BDD)
- Dado el timeline de Potencias sin parámetros musicales escritos a mano, Cuando corre `score`, Entonces produce una partitura con arco que cumple los medibles.
- Dado un impacto declarado en t, Entonces hay ≥0,5 s de vacío relativo antes de t y transitorio a ≤2 fotogramas de t.
- Dado un concepto de la memoria que se reinterpreta en t, Entonces su leitmotiv reaparece transformado en t ±1 s.
- Dado un sfx repetido (tic ×10), Entonces cada repetición varía y su intensidad sigue la curva.
- Dado el master, Entonces −14 LUFS, LRA ≥8, TP ≤ −1, clímax centrado ±0,5 s.
- [HUMANO] Dado Potencias v2, Cuando el usuario lo califica, Entonces nota ≥8 en soundtrack.

## TDD
test/sound.mjs: cada medible es un test; potencias v1 y la PoC deben FALLAR algunos (rojo) antes de implementar.

## Calificaciones
| versión | nota | comentario |
|---|---|---|
| sfx originales | ~5 | planos, monótonos |
| música PoC (score.mjs) | 6–7 | arco y tensión prometedores; falta refinar, sistematizar y el resto del soundtrack |
