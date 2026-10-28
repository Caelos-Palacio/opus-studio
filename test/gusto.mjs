#!/usr/bin/env node
// Spec 022 (estudio v6): perfil de gusto (data/gusto.md), panel de críticos (engine/panel.mjs) y conjunto de calibración.
//   node test/gusto.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT, rmrf } from './lib.mjs';

let n = 0, bad = 0;
const ok = (m, c, info = '') => { n++; console.log(`${c ? '✓' : '✗'} gusto: ${m}${info ? '  ' + info : ''}`); if (!c) bad++; };
const imp = (f) => import(pathToFileURL(path.join(ROOT, f)).href);
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const G = await imp('engine/gusto.mjs'), P = await imp('engine/panel.mjs');
const md = fs.readFileSync(path.join(ROOT, 'data/gusto.md'), 'utf8'), cal = J('data/calibracion.json'), notas = J('data/notas.json');
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'opus-gusto-')));
const rubrica = G.parseRubrica(md);
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

// ── G-A. perfil de gusto: reglas observables con origen ──
{
  const reglas = G.parseReglas(md), manual = reglas.filter((r) => !/^9\./.test(r.grupo));
  ok('A1 hay reglas en los 7 grupos (historia/voz, ritmo, composición/materia, color/tipografía, sonido, anti-patrones, movimiento)', [/^1\./, /^2\./, /^3\./, /^4\./, /^5\./, /^6\./, /^7\./].every((p) => manual.filter((r) => p.test(r.grupo)).length >= 3), reglas.length + ' reglas');
  const e = G.validarReglas(reglas);
  ok('A2 cada regla tiene id único, texto y ≥1 origen válido (nota N##, spec ###, research ##, MODO-LIBRE, exp)', e.length === 0, e.slice(0, 3).join(' | '));
  const nid = new Set(notas.notas.map((_, i) => G.idNota(i))), citadas = manual.flatMap((r) => r.origen.filter((o) => /^N\d+/.test(o)));
  ok('A3 los ids de nota citados existen en data/notas.json', citadas.length > 10 && citadas.every((o) => nid.has(o)), citadas.filter((o) => !nid.has(o)).join(','));
  const specs = manual.flatMap((r) => r.origen.filter((o) => /^spec /.test(o))).map((o) => o.slice(5)), existentes = fs.readdirSync(path.join(ROOT, 'docs/specs')).map((f) => f.slice(0, 3));
  ok('A4 las specs citadas existen en docs/specs', specs.length > 10 && specs.every((s) => existentes.includes(s)), [...new Set(specs.filter((s) => !existentes.includes(s)))].join(','));
  ok('A5 las reglas son frases concretas (≥ 7 palabras), no adjetivos sueltos, y ≥ 40 % llevan cifra, umbral o «a 1×»', manual.every((r) => r.texto.split(/\s+/).length >= 7 && !/^(bonit|elegante|épic|impactante|con personalidad)/i.test(r.texto)) && manual.filter((r) => /\d|1×|%/.test(r.texto)).length >= manual.length * 0.4, manual.filter((r) => /\d|1×|%/.test(r.texto)).length + '/' + manual.length + ' con cifra');
  const nombres = [...cal.peliculas.map((p) => p.clave), 'potencias', 'botella', 'world3d', 'mate_papel'], leak = manual.filter((r) => nombres.some((x) => new RegExp(`\\b${x}\\b`, 'i').test(r.texto)));
  ok('A6 las reglas no nombran películas concretas (valen para cualquier film y no filtran respuestas a la calibración)', leak.length === 0, leak.map((r) => r.id).join(','));
  ok('A7 las reglas del ejemplo del brief están (textura a 1×, un solo acento de luz)', /textura del soporte.*1×/.test(md) && /[Uu]n solo acento/.test(md));
  const bin = [ 'H05 sin origen: «Hay voz» sin origen', '- **H99** Texto suficientemente largo sin origen alguno.', '- **H98** Texto suficientemente largo con origen raro. _Origen: blablá_' ].join('\n');
  const eb = G.validarReglas(G.parseReglas(bin));
  ok('A8 el validador rechaza una regla sin origen y otra con origen inventado', eb.some((x) => /H99: sin origen/.test(x)) && eb.some((x) => /H98: origen inválido/.test(x)), eb.join(' | '));
}

{
  const reglas = G.parseReglas(md), por = Object.fromEntries(reglas.map((r) => [r.id, r]));
  const mov = reglas.filter((r) => /^M\d+$/.test(r.id));
  ok('A9 sección «Movimiento»: ≥ 5 reglas M* observables en las tiras (easing, peso, transición motivada, nada entra todo a la vez), cada una con origen', mov.length >= 5 && ['easing', 'inercia', 'cambio de escena', 'a la vez'].every((w) => mov.some((r) => r.texto.toLowerCase().includes(w.toLowerCase()))) && mov.every((r) => r.origen.length) && mov.every((r) => /^7\./.test(r.grupo)), mov.map((r) => r.id).join(','));
  ok('A10 regla positiva «didáctico con materia» (H09, origen N10 + spec 001) y las reglas anti-lección la matizan (H04, A07, A08 la citan)', por.H09 && /materia/.test(por.H09.texto) && por.H09.origen.includes('N10') && por.H09.origen.includes('spec 001') && ['H04', 'A07', 'A08'].every((id) => /H09/.test(por[id].texto)));
  ok('A11 el oscuro elegido con profundidad es válido con más peso (C12 PESO ALTO con spec 012, N09, N17; A01 y C09 lo remiten)', por.C12 && /PESO ALTO/.test(por.C12.texto) && ['spec 012', 'N09', 'N17'].every((o) => por.C12.origen.includes(o)) && /C12/.test(por.A01.texto) && /NO se penaliza/.test(por.C09.texto));
}

