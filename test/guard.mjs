#!/usr/bin/env node
// Unidades del guardia estático (AST) y del sandbox en ejecución: evasiones conocidas → FIX; shots limpios → nada.
import fs from 'node:fs';
import { rootFrom } from '../engine/paths.mjs';
import path from 'node:path';
import { scanSource, shotImportAllowed } from '../engine/guard.mjs';
import { makeSandbox, trusted } from '../engine/sandbox.mjs';

const ROOT = rootFrom(import.meta.url);
let n = 0, bad = 0; const ok = (c, m) => { n++; if (!c) { bad++; console.log('  ✗ guardia:', m); } };
const wrap = (body, pre = '') => `import { lerp } from '../engine/core.mjs';\n${pre}\nexport default {\n  draw(ctx, t, u, shot, film, api) {\n    ${body}\n  },\n};\n`;
const fixes = (src) => scanSource(src, 'X').filter((i) => i.level === 'FIX').map((i) => i.problem);
const hit = (name, src, re) => { const f = fixes(src); ok(f.some((p) => re.test(p)), `${name} → esperaba FIX ${re}, obtuvo [${f.join(' | ')}]`); };
const clean = (name, src) => { const f = fixes(src); ok(!f.length, `${name} → falso positivo [${f.join(' | ')}]`); };

// Evasiones: todas FIX.
hit('eval', wrap("eval('1+1');"), /^eval en/);
hit('alias eval', wrap('E("1");', 'const E = eval;'), /eval/);
hit('new Function', wrap("new Function('return 1')();"), /Function \(código desde string\)/);
hit('Function()', wrap("Function('return 1')();"), /Function/);
hit('constructor.constructor', wrap("this.constructor.constructor('return process')();"), /\.constructor/);
hit('constructor computado', wrap("(()=>0)['const'+'ructor']('return 1')();"), /\.constructor/);
hit('globalThis computado', wrap("globalThis['ev'+'al']('1');"), /globalThis|eval/);
hit('globalThis alias', wrap("const g = globalThis; g[['ev','al'].join('')]('1');"), /globalThis/);
hit('import fs', "import fs from 'node:fs';\nexport default { draw() {} };\n", /import prohibido 'node:fs'/);
hit('import fs sin node:', "import { readFileSync } from 'fs';\nexport default { draw() {} };\n", /import prohibido 'fs'/);
hit('import child_process', "import cp from 'child_process';\nexport default { draw() {} };\n", /import prohibido/);
hit('export from', "export * from 'node:vm';\nexport default { draw() {} };\n", /import prohibido/);
hit('import dinámico', wrap("import('node:' + 'fs');"), /import\(\) dinámico/);
hit('process', wrap("process.getBuiltinModule('fs');"), /process/);
hit('require', wrap("require('fs');"), /require/);
hit('Math.random', wrap('ctx.fillRect(Math.random(), 0, 1, 1);'), /Math\.random en shots\/X/);
hit('Math.random computado', wrap("ctx.fillRect(Math['ran'+'dom'](), 0, 1, 1);"), /Math\.random/);
hit('Math.random alias', wrap('ctx.fillRect(R(), 0, 1, 1);', 'const R = Math.random;'), /Math\.random/);
hit('Math.random destructurado', wrap('ctx.fillRect(random(), 0, 1, 1);', 'const { random } = Math;'), /Math\.random/);
hit('Math alias', wrap('ctx.fillRect(M.random(), 0, 1, 1);', 'const M = Math;'), /Math\.random/);
hit('Date.now', wrap('const d = Date.now();'), /Date en/);
hit('new Date', wrap('const d = new Date();'), /Date en/);
hit('Date alias', wrap('const d = new D();', 'const D = Date;'), /Date en/);
hit('performance.now', wrap('const d = performance.now();'), /performance\.now/);
hit('setTimeout', wrap('setTimeout(() => 0, 1);'), /temporizador/);
hit('fetch', wrap("fetch('http://x');"), /red en el shot/);
hit('async', wrap('(async () => 0)();'), /asíncrono/);
hit('fillText', wrap("ctx.fillText('a', 0, 0);"), /texto sin api\.text/);
hit('fillText computado', wrap("ctx['fill'+'Text']('a', 0, 0);"), /texto sin api\.text/);
hit('fillText plantilla', wrap("const k = 'Text'; ctx[`fill${k}`]('a', 0, 0);"), /texto sin api\.text/);
hit('setTransform', wrap('ctx.setTransform(1,0,0,1,0,0);'), /transform absoluta/);
hit('estado global', wrap('n++;', 'let n = 0;'), /estado de módulo mutable reasignado/);
hit('estado global indentado', wrap('n = n + 1;', '    let n = 0;'), /estado de módulo mutable reasignado/);
hit('estado global en bloque', wrap('n += 1;', '{ var n = 0; }'), /estado de módulo mutable reasignado/);
hit('estado global exportado', wrap('n += 1;', 'export let n = 0;'), /estado de módulo mutable reasignado/);
hit('estado global en arrow', wrap('bump();', 'let n = 0; const bump = () => { n++; };'), /estado de módulo mutable reasignado/);
hit('no parsea', 'export default { draw( {} };', /no parsea/);

