// gramaticas/index.mjs: los medios del kit. Se ELIGEN por tema (README); ninguno es el de por defecto.
//   import { elegir } from '../kit/gramaticas/index.mjs';  const G = elegir('neon', { a1: '#ffb000' });  // paleta opcional
//   G.soporte(ctx,W,H,t); G.trazo(ctx,pts,{grosor:12}); G.texto(ctx,'Hola',x,y,{tam:120}); G.acento(ctx,caja,{u}); G.post(ctx,W,H,fi); G.transicion(ctx,u,A,B)
import neon from './neon.mjs';
import tiza from './tiza.mjs';
import papel from './papel.mjs';
import { paleta } from './comun.mjs';
export { FARO } from './comun.mjs';
export const gramaticas = { neon, tiza, papel };
export const nombres = Object.keys(gramaticas);
const ARIDAD = { soporte: 4, trazo: 2, texto: 4, acento: 2, post: 4, transicion: 4 }; // posicion de `opts` en cada funcion

/** elegir(nombre,cambiosPaleta): la gramatica con la paleta fijada (neutro/tinta/a1/a2 se pueden cambiar; cada llamada aun admite `{paleta}` propio). */
export function elegir(nombre, cambios = null) {
  const g = gramaticas[nombre]; if (!g) throw new Error(`gramatica desconocida "${nombre}"; usa una de: ${nombres.join(', ')}`);
  const P = paleta(g.paleta, cambios), out = { nombre: g.nombre, cuando: g.cuando, paleta: P };
  for (const [m, n] of Object.entries(ARIDAD)) out[m] = (...a) => { a[n] = { paleta: P, ...(a[n] || {}) }; return g[m](...a); };
  return out;
}
