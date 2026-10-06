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
  const sh = fs.readdirSync(path.join(ROOT, 'shots')).filter((f) => /^(W_|P03|P04).*\.mjs$/.test(f));
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
const V1 = { shadows: false, ao: 0, rim: false };                             // todo lo de v2 apagado = regresión a v1
const S0 = style(), V1S = style({ world3d: V1 }), PAL = Object.values(S0.palette), hexRGB = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
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
  const withC = R(two({ color: 'shade', contact: true }), { style: V1S }), without = R(two({ color: 'shade', contact: false }), { style: V1S }), ch = M.diffRegion(withC, without, 8);
  ok(ch.count >= 60, `sombra de contacto: ${ch.count} px oscurecidos junto a la base (≥ 60)`);
  ok(ch.darker >= 0.95, `la sombra solo oscurece (${f2(ch.darker * 100)} % de los píxeles que cambian son más oscuros)`);
  const edgeHalo = M.haloRing(R(two(null), { transparent: true, style: V1S }), S0.palette.paper);
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

const CUBE0 = () => ({ id: 'cubo0', background: 'paper', fog: false, camera: { fov: 30, dist: 14, el: 30, az: -20, target: [0, 0, 0] }, ground: { color: 'shade', contact: true }, objects: [{ shape: 'box', size: [2, 2, 2], pos: [0, 1, 0], color: 'accent' }, { shape: 'sphere', size: 0.8, pos: [3, 0.8, 1], color: 'accent2' }] });
// 6) coste y golden con tolerancia (PSNR ≥ 40 dB); el golden 2D sigue bit a bit (test/golden.mjs)
{
  const { datacenterScene, datacenterCam } = await E('shots/W_datacenter.mjs'), SC = datacenterScene();
  const frame = (t) => R(SC, { t, cam: datacenterCam(t), motionBlur: null, size: [1280, 720], ssaa: 2, style: style({ world3d: V1 }) });   // v1 (la medida v2 está en S7)
  frame(0.5); const ts = []; for (const t of [1.0, 1.8, 2.3, 2.7]) { const a = performance.now(); frame(t); ts.push(performance.now() - a); }
  const ms = ts.reduce((p, q) => p + q, 0) / ts.length, worst = Math.max(...ts);
  const os = await import('node:os'), busy = Math.min(1, os.loadavg()[0] / os.cpus().length), lim = 150 * Math.max(1, busy * 5);   // el reloj de pared miente con la máquina cargada (npm test corre 12 tareas a la vez)
  ok(ms <= lim && worst <= lim * 1.5, `coste: datacenter 1280×720 SSAA 2× (zoom medio/cercano, sin motion blur) = ${ms.toFixed(0)} ms/fotograma de media, ${worst.toFixed(0)} el peor (≤ ${lim.toFixed(0)} con carga ${busy.toFixed(2)}; 150 en reposo)`);
  const { createCanvas, loadImage } = (await import('canvas')).default;
  const dir = path.join(ROOT, 'test/golden/world3d'); fs.mkdirSync(dir, { recursive: true });
  const cases = [['datacenter', () => R(SC, { t: 1.5, cam: datacenterCam(1.5), size: [480, 270], k: 270 / 1080, style: style({ world3d: V1 }) })], ['esfera-toon', () => R(SPH(), { size: [320, 180], k: 180 / 1080, style: style({ world3d: { ...V1, shading: 'toon', outline: { width: 8, color: 'ink' } } }) })],
    ['datacenter-v2', () => R(SC, { t: 1.5, cam: datacenterCam(1.5), size: [480, 270], k: 270 / 1080 })], ['cubo-v2', () => R(CUBE0(), { size: [320, 180], k: 180 / 1080 })]];
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


// ══ world3d v2 (spec 009): sombras, AO, rim, bloom del post 2D, cámara desde el shot, parallax, niebla con degradado, vídeo ══════════
const GR = (o = {}) => ({ color: 'shade', contact: false, ...o });
const CUBE = (over = {}, ground = GR(), cam = {}) => ({ id: 'cube' + (ground ? (ground.catcher ? 'c' : 'g') : 'x'), background: 'paper', fog: false, camera: { fov: 30, dist: 14, el: 35, az: 0, target: [0, 0, 0], ...cam }, ...(ground ? { ground } : {}),
  objects: [{ shape: 'box', size: [2, 2, 2], pos: [0, 1, 0], color: 'accent', outline: false, ...over }] });
const mean = (im, f) => { let s = 0, n = 0; for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) if (f(x, y)) { const i = (y * im.width + x) * 4; s += 0.2126 * im.data[i] + 0.7152 * im.data[i + 1] + 0.0722 * im.data[i + 2]; n++; } return n ? s / n : 0; };
const lumAt = (im, x, y) => mean(im, (a, b) => a === x && b === y);

