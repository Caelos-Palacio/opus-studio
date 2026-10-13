// muestra.mjs: node muestra.mjs -> muestra.jpg, lamina con cada material y forma etiquetados (revision visual rapida).
import { createCanvas } from 'canvas';
import fs from 'node:fs';
import * as M from './kit/materia.mjs';
import * as F from './kit/formas.mjs';
import { texto, cifrasTabulares, contraste, escribirse } from './kit/texto.mjs';
import * as O from './kit/objetos.mjs';
import * as X from './kit/transiciones.mjs';
import * as G from './kit/mapa.mjs';

const CW = 480, CH = 300, COLS = 4;
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
  ['torno: sombreado continuo (esfera, jarra)', (g) => { M.papel(g, CW, CH, { seed: 7 }); F.sombraContacto(g, 150, 262, 80); F.torno(g, F.perfil([[-100, 52], [-90, 60], [-60, 66], [70, 66], [95, 52], [105, 50]]), { x: 150, y: 160, tono: '#b8613a', luz: -0.5 }); F.sombraContacto(g, 350, 262, 70, { ry: 10 }); F.torno(g, F.perfil(Array.from({ length: 61 }, (_, i) => { const a = Math.PI * i / 60; return [-70 * Math.cos(a), 70 * Math.sin(a)]; }), 1), { x: 350, y: 190, tono: '#3d7f8c', luz: -0.55, reflejo: false }); }],
  ['tubo(puntos,{grosor,variacion})', (g) => { M.papel(g, CW, CH, { seed: 8 }); F.tubo(g, [[40, 230], [150, 90], [260, 220], [360, 80], [450, 190]], { grosor: 16, variacion: 0.25, seed: 4 }); }],
  ['catenaria(a,b,caida)', (g) => { M.papel(g, CW, CH, { seed: 9 }); F.solido(g, [[40, 270], [75, 262], [80, 275], [45, 283]], 200, '#6c5a49'); F.solido(g, [[400, 270], [435, 262], [440, 275], [405, 283]], 200, '#6c5a49'); F.tubo(g, F.catenaria([60, 78], [420, 78], 90), { grosor: 8, color: '#8c6b42', seed: 2 }); }],
  ['red(...): nudos y cuerdas', (g) => { M.papel(g, CW, CH, { seed: 10 }); F.red(g, { x: 50, y: 40, w: 380, h: 220, cols: 6, filas: 4, grosor: 4, seed: 3 }); }],
  ['solido(plan,alto,tonos)', (g) => { M.papel(g, CW, CH, { seed: 11 }); F.sombraContacto(g, 160, 250, 110, { alfa: 0.3 }); F.solido(g, [[70, 250], [190, 225], [250, 255], [130, 285]], 110, '#8a7ba8'); F.solido(g, [[290, 240], [370, 225], [420, 245], [340, 265]], 60, '#c0704a'); }],
  ['sombraContacto(ctx,x,y,rx)', (g) => { M.papel(g, CW, CH, { seed: 12 }); const taza = F.perfil([[-45, 50], [-40, 54], [40, 42], [48, 36]]); F.sombraContacto(g, 130, 250, 70); F.torno(g, taza, { x: 130, y: 205, tono: '#3d7f8c', luz: -0.5 }); F.torno(g, taza, { x: 350, y: 140, tono: '#3d7f8c', luz: -0.5 }); }],
  ['trazoMano(ctx,puntos,{presion})', (g) => { M.papel(g, CW, CH, { seed: 13 }); const P = Array.from({ length: 40 }, (_, i) => [40 + i * 10.5, 160 + 60 * Math.sin(i * 0.35) * Math.cos(i * 0.12)]); F.trazoMano(g, P, { tam: 12, color: '#1f2a36', seed: 2 }); F.trazoMano(g, [[60, 250], [180, 238], [300, 252], [430, 240]], { tam: 6, color: '#a8452f' }); }],
  ['texto / cifrasTabulares / contraste', (g) => { M.papel(g, CW, CH, { seed: 14 }); texto(g, 'Texto serif', 30, 30, { tam: 52, peso: 'bold', color: '#1f2a36' }); texto(g, 'mono: 0123456789', 30, 100, { tam: 28, mono: true, color: '#3a3f46' }); cifrasTabulares(g, 12345.6, 30, 150, { tam: 64, decimales: 1, color: '#1f2a36' }); texto(g, `contraste ${contraste('#1f2a36', '#e9dcc0').toFixed(1)}:1`, 30, 240, { tam: 30, color: '#a8452f', fondoVelo: '#ffffff' }); }],
];
const A = (g) => { M.papel(g, CW, CH, { seed: 2 }); g.fillStyle = '#c8553d'; g.beginPath(); g.arc(240, 150, 80, 0, 7); g.fill(); texto(g, 'A', 30, 20, { tam: 60, peso: 'bold' }); };
const B = (g) => { M.agua(g, CW, CH, 2, { particulas: 30 }); g.fillStyle = '#f4efe2'; g.fillRect(200, 80, 60, 140); texto(g, 'B', 30, 20, { tam: 60, peso: 'bold', color: '#f4efe2' }); };
const enc = G.encuadre({ lon0: -12, lat0: 42, lon1: 8, lat1: 56 }, CW, CH), enc2 = G.encuadre({ lon0: -25, lat0: 35, lon1: 30, lat1: 72 }, CW, CH), P = (lo, la) => G.proyectar(lo, la, enc);
const mapaCelda = (estilo) => (g) => { G.dibujarCostas(g, enc, { estilo }); G.graticula(g, enc); const o = P(-4.5, 48.4), d = P(-8.5, 51.9); G.ruta(g, o, d, 0.85, { esc: 0.4 }); G.marcador(g, { x: o[0], y: o[1], nombre: 'Origen' }, { esc: 0.4 }); };
const tr = (f, o = {}) => (g) => { const t = createCanvas(CW, CH); f(t.getContext('2d'), 0.5, A, B, o); g.drawImage(t, 0, 0); }; // las transiciones usan el tamano del canvas: cada una en el suyo
const nuevas = [
  ['botella: vidrio, labio, hombro, fondo, corcho', (g) => { M.agua(g, CW, CH, 2, { particulas: 30 }); O.botella(g, { x: 240, y: 150, alto: 280, lleno: 0.4, algas: 0.7, t: 1 }); }],
  ['botella girada: el agua sigue horizontal', (g) => { M.agua(g, CW, CH, 4, { particulas: 30 }); O.botella(g, { x: 240, y: 150, alto: 420, rot: 1.3, lleno: 0.55, lastre: 0.2, algas: 1, t: 2, seed: 8 }); }],
  ['moneda({cara:"perfil", leyenda, desgaste})', (g) => { M.papel(g, CW, CH, { seed: 3, tono: '#d8cdb4' }); O.moneda(g, { x: 160, y: 150, r: 100, desgaste: 0.3 }); O.moneda(g, { x: 365, y: 150, r: 100, cara: 'escudo', leyenda: 'PAX ET LABOR', desgaste: 0.8 }); }],
  ['moneda({giro}): de frente a de canto', (g) => { M.papel(g, CW, CH, { seed: 3, tono: '#d8cdb4' }); [0.45, 0.95, 1.35, Math.PI / 2].forEach((q, i) => O.moneda(g, { x: 60 + i * 120, y: 150, r: 52, giro: q, leyenda: 'ANNUS' })); }],
  ['sobre({abierto, sello}): 0, 0.5 y 1', (g) => { M.papel(g, CW, CH, { seed: 5, tono: '#d8cdb4' }); O.sobre(g, { x: 80, y: 170, w: 140, abierto: 0 }); O.sobre(g, { x: 240, y: 190, w: 140, abierto: 0.55 }); O.sobre(g, { x: 400, y: 190, w: 140, abierto: 1 }); }],
  ['tarjeta({lineas, sello, doblez})', (g) => { M.papel(g, CW, CH, { seed: 6, tono: '#d8cdb4' }); O.tarjeta(g, { x: 240, y: 150, w: 400, h: 250, tam: 26, rot: -0.04, lineas: ['Marianne Wink', 'Calle del Faro, 14, Puerto Viejo', 'Llegare con la marea.'] }); }],
  ['sello({texto, golpe}) + almohadilla', (g) => { M.papel(g, CW, CH, { seed: 7, tono: '#d8cdb4' }); O.sello(g, { x: 150, y: 250, tam: 150, golpe: 0.25, almohadilla: true }); O.sello(g, { x: 350, y: 255, tam: 150, golpe: 1 }); }],
  ['lupa(): amplia lo que hay debajo', (g) => { M.papel(g, CW, CH, { seed: 8, tono: '#d8cdb4' }); texto(g, 'Marianne Wink, Puerto Viejo, 14', 20, 120, { tam: 30 }); texto(g, 'letra pequena de la carta', 20, 170, { tam: 20, mono: true }); O.lupa(g, { x: 260, y: 130, r: 85 }); }],
  ['mapa acuarela: Natural Earth + marcador + ruta', mapaCelda('acuarela')],
  ['mapa tinta: lineas paralelas a la costa', mapaCelda('tinta')],
  ['mapa grabado', mapaCelda('grabado')],
  ['mapa: toda la region (lon -25..30, lat 35..72)', (g) => G.dibujarCostas(g, enc2, { estilo: 'acuarela' })],
  ['revelarTinta(u=.5): mancha que descubre B', tr(X.revelarTinta)],
  ['barridoObjeto(u=.5): la brocha tapa el corte', tr(X.barridoObjeto)],
  ['papelQueSube(u=.5): hoja con sombra', tr(X.papelQueSube)],
  ['cortinaAgua(u=.5): nivel ondulado', tr(X.cortinaAgua)],
  ['zoomA(u=.5): entra en el detalle de A', tr(X.zoomA, { foco: { x: 0.5, y: 0.5, r: 0.27 } })],
  ['corteEco(u=.5): la forma viaja de A a B', tr(X.corteEco, { a: { x: 0.5, y: 0.5, r: 0.27 }, b: { x: 0.68, y: 0.5, r: 0.3 } })],
  ['escribirse({ctx,alinear:"center"}): ancla fija', (g) => { M.papel(g, CW, CH, { seed: 9 }); [0.6, 1.4, 3.2].forEach((lt, i) => { const b = escribirse('Hola, mundo estable', lt, { cps: 8, ctx: g, x: 240, y: 40 + i * 70, alinear: 'center', tam: 40, color: '#1f2a36' }); g.strokeStyle = 'rgba(168,69,47,0.6)'; g.strokeRect(b.x, b.y - 4, b.w, b.h + 8); }); }],
];
const todas = [...celdas, ...nuevas], c = createCanvas(COLS * CW, Math.ceil(todas.length / COLS) * (CH + 30)), g = c.getContext('2d');
g.fillStyle = '#17171a'; g.fillRect(0, 0, c.width, c.height);
todas.forEach(([nombre, fn], i) => {
  const x = (i % COLS) * CW, y = Math.floor(i / COLS) * (CH + 30); g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, CW, CH); g.clip(); fn(g); g.restore();
  g.fillStyle = '#17171a'; g.fillRect(x, y + CH, CW, 30); texto(g, nombre, x + 12, y + CH + 6, { tam: 17, mono: true, color: '#e8e2d0' });
});
fs.writeFileSync(new URL('./muestra.jpg', import.meta.url), c.toBuffer('image/jpeg', { quality: 0.9 })); console.log('muestra.jpg');
