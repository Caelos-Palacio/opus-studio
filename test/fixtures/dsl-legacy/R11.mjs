import { renderShot, wheelEntity } from './R_mundo.mjs';
// R11 · GOLPE FINAL (WS): la hoja cae a los 1,6 s; blanco; la criatura estalla; polvo y silencio; la rueda sola; octavo paso (6,0 s).
const VIEW = { x: 0, y: 0, z: 1 };
export default {
  params: { fuerza: { type: 'number', range: [0.5, 4.5], unit: '×', default: 1, semantic: 'intensidad del golpe final (la dirige la memoria: relación escala)' } },
  entities: { rueda: wheelEntity(VIEW) },
  draw(ctx, t, u, shot, film, api) { renderShot(ctx, api, film, shot, t, { view: VIEW, tension: 1, mood: 0.5 }); },
};
