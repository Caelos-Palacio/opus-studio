# Entorno del film «e^{iπ}» (mate). Uso:  source data/mate/env.sh   (cada comando del motor lo necesita: el shell no conserva el export)
export OPUS_TIMELINE=data/mate/timeline.json
export OPUS_STORY=data/mate/story.json
export OPUS_LAYERS=none            # sin esto el film se llama "main" y aplicaría data/layers/memoria.json (capa del demo A1–A3)
export OPUS_AGENT=video-mate OPUS_ROLE=director
