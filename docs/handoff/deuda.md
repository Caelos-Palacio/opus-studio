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

## 4. CI macOS (reproducido en Linux)
- Log real del job macos-14 (gh run view --job): golden demo 6/9 y fixture 6/15 = EXACTAMENTE los fotogramas con texto que cambian al sustituir la tipografía
  (simulado con otra fuente en Linux: mismos fotogramas y Δmax 224 en A1@mid). Causa: otras fuentes/cairo, no el motor.
- Fix: modo tolerante por BLOQUES de 8×8 celdas (composición), umbral 90/2 (calibrado: otra tipografía ≤ 41/0,6). Selftests `golden-otra-fuente`
  (DejaVu Serif vía `OPUS_GOLDEN_FONTCONF`/test/golden/fonts-alt.conf pasa) y `golden-tolerante-detecta` (cuadrado de 200 px se detecta). Estricto intacto en misma huella.
- gov 124/129 (ENOENT ledger + 4 E11): reproducido con `TMPDIR=<symlink>`. `roles.rel()` comparaba la ruta simbólica (/var/…) con ROOT real (/private/var/…) → "fuera del proyecto" → allow sin registrar.
  Fix: realpath del ancestro existente. Test sin plataforma (symlink explícito). `copyRepo` ahora devuelve realpath (hash: grafo-vivo y digests fallaban por lo mismo en macOS).
- Siguen sin cubrir (solo macOS, no reproducibles aquí): world3d (headless-gl/GL en macOS: determinismo, PSNR 27 dB, coste) — el job es `experimental`.
- Para reproducir: `ln -s $(mktemp -d) /tmp/lnk; TMPDIR=/tmp/lnk npm test`.

## 5. isMain
- `engine/{ctx,status,dsl,vocab}.mjs` usan `isMain` de paths.mjs (sin `file://${argv[1]}`). docs/ctx y STATUS.md regenerados (estaban caducados).