// S1 sombra proyectada: del lado opuesto a la luz (az 135° = arriba-izquierda ⇒ la sombra cae a la derecha), ≥ 12 % más oscura que el suelo libre
{
  const on = R(CUBE(), { style: style({ world3d: { shadows: true, ao: 0, rim: false } }) }), off = R(CUBE(), { style: style({ world3d: V1 }) });
  const d = M.diffRegion(on, off, 6); let sx = 0, nx = 0, a = 0, b = 0;
  for (let y = 0; y < on.height; y++) for (let x = 0; x < on.width; x++) { const i = (y * on.width + x) * 4, df = (0.7152 * (on.data[i + 1] - off.data[i + 1])); if (df < -3) { sx += x; nx++; a += on.data[i + 1]; b += off.data[i + 1]; } }
  ok(d.count >= 1500 && d.darker >= 0.97, `S1 sombra proyectada: ${d.count} px oscurecidos (≥ 1500), ${f2(d.darker * 100)} % solo oscurecen`);
  ok(nx > 0 && sx / nx > on.width / 2 + 20, `S1 la sombra cae del lado opuesto a la luz (centroide x = ${f2(sx / Math.max(1, nx))} > centro ${on.width / 2})`);
  ok(nx > 0 && a / b <= 0.88, `S1 bajo la sombra la luminancia (canal verde) es ${f2((a / b) * 100)} % del suelo libre (≤ 88 %)`);
  const toon = M.clusters([...Array(on.width * on.height).keys()].filter((i) => i % 3 === 0).map((i) => ({ c: [on.data[i * 4], on.data[i * 4 + 1], on.data[i * 4 + 2]] })), 4);
  ok(toon <= 6, `S1 en toon la sombra es de bandas (${toon} tonos en toda la imagen, sin degradado de PCF)`);
  const soft = R(CUBE(), { style: style({ world3d: { shading: 'soft', shadows: true } }) }), softOff = R(CUBE(), { style: style({ world3d: { shading: 'soft', ...V1 } }) });
  ok(M.diffRegion(soft, softOff, 6).count >= 1500, 'S1 también con shading soft (PCF suave)');
  // sombra proyectada al suelo 2D: ground.catcher ⇒ la capa con alfa solo lleva la sombra (alfa > 0 junto al cubo, 0 lejos)
  const c = R(CUBE({}, GR({ catcher: true })), { transparent: true, style: style({ world3d: { shadows: true, ao: 0, rim: false } }) });
  let aSh = 0, aFar = 0; for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const al = c.data[(y * c.width + x) * 4 + 3]; if (x < 40 && y > c.height - 40) aFar = Math.max(aFar, al); if (al > 60) aSh++; }
  ok(aSh >= 1500 && aFar === 0, `S1 sombra sobre el suelo 2D: la capa transparente tiene ${aSh} px de sombra (alfa > 60) y 0 lejos del objeto`);
  const g2d = [58, 65, 96];                                                    // suelo 2D (shade del estilo) sobre el que se compone; el cubo cubre su zona
  let dk = 0, nn = 0; for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4, al = c.data[i + 3] / 255; if (al > 0.3 && c.data[i] < 80) { const comp = g2d.map((v, k) => v * (1 - al) + c.data[i + k] * al); dk += (0.2126 * comp[0] + 0.7152 * comp[1] + 0.0722 * comp[2]) / (0.2126 * g2d[0] + 0.7152 * g2d[1] + 0.0722 * g2d[2]); nn++; } }
  ok(nn > 500 && dk / nn <= 0.88, `S1 compuesta sobre el suelo 2D oscurece al ${f2((dk / Math.max(1, nn)) * 100)} % (≤ 88 %)`);
}

