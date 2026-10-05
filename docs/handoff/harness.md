# Handoff harness (ROADMAP §2)
Estado por punto (actualizar al avanzar):
1. EDL: HECHO. data/edit.schema.json + engine/inputs.mjs (validateEdit/assertEdit/atempoChain) enganchado en film.buildTimeMap y cut. Test: test/harness.mjs --only edl.
2. HECHO: esquemas notas/audio/medio/sound-style/facts/world3d.scene + story con ruta JSON + safeJoin; cargadores enganchados (film, score, metrics, world3d). test/fuzz.mjs (seed, --n, --no-cli).
3. HECHO: engines + sandbox fail-closed (--unsafe-legacy-node/OPUS_UNSAFE_LEGACY_NODE, ledger). Test: harness --only runtime
4. HECHO: paths.mjs (rootFrom/isMain), sustituidos .pathname e isMain salvo gate/orch/ledger(isMain)/roles (de otros agentes; seguimiento). Test: harness --only paths
5. HECHO: ci.yml (ubuntu-24.04 + macos-14 experimental, Mesa+xvfb, node 22.15, git config); act no disponible → test estático harness --only ci. NO ejecutado en GitHub.
6. HECHO: harness --only repro (dos copias limpias de archivos versionados en rutas distintas, golden worker, sha por fotograma).
