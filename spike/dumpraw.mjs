import fs from 'node:fs';
const T = +process.argv[3]; const which = process.argv[2];
if (which === 'gl') { const { frameRGBA } = await import('./render-gl.mjs'); fs.writeFileSync(`out/webgl/raw_${process.env.TAG}.bin`, frameRGBA(T)); }
else { const { openChrome } = await import('./render-chrome.mjs'); const C = await openChrome(); fs.writeFileSync(`out/webgl/raw_${process.env.TAG}.bin`, await C.frame(T)); await C.close(); }
