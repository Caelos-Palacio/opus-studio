// Índice semántico v2 (spec 006): conceptos, anclas, relaciones, objetos y params del DSL — NO píxeles — con vocabulario
// canónico (engine/vocab.mjs). Sin render, determinista. Responde: ¿dónde aparece el concepto X? ¿qué objetos dependen del param Y?
// Export OTIO (OpenTimelineIO JSON) del timeline con markers semánticos (metadata.opus).
import fs from 'node:fs';
import path from 'node:path';
import { canon, VERSION, terms, sections } from './vocab.mjs';
import { depsOf } from './dsl-core.mjs';
import { suggest } from './schema.mjs';

export const SEM_SCHEMA = 'opus-semindex/2';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const r3 = (v) => Math.round(v * 1000) / 1000;

export function buildSemIndex({ timeline, memoria, root = ROOT } = {}) {
  const tf = path.resolve(root, timeline), tl = rd(tf);
  let mem = null; const mf = memoria ? path.resolve(root, memoria) : tl.sound?.memoria ? path.resolve(root, tl.sound.memoria) : null;
  const cand = [mf, path.join(path.dirname(tf), 'memoria.json'), path.join(root, 'data/memoria.json')].filter(Boolean).find((f) => fs.existsSync(f));
  if (cand) mem = rd(cand);
  const shots = (tl.shots ?? []).map((s) => ({ id: s.id, t: s.t, size: s.size ?? null, scale: s.size ? canon(s.size, 'shot.scale') : null, text: s.text ?? null, action: s.action ?? null, dsl: false }));
  const params = {}, objects = [];
  for (const s of tl.shots ?? []) for (const [k, v] of Object.entries(s.params ?? {})) params[`/shots/${s.id}/params/${k}`] = { shot: s.id, name: k, source: 'timeline', default: typeof v === 'object' ? null : v, readers: [], possible: [], concepts: [] };
  for (const sh of shots) {
    const f = path.join(root, 'shots', sh.id + '.scene.json'); if (!fs.existsSync(f)) continue;
    const sc = rd(f); sh.dsl = true;
    for (const [k, d] of Object.entries(sc.params ?? {})) params[`/shots/${sh.id}/params/${k}`] ??= { shot: sh.id, name: k, source: 'dsl', default: d.default ?? null, unit: d.unit ?? null, semantic: d.semantic ?? null, readers: [], possible: [], concepts: [] };
    const sem = new Map(); const walk = (L) => { for (const o of L ?? []) { if (o.id) sem.set(o.id, o.semantic ?? null); if (o.children) walk(o.children); } }; walk(sc.objects);
    for (const d of depsOf(sc)) {
      const key = d.id ?? d.type, o = { shot: sh.id, id: key, type: d.type, semantic: sem.get(d.id) ?? null, params: d.inputs, opaque: d.opaqueInputs, libs: d.libs, entities: d.entities, timeDependent: d.timeDependent };
      objects.push(o);
      for (const p of d.inputs) (params[`/shots/${sh.id}/params/${p}`] ??= { shot: sh.id, name: p, source: 'dsl', readers: [], possible: [], concepts: [] }).readers.push(key);
      if (d.opaqueInputs) for (const [pk, P] of Object.entries(params)) if (P.shot === sh.id && !d.inputs.includes(P.name)) P.possible.push(key);
    }
  }
  const concepts = (mem?.conceptos ?? []).map((c) => ({ id: c.id, label: c.label, kind: c.kind, saliencia: c.saliencia ?? null,
    anclas: (c.anclas ?? []).map((a) => ({ ...(a.shot ? { shot: a.shot } : {}), ...(a.t ? { t: a.t } : {}), ...(a.entidad ? { entidad: a.entidad } : {}), ...(a.param ? { param: a.param } : {}), ...(a.rol ? { rol: a.rol } : {}) })) }));
  for (const c of concepts) for (const a of c.anclas) { if (a.param && params[a.param]) params[a.param].concepts.push(c.id); a.shots = a.shot ? [a.shot] : a.param ? [a.param.split('/')[2]] : a.t ? shots.filter((s) => s.t[0] < a.t[1] && s.t[1] > a.t[0]).map((s) => s.id) : []; }
  for (const P of Object.values(params)) { P.readers.sort(); P.possible = [...new Set(P.possible)].sort(); P.concepts.sort(); }
  const relations = (mem?.relaciones ?? []).map((r) => ({ tipo: r.tipo, de: r.de, a: r.a, ...(r.t != null ? { t: r.t } : {}) }));
  return { schema: SEM_SCHEMA, vocab: VERSION, film: path.relative(root, tf), duration: tl.duration, fps: tl.fps ?? 30, shots, concepts, relations, objects: objects.sort((a, b) => a.shot.localeCompare(b.shot)), params: Object.fromEntries(Object.entries(params).sort(([a], [b]) => a.localeCompare(b))) };
}

