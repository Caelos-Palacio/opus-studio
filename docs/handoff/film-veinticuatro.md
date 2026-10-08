# Handoff — film VEINTICUATRO (E2b)
Rama `film-veinticuatro` (sin push). Entrega: `out/entregas/veinticuatro.mp4` + `veinticuatro.jpg`. Falta la nota del usuario (H1).

## Qué es
75 s, 16:9, estilo `cosmos` (ámbar = lámpara/archivo, cian = destello). Mitad 1: cubas (Kamiokande-II, IMB, Baksan) con destellos al ritmo REAL; mitad 2 (giro 48 s): mesa, lámpara, papel continuo con los mismos puntos; cierre en agua negra y silencio.
Datos: `data/veinticuatro/{story.json,build.mjs,escenas.mjs,timeline.json,audio.json}`; shots `shots/V01..V12.scene.json` (generados por `escenas.mjs`, editables a mano). Regenerar: `node data/veinticuatro/escenas.mjs && node engine/dsl.mjs build --all`, luego `node engine/sound.mjs --mix && node engine/audio.mjs --analyze data/mix-veinticuatro.wav`.

## Decisiones
- Pausa: 7,304 s reales entre el 9.º y el 10.º destello, silencio digital (sin música, sin ambiente, sin drone); el 9.º→10.º se mide en el timeline (test V2/V3).
- Dudoso (CORREGIDO 2026-10-08): el evento EXCLUIDO de los 11 oficiales de KII es el 6.º (0,686 s, 6,3 MeV; bajo el umbral de 7,5 MeV), no el 12.º. Va a media luz DENTRO de la primera ráfaga (V02, `gota` débil, el contador no lo cuenta: 8 aceptados en 1,915 s), el contador queda en 8 en la pausa y los «tres más» (9,219; 10,433; 12,439 s) son todos aceptados → 11. En V05 el sexto reaparece a media luz con el 12 fantasma («Otras cuentas ponen doce. El sexto, el débil.»); V08: «Veinticinco, si vale el sexto.»; V12: el lápiz no marca el 6.º punto (al principio de la fila de KII), la cámara muestra desde FX −80 / FY 0.
- Opciones del giro: (A) dudoso al final (el film original; FALSO: el 12.º es oficial); (B) dudoso a mitad de la ráfaga (elegida, fiel a los hechos; el 7,304 s sigue entre los destellos 9.º y 10.º contando el 6.º como destello). El giro de la película (papel/archivo) no cambia; sí pierde la simetría «el último queda a medias» y gana que el hueco de la pausa y el dudoso quedan lejos en la hoja.
- Reencuadre: V02 termina a 12,6 s (el texto necesitaba 3 s); V04 se alarga a 22,4 s (3 destellos, el último a 21,44 s) y V05 queda 22,4–25,4 s; los beats del story se retimaron (giro 48 s intacto).
- Listado de impresora: una línea y se pasa; la hoja marca el hueco de la pausa y el lápiz lo recorre sin marcar; el último punto se marca; el 12.º queda con arco a medias.
- Motor: voces `gota` (clic de agua, altura = energía) y `nota` (nota larga) en `sounddesign.mjs`, `sound.mjs` (v1), esquema (`voice` + `sfx.energia`). Sin música: `mix.bus.music −90`, `sfx.air false`, `impact.tailKeep 999`, `peakFallback 0.64`.
- Audio: −19 LUFS a propósito (film escaso); techo −3 dBTP.

## Verificación de datos (2026-10-08)
Tabla con cita y URL: `docs/guiones/veinticuatro.fuentes.md`. Resultado: tiempos de KII, IMB y Baksan correctos; energías de KII 9.º–12.º estaban mal (ahora 19,8; 8,6; 13,0; 8,9 MeV); el excluido es el 6.º; la pausa de 7,304 s correcta (etiquetas 9 y 10 de Hirata). Pendiente sin comprobar: PRL originales de pago; energías de IMB con dos versiones en la literatura (se usan las de Loredo-Lamb/Vissani; solo fijan la altura del clic).
Gates (2026-10-08): narr 0 FIX (1 WARN previo `imperfeccion.presente`), lint SHIP 0 FIX, critic SHIP (manual, láminas V05/V08/V12 + peek), master sin --force, −19,0 LUFS, pico −3,5 dBFS. Entrega reemplazada en `out/entregas/veinticuatro.{mp4,jpg}` del repo principal (jpg = peek 4×3).
Rama al día con main (merge sin conflictos; STATUS.md y data/tools.index.json regenerados).

## Pendiente / dudas
- Falta la nota del usuario (H1).
- Papel: V10–V12 usan hoja de formas (el objeto `papel_continuo` registra un foco del tamaño de la hoja y el lint prohíbe texto sobre foco); solo V09 usa el objeto.
- Recetas: `pausa_sostenida`/`contar`/`documento` no encajaban (ancla circular); se escribieron escenas propias con elementos (fondo, objetos).
- Avisos de lint (~49): pop de destellos, objetos tocando borde.
