#!/usr/bin/env node
// Diagramas del sistema (rama diagramas): el MOTOR dibuja los esquemas del propio sistema (film `sistema`, 5 láminas en DSL nativo).
//   D1 el film existe y es 100 % DSL nativo (cuenta en la cobertura, sin JS legado) · D2 lint sin FIX (texto legible, dentro de la zona segura)
//   D3 cada lámina final es un diagrama real (ni vacío ni negro) y determinista · D4 usan flechas y cajas del DSL, sin libs ni JS
//   D5 cada cifra pintada en la lámina de eficiencia está escrita en la documentación (no se inventan)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, FONTS_CONF, copyRepo, rmrf, run } from './lib.mjs';

let n = 0, bad = 0;
const ok = (m, c, info = '') => { n++; console.log(`${c ? '✓' : '✗'} diagramas: ${m}${info ? '  ' + info : ''}`); if (!c) bad++; };
const rd = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const TL = JSON.parse(rd('data/sistema/timeline.json')), IDS = ['S01', 'S02', 'S03', 'S04', 'S05'];

// D1
{
  const cov = JSON.parse(rd('data/dsl-coverage.json')), CV = await import('../engine/dsl-coverage.mjs'), C = CV.coverage(ROOT);
  ok('D1 el film sistema tiene las 5 láminas en orden, con el medio tecnico_plano y 8 s cada una', JSON.stringify(TL.shots.map((s) => s.id)) === JSON.stringify(IDS) && TL.medium === 'tecnico_plano' && TL.shots.every((s) => s.t[1] - s.t[0] === 8) && fs.existsSync(path.join(ROOT, 'styles/medios/tecnico_plano.json')));
  ok('D1b cada lámina es DSL nativo: .scene.json + .mjs generado, declarada «nativo», sin libs y contada por la cobertura', IDS.every((id) => {
    const sc = JSON.parse(rd(`shots/${id}.scene.json`)), row = C.rows.find((r) => r.id === id);
    return /^\/\/ GENERADO/.test(rd(`shots/${id}.mjs`)) && id in (cov.nativo ?? {}) && !sc.libs && row?.counts && row.native;
  }));
}

// D2 + D3 en una copia aislada (el motor lee SOLO de la copia)
const D = copyRepo();
const env = { FONTCONFIG_FILE: FONTS_CONF, OPUS_LAYERS: 'none', OPUS_TIMELINE: 'data/sistema/timeline.json', OPUS_WARM: '0' };
try {
  const L = await run(['engine/lint.mjs'], { cwd: D, env, timeout: 600000 });
  const m = /^SHIP/m.test(L.stdout) ? [0, 0] : /conteos: FIX (\d+)/.exec(L.stdout);
  ok('D2 lint del film sistema sin FIX (layout: texto legible, dentro de la zona segura y sin pisarse; foco registrado)', m && +m[1] === 0, (L.stdout.match(/FIX .*/g) ?? []).slice(0, 3).join(' | '));

  const still = async (t) => { const r = await run(['engine/render.mjs', '--still', String(t)], { cwd: D, env, timeout: 300000 }); const f = path.join(D, `out/sheets/still_${t.toFixed(2)}.png`); return r.status === 0 && fs.existsSync(f) ? fs.readFileSync(f) : null; };
  const { default: canvasPkg } = await import('canvas');
  const info = async (png) => {
    const img = await canvasPkg.loadImage(png), c = canvasPkg.createCanvas(img.width, img.height), x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const px = x.getImageData(0, 0, img.width, img.height).data, N = px.length / 4; let lum = 0, claro = 0, ref = [px[0], px[1], px[2]], dif = 0;
    for (let i = 0; i < px.length; i += 4) { const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]; lum += l; if (l > 170) claro++; if (Math.abs(px[i] - ref[0]) + Math.abs(px[i + 1] - ref[1]) + Math.abs(px[i + 2] - ref[2]) > 60) dif++; }
    return { lum: lum / N, claro: claro / N, dif: dif / N, w: img.width, h: img.height };
  };
  const res = {};
  for (const s of TL.shots) { const png = await still(s.t[1] - 0.5); res[s.id] = png && { png, ...(await info(png)) }; }
  const bien = IDS.filter((id) => res[id] && res[id].w === 1920 && res[id].lum > 40 && res[id].claro > 0.01 && res[id].dif > 0.08);
  ok('D3 el still final de cada lámina es un diagrama: 1920×1080, ni negro ni vacío (luz media > 40, texto/trazo claro > 1 %, > 8 % de píxeles distintos del fondo)', bien.length === 5, IDS.filter((i) => !bien.includes(i)).map((i) => `${i}:${res[i] ? JSON.stringify({ l: +res[i].lum.toFixed(0), c: +res[i].claro.toFixed(3), d: +res[i].dif.toFixed(3) }) : 'sin render'}`).join(' '));
  const again = await still(TL.shots[3].t[1] - 0.5);
  ok('D3b determinista: la lámina 4 renderizada dos veces da los mismos bytes', again && res.S04 && crypto.createHash('sha256').update(again).digest('hex') === crypto.createHash('sha256').update(res.S04.png).digest('hex'));
  if (process.env.OPUS_DIAGRAMAS_OUT) { fs.mkdirSync(process.env.OPUS_DIAGRAMAS_OUT, { recursive: true }); IDS.forEach((id, i) => res[id] && fs.writeFileSync(path.join(process.env.OPUS_DIAGRAMAS_OUT, `${String(i + 1).padStart(2, '0')}-${id}.png`), res[id].png)); }
} finally { rmrf(D); }

// D4
{
  const flat = (o, f) => { f(o); for (const c of o.children ?? []) flat(c, f); };
  const tipos = (id) => { const s = new Set(); for (const o of JSON.parse(rd(`shots/${id}.scene.json`)).objects) flat(o, (x) => s.add(x.type)); return s; };
  ok('D4 los diagramas con flechas (S01 pipeline, S02 ciclo, S04 orquestación) usan el tipo nativo arrow, y todos usan cajas (shape), texto y foco del DSL', ['S01', 'S02', 'S04'].every((i) => tipos(i).has('arrow')) && IDS.every((i) => ['shape', 'text', 'focus'].every((t) => tipos(i).has(t))));
}

// D5: cada cifra de S05 está en la documentación
{
  const sc = JSON.parse(rd('shots/S05.scene.json')), rep = sc.objects.find((o) => o.id === 'r'), F = rep.fields, idx = (k) => F.indexOf(k);
  const docs = ['docs/current/EFICIENCIA.md', 'docs/current/MEDIOS.md', 'docs/handoff/dsl80.md', 'docs/handoff/deuda2.md', 'STATUS.md'].map(rd).join('\n').replace(/\*\*/g, '');
  const num = (t) => t.replace(/[≈\s]|[a-zA-Z%]+$/g, '').replace(/^≈/, '').trim();
  const falta = [];
  for (const it of rep.items) for (const k of ['ta', 'td']) { const txt = it[idx(k)].replace(/^≈\s*/, '').replace(/\s*(s|MB|%)$/, ''); if (!docs.includes(txt)) falta.push(`${it[idx('n')]}: ${txt}`); }
  ok('D5 las 12 cifras (6 antes, 6 después) de la lámina de eficiencia aparecen escritas en EFICIENCIA/MEDIOS/STATUS/handoffs', rep.items.length === 6 && !falta.length, falta.join(' | '));
}
console.log(`\ndiagramas: ${n - bad}/${n}${bad ? `  ${bad} fallos` : ''}`);
process.exit(bad ? 1 : 0);
