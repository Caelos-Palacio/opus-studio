#!/usr/bin/env node
// Spec 003 (BDD de MEDIOS): mide fotogramas reales de Mate v1 (sin medio) y de mate_papel (medio papel_crema).
// Rojo→verde: v1 debe FALLAR los criterios de medio; el film con medio debe cumplirlos.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';
import { hex2rgb } from '../engine/color.mjs';

let n = 0, bad = 0;
const ok = (c, m, info = '') => { n++; console.log(`${c ? '✓' : '✗'} medios: ${m}${info ? '  ' + info : ''}`); if (!c) bad++; };
const A = 'data/mate/timeline.json', B = 'data/mate_papel/timeline.json', TS = [6, 30, 55, 85], SIZE = '640x360';

async function load(tl) {
  process.env.OPUS_TIMELINE = tl; process.env.OPUS_LAYERS = 'none';
  const { makeRenderer } = await import('../engine/render.mjs');
  return makeRenderer({ size: SIZE });
}
const grab = (R, t) => { R.frame(t); const { width: w, height: h } = R.cv; return { w, h, d: R.ctx.getImageData(0, 0, w, h).data }; };
const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
// Bloques de 16 px; fondo = bloques cuya media está cerca de la mediana (no contienen contenido). low = desviación de las medias
// (luz, manchas, viñeta); hf = mediana de |Δ| entre vecinos (textura de alta frecuencia).
function bgMetrics({ w, h, d }) {
  const bs = 16, blocks = [];
  for (let by = 0; by + bs <= h; by += bs) for (let bx = 0; bx + bs <= w; bx += bs) {
    let s = 0, g = 0, c = 0;
    for (let y = 0; y < bs; y++) for (let x = 0; x < bs; x++) {
      const i = ((by + y) * w + bx + x) * 4, L = lum(d, i); s += L;
      if (x < bs - 1) { g += Math.abs(L - lum(d, i + 4)); c++; }
      if (y < bs - 1) { g += Math.abs(L - lum(d, i + w * 4)); c++; }
    }
    blocks.push({ m: s / (bs * bs), g: g / c });
  }
  const med = [...blocks].map((b) => b.m).sort((a, b) => a - b)[blocks.length >> 1];
  const bg = blocks.filter((b) => Math.abs(b.m - med) < 28);
  const mean = bg.reduce((a, b) => a + b.m, 0) / bg.length, low = Math.sqrt(bg.reduce((a, b) => a + (b.m - mean) ** 2, 0) / bg.length);
  const hf = bg.map((b) => b.g).sort((a, b) => a - b)[bg.length >> 1];
  return { low, hf, bg: bg.length };
}
const flat = (m) => m.low < 1.2 || m.hf < 1.5;   // umbral M1 (calibrado en test/medios con la medición de v1 y B; ver spec)

// ── M1/M6: fondo plano ──
const RA = await load(A), mA = TS.map((t) => bgMetrics(grab(RA, t)));
ok(mA.some((m) => flat(m)), 'M6 Mate v1 FALLA el criterio de fondo no plano', mA.map((m) => `low ${m.low.toFixed(2)} hf ${m.hf.toFixed(2)}`).join(' | '));
ok(!RA.film.medium && !RA.film._mx, 'M7 sin medio declarado: sin estado de medio en el film');
let RB = null, mB = [];
try { RB = await load(B); mB = TS.map((t) => bgMetrics(grab(RB, t))); } catch (e) { ok(false, `film con medio carga (${e.message.split('\n')[0]})`); }
if (RB) {
  ok(mB.every((m) => !flat(m)), 'M1 mate_papel: ningún fotograma con fondo plano', mB.map((m) => `low ${m.low.toFixed(2)} hf ${m.hf.toFixed(2)}`).join(' | '));
  const med = RB.film.medium;
  ok(!!med && med.name === 'papel_crema', 'film carga el medio declarado', med?.name ?? 'sin medio');
  // M2: paleta
  const acc = (med?.accents ?? []);
  ok(acc.length >= 1 && acc.length <= 2, 'M2 el medio declara 1–2 acentos', acc.join(' '));
  const hue = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dd = mx - mn; if (!dd) return 0; const hh = mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; return (hh * 60 + 360) % 360; };
  const ah = acc.map((c) => hue(...hex2rgb(c)));
  let sat = 0, near = 0;
  for (const t of TS) { const { d } = grab(RB, t); for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); if (mx > 40 && (mx - mn) / mx > 0.5) { sat++; const h = hue(d[i], d[i + 1], d[i + 2]); if (ah.some((a) => Math.min(Math.abs(h - a), 360 - Math.abs(h - a)) <= 40)) near++; } } }
  ok(sat > 200 && near / sat >= 0.92, 'M2 píxeles saturados ≥92 % en los acentos declarados', `${near}/${sat}`);
  // M3: grano animado en el parche de fondo (esquina sup-der, 60×40)
  const f0 = grab(RB, 30), f1 = grab(RB, 30 + 1 / 15); let dif = 0, cnt = 0;
  for (let y = 4; y < 44; y++) for (let x = f0.w - 64; x < f0.w - 4; x++) { const i = (y * f0.w + x) * 4; dif += Math.abs(lum(f0.d, i) - lum(f1.d, i)); cnt++; }
  ok(dif / cnt >= 0.8, 'M3 grano animado entre fotogramas contiguos', `Δ ${(dif / cnt).toFixed(2)}/255`);
  // M4: profundidad
  const { layerOffsets } = await import('../engine/medium.mjs');
  const offs = layerOffsets(med, { z: 1.06, x: 24, y: 10, r: 0, fx: 0.5, fy: 0.5 }, 1280, 720);
  const ds = new Set(offs.map((o) => o.dx.toFixed(2) + ',' + o.dy.toFixed(2) + ',' + o.s.toFixed(3)));
  ok(offs.length >= 2 && ds.size >= 2 && offs.every((o) => o.depth > 0), 'M4 ≥2 capas de parallax con desplazamiento distinto', `${offs.length} capas, ${ds.size} desplazamientos distintos`);
  // M5: una construcción por (medio, seed, tamaño)
  const { mediumStats } = await import('../engine/medium.mjs'), b0 = mediumStats.builds;
  for (const t of [1, 2, 3, 4, 5]) grab(RB, t);
  ok(mediumStats.builds === b0 && b0 >= 1, 'M5 texturas precalculadas una vez (5 fotogramas más: 0 construcciones nuevas)', `construcciones: ${b0}`);
}
// M8: esquema
const { validateTimeline } = await import('../engine/schema.mjs');
const tl = JSON.parse(fs.readFileSync(path.join(ROOT, A), 'utf8')); tl.medium = 'papel_crem';
const iss = validateTimeline(tl).filter((i) => i.level === 'FIX' && /medium/.test(i.problem));
ok(iss.length === 1 && /papel_crema/.test(iss[0].remedy ?? ''), 'M8 medium desconocido ⇒ FIX con sugerencia', iss[0]?.problem ?? 'sin FIX');
console.log(`${n - bad}/${n} medibles de medios`);
process.exit(bad ? 1 : 0);
