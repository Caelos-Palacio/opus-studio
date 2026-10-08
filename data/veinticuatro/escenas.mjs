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
const sfxGota = (r) => ({ at: r[0], type: 'gota', gain: R(r[5] < 1 ? 0.22 : 0.5 + 0.45 * r[3]), pan: R(Math.max(-1, Math.min(1, (r[1] - 640) / 640)) * 0.7), energia: R(Math.max(0, Math.min(1, r[4]))) });
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
          { type: 'glow', x: X('f_x'), y: X('f_y'), r: X('(60 + 200 * f_z) * (0.6 + 0.4 * f_e)'), color, alpha: X('0.42 * dec * f_ok') },
          { type: 'glow', x: X('f_x'), y: X('f_y'), r: X('(20 + 50 * f_z)'), color: 'ink', alpha: X('0.35 * exp(-age * 9) * f_ok') },
          { type: 'shape', shape: 'circle', stroke: true, lineWidth: X('2 + 5 * f_z'), x: X('f_x'), y: X('f_y'), r: X('12 + (60 + 190 * f_z) * (1 - exp(-age * 3.4))'), color, alpha: X('0.85 * dec * f_ok') },
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

export function contador(valor, color, alpha = 1, { x = 215, y = 112, size = 220, label = null } = {}) {
  return { id: 'cont', type: 'objeto', objeto: 'contador', x, y, size, alfa: alpha, params: { digitos: 2, tipo: 'numerico' }, partes: { valor: X(valor), brillo: 0.95 }, color: '#07141c', relleno: '#0a1a24', acento: color };
}

// cuba_oscura más hundida: menos haz, menos turbidez, fotomultiplicadores lejanos casi apagados (el oscuro es el tema)
const AJ = { agua: { stops: ['#01070c', '#03141d', '#010305'] }, haces: { intensidad: 0.045 }, turbidez: { alfa: 0.1 }, bruma: { densidad: 0.2 }, pmtLejanos: { brillo: 0.3, alfa: 0.5 }, pmtCercanos: { brillo: 0.4, alfa: 0.75 }, vineta: { fuerza: 0.9 } };
const CUBA_K = (extra = {}) => ({ type: 'fondo', preset: 'cuba_oscura', ajustes: AJ, ...extra });

function cuba(id, doc, { rows, base = 0, color = 'accent2', fondo = CUBA_K(), textos = [], camera = { move: 'push', why: 'approach', amount: 0.02 }, contAlpha = '1', extra = [], etiqueta = null }) {
  const objs = [fondo]; if (rows.length) { objs.push(flashes(rows, color)); SFX[id] = rows.map(sfxGota); }
  objs.push(contador(rows.length ? cuentaExpr(rows, base) : String(base), color, null));
  objs[objs.length - 1].alfa = X(contAlpha);
  if (etiqueta) objs.push({ ...texto('et', etiqueta, 0.3, 99, { x: '215', y: '178', role: 'label', color, max: 0.6, align: 'center' }) });
  for (const [i, t] of textos.entries()) objs.push(texto('t' + i, ...t));
  objs.push(...extra);
  return { dsl: 1, id, doc, camera, transition: { out: 'cut' }, objects: objs };
}


