// muestra-gramaticas.mjs: node muestra-gramaticas.mjs -> muestra-gramaticas.jpg (lamina de validacion de la v3).
// Fila 1: LA MISMA escena (un objeto, un texto, un acento) en neon, tiza y papel. Filas 2-3: una celda por arreglo de la v2 y los cortes propios de cada medio.
import { createCanvas } from 'canvas';
import fs from 'node:fs';
import * as M from './kit/materia.mjs';
import * as O from './kit/objetos.mjs';
import * as X from './kit/transiciones.mjs';
import * as Q from './kit/auditoria.mjs';
import { texto, registrarFuentes } from './kit/texto.mjs';
import { elegir } from './kit/gramaticas/index.mjs';
import { escenaGenerica } from './escena-generica.mjs';

registrarFuentes();
const CW = 640, CH = 360, COLS = 3, PIE = 30, celda = (fn, w = 1920, h = 1080) => { const c = createCanvas(w, h); fn(c.getContext('2d'), c); return c; };
const grama = (n) => celda((g, c) => { const G = elegir(n); escenaGenerica(G, g, 2.3, {}); G.post(g, 1920, 1080, 5); });
const A = (g) => { g.fillStyle = '#c8553d'; g.fillRect(0, 0, CW, CH); texto(g, 'A', 30, 20, { tam: 60, peso: 'bold', color: '#fff' }); }, B = (g) => { g.fillStyle = '#2d6f78'; g.fillRect(0, 0, CW, CH); texto(g, 'B', 30, 20, { tam: 60, peso: 'bold', color: '#fff' }); };
const trans = (f) => { const c = createCanvas(CW, CH); f(c.getContext('2d')); return c; };
const contrasteAlfa = () => celda((g, c) => {
  M.papel(g, CW, CH, { seed: 3 }); const filas = [1, 0.7, 0.5, 0.3];
  filas.forEach((a, i) => { const b = { id: 't', color: '#1f2a36', ...texto(g, `Texto con alfa ${a}`, 30, 20 + i * 52, { tam: 34, color: '#1f2a36', alfa: a }) }, r = Q.contrasteCaja(c, b); texto(g, `${r.mediana.toFixed(1)}:1 ${r.mediana >= 4.5 ? 'ok' : 'FALLO'}`, 420, 24 + i * 52, { tam: 26, mono: true, color: r.mediana >= 4.5 ? '#2f6d4f' : '#a8452f' }); });
  texto(g, 'La auditoria mide el color efectivo\n(mezcla con el fondo), no el nominal.', 30, 250, { tam: 22, mono: true, color: '#3a3f46' });
}, CW, CH);
const todas = [
  ['neon: luz sobre muro humedo, tubos, halo, rotulo', grama('neon'), 1920, 1080], ['tiza: pizarra, trazo con grano, letra de pizarra', grama('tiza'), 1920, 1080], ['papel: papel, pluma, acuarela, serif', grama('papel'), 1920, 1080],
  ['barridoObjeto por defecto: brocha (u=.5, der y abj)', celda((g) => { const a = trans((q) => X.barridoObjeto(q, 0.5, A, B, { dir: 'der' })), b = trans((q) => X.barridoObjeto(q, 0.5, A, B, { dir: 'abj' })); g.drawImage(a, 0, 0, CW / 2, CH / 2, 0, 0, CW / 2, CH); g.drawImage(b, CW / 2, 0, CW / 2, CH / 2, CW / 2, 0, CW / 2, CH); }, CW, CH), CW, CH],
  ['moneda: busto con pelo, laurel y cinta (no calvo)', celda((g) => { M.papel(g, CW, CH, { seed: 3, tono: '#d8cdb4' }); O.moneda(g, { x: 200, y: 180, r: 150 }); O.moneda(g, { x: 480, y: 180, r: 100, desgaste: 0.7, giro: 0.5 }); }, CW, CH), CW, CH],
  ['tinta: tentaculos continuos (lt 1.6 y 4)', celda((g) => { M.papel(g, CW, CH, { seed: 5 }); M.tinta(g, 170, 180, 130, 1.6, 3); M.tinta(g, 460, 180, 130, 4, 5); }, CW, CH), CW, CH],
  ['sello: >= 10 piezas siempre (golpe 0, .45, 1)', celda((g) => { M.papel(g, CW, CH, { seed: 7, tono: '#d8cdb4' }); const n = [0, 0.45, 1].map((q, i) => O.sello(g, { x: 110 + i * 210, y: 300, tam: 150, golpe: q, texto: 'OK' }).piezas.length); texto(g, `piezas: ${n.join(' / ')}`, 20, 12, { tam: 22, mono: true, color: '#1f2a36' }); }, CW, CH), CW, CH],
  ['contraste con alfa < 0,95 (color efectivo)', contrasteAlfa(), CW, CH],
  ['transiciones propias: borrado (tiza) y apagon (neon), u=.5', celda((g) => { const mk = (n) => { const G = elegir(n); return celda((q) => G.transicion(q, 0.5, (c) => { G.soporte(c, CW, CH, 1); texto(c, 'A', 40, 30, { tam: 70, color: '#fff' }); }, (c) => { G.soporte(c, CW, CH, 2, { seed: 9 }); texto(c, 'B', 40, 30, { tam: 70, color: '#fff' }); }), CW, CH); }, a = mk('tiza'), b = mk('neon'); g.drawImage(a, 0, 0, CW / 2, CH, 0, 0, CW / 2, CH); g.drawImage(b, CW / 2, 0, CW / 2, CH, CW / 2, 0, CW / 2, CH); }, CW, CH), CW, CH],
];
const c = createCanvas(COLS * CW, Math.ceil(todas.length / COLS) * (CH + PIE)), g = c.getContext('2d'); g.fillStyle = '#141416'; g.fillRect(0, 0, c.width, c.height);
todas.forEach(([nombre, im, w, h], i) => { const x = (i % COLS) * CW, y = Math.floor(i / COLS) * (CH + PIE); g.drawImage(im, 0, 0, w, h, x, y, CW, CH); texto(g, nombre, x + 10, y + CH + 5, { tam: 17, mono: true, color: '#e8e2d0' }); });
fs.writeFileSync(new URL('./muestra-gramaticas.jpg', import.meta.url), c.toBuffer('image/jpeg', { quality: 0.92 })); console.log('muestra-gramaticas.jpg');