// ── G-B. rúbrica ──
{
  const esp = { director: ['historia', 'voz', 'ritmo', 'movimiento'], ojo: ['composicion', 'materia', 'color', 'tipografia'], esceptico: ['no_generico', 'no_clipart', 'no_corporativo'] };
  ok('B1 la rúbrica define las 3 miradas con sus criterios (director, ojo, escéptico)', Object.entries(esp).every(([m, c]) => JSON.stringify(Object.keys(rubrica[m] ?? {})) === JSON.stringify(c)), JSON.stringify(Object.fromEntries(Object.entries(rubrica).map(([k, v]) => [k, Object.keys(v).length]))));
  ok('B2 miradaKey acepta «escéptico» con tilde y sin ella, y rechaza lo demás', G.miradaKey('escéptico') === 'esceptico' && G.miradaKey('Esceptico') === 'esceptico' && G.miradaKey('ojo') === 'ojo' && G.miradaKey('critico') === null);
}

// ── G-C. generador build / nota (G5) ──
{
  const d = path.join(tmp, 'g'); fs.mkdirSync(d); const gm = path.join(d, 'gusto.md'), nj = path.join(d, 'notas.json');
  fs.copyFileSync(path.join(ROOT, 'data/gusto.md'), gm); fs.copyFileSync(path.join(ROOT, 'data/notas.json'), nj);
  G.build({ notas: nj, gusto: gm }); const a = fs.readFileSync(gm, 'utf8'); G.build({ notas: nj, gusto: gm });
  ok('C1 build es idempotente y regenera exactamente el data/gusto.md versionado (sin deriva respecto a notas.json)', a === fs.readFileSync(gm, 'utf8') && a === md);
  const antes = G.parseReglas(a).length, r = G.agregarNota({ film: 'film_nuevo', texto: 'el acento cambia demasiado a menudo', nota: 7, dim: 'visual', notas: nj, gusto: gm, fecha: '2026-10-12' });
  const despues = fs.readFileSync(gm, 'utf8'), reg = G.parseReglas(despues).find((x) => x.id === r.id);
  ok('C2 G5: «nota <film> <texto>» añade la nota a notas.json y una regla con origen a gusto.md', JSON.parse(fs.readFileSync(nj, 'utf8')).notas.at(-1).texto.includes('acento cambia') && reg && reg.texto.includes('acento cambia') && reg.origen.includes(r.id) && G.parseReglas(despues).length === antes + 1, r.id);
  ok('C3 la regla nueva pasa el validador y el panel siguiente la lleva en su paquete (sección de notas)', G.validarReglas(G.parseReglas(despues)).length === 0 && /acento cambia/.test(despues));
  ok('C4 las reglas manuales no se tocan al regenerar', despues.slice(0, despues.indexOf(G.BEGIN)) === md.slice(0, md.indexOf(G.BEGIN)));
  const cli = execFileSync(process.execPath, [path.join(ROOT, 'engine/gusto.mjs'), 'check']).toString();
  ok('C5 `gusto.mjs check` valida el perfil real', /^ok:/.test(cli), cli.trim());
}

// ── G-D. validación de veredictos ──
const vistosOk = ['hoja.jpg', 'recortes/r1.png', 'recortes/r2.png', 'recortes/r3.png', 'recortes/r4.png', 'tiras/t1.jpg', 'tiras/t2.jpg', 'tiras/t3.jpg'];
const buen = { mirada: 'director', puntos: { historia: 7, voz: 6, ritmo: 8, movimiento: 7 }, total: 7, arreglos: ['acortar el tramo f03–f05', 'añadir un respiro de 4 s antes del giro', 'cambiar el cierre por una imagen'], vistos: vistosOk };
const val = (v, m) => P.validarVeredicto(v, rubrica, m);
{
  ok('D1 un veredicto correcto valida', val(buen).ok, val(buen).errores.join('|'));
  ok('D2 acepta «escéptico» con tilde', val({ mirada: 'escéptico', puntos: { no_generico: 4, no_clipart: 5, no_corporativo: 3 }, total: 4, arreglos: buen.arreglos, vistos: vistosOk }).ok);
  ok('D3 rechaza mirada inválida', !val({ ...buen, mirada: 'crítico' }).ok);
  ok('D4 rechaza criterio que falta o que sobra', !val({ ...buen, puntos: { historia: 7, voz: 6, ritmo: 8 } }).ok && !val({ ...buen, puntos: { ...buen.puntos, extra: 5 } }).ok);
  ok('D5 rechaza puntos fuera de 0–10 o no numéricos', !val({ ...buen, puntos: { historia: 11, voz: 6, ritmo: 8, movimiento: 7 } }).ok && !val({ ...buen, puntos: { historia: -1, voz: 6, ritmo: 8, movimiento: 7 } }).ok && !val({ ...buen, puntos: { historia: '7', voz: 6, ritmo: 8, movimiento: 7 } }).ok);
  ok('D6 rechaza un total que no es la media de los puntos (±0,25)', !val({ ...buen, total: 9 }).ok && val({ ...buen, total: 7.2 }).ok);
  ok('D7 exige exactamente 3 arreglos concretos', !val({ ...buen, arreglos: ['uno', 'dos'] }).ok && !val({ ...buen, arreglos: [...buen.arreglos, 'cuatro arreglos de más'] }).ok && !val({ ...buen, arreglos: ['a', 'b', 'c'] }).ok);
  ok('D8 rechaza lo que no es un objeto', !val(null).ok && !val([1]).ok && !val('x').ok);
  const dir = path.join(tmp, 'reg'); fs.mkdirSync(dir);
  const v = P.registrar(dir, 'director', JSON.stringify(buen), rubrica);
  ok('D9 registrar valida, normaliza y guarda veredictos/director.json', v.mirada === 'director' && JSON.parse(fs.readFileSync(path.join(dir, 'veredictos/director.json'), 'utf8')).total === 7);
  let msg = ''; try { P.registrar(dir, 'ojo', JSON.stringify(buen), rubrica); } catch (e) { msg = e.message; }
  ok('D10 registrar rechaza si la mirada del JSON no coincide con la pedida; y JSON ilegible', /no coincide/.test(msg) && (() => { try { P.registrar(dir, 'ojo', '{no es json', rubrica); } catch (e) { return /ilegible/.test(e.message); } })());
}

