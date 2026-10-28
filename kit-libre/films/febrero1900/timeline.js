// timeline.js: UNICA fuente de tiempos. Hoja de calculo vertical 9:16. Imagen y sonido leen de aqui.
export const fps = 30, W = 1080, H = 1920;
const D = [['tecleo', 3.8], ['bisiesto', 2.5], ['baja', 6.5], ['respiro', 4.2], ['lotus', 3.0], ['desplaza', 4.4], ['cierre', 3.2]];
let a = 0;
export const escenas = D.map(([id, dur]) => { const e = { id, t0: a, dur, sujeto: { x: 0, y: 0, w: 1080, h: 1920 } }; a += dur; return e; });
export const dur = a;
// cruces[i]: segundos del scroll entre la escena i y la i+1 (la i+1 ya vive durante el cruce)
export const cruces = [0.7, 0.6, 0.9, 0.8, 0.7, 0.7];
// A60: la escena 'baja' baja de la fila 1 a la 60 y aterriza en TLAND (momento memorable).
export const TLAND = 9.0, TBAJA0 = 6.9; // empieza a bajar en 6.9, aterriza en 9.0
export const teclasT = [0.55, 0.74, 0.9, 1.1, 1.22, 1.38, 1.55, 1.7, 1.86, 2.02];
const teclas = teclasT.map((t) => ({ t, tipo: 'clic' }));
const filas = Array.from({ length: 11 }, (_, i) => { const u = i / 10; return { t: +(TBAJA0 + (TLAND - TBAJA0) * (1 - Math.pow(1 - u, 1.8)) * 0.97).toFixed(3), tipo: 'clic' }; });
export const eventos = [...teclas, { t: 2.35, tipo: 'golpe' }, { t: 4.9, tipo: 'clic' }, ...filas, { t: TLAND, tipo: 'golpe' }, { t: 14.4, tipo: 'clic' }, { t: 17.9, tipo: 'papel' }, { t: 20.9, tipo: 'moneda' }, ...Array.from({ length: 12 }, (_, i) => ({ t: +(20.9 + i * 0.16).toFixed(2), tipo: 'clic', gan: 0.3 })), { t: 25.3, tipo: 'clic' }];
export const notas = []; // sin piano: la musica no hace falta
