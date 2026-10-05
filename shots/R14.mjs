import { renderShot, world } from './R_mundo.mjs';
// R14 · CIERRE (WS): rima con R01. La memoria (relación rima) pide repetir el encuadre y la posición del texto del primer plano;
// intensidad (escala adaptacion→amenaza) engorda el hilo del atacante; enfasis (peso de la rueda) su brillo. La pregunta queda abierta.
export default {
  params: {
    enfasis: { type: 'number', range: [0, 1], unit: '×', default: 0.5, semantic: 'peso de memoria de la rueda: brillo del oro' },
    intensidad: { type: 'number', range: [0.5, 3], unit: '×', default: 1, semantic: 'presencia del atacante (relación escala adaptacion→amenaza)' },
    rima: { type: 'json', default: [], semantic: 'callbacks de rima [{ref, concepto}]: repetir el encuadre del plano referido (rol rima)' },
  },
  draw(ctx, t, u, shot, film, api) {
    const P = api.params; world(film); const rima = (P.rima ?? []).length > 0;
    renderShot(ctx, api, film, shot, t, { view: { x: 0, y: rima ? 0 : 0.03, z: 1 }, mood: 0.5 + 0.6 * P.enfasis, thread: { x: -0.42, k: 0.7 + 0.4 * P.intensidad, a: 1 },
      wheelEcho: 0, caps: [{ str: shot.text, t0: shot.t[0] + 0.5, t1: shot.t[1] - 0.3, color: 'ink', at: api.at(0.5, 0.955) }] });
  },
};
