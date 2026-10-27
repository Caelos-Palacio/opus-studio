// timeline.js: UNICA fuente de tiempos. Imagen y sonido leen de aqui. Duraciones irregulares (CV >= 0.3), un respiro, un pico (golpe).
// `cruces[i]`: segundos de la transicion motivada entre la escena i y la i+1 (la escena i+1 ya empieza a vivir al comenzar el cruce).
// Cada escena declara su sujeto en frame.js (cajas(t).sujeto) o aqui con `sujeto:{x,y,w,h}` / `ocupacion_ok:{porque}` para un plano general intencionado.
export const fps = 30, W = 1920, H = 1080, cruces = [1.6, 1.8];
export const escenas = [
  { id: 'titulo', t0: 0, dur: 5 },
  { id: 'ruta', t0: 5, dur: 7.5, sujeto: { x: 0, y: 0, w: 1920, h: 1080 } },
  { id: 'cifra', t0: 12.5, dur: 12 },
];
export const dur = escenas.reduce((s, e) => s + e.dur, 0);
export const eventos = [{ t: 0.7, tipo: 'papel' }, { t: 1.6, tipo: 'clic' }, { t: 3.2, tipo: 'gota' }, { t: 4.9, tipo: 'golpe' }, { t: 8.2, tipo: 'clic' }, { t: 11.7, tipo: 'gota' }, { t: 15.5, tipo: 'gota' }, { t: 20.5, tipo: 'moneda' }];
export const notas = [{ t: 6, midi: 62 }, { t: 9, midi: 69, dur: 5 }, { t: 15, midi: 66, dur: 4 }];
