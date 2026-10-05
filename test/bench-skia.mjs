#!/usr/bin/env node
// R5 — benchmark aislado: node-canvas (Cairo) vs @napi-rs/canvas (Skia) en las operaciones que dominan el perfil
// (docs/research/08-perfil.md). SOLO mide: no migra nada. @napi-rs/canvas no es dependencia del proyecto:
//   npm i --no-save @napi-rs/canvas && node test/bench-skia.mjs [--json out.json]      (OPUS_SKIA_DIR=<dir con node_modules> para otra ubicación)
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const cairo = require('canvas');
let skia; try { skia = require(process.env.OPUS_SKIA_DIR ? path.join(process.env.OPUS_SKIA_DIR, 'node_modules/@napi-rs/canvas') : '@napi-rs/canvas'); } catch (e) { console.error('falta @napi-rs/canvas: npm i --no-save @napi-rs/canvas'); process.exit(1); }
const W = 1280, H = 720, hr = process.hrtime.bigint.bind(process.hrtime);
// Skia difiere el rasterizado hasta leer: cada operación devuelve su ctx y se fuerza el volcado con un getImageData 1×1 (también en cairo, por igualdad).
const T = (f, k = 30) => { const g = () => { const c = f(); c?.getImageData?.(0, 0, 1, 1); }; for (let i = 0; i < 3; i++) g(); const a = hr(); for (let i = 0; i < k; i++) g(); return Number(hr() - a) / 1e6 / k; };
const FONT = '600 40px sans-serif';
function suite(lib, name) {
  const mk = (w, h) => lib.createCanvas(w, h), cv = mk(W, H), x = cv.getContext('2d');
  const scene = (c = cv) => { const q = c.getContext('2d'); q.setTransform(1, 0, 0, 1, 0, 0); q.globalAlpha = 1; q.globalCompositeOperation = 'source-over'; q.fillStyle = '#102'; q.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 300; i++) { q.fillStyle = `hsla(${(i * 37) % 360},70%,55%,0.${(i % 8) + 2})`; q.fillRect((i * 97) % c.width, (i * 53) % c.height, 80, 50); } };
  scene(); const half = mk(W / 2, H / 2), quarter = mk(W / 4, H / 4), hx = half.getContext('2d'), qx = quarter.getContext('2d'), R = {};
  R['drawImage ↓2× (blur chain step)'] = T(() => { hx.drawImage(cv, 0, 0, W / 2, H / 2); return hx; }, 200);
  R['drawImage ↓4× de golpe (bloom)'] = T(() => { qx.drawImage(cv, 0, 0, W / 4, H / 4); return qx; });
  const up = mk(W, H), ux = up.getContext('2d'); ux.globalCompositeOperation = 'lighter'; ux.globalAlpha = 0.7;
  R['drawImage ↑2× a 1280×720 lighter'] = T(() => { ux.drawImage(half, 0, 0, W, H); return ux; });
  R['drawImage ↑4× a 1280×720'] = T(() => { ux.drawImage(quarter, 0, 0, W, H); return ux; });
  R['drawImage 1:1 (capa compuesta)'] = T(() => { x.drawImage(up, 0, 0); return x; });
  R['gradiente radial pantalla completa'] = T(() => { const g = x.createRadialGradient(W / 2, H / 2, 250, W / 2, H / 2, 800); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)'); x.fillStyle = g; x.fillRect(0, 0, W, H); return x; });
  R['getImageData 1280×720'] = T(() => { x.getImageData(0, 0, W, H); });
  const im = x.getImageData(0, 0, W, H); R['putImageData 1280×720'] = T(() => { x.putImageData(im, 0, 0); return x; });
  R['toBuffer raw (a ffmpeg)'] = T(() => { if (name === 'cairo') cv.toBuffer('raw'); else x.getImageData(0, 0, W, H).data; });
  R['fillRect ×1100 (grano)'] = T(() => { x.fillStyle = 'rgba(255,255,255,.1)'; for (let i = 0; i < 1100; i++) x.fillRect((i * 97) % W, (i * 53) % H, 1.4, 1.4); return x; });
  // paths: 400 cúbicas rellenas+trazadas (glifos TeX, plots)
  const P = [...Array(400)].map((_, i) => [(i * 31) % W, (i * 17) % H]);
  R['paths: 400 curvas Bézier fill+stroke'] = T(() => { x.lineWidth = 2; x.strokeStyle = '#fc4'; x.fillStyle = 'rgba(80,160,255,.5)'; for (const [a, b] of P) { x.beginPath(); x.moveTo(a, b); x.bezierCurveTo(a + 60, b - 40, a + 90, b + 50, a + 140, b); x.lineTo(a + 100, b + 60); x.closePath(); x.fill(); x.stroke(); } return x; });
  const big = [...Array(40)].map((_, i) => Array.from({ length: 600 }, (_, j) => [200 + (j * 1.7), 360 + Math.sin(j / 15 + i) * (30 + i * 5)]));
  R['paths: 40 polilíneas × 600 pts (plots)'] = T(() => { x.lineWidth = 1.5; x.strokeStyle = '#8f8'; for (const pl of big) { x.beginPath(); pl.forEach(([a, b], j) => (j ? x.lineTo(a, b) : x.moveTo(a, b))); x.stroke(); } return x; });
  R['texto: fillText ×150 (40 px)'] = T(() => { x.font = FONT; x.fillStyle = '#fff'; for (let i = 0; i < 150; i++) x.fillText('Potencias z² + c ∂L/∂q', (i * 41) % 900, 40 + ((i * 29) % 650)); return x; });
  R['texto: measureText ×300'] = T(() => { x.font = FONT; for (let i = 0; i < 300; i++) x.measureText('Hamburgefonstiv ' + i); });
  // blur nativo de la librería (cairo no tiene ctx.filter) vs cadena del motor
  const chain = () => { let cur = cv, w = W, h = H; const cs = []; for (let i = 0; i < 4; i++) { w >>= 1; h >>= 1; const c = mk(w, h); c.getContext('2d').drawImage(cur, 0, 0, w, h); cs.push(c); cur = c; } for (let i = 2; i >= 0; i--) { const c = mk(cs[i].width, cs[i].height); c.getContext('2d').drawImage(cur, 0, 0, c.width, c.height); cur = c; } const o = mk(W, H); o.getContext('2d').drawImage(cur, 0, 0, W, H); return o.getContext('2d'); };
  R['blur r≈16: cadena del motor (↓×4 ↑×4)'] = T(chain, 10);
  const o = mk(W, H), ox = o.getContext('2d');
  R['blur r=16: ctx.filter nativo'] = (() => { try { ox.filter = 'blur(16px)'; if (ox.filter === 'none' || ox.filter === undefined) return null; const t = T(() => { ox.clearRect(0, 0, W, H); ox.drawImage(cv, 0, 0); return ox; }, 10); ox.filter = 'none'; return t; } catch { return null; } })();
  R['blur r=16 a ½ res nativo + subida'] = (() => { try { const hh = mk(W / 2, H / 2), q = hh.getContext('2d'); q.filter = 'blur(8px)'; if (q.filter === 'none' || q.filter === undefined) return null; return T(() => { q.clearRect(0, 0, W / 2, H / 2); q.drawImage(cv, 0, 0, W / 2, H / 2); x.drawImage(hh, 0, 0, W, H); return x; }, 10); } catch { return null; } })();
  return R;
}
const C = suite(cairo, 'cairo'), S = suite(skia, 'skia'), rows = Object.keys(C).map((k) => ({ op: k, cairo: C[k], skia: S[k], x: C[k] && S[k] ? C[k] / S[k] : null }));
const f = (v) => (v == null ? 'n/d' : v.toFixed(2).padStart(8));
console.log('| operación | node-canvas (cairo) ms | @napi-rs/canvas (skia) ms | speedup |\n|---|---:|---:|---:|');
for (const r of rows) console.log(`| ${r.op} | ${f(r.cairo)} | ${f(r.skia)} | ${r.x ? r.x.toFixed(1) + '×' : 'n/d'} |`);
console.log(`\nnode-canvas ${cairo.version} cairo ${cairo.cairoVersion} · @napi-rs/canvas ${skia.version ?? '?'} · node ${process.version}`);
const j = process.argv.indexOf('--json'); if (j > 0) fs.writeFileSync(process.argv[j + 1], JSON.stringify(rows));
