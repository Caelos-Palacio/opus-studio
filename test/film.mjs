#!/usr/bin/env node
// P1 (docs/EFICIENCIA.md): film activo explícito. `opus use <film>` → out/.film; un único resolvedor (filmid.mjs/film.mjs);
// toda CLI imprime en su 1.ª línea «film: <clave> (<ruta>, fuente: flag|env|use|demo)»; `--help` real sin ejecutar nada.
// Corre en una copia temporal (nunca toca el out/.film real).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, copyRepo, rmrf, run } from './lib.mjs';

let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('  ✗ film:', m); } };
const d = copyRepo();
const first = (r) => (r.stdout + r.stderr).split('\n').find((l) => l.trim()) ?? '';
const FL = /^film: (\S+) \(([^,]+), fuente: (flag|env|use|demo)\)$/;
try {
  // 1. sin nada: demo
  let r = await run(['engine/lint.mjs', '--only', 'validate'], { cwd: d, env: { OPUS_TIMELINE: '' }, timeout: 120000 });   // OPUS_TIMELINE vacío cuenta como ausente
  let m = FL.exec(first(r)); ok(m && m[1] === 'main' && m[2] === 'data/timeline.json' && m[3] === 'demo', `sin use/env/flag → demo (1.ª línea: «${first(r)}»)`);
  // 2. use mate
  r = await run(['engine/opus.mjs', 'use', 'mate'], { cwd: d, env: { OPUS_TIMELINE: '' } });
  ok(r.status === 0 && fs.existsSync(path.join(d, 'out/.film')), `use mate escribe out/.film (${r.stderr.trim()})`);
  ok(fs.existsSync(path.join(d, 'out/.film')) && fs.readFileSync(path.join(d, 'out/.film'), 'utf8').trim() === 'data/mate/timeline.json', 'out/.film contiene la ruta del timeline');
  r = await run(['engine/opus.mjs', 'use', 'inexistente-xyz'], { cwd: d, env: { OPUS_TIMELINE: '' } });
  ok(r.status !== 0 && /inexistente-xyz/.test(r.stderr + r.stdout), 'use <film desconocido> falla con mensaje claro');
  // 3. prioridad flag > env > use > demo
  const E = { OPUS_TIMELINE: '' };
  r = await run(['engine/lint.mjs', '--only', 'validate'], { cwd: d, env: E });
  m = FL.exec(first(r)); ok(m && m[1] === 'mate' && m[2] === 'data/mate/timeline.json' && m[3] === 'use', `use manda sobre demo («${first(r)}»)`);
  r = await run(['engine/lint.mjs', '--only', 'validate'], { cwd: d, env: { OPUS_TIMELINE: 'data/reel/timeline.json' } });
  m = FL.exec(first(r)); ok(m && m[1] === 'reel' && m[3] === 'env', `env manda sobre use («${first(r)}»)`);
  r = await run(['engine/lint.mjs', '--only', 'validate', '--timeline', 'data/regla/regla.json'], { cwd: d, env: { OPUS_TIMELINE: 'data/reel/timeline.json' } });
  m = FL.exec(first(r)); ok(m && m[1] === 'regla' && m[3] === 'flag', `flag manda sobre env («${first(r)}»)`);
  // 4. otras CLI baratas con use mate: 1.ª línea + derivación de memoria/story de la carpeta del film
  r = await run(['engine/memoria.mjs', 'final'], { cwd: d, env: E });
  m = FL.exec(first(r)); ok(m && m[1] === 'mate' && m[3] === 'use', `memoria imprime el film («${first(r)}»)`);
  ok(/data\/mate\/memoria\.json/.test(r.stdout), 'memoria deriva data/mate/memoria.json de la carpeta del film');
  r = await run(['engine/memoria.mjs', 'final', '--json'], { cwd: d, env: E });
  ok(!!(() => { try { JSON.parse(r.stdout); return true; } catch { return false; } })(), 'memoria --json: stdout sigue siendo JSON puro (la línea film va a stderr)');
  r = await run(['engine/arc.mjs', '--fps', '2'], { cwd: d, env: E });
  m = FL.exec(first(r)); ok(m && m[1] === 'mate', `arc imprime el film («${first(r)}»)`);
  ok(/data\/mate\/story\.json/.test(r.stdout + r.stderr), 'arc deriva data/mate/story.json de la carpeta del film');
  r = await run(['engine/params.mjs', 'list'], { cwd: d, env: E });
  m = FL.exec(first(r)); ok(m && m[1] === 'mate', `params imprime el film («${first(r)}»)`);
  // 5. use demo vuelve al demo
  await run(['engine/opus.mjs', 'use', 'demo'], { cwd: d, env: E });
  r = await run(['engine/lint.mjs', '--only', 'validate'], { cwd: d, env: E });
  m = FL.exec(first(r)); ok(m && m[1] === 'main', `use demo → main («${first(r)}»)`);
  // 6. las demás CLI: importan el resolvedor y anuncian el film (estático; ejecutarlas costaría minutos)
  for (const f of ['lint', 'arc', 'memoria', 'sound', 'cut', 'critic', 'index', 'q', 'autocam', 'params', 'render']) {
    const s = fs.readFileSync(path.join(ROOT, `engine/${f}.mjs`), 'utf8'); ok(/announceFilm\(/.test(s), `${f}.mjs llama announceFilm()`);
  }
  // 7. --help real en todas las CLI: exit 0, rápido, imprime uso, no ejecuta ni escribe nada
  const before = fs.existsSync(path.join(d, 'out')) ? fs.readdirSync(path.join(d, 'out')).sort().join() : '';
  for (const f of ['lint', 'arc', 'memoria', 'sound', 'cut', 'critic', 'index', 'q', 'autocam', 'params', 'render', 'grid', 'score', 'assets', 'opus', 'peek']) {
    const t0 = Date.now(); r = await run([`engine/${f}.mjs`, '--help'], { cwd: d, env: E, timeout: 20000 });
    ok(r.status === 0 && new RegExp(`engine/${f}\\.mjs|opus|peek`, 'i').test(r.stdout) && !/^film:/m.test(r.stdout) && Date.now() - t0 < 8000, `${f} --help: exit ${r.status}, ${Date.now() - t0} ms, «${r.stdout.split('\n')[0].slice(0, 60)}»`);
  }
  const after = fs.existsSync(path.join(d, 'out')) ? fs.readdirSync(path.join(d, 'out')).sort().join() : '';
  ok(before === after, `--help no escribe nada en out/ (${before} → ${after})`);
  // 8. P2: `master` escribe out/<film>.mp4 (el demo conserva out/master.mp4 por compatibilidad)
  const { masterFile } = await import('../engine/cut.mjs');
  ok(typeof masterFile === 'function' && masterFile('main') === 'out/master.mp4', 'master del demo: out/master.mp4');
  ok(typeof masterFile === 'function' && masterFile('mate') === 'out/mate.mp4' && masterFile('reel', true) === 'out/reel.review.mp4', 'master de un film: out/<film>.mp4 (y .review.mp4)');
  // 9. P5: peek = hoja de contacto 4×3 de baja resolución, sin master, en < 10 s (en la suite bajo carga se tolera 25 s)
  const canvas = (await import('canvas')).default, dim = (f) => { const im = new canvas.Image(); im.src = fs.readFileSync(f); return [im.width, im.height]; };
  let t0 = Date.now(); r = await run(['engine/peek.mjs', 'mate'], { cwd: d, env: E, timeout: 60000 }); const dt = Date.now() - t0;
  m = FL.exec(first(r)); ok(m && m[1] === 'mate' && m[3] === 'flag', `peek mate imprime el film («${first(r)}»)`);
  const jf = path.join(d, 'out/peek/mate.jpg'); ok(r.status === 0 && fs.existsSync(jf), `peek escribe out/peek/mate.jpg (${(r.stderr || r.stdout).slice(-200)})`);
  if (fs.existsSync(jf)) { const b = fs.readFileSync(jf), [w, h] = dim(jf); ok(b[0] === 0xff && b[1] === 0xd8, 'es un JPEG'); ok(w <= 2000 && h <= 1200 && w / h > 1.2 && w / h < 2.2, `hoja 4×3 (${w}×${h}) de baja resolución`); }
  ok(dt < 25000, `peek mate tarda ${dt} ms (objetivo < 10 s en máquina libre; tolerancia 25 s bajo carga)`);
  r = await run(['engine/peek.mjs', 'mate', '--t', '1,20,40'], { cwd: d, env: E, timeout: 60000 });
  ok(r.status === 0 && /1\.00s|3 fotogramas|3 frames/.test(r.stdout), `peek --t 1,20,40 renderiza esos 3 instantes («${r.stdout.trim().split('\n').pop()}»)`);
  if (fs.existsSync(jf)) { const [, h2] = dim(jf); ok(h2 > 0, 'hoja con --t válida'); }
} finally { rmrf(d); }
console.log(`${bad ? '✗' : '✓'} film activo     ${n - bad}/${n}`); process.exit(bad ? 1 : 0);
