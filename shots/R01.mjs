import { renderShot, wheelEntity, world } from './R_mundo.mjs';
// R01 · la criatura quieta bajo la rueda (WS) y la pregunta del gancho (3,0 s). Un hilo rojo en el borde izquierdo.
// enfasis lo dirige la memoria (peso de «regla» a mitad del plano): cuánto se ve el decorado en la penumbra.
const VIEW = { x: 0, y: 0, z: 1 };
export default {
  params: { enfasis: { type: 'number', range: [0, 1], unit: '×', default: 0.5, semantic: 'peso de memoria de la criatura: visibilidad del decorado' } },
  entities: { rueda: wheelEntity(VIEW) },
  draw(ctx, t, u, shot, film, api) {
    const P = api.params; world(film);
    renderShot(ctx, api, film, shot, t, { view: VIEW, mood: 0.5 + 0.9 * P.enfasis, thread: { x: -0.75, k: 0.8, a: api.spring(t - 1.2) },
      caps: [{ str: '¿POR QUÉ GIRA LA RUEDA?', t0: 3.0, t1: 5.6, color: 'ink' }] });
  },
};
