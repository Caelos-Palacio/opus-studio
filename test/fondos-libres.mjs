#!/usr/bin/env node
// Spec 021 (BDD de FONDOS LIBRES): valores animables (expr / keyframes / colores OKLab / anclas), capas reactivas a eventos, capa `codigo`
// (sandbox, guardia AST, hash, coste, falla cerrada) y anti-menú (presets genéricos, derivar, lint fondo.estatico / preset_crudo / codigo_lento).
import fs from 'node:fs';
import path from 'node:path';
import canvasPkg from 'canvas';
import crypto from 'node:crypto';
import { ROOT, copyRepo, rmrf, run, FONTS_CONF } from './lib.mjs';
import { drawFondo, validateFondo, PRESETS, CAPAS, derivarPreset, makeColor, fondoAnimado } from '../engine/fondos.mjs';
import { resolver, makeEnv, evHelpers, esDinamico } from '../engine/fondo-valor.mjs';
import { eventosDeFilm } from '../engine/fondo-eventos.mjs';
import { analizarFondos, FONDO_LIBRE } from '../engine/fondo-lint.mjs';
import { scanSource, scanFondoCodigo } from '../engine/guard.mjs';
import { mix, hex2rgb } from '../engine/color.mjs';
import { validateScene } from '../engine/dsl-core.mjs';
import { DEFAULTS } from '../engine/styles.mjs';
const { createCanvas } = canvasPkg;

let n = 0, bad = 0;
const ok = (m, c, info = '') => { n++; console.log(`${c ? '✓' : '✗'} fondos-libres: ${m}${info ? '  ' + String(info).replace(/\n✗ /g, '\n· ').replace(/^✗ /, '· ') : ''}`); if (!c) bad++; };
const PAL = { ...DEFAULTS.palette, paper: '#f4efe4', ink: '#1c1b1a' }, W = 320, H = 180;
const sha = (im) => crypto.createHash('sha1').update(im.data).digest('hex').slice(0, 12);
const diffPx = (a, b) => { let c = 0; for (let i = 0; i < a.data.length; i += 4) if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 6) c++; return c; };
const meanL = (im) => { let s = 0; for (let i = 0; i < im.data.length; i += 4) s += im.data[i] + im.data[i + 1] + im.data[i + 2]; return s / (im.data.length / 4) / 3; };
const cx = (im, x0, x1) => { let sx = 0, m = 0; for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * 4; m += im.data[i]; } return m; };
// Pinta un fondo en t con eventos del film (E.eventos), lt/u/dur propios y caché opcional (para probar independencia de la caché).
const render = (spec, t, { base = '#808080', cache = new Map(), eventos = [], extra = {}, dur = 12, t0 = 0 } = {}) => {
  const cv = createCanvas(W, H), g = cv.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, W, H); g.scale(W / 1280, W / 1280);
  drawFondo(g, spec, t, { W: 1280, H: 720, k: 1, pal: PAL, canvas: (a, b) => createCanvas(a, b), cache, depth: (d, fn) => fn(), lt: t - t0, u: (t - t0) / dur, dur, t0, eventos, beatAt: (tt) => tt * 2, ...extra });
  return g.getImageData(0, 0, W, H);
};
const col = makeColor(PAL);
const ENV = (o = {}) => makeEnv({ t: 0, lt: 0, u: 0, dur: 12, t0: 0, beatAt: (t) => t * 2, eventos: [], hex: col.hex, pal: PAL, ...o });
const errs = (spec) => validateFondo(spec);

