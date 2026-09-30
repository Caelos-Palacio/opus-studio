#!/usr/bin/env node
// Suite de regresión del propio verificador: cada mutación rompe el contrato y el lint DEBE detectarla.
// Corre en una copia temporal del repo (node_modules enlazado): nunca toca tus archivos.   npm test [-- --only nombre]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const inject = (code) => (src) => src.replace(/api\.text\(shot\.text,/, `${code} api.text(shot.text,`);
const MUT = [
  { name: 'base-ship', file: null, expect: { verdict: 'SHIP' } },
  { name: 'math-random', file: 'shots/A2.mjs', edit: inject("ctx.fillStyle='#f00'; ctx.fillRect(50+Math.random()*30,50,20,20);"), expect: { fix: /Math\.random en shots\/A2/ } },
  { name: 'estado-global', file: 'shots/A2.mjs', edit: (s) => inject("ctx.fillStyle='#f00'; ctx.fillRect(50+(n++%2)*30,50,20,20);")(s.replace('export default {', 'let n = 0;\nexport default {')), expect: { fix: /no determinista en este shot/, shot: 'A2' } },
  { name: 'filltext-crudo', file: 'shots/A2.mjs', edit: inject("ctx.font='8px sans-serif'; ctx.fillStyle='#000'; ctx['fill'+'Text']('OCULTO', 300, 300);"), expect: { fix: /ctx\.fillText/ } },
  { name: 'settransform', file: 'shots/A2.mjs', edit: inject("ctx.save(); ctx['set'+'Transform'](1,0,0,1,0,0); ctx.restore();"), expect: { fix: /setTransform/ } },
  { name: 'fuga-transform', file: 'shots/A2.mjs', edit: inject('ctx.translate(3,0);'), expect: { fix: /fuga de transform/ } },
  { name: 'sin-foco', file: 'shots/A1.mjs', edit: (s) => s.replace(/api\.morph\([^;]*\);/, "ctx.fillStyle=api.color('ink'); ctx.beginPath(); ctx.arc(d.x,d.y,d.s/2,0,6.28); ctx.fill();"), expect: { fix: /no registra ningún foco/, shot: 'A1' } },
  { name: 'camara-falsa', file: 'shots/A2.mjs', edit: (s) => s.replace("api.glow(d.x", "ctx.save(); const zz = 1 + 0.4 * u; ctx.translate(640,360); ctx.scale(zz,zz); ctx.translate(-640,-360); for (let q = 0; q < 10; q++) { ctx.fillStyle = api.color('shade'); ctx.fillRect(100 + q * 90, 600, 30, 30); } ctx.restore(); api.glow(d.x"), expect: { warn: /cámara falsa/ } },
  { name: 'texto-fuera', file: 'shots/A3.mjs', edit: (s) => s.replace("api.text(shot.text, d.x, d.y,", "api.text(shot.text, 20, d.y,"), expect: { fix: /fuera de safe area/ } },
];
const copy = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'opus-test-'));
  for (const e of fs.readdirSync(ROOT)) if (!['node_modules', 'out', '.git'].includes(e)) fs.cpSync(path.join(ROOT, e), path.join(d, e), { recursive: true });
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(d, 'node_modules'));
  return d;
};
let fail = 0;
for (const m of MUT.filter((x) => !only || x.name === only)) {
  const d = copy();
  try {
    if (m.file) { const f = path.join(d, m.file), a = fs.readFileSync(f, 'utf8'), b = m.edit(a); if (a === b) throw new Error('la mutación no se aplicó'); fs.writeFileSync(f, b); }
    spawnSync(process.execPath, ['engine/lint.mjs', '--only', 'validate'], { cwd: d, encoding: 'utf8' });
    const r = spawnSync(process.execPath, ['engine/lint.mjs'], { cwd: d, encoding: 'utf8', timeout: 300000 }), L = JSON.parse(fs.readFileSync(path.join(d, 'out/lint.json'), 'utf8'));
    const e = m.expect, fx = L.issues.filter((i) => i.level === 'FIX'), wn = L.issues.filter((i) => i.level === 'WARN');
    let ok = true;
    if (e.verdict) ok &&= L.verdict === e.verdict;
    if (e.fix) ok &&= fx.some((i) => e.fix.test(i.problem) && (!e.shot || i.shot === e.shot));
    if (e.warn) ok &&= wn.some((i) => e.warn.test(i.problem));
    console.log(`${ok ? '✓' : '✗'} ${m.name.padEnd(16)} ${L.verdict}  ${ok ? '' : r.stdout.split('\n').slice(-12).join('\n   ')}`);
    if (!ok) fail++;
  } catch (err) { console.log(`✗ ${m.name}: ${err.message}`); fail++; }
  finally { fs.rmSync(d, { recursive: true, force: true }); }
}
// Integración: el fixture showcase ejercita TeX+morph semántico, scene graph+constraints+fps por nodo, 2.5D/DOF, capas fx,
// partículas, campos, grafo, globo, card3d y autocámara. Debe dar SHIP. (Es un fixture de prueba, no contenido del estudio.)
if (!only || only === 'fixture') {
  const d = copy(), fx = path.join(ROOT, 'test/fixtures/showcase');
  try {
    for (const f of fs.readdirSync(path.join(fx, 'shots'))) fs.copyFileSync(path.join(fx, 'shots', f), path.join(d, 'shots', f));
    fs.copyFileSync(path.join(fx, 'timeline.json'), path.join(d, 'data/fixture.json'));
    const env = { ...process.env, OPUS_TIMELINE: 'data/fixture.json' };
    spawnSync(process.execPath, ['engine/autocam.mjs'], { cwd: d, env, encoding: 'utf8' });
    spawnSync(process.execPath, ['engine/lint.mjs'], { cwd: d, env, encoding: 'utf8', timeout: 900000 });
    const L = JSON.parse(fs.readFileSync(path.join(d, 'out/lint.json'), 'utf8')), ok = L.verdict === 'SHIP';
    console.log(`${ok ? '✓' : '✗'} fixture-v4       ${L.verdict}  ${ok ? '' : L.issues.filter((i) => i.level === 'FIX').map((i) => i.shot + ' ' + i.problem).join(' | ')}`); if (!ok) fail++;
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
}
// Unidades puras (geometría, partículas, sims): sin render.
const U = spawnSync(process.execPath, [path.join(ROOT, 'test/unit.mjs')], { encoding: 'utf8' }); process.stdout.write(U.stdout + U.stderr); if (U.status) fail++;
console.log(fail ? `\n${fail} fallos` : '\nTodo verde'); process.exit(fail ? 1 : 0);
