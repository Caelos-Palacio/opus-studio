// test.mjs: pruebas rapidas del kit. node test.mjs  (sale con codigo 1 si algo falla)
import { createCanvas } from 'canvas';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import * as B from './kit/base.mjs';
import * as M from './kit/materia.mjs';
import * as F from './kit/formas.mjs';
import * as T from './kit/texto.mjs';
import * as A from './kit/audio.mjs';
import * as Q from './kit/auditoria.mjs';

let fallos = 0;
const t = async (nombre, fn) => { try { await fn(); console.log('ok   ' + nombre); } catch (e) { fallos++; console.log('FAIL ' + nombre + ': ' + e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
const W = 480, H = 300;
const md5 = (c) => createHash('md5').update(c.toBuffer('raw')).digest('hex');
const pinta = (fn) => { const c = createCanvas(W, H); fn(c.getContext('2d')); return c; };
const llenos = (c) => { const d = c.getContext('2d').getImageData(0, 0, W, H).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++; return n / (W * H); };
const poly = [[100, 60], [300, 50], [360, 200], [200, 260], [90, 190]];

await t('base: PRNG, ruido y muelle deterministas', () => {
  const a = B.rng('semilla'), b = B.rng('semilla'); for (let i = 0; i < 50; i++) ok(a() === b(), 'rng');
  ok(B.fbm(1.5, 2.5, 3) === B.fbm(1.5, 2.5, 3), 'fbm'); ok(Math.abs(B.spring(3, 0.5, 10) - 1) < 0.01, 'spring'); ok(B.mezclar('#000000', '#ffffff', 0) === '#000000' && B.mezclar('#102030', '#ffffff', 1) === '#ffffff', 'mezclar');
});
const mats = {
  papel: (g) => M.papel(g, W, H), acuarela: (g) => M.acuarela(g, poly, { color: '#3d7f8c' }), agua: (g) => M.agua(g, W, H, 1.5, {}),
  vidrio: (g) => M.vidrio(g, poly, {}), tinta: (g) => M.tinta(g, 240, 150, 100, 1.2, 2), metal: (g) => M.metal(g, 240, 150, 80), grano: (g) => M.grano(g, W, H, 3, 0.3), vineta: (g) => M.vineta(g, W, H, 0.6),
  torno: (g) => F.torno(g, F.perfil([[0, 20], [100, 50], [200, 40]]), { x: 240, y: 40 }), tubo: (g) => F.tubo(g, [[30, 40], [200, 200], [400, 60]], { seed: 1 }), red: (g) => F.red(g, { x: 40, y: 40, w: 400, h: 200 }),
  solido: (g) => F.solido(g, [[100, 250], [250, 230], [300, 270], [150, 290]], 100, '#8a7ba8'), sombraContacto: (g) => F.sombraContacto(g, 240, 150, 80), trazoMano: (g) => F.trazoMano(g, [[30, 150], [200, 60], [420, 190]], { tam: 10 }), texto: (g) => T.texto(g, 'Hola', 40, 40, { tam: 60 }), cifras: (g) => T.cifrasTabulares(g, 1234.5, 40, 40, { tam: 60, decimales: 1 }),
};
for (const [n, fn] of Object.entries(mats)) await t(`${n}: pinta algo y es determinista`, () => {
  const c1 = pinta(fn); ok(llenos(c1) > 0.004, 'lienzo vacio (' + llenos(c1).toFixed(4) + ')'); M.limpiarCache(); ok(md5(c1) === md5(pinta(fn)), 'md5 distinto con cache limpia');
});
await t('formas: catenaria cae entre extremos y cuelga', () => { const p = F.catenaria([0, 0], [100, 0], 40); ok(p[0][1] === 0 && Math.abs(p[24][1]) < 1e-9 && p[12][1] > 39, 'forma'); });
await t('texto: caja, tabulares y contraste', () => {
  const g = createCanvas(W, H).getContext('2d'); T.registrarFuentes(); const b = T.texto(g, 'Hola', 10, 10, { tam: 40 }); ok(b.w > 20 && b.h === 40, 'caja');
  const x = T.cifrasTabulares(g, 1111, 0, 0, { tam: 40 }).w, y = T.cifrasTabulares(g, 8888, 0, 0, { tam: 40 }).w; ok(Math.abs(x - y) < 0.01, 'ancho de cifras no tabular');
  ok(T.contraste('#000000', '#ffffff') > 20.9 && T.escribirse('abcdef', 0.2, { cps: 10 }) === 'ab', 'contraste o escribirse');
});
await t('auditoria: textoTapado, vacio, ocupacion, determinismo', () => {
  ok(Q.textoTapado([{ x: 0, y: 0, w: 10, h: 10 }], [{ x: 5, y: 5, w: 10, h: 10 }]).length === 1 && !Q.textoTapado([{ x: 0, y: 0, w: 10, h: 10 }], [{ x: 20, y: 0, w: 5, h: 5 }]).length, 'cajas');
  const plano = pinta((g) => { g.fillStyle = '#888'; g.fillRect(0, 0, W, H); }); ok(Q.vacio(plano).vacio, 'plano no detectado'); ok(!Q.vacio(pinta((g) => { M.papel(g, W, H); F.torno(g, F.perfil([[0, 20], [200, 50]]), { x: 240, y: 40 }); })).vacio, 'falso vacio');
  ok(Q.ocupacion(plano) < 0.01 && Q.ocupacion(pinta((g) => { g.fillStyle = '#eee'; g.fillRect(0, 0, W, H); g.fillStyle = '#222'; g.fillRect(150, 80, 180, 140); })) > 0.1, 'ocupacion');
  ok(Q.determinismo((g, tt) => M.agua(g, W, H, tt, {}), [0, 1.3], { W, H }).ok, 'determinismo'); ok(!Q.determinismo((g) => { g.fillStyle = `rgb(${(globalThis.__n = (globalThis.__n || 0) + 1) % 255},0,0)`; g.fillRect(0, 0, 9, 9); }, [0], { W: 16, H: 16 }).ok, 'no detecta estado');
});
await t('audio: master con TP <= -1 dBTP medido con ffmpeg', () => {
  const p = A.componer([{ t: 0.5, tipo: 'gota' }, { t: 1.2, tipo: 'papel' }, { t: 2, tipo: 'moneda' }, { t: 3, tipo: 'golpe' }], 5, { notas: [{ t: 1, midi: 60, dur: 3 }], pads: [{ t: 0.5, dur: 4, notas: [48, 55] }] });
  fs.mkdirSync('salida', { recursive: true }); A.escribirWav(p, 'salida/test.wav'); const m = A.medir('salida/test.wav'); console.log('     ', JSON.stringify(m));
  ok(m.TP <= -1 && m.I < -10 && m.I > -30, 'TP/I fuera de rango'); ok(A.picoVerdadero(p) <= -2.9, 'limitador');
});
await t('plantilla: renderiza 2 s y pasa la auditoria', () => {
  fs.rmSync('plantilla/salida/test.mp4', { force: true }); execFileSync('node', ['plantilla/render.js', '--preview', '--dur', '2', '--audio', '--salida', 'plantilla/salida/test.mp4'], { stdio: 'pipe' });
  const d = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', 'plantilla/salida/test.mp4'], { encoding: 'utf8' })); ok(d > 1.8 && d < 2.3, 'duracion ' + d);
  const r = spawnSync('node', ['kit/auditoria.mjs', 'plantilla'], { encoding: 'utf8' }); ok(r.status === 0, 'auditoria con fallos graves:\n' + r.stdout);
});
console.log(fallos ? `\n${fallos} FALLOS` : '\ntodo bien'); process.exit(fallos ? 1 : 0);
