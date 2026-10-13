// Foley de oficina/archivo (spec 017, film «Consta»): voces sintetizadas, deterministas (rng por evento) y opt-in por tipo.
// Cada voz: { doc, dur (por defecto), synth(e, R) → { x: mono, lead: s antes del instante de sincronía } }.
// El instante del evento es el CONTACTO (el sello al tocar el papel, el clic de la llave), no el inicio de la pisada.
// No hay música: son los sonidos de lo que se ve (llaves, sello, pluma, secante, reloj de pared, una mosca).
import { SR, TAU, clamp } from './dsp.mjs';

const mk = (sec) => new Float32Array(Math.max(1, Math.round(sec * SR)));
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));
const lp1 = (fc) => 1 - Math.exp((-TAU * fc) / SR);

// parciales inarmónicos de metal (relaciones de una placa/campanilla pequeña); `det` los desafina un poco por evento
const METAL = [[1, 1], [1.52, 0.7], [2.18, 0.5], [2.9, 0.32], [3.8, 0.2]];
const clink = (x, at, f0, det, g, dec) => {
  const n0 = Math.round(at * SR);
  for (let i = 0; i < 0.45 * SR && n0 + i < x.length; i++) {
    const t = i / SR; let s = 0;
    for (const [r, a] of METAL) s += a * Math.sin(TAU * f0 * r * (1 + 0.012 * det) * t) * Math.exp(-t / (dec / (0.6 + 0.4 * r)));
    x[n0 + i] += g * s * clamp(t / 0.0004);
  }
};
const thud = (x, at, f0, f1, g, dec) => { const n0 = Math.round(at * SR); let ph = 0; for (let i = 0; i < 0.5 * SR && n0 + i < x.length; i++) { const t = i / SR; ph += (TAU * (f1 + (f0 - f1) * Math.exp(-t * 28))) / SR; x[n0 + i] += g * Math.sin(ph) * env(t, 0.002, dec); } };
const noiseBurst = (x, at, R, fc, g, dec, len = 0.2) => { const n0 = Math.round(at * SR), a = lp1(fc); let l = 0, h = 0; for (let i = 0; i < len * SR && n0 + i < x.length; i++) { const t = i / SR, n = R() * 2 - 1; l += a * (n - l); h += 0.25 * (l - h); x[n0 + i] += g * (l - h) * 3 * env(t, 0.0006, dec); } };

