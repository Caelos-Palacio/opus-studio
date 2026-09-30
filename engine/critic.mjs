#!/usr/bin/env node
// Crítico visual (el último peldaño de la escalera: después del lint, nunca en su lugar).
//   node engine/critic.mjs [--shot A2] [--force]          → out/review/<film>/<ID>.png + packet.md (para un agente con visión)
//   node engine/critic.mjs --api [--model M] [--force]     → además llama a la API de Anthropic (ANTHROPIC_API_KEY) y fusiona veredictos
// Cada lámina: 3 columnas (in · mid · out) × 3 filas (color · grises · anotada: focos, texto, tercios, área segura).
// Diseño contra fallos típicos de "VLM como juez": (1) juzga sobre muestras sistemáticas, no elegidas a ojo; (2) recibe los
// HECHOS medidos (lint, cajas, cámara) para no alucinar lo que ya está medido; (3) rúbrica cerrada con JSON validado;
// (4) caché por hash de fragmento: un shot sin cambios no se vuelve a pagar; (5) pase de coherencia sobre la tira completa.
import fs from 'node:fs';
import path from 'node:path';
import canvasPkg from 'canvas';
import { ROOT } from './film.mjs';
import { makeRenderer } from './render.mjs';
import { plan, filmName } from './cut.mjs';
import { barHeight } from './grade.mjs';
const { createCanvas } = canvasPkg;

const argv = process.argv.slice(2), has = (k) => argv.includes(k), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
export const RUBRIC = {
  framing: 'sujeto legible, lead room/headroom, aire, tamaño de plano que sirve a la idea',
  hierarchy: 'un foco domina; el ojo sabe dónde ir primero y segundo',
  aesthetic: 'coherente con el estilo declarado; sin look de plantilla (gradiente+centrado, partículas decorativas, glow gratuito)',
  coherence: 'continuidad con shots vecinos: color-rol, escala, dirección, motivo',
  clarity: 'se entiende sin sonido; el texto se lee; la idea del shot es inequívoca',
};
const SCHEMA = `{"shot":"ID","scores":{${Object.keys(RUBRIC).map((k) => `"${k}":1-5`).join(',')}},"issues":[{"t":segundos,"severity":"FIX|WARN","problem":"…","fix":"arreglo mínimo y concreto"}]}`;

