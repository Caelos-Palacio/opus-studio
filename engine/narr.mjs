#!/usr/bin/env node
// Lint narrativo (spec 013, research 11 §5): el SUELO negativo del storytelling. Determinista, sin red ni LLM.
//   node engine/narr.mjs [film|ruta/story.json] [--json]      (npm run narr; sin argumento: todos los films del repo)
//   node engine/narr.mjs frescura <story.json|film>           test de frescura (7 criterios 0–2, vetos)
// Lo positivo (gracia, alma, voz que suena a alguien) NO se lintea: lo juzga el usuario. Sin score global (Goodhart).
// Niveles nominales: FIX solo en schema.v2, ancla.visible, ancla.dato, cliche.apertura/cierre (grupos A y C), cierre.moraleja,
// frescura.registro, diversidad.oleada y narr_ok.sin_porque. Un story v1 se informa siempre como WARN (effLevel): el gate de
// master exige 0 FIX narrativos solo si el film es v2. Excepciones: story.narr_ok = [{check, porque}] (sin porqué = FIX).
// Salida: out/narr.json. Sin film en la 1.ª línea (analiza el repo entero, no el film activo).
import './help.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { isMain, rootFrom } from './paths.mjs';
import { validateStorySchema } from './inputs.mjs';

const ROOT = rootFrom(import.meta.url);
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
export const ANTI = read('data/anticliche.es.json');
export const ARCCFG = read('engine/arc.json');
export const FIX_CHECKS = ['schema.v2', 'ancla.visible', 'ancla.dato', 'cliche.apertura', 'cliche.cierre', 'cierre.moraleja', 'frescura.registro', 'diversidad.oleada', 'narr_ok.sin_porque'];
export const CHECKS = ['schema.v2', 'ancla.visible', 'ancla.dato', 'abstracto.densidad', 'concreto.ratio', 'cliche.apertura', 'cliche.cierre', 'cliche.poster', 'paralelismo.neg', 'triada', 'pregunta.plantilla', 'pregunta.apertura_y_cierre', 'spine.metronomo', 'ritmo.beats_cv', 'ritmo.frases_cv', 'giro.posicion', 'cierre.eco', 'cierre.moraleja', 'voz.coherencia', 'voz.tic', 'imperfeccion.presente', 'frescura.registro', 'frescura.archivo', 'diversidad.oleada'];
export const UMBRAL = { abstracto: 4, concreto: 0.8, beatsCv: 0.30, frasesCv: 0.45, frasesMin: 8, giro: [0.55, 0.92], giroTol: 0.05, eco: 0.5, archivo: 0.3, tic: [2, 6], puntos: 10 };
export const VETADOS = ['ancla', 'pregunta', 'hecho_raro', 'distancia_default'];
export const CRITERIOS = ['ancla', 'pregunta', 'hecho_raro', 'giro_relee', 'apuesta', 'distancia_default', 'distancia_archivo'];

// ───────── texto ─────────
export const norm = (s) => String(s ?? '').toLowerCase().replace(/ñ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\u0001/g, 'ñ').replace(/\s+/g, ' ').trim();
export const stripQuotes = (s) => String(s ?? '').replace(/«[^»]*»|“[^”]*”|"[^"\n]*"/g, ' ');   // las citas se respetan (como el lint de vocab)
const words = (s) => norm(s).split(/[^a-zñ0-9]+/).filter(Boolean);
const STOP = new Set('para pero como esto esta este esos esas unos unas sobre entre desde hasta cada todo toda cuando donde porque sino cuyo tiene tienen ante bajo tras con sin por los las del una que mas muy son ser fue hay'.split(' '));
const kw = (s, n = 4) => [...new Set(words(s).filter((w) => w.length >= n && !STOP.has(w)))];
const jaccard = (a, b) => { const A = new Set(a), B = new Set(b); if (!A.size || !B.size) return 0; let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i); };
const mean = (a) => (a.length ? a.reduce((p, q) => p + q, 0) / a.length : 0);
const cv = (a) => { const m = mean(a); return m ? Math.sqrt(mean(a.map((x) => (x - m) ** 2))) / m : 0; };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RX = new Map();
const rxOf = (e) => { const k = e.re ?? e.p; if (!RX.has(k)) RX.set(k, new RegExp(e.re ?? `(?<![a-zñ0-9])${esc(norm(e.p))}(?![a-zñ0-9])`, 'u')); return RX.get(k); };
const hits = (text, entries) => { const n = norm(stripQuotes(text)); return entries.map((e) => rxOf(e).exec(n)?.[0]).filter(Boolean); };
const mk = (check, level, problem, remedy, t = 0) => ({ check, level, problem, remedy, t });