{
  const sin = { ...buen }; delete sin.vistos;
  ok('D11 «vistos» obligatorio: sin el campo, con < 7 archivos, o sin 4 recortes / 3 tiras, el veredicto se rechaza', !val(sin).ok && /vistos/.test(val(sin).errores.join()) && !val({ ...buen, vistos: vistosOk.slice(0, 6) }).ok && !val({ ...buen, vistos: ['hoja.jpg', 'frames/f01.jpg', 'frames/f02.jpg', 'frames/f03.jpg', 'frames/f04.jpg', 'frames/f05.jpg', 'frames/f06.jpg', 'tiras/t1.jpg', 'tiras/t2.jpg', 'tiras/t3.jpg'] }).ok && !val({ ...buen, vistos: [...vistosOk.slice(0, 5), 'tiras/t1.jpg', 'tiras/t1.jpg', 'tiras/t1.jpg'] }).ok);
  ok('D12 «vistos» válido con 7+ (4 recortes y 3 tiras), tolera prefijo de letra y se guarda normalizado; registrar rechaza uno con 6', val({ ...buen, vistos: ['A/hoja.jpg', 'A/recortes/r1.png', 'A/recortes/r2.png', 'A/recortes/r3.png', 'A/recortes/r6.png', 'A/tiras/t1.jpg', 'A/tiras/t4.jpg', 'A/tiras/t6.jpg'] }).ok && val(buen).v.vistos.length === 8 && (() => { try { P.registrar(path.join(tmp, 'rv'), 'director', { ...buen, vistos: vistosOk.slice(0, 6) }, rubrica); } catch (e) { return /vistos/.test(e.message); } })());
}

// ── G-E. agregación SHIP / FIX ──
{
  const V = (d, o, e) => ({ director: { total: d, arreglos: ['a1 director', 'a2', 'a3'] }, ojo: { total: o, arreglos: ['b1 ojo', 'b2', 'b3'] }, esceptico: { total: e, arreglos: ['c1 esceptico', 'c2', 'c3'] } });
  const A = (...t) => P.agregar(V(...t));
  ok('E1 SHIP: media ≥ 8 y ninguna mirada < 6', A(8, 8.5, 8).estado === 'SHIP' && A(8, 8, 8).estado === 'SHIP' && A(10, 8, 6).estado === 'SHIP');
  ok('E2 FIX por media < 8 aunque ninguna baje de 6', A(7.5, 8, 7.5).estado === 'FIX' && /media/.test(A(7.5, 8, 7.5).motivo));
  ok('E3 FIX si una mirada baja de 6 aunque la media supere 8 (10, 9, 5.9)', A(10, 9, 5.9).estado === 'FIX' && /< 6/.test(A(10, 9, 5.9).motivo) && A(10, 9, 5.9).media > 8);
  const f = A(7, 5, 6.5);
  ok('E4 FIX devuelve 9 arreglos, de la mirada más baja a la más alta; SHIP ninguno', f.arreglos.length === 9 && f.arreglos[0].mirada === 'ojo' && f.arreglos[8].mirada === 'director' && A(9, 9, 9).arreglos.length === 0);
  ok('E5 faltan miradas → INCOMPLETO (no se decide con 2 de 3)', P.agregar({ director: V(9, 9, 9).director, ojo: V(9, 9, 9).ojo }).estado === 'INCOMPLETO');
  const dir = path.join(tmp, 'ver'); fs.mkdirSync(dir);
  const mk = (m, puntos, total) => P.registrar(dir, m, { mirada: m, puntos, total, arreglos: ['arreglo concreto uno', 'arreglo concreto dos', 'arreglo concreto tres'], vistos: vistosOk }, rubrica);
  mk('director', { historia: 9, voz: 8, ritmo: 8, movimiento: 8 }, 8.3); mk('ojo', { composicion: 8, materia: 9, color: 8, tipografia: 8 }, 8.3); mk('escéptico', { no_generico: 8, no_clipart: 8, no_corporativo: 8 }, 8);
  const r = P.veredicto(dir);
  ok('E6 veredicto(dir) agrega los 3 JSON registrados y escribe veredicto.json y veredicto.md', r.estado === 'SHIP' && fs.existsSync(path.join(dir, 'veredicto.md')) && JSON.parse(fs.readFileSync(path.join(dir, 'veredicto.json'), 'utf8')).estado === 'SHIP' && /SHIP/.test(fs.readFileSync(path.join(dir, 'veredicto.md'), 'utf8')), `media ${r.media}`);
}

