import { TAU, noise1 } from '../engine/core.mjs';
// Continentes abstractos deterministas (no geografía real): lazos [lon,lat] con radio ruidoso.
const LAND = [[-60, 10, 28], [20, 40, 22], [100, 30, 30], [140, -25, 16], [-10, -15, 20]].map(([lo, la, r], k) =>
  Array.from({ length: 73 }, (_, i) => { const a = (i / 72) * TAU, rr = r * (0.75 + 0.35 * noise1(i * 0.25, k + 3)); return [lo + rr * Math.cos(a), la + rr * 0.7 * Math.sin(a)]; }));
export default {
  draw(ctx, t, u, shot, film, api) {
    const lt = t - shot.t[0], [cx, cy] = api.at(0.5, 0.54), R = api.safe.h * 0.34;
    api.globe({ x: cx, y: cy, r: R, lon: -40 + lt * 22, lat: 16, features: LAND, u: api.ease('out', Math.min(1, lt / 1.1)), label: 'planeta' });
    const orbit = (tt) => { const a = (tt - shot.t[0]) * 1.3 - 0.6; return [cx + Math.cos(a) * R * 1.5, cy + Math.sin(a) * R * 0.45]; };
    // capa con bloom: la estela brilla porque es brillante, no porque "tenga glow"
    api.layer({ bloom: { threshold: 0.45, strength: 1.0, radius: 18 } }, (c, tt, A) => {
      A.particles({ seed: 4, rate: 110, life: 0.9, at: orbit, speed: 28, spread: TAU, drag: 2.5, turb: 6, size: 2.2, color: 'accent', t0: shot.t[0] });
      A.trajectory(orbit, { trail: 0.7, color: 'accent', r: 7, label: 'satélite', weight: 0.4 });
    });
    api.text(shot.text, ...api.at(0.5, 0.06), { role: 'h2', alpha: api.spring(lt - 1.2), screen: true });   // pantalla: el push no lo saca
  },
};