function sheet(R, s) {
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

async function callApi(model, text, images) {
  const key = process.env.ANTHROPIC_API_KEY; if (!key) throw new Error('--api requiere ANTHROPIC_API_KEY');
  const content = [...images.map((b) => ({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: b.toString('base64') } })), { type: 'text', text }];
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 1500, system: 'Eres director de fotografía y editor jefe. Juzgas solo lo que el lint no mide. Respondes SOLO con JSON válido, sin texto extra.', messages: [{ role: 'user', content }] }) });
  if (!r.ok) throw new Error(`API ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const d = await r.json(), txt = d.content.filter((c) => c.type === 'text').map((c) => c.text).join('').replace(/```json|```/g, '').trim();
  return JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
}
const valid = (o) => o && o.scores && Object.keys(RUBRIC).every((k) => o.scores[k] >= 1 && o.scores[k] <= 5) && Array.isArray(o.issues);

async function main() {
  const R = await makeRenderer({ size: '1280x720' }), { film } = R, name = filmName(), dir = path.join(ROOT, 'out/review', name); fs.mkdirSync(dir, { recursive: true });
  const P = plan(film, { fps: film.fps, size: `${film.width}x${film.height}` }), hashOf = (id) => P.jobs.filter((j) => j.shots.includes(id)).map((j) => j.hash).join('.');
  const cacheF = path.join(dir, 'critic.json'), cache = fs.existsSync(cacheF) ? JSON.parse(fs.readFileSync(cacheF, 'utf8')) : {};
  const lint = fs.existsSync(path.join(ROOT, 'out/lint.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'out/lint.json'), 'utf8')) : { issues: [] };
  const idx = fs.existsSync(path.join(ROOT, 'out/index', name, 'film.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'out/index', name, 'film.json'), 'utf8')) : null;
  const shots = film.shots.filter((s) => !arg('--shot') || s.id === arg('--shot')), model = arg('--model', process.env.OPUS_CRITIC_MODEL ?? 'claude-sonnet-4-6');
  let md = `# Review packet · ${film.title} · ${film.S.name}/${film.profileName}\n\nRúbrica (1–5): ${Object.entries(RUBRIC).map(([k, v]) => `**${k}** = ${v}`).join(' · ')}\nResponde por shot con: \`${SCHEMA}\`\nLámina: filas color / grises / anotada (rosa = focos, amarillo = texto, azul = área segura, punteado = tercios).\n\n`;
  const results = [];
  for (const s of shots) {
    const png = sheet(R, s).toBuffer('image/png'), f = path.join(dir, `${s.id}.png`); fs.writeFileSync(f, png);
    const facts = { id: s.id, t: s.t, size: s.size, cam: s.cam, action: s.action, text: s.text, transition_out: s.transition_out, style: film.S.name, profile: film.profileName, lint: lint.issues.filter((i) => i.shot === s.id).map((i) => `${i.level} ${i.problem}`), tags: idx?.shots.find((x) => x.id === s.id)?.tags ?? [] };
    md += `## ${s.id}\n![](${s.id}.png)\nHechos medidos: \`${JSON.stringify(facts)}\`\n\n`;
    const h = hashOf(s.id);
    if (has('--api')) {
      if (!has('--force') && cache[s.id]?.hash === h) { results.push(cache[s.id].result); console.log(`  = ${s.id} (caché)`); continue; }
      const prompt = `Shot ${s.id}. Hechos medidos (no los contradigas; ya están verificados): ${JSON.stringify(facts)}\nRúbrica: ${JSON.stringify(RUBRIC)}\nDevuelve exactamente: ${SCHEMA}\nSolo problemas visibles en la lámina; cada fix debe ser una acción concreta sobre el shot.`;
      let res; for (let k = 0; k < 2 && !valid(res); k++) res = await callApi(model, prompt, [png]).catch((e) => ({ error: e.message }));
      if (!valid(res)) { console.log(`  ! ${s.id}: respuesta inválida ${res?.error ?? ''}`); continue; }
      res.shot = s.id; cache[s.id] = { hash: h, model, result: res }; results.push(res); console.log(`  ✓ ${s.id}`, JSON.stringify(res.scores));
    }
  }
  if (has('--api') && shots.length > 1) {                                       // coherencia entre shots: una sola llamada con la tira de medios
    const tw = 320, th = Math.round((tw * R.H) / R.W), strip = createCanvas(tw * shots.length, th), sx = strip.getContext('2d');
    shots.forEach((s, i) => { R.frame((s.t[0] + s.t[1]) / 2); sx.drawImage(R.cv, i * tw, 0, tw, th); });
    const key = shots.map((s) => hashOf(s.id)).join('|');
    if (has('--force') || cache._film?.hash !== key) {
      const res = await callApi(model, `Tira de fotogramas medios en orden: ${shots.map((s) => s.id).join(', ')}. Juzga SOLO coherencia entre planos (color-rol, escala, dirección de pantalla, evolución del motivo, rima primer/último). Devuelve {"issues":[{"shot":"ID","t":s,"severity":"FIX|WARN","problem":"…","fix":"…"}]}`, [strip.toBuffer('image/png')]).catch((e) => ({ issues: [], error: e.message }));
      cache._film = { hash: key, result: res };
    }
    for (const i of cache._film.result.issues ?? []) results.push({ shot: i.shot, issues: [i], scores: null });
  }
  fs.writeFileSync(path.join(dir, 'packet.md'), md);
  fs.writeFileSync(cacheF, JSON.stringify(cache, null, 1));
  if (!has('--api')) return console.log(`→ ${path.relative(ROOT, dir)}/packet.md (${shots.length} láminas). Sin --api: un agente con visión lee las láminas y responde con el esquema.`);
  const all = results.flatMap((r) => (r.issues ?? []).map((i) => ({ ...i, shot: i.shot ?? r.shot }))), fixes = all.filter((i) => i.severity === 'FIX');
  for (const i of all) console.log(`${i.severity.padEnd(4)}  ${String(i.shot).padEnd(6)} ${(+i.t || 0).toFixed(2).padStart(6)}s  ${i.problem}  →  ${i.fix}`);
  console.log(fixes.length ? `\nCRITIC FIX (${fixes.length})` : '\nCRITIC SHIP'); process.exit(fixes.length ? 1 : 0);
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
