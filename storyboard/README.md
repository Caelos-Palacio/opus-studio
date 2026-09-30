# Storyboard = viñetas de trazo, baratas

No concept art. No frames renderizados. No color. No sombra.

Cada shot = un SVG de líneas negras sobre papel, 20–40 trazos, 3 minutos de modelo máximo.

## Formato de cada viñeta
- Archivo: `storyboard/{ID}.svg`
- viewBox `0 0 320 180` (o 180 320 si 9:16)
- Solo `<path>` / `<line>` / `<circle>` stroke `#141414` width 1.5–2.5
- Prohibido: fill salvo 1 negro sólido para acento de foco, filtros, texto fancy, gradientes
- Tipo: 1–3 palabras en mayúsculas, esquina, 11px
- Esquina inf-izq: `{ID}  {t0}-{t1}s`
- Esquina inf-der: beat numbers

Qué dibujar:
0. rejilla de tercios (2 verticales + 2 horizontales punteadas finas) y tamaño de plano (ECU/CU/MS/WS/EWS) en la esquina
1. encuadre (caja de cámara)
2. masas principales en 5–8 líneas
3. flecha de movimiento (acción)
4. flecha punteada de cámara
5. el hit del beat (cruz o marca)

## Franja temporal
`storyboard/STRIP.svg` — viñetas en una sola tira, ordenadas por `t0`.
- 16:9 strip: N paneles en fila, gap 8, label de tiempo bajo cada uno
- Si N>8: dos filas
- Encima: regla de beats (tick cada beat, número cada 4)

También: `storyboard/STRIP.png` a 1600px de ancho para revisión rápida.

## Regla
Nadie escribe `shots/*.js` hasta que el humano dice OK al STRIP.
Si un shot cambia de duración, se redibuja SOLO esa viñeta y se regenera el STRIP.

## Continuidad
Las entidades de un `handoff` se marcan con trazo doble en la viñeta de salida y en la de entrada:
en el STRIP tiene que verse que el mismo objeto cruza el corte.

## Perfil explainer
Una viñeta por **idea**, no por beat musical. Añade en la esquina superior derecha la anomalía en ≤ 4 palabras.

## Cámara
La flecha punteada de cámara indica el tipo (`push` flecha hacia el centro, `pull` hacia fuera, `slide` recta lateral, `rotate` arco) y su `why` en ≤ 4 palabras. Un shot, una flecha.
