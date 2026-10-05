#!/usr/bin/env node
// Spec 004 (world3d): escenarios BDD como comprobaciones medibles. El 3D es una CAPA del compositor 2D, no un vídeo pegado.
//   node test/world3d.mjs [--update]      --update regenera el golden con tolerancia (test/golden/world3d/*.png)
// Sin gl/Mesa: las comprobaciones 3D se SALTAN con aviso (y se exige el FIX de lint); la guardia y los metadatos corren siempre.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, FONTS_CONF, copyRepo, rmrf, run } from './lib.mjs';

const argv = process.argv.slice(2), has = (k) => argv.includes(k);
const E = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
let n = 0, bad = 0; const skipped = [];
const ok = (c, m) => { n++; if (!c) { bad++; console.log('  ✗ world3d:', m); } else if (has('--v')) console.log('  ✓', m); };
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : String(x));

// ── worker: corre dentro de una copia del repo con el fixture (grade completo) ─────────────────────────────────────────
if (argv[0] === '--worker') {
  const root = argv[1], { makeRenderer } = await import(pathToFileURL(path.join(root, 'engine/render.mjs')).href);
  const M = await import(pathToFileURL(path.join(root, 'engine/world3d/metrics.mjs')).href);
  const R = await makeRenderer({}), Rn = await makeRenderer({ grade: false }), { W, H } = R, out = {};
  const px = (t, grade) => { const r = grade ? R : Rn; r.frame(t); return r.ctx.getImageData(0, 0, W, H).data; };
  // 1. grano: región 2D (izquierda) vs región 3D (derecha) de t=0.5 con el grade completo
  const g = px(0.5, true), rl = [W * 0.12, H * 0.3, W * 0.2, H * 0.4], rr = [W * 0.68, H * 0.3, W * 0.2, H * 0.4];
  out.noise2d = M.noiseStd(g, W, H, rl); out.noise3d = M.noiseStd(g, W, H, rr);
  // 2. la capa 3D recibe el post: la esfera (t=2) con grade vs sin grade (viñeta oscurece la esquina de la capa 3D)
  const a = new Uint8ClampedArray(px(2, true)), b = new Uint8ClampedArray(px(2, false));
  const lum = (d, x, y) => { const i = (y * W + x) * 4; return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; };
  out.cornerGraded = lum(a, 6, 6); out.cornerRaw = lum(b, 6, 6); out.diffPx = M.diffCount(a, b);
  out.layerSeen = R.film.world3d?.available ?? false;
  process.stdout.write(JSON.stringify(out)); process.exit(0);
}

// ── guardia: los shots no importan three/gl ni abren contextos GL (no necesita gl) ────────────────────────────────────
{
  const { scanSource } = await E('engine/guard.mjs');
  const wrap = (body, pre = '') => `${pre}\nexport default {\n  draw(ctx, t, u, shot, film, api) {\n    ${body}\n  },\n};\n`;
  const fixes = (src) => scanSource(src, 'X').filter((i) => i.level === 'FIX').map((i) => i.problem);
  ok(fixes(wrap('', "import * as THREE from 'three';")).some((p) => /import prohibido 'three'/.test(p)), 'import three → FIX');
  ok(fixes(wrap('', "import createGL from 'gl';")).some((p) => /import prohibido 'gl'/.test(p)), 'import gl → FIX');
  ok(fixes(wrap('', "import fs from 'node:fs';")).some((p) => /import prohibido 'node:fs'/.test(p)), 'import fs → FIX');
  ok(fixes(wrap("const c = film.canvas(8, 8).getContext('webgl'); c.createShader(35633);")).some((p) => /webgl|GL/i.test(p)), 'getContext(webgl) en un shot → FIX');
  ok(fixes(wrap('const g = new WebGLRenderingContext();')).some((p) => /WebGL/i.test(p)), 'WebGLRenderingContext → FIX');
  ok(!fixes(wrap("api.world3d({ id: 'x', objects: [{ shape: 'box', size: [1, 1, 1], color: 'accent' }] }, { t, u });")).length, 'api.world3d con escena declarada (datos) no da FIX');
  const sh = fs.readdirSync(path.join(ROOT, 'shots')).filter((f) => /^W_|^P03/.test(f));
  for (const f of sh) ok(!scanSource(fs.readFileSync(path.join(ROOT, 'shots', f), 'utf8'), f).filter((i) => i.level === 'FIX').length, `shots/${f} limpio para la guardia`);
}

