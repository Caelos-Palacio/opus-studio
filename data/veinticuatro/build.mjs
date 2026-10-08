// Genera data/veinticuatro/timeline.json (ritmo REAL de los eventos). Uso: node data/veinticuatro/build.mjs
// Tiempos relativos de los eventos (s): Kamiokande-II 12 filas (9 en 1,915 s; pausa 7,304 s; 3 de 9,219 a 12,439), IMB 8 en 6 s, Baksan 5 en 9,1 s.
// Fuentes y dudas: docs/guiones/veinticuatro.md. Los intermedios de cada serie son de la tabla publicada (a verificar contra el PRL).
import fs from 'node:fs';
export const KAM = [0, 0.107, 0.303, 0.324, 0.507, 0.686, 1.541, 1.728, 1.915, 9.219, 10.433, 12.439];
export const IMB = [0, 0.412, 0.650, 1.141, 1.562, 2.684, 5.010, 5.582];
export const BAK = [0, 0.435, 1.710, 7.687, 9.099];
export const F1 = 9.0, I0 = 26.0, B0 = 33.0;                       // instante (s del film) del primer destello de cada detector
const shot = (id, a, b, o) => ({ id, t: [a, b], transition_out: 'cut', after: null, ...o });
const S = [
  shot('V01', 0, 8.2, { size: 'EWS', action: 'agua negra; mil fotomultiplicadores como lunas lejanas con niebla fría y paralaje; no ocurre nada', text: 'Kamioka, mil metros bajo la roca. Una cuba de agua, mil fotomultiplicadores. Esperan.', cam: { move: 'push', why: 'approach', amount: 0.03 }, premise: 'la cuba antes del primer destello', hold_ok: [[0.5, 8.2]] }),
  shot('V02', 8.2, 12.6, { size: 'WS', action: 'el primer destello Cherenkov; en 1,9 s reales nueve, cada uno a una profundidad; el contador sube 1 a 9', text: 'Uno.', on_beat_at: [F1 - 8.2], cam: { move: 'static' }, premise: 'nueve destellos al ritmo real', sakuga: 'normal' }),
  shot('V03', 12.6, 18.15, { size: 'WS', action: 'no se enciende nada durante 7,304 s reales; el contador queda en 9; solo agua, niebla y polvo', text: 'Pasan siete segundos. No llega ninguno.', cam: { move: 'push', why: 'approach', amount: 0.02 }, premise: 'la pausa real, sin música', hold_ok: [[0, 5.55]], sakuga: 'simple' }),
  shot('V04', 18.15, 21.0, { size: 'WS', action: 'dos destellos más a 1,2 s uno de otro; el contador llega a 11', text: 'Dos más. Contamos once.', cam: { move: 'static' }, premise: 'once' }),
  shot('V05', 21.0, 25.4, { size: 'MS', action: 'un duodécimo destello a media luz; el contador no lo acepta y queda parpadeando', text: 'Otras cuentas ponen doce.', cam: { move: 'push', why: 'approach', amount: 0.03 }, premise: 'la duda 11/12 queda abierta' }),
  shot('V06', 25.4, 32.4, { size: 'WS', action: 'otra cuba, más fría, en una mina de sal de Ohio: ocho destellos en 5,6 s; el contador pasa de 11 a 19', text: 'En una mina de sal de Ohio, otra cuba: ocho.', cam: { move: 'static' }, premise: 'IMB' }),
  shot('V07', 32.4, 43.4, { size: 'MS', action: 'bloque de centelleador en el Cáucaso; cinco destellos amarillentos en 9,1 s; el contador llega a 24', text: 'En el Cáucaso, cinco. Allí no es agua: es centelleador.', cam: { move: 'push', why: 'approach', amount: 0.04 }, premise: 'Baksan, otro medio' }),
  shot('V08', 43.4, 48, { size: 'MS', action: 'los tres contadores en fila; la suma baja a un 24 con un 25 fantasma al lado', text: 'Contamos veinticuatro. Veinticinco, si vale el doce.', cam: { move: 'static' }, premise: 'la cuenta y su duda', hold_ok: [[3.4, 4.6]], sakuga: 'simple' }),
  shot('V09', 48, 55, { size: 'MS', action: 'el agua se apaga de golpe; entra una lámpara de mesa ámbar y una hoja de papel continuo con los mismos 24 puntos', text: 'Nadie los vio llegar. Los encontraron en un listado de impresora, dos días después.', cam: { move: 'push', why: 'approach', amount: 0.03 }, premise: 'giro: eran filas de un archivo', sakuga: 'hero' }),
  shot('V10', 55, 59, { size: 'CU', action: 'entre el punto 9 y el 10 hay un tramo de papel en blanco; una mano con lápiz lo recorre sin marcar', text: 'En esos 13 segundos, ni un ruido ajeno.', cam: { move: 'static' }, premise: 'el hueco en el papel es la prueba' }),
  shot('V11', 59, 65.2, { size: 'WS', action: 'la lámpara se aleja con paralaje; 24 puntos en la hoja y una flecha de trazo fino hacia un horizonte sin fin', text: 'Salieron unos 10^58. Hace 168 000 años. Aquí se contaron 24.', cam: { move: 'pull', why: 'reveal', amount: 0.04 }, premise: 'la escala, en voz baja' }),
  shot('V12', 65.2, 75, { size: 'CU', action: 'la mano marca el último punto; el duodécimo queda sin marcar con el lápiz a medias; la lámpara se apaga; agua negra', text: 'Contamos.', cam: { move: 'static' }, premise: 'cierre en silencio', hold_ok: [[6.5, 9.8]], sakuga: 'simple' }),
];
S.forEach((s, i) => { if (i) s.after = S[i - 1].id; });
// Sonido v2 SIN música: el soundtrack son los clics de agua (voz `gota`, altura = energía), un zumbido lejano antes de la pausa, el silencio REAL de 7,304 s
// (nada suena entre el 9.º y el 10.º destello) y, tras el giro, una sola nota larga (voz `nota`). Techo −3 dBTP; sonoridad baja a propósito (−19 LUFS).
const sound = { style: 'contemplativo', memoria: 'data/veinticuatro/memoria.json', overrides: {
  mix: { bus: { music: -90, sfx: 1.5, amb: -3 }, macro: { floorDb: -6, pow: 0.9 } }, sfx: { air: false }, master: { lufs: -19, tp: -3 },
  sections: { peakFallback: 0.64 }, impact: { tailKeep: 999 } } };   // pico de intensidad en el giro (48 s); sin cola de golpe que apague la nota
const tl = { title: 'Veinticuatro', style: 'cosmos', profile: 'cinematic', fps: 30, width: 1280, height: 720, duration: 75, autoSfx: false, music: null, sound, end_hold_ok: true, shots: S };
fs.writeFileSync(new URL('./timeline.json', import.meta.url), JSON.stringify(tl, null, 1));
console.log('timeline.json', S.length, 'shots');
