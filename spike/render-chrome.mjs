// Opción (b): Chrome headless (SwiftShader, CPU) vía puppeteer-core; red bloqueada; lee píxeles con readPixels (RGBA crudo, sin PNG).
import puppeteer from 'puppeteer-core'; import crypto from 'node:crypto'; import path from 'node:path'; import fs from 'node:fs';
const D = path.dirname(new URL(import.meta.url).pathname), ROOT = path.resolve(D, '..');
const W = 1280, H = 720;
export async function openChrome({ aa = false } = {}) {
  const tmp = path.join(ROOT, 'out/webgl/site'); fs.mkdirSync(tmp, { recursive: true });
  fs.copyFileSync(path.join(D, 'page.html'), path.join(tmp, 'page.html')); fs.copyFileSync(path.join(D, 'world.mjs'), path.join(tmp, 'world.mjs'));
  fs.copyFileSync(path.join(ROOT, 'node_modules/three/build/three.module.js'), path.join(tmp, 'three.module.js'));
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
    args: ['--no-sandbox', ...(process.env.CHROME_GL ? process.env.CHROME_GL.split(' ') : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']), '--ignore-gpu-blocklist', '--allow-file-access-from-files', '--disable-dev-shm-usage', '--force-color-profile=srgb'] });
  const page = await browser.newPage(); await page.setViewport({ width: W, height: H });
  await page.setRequestInterception(true);
  const blocked = []; page.on('request', (rq) => { const u = rq.url(); if (u.startsWith('file://' + tmp)) rq.continue(); else { blocked.push(u); rq.abort(); } });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto('file://' + path.join(tmp, 'page.html')); await page.waitForFunction('window.ready');
  const ver = await page.evaluate((w, h, a) => window.init(w, h, a), W, H, aa);
  const frame = async (t) => { const b64 = await page.evaluate((t) => { window.world.render(t); const gl = window.gl, b = new Uint8Array(window.c.width * window.c.height * 4); gl.readPixels(0, 0, window.c.width, window.c.height, gl.RGBA, gl.UNSIGNED_BYTE, b);
      let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }, t); return Buffer.from(b64, 'base64'); };
  return { frame, ver, blocked, close: () => browser.close(), page };
}
if (process.argv[1].endsWith('render-chrome.mjs')) {
  const N = +(process.argv[2] ?? 6); const C = await openChrome(); console.log('GL', C.ver);
  const hs = [], ts = [];
  for (const pass of [0, 1]) for (let i = 0; i < N; i++) { const t = 3 * i / Math.max(1, N - 1), t0 = performance.now(), b = await C.frame(t), dt = performance.now() - t0; hs.push(crypto.createHash('sha1').update(b).digest('hex').slice(0, 10)); if (!pass) ts.push(dt); }
  console.log('chrome ms/frame', ts.map((x) => x.toFixed(0)).join(' '), '| determinista:', hs.slice(0, N).every((h, i) => h === hs[N + i]), hs.slice(0, N).join(','));
  await C.close();
}
