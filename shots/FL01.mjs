// Demo spec 021 (fondos libres): UN fondo que vive con el relato de 12 s. Turbio gris-verde → azul claro en el «giro» (t = 6 s), dos impactos (3,0 y 8,6 s)
// lo sacuden (onda + mancha + pulso + niebla que reacciona) y una capa `codigo` propia (burbujas) sube por dentro. Todo es DATO salvo shots/fondos/burbujas.mjs.
const IMPACTOS = [3.0, 8.6];
export default {
  draw(ctx, t, u, shot, film, api) {
    const lt = t - shot.t[0];
    api.fondo({
      semilla: 5,
      eventos: [{ id: 'giro', at: 6 }, ...IMPACTOS.map((at, i) => ({ tipo: 'impacto', id: `golpe${i}`, at, x: i ? 0.7 : 0.3, y: 0.55, fuerza: 1 }))],
      capas: [
        { id: 'agua', tipo: 'degradado', modo: 'lineal', angulo: 90, stops: [{ k: [[-1.5, '#5b6a5a'], [1.8, '#cfe6f6']], en: 'giro' }, { k: [[-1.5, '#2c382f'], [1.8, '#8fbbe0']], en: 'giro' }, { k: [[-1.5, '#161d19'], [1.8, '#5d8fc0']], en: 'giro' }] },
        { id: 'turbidez', tipo: 'deformado', modo: 'nube', color: '#1f2a22', colorB: { k: [[-1.5, '#7d8a6c'], [1.8, '#f2faff']], en: 'giro' }, escala: 0.5, fuerza: 0.9, contraste: 1.5, mezcla: 'normal', deriva: [0.006, -0.002], paralaje: 0.15,
          alfa: { k: [[-1.5, 0.75], [1.8, 0.28]], en: 'giro' } },
        { id: 'rayos', tipo: 'rayos', color: '#ffffff', origen: [0.5, -0.1], n: 7, apertura: 50, intensidad: { k: [[-1.5, 0.02], [1.8, 0.22]], en: 'giro' }, mezcla: 'pantalla', paralaje: 0.3 },
        { id: 'bruma', tipo: 'niebla', color: { k: [[-1.5, '#46513f'], [1.8, '#dcecf8']], en: 'giro' }, horizonte: 0.6, densidad: { expr: "0.55 - 0.25*paso('giro',2) + 0.3*pulso('impacto',0.6)" }, mezcla: 'pantalla', paralaje: 0.5 },
        { id: 'burbujas', tipo: 'codigo', archivo: 'fondos/burbujas.mjs', maxMs: 40, paralaje: 0.9, params: { n: 46, alfa: 1, color: { k: [[-1.5, '#9aa88c'], [1.8, '#ffffff']], en: 'giro' } } },
        { id: 'onda', tipo: 'onda', evento: 'impacto', color: '#ffffff', velocidad: 0.7, ancho: 0.07, anillos: 3, vida: 2.2, intensidad: 0.85, paralaje: 0.4 },
        { id: 'tinta', tipo: 'mancha', evento: 'impacto', color: { k: [[-1.5, '#10170f'], [1.8, '#2c5d94']], en: 'giro' }, radio: 0.2, persiste: 1.2, vida: 2.5, intensidad: 0.45, mezcla: 'multiplicar', paralaje: 0.5 },
        { id: 'flash', tipo: 'pulso', evento: 'impacto', color: '#ffffff', tau: 0.25, intensidad: 0.5, modo: 'radial', radio: 1.2 },
        { id: 'vineta', tipo: 'vineta', color: { k: [[-1.5, '#05080a'], [1.8, '#16314d']], en: 'giro' }, fuerza: 0.6, paralaje: 0 },
      ],
    });
    for (const at of IMPACTOS) api.impact(at, { frames: 2, mode: 'burst', color: 'paper' });          // mismo `at` que los eventos del fondo
    const a = api.ease('out', Math.min(1, lt / 1.2));
    const [bx, by] = api.at(0.5, 0.62);
    api.objeto('botella_vidrio', { x: bx, y: by, size: api.safe.h * 0.5, rot: Math.sin(lt * 0.8) * 0.08, label: 'botella' });   // el sujeto: el fondo vive DETRÁS de él
    api.text(lt < 6 ? 'TURBIO' : 'CLARO', ...api.at(0.5, 0.12), { role: 'h1', alpha: a, color: lt < 6 ? 'paper' : 'ink' });
  },
};
