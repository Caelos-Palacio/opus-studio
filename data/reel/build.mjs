#!/usr/bin/env node
// Autor del timeline del reel: la MÚSICA MANDA. Todos los instantes salen de la rejilla de tempo (data/reel/audio.json, de engine/grid.mjs):
// cada shot se declara en PULSOS (índice en `beats`), no en segundos; los sfx y los acentos, en fracciones de pulso desde el inicio del shot.
// Los cortes se cuantizan al fotograma POSTERIOR al pulso (el sonido nunca llega después de la imagen: el ojo tolera mal el vídeo adelantado).
//   node engine/grid.mjs                 (rejilla desde la partitura; hay que repetirlo si cambian el golpe o el estilo sonoro)
//   node data/reel/build.mjs             → data/reel/timeline.json
//   node engine/grid.mjs                 (otra vez: los onsets por instrumento dependen de las secciones, que dependen de los shots)
import fs from 'node:fs';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname), A = JSON.parse(fs.readFileSync(path.join(here, 'audio.json'), 'utf8')), B = A.beats, FPS = 30, DUR = 30;
const q = (t) => +(Math.ceil(t * FPS - 1e-6) / FPS).toFixed(5);                    // fotograma posterior
const bt = (x) => { const i = Math.floor(x); return i >= B.length - 1 ? B[B.length - 1] + (x - (B.length - 1)) * (B[B.length - 1] - B[B.length - 2]) : B[i] + (B[i + 1] - B[i]) * (x - i); };
const HIT = A.beats.findIndex((t) => Math.abs(t - A.hit) < 1e-3), REV0 = B.findIndex((t) => Math.abs(t - A.rev0) < 1e-3);
if (HIT < 0 || REV0 < 0) throw new Error('el golpe o el regreso no están en la rejilla: corre engine/grid.mjs');
const r = (x) => +x.toFixed(4);

