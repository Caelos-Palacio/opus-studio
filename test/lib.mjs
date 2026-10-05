// Utilidades compartidas por los tests: copia mínima del repo, procesos hijos asíncronos y pool con límite de CPU.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const FONTS_CONF = path.join(ROOT, 'test/golden/fonts.conf');
// Solo lo que el motor lee al renderizar/lintar/montar. Antes se copiaba TODO el repo (incluidos docs/, test/ y, en el
// checkout principal, .claude/worktrees/* con sus copias enteras): lento y frágil.
const NEEDED = ['engine', 'shots', 'styles', 'data', 'assets', 'storyboard', 'package.json'];

// Copia temporal aislada (node_modules enlazado). fixture = dir con shots/ + timeline.json → shots/ y data/<name>.json
export function copyRepo({ fixture, name = 'fixture' } = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'opus-test-'));
  for (const e of NEEDED) { const s = path.join(ROOT, e); if (fs.existsSync(s)) fs.cpSync(s, path.join(d, e), { recursive: true }); }
  fs.rmSync(path.join(d, 'data/autocam'), { recursive: true, force: true });        // cámaras horneadas locales: se regeneran
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(d, 'node_modules'));
  if (fixture) {
    for (const f of fs.readdirSync(path.join(fixture, 'shots'))) fs.copyFileSync(path.join(fixture, 'shots', f), path.join(d, 'shots', f));
    fs.copyFileSync(path.join(fixture, 'timeline.json'), path.join(d, `data/${name}.json`));
  }
  return d;
}
export const rmrf = (d) => fs.rmSync(d, { recursive: true, force: true });

// spawn → promesa {status, stdout, stderr}; nunca rechaza (el test decide qué es fallo).
export function run(args, { cwd = ROOT, env = {}, timeout = 900000 } = {}) {
  return new Promise((res) => {
    const p = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env } }); let out = '', err = '';
    const k = setTimeout(() => p.kill('SIGKILL'), timeout);
    p.stdout.on('data', (b) => (out += b)); p.stderr.on('data', (b) => (err += b));
    p.on('close', (status) => { clearTimeout(k); res({ status, stdout: out, stderr: err }); });
  });
}

// Pool: como mucho `n` tareas a la vez. Devuelve las promesas en el orden de entrada (para imprimir en orden estable).
export function pool(n) {
  let active = 0; const q = [];
  const next = () => { while (active < n && q.length) { const { fn, res } = q.shift(); active++; fn().then(res, res).finally(() => { active--; next(); }); } };
  return (fn) => new Promise((res) => { q.push({ fn, res }); next(); });
}
export const CPUS = Math.max(1, (os.availableParallelism?.() ?? os.cpus().length));