// ¿dónde aparece X? X = concepto (id/label), kind, tipo de relación, escala, tipo/id de objeto, nombre de param, o un sinónimo → se canoniza.
export function where(I, term) {
  const raw = String(term), c = canon(raw) ?? raw, w = [raw.toLowerCase(), String(c).toLowerCase()], hits = [];
  const eq = (x) => x != null && w.includes(String(x).toLowerCase());
  for (const k of I.concepts) if (eq(k.id) || eq(k.label) || eq(k.kind)) hits.push({ kind: 'concepto', id: k.id, label: k.label, ckind: k.kind, shots: [...new Set(k.anclas.flatMap((a) => a.shots ?? []))], t: k.anclas.filter((a) => a.t).map((a) => a.t), anclas: k.anclas.length });
  for (const r of I.relations) if (eq(r.tipo)) hits.push({ kind: 'relación', id: `${r.de} -${r.tipo}→ ${r.a}`, t: r.t ?? null });
  for (const s of I.shots) if (eq(s.scale) || eq(s.size)) hits.push({ kind: 'plano', id: s.id, t: s.t, scale: s.scale });
  for (const o of I.objects) if (eq(o.type) || eq(o.id)) hits.push({ kind: 'objeto', id: o.id, shot: o.shot, otype: o.type, semantic: o.semantic });
  for (const [p, P] of Object.entries(I.params)) if (eq(P.name) || eq(p)) hits.push({ kind: 'param', id: p, shot: P.shot, readers: P.readers, concepts: P.concepts });
  const out = { term: raw, canonical: canon(raw), hits };
  if (!hits.length) { const pool = sections().flatMap((s) => terms(s)); out.suggest = suggest(raw, pool) ?? null; }
  return out;
}
// ¿qué objetos dependen del param Y? (nombre o ruta /shots/ID/params/n)
export function dependsOn(I, param) {
  const p = String(param), keys = Object.keys(I.params).filter((k) => k === p || I.params[k].name === p);
  return { param: p, matches: keys.map((k) => ({ path: k, shot: I.params[k].shot, objects: I.params[k].readers, possible: I.params[k].possible, concepts: I.params[k].concepts })) };
}

