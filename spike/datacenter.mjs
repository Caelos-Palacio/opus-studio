// Shot "datacenter" (spike): 3D real (three + headless-gl, rasterizador software llvmpipe → reproducible sin GPU) + HUD 2D (node-canvas).
//   node spike/datacenter.mjs [fps=30]   → out/webgl/datacenter.mp4, out/webgl/contact.png
process.env.LIBGL_ALWAYS_SOFTWARE ??= '1'; process.env.GALLIUM_DRIVER ??= 'llvmpipe';
import fs from 'node:fs'; import { spawn } from 'node:child_process'; import canvasPkg from 'canvas';
const { createCanvas } = canvasPkg;
const { frameRGBA } = await import('./render-gl.mjs'); const { makeWorld, DURATION, ACC } = await import('./world.mjs');
const W = 1280, H = 720, FPS = +(process.argv[2] ?? 30), N = Math.round(DURATION * FPS);
const hex = (n) => '#' + n.toString(16).padStart(6, '0'), Y = hex(ACC.yellow), R = hex(ACC.red), MONO = '15px monospace';
const cv = createCanvas(W, H), ctx = cv.getContext('2d'), id = ctx.createImageData(W, H);
const fovW = (d) => 2 * d * Math.tan(34 * Math.PI / 360) * (W / H);   // ancho del campo a la distancia d (m)
const fmt = (m) => m >= 100 ? `${m.toFixed(0)} m` : m >= 10 ? `${m.toFixed(1)} m` : `${m.toFixed(2)} m`;
const grain = (x, y, f) => { let h = (x * 374761393 + y * 668265263 + f * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) & 255) / 255; };
let info; // distancia cámara → m (reutiliza la misma función que el mundo)
function hud(t, d) {
  const ink = 'rgba(235,232,225,0.9)', dim = 'rgba(235,232,225,0.38)';
  // regla log vertical derecha: 1 m (abajo) … 1 km (arriba); décadas con rótulo, 9 marcas internas log
  const X = W - 74, y0 = H - 70, y1 = 70, L = (m) => y0 + (y1 - y0) * (Math.log10(m) / 3);
  ctx.lineWidth = 1; ctx.font = '12px monospace'; ctx.textAlign = 'right';
  for (let dec = 0; dec <= 3; dec++) for (let k = 1; k < 10; k++) { const m = k * 10 ** dec; if (m > 1000) break; const y = L(m), big = k === 1;
    ctx.strokeStyle = big ? ink : dim; ctx.beginPath(); ctx.moveTo(X, y); ctx.lineTo(X + (big ? 18 : 8), y); ctx.stroke();
    if (big) { ctx.fillStyle = ink; ctx.fillText(m >= 1000 ? '1 km' : m + ' m', X - 8, y + 4); } }
  const fw = fovW(d), yy = L(Math.min(1000, Math.max(1, fw))); ctx.fillStyle = Y; ctx.beginPath(); ctx.moveTo(X - 4, yy); ctx.lineTo(X - 26, yy - 7); ctx.lineTo(X - 26, yy + 7); ctx.fill();
  ctx.fillRect(X, yy - 1, 26, 2);
  ctx.textAlign = 'left'; ctx.font = MONO; ctx.fillStyle = ink; ctx.fillText('FOV', 36, H - 62); ctx.font = 'bold 30px monospace'; ctx.fillStyle = Y; ctx.fillText(fmt(fw), 36, H - 30);
  ctx.font = '12px monospace'; ctx.fillStyle = dim; ctx.fillText(`ESCALA LOG10 ${Math.log10(fw).toFixed(2)}   t=${t.toFixed(2)}s`, 36, 40);
  ctx.fillStyle = R; ctx.fillRect(36, 52, 6, 6); ctx.fillStyle = dim; ctx.fillText('ALERTA', 48, 59);
}
export async function renderAll() {
  const { default: createGL } = await import('gl'); // el mundo ya lo crea render-gl; aquí solo usamos frameRGBA
  const world = { info: null };
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'medium', '-movflags', '+faststart', 'out/webgl/datacenter.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
  const tiles = [], t0 = performance.now(); let tr = 0;
  const dist = (t) => { const u = Math.min(1, t / DURATION), e = u * u * (3 - 2 * u); return 380 * Math.pow(7 / 380, e); };
  for (let f = 0; f < N; f++) {
    const t = f / FPS, a = performance.now(), px = frameRGBA(t); tr += performance.now() - a;
    for (let y = 0; y < H; y++) id.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);   // gl es bottom-up
    ctx.putImageData(id, 0, 0);
    // grade 2D del motor: viñeta + grano determinista por (x,y,frame)
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const d = dist(t); hud(t, d);
    if (f % Math.round(N / 6) === 0 || f === N - 1) { const c = createCanvas(320, 180); c.getContext('2d').drawImage(cv, 0, 0, 320, 180); tiles.push({ c, label: `t=${t.toFixed(2)}s  FOV ${fmt(fovW(d))}` }); }
    const out = Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer); if (!ff.stdin.write(out)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r));
  const tot = performance.now() - t0; console.log(`${N} frames: ${(tot / N).toFixed(0)} ms/frame total, ${(tr / N).toFixed(0)} ms 3D (gl+readPixels)`);
  const sh = createCanvas(3 * 320, 2 * 202), sx = sh.getContext('2d'); sx.fillStyle = '#111'; sx.fillRect(0, 0, sh.width, sh.height); sx.font = '13px monospace';
  tiles.slice(0, 6).forEach((tl, i) => { const X = (i % 3) * 320, Yy = Math.floor(i / 3) * 202; sx.drawImage(tl.c, X, Yy); sx.fillStyle = '#ddd'; sx.fillText(tl.label, X + 6, Yy + 196); });
  fs.writeFileSync('out/webgl/contact.png', sh.toBuffer('image/png'));
}
await renderAll();