// ───────── checks ─────────
// ctx: { texts:[{t,end,text,shot,action,hold,sfx}], duration, others:[{key,story,duration}] , shots }
export function checkStory(story, ctx = {}) {
  const I = [], v2 = story?.v === 2, texts = ctx.texts ?? [], others = ctx.others ?? [], beats = [...(story?.beats ?? [])].filter((b) => typeof b?.t === 'number');
  const D = ctx.duration ?? (beats.length ? beats[beats.length - 1].t * 1.15 : 0), add = (...a) => I.push(mk(...a));
  const screen = texts.filter((x) => x.text).map((x) => x.text), idea = story?.idea ?? '';
  const lastBeat = beats[beats.length - 1], firstBeat = beats[0];

  // schema.v2
  if (v2) for (const e of validateStorySchema(story).filter((x) => x.level === 'FIX')) add('schema.v2', 'FIX', `story v2 ${e.path}: ${e.message}`, e.remedy || 'ver data/story.schema.json y data/story.template.json');

  // ancla
  const an = story?.ancla;
  if (v2 && an) {
    const lim = an.en_pantalla_antes_de ?? (D ? D * 0.15 : 8), keys = kw(`${an.objeto ?? ''} ${an.detalle ?? ''}`, 4);
    const vis = texts.filter((x) => x.t < lim).map((x) => `${x.text ?? ''} ${x.action ?? ''}`);
    const src = texts.length ? vis : beats.filter((b) => b.t < lim).map((b) => `${b.text} ${b.concreto ?? ''}`);
    const vw = new Set(words(src.join(' '))), seen = keys.filter((k) => vw.has(k) || [...vw].some((w) => w.length >= 5 && k.length >= 5 && (w.startsWith(k.slice(0, 5)) && k.startsWith(w.slice(0, 5)))));
    if (seen.length < Math.min(2, keys.length)) add('ancla.visible', 'FIX', `el ancla («${an.objeto}») no aparece en pantalla antes de ${lim}s (palabras vistas: ${seen.join(', ') || 'ninguna'})`, 'mostrar el objeto/detalle en un shot (texto o acción) antes de en_pantalla_antes_de, o subir ese límite', lim);
    const val = an.dato?.valor ?? '';
    if (!(/\d/.test(val) || /[a-zñ][A-ZÁÉÍÓÚÑ]|\s[A-ZÁÉÍÓÚÑ]/.test(val)) || !String(an.dato?.fuente ?? '').trim()) add('ancla.dato', 'FIX', `ancla.dato sin cifra/nombre propio o sin fuente (valor «${val}», fuente «${an.dato?.fuente ?? ''}»)`, 'dato = cifra, fecha o nombre propio, con fuente (verificar contra fuente primaria)');
  }

  // léxico: abstractos, concreto, clichés
  const corpus = [idea, ...beats.map((b) => b.text), ...screen].join(' '), nw = words(corpus).length || 1;
  const E = new Set(ANTI.grupos.E.palabras), nab = words(corpus).filter((w) => E.has(w)).length, dens = (nab / nw) * 100;
  if (dens > UMBRAL.abstracto) add('abstracto.densidad', 'WARN', `${dens.toFixed(1)} abstractos por 100 palabras (> ${UMBRAL.abstracto})`, 'cambiar abstractos (escala, idea, todo, tiempo…) por la cosa concreta');
  if (v2 && beats.length) { const r = beats.filter((b) => String(b.concreto ?? '').trim()).length / beats.length; if (r < UMBRAL.concreto) add('concreto.ratio', 'WARN', `solo el ${(r * 100).toFixed(0)} % de los beats declara \`concreto\` (< ${UMBRAL.concreto * 100} %)`, 'cada beat: qué cosa física ocurre'); }
  const F = ANTI.grupos.F.entradas, Z = (z) => F.filter((e) => e.zona === z);
  for (const b of beats) if (hits(b.text, Z('beats_sujeto')).length) { add('concreto.ratio', 'WARN', `beat ${b.id ?? ''} con sujeto genérico: «${b.text}»`, 'nombrar el objeto (material, rasgo)', b.t); break; }
  const open = [story?.question?.text, firstBeat?.text, ...screen.slice(0, 2)].filter(Boolean), A = ANTI.grupos.A.entradas;
  const ha = open.flatMap((x) => hits(x, A)); if (ha.length) add('cliche.apertura', 'FIX', `apertura de cliché: «${[...new Set(ha)].join('», «')}»`, 'abrir con el objeto o el hecho; si es una cita, ponerla entre «…»; o narr_ok con porqué');
  const close = [lastBeat?.text, story?.cierre?.ultima_linea, ...screen.slice(-2)].filter(Boolean), C = ANTI.grupos.C.entradas;
  const hc = close.flatMap((x) => hits(x, C)); if (hc.length) add('cliche.cierre', 'FIX', `cierre moralizante: «${[...new Set(hc)].join('», «')}»`, 'cortar antes de la moraleja (cierre corte/silencio/cicatriz)');
  const tail = beats.slice(-3).map((b) => b.text), tipo = story?.cierre?.tipo;
  if (tipo !== 'eco' && tail.some((x) => hits(x, Z('retorno')).length)) add('cliche.cierre', 'WARN', 'cierre con retorno ("vuelve…") en los últimos beats: plantilla de los films v1', 'el eco es una opción, no una regla: probar corte, golpe, cicatriz o silencio (o cierre.tipo "eco" con porqué)');
  if (close.some((x) => hits(x, Z('cierre')).length)) add('cliche.cierre', 'WARN', 'cierre en pregunta retórica', 'cerrar con un hecho, no con "¿…?"');
  const P = hits([idea, ...screen].join(' . '), ANTI.grupos.D.entradas); if (P.length) add('cliche.poster', 'WARN', `vocabulario de póster: «${[...new Set(P)].join('», «')}» (decir asombro no lo produce)`, 'mostrar el hecho en vez de calificarlo');
  const nb = [idea, ...screen].map((x) => hits(x, ANTI.grupos.B.entradas).length).reduce((p, q) => p + q, 0); if (nb >= ANTI.grupos.B.min) add('paralelismo.neg', 'WARN', `${nb} paralelismos/estructuras de plantilla ("no es X, es Y", "se trata de"…)`, 'afirmar directamente');
  const tri = [idea, ...screen].filter((x) => /(?:^|[ ,])[\p{L}\d]+(?: [\p{L}\d]+)?, [\p{L}\d]+(?: [\p{L}\d]+)?,? (?:y|o|e) [\p{L}\d]+/iu.test(stripQuotes(x)) && !/,.*,.*,/.test(x) ).length;
  if (tri >= 2) add('triada', 'WARN', `${tri} enumeraciones en tríada ("A, B y C")`, 'dos o cuatro elementos, o uno solo bien elegido');

  // pregunta
  const qt = story?.question?.text ?? '';
  if (qt) {
    const yn = /^¿?\s*(cabe|es|son|puede|pueden|hay|existe|existen|se puede|sera|esta|tiene|tienen)\b/.test(norm(qt)), nOtros = others.filter((o) => /^\s*¿/.test(o.story?.question?.text ?? '')).length;
    if (yn || (/^\s*¿/.test(qt) && nOtros >= 2)) add('pregunta.plantilla', 'WARN', yn ? `pregunta sí/no («${qt}»)` : `la apertura con "¿…?" ya la usan ${nOtros} films del archivo (plantilla)`, 'empezar por un objeto, una cifra o una afirmación que se pueda rebatir', story.question.posed_at ?? 0);
    if (/^\s*¿/.test(qt) && lastBeat && /¿/.test(lastBeat.text)) add('pregunta.apertura_y_cierre', 'WARN', 'el gancho y el último beat son ambos "¿…?"', 'cerrar sin pregunta', lastBeat.t);
  }

  // spine y ritmo
  const links = beats.slice(1).map((b) => norm(b.link ?? ''));
  if (beats.length >= 6) {
    const alt = links.length >= 5 && links.every((l, i) => l && (i === 0 || l !== links[i - 1])), counts = {}; for (const l of links) counts[l] = (counts[l] ?? 0) + 1;
    const top = Math.max(...Object.values(counts)) / links.length;
    if (alt || top > 0.7) add('spine.metronomo', 'WARN', alt ? 'conectores en alternancia estricta (metrónomo ABAB)' : `${(top * 100).toFixed(0)} % de los beats con el mismo conector`, 'romper el compás: un beat sin conector marcado, un giro doble, un beat largo');
  }
  const durs = beats.map((b, i) => (beats[i + 1]?.t ?? D) - b.t).filter((x) => x > 0);
  if (durs.length >= 3 && cv(durs) < UMBRAL.beatsCv) add('ritmo.beats_cv', 'WARN', `duraciones de beat uniformes (CV ${cv(durs).toFixed(2)} < ${UMBRAL.beatsCv})`, 'un beat corto (2 s) y otro largo (14 s)');
  const wl = screen.map((x) => words(x).length).filter(Boolean); if (wl.length >= UMBRAL.frasesMin && cv(wl) < UMBRAL.frasesCv) add('ritmo.frases_cv', 'WARN', `longitud de frases en pantalla uniforme (CV ${cv(wl).toFixed(2)} < ${UMBRAL.frasesCv})`, 'mezclar frases de 1 palabra con otras de 12');

  // giro
  const gt = v2 ? story?.giro?.t ?? story?.accommodation?.t : story?.accommodation?.t, forma = story?.forma ?? 'causal', fm = ARCCFG.formas?.[forma] ?? ARCCFG.formas.causal;
  if (typeof gt === 'number' && D) {
    const pos = gt / D, w = fm.giroPos ?? UMBRAL.giro, prev = others.filter((o) => o.duration && typeof (o.story?.giro?.t ?? o.story?.accommodation?.t) === 'number').map((o) => ({ key: o.key, pos: (o.story?.giro?.t ?? o.story.accommodation.t) / o.duration }));
    const same = prev.filter((o) => Math.abs(o.pos - pos) <= UMBRAL.giroTol);
    if (pos < w[0] || pos > w[1]) add('giro.posicion', 'WARN', `giro al ${(pos * 100).toFixed(0)} % (fuera de ${w.map((x) => x * 100).join('–')} % para forma ${forma})`, 'mover el giro', gt);
    else if (same.length) add('giro.posicion', 'WARN', `giro al ${(pos * 100).toFixed(0)} %: coincide (±${UMBRAL.giroTol * 100} pts) con ${same.map((o) => `${o.key} ${(o.pos * 100).toFixed(0)} %`).join(', ')}`, 'predecibilidad estructural: probar otra posición del giro', gt);
  }
  if (firstBeat && lastBeat && beats.length >= 2 && tipo !== 'eco') { const j = jaccard(kw(firstBeat.text, 4), kw(lastBeat.text, 4)); if (j > UMBRAL.eco) add('cierre.eco', 'WARN', `último beat solapa ${(j * 100).toFixed(0)} % con el primero sin cierre.tipo "eco"`, 'declarar el eco (con porqué) o cambiar el cierre', lastBeat.t); }
  if (v2 && tipo === 'eco' && !String(story.cierre.porque ?? '').trim()) add('cierre.eco', 'WARN', 'cierre "eco" sin `porque`', 'justificar por qué el retorno es la mejor opción aquí');
  const lastT = [lastBeat?.text, story?.cierre?.ultima_linea].filter(Boolean).map((x) => norm(stripQuotes(x)));
  const MOR = /\b(tu eres|tu seras|eres el|todos somos|somos|siempre|para siempre|nunca mas)\b|\b(tu|te|tus)\b.*\b(esencia|verdad|vida|mundo|tiempo|universo|todo|sentido)\b/;
  if (lastT.some((x) => MOR.test(x))) add('cierre.moraleja', 'FIX', `moraleja en el cierre: «${lastBeat?.text ?? story.cierre.ultima_linea}»`, 'cortar antes de explicar quién es el paso cero; que el objeto cierre', lastBeat?.t ?? 0);

  // voz
  const vz = story?.voz;
  if (vz) {
    const nt = norm(stripQuotes([idea, ...screen].join(' . '))), bad = { impersonal: /\b(yo|me|mi|nosotros|tu|te|usted)\b/, tercera: /\b(yo|me|mi|nosotros|tu|te|usted)\b/, yo: /\b(tu|tus|nosotros|usted)\b/, nosotros: /\b(yo|tu|usted)\b/, tu: /\b(yo|nosotros)\b/ }[vz.persona];
    const m = bad?.exec(nt); if (m) add('voz.coherencia', 'WARN', `persona declarada «${vz.persona}» pero aparece «${m[0]}» en pantalla`, 'ajustar el texto a la persona (o la persona a la voz)');
    for (const pr of vz.prohibido ?? []) if (new RegExp(`(?<![a-zñ0-9])${esc(norm(pr))}(?![a-zñ0-9])`).test(nt)) add('voz.coherencia', 'WARN', `aparece la palabra prohibida por la voz: «${pr}»`, 'quitarla');
    if (vz.tic) {
      const q = /['«"“]([^'»"”]+)['»"”]/.exec(vz.tic), tic = norm(q ? q[1] : vz.tic), n = (norm([...(screen.length ? screen : beats.map((b) => b.text)), ...(story.narration ?? []).map((x) => x.text)].join(' . ')).match(new RegExp(`(?<![a-zñ0-9])${esc(tic)}(?![a-zñ0-9])`, 'g')) ?? []).length;
      if (n < UMBRAL.tic[0] || n > UMBRAL.tic[1]) add('voz.tic', 'WARN', `el tic «${tic}» aparece ${n} veces en pantalla (esperado ${UMBRAL.tic.join('–')})`, 'repetirlo lo justo para que sea un tic y no un ruido');
    }
  }

  // imperfección
  for (const im of story?.imperfeccion ?? []) {
    if (!texts.length) break;
    const s = texts.find((x) => im.t >= x.t && im.t < (x.end ?? x.t + 1e9));
    const ev = s && ((s.hold ?? []).some(([a, b]) => im.t >= a && im.t <= b) || (s.sfx ?? []).some((f) => Math.abs((s.t + (f.at ?? 0)) - im.t) <= 1) || kw(im.que, 5).some((k) => norm(`${s.action ?? ''} ${s.text ?? ''}`).includes(k)));
    if (!s || !ev) add('imperfeccion.presente', 'WARN', `imperfección a ${im.t}s («${im.que}») sin evento en el timeline (hold, sfx o acción que la nombre)`, 'darle un shot/hold/sfx que la haga visible', im.t);
  }

  // frescura
  if (v2 && story?.frescura) {
    const fr = frescura(story, ctx); if (!fr.ok) add('frescura.registro', 'FIX', `frescura ${fr.total}/14: ${fr.motivos.join('; ')}`, 'rehacer el concepto (docs/current/IDEACION.md) o subir los puntos con razón');
  }
  const mine = kw(`${idea} ${an?.objeto ?? ''} ${an?.detalle ?? ''}`, 5), sim = others.map((o) => ({ key: o.key, j: jaccard(mine, kw(`${o.story?.idea ?? ''} ${o.story?.ancla?.objeto ?? ''} ${o.story?.ancla?.detalle ?? ''}`, 5)) })).filter((x) => x.j > UMBRAL.archivo);
  if (sim.length) add('frescura.archivo', 'WARN', `solape de palabras clave con ${sim.map((x) => `${x.key} (${x.j.toFixed(2)})`).join(', ')} (> ${UMBRAL.archivo})`, 'otro tema o ángulo distinto del archivo');

  return applyOk(story, I);
}
export function applyOk(story, issues) {
  const oks = [].concat(story?.narr_ok ?? []), out = [];
  for (const o of oks) if (!String(o?.porque ?? '').trim()) out.push(mk('narr_ok.sin_porque', 'FIX', `narr_ok «${o?.check}» sin porqué`, 'toda excepción lleva su porqué'));
  for (const i of issues) {
    const ex = oks.find((o) => String(o?.porque ?? '').trim() && (o.check === i.check || i.check.startsWith(o.check + '.')));
    out.push(ex ? { ...i, level: 'EXC', nominal: i.level, problem: `${i.problem}  [excepción: ${ex.porque}]` } : i);
  }
  return out;
}
export const effLevel = (issue, story) => (issue.level === 'FIX' && story?.v !== 2 ? 'WARN' : issue.level);   // v1: nunca bloquea

