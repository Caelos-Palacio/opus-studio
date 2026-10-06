// R12 · plan de los ecos releídos (spec 010): la lógica de ordenar los callbacks de la memoria y de rotular cada golpe, como función PURA
// del tiempo y de los params. El shot R12 (DSL) la llama como `let` y dibuja con renderShot; los números son los del R12 en JS.
import { clamp } from '../engine/core.mjs';
import { world, ECO_KIND } from './R_mundo.mjs';
const NAMES = { corte: 'CORTE', impacto: 'IMPACTO', calor: 'CALOR', espinas: 'ESPINAS', prensa: 'PRENSA', rafaga: 'RÁFAGA', rueda: 'LA RUEDA' };
const ECO_MAP = { 'golpe-corte': 'corte', 'golpe-impacto': 'impacto', 'golpe-calor': 'calor', 'golpe-espinas': 'espinas', 'golpe-prensa': 'prensa', rafaga: 'rafaga', rueda: 'rueda' };
const kindOf = (e) => (e ? (ECO_MAP[e.concepto] ?? 'corte') : 'corte');
// → { echoes:[{kind,u,s}], wheelEcho, rows:[[texto, x, y, alpha]] }
export function echoPlan(api, film, t, hold, ecoParam) {
  const W = world(film), s0 = W.REV + 0.8 + hold, STEP = 0.33, DUR = 0.55;
  const eco = [...(ecoParam ?? [])].sort((a, b) => a.tramo[0] - b.tramo[0] || a.giro.localeCompare(b.giro));
  const echoes = [], list = []; let wheelEcho = 0;
  eco.forEach((e, j) => {
    const kind = ECO_KIND[e.concepto] ?? 'corte', te = s0 + j * STEP, uu = (t - te) / DUR, s = clamp(e.fuerza);
    if (kind === 'rueda') wheelEcho = clamp((t - te) / 0.45); else echoes.push({ kind, u: uu, s });
    if (t >= te) list.push({ str: NAMES[kind] ?? kind, a: api.spring(t - te), s });
  });
  const [lx] = api.at(0.97, 0), y0 = api.at(0, 0.22)[1], dy = api.sizes.body * 1.9;
  return { echoes, wheelEcho, rows: list.map((e, i) => [NAMES[kindOf(eco[i])] ?? '', lx, y0 + i * dy, clamp(e.a) * (0.5 + 0.5 * e.s)]) };
}
