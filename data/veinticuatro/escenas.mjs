// Genera shots/V01..V12.scene.json a partir de las tablas de eventos de build.mjs (ritmo real). Los .scene.json resultantes
// son datos propios del film (se pueden editar a mano); este script solo evita repetir tablas y expresiones.
// Uso: node data/veinticuatro/escenas.mjs && node engine/dsl.mjs build --all
import fs from 'node:fs';
import { KAM, IMB, BAK, F1, I0, B0 } from './build.mjs';
const X = (s) => ({ $expr: s });
const SH = (id) => new URL(`../../shots/${id}.scene.json`, import.meta.url);
const w = (id, sc) => fs.writeFileSync(SH(id), JSON.stringify(sc, null, 1));
const R = (n) => +n.toFixed(3);
// PRNG sembrado (solo para repartir posiciones en el cuadro al generar; los datos quedan fijos en el JSON)
const prng = (s) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);

// energías (MeV) de las tablas publicadas, solo para dar altura al clic y tamaño al destello (de memoria: a verificar)
export const EK = [20.0, 13.5, 7.5, 9.2, 12.8, 6.3, 35.4, 21.0, 8.1, 12.2, 8.9, 6.3];
export const EI = [38, 37, 28, 39, 36, 36, 19, 22];
export const EB = [12.0, 17.9, 23.5, 17.6, 20.3];

// filas de destello: [k (s locales), x, y, z (0 lejos..1 cerca), energía 0..1, ok (1 aceptado, .45 dudoso)]
export function filas(times, energias, t0shot, t0film, { seed, okFrom = 99, zOverride = null, box = [190, 1090, 150, 480] }) {
  const rnd = prng(seed);
  return times.map((t, i) => {
    const z = zOverride ? zOverride[i] : R(0.12 + 0.88 * rnd());
    const x = R(box[0] + (box[1] - box[0]) * rnd()), y = R(box[2] + (box[3] - box[2]) * (0.5 + (rnd() - 0.5) * (0.5 + 0.6 * z)));
    return [R(t0film + t - t0shot), x, y, z, R((energias[i] - 5) / 32), i >= okFrom ? 0.45 : 1];
  });
}
const cuentaExpr = (rows, base) => { const ok = rows.filter((r) => r[5] === 1); return ok.length ? `${base} + ` + ok.map((r) => `seg(lt, ${r[0]}, ${R(r[0] + 0.16)})`).join(' + ') : String(base); };
const texto = (id, str, a, b, { y = 'S_y1 - 46', role = 'label', color = 'ink', max = 1, x = 'S_cx', align = 'center' } = {}) =>
  ({ id, type: 'text', text: str, x: X(x), y: X(y), role, align, color, alpha: X(`${max} * seg(lt, ${a}, ${a + 0.8}) * (1 - seg(lt, ${b - 0.8}, ${b}))`) });