export const FOLEY = {
  llave: {
    doc: 'llave de latón: clin al cogerla (dur corta) o giro en la cerradura con trinquete y golpe final (dur ≥ 0,5)', dur: 0.4,
    synth(e, R) {
      const d = e.dur ?? 0.4, det = R() * 2 - 1, f0 = 2100 + 700 * R();
      if (d < 0.5) { const x = mk(0.5); clink(x, 0, f0, det, 0.7, 0.11); noiseBurst(x, 0, R, 6000, 0.25, 0.004, 0.02); return { x, lead: 0 }; }
      const x = mk(d + 0.5), n = 6 + Math.floor(R() * 3), body = d * 0.78;
      let u0 = 0;
      for (let k = 0; k < n; k++) {                                  // trinquete: los pasos se aprietan (cada giro es otro, la cerradura no es la misma)
        u0 += (1 - 0.55 * (k / n)) / (n * 0.74); const at = Math.min(body, u0 * body * 0.95);
        clink(x, at, f0 * (0.55 + 0.1 * (R() - 0.5)), det, 0.16 + 0.06 * R(), 0.025); noiseBurst(x, at, R, 3500, 0.12, 0.006, 0.03);
      }
      let l = 0; const a = lp1(700 + 400 * R());                    // fricción del paletón mientras gira
      for (let i = 0; i < body * SR; i++) { const t = i / SR; l += a * (R() * 2 - 1 - l); x[i] += 0.07 * l * Math.sin(Math.PI * t / body) ** 0.7; }
      thud(x, d, 150, 95, 0.55, 0.07); clink(x, d, f0 * 0.8, det, 0.55, 0.14); noiseBurst(x, d, R, 900, 0.3, 0.02, 0.08);   // el pestillo cae
      return { x, lead: 0 };
    },
  },
  sello: {
    doc: 'sello de goma que estampa: golpe sordo, batido de papel y cola; el contacto es el instante', dur: 0.5,
    synth(e, R) {
      const x = mk(0.9), lead = 0.1; let l = 0;
      for (let i = 0; i < lead * SR; i++) { const t = i / SR; l += lp1(900) * (R() * 2 - 1 - l); x[i] += 0.1 * l * (t / lead) ** 2; }      // el aire que empuja antes de tocar
      thud(x, lead, 95, 52, 0.95, 0.16); noiseBurst(x, lead, R, 650, 0.9, 0.05, 0.25); noiseBurst(x, lead, R, 3800, 0.45, 0.009, 0.08);   // cuerpo, golpe, palmada de papel
      thud(x, lead + 0.012, 230, 160, 0.3, 0.03); noiseBurst(x, lead + 0.05, R, 1800, 0.12, 0.09, 0.25);                                  // mesa que responde y hoja que se asienta
      return { x, lead };
    },
  },
  sello_seco: {
    doc: 'sello SIN tinta: el mismo gesto, más corto y hueco; no hay palmada ni cola', dur: 0.4,
    synth(e, R) {
      const x = mk(0.6), lead = 0.1; let l = 0;
      for (let i = 0; i < lead * SR; i++) { const t = i / SR; l += lp1(800) * (R() * 2 - 1 - l); x[i] += 0.07 * l * (t / lead) ** 2; }
      thud(x, lead, 80, 58, 0.5, 0.07); noiseBurst(x, lead, R, 420, 0.3, 0.025, 0.1);
      return { x, lead };
    },
  },
  pluma: {
    doc: 'pluma sobre papel: arañazo fino modulado por el ritmo de la letra, con pausas y presión irregular (dur s)', dur: 1.0,
    synth(e, R) {
      const d = e.dur ?? 1, x = mk(d); let l1 = 0, l2 = 0, h = 0, ph = 0, rate = 15, press = 0.6, gap = 0;
      for (let i = 0; i < x.length; i++) {
        const t = i / SR;
        if (i % 2400 === 0) { rate = 11 + 9 * R(); press = 0.35 + 0.65 * R(); gap = R() < 0.22 ? 0.12 * SR : 0; }   // cada 50 ms: otra letra, otra presión (y alguna pausa)
        if (gap > 0) gap--;
        ph += rate / SR; const stroke = (0.5 + 0.5 * Math.sin(TAU * ph)) ** 1.6, n = R() * 2 - 1;
        l1 += lp1(6500) * (n - l1); l2 += lp1(2300) * (l1 - l2); h = l1 - l2;          // banda 2,3–6,5 kHz: el filo de la punta
        x[i] = (gap > 0 ? 0.1 : 1) * press * stroke * h * 0.9 * Math.min(1, t / 0.03, (d - t) / 0.05);
      }
      return { x, lead: 0 };
    },
  },
  secante: {
    doc: 'papel secante que se desliza sobre tinta fresca: roce suave y largo (dur s)', dur: 1.0,
    synth(e, R) {
      const d = e.dur ?? 1, x = mk(d); let l = 0, m = 0;
      for (let i = 0; i < x.length; i++) {
        const t = i / SR, u = t / d, fc = 700 + 900 * Math.sin(Math.PI * u), a = lp1(fc), n = R() * 2 - 1;
        l += a * (n - l); m += 0.002 * (R() * 2 - 1 - m);
        x[i] = (l * 2.4 + m * 14) * Math.sin(Math.PI * u) ** 1.3 * (0.65 + 0.35 * Math.sin(TAU * 7 * t + 1));
      }
      return { x, lead: 0 };
    },
  },
  reloj: {
    doc: 'reloj de pared: un tic-tac por segundo (el tac, más grave), en cada segundo entero desde el evento (dur s)', dur: 5,
    synth(e, R) {
      const d = e.dur ?? 5, x = mk(d + 0.2), det = R() * 2 - 1;
      for (let k = 1; k <= Math.floor(d); k++) {
        const tock = k % 2 === 0, f = (tock ? 1180 : 1450) * (1 + 0.01 * det), g = tock ? 0.8 : 1;
        const at = k + 0.004 * (R() - 0.5);
        const n0 = Math.round(at * SR);
        for (let i = 0; i < 0.12 * SR && n0 + i < x.length; i++) {
          const t = i / SR;
          x[n0 + i] += g * (0.7 * Math.sin(TAU * f * t) * env(t, 0.0004, 0.012) + 0.4 * Math.sin(TAU * f * 2.41 * t) * env(t, 0.0004, 0.006) + 0.35 * Math.sin(TAU * (tock ? 180 : 240) * t) * env(t, 0.001, 0.025));
        }
        noiseBurst(x, at, R, 5200, 0.2 * g, 0.003, 0.02);
      }
      return { x, lead: 0 };
    },
  },
  mosca: {
    doc: 'mosca: zumbido agudo con vaivén (se acerca, se aleja, se posa); dur s', dur: 4,
    synth(e, R) {
      const d = e.dur ?? 4, x = mk(d), f0 = 170 + 40 * R(), w1 = 0.55 + 0.3 * R(), w2 = 1.7 + 0.5 * R(), p0 = R() * TAU; let ph = 0;
      for (let i = 0; i < x.length; i++) {
        const t = i / SR, near = 0.5 + 0.5 * Math.sin(TAU * w1 * t + p0), land = (t % 2.6) > 2.0 ? 0.05 : 1;   // cada ~2,6 s se posa un momento
        ph += (TAU * (f0 * (1 + 0.04 * Math.sin(TAU * w2 * t) + 0.02 * near))) / SR;
        const car = Math.asin(Math.sin(ph)) + 0.5 * Math.asin(Math.sin(2 * ph + 0.7)), am = 0.65 + 0.35 * Math.sin(TAU * 38 * t);
        x[i] = 0.5 * car * am * near ** 1.5 * land * Math.min(1, t / 0.2, (d - t) / 0.2);
      }
      return { x, lead: 0 };
    },
  },
};
export const FOLEY_TYPES = Object.keys(FOLEY);