// ── A. valores animables ──
{
  const k = { k: [[0, 0], [2, 10]], ease: 'linear' };
  ok('A1 keyframes numéricos: lerp con la curva; antes del primero y después del último se mantiene', resolver(k, 'num', ENV({ lt: 1 })) === 5 && resolver(k, 'num', ENV({ lt: -3 })) === 0 && resolver(k, 'num', ENV({ lt: 9 })) === 10);
  const e1 = { k: [[0, 0], [2, 10]] }, v = resolver(e1, 'num', ENV({ lt: 0.5 }));
  ok('A1 sin ease usa smooth (más lento al principio que lineal)', v < 2.5 && v > 0, `v=${v.toFixed(2)}`);
  ok('A1 int redondea, enum/bool son escalón', resolver({ k: [[0, 2], [2, 8]], ease: 'linear' }, 'int', ENV({ lt: 0.6 })) === 4 && resolver({ k: [[0, 'rampa'], [2, 'nube']] }, 'enum', ENV({ lt: 1 })) === 'rampa' && resolver({ k: [[0, 'rampa'], [2, 'nube']] }, 'enum', ENV({ lt: 2 })) === 'nube');
  const c = { k: [[0, '#ff0000'], [2, '#00ff00']], ease: 'linear' }, mid = resolver(c, 'color', ENV({ lt: 1 }));
  const rgbAvg = '#' + hex2rgb('#ff0000').map((x, i) => Math.round((x + hex2rgb('#00ff00')[i]) / 2).toString(16).padStart(2, '0')).join('');
  ok('A2 colores: el punto medio es mix OKLab de los extremos, no la media RGB', mid === mix('#ff0000', '#00ff00', 0.5) && mid !== rgbAvg, `${mid} vs rgb ${rgbAvg}`);
  ok('A2 admite roles de la paleta y {mezcla} con u animado', resolver({ k: [[0, 'paper'], [2, 'ink']], ease: 'linear' }, 'color', ENV({ lt: 2 })) === 'ink' && col.hex(resolver({ mezcla: ['paper', 'ink', { k: [[0, 0], [2, 1]], ease: 'linear' }] }, 'color', ENV({ lt: 1 }))) === mix(PAL.paper, PAL.ink, 0.5));
  ok('A2 listas de colores: elementos dinámicos y keyframes de listas completas', JSON.stringify(resolver([{ k: [[0, '#000000'], [1, '#ffffff']], ease: 'linear' }, 'paper'], 'colores', ENV({ lt: 0.5 }))) === JSON.stringify([mix('#000000', '#ffffff', 0.5), 'paper']) && resolver({ k: [[0, ['#000000', 'paper']], [1, ['#ffffff', 'ink']]], ease: 'linear' }, 'colores', ENV({ lt: 1 })).join() === '#ffffff,ink');
  const evs = [{ t: 6, kind: 'cue', id: 'giro' }];
  const g = { k: [[-1, 0], [1, 10]], en: 'giro', ease: 'linear' };
  ok('A3 `en` desplaza los keyframes al instante del evento (lt = t − t0)', resolver(g, 'num', ENV({ lt: 5, t: 5, eventos: evs })) === 0 && resolver(g, 'num', ENV({ lt: 6, t: 6, eventos: evs })) === 5 && resolver(g, 'num', ENV({ lt: 7, t: 7, eventos: evs })) === 10);
  ok('A3 `en` respeta t0 del shot (el ancla es del film, lt es local)', resolver(g, 'num', ENV({ lt: 2, t: 8, t0: 6, eventos: [{ t: 8, kind: 'cue', id: 'giro' }] })) === 5);
  let m = ''; try { resolver({ k: [[0, 1], [1, 2]], en: 'giroo' }, 'num', ENV({ eventos: evs })); } catch (e) { m = e.message; }
  ok('A3 ancla inexistente falla con «¿quisiste decir…?»', /ancla "giroo" no existe/.test(m) && /quisiste decir "giro"/.test(m), m.slice(0, 120));
  ok('A4 ejes u, t y beat', resolver({ k: [[0, 0], [1, 10]], eje: 'u', ease: 'linear' }, 'num', ENV({ u: 0.25 })) === 2.5 && resolver({ k: [[0, 0], [4, 8]], eje: 'beat', ease: 'linear' }, 'num', ENV({ t: 1, lt: 1, beat: 2 })) === 4 && resolver({ k: [[0, 0], [10, 10]], eje: 't', ease: 'linear' }, 'num', ENV({ t: 3, lt: 1 })) === 3);
  const E5 = ENV({ t: 2, lt: 2, u: 0.5, dur: 8, beat: 4 });
  ok('A4 expr con t lt u dur beat y funciones de expr.mjs', resolver({ expr: 'lt*2 + u + beat/4 + clamp(dur,0,1)' }, 'num', E5) === 6.5);
  const ev = [{ t: 1, kind: 'impacto', id: 'K:i0' }, { t: 4, kind: 'impacto', id: 'K:i1' }, { t: 6, kind: 'beat', id: 'b4' }], h = evHelpers(ev, 5);
  ok('A4 funciones de eventos: pulso, desde, hasta, paso, cuenta', Math.abs(h.pulso('impacto', 1) - (Math.exp(-4) + Math.exp(-1))) < 1e-9 && h.desde('impacto') === 1 && h.hasta('b4') === 1 && h.hasta('cue') === 999 && h.cuenta('impacto') === 2 && h.paso('K:*', 2) === 1 && h.paso('b4', 2) === 0);
  ok('A4 expr usa pulso/paso con los eventos del cuadro', Math.abs(resolver({ expr: "pulso('impacto',1)" }, 'num', ENV({ t: 1, lt: 1, eventos: ev })) - 1) < 1e-9);
  // validación
  const e = errs({ capas: [{ tipo: 'fbm', color: { k: [[1, '#fff'], [0, 'xx!']], en: 5 }, alfa: { expr: 'sin(' }, escala: { expr: 'lt' }, contraste: { k: [[0, 1]], ease: 'nope' } }, { tipo: 'niebla', color: { expr: 'lt' } }] });
  const paths = e.map((x) => x.path).join(' ');
  ok('A5 validación: keyframes desordenados, color roto, ancla no texto, expr rota, ease desconocida y expr en un color fallan con ruta', /capas\/0\/color\/k\/1/.test(paths) && /capas\/0\/color\/en/.test(paths) && /capas\/0\/alfa/.test(paths) && /capas\/0\/contraste\/ease/.test(paths) && /capas\/1\/color/.test(paths) && e.some((x) => /quisiste decir "smooth"|válidos/.test(x.remedy)), paths);
  ok('A5 un spec con valores dinámicos y eventos válidos valida', !errs({ capas: [{ tipo: 'degradado', stops: [{ k: [[-1, '#6b7a68'], [1.5, '#bcd8ee']], en: 'giro' }, 'paper'] }, { tipo: 'fbm', alfa: { expr: "0.3+pulso('impacto',0.5)" }, color: { mezcla: ['paper', 'ink', { expr: 'u' }] } }, { tipo: 'onda', evento: 'impacto' }], eventos: [{ id: 'giro', at: 6 }, { tipo: 'impacto', at: 3, x: 0.3, y: 0.4 }] }).length);
  ok('A5 eventos mal formados fallan (at ausente, clave desconocida)', errs({ capas: [{ tipo: 'relleno' }], eventos: [{ id: 'a' }, { at: 1, quien: 'x' }, 7] }).length >= 3);
  ok('A5 los fondos de la spec 014 siguen validando (todos los presets)', Object.keys(PRESETS).every((p) => !errs({ preset: p }).length));
}

