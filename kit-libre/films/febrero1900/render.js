// render.js: node render.js [--preview] [--dur S] [--audio] [--salida ruta]. Audio -> video en paralelo -> medida -> hoja.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderizar, hojaContacto } from '../../kit/render.mjs';
import { escribirWav, medir } from '../../kit/audio.mjs';
import { audioFilm } from './audio.js';
import * as TL from './timeline.js';

const aqui = path.dirname(fileURLToPath(import.meta.url)), A = process.argv, arg = (n, d) => A.includes(n) ? A[A.indexOf(n) + 1] : d, prev = A.includes('--preview');
const salida = path.resolve(arg('--salida', path.join(aqui, 'salida', prev ? 'preview.mp4' : 'final.mp4'))), dur = parseFloat(arg('--dur', TL.dur));
fs.mkdirSync(path.dirname(salida), { recursive: true });
let audio = null;
if (!prev || A.includes('--audio')) { audio = path.join(path.dirname(salida), 'audio.wav'); escribirWav(audioFilm(), audio); }
await renderizar({ modulo: path.join(aqui, 'frame.js'), W: TL.W, H: TL.H, fps: prev ? 12 : TL.fps, dur, escala: prev ? 0.25 : 1, salida, audio });
if (audio) console.log('audio', medir(salida));
if (!prev) console.log('hoja', await hojaContacto(salida, path.join(path.dirname(salida), 'hoja.jpg')));