export function flashes(rows, color) {
  return {
    id: 'f', type: 'repeat', items: rows, fields: ['k', 'x', 'y', 'z', 'e', 'ok'],
    children: [
      { id: 'age', type: 'let', value: X('lt - f_k') },
      { id: 'dec', type: 'let', value: X('exp(-age * (2.6 + 3 * (1 - f_z)))') },
      {
        type: 'group', when: 'age >= 0 && age < 2.6', children: [
          { type: 'glow', x: X('f_x'), y: X('f_y'), r: X('(70 + 260 * f_z) * (0.7 + 0.5 * f_e)'), color, alpha: X('0.95 * dec * f_ok') },
          { type: 'glow', x: X('f_x'), y: X('f_y'), r: X('(20 + 60 * f_z)'), color: 'ink', alpha: X('0.9 * exp(-age * 9) * f_ok') },
          { type: 'shape', shape: 'circle', stroke: true, lineWidth: X('2 + 5 * f_z'), x: X('f_x'), y: X('f_y'), r: X('12 + (60 + 190 * f_z) * (1 - exp(-age * 3.4))'), color, alpha: X('1 * dec * f_ok') },
          { type: 'shape', shape: 'circle', stroke: true, lineWidth: X('0.8 + 1.5 * f_z'), x: X('f_x'), y: X('f_y'), r: X('6 + (34 + 120 * f_z) * (1 - exp(-age * 3.4))'), color: 'ink', alpha: X('0.5 * dec * f_ok') },
          { type: 'shape', shape: 'circle', x: X('f_x'), y: X('f_y'), r: X('2 + 7 * f_z'), color: 'ink', alpha: X('exp(-age * 16) * f_ok') },
          // fotomultiplicadores de la pared que ven el cono: puntos sobre el anillo
          {
            id: 'p', type: 'repeat', n: 9, children: [
              { type: 'glow', x: X('f_x + cos(i * 0.698 + f_k * 5) * (12 + (60 + 190 * f_z) * (1 - exp(-age * 3.4)))'), y: X('f_y + sin(i * 0.698 + f_k * 5) * (12 + (60 + 190 * f_z) * (1 - exp(-age * 3.4))) * 0.92'), r: X('7 + 9 * f_z'), color, alpha: X('0.8 * dec * f_ok * (0.4 + 0.6 * abs(sin(i * 2.1 + f_k)))') },
            ],
          },
        ],
      },
    ],
  };
}

export function contador(valor, color, alpha = 1, { x = 150, y = 640, size = 240, label = null } = {}) {
  return { id: 'cont', type: 'objeto', objeto: 'contador', x, y, size, alfa: alpha, params: { digitos: 2, tipo: 'numerico' }, partes: { valor: X(valor), brillo: 0.95 }, color: '#07141c', relleno: '#0a1a24', acento: color };
}

// cuba_oscura más hundida: menos haz, menos turbidez, fotomultiplicadores lejanos casi apagados (el oscuro es el tema)
const AJ = { haces: { intensidad: 0.05 }, turbidez: { alfa: 0.16 }, bruma: { densidad: 0.3 }, pmtLejanos: { brillo: 0.3, alfa: 0.5 }, pmtCercanos: { brillo: 0.4, alfa: 0.75 }, vineta: { fuerza: 0.9 } };
const CUBA_K = (extra = {}) => ({ type: 'fondo', preset: 'cuba_oscura', ajustes: AJ, ...extra });

function cuba(id, doc, { rows, base = 0, color = 'accent2', fondo = CUBA_K(), textos = [], camera = { move: 'push', why: 'approach', amount: 0.02 }, contAlpha = '1', extra = [], etiqueta = null }) {
  const objs = [fondo]; if (rows.length) objs.push(flashes(rows, color));
  objs.push(contador(rows.length ? cuentaExpr(rows, base) : String(base), color, null));
  objs[objs.length - 1].alfa = X(contAlpha);
  if (etiqueta) objs.push({ ...texto('et', etiqueta, 0.3, 99, { x: '150', y: '566', role: 'body', color, max: 0.55, align: 'center' }) });
  for (const [i, t] of textos.entries()) objs.push(texto('t' + i, ...t));
  objs.push(...extra);
  return { dsl: 1, id, doc, camera, transition: { out: 'cut' }, objects: objs };
}


