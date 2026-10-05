// Opción (a): headless-gl + three en Node. node spike/render-gl.mjs [frames] [W] [H]
import createGL from 'gl'; import * as THREE from 'three'; import fs from 'node:fs'; import crypto from 'node:crypto';
import { makeWorld, DURATION } from './world.mjs';
const W = +(process.argv[4] ?? 1280), H = +(process.argv[5] ?? 720), N = +(process.argv[3] ?? 6);
const gl = createGL(W, H, { preserveDrawingBuffer: true, antialias: false, alpha: false });
const canvas = { width: W, height: H, style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => gl, clientWidth: W, clientHeight: H };
const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: false });
const world = makeWorld(THREE, renderer, W, H);
const buf = new Uint8Array(W * H * 4);
export function frameRGBA(t) { world.render(t); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf); return buf; }
if (process.argv[1].endsWith('render-gl.mjs')) {
  const hs = [], ts = [];
  for (const pass of [0, 1]) for (let i = 0; i < N; i++) {
    const t = DURATION * i / Math.max(1, N - 1), t0 = performance.now(); frameRGBA(t); const dt = performance.now() - t0;
    const h = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10); if (pass) hs.push(h); else { hs.push(h); ts.push(dt); }
  }
  const a = hs.slice(0, N), b = hs.slice(N);
  console.log('gl ms/frame', ts.map((x) => x.toFixed(0)).join(' '), '| determinista:', a.every((h, i) => h === b[i]), a.join(','));
}