// ───────────────── mitad 1: las cubas ─────────────────
const gen = {};
const SFX = {};   // id de shot → sfx (se escriben en el timeline al final)
const FIN = (id, lines) => lines;
gen.V01 = () => cuba('V01', 'La cuba antes del primer destello: agua negra, fotomultiplicadores como lunas, nada ocurre (8,2 s).', {
  rows: [], base: 0, contAlpha: 'seg(lt, 6.0, 7.4) * 0.5', camera: { move: 'push', why: 'approach', amount: 0.03 },
  textos: [['Kamioka, mil metros bajo la roca.', 0.9, 8.1, { role: 'body', y: 'S_y1 - 74' }], ['Una cuba de agua, mil fotomultiplicadores. Esperan.', 2.6, 8.1, { role: 'body', y: 'S_y1 - 34' }]],
});
gen.V02 = () => cuba('V02', 'Primer destello y los nueve de la primera ráfaga, al ritmo real de Kamiokande-II (1,915 s).', {
  rows: filas(KAM.slice(0, 9), EK.slice(0, 9), 8.2, F1, { seed: 11, zOverride: [0.5, 0.2, 0.85, 0.35, 0.65, 0.15, 0.95, 0.4, 0.7] }), base: 0, contAlpha: '0.5 + 0.5 * seg(lt, 0.6, 0.8)',
  camera: { move: 'static' }, etiqueta: 'KAMIOKANDE-II', textos: [['Uno.', 0.8, 1.9, { role: 'h2', y: 'S_y1 - 96' }], ['Nueve en menos de dos segundos.', 1.3, 4.4, { role: 'body', y: 'S_y1 - 34' }]],
});
gen.V03 = () => cuba('V03', 'La pausa real: 7,304 s entre el 9.º y el 10.º destello. No ocurre nada; solo agua, niebla y polvo. El contador queda en 9.', {
  rows: [], base: 9, camera: { move: 'push', why: 'approach', amount: 0.025 }, etiqueta: 'KAMIOKANDE-II',
  textos: [['Pasan siete segundos. No llega ninguno.', 1.0, 5.4, { role: 'body' }]],
});
// V04: el 10.º destello a F1+9,219 s y el 11.º a +10,433 s. El shot empieza a 18,15 s
gen.V04 = () => cuba('V04', 'Dos destellos más (9,219 y 10,433 s tras el primero): el contador llega a 11.', {
  rows: filas(KAM.slice(9, 11), EK.slice(9, 11), 18.15, F1, { seed: 21, zOverride: [0.6, 0.3] }), base: 9, camera: { move: 'static' }, etiqueta: 'KAMIOKANDE-II',
  textos: [['Dos más. Contamos once.', 0.5, 2.85, { role: 'body' }]],
});
gen.V05 = () => cuba('V05', 'El duodécimo (12,439 s) llega a media luz: el contador no lo acepta y queda parpadeando en un 12 fantasma entre interrogaciones de grafito.', {
  rows: filas(KAM.slice(11, 12), EK.slice(11, 12), 21.0, F1, { seed: 31, zOverride: [0.5], okFrom: 0 }).map((r) => { r[5] = 0.6; return r; }), base: 11, camera: { move: 'push', why: 'approach', amount: 0.03 }, etiqueta: 'KAMIOKANDE-II',
  extra: [
    { id: 'fan', type: 'text', text: '12', x: 400, y: 112, role: 'h2', align: 'center', color: 'ink', alpha: X('seg(lt, 0.7, 1.0) * (0.3 + 0.25 * sin(lt * 7))') },
    { id: 'q1', type: 'text', text: '?', x: 470, y: 90, role: 'h2', align: 'center', color: 'shade', alpha: X('seg(lt, 1.2, 1.8) * 0.6') },
    { id: 'q2', type: 'text', text: '?', x: 510, y: 135, role: 'body', align: 'center', color: 'shade', alpha: X('seg(lt, 1.6, 2.2) * 0.5') },
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
        { type: 'glow', x: X('b_x'), y: X('b_y'), r: X('170 + 50 * b_e'), color: ambar, alpha: X('0.5 * decb') },
        { type: 'shape', shape: 'rect', x: X(`b_x - ${TQ.w / 2}`), y: X(`b_y - ${TQ.h / 2}`), w: TQ.w, h: TQ.h, color: ambar, alpha: X('0.6 * decb') },
        { type: 'shape', shape: 'rect', stroke: true, lineWidth: 2.4, x: X(`b_x - ${TQ.w / 2} - 8 * (1 - decb)`), y: X(`b_y - ${TQ.h / 2} - 8 * (1 - decb)`), w: X(`${TQ.w} + 16 * (1 - decb)`), h: X(`${TQ.h} + 16 * (1 - decb)`), color: '#fff3c0', alpha: X('decb') },
      ] },
    ] });
  const cont = o.objects.find((q) => q.id === 'cont'); cont.partes.valor = X(cuentaExpr(rows, 19)); SFX.V07 = rows.map(sfxGota);
  return o;
};