// ───────────────── mitad 1: las cubas ─────────────────
const gen = {};
const FIN = (id, lines) => lines;
gen.V01 = () => cuba('V01', 'La cuba antes del primer destello: agua negra, fotomultiplicadores como lunas, nada ocurre (8,2 s).', {
  rows: [], base: 0, contAlpha: 'seg(lt, 6.0, 7.4) * 0.5', camera: { move: 'push', why: 'approach', amount: 0.03 },
  textos: [['Kamioka, mil metros bajo la roca. Una cuba de agua y mil fotomultiplicadores. Esperan.', 1.6, 8.0, { role: 'body' }]],
});
gen.V02 = () => cuba('V02', 'Primer destello y los nueve de la primera ráfaga, al ritmo real de Kamiokande-II (1,915 s).', {
  rows: filas(KAM.slice(0, 9), EK.slice(0, 9), 8.2, F1, { seed: 11, zOverride: [0.5, 0.2, 0.85, 0.35, 0.65, 0.15, 0.95, 0.4, 0.7] }), base: 0, contAlpha: '0.5 + 0.5 * seg(lt, 0.6, 0.8)',
  camera: { move: 'static' }, etiqueta: 'KAMIOKANDE-II', textos: [['Uno.', 0.95, 2.0, { role: 'h2' }], ['Nueve en menos de dos segundos.', 2.15, 3.3, { role: 'body' }]],
});
gen.V03 = () => cuba('V03', 'La pausa real: 7,304 s entre el 9.º y el 10.º destello. No ocurre nada; solo agua, niebla y polvo. El contador queda en 9.', {
  rows: [], base: 9, camera: { move: 'push', why: 'approach', amount: 0.025 }, etiqueta: 'KAMIOKANDE-II',
  textos: [['Pasan siete segundos. No llega ninguno.', 1.2, 5.6, { role: 'body' }]],
});
// V04: el 10.º destello a F1+9,219 s y el 11.º a +10,433 s. El shot empieza a 18,15 s
gen.V04 = () => cuba('V04', 'Dos destellos más (9,219 y 10,433 s tras el primero): el contador llega a 11.', {
  rows: filas(KAM.slice(9, 11), EK.slice(9, 11), 18.15, F1, { seed: 21, zOverride: [0.6, 0.3] }), base: 9, camera: { move: 'static' }, etiqueta: 'KAMIOKANDE-II',
  textos: [['Dos más. Contamos once.', 0.9, 2.85, { role: 'body' }]],
});
gen.V05 = () => cuba('V05', 'El duodécimo (12,439 s) llega a media luz: el contador no lo acepta y queda parpadeando en un 12 fantasma entre interrogaciones de grafito.', {
  rows: filas(KAM.slice(11, 12), EK.slice(11, 12), 21.0, F1, { seed: 31, zOverride: [0.5], okFrom: 0 }).map((r) => { r[5] = 0.6; return r; }), base: 11, camera: { move: 'push', why: 'approach', amount: 0.03 }, etiqueta: 'KAMIOKANDE-II',
  extra: [
    { id: 'fan', type: 'text', text: '12', x: 322, y: 640, role: 'h2', align: 'center', color: 'ink', alpha: X('seg(lt, 0.7, 1.0) * (0.3 + 0.25 * sin(lt * 7))') },
    { id: 'q1', type: 'text', text: '?', x: 392, y: 612, role: 'h2', align: 'center', color: 'shade', alpha: X('seg(lt, 1.2, 1.8) * 0.6') },
    { id: 'q2', type: 'text', text: '?', x: 430, y: 660, role: 'body', align: 'center', color: 'shade', alpha: X('seg(lt, 1.6, 2.2) * 0.5') },
  ],
  textos: [['Otras cuentas ponen doce.', 1.4, 4.2, { role: 'body' }]],
});
// IMB: otra cuba, más fría y más azul
const AJ_IMB = { haces: { intensidad: 0.07, color: '#9fb0ff' }, turbidez: { alfa: 0.2, colorB: '#2b3a9a' }, bruma: { color: '#1b2a7e', densidad: 0.34 }, pmtLejanos: { brillo: 0.3, alfa: 0.5, color: '#a8b8ff', cristal: '#0b1230' }, pmtCercanos: { brillo: 0.4, alfa: 0.75, color: '#b9c6ff', cristal: '#0c1536' }, nieveMarina: { color: '#c8d2ff' }, vineta: { fuerza: 0.9 } };
gen.V06 = () => cuba('V06', 'IMB: otra cuba, más fría y más azul, en una mina de sal de Ohio; ocho destellos en 5,6 s reales (11 a 19).', {
  rows: filas(IMB, EI, 25.4, I0, { seed: 41, box: [220, 1060, 140, 470] }), base: 11, color: '#7f9bff', fondo: { type: 'fondo', preset: 'cuba_oscura', semilla: 7, ajustes: AJ_IMB },
  camera: { move: 'static' }, etiqueta: 'IMB · OHIO', textos: [['En una mina de sal de Ohio, otra cuba: ocho.', 0.8, 4.6, { role: 'body' }]],
});

