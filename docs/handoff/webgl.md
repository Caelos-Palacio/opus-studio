# Handoff — spike WebGL (rama webgl)
Estado: spike completo. Informe: docs/history/research/07-webgl.md. Código: spike/ (world.mjs, render-gl.mjs, render-chrome.mjs, datacenter.mjs, helpers dumpraw/cmp/dump-gl).
Repro: `npm i --no-save three@0.160.0 gl puppeteer-core` (en el worktree: node_modules es copia con enlaces duros del principal, no symlink; NO se commitea) y `node spike/datacenter.mjs` → out/webgl/datacenter.mp4 + contact.png.
Decisión pendiente (usuario): ¿integrar world3d con headless-gl (recomendado) o descartar? El prototipo no está integrado en el motor ni en tests.
