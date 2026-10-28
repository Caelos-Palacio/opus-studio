import { renderShot, wheelEntity } from './R_mundo.mjs';
// R05 · ESPINAS (WS): siete espinas desde los bordes atraviesan la criatura (21,9 s).
// La respuesta de la criatura decrece golpe a golpe (resp) mientras la fuerza crece: la pista que el giro de R12 relee.
export default {
  params: { fuerza: { type: 'number', range: [0.5, 4.5], unit: '×', default: 1, semantic: 'intensidad del golpe (estruendo: sacudida, flash, chispas); la dirige la memoria por la cadena de relaciones escala' } },
  draw(ctx, t, u, shot, film, api) {
    renderShot(ctx, api, film, shot, t, { view: { x: 0, y: 0, z: 0.8 }, caps: [{ str: 'ESPINAS', t0: shot.t[0] + 1.7, t1: shot.t[0] + 3.1, color: 'accent', at: api.at(0.15, 0.5) }] });
  },
};
