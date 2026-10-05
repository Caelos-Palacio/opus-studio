# Traspaso — vídeo "La regla que se adapta" (agente cortado por límite de uso)

Encargo: perfil cinematic, ~60 s, 16:9, estilo oscuro/contundente. Un sistema abstracto recibe golpes que parecen
daño hasta que el giro revela que se ADAPTABA: la memoria conceptual reinterpreta retroactivamente los golpes
previos (estilo Mahoraga, sin personajes con copyright). Memoria (data/regla/memoria.json) dirige la edición vía
capa de parámetros; leitmotiv que se transforma en el giro; impactos con pre-silencio; crescendo; hold; pico 60–85 %.
Entregables: out/regla.mp4 (npm run master SIN --force) y docs/videos/regla.md (concepto, decisiones, qué funcionó/
falló del sistema, falsos positivos del lint, métricas arc/sound, tiempos).

Estado al cortarse: brief, story, memoria, timeline (data/regla/), capas (data/regla/layers), 14 shots R01–R14 +
R_mundo, storyboard/regla/, estilo visual styles/hierro.json, estilo sonoro styles/sound/forja.json; cambios en
engine/params.mjs y engine/signal.mjs (revisar con git diff, documentar por qué). Iba a correr el LINT COMPLETO.
OJO: out/lint.json dice film "main": filmKey() usa el basename del timeline y "timeline.json" → "main", colisiona
con el demo. Usar un nombre distinto (p.ej. data/regla/regla.json) o arreglar filmKey; anotarlo como bug.