// ── B. determinismo y caché ──
{
  const spec = { capas: [{ tipo: 'degradado', stops: [{ k: [[-1, '#6b7a68'], [1.5, '#bcd8ee']], en: 'giro' }, { k: [[-1, '#22302a'], [1.5, '#e8f2fa']], en: 'giro' }] },
    { tipo: 'fbm', color: { k: [[-1, '#304030'], [1.5, '#d0e8ff']], en: 'giro' }, colorB: 'paper', modo: 'nube', alfa: { expr: "0.3+0.4*pulso('impacto',0.5)" } }, { tipo: 'onda', evento: 'impacto', color: '#ffffff' }], eventos: [{ id: 'giro', at: 6 }, { tipo: 'impacto', at: 3 }, { tipo: 'impacto', at: 8 }] };
  const A = render(spec, 5.2), cold = render(spec, 5.2, { cache: new Map() });
  render(spec, 9); render(spec, 1);
  ok('B1 mismo spec + t ⇒ mismos píxeles, tras pintar otros t y con caché fría o caliente', sha(A) === sha(cold) && sha(render(spec, 5.2)) === sha(A));
  const warm = new Map(); for (const t of [0, 2, 4, 6, 8, 10]) render(spec, t, { cache: warm });
  ok('B1 orden de pintado irrelevante (6 t en otro orden y caché reutilizada)', sha(render(spec, 5.2, { cache: warm })) === sha(A));
  ok('B1 el fondo con color animado cambia entre t y es estable en un mismo t', sha(render(spec, 1)) !== sha(render(spec, 7)) && sha(render(spec, 7)) === sha(render(spec, 7)));
  const antes = render(spec, 4.9), despues = render(spec, 7.1);
  ok('B2 turbio → claro: el fondo es más claro tras el giro (ancla) que antes', meanL(despues) > meanL(antes) + 25, `${meanL(antes).toFixed(0)} → ${meanL(despues).toFixed(0)}`);
  const sp = { capas: [{ tipo: 'fbm', color: { k: [[0, '#203020'], [10, '#d0e8ff']] }, colorB: 'paper' }] }, ca = new Map();
  for (let i = 0; i < 12; i++) render(sp, i * 0.5, { cache: ca }); const s12 = ca.size;
  for (let i = 12; i < 40; i++) render(sp, i * 0.25, { cache: ca });
  ok('B3 un color animado en fbm NO acumula texturas: el campo se memoriza sin color y la caché no crece', ca.size === s12 && s12 <= 4, `entradas ${s12} → ${ca.size}`);
  ok('B3 el campo sigue siendo determinista con el color animado (caché fría = caliente)', sha(render(sp, 3.3, { cache: ca })) === sha(render(sp, 3.3, { cache: new Map() })));
  ok('B4 fondoAnimado distingue estático de animado (valores, anim, reactivas, código)', !fondoAnimado({ preset: 'cuba_oscura' }) && fondoAnimado(spec) && fondoAnimado({ capas: [{ tipo: 'foco', anim: { alfa: 'sin(t)' } }] }) && fondoAnimado({ capas: [{ tipo: 'pulso' }] }) && fondoAnimado({ capas: [{ tipo: 'codigo', archivo: 'fondos/x.mjs' }] }));
}