// Sin falsos positivos.
clean('comentario y string', wrap("// Math.random() eval( new Date()\nconst s = 'Math.random() fetch( process';"));
clean('local sombrea', wrap('let n = 0; n++; const f = () => { let n = 1; n++; };'));
clean('let de módulo inicializado a nivel de módulo', wrap('', 'let n = 0; n = 3;').replace('let n = 0; n = 3;', 'let n = 0;\nn = 3;'));
clean('parámetro llamado self/process', wrap('const f = (self, process) => self + process; f(1, 2);'));
clean('Math legítimo', wrap('const a = Math.sin(t) + Math.PI + Math[t > 1 ? "cos" : "sin"](t);'));
clean('Date.UTC puro', wrap('const a = Date.UTC(2020, 1);'));
clean('import relativo', "import A1 from './A1.mjs';\nimport { lerp } from '../engine/core.mjs';\nexport default { draw() {} };\n");
ok(scanSource(wrap('', 'let n = 0;'), 'X').some((i) => i.level === 'WARN' && /estado de módulo mutable \(shots\/X\.mjs:2\)/.test(i.problem)), 'let de módulo sin reasignar → WARN (semántica previa)');

// Shots reales del repo y del fixture: sin FIX.
for (const dir of [path.join(ROOT, 'shots'), path.join(ROOT, 'test/fixtures/showcase/shots')]) for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.mjs'))) clean(path.relative(ROOT, path.join(dir, f)), fs.readFileSync(path.join(dir, f), 'utf8'));
// Imports relativos a módulos impuros del motor (film, render, tex…) → FIX (resuelto contra ROOT).
for (const m of ['film', 'render', 'tex', 'cut', 'guard', 'sandbox']) ok(!shotImportAllowed(ROOT, path.join(ROOT, 'engine', m + '.mjs')), `engine/${m}.mjs no importable desde un shot`);
for (const m of ['core', 'geom', 'seek', 'api']) ok(shotImportAllowed(ROOT, path.join(ROOT, 'engine', m + '.mjs')), `engine/${m}.mjs importable desde un shot`);
ok(shotImportAllowed(ROOT, path.join(ROOT, 'shots', 'A1.mjs')) && !shotImportAllowed(ROOT, path.join(ROOT, 'data', 'x.mjs')), 'shots sí, fuera de engine/shots no');

// Sandbox en ejecución: congela reloj y azar, corta eval/Function/process/timers, y restaura al salir.
{
  const sb = makeSandbox(ROOT), realRandom = Math.random, realNow = Date.now;
  const r1 = sb.run('A', () => [Math.random(), Math.random()]), r2 = sb.run('A', () => [Math.random(), Math.random()]);
  ok(r1.join() === r2.join() && r1[0] !== r1[1], 'Math.random sembrado y determinista por ejecución');
  ok(sb.run('A', () => Date.now()) === sb.run('A', () => Date.now()) && sb.run('A', () => new Date().getTime()) === sb.run('A', () => Date.now()), 'Date congelado');
  ok(sb.run('A', () => performance.now()) === 0, 'performance.now congelado');
  const throws = (fn) => { try { sb.run('A', fn); return false; } catch { return true; } };
  ok(throws(() => eval('1')), 'eval lanza');
  ok(throws(() => new Function('return 1')()), 'new Function lanza');
  ok(throws(() => (() => 0).constructor('return 1')()), '.constructor → Function lanza');
  ok(throws(() => Object.getPrototypeOf(async () => 0).constructor('return 1')()), 'AsyncFunction lanza');
  ok(throws(() => globalThis.process.getBuiltinModule('fs')), 'process.getBuiltinModule no disponible');
  ok(throws(() => setTimeout(() => 0, 1)), 'setTimeout lanza');
  ok(Math.random === realRandom && Date.now === realNow && typeof process.getBuiltinModule === 'function' && eval('1') === 1 && new Function('return 2')() === 2, 'globales restaurados al salir');
  let inner = null; try { sb.run('A', () => { throw new Error('x'); }); } catch { inner = Math.random === realRandom; } ok(inner, 'restaura también si el shot lanza');
  // trusted: servicios SÍNCRONOS del motor (TeX) que el shot invoca vía api; corren con los globales reales y el sandbox del shot sigue después
  const seq = sb.run('B', () => { const a = Math.random(); const inside = trusted(() => [typeof process.pid, Math.random === realRandom, Date.now === realNow, typeof setTimeout]); return [a, inside, Math.random === realRandom, (() => { try { return typeof process.pid; } catch { return 'blocked'; } })(), Math.random()]; });
  ok(seq[1].join() === 'number,true,true,function' && seq[2] === false && seq[3] === 'blocked', 'trusted: globales reales dentro, sandbox restaurado después');
  ok(sb.run('B', () => [Math.random(), Math.random()]).join() !== '' && seq[4] === sb.run('B', () => { const a = Math.random(); return [a, Math.random()]; })[1], 'trusted: no desplaza la secuencia de Math.random del shot');
  ok(trusted(() => 7) === 7 && Math.random === realRandom, 'trusted fuera de sandbox = llamada directa');
  ok(sb.run('A', () => [1, 2, 3].map((x) => x * 2).join()) === '2,4,6' && sb.run('A', () => typeof Function.prototype.call) === 'function' && sb.run('A', () => ((f) => f instanceof Function)(() => 0)), 'código normal intacto (instanceof Function)');
}
console.log(`${bad ? '✗' : '✓'} guardia        ${n - bad}/${n}`); process.exit(bad ? 1 : 0);