// ── backend ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const { createWorld3d } = await E('engine/world3d/index.mjs'), M = await E('engine/world3d/metrics.mjs'), { resolveStyle } = await E('engine/styles.mjs');
const w3 = createWorld3d();
if (!w3.available) {
  console.log(`⚠ world3d: backend no disponible (${w3.reason}) — comprobaciones 3D saltadas. Instala 'gl' y Mesa (libEGL/libGL + llvmpipe).`);
  // sin 3D, un shot que lo usa debe dar FIX en lint (OPUS_W3D_DISABLE=1 lo simula aunque gl exista)
  const d = copyRepo({ fixture: path.join(ROOT, 'test/fixtures/world3d'), name: 'w3dfix' });
  try {
    const r = await run(['engine/lint.mjs', '--only', 'layout'], { cwd: d, env: { OPUS_TIMELINE: 'data/w3dfix.json' } });
    ok(/world3d no disponible/.test(r.stdout + r.stderr), 'sin gl/Mesa, un shot con world3d da FIX «world3d no disponible»');
  } finally { rmrf(d); }
  console.log(bad ? `✗ world3d: ${bad}/${n} comprobaciones fallan` : `✓ world3d: ${n} comprobaciones (3D saltado: sin gl/Mesa)`);
  process.exit(bad ? 1 : 0);
}

const style = (over = {}) => resolveStyle(JSON.parse(fs.readFileSync(path.join(ROOT, 'styles/cosmos.json'), 'utf8')), { styleOverrides: over });
const S0 = style(), PAL = Object.values(S0.palette), hexRGB = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const BG = hexRGB(S0.palette.paper), INK = hexRGB(S0.palette.ink), AZ = S0.light.az;
const SPH = (o = {}) => ({ id: 'sph', background: 'paper', fog: false, camera: { fov: 30, dist: 6, target: [0, 0, 0] }, objects: [{ shape: 'sphere', size: 1, pos: [0, 0, 0], color: 'accent', ...o }] });
const R = (scene, o = {}) => w3.render(scene, { size: [1280, 720], style: S0, t: 0, u: 0, fps: 30, k: 720 / 1080, cache: false, ...o });
const px = (im, x, y) => { const i = (y * im.width + x) * 4; return [im.data[i], im.data[i + 1], im.data[i + 2]]; };

// 1) sombreado toon: contorno con el grosor y color de tinta del estilo, bandas cuantizadas, sin dientes (AA)
{
  const W = 8, S = style({ world3d: { shading: 'toon', bands: 3, outline: { width: W, color: 'ink' } } }), k = 720 / 1080;
  const im = R(SPH(), { style: S }), y = 360;
  let x = 0; while (x < im.width && M.deltaE(px(im, x, y), BG) < 6) x++;           // 1.er píxel no-fondo desde la izquierda
  let run = 0, xi = x; for (; xi < im.width; xi++) { if (M.deltaE(px(im, xi, y), INK) < 28) run++; else if (run) break; }
  ok(Math.abs(run - W * k) <= 1.6, `contorno toon: ${run} px ≈ ${f2(W * k)} px del estilo (±1,6)`);
  const inkRun = [...Array(run)].map((_, i) => px(im, x + i, y)), de = Math.max(0, ...inkRun.map((c) => M.deltaE(c, INK)));
  ok(run > 0 && de < 28, `color de contorno = tinta del estilo (ΔE máx ${f2(de)} < 28)`);
  const cl = M.clusters(M.disc(im, 0.9), 4); ok(cl >= 3 && cl <= 4, `toon: bandas cuantizadas, ${cl} tonos en el disco (3 bandas)`);
  const soft = M.clusters(M.disc(R(SPH(), { style: style({ world3d: { shading: 'soft' } }) }), 0.9), 4);
  ok(soft >= cl + 2, `soft: degradado suave (${soft} tonos > toon ${cl}+2)`);
  const ink = R(SPH(), { style: style({ world3d: { shading: 'ink' } }) }), hatch = M.hatchEnergy(ink), flat = M.hatchEnergy(R(SPH(), { style: style({ world3d: { shading: 'toon' } }) }));
  ok(hatch > flat * 1.5, `ink: hatching en la zona de sombra (energía ${f2(hatch)} > toon ${f2(flat)}×1,5)`);
  // luz clave del estilo: el centroide de luminancia de la esfera apunta hacia S.light.az (el mismo az que usan glow/sombras 2D)
  const L = M.lightAngle(R(SPH(), { style: S0 }), 0.6), dA = Math.abs(((L - AZ + 540) % 360) - 180);
  ok(dA <= 35, `luz clave: la esfera se ilumina hacia ${f2(L)}° ≈ az del estilo ${AZ}° (Δ ${f2(dA)}° ≤ 35)`);
  const S2 = style({ light: { az: 45 } }), L2 = M.lightAngle(R(SPH(), { style: S2 }), 0.6), dB = Math.abs(((L2 - 45 + 540) % 360) - 180);
  ok(dB <= 35, `luz clave: cambiar S.light.az a 45° mueve la luz 3D (${f2(L2)}°, Δ ${f2(dB)}° ≤ 35)`);
}