// ── C. fondo reactivo ──
{
  const only = (capa, eventos) => ({ capas: [{ tipo: 'relleno', color: '#808080' }, capa], eventos });
  const ev1 = [{ tipo: 'impacto', at: 3, x: 0.25, y: 0.5 }], ev2 = [{ tipo: 'impacto', at: 3, x: 0.25, y: 0.5 }, { tipo: 'impacto', at: 3.3, x: 0.75, y: 0.5 }];
  const base = render({ capas: [{ tipo: 'relleno', color: '#808080' }] }, 3.5), onda = { tipo: 'onda', evento: 'impacto', color: '#ffffff', ancho: 0.08 };
  ok('C1 onda: no pinta antes del evento, pinta tras él y se apaga cuando acaba su vida', diffPx(render(only(onda, ev1), 2.9), base) === 0 && diffPx(render(only(onda, ev1), 3.5), base) > 300 && diffPx(render(only(onda, ev1), 5.0), base) === 0);
  ok('C1 dos impactos ⇒ más ondas que uno (cada evento tiene la suya)', diffPx(render(only(onda, ev2), 3.8), base) > diffPx(render(only(onda, ev1), 3.8), base) * 1.3);
  const left = render(only({ ...onda, color: '#000000' }, [{ tipo: 'impacto', at: 3, x: 0.2, y: 0.5 }]), 3.4), right = render(only({ ...onda, color: '#000000' }, [{ tipo: 'impacto', at: 3, x: 0.8, y: 0.5 }]), 3.4);
  ok('C1 la onda nace en la posición x,y del evento', cx(left, 0, 160) < cx(left, 160, 320) * 0.995 || cx(right, 160, 320) < cx(right, 0, 160) * 0.995, `izq ${cx(left, 0, 160)} dcha ${cx(left, 160, 320)}`);
  const man = { tipo: 'mancha', evento: 'impacto', color: '#101010', radio: 0.3, persiste: 3, vida: 2 };
  ok('C2 mancha: crece, persiste y se desvanece', diffPx(render(only(man, ev1), 2.9), base) === 0 && diffPx(render(only(man, ev1), 3.3), base) > 0 && diffPx(render(only(man, ev1), 5.5), base) > diffPx(render(only(man, ev1), 3.3), base) * 0.9 && diffPx(render(only(man, ev1), 8.5), base) === 0);
  const pul = { tipo: 'pulso', evento: 'impacto', color: '#ffffff', tau: 0.3, intensidad: 0.8 };
  ok('C3 pulso: destello que se apaga con el tiempo', meanL(render(only(pul, ev1), 3.0)) > meanL(render(only(pul, ev1), 3.4)) && meanL(render(only(pul, ev1), 3.4)) > meanL(render(only(pul, ev1), 2.9)) - 0.01 && diffPx(render(only(pul, ev1), 6), base) === 0);
  const a = render(only(onda, ev1), 3.5), cache = new Map(); render(only(onda, ev1), 9, { cache }); render(only(onda, ev1), 3.2, { cache });
  ok('C4 sin estado entre cuadros: pintar otros t antes no cambia el cuadro', sha(render(only(onda, ev1), 3.5, { cache })) === sha(a) && sha(render(only(man, ev1), 5, { cache })) === sha(render(only(man, ev1), 5)));
  const via = { capas: [{ tipo: 'relleno', color: '#808080' }, { tipo: 'foco', color: '#ffffff', intensidad: { expr: "0.9*pulso('impacto',0.3)" }, radio: 0.9 }], eventos: ev1 };
  ok('C5 un foco con intensidad = pulso(impacto) se enciende en el golpe y se apaga', meanL(render(via, 3.0)) > meanL(render(via, 2.9)) + 3 && meanL(render(via, 3.0)) > meanL(render(via, 4.0)) + 3, `${meanL(render(via, 2.9)).toFixed(1)} · ${meanL(render(via, 3.0)).toFixed(1)} · ${meanL(render(via, 4)).toFixed(1)}`);
  const film = eventosDeFilm({ W: 1000, H: 500, shots: [{ id: 'K1', t: [2, 8], sfx: [{ at: 1, type: 'impact' }, { at: 2, type: 'tick' }] }, { id: 'K2', t: [8, 12] }],
    escenas: { K2: { cues: [{ id: 'giro', at: 1.5 }, { id: 'x', at: { $expr: 'u' } }], objects: [{ type: 'group', children: [{ type: 'impact', at: 3, opts: { x: 250, y: 250 } }] }] } }, story: { beats: [{ id: 'b1', t: 0.6 }, { t: 7 }] } });
  ok('C6 eventos del film: sfx impact, cues y nodos impact de las escenas (anidados, con x,y en fracciones) y beats del story; ordenados y con ids', film.length === 5 && film.map((e) => e.t).join() === '0.6,3,7,9.5,11' && film.find((e) => e.id === 'K1:impacto0').kind === 'impacto' && film.find((e) => e.id === 'giro').kind === 'cue' && film.find((e) => e.kind === 'impacto' && e.x === 0.25 && e.y === 0.5) && film.find((e) => e.id === 'b2'), JSON.stringify(film.map((e) => e.id)));
  const spE = { capas: [{ tipo: 'relleno', color: '#808080' }, { tipo: 'onda', evento: 'K1:*', color: '#ffffff' }] };
  ok('C6 los eventos del film (E.eventos) llegan a las capas reactivas, sin declararlos en el fondo', diffPx(render(spE, 3.5, { eventos: [{ t: 3, kind: 'impacto', id: 'K1:impacto0' }] }), base) > 200 && diffPx(render(spE, 3.5, { eventos: [] }), base) === 0);
}