// IMB ya está; Baksan es otro medio: bloque de tanques de centelleador (aceite), no agua
const ambar = '#f0d060';
const CAPAS_BAKSAN = { type: 'fondo', capas: [
  { tipo: 'degradado', id: 'roca', modo: 'lineal', angulo: 90, stops: ['#0b0904', '#1a130a', '#080603'] },
  { tipo: 'deformado', id: 'aceite', modo: 'nube', color: '#0e0a04', colorB: '#6a4a14', escala: 0.5, fuerza: 0.7, contraste: 1.4, alfa: 0.28, mezcla: 'pantalla', deriva: [0.004, -0.002], paralaje: 0.15 },
  { tipo: 'niebla', id: 'bruma', color: '#5a4012', horizonte: 0.5, altura: 0.6, densidad: 0.35, ruido: 0.8, velocidad: 0.01, mezcla: 'pantalla', paralaje: 0.5 },
  { tipo: 'polvo', id: 'particulas', n: 110, color: '#ffe39a', tamano: [0.5, 2.4], viento: [0.001, -0.004], alfaMax: 0.35, titileo: 0.6, paralaje: 1.05 },
  { tipo: 'vineta', id: 'vineta', color: '#030201', fuerza: 0.9, interior: 0.26, paralaje: 0 },
] };
const TQ = { c: 9, f: 5, x0: 78, y0: 72, dx: 126, dy: 102, w: 116, h: 92 };
gen.V07 = () => {
  const tanque = (i) => [TQ.x0 + (i % TQ.c) * TQ.dx + TQ.w / 2, TQ.y0 + Math.floor(i / TQ.c) * TQ.dy + TQ.h / 2];
  const idx = [13, 29, 7, 24, 40];
  const rows = BAK.map((t, i) => { const [x, y] = tanque(idx[i]); return [R(B0 + t - 32.4), x, y, R(0.3 + 0.12 * i), R((EB[i] - 5) / 32), 1]; });
  const o = cuba('V07', 'Baksan: un bloque de tanques de centelleador (aceite, no agua); cinco destellos amarillentos en 9,1 s reales, con su silencio de seis segundos (19 a 24).', {
    rows: [], base: 19, color: ambar, fondo: CAPAS_BAKSAN, camera: { move: 'push', why: 'approach', amount: 0.04 }, etiqueta: 'BAKSAN · CÁUCASO',
    textos: [['En el Cáucaso, cinco.', 0.9, 4.0, { role: 'body' }], ['Allí no es agua: es centelleador.', 4.4, 10.4, { role: 'body' }]],
  });
  // la cuenta y los destellos: cada uno enciende un tanque
  o.objects.splice(1, 0,
    { id: 'tq', type: 'repeat', n: TQ.c * TQ.f, children: [
      { type: 'shape', shape: 'rect', stroke: true, lineWidth: 1.4, x: X(`${TQ.x0} + (i % ${TQ.c}) * ${TQ.dx}`), y: X(`${TQ.y0} + floor(i / ${TQ.c}) * ${TQ.dy}`), w: TQ.w, h: TQ.h, color: '#6a5326', alpha: 0.5 },
      { type: 'shape', shape: 'rect', x: X(`${TQ.x0} + (i % ${TQ.c}) * ${TQ.dx}`), y: X(`${TQ.y0} + floor(i / ${TQ.c}) * ${TQ.dy}`), w: TQ.w, h: TQ.h, color: '#2a1e0a', alpha: 0.28 },
    ] },
    { id: 'b', type: 'repeat', items: rows, fields: ['k', 'x', 'y', 'z', 'e', 'ok'], children: [
      { id: 'ageb', type: 'let', value: X('lt - b_k') }, { id: 'decb', type: 'let', value: X('exp(-ageb * 2.1)') },
      { type: 'group', when: 'ageb >= 0 && ageb < 3', children: [
        { type: 'glow', x: X('b_x'), y: X('b_y'), r: X('170 + 50 * b_e'), color: ambar, alpha: X('0.7 * decb') },
        { type: 'shape', shape: 'rect', x: X(`b_x - ${TQ.w / 2}`), y: X(`b_y - ${TQ.h / 2}`), w: TQ.w, h: TQ.h, color: ambar, alpha: X('0.85 * decb') },
        { type: 'shape', shape: 'rect', stroke: true, lineWidth: 2.4, x: X(`b_x - ${TQ.w / 2} - 8 * (1 - decb)`), y: X(`b_y - ${TQ.h / 2} - 8 * (1 - decb)`), w: X(`${TQ.w} + 16 * (1 - decb)`), h: X(`${TQ.h} + 16 * (1 - decb)`), color: '#fff3c0', alpha: X('decb') },
      ] },
    ] });
  const cont = o.objects.find((q) => q.id === 'cont'); cont.partes.valor = X(cuentaExpr(rows, 19));
  return o;
};

