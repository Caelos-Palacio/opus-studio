# Handoff — film VEINTICUATRO (E2b)
Rama `film-veinticuatro` (sin push). Entrega: `out/entregas/veinticuatro.mp4` + `veinticuatro.jpg`. Falta la nota del usuario (H1).

## Qué es
75 s, 16:9, estilo `cosmos` (ámbar = lámpara/archivo, cian = destello). Mitad 1: cubas (Kamiokande-II, IMB, Baksan) con destellos al ritmo REAL; mitad 2 (giro 48 s): mesa, lámpara, papel continuo con los mismos puntos; cierre en agua negra y silencio.
Datos: `data/veinticuatro/{story.json,build.mjs,escenas.mjs,timeline.json,audio.json}`; shots `shots/V01..V12.scene.json` (generados por `escenas.mjs`, editables a mano). Regenerar: `node data/veinticuatro/escenas.mjs && node engine/dsl.mjs build --all`, luego `node engine/sound.mjs --mix && node engine/audio.mjs --analyze data/mix-veinticuatro.wav`.

## Decisiones
- Pausa: 7,304 s reales entre el 9.º y el 10.º destello, silencio digital (sin música, sin ambiente, sin drone); el 9.º→10.º se mide en el timeline (test V2/V3).
- 12.º destello: a media luz, el contador no lo acepta (se queda en 11), `gota` débil; el 25 fantasma aparece junto al 24. Cambio frente al guion: 9 + 2 aceptados = 11 (el guion decía «tres más»).
- Reencuadre: V02 termina a 12,6 s (el texto necesitaba 3 s); los beats del story se retimaron (giro 48 s intacto).
- Listado de impresora: una línea y se pasa; la hoja marca el hueco de la pausa y el lápiz lo recorre sin marcar; el último punto se marca; el 12.º queda con arco a medias.
- Motor: voces `gota` (clic de agua, altura = energía) y `nota` (nota larga) en `sounddesign.mjs`, `sound.mjs` (v1), esquema (`voice` + `sfx.energia`). Sin música: `mix.bus.music −90`, `sfx.air false`, `impact.tailKeep 999`, `peakFallback 0.64`.
- Audio: −19 LUFS a propósito (film escaso); techo −3 dBTP.

## Pendiente / dudas
- Energías (MeV) y tiempos intermedios de las tablas: de memoria; un subagente (haiku) los dio por confirmados. IMPORTANTE: ese mismo informe dice que la fila EXCLUIDA de los «11 oficiales» de Kamiokande-II es la 6.ª (0,686 s), no la 12.ª. El film sigue el guion (12.º dudoso); decidir si se cambia (el 12.º sería aceptado y el 6.º el dudoso).
- Papel: V10–V12 usan hoja de formas (el objeto `papel_continuo` registra un foco del tamaño de la hoja y el lint prohíbe texto sobre foco); solo V09 usa el objeto.
- Recetas: `pausa_sostenida`/`contar`/`documento` no encajaban (ancla circular); se escribieron escenas propias con elementos (fondo, objetos).
- Avisos de lint (50): pop de destellos, objetos tocando borde.