// V08: los tres contadores en fila; la suma baja a un 24 con un 25 fantasma
const CK = '#5FA8CF', CI = '#7f9bff', CB = ambar;
gen.V08 = () => ({
  dsl: 1, id: 'V08', doc: 'Los tres contadores (11, 8, 5) se funden en un 24; al lado, un 25 fantasma a medio apagar.', camera: { move: 'static' }, transition: { out: 'cut' },
  objects: [
    CUBA_K({ ajustes: { ...AJ, pmtLejanos: { brillo: 0.22, alfa: 0.4 }, pmtCercanos: { brillo: 0.3, alfa: 0.6 } } }),
    ...[[CK, 11, 300, 'KAMIOKANDE-II'], [CI, 8, 640, 'IMB'], [CB, 5, 980, 'BAKSAN']].flatMap(([c, v, x, lab], j) => [
      { id: 'c' + j, type: 'objeto', when: 'lt < 3.2', objeto: 'contador', x: X(`${x} + (640 - ${x}) * ease('inOut', seg(lt, 1.9, 3.0))`), y: 290, size: 260, alfa: X('seg(lt, 0.1, 0.6) * (1 - seg(lt, 2.5, 3.1))'), params: { digitos: 2, tipo: 'numerico' }, partes: { valor: v, brillo: 0.95 }, color: '#07141c', relleno: '#0a1a24', acento: c },
      { id: 'l' + j, type: 'text', when: 'lt < 2.0', text: lab, x, y: 372, role: 'label', align: 'center', color: c, alpha: X('0.75 * seg(lt, 0.2, 0.6) * (1 - seg(lt, 1.6, 1.95))') },
    ]),
    { id: 'tot', type: 'objeto', when: 'lt > 2.5', objeto: 'contador', x: 640, y: 300, size: 480, alfa: X('seg(lt, 2.7, 3.2)'), params: { digitos: 2, tipo: 'numerico' }, partes: { valor: 24, brillo: 1 }, color: '#07141c', relleno: '#0a1a24', acento: '#e9e6ef' },
    { id: 'fan', type: 'text', when: 'lt > 3.2', text: '25', x: 1020, y: 300, role: 'display', align: 'center', color: 'ink', alpha: X('seg(lt, 3.2, 3.8) * (0.36 + 0.14 * sin(lt * 5.5))') },
    texto('t0', 'Contamos veinticuatro.', 0.6, 4.6, { role: 'body', y: 'S_y1 - 74' }),
    texto('t1', 'Veinticinco, si vale el doce.', 1.4, 4.6, { role: 'label', y: 'S_y1 - 34', max: 0.85 }),
  ],
});

// ───────────────── mitad 2: el archivo (mesa, lámpara, papel continuo) ─────────────────
const MESA = { type: 'fondo', capas: [
  { tipo: 'degradado', id: 'mesa', modo: 'lineal', angulo: 90, stops: ['#0d0805', '#1d130a', '#090604'] },
  { tipo: 'deformado', id: 'vetas', color: '#120a05', colorB: '#4a3018', escala: 0.14, estira: 7, fuerza: 0.5, contraste: 1.5, alfa: 0.35, mezcla: 'superponer', paralaje: 0.18 },
  { tipo: 'foco', id: 'pozo', color: '#ffcf8a', centro: [0.55, 0.55], radio: 0.55, achatado: 0.7, intensidad: 0.28, mezcla: 'pantalla', paralaje: 0.4 },
  { tipo: 'polvo', id: 'serrin', n: 80, color: '#ffe2b0', alfaMax: 0.45, tamano: [0.5, 2.2], viento: [0.003, -0.004], paralaje: 1 },
  { tipo: 'vineta', id: 'vineta', color: '#050302', fuerza: 0.92, interior: 0.22, paralaje: 0 },
] };
const PX = 64, PX0 = -392, FILA = [-130, 0, 130];
const wx = (t) => R(PX0 + PX * t);
// puntos del listado: [wx, wy, hueco(0|1), orden de conteo (0..23, -1 el dudoso), índice global]
const PUNTOS = (() => { const r = []; let ord = 0, g = 0;
  KAM.forEach((t, i) => { r.push(i === 11 ? [wx(t), FILA[0], 1, -1, g++] : [wx(t), FILA[0], 0, ord++, g++]); });
  IMB.forEach((t) => r.push([wx(t), FILA[1], 0, ord++, g++])); BAK.forEach((t) => r.push([wx(t), FILA[2], 0, ord++, g++])); return r; })();
