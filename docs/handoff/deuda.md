# Rama `deuda`: deuda conocida del HANDOFF

## 1. Crítico vs gate (contrato único)
- `critic.mjs` escribe la caché con `hash` (hash del plan del shot; `_film` = hashes de todos los shots unidos) además de `key`.
  Es lo que lee `gate.criticState`: la caché real ya cuenta como cobertura y detecta FIX.
- Un veredicto completo (sin `--shot`) sella `out/critic.json` con `verdict.mjs stamp` (`sealCritic`). Test e2e en test/critic.mjs.

## 2. Capas de film con carpeta
- `layersDir`: `<carpeta del film>/layers` si el film tiene carpeta propia (`data/<f>/timeline.json` o `data/<f>/<f>.json`) y existe; si no `data/layers/<f>`.
- **El cookKey de regla cambia** (ahora se aplica `data/regla/layers/memoria.json`): caducan sus veredictos y fragmentos; relanzar lint antes del master.

## 3. TeX dinámico en el sandbox
- Causa: la caché de TeX falla (cadena generada por el shot) → `compileTexSync` + `writeAtomic` usaban `process.pid`/`Date` dentro del sandbox → SandboxError.
- Vía: `trusted(fn)` en `engine/sandbox.mjs` (solo el motor lo importa; el shot no puede) ejecuta la compilación con los globales reales y reinstala el sandbox
  intacto (la secuencia de Math.random no se reinicia). `makeTexStore.get` lo usa solo en fallo de caché; cadena ≤ 2000 caracteres. El resultado es función pura de la cadena.
- `assets --tex` sigue precompilando los literales (más rápido en frío y manifiesto para el navegador); lo dinámico se compila al vuelo y se cachea igual.
- Tests: test/guard.mjs (trusted) y mutación `tex-dinamico` en test/run.mjs.
