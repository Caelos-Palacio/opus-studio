# Rama `deuda`: deuda conocida del HANDOFF

## 1. Crítico vs gate (contrato único)
- `critic.mjs` escribe la caché con `hash` (hash del plan del shot; `_film` = hashes de todos los shots unidos) además de `key`.
  Es lo que lee `gate.criticState`: la caché real ya cuenta como cobertura y detecta FIX.
- Un veredicto completo (sin `--shot`) sella `out/critic.json` con `verdict.mjs stamp` (`sealCritic`). Test e2e en test/critic.mjs.

## 2. Capas de film con carpeta
- `layersDir`: `<carpeta del film>/layers` si el film tiene carpeta propia (`data/<f>/timeline.json` o `data/<f>/<f>.json`) y existe; si no `data/layers/<f>`.
- **El cookKey de regla cambia** (ahora se aplica `data/regla/layers/memoria.json`): caducan sus veredictos y fragmentos; relanzar lint antes del master.
