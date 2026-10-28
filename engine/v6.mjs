#!/usr/bin/env node
// Estudio v6 (spec 022, ROADMAP §9 F2): tubería de un film libre. NO genera arte: lo hace un agente productor (Sonnet) que sigue
// docs/current/MODO-LIBRE.md. Este script prepara, mide, pausa, verifica y registra. Flujo: docs/current/V6.md.
//   node engine/v6.mjs nuevo <id> --tema "<texto>" [--historia f.md] [--revision autonomo|consultar|consultar_final]
//   node engine/v6.mjs storyboard <id>                       stills + storyboard.html/.jpg + filtro del plan
//   node engine/v6.mjs consultar <id> [--espera <h>]          pausa: fase esperando_usuario
//   node engine/v6.mjs aprobar <id> [--cambios "<t>"|--archivo f.md]
//   node engine/v6.mjs producir <id> [--preview|--clip t0 t1]
//   node engine/v6.mjs verificar <id>                         auditoría del kit + panel filtro → verificacion.md (PASA/FALLA)
//   node engine/v6.mjs entregar <id>                          exige PASA; copia a out/entregas y registra en data/entregas.json
//   node engine/v6.mjs estado [<id>]
// Entorno (tests): V6_REGISTRO (def. data/entregas.json), V6_OUT (def. out/entregas).
import './help.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FILMS = path.join(ROOT, 'kit-libre/films');
export const REVISIONES = ['autonomo', 'consultar', 'consultar_final'];
export const RASGOS = ['paleta', 'medio', 'tipografia', 'sonido', 'estructura'];
export const MAX_RONDAS = 2;
const registro = () => process.env.V6_REGISTRO || path.join(ROOT, 'data/entregas.json');
const salidaEntregas = () => process.env.V6_OUT || path.join(ROOT, 'out/entregas');
const err = (m) => { throw new Error(m); };
const sinTilde = (x) => String(x).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ahora = () => new Date().toISOString();

// ───────────── estado ─────────────
export const dirFilm = (id) => { if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id ?? '')) err(`id de film no válido: «${id}» (letras, números, _ y -)`); return path.join(FILMS, id); };
const rEstado = (id) => { const f = path.join(dirFilm(id), 'estado.json'); if (!fs.existsSync(f)) err(`no existe el film «${id}» (v6 nuevo ${id} --tema "…")`); return JSON.parse(fs.readFileSync(f, 'utf8')); };
const wEstado = (id, e) => fs.writeFileSync(path.join(dirFilm(id), 'estado.json'), JSON.stringify(e, null, 2) + '\n');
const nota = (e, evento, extra = {}) => e.historial.push({ t: ahora(), evento, fase: e.fase, ...extra });
export function mover(e, fase, evento, extra) { e.fase = fase; nota(e, evento, extra); return e; }
const exigeFase = (e, ok, cmd) => { if (!ok.includes(e.fase)) err(`${cmd}: la fase actual es «${e.fase}»; se necesita ${ok.map((f) => `«${f}»`).join(' o ')}. Mira: v6 estado ${e.id}`); };

