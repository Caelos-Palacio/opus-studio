#!/usr/bin/env node
// Spec 020 — vectores y diagramas: SVG como elemento (parse, sanitización, determinismo, draw-on, recoloreo, morph, hash),
// tipo DSL `svg` / `box` con rótulo, generadores de diagramas (flujo, capas, barras) y perfil de lint `lamina`.
//   V1 parse · V2 sanitización · V3 determinismo/trazo/recoloreo/morph · V4 hash · V5 DSL y toolbox · V6 diagramas · V7 perfil lamina y S01
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, FONTS_CONF, copyRepo, rmrf, run } from './lib.mjs';
import canvasPkg from 'canvas';

let n = 0, bad = 0;
const ok = (m, c, info = '') => { n++; console.log(`${c ? '✓' : '✗'} vectores: ${m}${info ? '  ' + info : ''}`); if (!c) bad++; };
const rd = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const clone = (x) => JSON.parse(JSON.stringify(x));
const S = await import('../engine/svg.mjs');
const D = await import('../engine/dsl-core.mjs');
const G = await import('../engine/diagramas.mjs');
const IO = await import('../engine/svg-io.mjs');
const { parseSvg, SvgError, drawSvg, SVG_LIB, longitud } = S, { cargarSvg } = IO;

const PAL = { paper: '#f3ead8', ink: '#1b2a3a', accent: '#d9482b', accent2: '#2b7fd9', shade: '#8a8a8a', quant: '#e0a020', anom: '#20a060' };
const PAL2 = { paper: '#101820', ink: '#f0f0f0', accent: '#20d0a0', accent2: '#d040d0', shade: '#505050', quant: '#ffee00', anom: '#ff3030' };
const SZ = 200;
// pinta con drawSvg en un lienzo limpio; devuelve {sha, ink (píxeles no transparentes), r}
function paint(doc, o = {}, pal = PAL) {
  const c = canvasPkg.createCanvas(SZ, SZ), x = c.getContext('2d');
  const r = drawSvg(x, doc, { x: SZ / 2, y: SZ / 2, size: 160, ...o }, { pal, k: 1 });
  const d = x.getImageData(0, 0, SZ, SZ).data; let ink = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) ink++;
  return { sha: crypto.createHash('sha256').update(d).digest('hex'), ink, r, data: d };
}
const SVG = (body, attrs = 'viewBox="0 0 100 100"') => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;
const fail = (txt) => { try { parseSvg(txt, { nombre: 't' }); return null; } catch (e) { return e; } };

