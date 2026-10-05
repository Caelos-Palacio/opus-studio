#!/usr/bin/env node
// Crítico visual (el último peldaño de la escalera: después del lint, nunca en su lugar).
//   node engine/critic.mjs [--shot A2]                      → out/review/<film>/<ID>.png + packet.md; exit según verdict.json vigente (3 = pendiente)
//   node engine/critic.mjs --verdict file.json              → valida el veredicto manual/externo con esquema, lo persiste y sale 0 SHIP / 1 FIX
//   node engine/critic.mjs --api [--model M] [--n 3] [--force] [--retries 1]   → N muestras por shot a la API, voto + mediana
//   node engine/critic.mjs --eval [--n 3] [--repeats 1]     → set dorado test/critic-golden: recall / especificidad / estabilidad
// Cliente inyectable: OPUS_CRITIC_CLIENT=ruta/a/modulo.mjs (export default async (model, text, images) => objeto) sustituye a la API.
// Exit: 0 SHIP · 1 FIX · 2 no puede correr (lint en FIX/caducado/ausente, uso) · 3 pendiente (sin veredicto vigente).
// Honestidad (E4): respuesta inválida = voto FIX (fail-closed); todas inválidas nunca = SHIP; el pase de coherencia que falla
// es FIX, no se traga; caché con clave = modelo + sistema + rúbrica + prompt + esquema + hash del plan + N; no corre con lint en FIX.
// Lámina: 3 columnas (in · mid · out) × 3 filas (color · grises · anotada: focos, texto, tercios, área segura).
import './help.mjs';
import { announceFilm } from './filmid.mjs';
import { activeTimeline } from './filmid.mjs';
import { lintState } from './verdict.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { validate } from './schema.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const argv = process.argv.slice(2), has = (k) => argv.includes(k), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
export const RUBRIC = {
  framing: 'sujeto legible, lead room/headroom, aire, tamaño de plano que sirve a la idea',
  hierarchy: 'un foco domina; el ojo sabe dónde ir primero y segundo',
  aesthetic: 'coherente con el estilo declarado; sin look de plantilla (gradiente+centrado, partículas decorativas, glow gratuito)',
  coherence: 'continuidad con shots vecinos: color-rol, escala, dirección, motivo',
  clarity: 'se entiende sin sonido; el texto se lee; la idea del shot es inequívoca',
};
export const SYSTEM = 'Eres director de fotografía y editor jefe. Juzgas solo lo que el lint no mide. Respondes SOLO con JSON válido, sin texto extra.';
export const SCHEMA_TEXT = `{"shot":"ID","scores":{${Object.keys(RUBRIC).map((k) => `"${k}":1-5`).join(',')}},"issues":[{"t":segundos,"severity":"FIX|WARN","problem":"…","fix":"arreglo mínimo y concreto"}]}`;
const issue = (needShot) => ({ type: 'object', additionalProperties: false, required: ['t', 'severity', 'problem', 'fix', ...(needShot ? ['shot'] : [])],
  properties: { shot: { type: 'string' }, t: { type: 'number' }, severity: { enum: ['FIX', 'WARN'] }, problem: { type: 'string', minLength: 1 }, fix: { type: 'string', minLength: 1 } } });