// ───────────── plan.md ─────────────
const COLS = { id: /^(escena|id)\b/, t0: /inicio|^t0|^t$/, dur: /^dur/, objeto: /objeto|protagonista/, movimiento: /movim/, color: /color|fondo|paleta/, transicion: /transic/, sonido: /sonid/, texto: /^texto|texto exacto|en pantalla/ };
/** Tabla de escenas de plan.md: filas `| id | inicio | dur | … |`; las columnas se reconocen por su cabecera. */
export function escenasDePlan(txt) {
  const filas = txt.split('\n').filter((l) => /^\s*\|/.test(l)).map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
  const ini = filas.findIndex((f) => f.some((c) => COLS.id.test(sinTilde(c))) && f.some((c) => COLS.sonido.test(sinTilde(c)) || COLS.movimiento.test(sinTilde(c))));
  if (ini < 0) return [];
  const idx = {}; filas[ini].forEach((c, i) => { for (const [k, re] of Object.entries(COLS)) if (!(k in idx) && re.test(sinTilde(c))) idx[k] = i; });
  return filas.slice(ini + 1).filter((f) => !f.every((c) => /^[-: ]*$/.test(c))).map((f) => { const o = {}; for (const k in idx) o[k] = f[idx[k]] ?? ''; o.id = sinTilde(o.id).replace(/[^a-z0-9_-]/g, ''); return o; });
}
/** Momento memorable declarado: «memorable: 12,4» / «momento memorable (t = 12.4 s)». */
export function memorableDePlan(txt) {
  const m = sinTilde(txt.replace(/[*`_]/g, '')).match(/momento memorable[^\n\d]*?(\d+(?:[.,]\d+)?)\s*(?:s\b|seg)?/) ?? sinTilde(txt.replace(/[*`_]/g, '')).match(/\bmemorable\s*[:=]\s*(?:t\s*=\s*)?(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}
async function rasgosDe(planTxt) { const { rasgosDePlan } = await import(pathToFileURL(path.join(ROOT, 'engine/panel.mjs')).href); return rasgosDePlan(planTxt); }

// ───────────── nuevo ─────────────
const ultimas = (n = 3) => { try { return (JSON.parse(fs.readFileSync(registro(), 'utf8')).entregas ?? []).slice(-n); } catch { return []; } };
export function encargo({ id, tema, historia, revision }) {
  const veto = ultimas().map((e) => `- **${e.film}** (${e.fecha}): ${RASGOS.map((k) => `${k}: ${e[k]}`).join(' · ')}`).join('\n') || '- (sin entregas previas)';
  return `# Encargo v6: ${id}

Eres el agente productor (Sonnet) de un film de opus-studio. Trabajas con libertad creativa, pero dentro de unas reglas de juego y unos puntos de control. Revisión: **${revision}**.

## 0. Antes de nada
1. Lee entero \`docs/current/MODO-LIBRE.md\` (sobre todo §0b, el pliego de sorpresa) y \`kit-libre/README.md\` (el kit: materia, formas, objetos, transiciones, mapa, audio, auditoría).
2. Tu carpeta es \`kit-libre/films/${id}/\` (ya contiene la plantilla). Lleva \`log.md\` con la hora (\`date\`) al empezar y terminar cada fase.

## 1. Historia
${historia ? `Fuente: \`${historia.nombre}\`.\n\n${historia.texto.trim()}` : `Tema: ${tema}\n\n(No hay guion cerrado: tú eliges ángulo, hechos con fuente y estructura. Pon las cifras reales en \`hechos.js\`.)`}

## 2. Veto de repetición (últimas 3 entregas)
No repitas 2 o más de los 5 rasgos (paleta, medio, tipografía, sonido, estructura) de NINGUNA de estas. El filtro lo mide sobre tu \`plan.md\`:
${veto}

## 3. Aislamiento
- Escribes SOLO dentro de \`kit-libre/films/${id}/\`. No toques \`kit-libre/kit/\`, \`kit-libre/plantilla/\`, \`engine/\`, \`data/\` ni \`out/\`.
- Si el kit no sirve para algo, impleméntalo dentro de tu carpeta (\`lib.js\`) y anótalo en \`log.md\`; no lo parches en el kit.
- Nada aleatorio no reproducible: \`frame(ctx,t)\` es pura (sin \`Math.random\` ni \`Date\`), PRNG con semilla. Imagen y sonido leen de \`timeline.js\`.
- No leas otros films ni el resto del repo para copiar su estilo: la voz es tuya. No hagas \`git commit\` ni \`push\`.

## 4. Fases (en este orden)
1. **Pliego y plan.** Sigue MODO-LIBRE §0b y §1. Escribe \`plan.md\` con:
   - los 5 rasgos, cada uno en su línea con ese formato exacto: \`paleta: …\`, \`medio: …\`, \`tipografia: …\`, \`sonido: …\`, \`estructura: …\`;
   - \`referencia:\` (obra/oficio/objeto real; qué tomas y qué evitas), \`rareza:\` y \`momento memorable: <t en segundos>\` (≈3 s sin texto);
   - la tabla de escenas, una fila por escena de \`timeline.js\`, con estas columnas:
     \`| escena | inicio | dur | objeto | movimiento | color | transicion | sonido | texto |\` (el id de \`escena\` coincide con \`timeline.js\`; \`color\` lleva valores hex).
2. **Esqueleto.** Edita \`timeline.js\`, \`hechos.js\` y \`frame.js\` hasta que \`node kit-libre/films/${id}/still.js\` muestre todas las escenas.
3. **Storyboard (punto de control).** Pide al director (o ejecuta): \`node engine/v6.mjs storyboard ${id}\`. Si el filtro del plan FALLA, corrige \`plan.md\` (máx. ${MAX_RONDAS} rondas).
   - \`autonomo\`: si el filtro pasa, sigues sin esperar.
   - \`consultar\` / \`consultar_final\`: te DETIENES tras el storyboard. El director ejecutará \`v6 consultar ${id}\` y \`v6 aprobar ${id} --cambios "…"\`. Al reanudar, lee \`cambios.md\`, aplícalos a \`plan.md\` y al código, regenera el storyboard y solo entonces produce.
4. **Producción.** \`node kit-libre/kit/auditoria.mjs kit-libre/films/${id}\` sin FALLOS GRAVES; \`node engine/v6.mjs producir ${id} --preview\`; mira el resultado; luego \`node engine/v6.mjs producir ${id}\` (render final con audio).
5. **Verificación.** \`node engine/v6.mjs verificar ${id}\`. Si FALLA, corrige lo que diga \`verificacion.md\` y repite (máx. ${MAX_RONDAS} rondas).${revision === 'consultar_final' ? ' En `consultar_final` te detienes al PASAR: el director aprueba el corte con `v6 aprobar`.' : ''}
6. **Entrega.** \`node engine/v6.mjs entregar ${id}\` (copia el mp4 y la hoja a \`out/entregas/\` y registra los 5 rasgos).
7. **Informe** (≤ 15 líneas): qué hiciste, la rareza, el momento memorable, tokens aproximados y lo que dejaste sin pulir.
`;
}
export function nuevo(id, { tema, historia, revision = 'autonomo' } = {}) {
  const dir = dirFilm(id);
  if (!REVISIONES.includes(revision)) err(`--revision debe ser ${REVISIONES.join('|')}`);
  if (!tema && !historia) err('falta --tema "<texto>" (o --historia <archivo.md>)');
  if (fs.existsSync(dir)) err(`ya existe ${path.relative(ROOT, dir)}`);
  let hist = null; if (historia) { if (!fs.existsSync(historia)) err(`no existe ${historia}`); hist = { nombre: path.basename(historia), texto: fs.readFileSync(historia, 'utf8') }; }
  fs.mkdirSync(FILMS, { recursive: true });
  fs.cpSync(path.join(ROOT, 'kit-libre/plantilla'), dir, { recursive: true });
  fs.rmSync(path.join(dir, 'salida'), { recursive: true, force: true });
  for (const f of fs.readdirSync(dir).filter((x) => /\.(m?js)$/.test(x))) { const p = path.join(dir, f); fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replaceAll("'../kit/", "'../../kit/")); }   // la carpeta está un nivel más abajo que la plantilla
  fs.writeFileSync(path.join(dir, 'encargo.md'), encargo({ id, tema: tema ?? hist.nombre, historia: hist, revision }));
  fs.writeFileSync(path.join(dir, 'plan.md'), `# Plan: ${id}\n\npaleta:\nmedio:\ntipografia:\nsonido:\nestructura:\nreferencia:\nrareza:\nmomento memorable:\n\n| escena | inicio | dur | objeto | movimiento | color | transicion | sonido | texto |\n|---|---|---|---|---|---|---|---|---|\n`);
  const e = { id, tema: tema ?? null, fase: 'plan', revision, creado: ahora(), rondas_plan: 0, historial: [] };
  nota(e, 'nuevo', { revision }); wEstado(id, e);
  return { dir, estado: e };
}

