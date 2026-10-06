# Handoff — motor (spec docs/specs/009-motor.md)
Hecho: engine/cookkey.mjs (clave por shot/film), framecache.mjs (R1), framewarm.mjs (precalentamiento paralelo), audiocache.mjs (R7); lint incremental
(determinismo por muestra OK, --shot real en motion/rhythm/transitions, arc solo con caché), peek/index/metrics por caché; fxFast por defecto en lint/peek/review/stills;
cut: preset faster, hilos auto, troceo 120 + LPT. Audio: caché de música y efectos, mixdown/limitador sin alocaciones, piano por recurrencia.
Env: OPUS_NOCACHE=1, OPUS_WARM=0|1, OPUS_STATS=1 (imprime aciertos/fallos y ms por check), OPUS_FXFAST=0.
Pendiente: critic no usa la caché (territorio de deuda); R2/R7 por sección fina; tocar film.mjs/render.mjs caduca fragmentos y veredictos una vez.
