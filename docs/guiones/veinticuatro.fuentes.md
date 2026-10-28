# Veinticuatro — fuentes de los datos (verificación 2026-10-08)

Método: no pude abrir el PRL original (acceso de pago); se contrastaron cuatro tablas independientes que reproducen las de Hirata (KII), Bionta (IMB) y Alekseev (Baksan), leídas del PDF (pdftotext), no de resúmenes. Coinciden en tiempos y energías de KII y Baksan y en los tiempos de IMB.

## Veredicto sobre la duda
**El evento excluido de los 11 oficiales de Kamiokande-II es el 6.º (0,686 s, 6,3 MeV), no el 12.º.** El 12.º (12,439 s, 8,9 MeV) es un evento oficial y aceptado. El guion y el film tenían el dudoso al final; el informe del subagente era correcto. Los 12 «eventos» que cuentan Wikipedia y otros = los 11 oficiales + el 6.º.

## Tabla de verificación
| dato | valor verificado | estado en guion/film | cita | URL |
|---|---|---|---|---|
| KII: numeración de Hirata 1–12 sin el 6 (11 eventos) | filas 1,2,3,4,5,7,8,9,10,11,12; «Event no. 6 has been excluded by authors from the signal analysis» | el film lo tenía al revés (12.º dudoso) → corregido | Tabla 1 de «Statistical analysis of neutrino events from SN1987A neutrino burst» (reproduce Hirata et al. PRL 58, 1490) | https://arxiv.org/pdf/0709.4627 |
| por qué se excluye el 6.º | por debajo del umbral de análisis E ≥ 7,5 MeV (6,3 ± 1,7 MeV; probabilidad de fondo alta: 7,9×10⁻² Hz/MeV, la mayor de la ráfaga corta). El 3.º (7,5 MeV) queda justo en el umbral y se conserva | sin documentar | Vissani 2015, Tabla 1 y §3 («the five events K6, K13, K14, K15, K16 are excluded a priori» con Emin = 7,5 MeV) | https://arxiv.org/pdf/1409.4710 (J. Phys. G 42, 013001) |
| KII: tiempos (s) de los 11 oficiales + el 6.º | 0; 0,107; 0,303; 0,324; 0,507; **0,686 (excluido)**; 1,541; 1,728; 1,915; 9,219; 10,433; 12,439 | correctos (ya estaban así en `KAM`) | Loredo & Lamb 2002, Tabla III (ti) | https://arxiv.org/pdf/astro-ph/0107260 (Phys. Rev. D 65, 063002) |
| KII: energías (MeV) | 20,0; 13,5; 7,5; 9,2; 12,8; **6,3**; 35,4; 21,0; **19,8; 8,6; 13,0; 8,9** | las 4 últimas estaban mal en `EK` (8,1; 12,2; 8,9; 6,3, de memoria; el 9.º ponía 8,1 en vez de 19,8) → corregido | Loredo & Lamb 2002, Tabla III; Vissani 2015, Tabla 1; Hirata en 0709.4627 | idem |
| KII: eventos tardíos | K13–K16 a 17,6; 20,3; 21,4; 23,8 s (4,6–6,5 MeV) son fondo/ruido, no entran en los 11 | no usados | Vissani 2015, Tabla 1 | https://arxiv.org/pdf/1409.4710 |
| KII: pausa | «between the 9th and 10th events, there was a gap of 7.304 s»; en la numeración de Hirata las etiquetas 9 y 10 son 1,915 s y 9,219 s (9,219 − 1,915 = 7,304). Sin muón cósmico (0,37 Hz) ni fondo de baja energía (0,15 Hz) en el hueco | correcto; el «9.º» es la etiqueta de Hirata (8.º evento aceptado; 9.º destello contando el 6.º) | Oyama et al., ApJ 2021 (reexamen de la estructura temporal), Fig. 1 | https://arxiv.org/pdf/2108.01783 |
| KII: nº de eventos | 11 oficiales «over ∼13 s» (12,439 s) | correcto; antes de la pausa son **8** aceptados (no 9) → corregido | Oyama 2021; Hirata et al., PRL 58, 1490 (1987) | https://arxiv.org/pdf/2108.01783 · https://link.aps.org/doi/10.1103/PhysRevLett.58.1490 |
| IMB: 8 eventos | tiempos 0; 0,412; 0,650; 1,141; 1,562; 2,684; 5,010; 5,582 s | correcto | Loredo & Lamb 2002, Tabla III; Vissani 2015, Tabla 1 (Bionta et al., PRL 58, 1494) | https://arxiv.org/pdf/astro-ph/0107260 |
| IMB: energías | 38; 37; 28; 39; 36; 36; 19; 22 MeV (L&L y Vissani). Otra tabla (arXiv 0709.4627, citando a Bionta) da 38; 37; 40; 35; 29; 37; 20; 24 con tiempos redondeados: la discrepancia viene de dos reconstrucciones distintas, no hay forma de zanjarla sin el PRL | se mantienen las de L&L/Vissani (solo fijan la altura del clic) | idem | https://arxiv.org/pdf/0709.4627 |
| Baksan: 5 eventos | tiempos 0; 0,435; 1,710; 7,687; 9,099 s; energías 12,0; 17,9; 23,5; 17,6 (17,5 en Vissani); 20,3 MeV | correcto | Loredo & Lamb 2002, Tabla III (Alekseev et al.); Vissani 2015 | https://arxiv.org/pdf/astro-ph/0107260 · https://inspirehep.net/literature/267487 |
| «24 en menos de 13 s» | cada detector por separado: KII 12,439 s, IMB 5,582 s, Baksan 9,099 s. Relojes absolutos con incertidumbre (KII ±1 min; IMB −54/+2 s; Baksan ±50 ms según otra tabla): un alineamiento reciente los hace casi coincidir (primer evento de IMB 07:35:41,37 UT; KII +6,4 s; Baksan −30,4 s) | cierto en el sentido de «cada ráfaga dura < 13 s y las tres coinciden en el tiempo». El film las muestra una tras otra por montaje (no se afirma que ocurrieran en secuencia) | Búsqueda y resumen del alineamiento de relojes (no leí el artículo primario) | https://arxiv.org/html/2605.06401 |
| Hora y fecha | 23-feb-1987, 07:35 UT | correcto | Wikipedia (ver veinticuatro.md) | https://en.wikipedia.org/wiki/SN_1987A |

## Lo no verificado
- No se leyó el texto de pago de los tres PRL/JETP originales; las cifras vienen de tablas que los reproducen. Las energías de IMB admiten dos versiones.
- «Nhit ≤ 20» como razón literal de la exclusión del 6.º viene de un resumen de búsqueda sobre Hirata et al. (1988, PRD 38, 448) y no se pudo comprobar en el PDF; la razón comprobada es el umbral de 7,5 MeV (Vissani).
