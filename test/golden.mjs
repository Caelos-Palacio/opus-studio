#!/usr/bin/env node
// Golden tests de píxel: fotogramas in/mid/out de cada shot del demo (data/timeline.json) y del fixture showcase.
//   node test/golden.mjs            compara con test/golden/<film>.json (+ miniaturas PNG 160×90)
//   node test/golden.mjs --update   regenera los golden (revisa las miniaturas en el diff antes de commitear)
//   [--only demo|fixture] [--no-selftest]
// Digest por fotograma: sha256 de los píxeles a tamaño completo (exacto) + miniatura RGB 160×90 por media de bloques 8×8.
//   · Misma plataforma (huella = versiones de canvas/cairo/pango/freetype + métrica de fuentes): el motor es determinista,
//     así que se exige igualdad BIT A BIT (un píxel distinto = fallo). La miniatura solo sirve para localizar el cambio.
//   · Plataforma distinta: comparación perceptual con tolerancia (Δmax por celda y Δ medio; OPUS_GOLDEN_TOL="max,media").
//     En este modo un píxel aislado (Δ≈3 en la miniatura) NO se detecta; un desplazamiento de 1 px de un borde sí.
// Fuentes herméticas: el render corre con FONTCONFIG_FILE=test/golden/fonts.conf (solo DejaVu), así el texto no depende
// de qué "Helvetica" tenga cada máquina.
import { isMain } from '../engine/paths.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ROOT, FONTS_CONF, copyRepo, rmrf, run } from './lib.mjs';

const argv = process.argv.slice(2), has = (k) => argv.includes(k), arg = (k) => (has(k) ? argv[argv.indexOf(k) + 1] : null);
const GDIR = path.join(ROOT, 'test/golden'), GW = 160;
const [TOL_MAX, TOL_MEAN] = (process.env.OPUS_GOLDEN_TOL ?? '3,0.2').split(',').map(Number);
export const FILMS = [
  { name: 'demo', timeline: 'data/timeline.json' },
  { name: 'fixture', timeline: 'data/fixture.json', fixture: path.join(ROOT, 'test/fixtures/showcase') },
];
const ENV = { FONTCONFIG_FILE: FONTS_CONF, OPUS_LAYERS: 'none' };   // golden = película base: las capas de contenido (data/layers/*, p.ej. memoria) no deben mover el golden del motor

// ── worker: corre DENTRO de la copia (root) y escribe el digest JSON en stdout ─────────────────────────────────────
async function worker(root) {
  const canvas = (await import('canvas')).default;
  const { makeRenderer } = await import(pathToFileURL(path.join(root, 'engine/render.mjs')).href);
  const R = await makeRenderer({}), { film, W, H, ctx } = R, fps = film.fps, GH = Math.round((GW * H) / W), last = Math.round(film.duration * fps);
  const tf = film.typeface, probe = ctx.canvas.getContext('2d');
  const fonts = [tf.family, tf.fallback, 'monospace'].filter(Boolean).map((f) => { probe.font = `600 40px ${f}`; return probe.measureText('Hamburgefonstiv 0123 q̇').width.toFixed(3); });
  const fingerprint = { canvas: canvas.version, cairo: canvas.cairoVersion, pango: canvas.pangoVersion, freetype: canvas.freetypeVersion, platform: `${process.platform}-${process.arch}`, fonts: fonts.join(' ') };
  const frames = [];
  for (const s of film.shots) {
    const fin = Math.round(s.t[0] * fps), fout = Math.max(fin, Math.round(s.t[1] * fps) - 1);
    for (const [at, f] of [['in', fin], ['mid', Math.round((fin + fout) / 2)], ['out', fout]]) {
      const t = Math.min(f, last) / fps; R.frame(t);
      const px = ctx.getImageData(0, 0, W, H).data, th = Buffer.alloc(GW * GH * 3);
      for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
        const x0 = Math.floor((i * W) / GW), x1 = Math.floor(((i + 1) * W) / GW), y0 = Math.floor((j * H) / GH), y1 = Math.floor(((j + 1) * H) / GH), acc = [0, 0, 0];
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const k = (y * W + x) * 4; acc[0] += px[k]; acc[1] += px[k + 1]; acc[2] += px[k + 2]; }
        const n = (x1 - x0) * (y1 - y0); for (let c = 0; c < 3; c++) th[(j * GW + i) * 3 + c] = Math.round(acc[c] / n);
      }
      frames.push({ shot: s.id, at, t: +t.toFixed(6), sha: crypto.createHash('sha256').update(px).digest('hex').slice(0, 20), thumb: th.toString('base64') });
    }
  }
  process.stdout.write(JSON.stringify({ size: [W, H], grid: [GW, GH], fingerprint, frames }));
}

