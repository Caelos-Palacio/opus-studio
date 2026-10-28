// «Potencias» · los dos únicos tramos 3D del film, GUIONIZADOS desde el principio (data/stress/story.json, beats b3 y b4 con `w3d`).
// No es un shot: lo importan P03 y P04.
//   · P03 — la ciudad como volumen (10^1–10^3 m): lo último que se recorre a pie tiene profundidad; al alejarnos la cámara se eleva y la ciudad se aplana en mapa.
//   · P04 — el suelo plano era una esfera (10^6–10^9 m): el planeta como volumen iluminado desde donde luego entrará el Sol (P05).
// Las escenas son DATOS (api.world3d, spec 004/009); se construyen UNA vez con un PRNG sembrado (nada de Math.random).
import { rng } from '../engine/core.mjs';

// ───────── P03: la ciudad ─────────
// Metros. Plaza vacía en el origen (tú) y calle hacia el fondo; el centro de negocios queda a la derecha y lejos (como la silueta 2D de P_mundo: CITY).
const PITCH = 56, COLS = 36, ROWS = 28;
function buildCity() {
  const r = rng(2718), boxes = [], glass = [];
  for (let j = 0; j < ROWS; j++) for (let i = -COLS; i <= COLS; i++) {
    const x0 = i * PITCH + (r() - 0.5) * 10, z0 = -60 - j * PITCH + (r() - 0.5) * 10;
    if (Math.abs(x0) < 260 && z0 > -330) { r(); r(); r(); continue; }                        // la plaza: nada a menos de ~190 m por delante
    const w = 20 + r() * 20, d = 20 + r() * 20, dc = Math.hypot((x0 - 700) / 900, (z0 + 650) / 520);
    const h = 7 + 16 * r() + 150 * r() ** 2.4 * Math.exp(-dc * dc * 0.9), tall = h > 70;
    boxes.push(x0, h / 2, z0, w, h, d, tall ? 1 : 0);
    if (tall && boxes.length < 4800) glass.push(x0, h + 3, z0, w * 0.35, 6, d * 0.35, 0);   // antena / remate: lo bastante alto para leerse de lejos
  }
  return {
    id: 'ciudad', background: 'paper', fog: {}, ground: { color: 'paper', size: 90000, catcher: true },
    camera: { fromShot: true, target: [0, 0, 3], nearK: 0.02, farK: 120 },
    objects: [
      { instances: { shape: 'box', size: [1, 1, 1] }, data: boxes.map((v) => +v.toFixed(1)), colors: ['shade', 'ink'], outline: true, contact: true },
      { instances: { shape: 'box', size: [1, 1, 1] }, data: glass.map((v) => +v.toFixed(1)), colors: ['accent'], mat: 'emissive', outline: false, contact: false },
    ],
  };
}
const C = {};
export const cityScene = () => (C.city ??= buildCity());

// ───────── P04: el globo ─────────
// El planeta (radio RE) bajo tus pies: el origen es el punto de la superficie donde estás; la cámara mira ese punto con la escala del reloj (cam.ppm), así que
// el círculo proyectado coincide con el disco 2D de P_mundo (centro (cx, cy + (RE+H0)·ppm), radio RE·ppm). Las líneas del globo (continentes, graticule) las dibuja el 2D encima.
// Unidades de la escena: KILÓMETROS (el esquema limita las magnitudes a 1e6): cam.ppm va en px por km.
const RE_KM = 6371, H0_KM = 0.00085;
export const earthScene = () => (C.earth ??= {
  id: 'tierra', background: 'paper', fog: false, ground: false,
  camera: { fov: 14, near: 1000, far: 1e6, target: [0, 0, 0], dist: 1e5, az: 0, el: 0 },
  objects: [{ shape: 'sphere', size: RE_KM, pos: [0, -(RE_KM + H0_KM), 0], color: 'accent2', outline: true, contact: false }],
});
