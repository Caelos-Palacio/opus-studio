#!/usr/bin/env node
// Estudio v6 (spec 022, F2): tubería engine/v6.mjs. Sin render de vídeo: transiciones de fase, aprobar, entregar sin PASA, veto con registro temporal, stills del storyboard.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './lib.mjs';

let n = 0, bad = 0;
const ok = (m, c, info = '') => { n++; console.log(`${c ? '✓' : '✗'} v6: ${m}${info ? '  ' + info : ''}`); if (!c) bad++; };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opus-v6-')), reg = path.join(tmp, 'entregas.json'), out = path.join(tmp, 'entregas');
const env = { ...process.env, V6_REGISTRO: reg, V6_OUT: out };
const v6 = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'engine/v6.mjs'), ...a], { encoding: 'utf8', cwd: ROOT, env });
const R = { paleta: 'verde esmeralda', medio: 'tiza', tipografia: 'manuscrita', sonido: 'tambor', estructura: 'espiral' };
fs.writeFileSync(reg, JSON.stringify({ entregas: [{ film: 'previa', fecha: '2026-01-01', ...R }, { film: 'previa2', fecha: '2026-01-02', paleta: 'rojo', medio: 'carbon', tipografia: 'gotica', sonido: 'cuerdas', estructura: 'lineal' }] }));
const planCon = (r) => `# plan\n${Object.entries(r).map(([k, v]) => `- **${k}:** ${v}`).join('\n')}\nmomento memorable: 10 s\n\n| escena | inicio | dur | objeto | movimiento | color | transicion | sonido | texto |\n|---|---|---|---|---|---|---|---|---|\n| sobre | 0 | 5 | sobre | cae | #112233 | tinta | papel | Hola |\n| mapa | 5 | 7.5 | mapa | ruta | #445566 | agua | gota | Mapa |\n| mar | 12.5 | 12 | botella | flota | #778899 | | golpe | Fin |\n`;
const lee = (id) => JSON.parse(fs.readFileSync(path.join(ROOT, 'kit-libre/films', id, 'estado.json'), 'utf8'));
const ids = [];
const film = (sufijo) => { const id = `test_v6_${process.pid}_${sufijo}`; ids.push(id); return id; };
try {
  // nuevo: carpeta, encargo con las últimas entregas, estado
  const a = film('a'), r0 = v6('nuevo', a, '--tema', 'faros', '--revision', 'consultar'), da = path.join(ROOT, 'kit-libre/films', a);
  ok('nuevo crea la carpeta desde la plantilla', r0.status === 0 && ['frame.js', 'timeline.js', 'encargo.md', 'plan.md', 'estado.json'].every((f) => fs.existsSync(path.join(da, f))), r0.stderr.trim());
  ok('nuevo reescribe los imports a ../../kit/', !/'\.\.\/kit\//.test(fs.readFileSync(path.join(da, 'frame.js'), 'utf8')) && /'\.\.\/\.\.\/kit\//.test(fs.readFileSync(path.join(da, 'frame.js'), 'utf8')));
  const enc = fs.readFileSync(path.join(da, 'encargo.md'), 'utf8');
  ok('encargo: MODO-LIBRE, README del kit, tema, aislamiento y las entregas del registro', /MODO-LIBRE\.md/.test(enc) && /kit-libre\/README\.md/.test(enc) && /faros/.test(enc) && /Aislamiento/.test(enc) && /previa2/.test(enc) && /previa\b/.test(enc));
  let e = lee(a); ok('estado inicial {fase, revision, historial}', e.fase === 'plan' && e.revision === 'consultar' && Array.isArray(e.historial) && e.historial.length === 1);
  ok('nuevo rechaza un id repetido y una revisión inválida', v6('nuevo', a, '--tema', 'x').status !== 0 && v6('nuevo', film('b'), '--tema', 'x', '--revision', 'raro').status !== 0);
  // fases ilegales
  ok('consultar antes del storyboard falla', v6('consultar', a).status !== 0);
  ok('aprobar antes de consultar falla', v6('aprobar', a).status !== 0);
  ok('producir antes de aprobar falla', v6('producir', a, '--preview').status !== 0);
  // storyboard con veto: plan que repite 2+ rasgos de «previa» → FALLA; N stills = escenas + memorable
  fs.writeFileSync(path.join(da, 'plan.md'), planCon({ ...R, estructura: 'otra cosa distinta' }));
  const s1 = v6('storyboard', a); e = lee(a);
  ok('el veto usa el registro temporal (repite 4 de 5 → filtro FALLA)', s1.status === 0 && e.storyboard?.filtro === 'FALLA' && /FALLA/.test(s1.stdout) && /previa/.test(s1.stdout), s1.stderr.trim());
  const imgs = fs.readdirSync(path.join(da, 'storyboard')).filter((f) => f.endsWith('.png'));
  ok('storyboard: 3 escenas + 1 momento memorable = 4 stills (png) y 4 imágenes en el html', imgs.length === 4 && e.storyboard.n_stills === 4 && (fs.readFileSync(path.join(da, 'storyboard.html'), 'utf8').match(/<img /g) ?? []).length === 4 && fs.existsSync(path.join(da, 'storyboard.jpg')), `${imgs.length} png`);
  ok('storyboard en `consultar` no avanza solo', e.fase === 'storyboard_listo');
  fs.writeFileSync(path.join(da, 'plan.md'), planCon({ paleta: 'cobalto y naranja', medio: 'cianotipia', tipografia: 'grotesca', sonido: 'viento', estructura: 'tres actos' }));
  const s2 = v6('storyboard', a); e = lee(a);
  ok('con rasgos distintos el filtro PASA', e.storyboard.filtro === 'PASA', s2.stderr.trim());
  const html = fs.readFileSync(path.join(da, 'storyboard.html'), 'utf8');
  ok('el html trae texto, paleta, movimiento, transición y sonido de plan.md', /Hola/.test(html) && /#112233/.test(html) && /cae/.test(html) && /tinta/.test(html) && /papel/.test(html) && /momento memorable/.test(html));
  // consultar / aprobar
  ok('consultar → esperando_usuario y pide plazo', v6('consultar', a, '--espera', '0.0001').status === 0 && lee(a).fase === 'esperando_usuario' && lee(a).espera_h === 0.0001);
  await new Promise((r) => setTimeout(r, 500));
  ok('estado señala el plazo vencido para reanudar en autónomo', /AVISO: plazo/.test(v6('estado', a).stdout));
  const ap = v6('aprobar', a, '--cambios', 'Beat 3: texto más corto'); e = lee(a);
  ok('aprobar registra los cambios en cambios.md y en el historial y pasa a producir', ap.status === 0 && e.fase === 'producir' && /Beat 3: texto más corto/.test(fs.readFileSync(path.join(da, 'cambios.md'), 'utf8')) && e.historial.some((h) => h.evento === 'aprobar' && h.cambios === 'Beat 3: texto más corto'));
  // entregar sin PASA
  const e1 = v6('entregar', a);
  ok('entregar sin verificación PASA falla y no toca el registro', e1.status !== 0 && /PASA/.test(e1.stderr) && JSON.parse(fs.readFileSync(reg, 'utf8')).entregas.length === 2 && !fs.existsSync(out));
  const e0 = lee(a); e0.fase = 'verificado'; e0.verificacion = { resultado: 'FALLA', motivos: ['x'], mp4: 'salida/final.mp4', completo: true }; fs.writeFileSync(path.join(da, 'estado.json'), JSON.stringify(e0));
  ok('entregar con verificación FALLA también falla', v6('entregar', a).status !== 0);
  e0.verificacion = { resultado: 'PASA', motivos: [], mp4: 'salida/clip.mp4', completo: false }; fs.writeFileSync(path.join(da, 'estado.json'), JSON.stringify(e0));
  ok('entregar un clip (no final) falla', v6('entregar', a).status !== 0);
  // entregar con PASA (mp4 ficticio) → registro temporal + out temporal
  fs.mkdirSync(path.join(da, 'salida'), { recursive: true }); fs.writeFileSync(path.join(da, 'salida/final.mp4'), 'mp4 ficticio'); fs.writeFileSync(path.join(da, 'salida/hoja.jpg'), 'jpg');
  e0.verificacion = { resultado: 'PASA', motivos: [], mp4: 'salida/final.mp4', completo: true }; fs.writeFileSync(path.join(da, 'estado.json'), JSON.stringify(e0));
  const e2 = v6('entregar', a), rg = JSON.parse(fs.readFileSync(reg, 'utf8')).entregas;
  ok('entregar con PASA copia mp4 y hoja y añade los 5 rasgos al registro (temporal)', e2.status === 0 && fs.existsSync(path.join(out, `${a}.mp4`)) && fs.existsSync(path.join(out, `${a}.jpg`)) && rg.length === 3 && rg[2].film === a && rg[2].paleta === 'cobalto y naranja' && rg[2].estructura === 'tres actos' && lee(a).fase === 'entregado', e2.stderr.trim());
  const real = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/entregas.json'), 'utf8')).entregas;
  ok('data/entregas.json real queda intacto', !real.some((x) => x.film === a));
  // modo autonomo: el filtro pasa → producir solo; falla → corregir_plan
  const b = film('c'); v6('nuevo', b, '--tema', 'x'); const db = path.join(ROOT, 'kit-libre/films', b);
  fs.writeFileSync(path.join(db, 'plan.md'), planCon({ ...R })); v6('storyboard', b);
  ok('autónomo con filtro FALLA → corregir_plan (ronda 1)', lee(b).fase === 'corregir_plan' && lee(b).rondas_plan === 1);
  fs.writeFileSync(path.join(db, 'plan.md'), planCon({ paleta: 'magenta neón', medio: 'luz sobre negro', tipografia: 'monoespaciada', sonido: 'sintetizador', estructura: 'cuenta atrás' })); v6('storyboard', b);
  ok('autónomo con filtro PASA → producir sin pausa', lee(b).fase === 'producir');
  ok('v6 estado muestra el siguiente paso', /siguiente: v6 producir/.test(v6('estado', b).stdout));
} finally { for (const id of ids) fs.rmSync(path.join(ROOT, 'kit-libre/films', id), { recursive: true, force: true }); fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(`\nv6: ${n - bad}/${n}`); process.exit(bad ? 1 : 0);
