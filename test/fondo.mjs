#!/usr/bin/env node
// Spec 012 P6 (BDD del FONDO): la métrica fondo.profundidad y el check de lint fondo.vacio. El negro ELEGIDO por el tema (estrellas, niebla,
// viñeta, globo, parallax) pasa; el negro VACÍO (oscuro y sin profundidad medible) avisa; el soporte claro con textura pasa.
// Casos: (1) sintéticos de valor conocido, (2) fotogramas reales de films (test/fixtures/fondo/*.bin.gz; regenerar con make.mjs).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ROOT } from './lib.mjs';
import { FONDO, fondoSeries, veredicto } from '../engine/metrics/fondo.mjs';
import { REGISTRY } from '../engine/metrics/registry.mjs';

let n = 0, bad = 0;
const ok = (m, c, info = '') => { n++; console.log(`${c ? '✓' : '✗'} fondo: ${m}${info ? '  ' + info : ''}`); if (!c) bad++; };
const W = 192, H = 108, FPS = 4, PER = 8;

// ── generadores sintéticos (PRNG sembrado ⇒ reproducible) ──
let seed = 1; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
// base(x,y,k) → luma 0–255 (float); grain = σ del grano por fotograma (en 0–255); obj: caja con un objeto brillante (sujeto)
function film(seconds, { base, grain = 1.2, obj = true }) {
  const fr = [], box = { kind: 'focus', x: 80, y: 30, w: 32, h: 48 };
  for (let k = 0; k < seconds * FPS; k++) {
    const luma = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = base(x, y, k) + grain * gauss();
      if (obj && x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h) v = 230;
      luma[y * W + x] = Math.max(0, Math.min(255, Math.round(v)));
    }
    fr.push({ t: k / FPS, W, H, luma, boxes: obj ? [box] : [] });
  }
  return fr;
}
const stars = (() => { const s = new Map(); for (let i = 0; i < 160; i++) s.set(Math.floor(rnd() * H) * W + Math.floor(rnd() * W), 40 + rnd() * 140); return s; })();
const fog = (x, y, k) => 14 * (0.5 + 0.5 * Math.sin(x / 31 + k / 24) * Math.cos(y / 19 - k / 31));
const flat = () => 10, vign = (x, y) => 6 + 26 * (1 - Math.hypot((x - W / 2) / (W / 2), (y - H / 2) / (H / 2)) / 1.42);
const S = (fr) => fondoSeries(fr, { fps: FPS });

// ── 1. registro y documentación ──
{ const m = REGISTRY.find((x) => x.id === 'fondo.profundidad');
  ok('fondo.profundidad está en el registro con unidad, fórmula y umbral documentados', m && m.unit === '%' && /σ_esp/.test(m.formula) && /σ_grad/.test(m.formula) && /τ/.test(m.formula) && /fondo\.vacio/.test(m.formula) && m.typical && m.dim, m && m.id);
  ok('umbrales ordenados: empty < dark; warnFrac < fixFrac', FONDO.empty > 0 && FONDO.warnFrac < FONDO.fixFrac && FONDO.dark > 0);
  const spec = fs.readFileSync(path.join(ROOT, 'docs/specs/012-produccion-v2.md'), 'utf8');
  ok('spec 012: P6 es un escenario numerado con su test y P5 queda subsumido por P6', /^- P6 .*fondo\.vacio.*test\/fondo\.mjs/m.test(spec) && /^- P5 .*subsumid[oa] por P6/m.test(spec)); }