// AO de contacto: la unión pared/suelo es más oscura que la pared a media altura; desactivable
{
  const row = (im, fy) => mean(im, (x, y) => Math.abs(x - im.width / 2) < 30 && Math.abs(y - im.height * fy) < 3);
  const sc = CUBE({}, GR(), { el: 12, dist: 12 });
  const a1 = R(sc, { style: style({ world3d: { shadows: false, ao: 0.7, rim: false } }) }), a0 = R(sc, { style: style({ world3d: V1 }) });
  const find = (im) => { let lo = -1, hi = -1; for (let y = 0; y < im.height; y++) if (M.deltaE([im.data[(y * im.width + im.width / 2) * 4], im.data[(y * im.width + im.width / 2) * 4 + 1], im.data[(y * im.width + im.width / 2) * 4 + 2]], hexRGB(S0.palette.shade)) > 12 && M.deltaE([im.data[(y * im.width + im.width / 2) * 4], im.data[(y * im.width + im.width / 2) * 4 + 1], im.data[(y * im.width + im.width / 2) * 4 + 2]], BG) > 12) { if (lo < 0) lo = y; hi = y; } return [lo, hi]; };
  const [lo, hi] = find(a0), h = hi - lo, fr = (im, f) => row(im, (lo + h * f) / im.height);
  const c1 = fr(a1, 0.5) - fr(a1, 0.94), c0 = fr(a0, 0.5) - fr(a0, 0.94);
  ok(h > 80 && c1 >= c0 + 6, `AO de contacto: la unión es ${f2(c1)} niveles más oscura que la pared (sin AO ${f2(c0)}; ≥ +6)`);
}

// rim: luz de borde del color de acento: separa el objeto del fondo aunque sean casi del mismo color
{
  const sc = { id: 'rim', background: 'paper', fog: false, camera: { fov: 30, dist: 6, target: [0, 0, 0] }, objects: [{ shape: 'sphere', size: 1, pos: [0, 0, 0], color: 'paper', outline: false }] };
  const edge = (im) => { const cx = im.width / 2, cy = im.height / 2, R0 = 0.631 * (im.height / 2); let mx = 0; for (let a = 0; a < 360; a += 5) for (const rr of [0.93, 0.96]) { const x = Math.round(cx + Math.cos(a * Math.PI / 180) * R0 * rr), y = Math.round(cy - Math.sin(a * Math.PI / 180) * R0 * rr), i = (y * im.width + x) * 4; mx = Math.max(mx, M.deltaE([im.data[i], im.data[i + 1], im.data[i + 2]], BG)); } return mx; };
  const on = edge(R(sc, { style: style({ world3d: { shadows: false, rim: { color: 'accent', strength: 0.9 } } }) })), off = edge(R(sc, { style: style({ world3d: V1 }) }));
  ok(on >= 15 && off < 8, `rim: ΔE objeto–fondo en el borde ${f2(on)} ≥ 15 (sin rim ${f2(off)})`);
}

