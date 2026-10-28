# Consta (C1) — el kilo que no puede adelgazar

45 s · 16:9 · kraft · forma causal · tono humor seco + vértigo · giro al 58 % (26 s) · story: `consta.story.json`

## 1. Hechos verificados
| afirmación del research | resultado | fuente |
|---|---|---|
| Cilindro de platino-iridio, 90/10, ≈39 mm de alto y de diámetro, fundido en 1879 (Johnson Matthey), ratificado como el kilo por la 1.ª CGPM en 1889 | confirmado | https://en.wikipedia.org/wiki/International_Prototype_of_the_Kilogram · NIST (1879, cilindro) https://www.nist.gov/si-redefinition/kilogram-introduction |
| Custodia en el BIPM, "Sèvres", cámara que exige tres llaves de custodios independientes | confirmado. Matiz: el BIPM (Pavillon de Breteuil) cae técnicamente en Saint-Cloud; NIST y Wikipedia dicen "Sèvres" y "las afueras de París" | NIST (arriba) · https://greg.org/archive/2009/08/25/the-international-prototype-kilogram-or-le-grand-k.html |
| Tres campanas de cristal para el IPK; cada una de las 6 copias hermanas bajo dos | confirmado | greg.org (arriba) · Wikipedia (arriba) |
| ≈50 µg de divergencia respecto a las copias en ~100 años | confirmado, pero la cifra es RELATIVA: "el IPK perdió quizá 50 µg frente a sus copias" y "no hay datos históricos que determinen cuál de los prototipos ha sido más estable". Nadie sabe quién se movió. | Wikipedia (arriba); BIPM citado en https://www.discovermagazine.com/the-kilogram-isnt-what-it-used-to-be-its-lighter-2479 |
| Tres verificaciones periódicas | 1889, 1948, 1989 (el research no daba fechas). Algún texto dice 1946; Wikipedia y la búsqueda dicen 1948 | Wikipedia (arriba) |
| Redefinición: voto 16-nov-2018, vigente 20-may-2019, h = 6,62607015 × 10⁻³⁴ J·s exacta | confirmado | https://en.wikipedia.org/wiki/Kilogram · NIST (arriba, "November 2018") |

CORRECCIÓN al research §3.3/§8: el giro "no adelgazó el kilo: engordó el mundo" NO se sostiene como hecho. No se sabe si el IPK perdió o las copias ganaron. El giro verdadero (y mejor) es "no consta cuál se movió": la duda es el material. Descarto también la frase "las tres llaves protegían de ser medido por otro" (las copias SÍ se comparan con él en las verificaciones) y la cambio por "garantizaban que nadie lo tocara, no que no cambiara".
Sin verificar y NO usado en pantalla: "contaminación superficial reversible de ~1 µg/año" (resumen de búsqueda de NIST, no leí la página); los nombres de los tres custodios; la equivalencia de 50 µg con un grano de sal (orden de magnitud propio).

## 2. Versión por defecto (escrita antes del guion, "escéptico ciego" autosimulado)
"El kilo cambia: Le Grand K pierde 50 µg en un siglo, los científicos no se fían de un objeto, en 2019 lo sustituyen por la constante de Planck. La ciencia siempre avanza." Giro = "ahora ya no depende de un objeto"; cierre optimista. Es el explainer que ya existe de sobra.
Distancia: el guion despacha 2019 en un beat (b7) y se queda en la casilla en blanco "quién se movió". No celebra, no explica Planck. Pero el tema (kilo + 2019) SÍ es el por defecto: distancia_default = 1, no 2. Riesgo honesto: es de los temas más cubiertos de divulgación. Lo salva el ángulo (indecidibilidad + acta), no el tema.
Nota: `data/story.template.json` de la rama narr ES el ejemplo del research con el giro "engordó el mundo". Este guion lo reemplaza y corrige.

## 3. Test de frescura (§4.1): 12/14, sin ceros
ancla 2 (cilindro, 3 llaves, 3 campanas) · pregunta 2 ("respecto a qué lo pierde") · hecho_raro 2 (50 µg sin culpable) · giro_relee 2 (las llaves pasan de proteger la verdad a proteger la custodia) · apuesta 1 (es convención vs. verdad; nadie pierde algo tangible) · distancia_default 1 · distancia_archivo 2. Vetos: cabe en póster? No (la frase final es un hecho, no una tesis). Lint (narr de la rama narr, importado, sin tocarla): 0 FIX, 0 WARN; frescura APTO.

## 4. Nota de dirección
- Objeto ancla: el cilindro bajo tres campanas anidadas. Física: vidrio frío, ligeras condensaciones en las campanas, la balanza de cruz cuya aguja NO vuelve al cero (se queda ladeada medio grado hasta b5). Todo en miniatura sobre papel de estraza con relieve.
- b1 (7 s): plano fijo y largo. Tres manos, tres llaves, un tampón sin tinta. Ancla visible desde el segundo 0,4. b2: la balanza. b3 (9,6 s, el más largo): la pluma tacha "ha perdido" dos veces; sello rojo SIN VARIACIÓN; papel secante. b4: seis copias, un plato de balanza que baja un pelo con cada una (ritmo de cuentagotas).
- b5 (26 s, el giro): pausa de 4,5 s, sin música ni foley salvo el reloj de pared. La mosca recorre la casilla en blanco. Es el beat que pesa; no le pongas texto extra.
- b6: las llaves giran una tras otra (tres clics distintos). b7: el sello baja sobre "h = 6,62607015 × 10⁻³⁴ J·s"; 2,6 s, casi un trámite (más corto que lo que merece, a propósito). b8: la cámara aguarda tres segundos de más; el sello baja SIN tinta.
- Ritmo: 7,0 / 4,0 / 9,6 / 5,0 / 4,5 / 6,0 / 2,6 / 5,9 s (CV 0,39). Cortes secos; ningún whoosh.
- Sonido: papel, tampón, pluma sobre papel, secante, mecanismo de llave, reloj. Música: nada, o una sola nota grave de oficina (zumbido de fluorescente) que se corta en b5. El silencio de b5 y de b8 son los dos picos.
- Texto en pantalla: sello/etiqueta de expediente, tipografía mecanográfica; "consta" 5 veces (dentro del 2–6 del lint). Rojo de sello como único acento.
- Imperfección deliberada (t≈41): el acta se queda sin la tercera firma; la cámara aguarda 3 s de más. Y la balanza ladeada. No las arregles.
- NO hacer: no mostrar un "gato en la balanza" ni humor de objetos (el humor sale de la sequedad, no del gag); no explicar la constante de Planck; no decir "engordó el mundo"; no música épica; no dar un cierre de "la ciencia avanza"; no negro. No abrir con "¿…?".

## Ajustes tras el escéptico ciego (2026-10-07)
El escéptico adivinó el giro ("no se sabe cuál cambió"). Se mantiene (es verdad y es el corazón), pero el centro se desplaza a
lo que NO previó: (1) la voz del funcionario y su "consta"; (2) un cierre de otra especie que agrande en vez de desinflar: desde
2019 el cilindro tiene, por primera vez, una incertidumbre propia (deja de ser el kilo y pasa a poder ser medido) — VERIFICAR con
fuente BIPM antes de usarlo; si no se sostiene, cerrar en el sello sin tinta. No añadir explicación.
