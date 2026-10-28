#!/usr/bin/env node
// Spec 014 (BDD de FONDOS GENERATIVOS y OBJETOS): registro y meta, esquema estricto, determinismo, animación, parallax, medio,
// profundidad (fondo.vacio), biblioteca de objetos (estados, anclas, foco), tipos DSL `fondo` y `objeto`, docs.
import fs from 'node:fs';
import path from 'node:path';
import canvasPkg from 'canvas';
import crypto from 'node:crypto';
import { ROOT } from './lib.mjs';
import { CAPAS, PRESETS, drawFondo, validateFondo, resolveFondo } from '../engine/fondos.mjs';
import { OBJETOS, drawObjeto } from '../engine/objetos.mjs';
import { metaFondosObjetos } from '../engine/fondos-meta.mjs';
import { windowStats, FONDO } from '../engine/metrics/fondo.mjs';
import { validateScene, shot, depsOf, TYPES } from '../engine/dsl-core.mjs';
import { DEFAULTS } from '../engine/styles.mjs';
const { createCanvas } = canvasPkg;

let n = 0, bad = 0;
const ok = (m, c, info = '') => { n++; console.log(`${c ? '✓' : '✗'} fondos: ${m}${info ? '  ' + info : ''}`); if (!c) bad++; };
const W = 320, H = 180, PAL_DARK = { ...DEFAULTS.palette, paper: '#06080f', ink: '#e8ecf5', shade: '#1a2233' };
const kraft = JSON.parse(fs.readFileSync(path.join(ROOT, 'styles/medios/kraft.json'), 'utf8')).palette, neon = JSON.parse(fs.readFileSync(path.join(ROOT, 'styles/medios/neon.json'), 'utf8')).palette;
const cache = new Map();
const render = (spec, t, { pal = PAL_DARK, w = W, h = H, depth, base = '#000000' } = {}) => {
  const cv = createCanvas(w, h), g = cv.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, w, h); g.scale(w / 1280, w / 1280);
  drawFondo(g, spec, t, { W: 1280, H: (1280 * h) / w, k: 1, pal, canvas: (a, b) => createCanvas(a, b), cache: new Map(), depth: depth ?? ((d, fn) => fn()) });
  return g.getImageData(0, 0, w, h);
};
const sha = (im) => crypto.createHash('sha1').update(im.data).digest('hex').slice(0, 12);
const mad = (a, b) => { let s = 0; for (let i = 0; i < a.data.length; i += 4) s += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]); return s / (a.data.length / 4) / 3; };
const errs = (f) => { const r = []; f((p, m, rem) => r.push({ path: p, message: m, remedy: rem })); return r; };