const GRAFITO = '#34343a', TINTA = '#1f160d';

// hoja de papel continuo dibujada con formas (para los primeros planos: el objeto papel_continuo registra un foco del tamaño de la hoja y el texto no puede pisarlo)
const papelFormas = (SX, SY, Z, glowOn) => [
  { id: 'pg', type: 'repeat', n: 9, children: [
    { type: 'shape', shape: 'rect', x: X(`${SX('-450 + i * 100')}`), y: X(SY('-290')), w: X('100 * Z + 1'), h: X('580 * Z'), color: X('i % 2 == 0 ? "#cdbf9b" : "#bfb08a"'), alpha: X(`0.2 + 0.5 * ${glowOn}`) },
    { type: 'shape', shape: 'rect', stroke: true, lineWidth: 1.2, x: X(`${SX('-450 + i * 100')}`), y: X(SY('-290')), w: X('100 * Z + 1'), h: X('580 * Z'), color: '#3a2a18', alpha: X(`0.25 * ${glowOn}`) },
  ] },
  { id: 'pp', type: 'repeat', n: 36, children: [
    { type: 'shape', shape: 'circle', x: X(SX('-440 + (i % 18) * 51')), y: X(SY('i < 18 ? -268 : 268')), r: X('max(2, 5 * Z)'), color: '#1a1008', alpha: X(`0.28 * ${glowOn}`) },
  ] },
];