// ── V1 parse ──
{
  const doc = parseSvg(SVG(`<g transform="translate(10 10) scale(2)" fill="#ff0000" stroke="#00f" stroke-width="2" opacity="0.5">
    <path d="M0 0 L20 0 C30 0 30 10 20 10 Q10 20 0 10 A5 5 0 0 1 0 0 Z"/><rect x="30" y="30" width="20" height="10" fill="none"/><circle cx="60" cy="60" r="10" fill-opacity="0.4"/></g>`), { nombre: 'p' });
  const [a, b, c] = doc.items;
  ok('V1a parse: path (M L C Q A Z), rect y circle dentro de un grupo con transform → 3 items', doc.items.length === 3 && doc.paths === 3, JSON.stringify(doc.items.map((i) => i.tipo)));
  ok('V1b estilo heredado del grupo: relleno y trazo del grupo, grosor escalado por el transform (2×2 = 4 → 4/100 del cuadro), opacidad 0,5', a.fill === '#ff0000' && a.stroke === '#0000ff' && b.fill === null && Math.abs(a.sw - 0.04 * 1) < 1e-9 * 100 && a.opacity === 0.5, JSON.stringify([a.fill, a.stroke, a.sw, a.opacity, b.fill]));
  ok('V1c fill-opacity propio del circle (0,4) se conserva y no pisa el heredado', c.fillOpacity === 0.4 && c.opacity === 0.5);
  const arc = parseSvg(SVG('<path d="M10 50 A40 40 0 0 1 90 50"/>'), { nombre: 'a' }).items[0].shape, xs = arc.contours[0].d.filter((_, i) => i % 2 === 0), ys = arc.contours[0].d.filter((_, i) => i % 2 === 1);
  // semicírculo de radio 40 centrado en (50,50): ancho 80, alto 40 (en cuadro unidad /100)
  ok('V1d arco A → cúbicas con bbox del semicírculo (ancho 0,8, alto ≈ 0,4)', Math.abs(Math.max(...xs) - Math.min(...xs) - 0.8) < 0.01 && Math.abs(Math.max(...ys) - Math.min(...ys) - 0.4) < 0.01, `${(Math.max(...xs) - Math.min(...xs)).toFixed(3)} × ${(Math.max(...ys) - Math.min(...ys)).toFixed(3)}`);
  const all = doc.items.flatMap((i) => i.shape.contours.flatMap((c2) => c2.d)); ok('V1e cuadro unidad: lado mayor 1 y centrado (coordenadas en [−0,5·k, 0,5·k])', Math.max(...all.map(Math.abs)) <= 1.001, '');
  const lib = SVG_LIB.map((id) => { try { const d = cargarSvg(id, ROOT); return { id, paths: d.paths, role: d.items.some((i) => i.fillRol || i.strokeRol), avisos: d.avisos }; } catch (e) { return { id, err: e.message }; } });
  const want = ['secante', 'mosca', 'sobre', 'moneda', 'botella', 'sello', 'lupa', 'reloj', 'mano', 'hoja'];
  ok('V1f biblioteca: las 10 SVG propias existen y parsean, con ≥ 3 paths y roles de paleta (data-fill/data-stroke)', want.every((w) => lib.some((l) => l.id === w && !l.err && l.paths >= 3 && l.role)), JSON.stringify(lib.filter((l) => l.err || l.paths < 3 || !l.role)));
}

{ const { spawnSync } = await import('node:child_process'), r = spawnSync(process.execPath, ['engine/svg-io.mjs', 'manifest', '--check'], { cwd: ROOT, encoding: 'utf8' });
  ok('V1g el manifiesto puro engine/svg-lib.mjs está al día con assets/svg/ (y svg.mjs/dsl-core no importan fs)', r.status === 0 && !/node:/.test(rd('engine/svg.mjs').split('\n').filter((l) => /^import/.test(l)).join('\n')), r.stdout); }

