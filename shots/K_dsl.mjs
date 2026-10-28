// «Pulso» en DSL (spec 010): funciones PURAS de apoyo para los .scene.json de K01–K24. La tipografía cinética sigue en K_tipo.mjs.
import { rng } from '../engine/core.mjs';
export const stagger = (api) => api.S.motion.stagger;                    // intervalo entre letras del estilo activo
export const rngAt = (seed, k) => { const R = rng(seed); let v = 0; for (let i = 0; i <= k; i++) v = R(); return v; };   // k-ésimo valor de la secuencia sembrada (sin estado)
// K23: índice global (sin contar espacios) de la letra i de la línea j del cartel; -1 si es un espacio. N = nº total de letras.
const cnt = (s) => [...s].filter((c) => c !== ' ').length;
export const glyphN = (lines) => lines.reduce((a, l) => a + l.str.replace(' ', '').length, 0);
export const glyphIdx = (lines, j, i) => { const s = lines[j].str; if (s[i] === ' ') return -1; let base = 0; for (let q = 0; q < j; q++) base += cnt(lines[q].str); return base + cnt(s.slice(0, i)); };
