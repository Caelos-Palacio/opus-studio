#!/usr/bin/env node
// Genera una fixture de fondo (spec 012 P6) de un film REAL: ventanas de 2 s a 4 fps, 192 px, con gradación, luma 0–255 + cajas.
//   OPUS_TIMELINE=data/reel/timeline.json node test/fixtures/fondo/make.mjs reel 3,13,25,40,55      → test/fixtures/fondo/reel.bin.gz
//   node test/fixtures/fondo/make.mjs --mp4 ruta.mp4 potencias_v1 0,3,6,9                            → idem desde un mp4 (cajas estimadas por brillo)
// Formato (.bin.gz): uint32 LE n · JSON {W,H,fps,wins:[{t0,boxes:[[caja…]×8]}]} (n bytes) · luma W·H por fotograma, en orden.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
const argv = process.argv.slice(2), mp4i = argv.indexOf('--mp4'), mp4 = mp4i >= 0 ? argv.splice(mp4i, 2)[1] : null;
// Un mp4 no guarda las cajas del motor: se estiman. Celda de 8 px «objeto» si su máximo supera la mediana del fotograma en > 40/255
// (≈ 16 % de escala): figuras, texto, puntos brillantes, marcos. Componentes conexas (8-vecinos) → una caja 'focus' cada una.
function objectBoxes(y) {
  const B = 8, cw = W / B, ch = H / B, med = [...y].sort((a, b) => a - b)[y.length >> 1], on = new Uint8Array(cw * ch);
  for (let i = 0; i < y.length; i++) if (y[i] > med + 40) on[((Math.floor(i / W) / B) | 0) * cw + (((i % W) / B) | 0)] = 1;
  const seen = new Uint8Array(cw * ch), out = [];
  for (let c = 0; c < cw * ch; c++) if (on[c] && !seen[c]) {
    const st = [c]; seen[c] = 1; let x0 = cw, x1 = 0, y0 = ch, y1 = 0;
    while (st.length) { const k = st.pop(), x = k % cw, yy = (k / cw) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, yy); y1 = Math.max(y1, yy);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = yy + dy; if (nx >= 0 && nx < cw && ny >= 0 && ny < ch && on[ny * cw + nx] && !seen[ny * cw + nx]) { seen[ny * cw + nx] = 1; st.push(ny * cw + nx); } } }
    out.push({ kind: 'focus', x: x0 * B, y: y0 * B, w: (x1 - x0 + 1) * B, h: (y1 - y0 + 1) * B });
  }
  return out;
}
const [name, starts] = argv, ts = starts.split(',').map(Number), W = 192, fps = 4, per = 8;
const out = path.join(path.dirname(new URL(import.meta.url).pathname), name + '.bin.gz'), wins = [], bufs = []; let H = 108;
if (mp4) {
  for (const t0 of ts) {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(t0), '-t', '2', '-i', mp4, '-vf', `fps=${fps},scale=${W}:${H}`, '-pix_fmt', 'gray', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 26 });
    if (r.status || r.stdout.length !== W * H * per) throw new Error(`ffmpeg ${t0}: ${r.stdout.length} bytes ${r.stderr}`);
    wins.push({ t0, boxes: Array.from({ length: per }, (_, k) => objectBoxes(r.stdout.subarray(k * W * H, (k + 1) * W * H))) }); bufs.push(r.stdout);
  }
} else {
  const { makeRenderer } = await import('../../../engine/render.mjs'), { frameCache } = await import('../../../engine/framecache.mjs'), { loadFilm } = await import('../../../engine/film.mjs');
  const film = await loadFilm({}); H = Math.round((W * film.height) / film.width / 2) * 2;
  const FC = frameCache({ film, size: `${W}x${H}`, grade: true, make: () => makeRenderer({ size: `${W}x${H}`, grade: true }) });
  for (const t0 of ts) {
    const boxes = [], luma = Buffer.alloc(W * H * per);
    for (let k = 0; k < per; k++) {
      const F = await FC.get(t0 + k / fps, { px: true });
      boxes.push([...F.boxes].map((b) => ({ kind: b.kind, x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.w.toFixed(1), h: +b.h.toFixed(1) })));
      for (let i = 0; i < W * H; i++) luma[k * W * H + i] = Math.round(0.2126 * F.data[i * 4] + 0.7152 * F.data[i * 4 + 1] + 0.0722 * F.data[i * 4 + 2]);
    }
    wins.push({ t0, boxes }); bufs.push(luma);
  }
}
const head = Buffer.from(JSON.stringify({ W, H, fps, wins })), len = Buffer.alloc(4); len.writeUInt32LE(head.length);
fs.writeFileSync(out, zlib.gzipSync(Buffer.concat([len, head, ...bufs]), { level: 9 }));
console.log(out, fs.statSync(out).size, 'bytes');
process.exit(0);