function mesa(id, doc, { Z, FX = '0', FY = '0', slide = null, lamp, glowOn = '1', marks = '0', pencil = null, hand = false, camera = { move: 'static' }, textos = [], extra = [], agua = null, dots = '1', fan = null, aparece = false, formas = false, encendido = null }) {
  const sl = slide ? 'sl' : null, SX = (w) => `640 + ((${w}) - FX) * Z${sl ? ' + sl' : ''}`, SY = (w) => `360 + ((${w}) - FY) * Z`;
  const AP = aparece ? 'seg(lt, 1.2 + d_g * 0.05, 1.5 + d_g * 0.05)' : '1', o = [{ ...MESA }];
  o.push({ id: 'Z', type: 'let', value: X(Z) }, { id: 'FX', type: 'let', value: X(FX) }, { id: 'FY', type: 'let', value: X(FY) });
  if (slide) o.push({ id: 'sl', type: 'let', value: X(slide) });
  o.push({ id: 'ox', type: 'let', value: X(SX('0')) }, { id: 'oy', type: 'let', value: X(SY('0')) });
  o.push({ type: 'glow', x: X('ox'), y: X('oy'), r: X('560 * Z'), color: 'accent', alpha: X(`0.16 * ${glowOn}`) });
  if (encendido) o.push({ type: 'glow', when: 'lt > 0.4 && lt < 1.6', x: X('ox'), y: X('oy'), r: 900, color: 'accent', alpha: X(encendido) });
  if (formas) o.push(...papelFormas(SX, SY, Z, glowOn));
  else o.push({ id: 'papel', type: 'objeto', objeto: 'papel_continuo', x: X('ox'), y: X('oy'), size: X('1000 * Z'), rot: 1.5708, params: { pliegues: 9 }, partes: { despliegue: 1, impreso: 0 }, relleno: '#d8c9a4', color: '#3a2a18', acento: '#b99a68', alfa: X(`0.2 + 0.5 * ${glowOn}`) });
  // la luz de la lámpara: charco ámbar sobre el papel y oscuridad en los bordes (ilumina lo que hay debajo: hoja y puntos)
  o.push({ type: 'fondo', capas: [{ tipo: 'foco', id: 'charco', color: '#ffcf8a', centro: [0.5, 0.52], radio: 0.42, achatado: 0.8, intensidad: 0.22, mezcla: 'pantalla', paralaje: 0 }, { tipo: 'vineta', id: 'borde', color: '#030201', fuerza: 0.96, interior: 0.1, paralaje: 0 }], alfa: X(`${glowOn}`) });
  o.push({ id: 'd', type: 'repeat', items: PUNTOS, fields: ['x', 'y', 'h', 'o', 'g'], children: [
    { id: 'dx', type: 'let', value: X(SX('d_x')) }, { id: 'dy', type: 'let', value: X(SY('d_y')) },
    { type: 'group', when: 'd_h == 0', children: [{ type: 'shape', shape: 'circle', x: X('dx'), y: X('dy'), r: X('max(2, 6.5 * Z)'), color: TINTA, alpha: X(`(${dots}) * ${AP} * ${glowOn}`) }] },
    { type: 'group', when: 'd_h == 1', children: [{ type: 'shape', shape: 'circle', stroke: true, lineWidth: X('max(1, 1.6 * Z)'), x: X('dx'), y: X('dy'), r: X('max(3, 7.5 * Z)'), color: TINTA, alpha: X(`0.7 * (${dots}) * ${AP} * ${glowOn}`) }] },
    { type: 'group', when: 'd_o >= 0', children: [
      { id: 'mk', type: 'let', value: X(marks) },
      { type: 'shape', shape: 'circle', stroke: true, lineWidth: X('max(1.2, 2.2 * Z)'), x: X('dx'), y: X('dy'), r: X('max(5, 13 * Z)'), color: GRAFITO, alpha: 0.85, sweep: X('6.2832 * mk') },
    ] },
  ] });
  if (fan) o.push(...fan(SX, SY));
  o.push({ id: 'lamp', type: 'objeto', objeto: 'lampara_mesa', x: X(lamp.x), y: X(lamp.y), size: X(lamp.size), relleno: '#9a6b22', color: '#f1d9a0', params: { cono: false }, partes: { encendida: X(lamp.on), brazo1: 0.7, brazo2: 0.8 }, alfa: X(lamp.alfa ?? '1') });
  if (pencil) {
    o.push({ id: 'tx', type: 'let', value: X(SX(pencil.x)) }, { id: 'ty', type: 'let', value: X(SY(pencil.y)) });
    const ps = `${pencil.size ?? 330} * Z`, dx = Math.cos(2.3), dy = Math.sin(2.3);
    o.push({ id: 'lap', type: 'objeto', when: pencil.when ?? 'true', objeto: 'lapiz', x: X(`tx - 0.375 * (${ps}) * ${R(dx)}`), y: X(`ty - 0.375 * (${ps}) * ${R(dy)}`), size: X(ps), rot: 2.3, color: '#1a1008', params: { color: '#c79a4a' }, partes: { desgaste: 0.3 }, alfa: X(pencil.alpha ?? '1') });
    if (hand) o.push({ id: 'mano', type: 'objeto', when: pencil.when ?? 'true', objeto: 'mano', x: X(`tx - 0.65 * (${ps}) * ${R(dx)}`), y: X(`ty - 0.65 * (${ps}) * ${R(dy)}`), size: X(`${(pencil.size ?? 330) * 0.95} * Z`), rot: 3.87, estado: 'pinza', relleno: '#2b1b0e', color: '#caa66a', alfa: X(pencil.alpha ?? '1') });
  }
  o.push(...extra);
  if (agua) o.push({ type: 'fondo', preset: 'cuba_oscura', ajustes: AJ, alfa: X(agua) });
  for (const [i, t] of textos.entries()) o.push(texto('t' + i, ...t));
  return { dsl: 1, id, doc, camera, transition: { out: 'cut' }, objects: o };
}

