# 001 — Del "correcto" al "épico y vibrante"

## Intención (usuario, sobre potencias.mp4, 2026-10-01)
"Está más o menos. Le falta dinamismo y bastante en lo auditivo; se siente monótona y algo apresurada,
pero no épica o vibrante."

## Diagnóstico (evidencia)
- Ritmo constante por diseño: 1,5 s por orden ×10; 7/13 shots de 4,5 s idénticos; mismo zoom log.
- Audio: sin música; solo sfx procedurales (tic, drone, riser, impact). Nada mide el audio.
- Lint dio SHIP: mide corrección, no intensidad → falso negativo.

## Traducción a medibles
| crítica | medible |
|---|---|
| monótona | varianza de duración de shots (CV ≥ 0,35); ≥3 tempos distintos; tasa de zoom no constante (aceleración en la subida al pico) |
| apresurada | ≥1 respiro (hold ≥1,5 s) por cada 20 s; ningún tramo >15 s sin respiro; tiempo de lectura de cada concepto nuevo ≥ umbral |
| sin dinamismo | rango dinámico de energía visual (p90/p10 ≥ 4); contraste calma→pico |
| audio pobre | música con arco (intro, construcción, clímax, resolución); rango dinámico de loudness (LRA ≥ 6 LU); hits sincronizados con impactos (≤2 fotogramas); el clímax sonoro coincide con el pico visual (±0,5 s) |
| no épico | crescendo: energía audio+visual sube de forma monótona los 10–20 s previos al pico; pico al 60–85 %; silencio/vacío antes del golpe; final que respira |

## Escenarios (BDD)
- Dado un timeline con ≥5 shots de igual duración consecutivos, Cuando corre arc, Entonces WARN "ritmo monótono" con la ventana.
- Dado un film sin música (solo sfx), Cuando corre arc en perfil cinematic/explainer épico, Entonces FIX "sin banda sonora con arco".
- Dado un master, Cuando se mide loudness, Entonces LRA ≥ 6 LU y el máximo de loudness (ventana 3 s) cae a ±0,5 s del pico visual.
- Dado un tramo de 15 s sin hold ≥1,5 s, Entonces WARN "apresurado".
- Dado el pico principal, Entonces los 10 s previos tienen pendiente de energía positiva (crescendo) y hay ≥0,5 s de vacío justo antes del golpe.
- [HUMANO] Dado el nuevo render de Potencias, Cuando el usuario lo califica, Entonces nota ≥ 8 y "épico/vibrante".

## TDD
Tests en test/arc.mjs (rojo primero): fixtures plano vs con arco; fixture de audio sin música; master real de Potencias
v1 debe FALLAR estos tests (reproduce tu crítica) antes de cambiar nada.

## Fuera de alcance
Elegir estética nueva; cambiar el concepto Powers of Ten (se mantiene, se le da tempo y música).

## Calificaciones
| versión | nota | comentario |
|---|---|---|
| potencias v1 | ~5 ("más o menos") | monótona, apresurada, audio pobre, no épica |
| potencias + música PoC | 6–7 | la música mejora; quizá más el beat de tensión; falta refinar y sistematizar; mejorar TODO el soundtrack, no solo la música → spec 002 |
