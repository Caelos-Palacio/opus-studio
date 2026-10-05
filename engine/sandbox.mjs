// Sandbox en ejecución de shots/*.mjs (Node). Defensa en profundidad detrás del guardia estático (guard.mjs):
//   1. Hook de carga (module.registerHooks): un shot solo importa otros shots o el núcleo PURO del motor
//      (sin builtins: nada de fs, child_process, vm, worker_threads, net, node:*, data:, paquetes).
//   2. Mientras corre código del shot (evaluación del módulo y cada draw/scene/entities), los globales peligrosos
//      o no deterministas quedan sustituidos: Math.random sembrado por shot; Date y performance.now congelados;
//      eval, Function (y .constructor de funciones/async/generadores), process, timers y red lanzan SandboxError.
//      Se restauran al salir (también si el shot lanza). Coste: unas decenas de defineProperty por shot y frame.
// Huecos conocidos (documentados en docs/research/01-auditoria.md §E7): mismo realm y mismo hilo; callbacks
// asíncronos que el shot consiga encolar (p. ej. await/then) correrían fuera del sandbox — el guardia estático
// prohíbe async/await/Promise/timers; un aislamiento total pediría worker_threads con el canvas dentro del worker.
import module from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { shotImportAllowed } from './guard.mjs';

export class SandboxError extends Error { constructor(what) { super(`sandbox: ${what} bloqueado en un shot`); this.name = 'SandboxError'; this.what = what; } }

const EPOCH = 0;                                             // reloj de pared congelado: el único reloj es t
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const mulberry = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

let hooked = null;                                          // raíces cuyo shots/ está vigilado por el hook de carga
function installHooks(root) {
  if (!hooked) {
    hooked = new Set();
    if (typeof module.registerHooks !== 'function') return false;   // Node < 22.15: queda solo el guardia estático
    module.registerHooks({
      resolve(specifier, context, next) {
        const parent = context.parentURL ?? '';
        const inShot = parent.startsWith('data:') || parent.startsWith('blob:') || [...hooked].some((r) => parent.startsWith(pathToFileURL(path.join(r, 'shots')).href + '/'));
        if (!inShot) return next(specifier, context);
        const r = next(specifier, context), root = [...hooked].find((x) => parent.startsWith(pathToFileURL(x).href + '/'));
        if (!r.url.startsWith('file:') || !root || !shotImportAllowed(root, fileURLToPath(r.url))) {
          const e = new SandboxError(`import '${specifier}'`); report(e); throw e;
        }
        return r;
      },
    });
  }
  hooked.add(path.resolve(root));
  return true;
}

// Violaciones en tiempo de ejecución (se registran aunque el shot capture la excepción).
const LOG = [], PROC = process;                     // process real (el global se sustituye dentro del sandbox)
let current = null;
function report(e) {
  const rec = { shot: current ?? '?', what: e.what, message: e.message };
  if (!LOG.some((x) => x.shot === rec.shot && x.what === rec.what)) { LOG.push(rec); PROC.stderr.write(`✗ ${e.message} (shot ${rec.shot})\n`); }
  PROC.exitCode = 1;
}
const deny = (what) => function blocked() { const e = new SandboxError(what); report(e); throw e; };

const G = globalThis;
const FN_PROTOS = [Function.prototype, Object.getPrototypeOf(async function () {}), Object.getPrototypeOf(function* () {}), Object.getPrototypeOf(async function* () {})];
function patches(id) {
  const RealDate = Date;
  function FrozenDate(...a) { if (!new.target) return new RealDate(EPOCH).toString(); return a.length ? new RealDate(...a) : new RealDate(EPOCH); }
  FrozenDate.prototype = RealDate.prototype; FrozenDate.now = () => EPOCH; FrozenDate.UTC = RealDate.UTC; FrozenDate.parse = RealDate.parse;
  const FnStub = deny('Function (código desde string)'); FnStub.prototype = Function.prototype;
  const P = PROC, safe = { env: Object.freeze({}), argv: Object.freeze([]), platform: P.platform, versions: Object.freeze({ ...P.versions }) };
  const stubProcess = new Proxy(Object.freeze({}), { get: (_, k) => (typeof k === 'symbol' ? undefined : k in safe ? safe[k] : deny('process.' + k)()), has: (_, k) => k in safe });
  const list = [
    [Math, 'random', mulberry(hashStr(String(id)))],
    [G, 'Date', FrozenDate],
    [G, 'eval', deny('eval')],
    [G, 'Function', FnStub],
    [G, 'process', stubProcess],
    ...['setTimeout', 'setInterval', 'setImmediate', 'queueMicrotask', 'requestAnimationFrame'].map((k) => [G, k, deny('temporizador ' + k)]),
    ...['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'].map((k) => [G, k, deny('red ' + k)]),
    ...FN_PROTOS.map((p) => [p, 'constructor', FnStub]),
  ];
  const perf = G.performance; if (perf) list.push([perf, 'now', () => 0]);
  return list;
}

export function makeSandbox(root) {
  const hooks = installHooks(root);
  let depth = 0, saved = null;
  const enter = (id) => {
    if (depth++ > 0) return;
    current = id; saved = [];
    for (const [obj, key, val] of patches(id)) {
      saved.push([obj, key, Object.getOwnPropertyDescriptor(obj, key)]);
      Object.defineProperty(obj, key, { value: val, writable: true, configurable: true, enumerable: false });
    }
  };
  const exit = () => {
    if (--depth > 0) return;
    for (let i = saved.length - 1; i >= 0; i--) { const [obj, key, d] = saved[i]; if (d) Object.defineProperty(obj, key, d); else delete obj[key]; }
    saved = null; current = null;
  };
  // Síncrono: ejecuta fn con los globales del shot; propaga cualquier error (también SandboxError).
  const run = (id, fn) => { enter(id); try { return fn(); } finally { exit(); } };
  return {
    hooks, log: LOG, run,
    // Evaluación del módulo del shot (top-level) bajo el sandbox. loadFilm no ejecuta nada concurrente mientras tanto.
    // Un import bloqueado deja el shot sin módulo (se dibuja el placeholder): el lint sigue y el guardia da el FIX.
    async importShot(file, id) {
      enter(id);
      try { return (await import(pathToFileURL(file).href)).default; }
      catch (e) { if (e instanceof SandboxError || e?.name === 'SandboxError') { report(e); return undefined; } throw e; }
      finally { exit(); }
    },
    // Envuelve las funciones del módulo (draw, scene, entities.*, …) para que cada llamada del motor corra en sandbox.
    // Una SandboxError aborta esa llamada (el frame queda sin el shot) sin tumbar el proceso; exitCode = 1.
    wrap(mod, id) {
      if (!mod || typeof mod !== 'object') return mod;
      const w = (f) => function (...a) { try { return run(id, () => f.apply(this, a)); } catch (e) { if (e instanceof SandboxError) return undefined; throw e; } };
      const out = {};
      for (const [k, v] of Object.entries(mod)) {
        if (typeof v === 'function') out[k] = w(v);
        else if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) out[k] = Object.fromEntries(Object.entries(v).map(([k2, v2]) => [k2, typeof v2 === 'function' ? w(v2) : v2]));
        else out[k] = v;
      }
      return out;
    },
  };
}
