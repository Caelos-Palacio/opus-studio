// `--help` real: importado PRIMERO por cada CLI, imprime la cabecera del script y sale ANTES de ejecutar nada (ni análisis por defecto).
import fs from 'node:fs';
import path from 'node:path';
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  const f = process.argv[1], rel = 'engine/' + path.basename(f ?? 'opus.mjs'), out = [`Uso: node ${rel} [opciones]`];
  try { for (const l of fs.readFileSync(f, 'utf8').split('\n').slice(1)) { if (!l.startsWith('//')) break; out.push(l.replace(/^\/\/ ?/, '')); } } catch {}
  out.push('', 'Film activo: --timeline X > OPUS_TIMELINE > out/.film (`npm run use -- <film>`) > demo.');
  console.log(out.join('\n')); process.exit(0);
}
