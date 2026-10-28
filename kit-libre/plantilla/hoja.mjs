// hoja.mjs: node hoja.mjs [mp4] [jpg]. Hoja de contacto de 12 fotogramas del mp4 (por defecto salida/final.mp4).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hojaContacto } from '../kit/render.mjs';

const d = path.join(path.dirname(fileURLToPath(import.meta.url)), 'salida');
console.log(await hojaContacto(process.argv[2] ?? path.join(d, 'final.mp4'), process.argv[3] ?? path.join(d, 'hoja.jpg')));