// ───────────── storyboard ─────────────
async function lienzo() {
  const req = createRequire(path.join(ROOT, 'kit-libre/package.json')); return req('canvas');
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function filtroPlan(planPath) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'engine/panel.mjs'), 'filtro', '--entrega', planPath, '--registro', registro()], { encoding: 'utf8', cwd: ROOT });
  const lineas = (r.stdout ?? '').split('\n').filter((l) => /^\s*\[/.test(l)).map((l) => l.trim());
  return { pasa: r.status === 0, lineas, salida: ((r.stdout ?? '') + (r.stderr ?? '')).trim() };
}
export async function storyboard(id) {
  const dir = dirFilm(id), e = rEstado(id);
  exigeFase(e, ['plan', 'corregir_plan', 'storyboard_listo', 'esperando_usuario', 'producir'], 'storyboard');
  const planPath = path.join(dir, 'plan.md');
  if (!fs.existsSync(planPath)) err('falta plan.md');
  const plan = fs.readFileSync(planPath, 'utf8'), filas = escenasDePlan(plan), mem = memorableDePlan(plan);
  const TL = await import(pathToFileURL(path.join(dir, 'timeline.js')).href + `?v=${Date.now()}`), F = await import(pathToFileURL(path.join(dir, 'frame.js')).href);
  const { createCanvas } = await lienzo(), sdir = path.join(dir, 'storyboard'); fs.rmSync(sdir, { recursive: true, force: true }); fs.mkdirSync(sdir, { recursive: true });
  const W = TL.W, H = TL.H, tomas = TL.escenas.map((s, i) => ({ id: s.id, t0: s.t0, dur: s.dur, t: +(s.t0 + s.dur / 2).toFixed(2), memorable: false, fila: filas.find((f) => f.id === sinTilde(s.id).replace(/[^a-z0-9_-]/g, '')) ?? filas[i] ?? {} }));
  if (mem != null && mem >= 0 && mem <= TL.dur) tomas.push({ id: 'momento memorable', t0: mem, dur: 0, t: mem, memorable: true, fila: tomas.find((s) => !s.memorable && mem >= s.t0 && mem < s.t0 + s.dur)?.fila ?? {} });
  tomas.forEach((s, i) => {
    const c = createCanvas(W, H); F.frame(c.getContext('2d'), s.t);
    s.png = `storyboard/${String(i + 1).padStart(2, '0')}_${s.id.replace(/[^a-z0-9]+/gi, '_')}.png`; fs.writeFileSync(path.join(dir, s.png), c.toBuffer('image/png'));
    s.jpg = c.toBuffer('image/jpeg', { quality: 0.85 });
  });
  const fl = filtroPlan(planPath);
  // lámina
  const cols = Math.min(3, tomas.length), tw = 640, th = Math.round(tw * H / W), barra = 44, filasN = Math.ceil(tomas.length / cols), lam = createCanvas(cols * tw, filasN * (th + barra)), g = lam.getContext('2d');
  g.fillStyle = '#16181d'; g.fillRect(0, 0, lam.width, lam.height);
  const { loadImage } = await lienzo();
  for (let i = 0; i < tomas.length; i++) {
    const s = tomas[i], x = (i % cols) * tw, y = Math.floor(i / cols) * (th + barra); g.drawImage(await loadImage(s.jpg), x, y, tw, th);
    g.fillStyle = '#ece8dc'; g.font = 'bold 18px sans-serif'; g.fillText(`${i + 1}. ${s.id}${s.memorable ? ' ★' : ''}`, x + 10, y + th + 20);
    g.font = '15px sans-serif'; g.fillStyle = '#a9a69c'; g.fillText(`t=${s.t.toFixed(1)} s${s.dur ? ` · dur ${s.dur} s` : ''}`, x + 10, y + th + 38);
  }
  fs.writeFileSync(path.join(dir, 'storyboard.jpg'), lam.toBuffer('image/jpeg', { quality: 0.88 }));
  // html autocontenido
  const chips = (c) => (String(c ?? '').match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) ?? []).map((h) => `<i class="chip" style="background:${h}" title="${h}"></i>`).join('');
  const dato = (k, v) => `<div><b>${k}</b><span>${esc(v) || '—'}</span></div>`;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Storyboard ${esc(id)}</title>