const scores = (int) => ({ type: 'object', additionalProperties: false, required: Object.keys(RUBRIC), properties: Object.fromEntries(Object.keys(RUBRIC).map((k) => [k, { type: int ? 'integer' : 'number', minimum: 1, maximum: 5 }])) });
// Respuesta de UNA muestra por shot (lo que devuelve el modelo o el agente con visión).
export const RESPONSE_SCHEMA = { type: 'object', additionalProperties: false, required: ['scores', 'issues'], properties: { shot: { type: 'string' }, scores: scores(true), issues: { type: 'array', items: issue(false) } } };
export const COHERENCE_SCHEMA = { type: 'object', additionalProperties: false, required: ['issues'], properties: { issues: { type: 'array', items: issue(true) } } };
// Veredicto persistido (out/review/<film>/verdict.json): manual/externo (--verdict) o de la API. Mismo esquema para ambos.
export const VERDICT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['plan', 'shots'],
  properties: {
    plan: { type: 'string', minLength: 1 }, source: { enum: ['manual', 'api'] }, reviewer: { type: 'string' }, model: { type: 'string' }, n: { type: 'integer', minimum: 1 },
    verdict: { enum: ['SHIP', 'FIX'] }, ts: { type: 'string' },
    shots: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['shot', 'scores', 'issues'],
      properties: { shot: { type: 'string' }, scores: { anyOf: [{ type: 'null' }, scores(false)] }, issues: { type: 'array', items: issue(false) }, verdict: { enum: ['SHIP', 'FIX'] }, agreement: { type: 'number', minimum: 0, maximum: 1 }, invalid: { type: 'integer', minimum: 0 } } } },
    coherence: { anyOf: [{ type: 'null' }, { type: 'object', additionalProperties: false, required: ['issues'], properties: { issues: { type: 'array', items: issue(true) }, verdict: { enum: ['SHIP', 'FIX'] }, agreement: { type: 'number' }, invalid: { type: 'integer' } } }] },
  },
};
const errText = (errs) => errs.filter((e) => e.level === 'FIX').slice(0, 3).map((e) => `${e.path}: ${e.message}`).join('; ');
export const checkResponse = (o, schema = RESPONSE_SCHEMA) => { const e = validate(o, schema).filter((x) => x.level === 'FIX'); return { ok: !e.length, error: errText(e) }; };
export const sha = (...xs) => crypto.createHash('sha256').update(xs.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('\u0000')).digest('hex').slice(0, 16);
// Clave de caché: cualquier cambio en modelo, instrucciones, rúbrica, prompt, esquema, plan o N invalida el resultado.
export const cacheKey = ({ model, prompt, plan, n, schema = RESPONSE_SCHEMA, rubric = RUBRIC, system = SYSTEM }) => sha('critic-v2', model, system, rubric, prompt, schema, plan, n);

const median = (xs) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const sampleVerdict = (r) => (r.issues.some((i) => i.severity === 'FIX') ? 'FIX' : 'SHIP');
// N muestras → voto. Cada muestra inválida (error de red, JSON roto, fuera de esquema tras `retries` reintentos) es un voto FIX.
// SHIP solo con mayoría estricta de muestras válidas que dicen SHIP; empate = FIX. Puntuaciones = mediana de las válidas.
export async function judge(client, { model, prompt, images = [], n = 3, retries = 1, schema = RESPONSE_SCHEMA, label = 'shot' }) {
  const samples = [];
  for (let k = 0; k < n; k++) {
    let s = null;
    for (let a = 0; a <= retries && !s?.ok; a++) {
      try { const res = await client(model, prompt, images), c = checkResponse(res, schema); s = c.ok ? { ok: true, res } : { ok: false, error: `fuera de esquema: ${c.error}` }; }
      catch (e) { s = { ok: false, error: e.message }; }
    }
    samples.push(s.ok ? { valid: true, verdict: sampleVerdict(s.res), res: s.res } : { valid: false, verdict: 'FIX', error: s.error });
  }
  const valid = samples.filter((s) => s.valid), fixV = samples.filter((s) => s.verdict === 'FIX').length, verdict = n - fixV > n / 2 ? 'SHIP' : 'FIX';
  const agreement = Math.max(fixV, n - fixV) / n, invalid = n - valid.length;
  const sc = valid[0]?.res.scores ? Object.fromEntries(Object.keys(RUBRIC).map((k) => [k, median(valid.map((s) => s.res.scores[k]))])) : null;
  // representante: la muestra válida del lado ganador más cercana a la mediana (sus issues son los que se informan)
  const dist = (s) => (sc ? Object.keys(RUBRIC).reduce((p, k) => p + Math.abs(s.res.scores[k] - sc[k]), 0) : Math.abs(s.res.issues.length - median(valid.map((v) => v.res.issues.length))));
  const rep = valid.filter((s) => s.verdict === verdict).sort((a, b) => dist(a) - dist(b))[0];
  const issues = [...(rep?.res.issues ?? [])];
  if (invalid) issues.push({ t: 0, severity: verdict === 'FIX' ? 'FIX' : 'WARN', problem: `crítico (${label}): ${invalid}/${n} respuestas inválidas — ${samples.find((s) => !s.valid).error}`.slice(0, 300), fix: 'repetir con --force; si persiste, revisar modelo/esquema (no cuenta como SHIP)' });
  return { verdict, scores: sc, issues, agreement: +agreement.toFixed(3), invalid, samples: samples.map(({ valid: v, verdict: d, error }) => ({ valid: v, verdict: d, ...(error ? { error } : {}) })) };
}