// V08: los tres contadores en fila; la suma baja a un 24 con un 25 fantasma
const CK = '#5FA8CF', CI = '#7f9bff', CB = ambar;
gen.V08 = () => ({
  dsl: 1, id: 'V08', doc: 'Los tres contadores (11, 8, 5) se funden en un 24; al lado, un 25 fantasma a medio apagar.', camera: { move: 'static' }, transition: { out: 'cut' },
  objects: [
    CUBA_K({ ajustes: { ...AJ, pmtLejanos: { brillo: 0.22, alfa: 0.4 }, pmtCercanos: { brillo: 0.3, alfa: 0.6 } } }),
    ...[[CK, 11, 300, 'KAMIOKANDE-II'], [CI, 8, 640, 'IMB'], [CB, 5, 980, 'BAKSAN']].flatMap(([c, v, x, lab], j) => [
      { id: 'c' + j, type: 'objeto', objeto: 'contador', x: X(`${x} + (640 - ${x}) * ease('inOut', seg(lt, 1.6, 2.8))`), y: 330, size: 260, alfa: X('seg(lt, 0.1, 0.6) * (1 - seg(lt, 2.3, 2.9))'), params: { digitos: 2, tipo: 'numerico' }, partes: { valor: v, brillo: 0.95 }, color: '#07141c', relleno: '#0a1a24', acento: c },
      { id: 'l' + j, type: 'text', text: lab, x: X(`${x} + (640 - ${x}) * ease('inOut', seg(lt, 1.6, 2.8))`), y: 410, role: 'label', align: 'center', color: c, alpha: X('0.7 * seg(lt, 0.3, 0.8) * (1 - seg(lt, 2.1, 2.6))') },
    ]),
    { id: 'tot', type: 'objeto', objeto: 'contador', x: 640, y: 330, size: 480, alfa: X('seg(lt, 2.5, 3.1)'), params: { digitos: 2, tipo: 'numerico' }, partes: { valor: 24, brillo: 1 }, color: '#07141c', relleno: '#0a1a24', acento: '#e9e6ef' },
    { id: 'fan', type: 'text', text: '25', x: 1010, y: 330, role: 'display', align: 'center', color: 'ink', alpha: X('seg(lt, 3.2, 3.8) * (0.14 + 0.1 * sin(lt * 5.5))') },
    texto('t0', 'Contamos veinticuatro.', 0.7, 4.6, { role: 'body', y: 'S_y1 - 74' }),
    texto('t1', 'Veinticinco, si vale el doce.', 2.9, 4.6, { role: 'label', y: 'S_y1 - 34', max: 0.85 }),
  ],
});

for (const [k, f] of Object.entries(gen)) { w(k, f()); }
console.log('escenas:', Object.keys(gen).join(' '));
