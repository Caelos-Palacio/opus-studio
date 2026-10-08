#!/usr/bin/env node
// Film VEINTICUATRO (E2b): BDD de lo que el film pide al motor y de sus datos reales.
//   V1  la voz `gota` (clic de agua) sube de altura con la energía del evento y la voz `nota` existe (v1, v2 y esquema)
//   V2  el ritmo es REAL: 9.º→10.º destello de Kamiokande-II = 7,304 s; IMB 8 en < 6 s; Baksan 5 en 9,1 s
//   V3  la pausa es silencio REAL: ningún evento sonoro entre el 9.º destello (+reverb) y el 10.º; sin música (bus ≤ −60 dB)
//   V4  el 12.º destello es dudoso (gota débil) y el total contado es 11+8+5 = 24
//   V5  el timeline y el story del film son válidos; el story es v2 con medio y fondo declarados
// Uso: node test/veinticuatro.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';
import { validateTimeline } from '../engine/schema.mjs';
import { VOICES } from '../engine/sound.mjs';

let n = 0, bad = 0;
const ok = (m, c, info = '') => { n++; console.log(`${c ? '✓' : '✗'} veinticuatro: ${m}${info ? '  ' + info : ''}`); if (!c) bad++; };
const rd = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const tl = rd('data/veinticuatro/timeline.json'), story = rd('data/veinticuatro/story.json');

// V1 ── voz gota: la altura sigue a la energía (cruces por cero del primer tramo) en la voz v1 y en la v2
const zcr = (x, a, b) => { let z = 0; for (let i = Math.floor(a) + 1; i < Math.floor(b); i++) if ((x[i - 1] < 0) !== (x[i] < 0)) z++; return z; };
{
  const SR = 48000, v1 = (en) => { const x = new Float32Array(SR / 2); VOICES.gota.fn({ seed: 1, energia: en }, (i, v) => { x[i] += v; }); return x; };
  const lo = v1(0.05), hi = v1(0.95);
  ok('V1 gota v1: más energía = más aguda', zcr(hi, 0.004 * SR, 0.06 * SR) > zcr(lo, 0.004 * SR, 0.06 * SR) * 1.5, `${zcr(lo, 192, 2880)} vs ${zcr(hi, 192, 2880)} cruces`);
  ok('V1 existen las voces gota y nota en v1', typeof VOICES.gota?.fn === 'function' && typeof VOICES.nota?.fn === 'function');
  const { build } = await import('../engine/sound.mjs');
  const mini = { title: 'mini', style: 'cosmos', profile: 'cinematic', fps: 30, width: 640, height: 360, duration: 6, sound: { style: 'contemplativo', overrides: { sfx: { air: false }, mix: { bus: { music: -90 } }, impact: { tailKeep: 999 } } },
    shots: [{ id: 'M1', t: [0, 6], size: 'WS', action: 'prueba', text: '', cam: { move: 'static' }, transition_out: 'cut', sfx: [{ at: 1, type: 'gota', gain: 0.8, energia: 0.05 }, { at: 3, type: 'gota', gain: 0.8, energia: 0.95 }, { at: 4, type: 'nota', gain: 0.5, dur: 1.5 }] }] };
  const b = build(mini, { memoria: null, tag: 'test-veinticuatro' }), ev = b.events.filter((e) => e.type === 'gota').sort((p, q) => p.t - q.t), x0 = b.renderEvent(ev[0]), x1 = b.renderEvent(ev[1]);
  ok('V1 gota v2: la energía fija la altura (f0 y cruces)', ev.length === 2 && ev[1].p.f0 > ev[0].p.f0 * 2 && zcr(x1, 192, 2880) > zcr(x0, 192, 2880), `f0 ${ev[0]?.p.f0.toFixed(0)} → ${ev[1]?.p.f0.toFixed(0)} Hz`);
  ok('V1 nota v2: suena (no es silencio) y entra despacio', (() => { const e = b.events.find((q) => q.type === 'nota'), x = b.renderEvent(e); let a = 0, c = 0; for (let i = 0; i < SR * 0.3; i++) a = Math.max(a, Math.abs(x[i])); for (let i = SR * 0.7; i < SR * 1.1; i++) c = Math.max(c, Math.abs(x[i])); return c > 1e-3 && a < c * 0.5; })());
}

