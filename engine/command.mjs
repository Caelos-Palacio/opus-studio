// Comandos SIN shell (orquestación al límite). Evidencias de `orch deliver` y criterios de gates.json son:
//   · argv  ["node", "engine/x.mjs", ...args]  (script existente DENTRO del repo; nada de -e, bash -c ni rutas fuera)
//   · ID de la allowlist data/commands.json  + argumentos:  "lint --only validate"
//   · compat: el argv literal de un ID como string ("node engine/lint.mjs --only validate")
// Un string con metacaracteres de shell, un ejecutable que no es node o una ruta fuera del repo → {ok:false, why}.
// Nunca se ejecuta con shell: spawnArgv usa execve directo.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './ledger.mjs';

export const COMMANDS_FILE = path.join(ROOT, 'data/commands.json');
export const commands = () => {
  try { return Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(COMMANDS_FILE, 'utf8'))).filter(([k, v]) => !k.startsWith('_') && Array.isArray(v) && v.every((x) => typeof x === 'string'))); }
  catch { return {}; }
};
const META = /[;&|`$<>(){}\\"'*?!~#^\[\]\n\r\0]/;
const inside = (root, p) => { const r = path.relative(root, p); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };
// ¿p (relativa a ROOT, o absoluta) queda dentro del repo, siguiendo symlinks del ancestro existente más cercano?
export function inRepo(p, root = ROOT) {
  const abs = path.resolve(root, p); if (!inside(root, abs)) return false;
  let real = abs; while (real !== path.dirname(real)) { try { real = fs.realpathSync(real); break; } catch { real = path.dirname(real); } }
  let realRoot = root; try { realRoot = fs.realpathSync(root); } catch {}
  return inside(realRoot, real);
}
const pathLike = (a) => /^[~/.]|[\\/]|^[a-zA-Z]:/.test(a);
const badArg = (a) => {
  if (/\0/.test(a)) return 'NUL en un argumento';
  for (const part of a.startsWith('--') && a.includes('=') ? [a.slice(a.indexOf('=') + 1)] : a.startsWith('-') && !a.startsWith('--') ? [] : [a]) {   // --flag=/ruta también se mira
    if (part && pathLike(part) && !/^[~/.]*$/.test(part) && !inRepo(part)) return `ruta fuera del repo: ${part}`;
    if (part.startsWith('~')) return `ruta fuera del repo: ${part}`;
  }
  return null;
};
const fail = (why) => ({ ok: false, why, argv: null, id: null });

// spec: string | string[]  →  {ok, argv, id, display, why}
export function resolveCommand(spec) {
  const C = commands();
  let argv, id = null;
  if (Array.isArray(spec)) {
    if (!spec.length || spec.some((x) => typeof x !== 'string' || !x.length)) return fail('argv vacío o con elementos que no son strings');
    argv = spec;
  } else if (typeof spec === 'string') {
    if (META.test(spec)) return fail(`metacaracteres de shell en "${spec.slice(0, 60).replace(/\s+/g, ' ')}": usa argv ["node","engine/x.mjs",…] o un ID de data/commands.json (${Object.keys(C).join(', ')})`);
    const t = spec.trim().split(/\s+/).filter(Boolean); if (!t.length) return fail('comando vacío');
    if (C[t[0]]) { id = t[0]; argv = [...C[t[0]], ...t.slice(1)]; }
    else {
      const hit = Object.entries(C).find(([, a]) => a.every((x, i) => t[i] === x));        // compat: el argv literal de un ID
      if (!hit) return fail(`"${t[0]}" no es un ID de la allowlist (${Object.keys(C).join(', ')})`);
      id = hit[0]; argv = t;
    }
  } else return fail('el comando debe ser un array (argv) o un ID de la allowlist');
  if (argv[0] !== 'node' && argv[0] !== process.execPath) return fail(`ejecutable no permitido: ${path.basename(argv[0])} (solo node)`);
  const script = argv[1];
  if (!script) return fail('falta el script de node');
  if (script.startsWith('-')) return fail(`node ${script}: no se permiten flags de node ni -e (código inline)`);
  if (!inRepo(script)) return fail(`script fuera del repo: ${script}`);
  if (!fs.existsSync(path.resolve(ROOT, script)) || !fs.statSync(path.resolve(ROOT, script)).isFile()) return fail(`el script no existe: ${script}`);
  for (const a of argv.slice(2)) { const b = badArg(a); if (b) return fail(b); }
  return { ok: true, argv: [process.execPath, ...argv.slice(1)], id, display: ['node', ...argv.slice(1)].join(' '), why: null };
}
export const display = (spec) => (Array.isArray(spec) ? spec.join(' ') : String(spec));

// Ejecuta un argv ya resuelto, sin shell.
export function spawnArgv(argv, { cwd = ROOT, env = process.env, maxBuffer = 256 << 20 } = {}) {
  return spawnSync(argv[0], argv.slice(1), { cwd, encoding: 'utf8', env, maxBuffer, shell: false });
}