// S2/S3 cámara desde el shot: horizonte y suelo proyectan donde dice el shot; reglas de ángulo por escala de plano
{
  const { resolveCameraInfo, angleCheck, ANGLE_RULES } = await E('engine/world3d/camera.mjs');
  const rowOf = (im, x, f) => { const r = []; for (let y = 0; y < im.height; y++) { const i = (y * im.width + x) * 4; if (f([im.data[i], im.data[i + 1], im.data[i + 2]])) r.push(y); } return r; };
  const AC = hexRGB(S0.palette.accent), INKc = hexRGB(S0.palette.ink);
  const sc = (cam) => ({ id: 'fs', background: 'paper', fog: false, camera: { fromShot: true, far: 1e6, near: 1, ...cam }, ground: { color: 'accent', size: 200000, contact: false, mat: 'flat' },
    objects: [{ shape: 'plane', size: [0.3, 0.3], pos: [0, 0.01, 0], rot: [-90, 0, 0], color: 'ink', mat: 'flat', outline: false }] });
  const fs = (cam, o = {}) => R(sc(cam), { size: [640, 360], k: 360 / 1080, groundFy: 0.78, style: style({ world3d: V1 }), ...o });
  const im = fs({ scale: 'PG', dist: 20, horizon: 0.3 }), H = im.height, info = im.info ?? {};
  const g = rowOf(im, 320, (c) => M.deltaE(c, INKc) < 25), gy = g.length ? g.reduce((p, q) => p + q, 0) / g.length : -99;
  ok(Math.abs(gy - 0.78 * H) <= 2, `S2 el plano y=0 cae en ${f2(gy)} px ≈ 0,78·H = ${f2(0.78 * H)} (±2)`);
  const hz = rowOf(im, 40, (c) => M.deltaE(c, AC) < 20), hy = hz.length ? hz[0] : -99;
  ok(Math.abs(hy - 0.3 * H) <= 2, `S2 horizonte proyectado en ${hy} px ≈ 0,30·H = ${f2(0.3 * H)} (±2)`);
  ok(Math.abs((info.horizonY ?? -9) * H - 0.3 * H) <= 0.5 && Math.abs((info.groundY ?? -9) - 0.78) < 1e-6, `S2 la capa informa horizonte ${f2(info.horizonY)} y suelo ${f2(info.groundY)} (el shot dibuja su 2D con ellos)`);
  const pg = fs({ scale: 'PG', dist: 20 }).info, pm = fs({ scale: 'PM', dist: 20 }).info, he = fs({ scale: 'PG', heroic: true, dist: 20 }).info;
  ok(pg.el >= 8 && pg.el <= 20 && pg.angle.ok, `S3 PG sin el ⇒ elevación resuelta ${f2(pg.el)}° ∈ [8°, 20°]`);
  ok(pm.el >= 5 && pm.el <= 15 && pm.angle.ok, `S3 PM sin el ⇒ ${f2(pm.el)}° ∈ [5°, 15°]`);
  ok(he.el >= -12 && he.el <= -4 && he.angle.ok, `S3 contrapicado heroico ⇒ ${f2(he.el)}° ∈ [−12°, −4°]`);
  const bad = fs({ scale: 'PG', el: 40, dist: 20 }).info;
  ok(!bad.angle.ok && /w3d\.angulo/.test(angleCheck(bad.angle)?.msg ?? ''), `S3 PG con el 40° sin override ⇒ aviso w3d.angulo (${angleCheck(bad.angle)?.msg ?? '—'})`);
  ok(fs({ scale: 'PG', el: 40, dist: 20, override: true }).info.angle.ok, 'S3 con override:true no hay aviso');
  ok(ANGLE_RULES.PG.range[0] === 8 && ANGLE_RULES.PM.range[1] === 15 && ANGLE_RULES.heroic.range[0] === -12, 'reglas de ángulo = spec 009 (PG [8,20], PM [5,15], heroico [−12,−4])');
  const f1 = resolveCameraInfo({ fromShot: true, scale: 'PG' }, { focal: 1.2, W: 1280, H: 720, groundFy: 0.7 }), f2_ = resolveCameraInfo({ fromShot: true, scale: 'PG' }, { focal: 2.4, W: 1280, H: 720, groundFy: 0.7 });
  ok(f1.fov > f2_.fov + 8 && Math.abs(f1.fov - 26.4) < 0.5, `fov ligado a la focal del estilo: focal 1,2 → ${f2(f1.fov)}°, focal 2,4 → ${f2(f2_.fov)}°`);
}