// ───────── frescura (research §4.1) ─────────
export function frescura(story, ctx = {}) {
  const p = story?.frescura?.puntos ?? {}, motivos = [], total = CRITERIOS.reduce((s, k) => s + (Number.isInteger(p[k]) ? p[k] : 0), 0);
  for (const k of CRITERIOS) if (!Number.isInteger(p[k]) || p[k] < 0 || p[k] > 2) motivos.push(`criterio ${k} ausente o fuera de 0–2`);
  for (const k of VETADOS) if (p[k] === 0 || p[k] == null) motivos.push(`veto: ${k} = 0`);
  if (total < UMBRAL.puntos) motivos.push(`suma ${total} < ${UMBRAL.puntos}`);
  const txt = `${story?.idea ?? ''} ${story?.cierre?.ultima_linea ?? ''}`;
  if (hits(txt, ANTI.grupos.C.entradas).length) motivos.push('veto: cabe en un póster (moraleja)');
  const ob = kw(story?.ancla?.objeto ?? '', 4), E = new Set(ANTI.grupos.E.palabras);
  if (!ob.length || ob.every((w) => E.has(w))) motivos.push('veto: sin sustantivo concreto (ancla.objeto)');
  const mine = kw(`${story?.idea ?? ''} ${story?.ancla?.objeto ?? ''} ${story?.ancla?.detalle ?? ''}`, 5), maxJ = Math.max(0, ...(ctx.others ?? []).map((o) => jaccard(mine, kw(`${o.story?.idea ?? ''} ${o.story?.ancla?.objeto ?? ''} ${o.story?.ancla?.detalle ?? ''}`, 5))));
  const contrasta = []; if (p.distancia_archivo === 2 && maxJ > UMBRAL.archivo) { contrasta.push(`distancia_archivo=2 pero el solape medido es ${maxJ.toFixed(2)}`); motivos.push('distancia_archivo declarada no casa con el archivo'); }
  return { puntos: p, total, max: 14, ok: !motivos.length, motivos, contrasta };
}