// ── digest de un film (en ROOT para el demo; en copia temporal para fixture/mutaciones) ────────────────────────────
export async function digest(F, { root = null, mutate = null } = {}) {
  const own = !root && (F.fixture || mutate), dir = root ?? (own ? copyRepo({ fixture: F.fixture, name: path.basename(F.timeline, '.json') }) : ROOT);
  try {
    if (mutate) for (const [file, edit] of Object.entries(mutate)) { const p = path.join(dir, file), a = fs.readFileSync(p, 'utf8'), b = edit(a); if (a === b) throw new Error(`mutación no aplicada en ${file}`); fs.writeFileSync(p, b); }
    const env = { ...ENV, OPUS_TIMELINE: F.timeline };
    if (F.fixture) { const a = await run(['engine/autocam.mjs'], { cwd: dir, env }); if (a.status) throw new Error('autocam falló: ' + a.stderr.slice(-400)); }
    const r = await run([path.join(ROOT, 'test/golden.mjs'), '--worker', dir], { cwd: dir, env });
    if (r.status) throw new Error(`render falló (${F.name}): ${r.stderr.slice(-600)}`);
    return JSON.parse(r.stdout);
  } finally { if (own) rmrf(dir); }
}

// ── golden en disco: JSON (huella + sha) + miniaturas PNG ──────────────────────────────────────────────────────────
async function png() { return (await import('canvas')).default; }
export async function save(name, D) {
  const { createCanvas } = await png(), [gw, gh] = D.grid, dir = path.join(GDIR, name);
  rmrf(dir); fs.mkdirSync(dir, { recursive: true });
  for (const f of D.frames) {
    const c = createCanvas(gw, gh), x = c.getContext('2d'), im = x.createImageData(gw, gh), b = Buffer.from(f.thumb, 'base64');
    for (let i = 0; i < gw * gh; i++) { im.data[i * 4] = b[i * 3]; im.data[i * 4 + 1] = b[i * 3 + 1]; im.data[i * 4 + 2] = b[i * 3 + 2]; im.data[i * 4 + 3] = 255; }
    x.putImageData(im, 0, 0); fs.writeFileSync(path.join(dir, `${f.shot}_${f.at}.png`), c.toBuffer('image/png', { compressionLevel: 9 }));
  }
  fs.writeFileSync(path.join(GDIR, name + '.json'), JSON.stringify({ film: name, size: D.size, grid: D.grid, fingerprint: D.fingerprint, frames: D.frames.map(({ thumb, ...f }) => ({ ...f, png: `${name}/${f.shot}_${f.at}.png` })) }, null, 1) + '\n');
}
export async function load(name) {
  const jf = path.join(GDIR, name + '.json'); if (!fs.existsSync(jf)) return null;
  const G = JSON.parse(fs.readFileSync(jf, 'utf8')), { loadImage, createCanvas } = await png(), [gw, gh] = G.grid;
  for (const f of G.frames) {
    const c = createCanvas(gw, gh), x = c.getContext('2d'); x.drawImage(await loadImage(path.join(GDIR, f.png)), 0, 0);
    const d = x.getImageData(0, 0, gw, gh).data, b = Buffer.alloc(gw * gh * 3);
    for (let i = 0; i < gw * gh; i++) { b[i * 3] = d[i * 4]; b[i * 3 + 1] = d[i * 4 + 1]; b[i * 3 + 2] = d[i * 4 + 2]; }
    f.thumb = b.toString('base64');
  }
  return G;
}

// ── comparación ────────────────────────────────────────────────────────────────────────────────────────────────────
// OPUS_GOLDEN_MODE=tolerant|strict fuerza el modo (p.ej. si una CPU distinta cambia bits con la misma huella).
const MODE = process.env.OPUS_GOLDEN_MODE, sameFp = (a, b) => (MODE ? MODE === 'strict' : JSON.stringify(a) === JSON.stringify(b));
export function compare(G, D, { strict = sameFp(G.fingerprint, D.fingerprint) } = {}) {
  const bad = [], [gw] = D.grid, sx = D.size[0] / gw;
  if (JSON.stringify(G.size) !== JSON.stringify(D.size)) return { strict, bad: [{ key: '*', why: `tamaño ${G.size} → ${D.size}` }], identical: 0 };
  const key = (f) => `${f.shot}@${f.at}`, gm = new Map(G.frames.map((f) => [key(f), f]));
  let identical = 0;
  for (const f of D.frames) {
    const g = gm.get(key(f)); gm.delete(key(f));
    if (!g) { bad.push({ key: key(f), why: 'fotograma nuevo (no hay golden)' }); continue; }
    if (Math.abs(g.t - f.t) > 1e-6) { bad.push({ key: key(f), why: `t ${g.t} → ${f.t}` }); continue; }
    if (g.sha === f.sha) { identical++; continue; }
    const A = Buffer.from(g.thumb, 'base64'), B = Buffer.from(f.thumb, 'base64'); let mx = 0, at = 0, sum = 0;
    for (let i = 0; i < A.length; i++) { const d = Math.abs(A[i] - B[i]); sum += d; if (d > mx) { mx = d; at = i; } }
    const mean = sum / A.length, cell = Math.floor(at / 3), where = `x≈${Math.round(((cell % gw) + 0.5) * sx)} y≈${Math.round((Math.floor(cell / gw) + 0.5) * sx)}`;
    const fail = strict || mx > TOL_MAX || mean > TOL_MEAN;
    if (fail) bad.push({ key: key(f), why: `Δmax ${mx} Δmedia ${mean.toFixed(3)} (${where})${strict ? ' · bits distintos' : ''}` });
  }
  for (const k of gm.keys()) bad.push({ key: k, why: 'fotograma desaparecido' });
  return { strict, bad, identical };
}

