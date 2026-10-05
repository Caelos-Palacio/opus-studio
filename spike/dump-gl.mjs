import { frameRGBA } from './render-gl.mjs'; import canvasPkg from 'canvas'; import fs from 'node:fs';
const { createCanvas } = canvasPkg; const W=1280,H=720;
for (const t of [0,1.5,3]) { const b = frameRGBA(t); const c = createCanvas(W,H), x=c.getContext('2d'), id=x.createImageData(W,H);
 for (let y=0;y<H;y++) id.data.set(b.subarray((H-1-y)*W*4,(H-y)*W*4), y*W*4); x.putImageData(id,0,0); fs.writeFileSync(`out/webgl/gl_${t}.png`, c.toBuffer('image/png')); }
