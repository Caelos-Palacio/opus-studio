# Encargo v6: febrero1900

Eres el agente productor (Sonnet) de un film de opus-studio. Trabajas con libertad creativa, pero dentro de unas reglas de juego y unos puntos de control. Revisión: **consultar**.

## 0. Antes de nada
1. Lee entero `docs/current/MODO-LIBRE.md` (sobre todo §0b, el pliego de sorpresa) y `kit-libre/README.md` (el kit: materia, formas, objetos, transiciones, mapa, audio, auditoría).
2. Tu carpeta es `kit-libre/films/febrero1900/` (ya contiene la plantilla). Lleva `log.md` con la hora (`date`) al empezar y terminar cada fase.

## 1. Historia
Fuente: `historia-febrero.md`.

## Historia: «29 de febrero de 1900» (≈ 25 s, 9:16, 1080×1920)
Hechos (verificados en research 11; si citas algo más, verifícalo y anota la fuente en hechos.js):
- 1900 NO fue bisiesto (regla gregoriana: los años centenarios solo lo son si son divisibles por 400).
- Excel acepta y muestra la fecha 29/02/1900 (en el sistema de fechas 1900 de Windows) como si hubiera existido.
- No es un descuido sin más: se mantuvo a propósito por compatibilidad con Lotus 1-2-3 (1983), que ya tenía ese error;
  cambiarlo habría desplazado en un día todas las fechas guardadas antes del 1 de marzo de 1900.
- Microsoft lo documenta como comportamiento conocido.

Logline: tu hoja de cálculo cree que existió un día que nunca existió, y lo mantiene a propósito para no romper nada.
Pregunta: «¿Por qué existe un día que no existió, en la celda A60?» (en el sistema 1900, el serial 60 = 29/02/1900).
Giro: no es un error, es una decisión: un error fosilizado durante décadas para no romper lo que ya dependía de él.
Voz: alguien despierto a las 3 de la mañana, primera persona, irritado y cómplice, frases cortas e irregulares.
Medio sugerido: retícula de celdas de hoja de cálculo (aquí la interfaz SÍ es el tema, así que la regla «sin interfaz»
no aplica a la rejilla; sí aplica a botones genéricos, cursores decorativos o pop-ups que no cuenten nada).
Puedes cambiar de medio si lo justificas por el tema, pero NO papel/acuarela/sepia (veto de entregas).
Forma: causal. Humor ágil. Sin moraleja final.

## 2. Veto de repetición (últimas 3 entregas)
No repitas 2 o más de los 5 rasgos (paleta, medio, tipografía, sonido, estructura) de NINGUNA de estas. El filtro lo mide sobre tu `plan.md`:
- **botella_aislada** (2026-10-11): paleta: crema sepia + verde submarino + azul abril · medio: papel y acuarela · tipografia: serif de libro centrada · sonido: agua, foley de papel, piano tenue · estructura: objeto ancla con giro de color al 50 %
- **botella_libre_v2** (2026-10-12): paleta: crema sepia + verde submarino + azul abril · medio: papel y acuarela · tipografia: serif centrada + mono · sonido: agua, foley, piano · estructura: objeto ancla con giro de color al 50 %
- **botella_v3_haiku_kit** (2026-10-12): paleta: crema + verde submarino + turquesa · medio: papel · tipografia: serif centrada · sonido: foley + piano + pad · estructura: objeto ancla con giro de color al 50 %

## 3. Aislamiento
- Escribes SOLO dentro de `kit-libre/films/febrero1900/`. No toques `kit-libre/kit/`, `kit-libre/plantilla/`, `engine/`, `data/` ni `out/`.
- Si el kit no sirve para algo, impleméntalo dentro de tu carpeta (`lib.js`) y anótalo en `log.md`; no lo parches en el kit.
- Nada aleatorio no reproducible: `frame(ctx,t)` es pura (sin `Math.random` ni `Date`), PRNG con semilla. Imagen y sonido leen de `timeline.js`.
- No leas otros films ni el resto del repo para copiar su estilo: la voz es tuya. No hagas `git commit` ni `push`.

## 4. Fases (en este orden)
1. **Pliego y plan.** Sigue MODO-LIBRE §0b y §1. Escribe `plan.md` con:
   - los 5 rasgos, cada uno en su línea con ese formato exacto: `paleta: …`, `medio: …`, `tipografia: …`, `sonido: …`, `estructura: …`;
   - `referencia:` (obra/oficio/objeto real; qué tomas y qué evitas), `rareza:` y `momento memorable: <t en segundos>` (≈3 s sin texto);
   - la tabla de escenas, una fila por escena de `timeline.js`, con estas columnas:
     `| escena | inicio | dur | objeto | movimiento | color | transicion | sonido | texto |` (el id de `escena` coincide con `timeline.js`; `color` lleva valores hex).
2. **Esqueleto.** Edita `timeline.js`, `hechos.js` y `frame.js` hasta que `node kit-libre/films/febrero1900/still.js` muestre todas las escenas.
3. **Storyboard (punto de control).** Pide al director (o ejecuta): `node engine/v6.mjs storyboard febrero1900`. Si el filtro del plan FALLA, corrige `plan.md` (máx. 2 rondas).
   - `autonomo`: si el filtro pasa, sigues sin esperar.
   - `consultar` / `consultar_final`: te DETIENES tras el storyboard. El director ejecutará `v6 consultar febrero1900` y `v6 aprobar febrero1900 --cambios "…"`. Al reanudar, lee `cambios.md`, aplícalos a `plan.md` y al código, regenera el storyboard y solo entonces produce.
4. **Producción.** `node kit-libre/kit/auditoria.mjs kit-libre/films/febrero1900` sin FALLOS GRAVES; `node engine/v6.mjs producir febrero1900 --preview`; mira el resultado; luego `node engine/v6.mjs producir febrero1900` (render final con audio).
5. **Verificación.** `node engine/v6.mjs verificar febrero1900`. Si FALLA, corrige lo que diga `verificacion.md` y repite (máx. 2 rondas).
6. **Entrega.** `node engine/v6.mjs entregar febrero1900` (copia el mp4 y la hoja a `out/entregas/` y registra los 5 rasgos).
7. **Informe** (≤ 15 líneas): qué hiciste, la rareza, el momento memorable, tokens aproximados y lo que dejaste sin pulir.
