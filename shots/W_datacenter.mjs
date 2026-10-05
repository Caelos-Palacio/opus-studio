// «datacenter» — mundo 3D declarado como DATOS para api.world3d (spec 004). No es un shot: lo importan D01 y P03 (variante w3d).
// Escena estática (se construye UNA vez al cargar el módulo con un PRNG sembrado: nada de Math.random) + cámara en función de t.
// Escala: metros. 40×28 racks de 1,2×4,2×2,2 m; zoom de escala logarítmico de 380 m a 7 m hasta el rack héroe.
import { rng } from '../engine/core.mjs';
const COLS = 40, ROWS = 28, SX = 2.2, SZ = 6.0, RW = 1.2, RH = 4.2, RD = 2.2, SLOTS = 12;
export const D0 = 380, D1 = 7, FOV = 34;
const HERO_ROW = 9, HX = 0, HZ = -HERO_ROW * SZ;
export const TARGET = [HX, RH * 0.6, HZ + RD / 2];

function build() {
  const r = rng(1337), racks = [], slots = [], leds = [];
  for (let row = 0; row < ROWS; row++) for (let c = 0; c < COLS; c++) {
    const x = (c - COLS / 2) * SX, z = -row * SZ, h = 0.92 + r() * 0.16, faceZ = z + RD / 2 + 0.03, hot = r() < 0.045, bad = r() < 0.006;
    racks.push(x, RH * h / 2, z, RW, RH * h, RD, 0);
    for (let s = 0; s < SLOTS; s++) {
      const y = 0.35 + s * 0.33 * h;
      slots.push(x, y, faceZ, 1.0, 0.24, 0.04, 0);
      for (let k = 0; k < 2; k++) {
        const q = r(), ci = k && bad ? 3 : k && (hot || q < 0.05) ? 2 : q < 0.5 ? 0 : 1;      // 0/1 tenue · 2 ámbar (acento) · 3 tinta (alerta)
        leds.push(x + (k ? 0.38 : -0.12), y, faceZ + 0.04, k ? 0.12 : 0.5, 0.12, 0.05, ci);
      }
    }
  }
  const hero = [HX, RH * 0.62, HZ + RD / 2 + 0.12, RW + 0.1, 0.06, 0.05, 0, HX, RH * 0.62 + 0.35, HZ + RD / 2 + 0.12, RW + 0.1, 0.04, 0.05, 1];
  return {
    id: 'datacenter', background: 'paper', fog: { density: 0.0021 }, ground: { color: 'paper', size: 3000, contact: true },
    camera: { fov: FOV, near: 0.5, far: 4000, target: TARGET, dist: D0, az: -31, el: 31 },
    objects: [
      { instances: { shape: 'box', size: [1, 1, 1] }, data: racks, colors: ['shade'], outline: true, contact: true },
      { instances: { shape: 'box', size: [1, 1, 1] }, data: slots, colors: ['paper'], mat: 'flat', outline: false, contact: false },
      { instances: { shape: 'box', size: [1, 1, 1] }, data: leds, colors: ['shade', 'accent2', 'accent', 'ink'], mat: 'emissive', outline: false, contact: false },
      { instances: { shape: 'box', size: [1, 1, 1] }, data: hero, colors: ['accent', 'ink'], mat: 'emissive', outline: false, contact: false },
    ],
  };
}
const CACHE = {};                                              // la escena se construye una sola vez (el motor la cachea por identidad del objeto)
export const datacenterScene = () => (CACHE.scene ??= build());
const ease = (u) => u * u * (3 - 2 * u);
export const dist = (t, D = 3) => D0 * Math.pow(D1 / D0, ease(Math.min(1, Math.max(0, t / D))));
// Cámara como función pura de t (la usan step/motionBlur del motor): de vista aérea oblicua a plano frontal.
export const datacenterCam = (t, D = 3) => { const u = ease(Math.min(1, Math.max(0, t / D))); return { dist: dist(t, D), az: -32 * (1 - u), el: 32 * (1 - u) + 2.3 }; };
export const fovWidth = (d, aspect = 16 / 9) => 2 * d * Math.tan((FOV * Math.PI) / 360) * aspect;

// HUD 2D (regla log 1 m–1 km con marcador de FOV): lo dibuja el compositor 2D encima de la capa 3D, con tipografía y tinta del estilo
// y DENTRO del área segura (api.safe).
export function datacenterHud(ctx, api, film, t, d) {
  const W = film.width, H = film.height, k = api.k, sf = api.safe, fw = fovWidth(d, W / H);
  const X = sf.x1 - 30 * k, y0 = sf.y1 - 24 * k, y1 = sf.y0 + 28 * k, L = (m) => y0 + (y1 - y0) * (Math.log10(m) / 3);
  ctx.save(); ctx.lineWidth = Math.max(1, k * 1.5);
  for (let dec = 0; dec <= 3; dec++) for (let q = 1; q < 10; q++) { const m = q * 10 ** dec; if (m > 1000) break; const y = L(m), big = q === 1;
    ctx.globalAlpha = big ? 0.9 : 0.4; ctx.strokeStyle = api.color('ink'); ctx.beginPath(); ctx.moveTo(X, y); ctx.lineTo(X + (big ? 18 : 8) * k, y); ctx.stroke();
    if (big) { ctx.globalAlpha = 1; api.text(m >= 1000 ? '1 km' : m + ' m', X - 10 * k, y, { role: 'label', align: 'right', color: 'ink', alpha: 0.9 }); } }
  const yy = L(Math.min(1000, Math.max(1, fw))); ctx.globalAlpha = 1; ctx.fillStyle = api.color('accent'); ctx.beginPath(); ctx.moveTo(X - 4 * k, yy); ctx.lineTo(X - 26 * k, yy - 7 * k); ctx.lineTo(X - 26 * k, yy + 7 * k); ctx.fill(); ctx.fillRect(X, yy - k, 26 * k, 2 * k);
  ctx.restore();
  // lectura por décadas en TeX (literales String.raw: assets.mjs --tex los precompila); el valor continuo lo marca el cursor de la regla
  const DEC = [String.raw`\approx 1\,\mathrm{m}`, String.raw`\approx 10\,\mathrm{m}`, String.raw`\approx 100\,\mathrm{m}`, String.raw`\approx 1\,\mathrm{km}`], dec = Math.max(0, Math.min(3, Math.round(Math.log10(Math.max(1, fw)))));
  const big = api.sizes.h2, vy = sf.y1 - big * 0.6;
  api.text('CAMPO DE VISIÓN', sf.x0, vy - big * 0.575 - api.sizes.label * 0.7, { role: 'label', align: 'left', alpha: 0.8 });
  api.tex(DEC[dec], sf.x0, vy, { size: big, align: 'left', color: 'accent' });
}
