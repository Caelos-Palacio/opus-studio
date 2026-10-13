// muestra.mjs: node muestra.mjs -> muestra.jpg, lamina con cada material y forma etiquetados (revision visual rapida).
import { createCanvas } from 'canvas';
import fs from 'node:fs';
import * as M from './kit/materia.mjs';
import * as F from './kit/formas.mjs';
import { texto, cifrasTabulares, contraste } from './kit/texto.mjs';

const CW = 480, CH = 300, c = createCanvas(4 * CW, 4 * (CH + 30)), g = c.getContext('2d');
const contorno = (p) => [...p.map(([y, r]) => [-r, y]), ...[...p].reverse().map(([y, r]) => [r, y])];
const botella = F.perfil([[-110, 9], [-92, 9], [-78, 14], [-35, 38], [80, 38], [105, 34]], 2);
const celdas = [
  ['papel(ctx,W,H,{tono,fibra})', (g) => { M.papel(g, CW, CH, { tono: '#e9dcc0', fibra: 300, seed: 2 }); }],
  ['acuarela(ctx,poligono,{capas})', (g) => { M.papel(g, CW, CH, { seed: 3 }); const b = [[0, -1], [0.9, -0.6], [1, 0.3], [0.4, 1], [-0.6, 0.9], [-1, 0.1], [-0.7, -0.7]]; M.acuarela(g, b.map(([x, y]) => [190 + x * 110, 150 + y * 95]), { color: '#3d7f8c', seed: 2 }); M.acuarela(g, b.map(([x, y]) => [320 + y * 60, 190 + x * 55]), { color: '#d49a3a', seed: 6, capas: 28 }); }],
  ['agua(ctx,W,H,t,{causticas})', (g) => M.agua(g, CW, CH, 2.3, { particulas: 45 })],
  ['vidrio(ctx,path,{tinte})', (g) => { M.papel(g, CW, CH, { seed: 4 }); ['#c8553d', '#3d7f8c', '#d49a3a', '#6a4c93', '#2f6d4f'].forEach((k, i) => { g.fillStyle = k; g.fillRect(40 + i * 85, 20, 45, 260); }); M.vidrio(g, contorno(botella).map(([x, y]) => [x * 1.4 + 240, y * 1.2 + 150]), { tinte: '#9fd4cc' }); }],
  ['tinta(ctx,x,y,r,lt,seed)', (g) => { M.papel(g, CW, CH, { seed: 5 }); M.tinta(g, 240, 150, 120, 1.6, 3); }],
  ['metal(ctx,x,y,r,{desgaste})', (g) => { g.fillStyle = '#2d2c31'; g.fillRect(0, 0, CW, CH); F.sombraContacto(g, 170, 235, 80); F.sombraContacto(g, 335, 235, 55); M.metal(g, 170, 150, 82); M.metal(g, 335, 175, 56, { tono: '#9fa7ad', desgaste: 0.8, seed: 3 }); }],
  ['grano(ctx,..,frame) + vineta', (g) => { const q = g.createLinearGradient(0, 0, CW, CH); q.addColorStop(0, '#8aa0aa'); q.addColorStop(1, '#4b5d68'); g.fillStyle = q; g.fillRect(0, 0, CW, CH); M.grano(g, CW, CH, 7, 0.08); M.vineta(g, CW, CH, 0.55); }],
  ['torno(perfil,{luz}) botella', (g) => { M.papel(g, CW, CH, { seed: 6 }); F.sombraContacto(g, 240, 262, 70); F.torno(g, botella, { x: 240, y: 150, tono: '#3f8a64', luz: -0.55 }); }],
  ['torno: jarra y moneda de canto', (g) => { M.papel(g, CW, CH, { seed: 7 }); F.sombraContacto(g, 150, 262, 80); F.torno(g, F.perfil([[-100, 52], [-90, 60], [-60, 66], [70, 66], [95, 52], [105, 50]]), { x: 150, y: 160, tono: '#b8613a', luz: -0.5 }); F.sombraContacto(g, 350, 262, 45, { ry: 8 }); F.torno(g, F.perfil([[-12, 55], [12, 55]]), { x: 350, y: 205, rot: Math.PI / 2, tono: '#b99a5b', estrias: true, luz: -0.6 }); }],
  ['tubo(puntos,{grosor,variacion})', (g) => { M.papel(g, CW, CH, { seed: 8 }); F.tubo(g, [[40, 230], [150, 90], [260, 220], [360, 80], [450, 190]], { grosor: 16, variacion: 0.25, seed: 4 }); }],
  ['catenaria(a,b,caida)', (g) => { M.papel(g, CW, CH, { seed: 9 }); F.solido(g, [[40, 270], [75, 262], [80, 275], [45, 283]], 200, '#6c5a49'); F.solido(g, [[400, 270], [435, 262], [440, 275], [405, 283]], 200, '#6c5a49'); F.tubo(g, F.catenaria([60, 78], [420, 78], 90), { grosor: 8, color: '#8c6b42', seed: 2 }); }],
  ['red(...): nudos y cuerdas', (g) => { M.papel(g, CW, CH, { seed: 10 }); F.red(g, { x: 50, y: 40, w: 380, h: 220, cols: 6, filas: 4, grosor: 4, seed: 3 }); }],
  ['solido(plan,alto,tonos)', (g) => { M.papel(g, CW, CH, { seed: 11 }); F.sombraContacto(g, 160, 250, 110, { alfa: 0.3 }); F.solido(g, [[70, 250], [190, 225], [250, 255], [130, 285]], 110, '#8a7ba8'); F.solido(g, [[290, 240], [370, 225], [420, 245], [340, 265]], 60, '#c0704a'); }],
  ['sombraContacto(ctx,x,y,rx)', (g) => { M.papel(g, CW, CH, { seed: 12 }); const taza = F.perfil([[-45, 50], [-40, 54], [40, 42], [48, 36]]); F.sombraContacto(g, 130, 250, 70); F.torno(g, taza, { x: 130, y: 205, tono: '#3d7f8c', luz: -0.5 }); F.torno(g, taza, { x: 350, y: 140, tono: '#3d7f8c', luz: -0.5 }); }],
  ['trazoMano(ctx,puntos,{presion})', (g) => { M.papel(g, CW, CH, { seed: 13 }); const P = Array.from({ length: 40 }, (_, i) => [40 + i * 10.5, 160 + 60 * Math.sin(i * 0.35) * Math.cos(i * 0.12)]); F.trazoMano(g, P, { tam: 12, color: '#1f2a36', seed: 2 }); F.trazoMano(g, [[60, 250], [180, 238], [300, 252], [430, 240]], { tam: 6, color: '#a8452f' }); }],
  ['texto / cifrasTabulares / contraste', (g) => { M.papel(g, CW, CH, { seed: 14 }); texto(g, 'Texto serif', 30, 30, { tam: 52, peso: 'bold', color: '#1f2a36' }); texto(g, 'mono: 0123456789', 30, 100, { tam: 28, mono: true, color: '#3a3f46' }); cifrasTabulares(g, 12345.6, 30, 150, { tam: 64, decimales: 1, color: '#1f2a36' }); texto(g, `contraste ${contraste('#1f2a36', '#e9dcc0').toFixed(1)}:1`, 30, 240, { tam: 30, color: '#a8452f', fondoVelo: '#ffffff' }); }],
];
g.fillStyle = '#17171a'; g.fillRect(0, 0, c.width, c.height);
celdas.forEach(([nombre, fn], i) => {
  const x = (i % 4) * CW, y = Math.floor(i / 4) * (CH + 30); g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, CW, CH); g.clip(); fn(g); g.restore();
  g.fillStyle = '#17171a'; g.fillRect(x, y + CH, CW, 30); texto(g, nombre, x + 12, y + CH + 6, { tam: 17, mono: true, color: '#e8e2d0' });
});
fs.writeFileSync(new URL('./muestra.jpg', import.meta.url), c.toBuffer('image/jpeg', { quality: 0.9 })); console.log('muestra.jpg');
