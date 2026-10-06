import { renderShot, wheelEntity } from './R_mundo.mjs';
// R02 · CORTE (MS): una diagonal parte las placas; las dos mitades se deslizan; la rueda da un paso (7,9 s).
// La respuesta de la criatura decrece golpe a golpe (resp) mientras la fuerza crece: la pista que el giro de R12 relee.
export default {
  params: { fuerza: { type: 'number', range: [0.5, 4.5], unit: '×', default: 1, semantic: 'intensidad del golpe (estruendo: sacudida, flash, chispas); la dirige la memoria por la cadena de relaciones escala' } },
  draw(ctx, t, u, shot, film, api) {
    renderShot(ctx, api, film, shot, t, { view: { x: 0, y: -0.04, z: 1.1 }, caps: [{ str: 'CORTE', t0: shot.t[0] + 2.6, t1: shot.t[0] + 5.2, color: 'accent', at: api.at(0.15, 0.5) }] });
  },
};
