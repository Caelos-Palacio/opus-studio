#!/usr/bin/env node
// docs/API.md se GENERA desde el registro DOC de prims.mjs + las voces de sound.mjs + las rúbricas del crítico:
// la referencia no puede desincronizarse del código (problema crónico de los proyectos con README escrito a mano).
import fs from 'node:fs';
import path from 'node:path';
import { DOC } from './prims.mjs';
import { VOICES } from './sound.mjs';
import { RUBRIC } from './critic.mjs';
import { WARPS } from './geom.mjs';
import { DEFAULTS } from './styles.mjs';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let md = `# API de shots — referencia generada\n\n> No editar: \`npm run docs\` la regenera desde \`engine/prims.mjs\` (DOC), \`sound.mjs\` (VOICES), \`geom.mjs\` (WARPS) y \`styles.mjs\` (DEFAULTS).\n\n`;
md += `## Primitivas (\`api.*\`)\nTodas registran cajas (lint) y metadatos (índice). Todas son funciones puras de \`t\`.\n\n| llamada | qué hace |\n|---|---|\n`;
for (const [, d] of Object.entries(DOC)) md += `| \`${d.sig.replace(/\|/g, '\\|')}\` | ${d.text} |\n`;
md += `\n## Deformaciones vectoriales (\`WARPS\`, en geom.mjs)\n${Object.keys(WARPS).map((k) => '`' + k + '`').join(' · ')} — se aplican a puntos de control (resolución infinita); \`compose(w1,w2)\`; raster: \`api.layer({warp})\` en px de dispositivo.\n`;
md += `\n## Scene graph (\`export default { scene: (t, film) => nodo }\`)\nCampos de nodo: \`id x y z rot s sx sy ax ay opacity visible time{offset,speed,from,to,loop} fps props(tl) children draw(ctx,tl,api,node) clip(ctx) fx{…} focus w h follow{id,lag,k} lookAt attach{id,dx,dy} zsort\`.\nCámara sobre nodo: \`shot.cam.track = { node, k, smooth }\`.\n`;
md += `\n## Voces de sonido (\`shot.sfx[].type\`)\n${Object.entries(VOICES).map(([k, v]) => `- \`${k}\` — ${v.doc}`).join('\n')}\n`;
md += `\n## Rúbrica del crítico visual\n${Object.entries(RUBRIC).map(([k, v]) => `- **${k}** — ${v}`).join('\n')}\n`;
md += `\n## Claves de estilo nuevas en v4\n\`\`\`json\n${JSON.stringify({ grade: { post: { bloom: { threshold: 0.62, strength: 0.7, radius: 26 }, chroma: 2, color: { lift: 0.015, gamma: 1.04, gain: 1, temp: 0.25, sat: 1.05, dither: 2 } } }, depth: DEFAULTS.depth }, null, 1)}\n\`\`\`\n`;
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'docs/API.md'), md); console.log('→ docs/API.md', `(${Object.keys(DOC).length} primitivas)`);
