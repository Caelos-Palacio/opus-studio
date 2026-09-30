#!/usr/bin/env node
// Prueba de versatilidad: el MISMO timeline en cada style pack → lint por estilo + galería (out/gallery.png).
//   node engine/gallery.mjs [--profile reel]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import canvasPkg from 'canvas';
import { makeRenderer } from './render.mjs';
import { loadStyles, ROOT } from './film.mjs';
const { createCanvas } = canvasPkg;
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const profile = arg('--profile'), names = Object.keys(loadStyles()), TS = [1.4, 3.4, 5.4], tw = 384, th = 216, lab = 26;
const c = createCanvas(TS.length * tw + 200, names.length * (th + lab)), x = c.getContext('2d');
x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
let bad = 0;
for (const [row, name] of names.entries()) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'engine/lint.mjs'), '--style', name, ...(profile ? ['--profile', profile] : [])], { encoding: 'utf8', env: process.env });
  const verdict = r.status === 0 ? 'SHIP' : 'FIX'; if (r.status) bad++;
  console.log(`${name.padEnd(11)} ${verdict}`); const nw = (r.stdout.match(/^WARN/gm) || []).length; if (nw) console.log(`   (${nw} avisos)`); if (r.status) console.log(r.stdout.split('\n').filter((l) => /^FIX/.test(l)).map((l) => '   ' + l).join('\n'));
  const R = await makeRenderer({ size: `${tw * 2}x${th * 2}`, style: name, profile });
  TS.forEach((t, i) => { R.frame(t); x.drawImage(R.cv, i * tw, row * (th + lab), tw, th); });
  x.fillStyle = verdict === 'SHIP' ? '#8fd694' : '#f08080'; x.font = '15px monospace'; x.fillText(`${name}  ${verdict}`, 8, row * (th + lab) + th + 18);
  x.fillStyle = '#aaa'; x.font = '11px monospace'; const P = R.film.S.palette;
  Object.entries(P).forEach(([k, v], j) => { x.fillStyle = v; x.fillRect(TS.length * tw + 10 + j * 26, row * (th + lab) + 10, 22, 22); });
  x.fillStyle = '#888'; x.fillText(`${R.film.S.motion.ease} · ${R.film.S.grade.letterbox ? 'letterbox ' : ''}${R.film.S.grade.grain ? 'grano ' : ''}${R.film.S.rules.glow ? 'glow ' : ''}${R.film.S.rules.gradients ? 'degradado' : ''}`, TS.length * tw + 10, row * (th + lab) + 60);
}
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'out/gallery.png'), c.toBuffer('image/png'));
console.log(`\n→ out/gallery.png (${names.length} estilos, perfil ${profile ?? 'por estilo'})`);
process.exit(bad ? 1 : 0);
