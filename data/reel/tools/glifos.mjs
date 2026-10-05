// Segunda mitad: añade el kerning (medido con node-canvas, que aplica el de la fuente) y escribe shots/K_glifos.mjs.
import fs from 'node:fs';
import canvasPkg from 'canvas';
const J = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), x = canvasPkg.createCanvas(10, 10).getContext('2d');
x.font = '900 1000px "Lato"';
const w = (s) => x.measureText(s).width / 1000, chars = Object.keys(J.glyphs).filter((c) => c !== ' '), kern = {};
for (const a of chars) for (const b of chars) { const k = +(w(a + b) - w(a) - w(b)).toFixed(4); if (Math.abs(k) > 0.004) kern[a + b] = k; }
const body = `// GENERADO por data/reel/tools/glifos.py + glifos.mjs (Lato Black, unidades de em, y hacia abajo, línea base en y=0). No editar.
// El motor no tiene glifo→trazo (solo MathJax): la tipografía cinética del reel necesita geometría por letra (romper, recomponer, recortar).
export const CAP = ${+J.cap.toFixed(4)};
export const GLYPHS = ${JSON.stringify(J.glyphs)};
export const KERN = ${JSON.stringify(kern)};
`;
fs.writeFileSync(new URL('../../../shots/K_glifos.mjs', import.meta.url), body);
console.log('→ shots/K_glifos.mjs', chars.length, 'glifos,', Object.keys(kern).length, 'pares de kerning');
