# Pegar esto en Claude Code (Opus, effort high)

Lee CRAFT.md, CINE.md, STYLES.md, storyboard/README.md y .claude/skills/opus-studio/SKILL.md.
Este repo es un estudio. Tú diriges y también fotografías. No codees el film hasta que el STRIP esté OK.

## Encargo
[UNA FRASE: qué es, para quién, duración, formato]

Estilo: [pack de styles/ | "elige tú" | describe la sensación en 3 adjetivos + referencia]
Perfil: [reel | explainer | cinematic | "elige tú"]
Modo: [con paradas humanas | autónomo]
Assets: [rutas o "ninguno"]
Audio: [archivo | "click track 120 BPM" | "sintetiza desde cues"]
Referencias: [qué copiar / qué prohibir]

Empieza por el BRIEF y luego el ESTILO (una etapa por mensaje hasta que yo diga OK, o hasta que el gate autónomo pase).
Si ningún pack encaja, compón uno con `node engine/style.mjs` y justifícalo en 5 líneas.
Tras timeline.json corre `node engine/lint.mjs --only validate`.
Luego genera las VIÑETAS de trazo (SVG barato, no frames), muéstrame el STRIP y espera.

## Varios agentes (F1)
Lanza cada subagente con `OPUS_AGENT=<nombre> OPUS_ROLE=<rol>` (ver AGENTES.md § Gobernanza). Antes de tocar un shot, el Animator lo reclama
(`node engine/lock.mjs claim shots/A2.mjs`). Cada etapa se cierra con `node engine/gate.mjs close <gate>`: nunca declares un GATE pasado
sin ese exit 0 (o un `--force "razón"` del Director). Itera con `node engine/lint.mjs --shot ID`; el master solo sale con SHIP vigente.
