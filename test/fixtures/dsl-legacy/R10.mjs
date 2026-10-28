import { renderShot } from './R_mundo.mjs';
// R10 · CARGA (WS, empuje lento): la criatura de rodillas; la hoja de luz se forma y las líneas convergen. `tension` (señal 0→1).
export default {
  params: { tension: { type: 'number', range: [0, 1], unit: '×', default: 0, semantic: 'carga del golpe final (hoja de luz, líneas convergentes, temblor)' } },
  draw(ctx, t, u, shot, film, api) {
    const tt = Math.min(t, shot.t[1] - 0.13), tr = api.param('tension', tt), j = 0.0025 * tr * Math.sin(tt * 61);   // los últimos 4 fotogramas quietos: hold-cut
    renderShot(ctx, api, film, shot, tt, { view: { x: j, y: 0.02, z: 0.95 }, tension: tr, mood: 1 - 0.5 * tr });
  },
};
