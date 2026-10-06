import { renderShot, wheelEntity, world, ECO_KIND } from './R_mundo.mjs';
import { clamp } from '../engine/core.mjs';
// R12 · LA REVELACIÓN (MS, pull): las placas vuelven en reversa, los cortes son costuras de oro y la rueda se enciende.
// Después cada golpe releído se repite en oro. Todo lo dirige la memoria (docs/MEMORIA.md): eco (qué planos y con qué fuerza = 1 − peso),
// hold (0,6 s para que el espectador relea) y revelar_en (retiene la respuesta de «¿por qué gira la rueda?»). Sin capa: película base, sin eco.
const VIEW = { x: 0, y: 0, z: 1 };
const NAMES = { corte: 'CORTE', impacto: 'IMPACTO', calor: 'CALOR', espinas: 'ESPINAS', prensa: 'PRENSA', rafaga: 'RÁFAGA', rueda: 'LA RUEDA' };
export default {
  params: {
    text: { type: 'string', semantic: 'la respuesta (default: shot.text del timeline)' },
    eco: { type: 'json', default: [], semantic: 'callbacks a los planos releídos [{ref, tramo, concepto, giro, fuerza}] (rol eco de la memoria)' },
    hold: { type: 'number', range: [0, 2], unit: 's', default: 0, semantic: 'pausa antes del primer eco (rol hold de la memoria)' },
    revelar_en: { type: 'number', range: [0, 6], unit: 's', default: 1.2, semantic: 'cuándo aparece la respuesta, desde el inicio del plano (rol retencion)' },
  },
  entities: { rueda: wheelEntity(VIEW) },
  draw(ctx, t, u, shot, film, api) {
    const P = api.params, W = world(film), s0 = W.REV + 0.8 + P.hold, STEP = 0.33, DUR = 0.55;
    const eco = [...(P.eco ?? [])].sort((a, b) => a.tramo[0] - b.tramo[0] || a.giro.localeCompare(b.giro));
    const echoes = [], list = []; let wheelEcho = 0;
    eco.forEach((e, j) => {
      const kind = ECO_KIND[e.concepto] ?? 'corte', te = s0 + j * STEP, uu = (t - te) / DUR, s = clamp(e.fuerza);
      if (kind === 'rueda') wheelEcho = clamp((t - te) / 0.45); else echoes.push({ kind, u: uu, s });
      if (t >= te) list.push({ str: NAMES[kind] ?? kind, a: api.spring(t - te), s });
    });
    const answerAt = shot.t[0] + P.revelar_en;
    const caps = [{ str: P.text, t0: answerAt, t1: shot.t[1] - 0.2, color: 'accent2', role: 'h2' }];
    renderShot(ctx, api, film, shot, t, { view: VIEW, mood: 0.8, caps, echoes, wheelEcho });
    const [lx] = api.at(0.97, 0), y0 = api.at(0, 0.22)[1], dy = api.sizes.body * 1.9;
    list.forEach((e, i) => api.text(NAMES[ECO_KIND_BY_NAME(eco[i])] ?? '', lx, y0 + i * dy, { role: 'body', color: 'accent2', alpha: clamp(e.a) * (0.5 + 0.5 * e.s), align: 'right' }));
  },
};
function ECO_KIND_BY_NAME(e) { return e ? (ECO_MAP[e.concepto] ?? 'corte') : 'corte'; }
const ECO_MAP = { 'golpe-corte': 'corte', 'golpe-impacto': 'impacto', 'golpe-calor': 'calor', 'golpe-espinas': 'espinas', 'golpe-prensa': 'prensa', rafaga: 'rafaga', rueda: 'rueda' };