// ── V2 sanitización ──
{
  const casos = [
    ['script', SVG('<script>alert(1)</script><path d="M0 0L9 9"/>'), /script/i],
    ['foreignObject', SVG('<foreignObject><div>x</div></foreignObject>'), /foreignObject/i],
    ['onload', SVG('<path d="M0 0L9 9" onload="x()"/>'), /on(load|…)|evento/i],
    ['href externo', SVG('<a href="http://evil.test/x"><path d="M0 0L9 9"/></a>'), /href/i],
    ['xlink data:', SVG('<use xlink:href="data:image/svg+xml;base64,AAAA"/>', 'xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 9 9"'), /href|data:/i],
    ['javascript:', SVG('<path d="M0 0L9 9" fill="javascript:alert(1)"/>'), /javascript/i],
    ['ENTITY', '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY a "bb">]>' + SVG('<path d="M0 0L9 9"/>'), /DOCTYPE|ENTITY/i],
    ['animate', SVG('<path d="M0 0L9 9"><animate attributeName="href" to="http://x"/></path>'), /animate|animaci/i],
    ['image', SVG('<image href="#a" width="9" height="9"/>'), /image/i],
    ['url externo', SVG('<path d="M0 0L9 9" fill="url(http://evil.test/g)"/>'), /url/i],
  ];
  const res = casos.map(([k, t, re]) => { const e = fail(t); return [k, e instanceof SvgError && re.test(e.message) && !!e.codigo, e?.message ?? 'no falló']; });
  ok('V2a lo inseguro falla con SvgError (código + mensaje claro en español): script, foreignObject, onload, href externo, data:, javascript:, ENTITY, animate, image, url externo', res.every((r) => r[1]), JSON.stringify(res.filter((r) => !r[1])));
  ok('V2b el mensaje dice qué y dónde (línea) y qué hacer', (() => { const e = fail(`<svg viewBox="0 0 9 9">\n<g>\n<script>x</script></g></svg>`); return /línea 3/.test(e?.message) && /quita|elimina|retira/i.test(e.message); })(), fail(`<svg viewBox="0 0 9 9">\n<g>\n<script>x</script></g></svg>`)?.message);
  const bien = [SVG('<title>t</title><defs/><path id="a" d="M0 0L9 9"/>'), SVG('<path d="M0 0L9 9"/><a href="#a"><path d="M1 1L5 5"/></a>')].map((t) => fail(t));
  ok('V2c lo benigno pasa: <title>, <defs>, href interno «#a»; lo no soportado va a doc.avisos', bien.every((e) => e === null) && parseSvg(SVG('<title>t</title><path d="M0 0L9 9"/>'), { nombre: 'x' }).avisos.some((a) => /title/.test(a)));
  ok('V2d límites: > 512 KB, > 4000 elementos y profundidad > 48 se rechazan', fail(SVG(`<path d="M0 0${' L1 1'.repeat(140000)}"/>`)) instanceof SvgError && fail(SVG('<path d="M0 0L1 1"/>'.repeat(4100))) instanceof SvgError && fail(SVG('<g>'.repeat(60) + '</g>'.repeat(60))) instanceof SvgError);
  const e1 = (() => { try { cargarSvg('../../etc/passwd', ROOT); } catch (e) { return e; } })(), e2 = (() => { try { cargarSvg('/etc/passwd', ROOT); } catch (e) { return e; } })(), e3 = (() => { try { cargarSvg('moska', ROOT); } catch (e) { return e; } })();
  ok('V2e ruta: «..» y absolutas se rechazan; un nombre desconocido sugiere «¿quisiste decir "mosca"?»', e1 instanceof SvgError && e2 instanceof SvgError && /mosca/.test(e3?.message ?? '') && /quisiste decir/.test(e3?.message ?? ''), [e1?.message, e3?.message].join(' | '));
}