// 2) AA: la escalera de un borde recto con SSAA 2× ≤ umbral (y SSAA 1 la deja a la vista: la métrica discrimina)
{
  const EDGE = { id: 'edge', background: 'paper', fog: false, camera: { fov: 30, dist: 8, target: [0, 0, 0] }, objects: [{ shape: 'plane', size: [30, 30], pos: [14, 0, 0], rot: [0, 0, 17], color: 'accent', mat: 'flat', outline: false }] };
  const a2 = M.stairRms(R(EDGE, { ssaa: 2 }), S0.palette.paper, S0.palette.accent), a1 = M.stairRms(R(EDGE, { ssaa: 1 }), S0.palette.paper, S0.palette.accent);
  ok(a2 <= 0.12, `AA SSAA 2×: escalera del borde ${f2(a2)} px ≤ 0,12`);
  ok(a1 >= 0.18 && a1 > a2 * 2, `sin AA (ssaa 1) la métrica ve la escalera: ${f2(a1)} px (> 2× ${f2(a2)})`);
}

// 3) paleta forzada: p95 de ΔE (Lab) de los píxeles 3D al color más cercano de la paleta del estilo
{
  const scene = { id: 'pal', background: 'paper', fog: { density: 0.05 }, camera: { fov: 34, dist: 14, el: 22, az: -20, target: [0, 1, 0] }, ground: { color: 'shade', contact: true },
    objects: [{ shape: 'box', size: [2, 2, 2], pos: [-2, 1, 0], color: 'accent'  }, { shape: 'sphere', size: 1.2, pos: [1.6, 1.2, 1], color: 'accent2'  }, { shape: 'cylinder', size: [0.8, 3], pos: [4, 1.5, -3], color: 'ink'  }] };
  const im = R(scene), p95 = M.paletteDeltaE(im, PAL, 0.95), off = M.paletteDeltaE(R(scene, { style: style({ world3d: { snap: 0 } }) }), PAL, 0.95);
  ok(p95 <= 16, `paleta: p95 ΔE al color de paleta más cercano = ${f2(p95)} ≤ 16`);
  ok(off > p95 + 3, `la cuantización a paleta es la que lo logra (sin ella p95 ΔE ${f2(off)} > ${f2(p95)}+3)`);
}