// ───────── diversidad de una oleada ─────────
// entries: [{key, story, duration}] → issues. medio/tono repetidos = FIX; forma única en ≥3 y duraciones parecidas = WARN.
export function checkOleada(entries) {
  const I = [], by = (f) => { const m = new Map(); for (const e of entries) { const v = f(e); if (v) m.set(v, [...(m.get(v) ?? []), e.key]); } return [...m].filter(([, k]) => k.length > 1); };
  for (const [v, k] of by((e) => e.story?.medium?.id)) I.push(mk('diversidad.oleada', 'FIX', `medio «${v}» repetido en la oleada: ${k.join(', ')}`, 'un medio distinto por film (fase 0 de la ideación)'));
  for (const [v, k] of by((e) => norm(e.story?.tono?.primario ?? ''))) I.push(mk('diversidad.oleada', 'FIX', `tono «${v}» repetido en la oleada: ${k.join(', ')}`, 'un tono distinto por film'));
  const fs_ = new Set(entries.map((e) => e.story?.forma ?? 'causal')); if (entries.length >= 3 && fs_.size === 1) I.push(mk('diversidad.oleada', 'WARN', `todos los films de la oleada usan la forma «${[...fs_][0]}»`, 'alternar formas (kisho, espiral, cuenta_atras)'));
  const ds = entries.map((e) => e.duration).filter(Boolean); if (ds.length >= 3 && Math.max(...ds) / Math.min(...ds) < 1.15) I.push(mk('diversidad.oleada', 'WARN', 'las duraciones de la oleada son casi iguales', 'variar la duración (un reel y un largo)'));
  return I;
}