// ── los shots, en pulsos. a,b = índices de `beats` (b: 'fin' = DUR). hits: pulsos (desde el inicio del shot) con acento visual+sonoro (on_beat_at).
//    sfx: [pulso, tipo, ganancia, dur?]. Cada shot lleva su porqué (action/on_beat) y su plano.
const S = [
  { id: 'K01', a: 0, b: 1, size: 'ECU', text: '¿', action: 'una ¿ lima gigante golpea el primer pulso y se asienta', on_beat: 'el golpe de la ¿ es el primer pulso del film', hits: [0], cam: { move: 'push', why: 'approach', amount: 0.05 }, sakuga: 'normal' },
  { id: 'K02', a: 1, b: 2, size: 'ECU', text: 'QUÉ', action: 'QUÉ entra a golpe, tembloroso (ruido); la ¿ queda de viñeta', on_beat: 'QUÉ cae en el pulso', hits: [0], cam: { move: 'push', why: 'approach', amount: 0.05 }, sakuga: 'normal' },
  { id: 'K03', a: 2, b: 4, size: 'CU', text: 'SUENA', action: 'SUENA tiembla; en el 2.º pulso se parte en tiras y canales', on_beat: 'pulso 1 entra; pulso 2 glitch', hits: [0, 1], cam: { move: 'push', why: 'approach', amount: 0.06 }, sakuga: 'normal' },
  { id: 'K04', a: 4, b: 5, size: 'ECU', text: 'CUANDO', action: 'CUANDO barre de izquierda a derecha en un pulso', on_beat: 'el barrido termina en el pulso', hits: [0], cam: { move: 'push', why: 'approach', amount: 0.04 }, sakuga: 'normal' },
  { id: 'K05', a: 5, b: 6, size: 'MS', text: 'TODO SE', action: 'TODO y SE caen letra a letra', on_beat: 'las letras de TODO caen escalonadas', hits: [0], cam: { move: 'push', why: 'approach', amount: 0.04 }, sakuga: 'normal' },
  { id: 'K06', a: 6, b: 8, size: 'CU', text: 'ROMPE', action: 'ROMPE aparece; en el 2.º pulso se agrieta y cae la ? lima', on_beat: 'pulso 2: grietas y la ? golpea', hits: [0, 1], cam: { move: 'push', why: 'approach', amount: 0.06 }, sakuga: 'normal' },
  { id: 'K07', a: 8, b: 12, size: 'WS', text: 'CRAC TAC PUM CLIC BUM', action: 'golpes sueltos (onomatopeyas) en síncopa 3+3+4+3+3 semicorcheas: ruido', on_beat: 'cada golpe cae en una semicorchea fuera del pulso', hits: [0], cam: { move: 'static' }, sakuga: 'normal',
    sfx: [[0, 'click', 0.9], [0.75, 'tick', 0.8], [1.5, 'pop', 0.9], [2.5, 'click', 0.8], [3.25, 'pop', 1.1]] },
  { id: 'K08', a: 12, b: 16, size: 'WS', text: 'TIC TAC TIC CLAC TIC TAC PUM CRAC', action: 'ocho golpes en corcheas con síncopa: el ruido empieza a repetirse y la rejilla asoma', on_beat: 'corcheas con acentos que rotan', hits: [0], cam: { move: 'static' }, sakuga: 'normal',
    sfx: [[0, 'tick', 0.8], [0.5, 'click', 0.7], [1, 'tick', 0.8], [1.75, 'pop', 0.9], [2, 'tick', 0.8], [2.5, 'click', 0.7], [3.25, 'pop', 1], [3.5, 'click', 0.9]] },
  { id: 'K09', a: 16, b: 20, size: 'WS', text: 'PUM TIC CLAC TOC', action: 'cuatro filas de secuenciador entran una por pulso; cada una se enciende con su instrumento', on_beat: 'una fila nueva por pulso', hits: [0], cam: { move: 'push', why: 'approach', amount: 0.04 }, sakuga: 'normal' },
  { id: 'K10', a: 20, b: 24, size: 'WS', text: 'PUM TIC CLAC TOC', action: 'las cuatro filas ya clavadas a la rejilla laten con bombo, hats, caja y toms', on_beat: 'cada fila reacciona a su pista de audio', hits: [0], cam: { move: 'push', why: 'approach', amount: 0.05 }, sakuga: 'normal' },
  { id: 'K11', a: 24, b: 28, size: 'MS', text: 'PUM TIC CLAC TOC', action: 'cuenta atrás de filas: 4, 3, 2, 1; las que quedan crecen', on_beat: 'en cada pulso se va una fila', hits: [0, 2], cam: { move: 'push', why: 'approach', amount: 0.06 }, sakuga: 'normal' },
  { id: 'K12', a: 28, b: 32, size: 'CU', text: 'A COMPÁS', action: 'A COMPÁS; un cursor lima barre el compás y numera sus 4 pulsos', on_beat: '1 2 3 4: un barrido por pulso', hits: [0], cam: { move: 'push', why: 'approach', amount: 0.08 }, sakuga: 'normal' },
  { id: 'K13', a: 32, b: 34, size: 'ECU', text: 'TODO', action: 'TODO a pantalla completa; entra con el crescendo y se tensa', on_beat: 'pulso 1 golpe; pulso 2 estroboscopio', hits: [0, 1], cam: { move: 'push', why: 'approach', amount: 0.14 }, sakuga: 'normal' },
  { id: 'K14', a: 34, b: 36, size: 'ECU', text: 'SE', action: 'SE más grande que la pantalla; vibra sin parar', on_beat: 'pulso 1 golpe; pulso 2 estroboscopio', hits: [0, 1], cam: { move: 'push', why: 'approach', amount: 0.16 }, sakuga: 'normal' },
  { id: 'K15', a: 36, b: 38, size: 'ECU', text: 'ROMPE', action: 'R-O-M-P-E, una letra por semicorchea, y la palabra entera titila', on_beat: 'cinco golpes en semicorcheas', hits: [], cam: { move: 'static' }, sakuga: 'normal',
    sfx: [[0, 'tick', 0.8], [0.2, 'tick', 0.8], [0.4, 'tick', 0.85], [0.6, 'tick', 0.9], [0.8, 'tick', 1]] },
  { id: 'K16', a: 38, b: 39, size: 'WS', text: 'ROMPE', action: 'la palabra se contrae hasta un punto: el aire se retira', on_beat: 'inspiración: todo converge en el punto', hits: [], cam: { move: 'static' }, sakuga: 'simple' },
  { id: 'K17', a: 39, b: HIT, size: 'EWS', text: '.', action: 'negro y un punto lima: el vacío antes del golpe', on_beat: 'silencio', hits: [], cam: { move: 'static' }, sakuga: 'simple', hold_ok: [[0, 'fin']] },
  { id: 'K18', a: HIT, b: HIT + 2, size: 'ECU', text: 'ROMPE', action: 'impact frame: ROMPE negro sobre blanco, estalla en esquirlas con smear y canales; onda de choque lima', on_beat: 'el golpe: fotograma 0 negativo, 1 rayos, 2.. esquirlas', hits: [0], cam: { move: 'pull', why: 'reveal', amount: 0.12 }, sakuga: 'hero',
    sfx: [[0, 'impact', 1], [0, 'riser', 0.38, 3.6]], impact: true },
  { id: 'K19', a: HIT + 2, b: REV0, size: 'WS', text: '', action: 'respiro: las esquirlas flotan casi quietas; un punto lima respira', on_beat: 'silencio', hits: [], cam: { move: 'static' }, sakuga: 'simple', on: 3, hold_ok: [[0, 'fin']] },
  { id: 'K20', a: REV0, b: REV0 + 2, size: 'MS', text: 'LO ROTO', action: 'esquirlas de LO ROTO vuelan de vuelta y se encajan en el pulso 3', on_beat: 'el groove vuelve; LO ROTO encaja', hits: [0, 1.6], cam: { move: 'push', why: 'approach', amount: 0.05 }, sakuga: 'normal', sfx: [[1.5, 'whoosh', 0.7, 0.9]] },
  { id: 'K21', a: REV0 + 2, b: REV0 + 4, size: 'MS', text: 'LO ROTO VUELVE', action: 'VUELVE entra desde la izquierda y se pega bajo LO ROTO', on_beat: 'VUELVE golpea en el pulso', hits: [0], cam: { move: 'push', why: 'approach', amount: 0.04 }, sakuga: 'normal' },
  { id: 'K22', a: REV0 + 4, b: REV0 + 6, size: 'MS', text: 'LO ROTO VUELVE A SONAR', action: 'A SONAR entra desde la derecha y cierra el bloque justificado', on_beat: 'A SONAR golpea en el pulso', hits: [0], cam: { move: 'push', why: 'approach', amount: 0.04 }, sakuga: 'normal' },
  { id: 'K23', a: REV0 + 6, b: REV0 + 10, size: 'MS', text: 'LO ROTO VUELVE A SONAR', action: 'la frase completa late con el groove; una ola lima recorre las letras', on_beat: 'ola lima por letra al compás', hits: [0, 2], cam: { move: 'pull', why: 'reveal', amount: 0.05 }, sakuga: 'normal' },
  { id: 'K24', a: REV0 + 10, b: 'fin', size: 'CU', text: '.', action: 'la frase se contrae en un punto lima: respuesta y cierre (rima con la ¿)', on_beat: 'último golpe: el punto', hits: [0], cam: { move: 'static' }, sakuga: 'simple', hold_ok: [[1, 'fin']], sfx: [[0, 'shimmer', 0.7]] },
];