gen.V09 = () => mesa('V09', 'El agua se apaga de golpe; entra una lámpara de mesa ámbar y una hoja de papel continuo con los mismos 24 puntos (más el dudoso, hueco).', {
  Z: '0.8', FY: '119', aparece: true, slide: '(1 - smooth(seg(lt, 0.5, 1.7))) * 1100', glowOn: 'seg(lt, 0.45, 1.2)', encendido: '0.55 * exp(-(lt - 0.45) * 4.5)',
  lamp: { x: '200', y: '300', size: '480', on: 'seg(lt, 0.4, 1.0)', alfa: 'seg(lt, 0.3, 0.6)' },
  camera: { move: 'push', why: 'approach', amount: 0.03 }, textos: [['Nadie los vio llegar.', 0.9, 6.9, { role: 'body', y: 'S_y1 - 74' }], ['Los encontraron en un listado de impresora, dos días después.', 1.7, 6.9, { role: 'label', y: 'S_y1 - 34' }]],
});
const GAP_X = R((wx(KAM[8]) + wx(KAM[9])) / 2);
gen.V10 = () => mesa('V10', 'El tramo en blanco entre el 9.º y el 10.º punto (los 7,3 s): una mano con lápiz lo recorre sin marcar nada.', {
  Z: '1.25', FX: String(GAP_X), FY: String(FILA[0] + 60), formas: true, lamp: { x: '-130', y: '250', size: '520', on: '1' },
  camera: { move: 'static' }, pencil: { x: `${R(wx(KAM[8]) - 40)} + ${R(wx(KAM[9]) - wx(KAM[8]) + 80)} * smooth(seg(lt, 0.5, 3.4))`, y: `${FILA[0]} + 4 + 1.5 * sin(lt * 4)`, alpha: 'seg(lt, 0.1, 0.5)' }, hand: true,
  textos: [['En esos 13 segundos, ni un ruido ajeno.', 0.6, 3.9, { role: 'body', y: 'S_y1 - 34' }]],
});
const ZZ = 'smooth(seg(lt, 0, 2.4))';
gen.V11 = () => mesa('V11', 'La lámpara se aleja con paralaje; 24 puntos, una flecha fina hacia un horizonte sin fin, el listado marcado a lápiz salvo el dudoso.', {
  Z: `1.25 - 0.85 * ${ZZ}`, FX: `${GAP_X} * (1 - ${ZZ})`, FY: `${FILA[0] + 60} * (1 - ${ZZ}) + 20 * ${ZZ}`, formas: true,
  lamp: { x: '-130 + 150 * smooth(seg(lt, 0.2, 5.4))', y: '250 - 40 * smooth(seg(lt, 0.2, 5.4))', size: '520 - 150 * smooth(seg(lt, 0.2, 5.4))', on: '1' },
  marks: '(d_o == 23 ? 0 : seg(lt, 1.0 + d_o * 0.12, 1.3 + d_o * 0.12))', camera: { move: 'pull', why: 'reveal', amount: 0.04 },
  extra: [
    { id: 'fl', type: 'lines', segs: [[X('ox + 410 * Z'), X('oy'), 1900, X('oy')], [X('1900'), X('oy'), X('1900 - 14'), X('oy - 6')], [X('1900'), X('oy'), X('1900 - 14'), X('oy + 6')]], color: 'ink', lineWidth: 1.2, alpha: X('0.55 * seg(lt, 3.5, 4.8)') },
  ],
  textos: [['Salieron unos 10⁵⁸. Hace 168 000 años.', 1.2, 6.1, { role: 'body', y: 'S_y1 - 74' }], ['Aquí se contaron 24.', 3.0, 6.1, { role: 'label', y: 'S_y1 - 34' }]],
});