// ───────── descubrimiento de films ─────────
export function discover(root = ROOT) {
  const out = [], base = path.join(root, 'data'), dirs = [base, ...fs.readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => path.join(base, e.name))];
  for (const d of dirs) {
    const sp = path.join(d, 'story.json'); if (!fs.existsSync(sp)) continue;
    let story; try { story = JSON.parse(fs.readFileSync(sp, 'utf8')); } catch { continue; }
    const key = d === base ? 'main' : path.basename(d), tl = findTimeline(d, d === base ? null : key, base);
    out.push({ key, storyPath: path.relative(root, sp), story, ...loadTimeline(tl) });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}
function findTimeline(d, key, base) {
  const c = key ? [path.join(d, 'timeline.json'), path.join(d, `${key}.json`)] : [path.join(base, 'timeline.json')];
  for (const f of c) if (fs.existsSync(f)) return f;
  if (key) for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.json') && x !== 'story.json')) { try { const j = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); if (Array.isArray(j.shots)) return path.join(d, f); } catch {} }
  return null;
}
export function loadTimeline(f) {
  if (!f) return { duration: 0, texts: [] };
  try {
    const tl = JSON.parse(fs.readFileSync(f, 'utf8'));
    return { timeline: f, duration: tl.duration ?? 0, texts: (tl.shots ?? []).map((s) => ({ t: s.t[0], end: s.t[1], text: typeof s.text === 'string' ? s.text : '', shot: s.id, action: s.action ?? '', hold: s.hold_ok ?? [], sfx: s.sfx ?? [] })) };
  } catch { return { duration: 0, texts: [] }; }
}