// ── D. capa codigo ──
{
  const prov = (fn) => ({ codigo: (a) => (a === 'fondos/x.mjs' ? fn : undefined) });
  const spec = { capas: [{ tipo: 'codigo', archivo: 'fondos/x.mjs', params: { r: { k: [[0, 10], [1, 50]], ease: 'linear' }, c: 'ink' } }] };
  let seen = null;
  const im = render(spec, 0.5, { base: '#ffffff', extra: prov((ctx, t, E) => { seen = E; ctx.fillStyle = E.hex(E.p.c); ctx.fillRect(0, 0, E.p.r, E.p.r); }) });
  ok('D1 la capa codigo se llama con (ctx, t, E): params resueltos (animables), paleta, hex, tiempos y eventos', seen && seen.p.r === 30 && seen.t === 0.5 && seen.W === 1280 && typeof seen.hex === 'function' && typeof seen.pulso === 'function' && Object.isFrozen(seen) && Object.isFrozen(seen.p) && im.data[0] < 60 && im.data[(10 * W + 100) * 4] > 240);
  let m = ''; try { render(spec, 0.5); } catch (e) { m = e.message; }
  ok('D2 sin proveedor sandbox la capa codigo falla CERRADA (no se ejecuta nada)', /exige el sandbox/.test(m) && /falla cerrada/.test(m), m.slice(0, 90));
  m = ''; try { render({ capas: [{ tipo: 'codigo', archivo: 'fondos/otro.mjs' }] }, 0.5, { extra: prov(() => {}) }); } catch (e) { m = e.message; }
  ok('D2 un archivo no cargado (o rechazado por la guardia) lanza con el motivo', /no está cargado/.test(m), m.slice(0, 100));
  const v = (c) => errs({ capas: [c] }).map((x) => x.path + ':' + x.message).join('|');
  ok('D3 archivo válido: fondos/<nombre>.mjs; rechaza rutas fuera, anidadas y ausentes', v({ tipo: 'codigo', archivo: 'fondos/nube-1.mjs' }) === '' && /archivo/.test(v({ tipo: 'codigo', archivo: '../x.mjs' })) && /archivo/.test(v({ tipo: 'codigo', archivo: 'fondos/a/b.mjs' })) && /archivo/.test(v({ tipo: 'codigo' })) && /archivo/.test(v({ tipo: 'codigo', archivo: '/etc/passwd' })));
  ok('D3 maxMs y params admiten valores animados; params desconocidos no', v({ tipo: 'codigo', archivo: 'fondos/a.mjs', maxMs: 50, params: { x: { expr: 'u' }, y: { k: [[0, 1], [1, 2]] } } }) === '' && /desconocido/.test(v({ tipo: 'codigo', archivo: 'fondos/a.mjs', cuanto: 1 })));
  // guardia AST: la MISMA que los shots
  const G = (src) => scanSource(src, 'fondos/t').filter((x) => x.level === 'FIX').map((x) => x.problem).join(' | ');
  ok('D4 la guardia rechaza fs, red, Date y Math.random (y eval, process) en el código del fondo', /import prohibido 'node:fs'/.test(G("import fs from 'node:fs'; export default (c) => fs.readFileSync('/etc/passwd');")) && /red/.test(G('export default (c) => { fetch("http://x"); }')) && /Date/.test(G('export default (c, t) => { c.x = Date.now(); }')) && /Math\.random/.test(G('export default (c) => { c.x = Math.random(); }')) && /eval/.test(G('export default (c) => eval("1")')) && /process/.test(G('export default (c) => process.env.HOME')), G('export default (c) => { fetch("x"); }').slice(0, 80));
  ok('D4 un fondo limpio (core.mjs, rng) pasa la guardia sin FIX', G("import { rng } from '../../engine/core.mjs'; export default function (ctx, t, E) { const R = rng(E.seed); ctx.fillRect(R() * 10, 0, 1, 1); }") === '');
  // worker en una copia aislada del repo: sandbox real, import hook, hash, coste
  const d = copyRepo();
  try {
    fs.mkdirSync(path.join(d, 'shots/fondos'), { recursive: true });
    const put = (f, s) => fs.writeFileSync(path.join(d, 'shots', f), s);
    put('fondos/ok.mjs', "import { rng } from '../../engine/core.mjs'; export default function (ctx, t, E) { const R = rng(E.seed); ctx.fillStyle = E.hex('ink'); for (let i = 0; i < 20; i++) ctx.fillRect(R() * E.W, R() * E.H, 4, 4); return t; }\n");
    put('fondos/lento.mjs', 'export default function (ctx, t, E) { let s = 0; for (let i = 0; i < 4e6; i++) s += Math.sin(i * t); return s; }\n');
    put('fondos/bad_fs.mjs', "import fs from 'node:fs'; export default function (ctx) { fs.readFileSync('/etc/passwd'); }\n");
    put('fondos/bad_net.mjs', "export default function (ctx) { fetch('http://example.com'); }\n");
    put('fondos/bad_rand.mjs', 'export default function (ctx) { ctx.x = Math.random(); }\n');
    put('fondos/bad_date.mjs', 'export default function (ctx) { ctx.x = Date.now(); }\n');
    put('Hx.mjs', "export default { draw(ctx, t, u, shot, film, api) { api.fondo({ capas: [{ tipo: 'codigo', archivo: 'fondos/ok.mjs' }] }); } };\n");
    put('Hy.mjs', "export default { draw(ctx, t, u, shot, film, api) { api.fondo({ preset: 'cuba_oscura' }); } };\n");
    put('hook.mjs', "import fs from 'node:fs'; export default { draw() { return fs; } };\n");
    fs.writeFileSync(path.join(d, '_w.mjs'), `
      import { cargarCodigoFondos } from './engine/film.mjs';
      import { makeSandbox, SandboxError } from './engine/sandbox.mjs';
      import { shotDeps, flushDigests } from './engine/hash.mjs';
      import { scanFondoCodigo } from './engine/guard.mjs';
      import canvasPkg from 'canvas';
      const sb = makeSandbox(process.cwd()), film = {}, out = {};
      await cargarCodigoFondos(film, sb);
      out.rechazados = Object.keys(film.codigoRechazados).sort();
      out.guardia = scanFondoCodigo(process.cwd()).filter((x) => x.level === 'FIX').map((x) => x.shot).filter((v, i, a) => a.indexOf(v) === i).sort();
      const cv = canvasPkg.createCanvas(64, 64), g = cv.getContext('2d');
      const E = { W: 64, H: 64, seed: 7, hex: () => '#000' };
      out.ok = film.codigo('fondos/ok.mjs')(g, 1.5, E);
      out.okA = Array.from(g.getImageData(0, 0, 64, 64).data.slice(0, 4096)).join();
      g.clearRect(0, 0, 64, 64); film.codigo('fondos/ok.mjs')(g, 1.5, E); out.okB = Array.from(g.getImageData(0, 0, 64, 64).data.slice(0, 4096)).join();
      film.codigo('fondos/lento.mjs')(g, 0.3, E);
      out.coste = film.codigoCoste;
      try { film.codigo('fondos/bad_fs.mjs'); out.lanza = 'no'; } catch (e) { out.lanza = e.message.slice(0, 80); }
      out.fechaCongelada = sb.run('t', () => Date.now()) === 0 && sb.run('t', () => performance.now()) === 0;
      out.randomSembrado = JSON.stringify([sb.run('s1', () => [Math.random(), Math.random()]), sb.run('s1', () => [Math.random(), Math.random()])].map((x) => x.join())) ;
      out.redBloqueada = (() => { try { sb.run('t', () => fetch('http://example.com')); return 'no'; } catch (e) { return e instanceof SandboxError ? 'SandboxError' : e.message; } })();
      out.envVacio = sb.run('t', () => process.env.HOME) === undefined; out.procesoBloqueado = (() => { try { sb.run('t', () => process.exit(3)); return 'no'; } catch (e) { return e instanceof SandboxError ? 'SandboxError' : e.message; } })();
      out.evalBloqueado = (() => { try { sb.run('t', () => (0, eval)('1')); return 'no'; } catch (e) { return e instanceof SandboxError ? 'SandboxError' : e.message; } })();
      const mod = await sb.importShot(process.cwd() + '/shots/hook.mjs', 'hook');
      out.importHook = mod === undefined && sb.log.some((x) => /import 'node:fs'/.test(x.message));
      process.exitCode = 0;
      const h0 = shotDeps('Hx'), h1 = shotDeps('Hy');
      import('node:fs').then(async (fs) => {
        fs.appendFileSync('shots/fondos/ok.mjs', '// cambio de contenido\\n'); const h2 = shotDeps('Hx'), h3 = shotDeps('Hy');
        fs.appendFileSync('shots/fondos/lento.mjs', '// otro fichero\\n'); const h4 = shotDeps('Hx');
        out.hash = { cambiaConElCodigo: h0 !== h2, otroShotIntacto: h1 === h3, otroFondoNoAfecta: h2 === h4 };
        flushDigests(); console.log('@@' + JSON.stringify(out));
      });
    `);
    const r = await run(['_w.mjs'], { cwd: d, env: { FONTCONFIG_FILE: FONTS_CONF } });
    const o = JSON.parse((r.stdout.split('@@')[1] ?? '{}').trim() || '{}');
    ok('D5 el sandbox real RECHAZA fs, red, Date y Math.random: ningún módulo malo se carga y la guardia los marca', r.status === 0 && JSON.stringify(o.rechazados) === JSON.stringify(['fondos/bad_date.mjs', 'fondos/bad_fs.mjs', 'fondos/bad_net.mjs', 'fondos/bad_rand.mjs']) && JSON.stringify(o.guardia) === JSON.stringify(['fondos/bad_date', 'fondos/bad_fs', 'fondos/bad_net', 'fondos/bad_rand']) && /rechazado por la guardia/.test(o.lanza ?? ''), r.stderr.replace(/^✗ /gm, '· ').slice(0, 300) + JSON.stringify(o.rechazados));
    ok('D5 el módulo limpio corre en el sandbox y es determinista (mismo seed ⇒ mismos píxeles)', o.ok === 1.5 && o.okA && o.okA === o.okB && /[1-9]/.test(o.okA));
    ok('D5 en ejecución: Date y performance congelados, Math.random sembrado, env vacío, red/process.exit/eval bloqueados, import de node:fs bloqueado por el hook', o.fechaCongelada && o.envVacio && o.redBloqueada === 'SandboxError' && o.procesoBloqueado === 'SandboxError' && o.evalBloqueado === 'SandboxError' && o.importHook && (() => { const q = JSON.parse(o.randomSembrado); return q[0] === q[1]; })(), JSON.stringify([o.fechaCongelada, o.redBloqueada, o.procesoBloqueado, o.evalBloqueado, o.importHook]));
    ok('D6 el hash del shot depende del CONTENIDO del código del fondo que referencia (y de ningún otro)', o.hash?.cambiaConElCodigo && o.hash.otroShotIntacto && o.hash.otroFondoNoAfecta, JSON.stringify(o.hash));
    ok('D7 el coste por cuadro se mide (n, total, max) por archivo', o.coste?.['fondos/lento.mjs']?.n === 1 && o.coste['fondos/lento.mjs'].max > 0 && o.coste['fondos/ok.mjs'].n === 2, JSON.stringify(o.coste));
    ok('D8 la guardia real del repo no tiene hallazgos en los fondos de código entregados', scanFondoCodigo(ROOT).filter((x) => x.level === 'FIX').length === 0, scanFondoCodigo(ROOT).filter((x) => x.level === 'FIX').map((x) => x.problem).join(';'));
  } finally { rmrf(d); }
}