// ── G-F. Spearman y calibración ──
{
  const s = P.spearman;
  ok('F1 Spearman: orden idéntico = 1, invertido = −1', near(s([1, 2, 3, 4, 5], [10, 20, 30, 40, 50]), 1) && near(s([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]), -1));
  ok('F2 Spearman con un par intercambiado: ρ = 0,8 (1 − 6·4/(5·24))', near(s([1, 2, 3, 4, 5], [2, 1, 4, 3, 5]), 0.8));
  ok('F3 Spearman con empates (rango medio): [1,2,2,3] vs [1,2,3,4] = 0,9487', near(s([1, 2, 2, 3], [1, 2, 3, 4]), 4.5 / Math.sqrt(22.5), 1e-9));
  ok('F4 Spearman: serie constante o n < 2 → null (no inventa)', s([1, 1, 1], [1, 2, 3]) === null && s([1], [2]) === null);
  ok('F5 Spearman no depende de la escala, solo del orden', near(s([0.1, 0.5, 0.9, 0.95], [1, 5, 50, 51]), 1));
  const c = { umbral_spearman: 0.7, peliculas: [{ clave: 'x1', nivel: 1 }, { clave: 'x2', nivel: 2 }, { clave: 'x3', nivel: 3 }, { clave: 'x4', nivel: 4 }], pares: [{ mayor: 'x4', menor: 'x1', fuerza: 'estricto', origen: 't' }, { mayor: 'x3', menor: 'x2', fuerza: 'debil', origen: 't' }] };
  const dir = path.join(tmp, 'cal'), mapa = path.join(tmp, 'mapa.json'), map = { A: 'x3', B: 'x1', C: 'x4', D: 'x2' }; fs.mkdirSync(dir); fs.writeFileSync(mapa, JSON.stringify(map));
  const puntua = (puntos) => { for (const [l, c2] of Object.entries(map)) { const t = puntos[c2]; for (const m of G.MIRADAS) { const pu = Object.fromEntries(Object.keys(rubrica[m]).map((k) => [k, t])); fs.mkdirSync(path.join(dir, l), { recursive: true }); P.registrar(path.join(dir, l), m, { mirada: m, puntos: pu, total: t, arreglos: ['arreglo concreto uno', 'arreglo concreto dos', 'arreglo concreto tres'], vistos: vistosOk }, rubrica); } } };
  puntua({ x1: 3, x2: 5, x3: 6, x4: 8 });
  const r = P.calibrar({ cal: c, dir, mapa });
  ok('F6 calibrar: panel que ordena como las notas → ρ = 1, CALIBRADO, pares cumplidos', near(r.rho, 1) && r.ok && r.pares.every((p) => p.ok) && r.n === 4);
  puntua({ x1: 8, x2: 6, x3: 5, x4: 3 });
  const r2 = P.calibrar({ cal: c, dir, mapa });
  ok('F7 calibrar: panel invertido → ρ = −1, NO calibrado, pares incumplidos', near(r2.rho, -1) && !r2.ok && r2.pares.every((p) => !p.ok));
  ok('F8 pares débiles toleran 0,25: 5,9 vs 6,0 cumple, 5,5 vs 6,0 no', P.evaluarPares([{ mayor: 'a', menor: 'b', fuerza: 'debil' }], { a: 5.9, b: 6 })[0].ok && !P.evaluarPares([{ mayor: 'a', menor: 'b', fuerza: 'debil' }], { a: 5.5, b: 6 })[0].ok);
}

// ── G-G. conjunto de calibración ──
{
  const claves = new Set(cal.peliculas.map((p) => p.clave)), niv = Object.fromEntries(cal.peliculas.map((p) => [p.clave, p.nivel]));
  ok('G1 ≥ 10 películas con mp4 y nivel 1–5; claves únicas', cal.peliculas.length >= 10 && claves.size === cal.peliculas.length && cal.peliculas.every((p) => p.mp4.endsWith('.mp4') && p.nivel >= 1 && p.nivel <= 5), cal.peliculas.length + ' películas');
  const req = [['mate_papel', 'potencias_v1'], ['botella_aislada', 'botella'], ['potencias_v2', 'potencias_v3'], ['reel_v2', 'regla_v2']];
  ok('G2 están los 4 pares de orden de la spec 022 (reel_v2 ≳ regla_v2 como débil)', req.every(([a, b]) => cal.pares.some((p) => p.mayor === a && p.menor === b)) && cal.pares.find((p) => p.mayor === 'reel_v2' && p.menor === 'regla_v2').fuerza === 'debil', cal.pares.length + ' pares');
  ok('G3 todo par referencia películas del conjunto y es coherente con los niveles', cal.pares.every((p) => claves.has(p.mayor) && claves.has(p.menor) && (p.fuerza === 'debil' ? niv[p.mayor] >= niv[p.menor] : niv[p.mayor] > niv[p.menor])));
  const nid = new Set(notas.notas.map((_, i) => G.idNota(i)));
  ok('G4 cada película cita notas existentes en notas.json', cal.peliculas.every((p) => p.notas.length && p.notas.every((x) => nid.has(x))));
  const ent = P.entregasDir();
  ok('G5 los mp4 existen en out/entregas (se omite si esa carpeta no está en este checkout)', !fs.existsSync(ent) || cal.peliculas.every((p) => fs.existsSync(path.join(ent, p.mp4))), fs.existsSync(ent) ? ent : 'sin out/entregas: omitido');
  const a = P.anonimizar([...claves], cal.semilla), b = P.anonimizar([...claves], cal.semilla);
  ok('G6 la anonimización es una biyección letra→película, determinista y baraja el orden', JSON.stringify(a) === JSON.stringify(b) && new Set(Object.values(a)).size === claves.size && Object.keys(a).every((k) => /^[A-Z]\d?$/.test(k)) && JSON.stringify(Object.values(a)) !== JSON.stringify([...claves]));
}

