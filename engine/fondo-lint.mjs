// LINT anti-menú de fondos (spec 021 §D) — núcleo PURO: decide los avisos fondo.estatico y fondo.preset_crudo a partir de lo que cada shot dijo
// al pintar su fondo (meta `fondo` que deja api.fondo: familia, preset, ajustado, animado) y de la estructura del timeline. engine/lint.mjs lo llama.
//   fondo.estatico     una familia sin variación animada en > 60 % de la duración del film (sin api.fondo, la familia es el soporte del medio)
//   (ambos son SUGERENCIAS: siempre WARN suave, nunca FIX ni bloquean gate/master/orquestación)
//   fondo.preset_crudo un preset sin ajustes/sin/capas en > 50 % de los shots con fondo
//   fondo_ok:{porque}  (≥ 20 caracteres) en el timeline justifica ambos: el soporte constante puede SER la metáfora (Mate papel)
export const FONDO_LIBRE = { estatico: 0.8, crudo: 0.5, okMin: 20, muestras: 8 };
export const fondoJustificado = (film) => (film.fondo_ok?.porque ?? '').trim().length >= FONDO_LIBRE.okMin;
// per: Map shotId → { familia, preset, ajustado, animado }.  → [{regla, shot, t, problem, remedy}]
export function analizarFondos(film, per) {
  if (fondoJustificado(film)) return [];
  const out = [], dur = (s) => s.t[1] - s.t[0], total = film.shots.reduce((a, s) => a + dur(s), 0) || film.duration, fam = new Map();
  for (const s of film.shots) {
    const m = per.get(s.id); if (!m || m.animado) continue;                 // sin fondo declarado en el shot: no cuenta (el soporte del medio no es un fondo declarado)
    const f = m.familia;
    const g = fam.get(f) ?? { dur: 0, first: s, n: 0 }; g.dur += dur(s); g.n++; fam.set(f, g);
  }
  const top = [...fam.entries()].sort((a, b) => b[1].dur - a[1].dur)[0];
  if (per.size && top && top[1].dur / total > FONDO_LIBRE.estatico) out.push({ regla: 'fondo.estatico', shot: top[1].first.id, t: top[1].first.t[0],
    problem: `fondo.estatico (sugerencia): el mismo fondo (${top[0]}) no varía en ${Math.round((100 * top[1].dur) / total)} % del film (${top[1].n} shots; umbral ${Math.round(100 * FONDO_LIBRE.estatico)} %)`,
    remedy: 'considera animar el fondo con el relato (keyframes {k:[…],en:"giro"} o {expr}), añadir una capa reactiva (onda/mancha/pulso) o código propio; si el soporte constante ES la metáfora (papel, pizarra), es válido: déjalo (o declara fondo_ok:{porque})' });
  const crudos = [...per.values()].filter((m) => m.preset && !m.ajustado);
  if (per.size && crudos.length / per.size > FONDO_LIBRE.crudo) out.push({ regla: 'fondo.preset_crudo', shot: crudos[0].shot, t: film.shots.find((s) => s.id === crudos[0].shot)?.t[0] ?? 0,
    problem: `fondo.preset_crudo (sugerencia): ${crudos.length} de ${per.size} shots con fondo usan un preset sin ningún ajuste (umbral ${Math.round(100 * FONDO_LIBRE.crudo)} %)`,
    remedy: 'considera que los presets son ejemplos de partida: derivar con ajustes (colores, escalas), sin (quitar capas), capas (añadir las propias) o keyframes; ver node engine/tools.mjs show <preset>' });
  return out;
}