// 4) bordes con el 2D: niebla de profundidad hacia el fondo y sombra de contacto
{
  const two = (ground = { color: 'shade', contact: true }) => ({ id: 'two' + (ground ? (ground.contact ? 'c' : 'n') : 'x'), background: 'paper', fog: { density: 0.035 }, camera: { fov: 30, dist: 10, el: 12, az: 0, target: [0, 1, -10] }, ...(ground ? { ground } : {}),
    objects: [{ shape: 'box', size: [2, 2, 2], pos: [-1.6, 1, -6], color: 'accent', outline: false }, { shape: 'box', size: [2, 2, 2], pos: [1.6, 1, -36], color: 'accent', outline: false }] });
  const im = R(two(null)), near = M.objMean(im, [0, 0, 0.5, 1]), farC = M.objMean(im, [0.5, 0, 1, 1]);
  const dn = M.deltaE(near, BG), df = M.deltaE(farC, BG);
  ok(near && farC && df < dn * 0.6, `niebla: el cubo lejano se funde hacia el fondo (ΔE ${f2(df)} < 0,6 × cercano ${f2(dn)})`);
  const withC = R(two({ color: 'shade', contact: true })), without = R(two({ color: 'shade', contact: false })), ch = M.diffRegion(withC, without, 8);
  ok(ch.count >= 60, `sombra de contacto: ${ch.count} px oscurecidos junto a la base (≥ 60)`);
  ok(ch.darker >= 0.95, `la sombra solo oscurece (${f2(ch.darker * 100)} % de los píxeles que cambian son más oscuros)`);
  const edgeHalo = M.haloRing(R(two(null), { transparent: true }), S0.palette.paper);
  ok(edgeHalo <= 6, `sin halos de recorte: el borde de la capa con alfa tiene ΔE ${f2(edgeHalo)} ≤ 6 respecto al fondo`);
}

// 5) movimiento: step 2 (twos) y motion blur; determinismo; hash de fragmento
{
  const mv = { id: 'mv', background: 'paper', fog: false, camera: { fov: 30, dist: 6, target: [0, 0, 0] }, objects: [{ shape: 'box', size: [1.4, 1.4, 1.4], pos: [0, 0, 0], color: 'accent'  }] };
  const CAM = (tt) => ({ az: tt * 270, dist: 6, el: 15 }), at = (f, o = {}) => R(mv, { t: f / 30, cam: CAM, size: [320, 180], k: 180 / 1080, ...o });
  const eq = (a, b) => M.diffCount(a.data, b.data) === 0, F = [0, 1, 2, 3].map((f) => at(f, { step: 2 }));
  ok(eq(F[0], F[1]) && eq(F[2], F[3]) && !eq(F[1], F[2]), 'step 2: el 3D cambia solo cada 2 fotogramas (0=1, 2=3, 1≠2)');
  const G = [0, 1].map((f) => at(f));
  ok(!eq(G[0], G[1]), 'sin step el 3D cambia en cada fotograma');
  const a = at(4, { motionBlur: { samples: 4, shutter: 0.5 } }), b = at(4);
  ok(M.diffCount(a.data, b.data) > 50, 'motion blur 3D: el obturador mezcla subfotogramas (el fotograma difiere del nítido)');
  ok(eq(at(4, { motionBlur: { samples: 4, shutter: 0.5 } }), a), 'motion blur determinista');
  const w4 = createWorld3d(), c = w4.render(mv, { size: [320, 180], style: S0, t: 0.2, u: 0, fps: 30, k: 1 / 6, cam: CAM, cache: false }), d = w3.render(mv, { size: [320, 180], style: S0, t: 0.2, u: 0, fps: 30, k: 1 / 6, cam: CAM, cache: false });
  ok(eq(c, d) && eq(c, w3.render(mv, { size: [320, 180], style: S0, t: 0.2, u: 0, fps: 30, k: 1 / 6, cam: CAM })), 'determinismo: mismo t ⇒ fotograma idéntico bit a bit (dos instancias y con caché)');
  w4.dispose?.();
  const sig = w3.sig();
  ok(/headless-gl/.test(sig) && /three@0\.16[0-2]/.test(sig) && /mesa|llvmpipe/i.test(sig), `hash de fragmento incluye backend + three + Mesa («${sig.slice(0, 90)}»)`);
  const { world3dSig } = await E('engine/hash.mjs'); ok(typeof world3dSig === 'function' && world3dSig() === sig, 'engine/hash.mjs world3dSig() = firma del backend (entra en el hash de los fragmentos 3D)');
}