// S4 bloom: sale del post 2D (fx.bloom), no del backend; el emisivo 3D florece igual que un glow 2D del mismo color y radio
{
  const { createCanvas } = (await import('canvas')).default, fx = await E('engine/fx.mjs');
  const film = { canvas: (w, h) => createCanvas(w, h), P: {}, S: S0 }, Wc = 320, Hc = 180;
  const emi = { id: 'emi', background: 'paper', fog: false, camera: { fov: 30, dist: 6, target: [0, 0, 0] }, objects: [{ shape: 'sphere', size: 1, pos: [0, 0, 0], color: 'accent', mat: 'emissive', outline: false }] };
  const base = R(emi, { size: [Wc, Hc], k: Hc / 1080, style: S0 }), mask = R(emi, { size: [Wc, Hc], k: Hc / 1080, style: S0, pass: 'emissive' });
  const Rr = 0.631 * (Hc / 2), ring = (im, r0, r1) => { let mx = 0; for (let y = 0; y < Hc; y++) for (let x = 0; x < Wc; x++) { const r = Math.hypot(x - Wc / 2, y - Hc / 2); if (r > Rr * r0 && r < Rr * r1) { const i = (y * Wc + x) * 4; mx = Math.max(mx, M.deltaE([im.data[i], im.data[i + 1], im.data[i + 2]], BG)); } } return mx; };
  ok(ring(base, 1.15, 2.5) < 1.5, `S4 el backend no hace bloom propio (halo ΔE ${f2(ring(base, 1.15, 2.5))} < 1,5 fuera del objeto)`);
  const paint = (draw) => { const c = createCanvas(Wc, Hc), x = c.getContext('2d'); x.fillStyle = S0.palette.paper; x.fillRect(0, 0, Wc, Hc); draw(x); return c; };
  const c3 = paint((x) => { const id = x.createImageData(Wc, Hc); id.data.set(mask.data); x.putImageData(id, 0, 0); }), c2 = paint((x) => { x.fillStyle = S0.palette.accent; x.beginPath(); x.arc(Wc / 2, Hc / 2, Rr, 0, 7); x.fill(); });
  const out = (c) => { const o = createCanvas(Wc, Hc), x = o.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, Wc, Hc); fx.bloom(film, x, c, { threshold: 0.5, strength: 1, radius: 40 }); return x.getImageData(0, 0, Wc, Hc).data; };   // solo la contribución del bloom (sobre negro)
  const a = out(c3), b = out(c2); let s = 0, nn = 0, mx = 0; for (let y = 0; y < Hc; y++) for (let x = 0; x < Wc; x++) { const r = Math.hypot(x - Wc / 2, y - Hc / 2); if (r > Rr * 1.2 && r < Rr * 3) for (let k = 0; k < 3; k++) { const d = Math.abs(a[(y * Wc + x) * 4 + k] - b[(y * Wc + x) * 4 + k]); s += d; nn++; mx = Math.max(mx, d); } }
  ok(s / nn <= 2 && nn > 1000, `S4 bloom del post 2D sobre el emisivo 3D = glow 2D del mismo color/radio (Δ medio ${f2(s / nn)}/255 ≤ 2, máx ${mx})`);
  let halo = 0; for (let y = 0; y < Hc; y++) for (let x = 0; x < Wc; x++) { const r = Math.hypot(x - Wc / 2, y - Hc / 2); if (r > Rr * 1.3 && r < Rr * 1.8) halo = Math.max(halo, a[(y * Wc + x) * 4]); }
  ok(halo > 8, `S4 el bloom existe (halo ${halo}/255 junto al emisivo)`);
}

// S5 niebla con el degradado del fondo: el objeto lejano adopta el color del degradado a su altura
{
  const sc = (bg) => ({ id: 'grad', background: bg, fog: { density: 0.5 }, camera: { fov: 30, dist: 40, el: 0, target: [0, 0, 0] }, objects: [{ shape: 'box', size: [4, 6, 2], pos: [0, 0, -300], color: 'accent', outline: false }, { shape: 'box', size: [4, 6, 2], pos: [10, 6, -300], color: 'accent', outline: false }] });
  const col = (im, x, y) => { const i = (y * im.width + x) * 4; return [im.data[i], im.data[i + 1], im.data[i + 2]]; };
  const grad = { top: 'paper', bottom: 'accent2' };
  const im = R(sc(grad), { style: style({ world3d: V1 }), size: [640, 360], k: 1 / 3 }), W2 = im.width;
  let worst = 0; for (const y of [150, 180, 210]) { const inside = col(im, W2 / 2, y), beside = col(im, 20, y); worst = Math.max(worst, M.deltaE(inside, beside)); }
  const top = col(im, 20, 2), bot = col(im, 20, 357);
  ok(M.deltaE(top, hexRGB(S0.palette.paper)) < 3 && M.deltaE(bot, hexRGB(S0.palette.accent2)) < 3, `S5 el fondo es un degradado (${top} → ${bot})`);
  ok(worst <= 3, `S5 niebla = color del degradado a la altura del objeto (ΔE máx ${f2(worst)} ≤ 3)`);
  const flat = R(sc('paper'), { style: style({ world3d: V1 }), size: [640, 360], k: 1 / 3 }); ok(M.deltaE(col(flat, W2 / 2, 210), col(flat, 20, 210)) < 3, 'S5 con fondo plano la niebla sigue siendo plana (regresión)');
  const gd = R({ ...sc(grad), fog: false, objects: [{ shape: 'box', size: [4, 6, 2], pos: [0, 0, -300], color: 'accent', outline: false }] }, { style: style({ world3d: V1 }), size: [640, 360], k: 1 / 3 });
  ok(M.deltaE(col(gd, W2 / 2, 180), hexRGB(S0.palette.accent)) < 6, 'S5 sin niebla el objeto conserva su color (el degradado no lo contamina)');
}

