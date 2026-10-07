// Manifiesto de suites de `npm test`. UNA línea por suite; test/run.mjs solo lo recorre.
//   { name, file, args?, stderr? , skip? }
//     name   : lo que acepta `--only <name>`; se imprime en el resumen de tiempos.
//     file   : script autónomo (imprime sus ✓/✗ y sale con código ≠ 0 si falla).
//     args   : argumentos extra, o por perfil: { fast: [...], quick: [...], full: [...] } (lo no listado = []).
//     skip   : perfiles en los que NO corre, p. ej. ['fast'].  (Documenta en docs/handoff/deuda2.md qué pierde cada perfil.)
//     stderr : false si su stderr son avisos esperados (se omite del informe).
//   Perfiles (docs/handoff/deuda2.md): fast (iterar, ~1 min) < quick (`npm test`, < 240 s, TODAS las suites con fixtures reducidas) < full (`npm test -- --full` / `npm run test:nightly`, todo).
//   Cada suite recibe el perfil en OPUS_TEST_PROFILE (leído con `PROFILE`/`FULL` de test/lib.mjs) y decide qué reduce; nunca borra un escenario sin que otro perfil lo corra.
// Registrar una suite nueva: añade AQUÍ una línea, o (sin conflictos de merge entre ramas) un archivo test/suites.d/<name>.json con el mismo objeto.
export const SUITES = [
  { name: 'golden', file: 'test/golden.mjs' },
  { name: 'cut', file: 'test/cut-render.mjs', skip: ['fast'] },
  { name: 'unit', file: 'test/unit.mjs' },
  { name: 'schema', file: 'test/schema.mjs' },
  { name: 'critic', file: 'test/critic.mjs' },
  { name: 'gov', file: 'test/gov.mjs' },
  { name: 'guard', file: 'test/guard.mjs', stderr: false },
  { name: 'hash', file: 'test/hash.mjs' },
  { name: 'params', file: 'test/params.mjs' },
  { name: 'memoria', file: 'test/memoria.mjs' },
  { name: 'arc', file: 'test/arc.mjs' },
  { name: 'sound', file: 'test/sound.mjs', args: { fast: ['--fast'], quick: ['--fast'] } },   // fast/quick: fixture ×0,6 (mismo código y reglas); full: los 78 s de Potencias
  { name: 'film', file: 'test/film.mjs' },
  { name: 'perf', file: 'test/perf.mjs' },
  { name: 'orch', file: 'test/orch.mjs' },
  { name: 'medios', file: 'test/medios.mjs' },
  { name: 'world3d', file: 'test/world3d.mjs' },
  { name: 'metrics', file: 'test/metrics.mjs' },
  { name: 'fondo', file: 'test/fondo.mjs' },
  { name: 'harness', file: 'test/harness.mjs' },
  { name: 'narr', file: 'test/narr.mjs' },
  { name: 'fuzz', file: 'test/fuzz.mjs' },
  { name: 'orquestacion', file: 'test/orquestacion.mjs' },
  { name: 'semantica', file: 'test/semantica.mjs', args: { fast: ['--fast'] } },
  { name: 'dsl-cov', file: 'test/dsl-cov.mjs', args: { fast: ['--fast'] } },
  { name: 'motor', file: 'test/motor.mjs' },
  { name: 'prores', file: 'test/prores.mjs' },   // F6: cut --prores/--alpha
];