// Mutaciones de 1 px para demostrar que el golden las detecta (y SOLO en el shot tocado).
const inject = (code) => (s) => s.replace(/api\.text\(shot\.text,/, `${code} api.text(shot.text,`);
export const PIXEL_MUTATIONS = [
  { name: 'golden-1px', files: { 'shots/A2.mjs': inject("ctx.save(); ctx['set'+'Transform'](1,0,0,1,0,0); ctx.fillStyle=api.color('ink'); ctx.fillRect(300,300,1,1); ctx.restore();") }, expect: /^A2@(in|mid|out)$/, n: 3 },
  // A3 es DSL (spec 006): su texto vive en el objeto "frase" de shots/A3.scene.json (generado en shots/A3.mjs)
  { name: 'golden-texto+1', files: { 'shots/A3.mjs': (s) => s.replace(/("\$shot": "text"\s*\},\s*"x": \{\s*"\$expr": )"dot_x"/, '$1"dot_x + 1"') }, expect: /^A3@(mid|out)$/, n: 2 },
];

async function main() {
  const films = FILMS.filter((F) => !arg('--only') || F.name === arg('--only')); let fail = 0;
  const D = await Promise.all(films.map((F) => digest(F).catch((e) => e)));
  if (has('--update')) {
    for (const [i, F] of films.entries()) { if (D[i] instanceof Error) throw D[i]; await save(F.name, D[i]); console.log(`→ test/golden/${F.name}.json (${D[i].frames.length} fotogramas)`); }
    return;
  }
  const demoI = films.findIndex((F) => F.name === 'demo');
  // mutaciones y repetición en paralelo: se comparan contra el digest actual del demo (misma máquina ⇒ siempre estricto)
  const extra = demoI >= 0 && !has('--no-selftest') ? [digest(films[demoI], {}), ...PIXEL_MUTATIONS.map((m) => digest(films[demoI], { mutate: m.files }))] : [];
  const X = await Promise.all(extra.map((p) => p.catch((e) => e)));
  for (const [i, F] of films.entries()) {
    const cur = D[i], G = cur instanceof Error ? null : await load(F.name);
    if (cur instanceof Error) { console.log(`✗ golden-${F.name.padEnd(9)} ${cur.message}`); fail++; continue; }
    if (!G) { console.log(`✗ golden-${F.name.padEnd(9)} sin golden: node test/golden.mjs --update`); fail++; continue; }
    const c = compare(G, cur), n = cur.frames.length;
    if (c.bad.length) { fail++; console.log(`✗ golden-${F.name.padEnd(9)} ${c.bad.length}/${n} fotogramas cambian (${c.strict ? 'estricto' : 'tolerante'})\n   ${c.bad.map((b) => `${b.key}: ${b.why}`).join('\n   ')}\n   si el cambio es intencionado: node test/golden.mjs --update y revisa test/golden/${F.name}/*.png`); }
    else console.log(`✓ golden-${F.name.padEnd(9)} ${n}/${n} fotogramas · ${c.identical} idénticos bit a bit${c.strict ? '' : ` · modo tolerante (otra plataforma: Δmax≤${TOL_MAX}, Δmedia≤${TOL_MEAN})`}`);
  }
  if (X.length) {
    const base = D[demoI], [rep, ...muts] = X;
    if (base instanceof Error || rep instanceof Error) { console.log(`✗ golden-repetible ${(base instanceof Error ? base : rep).message}`); fail++; }
    else { const c = compare(base, rep, { strict: true }), ok = !c.bad.length; console.log(`${ok ? '✓' : '✗'} golden-repetible 2 renders del demo: ${ok ? 'idénticos bit a bit' : c.bad.map((b) => b.key + ' ' + b.why).join(' | ')}`); if (!ok) fail++; }
    for (const [i, m] of PIXEL_MUTATIONS.entries()) {
      const M = muts[i]; if (M instanceof Error || base instanceof Error) { console.log(`✗ ${m.name.padEnd(16)} ${(M instanceof Error ? M : base).message}`); fail++; continue; }
      const c = compare(base, M, { strict: true }), keys = c.bad.map((b) => b.key), ok = keys.length === m.n && keys.every((k) => m.expect.test(k));
      console.log(`${ok ? '✓' : '✗'} ${m.name.padEnd(16)} detecta ${keys.join(', ') || 'nada'}${ok ? '' : ` (esperado ${m.n} que casen ${m.expect})`}  ${c.bad[0]?.why ?? ''}`); if (!ok) fail++;
    }
  }
  process.exitCode = fail ? 1 : 0;
}

if (argv[0] === '--worker') await worker(argv[1]);
else if (isMain(import.meta.url)) await main();
