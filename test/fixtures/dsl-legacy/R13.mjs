import { renderShot, world } from './R_mundo.mjs';
import { lerp, seg } from '../engine/core.mjs';
// R13 · el hilo rojo del atacante regresa por la izquierda y se detiene ante la criatura; ella ya es de oro. «SE ADAPTA.»
export default {
  draw(ctx, t, u, shot, film, api) {
    world(film); const e = api.ease('outExpo', seg(t, shot.t[0] + 0.2, shot.t[1] - 0.2));
    renderShot(ctx, api, film, shot, t, { view: { x: 0, y: 0.05, z: 0.95 }, thread: { x: lerp(-1.0, -0.42, e), k: 1.1, a: 1 },
      caps: [{ str: 'SE ADAPTA.', t0: shot.t[0] + 0.6, t1: shot.t[1] - 0.2, color: 'accent2', role: 'h1', at: api.at(0.5, 0.93) }] });
  },
};
