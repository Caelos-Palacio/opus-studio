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

// ═══════ 003b — medios nuevos: kraft · pizarra · técnico · neón (+ compresión y variantes del acento) ═══════
const NEW = ['kraft', 'pizarra', 'tecnico', 'neon'], ALL = ['papel_crema', ...NEW];
const hueOf = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dd = mx - mn; if (!dd) return 0; const hh = mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; return (hh * 60 + 360) % 360; };
const hd = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const withMedium = async (tl, medium) => { const old = process.env.OPUS_MEDIUM; process.env.OPUS_MEDIUM = medium; try { return await load(tl); } finally { if (old === undefined) delete process.env.OPUS_MEDIUM; else process.env.OPUS_MEDIUM = old; } };
const meanRGB = ({ d }) => { let r = 0, g = 0, b = 0; const N = d.length / 4; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } return [r / N, g / N, b / N]; };
const meanLum = ({ d }, y0 = 0, y1 = null, w = null) => { let s = 0, c = 0; const W = w ?? 640, Hh = y1 ?? d.length / 4 / W; for (let y = y0; y < Hh; y++) for (let x = 0; x < W; x++) { s += lum(d, (y * W + x) * 4); c++; } return s / c; };
const RM = {}, means = {};
for (const nm of NEW) {
  let R = null;
  try { R = await withMedium(A, nm); RM[nm] = R; } catch (e) { ok(false, `${nm}: film con medio carga (${e.message.split('\n')[0]})`); continue; }
  const med = R.film.medium;
  ok(med?.name === nm, `${nm}: OPUS_MEDIUM carga el medio sobre cualquier film`, med?.name ?? 'sin medio');
  const fr = TS.map((t) => grab(R, t)), mm = fr.map(bgMetrics);
  ok(mm.every((m) => !flat(m)), `${nm}: M1 ningún fotograma con fondo plano`, mm.map((m) => `low ${m.low.toFixed(2)} hf ${m.hf.toFixed(2)}`).join(' | '));
  means[nm] = meanRGB(fr[1]);
  const acc = med?.accents ?? [], ah = acc.map((c) => hueOf(...hex2rgb(c))), bh = hueOf(...hex2rgb(med?.support?.base ?? '#808080'));
  ok(acc.length >= 1 && acc.length <= 2 && !!med?.palette?.ink && !!med?.palette?.paper, `${nm}: M2 1 neutro + 1–2 acentos declarados`, acc.join(' '));
  let sat = 0, near = 0;
  for (const f of fr) for (let i = 0; i < f.d.length; i += 4) { const mx = Math.max(f.d[i], f.d[i + 1], f.d[i + 2]), mn = Math.min(f.d[i], f.d[i + 1], f.d[i + 2]); if (mx > 40 && (mx - mn) / mx > 0.5) { sat++; const h = hueOf(f.d[i], f.d[i + 1], f.d[i + 2]); if ([...ah, bh].some((a) => hd(h, a) <= 40)) near++; } }
  ok(sat < 200 || near / sat >= 0.92, `${nm}: M2 píxeles saturados ≥92 % en acentos o en el tinte del soporte`, `${near}/${sat}`);
  const gfps = med?.grain?.fps ?? 15, g0 = grab(R, 30), g1 = grab(R, 30 + 1 / gfps); let dif = 0, cnt = 0;
  for (let y = 4; y < 44; y++) for (let x = g0.w - 64; x < g0.w - 4; x++) { const i = (y * g0.w + x) * 4; dif += Math.abs(lum(g0.d, i) - lum(g1.d, i)); cnt++; }
  ok(dif / cnt >= 0.8, `${nm}: M3 grano animado (a su cadencia ${gfps} fps)`, `Δ ${(dif / cnt).toFixed(2)}/255`);
  const { layerOffsets } = await import('../engine/medium.mjs');
  const offs = layerOffsets(med, { z: 1.06, x: 24, y: 10, r: 0, fx: 0.5, fy: 0.5 }, 1280, 720).filter((o) => o.depth > 0);
  ok(offs.length >= 2 && new Set(offs.map((o) => o.dx.toFixed(2) + o.s.toFixed(3))).size >= 2, `${nm}: M4 ≥2 capas de parallax distintas`, `${offs.length} capas`);
}
// Identidad propia (no variantes de color del papel): cada medio trae su soporte, su tinta y sus elementos de capa.
const kinds = (m) => new Set((m?.layers ?? []).flatMap((L) => Object.keys(L))), lumOf = (c) => 0.2126 * hex2rgb(c)[0] + 0.7152 * hex2rgb(c)[1] + 0.0722 * hex2rgb(c)[2];
const K = RM.kraft?.film.medium, P = RM.pizarra?.film.medium, T = RM.tecnico?.film.medium, N = RM.neon?.film.medium;
ok(!!K && K.accents.length === 1 && lumOf(K.palette.ink) < 60 && kinds(K).has('stamps') && K.support.fibers.len[1] >= 50, 'K1 kraft: tinta negra + 1 acento, sello/estampado y fibras gruesas', K ? `fibras ${K.support.fibers.len}` : 'sin medio');
ok(!!P && lumOf(P.palette.ink) > 180 && lumOf(P.palette.paper) < 90 && kinds(P).has('ghost') && kinds(P).has('smudge') && (P.ink.erosion?.amount ?? 0) >= 0.4 && !!P.ink.halo, 'K2 pizarra: tiza clara sobre fondo oscuro, borrado parcial, ghosting y polvo', P ? `erosión ${P.ink.erosion?.amount}` : 'sin medio');
ok(!!T && kinds(T).has('dims') && kinds(T).has('text') && !!T.support.decor?.grid && /mono/i.test(T.font ?? ''), 'K3 técnico: cuadrícula en el soporte, cotas y HUD mono', T ? [...kinds(T)].join(' ') : 'sin medio');
ok(!!N && N.blend === 'screen' && !!N.ink.flicker && !!N.ink.reflection && (kinds(N).has('haze') || kinds(N).has('bokeh')), 'K4 neón: luz aditiva con parpadeo, reflejo mojado y atmósfera', N ? [...kinds(N)].join(' ') : 'sin medio');
const names = Object.keys(means); let minD = 1e9, pair = '';
for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) { const d = means[names[i]].reduce((a, v, k) => a + Math.abs(v - means[names[j]][k]), 0); if (d < minD) { minD = d; pair = names[i] + '~' + names[j]; } }
const papelMean = meanRGB(grab(RB, 30)); for (const nm of names) { const d = means[nm].reduce((a, v, k) => a + Math.abs(v - papelMean[k]), 0); if (d < minD) { minD = d; pair = nm + '~papel'; } }
ok(names.length === 4 && minD >= 40, 'X1 los 5 medios son visualmente distintos (color medio del fondo, L1 ≥ 40/255)', `mín ${minD.toFixed(0)} (${pair})`);
{ // neón: nunca negro plano, parpadeo sutil, reflejo
  const R = RM.neon;
  if (R) {
    const f = grab(R, 30), ml = meanLum(f), bm = bgMetrics(f);
    ok(ml >= 6 && ml <= 70 && bm.hf >= 1.5, 'N1 neón: fondo oscuro CON textura y atmósfera (no negro plano)', `lum media ${ml.toFixed(1)}  hf ${bm.hf.toFixed(2)}`);
    const { flickerAt } = await import('../engine/medium.mjs'), fl = Array.from({ length: 90 }, (_, i) => flickerAt(R.film.medium, 30 + i / 30)), mu = fl.reduce((a, b) => a + b, 0) / fl.length, sd = Math.sqrt(fl.reduce((a, b) => a + (b - mu) ** 2, 0) / fl.length);
    ok(sd >= 0.004 && Math.min(...fl) >= 0.85 && Math.max(...fl) <= 1.0001, 'N2 parpadeo sutil (σ ≥ 0,4 %, caída ≤ 15 %)', `σ ${(sd * 100).toFixed(2)} %  mín ${Math.min(...fl).toFixed(3)}`);
    const dipT = 30 + fl.indexOf(Math.min(...fl)) / 30, a = grab(R, dipT), I = R.film.medium.ink, saved = I.flicker; I.flicker = null; const b = grab(R, dipT); I.flicker = saved;
    ok(meanLum(b) - meanLum(a) >= 0.05, 'N2b el parpadeo oscurece de verdad el fotograma', `Δ ${(meanLum(b) - meanLum(a)).toFixed(2)}`);
    const hz = Math.round(R.H * (R.film.medium.ink.reflection?.y ?? 0.8)), on = grab(R, 30), ref = I.reflection; I.reflection = null; const off = grab(R, 30); I.reflection = ref;
    ok(meanLum(on, hz) - meanLum(off, hz) >= 0.3 && Math.abs(meanLum(on, 0, hz) - meanLum(off, 0, hz)) < 0.02, 'N3 reflejo en superficie húmeda: más luz bajo el horizonte, nada encima', `Δ abajo ${(meanLum(on, hz) - meanLum(off, hz)).toFixed(2)}`);
  }
}
{ // técnico: la cuadrícula del soporte es periódica
  const R = RM.tecnico;
  if (R) {
    const { mediumState } = await import('../engine/medium.mjs'), st = mediumState(R.film, R.cv), W = R.w ?? R.cv.width, Hh = R.cv.height, im = st.support.getContext('2d').getImageData(0, 0, W, Hh).data, minor = (R.film.medium.support.decor?.grid?.minor ?? 16) * (W / 1280), s = new Float64Array(W);
    for (let x = 0; x < W; x++) { let a = 0; for (let y = 0; y < Hh; y++) a += lum(im, (y * W + x) * 4); s[x] = a / Hh; }
    const mu = s.reduce((a, b) => a + b, 0) / W; let v = 0; for (let x = 0; x < W; x++) { s[x] -= mu; v += s[x] ** 2; }
    const ac = (p) => { let a = 0; for (let x = 0; x + p < W; x++) a += s[x] * s[x + p]; return a / v; }, p = Math.round(minor);
    ok(ac(p) >= 0.25 && ac(p) > ac(Math.round(p / 2)) + 0.15, 'T1 técnico: cuadrícula periódica en el soporte (autocorrelación al paso)', `ac(${p}) ${ac(p).toFixed(2)} vs ac(${Math.round(p / 2)}) ${ac(Math.round(p / 2)).toFixed(2)}`);
  }
}
{ // OPUS_MEDIUM sobre el demo, y errores con sugerencia
  const D = 'data/timeline.json', R0 = await load(D);
  ok(!R0.film.medium && !R0.film._mx, 'M7b demo sin OPUS_MEDIUM: sin medio (golden intacto)');
  const Rk = await withMedium(D, 'kraft'), f = grab(Rk, 3);
  ok(Rk.film.medium?.name === 'kraft' && !flat(bgMetrics(f)), 'X2 el demo con medio kraft renderiza con fondo no plano', `low ${bgMetrics(f).low.toFixed(2)} hf ${bgMetrics(f).hf.toFixed(2)}`);
  let msg = ''; try { await withMedium(D, 'krat'); } catch (e) { msg = e.message; }
  ok(/kraft/.test(msg) && /krat/.test(msg), 'X3 OPUS_MEDIUM desconocido ⇒ error con sugerencia', msg.split('\n')[0].slice(0, 80));
}
// Compresión adaptada al medio: encode por medio, y el grano de papel_crema cabe en ≤3× v1.
{
  const encOk = ALL.every((nm) => { const e = JSON.parse(fs.readFileSync(path.join(ROOT, 'styles/medios', nm + '.json'), 'utf8')).encode; return e && e.crf >= 16 && e.crf <= 30 && ['grain', 'film', 'none', undefined].includes(e.tune); });
  ok(encOk, 'C1 todos los medios declaran encode {crf, tune} razonable', ALL.map((nm) => { const e = JSON.parse(fs.readFileSync(path.join(ROOT, 'styles/medios', nm + '.json'), 'utf8')).encode; return `${nm}:${e ? e.crf + (e.tune ? '/' + e.tune : '') : '—'}`; }).join(' '));
}
{ // C2: medido — mate_papel, 45 fotogramas a 640×360: encode del medio vs crf 16 por defecto
  const { x264Args } = await import('../engine/encode.mjs'), { spawnSync } = await import('node:child_process'), os = await import('node:os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opus-enc-')), raw = path.join(tmp, 'f.raw'), fd = fs.openSync(raw, 'w'), W = RB.cv.width, Hh = RB.cv.height, N = 45;
  for (let i = 0; i < N; i++) { RB.frame(30 + i / 30); fs.writeSync(fd, RB.cv.toBuffer('raw')); } fs.closeSync(fd);
  const enc = (name, o) => { const f = path.join(tmp, name + '.mp4'); spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', `${W}x${Hh}`, '-r', '30', '-i', raw, ...x264Args(o), f]); return f; };
  const gray = (args) => spawnSync('ffmpeg', ['-loglevel', 'error', ...args, '-pix_fmt', 'gray', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 29 }).stdout;
  const hpStd = (g) => { let s = 0, s2 = 0, c = 0; for (let f = 0; f < N; f++) for (let y = 6; y < 46; y++) for (let x = W - 66; x < W - 6; x++) { const i = f * W * Hh + y * W + x, v = g[i] - (g[i - 1] + g[i + 1] + g[i - W] + g[i + W]) / 4; s += v; s2 += v * v; c++; } return Math.sqrt(s2 / c - (s / c) ** 2); };
  const E = RB.film.medium.encode ?? {}, a = enc('base', { crf: 16 }), b = enc('medio', { crf: E.crf ?? 16, tune: E.tune }), sz = (f) => fs.statSync(f).size;
  const ref = hpStd(gray(['-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', `${W}x${Hh}`, '-r', '30', '-i', raw])), keep = hpStd(gray(['-i', b])) / ref;
  ok(sz(b) <= 0.4 * sz(a) && keep >= 0.7, 'C2 mate_papel: encode del medio ≤ 40 % del tamaño de crf 16 conservando ≥ 70 % del grano visible', `${(sz(b) / 1024).toFixed(0)} kB vs ${(sz(a) / 1024).toFixed(0)} kB (${((100 * sz(b)) / sz(a)).toFixed(0)} %), grano ${(keep * 100).toFixed(0)} %`);
  fs.rmSync(tmp, { recursive: true, force: true });
}
// Variantes del acento morado de mate_papel (para elegir; el film por defecto no cambia).
{
  const rd = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'styles/medios', n + '.json'), 'utf8')), base = rd('papel_crema');
  const hsv = (c) => { const [r, g, b] = hex2rgb(c), mx = Math.max(r, g, b), mn = Math.min(r, g, b); return { h: hueOf(r, g, b), s: mx ? (mx - mn) / mx : 0, v: mx / 255 }; };
  let a = null, b = null; try { a = rd('papel_crema_ciruela'); b = rd('papel_crema_terracota'); } catch (e) { ok(false, `V1 variantes del acento existen (${e.message.split(',')[0]})`); }
  if (a && b) {
    const same = (x) => JSON.stringify({ ...x, name: 0, description: 0, accents: 0, palette: 0 }) === JSON.stringify({ ...base, name: 0, description: 0, accents: 0, palette: 0 });
    ok(same(a) && same(b) && a.accents[0] === base.accents[0] && b.accents[0] === base.accents[0], 'V1 las 2 variantes solo cambian el acento (mismo soporte, tinta y capas; cobalto intacto)');
    const d = hsv(base.accents[1]), va = hsv(a.accents[1]), vb = hsv(b.accents[1]);
    ok(va.s < d.s - 0.1 && va.v < d.v - 0.05 && hd(va.h, d.h) <= 40, 'V2 variante A: violeta más profundo y menos saturado', `s ${d.s.toFixed(2)}→${va.s.toFixed(2)} v ${d.v.toFixed(2)}→${va.v.toFixed(2)}`);
    ok(hd(vb.h, 18) <= 25 && vb.s >= 0.5, 'V3 variante B: terracota (segundo tono cálido en lugar del violeta)', `matiz ${vb.h.toFixed(0)}°`);
    ok(base.accents[1] === '#6A2CB8' && JSON.parse(fs.readFileSync(path.join(ROOT, B), 'utf8')).medium === 'papel_crema', 'V4 el film por defecto (mate_papel) sigue con papel_crema y su violeta');
  }
}
// Hojas de contacto A/B por medio (herramienta tools/medios-sheets.mjs)
{
  const os = await import('node:os'), { spawnSync } = await import('node:child_process'), od = fs.mkdtempSync(path.join(os.tmpdir(), 'opus-sheets-'));
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/medios-sheets.mjs'), '--media', 'kraft', '--w', '200', '--outdir', od, '--no-compare'], { encoding: 'utf8', cwd: ROOT });
  const f = path.join(od, 'kraft.jpg');
  ok(r.status === 0 && fs.existsSync(f) && fs.statSync(f).size > 15000, 'H1 hoja A/B por medio (demo y Mate, sin medio | con medio)', r.status === 0 ? (fs.existsSync(f) ? fs.statSync(f).size + ' B' : 'sin archivo') : (r.stderr || r.stdout).split('\n').slice(-2)[0]);
  fs.rmSync(od, { recursive: true, force: true });
}

console.log(`${n - bad}/${n} medibles de medios`);
process.exit(bad ? 1 : 0);