<style>:root{--bg:#f6f4ee;--fg:#1d1f24;--mut:#6b6d73;--card:#fff;--bd:#d9d5c8;--ok:#1f7a4d;--ko:#b3261e}@media(prefers-color-scheme:dark){:root{--bg:#16181d;--fg:#ece8dc;--mut:#a09d93;--card:#1f2228;--bd:#34373f;--ok:#58c28a;--ko:#ff8b83}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.45 system-ui,sans-serif}main{max-width:1100px;margin:0 auto;padding:24px 16px}h1{margin:0 0 4px}.mut{color:var(--mut)}
.escena{background:var(--card);border:1px solid var(--bd);border-radius:10px;margin:20px 0;overflow:hidden}.escena img{width:100%;display:block}.cuerpo{padding:14px 16px}.escena h2{margin:0 0 8px;font-size:1.1rem}
.datos{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px 18px}.datos b{display:block;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;color:var(--mut)}
.chip{display:inline-block;width:18px;height:18px;border-radius:50%;border:1px solid var(--bd);margin-right:4px;vertical-align:middle}.ok{color:var(--ok)}.ko{color:var(--ko)}pre{white-space:pre-wrap;background:var(--card);border:1px solid var(--bd);padding:10px;border-radius:8px}</style></head><body><main>
<h1>Storyboard · ${esc(id)}</h1><p class="mut">${tomas.filter((s) => !s.memorable).length} escenas · ${TL.dur.toFixed(1)} s · revisión ${esc(e.revision)} · generado ${esc(ahora())}</p>
<div class="escena"><div class="cuerpo"><h2>Filtro del plan (veto de repetición y rasgos): <span class="${fl.pasa ? 'ok' : 'ko'}">${fl.pasa ? 'PASA' : 'FALLA'}</span></h2><pre>${esc(fl.lineas.join('\n') || fl.salida)}</pre></div></div>
${tomas.map((s, i) => `<section class="escena"><img alt="still ${esc(s.id)}" src="data:image/jpeg;base64,${s.jpg.toString('base64')}"><div class="cuerpo"><h2>${i + 1}. ${esc(s.id)}${s.memorable ? ' ★ momento memorable' : ''} <span class="mut">t=${s.t.toFixed(1)} s${s.dur ? ` · ${s.t0}–${(s.t0 + s.dur).toFixed(1)} s` : ''}</span></h2><div class="datos">
${dato('Texto en pantalla', s.fila.texto)}<div><b>Paleta</b><span>${chips(s.fila.color)} ${esc(s.fila.color)}</span></div>${dato('Movimiento', s.fila.movimiento)}${dato('Objeto', s.fila.objeto)}${dato('Transición', s.fila.transicion)}${dato('Sonido', s.fila.sonido)}</div></div></section>`).join('\n')}
</main></body></html>`;
  fs.writeFileSync(path.join(dir, 'storyboard.html'), html);
  // fase
  e.storyboard = { n_stills: tomas.length, escenas: tomas.filter((s) => !s.memorable).length, filtro: fl.pasa ? 'PASA' : 'FALLA', html: 'storyboard.html', jpg: 'storyboard.jpg' };
  let sig;
  if (e.revision === 'autonomo') {
    if (fl.pasa) sig = 'producir';
    else { e.rondas_plan += 1; sig = e.rondas_plan > MAX_RONDAS ? 'bloqueado' : 'corregir_plan'; }
  } else sig = 'storyboard_listo';
  mover(e, sig, 'storyboard', { filtro: e.storyboard.filtro, stills: tomas.length });
  wEstado(id, e);
  return { dir, html: path.join(dir, 'storyboard.html'), jpg: path.join(dir, 'storyboard.jpg'), n: tomas.length, filtro: fl, fase: sig };
}

// ───────────── consultar / aprobar ─────────────
export function consultar(id, { espera = null } = {}) {
  const e = rEstado(id); exigeFase(e, ['storyboard_listo', 'producir', 'corregir_plan'], 'consultar');
  if (!fs.existsSync(path.join(dirFilm(id), 'storyboard.html'))) err('consultar: falta storyboard.html (v6 storyboard primero)');
  if (espera != null) { if (!(espera > 0)) err('--espera debe ser un número de horas > 0'); e.espera_h = espera; e.esperando_desde = ahora(); } else { delete e.espera_h; delete e.esperando_desde; }
  mover(e, 'esperando_usuario', 'consultar', espera != null ? { espera_h: espera } : {}); wEstado(id, e);
  return path.join(dirFilm(id), 'storyboard.html');
}
export function aprobar(id, { cambios = null, archivo = null } = {}) {
  const e = rEstado(id), dir = dirFilm(id);
  exigeFase(e, ['esperando_usuario', 'esperando_corte_final'], 'aprobar');
  if (archivo) { if (!fs.existsSync(archivo)) err(`no existe ${archivo}`); cambios = fs.readFileSync(archivo, 'utf8'); }
  const final = e.fase === 'esperando_corte_final', txt = (cambios ?? '').trim();
  if (txt) fs.appendFileSync(path.join(dir, 'cambios.md'), `\n## ${ahora()} (${final ? 'corte final' : 'storyboard'})\n\n${txt}\n`);
  delete e.espera_h; delete e.esperando_desde;
  mover(e, final ? 'aprobado_final' : 'producir', 'aprobar', { cambios: txt || null });
  wEstado(id, e); return { cambios: !!txt, fase: e.fase };
}
/** ¿Se superó el plazo --espera? */
export const plazoVencido = (e) => e.fase === 'esperando_usuario' && e.espera_h != null && Date.now() > Date.parse(e.esperando_desde) + e.espera_h * 3600e3;

