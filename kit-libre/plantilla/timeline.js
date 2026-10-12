// timeline.js: UNICA fuente de tiempos. Imagen y sonido leen de aqui. Duraciones irregulares, un respiro, un pico (golpe).
export const fps = 30, W = 1920, H = 1080, cruce = 0.9;
export const escenas = [{ id: 'papel', t0: 0, dur: 5.5 }, { id: 'agua', t0: 5.5, dur: 8 }];
export const dur = escenas.reduce((s, e) => s + e.dur, 0);
export const eventos = [{ t: 0.6, tipo: 'papel' }, { t: 1.4, tipo: 'clic' }, { t: 1.9, tipo: 'gota' }, { t: 5.4, tipo: 'golpe' }, { t: 7.1, tipo: 'gota' }, { t: 9.6, tipo: 'moneda' }, { t: 11.2, tipo: 'gota' }];
export const notas = [{ t: 6.5, midi: 62 }, { t: 8.2, midi: 69, dur: 5 }, { t: 10.4, midi: 66, dur: 4 }];
