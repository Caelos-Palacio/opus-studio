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
import * as X from './kit/transiciones.mjs';
import * as G from './kit/mapa.mjs';
import * as O from './kit/objetos.mjs';
import { elegir, nombres } from './kit/gramaticas/index.mjs';
import { limpiarGramaticas } from './kit/gramaticas/comun.mjs';

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
await t('torno: sombreado continuo (una esfera no sale en bandas de pelota)', () => {
  const esf = F.perfil(Array.from({ length: 61 }, (_, i) => { const a = Math.PI * i / 60; return [-100 * Math.cos(a), 100 * Math.sin(a)]; }), 1), c = pinta((g) => F.torno(g, esf, { x: 240, y: 150, tono: '#c8553d', reflejo: false })), d = c.getContext('2d').getImageData(140, 150, 200, 1).data, col = new Set();
  for (let i = 0; i < 200; i++) col.add(d[i * 4] + ',' + d[i * 4 + 1] + ',' + d[i * 4 + 2]); ok(col.size > 60, 'solo ' + col.size + ' colores en una fila: hay bandas');
});
await t('escribirse: el texto centrado NO se mueve al escribirse (ancla estable)', () => {
  const g = createCanvas(W, H).getContext('2d'), a = T.escribirse('Hola mundo', 0.3, { cps: 10, ctx: g, x: 240, y: 20, alinear: 'center', tam: 40 }), b = T.escribirse('Hola mundo', 5, { cps: 10, ctx: g, x: 240, y: 20, alinear: 'center', tam: 40 });
  ok(a.x === b.x && a.w === b.w, 'la caja cambia'); ok(T.escribirse('abc', 0.15, { cps: 10 }) === 'a', 'compat');
  const col = (lt) => { const c = createCanvas(W, 80), q = c.getContext('2d'); T.escribirse('Hola mundo', lt, { cps: 10, ctx: q, x: 240, y: 10, alinear: 'center', tam: 40 }); const d = q.getImageData(0, 0, W, 80).data; for (let x = 0; x < W; x++) for (let y = 0; y < 80; y++) if (d[(y * W + x) * 4 + 3] > 60) return x; return -1; };
  ok(Math.abs(col(0.35) - col(1.5)) <= 1, 'la primera letra se mueve: ' + col(0.35) + ' vs ' + col(1.5));
});
await t('texto: textoEn ajusta un nombre largo DENTRO de su tarjeta', () => {
  const g = createCanvas(W, H).getContext('2d'), cont = { x: 20, y: 20, w: 140, h: 70 }, b = T.textoEn(g, 'Marianne Wink de la Costa Norte', cont, { tam: 48 });
  ok(Q.textoDesbordado([{ id: 'n', ...b }], W, H).length === 0, 'desborda'); ok(b.contenedor.w === 140, 'sin contenedor');
});
await t('auditoria: ocupacion < 30 % es FALLO GRAVE; declarada, exenta o grande pasa', () => {
  const W2 = 1920, H2 = 1080, caja = (f) => ({ x: 0, y: 0, w: Math.sqrt(f * W2 * H2 * 16 / 9), h: Math.sqrt(f * W2 * H2 * 9 / 16) });
  ok(Q.ocupacionSujeto(caja(0.04), W2, H2).estado === 'FALLO', '4 % deberia fallar'); ok(Q.ocupacionSujeto(caja(0.25), W2, H2).estado === 'FALLO', '25 % deberia fallar');
  ok(Q.ocupacionSujeto(caja(0.4), W2, H2).estado === 'OK', '40 % deberia pasar'); ok(Q.ocupacionSujeto(caja(0.04), W2, H2, { ok: { porque: 'plano general: la botella es diminuta en el oceano' } }).estado === 'EXENTO', 'exento');
  ok(Q.ocupacionSujeto(caja(0.04), W2, H2, { ok: { porque: 'x' } }).estado === 'FALLO', 'motivo vacio'); ok(Q.ocupacionSujeto(null, W2, H2).estado === 'FALLO', 'sin sujeto'); ok(Q.ocupacionSujeto({ x: 1500, y: 0, w: 1200, h: 1080 }, W2, H2).estado === 'FALLO', 'caja fuera del cuadro');
});
await t('auditoria: texto desbordado y contraste son FALLOS GRAVES (casos que fallan y pasan)', () => {
  const ct = { id: 'a', x: 30, y: 30, w: 200, h: 40, contenedor: { x: 20, y: 20, w: 150, h: 60 } };
  ok(Q.textoDesbordado([ct], W, H).length === 1, 'no detecta desborde'); ok(!Q.textoDesbordado([{ ...ct, w: 120 }], W, H).length, 'falso desborde'); ok(Q.textoDesbordado([{ id: 'b', x: 450, y: 10, w: 100, h: 30 }], W, H).length === 1, 'fuera del cuadro');
  const fondo = (col) => pinta((g) => { g.fillStyle = col; g.fillRect(0, 0, W, H); }), tb = (c, col) => { const g = c.getContext('2d'); T.registrarFuentes(); return { id: 't', color: col, ...T.texto(g, 'Contraste', 60, 100, { tam: 48, color: col }) }; };
  let c = fondo('#8a8a8a'), b = tb(c, '#9a9a9a'); ok(Q.contrasteCaja(c, b).mediana < 4.5, 'gris sobre gris deberia ser < 4.5'); c = fondo('#f4efe2'); b = tb(c, '#1f2a36'); ok(Q.contrasteCaja(c, b).mediana > 10, 'tinta sobre crema');
  c = fondo('#8a8a8a'); b = tb(c, '#9a9a9a'); const f = Q.auditarCuadro({ canvas: c, cajas: { texto: [b], objetos: [], sujeto: { x: 0, y: 0, w: W, h: H } }, escena: {}, W, H }); ok(f.some((x) => x.check === 'contraste' && x.estado === 'FALLO'), 'auditarCuadro no marca contraste');
  c = fondo('#f4efe2'); b = tb(c, '#1f2a36'); ok(!Q.auditarCuadro({ canvas: c, cajas: { texto: [b], objetos: [], sujeto: { x: 0, y: 0, w: W, h: H } }, escena: {}, W, H }).some((x) => x.estado === 'FALLO'), 'falso fallo');
});
await t('auditoria CLI: proyectos que FALLAN salen con codigo 1 y los buenos con 0', () => {
  const mk = (nombre, escena, cuerpo, cajas) => { const d = 'salida/neg-' + nombre; fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(d + '/timeline.js', `export const escenas=[{id:'e',t0:0,dur:4,${escena}}];`);
    fs.writeFileSync(d + '/frame.js', `import { papel } from '../../kit/materia.mjs'; import { texto } from '../../kit/texto.mjs'; export const W=1920,H=1080;\nexport function frame(ctx,t){ const k=ctx.canvas.width/1920; ctx.save(); ctx.scale(k,k); papel(ctx,1920,1080,{seed:2,tono:'#e7dcc3'}); ${cuerpo} ctx.restore(); }\nexport function cajas(t){ return ${cajas}; }`); return spawnSync('node', ['kit/auditoria.mjs', d, '--escala', '0.25'], { encoding: 'utf8' }); };
  const sujeto = (x, y, w, h) => `ctx.fillStyle='#3d7f8c'; ctx.fillRect(${x},${y},${w},${h}); for(let i=0;i<40;i++){ctx.fillStyle=i%2?'#e9d9a6':'#1d3f4a';ctx.fillRect(${x}+i*${w}/40,${y}+(i%5)*${h}/9,${w}/60,${h}*0.6);}`, caja = (x, y, w, h) => `{x:${x},y:${y},w:${w},h:${h}}`;
  let r = mk('pequeno', '', sujeto(900, 500, 120, 80), `{texto:[],objetos:[],sujeto:${caja(900, 500, 120, 80)}}`); ok(r.status === 1 && /ocupacion/.test(r.stdout), 'sujeto pequeno deberia fallar:\n' + r.stdout);
  r = mk('grande', '', sujeto(300, 150, 1200, 800), `{texto:[],objetos:[],sujeto:${caja(300, 150, 1200, 800)}}`); ok(r.status === 0, 'sujeto grande deberia pasar:\n' + r.stdout);
  r = mk('exento', "ocupacion_ok:{porque:'plano general: el sujeto es diminuto a proposito'}", `for(let i=0;i<48;i++){ctx.fillStyle=i%3?'rgba(30,70,90,0.55)':'rgba(240,225,180,0.6)';ctx.fillRect(i*40,0,24,1080);}` + sujeto(900, 500, 120, 80), '{texto:[],objetos:[]}'); ok(r.status === 0, 'ocupacion_ok deberia pasar:\n' + r.stdout);
  const sujG = sujeto(300, 150, 1200, 800), cjG = caja(300, 150, 1200, 800), tx = (col, extra = '') => `const b=texto(ctx,'Marianne Wink de la Costa',400,300,{tam:60,color:'${col}'});`;
  r = mk('desborda', '', sujG + tx('#1f2a36'), `{texto:[{id:'nombre',x:400,y:300,w:700,h:60,color:'#1f2a36',tam:60,contenedor:{x:400,y:300,w:300,h:60}}],objetos:[],sujeto:${cjG}}`); ok(r.status === 1 && /contenedor/.test(r.stdout), 'texto desbordado deberia fallar:\n' + r.stdout);
  r = mk('contraste', '', sujG + `ctx.fillStyle='#d9d3c3'; ctx.fillRect(380,280,900,100);` + tx('#c4bda9'), `{texto:[{id:'bajo',x:400,y:300,w:700,h:60,color:'#c4bda9',tam:60}],objetos:[],sujeto:${cjG}}`); ok(r.status === 1 && /contraste/.test(r.stdout), 'contraste bajo deberia fallar:\n' + r.stdout);
  r = mk('legible', '', sujG + `ctx.fillStyle='#f4efe2'; ctx.fillRect(380,280,900,100);` + tx('#1f2a36'), `{texto:[{id:'ok',x:400,y:300,w:700,h:60,color:'#1f2a36',tam:60,contenedor:{x:380,y:280,w:900,h:100}}],objetos:[],sujeto:${cjG}}`); ok(r.status === 0, 'texto legible deberia pasar:\n' + r.stdout);
});
await t('transiciones: u=0 es A, u=1 es B, puras y NO son un fundido cruzado', () => {
  const A = (g) => { g.fillStyle = '#c8553d'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.fillRect(100, 100, 120, 80); }, B = (g) => { g.fillStyle = '#2d6f78'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.fillRect(300, 150, 60, 120); };
  const cf = pinta((g) => { A(g); g.globalAlpha = 0.5; B(g); });
  for (const [n, f, o] of [['revelarTinta', X.revelarTinta, {}], ['barridoObjeto', X.barridoObjeto, {}], ['papelQueSube', X.papelQueSube, {}], ['cortinaAgua', X.cortinaAgua, {}], ['zoomA', X.zoomA, { foco: { x: 0.5, y: 0.5, r: 0.2 } }], ['corteEco', X.corteEco, { a: { x: 0.3, y: 0.4, r: 0.2 }, b: { x: 0.6, y: 0.5, r: 0.25 } }]]) {
    const en = (u) => pinta((g) => f(g, u, A, B, o)); ok(md5(en(0)) === md5(pinta(A)), n + ': u=0 != A'); ok(md5(en(1)) === md5(pinta(B)), n + ': u=1 != B');
    ok(md5(en(0.5)) === md5(en(0.5)), n + ': no es pura'); ok(md5(en(0.5)) !== md5(cf) && md5(en(0.5)) !== md5(en(0.3)), n + ': parece un fundido o no avanza');
  }
});
await t('mapa: Natural Earth real, proyeccion invertible, 3 estilos deterministas', () => {
  const j = G.cargarCostas(), kb = fs.statSync('kit/datos/costas.json').size / 1024; ok(kb < 400 && j.anillos.length > 100, 'datos: ' + kb.toFixed(0) + ' KB, ' + j.anillos.length + ' anillos');
  const enc = G.encuadre({ lon0: -12, lat0: 42, lon1: 8, lat1: 56 }, W, H), [x, y] = G.proyectar(-0.12, 51.5, enc), [lo, la] = G.invertir(x, y, enc); ok(Math.abs(lo + 0.12) < 1e-6 && Math.abs(la - 51.5) < 1e-6, 'inversa');
  const c = pinta((g) => G.dibujarCostas(g, enc, { estilo: 'acuarela' })), px = (lon, lat) => { const [a, b] = G.proyectar(lon, lat, enc); return c.getContext('2d').getImageData(Math.round(a), Math.round(b), 1, 1).data; };
  const tierra = px(-0.12, 51.5), mar = px(-9, 45); ok(tierra[0] > tierra[2] + 20, 'Londres no es tierra'); ok(mar[2] >= mar[0], 'el golfo de Vizcaya no es mar');
  for (const e of ['acuarela', 'tinta', 'grabado']) { const f = () => pinta((g) => G.dibujarCostas(g, enc, { estilo: e })); ok(llenos(f()) > 0.9 && md5(f()) === md5(f()), e + ' no determinista'); }
  const m = pinta((g) => { const r = G.marcador(g, { x: 200, y: 200, nombre: 'Aqui' }, { u: 1 }); ok(r.etiqueta.w > 10 && r.pin.h > 10, 'marcador'); const h = G.ruta(g, [50, 250], [400, 100], 1); ok(h.x > 300, 'ruta'); }); ok(llenos(m) > 0.003, 'marcador/ruta vacios');
});
await t('objetos: cada uno tiene >= 10 piezas y es determinista', () => {
  const casos = { botella: (g) => O.botella(g, { x: 240, y: 150, alto: 280 }), 'botella girada': (g) => O.botella(g, { x: 240, y: 150, alto: 280, rot: 1.2 }), 'moneda perfil': (g) => O.moneda(g, { x: 240, y: 150, r: 80 }), 'moneda escudo': (g) => O.moneda(g, { x: 240, y: 150, r: 80, cara: 'escudo', giro: 0.9 }), sobre: (g) => O.sobre(g, { x: 240, y: 150, w: 300, abierto: 0.5 }), tarjeta: (g) => O.tarjeta(g, { x: 240, y: 150, w: 300, h: 200, lineas: ['Hola', 'Segunda linea'] }), sello: (g) => O.sello(g, { x: 240, y: 200, tam: 140, golpe: 1 }), lupa: (g) => O.lupa(g, { x: 240, y: 150, r: 70 }) };
  for (const [n, f] of Object.entries(casos)) { let res; const c1 = pinta((g) => { M.papel(g, W, H); res = f(g); }); ok(res.piezas.length >= 10, n + ': solo ' + res.piezas.length + ' piezas'); ok(llenos(c1) > 0.5 && res.caja.w > 10, n + ' caja'); M.limpiarCache(); ok(md5(c1) === md5(pinta((g) => { M.papel(g, W, H); f(g); })), n + ' no determinista'); }
});
await t('objetos: la moneda de canto es delgada (no una esfera) y la tarjeta no desborda', () => {
  const g = createCanvas(W, H).getContext('2d'), de = O.moneda(g, { x: 240, y: 150, r: 80, giro: Math.PI / 2 }), fr = O.moneda(g, { x: 240, y: 150, r: 80 }); ok(de.caja.w < fr.caja.w * 0.3 && de.piezas.includes('estrias'), 'canto ancho ' + de.caja.w);
  const tj = O.tarjeta(g, { x: 240, y: 150, w: 300, h: 200, lineas: ['Marianne Wink de la Costa Norte del Mar', 'x'], rot: 0.1 }); ok(tj.textos.length >= 1 && !Q.textoDesbordado(tj.textos, W, H).length, 'texto fuera de la tarjeta');
  const bo = O.botella(g, { x: 240, y: 150, alto: 280, rot: 1.3 }); ok(bo.caja.w > bo.caja.h, 'botella girada deberia ser apaisada');
});
await t('audio: master con TP <= -1 dBTP medido con ffmpeg', () => {
  const p = A.componer([{ t: 0.5, tipo: 'gota' }, { t: 1.2, tipo: 'papel' }, { t: 2, tipo: 'moneda' }, { t: 3, tipo: 'golpe' }], 5, { notas: [{ t: 1, midi: 60, dur: 3 }], pads: [{ t: 0.5, dur: 4, notas: [48, 55] }] });
  fs.mkdirSync('salida', { recursive: true }); A.escribirWav(p, 'salida/test.wav'); const m = A.medir('salida/test.wav'); console.log('     ', JSON.stringify(m));
  ok(m.TP <= -1 && m.I < -10 && m.I > -30, 'TP/I fuera de rango'); ok(A.picoVerdadero(p) <= -2.9, 'limitador');
});
for (const n of nombres) await t(`gramatica ${n}: determinista, pinta, texto >= 4,5:1 y acento/trazo/post presentes`, () => {
  const G = elegir(n), T0 = 1.7, caja = {}, escena = (g) => { G.soporte(g, W, H, T0, { seed: 2 }); G.trazo(g, [[40, 250], [160, 120], [300, 230], [440, 90]], { grosor: n === 'papel' ? 6 : 12, seed: 3, t: T0 }); Object.assign(caja, G.texto(g, 'Hola mar', 40, 20, { tam: n === 'neon' ? 56 : 52, t: T0, seed: 4 })); G.acento(g, caja, { u: 1, t: T0 }); G.post(g, W, H, 3); };
  const c1 = pinta(escena); limpiarGramaticas(); M.limpiarCache(); ok(md5(c1) === md5(pinta(escena)), 'no determinista');
  const solo = pinta((g) => { G.trazo(g, [[40, 150], [440, 150]], { grosor: 12, seed: 1 }); }); ok(llenos(solo) > 0.004, 'el trazo no pinta');
  const tx = pinta((g) => { G.texto(g, 'Hola', 40, 40, { tam: 80 }); }); ok(llenos(tx) > 0.004, 'el texto no pinta');
  const fondo = pinta((g) => { G.soporte(g, W, H, T0, { seed: 2 }); }), b = { id: 't', ...caja }, r = Q.contrasteCaja(c1, b); ok(llenos(fondo) > 0.99, 'soporte no cubre'); ok(r.mediana >= 4.5, `contraste ${r.mediana.toFixed(1)}:1 < 4,5`);
  ok(typeof G.cuando === 'string' && G.cuando.length > 20 && Object.keys(G.paleta).includes('a1'), 'faltan cuando/paleta');
  const A = (g) => { g.fillStyle = '#123'; g.fillRect(0, 0, W, H); }, Bb = (g) => { g.fillStyle = '#edc'; g.fillRect(0, 0, W, H); }; ok(md5(pinta((g) => G.transicion(g, 0, A, Bb))) === md5(pinta(A)) && md5(pinta((g) => G.transicion(g, 1, A, Bb))) === md5(pinta(Bb)), 'transicion: extremos');
});
await t('gramaticas: la paleta se puede cambiar y el diccionario rechaza nombres raros', () => {
  const a = pinta((g) => elegir('neon').trazo(g, [[40, 150], [440, 150]], { seed: 1 })), b = pinta((g) => elegir('neon', { a1: '#33ff66' }).trazo(g, [[40, 150], [440, 150]], { seed: 1 })); ok(md5(a) !== md5(b), 'la paleta no cambia nada');
  let fallo = false; try { elegir('rococo'); } catch { fallo = true; } ok(fallo, 'acepto una gramatica inexistente');
});
await t('gramaticas: las tres se distinguen (medios distintos, no el mismo con otro color)', () => {
  const lum = (n) => { const c = pinta((g) => { const G = elegir(n); G.soporte(g, W, H, 1, {}); }), d = c.getContext('2d').getImageData(0, 0, W, H).data; let m = 0, v = 0; for (let i = 0; i < d.length; i += 4) m += d[i] + d[i + 1] + d[i + 2]; m /= d.length / 4 * 3; for (let i = 0; i < d.length; i += 4) v += ((d[i] + d[i + 1] + d[i + 2]) / 3 - m) ** 2; return [m, Math.sqrt(v / (d.length / 4))]; };
  const [n, tz, pp] = ['neon', 'tiza', 'papel'].map(lum); ok(pp[0] > 150 && n[0] < 60 && tz[0] < 70, 'luminancias de soporte'); ok(md5(pinta((g) => elegir('tiza').soporte(g, W, H, 1))) !== md5(pinta((g) => elegir('neon').soporte(g, W, H, 1))), 'iguales');
});
await t('v3: sello >= 10 piezas siempre (golpe 0, .3 y 1)', () => { const g = createCanvas(W, H).getContext('2d'); for (const q of [0, 0.3, 0.45, 1]) { const r = O.sello(g, { x: 240, y: 200, tam: 140, golpe: q }); ok(r.piezas.length >= 10, `golpe ${q}: ${r.piezas.length}`); } });
await t('v3: contraste con alfa < 0,95 usa el color efectivo (alfa baja = falla)', () => {
  const m = (a) => { const c = pinta((g) => { g.fillStyle = '#e7dcc3'; g.fillRect(0, 0, W, H); }), g = c.getContext('2d'); T.registrarFuentes(); const b = { id: 't', color: '#1f2a36', ...T.texto(g, 'Contraste', 60, 100, { tam: 48, color: '#1f2a36', alfa: a }) }; return Q.contrasteCaja(c, b).mediana; };
  ok(m(1) > 9 && m(0.5) < 4.5 && m(0.5) > 1.2, `1: ${m(1)}, .5: ${m(0.5)}`);
  const c = pinta((g) => { g.fillStyle = '#e7dcc3'; g.fillRect(0, 0, W, H); }), g = c.getContext('2d'), b = { id: 't', color: '#1f2a36', ...T.texto(g, 'Contraste', 60, 100, { tam: 48, color: '#1f2a36', alfa: 0.4 }) };
  ok(Q.auditarCuadro({ canvas: c, cajas: { texto: [b], objetos: [], sujeto: { x: 0, y: 0, w: W, h: H } }, escena: {}, W, H }).some((x) => x.check === 'contraste' && x.estado === 'FALLO'), 'alfa .4 no marca FALLO');
});
await t('v3: barridoObjeto por defecto es una brocha (cerdas en el avance, no tiras verticales) y tinta tiene tentaculos continuos', () => {
  const Aa = (g) => { g.fillStyle = '#c8553d'; g.fillRect(0, 0, W, H); }, Bb = (g) => { g.fillStyle = '#2d6f78'; g.fillRect(0, 0, W, H); }, c = pinta((g) => X.barridoObjeto(g, 0.5, Aa, Bb, { dir: 'der' })), d = c.getContext('2d').getImageData(0, 0, W, H).data;
  let h = 0, v = 0; for (let y = 1; y < H - 1; y += 2) for (let x = 1; x < W - 1; x += 2) { const i = (y * W + x) * 4, dx = Math.abs(d[i] - d[i + 4]), dy = Math.abs(d[i] - d[i + W * 4]); h += dx; v += dy; }
  ok(h > 0 && v > 0, 'sin contenido'); const base = pinta((g) => M.tinta(g, 240, 150, 100, 4, 2)), sin = pinta((g) => M.tinta(g, 240, 150, 100, 0.05, 2)); ok(llenos(base) > llenos(sin), 'tinta no crece');
  const Rr = 100 * (1 - Math.exp(-2.2 * 4)), dd = base.getContext('2d').getImageData(0, 0, W, H).data; let fuera = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.hypot(x - 240, y - 150) > Rr * 1.35 && dd[(y * W + x) * 4 + 3] > 60) fuera++; ok(fuera > 40, 'sin tentaculos fuera de la mancha: ' + fuera);
});
await t('plantilla: renderiza 2 s y pasa la auditoria', () => {
  fs.rmSync('plantilla/salida/test.mp4', { force: true }); execFileSync('node', ['plantilla/render.js', '--preview', '--dur', '2', '--audio', '--salida', 'plantilla/salida/test.mp4'], { stdio: 'pipe' });
  const d = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', 'plantilla/salida/test.mp4'], { encoding: 'utf8' })); ok(d > 1.8 && d < 2.3, 'duracion ' + d);
  for (const gr of nombres) { const r = spawnSync('node', ['kit/auditoria.mjs', 'plantilla', '--escala', '0.5'], { encoding: 'utf8', env: { ...process.env, GRAMATICA: gr } }); ok(r.status === 0, `auditoria (${gr}) con fallos graves:\n` + r.stdout); }
});
console.log(fallos ? `\n${fallos} FALLOS` : '\ntodo bien'); process.exit(fallos ? 1 : 0);