{
  const claves = cal.peliculas.map((p) => p.clave), m1 = P.anonimizar(claves, cal.semillas.calibracion), m2 = P.anonimizar(claves, cal.semillas.calibracion2);
  ok('G7 el lote 2 usa otra semilla y un mapa NUEVO: ninguna letra apunta a la misma película que en el lote 1', cal.semillas.calibracion2 !== cal.semillas.calibracion && Object.keys(m1).every((k) => m1[k] !== m2[k]) && new Set(Object.values(m2)).size === claves.length && P.LOTE === 'calibracion2');
  const h = P.hermanos('/x/out/panel/calibracion2');
  ok('G8 los archivos hermanos del lote cuelgan de su nombre (mapa, veredictos, resultado): el lote 1 no se pisa', h.mapa.endsWith('calibracion2-mapa.json') && h.veredictos.endsWith('calibracion2-veredictos') && h.resultado.endsWith('calibracion2-resultado.json') && P.hermanos('/x/calibracion').mapa.endsWith('calibracion-mapa.json'));
}

{
  const vacio = P.profundidad({ esp: 2, tex: 0.3, temporal: 1, luces: 0, oscuros_pct: 100 }), estrellas = P.profundidad({ esp: 12, tex: 1.2, temporal: 8.5, luces: 1.4, oscuros_pct: 100 }), claro = P.profundidad({ esp: 18, tex: 3, temporal: 6, luces: 0, oscuros_pct: 0 });
  ok('H0a profundidad: un negro vacío sale «baja», un oscuro con estrellas y movimiento «media/alta», y un fondo claro «n/a» (no se mide como defecto)', vacio.nivel === 'baja' && ['media', 'alta'].includes(estrellas.nivel) && /^n\/a/.test(claro.nivel));
  const serie = { fps: 4, dif: Array.from({ length: 79 }, (_, i) => (i >= 38 && i <= 40 ? 20 : 1 + (i % 7) * 0.1) + (i === 12 || i === 72 ? 15 : 0)), luma: Array.from({ length: 80 }, (_, i) => (i < 56 ? 40 : 160)) };
  const mt = P.momentosTiras(serie, 20, 6);
  ok('H0b momentosTiras: 6 instantes ordenados y separados, uno es el giro (cambio de luminancia hacia el 40–90 %) y el resto son picos de actividad', mt.length === 6 && mt.every((m, i) => i === 0 || m.t > mt[i - 1].t) && mt.filter((m) => m.tipo === 'giro').length === 1 && Math.abs(mt.find((m) => m.tipo === 'giro').t - 14) <= 1 && mt.some((m) => Math.abs(m.t - 3) <= 0.5) && mt.some((m) => Math.abs(m.t - 18.25) <= 0.5), mt.map((m) => `${m.tipo[0]}${m.t.toFixed(1)}`).join(' '));
}