// Analiza todos los films (cada uno contra el resto como archivo; oleadas por story.oleada).
export function analyzeAll(root = ROOT) {
  const films = discover(root), res = films.map((f) => ({ ...f, issues: checkStory(f.story, { texts: f.texts, duration: f.duration, others: films.filter((o) => o !== f) }) }));
  const waves = {}; for (const f of res) if (f.story.oleada) (waves[f.story.oleada] ??= []).push(f);
  for (const [w, es] of Object.entries(waves)) for (const i of checkOleada(es)) for (const f of es) f.issues.push({ ...i, problem: `[oleada ${w}] ${i.problem}` });
  return res;
}
// Para el stage del lint: un film por ruta de story/timeline contra el archivo del repo.
export function analyzeOne(storyPath, timelinePath, root = ROOT) {
  const story = JSON.parse(fs.readFileSync(path.resolve(root, storyPath), 'utf8')), tl = loadTimeline(timelinePath ? path.resolve(root, timelinePath) : null);
  const all = discover(root), self = path.resolve(root, storyPath), others = all.filter((o) => path.resolve(root, o.storyPath) !== self);
  const issues = checkStory(story, { texts: tl.texts, duration: tl.duration, others });
  if (story.oleada) issues.push(...checkOleada([{ key: 'este', story, duration: tl.duration }, ...others.filter((o) => o.story.oleada === story.oleada)]));
  return { story, issues };
}