// ── OTIO ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const RT = (v, rate) => ({ OTIO_SCHEMA: 'RationalTime.1', rate, value: v });
const TR = (start, dur, rate) => ({ OTIO_SCHEMA: 'TimeRange.1', start_time: RT(start, rate), duration: RT(dur, rate) });
const COLORS = { entidad: 'BLUE', regla: 'GREEN', pregunta: 'YELLOW', 'tensión': 'RED', 'revelación': 'PINK', 'emoción': 'ORANGE', motivo: 'PURPLE', tema: 'CYAN' };
export function toOtio(I) {
  const rate = I.fps, F = (t) => Math.round(t * rate), total = F(I.duration);
  // pistas sin solapes: primer hueco libre
  const tracks = [];
  for (const s of [...I.shots].sort((a, b) => a.t[0] - b.t[0] || a.id.localeCompare(b.id))) {
    let tr = tracks.find((x) => x.end <= F(s.t[0])); if (!tr) { tr = { items: [], end: 0 }; tracks.push(tr); }
    const a = F(s.t[0]), b = Math.min(total, F(s.t[1]));
    if (a > tr.end) tr.items.push({ OTIO_SCHEMA: 'Gap.1', name: '', source_range: TR(0, a - tr.end, rate), metadata: {}, effects: [], markers: [] });
    tr.items.push({ OTIO_SCHEMA: 'Clip.1', name: s.id, source_range: TR(0, b - a, rate), media_reference: { OTIO_SCHEMA: 'MissingReference.1', name: s.id, metadata: {}, available_range: null },
      metadata: { opus: { shot: s.id, size: s.size, scale: s.scale, text: s.text, action: s.action, dsl: s.dsl } }, effects: [], markers: [] });
    tr.end = b;
  }
  for (const tr of tracks) if (tr.end < total) tr.items.push({ OTIO_SCHEMA: 'Gap.1', name: '', source_range: TR(0, total - tr.end, rate), metadata: {}, effects: [], markers: [] });
  const markers = [], mk = (name, t, color, opus) => markers.push({ OTIO_SCHEMA: 'Marker.1', name, color, marked_range: TR(F(t), 0, rate), comment: '', metadata: { opus } });
  for (const c of I.concepts) { const seen = new Set(); for (const a of c.anclas) { const t = a.t ? a.t[0] : a.shots?.[0] != null ? I.shots.find((s) => s.id === a.shots[0])?.t[0] : null; if (t == null) continue; const k = `${t}|${a.rol ?? ''}`; if (seen.has(k)) continue; seen.add(k);
    mk(`${c.label}`, t, COLORS[c.kind] ?? 'BLACK', { concept: c.id, kind: c.kind, ...(a.rol ? { rol: a.rol } : {}), ...(a.shot ? { shot: a.shot } : {}), vocab: I.vocab }); } }
  for (const r of I.relations) if (r.t != null) mk(`${r.tipo}: ${r.de} → ${r.a}`, r.t, 'MAGENTA', { relation: r.tipo, de: r.de, a: r.a, vocab: I.vocab });
  markers.sort((a, b) => a.marked_range.start_time.value - b.marked_range.start_time.value || a.name.localeCompare(b.name));
  return { OTIO_SCHEMA: 'Timeline.1', name: path.basename(I.film).replace(/\.json$/, ''), global_start_time: RT(0, rate), metadata: { opus: { schema: SEM_SCHEMA, vocab: I.vocab, duration: I.duration } },
    tracks: { OTIO_SCHEMA: 'Stack.1', name: 'tracks', metadata: {}, effects: [], markers, source_range: null,
      children: tracks.map((t, i) => ({ OTIO_SCHEMA: 'Track.1', name: `V${i + 1}`, kind: 'Video', metadata: {}, effects: [], markers: [], source_range: null, children: t.items })) } };
}
// Validación de esquema OTIO básico (lo que un lector estricto exige de lo que exportamos).
export function checkOtio(T) {
  const e = []; const need = (c, m) => { if (!c) e.push(m); };
  need(T?.OTIO_SCHEMA === 'Timeline.1', 'Timeline.1'); need(T.tracks?.OTIO_SCHEMA === 'Stack.1', 'Stack.1');
  const rt = (x, w) => need(x?.OTIO_SCHEMA === 'RationalTime.1' && Number.isFinite(x.value) && x.rate > 0, `${w}: RationalTime.1`);
  const range = (x, w) => { need(x?.OTIO_SCHEMA === 'TimeRange.1', `${w}: TimeRange.1`); rt(x?.start_time, w + '.start'); rt(x?.duration, w + '.dur'); };
  for (const tr of T.tracks?.children ?? []) { need(tr.OTIO_SCHEMA === 'Track.1' && tr.kind === 'Video', 'Track.1');
    for (const c of tr.children) { need(['Clip.1', 'Gap.1'].includes(c.OTIO_SCHEMA), 'hijo ' + c.OTIO_SCHEMA); range(c.source_range, c.name); }
  }
  for (const m of T.tracks?.markers ?? []) { need(m.OTIO_SCHEMA === 'Marker.1', 'Marker.1'); range(m.marked_range, 'marker ' + m.name); }
  return e;
}
export const otioSum = (T) => T.tracks.children.map((t) => t.children.reduce((a, c) => a + c.source_range.duration.value, 0));
