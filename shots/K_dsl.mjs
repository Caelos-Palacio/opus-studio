// «Pulso» en DSL (spec 010): funciones PURAS de apoyo para los .scene.json de K01–K24. La tipografía cinética sigue en K_tipo.mjs.
import { rng } from '../engine/core.mjs';
export const stagger = (api) => api.S.motion.stagger;                    // intervalo entre letras del estilo activo
export const rngAt = (seed, k) => { const R = rng(seed); let v = 0; for (let i = 0; i <= k; i++) v = R(); return v; };   // k-ésimo valor de la secuencia sembrada (sin estado)
