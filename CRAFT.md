# CRAFT — principios universales

Fuente de verdad del **proceso** y de los mínimos de calidad. Nadie la cambia sin el director.
El **gusto visual** vive en `CINE.md` (cinematografía) y en el style pack activo (`STYLES.md`, `styles/*.json`). Los números viven en `engine/profiles.json` y en el pack; el lint los aplica.

## Siempre (cualquier estilo, cualquier perfil)
- Un motivo que **muta** de forma a lo largo del film. Transformar un objeto existente > crear uno nuevo.
- Mundo continuo: varias "cámaras" sobre el mismo espacio. Toda entidad que cruza un corte se declara en `handoffs`.
- Un movimiento de cámara por shot, con razón (`cam.why`) y dentro de los límites del estilo.
- Una familia tipográfica, 1–2 pesos, máx. 3 tamaños a la vez. El texto es un objeto del mundo.
- Paleta reducida con roles; contraste comprobado; el color, si significa algo, significa lo mismo siempre.
- Tipo nunca sobre detalle; sujeto con aire; cuadro con espacio negativo.
- Todo lo visible se entiende sin sonido; todo texto da tiempo a leerse.
- Sin transiciones baratas (las `bans` del estilo). La transición ideal: el objeto cambia de significado.
- El último frame dialoga con el primero.

## Perfiles (ritmo y exigencia; ortogonales al estilo)
| perfil | para | hold máx. | cortes | shots | extra |
|---|---|---|---|---|---|
| `reel` | launch, social, 9:16, 10–30 s | 0,8 s | en downbeat ±1 frame | 1,5–3 s | algo ocurre en cada beat |
| `explainer` | divulgación, 16:9, 1–6 min | 4 s | libres | 3–40 s | causalidad (`after`, `premise`/`anomaly`), hechos con fuente, distinguir observación/modelo/formalismo/interpretación, simplificaciones declaradas, sin teleología |
| `cinematic` | trailer, marca premium, narrativa | 6 s | libres | 2,5–20 s | pausas como ritmo; lectura más lenta (12 car/s) |

`explainer`: las ecuaciones aparecen después del fenómeno y se construyen desde objetos en pantalla.

## Criterio de listo
- `npm run lint` → SHIP (incluye cámara, composición, tipografía, tiempo de lectura, paleta).
- Mute: se entiende el arco.
- Hoja a 2 fps: sin muertos ni pops (y `out/motion.json` lo confirma); en escala de grises el sujeto se lee.
- Pase Review-Cine sin FIX.