// ── E. anti-menú: presets y lint ──
{
  const FILMS = /consta|veinticuatro|botella|mate\b|potencias|regla|reel|showcase|euler|expediente de/i;
  const txt = (p) => `${p.resumen} ${p.porque} ${p.tags.join(' ')}`;
  ok('E1 los presets son genéricos por TEMA: ningún `porque`/resumen/tags nombra un film y todos son «ejemplo de partida»', Object.entries(PRESETS).every(([, p]) => !FILMS.test(txt(p)) && /^Ejemplo de partida/.test(p.resumen) && /^Ejemplo de partida/.test(p.porque)), Object.entries(PRESETS).filter(([, p]) => FILMS.test(txt(p))).map(([k]) => k).join());
  ok('E1 resumen ≤ 15 palabras y `porque` enseña a derivar', Object.values(PRESETS).every((p) => p.resumen.split(/\s+/).length <= 15 && /Derívalo/.test(p.porque)));
  const r = await run(['engine/tools.mjs', 'show', 'cuba_oscura'], { cwd: ROOT });
  ok('E2 `tools show <preset>` enseña a DERIVAR: ajustes, keyframes con ancla, expresión, sin y capas', r.status === 0 && /derivar:/.test(r.stdout) && /ajustes/.test(r.stdout) && /"k":\[\[/.test(r.stdout) && /"en":"giro"/.test(r.stdout) && /"expr"/.test(r.stdout) && /"sin":\[/.test(r.stdout) && /"capas":\[/.test(r.stdout) && /punto de partida, no destino/.test(r.stdout), r.stdout.slice(0, 200));
  const good = Object.keys(PRESETS).every((id) => derivarPreset(id).filter((l) => /\{"type":"fondo"/.test(l)).every((l) => { const j = JSON.parse(l.slice(l.indexOf('{"type":"fondo"'))); delete j.type; return !errs(j).length; }));
  ok('E2 los ejemplos de derivación de CADA preset son fondos válidos (validateFondo)', good);
  const g = await run(['engine/tools.mjs', 'show', 'fondo_libre'], { cwd: ROOT });
  ok('E2 hay una guía `fondo_libre` encontrable por intención', g.status === 0 && /codigo/.test(g.stdout) && /reactiv/.test(g.stdout));
  const sh = (id, t0, t1) => ({ id, t: [t0, t1] }), shots4 = [sh('A', 0, 3), sh('B', 3, 6), sh('C', 6, 9), sh('D', 9, 12)], film = (o = {}) => ({ shots: shots4, duration: 12, medium: 'papel_crema', ...o });
  const per = (list) => new Map(list.map(([id, m]) => [id, { shot: id, familia: 'preset:cuba_oscura', preset: 'cuba_oscura', ajustado: false, animado: false, ...m }]));
  const regla = (iss) => iss.map((x) => x.regla).sort().join();
  ok('E3 mismo preset, sin ajuste ni animación en todo el film ⇒ fondo.estatico + fondo.preset_crudo', regla(analizarFondos(film(), per([['A', {}], ['B', {}], ['C', {}], ['D', {}]]))) === 'fondo.estatico,fondo.preset_crudo');
  ok('E3 un preset ajustado (ajustes/sin/capas) en la mayoría no es crudo; sigue siendo estático si no se anima', regla(analizarFondos(film(), per([['A', { ajustado: true }], ['B', { ajustado: true }], ['C', { ajustado: true }], ['D', {}]]))) === 'fondo.estatico');
  ok('E3 con variación animada en la mayoría de la duración no es estático', regla(analizarFondos(film(), per([['A', { animado: true, ajustado: true }], ['B', { animado: true, ajustado: true }], ['C', { animado: true, ajustado: true }], ['D', {}]]))) === '');
  const cinco = { shots: [sh('A', 0, 2), sh('B', 2, 4), sh('C', 4, 6), sh('D', 6, 8), sh('E', 8, 10)], duration: 10, medium: 'papel_crema' };
  ok('E3 los umbrales son estrictos: exactamente 80 % de la duración estática y 50 % de crudos NO avisan', regla(analizarFondos(cinco, per([['A', { ajustado: true }], ['B', { ajustado: true }], ['C', { ajustado: true }], ['D', { ajustado: true }], ['E', { familia: 'y', animado: true }]]))) === '' && FONDO_LIBRE.estatico === 0.8 && FONDO_LIBRE.crudo === 0.5);
  ok('E3 por encima del 80 % (4 de 5 + parte del quinto estático) sí sugiere', regla(analizarFondos({ ...cinco, shots: [sh('A', 0, 3), sh('B', 3, 6), sh('C', 6, 9), sh('D', 9, 10)] }, per([['A', { ajustado: true }], ['B', { ajustado: true }], ['C', { ajustado: true }], ['D', { familia: 'y', animado: true }]]))) === 'fondo.estatico');
  ok('E3 fondos distintos (familias) repartidos no son «el mismo fondo»', regla(analizarFondos(film(), per([['A', { familia: 'f1', ajustado: true }], ['B', { familia: 'f2', ajustado: true }], ['C', { familia: 'f3', ajustado: true }], ['D', { familia: 'f4', ajustado: true }]]))) === '');
  ok('E4 sin fondo declarado (medio por defecto o soporte del medio) fondo.estatico NO aplica', regla(analizarFondos(film({ medium: 'papel_crema_terracota' }), new Map())) === '' && regla(analizarFondos(film(), new Map())) === '');
  ok('E4 ambos avisos son sugerencias: WARN y texto «considera», nunca exigen', analizarFondos(film(), per([['A', {}], ['B', {}], ['C', {}], ['D', {}]])).every((x) => /sugerencia/.test(x.problem) && /considera/.test(x.remedy)));
  const porque = 'el papel crema constante ES la metáfora: lo que se mide es siempre el mismo soporte';
  ok('E4 fondo_ok:{porque} (≥ 20 caracteres) justifica ambos avisos; un porque corto no', regla(analizarFondos(film({ fondo_ok: { porque } }), per([['A', {}], ['B', {}], ['C', {}], ['D', {}]]))) === '' && regla(analizarFondos(film({ fondo_ok: { porque: 'porque sí' } }), per([['A', {}], ['B', {}], ['C', {}], ['D', {}]]))) === 'fondo.estatico,fondo.preset_crudo');
  const mp = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/mate_papel/timeline.json'), 'utf8'));
  ok('E5 CALIBRACIÓN Mate papel: su soporte constante ES la metáfora y no recibe ni sugerencia', regla(analizarFondos(mp, new Map())) === '', regla(analizarFondos(mp, new Map())));
  const sch = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/timeline.schema.json'), 'utf8'));
  ok('E5 el esquema del timeline admite fondo_ok:{porque} (≥ 20 caracteres)', sch.properties.fondo_ok?.required?.[0] === 'porque' && sch.properties.fondo_ok.properties.porque.minLength === 20);
}

// ── F. integración: lint real sobre un film mínimo (meta de api.fondo → avisos; coste del código) ──
{
  const d = copyRepo();
  try {
    fs.mkdirSync(path.join(d, 'shots/fondos'), { recursive: true });
    fs.writeFileSync(path.join(d, 'shots/fondos/lento.mjs'), 'export default function (ctx, t, E) { let s = 0; for (let i = 0; i < 3e6; i++) s += Math.sin(i * t); ctx.globalAlpha = 0.01 + (s * 0) ; ctx.fillRect(0, 0, 1, 1); }\n');
    const shot = (extra) => `export default { draw(ctx, t, u, shot, film, api) { api.fondo({ preset: 'cuba_oscura'${extra} }); } };\n`;
    fs.writeFileSync(path.join(d, 'shots/F1.mjs'), shot(''));
    fs.writeFileSync(path.join(d, 'shots/F2.mjs'), shot(''));
    fs.writeFileSync(path.join(d, 'shots/F3.mjs'), "export default { draw(ctx, t, u, shot, film, api) { api.fondo({ capas: [{ tipo: 'relleno', color: '#101820' }, { tipo: 'codigo', archivo: 'fondos/lento.mjs', maxMs: 1 }, { tipo: 'niebla', color: '#335577' }] }); } };\n");
    const tl = (extra = {}) => ({ title: 'fx', style: 'cosmos', profile: 'cinematic', fps: 12, width: 320, height: 180, duration: 6, ...extra, shots: ['F1', 'F2', 'F3'].map((id, i) => ({ id, t: [i * 2, i * 2 + 2], size: 'WS', action: 'fondo', transition_out: 'cut', cam: { move: 'static' } })) });
    fs.writeFileSync(path.join(d, 'data/fx.json'), JSON.stringify(tl()));
    fs.writeFileSync(path.join(d, 'data/fx_ok.json'), JSON.stringify(tl({ fondo_ok: { porque: 'la cuba oscura constante es el tema: el agua negra no cambia en todo el relato' } })));
    const lint = (f) => run(['engine/lint.mjs', '--only', 'fondo'], { cwd: d, env: { OPUS_TIMELINE: `data/${f}`, FONTCONFIG_FILE: FONTS_CONF, OPUS_WARM: '0' } });
    const a = await lint('fx.json'), b = await lint('fx_ok.json');
    ok('F1 lint real: preset sin ajuste en 2 de 3 shots ⇒ fondo.preset_crudo, y el código lento ⇒ fondo.codigo_lento (con archivo y ms)', /fondo\.preset_crudo \(sugerencia\): 2 de 3/.test(a.stdout) && /fondo\.codigo_lento: shots\/fondos\/lento\.mjs tarda \d+ ms\/cuadro/.test(a.stdout), a.stdout.slice(-600) + a.stderr.slice(-300));
    ok('F2 lint real: fondo_ok:{porque} silencia fondo.estatico/preset_crudo pero NO el coste del código', !/fondo\.preset_crudo|fondo\.estatico/.test(b.stdout) && /fondo\.codigo_lento/.test(b.stdout), b.stdout.slice(-400));
    ok('F3 lint real: el film con fondos pasa sin FIX (los avisos son WARN)', !/^FIX/m.test(a.stdout) && a.status === 0, a.stdout.slice(-200));
  } finally { rmrf(d); }
}

// ── G. DSL: el tipo `fondo` acepta valores animados y eventos ──
{
  const SC = { dsl: 1, id: 'T9', objects: [{ type: 'fondo', capas: [{ tipo: 'fbm', color: { k: [[-1, '#304030'], [1, '#d0e8ff']], en: 'giro' }, colorB: 'paper' }, { tipo: 'onda', evento: 'impacto' }], eventos: [{ id: 'giro', at: 2 }, { tipo: 'impacto', at: 1, x: 0.3, y: 0.5 }], alfa: 0.9 }] };
  ok('G1 el tipo DSL fondo valida con valores animados y eventos', !validateScene(SC).length, JSON.stringify(validateScene(SC)));
  const bad = validateScene({ ...SC, objects: [{ type: 'fondo', capas: [{ tipo: 'fbm', alfa: { expr: 'sin(' } }], eventos: [{ id: 'x' }] }] });
  ok('G1 y rechaza con ruta una expresión rota y un evento sin `at`', bad.length >= 2, JSON.stringify(bad.map((e) => e.path)));
}
ok('G2 hay ≥ 27 tipos de capa (23 + onda, mancha, pulso, codigo) y las reactivas están marcadas', Object.keys(CAPAS).length >= 27 && ['onda', 'mancha', 'pulso'].every((k) => CAPAS[k].reactiva) && CAPAS.codigo.familia === 'libre', String(Object.keys(CAPAS).length));
ok('G3 esDinamico detecta expr/keyframes en cualquier profundidad', esDinamico({ mezcla: ['paper', 'ink', { expr: 'u' }] }) && esDinamico([1, { k: [[0, 1]] }]) && !esDinamico({ mezcla: ['paper', 'ink', 0.3] }) && !esDinamico('paper'));

console.log(`\nfondos-libres: ${n - bad}/${n}`);
process.exit(bad ? 1 : 0);
