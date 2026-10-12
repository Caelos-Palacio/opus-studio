// EVENTOS del film para los fondos (spec 021): lista ordenada de {t, kind, id, x?, y?, fuerza?} con t ABSOLUTO (s del film), derivada solo de DATOS
// del timeline, del story y de las escenas DSL (nada en tiempo de ejecución ⇒ pura de t). Pura: no importa fs (film.mjs lee los ficheros).
//   kind 'impacto': sfx {type:"impact"} del timeline y nodos {type:"impact", at} de las escenas       id `<shot>:impacto<i>`
//   kind 'cue'    : cues numéricos de las escenas DSL                                                   id = id del cue
//   kind 'beat'   : beats del story                                                                     id = b.id (b1, b2…)
//   Los eventos propios de un fondo (`eventos:[…]`) se suman en drawFondo. Los api.impact de un shot JS no se descubren antes de pintar: declararlos allí.
const num = (v) => typeof v === 'number' && Number.isFinite(v);
function* nodos(list) { for (const o of list ?? []) { if (!o || typeof o !== 'object') continue; yield o; yield* nodos(o.children); } }
export function eventosDeFilm({ shots = [], story = null, escenas = {}, W = 1, H = 1 } = {}) {
  const ev = [];
  for (const s of shots) {
    (s.sfx ?? []).forEach((e, i) => { if (e?.type === 'impact' && num(e.at)) ev.push({ t: s.t[0] + e.at, kind: 'impacto', id: `${s.id}:impacto${i}`, shot: s.id }); });
    const sc = escenas[s.id]; if (!sc) continue;
    for (const c of sc.cues ?? []) if (c?.id && num(c.at)) ev.push({ t: s.t[0] + c.at, kind: 'cue', id: c.id, shot: s.id });
    let n = 0;
    for (const o of nodos(sc.objects)) if (o.type === 'impact' && num(o.at)) {
      const op = o.opts && typeof o.opts === 'object' ? o.opts : {}, e = { t: s.t[0] + o.at, kind: 'impacto', id: `${s.id}:nodo${n++}`, shot: s.id };
      if (num(op.x)) e.x = op.x / W; if (num(op.y)) e.y = op.y / H; ev.push(e);
    }
  }
  (story?.beats ?? []).forEach((b, i) => { if (num(b?.t)) ev.push({ t: b.t, kind: 'beat', id: b.id ?? `b${i + 1}`, ...(b.shot ? { shot: b.shot } : {}) }); });
  return ev.sort((a, b) => a.t - b.t || String(a.id).localeCompare(String(b.id)));
}
