#!/usr/bin/env node
// Índice de metadatos: los agentes CONSULTAN el film (engine/q.mjs) en vez de re-renderizarlo o re-mirarlo.
//   node engine/index.mjs [--fps 4] [--changed] [--timeline X]
// Salida: out/index/<film>/film.json · shots/<ID>.json (muestras) · thumbs/<ID>_{in,mid,out}.jpg
// Cada shot guarda el hash de su fragmento: si el código/timeline cambia, q.mjs lo marca como "stale" (y --changed reindexa solo eso).
import fs from 'node:fs';
import path from 'node:path';
import canvasPkg from 'canvas';
import { ROOT, activeShots, shotBeats } from './film.mjs';
import { makeRenderer } from './render.mjs';
import { camState, specOf } from './camera.mjs';
import { plan, filmName } from './cut.mjs';
import { hex2rgb } from './color.mjs';
import { symbolSet } from './semantic.mjs';
const { createCanvas } = canvasPkg;

const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const r3 = (v) => Math.round(v * 1000) / 1000;

function colors(ctx, W, H, palette) {                                       // colores dominantes → rol de paleta más cercano
  const d = ctx.getImageData(0, 0, W, H).data, hist = new Map(), roles = Object.entries(palette).map(([k, v]) => [k, hex2rgb(v)]);
  for (let i = 0; i < d.length; i += 4 * 7) { const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4); hist.set(k, (hist.get(k) ?? 0) + 1); }
  const tot = [...hist.values()].reduce((a, b) => a + b, 0);
  return [...hist].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => { const c = [((k >> 8) & 15) * 17, ((k >> 4) & 15) * 17, (k & 15) * 17], [role, dist] = roles.map(([r, v]) => [r, Math.hypot(v[0] - c[0], v[1] - c[1], v[2] - c[2])]).sort((a, b) => a[1] - b[1])[0];
    return { hex: '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''), share: r3(n / tot), role: dist < 60 ? role : null }; });
}
const lum = (ctx, W, H) => { const d = ctx.getImageData(0, 0, W, H).data; let s = 0, n = 0; for (let i = 0; i < d.length; i += 64) { s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; n++; } return r3(s / n / 255); };

async function main() {
  const R = await makeRenderer({ size: arg('--size', '640x360') }), { film, W, H } = R, name = filmName() + (film.edit ? '.edit' : '');
  const dir = path.join(ROOT, 'out/index', name); for (const s of ['shots', 'thumbs']) fs.mkdirSync(path.join(dir, s), { recursive: true });
  const fps = +arg('--fps', 4), P = plan(film, { fps: film.fps, size: `${film.width}x${film.height}` }), hashOf = (id) => P.jobs.filter((j) => j.shots.includes(id)).map((j) => j.hash).join('.');
  const prevF = path.join(dir, 'film.json'), prev = fs.existsSync(prevF) ? JSON.parse(fs.readFileSync(prevF, 'utf8')) : null;
  const onlyChanged = argv.includes('--changed') && prev;
  const sfxF = path.join(ROOT, `out/sfx${filmName() === 'main' ? '' : '-' + filmName()}.json`), sfx = fs.existsSync(sfxF) ? JSON.parse(fs.readFileSync(sfxF, 'utf8')).events : [];
  const norm = (b) => ({ x: r3(b.x / W), y: r3(b.y / H), w: r3(b.w / W), h: r3(b.h / H) });
  const shots = [];
  for (const s of film.shots) {
    const h = hashOf(s.id), old = prev?.shots?.find((x) => x.id === s.id);
    if (onlyChanged && old && old.hash === h) { shots.push(old); continue; }
    const samples = [], prims = new Set(), nodes = new Set(), texts = new Set(), tags = new Set(), sym = new Map();   // símbolo → primer t visible
    for (let t = s.t[0]; t < s.t[1] - 1e-6; t += 1 / fps) {
      const boxes = R.frame(t), mine = boxes.filter((b) => b.shot === s.id), meta = (boxes.meta ?? []).filter((m) => m.shot === s.id), c = camState(s, t, film, { shake: false });
      for (const m of meta) { prims.add(m.prim); if (m.prim === 'tex') for (const x of symbolSet(m.morphTo && (m.u ?? 0) > 0.5 ? m.morphTo : m.tex)) if (!sym.has(x)) sym.set(x, r3(t)); if (m.prim === 'node') nodes.add(m.id); if (m.prim === 'layer') for (const f of m.fx ?? []) tags.add('fx:' + f); }
      for (const b of mine) if (b.kind === 'text') texts.add(b.label);
      samples.push({ t: r3(t), u: r3((t - s.t[0]) / (s.t[1] - s.t[0])), cam: { z: r3(c.z), x: r3(c.x / film.width), y: r3(c.y / film.height), r: r3(c.r) },
        boxes: mine.map((b) => ({ kind: b.kind, label: b.label, role: b.role, weight: b.weight, ...norm(b) })),
        meta: meta.filter((m) => m.prim !== 'layer').map((m) => ({ prim: m.prim, id: m.id ?? m.label ?? m.tex, ...(m.w != null ? norm(m) : { x: r3(m.x / W), y: r3(m.y / H) }) })), lum: lum(R.ctx, W, H) });
    }
    const thumbs = {};
    for (const [k, t] of [['in', s.t[0] + 0.02], ['mid', (s.t[0] + s.t[1]) / 2], ['out', s.t[1] - 0.02]]) {
      R.frame(t); const c = createCanvas(320, Math.round((320 * H) / W)); c.getContext('2d').drawImage(R.cv, 0, 0, c.width, c.height);
      const f = path.join(dir, 'thumbs', `${s.id}_${k}.jpg`); fs.writeFileSync(f, c.toBuffer('image/jpeg', { quality: 0.8 })); thumbs[k] = path.relative(ROOT, f);
    }
    R.frame((s.t[0] + s.t[1]) / 2); const pal = colors(R.ctx, W, H, film.palette);
    const sp = specOf(s, film); for (const p of prims) tags.add(p); if (sp.move !== 'static') tags.add('cam:' + sp.move); if (s.size) tags.add('size:' + s.size); if (texts.size) tags.add('text');
    if ((film.handoffs ?? []).some((x) => x.from === s.id || x.to === s.id)) tags.add('handoff'); if (s.transition_out) tags.add('out:' + s.transition_out);
    const row = { id: s.id, hash: h, t: s.t, size: s.size ?? null, action: s.action ?? '', text: [...texts], cam: s.cam ?? null, transition_out: s.transition_out ?? null, motifState: s.motifState ?? null,
      prims: [...prims].filter((p) => p !== 'node'), symbols: Object.fromEntries(sym), nodes: [...nodes], tags: [...tags].sort(), palette: pal, beats: shotBeats(film, s).map(r3), on_beat_at: s.on_beat_at ?? [],
      sfx: sfx.filter((e) => e.t >= s.t[0] && e.t < s.t[1]).map((e) => ({ t: r3(e.t), type: e.type, src: e.src })), lum: { min: Math.min(...samples.map((x) => x.lum)), max: Math.max(...samples.map((x) => x.lum)) }, thumbs, detail: `out/index/${name}/shots/${s.id}.json` };
    fs.writeFileSync(path.join(dir, 'shots', s.id + '.json'), JSON.stringify({ id: s.id, fps, samples }));
    shots.push(row); console.log('  ✓', s.id, row.tags.join(' '));
  }
  const motion = fs.existsSync(path.join(ROOT, 'out/motion.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'out/motion.json'), 'utf8')) : null;
  const lint = fs.existsSync(path.join(ROOT, 'out/lint.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'out/lint.json'), 'utf8')) : null;
  fs.writeFileSync(prevF, JSON.stringify({ film: name, title: film.title, style: film.S.name, profile: film.profileName, duration: film.duration, fps: film.fps, size: [film.width, film.height], palette: film.palette,
    motif: film.motif ?? null, handoffs: film.handoffs ?? [], edit: film.edit?.items ?? null, lint: lint ? { verdict: lint.verdict, issues: lint.issues.length } : null, energy: motion ? { fps: motion.fps, n: motion.energy.length } : null, shots }, null, 1));
  console.log('→', path.relative(ROOT, prevF), `(${shots.length} shots)`);
}
main().catch((e) => { console.error(e.stack); process.exit(1); });
