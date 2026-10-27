// audio.js: audio propio. Lee de timeline.js. Ventilador de torre que se calla 0,5 s al aterrizar en A60; teclas, rueda y tic. Sin musica, sin pad.
import { pista, mezcla, nivelar, cama, reverb, limitador, clic, golpe, papel, moneda } from '../../kit/audio.mjs';
import { eventos, dur, TLAND } from './timeline.js';
const VOC = { clic, golpe, papel, moneda };
export function audioFilm() {
  const bed = pista(dur), fan = pista(dur), fx = pista(dur), sr = bed.sr;
  cama(bed, { fc: 380, lfoHz: 0.07, prof: 0.3, gan: 0.05 });
  // ventilador: zumbido de 2 aspas (110 Hz y armonicos) + soplo; se calla de TLAND-0.05 a TLAND+0.45 y vuelve con un clic
  const a = TLAND - 0.05, b = TLAND + 0.45, cierre = (t) => t < a ? 1 : t < a + 0.03 ? 1 - (t - a) / 0.03 * 0.97 : t < b ? 0.03 : t < b + 0.05 ? 0.03 + (t - b) / 0.05 * 0.97 : 1;
  for (let i = 0; i < fan.n; i++) { const t = i / sr, w = 110 * (1 + 0.004 * Math.sin(t * 0.9)), v = (Math.sin(6.2832 * w * t) + 0.5 * Math.sin(6.2832 * 2 * w * t) + 0.25 * Math.sin(6.2832 * 3 * w * t + 1)) * 0.028 * (0.85 + 0.15 * Math.sin(t * 7.3)); const g = cierre(t); fan.L[i] = v * g; fan.R[i] = v * g * 0.96; for (let k = 0; k < 1; k++) { bed.L[i] *= (0.5 + 0.5 * g); bed.R[i] *= (0.5 + 0.5 * g); } }
  const ev = [...eventos, { t: b + 0.05, tipo: 'clic', gan: 0.35 }];
  ev.forEach((e, i) => VOC[e.tipo]?.(fx, e.t, { seed: i + 1, pan: e.pan ?? ((i % 5) - 2) * 0.2, ...(e.gan ? { gan: e.gan } : {}) }));
  reverb(fx, { tau: 0.35, mezcla: 0.18 });
  const m = mezcla([bed, fan, fx]); nivelar(m, { rmsDb: -19 }); limitador(m); return m;
}