// ── enlaces señal → parámetro (por defecto en todos los shots; cada shot puede sobreescribir)
const BIND = { kick: { $sig: 'kick' }, snare: { $sig: 'snare' }, hat: { $sig: 'hat' }, tom: { $sig: 'tom' }, chaos: { $sig: 'chaos' }, lock: { $sig: 'lock' }, shock: { $sig: 'shock' }, tension: { $sig: 'tension' }, drift: { $sig: 'drift' } };
const OVERRIDE = {
  K10: { chaos: { $expr: "sig('chaos') * (1 - 0.6 * sig('kick'))" }, lock: { $expr: "min(1, sig('lock') + 0.25 * sig('hat'))" } },
  K13: { tension: { $expr: "sig('tension') * (0.7 + 0.3 * sig('kick'))" } },
  K14: { tension: { $expr: "sig('tension') * (0.7 + 0.3 * sig('kick'))" } },
  K18: { shock: { $expr: "sig('shock') + 0.25 * sig('kick')" } },
  K23: { drift: { $expr: "sig('drift') * 0.5 + sig('kick') * 0.5" } },
};

const shots = S.map((s) => {
  const t0 = s.a === 0 ? 0 : q(B[s.a]), t1 = s.b === 'fin' ? DUR : q(B[s.b]), len = t1 - t0, abs = (k) => bt(s.a + k) - t0;   // pulso fraccionario k → segundos desde el inicio del shot
  const sh = { id: s.id, t: [t0, +t1.toFixed(5)], size: s.size, action: s.action, on_beat: s.on_beat };
  if (s.hits.length) sh.on_beat_at = s.hits.map((k) => Math.max(0, r(abs(k))));   // el esquema exige ≥ 0: si el corte cuantizado cae tras el pulso, el acento nace con el shot (≤ 1 fotograma tarde)
  sh.text = s.text; sh.transition_out = 'cut'; sh.must_read_mute = true;
  if (s.hold_ok) sh.hold_ok = s.hold_ok.map(([a, b]) => [r(a === 'fin' ? 0 : a), r(b === 'fin' ? len - (s.id === 'K17' ? 0.01 : 0) : b)]);
  sh.cam = { ...s.cam, ...(s.cam.move !== 'static' ? { ease: 'outExpo' } : {}) };
  sh.sakuga = s.sakuga; if (s.on) sh.on = s.on;
  if (s.sfx) sh.sfx = s.sfx.map(([k, type, gain, dur]) => ({ at: r(abs(k)), type, gain, ...(dur ? { dur } : {}) }));
  sh.params = { ...BIND, ...(OVERRIDE[s.id] ?? {}) };
  sh.meta = { pulso: [s.a, s.b === 'fin' ? B.length : s.b], compases: +(((s.b === 'fin' ? B.length : s.b) - s.a) / 4).toFixed(2) };
  return sh;
});

