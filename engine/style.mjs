#!/usr/bin/env node
// Gestión de estilos.
//   node engine/style.mjs --list
//   node engine/style.mjs --show noir                     estilo resuelto (pack + defaults)
//   node engine/style.mjs --new mi-marca [--from soft]    copia un pack como base
//   node engine/style.mjs --check mi-marca                reglas de gusto sobre la paleta
//   node engine/style.mjs --palette --hue 210 --scheme analogous --mode dark --mood muted [--apply mi-marca]
//        scheme: complementary|analogous|triad|split|mono · mode: light|dark · mood: muted|calm|bold|vivid
import fs from 'node:fs';
import path from 'node:path';
import { loadStyles, ROOT } from './film.mjs';
import { resolveStyle, checkPalette } from './styles.mjs';
import { generatePalette, contrast, oklch } from './color.mjs';

const argv = process.argv.slice(2), has = (k) => argv.includes(k);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const file = (n) => path.join(ROOT, 'styles', n + '.json');
const styles = loadStyles();

if (has('--list')) {
  for (const [n, p] of Object.entries(styles)) {
    const S = resolveStyle(p), g = S.grade;
    console.log(`${n.padEnd(11)} ${S.defaultProfile.padEnd(9)} ${Object.values(S.palette).slice(0, 5).join(' ')}  ${S.motion.ease}${g.letterbox ? ' · letterbox' : ''}${g.grain ? ' · grano' : ''}${S.rules.glow ? ' · glow' : ''}${S.rules.gradients ? ' · degradado' : ''}\n${''.padEnd(11)} ${S.description}`);
  }
} else if (has('--show')) {
  const n = arg('--show'); if (!styles[n]) { console.error('no existe: ' + n); process.exit(1); }
  console.log(JSON.stringify(resolveStyle(styles[n]), null, 2));
} else if (has('--new')) {
  const n = arg('--new'), from = arg('--from', '_template');
  if (!n || fs.existsSync(file(n))) { console.error('nombre vacío o ya existe'); process.exit(1); }
  const src = fs.existsSync(file(from)) ? JSON.parse(fs.readFileSync(file(from), 'utf8')) : null; if (!src) { console.error('base no existe: ' + from); process.exit(1); }
  src.name = n; fs.writeFileSync(file(n), JSON.stringify(src, null, 2) + '\n');
  console.log(`→ styles/${n}.json (base ${from}). Edita paleta, tipografía, movimiento, cámara y grade; luego: node engine/style.mjs --check ${n}`);
} else if (has('--check')) {
  const n = arg('--check'), p = styles[n] ?? (fs.existsSync(file(n)) ? JSON.parse(fs.readFileSync(file(n), 'utf8')) : null);
  if (!p) { console.error('no existe: ' + n); process.exit(1); }
  const S = resolveStyle(p), out = checkPalette(S);
  for (const k of ['maxZoomPerSec', 'maxPanPerSec', 'maxRotPerSec']) if (!(S.camera[k] > 0)) out.push({ level: 'FIX', problem: `camera.${k} inválido`, remedy: 'número > 0' });
  if (S.typeface.weights.length < 1 || S.typeface.weights.length > 2) out.push({ level: 'WARN', problem: 'usa 1–2 pesos tipográficos', remedy: 'una familia, dos pesos' });
  if (S.grade.letterbox && S.grade.letterbox < 1.78) out.push({ level: 'WARN', problem: 'letterbox < 1.78 no añade barras en 16:9', remedy: '2.0–2.39 para look de cine' });
  for (const x of out) console.log(`${x.level.padEnd(4)}  ${x.problem}  →  ${x.remedy}`);
  console.log(out.some((x) => x.level === 'FIX') ? '\nFIX' : `\nOK${out.length ? ` (${out.length} avisos)` : ''}`); process.exit(out.some((x) => x.level === 'FIX') ? 1 : 0);
} else if (has('--palette')) {
  const P = generatePalette({ hue: +arg('--hue', 25), scheme: arg('--scheme', 'complementary'), mode: arg('--mode', 'light'), mood: arg('--mood', 'calm') });
  console.log(JSON.stringify(P, null, 2));
  console.log(`contraste tinta/papel ${contrast(P.ink, P.paper).toFixed(1)}:1 · acento ${contrast(P.accent, P.paper).toFixed(1)}:1 · acento2 ${contrast(P.accent2, P.paper).toFixed(1)}:1 · croma acento ${oklch(P.accent).C.toFixed(2)}`);
  const ap = arg('--apply');
  if (ap) { const p = JSON.parse(fs.readFileSync(file(ap), 'utf8')); p.palette = { ...p.palette, ...P }; fs.writeFileSync(file(ap), JSON.stringify(p, null, 2) + '\n'); console.log(`→ paleta aplicada a styles/${ap}.json`); }
} else console.log('Uso: ver cabecera de engine/style.mjs');
