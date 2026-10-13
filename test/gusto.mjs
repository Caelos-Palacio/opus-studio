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
  const reglas = G.parseReglas(md), manual = reglas.filter((r) => !/^8\./.test(r.grupo));
  ok('A1 hay reglas en los 6 grupos (historia/voz, ritmo, composición/materia, color/tipografía, sonido, anti-patrones)', [/^1\./, /^2\./, /^3\./, /^4\./, /^5\./, /^6\./].every((p) => manual.filter((r) => p.test(r.grupo)).length >= 3), reglas.length + ' reglas');
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

// ── G-B. rúbrica ──
{
  const esp = { director: ['historia', 'voz', 'ritmo'], ojo: ['composicion', 'materia', 'color', 'tipografia'], esceptico: ['no_generico', 'no_clipart', 'no_corporativo'] };
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
const buen = { mirada: 'director', puntos: { historia: 7, voz: 6, ritmo: 8 }, total: 7, arreglos: ['acortar el tramo f03–f05', 'añadir un respiro de 4 s antes del giro', 'cambiar el cierre por una imagen'] };
const val = (v, m) => P.validarVeredicto(v, rubrica, m);
{
  ok('D1 un veredicto correcto valida', val(buen).ok, val(buen).errores.join('|'));
  ok('D2 acepta «escéptico» con tilde', val({ mirada: 'escéptico', puntos: { no_generico: 4, no_clipart: 5, no_corporativo: 3 }, total: 4, arreglos: buen.arreglos }).ok);
  ok('D3 rechaza mirada inválida', !val({ ...buen, mirada: 'crítico' }).ok);
  ok('D4 rechaza criterio que falta o que sobra', !val({ ...buen, puntos: { historia: 7, voz: 6 } }).ok && !val({ ...buen, puntos: { ...buen.puntos, extra: 5 } }).ok);
  ok('D5 rechaza puntos fuera de 0–10 o no numéricos', !val({ ...buen, puntos: { historia: 11, voz: 6, ritmo: 8 } }).ok && !val({ ...buen, puntos: { historia: -1, voz: 6, ritmo: 8 } }).ok && !val({ ...buen, puntos: { historia: '7', voz: 6, ritmo: 8 } }).ok);
  ok('D6 rechaza un total que no es la media de los puntos (±0,25)', !val({ ...buen, total: 9 }).ok && val({ ...buen, total: 7.2 }).ok);
  ok('D7 exige exactamente 3 arreglos concretos', !val({ ...buen, arreglos: ['uno', 'dos'] }).ok && !val({ ...buen, arreglos: [...buen.arreglos, 'cuatro arreglos de más'] }).ok && !val({ ...buen, arreglos: ['a', 'b', 'c'] }).ok);
  ok('D8 rechaza lo que no es un objeto', !val(null).ok && !val([1]).ok && !val('x').ok);
  const dir = path.join(tmp, 'reg'); fs.mkdirSync(dir);
  const v = P.registrar(dir, 'director', JSON.stringify(buen), rubrica);
  ok('D9 registrar valida, normaliza y guarda veredictos/director.json', v.mirada === 'director' && JSON.parse(fs.readFileSync(path.join(dir, 'veredictos/director.json'), 'utf8')).total === 7);
  let msg = ''; try { P.registrar(dir, 'ojo', JSON.stringify(buen), rubrica); } catch (e) { msg = e.message; }
  ok('D10 registrar rechaza si la mirada del JSON no coincide con la pedida; y JSON ilegible', /no coincide/.test(msg) && (() => { try { P.registrar(dir, 'ojo', '{no es json', rubrica); } catch (e) { return /ilegible/.test(e.message); } })());
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
  const mk = (m, puntos, total) => P.registrar(dir, m, { mirada: m, puntos, total, arreglos: ['arreglo concreto uno', 'arreglo concreto dos', 'arreglo concreto tres'] }, rubrica);
  mk('director', { historia: 9, voz: 8, ritmo: 8 }, 8.3); mk('ojo', { composicion: 8, materia: 9, color: 8, tipografia: 8 }, 8.3); mk('escéptico', { no_generico: 8, no_clipart: 8, no_corporativo: 8 }, 8);
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
  const puntua = (puntos) => { for (const [l, c2] of Object.entries(map)) { const t = puntos[c2]; for (const m of G.MIRADAS) { const pu = Object.fromEntries(Object.keys(rubrica[m]).map((k) => [k, t])); fs.mkdirSync(path.join(dir, l), { recursive: true }); P.registrar(path.join(dir, l), m, { mirada: m, puntos: pu, total: t, arreglos: ['arreglo concreto uno', 'arreglo concreto dos', 'arreglo concreto tres'] }, rubrica); } } };
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

// ── G-H. paquete anónimo con un mp4 sintético ──
{
  const mp4 = path.join(tmp, 'secreto_pelicula_xyz.mp4'), out = path.join(tmp, 'paquete');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=15:duration=4', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=4', '-shortest', '-pix_fmt', 'yuv420p', '-metadata', 'title=secreto_pelicula_xyz', mp4]);
  const r = await P.preparar(mp4, out, { nombre: 'Q' });
  const ls = (d) => fs.readdirSync(path.join(out, d)), fr = ls('frames'), rc = ls('recortes');
  ok('H1 preparar extrae 12 fotogramas, la hoja de contacto y 6 recortes', fr.length === 12 && rc.length === 6 && fs.existsSync(path.join(out, 'hoja.jpg')) && fs.statSync(path.join(out, 'hoja.jpg')).size > 2000, `${fr.length} + ${rc.length}`);
  { const { loadImage } = (await import('canvas')).default, a = await loadImage(path.join(out, 'recortes/r1.png')), f = await loadImage(path.join(out, 'frames/f01.jpg'));
    ok('H2 cada recorte es una zona de 1/4×1/4 del cuadro ampliada 4× (mismo tamaño que el fotograma)', a.width === f.width && a.height === f.height, `${a.width}×${a.height}`); }
  ok('H3 mide el audio con ebur128 (LUFS, LRA, true peak) y los % de vacíos y de fondo plano', r.audio && Number.isFinite(r.audio.I) && Number.isFinite(r.audio.LRA) && Number.isFinite(r.audio.TP) && r.vis.vacios_pct >= 0 && r.vis.plano_pct >= 0 && r.vis.muestras > 5, JSON.stringify(r.audio) + ' ' + r.vis.vacios_pct + '%');
  const pq = fs.readFileSync(path.join(out, 'paquete.md'), 'utf8'), po = fs.readFileSync(path.join(out, 'paquete.ojo.md'), 'utf8');
  ok('H4 paquete.md trae mediciones, reglas con origen y la rúbrica de las 3 miradas con su JSON', /LUFS/.test(pq) && /Fotogramas vacíos/.test(pq) && /\*\*C01\*\*/.test(pq) && /_Origen:/.test(pq) && ['historia', 'composicion', 'no_clipart'].every((c) => pq.includes(`"${c}"`)));
  ok('H5 paquete.<mirada>.md solo lleva las reglas y la rúbrica de su mirada', /"composicion"/.test(po) && !/"historia"/.test(po) && /\*\*C01\*\*/.test(po) && !/\*\*H01\*\*/.test(po));
  const txt = []; const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(md|json)$/.test(f)) txt.push(fs.readFileSync(p, 'utf8')); } }; walk(out);
  ok('H6 anonimato: ningún archivo del paquete contiene el nombre ni la ruta del mp4, ni notas humanas', txt.length >= 5 && txt.every((t) => !/secreto_pelicula|opus-gusto|\.mp4|notas humanas previas/i.test(t)) && /película Q/.test(pq));
  const idxNotas = fs.readFileSync(path.join(out, 'paquete.md'), 'utf8').includes('Notas humanas previas');
  const out2 = path.join(tmp, 'paquete2'); await P.preparar(mp4, out2);
  const pq2 = fs.readFileSync(path.join(out2, 'paquete.md'), 'utf8');
  ok('H7 sin --nombre el paquete es nominal y SÍ lleva las notas humanas previas (G5: el panel siguiente las aplica)', !idxNotas && /Notas humanas previas/.test(pq2) && /secreto_pelicula_xyz/.test(pq2));
  const dirCal = path.join(tmp, 'cal2'); fs.mkdirSync(path.join(dirCal, 'A'), { recursive: true }); fs.mkdirSync(path.join(dirCal, 'B'));
  const pr = P.prompt('ojo', { calibracion: true, dir: dirCal, salida: path.join(tmp, 'ojo.json') }), pu = P.prompt('director', { paquete: out });
  ok('H8 los prompts salen autocontenidos: sin huecos {{}}, con rutas, enfoque, rúbrica y formato; la calibración no menciona nombres reales', !/\{\{/.test(pr + pu) && pr.includes(dirCal) && /OJO|«ojo»/.test(pr) && pr.includes('"composicion"') && /A, B/.test(pr) && !cal.peliculas.filter((p) => p.clave.includes("_")).some((p) => pr.includes(p.clave)) && !/botella|potencias/i.test(pr) && pu.includes(path.join(out, 'paquete.director.md')) && /DIRECTOR/.test(pu));
  const lote = path.join(tmp, 'lote.json'); fs.writeFileSync(lote, JSON.stringify([{ paquete: 'A', ...buen }, { paquete: 'B', ...buen }, { paquete: 'Z', ...buen }, { paquete: 'A', ...buen, total: 2 }]));
  const rl = P.registrarLote(dirCal, lote, rubrica);
  ok('H9 registrar-lote registra los válidos y lista los rechazados (paquete inexistente, total incoherente)', rl.ok.length === 2 && rl.mal.length === 2 && fs.existsSync(path.join(dirCal, 'B/veredictos/director.json')));
}

rmrf(tmp);
console.log(`\n${n - bad}/${n} gusto en verde`);
process.exit(bad ? 1 : 0);