// ── V3 determinismo, trazo, recoloreo, morph ──
{
  const sec = cargarSvg('secante', ROOT), mos = cargarSvg('mosca', ROOT);
  const a = paint(mos, { trazo: 0.6 }), mid = paint(sec, { trazo: 0.3 }), b = paint(mos, { trazo: 0.6 });
  ok('V3a determinismo: mismo SVG y mismo trazo → mismos píxeles (también con otro dibujo entre medias)', a.sha === b.sha && a.ink > 200 && a.sha !== mid.sha);
  const t = [0, 0.25, 0.5, 1].map((u) => paint(mos, { trazo: u }));
  ok('V3b trazo: 0 no pinta nada; la tinta crece de forma monótona (0 < 0,25 < 0,5 < 1)', t[0].ink === 0 && t[0].ink < t[1].ink && t[1].ink < t[2].ink && t[2].ink < t[3].ink, t.map((x) => x.ink).join(' < '));
  ok('V3c trazo=1 (y sin trazo) pinta el SVG completo, idéntico', t[3].sha === paint(mos, {}).sha);
  const pu = [0.1, 0.4, 0.8].map((u) => paint(mos, { trazo: u }).r.punta);
  ok('V3d punta: la pluma existe, está dentro del cuadro y se mueve al avanzar el trazo', pu.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)) && (pu[0].x !== pu[1].x || pu[0].y !== pu[1].y) && (pu[1].x !== pu[2].x || pu[1].y !== pu[2].y));
  ok('V3e longitud por path: positiva y estable', longitud(mos) > 1 && longitud(mos) === longitud(cargarSvg('mosca', ROOT)));
  const p1 = paint(sec, {}, PAL), p2 = paint(sec, {}, PAL2);
  ok('V3f recoloreo por medio: la misma SVG con otra paleta (roles) da otros píxeles', p1.sha !== p2.sha && p1.ink === p2.ink);
  const flat = parseSvg(SVG('<path d="M10 10H90V90H10Z" fill="#ff0000" stroke="#0000ff" stroke-width="4" data-stroke="ink"/><circle cx="50" cy="50" r="20" fill="#00ff00"/>'), { nombre: 'f' });
  const pxAt = (r, x, y) => { const i = (y * SZ + x) * 4; return [r.data[i], r.data[i + 1], r.data[i + 2]]; };
  const base = paint(flat, { size: 180 }), re = paint(flat, { size: 180, roles: { '#ff0000': 'accent2' } }), mono = paint(flat, { size: 180, mono: 'accent' });
  const cc = (p) => pxAt(p, 100, 100), c2 = (p) => pxAt(p, 40, 40);
  ok('V3g roles {"#ff0000": "accent2"} recolorea solo ese color (el cuadrado) y no el círculo verde', JSON.stringify(c2(base)) === '[255,0,0]' && JSON.stringify(c2(re)) === JSON.stringify([0x2b, 0x7f, 0xd9]) && JSON.stringify(cc(re)) === JSON.stringify(cc(base)), JSON.stringify([c2(base), c2(re)]));
  ok('V3h mono: todo a un rol (círculo y cuadrado del color de accent)', JSON.stringify(cc(mono)) === JSON.stringify([0xd9, 0x48, 0x2b]) && JSON.stringify(c2(mono)) === JSON.stringify([0xd9, 0x48, 0x2b]));
  const A = parseSvg(SVG('<path d="M20 20H80V80H20Z" fill="#f00"/><circle cx="50" cy="50" r="10" fill="#00f"/>'), { nombre: 'A' }), B = parseSvg(SVG('<path d="M10 50L50 10L90 50L50 90Z" fill="#0f0"/><circle cx="50" cy="50" r="30" fill="#ff0"/>'), { nombre: 'B' });
  const m0 = paint(A, { morphTo: B, u: 0 }), m1 = paint(A, { morphTo: B, u: 1 }), mh = paint(A, { morphTo: B, u: 0.5 });
  ok('V3i morph: u=0 ≡ A y u=1 ≡ B (píxeles idénticos); u=0,5 distinto de ambos', m0.sha === paint(A).sha && m1.sha === paint(B).sha && mh.sha !== m0.sha && mh.sha !== m1.sha);
  const C = parseSvg(SVG('<path d="M0 0L9 9"/>'), { nombre: 'C' });
  const e = (() => { try { paint(A, { morphTo: C, u: 0.5 }); } catch (x) { return x; } })();
  ok('V3j morph con distinto nº de paths falla con los dos recuentos', e instanceof SvgError && /2/.test(e.message) && /1/.test(e.message) && /mismo n/i.test(e.message), e?.message);
}

// ── V4 hash por contenido ──
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opus-svg-')), f = path.join(ROOT, 'assets/svg/__hash_test.svg');
  const H = await import('../engine/hash.mjs');
  const sig = () => { H.flushDigests(); return H.assetsSig(); };
  try {
    fs.writeFileSync(f, SVG('<path d="M0 0L9 9"/>')); await new Promise((r) => setTimeout(r, 1100)); const s0 = sig();
    fs.writeFileSync(f, SVG('<path d="M0 0L9 8"/>')); await new Promise((r) => setTimeout(r, 1100)); const s1 = sig();
    const now = new Date(); fs.utimesSync(f, now, new Date(now.getTime() + 5000)); const s2 = sig();
    fs.writeFileSync(f, SVG('<path d="M0 0L9 8"/>')); await new Promise((r) => setTimeout(r, 1100)); const s3 = sig();
    ok('V4 el SVG entra en el hash por contenido: cambiar su contenido cambia assetsSig(); tocar su fecha o reescribir lo mismo, no', s0 !== s1 && s1 === s2 && s1 === s3, [s0, s1, s2].map((x) => x.slice(0, 6)).join(' '));
  } finally { fs.rmSync(f, { force: true }); fs.rmSync(tmp, { recursive: true, force: true }); H.flushDigests(); }
}

