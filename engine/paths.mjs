// Rutas del repo: ÚNICA fuente. Todo `new URL(import.meta.url).pathname` rompe con espacios/acentos (queda %20-codificado)
// y la detección de «soy el script principal» por `file://${argv[1]}` falla con espacios y symlinks. Usar estos helpers.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const here = (metaUrl) => path.dirname(fileURLToPath(metaUrl));                 // dirname del módulo
export const ROOT = path.resolve(here(import.meta.url), '..');                           // raíz del repo (engine/ está en <ROOT>/engine)
export const rootFrom = (metaUrl, up = 1) => path.resolve(here(metaUrl), ...Array(up).fill('..'));
const real = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
// Ruta real aunque el fichero aún no exista: resuelve symlinks del ancestro existente más cercano y re-añade el resto
// (macOS: /var → /private/var; un repo bajo un symlink). Sin ancestro resoluble devuelve path.resolve(p).
export const realish = (p) => {
  let a = path.resolve(p); const tail = [];
  for (;;) { try { return path.join(fs.realpathSync(a), ...tail); } catch { const up = path.dirname(a); if (up === a) return path.resolve(p); tail.unshift(path.basename(a)); a = up; } }
};
// ¿Este módulo es el punto de entrada? Compara rutas reales (resuelve symlinks), no cadenas de URL.
export const isMain = (metaUrl, argv1 = process.argv[1]) => !!argv1 && real(fileURLToPath(metaUrl)) === real(argv1);
