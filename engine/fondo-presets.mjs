// PRESETS de fondo (spec 014): fondos TEMÁTICOS de referencia, escritos como DATOS (pilas de capas de fondo-capas.mjs).
// Cada uno trae `porque` (el tema que sirve: spec 012 Lección — el fondo se elige por tema, no «para evitar el negro»),
// `resumen` (≤ 15 palabras), `tags` y `medio` (soporte con el que luce). Los claros usan ROLES de la paleta (se adaptan al medio);
// los oscuros usan tintas absolutas porque la oscuridad ES el tema (agua negra, noche, cosmos).
// Se DERIVAN, no se eligen: `ajustes` por id de capa (con valores animados: expr / keyframes con ancla `en`), `sin` para quitar, `capas` extra encima
// (también reactivas `onda`/`mancha`/`pulso` y `codigo` propio). Usado crudo en la mayoría de los shots, el lint avisa (fondo.preset_crudo).
export const PRESETS = {
  cosmos_profundo: {
    resumen: 'Ejemplo de partida: cosmos con nebulosa, dos campos de estrellas y polvo.', tags: ['oscuro', 'cosmos', 'escala', 'noche'], medio: 'sin medio o neon',
    porque: 'Ejemplo de partida para relatos de escala inmensa, noche o vacío: la oscuridad es el tema y la profundidad (nebulosa, estrellas lejanas y cercanas, polvo) evita el negro vacío. Derívalo: tiñe la nebulosa con el color del relato, quita capas con `sin`, anima brillo y tinte con keyframes.',
    capas: [
      { tipo: 'degradado', id: 'espacio', modo: 'radial', stops: ['#0d1430', '#05070f', '#020309'], centro: [0.58, 0.42], radio: 1.25 },
      { tipo: 'deformado', id: 'nebulosa', modo: 'nube', color: '#07102a', colorB: '#5a44b8', escala: 0.55, fuerza: 0.9, contraste: 1.6, alfa: 0.85, mezcla: 'pantalla', deriva: [0.004, 0.001], paralaje: 0.08 },
      { tipo: 'fbm', id: 'gas', modo: 'nube', color: '#07102a', colorB: '#a8407a', escala: 0.9, contraste: 1.8, alfa: 0.4, mezcla: 'pantalla', semilla: 7, deriva: [-0.003, 0.0015], paralaje: 0.14 },
      { tipo: 'estrellas', id: 'lejanas', n: 900, tamano: [0.6, 1.2], fuerza: 0.8, titileo: 0.3, destellos: 0, paralaje: 0.05 },
      { tipo: 'estrellas', id: 'cercanas', n: 160, tamano: [0.8, 2.1], fuerza: 0.95, titileo: 0.45, destellos: 5, semilla: 3, paralaje: 0.16, color: '#eef3ff', colorB: '#ffcf9a' },
      { tipo: 'polvo', id: 'polvo', n: 70, color: '#a9bcff', alfaMax: 0.35, tamano: [0.5, 2.6], paralaje: 1.15 },
      { tipo: 'vineta', id: 'vineta', color: '#010208', fuerza: 0.75, interior: 0.3, paralaje: 0 },
    ],
  },
  cuba_oscura: {
    resumen: 'Ejemplo de partida: agua negra con esferas luminosas, niebla fría, haces y paralaje.', tags: ['oscuro', 'agua', 'ciencia', 'detector', 'silencio'], medio: 'sin medio o neon',
    porque: 'Ejemplo de partida para relatos de detección, silencio o cavidades bajo tierra o bajo el agua: la oscuridad es el sujeto y las luces a distinta profundidad dan escala sin llenar el cuadro. Derívalo: cambia la cantidad y el color de las esferas, reacciona a los impactos con una capa `onda`.',
    capas: [
      { tipo: 'degradado', id: 'agua', modo: 'lineal', angulo: 90, stops: ['#020911', '#05202e', '#020509'] },
      { tipo: 'deformado', id: 'turbidez', modo: 'nube', color: '#031018', colorB: '#14506a', escala: 0.6, fuerza: 0.8, contraste: 1.4, alfa: 0.3, mezcla: 'pantalla', deriva: [0.003, -0.002], paralaje: 0.15 },
      { tipo: 'rayos', id: 'haces', color: '#7fd6ff', origen: [0.52, -0.12], n: 8, apertura: 48, direccion: 92, intensidad: 0.11, mezcla: 'pantalla', paralaje: 0.3 },
      { tipo: 'orbes', id: 'pmtLejanos', n: 84, radio: 0.017, disposicion: 'rejilla', area: [0.08, 0.92], brillo: 0.5, parpadeo: 0.6, destello: 0.03, cristal: '#0b2230', color: '#8fe8ff', alfa: 0.7, paralaje: 0.32 },
      { tipo: 'niebla', id: 'bruma', color: '#0d4660', horizonte: 0.52, altura: 0.55, densidad: 0.5, ruido: 0.85, velocidad: 0.01, mezcla: 'pantalla', paralaje: 0.5 },
      { tipo: 'orbes', id: 'pmtCercanos', n: 11, radio: 0.062, disposicion: 'dispersa', area: [0.12, 0.88], brillo: 0.78, parpadeo: 0.55, destello: 0.1, cristal: '#0c2a3a', color: '#a8f0ff', semilla: 5, alfa: 0.92, paralaje: 0.85 },
      { tipo: 'polvo', id: 'nieveMarina', n: 130, color: '#b4ecff', tamano: [0.5, 2.8], viento: [0.001, -0.007], alfaMax: 0.4, titileo: 0.7, paralaje: 1.05 },
      { tipo: 'vineta', id: 'vineta', color: '#000306', fuerza: 0.78, interior: 0.28, paralaje: 0 },
    ],
  },
  expediente_kraft: {
    resumen: 'Ejemplo de partida: soporte de estraza con renglones, marcas de registro y rayado a lápiz.', tags: ['claro', 'papel', 'archivo', 'burocracia', 'kraft'], medio: 'kraft',
    porque: 'Ejemplo de partida para relatos de archivo, trámite o custodia: el soporte de papel basto con renglones y marcas de registro es parte de la metáfora, no un adorno. Derívalo: envejece el soporte con keyframes, añade una `mancha` al sellar, cambia el rayado.',
    capas: [
      { tipo: 'degradado', id: 'soporte', stops: ['paper', 'shade'], modo: 'lineal', angulo: 80, alfa: 0.5, mezcla: 'multiplicar' },
      { tipo: 'fbm', id: 'mota', color: 'paper', colorB: 'shade', modo: 'nube', escala: 0.4, alfa: 0.4, mezcla: 'multiplicar', paralaje: 0.1 },
      { tipo: 'rayado', id: 'renglones', color: 'ink', paso: 0.058, margen: 0.11, colorMargen: 'accent', alfa: 0.2, inicio: 0.2, mezcla: 'multiplicar', paralaje: 0.2 },
      { tipo: 'motivo', id: 'registro', forma: 'cruz', color: 'ink', disposicion: 'rejilla', paso: 0.3, tamano: 0.16, variacion: 0.05, alfa: 0.22, mezcla: 'multiplicar', paralaje: 0.2 },
      { tipo: 'trama', id: 'lapiz', color: 'ink', angulo: -35, paso: 0.016, cobertura: 0.18, alfa: 0.14, mezcla: 'multiplicar', semilla: 4, paralaje: 0.45 },
      { tipo: 'vineta', id: 'vineta', color: 'ink', fuerza: 0.35, interior: 0.4, mezcla: 'multiplicar', paralaje: 0 },
    ],
  },
  papel_carta_acuarela: {
    resumen: 'Ejemplo de partida: papel de carta con renglones azules, lavados de acuarela y ondas.', tags: ['claro', 'papel', 'acuarela', 'carta', 'ternura'], medio: 'papel_crema',
    porque: 'Ejemplo de partida para relatos íntimos, de espera o de correspondencia: el papel rayado y la acuarela (agua, sal, tiempo) sostienen la ternura sin sentimentalismo. Derívalo: que los lavados pasen de turbios a claros en el giro del relato (keyframes con `en`).',
    capas: [
      { tipo: 'relleno', id: 'papel', color: 'paper', alfa: 1 },
      { tipo: 'fbm', id: 'fibra', color: 'paper', colorB: 'shade', modo: 'nube', escala: 0.3, octavas: 6, alfa: 0.35, mezcla: 'multiplicar', paralaje: 0.08 },
      { tipo: 'acuarela', id: 'lavados', colores: ['accent2', { mezcla: ['accent2', 'accent', 0.45] }, 'accent'], n: 7, tamano: [0.08, 0.2], intensidad: 0.13, zona: [0.4, 1], mezcla: 'multiplicar', paralaje: 0.22 },
      { tipo: 'rayado', id: 'renglones', color: 'accent2', paso: 0.052, margen: 0.13, colorMargen: 'accent', alfa: 0.33, inicio: 0.18, mezcla: 'multiplicar', paralaje: 0.2, inclinacion: 0.004 },
      { tipo: 'motivo', id: 'olitas', forma: 'onda', color: 'accent2', disposicion: 'ladrillo', paso: 0.17, tamano: 0.3, variacion: 0.5, alfa: 0.1, mezcla: 'multiplicar', paralaje: 0.3 },
      { tipo: 'polvo', id: 'sal', n: 50, color: 'ink', tamano: [0.5, 1.8], alfaMax: 0.2, titileo: 0.2, mezcla: 'multiplicar', paralaje: 1.1 },
      { tipo: 'vineta', id: 'vineta', color: 'shade', fuerza: 0.4, interior: 0.35, mezcla: 'multiplicar', paralaje: 0 },
    ],
  },
  mar_acuarela: {
    resumen: 'Ejemplo de partida: mar de acuarela con lavados azules, franjas de olas y bruma.', tags: ['claro', 'mar', 'acuarela', 'agua', 'calma'], medio: 'papel_crema',
    porque: 'Ejemplo de partida para cualquier relato sobre el mar, el agua o el tiempo en calma: el agua pintada da movimiento lento y luz sin competir con el objeto ancla. Derívalo: sube la amplitud de las olas con el drama, tiñe el cielo según la hora del relato.',
    capas: [
      { tipo: 'degradado', id: 'cielo', modo: 'lineal', angulo: 90, stops: ['paper', { mezcla: ['paper', 'accent2', 0.18] }], alfa: 1 },
      { tipo: 'acuarela', id: 'cielo2', colores: ['accent2', 'shade'], n: 4, tamano: [0.25, 0.5], intensidad: 0.14, zona: [0, 0.4], mezcla: 'multiplicar', paralaje: 0.1 },
      { tipo: 'olas', id: 'mar', color: 'accent2', colorB: 'paper', horizonte: 0.4, filas: 9, amplitud: 0.012, longitud: 0.3, velocidad: 0.04, espuma: 0.5, alfa: 0.75, paralaje: 0.35 },
      { tipo: 'niebla', id: 'bruma', color: 'paper', horizonte: 0.4, altura: 0.18, densidad: 0.75, ruido: 0.6, paralaje: 0.2 },
      { tipo: 'fbm', id: 'grano', color: 'paper', colorB: 'shade', modo: 'nube', escala: 0.25, alfa: 0.25, mezcla: 'multiplicar', paralaje: 0.05 },
      { tipo: 'vineta', id: 'vineta', color: 'shade', fuerza: 0.35, mezcla: 'multiplicar', paralaje: 0 },
    ],
  },
  noche_ciudad: {
    resumen: 'Ejemplo de partida: noche urbana con cielo violeta, montañas, rascacielos, bokeh y bruma.', tags: ['oscuro', 'ciudad', 'noche', 'luces'], medio: 'sin medio o neon',
    porque: 'Ejemplo de partida para historias de gente, turnos o señales nocturnas: las ventanas encendidas dan escala humana y el bokeh cálido, intimidad. Derívalo: enciende más ventanas a lo largo del relato, apaga el bokeh en el silencio.',
    capas: [
      { tipo: 'degradado', id: 'cielo', modo: 'lineal', angulo: 90, stops: ['#050818', '#1a1440', '#4a2a5a'] },
      { tipo: 'estrellas', id: 'estrellas', n: 140, fuerza: 0.55, titileo: 0.5, destellos: 0, paralaje: 0.04 },
      { tipo: 'perfil', id: 'sierra', modo: 'montanas', color: '#0d0f26', base: 0.7, altura: 0.2, detalle: 6, paralaje: 0.18 },
      { tipo: 'niebla', id: 'brumaLejos', color: '#4a2f68', horizonte: 0.68, altura: 0.2, densidad: 0.6, mezcla: 'pantalla', paralaje: 0.3 },
      { tipo: 'perfil', id: 'ciudad', modo: 'ciudad', color: '#070814', base: 0.88, altura: 0.5, luces: '#ffc872', encendidas: 0.3, parpadeo: 0.05, paralaje: 0.55 },
      { tipo: 'bokeh', id: 'luces', colores: ['#ffb35c', '#ff6f91', '#7fb7ff'], n: 20, radio: [0.02, 0.075], alfaMax: 0.2, mezcla: 'pantalla', paralaje: 0.95 },
      { tipo: 'vineta', id: 'vineta', color: '#02030a', fuerza: 0.65, paralaje: 0 },
    ],
  },
  laboratorio: {
    resumen: 'Ejemplo de partida: laboratorio claro con retícula de puntos, cono de lámpara y semitono.', tags: ['claro', 'ciencia', 'medida', 'tecnico'], medio: 'tecnico o pizarra',
    porque: 'Ejemplo de partida para relatos de medir, razonar o demostrar: retícula de referencia, una lámpara que ilumina el experimento y márgenes limpios para los datos. Derívalo: mueve el foco de la lámpara hacia el dato, afina la retícula cuando el relato se concreta.',
    capas: [
      { tipo: 'degradado', id: 'pared', stops: ['paper', 'shade'], modo: 'radial', centro: [0.5, 0.55], radio: 1.1, alfa: 1 },
      { tipo: 'reticula', id: 'puntos', estilo: 'puntos', color: 'ink', paso: 0.045, mayor: 0, alfa: 0.18, paralaje: 0.2 },
      { tipo: 'reticula', id: 'ejes', estilo: 'lineas', color: 'accent2', paso: 0.225, mayor: 0, alfa: 0.12, paralaje: 0.25 },
      { tipo: 'foco', id: 'lampara', color: 'paper', centro: [0.5, 0.6], radio: 0.55, achatado: 0.6, intensidad: 0.6, cono: true, origenCono: [0.5, -0.12], paralaje: 0.4 },
      { tipo: 'semitono', id: 'esquina', color: 'ink', campo: 'radial', centro: [1.05, 1.05], paso: 0.026, tamano: 0.8, alfa: 0.1, paralaje: 0.3 },
      { tipo: 'vineta', id: 'vineta', color: 'ink', fuerza: 0.3, mezcla: 'multiplicar', paralaje: 0 },
    ],
  },
  taller_madera: {
    resumen: 'Ejemplo de partida: banco de taller con vetas, lámpara cálida, polvo dorado y rayones.', tags: ['oscuro', 'madera', 'taller', 'calido', 'oficio'], medio: 'sin medio',
    porque: 'Ejemplo de partida para relatos de oficio (reparar, medir a mano, escribir con pluma): las vetas dan escala táctil y la lámpara recorta el objeto del resto. Derívalo: baja la lámpara al cerrar el relato, cambia la madera por otro tono.',
    capas: [
      { tipo: 'degradado', id: 'base', modo: 'lineal', angulo: 90, stops: ['#2a1a0e', '#4a2f19', '#241508'] },
      { tipo: 'deformado', id: 'vetas', color: '#2b1a0d', colorB: '#7a5230', escala: 0.14, estira: 7, fuerza: 0.5, contraste: 1.6, alfa: 0.7, mezcla: 'superponer', paralaje: 0.18 },
      { tipo: 'trama', id: 'rayones', color: '#e8c89a', angulo: 12, paso: 0.02, cobertura: 0.12, alfa: 0.08, paralaje: 0.3 },
      { tipo: 'foco', id: 'lampara', color: '#ffd9a0', centro: [0.5, 0.58], radio: 0.5, achatado: 0.65, intensidad: 0.5, cono: true, origenCono: [0.62, -0.1], mezcla: 'pantalla', paralaje: 0.4 },
      { tipo: 'polvo', id: 'serrin', n: 90, color: '#ffe2b0', alfaMax: 0.4, tamano: [0.5, 2.2], viento: [0.003, -0.004], paralaje: 1 },
      { tipo: 'vineta', id: 'vineta', color: '#0c0603', fuerza: 0.8, interior: 0.25, paralaje: 0 },
    ],
  },
  amanecer_niebla: {
    resumen: 'Ejemplo de partida: amanecer con niebla, sierras en bandas, rayos de sol y polvo.', tags: ['claro', 'amanecer', 'paisaje', 'esperanza', 'niebla'], medio: 'papel_crema',
    porque: 'Ejemplo de partida para una apertura serena o un cierre que no explica nada: el horizonte entre la niebla da esperanza sin música épica. Derívalo: levanta el sol y despeja la bruma con keyframes a lo largo del shot.',
    capas: [
      { tipo: 'degradado', id: 'cielo', modo: 'lineal', angulo: 90, stops: ['#7d8fb0', '#e9a98f', '#f6d8b8'] },
      { tipo: 'fbm', id: 'nubes', modo: 'nube', color: '#f6d8b8', colorB: '#fff4de', escala: 0.5, contraste: 1.7, alfa: 0.55, deriva: [0.005, 0], paralaje: 0.1 },
      { tipo: 'rayos', id: 'sol', color: '#fff1d0', origen: [0.78, 0.38], n: 9, apertura: 120, direccion: 165, intensidad: 0.2, mezcla: 'pantalla', paralaje: 0.2 },
      { tipo: 'perfil', id: 'sierraLejos', modo: 'montanas', color: '#b9a9b8', base: 0.7, altura: 0.2, detalle: 5, alfa: 0.8, paralaje: 0.2 },
      { tipo: 'niebla', id: 'bruma1', color: '#f8e6cf', horizonte: 0.7, altura: 0.18, densidad: 0.8, paralaje: 0.32 },
      { tipo: 'perfil', id: 'sierraCerca', modo: 'montanas', color: '#7c6f8a', base: 0.82, altura: 0.22, detalle: 6, semilla: 11, paralaje: 0.5 },
      { tipo: 'niebla', id: 'bruma2', color: '#fdeede', horizonte: 0.85, altura: 0.2, densidad: 0.7, velocidad: -0.01, paralaje: 0.7 },
      { tipo: 'polvo', id: 'luz', n: 60, color: '#fff7e6', alfaMax: 0.5, paralaje: 1.05 },
    ],
  },
  plano_tecnico: {
    resumen: 'Ejemplo de partida: plano milimetrado con líneas mayores, marcas de registro y viñeta.', tags: ['claro', 'plano', 'ingenieria', 'medida'], medio: 'tecnico o tecnico_bermellon',
    porque: 'Ejemplo de partida para relatos que construyen o miden algo (un mecanismo, una balanza, un instrumento): el milimetrado enmarca el objeto como pieza de ingeniería. Derívalo: engrosa la retícula mayor cuando el objeto se acerca al dato.',
    capas: [
      { tipo: 'relleno', id: 'papel', color: 'paper' },
      { tipo: 'reticula', id: 'menor', estilo: 'lineas', color: 'accent2', paso: 0.025, mayor: 0, alfa: 0.3, grosor: 0.8, paralaje: 0.15 },
      { tipo: 'reticula', id: 'mayor', estilo: 'lineas', color: 'accent2', paso: 0.125, mayor: 0, alfa: 0.55, grosor: 1.4, paralaje: 0.15 },
      { tipo: 'motivo', id: 'registro', forma: 'anillo', color: 'accent', disposicion: 'rejilla', paso: 0.5, tamano: 0.18, variacion: 0, alfa: 0.4, grosor: 1.2, paralaje: 0.2 },
      { tipo: 'trama', id: 'sombra', color: 'ink', angulo: 45, paso: 0.01, cobertura: 0.2, alfa: 0.1, paralaje: 0.4 },
      { tipo: 'vineta', id: 'vineta', color: 'ink', fuerza: 0.28, mezcla: 'multiplicar', paralaje: 0 },
    ],
  },
};