// 6) coste y golden con tolerancia (PSNR ≥ 40 dB); el golden 2D sigue bit a bit (test/golden.mjs)
{
  const { datacenterScene, datacenterCam } = await E('shots/W_datacenter.mjs'), SC = datacenterScene();
  const frame = (t) => R(SC, { t, cam: datacenterCam(t), motionBlur: null, size: [1280, 720], ssaa: 2 });
  frame(0.5); const ts = []; for (const t of [1.0, 1.8, 2.3, 2.7]) { const a = performance.now(); frame(t); ts.push(performance.now() - a); }
  const ms = ts.reduce((p, q) => p + q, 0) / ts.length, worst = Math.max(...ts);
  const os = await import('node:os'), busy = Math.min(1, os.loadavg()[0] / os.cpus().length), lim = 150 * Math.max(1, busy * 5);   // el reloj de pared miente con la máquina cargada (npm test corre 12 tareas a la vez)
  ok(ms <= lim && worst <= lim * 1.5, `coste: datacenter 1280×720 SSAA 2× (zoom medio/cercano, sin motion blur) = ${ms.toFixed(0)} ms/fotograma de media, ${worst.toFixed(0)} el peor (≤ ${lim.toFixed(0)} con carga ${busy.toFixed(2)}; 150 en reposo)`);
  const { createCanvas, loadImage } = (await import('canvas')).default;
  const dir = path.join(ROOT, 'test/golden/world3d'); fs.mkdirSync(dir, { recursive: true });
  const cases = [['datacenter', () => R(SC, { t: 1.5, cam: datacenterCam(1.5), size: [480, 270], k: 270 / 1080 })], ['esfera-toon', () => R(SPH(), { size: [320, 180], k: 180 / 1080, style: style({ world3d: { shading: 'toon', outline: { width: 8, color: 'ink' } } }) })]];
  for (const [name, mk] of cases) {
    const im = mk(), f = path.join(dir, name + '.png');
    if (has('--update') || !fs.existsSync(f)) { const c = createCanvas(im.width, im.height), x = c.getContext('2d'), id = x.createImageData(im.width, im.height); id.data.set(im.data); x.putImageData(id, 0, 0); fs.writeFileSync(f, c.toBuffer('image/png')); console.log(`  → golden ${name}.png ${has('--update') ? 'actualizado' : 'CREADO (revísalo y commitéalo)'}`); continue; }
    const g = await loadImage(f), c = createCanvas(g.width, g.height), x = c.getContext('2d'); x.drawImage(g, 0, 0); const gd = x.getImageData(0, 0, g.width, g.height).data;
    const p = M.psnr(im.data, gd); ok(g.width === im.width && p >= 40, `golden 3D «${name}»: PSNR ${f2(p)} dB ≥ 40`);
  }
}

// 7) integración en el compositor: grano/viñeta del estilo cubren la capa 3D igual que el 2D (grade completo del film)
{
  const d = copyRepo({ fixture: path.join(ROOT, 'test/fixtures/world3d'), name: 'w3dfix' });
  try {
    const r = await run([path.join(ROOT, 'test/world3d.mjs'), '--worker', d], { cwd: d, env: { OPUS_TIMELINE: 'data/w3dfix.json', FONTCONFIG_FILE: FONTS_CONF, OPUS_LAYERS: 'none' } });
    let o = null; try { o = JSON.parse(r.stdout); } catch { ok(false, 'worker del fixture falló: ' + (r.stderr || r.stdout).slice(-500)); }
    if (o) {
      const ratio = o.noise3d / Math.max(1e-6, o.noise2d);
      ok(o.layerSeen, 'film.world3d disponible dentro del film');
      ok(o.noise2d > 0.3, `el grano del estilo existe en el 2D (σ ${f2(o.noise2d)} > 0,3)`);
      ok(ratio >= 0.7 && ratio <= 1.4, `grano: espectro de ruido región 3D / región 2D = ${f2(ratio)} ∈ [0,7; 1,4]`);
      ok(o.cornerGraded < o.cornerRaw - 1 && o.diffPx > 1000, `la capa 3D pasa por el grade (viñeta): esquina ${f2(o.cornerRaw)} → ${f2(o.cornerGraded)}`);
    }
  } finally { rmrf(d); }
}

console.log(bad ? `✗ world3d: ${bad}/${n} comprobaciones fallan` : `✓ world3d: ${n} comprobaciones (${w3.sig().split(' ')[0]})`);
process.exit(bad ? 1 : 0);
