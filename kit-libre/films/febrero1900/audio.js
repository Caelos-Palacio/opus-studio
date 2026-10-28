// audio.js: audio propio. Lee de timeline.js. Ventilador de torre que se calla 0,5 s al aterrizar en A60; teclas, rueda y tic. Sin musica, sin pad.
import { pista, mezcla, nivelar, cama, reverb, limitador, clic, golpe, papel, moneda } from '../../kit/audio.mjs';
import { eventos, dur, TLAND } from './timeline.js';
const VOC = { clic, golpe, papel, moneda };
const GANAN = -14;
export function audioFilm() {
  const bed = pista(dur), fan = pista(dur), fx = pista(dur), sr = bed.sr;
  cama(bed, { fc: 380, lfoHz: 0.07, prof: 0.3, gan: 0.05 });
  // ventilador: zumbido de 2 aspas (110 Hz y armonicos) + soplo; se calla de TLAND-0.05 a TLAND+0.45 y vuelve con un clic
  const a = TLAND - 0.05, b = TLAND + 0.45, cierre = (t) => t < a ? 1 : t < a + 0.03 ? 1 - (t - a) / 0.03 : t < b ? 0 : t < b + 0.05 ? (t - b) / 0.05 : 1;
  for (let i = 0; i < fan.n; i++) { const t = i / sr, w = 110 * (1 + 0.004 * Math.sin(t * 0.9)), v = (Math.sin(6.2832 * w * t) + 0.5 * Math.sin(6.2832 * 2 * w * t) + 0.25 * Math.sin(6.2832 * 3 * w * t + 1)) * 0.028 * (0.85 + 0.15 * Math.sin(t * 7.3)); const g = cierre(t); fan.L[i] = v * g; fan.R[i] = v * g * 0.96; for (let k = 0; k < 1; k++) { bed.L[i] *= g; bed.R[i] *= g; } }
  const ev = [...eventos.map((e) => e.tipo === 'golpe' && e.t === TLAND ? { ...e, gan: 1.6 } : e.tipo === 'clic' && e.gan === 0.3 ? { ...e, gan: 0.7 } : e), { t: b + 0.05, tipo: 'clic', gan: 0.35 }];
  ev.forEach((e, i) => VOC[e.tipo]?.(fx, e.t, { seed: i + 1, pan: e.pan ?? ((i % 5) - 2) * 0.2, ...(e.gan ? { gan: e.gan } : {}) }));
  reverb(fx, { tau: 0.35, mezcla: 0.18 });
  const m = mezcla([bed, fan, fx]);
  // dinamica: respiros mucho mas bajos, pico en la bajada, el golpe de A60 y la cascada
  const pts = [[0, -2], [5.5, -3], [6.6, -1], [9.0, 2], [10.5, -4], [12.6, -4], [13.6, -11], [16.8, -11], [17.6, -6], [20.2, -5], [20.9, 1], [23.0, 1], [24.2, -8], [27.6, -10]];
  const dbAt = (t) => { for (let k = 1; k < pts.length; k++) if (t <= pts[k][0]) { const [t0, d0] = pts[k - 1], [t1, d1] = pts[k]; return d0 + (d1 - d0) * (t - t0) / (t1 - t0); } return pts.at(-1)[1]; };
  for (let i = 0; i < m.n; i++) { const g = Math.pow(10, dbAt(i / sr) / 20); m.L[i] *= g; m.R[i] *= g; } nivelar(m, { rmsDb: GANAN }); limitador(m); return m;
}
