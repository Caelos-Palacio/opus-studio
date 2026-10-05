# 005 — Métricas con sentido: unidades reales y estandarizables

## Intención (usuario, 2026-10-05)
"Metrizar todos los parámetros en medidas reales y con sentido. No métricas como luz o sigma del cambio promedio
ponderado de los píxeles; cosas más útiles, precisas, abstractas tal vez y estandarizables."

## Principio
Cada magnitud se expresa en una unidad que un director, músico o diseñador reconoce, con norma o literatura de
referencia, y comparable entre films. Lo de píxeles queda como MÉTODO interno de medida, nunca como la métrica.
Toda métrica: {id, nombre, unidad, definición, método, referencia/norma, rango típico por género, confianza}.

## Catálogo inicial (a completar por el agente)
| dominio | métrica | unidad / norma |
|---|---|---|
| montaje | ASL (duración media de plano), ritmo de corte | s; cortes/min (Salt, Cutting/Cinemetrics) |
| montaje | corte en el pulso | % de cortes a ≤ 1 fotograma de un beat |
| plano | escala de plano | ECU/CU/MCU/MS/MLS/LS/ELS por fracción de encuadre del sujeto |
| cámara | lente equivalente / FOV | mm equivalentes 35 mm; grados |
| cámara | velocidad angular, dolly, zoom | °/s; alturas de sujeto/s; stops/s (log2 de escala) |
| movimiento | velocidad en pantalla, aceleración, jerk | anchos de pantalla/s; perfil de easing |
| escala | saltos de escala | décadas/s (órdenes de magnitud) |
| composición | tercios, aire (headroom/lead room), balance | % de encuadre; momento de peso visual |
| color | diferencia de color, armonía, contraste | ΔE2000 (CIE), esquema de armonía, ratio WCAG |
| texto | legibilidad, tamaño, tiempo de lectura | APCA Lc; altura x en minutos de arco a distancia estándar; palabras/min (WPM) |
| información | carga | conceptos nuevos/min; elementos animados simultáneos (Mayer) |
| drama | curva de tensión, posición del pico, fases | 0–1 normalizado; % de duración; fases (Freytag/arc) |
| audio | sonoridad, rango, pico | LUFS / LU / dBTP (EBU R128, ITU BS.1770) |
| audio | tempo, tonalidad, sincronía AV | BPM, tono/modo, ms de desfase |
| medio | textura/soporte | tipo de medio, densidad de grano (ISO equivalente), paleta (n neutros + n acentos) |

## Escenarios (BDD)
- Dado cualquier film, Cuando corre `npm run metrics`, Entonces produce out/metrics/<film>.json (esquema estándar) y una ficha legible (tipo "ficha técnica").
- Dado un parámetro de shot en px o unidades internas, Entonces su esquema declara la unidad con sentido y la conversión (p.ej. tamaño → escala de plano; velocidad px/s → anchos de pantalla/s).
- Dados dos films, Entonces `metrics compare a b` los compara métrica a métrica con su rango típico.
- Dadas las notas del usuario, Entonces se puede correlacionar nota ↔ métricas (calibración).