// ───────────── producir ─────────────
const run = (cmd, args, opts = {}) => { const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT, ...opts }); if (r.status !== 0) err(`falló: ${cmd} ${args.slice(0, 3).join(' ')}…`); };
export function producir(id, { preview = false, clip = null } = {}) {
  const dir = dirFilm(id), e = rEstado(id);
  exigeFase(e, ['producir', 'producido', 'verificado', 'verificado_falla'], 'producir');
  const sal = path.join(dir, 'salida'); fs.mkdirSync(sal, { recursive: true });
  const render = (extra) => run(process.execPath, [path.join(dir, 'render.js'), ...extra]);
  let mp4, modo;
  if (preview) { mp4 = path.join(sal, 'preview.mp4'); modo = 'preview'; render(['--preview', '--audio']); }
  else if (clip) {
    const [t0, t1] = clip; if (!(t1 > t0 && t0 >= 0)) err('--clip t0 t1 con 0 ≤ t0 < t1'); modo = `clip ${t0}-${t1}`; mp4 = path.join(sal, 'clip.mp4');
    if (t0 === 0) render(['--dur', String(t1), '--salida', mp4]);
    else { const tmp = path.join(sal, 'clip_base.mp4'); render(['--dur', String(t1), '--salida', tmp]); run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(t0), '-i', tmp, '-c:v', 'libx264', '-crf', '17', '-pix_fmt', 'yuv420p', '-c:a', 'aac', mp4]); fs.rmSync(tmp, { force: true }); }
  } else { mp4 = path.join(sal, 'final.mp4'); modo = 'final'; render([]); }
  if (!fs.existsSync(mp4)) err(`el render no produjo ${mp4}`);
  e.produccion = { modo, mp4: path.relative(dir, mp4), completo: modo === 'final', t: ahora() }; delete e.verificacion;
  mover(e, 'producido', 'producir', { modo }); wEstado(id, e); return mp4;
}

