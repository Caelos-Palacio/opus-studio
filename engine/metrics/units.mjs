import { terms } from "../vocab.mjs";
// Unidades con sentido: tabla de unidades (símbolo → dimensión como vector de exponentes), escala de plano y conversiones de
// los parámetros de shot (unit del esquema F4) a magnitudes que un director/diseñador reconoce.
export const UNITS = {
  s: { dim: { T: 1 }, label: 'segundo' }, ms: { dim: { T: 1 }, label: 'milisegundo' }, 'cortes/min': { dim: { T: -1 }, label: 'cortes por minuto' },
  1: { dim: {}, label: 'adimensional' }, '%': { dim: {}, label: 'porcentaje' }, ':1': { dim: {}, label: 'razón' }, n: { dim: {}, label: 'recuento' }, Lc: { dim: {}, label: 'contraste APCA Lc' },
  mm: { dim: { L: 1 }, label: 'milímetro (equiv. 35 mm)' }, '°': { dim: { A: 1 }, label: 'grado' }, arcmin: { dim: { A: 1 }, label: 'minuto de arco' }, '°/s': { dim: { A: 1, T: -1 }, label: 'grados por segundo' },
  'stops/s': { dim: { S: 1, T: -1 }, label: 'pasos (log2 de escala) por segundo' }, stops: { dim: { S: 1 }, label: 'pasos (log2)' }, 'alturas/s': { dim: { T: -1 }, label: 'alturas de sujeto por segundo' },
  'anchos/s': { dim: { T: -1 }, label: 'anchos de pantalla por segundo' }, 'anchos/s²': { dim: { T: -2 }, label: 'anchos de pantalla por s²' }, 'anchos/s³': { dim: { T: -3 }, label: 'anchos de pantalla por s³' },
  'décadas/s': { dim: { D: 1, T: -1 }, label: 'décadas (log10) por segundo' }, décadas: { dim: { D: 1 }, label: 'décadas (log10)' },
  ΔE00: { dim: { C: 1 }, label: 'diferencia de color CIEDE2000' }, 'palabras/min': { dim: { W: 1, T: -1 }, label: 'palabras por minuto' }, 'car/s': { dim: { Ch: 1, T: -1 }, label: 'caracteres por segundo' },
  elementos: { dim: { N: 1 }, label: 'elementos simultáneos' }, 'conceptos/min': { dim: { K: 1, T: -1 }, label: 'conceptos nuevos por minuto' }, ISO: { dim: { ISO: 1 }, label: 'sensibilidad ISO equivalente' },
  LUFS: { dim: { dB: 1 }, label: 'LUFS (BS.1770)' }, LU: { dim: { dB: 1 }, label: 'LU' }, dBTP: { dim: { dB: 1 }, label: 'dB true peak' }, dB: { dim: { dB: 1 }, label: 'decibelio' }, BPM: { dim: { B: 1, T: -1 }, label: 'pulsos por minuto' },
  categoría: { dim: {}, label: 'categórica' }, '0–1': { dim: {}, label: 'índice normalizado' },
};
export const dimKey = (d) => Object.keys(d).sort().map((k) => `${k}^${d[k]}`).join('·') || '1';
export const dimOf = (u) => (UNITS[u] ? dimKey(UNITS[u].dim) : null);

// Escala de plano por fracción f = altura del sujeto / altura visible del encuadre (convención; Bordwell & Thompson, Film Art):
export const SCALES = terms('shot.scale').map((n, i) => [n, [1.0, 0.6, 0.4, 0.25, 0.15, 0.08, 0][i]]);   // nombres: vocab (spec 006); umbrales: convención
export const scaleIndex = (f) => { const i = SCALES.findIndex(([, lo]) => f >= lo); return i < 0 ? SCALES.length - 1 : i; };
export const scaleName = (f) => SCALES[scaleIndex(f)][0];
const DECL = { ECU: 0, BCU: 0, CU: 1, MCU: 2, MS: 3, MCS: 3, MLS: 4, LS: 5, WS: 5, FS: 5, ELS: 6, EWS: 6, XLS: 6 };
export const declaredScale = (s) => (s && DECL[String(s).toUpperCase()] != null ? DECL[String(s).toUpperCase()] : null);
export const fracOfScale = (name) => { const i = SCALES.findIndex(([n]) => n === name); return i < 0 ? null : [SCALES[i][1], i ? SCALES[i - 1][1] : Infinity]; };

// Unidades de los esquemas de parámetros (unit en shots/*.mjs) → magnitud con sentido.
export const visibleHeight = (film) => { const g = film.S?.grade?.letterbox; return g ? Math.min(film.height, film.width / g) : film.height; };
export const PARAM_UNITS = {
  '×': { sense: 'factor', dim: '1', convert: (v) => ({ value: v, unit: '×', note: 'multiplicador adimensional' }) },
  s: { sense: 'tiempo', dim: 'T^1', convert: (v, film) => ({ value: v, unit: 's', note: `${(v * film.fps).toFixed(1)} fotogramas a ${film.fps} fps` }) },
  vh: { sense: 'fracción del alto visible', dim: '1', convert: (v, film, name) => (/size|^s$|^h$|height|alto/i.test(name) ? { value: v, unit: 'escala de plano', note: `${scaleName(v)} (sujeto = ${(v * 100).toFixed(0)} % del alto visible) · ${(v * visibleHeight(film)).toFixed(0)} px a ${film.width}×${film.height}` } : { value: v, unit: 'alto visible', note: `${(v * 100).toFixed(0)} % del alto visible` }) },
  w: { sense: 'anchos de pantalla', dim: '1', convert: (v, film) => ({ value: v, unit: 'anchos de pantalla', note: `${(v * film.width).toFixed(0)} px a ${film.width}` }) },
  px: { sense: 'píxeles del film', dim: 'L^1', convert: (v, film) => ({ value: v / film.width, unit: 'anchos de pantalla', note: `${v} px = ${((v / film.width) * 100).toFixed(2)} % del ancho` }) },
  safe: { sense: 'fracción del área segura', dim: '1', convert: (v, film) => { const P = film.P?.safe ?? { top: 0.08, bottom: 0.08 }; return { value: v * (1 - P.top - P.bottom), unit: 'alto visible', note: `${(v * 100).toFixed(0)} % del área segura = ${((P.top + v * (1 - P.top - P.bottom)) * 100).toFixed(0)} % del alto visible` }; } },
};
// Recorre los params promovidos de los shots del film y devuelve {shot, name, unit, sense, default, converted}.
export function describeParams(film) {
  const out = [];
  for (const s of film.shots) { const sch = film.mods?.[s.id]?.params; if (!sch) continue;
    for (const [name, d] of Object.entries(sch)) { const U = d.unit ? PARAM_UNITS[d.unit] : null, v = d.default;
      out.push({ shot: s.id, name, type: d.type, unit: d.unit ?? null, known: !d.unit || !!U, sense: U?.sense ?? null, default: v, converted: U && typeof v === 'number' ? U.convert(v, film, name) : null, semantic: d.semantic ?? null }); } }
  return out;
}