// ── lint vigente ─────────────────────────────────────────────────────────────────────────────────────────────────
// El crítico no corre sobre un film que el lint no aprueba: ausente, en FIX o más viejo que el timeline/shots = no corre.
export function lintGate(root = ROOT, tlPath = activeTimeline()) {
  const f = path.join(root, 'out/lint.json');
  if (!fs.existsSync(f)) return { ok: false, reason: 'no hay out/lint.json: corre `npm run lint` antes del crítico' };
  let L; try { L = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return { ok: false, reason: 'out/lint.json ilegible' }; }
  if (L.verdict !== 'SHIP') return { ok: false, reason: `el lint vigente está en ${L.verdict ?? '?'} (${(L.issues ?? []).filter((i) => i.level === 'FIX').length} FIX): arréglalo antes de pedir juicio visual` };
  // Veredicto sellado (F1/E3): vigencia por hash de contenido; parcial (--only/--shot) no vale. mtime solo como respaldo sin sello.
  if (root === ROOT && L.engineHash) { const st = lintState(); return st.fresh ? { ok: true, lint: L } : { ok: false, reason: `lint caducado: ${st.why}; vuelve a correr \`npm run lint\`` }; }
  const lm = fs.statSync(f).mtimeMs, srcs = [path.join(root, tlPath), ...(fs.existsSync(path.join(root, 'shots')) ? fs.readdirSync(path.join(root, 'shots')).filter((x) => x.endsWith('.mjs')).map((x) => path.join(root, 'shots', x)) : [])];
  const newer = srcs.filter((p) => fs.existsSync(p) && fs.statSync(p).mtimeMs > lm);
  if (newer.length) return { ok: false, reason: `lint caducado: ${newer.map((p) => path.relative(root, p)).slice(0, 3).join(', ')} cambió después de out/lint.json; vuelve a correr \`npm run lint\`` };
  return { ok: true, lint: L };
}

// ── veredicto persistido ─────────────────────────────────────────────────────────────────────────────────────────
// Un veredicto vale solo si valida el esquema, cubre todos los shots pedidos y su `plan` es el del film actual.
export function checkVerdict(V, { plan, shots }) {
  const errs = validate(V, VERDICT_SCHEMA).filter((e) => e.level === 'FIX').map((e) => `${e.path}: ${e.message}${e.remedy ? ` (${e.remedy})` : ''}`);
  if (errs.length) return { ok: false, errors: errs };
  if (V.plan !== plan) errs.push(`/plan: "${V.plan}" ≠ plan actual "${plan}" (el veredicto es de otra versión del film)`);
  const got = new Set(V.shots.map((s) => s.shot));
  for (const id of shots) if (!got.has(id)) errs.push(`/shots: falta el shot ${id}`);
  for (const s of V.shots) if (!shots.includes(s.shot)) errs.push(`/shots: shot desconocido ${s.shot}`);
  return { ok: !errs.length, errors: errs };
}
export const verdictOf = (V) => (V.shots.some((s) => (s.verdict ?? sampleVerdict(s)) === 'FIX') || (V.coherence && (V.coherence.verdict ?? sampleVerdict(V.coherence)) === 'FIX') ? 'FIX' : 'SHIP');
function report(V) {
  const all = [...V.shots.flatMap((s) => s.issues.map((i) => ({ ...i, shot: i.shot ?? s.shot }))), ...(V.coherence?.issues ?? [])];
  for (const i of all) console.log(`${i.severity.padEnd(4)}  ${String(i.shot).padEnd(6)} ${(+i.t || 0).toFixed(2).padStart(6)}s  ${i.problem}  →  ${i.fix}`);
  for (const s of V.shots) if (s.agreement != null) console.log(`  ${s.shot.padEnd(6)} ${s.verdict}  acuerdo ${(s.agreement * 100).toFixed(0)}%${s.invalid ? `  inválidas ${s.invalid}` : ''}  ${s.scores ? JSON.stringify(s.scores) : ''}`);
  const v = verdictOf(V); console.log(v === 'FIX' ? `\nCRITIC FIX (${all.filter((i) => i.severity === 'FIX').length})  [${V.source ?? 'manual'}]` : `\nCRITIC SHIP  [${V.source ?? 'manual'}]`); return v;
}