// ── G-H. paquete anónimo con un mp4 sintético ──
{
  const mp4 = path.join(tmp, 'secreto_pelicula_xyz.mp4'), out = path.join(tmp, 'paquete');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=15:duration=4', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=4', '-shortest', '-pix_fmt', 'yuv420p', '-metadata', 'title=secreto_pelicula_xyz', mp4]);
  const r = await P.preparar(mp4, out, { nombre: 'Q' });
  const ls = (d) => fs.readdirSync(path.join(out, d)), fr = ls('frames'), rc = ls('recortes');
  const tr = ls('tiras');
  ok('H1 preparar extrae 12 fotogramas, la hoja de contacto, 6 recortes y 6 tiras de movimiento', fr.length === 12 && rc.length === 6 && tr.length === 6 && fs.existsSync(path.join(out, 'hoja.jpg')) && fs.statSync(path.join(out, 'hoja.jpg')).size > 2000, `${fr.length} + ${rc.length} + ${tr.length}`);
  { const { loadImage } = (await import('canvas')).default, a = await loadImage(path.join(out, 'recortes/r1.png')), f = await loadImage(path.join(out, 'frames/f01.jpg'));
    ok('H2 cada recorte es una zona de 1/4×1/4 del cuadro ampliada 4× (mismo tamaño que el fotograma)', a.width === f.width && a.height === f.height, `${a.width}×${a.height}`); }
  ok('H3 mide el audio con ebur128 (LUFS, LRA, true peak) y el % de fondo oscuro/plano y de fondo plano', r.audio && Number.isFinite(r.audio.I) && Number.isFinite(r.audio.LRA) && Number.isFinite(r.audio.TP) && r.vis.oscuro_plano_pct >= 0 && r.vis.plano_pct >= 0 && r.vis.muestras > 5, JSON.stringify(r.audio) + ' ' + r.vis.oscuro_plano_pct + '%');
  const pq = fs.readFileSync(path.join(out, 'paquete.md'), 'utf8'), po = fs.readFileSync(path.join(out, 'paquete.ojo.md'), 'utf8');
  ok('H4 paquete.md trae mediciones, reglas con origen y la rúbrica de las 3 miradas con su JSON', /LUFS/.test(pq) && /Fondo oscuro\/plano/.test(pq) && !/Fotogramas vacíos/.test(pq) && /\*\*C01\*\*/.test(pq) && /_Origen:/.test(pq) && ['historia', 'composicion', 'no_clipart'].every((c) => pq.includes(`"${c}"`)));
  ok('H5 paquete.<mirada>.md solo lleva las reglas y la rúbrica de su mirada', /"composicion"/.test(po) && !/"historia"/.test(po) && /\*\*C01\*\*/.test(po) && !/\*\*H01\*\*/.test(po));
  const txt = []; const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(md|json)$/.test(f)) txt.push(fs.readFileSync(p, 'utf8')); } }; walk(out);
  ok('H6 anonimato: ningún archivo del paquete contiene el nombre ni la ruta del mp4, ni notas humanas', txt.length >= 5 && txt.every((t) => !/secreto_pelicula|opus-gusto|\.mp4|notas humanas previas/i.test(t)) && /película Q/.test(pq));
  {
  const med = JSON.parse(fs.readFileSync(path.join(out, 'medidas.json'), 'utf8')), pd = fs.readFileSync(path.join(out, 'paquete.director.md'), 'utf8');
  ok('H10 «vacío» reetiquetado como «fondo oscuro/plano (%)», con la aclaración de que no es un defecto, y con la profundidad medida al lado (espacial, textura, temporal, puntos de luz)', /Fondo oscuro\/plano/.test(pq) && /NO es un defecto/.test(pq) && /Profundidad medida/.test(pq) && /varianza espacial/.test(pq) && /varianza temporal/.test(pq) && ['espacial', 'textura', 'temporal', 'puntos_luz_pct', 'nivel'].every((k) => k in med.vis.profundidad), JSON.stringify(med.vis.profundidad));
  ok('H11 el paquete describe las 6 tiras (8 fotogramas a 5 fps, con tiempo y Δ) y la tira del giro; medidas.json las lista', /tiras\/t6\.jpg/.test(pq) && /8 fotogramas CONSECUTIVOS a 5 fps/.test(pq) && /EL GIRO/.test(pq) && med.tiras.length === 6 && med.tiras.every((t) => t.deltas.length === 7 && t.hasta > t.desde) && med.tiras.filter((t) => t.tipo === 'giro').length === 1);
  ok('H12 descriptor de audio legible: curva ASCII por tramos, golpes, silencios y presencia de cama/música', /Descriptor de audio/.test(pd) && /█/.test(pd) && /Golpes o ataques detectados/.test(pd) && /Silencios/.test(pd) && /Música o cama sostenida/.test(pd) && med.perfil_audio.curva.length >= 8 && Array.isArray(med.perfil_audio.golpes));
  ok('H13 el paquete exige lectura: ≥ 7 vistos (4 recortes y 3 tiras) y explica el campo «vistos» en el formato de respuesta', /«vistos»|`vistos`/.test(pd) && /mínimo 7/.test(pd) && /"vistos":\[/.test(pd) && /Un veredicto con menos se rechaza/.test(pd));
}
const idxNotas = fs.readFileSync(path.join(out, 'paquete.md'), 'utf8').includes('Notas humanas previas');
  const out2 = path.join(tmp, 'paquete2'); await P.preparar(mp4, out2);
  const pq2 = fs.readFileSync(path.join(out2, 'paquete.md'), 'utf8');
  ok('H7 sin --nombre el paquete es nominal y SÍ lleva las notas humanas previas (G5: el panel siguiente las aplica)', !idxNotas && /Notas humanas previas/.test(pq2) && /secreto_pelicula_xyz/.test(pq2));
  const dirCal = path.join(tmp, 'cal2'); fs.mkdirSync(path.join(dirCal, 'A'), { recursive: true }); fs.mkdirSync(path.join(dirCal, 'B'));
  const pr = P.prompt('ojo', { calibracion: true, dir: dirCal, salida: path.join(tmp, 'ojo.json') }), pu = P.prompt('director', { paquete: out });
  ok('H8 los prompts salen autocontenidos: sin huecos {{}}, con rutas, enfoque, rúbrica y formato; la calibración no menciona nombres reales', !/\{\{/.test(pr + pu) && pr.includes(dirCal) && /OJO|«ojo»/.test(pr) && pr.includes('"composicion"') && /A, B/.test(pr) && /vistos/.test(pr) && /tiras/.test(pr) && !cal.peliculas.filter((p) => p.clave.includes("_")).some((p) => pr.includes(p.clave)) && !/botella|potencias/i.test(pr) && pu.includes(path.join(out, 'paquete.director.md')) && /DIRECTOR/.test(pu));
  const d2 = path.join(tmp, 'pp', 'calibracion2'); fs.mkdirSync(path.join(d2, 'A'), { recursive: true });
  ok('H8b `prompt --calibracion` sin --dir apunta al lote por defecto (calibracion2): su carpeta de veredictos es calibracion2-veredictos', P.LOTE === 'calibracion2' && P.prompt('director', { calibracion: true, dir: d2 }).includes(path.join(tmp, 'pp', 'calibracion2-veredictos', 'director.json')));
  const lote = path.join(tmp, 'lote.json'); fs.writeFileSync(lote, JSON.stringify([{ paquete: 'A', ...buen }, { paquete: 'B', ...buen }, { paquete: 'Z', ...buen }, { paquete: 'A', ...buen, total: 2 }]));
  const rl = P.registrarLote(dirCal, lote, rubrica);
  ok('H9 registrar-lote registra los válidos y lista los rechazados (paquete inexistente, total incoherente)', rl.ok.length === 2 && rl.mal.length === 2 && fs.existsSync(path.join(dirCal, 'B/veredictos/director.json')));
}

// ── G-F. filtro de mínimos (sin LLM) y lámina A/B (F1) ──
{
  const sh = (a) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a]);
  const mk = (nombre, vid, vol) => { const f = path.join(tmp, nombre); sh(['-f', 'lavfi', '-i', `${vid}${vid.includes('=') ? ':' : '='}size=320x180:rate=15:duration=4`, ...(vol == null ? [] : ['-f', 'lavfi', '-i', 'sine=frequency=1000:duration=4', '-af', vol]), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', ...(vol == null ? [] : ['-c:a', 'aac']), f]); return f; };
  const bueno = mk('f_bueno.mp4', 'testsrc2', 'volume=7.8dB'), negro = mk('f_negro.mp4', 'color=c=black', 'volume=7.8dB'), fuerte = mk('f_fuerte.mp4', 'testsrc2', 'volume=24dB,alimiter=limit=1:level=0'), mudo = mk('f_mudo.mp4', 'testsrc2', null);
  const id = (r, k) => r.checks.find((c) => c.id === k)?.estado;
  const rb = P.filtro(bueno), rn = P.filtro(negro), rf = P.filtro(fuerte), rm = P.filtro(mudo);
  ok('F1 filtro: un mp4 con textura y audio a −13 LUFS / TP < −1 PASA (texto y determinismo quedan N/A sin --codigo)', rb.estado === 'PASA' && id(rb, 'fondo') === 'OK' && id(rb, 'audio') === 'OK' && id(rb, 'texto') === 'N/A', JSON.stringify(rb.checks.map((c) => c.id + ':' + c.estado)));
  ok('F2 filtro: fondo negro plano (profundidad baja) FALLA con motivo «fondo»', rn.estado === 'FALLA' && id(rn, 'fondo') === 'FALLA' && id(rn, 'audio') === 'OK' && rn.motivos.some((m) => /^fondo:/.test(m)), rn.motivos.join('|'));
  ok('F3 filtro: audio con true peak > −1 y fuera de rango de LUFS FALLA con motivo «audio»', rf.estado === 'FALLA' && id(rf, 'audio') === 'FALLA' && /true peak/.test(rf.motivos[0]) && /LUFS/.test(rf.motivos[0]), rf.motivos.join('|'));
  ok('F4 filtro: un mp4 sin pista de audio FALLA («sin pista»)', rm.estado === 'FALLA' && /sin pista|no tiene pista/.test(rm.motivos.join()), rm.motivos.join('|'));

  const bajo = mk('f_bajo.mp4', 'testsrc2', 'volume=2.4dB'), rbj = P.filtro(bajo);
  ok('F4b filtro de MÍNIMOS: sonoridad −18,7 LUFS (como Botella libre) PASA; el rango admitido es −20…−13 LUFS', rbj.estado === 'PASA' && P.AUDIO_I[0] === -20 && P.AUDIO_I[1] === -13, JSON.stringify(rbj.medidas.audio));

  // con código: auditoría del kit-libre (texto y determinismo)
  const proy = (nombre, { random = false, texto = false } = {}) => {
    const d = path.join(tmp, nombre); fs.mkdirSync(d, { recursive: true });
    const suj = '{ x: 40, y: 20, w: 400, h: 230 }';
    fs.writeFileSync(path.join(d, 'timeline.js'), `export const escenas = [{ id: 'a', t0: 0, dur: 3, sujeto: ${suj} }, { id: 'b', t0: 3, dur: 5, sujeto: ${suj} }];\n`);
    fs.writeFileSync(path.join(d, 'frame.js'), `export const W = 480, H = 270;
export function frame(ctx, t) { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#d8c8a0'); g.addColorStop(1, '#406050'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#802020'; ctx.fillRect(${random ? '100 + Math.random() * 50' : '100 + t * 10'}, 80, 120, 90); ctx.fillStyle = '#fff'; for (let i = 0; i < 20; i++) ctx.fillRect(i * 20, (i * 37) % 270, 6, 6); }
${texto ? "export const cajas = () => ({ texto: [{ id: 'titulo', x: 400, y: 10, w: 300, h: 60, tam: 40, contenedor: { x: 0, y: 0, w: 480, h: 270 } }], objetos: [] });" : ''}
`);
    return d;
  };
  const cb = P.filtro(bueno, { codigo: proy('p_bueno') }), cr = P.filtro(bueno, { codigo: proy('p_random', { random: true }) }), ct = P.filtro(bueno, { codigo: proy('p_texto', { texto: true }) });
  ok('F5 filtro --codigo: proyecto limpio PASA con texto y determinismo OK', cb.estado === 'PASA' && id(cb, 'texto') === 'OK' && id(cb, 'determinismo') === 'OK', cb.motivos.join('|'));
  ok('F6 filtro --codigo: render no determinista FALLA con motivo «determinismo»', cr.estado === 'FALLA' && id(cr, 'determinismo') === 'FALLA', cr.motivos.join('|'));
  ok('F7 filtro --codigo: texto fuera del cuadro FALLA con motivo «texto»', ct.estado === 'FALLA' && id(ct, 'texto') === 'FALLA', ct.motivos.join('|'));
  ok('F8 filtro --codigo: un proyecto ilegible FALLA («auditoria») en lugar de pasar en falso', P.filtro(bueno, { codigo: path.join(tmp, 'no_existe') }).checks.some((c) => c.id === 'auditoria' && c.estado === 'FALLA'));

  // --entrega: veto de repetición contra data/entregas.json (rasgos de plan.md)
  const reg = path.join(tmp, 'entregas.json'), plan = (t) => { const f = path.join(tmp, 'plan_' + Math.random().toString(36).slice(2) + '.md'); fs.writeFileSync(f, t); return f; };
  const R = (film, paleta, medio, tipografia, sonido, estructura) => ({ film, paleta, medio, tipografia, sonido, estructura });
  fs.writeFileSync(reg, JSON.stringify({ entregas: [R('viejo', 'rojo', 'collage', 'grotesca', 'jazz', 'cuenta atrás'), R('b1', 'crema sepia + verde submarino', 'papel y acuarela', 'serif de libro centrada', 'agua y piano', 'objeto ancla'), R('b2', 'crema + verde submarino + turquesa', 'papel', 'serif centrada + mono', 'foley + piano', 'objeto ancla con giro'), R('b3', 'crema + verde submarino', 'papel', 'serif centrada', 'foley + piano + pad', 'objeto ancla con giro')] }));
  const nuevo = plan('# Plan\n- **paleta:** verde neón + magenta sobre ladrillo\n- **medio:** neón y luz sobre negro\n- **tipografía:** tubo de neón monoespaciado\n- **sonido:** zumbido eléctrico y sintetizador\n- **estructura:** cuenta atrás con remate mudo\n');
  const igual = plan('# Plan\npaleta: crema sepia con verde submarino\nmedio: papel y acuarela\ntipografía: serif de libro\nsonido: bajo continuo\nestructura: cuenta atrás con remate\n');
  const una = plan('# Plan\npaleta: azul cianotipia\nmedio: papel\ntipografía: manuscrita\nsonido: lluvia\nestructura: lista de pasos\n');
  const parcial = plan('# Plan\npaleta: azul\nmedio: tiza\n');
  const rn1 = P.filtro(null, { plan: nuevo, registro: reg }), ri = P.filtro(null, { plan: igual, registro: reg }), ru = P.filtro(null, { plan: una, registro: reg }), rp = P.filtro(null, { plan: parcial, registro: reg });
  ok('F9 --entrega: un plan con rasgos nuevos PASA; solo comparte 1 de 5 con una de las 3 últimas (el viejo fuera de las 3 no cuenta)', rn1.estado === 'PASA' && ru.estado === 'PASA', rn1.motivos.concat(ru.motivos).join('|'));
  ok('F10 --entrega: repetir ≥ 2 de 5 rasgos de una de las 3 últimas FALLA y nombra la entrega y los rasgos', ri.estado === 'FALLA' && /b1/.test(ri.motivos[0]) && /paleta/.test(ri.motivos[0]) && /medio/.test(ri.motivos[0]), ri.motivos.join('|'));
  ok('F11 --entrega: un plan que no declara los 5 rasgos FALLA (pliego de sorpresa); rasgosDePlan lee negritas y tildes', rp.estado === 'FALLA' && /tipografia/.test(rp.motivos[0]) && Object.keys(P.rasgosDePlan('- **tipografía:** x y\n')).join() === 'tipografia');
  ok('F12 --entrega combinado con mp4: suma ambos grupos de comprobaciones', P.filtro(bueno, { plan: nuevo, registro: reg }).checks.map((c) => c.id).filter((i) => i !== 'dinamica').join() === 'fondo,audio,texto,determinismo,repeticion');
  ok('F13 filtro sin mp4 ni plan es un error de uso; el registro real data/entregas.json es válido para el veto', (() => { try { P.filtro(null, {}); return false; } catch { return true; } })() && P.filtro(null, { plan: nuevo }).estado === 'PASA');

  // CLI: código de salida 0 / 3
  const cli = (a) => { try { execFileSync('node', [path.join(ROOT, 'engine/panel.mjs'), ...a], { stdio: 'pipe' }); return 0; } catch (e) { return e.status; } };
  ok('F14 CLI `panel.mjs filtro`: sale 0 si PASA y 3 si FALLA', cli(['filtro', bueno]) === 0 && cli(['filtro', negro]) === 3);

  // ab: lámina comparativa
  const lam = path.join(tmp, 'lam', 'ab.jpg'), r = await P.ab(bueno, negro, lam);
  const { loadImage } = (await import('canvas')).default, im = await loadImage(lam);
  ok('F15 ab genera una lámina JPG A|B (dos columnas: hoja 4×3 y tira de 8 fotogramas del momento clave), sin LLM', fs.existsSync(lam) && im.width === r.w && im.height === r.h && r.w >= 1900 && r.h >= 500 && r.claves.length === 2 && r.durs.every((d) => d > 3), `${im.width}×${im.height}`);
  ok('F16 CLI `panel.mjs ab` escribe la lámina con --out y sale 0; falta un mp4 → error', cli(['ab', bueno, negro, '--out', path.join(tmp, 'lam', 'cli.jpg')]) === 0 && fs.existsSync(path.join(tmp, 'lam', 'cli.jpg')) && cli(['ab', bueno, path.join(tmp, 'nada.mp4')]) === 1);
}

rmrf(tmp);
console.log(`\n${n - bad}/${n} gusto en verde`);
process.exit(bad ? 1 : 0);