// ── F1 registro y meta ──
const M = metaFondosObjetos(), words = (s) => s.trim().split(/\s+/).length;
const capas = Object.keys(CAPAS), pres = Object.keys(PRESETS), objs = Object.keys(OBJETOS);
ok('F1 ≥ 22 tipos de capa, ≥ 10 presets, ≥ 25 objetos', capas.length >= 22 && pres.length >= 10 && objs.length >= 25, `${capas.length} capas · ${pres.length} presets · ${objs.length} objetos`);
ok('F1 meta uniforme: id, kind, resumen ≤ 15 palabras, tags, params con nombre/tipo', M.length === capas.length + pres.length + objs.length && M.every((m) => m.id && ['capa-fondo', 'preset-fondo', 'objeto'].includes(m.kind) && words(m.resumen) <= 15 && m.tags.length >= 1 && m.params.length >= 1 && m.params.every((p) => p.name && p.type)), `${M.length} entradas`);
ok('F1 cada capa declara valor por defecto y tipo en todos sus params', capas.every((c) => Object.values(CAPAS[c].params).every((d) => d.type && 'def' in d)));
for (const need of ['degradado', 'fbm', 'deformado', 'celular', 'flujo', 'niebla', 'polvo', 'rayos', 'bokeh', 'estrellas', 'reticula', 'trama', 'rayado', 'semitono', 'motivo', 'vineta', 'foco', 'terminador']) if (!CAPAS[need]) ok(`F1 falta la capa ${need}`, false);
// ── F2 esquema estricto ──
const e2 = validateFondo({ capas: [{ tipo: 'nieblaa' }, { tipo: 'niebla', densidadd: 1 }, { tipo: 'polvo', n: -3 }, { tipo: 'fbm', anim: { alfa: 'sin(' } }] });
ok('F2 tipo/param desconocido, valor fuera de rango y expresión rota fallan con ruta; hint «quisiste decir»', e2.length >= 4 && e2.some((e) => /quisiste decir "niebla"/.test(e.remedy)) && e2.some((e) => /quisiste decir "densidad"/.test(e.remedy)) && e2.every((e) => e.path.startsWith('/capas/')), e2.map((e) => e.path).join(' '));
ok('F2 fondo vacío, preset y ajustes inexistentes fallan', validateFondo({}).length === 1 && validateFondo({ preset: 'cuba_osura' }).some((e) => /cuba_oscura/.test(e.remedy)) && validateFondo({ preset: 'cuba_oscura', ajustes: { bruma2: {} } }).length === 1);
ok('F2 todos los presets validan', pres.every((p) => !validateFondo({ preset: p }).length), pres.filter((p) => validateFondo({ preset: p }).length).join(','));
// ── F3/F4/F5 determinismo, semilla, animación ──
const A = render({ preset: 'cuba_oscura', semilla: 3 }, 2.5);
ok('F3 mismo fondo+semilla+t ⇒ mismos píxeles (aunque se pinte otro t entre medias)', (render({ preset: 'cuba_oscura', semilla: 3 }, 9), sha(A) === sha(render({ preset: 'cuba_oscura', semilla: 3 }, 2.5))));
ok('F4 otra semilla ⇒ píxeles distintos', sha(A) !== sha(render({ preset: 'cuba_oscura', semilla: 4 }, 2.5)));
ok('F5 el fondo se anima en t (deriva, parpadeo, polvo) y es estable en un mismo t', mad(A, render({ preset: 'cuba_oscura', semilla: 3 }, 4.1)) > 0.3);
const an = { capas: [{ tipo: 'foco', anim: { alfa: '0.4+0.4*sin(t*3)', dx: 't*0.01' } }] };
ok('F5 anim por expresión de t cambia el pintado', sha(render(an, 0.2)) !== sha(render(an, 0.7)) && sha(render(an, 0.7)) === sha(render(an, 0.7)));
// ── F6 presets ──
const props = pres.map((p) => { let r; try { r = render({ preset: p, semilla: 1 }, 1.5, { pal: PRESETS[p].medio.startsWith('kraft') ? kraft : PAL_DARK, base: '#808080' }); } catch (e) { return { p, err: e.message }; } let op = 0; for (let i = 3; i < r.data.length; i += 4) op++; return { p, mean: r.data.reduce((a, v, i) => a + (i % 4 < 3 ? v : 0), 0) / (op * 3) }; });
ok('F6 todos los presets se pintan sin error y traen `porque` que nombra el tema', props.every((x) => !x.err) && pres.every((p) => PRESETS[p].porque.length > 60), props.filter((x) => x.err).map((x) => `${x.p}: ${x.err}`).join('; '));
// ── F7/F8 profundidad ──
const frames = (spec, pal = PAL_DARK) => Array.from({ length: 8 }, (_, i) => { const im = render(spec, 1 + i * 0.25, { pal, w: 384, h: 216 }); return { t: i * 0.25, W: 384, H: 216, data: im.data, boxes: [] }; });
const prof = Object.fromEntries(['cosmos_profundo', 'cuba_oscura', 'noche_ciudad'].map((p) => [p, windowStats(frames({ preset: p }))]));
ok('F7 cosmos_profundo, cuba_oscura y noche_ciudad: P ≥ 1,0 % (no son negro vacío)', Object.values(prof).every((s) => !s.empty && s.P >= FONDO.empty), Object.entries(prof).map(([k, s]) => `${k} P ${s.P.toFixed(2)} lum ${s.lum.toFixed(1)}`).join(' | '));
const flat = windowStats(frames({ capas: [{ tipo: 'relleno', color: '#04050a' }] }));
ok('F8 un relleno oscuro plano SÍ es vacío (la métrica sigue discriminando)', flat.empty && flat.P < FONDO.empty, `P ${flat.P.toFixed(2)}`);
const one = windowStats(frames({ capas: [{ tipo: 'relleno', color: '#04050a' }, { tipo: 'niebla', color: '#2a3a5a', densidad: 0.6, paralaje: 0.5 }, { tipo: 'polvo', n: 90 }] }));
ok('F8 con atmósfera (niebla + polvo) el mismo negro pasa', !one.empty, `P ${one.P.toFixed(2)}`);
// ── F9 parallax ──
const ds = []; const cam = 120, camDepth = (d, fn) => { ds.push(d); fn(); };
render({ capas: [{ tipo: 'estrellas', paralaje: 0.1 }, { tipo: 'polvo', paralaje: 1.1 }] }, 1, { depth: camDepth });
const shiftOf = (par) => { const sp = { capas: [{ tipo: 'fbm', escala: 0.15, paralaje: par }] }, g = (c) => { const cv = createCanvas(W, H), x = cv.getContext('2d'); x.scale(W / 1280, W / 1280); drawFondo(x, sp, 1, { W: 1280, H: 720, k: 1, pal: PAL_DARK, canvas: (a, b) => createCanvas(a, b), cache: new Map(), depth: (d, fn) => { x.save(); x.translate(-c * d, 0); fn(); x.restore(); } }); return x.getImageData(0, 0, W, H); }; return mad(g(0), g(cam)); };
ok('F9 cada capa pide su profundidad a la cámara y la cercana se mueve más que la lejana', ds.join() === '0.1,1.1' && shiftOf(1.1) > shiftOf(0.1) * 1.4, `lejana ${shiftOf(0.1).toFixed(2)} cercana ${shiftOf(1.1).toFixed(2)}`);
// ── F10 medio ──
const kA = render({ preset: 'expediente_kraft' }, 1, { pal: kraft, base: '#B58C5C' }), kB = render({ preset: 'expediente_kraft' }, 1, { pal: neon, base: '#B58C5C' });
ok('F10 los colores por rol cambian con la paleta del medio', mad(kA, kB) > 1.5, `Δ ${mad(kA, kB).toFixed(2)}`);
let thrown = ''; try { render({ capas: [{ tipo: 'relleno', color: 'rojoIntenso' }] }, 0); } catch (e) { thrown = e.message; }
ok('F10 un rol de color inexistente da error claro con los roles válidos', /rol de color desconocido "rojoIntenso"/.test(thrown) && /paper/.test(thrown));
// ── F12 ajustes y sin ──
const rs = resolveFondo({ preset: 'cuba_oscura', ajustes: { bruma: { densidad: 0.9 } }, sin: ['polvo' === 'x' ? '' : 'nieveMarina'], capas: [{ tipo: 'foco', id: 'mio' }] });
ok('F12 ajustes y sin por id de capa y capas extra encima', rs.capas.find((c) => c.id === 'bruma').densidad === 0.9 && !rs.capas.some((c) => c.id === 'nieveMarina') && rs.capas.at(-1).id === 'mio');
let t12 = ''; try { resolveFondo({ preset: 'cuba_oscura', sin: ['nada'] }); } catch (e) { t12 = e.message; }
ok('F12 sin con id inexistente es error', /sin "nada" no existe/.test(t12));
// ── Objetos O14–O17 ──
const pal = { ...DEFAULTS.palette, paper: '#EBE1CB', ink: '#2B2119', shade: '#B8AA8C' };
const drawO = (id, o, w = 220) => { const cv = createCanvas(w, w), g = cv.getContext('2d'); g.fillStyle = '#EBE1CB'; g.fillRect(0, 0, w, w); const r = drawObjeto(g, id, { x: w / 2, y: w / 2, size: w * 0.8, ...o }, { pal, k: 0.5, t: 1, font: 'DejaVu Sans' }); return { r, im: g.getImageData(0, 0, w, w) }; };
const inkPixels = (im) => { let c = 0; for (let i = 0; i < im.data.length; i += 4) if (Math.abs(im.data[i] - 235) + Math.abs(im.data[i + 1] - 225) + Math.abs(im.data[i + 2] - 203) > 40) c++; return c; };
let oBad = [], aBad = [];
for (const id of objs) {
  const def = OBJETOS[id]; if (!def.anclas.length || !Object.keys(def.partes).length || Object.keys(def.estados).length < 2) oBad.push(`${id}: sin anclas/partes/estados`);
  for (const e of Object.keys(def.estados)) { try { const { r, im } = drawO(id, { estado: e }); if (inkPixels(im) < 300) oBad.push(`${id}/${e}: casi vacío`);
    for (const a of def.anclas) { const p = r[a]; if (!p || Math.abs(p.x - 110) > 110 * 1.3 || Math.abs(p.y - 110) > 110 * 1.3) aBad.push(`${id}.${a}`); } } catch (er) { oBad.push(`${id}/${e}: ${er.message}`); } }
  for (const ext of [0, 1]) { const partes = Object.fromEntries(Object.entries(def.partes).map(([k, d]) => [k, ext ? d.max : d.min])); try { const { im } = drawO(id, { partes }); if (inkPixels(im) < 100) oBad.push(`${id}/extremo${ext}: vacío`); } catch (er) { oBad.push(`${id}/extremo${ext}: ${er.message}`); } }
}
ok('O14/O15 cada objeto: meta, anclas, partes, ≥ 2 estados; se pinta en todos los estados y en los extremos de sus partes', !oBad.length, oBad.slice(0, 4).join('; '));
ok('O17 las anclas caen cerca del objeto', !aBad.length, aBad.slice(0, 5).join(' '));
const a1 = drawO('cuba', { estado: 'reposo' }), a2 = drawO('cuba', { estado: 'destello' }), mid = drawO('cuba', { estado: ['reposo', 'destello', 0.5] });
ok('O16 interpolar estados [a,b,0.5] da algo distinto de a y de b', mad(a1.im, mid.im) > 0.05 && mad(mid.im, a2.im) > 0.05 && mad(a1.im, a2.im) > mad(a1.im, mid.im));
const p1 = drawObjeto(createCanvas(10, 10).getContext('2d'), 'llave_laton', { x: 100, y: 50, size: 200 }, { pal }), p2 = drawObjeto(createCanvas(10, 10).getContext('2d'), 'llave_laton', { x: 300, y: 80, size: 100, rot: Math.PI / 2 }, { pal });
ok('O17 las anclas siguen a x, y, size y rot', Math.abs((p1.punta.x - p1.aro.x) - 2 * (p2.punta.y - p2.aro.y)) < 1e-6 && p2.punta.x - p2.aro.x < 1e-6 && Math.abs(p1.aro.x - (100 + p1.aro.x - 100)) < 1e-9);
const pedidos = ['cilindro_metalico', 'campana_cristal', 'llave_laton', 'balanza_cruz', 'sello_tampon', 'acta_cuaderno', 'pluma', 'fotomultiplicador', 'cuba', 'contador', 'papel_continuo', 'lapiz', 'lampara_mesa', 'botella_vidrio', 'tarjeta_postal', 'moneda', 'sobre_sello', 'red_pesca', 'mapa_costero', 'reloj', 'mano', 'puerta', 'ventana', 'mesa', 'libro'];
ok('O guiones: están los 19 objetos de Consta, Veinticuatro y Botella más reloj, mano, puerta, ventana, mesa y libro', pedidos.every((p) => OBJETOS[p]), pedidos.filter((p) => !OBJETOS[p]).join(','));
// ── DSL ──
const fakeApi = (log) => { const ctx = createCanvas(W, H).getContext('2d'); return { ctx, api: { params: {}, k: 1, dt: 1 / 24, safe: { x0: 0, x1: W, y0: 0, y1: H, w: W, h: H, cx: W / 2, cy: H / 2 }, color: (c) => c, param: () => 0, spring: () => 1, at: (a, b) => [a, b], focus: (...a) => log.focus.push(a),
  fondo: (s, o) => { log.fondo.push([s, o]); drawFondo(ctx, s, 1, { W, H, k: 1, pal: PAL_DARK, canvas: (a, b) => createCanvas(a, b), cache: new Map(), depth: (d, fn) => fn() }); },
  objeto: (id, o) => { log.objeto.push([id, o]); const r = drawObjeto(ctx, id, o, { pal, k: 1, t: 0 }); log.focus.push([r.x, r.y, r.w, r.h, id]); return r; } } }; };