// ── clientes ─────────────────────────────────────────────────────────────────────────────────────────────────────
export async function anthropicClient(model, text, images) {
  const key = process.env.ANTHROPIC_API_KEY; if (!key) throw new Error('--api requiere ANTHROPIC_API_KEY');
  const content = [...images.map((b) => ({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: b.toString('base64') } })), { type: 'text', text }];
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 1500, system: SYSTEM, messages: [{ role: 'user', content }] }) });
  if (!r.ok) throw new Error(`API ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const d = await r.json(), txt = d.content.filter((c) => c.type === 'text').map((c) => c.text).join('').replace(/```json|```/g, '').trim();
  return JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
}
async function getClient() {
  const m = process.env.OPUS_CRITIC_CLIENT;
  if (m) return (await import(pathToFileURL(path.resolve(ROOT, m)).href)).default;
  return anthropicClient;
}
export const shotPrompt = (id, facts) => `Shot ${id}. Hechos medidos (no los contradigas; ya están verificados): ${JSON.stringify(facts)}\nRúbrica: ${JSON.stringify(RUBRIC)}\nDevuelve exactamente: ${SCHEMA_TEXT}\nSolo problemas visibles en la lámina; cada fix debe ser una acción concreta sobre el shot.`;
export const coherencePrompt = (ids) => `Tira de fotogramas medios en orden: ${ids.join(', ')}. Juzga SOLO coherencia entre planos (color-rol, escala, dirección de pantalla, evolución del motivo, rima primer/último). Devuelve {"issues":[{"shot":"ID","t":s,"severity":"FIX|WARN","problem":"…","fix":"…"}]}`;

// ── lámina ───────────────────────────────────────────────────────────────────────────────────────────────────────
async function sheet(R, s) {
  const { createCanvas } = (await import('canvas')).default, { barHeight } = await import('./grade.mjs');
  const { W, H, film } = R, tw = 360, th = Math.round((tw * H) / W), c = createCanvas(tw * 3, th * 3 + 24), x = c.getContext('2d'), bar = barHeight(film) * (H / film.height), P = film.P.safe;
  x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
  const ts = [s.t[0] + 0.02, (s.t[0] + s.t[1]) / 2, s.t[1] - 0.02];
  ts.forEach((t, i) => {
    const boxes = R.frame(t).filter((b) => b.shot === s.id), sx = tw / W, X = i * tw;
    x.drawImage(R.cv, X, 0, tw, th);
    const g = createCanvas(tw, th), gx = g.getContext('2d'); gx.drawImage(R.cv, 0, 0, tw, th); const im = gx.getImageData(0, 0, tw, th);
    for (let k = 0; k < im.data.length; k += 4) { const L = 0.299 * im.data[k] + 0.587 * im.data[k + 1] + 0.114 * im.data[k + 2]; im.data[k] = im.data[k + 1] = im.data[k + 2] = L; } gx.putImageData(im, 0, 0); x.drawImage(g, X, th);
    x.drawImage(R.cv, X, 2 * th, tw, th); x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(X, 2 * th, tw, th);
    x.save(); x.translate(X, 2 * th); x.lineWidth = 1; x.setLineDash([4, 4]); x.strokeStyle = 'rgba(255,255,255,0.5)';
    for (const f of [1 / 3, 2 / 3]) { x.beginPath(); x.moveTo(tw * f, 0); x.lineTo(tw * f, th); x.moveTo(0, bar * sx + (th - 2 * bar * sx) * f); x.lineTo(tw, bar * sx + (th - 2 * bar * sx) * f); x.stroke(); }
    x.strokeStyle = '#6cf'; x.strokeRect(tw * P.side, (bar + H * P.top) * sx, tw * (1 - 2 * P.side), th - (2 * bar + H * (P.top + P.bottom)) * sx); x.setLineDash([]);
    for (const b of boxes) { x.strokeStyle = b.kind === 'text' ? '#ff5' : '#f5a'; x.lineWidth = b.kind === 'focus' ? 1 + 2 * (b.weight ?? 1) : 1.5; x.strokeRect(b.x * sx, b.y * sx, b.w * sx, b.h * sx); }
    x.restore(); x.fillStyle = '#ddd'; x.font = '13px monospace'; x.fillText(`${s.id}  t=${t.toFixed(2)}  ${['in', 'mid', 'out'][i]}`, X + 6, 3 * th + 17);
  });
  return c;
}
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

async function main() {
  const n = Math.max(1, +arg('--n', process.env.OPUS_CRITIC_N ?? 3) | 0), retries = Math.max(0, +arg('--retries', 1) | 0), useApi = has('--api');
  const gate = lintGate();
  if (!gate.ok) { console.error(`CRITIC NO CORRE: ${gate.reason}`); return 2; }
  const { ROOT: R0 } = await import('./film.mjs'), { makeRenderer } = await import('./render.mjs'), { plan, filmName } = await import('./cut.mjs');
  const R = await makeRenderer({ size: '1280x720' }), { film } = R, name = filmName(), dir = path.join(R0, 'out/review', name); fs.mkdirSync(dir, { recursive: true });
  const P = plan(film, { fps: film.fps, size: `${film.width}x${film.height}` }), hashOf = (id) => P.jobs.filter((j) => j.shots.includes(id)).map((j) => j.hash).join('.');
  const shots = film.shots.filter((s) => !arg('--shot') || s.id === arg('--shot')), ids = shots.map((s) => s.id), planH = sha(shots.map((s) => [s.id, hashOf(s.id)]));
  const verdictF = path.join(dir, 'verdict.json');
  if (arg('--verdict')) {                                                       // veredicto manual/externo: se valida y se persiste
    const V = readJson(path.resolve(arg('--verdict')), null), c = V ? checkVerdict(V, { plan: planH, shots: ids }) : { ok: false, errors: ['no es JSON legible'] };
    if (!c.ok) { for (const e of c.errors) console.log(`FIX   crítico  veredicto inválido ${e}`); console.log(`\nCRITIC FIX (veredicto inválido: no cuenta como SHIP)`); return 1; }
    const out = { ...V, source: V.source ?? 'manual', verdict: verdictOf(V), ts: V.ts ?? new Date().toISOString() };
    fs.writeFileSync(verdictF, JSON.stringify(out, null, 1)); return report(out) === 'FIX' ? 1 : 0;
  }
  const cacheF = path.join(dir, 'critic.json'), cache = readJson(cacheF, {});
  const idx = readJson(path.join(R0, 'out/index', name, 'film.json'), null), model = arg('--model', process.env.OPUS_CRITIC_MODEL ?? 'claude-sonnet-4-6');
  let md = `# Review packet · ${film.title} · ${film.S.name}/${film.profileName}\n\nplan: \`${planH}\`\n\nRúbrica (1–5): ${Object.entries(RUBRIC).map(([k, v]) => `**${k}** = ${v}`).join(' · ')}\nResponde por shot con: \`${SCHEMA_TEXT}\`\nLámina: filas color / grises / anotada (rosa = focos, amarillo = texto, azul = área segura, punteado = tercios).\n\n` +
    `Veredicto sin --api: escribe un JSON \`{"plan":"${planH}","reviewer":"…","shots":[{"shot":"ID","scores":{…},"issues":[…]}, …],"coherence":{"issues":[…]}}\` con TODOS los shots (${ids.join(', ')}) y pásalo con \`node engine/critic.mjs --verdict archivo.json\`. Se valida con esquema; inválido = FIX.\n\n`;
  const shotRes = [], pngs = {};
  for (const s of shots) {
    const png = (await sheet(R, s)).toBuffer('image/png'); pngs[s.id] = png; fs.writeFileSync(path.join(dir, `${s.id}.png`), png);
    const facts = { id: s.id, t: s.t, size: s.size, cam: s.cam, action: s.action, text: s.text, transition_out: s.transition_out, style: film.S.name, profile: film.profileName, lint: gate.lint.issues.filter((i) => i.shot === s.id).map((i) => `${i.level} ${i.problem}`), tags: idx?.shots?.find((x) => x.id === s.id)?.tags ?? [] };
    md += `## ${s.id}\n![](${s.id}.png)\nHechos medidos: \`${JSON.stringify(facts)}\`\n\n`;
    if (!useApi) continue;
    const prompt = shotPrompt(s.id, facts), key = cacheKey({ model, prompt, plan: hashOf(s.id), n });
    if (!has('--force') && cache[s.id]?.key === key) { shotRes.push(cache[s.id].result); console.log(`  = ${s.id} (caché)`); continue; }
    const J = await judge(await getClient(), { model, prompt, images: [png], n, retries, label: s.id }), res = { shot: s.id, scores: J.scores, issues: J.issues, verdict: J.verdict, agreement: J.agreement, invalid: J.invalid };
    if (!J.invalid) cache[s.id] = { key, model, n, result: res }; else delete cache[s.id];   // lo inválido no se cachea: se reintenta
    shotRes.push(res); console.log(`  ${J.verdict === 'SHIP' ? '✓' : '✗'} ${s.id}  ${J.verdict} (acuerdo ${(J.agreement * 100).toFixed(0)}%${J.invalid ? `, ${J.invalid} inválidas` : ''})`);
  }
  fs.writeFileSync(path.join(dir, 'packet.md'), md);
  if (!useApi) {
    const V = readJson(verdictF, null), c = V ? checkVerdict(V, { plan: planH, shots: ids }) : null;
    console.log(`→ ${path.relative(R0, dir)}/packet.md (${shots.length} láminas, plan ${planH}).`);
    if (c?.ok) return report(V) === 'FIX' ? 1 : 0;
    console.log(V ? `CRITIC PENDIENTE: verdict.json no vale (${c.errors[0]})` : 'CRITIC PENDIENTE: sin veredicto. Un agente con visión lee las láminas y lo entrega con --verdict (o usa --api).');
    return 3;
  }
  let coherence = null;
  if (shots.length > 1) {                                                       // coherencia: tira de medios; falla = FIX (no se traga)
    const { createCanvas } = (await import('canvas')).default, tw = 320, th = Math.round((tw * R.H) / R.W), strip = createCanvas(tw * shots.length, th), sx = strip.getContext('2d');
    shots.forEach((s, i) => { R.frame((s.t[0] + s.t[1]) / 2); sx.drawImage(R.cv, i * tw, 0, tw, th); });
    const prompt = coherencePrompt(ids), key = cacheKey({ model, prompt, plan: planH, n, schema: COHERENCE_SCHEMA });
    if (!has('--force') && cache._film?.key === key) coherence = cache._film.result;
    else {
      const J = await judge(await getClient(), { model, prompt, images: [strip.toBuffer('image/png')], n, retries, schema: COHERENCE_SCHEMA, label: 'coherencia' });
      coherence = { issues: J.issues.map((i) => ({ shot: i.shot ?? '-', ...i })), verdict: J.verdict, agreement: J.agreement, invalid: J.invalid };
      if (!J.invalid) cache._film = { key, result: coherence }; else delete cache._film;
    }
  }
  fs.writeFileSync(cacheF, JSON.stringify(cache, null, 1));
  const V = { plan: planH, source: 'api', model, n, shots: shotRes, coherence, ts: new Date().toISOString() }; V.verdict = verdictOf(V);
  const c = checkVerdict(V, { plan: planH, shots: ids });                          // el propio resultado pasa por el mismo esquema
  if (!c.ok) { console.log(`FIX   crítico  veredicto generado inválido: ${c.errors[0]}\n\nCRITIC FIX`); return 1; }
  fs.writeFileSync(verdictF, JSON.stringify(V, null, 1));
  return report(V) === 'FIX' ? 1 : 0;
}