// V12: la mano marca el último punto (el 24); el duodécimo (el dudoso) queda sin marcar, con el lápiz a medias; la lámpara se apaga y vuelve el agua negra
const U = FILA[2], L24 = PUNTOS[PUNTOS.length - 1], D12 = PUNTOS[11];
gen.V12 = () => mesa('V12', 'La mano marca el último punto con lápiz; el duodécimo queda sin marcar, con el lápiz a medias; la lámpara se apaga despacio y vuelve el agua negra.', {
  Z: '0.95 + 0.1 * smooth(seg(lt, 0, 5))', FX: '300', FY: '150', formas: true, glowOn: '(1 - smooth(seg(lt, 5.8, 8.4)))', lamp: { x: '120', y: '300', size: '440', on: '(1 - smooth(seg(lt, 5.8, 8.4)))' },
  marks: `(d_o == 23 ? seg(lt, 1.7, 2.7) : seg(lt, -9, -8.9))`, camera: { move: 'static' },
  pencil: {
    x: `lt < 1.7 ? 60 + ${R(L24[0] + 13 - 60)} * smooth(seg(lt, 0.2, 1.7)) : lt < 2.9 ? ${L24[0]} + 13 * cos(6.2832 * seg(lt, 1.7, 2.7)) : lt < 4.4 ? ${R(L24[0] + 13)} + ${R(D12[0] + 13 - L24[0] - 13)} * smooth(seg(lt, 2.9, 4.3)) : ${D12[0]} + 13 * cos(3.1416 * seg(lt, 4.4, 5.6))`,
    y: `lt < 1.7 ? 20 + ${R(L24[1] - 20)} * smooth(seg(lt, 0.2, 1.7)) : lt < 2.9 ? ${L24[1]} + 13 * sin(6.2832 * seg(lt, 1.7, 2.7)) : lt < 4.4 ? ${L24[1]} + ${R(D12[1] - L24[1])} * smooth(seg(lt, 2.9, 4.3)) : ${D12[1]} + 13 * sin(3.1416 * seg(lt, 4.4, 5.6))`,
    alpha: '1 - smooth(seg(lt, 6.4, 8.2))',
  }, hand: true,
  extra: [{ id: 'med', type: 'shape', shape: 'circle', stroke: true, lineWidth: X('max(1.2, 2.2 * Z)'), x: X(`640 + (${D12[0]} - FX) * Z`), y: X(`360 + (${D12[1]} - FY) * Z`), r: X('max(5, 13 * Z)'), color: GRAFITO, alpha: 0.85, sweep: X('3.1416 * seg(lt, 4.4, 5.6)') }],
  agua: 'smooth(seg(lt, 6.8, 9.0)) * 0.97',
  textos: [['Contamos.', 6.4, 9.6, { role: 'h2', y: 'S_y1 - 40', color: 'ink' }]],
});

// sonido: gotas de cada destello (arriba) + el resto de eventos declarados del film
const EXTRA = {
  V01: [{ at: 0.4, type: 'drone', dur: 10.8, gain: 0.5 }],
  V08: [{ at: 2.5, type: 'gota', gain: 0.7, energia: 0.05 }, { at: 3.3, type: 'gota', gain: 0.16, energia: 0.95, pan: 0.5 }],
  V09: [{ at: 0.45, type: 'click', gain: 0.5, pan: -0.3 }, { at: 1.0, type: 'nota', dur: 19.5, gain: 0.5 }],
  V11: Array.from({ length: 23 }, (_, o) => ({ at: R(1.15 + o * 0.12), type: 'click', gain: 0.11, pan: R(-0.2 + 0.4 * (o % 3) / 2) })),
  V12: [{ at: 2.6, type: 'click', gain: 0.22 }, { at: 5.8, type: 'click', gain: 0.4, pan: -0.4 }],
};
for (const [k, f] of Object.entries(gen)) { w(k, f()); }
const tlPath = new URL('./timeline.json', import.meta.url), tl = JSON.parse(fs.readFileSync(tlPath, 'utf8'));
for (const sh of tl.shots) { const l = [...(SFX[sh.id] ?? []), ...(EXTRA[sh.id] ?? [])]; if (l.length) sh.sfx = l; }
fs.writeFileSync(tlPath, JSON.stringify(tl, null, 1));
console.log('escenas:', Object.keys(gen).join(' '), '· sfx:', tl.shots.reduce((n, s) => n + (s.sfx?.length ?? 0), 0));
