import { renderShot, wheelEntity } from './R_mundo.mjs';
// R07 · RÁFAGA I (WS): corte, impacto y espina en 1,3 s; se hunde un poco más cada vez.
// La respuesta de la criatura decrece golpe a golpe (resp) mientras la fuerza crece: la pista que el giro de R12 relee.
export default {
  params: { fuerza: { type: 'number', range: [0.5, 4.5], unit: '×', default: 1, semantic: 'intensidad del golpe (estruendo: sacudida, flash, chispas); la dirige la memoria por la cadena de relaciones escala' } },
  draw(ctx, t, u, shot, film, api) {
    renderShot(ctx, api, film, shot, t, { view: { x: 0, y: 0.02, z: 0.95 }, caps: [] });
  },
};