// S6 parallax: la cámara 3D se desplaza con la misma ley que las capas 2D (depth d ⇒ cam.x·d)
{
  const sc = { id: 'par', background: 'paper', fog: false, camera: { fov: 30, dist: 10, target: [0, 0, 0], el: 0 }, objects: [
    { shape: 'box', size: [0.8, 0.8, 0.8], pos: [-1.2, 0, 0], color: 'accent', outline: false }, { shape: 'box', size: [1.6, 1.6, 1.6], pos: [3, 0, -10], color: 'accent2', outline: false }] };
  const cen = (im, c) => { let sx = 0, sy = 0, n = 0; for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) { const i = (y * im.width + x) * 4; if (M.deltaE([im.data[i], im.data[i + 1], im.data[i + 2]], c) < 12) { sx += x; sy += y; n++; } } return n ? [sx / n, sy / n] : [NaN, NaN]; };
  const at = (pan) => R(sc, { style: style({ world3d: V1 }), size: [640, 360], k: 1 / 3, unitH: 360, cam: { pan } });
  const a = at([0, 0]), b = at([40, 0]), A0 = cen(a, hexRGB(S0.palette.accent)), A1 = cen(b, hexRGB(S0.palette.accent)), B0 = cen(a, hexRGB(S0.palette.accent2)), B1 = cen(b, hexRGB(S0.palette.accent2));
  const sA = A1[0] - A0[0], sB = B1[0] - B0[0];
  ok(Math.abs(sA - 40) <= 2, `S6 plano del sujeto (d = 1): desplazamiento ${f2(sA)} px = cam.x (40) ±5 %`);
  ok(Math.abs(sB - 20) <= 1, `S6 objeto al doble de distancia (d = 0,5): ${f2(sB)} px = 0,5·cam.x (20) ±5 %`);
  ok(Math.abs(A1[1] - A0[1]) < 0.5 && Math.abs(B1[1] - B0[1]) < 0.5, 'S6 sin desplazamiento vertical espurio');
}

