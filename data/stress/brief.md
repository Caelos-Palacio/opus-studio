# Brief — «Potencias» (film de estrés F0)

- Pieza: explainer de 78 s. Desde una persona hasta el borde del universo observable en saltos de ×10, a ritmo constante
  (homenaje explícito a *Powers of Ten*, Eames 1977: ×10 cada 10 s; aquí ×10 cada 1,5 s). Después, la regla se rompe
  (no hay 10^27 observable), el viaje entero se pliega en una regla de 27 pasos iguales y volvemos a casa.
- Estilo: `cosmos` (nocturno, ámbar + cian, bloom físico, niebla/DOF) con `styleOverrides` de tipo (Lato: Helvetica cae a Nimbus Sans aquí).
- Energía: baja → media constante → pico → silencio → baja.
- Perfil: `explainer` (causalidad `after`, hechos con fuente en `data/facts.json`).
- Modo: autónomo (gates cerrados por el propio agente; ver `docs/research/06-estres.md`).
- Duración: 78 s · 16:9 · 1280×720 · 30 fps.
- Sonido: solo `shot.sfx` (sound.mjs): tic en cada ×10 (el metrónomo de Eames), lechos `drone`, `riser` al borde, `impact` en el borde, **silencio** 51,6–54,6 s, `rev` en la revelación.
- Una frase que debe entenderse mute: «Todo lo que existe cabe en 27 multiplicaciones por diez desde ti.»
- Pregunta del gancho (brecha, 8 % del film): «¿Cuántos pasos hasta el borde de lo visible?» → respuesta tardía (72 %): «≈ 27».
- Arco causal: un metro (observación, escala humana) → cada ventana es 10× la anterior (regla) → la regla nos lleva de la
  Tierra a la red cósmica (observación) → **no hay más allá observable** (la regla se rompe: anomalía) → los 27 pasos,
  puestos en fila, son iguales: eso es un logaritmo (modelo → formalismo) → volvemos a 10^0: tú eres el punto de partida.
- Motivo: la **ventana** cuadrada (frame) → cada ventana se vuelve un **punto** de la regla (dot) → la regla (bar) → casa (home).
- Color: ámbar = tú y la ventana (la unidad que se multiplica); cian = luz (atmósfera, estrellas, borde CMB); tinta = mundo.
- Referencias: Eames, *Powers of Ten* (copiar: ritmo constante, centro fijo, contador; no copiar: el picnic, la vuelta al átomo).
  3Blue1Brown (la ecuación llega después del fenómeno y se construye desde lo que está en pantalla).
- Lo que no haré: partículas decorativas, zoom de cámara falso (la escala es contenido, no cámara), afirmar posiciones reales
  de estrellas/galaxias (direcciones simplificadas y declaradas), texto que duplica lo que ya se ve.

## 5 líneas (salida de la etapa 1)
1. Pieza: de 1 m a 8,8×10²⁶ m en 27 pasos ×10 y vuelta; la regla de pasos iguales = log₁₀.
2. Arco mute: persona → ventanas que crecen ×10 → Tierra, Sol, estrellas, galaxia, red → borde (flash, silencio) → regla → persona.
3. Look: cosmos nocturno, ámbar = tú, cian = luz, TeX real para cada cifra.
4. Ritmo: calma 10 s, viaje a 1,5 s por orden (constante), pico al 65 %, hold/silencio 3 s, revelación al 72 %, descenso.
5. No haré: cámara falsa, partículas decorativas, cifras sin fuente.

## Estilo (etapa 1b)
Emoción: asombro contenido · Energía: baja-media · Referencia: Eames 1977 · Paleta: cosmos (papel azul-negro, ámbar, cian) ·
Cámara: casi quieta (la escala la mueve el contenido); push al abrir, pull al revelar la regla, slide al volver, push al aterrizar.
- Viñetas: `storyboard/stress/<ID>.svg` (el campo `vignette` del timeline se retiró tras el merge del esquema cerrado: no tenía consumidor).
