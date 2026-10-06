// Precalentamiento paralelo de la caché de fotogramas del lint (R6, spec 009). En frío el lint renderiza ~1 600 fotogramas en UN proceso; aquí se
// reparten entre procesos hijos (cada uno rellena su porción de out/cache/frames) y el lint analiza ya con todo en caché. El resultado es idéntico:
// la caché es por contenido y los hijos piden exactamente los mismos fotogramas (misma función de plan que los checks).
//   lintFrames(film, {lfps, scope}) → { layout: [{t, px, guard}], small: [{t, px}] }     (los conjuntos que recorren layout y motion/arc)
//   prewarm({film, layoutCache, smallCache, lfps, scope, sizes}) → n fotogramas repartidos (0 = no merece la pena / sin caché)
// CLI (hijo): node engine/framewarm.mjs --slice i/k --lfps N --need L|S|LS [--size WxH] [--scope t0:t1:id,id]
import { isMain } from './paths.mjs';
import os from 'node:os';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function lintFrames(film, { lfps = 12, scope = null } = {}) {
  const fps = Math.min(lfps, 8), layout = [], small = [], n = Math.floor(film.duration * fps + 1e-9);
  for (let i = 0; i <= film.duration * fps; i++) { const t = i / fps; if (scope && (t < scope.t0 || t > scope.t1)) continue; layout.push({ t, px: false, guard: true }); }
  for (const s of film.shots) if (s.compose !== 'free' && (!scope || scope.ids.has(s.id))) layout.push({ t: (s.t[0] + s.t[1]) / 2, px: true, guard: true });
  const m = Math.round(film.duration * lfps), f0 = scope ? Math.max(0, Math.floor(scope.t0 * lfps) - 3) : 0, f1 = scope ? Math.min(m, Math.ceil(scope.t1 * lfps) + 3) : m;
  for (let i = f0; i <= f1; i++) small.push({ t: i / lfps, px: true });
  void n; return { layout, small };
}

const MIN_FRAMES = +(process.env.OPUS_WARM_MIN ?? 160);                       // por debajo, arrancar procesos cuesta más que renderizar
export async function prewarm({ film, FCL, FCS_, lfps, scope, needLayout = true, needSmall = true }) {
  if (process.env.OPUS_NOCACHE === '1' || process.env.OPUS_WARM === '0') return 0;
  const cpus = os.availableParallelism?.() ?? os.cpus().length; if (cpus < 4) return 0;
  const F = lintFrames(film, { lfps, scope }), jobs = [needLayout ? FCL.missing(F.layout) : [], needSmall ? FCS_.missing(F.small) : []];
  const total = jobs[0].length + jobs[1].length; if (total < MIN_FRAMES) return 0;
  const k = Math.max(2, Math.min(cpus - 2, Math.ceil(total / 40))), me = fileURLToPath(import.meta.url);
  const sc = scope ? `${scope.t0}:${scope.t1}:${[...scope.ids].join(',')}` : '';
  const sz = process.argv.includes('--size') ? process.argv[process.argv.indexOf('--size') + 1] : null;
  const run = (i) => new Promise((res) => {
    const p = spawn(process.execPath, [me, '--slice', `${i}/${k}`, '--lfps', String(lfps), '--need', `${needLayout ? 'L' : ''}${needSmall ? 'S' : ''}`, ...(sz ? ['--size', sz] : []), ...(sc ? ['--scope', sc] : [])], { stdio: ['ignore', 'ignore', 'inherit'], env: process.env });
    p.on('close', () => res()); p.on('error', () => res());                     // si un hijo falla, el lint renderiza lo que falte por su cuenta
  });
  // cada hijo hace su porción de TODO lo que falte (layout y small), así el reparto es parejo
  await Promise.all(Array.from({ length: k }, (_, i) => run(i)));
  return total;
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const { makeRenderer } = await import('./render.mjs'), { frameCache } = await import('./framecache.mjs'), { guardCtx } = await import('./guard.mjs');
  const [si, sk] = arg('--slice', '0/1').split('/').map(Number), lfps = +arg('--lfps', 12), sz = arg('--size', undefined), sc = arg('--scope', '');
  const R = await makeRenderer({ size: sz, grade: false }), film = R.film;
  const scope = sc ? (([a, b, ids]) => ({ t0: +a, t1: +b, ids: new Set(ids.split(',')) }))(sc.split(':')) : null;
  const small = `192x${Math.round((192 * film.height) / film.width / 2) * 2}`;
  let R2 = null;
  const FCL = frameCache({ film, size: sz, grade: false, make: async () => R }), FCS_ = frameCache({ film, size: small, grade: false, make: async () => (R2 ??= await makeRenderer({ size: small, grade: false })) });
  const F = lintFrames(film, { lfps, scope }), need = arg('--need', 'LS'), mine = (l) => l.filter((_, j) => j % sk === si);   // se reparte la lista COMPLETA (determinista), luego cada hijo filtra lo que falta
  if (need.includes('L')) for (const it of FCL.missing(mine(F.layout))) await FCL.get(it.t, { px: it.px, guard: it.guard ? guardCtx : null });
  if (need.includes('S')) for (const it of FCS_.missing(mine(F.small))) await FCS_.get(it.t, { px: it.px });
  process.exit(0);
}
