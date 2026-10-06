#!/usr/bin/env node
// Spec 010 — DSL al ~80 %: cobertura (dsl coverage), goldens de píxeles contra el JS legado y rendimiento.
//   node test/dsl-cov.mjs [--fast]        tests (C1–C9)
//   node test/dsl-cov.mjs --worker <timeline> [ids,…]   (interno) sha de píxeles de cada shot en 6 instantes
//   node test/dsl-cov.mjs --gen            REGENERA test/fixtures/dsl-legacy/hashes.json (solo con el JS legado intacto)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ROOT, FONTS_CONF, run } from './lib.mjs';

export const FRACS = [0.02, 0.25, 0.4, 0.5, 0.75, 0.98];
export const FILMS = { demo: 'data/timeline.json', mate: 'data/mate/timeline.json', regla: 'data/regla/regla.json', potencias: 'data/stress/potencias.json', reel: 'data/reel/timeline.json' };
const HASHES = path.join(ROOT, 'test/fixtures/dsl-legacy/hashes.json');
const argv = process.argv.slice(2);

if (argv[0] === '--worker') {
  const { makeRenderer } = await import(pathToFileURL(path.join(process.cwd(), 'engine/render.mjs')).href);
  const R = await makeRenderer({}), only = argv[1] ? argv[1].split(',') : null, out = {}, tm = {};
  const perf = process.env.DSL_PERF ? Number(process.env.DSL_PERF) : 0;
  for (const s of R.film.shots) {
    if (only && !only.includes(s.id)) continue;
    const [a, b] = s.t; out[s.id] = {};
    for (const f of FRACS) { const t = a + (b - a) * f; R.frame(t); out[s.id][f] = crypto.createHash('sha256').update(R.ctx.getImageData(0, 0, R.W, R.H).data).digest('hex').slice(0, 20); }
    if (perf) { const ts = []; for (let r = 0; r < perf; r++) { const t0 = process.hrtime.bigint(); for (const f of FRACS) R.frame(a + (b - a) * f); ts.push(Number(process.hrtime.bigint() - t0) / 1e6 / FRACS.length); } ts.sort((x, y) => x - y); tm[s.id] = ts[Math.floor(ts.length / 2)]; }
  }
  process.stdout.write(JSON.stringify(perf ? { hashes: out, ms: tm } : out)); process.exit(0);
}
export const workerEnv = { FONTCONFIG_FILE: FONTS_CONF, OPUS_LAYERS: 'none' };
export async function renderFilm(film, { cwd = ROOT, ids, perf } = {}) {
  const r = await run([path.join(ROOT, 'test/dsl-cov.mjs'), '--worker', ...(ids ? [ids.join(',')] : [])], { cwd, env: { ...workerEnv, OPUS_TIMELINE: FILMS[film], ...(perf ? { DSL_PERF: String(perf) } : {}) } });
  if (r.status) throw new Error(`${film}: ${r.stderr.slice(-400)}`);
  return JSON.parse(r.stdout);
}
if (argv[0] === '--gen') {
  const H = fs.existsSync(HASHES) ? JSON.parse(fs.readFileSync(HASHES, 'utf8')) : {};
  for (const film of Object.keys(FILMS)) { const h = await renderFilm(film); Object.assign(H, h); console.log(`${film}: ${Object.keys(h).join(' ')}`); }
  fs.writeFileSync(HASHES, JSON.stringify(Object.fromEntries(Object.entries(H).sort(([a], [b]) => a.localeCompare(b))), null, 1) + '\n');
  process.exit(0);
}
export const refHashes = () => JSON.parse(fs.readFileSync(HASHES, 'utf8'));
export const dslShots = () => fs.readdirSync(path.join(ROOT, 'shots')).filter((f) => f.endsWith('.scene.json')).map((f) => f.replace('.scene.json', '')).sort();
if (argv[0] === '--check') {   // node test/dsl-cov.mjs --check [film|all] [id,id]  → compara los shots DSL con los hashes del JS legado
  const films = !argv[1] || argv[1] === 'all' ? Object.keys(FILMS) : [argv[1]], mine = dslShots(), H = refHashes(); let bad = 0, n = 0;
  for (const film of films) {
    const ids = (argv[2] ? argv[2].split(',') : mine), tl = JSON.parse(fs.readFileSync(path.join(ROOT, FILMS[film]), 'utf8')).shots.map((s) => s.id), want = ids.filter((i) => mine.includes(i) && tl.includes(i)); if (!want.length) continue;
    const got = await renderFilm(film, { ids: want });
    for (const id of want) { n++; const ok = JSON.stringify(got[id]) === JSON.stringify(H[id]); if (!ok) { bad++; console.log(`✗ ${id}: ${FRACS.filter((f) => got[id]?.[f] !== H[id]?.[f]).join(' ')}`); } else console.log(`✓ ${id}`); }
  }
  console.log(`${n} shots DSL, ${bad} difieren`); process.exit(bad ? 1 : 0);
}