// V2 ── ritmo real (tiempos de la tabla publicada; los de los extremos vienen de docs/guiones/veinticuatro.md)
const gotas = tl.shots.flatMap((s) => (s.sfx ?? []).filter((e) => e.type === 'gota').map((e) => ({ t: s.t[0] + e.at, shot: s.id, e })));
const by = (ids) => gotas.filter((g) => ids.includes(g.shot)).sort((a, b) => a.t - b.t);
const kam = by(['V02', 'V04', 'V05']), imb = by(['V06']), bak = by(['V07']);
ok('V2 Kamiokande-II: 12 filas; 9 en 1,915 s', kam.length === 12 && Math.abs(kam[8].t - kam[0].t - 1.915) < 0.003, `${kam.length} filas, ${(kam[8]?.t - kam[0]?.t).toFixed(3)} s`);
ok('V2 la pausa REAL entre el 9.º y el 10.º destello es 7,304 s', Math.abs(kam[9].t - kam[8].t - 7.304) < 0.003, `${(kam[9].t - kam[8].t).toFixed(3)} s`);
ok('V2 el 12.º cae a 12,439 s del primero', Math.abs(kam[11].t - kam[0].t - 12.439) < 0.003);
ok('V2 IMB: 8 eventos en menos de 6 s', imb.length === 8 && imb[7].t - imb[0].t < 6 && imb[7].t - imb[0].t > 5.5);
ok('V2 Baksan: 5 eventos en 9,1 s', bak.length === 5 && Math.abs(bak[4].t - bak[0].t - 9.099) < 0.003);

// V3 ── el silencio de la pausa es real
const t9 = kam[8].t, t10 = kam[9].t, ev = tl.shots.flatMap((s) => (s.sfx ?? []).map((e) => ({ t: s.t[0] + e.at, type: e.type, dur: e.dur })));
const dentro = ev.filter((e) => e.t > t9 + 0.6 && e.t < t10 - 0.02 || (e.dur && e.t < t10 && e.t + e.dur > t9 + 0.6 && e.t > t9 + 0.01));
ok('V3 ningún evento sonoro (ni drone) dentro de la pausa', dentro.length === 0, JSON.stringify(dentro));
ok('V3 sin música: bus de música ≤ −60 dB y sin pista', tl.music == null && tl.sound.overrides.mix.bus.music <= -60);
ok('V3 el audio analizado ve la pausa como silencio ≥ 6 s', (() => { try { const a = rd('data/veinticuatro/audio.json'); return a.silences.some(([x, y]) => x <= t9 + 0.7 && y >= t10 - 0.2 && y - x >= 6); } catch { return false; } })());

// V4 ── el 12.º es dudoso y la cuenta es 24
ok('V4 el 12.º destello suena débil (gain < 0,3) y los demás no', kam[11].e.gain < 0.3 && kam.slice(0, 11).every((g) => g.e.gain >= 0.3));
ok('V4 11 + 8 + 5 = 24 aceptados', kam.length - 1 + imb.length + bak.length === 24);

// V5 ── datos válidos
const r = validateTimeline(tl), fixes = r.filter((i) => i.level === 'FIX');
ok('V5 el timeline valida (0 FIX de esquema)', fixes.length === 0, JSON.stringify(fixes).slice(0, 200));
ok('V5 story v2 con medio, fondo declarado y cierre en silencio', story.v === 2 && story.medium?.id === 'cuba_oscura' && story.cierre?.tipo === 'silencio' && story.giro?.t === 48);
ok('V5 todas las escenas V01–V12 existen y están al día', tl.shots.every((s) => fs.existsSync(path.join(ROOT, `shots/${s.id}.scene.json`)) && fs.existsSync(path.join(ROOT, `shots/${s.id}.mjs`))));
ok('V5 el film respeta el tic: «Contamos» 3 veces en pantalla', tl.shots.map((s) => s.text).join(' ').match(/contamos/gi)?.length === 3);

console.log(bad ? `\n${bad} fallos de ${n}` : `\n${n} comprobaciones OK`);
process.exit(bad ? 1 : 0);