const signals = {
  kick: { op: 'audio', feature: 'onsets', track: 'kick', decay: 0.14, attack: 0.004, description: 'envolvente de los bombos de la partitura (audio.json.tracks.kick)' },
  snare: { op: 'audio', feature: 'onsets', track: 'snare', decay: 0.1, attack: 0.003, description: 'cajas, palmas y redoble' },
  hat: { op: 'audio', feature: 'onsets', track: 'hat', decay: 0.05, attack: 0.002, description: 'hats' },
  tom: { op: 'audio', feature: 'onsets', track: 'tom', decay: 0.18, attack: 0.004, description: 'toms' },
  chaos: { op: 'keys', description: 'del ruido al orden: 1 = caos, 0 = rejilla; se desordena de golpe en el pico', keys: [
    { t: 0, v: 1 }, { t: r(B[8]), v: 1, ease: 'inOut' }, { t: r(B[16]), v: 0.7, ease: 'inOut' }, { t: r(B[24]), v: 0.3, ease: 'inOut' }, { t: r(B[32]), v: 0.12, ease: 'in' },
    { t: r(B[38]), v: 0.65, ease: 'out' }, { t: r(B[39]), v: 0 }, { t: A.hit, v: 1 }, { t: r(B[HIT + 2]), v: 0.4, ease: 'out' }, { t: A.rev0, v: 0.2, ease: 'out' }, { t: r(B[REV0 + 2]), v: 0 }] },
  lock: { op: 'keys', description: 'cuánto se pega todo a la rejilla (sube durante el enganche, se suelta en el golpe)', keys: [
    { t: 0, v: 0 }, { t: r(B[12]), v: 0, ease: 'inOut' }, { t: r(B[16]), v: 0.3, ease: 'inOut' }, { t: r(B[22]), v: 0.8, ease: 'inOut' }, { t: r(B[28]), v: 1 }, { t: A.hit - 0.001, v: 1 }, { t: A.hit, v: 0 }] },
  shock: { op: 'env', at: [A.hit, A.rev0], attack: 0, decay: 0.5, peak: 1.4, description: 'onda de choque: el golpe y el reencaje' },
  tension: { op: 'keys', description: 'tensión del crescendo: sube hasta el aire retenido y se vacía', keys: [
    { t: 0, v: 0 }, { t: r(B[24]), v: 0.1, ease: 'in' }, { t: r(B[32]), v: 0.5, ease: 'in' }, { t: r(B[38]), v: 1.3 }, { t: r(B[39]), v: 0 }] },
  drift: { op: 'lfo', freq: 0.31, amp: 1, shape: 'sine', description: 'respiración lenta' },
  nivel: { op: 'audio', feature: 'rms', gain: 6, description: 'nivel de la mezcla (audio.json.rms; lo escribe engine/grid.mjs --mix)' },
  pulso: { op: 'expr', expr: "clamp(sig('kick') + 0.5 * sig('snare'), 0, 1.5)", description: 'impulso total de percusión' },
};

const tl = {
  title: 'Pulso — ¿Qué suena cuando todo se rompe?', style: 'pulso', profile: 'reel',
  profileOverrides: { shotLen: [0.4, 3.2], readCps: 20 },
  fps: FPS, width: 1080, height: 1920, duration: DUR, end_hold_ok: true,
  sound: { style: 'electro', memoria: 'data/reel/memoria.json', overrides: { impact: { vacuum: r(A.hit - B[HIT - 1]) } } },
  signals, shots,
  meta: { generado: 'data/reel/build.mjs desde data/reel/audio.json (rejilla de engine/grid.mjs)', bpmGolpe: A.bpm, golpe: A.hit, respiroHasta: A.rev0 },
};
fs.writeFileSync(path.join(here, 'timeline.json'), JSON.stringify(tl, null, 1) + '\n');
console.log(`→ data/reel/timeline.json  ${shots.length} shots · golpe ${A.hit}s (pulso ${HIT}) · regreso ${A.rev0}s (pulso ${REV0}) · cortes: ${shots.map((s) => s.t[0].toFixed(3)).join(' ')}`);