// ── set dorado ───────────────────────────────────────────────────────────────────────────────────────────────────
// test/critic-golden/cases.json: [{id, shot, module|null, expect:"SHIP"|"FIX", rubric:[…], defect}]. El módulo envuelve el shot
// original e inyecta el defecto (sin copiar el shot). Mide recall (FIX detectados), especificidad (SHIP respetados), estabilidad
// (acuerdo medio entre muestras y entre repeticiones) y si la rúbrica esperada baja (≤ 3).
export function scoreEval(rows) {
  const pos = rows.filter((r) => r.expect === 'FIX'), neg = rows.filter((r) => r.expect === 'SHIP'), rate = (xs, f) => (xs.length ? +(xs.filter(f).length / xs.length).toFixed(3) : null);
  return {
    cases: rows.length, recall: rate(pos, (r) => r.verdict === 'FIX'), specificity: rate(neg, (r) => r.verdict === 'SHIP'),
    rubricHit: rate(pos.filter((r) => r.rubric?.length && r.scores), (r) => r.rubric.some((k) => r.scores[k] <= 3)),
    stability: rows.length ? +(rows.reduce((p, r) => p + r.agreement, 0) / rows.length).toFixed(3) : null,
    invalid: rows.reduce((p, r) => p + (r.invalid ?? 0), 0),
  };
}
async function evalMain() {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPUS_CRITIC_CLIENT) { console.error('--eval necesita ANTHROPIC_API_KEY (o OPUS_CRITIC_CLIENT para un cliente simulado)'); return 2; }
  const gd = path.join(ROOT, 'test/critic-golden'), cases = JSON.parse(fs.readFileSync(path.join(gd, 'cases.json'), 'utf8'));
  const n = Math.max(1, +arg('--n', 3) | 0), reps = Math.max(1, +arg('--repeats', 1) | 0), model = arg('--model', process.env.OPUS_CRITIC_MODEL ?? 'claude-sonnet-4-6');
  const { makeRenderer } = await import('./render.mjs'), R = await makeRenderer({ size: '1280x720' }), client = await getClient(), rows = [];
  for (const c of cases) {
    const s = R.film.shots.find((x) => x.id === c.shot); if (!s) { console.log(`  ! ${c.id}: shot ${c.shot} no está en el timeline`); continue; }
    const orig = R.film.mods[c.shot];
    if (c.module) R.film.mods[c.shot] = (await import(pathToFileURL(path.join(gd, c.module)).href)).default;
    try {
      const png = (await sheet(R, s)).toBuffer('image/png'), prompt = shotPrompt(s.id, { id: s.id, t: s.t, size: s.size, cam: s.cam, action: s.action, text: s.text, style: R.film.S.name, lint: [] }), runs = [];
      for (let k = 0; k < reps; k++) runs.push(await judge(client, { model, prompt, images: [png], n, label: c.id }));
      const fixR = runs.filter((j) => j.verdict === 'FIX').length, verdict = reps - fixR > reps / 2 ? 'SHIP' : 'FIX';
      const row = { id: c.id, expect: c.expect, rubric: c.rubric, verdict, scores: runs[0].scores, agreement: runs.reduce((p, j) => p + j.agreement, 0) / reps * (Math.max(fixR, reps - fixR) / reps), invalid: runs.reduce((p, j) => p + j.invalid, 0) };
      rows.push(row); console.log(`  ${row.verdict === c.expect ? '✓' : '✗'} ${c.id.padEnd(24)} esperado ${c.expect}  obtenido ${verdict}  acuerdo ${(row.agreement * 100).toFixed(0)}%  (${c.defect})`);
    } finally { R.film.mods[c.shot] = orig; }
  }
  const S = scoreEval(rows); fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'out/critic-eval.json'), JSON.stringify({ model, n, repeats: reps, ...S, rows }, null, 1));
  console.log(`\nrecall ${S.recall} · especificidad ${S.specificity} · rúbrica ${S.rubricHit} · estabilidad ${S.stability} · inválidas ${S.invalid}  → out/critic-eval.json`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) announceFilm();
if (import.meta.url === `file://${process.argv[1]}`) (has('--eval') ? evalMain() : main()).then((code) => process.exit(code ?? 0), (e) => { console.error(e.message); process.exit(2); });
