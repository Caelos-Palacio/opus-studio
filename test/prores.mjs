#!/usr/bin/env node
// F6 — ProRes 4444 con canal alfa: `cut --prores [--alpha] [--shot ID]` (docs/API.md «cut --prores», MOTOR.md).
// Fixture test/fixtures/alpha: un sujeto opaco en el centro sobre fondo vacío. Contrato: .mov ProRes con pix_fmt de alfa (yuva444p10le);
// (ffprobe informa yuva444p12le al decodificar prores_ks; en disco se codifica desde yuva444p10le.)
// con --alpha un píxel de fondo tiene alfa 0 y uno del sujeto alfa > 0 (y su color); sin --alpha todo es opaco; --shot recorta; con medio (kraft) el soporte también se va.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, FONTS_CONF, copyRepo, rmrf, run } from './lib.mjs';

const W = 320, H = 180, FPS = 12;
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('  ✗ prores:', m); } };
const probe = (f) => { const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,profile,pix_fmt,width,height,nb_read_frames', '-count_frames', '-of', 'json', f], { encoding: 'utf8' }); return JSON.parse(r.stdout).streams[0]; };
const audioCodec = (f) => spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim();
const frame = (f, i) => { const r = spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', `select=eq(n\\,${i})`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], { maxBuffer: 1 << 26 }); return r.stdout; };
const px = (b, x, y) => Array.from(b.subarray((y * W + x) * 4, (y * W + x) * 4 + 4));

const d = copyRepo({ fixture: path.join(ROOT, 'test/fixtures/alpha'), name: 'alpha' });
const base = { OPUS_TIMELINE: 'data/alpha.json', FONTCONFIG_FILE: FONTS_CONF };
const cut = (args, env = {}) => run(['engine/cut.mjs', ...args, '--fps', String(FPS), '--size', `${W}x${H}`, '--workers', '2', '--force', 'test F6: contrato del contenedor, no juzga el film'], { cwd: d, env: { ...base, ...env } });
try {
  // 1. --prores --alpha
  let r = await cut(['--prores', '--alpha']), f = path.join(d, 'out/alpha.alpha.mov');
  ok(r.status === 0 && fs.existsSync(f), 'cut --prores --alpha escribe out/alpha.alpha.mov ' + (r.stderr || r.stdout).slice(-300));
  if (fs.existsSync(f)) {
    const p = probe(f);
    ok(p.codec_name === 'prores' && /4444/.test(p.profile) && /^yuva444p(10|12)le$/.test(p.pix_fmt), `ProRes 4444 con alfa: ${p.codec_name}/${p.profile}/${p.pix_fmt}`);
    ok(+p.width === W && +p.height === H && +p.nb_read_frames >= 2 * FPS, `${p.width}×${p.height}, ${p.nb_read_frames} fotogramas`);
    ok(audioCodec(f) === 'pcm_s16le', 'audio PCM en el .mov (' + audioCodec(f) + ')');
    for (const i of [3, 18]) {                                                        // un fotograma de cada shot (círculo / cuadrado)
      const b = frame(f, i), corner = px(b, 3, 3), mid = px(b, W / 2, H / 2), side = px(b, W / 2 + 20, H / 2 - 10);
      ok(corner[3] === 0, `fotograma ${i}: píxel de fondo (esquina) alfa ${corner[3]} == 0`);
      ok(mid[3] > 200 && side[3] > 0, `fotograma ${i}: píxel del sujeto alfa ${mid[3]} > 0 (y borde interior ${side[3]})`);
      ok(mid[0] + mid[1] + mid[2] > 60, `fotograma ${i}: el sujeto conserva su color (${mid.slice(0, 3)}), no es negro premultiplicado`);
    }
  }
  // 2. --prores sin --alpha: contenedor con alfa, todo opaco (con fondo)
  r = await cut(['--prores']); f = path.join(d, 'out/alpha.prores.mov');
  ok(r.status === 0 && fs.existsSync(f), 'cut --prores escribe out/alpha.prores.mov');
  if (fs.existsSync(f)) { const b = frame(f, 3); ok(/^yuva444p/.test(probe(f).pix_fmt) && px(b, 3, 3)[3] === 255, `--prores sin --alpha: fondo opaco (esquina alfa ${px(b, 3, 3)[3]})`); }
  // 3. --shot AL2: solo ese shot (1 s) y audio recortado
  r = await cut(['--prores', '--alpha', '--shot', 'AL2']); f = path.join(d, 'out/alpha.AL2.alpha.mov');
  ok(r.status === 0 && fs.existsSync(f), 'cut --shot AL2 escribe out/alpha.AL2.alpha.mov ' + (r.stderr || r.stdout).slice(-200));
  if (fs.existsSync(f)) { const p = probe(f), b = frame(f, 3); ok(+p.nb_read_frames === FPS, `--shot: ${p.nb_read_frames} fotogramas (== ${FPS})`); ok(px(b, 3, 3)[3] === 0 && px(b, W / 2, H / 2)[3] > 200, '--shot: fondo transparente y sujeto opaco'); }
  // 4. con medio (kraft): soporte de papel y parallax fuera; el sujeto (tinta) queda
  r = await cut(['--prores', '--alpha'], { OPUS_MEDIUM: 'kraft' }); f = path.join(d, 'out/alpha.alpha.mov');
  if (ok(r.status === 0, 'cut --alpha con medio kraft ' + (r.stderr || r.stdout).slice(-300)), r.status === 0) { const b = frame(f, 3); ok(px(b, 3, 3)[3] === 0 && px(b, W / 2, H / 2)[3] > 100, `medio kraft: soporte fuera (esquina alfa ${px(b, 3, 3)[3]}), tinta del sujeto dentro (alfa ${px(b, W / 2, H / 2)[3]})`); }
  // 5. --alpha-grain: el grano del estilo solo cae sobre el sujeto; el fondo sigue transparente
  r = await cut(['--prores', '--alpha', '--alpha-grain'], { OPUS_MEDIUM: '' }); f = path.join(d, 'out/alpha.alpha.mov');
  if (ok(r.status === 0, 'cut --alpha --alpha-grain ' + (r.stderr || r.stdout).slice(-200)), r.status === 0) { const b = frame(f, 3); ok(px(b, 3, 3)[3] === 0 && px(b, W / 2, H / 2)[3] > 200, '--alpha-grain: fondo transparente, sujeto opaco'); }
  // 6. el master h264 no se mezcla: --shot sin --prores es un error claro
  r = await cut(['--shot', 'AL2']);
  ok(r.status !== 0 && /--shot solo con --prores/.test(r.stderr + r.stdout), '--shot sin --prores falla con mensaje claro');
} finally { rmrf(d); }
console.log(bad ? `✗ prores: ${bad}/${n} comprobaciones fallan` : `✓ prores: ${n} comprobaciones (ProRes 4444 + alfa)`);
process.exit(bad ? 1 : 0);
