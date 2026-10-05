import { renderShot, wheelEntity } from './R_mundo.mjs';
// R03 · IMPACTO (CU): ondas de choque y grietas en estrella desde el centro (13,4 s).
// La respuesta de la criatura decrece golpe a golpe (resp) mientras la fuerza crece: la pista que el giro de R12 relee.
export default {
  params: { fuerza: { type: 'number', range: [0.5, 4.5], unit: '×', default: 1, semantic: 'intensidad del golpe (estruendo: sacudida, flash, chispas); la dirige la memoria por la cadena de relaciones escala' } },
  draw(ctx, t, u, shot, film, api) {
    renderShot(ctx, api, film, shot, t, { view: { x: 0, y: 0.06, z: 2.1 }, bleed: true, caps: [{ str: 'IMPACTO', t0: shot.t[0] + 2.3, t1: shot.t[0] + 4.4, color: 'accent', at: api.at(0.15, 0.5) }] });
  },
};