// ───────────── verificar ─────────────
export function verificar(id) {
  const dir = dirFilm(id), e = rEstado(id);
  exigeFase(e, ['producido', 'verificado', 'verificado_falla'], 'verificar');
  const mp4 = path.join(dir, e.produccion.mp4); if (!fs.existsSync(mp4)) err(`no existe ${mp4}`);
  const au = spawnSync(process.execPath, [path.join(ROOT, 'kit-libre/kit/auditoria.mjs'), dir], { encoding: 'utf8', cwd: ROOT, maxBuffer: 1 << 28 });
  const auOk = au.status === 0, auTxt = (au.stdout ?? '') + (au.stderr ?? '');
  const fr = spawnSync(process.execPath, [path.join(ROOT, 'engine/panel.mjs'), 'filtro', mp4, '--codigo', dir, '--entrega', path.join(dir, 'plan.md'), '--registro', registro()], { encoding: 'utf8', cwd: ROOT, maxBuffer: 1 << 28 });
  const frOk = fr.status === 0, lineas = (fr.stdout ?? '').split('\n').filter((l) => /^\s*\[/.test(l)).map((l) => l.trim());
  const motivos = [...(auOk ? [] : ['auditoría del kit con fallos graves (código ' + au.status + ')']), ...lineas.filter((l) => /^\[FALLA/.test(l)).map((l) => 'filtro ' + l)];
  if (!frOk && !motivos.length) motivos.push('el filtro falló: ' + ((fr.stderr ?? '').trim().split('\n').pop() || 'sin detalle'));
  const pasa = auOk && frOk, completo = !!e.produccion.completo;
  const relativo = (txt) => txt.split(ROOT + path.sep).join('').split(ROOT).join('.');
  fs.writeFileSync(path.join(dir, 'verificacion.md'), relativo(`# Verificación: ${id}\n\nResultado: **${pasa ? 'PASA' : 'FALLA'}** (${ahora()})\n\nArchivo: \`${e.produccion.mp4}\` (${e.produccion.modo}${completo ? '' : ': no es el corte final, no se puede entregar'})\n\n## Motivos\n${motivos.length ? motivos.map((m) => `- ${m}`).join('\n') : '- ninguno'}\n\n## Filtro (panel.mjs filtro --codigo --entrega plan.md)\n\`\`\`\n${lineas.join('\n') || (fr.stdout + fr.stderr).trim()}\n\`\`\`\n\n## Auditoría del kit\n\`\`\`\n${auTxt.trim().split('\n').slice(-40).join('\n')}\n\`\`\`\n`));

  e.verificacion = { resultado: pasa ? 'PASA' : 'FALLA', motivos, mp4: e.produccion.mp4, completo, t: ahora() };
  const fase = !pasa ? 'verificado_falla' : completo && e.revision === 'consultar_final' ? 'esperando_corte_final' : 'verificado';
  mover(e, fase, 'verificar', { resultado: e.verificacion.resultado }); wEstado(id, e);
  return { pasa, motivos, fase };
}

// ───────────── entregar ─────────────
export async function entregar(id) {
  const dir = dirFilm(id), e = rEstado(id);
  const ok = e.revision === 'consultar_final' ? ['aprobado_final'] : ['verificado'];
  if (e.verificacion?.resultado !== 'PASA' || !ok.includes(e.fase)) err(`entregar: exige verificación PASA${e.revision === 'consultar_final' ? ' y aprobación del corte final (v6 aprobar)' : ''}; fase «${e.fase}», verificación ${e.verificacion?.resultado ?? 'sin hacer'}`);
  if (!e.verificacion.completo) err('entregar: lo verificado fue un clip/preview; produce el corte final (v6 producir) y verifica de nuevo');
  const mp4 = path.join(dir, e.verificacion.mp4), hoja = path.join(dir, 'salida/hoja.jpg');
  if (!fs.existsSync(mp4)) err(`no existe ${mp4}`);
  const rasgos = await rasgosDe(fs.readFileSync(path.join(dir, 'plan.md'), 'utf8')), faltan = RASGOS.filter((k) => !rasgos[k]);
  if (faltan.length) err(`plan.md no declara: ${faltan.join(', ')}`);
  const out = salidaEntregas(); fs.mkdirSync(out, { recursive: true });
  fs.copyFileSync(mp4, path.join(out, `${id}.mp4`)); if (fs.existsSync(hoja)) fs.copyFileSync(hoja, path.join(out, `${id}.jpg`));
  const rf = registro(), reg = fs.existsSync(rf) ? JSON.parse(fs.readFileSync(rf, 'utf8')) : { nota: 'Registro de entregas (MODO-LIBRE §0b).', entregas: [] };
  reg.entregas = (reg.entregas ?? []).filter((x) => x.film !== id); reg.entregas.push({ film: id, fecha: ahora().slice(0, 10), ...Object.fromEntries(RASGOS.map((k) => [k, rasgos[k]])) });
  fs.writeFileSync(rf, '{\n  "nota": ' + JSON.stringify(reg.nota ?? 'Registro de entregas (MODO-LIBRE §0b).') + ',\n  "entregas": [\n' + reg.entregas.map((x) => '    ' + JSON.stringify(x)).join(',\n') + '\n  ]\n}\n');
  mover(e, 'entregado', 'entregar', { destino: path.relative(ROOT, out) }); wEstado(id, e);
  return { mp4: path.join(out, `${id}.mp4`), hoja: fs.existsSync(hoja) ? path.join(out, `${id}.jpg`) : null, registro: rf };
}

// ───────────── estado ─────────────
const SIGUIENTE = {
  plan: (e) => `el agente productor lee encargo.md y escribe plan.md + código; luego: v6 storyboard ${e.id}`,
  corregir_plan: (e) => `corregir plan.md (ronda ${e.rondas_plan}/${MAX_RONDAS}) según el filtro y repetir: v6 storyboard ${e.id}`,
  bloqueado: (e) => `el plan no pasa el filtro tras ${MAX_RONDAS} rondas: decide el director (cambiar rasgos o v6 aprobar ${e.id})`,
  storyboard_listo: (e) => `v6 consultar ${e.id} (el usuario opina) — o v6 aprobar ${e.id} para seguir`,
  esperando_usuario: (e) => `el usuario revisa storyboard.html; luego v6 aprobar ${e.id} [--cambios "…"]`,
  producir: (e) => `v6 producir ${e.id} --preview y después v6 producir ${e.id}`,
  producido: (e) => `v6 verificar ${e.id}`,
  verificado: (e) => `v6 entregar ${e.id}`,
  verificado_falla: (e) => `corregir según verificacion.md, v6 producir ${e.id} y v6 verificar ${e.id}`,
  esperando_corte_final: (e) => `el usuario ve el corte final; luego v6 aprobar ${e.id} [--cambios "…"]`,
  aprobado_final: (e) => `v6 entregar ${e.id}`,
  entregado: () => 'nada: entregado',
};
export function estado(id) {
  const dir = dirFilm(id), e = rEstado(id), falta = [];
  const tiene = (f) => fs.existsSync(path.join(dir, f));
  if (['plan', 'corregir_plan'].includes(e.fase)) { if (!tiene('plan.md')) falta.push('plan.md'); else if (!escenasDePlan(fs.readFileSync(path.join(dir, 'plan.md'), 'utf8')).length) falta.push('tabla de escenas en plan.md'); }
  if (e.fase === 'producir' && !tiene('storyboard.html')) falta.push('storyboard.html');
  if (e.fase === 'verificado_falla') falta.push(...(e.verificacion?.motivos ?? []));
  if (e.verificacion && !e.verificacion.completo && ['verificado', 'verificado_falla'].includes(e.fase)) falta.push('corte final (lo verificado es un clip/preview)');
  return { id, fase: e.fase, revision: e.revision, siguiente: (SIGUIENTE[e.fase] ?? (() => '?'))(e), falta, plazoVencido: plazoVencido(e),
    aviso: plazoVencido(e) ? `plazo de ${e.espera_h} h vencido: reanuda en modo autónomo con v6 aprobar ${id} (sin cambios)` : null };
}
const listar = () => (fs.existsSync(FILMS) ? fs.readdirSync(FILMS).filter((d) => fs.existsSync(path.join(FILMS, d, 'estado.json'))) : []);

// ───────────── CLI ─────────────
export async function cli(argv) {
  const flag = (n, d = null) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
  const valores = new Set(['--tema', '--historia', '--revision', '--cambios', '--archivo', '--espera']);
  const pos = argv.filter((a, i) => !a.startsWith('--') && !valores.has(argv[i - 1]) && !(argv[i - 1] === '--clip' || argv[i - 2] === '--clip'));
  const [cmd, id] = pos;
  switch (cmd) {
    case 'nuevo': { const r = nuevo(id, { tema: flag('--tema'), historia: flag('--historia') && path.resolve(flag('--historia')), revision: flag('--revision', 'autonomo') }); console.log(`film ${id} creado en ${path.relative(ROOT, r.dir)} (revisión ${r.estado.revision})\nprompt del productor: ${path.relative(ROOT, r.dir)}/encargo.md`); break; }
    case 'storyboard': { const r = await storyboard(id); console.log(`storyboard: ${r.n} stills\n  ${r.html}\n  ${r.jpg}\nfiltro del plan: ${r.filtro.pasa ? 'PASA' : 'FALLA'}\n${r.filtro.lineas.map((l) => '  ' + l).join('\n')}\nfase: ${r.fase}`); break; }
    case 'consultar': { const p = consultar(id, { espera: flag('--espera') ? parseFloat(flag('--espera')) : null }); console.log(`esperando al usuario. Storyboard: ${p}`); break; }
    case 'aprobar': { const r = aprobar(id, { cambios: flag('--cambios'), archivo: flag('--archivo') }); console.log(`aprobado${r.cambios ? ' con cambios (cambios.md)' : ' sin cambios'} → fase ${r.fase}`); break; }
    case 'producir': { const i = argv.indexOf('--clip'); const p = producir(id, { preview: argv.includes('--preview'), clip: i >= 0 ? [parseFloat(argv[i + 1]), parseFloat(argv[i + 2])] : null }); console.log(`producido: ${p}`); break; }
    case 'verificar': { const r = verificar(id); console.log(`${r.pasa ? 'PASA' : 'FALLA'}${r.motivos.length ? '\n- ' + r.motivos.join('\n- ') : ''}\n(verificacion.md) fase: ${r.fase}`); if (!r.pasa) process.exitCode = 3; break; }
    case 'entregar': { const r = await entregar(id); console.log(`entregado: ${r.mp4}${r.hoja ? '\nhoja: ' + r.hoja : ''}\nregistro: ${r.registro}`); break; }
    case 'estado': { for (const f of id ? [id] : listar()) { const s = estado(f); console.log(`${s.id}: fase ${s.fase} (revisión ${s.revision})\n  siguiente: ${s.siguiente}${s.falta.length ? '\n  falta: ' + s.falta.join('; ') : ''}${s.aviso ? '\n  AVISO: ' + s.aviso : ''}`); } if (!id && !listar().length) console.log('sin films v6'); break; }
    default: console.error('uso: v6.mjs nuevo|storyboard|consultar|aprobar|producir|verificar|entregar|estado <id> …   (docs/current/V6.md)'); process.exitCode = cmd ? 1 : 0;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) cli(process.argv.slice(2)).catch((x) => { console.error('v6: ' + x.message); process.exit(1); });