// ── 2. sintéticos de valor conocido ──
{ const E = S(film(12, { base: flat }));
  ok('negro plano con un objeto: P < umbral, oscuro, vacío en todo el film ⇒ FIX (es el film)', E.P < FONDO.empty && E.darkFrac === 1 && E.emptyFrac === 1 && veredicto(E) === 'FIX', `P=${E.P.toFixed(2)} vacío=${E.emptyFrac}`);
  const G = S(film(12, { base: flat, grain: 3 }));
  ok('el grano por fotograma NO es profundidad (σ=3/255 ≈ 1,2 %)', G.P < FONDO.empty && veredicto(G) === 'FIX', `P=${G.P.toFixed(2)}`);
  const St = S(film(12, { base: (x, y) => 8 + (stars.get(y * W + x) ?? 0) }));
  ok('oscuro con estrellas: pasa', St.darkFrac === 1 && St.P >= FONDO.empty && veredicto(St) === null, `P=${St.P.toFixed(2)}`);
  const V = S(film(12, { base: vign }));
  ok('oscuro con viñeta (gradiente): pasa', V.P >= FONDO.empty && veredicto(V) === null, `P=${V.P.toFixed(2)}`);
  const Fg = S(film(12, { base: (x, y, k) => 6 + fog(x, y, k) }));
  ok('oscuro con niebla que deriva: pasa', Fg.P >= FONDO.empty && veredicto(Fg) === null, `P=${Fg.P.toFixed(2)}`);
  const Br = S(film(12, { base: (x, y, k) => 8 + 5 * Math.sin(k * 0.9) }));
  ok('oscuro plano pero que respira (parpadeo temporal): pasa por τ', Br.P >= FONDO.empty && veredicto(Br) === null, `P=${Br.P.toFixed(2)}`);
  const Pa = S(film(12, { base: (x, y) => 215 + 7 * Math.sin(x * 0.7) * Math.sin(y * 0.9), grain: 2 }));
  ok('soporte claro con textura (papel): no es oscuro, pasa', Pa.darkFrac === 0 && Pa.emptyFrac === 0 && veredicto(Pa) === null);
  const Pl = S(film(12, { base: () => 215, grain: 0.5 }));
  ok('soporte claro liso: no es «fondo oscuro vacío» (otros checks lo juzgan): no avisa', Pl.darkFrac === 0 && veredicto(Pl) === null);
  const bright = film(12, { base: flat }); for (const f of bright) { f.boxes = [{ kind: 'focus', x: 0, y: 0, w: W, h: H }]; f.luma.fill(220); }
  ok('sin fondo visible (el sujeto ocupa todo): sin dato, no avisa', veredicto(S(bright)) === null && S(bright).wins.every((w) => w.nodata));
  // fracciones: 4 de 10 ventanas vacías ⇒ WARN; 2 de 10 ⇒ pasa; 8 de 10 ⇒ FIX
  const mix = (nEmpty) => { const fr = [], tot = 10; for (let w = 0; w < tot; w++) fr.push(...film(2, { base: w < nEmpty ? flat : (x, y) => 8 + (stars.get(y * W + x) ?? 0) }).map((f, i) => ({ ...f, t: (w * PER + i) / FPS }))); return S(fr); };
  ok('fracción vacía: 20 % pasa (calma suelta = dramaturgia)', veredicto(mix(2)) === null, `f=${mix(2).emptyFrac}`);
  ok('fracción vacía: 40 % ⇒ WARN', veredicto(mix(4)) === 'WARN', `f=${mix(4).emptyFrac}`);
  ok('fracción vacía: 80 % ⇒ FIX', veredicto(mix(8)) === 'FIX', `f=${mix(8).emptyFrac}`);
  ok('el sujeto no cuenta como profundidad: mover la caja no cambia P (±0,3)', Math.abs(S(film(12, { base: flat })).P - S(film(12, { base: flat, obj: false })).P) < 0.3); }

// ── 3. calibración con fotogramas reales (fixtures: luma 192 px, 4 fps, ventanas de 2 s; cajas del motor o estimadas) ──
function load(name) {
  const b = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, 'test/fixtures/fondo', name + '.bin.gz'))), nh = b.readUInt32LE(0), h = JSON.parse(b.subarray(4, 4 + nh));
  const fr = []; let o = 4 + nh; const sz = h.W * h.H;
  for (const w of h.wins) for (let k = 0; k < PER; k++) { fr.push({ t: w.t0 + k / h.fps, W: h.W, H: h.H, luma: b.subarray(o, o + sz), boxes: w.boxes[k] ?? [] }); o += sz; }
  return S(fr);
}
const real = Object.fromEntries(['potencias_v2', 'mate_papel', 'reel', 'regla', 'potencias_v1'].map((k) => [k, load(k)]));
const show = (k) => `P=${real[k].P.toFixed(2)} oscuro=${real[k].darkFrac.toFixed(2)} vacío=${real[k].emptyFrac.toFixed(2)}`;
ok('Potencias v2 (oscuro del tema: estrellas, galaxia, globo) NO avisa', veredicto(real.potencias_v2) === null && real.potencias_v2.darkFrac > 0.9, show('potencias_v2'));
ok('Mate papel (terracota) NO avisa', veredicto(real.mate_papel) === null && real.mate_papel.darkFrac === 0, show('mate_papel'));
ok('Reel neón (oscuro con luz y movimiento) NO avisa', veredicto(real.reel) === null, show('reel'));
ok('Regla pizarra NO avisa', veredicto(real.regla) === null && real.regla.darkFrac === 0, show('regla'));
ok('Potencias v1 (negro azulado casi vacío, muestreo cada 6 s) avisa al menos en parte', real.potencias_v1.emptyFrac >= FONDO.warnFrac && veredicto(real.potencias_v1) !== null, show('potencias_v1'));
ok('margen de calibración: P de los films buenos ≥ 1,5× el umbral; ninguno cae en la banda dudosa [0,8–1,2) salvo v1', ['potencias_v2', 'mate_papel', 'reel', 'regla'].every((k) => real[k].P >= 1.5 * FONDO.empty), ['potencias_v2', 'mate_papel', 'reel', 'regla'].map((k) => real[k].P.toFixed(2)).join(' '));

console.log(`\nfondo: ${n - bad}/${n}`);
process.exit(bad ? 1 : 0);