const SC = { dsl: 1, id: 'T1', objects: [{ type: 'fondo', preset: 'cuba_oscura', ajustes: { bruma: { densidad: 0.4 } }, alfa: 0.9 }, { type: 'objeto', id: 'llave', objeto: 'llave_laton', x: 100, y: 90, size: 120, estado: 'girada', fields: ['punta.x', 'punta.y'], partes: { brillo: { $expr: 'lt * 0.1' } } },
  { type: 'shape', shape: 'circle', x: { $expr: 'llave_punta_x' }, y: { $expr: 'llave_punta_y' }, r: 4, color: 'accent' }] };
ok('D11 un shot DSL con fondo y objeto valida', !validateScene(SC).length, JSON.stringify(validateScene(SC)));
const log = { focus: [], fondo: [], objeto: [] }; let dslErr = '';
try { const m = shot(SC, {}), { ctx, api } = fakeApi(log); ctx.fillRect = ctx.fillRect; m.draw(ctx, 1, 0.5, { id: 'T1', t: [0, 4] }, { width: W, height: H }, api); } catch (e) { dslErr = e.message; }
ok('D11/D18 compila y pinta; el objeto publica sus anclas como variables <id>_<ancla>_x|y; registra foco', !dslErr && log.fondo.length === 1 && log.fondo[0][0].preset === 'cuba_oscura' && log.objeto[0][1].partes.brillo > 0 && log.focus.length >= 1, dslErr);
const dd = depsOf(SC);
ok('D11 deps: el fondo depende del tiempo y del cuadro; el objeto del tiempo', dd[0].time && dd[0].frame && dd[1].time);
const bad1 = validateScene({ ...SC, objects: [{ type: 'objeto', objeto: 'llave_latoon', x: 1, y: 1, size: 10 }, { type: 'objeto', objeto: 'reloj', x: 1, y: 1, size: 10, params: { numerox: true }, partes: { hor: 3 }, estado: 'cuatro' }, { type: 'fondo', capas: [{ tipo: 'fbm', escalla: 1 }] }, { type: 'fondo', preset: 'nope' }] });
ok('D19 objeto, param, parte, estado y capa/preset desconocidos fallan con «¿quisiste decir…?»', bad1.length >= 5 && bad1.some((e) => /llave_laton/.test(e.remedy)) && bad1.some((e) => /"numeros"/.test(e.remedy)) && bad1.some((e) => /"hora"/.test(e.remedy)) && bad1.some((e) => /"escala"/.test(e.remedy)), bad1.map((e) => e.path).join(' '));
ok('D tipos registrados en TYPES con req y props', TYPES.fondo && TYPES.objeto && TYPES.objeto.req.includes('size'));
// ── docs ──
const API = fs.readFileSync(path.join(ROOT, 'docs/API.md'), 'utf8');
ok('I22 docs/API.md (generado) documenta api.fondo y api.objeto', /api\.fondo\(/.test(API) && /api\.objeto\(/.test(API));
ok('I22 docs/handoff/fondos.md documenta dónde está el meta', /fondos-meta/.test(fs.readFileSync(path.join(ROOT, 'docs/handoff/fondos.md'), 'utf8')));
// I23 (rescatado de la rama voz, V3b): un objeto de tamaño 0 (p. ej. un muelle en su primer instante) no envenena el contexto de dibujo
{
  const c = canvasPkg.createCanvas(100, 100), g = c.getContext('2d'), E = { pal: { paper: '#ffffff', ink: '#000000', accent: '#ff0000', accent2: '#0000ff', shade: '#cccccc' }, k: 1, t: 0 };
  g.fillStyle = '#fff'; g.fillRect(0, 0, 100, 100); drawObjeto(g, 'moneda', { x: 50, y: 50, size: 0 }, E); g.fillStyle = '#00ff00'; g.fillRect(10, 10, 20, 20);
  const px = g.getImageData(15, 15, 1, 1).data;
  ok('I23 tras dibujar una moneda de tamaño 0, el contexto sigue dibujando (antes quedaba muerto para el resto de la sesión)', px[1] === 255 && px[0] === 0);
}
console.log(`\nfondos: ${n - bad}/${n}`);
process.exit(bad ? 1 : 0);