function pick(arg) {
  if (!arg) return null;
  const direct = path.resolve(ROOT, arg); if (fs.existsSync(direct) && direct.endsWith('.json')) { const k = path.basename(path.dirname(direct)); return { key: k, storyPath: path.relative(ROOT, direct), story: JSON.parse(fs.readFileSync(direct, 'utf8')), ...loadTimeline(findTimeline(path.dirname(direct), k, path.join(ROOT, 'data'))) }; }
  return discover().find((f) => f.key === arg) ?? null;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--')), json = process.argv.includes('--json');
  if (args[0] === 'frescura') {
    const f = pick(args[1]); if (!f) { console.error('uso: narr.mjs frescura <story.json|film>'); process.exit(2); }
    const others = discover().filter((o) => o.storyPath !== f.storyPath), r = frescura(f.story, { others });
    if (json) console.log(JSON.stringify(r, null, 1));
    else { console.log(`frescura ${f.key} (${f.storyPath})`); for (const k of CRITERIOS) console.log(`  ${k.padEnd(18)} ${r.puntos[k] ?? '-'}/2${VETADOS.includes(k) ? '  (veto si 0)' : ''}`); console.log(`  total ${r.total}/${r.max}  →  ${r.ok ? 'APTO' : 'VETADO'}`); for (const m of r.motivos) console.log(`  · ${m}`); for (const m of r.contrasta) console.log(`  · contraste: ${m}`); }
    process.exit(r.ok ? 0 : 1);
  }
  const all = analyzeAll(), sel = args[0] ? all.filter((f) => f.key === args[0] || f.storyPath === args[0]) : all;
  if (args[0] && !sel.length) { const f = pick(args[0]); if (!f) { console.error(`narr: no encuentro «${args[0]}»`); process.exit(2); } sel.push({ ...f, issues: checkStory(f.story, { texts: f.texts, duration: f.duration, others: all.filter((o) => o.storyPath !== f.storyPath) }) }); }
  const out = sel.map((f) => ({ film: f.key, story: f.storyPath, v: f.story.v ?? 1, issues: f.issues.map((i) => ({ ...i, level: effLevel(i, f.story), nominal: i.nominal ?? i.level })) }));
  let fixes = 0;
  if (!json) console.log('lint narrativo (spec 013): el suelo negativo; lo bueno lo juzga el usuario');
  for (const f of out) {
    const n = (l) => f.issues.filter((i) => i.level === l).length; fixes += n('FIX');
    if (!json) { console.log(`\n${f.film} (${f.story}, v${f.v})  FIX ${n('FIX')} · WARN ${n('WARN')}${n('EXC') ? ` · EXC ${n('EXC')}` : ''}`); for (const i of f.issues) console.log(`  ${i.level.padEnd(4)} ${i.check.padEnd(26)} ${i.problem}${i.remedy ? `  →  ${i.remedy}` : ''}`); }
  }
  try { fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'out/narr.json'), JSON.stringify({ films: out }, null, 1)); } catch {}
  if (json) console.log(JSON.stringify({ films: out }, null, 1)); else console.log(`\n${fixes ? `FIX (${fixes})` : 'OK'}  ${out.length} films`);
  process.exit(fixes ? 1 : 0);
}