// S7 regresión: shadows/ao/rim apagados = v1 (golden v1) y no cuestan más; con ellos el coste ≤ 220 ms (1280×720, SSAA 2×)
{
  const { datacenterScene, datacenterCam } = await E('shots/W_datacenter.mjs'), SC = datacenterScene(), { createCanvas, loadImage } = (await import('canvas')).default, dir = path.join(ROOT, 'test/golden/world3d');
  const V1S = style({ world3d: V1 });
  const cmp = async (name, im) => { const g = await loadImage(path.join(dir, name + '.png')), c = createCanvas(g.width, g.height), x = c.getContext('2d'); x.drawImage(g, 0, 0); return M.psnr(im.data, x.getImageData(0, 0, g.width, g.height).data); };
  const p1 = await cmp('datacenter', R(SC, { t: 1.5, cam: datacenterCam(1.5), size: [480, 270], k: 270 / 1080, style: V1S })), p2 = await cmp('esfera-toon', R(SPH(), { size: [320, 180], k: 180 / 1080, style: style({ world3d: { ...V1, shading: 'toon', outline: { width: 8, color: 'ink' } } }) }));
  ok(p1 >= 40 && p2 >= 40, `S7 shadows:false (+ao/rim off) reproduce el golden v1: datacenter ${f2(p1)} dB, esfera ${f2(p2)} dB (≥ 40)`);
  const ms = (S, n = 4) => { const frame = (t) => R(SC, { t, cam: datacenterCam(t), motionBlur: null, size: [1280, 720], ssaa: 2, style: S }); frame(0.5); const ts = []; for (const t of [1.0, 1.8, 2.3, 2.7].slice(0, n)) { const a = performance.now(); frame(t); ts.push(performance.now() - a); } return [ts.reduce((p, q) => p + q, 0) / ts.length, Math.max(...ts)]; };
  const os = await import('node:os'), busy = Math.min(1, os.loadavg()[0] / os.cpus().length), k = Math.max(1, busy * 5);
  const [m1] = ms(V1S), [m2, w2] = ms(S0);
  console.log(`  · coste datacenter 1280×720 SSAA 2×: v1 ${m1.toFixed(0)} ms · v2 (sombras+AO+rim) ${m2.toFixed(0)} ms de media, ${w2.toFixed(0)} el peor`);
  ok(m1 <= 150 * k, `S7 shadows:false: coste v1 ${m1.toFixed(0)} ms ≤ ${(150 * k).toFixed(0)}`);
  ok(m2 <= 220 * k && w2 <= 220 * k * 1.4, `coste v2 con sombras + SSAA 2×: ${m2.toFixed(0)} ms de media, ${w2.toFixed(0)} el peor (≤ ${(220 * k).toFixed(0)}; 220 en reposo)`);
}

// S8 determinismo con sombras: dos instancias y con caché dan el mismo fotograma
{
  const sc = CUBE(), o = { size: [320, 180], k: 180 / 1080, t: 0.3, cache: false }, w4 = createWorld3d();
  const a = w3.render(sc, { ...o, style: S0 }), b = w4.render(sc, { ...o, style: S0 }), c = w3.render(sc, { ...o, style: S0 });
  ok(M.diffCount(a.data, b.data) === 0 && M.diffCount(a.data, c.data) === 0, 'S8 sombras: mismo t ⇒ fotograma idéntico (dos instancias, repetido)'); w4.dispose?.();
  ok(M.diffCount(R(sc, { size: [320, 180], k: 180 / 1080, style: S0 }).data, R(sc, { size: [320, 180], k: 180 / 1080, style: style({ world3d: V1 }) }).data) > 200, 'el estilo por defecto activa v2 (≠ v1)');
}

// S9 + lint: `npm run ab -- potencias w3d` entrega mp4 + hoja; el crítico (lint) avisa w3d.angulo
{
  const r = await run([path.join(ROOT, 'engine/ab.mjs'), 'potencias', 'w3d', '--plan'], { cwd: ROOT });
  ok(/out\/ab\/potencias-w3d\.mp4/.test(r.stdout) && /out\/ab\/potencias-w3d\.jpg/.test(r.stdout), `S9 ab potencias w3d planifica out/ab/potencias-w3d.mp4 + hoja (${(r.stdout.match(/→ .*/g) ?? []).join(' ')})`);
  const d = copyRepo({ fixture: path.join(ROOT, 'test/fixtures/world3d2'), name: 'w3dfix2' });
  try {
    const l = await run(['engine/lint.mjs', '--only', 'layout', '--fps', '6'], { cwd: d, env: { OPUS_TIMELINE: 'data/w3dfix2.json', FONTCONFIG_FILE: FONTS_CONF, OPUS_LAYERS: 'none' } });
    ok(/w3d\.angulo/.test(l.stdout + l.stderr), 'lint: aviso w3d.angulo cuando el ángulo está fuera de la regla sin override');
    ok(!/W2b.*w3d\.angulo|w3d\.angulo.*W2b/.test(l.stdout + l.stderr), 'lint: el shot con camera.override no avisa');
  } finally { rmrf(d); }
}

console.log(bad ? `✗ world3d: ${bad}/${n} comprobaciones fallan` : `✓ world3d: ${n} comprobaciones (${w3.sig().split(' ')[0]})`);
process.exit(bad ? 1 : 0);
