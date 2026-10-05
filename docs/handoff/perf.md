# Handoff — perf (R0, R3, R4, R5)
Rama `perf` (worktree .claude/worktrees/perf). Sin push. Detalle y tablas: docs/research/08-perfil.md.

## Hecho
- **R0** `npm run profile -- [--timeline X | --fixture dir] [--frames N] [--fx-fast] [--no-encode] [--json f] [--md f]` (engine/profile.mjs). Instrumentación en engine/perf.mjs (apagada por defecto; ganchos `span()` en fx.mjs, grade.mjs, prims.tex y seek).
- **Viñeta cacheada** (grade.mjs): bit a bit igual (test/perf.mjs + golden); grade.post 24–28 → 7–11 ms.
- **R3 opt-in `fxFast`**: `OPUS_FXFAST=1` / `profile --fx-fast` / `profileOverrides.fxFast`. Entra en el hash vía film.P. Por defecto OFF.
- **R4**: engine/encode.mjs (`x264Args`, `workerThreads`). `cut --preset faster --threads auto` (o OPUS_PRESET / OPUS_THREADS). Por defecto = bytes de siempre; preset ≠ medium entra en el hash.
- **R5**: test/bench-skia.mjs (no migra; `npm i --no-save @napi-rs/canvas` o OPUS_SKIA_DIR). Sin tocar node_modules del worktree (symlink a main).
- Tests: test/perf.mjs (registrado en test/run.mjs); `npm test` verde.

## No hecho / ideas
- R1 (caché de fotogramas compartida): se evitó por conflicto con el agente de lint/CLIs; ver "Pendiente" en 08-perfil.md.
- Valorar `fxFast` por defecto en `--review`/peek/lint (no en master) y `faster`+threads auto como default del master (−19 % CPU, misma calidad).
- Ojo: cambios en fx/grade/seek/prims/render/cut/film invalidan la caché de fragmentos (hash de motor); es esperable.