// ── V5 DSL, api y toolbox ──
{
  const sc = { dsl: 1, id: 'V5', params: { p: { type: 'number', default: 0.5 } }, objects: [{ id: 'm', type: 'svg', svg: 'mosca', x: 100, y: 50, size: { $expr: '60 + 10 * p' }, trazo: { $expr: 'seg(lt, 0, 2)' }, roles: { '#000000': 'accent' }, mono: 'ink', fields: ['punta.x'] },
    { id: 'c', type: 'text', text: 'x', x: { $expr: 'm_x' }, y: { $expr: 'm_punta_x' } }] };
  const errs = D.validateScene(sc);
  ok('V5a el escenario con {type:"svg"} valida y compila', errs.length === 0 && 'svg' in D.TYPES, JSON.stringify(errs.slice(0, 2)));
  const bads = [['mosca desconocida', (s) => { s.objects[0].svg = 'moska'; }, /moska|mosca/], ['prop desconocida', (s) => { s.objects[0].tamano = 3; }, /tamano|size/], ['falta size', (s) => { delete s.objects[0].size; }, /size/], ['ruta fuera de assets', (s) => { s.objects[0].svg = '../x.svg'; }, /assets|\.\./]];
  const rr = bads.map(([k, f, re]) => { const s = clone(sc); f(s); const e = D.validateScene(s); return [k, e.length > 0 && re.test(JSON.stringify(e)), JSON.stringify(e.slice(0, 1))]; });
  ok('V5b svg/prop desconocidos, req ausentes y rutas fuera de assets/ fallan con ruta y sugerencia', rr.every((x) => x[1]), JSON.stringify(rr.filter((x) => !x[1])));
  const dd = Object.fromEntries(D.depsOf(sc).map((d) => [d.id, d]));
  ok('V5c deps: el svg lee el param y el tiempo; sus fields (punta_x) son legibles por otros objetos', dd.m.params.join() === 'p' && dd.m.time && dd.c.objects.join() === 'm', JSON.stringify([dd.m.params, dd.m.time, dd.c.objects]));
  const log = [], spy = new Proxy({}, { get: (_, k) => (k === 'getTransform' ? () => ({}) : (...a) => { log.push(k); }), set: () => true });
  const calls = [], api = { params: { p: 0.5 }, k: 1, dt: 0.04, safe: { x0: 0, x1: 100, y0: 0, y1: 50, w: 100, h: 50, cx: 50, cy: 25 }, color: (c) => c, spring: (x) => x, at: (x, y) => [x, y], param: () => 0, text: (...a) => calls.push(['text', ...a]), svg: (id, o) => { calls.push(['svg', id, o]); return { x: o.x, y: o.y, w: o.size, h: o.size, punta: { x: 7, y: 8 } }; }, focus: () => {} };
  D.shot(clone(sc), {}).draw(spy, 1, 0.25, { t: [0, 4], text: 'x' }, { width: 100, height: 50 }, api);
  const sv = calls.find((c) => c[0] === 'svg'), tx = calls.find((c) => c[0] === 'text');
  ok('V5d el tipo svg llama a api.svg(id, {x,y,size,trazo,roles,mono}) con expresiones evaluadas y publica fields', sv && sv[1] === 'mosca' && sv[2].size === 65 && sv[2].trazo === 0.5 && sv[2].mono === 'ink' && sv[2].roles['#000000'] === 'accent' && tx[2] === 100 && tx[3] === 7, JSON.stringify([sv, tx]));
  ok('V5e api.svg está documentada (DOC de prims) y devuelve punta/centro', /api\.svg\(/.test(rd('engine/prims.mjs')) && /punta/.test(rd('engine/prims.mjs')));
  // box con rótulo
  const bx = { dsl: 1, id: 'BX', objects: [{ type: 'box', x: 1, y: 2, w: 3, h: 4 }, { type: 'box', x: 10, y: 20, w: 30, h: 40, label: 'brief\npieza', tag: '01', color: 'accent', fill: 'paper', radius: 6, banda: 8, sombra: true, alpha: { $expr: 'seg(lt, 0, 1)' } }] };
  const be = D.validateScene(bx), boxCalls = [], api2 = { ...api, box: (...a) => boxCalls.push(a) };
  D.shot(clone(bx), {}).draw(spy, 1, 0.25, { t: [0, 4], text: 'x' }, { width: 100, height: 50 }, api2);
  ok('V5f box: sin props visuales se comporta como antes (no dibuja); con label/tag/color/fill/radius/banda/sombra/alpha llama a api.box', be.length === 0 && boxCalls.length === 1 && boxCalls[0][4].label === 'brief\npieza' && boxCalls[0][4].tag === '01' && boxCalls[0][4].alpha === 1 && boxCalls[0][0] === 10, JSON.stringify([be.slice(0, 1), boxCalls]));
  ok('V5g box con prop desconocida sugiere («lable» → ¿quisiste decir "label"?)', D.validateScene({ dsl: 1, id: 'B2', objects: [{ type: 'box', x: 1, y: 1, w: 1, h: 1, lable: 'x' }] }).some((e) => /label/.test(e.message + (e.remedy ?? ''))));
  const T = await import('../engine/toolbox.mjs'), reg = (await T.buildRegistry({ root: ROOT })).entries, ids = new Set(reg.map((e) => e.id)), top = T.search(reg, 'mosca vectorial svg', { k: 5 }).map((r) => r.entry.id);
  ok('V5h toolbox: dsl:svg, prim:svg, prim:box, objeto:svg_mosca y las 3 recetas de diagrama registradas; «mosca» encuentra objeto:svg_mosca', ['dsl:svg', 'prim:svg', 'prim:box', 'objeto:svg_mosca', 'receta:diagrama_flujo', 'receta:diagrama_capas', 'receta:barras_antes_despues'].every((i) => ids.has(i)) && top.includes('objeto:svg_mosca'), `${top.join(' ')}`);
  const cov = await import('../engine/dsl-coverage.mjs'); const C = cov.coverage(ROOT), min = JSON.parse(rd('data/dsl-coverage.json')).ratchet?.min ?? 0;
  ok('V5i la cobertura DSL no baja (ratchet)', C.pct >= min - 1e-9, `${C.pct.toFixed(2)} % ≥ ${min}`);
}

// ── V6 generadores de diagramas ──
{
  const flujo = { receta: 'diagrama_flujo', id: 'F1', disposicion: 'serpiente', cols: 3, leyenda: [['accent', 'decide el usuario']], nodos: [['uno', 'a', 'b', 'accent2'], ['dos', 'c', 'd', 'ink'], ['tres', 'e', 'f', 'ink'], ['cuatro', 'g', 'h', 'ink'], ['cinco', 'i', 'j', 'accent']] };
  const cuenta = (sc, tipo) => { const w = (l) => l.reduce((a, o) => a + (o.type === 'repeat' ? (o.items?.length ?? 0) * w(o.children) : (o.type === tipo ? 1 : 0) + w(o.children ?? [])), 0); return w(sc.objects); };
  const sc = G.generar(clone(flujo)), tipos = (s) => { const out = []; const w = (l) => { for (const o of l) { out.push(o); if (o.children) w(o.children); } }; w(s.objects); return out; };
  const nBox = cuenta(sc, 'box'), nArr = cuenta(sc, 'arrow');
  ok('V6a diagrama_flujo: escenario válido; 5 nodos → 5 cajas con rótulo y 4 flechas de cadena', D.validateScene(sc).length === 0 && nBox >= 5 && nArr === 4, `${nBox} cajas ${nArr} flechas ${JSON.stringify(D.validateScene(sc).slice(0, 2))}`);
  const geom = G.disponer(flujo.nodos.length, 'serpiente', 3), fila = G.disponer(5, 'fila', 5), col = G.disponer(3, 'columna', 1);
  ok('V6b disposición: serpiente invierte la segunda fila (nodo 4 bajo el 3, sentido ←); fila y columna ordenadas', geom[2].c === 2 && geom[3].c === 2 && geom[4].c === 1 && geom[3].f === 1 && fila.every((p, i) => p.f === 0 && p.c === i) && col.every((p, i) => p.c === 0 && p.f === i), JSON.stringify(geom));
  const e1 = (() => { try { G.generar({ ...clone(flujo), aristas: [['uno', 'tress']] }); } catch (e) { return e; } })(), e2 = (() => { try { G.generar({ ...clone(flujo), disposicion: 'serpentin' }); } catch (e) { return e; } })(), e3 = (() => { try { G.generar({ receta: 'diagrama_flujo', id: 'F2', nodos: [] }); } catch (e) { return e; } })();
  ok('V6c errores con ruta y sugerencia: arista a un nodo inexistente («tress» → "tres"), disposición desconocida («serpentin» → "serpiente"), sin nodos', /tres/.test(e1?.message ?? '') && /serpiente/.test(e2?.message ?? '') && /nodos/.test(e3?.message ?? ''), [e1?.message, e2?.message, e3?.message].join(' | '));
  const aris = G.generar({ ...clone(flujo), aristas: [['uno', 'tres'], ['dos', 'cinco']] }); const nA = cuenta(aris, 'arrow');
  ok('V6d aristas explícitas (por título o índice) reemplazan la cadena: 2 aristas → 2 flechas', nA === 2, String(nA));
  const capas = { receta: 'diagrama_capas', id: 'C1', capas: [['gobernanza', 'quién puede qué', 'accent2', ['ledger', 'gate', 'roles'], 'contrato: sin SHIP no hay master', ['gate']], ['render', 'tiempo → imagen', 'accent2', ['seek', 'caché'], 'contrato: mismo t → mismos píxeles']] };
  const sc2 = G.generar(clone(capas)), mods = cuenta(sc2, 'box');
  ok('V6e diagrama_capas: válido; 2 capas + 5 módulos = 7 cajas, el contrato como texto, el destacado en accent', D.validateScene(sc2).length === 0 && mods === 7 && JSON.stringify(sc2).includes('contrato: sin SHIP no hay master') && JSON.stringify(sc2).includes('"accent"'), `${mods} ${JSON.stringify(D.validateScene(sc2).slice(0, 2))}`);
  const barras = { receta: 'barras_antes_despues', id: 'B1', filas: [['master', 'reloj', 167, 84, 's'], ['lint', 'film', 70, 1.5, 's'], ['cobertura', 'dsl', 3.2, 95.2, '%'], ['tokens', 'arranque', 15300, 1400, '', '≈ ']] };
  const M = G.mejora, sc3 = G.generar(clone(barras));
  ok('V6f mejora calculada: 167→84 = «−50 %»; 70→1,5 = «÷ 47»; 3,2→95,2 = «× 30»; 15 300→1 400 = «−91 %»', M(167, 84) === '−50 %' && M(70, 1.5) === '÷ 47' && M(3.2, 95.2) === '× 30' && M(15300, 1400) === '−91 %', [M(167, 84), M(70, 1.5), M(3.2, 95.2), M(15300, 1400)].join(' '));
  const s3 = JSON.stringify(sc3);
  ok('V6g barras_antes_despues: válido; cada fila a su escala (la mayor de cada fila llena el ancho; la menor, proporcional) y las cifras formateadas («167 s», «95,2 %», «≈ 15 300»)', D.validateScene(sc3).length === 0 && G.escalaFila(167, 84) .every((x) => x > 0 && x <= 1) && Math.max(...G.escalaFila(167, 84)) === 1 && Math.abs(G.escalaFila(167, 84)[1] - 84 / 167) < 1e-9 && /167 s/.test(s3) && /95,2 %/.test(s3) && /≈ 15 300/.test(s3), s3.slice(0, 120));
  const e4 = (() => { try { G.generar({ receta: 'barras_antes_despues', id: 'B2', filas: [['x', 'y', 'mucho', 3]] }); } catch (e) { return e; } })();
  ok('V6h una fila sin cifras numéricas falla con ruta (/filas/0)', /filas\/0|fila 0/.test(e4?.message ?? ''), e4?.message);
  ok('V6i determinismo: los mismos datos dan el mismo .scene.json byte a byte (y distinto id → otro)', JSON.stringify(G.generar(clone(flujo))) === JSON.stringify(G.generar(clone(flujo))) && G.serializar(G.generar(clone(capas))) === G.serializar(G.generar(clone(capas))));
  ok('V6j las tres recetas están en el catálogo con meta (resumen ≤ 15 palabras, tags, params)', G.RECETAS.length === 3 && G.RECETAS.every((r) => r.meta.resumen.trim().split(/\s+/).length <= 15 && r.meta.tags.length && r.meta.params));
}

// ── V7 perfil lamina y lámina S01 desde datos ──
{
  const P = JSON.parse(rd('engine/profiles.json')), sch = JSON.parse(rd('data/timeline.schema.json'));
  ok('V7a perfil lamina: en profiles.json y en el esquema; relaja readCps, hold, foco y saliencia (documentado en docs/current/LAMINAS.md)', P.lamina && P.lamina.readCps > P.cinematic.readCps && P.lamina.maxHold >= 60 && P.lamina.requireFocus === false && P.lamina.saliency === false && sch.properties.profile.enum.includes('lamina') && fs.existsSync(path.join(ROOT, 'docs/current/LAMINAS.md')));
  const TL = JSON.parse(rd('data/sistema/timeline.json'));
  ok('V7b el film sistema usa el perfil lamina (sin profileOverrides.maxHold ni hold_ok manuales)', TL.profile === 'lamina' && !TL.profileOverrides?.maxHold && TL.shots.every((s) => !s.hold_ok));
  const src = rd('shots/S01.diagrama.json'), L = src.trimEnd().split('\n').length, antes = 464;
  const regen = G.serializar(G.generar(JSON.parse(src)));
  ok(`V7c S01 sale de shots/S01.diagrama.json (${L} líneas escritas frente a ${antes} del JSON a mano: −${Math.round(100 * (1 - L / antes))} %); el .scene.json está al día y la reducción ≥ 90 %`, regen === rd('shots/S01.scene.json') && L <= antes * 0.1, `${L} líneas`);
  const Dd = copyRepo(), env = { FONTCONFIG_FILE: FONTS_CONF, OPUS_LAYERS: 'none', OPUS_TIMELINE: 'data/sistema/timeline.json', OPUS_WARM: '0' };
  try {
    const Lr = await run(['engine/lint.mjs'], { cwd: Dd, env, timeout: 600000 });
    const m = /^SHIP/m.test(Lr.stdout) ? [0, 0] : /conteos: FIX (\d+)/.exec(Lr.stdout);
    ok('V7d lint del film sistema con perfil lamina: sin FIX y sin avisos de lectura («visible … de lectura») ni de hold', m && +m[1] === 0 && !/de lectura|hold >/.test(Lr.stdout), (Lr.stdout.match(/(FIX|WARN) .*(lectura|hold).*/g) ?? (Lr.stdout.match(/FIX .*/g) ?? [])).slice(0, 3).join(' | '));
    const r = await run(['engine/render.mjs', '--still', '7.5'], { cwd: Dd, env, timeout: 300000 }), f = path.join(Dd, 'out/sheets/still_7.50.png');
    const img = r.status === 0 && fs.existsSync(f) ? await canvasPkg.loadImage(fs.readFileSync(f)) : null;
    let claro = 0; if (img) { const c = canvasPkg.createCanvas(img.width, img.height), x = c.getContext('2d'); x.drawImage(img, 0, 0); const px = x.getImageData(0, 0, img.width, img.height).data; for (let i = 0; i < px.length; i += 4) if (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2] > 170) claro++; claro /= px.length / 4; }
    ok('V7e el still final de S01 regenerada es un diagrama real (1920×1080, > 1 % de texto/trazo claro)', img && img.width === 1920 && claro > 0.01, `claro ${(claro * 100).toFixed(1)} %`);
  } finally { rmrf(Dd); }
}

console.log(`\nvectores: ${n - bad}/${n}${bad ? `  ${bad} fallos` : ''}`);
process.exit(bad ? 1 : 0);
