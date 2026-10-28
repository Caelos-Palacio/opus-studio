// hechos.js: hechos verificados (research 11, encargo). Fuente: regla gregoriana del calendario; documentacion de Microsoft
// ("Excel incorrectly assumes that the year 1900 is a leap year", KB 214326); compatibilidad con Lotus 1-2-3 (1983).
export const hechos = {
  anio: 1900, divisores: [[4, 475], [100, 19], [400, 4.75]], serie: 60, lotus: 1983,
  tecleo: '29/02/1900',
  voz: {
    tecleo: '03:12. Tecleo 29/02/1900 y la hoja asiente.',
    bisiesto: '1900 no fue bisiesto.',
    baja: '¿Quién coló un día en la A60?',
    respiro: 'Lo llamé error. Me equivoqué.',
    lotus: 'Lotus ya lo hacía, en 1983.',
    desplaza: 'Si lo corriges, cada fecha guardada se mueve un día.',
    cierre: 'Microsoft lo documenta. Es a propósito.',
  },
};
// Si se corrigiera el error, casi todas las fechas POSTERIORES al 28/02/1900 se moverian un dia (no las anteriores).
// fecha(serie): serie 1 = 01/01/1900; la 60 es el 29/02 fantasma (Excel/Lotus); desde la 61, 01/03/1900 en adelante.
const MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export function fecha(s) {
  if (s === 60) return '29/02/1900';
  let d = s < 60 ? s : s - 1, m = 0; while (d > MES[m]) { d -= MES[m]; m++; }
  return String(d).padStart(2, '0') + '/' + String(m + 1).padStart(2, '0') + '/1900';
}
