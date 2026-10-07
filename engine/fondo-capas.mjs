// FONDOS GENERATIVOS (spec 014): un fondo es una PILA DE CAPAS declaradas como datos. Este módulo es PURO (sin fs ni Math.random):
// registro de capas con esquema estricto, validación, resolución de presets y pintado determinista. Lo importan dsl-core (validación),
// prims (api.fondo) y las herramientas. Las texturas pesadas (ruido, celular, acuarela) se precalculan UNA vez por
// (capa, semilla, paleta, tamaño) en E.cache y por fotograma solo se dibujan desplazadas (deriva con envoltura: el ruido es periódico).
//
//   fondo   = { preset?, semilla?, ajustes?: {<idCapa>: {param…}}, sin?: [idCapa], capas?: [capa…] }
//   capa    = { tipo, id?, alfa?, mezcla?, paralaje?, semilla?, deriva?: [vx,vy], anim?: {alfa,escala,dx,dy}, …params del tipo }
//   Coordenadas en fracción del cuadro (0..1) y tamaños en fracción del lado menor; colores = rol de la paleta | #hex | {mezcla:[a,b,u]} | {paleta:u}.
//   anim = expresiones de t (engine/expr.mjs; variables t lt u dur). Las capas se pintan 35 % más grandes que el cuadro (PAD) para el parallax.
import { rng, clamp, lerp, smooth, hash2, hashStr } from './core.mjs';
import { hex2rgb, rgba, mix, luminance } from './color.mjs';
import { compile } from './expr.mjs';

export const PAD = 1.4, TAU = Math.PI * 2;
export const MEZCLAS = { normal: 'source-over', multiplicar: 'multiply', pantalla: 'screen', luz: 'lighter', superponer: 'overlay' };
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
export const hint = (w, cs) => { let best = null, bd = 1e9; for (const c of cs) { const d = lev(String(w).toLowerCase(), String(c).toLowerCase()); if (d < bd) { bd = d; best = c; } }
  return best != null && bd <= Math.max(1, Math.floor(String(w).length / 3)) ? `¿quisiste decir "${best}"?` : `válidos: ${[...cs].join(' ')}`; };

// ── tipos de parámetro (esquema) ──────────────────────────────────────────────────────────────────────────────
//   num [min,max] · int [min,max] · bool · color · colores (lista) · par ([a,b] números) · enum (opciones) · json (objeto libre)
export const T = {
  num: (def, doc, min = -1e6, max = 1e6) => ({ type: 'num', def, doc, min, max }), int: (def, doc, min = 0, max = 4096) => ({ type: 'int', def, doc, min, max }),
  bool: (def, doc) => ({ type: 'bool', def, doc }), color: (def, doc) => ({ type: 'color', def, doc }), colores: (def, doc) => ({ type: 'colores', def, doc }),
  par: (def, doc) => ({ type: 'par', def, doc }), enu: (def, doc, opts) => ({ type: 'enum', def, doc, opts }), json: (def, doc) => ({ type: 'json', def, doc }),
};
const COMUNES = {
  id: { type: 'string', def: null, doc: 'nombre de la capa (para ajustes/sin de un preset)' },
  alfa: T.num(1, 'opacidad 0..1', 0, 1), mezcla: T.enu('normal', 'modo de mezcla', Object.keys(MEZCLAS)),
  paralaje: T.num(null, 'profundidad de cámara: 0 lejano · 1 plano del sujeto · >1 primer plano', 0, 3), semilla: T.int(0, 'desplaza la semilla de esta capa', 0, 1e9),
  deriva: T.par([0, 0], 'velocidad de deriva [x,y] en lado menor por segundo'),
  anim: T.json(null, 'expresiones de t: {alfa, escala, dx, dy} (dx/dy en lado menor)'),
};
export const ANIM_KEYS = ['alfa', 'escala', 'dx', 'dy'];

// ── utilidades numéricas ──────────────────────────────────────────────────────────────────────────────────────
const mod = (a, n) => ((a % n) + n) % n;
// ruido de valor PERIÓDICO (periodo px×py celdas): permite derivar texturas sin costura
function pnoise(x, y, px, py, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), u = smooth(x - ix), v = smooth(y - iy);
  const h = (i, j) => hash2(mod(i, px) * 73856093 ^ mod(j, py) * 19349663, seed);
  return lerp(lerp(h(ix, iy), h(ix + 1, iy), u), lerp(h(ix, iy + 1), h(ix + 1, iy + 1), u), v);
}
function fbm(x, y, px, py, oct, gain, seed) {
  let a = 1, s = 0, n = 0, f = 1;
  for (let o = 0; o < oct; o++) { s += a * pnoise(x * f, y * f, px * f, py * f, seed + o * 131); n += a; a *= gain; f *= 2; }
  return s / n;
}
// Campo fbm [0,1] de tw×th, periódico, con deformación de dominio opcional.
function campoFbm(tw, th, { celdas, oct, gain, seed, warp = 0, contraste = 1, estira = 1 }) {
  const cx = Math.max(1, Math.round(celdas / estira)), cy = Math.max(1, Math.round((celdas * th) / tw)), out = new Float32Array(tw * th);
  for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) {
    let u = (i / tw) * cx, v = (j / th) * cy;
    if (warp) { const wx = fbm(u + 5.2, v + 1.3, cx, cy, 3, 0.5, seed + 701) - 0.5, wy = fbm(u + 9.7, v + 3.1, cx, cy, 3, 0.5, seed + 907) - 0.5; u += wx * warp * cx * 0.7; v += wy * warp * cy * 0.7; }
    const n = fbm(u, v, cx, cy, oct, gain, seed);
    out[j * tw + i] = clamp((n - 0.5) * contraste * 2.2 + 0.5);
  }
  return out;
}
const rr = (r, [a, b]) => a + (b - a) * r();

// ── registro ──────────────────────────────────────────────────────────────────────────────────────────────────
export const CAPAS = {};
const wc = (s) => String(s).trim().split(/\s+/).length;
function capa(tipo, familia, resumen, tags, params, def, draw) {
  if (wc(resumen) > 15) throw new Error(`capa ${tipo}: resumen > 15 palabras`);
  CAPAS[tipo] = { tipo, familia, resumen, tags: [familia, ...tags], params: { ...COMUNES, ...params }, paralaje: def.paralaje ?? 0.3, deriva: def.deriva ?? 'none', draw };
}
const textura = (L, ctx, key, tw, th, build, { dx = L.dx, dy = L.dy } = {}) => {            // dibuja una textura periódica que cubre el PAD, con deriva envolvente
  const cv = L.tex(key, tw, th, build), X0 = L.X0, Y0 = L.Y0, WW = L.WW, HH = L.HH, ox = mod(dx, WW), oy = mod(dy, HH);
  ctx.imageSmoothingEnabled = true;
  for (let a = -1; a <= 0; a++) for (let b = -1; b <= 0; b++) { const x = X0 + ox + a * WW, y = Y0 + oy + b * HH; if (x + WW < -2 || y + HH < -2 || x > L.W + 2 || y > L.H + 2) continue; ctx.drawImage(cv, x, y, WW + 0.5, HH + 0.5); }
};
const texSize = (L, max = 640) => { const tw = Math.round(clamp(L.WW / 2, 128, max)); return [tw, Math.max(32, Math.round((tw * L.HH) / L.WW))]; };
const rampa = (x2d, tw, th, f, A, B, nube, alfaMax = 1) => {                                  // campo → imagen: rampa de color A→B (opaca) o nube (color B con alfa ∝ campo)
  const im = x2d.createImageData(tw, th), d = im.data;
  for (let i = 0; i < tw * th; i++) { const v = f[i], p = i * 4;
    if (nube) { d[p] = B[0]; d[p + 1] = B[1]; d[p + 2] = B[2]; d[p + 3] = 255 * alfaMax * v; } else { d[p] = lerp(A[0], B[0], v); d[p + 1] = lerp(A[1], B[1], v); d[p + 2] = lerp(A[2], B[2], v); d[p + 3] = 255 * alfaMax; } }
  x2d.putImageData(im, 0, 0);
};
const rgbOf = (L, c) => hex2rgb(L.hex(c));

// ═════ degradados ═════
capa('relleno', 'degradado', 'Color liso que cubre todo el cuadro.', ['base', 'liso'], { color: T.color('paper', 'color de relleno') }, { paralaje: 0 },
  (ctx, p, L) => { ctx.fillStyle = L.hex(p.color); ctx.fillRect(L.X0, L.Y0, L.WW, L.HH); });
capa('degradado', 'degradado', 'Degradado lineal, radial o por bandas; puede muestrear la paleta del medio.', ['color', 'luz', 'paleta'], {
  modo: T.enu('lineal', 'forma del degradado', ['lineal', 'radial', 'bandas']), stops: T.colores(['shade', 'paper'], 'colores de principio a fin'),
  desde: T.enu('stops', 'stops: lista dada · paleta: la paleta del medio ordenada de oscuro a claro', ['stops', 'paleta']),
  angulo: T.num(90, 'grados: 90 = de arriba a abajo', -360, 360), centro: T.par([0.5, 0.5], 'centro del radial o del lineal'), radio: T.num(0.8, 'radial: radio / diagonal', 0.05, 4),
  suave: T.num(0.04, 'bandas: anchura de la transición', 0, 0.5) }, { paralaje: 0 },
  (ctx, p, L) => {
    const cs = (p.desde === 'paleta' ? L.paletaOrdenada() : p.stops).map((c) => L.hex(c)), cxp = L.W * p.centro[0], cyp = L.H * p.centro[1];
    let g;
    if (p.modo === 'radial') g = ctx.createRadialGradient(cxp, cyp, 0, cxp, cyp, (p.radio * Math.hypot(L.W, L.H)) / 2);
    else { const a = (p.angulo * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a), half = (Math.abs(ca) * L.W + Math.abs(sa) * L.H) / 2; g = ctx.createLinearGradient(cxp - ca * half, cyp - sa * half, cxp + ca * half, cyp + sa * half); }
    if (p.modo === 'bandas') { const n = cs.length, s = p.suave / 2 / n; cs.forEach((c, i) => { g.addColorStop(clamp(i / n + (i ? s : 0)), c); g.addColorStop(clamp((i + 1) / n - (i < n - 1 ? s : 0)), c); }); }
    else cs.forEach((c, i) => g.addColorStop(cs.length === 1 ? 0 : i / (cs.length - 1), c));
    ctx.fillStyle = g; ctx.fillRect(L.X0, L.Y0, L.WW, L.HH);
  });

// ═════ campos de ruido ═════
const RUIDO = { color: T.color('shade', 'color de los valles'), colorB: T.color('paper', 'color de las crestas'), escala: T.num(0.35, 'tamaño del grano: 1 = una celda por cuadro', 0.04, 1),
  estira: T.num(1, 'estira el grano en horizontal (vetas)', 0.2, 12), octavas: T.int(5, 'capas de detalle', 1, 8), aspereza: T.num(0.5, 'peso de cada octava', 0.1, 0.9), contraste: T.num(1, 'contraste del campo', 0.2, 3), modo: T.enu('rampa', 'rampa: opaco A→B · nube: B con alfa según el campo', ['rampa', 'nube']) };
const ruidoDraw = (warpDef) => (ctx, p, L) => {
  const [tw, th] = texSize(L), A = rgbOf(L, p.color), B = rgbOf(L, p.colorB), warp = p.fuerza ?? 0, cel = Math.max(1.5, (1 / p.escala) * 1.4);
  textura(L, ctx, `ruido|${JSON.stringify([p, L.palKey, L.seed])}`, tw, th, (x2d) => rampa(x2d, tw, th, campoFbm(tw, th, { celdas: cel, oct: p.octavas, gain: p.aspereza, seed: L.seed, warp, contraste: p.contraste, estira: p.estira }), A, B, p.modo === 'nube'));
};
capa('fbm', 'ruido', 'Campo de ruido fractal suave: nubes, manchas, textura de soporte.', ['nube', 'textura', 'organico'], RUIDO, { deriva: 'tex', paralaje: 0.25 }, ruidoDraw());
capa('deformado', 'ruido', 'Ruido con dominio deformado: humo, mármol, vetas fluidas.', ['humo', 'marmol', 'fluido'], { ...RUIDO, fuerza: T.num(0.7, 'cuánto se deforma el dominio', 0, 2) }, { deriva: 'tex', paralaje: 0.25 }, ruidoDraw());
capa('celular', 'ruido', 'Ruido celular tipo Voronoi: celdas, grietas, membranas, fotocélulas.', ['voronoi', 'grietas', 'celulas'], {
  color: T.color('shade', 'color de fondo de las celdas'), colorB: T.color('ink', 'color de los bordes o núcleos'), celdas: T.int(9, 'celdas a lo ancho del cuadro', 2, 60),
  modo: T.enu('bordes', 'bordes: red de grietas · celdas: mosaico de tonos · nucleos: puntos brillantes', ['bordes', 'celdas', 'nucleos']), grosor: T.num(0.07, 'grosor del borde', 0.01, 0.4),
  irregular: T.num(0.85, 'cuánto se desplaza cada semilla de celda', 0, 1) }, { deriva: 'tex', paralaje: 0.35 },
  (ctx, p, L) => {
    const [tw, th] = texSize(L, 1000), A = rgbOf(L, p.color), B = rgbOf(L, p.colorB), nx = p.celdas, ny = Math.max(1, Math.round((nx * th) / tw));
    textura(L, ctx, `celular|${JSON.stringify([p, L.palKey, L.seed])}`, tw, th, (x2d) => {
      const im = x2d.createImageData(tw, th), d = im.data, fx = new Float32Array(nx * ny), fy = new Float32Array(nx * ny), val = new Float32Array(nx * ny);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; fx[k] = 0.5 + (hash2(k, L.seed) - 0.5) * p.irregular; fy[k] = 0.5 + (hash2(k, L.seed + 77) - 0.5) * p.irregular; val[k] = hash2(k, L.seed + 191); }
      for (let py = 0; py < th; py++) for (let px = 0; px < tw; px++) {
        const u = (px / tw) * nx, v = (py / th) * ny, ci = Math.floor(u), cj = Math.floor(v); let f1 = 9, f2 = 9, id = 0;
        for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const k = mod(cj + b, ny) * nx + mod(ci + a, nx), dx = ci + a + fx[k] - u, dy = cj + b + fy[k] - v, dd = Math.hypot(dx, dy); if (dd < f1) { f2 = f1; f1 = dd; id = k; } else if (dd < f2) f2 = dd; }
        const m = p.modo === 'bordes' ? 1 - smooth(clamp((f2 - f1) / p.grosor)) : p.modo === 'nucleos' ? Math.max(0, 1 - f1 / (p.grosor * 4)) ** 2 : val[id];
        const q = (py * tw + px) * 4; d[q] = lerp(A[0], B[0], m); d[q + 1] = lerp(A[1], B[1], m); d[q + 2] = lerp(A[2], B[2], m); d[q + 3] = 255;
      }
      x2d.putImageData(im, 0, 0);
    });
  });
capa('flujo', 'ruido', 'Líneas de flujo que siguen un campo de ruido, con trazo que avanza.', ['lineas', 'corriente', 'viento'], {
  color: T.color('ink', 'color de las líneas'), n: T.int(120, 'número de líneas', 5, 600), largo: T.num(0.28, 'largo de cada línea (lado menor)', 0.03, 1.5), giro: T.num(1.3, 'cuánto se curva el campo', 0, 4),
  escala: T.num(0.45, 'tamaño de los remolinos', 0.05, 2), grosor: T.num(1.2, 'grosor en píxeles de referencia', 0.3, 12), velocidad: T.num(0.1, 'avance del trazo (ciclos por segundo)', 0, 3), alfaMin: T.num(0.25, 'alfa mínimo por línea', 0, 1) }, { paralaje: 0.45 },
  (ctx, p, L) => {
    const pts = L.memo(`flujo|${JSON.stringify([p, L.seed, L.W, L.H])}`, () => {
      const R = rng(L.seed), m = Math.min(L.W, L.H), out = [], pasos = 36, h = (p.largo * m) / pasos, cel = Math.max(1, 1 / p.escala);
      for (let i = 0; i < p.n; i++) { let x = L.X0 + R() * L.WW, y = L.Y0 + R() * L.HH; const line = []; for (let s = 0; s <= pasos; s++) { line.push([x, y]);
        const a = pnoise((x / L.W) * cel, (y / L.H) * cel, 997, 997, L.seed) * TAU * p.giro; x += Math.cos(a) * h; y += Math.sin(a) * h; } out.push({ line, a: p.alfaMin + R() * (1 - p.alfaMin), ph: R() }); }
      return out;
    });
    ctx.strokeStyle = L.hex(p.color); ctx.lineWidth = p.grosor * L.k; ctx.lineCap = 'round'; const len = pts[0]?.line.length ?? 0;
    for (const { line, a, ph } of pts) {
      const head = mod(L.t * p.velocidad + ph, 1), tail = 0.55; ctx.globalAlpha = L.alpha * a; ctx.beginPath();     // la «cabeza» recorre la línea; la cola se desvanece por tramos
      for (let s = 0; s < len; s++) { const u = s / (len - 1), d = mod(head - u, 1); if (d > tail) continue; if (s === 0 || mod(head - (s - 1) / (len - 1), 1) > tail) ctx.moveTo(line[s][0], line[s][1]); else ctx.lineTo(line[s][0], line[s][1]); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });

// ═════ atmósfera ═════
capa('niebla', 'atmosfera', 'Niebla por profundidad: velo que espesa hacia el horizonte y deriva.', ['profundidad', 'bruma', 'frio'], {
  color: T.color('shade', 'color de la niebla'), horizonte: T.num(0.6, 'altura (0..1) donde es más densa', 0, 1), altura: T.num(0.5, 'cuánto se extiende hacia arriba y abajo', 0.05, 1.5), densidad: T.num(0.7, 'densidad máxima 0..1', 0, 1),
  ruido: T.num(0.8, 'cuánto la rompe un ruido (0 = velo liso)', 0, 1), escala: T.num(0.5, 'tamaño de los jirones', 0.1, 1), velocidad: T.num(0.012, 'deriva horizontal (lado menor por segundo)', -1, 1) }, { paralaje: 0.5 },
  (ctx, p, L) => {
    const [tw, th] = texSize(L, 512), C = rgbOf(L, p.color);
    textura(L, ctx, `niebla|${JSON.stringify([p, L.palKey, L.seed])}`, tw, th, (x2d) => {
      const f = campoFbm(tw, th, { celdas: Math.max(2, (1 / p.escala) * 1.6), oct: 4, gain: 0.55, seed: L.seed, contraste: 1.1 }), im = x2d.createImageData(tw, th), d = im.data;
      for (let j = 0; j < th; j++) { const y = (L.Y0 + (j / th) * L.HH) / L.H, g = Math.exp(-(((y - p.horizonte) / p.altura) ** 2) * 2.2);
        for (let i = 0; i < tw; i++) { const q = (j * tw + i) * 4, n = lerp(1, f[j * tw + i] * 1.5, p.ruido); d[q] = C[0]; d[q + 1] = C[1]; d[q + 2] = C[2]; d[q + 3] = 255 * clamp(g * n * p.densidad); } }
      x2d.putImageData(im, 0, 0);
    }, { dx: L.t * p.velocidad * Math.min(L.W, L.H) + L.dx, dy: 0 });
  });
capa('polvo', 'atmosfera', 'Partículas en suspensión que derivan y titilan, con tamaños en profundidad.', ['particulas', 'suspension', 'luz'], {
  color: T.color('paper', 'color de las motas'), n: T.int(140, 'número de motas', 1, 1200), tamano: T.par([0.6, 3.4], 'radio mínimo y máximo en píxeles de referencia'), viento: T.par([0.004, -0.006], 'velocidad [x,y] (lado menor por segundo)'),
  titileo: T.num(0.5, 'cuánto titilan 0..1', 0, 1), turbulencia: T.num(0.012, 'vaivén lateral (lado menor)', 0, 0.2), alfaMax: T.num(0.55, 'alfa máximo de una mota', 0.02, 1) }, { paralaje: 0.9, deriva: 'pts' },
  (ctx, p, L) => {
    const pts = L.memo(`polvo|${p.n}|${L.seed}`, () => { const R = rng(L.seed); return Array.from({ length: p.n }, () => ({ x: R(), y: R(), z: R(), ph: R() * TAU, f: 0.4 + R() * 1.6, a: R() })); }), m = Math.min(L.W, L.H);
    ctx.fillStyle = L.hex(p.color);
    for (const q of pts) {
      const x = L.X0 + mod(q.x * L.WW + (p.viento[0] * m * (0.4 + q.z) * L.t) + L.dx * (0.4 + q.z), L.WW), y = L.Y0 + mod(q.y * L.HH + p.viento[1] * m * (0.4 + q.z) * L.t + L.dy * (0.4 + q.z), L.HH) + Math.sin(L.t * q.f + q.ph) * p.turbulencia * m;
      const tw = 1 - p.titileo * (0.5 - 0.5 * Math.sin(L.t * q.f * 2.1 + q.ph * 1.7)), r = (p.tamano[0] + (p.tamano[1] - p.tamano[0]) * q.z ** 2.2) * L.k;
      ctx.globalAlpha = L.alpha * p.alfaMax * (0.25 + 0.75 * q.a) * tw * (r > p.tamano[1] * L.k * 0.7 ? 0.45 : 1); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
capa('rayos', 'atmosfera', 'Rayos de luz volumétricos (godrays) desde un punto, con vaivén lento.', ['luz', 'volumetrico', 'cuba'], {
  color: T.color('paper', 'color de la luz'), origen: T.par([0.75, -0.1], 'punto de origen del haz (fracción del cuadro)'), n: T.int(7, 'número de haces', 1, 40), apertura: T.num(55, 'abanico total en grados', 5, 180),
  direccion: T.num(100, 'grados: 90 = hacia abajo', -360, 360), largo: T.num(1.3, 'longitud (diagonal)', 0.2, 3), intensidad: T.num(0.22, 'alfa en el origen', 0, 1), vaiven: T.num(0.04, 'oscilación lenta en radianes', 0, 0.5) }, { paralaje: 0.35 },
  (ctx, p, L) => {
    const R = rng(L.seed), ox = L.W * p.origen[0], oy = L.H * p.origen[1], D = Math.hypot(L.W, L.H) * p.largo, c = L.hex(p.color);
    for (let i = 0; i < p.n; i++) {
      const a0 = ((p.direccion - p.apertura / 2 + (p.apertura * (i + R() * 0.8)) / p.n) * Math.PI) / 180 + Math.sin(L.t * (0.3 + R() * 0.5) + R() * 6) * p.vaiven, w = ((p.apertura / p.n) * (0.25 + R() * 0.5) * Math.PI) / 180, a = p.intensidad * (0.4 + 0.6 * R());
      const g = ctx.createLinearGradient(ox, oy, ox + Math.cos(a0) * D, oy + Math.sin(a0) * D); g.addColorStop(0, rgba(c, a)); g.addColorStop(0.55, rgba(c, a * 0.3)); g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(a0 - w) * D, oy + Math.sin(a0 - w) * D); ctx.lineTo(ox + Math.cos(a0 + w) * D, oy + Math.sin(a0 + w) * D); ctx.closePath(); ctx.fill();
    }
  });
capa('bokeh', 'atmosfera', 'Discos de luz desenfocada con borde vivo, que respiran y derivan.', ['luz', 'ciudad', 'noche'], {
  colores: T.colores(['accent', 'paper'], 'colores de los discos'), n: T.int(24, 'número de discos', 1, 200), radio: T.par([0.02, 0.08], 'radio mínimo y máximo (lado menor)'), alfaMax: T.num(0.28, 'alfa máximo', 0.02, 1),
  respira: T.num(0.3, 'cuánto respiran 0..1', 0, 1), viento: T.par([0.006, -0.003], 'velocidad [x,y] (lado menor por segundo)') }, { paralaje: 0.6, deriva: 'pts' },
  (ctx, p, L) => {
    const m = Math.min(L.W, L.H), pts = L.memo(`bokeh|${JSON.stringify(p)}|${L.seed}`, () => { const R = rng(L.seed); return Array.from({ length: p.n }, () => ({ x: R(), y: R(), r: rr(R, p.radio), c: Math.floor(R() * p.colores.length), a: 0.4 + 0.6 * R(), ph: R() * TAU, f: 0.3 + R() * 0.9 })); });
    for (const q of pts) {
      const x = L.X0 + mod(q.x * L.WW + p.viento[0] * m * L.t + L.dx * 0.6, L.WW), y = L.Y0 + mod(q.y * L.HH + p.viento[1] * m * L.t + L.dy * 0.6, L.HH), r = q.r * m, c = L.hex(p.colores[q.c]);
      const a = p.alfaMax * q.a * (1 - p.respira * (0.5 - 0.5 * Math.sin(L.t * q.f + q.ph))), g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
      g.addColorStop(0, rgba(c, a * 0.45)); g.addColorStop(0.82, rgba(c, a * 0.7)); g.addColorStop(0.94, rgba(c, a * 1.2)); g.addColorStop(1, rgba(c, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
  });
capa('estrellas', 'atmosfera', 'Campo de estrellas con titileo y algunas destellos en cruz.', ['cosmos', 'noche', 'puntos'], {
  color: T.color('paper', 'color de las estrellas'), colorB: T.color('accent', 'tinte de algunas estrellas'), n: T.int(420, 'número de estrellas', 1, 4000), tamano: T.par([0.5, 1.7], 'radio mínimo y máximo (píxeles de referencia)'),
  titileo: T.num(0.35, 'cuánto titilan 0..1', 0, 1), destellos: T.int(4, 'estrellas grandes con cruz de luz', 0, 40), fuerza: T.num(0.9, 'alfa máximo', 0.05, 1), viento: T.par([0.002, 0], 'giro lento [x,y] (lado menor por segundo)') }, { paralaje: 0.12, deriva: 'pts' },
  (ctx, p, L) => {
    const m = Math.min(L.W, L.H), pts = L.memo(`estrellas|${p.n}|${L.seed}`, () => { const R = rng(L.seed); return Array.from({ length: p.n }, () => ({ x: R(), y: R(), s: R() ** 3, a: 0.3 + 0.7 * R(), ph: R() * TAU, f: 0.5 + R() * 2.5, t: R() < 0.18 })); }), A = L.hex(p.color), B = L.hex(p.colorB);
    pts.forEach((q, i) => {
      const x = L.X0 + mod(q.x * L.WW + p.viento[0] * m * L.t + L.dx * 0.5, L.WW), y = L.Y0 + mod(q.y * L.HH + p.viento[1] * m * L.t + L.dy * 0.5, L.HH), r = (p.tamano[0] + (p.tamano[1] - p.tamano[0]) * q.s) * L.k;
      const tw = 1 - p.titileo * (0.5 - 0.5 * Math.sin(L.t * q.f + q.ph)); ctx.globalAlpha = L.alpha * p.fuerza * q.a * tw; ctx.fillStyle = q.t ? B : A; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      if (i < p.destellos) { ctx.strokeStyle = A; ctx.lineWidth = Math.max(0.6, r * 0.35); ctx.globalAlpha *= 0.5; const l = r * (6 + 4 * q.s); ctx.beginPath(); ctx.moveTo(x - l, y); ctx.lineTo(x + l, y); ctx.moveTo(x, y - l); ctx.lineTo(x, y + l); ctx.stroke(); }
    });
    ctx.globalAlpha = 1;
  });
capa('orbes', 'atmosfera', 'Esferas luminosas de cristal, como lunas o fotomultiplicadores, con parpadeo propio.', ['esferas', 'luz', 'cuba', 'fotomultiplicador'], {
  color: T.color('accent', 'color de la luz interior'), cristal: T.color('shade', 'color del vidrio apagado'), n: T.int(40, 'número de esferas', 1, 400), disposicion: T.enu('rejilla', 'cómo se reparten', ['rejilla', 'dispersa', 'anillo', 'fila']),
  radio: T.num(0.035, 'radio medio (lado menor)', 0.004, 0.4), area: T.par([0.12, 0.88], 'tramo vertical ocupado [y0,y1]'), perspectiva: T.num(0.5, 'las de abajo/centro se ven mayores 0..1', 0, 1), brillo: T.num(0.8, 'intensidad de la luz 0..1', 0, 1),
  parpadeo: T.num(0.5, 'cuánto parpadean 0..1', 0, 1), destello: T.num(0.04, 'probabilidad de que una esfera se encienda a tope', 0, 1) }, { paralaje: 0.55 },
  (ctx, p, L) => {
    const m = Math.min(L.W, L.H), pts = L.memo(`orbes|${JSON.stringify(p)}|${L.seed}|${L.W}x${L.H}`, () => {
      const R = rng(L.seed), out = [], cols = Math.max(1, Math.round(Math.sqrt((p.n * L.WW) / L.HH))), rows = Math.max(1, Math.ceil(p.n / cols));
      for (let i = 0; i < p.n; i++) { let x, y;
        if (p.disposicion === 'rejilla') { x = ((i % cols) + 0.5 + (Math.floor(i / cols) % 2) * 0.5 - 0.25) / cols; y = p.area[0] + ((Math.floor(i / cols) + 0.5) / rows) * (p.area[1] - p.area[0]); x += (R() - 0.5) * 0.02 / 1; y += (R() - 0.5) * 0.02; }
        else if (p.disposicion === 'anillo') { const a = (i / p.n) * TAU + R() * 0.1; x = 0.5 + 0.38 * Math.cos(a) * (L.WW / L.W) / 1.4 / 1; y = 0.5 + 0.34 * Math.sin(a); }
        else if (p.disposicion === 'fila') { x = (i + 0.5) / p.n; y = 0.5 + (R() - 0.5) * 0.06; } else { x = R(); y = p.area[0] + R() * (p.area[1] - p.area[0]); }
        out.push({ x, y, ph: R() * TAU, f: 0.4 + R() * 1.8, hot: R() < p.destello, s: 0.8 + R() * 0.4, k2: R() }); }
      return out;
    }), cr = L.hex(p.cristal), lz = L.hex(p.color);
    for (const q of pts) {
      const cyN = q.y, persp = 1 + p.perspectiva * 0.6 * (cyN - 0.5), r = p.radio * m * q.s * persp, x = L.X0 + mod(q.x * L.W - L.X0 + L.dx * 0.3, L.WW), y = L.Y0 + ((q.y * L.H) - L.Y0) % L.HH;
      const fl = 1 - p.parpadeo * (0.5 - 0.5 * Math.sin(L.t * q.f + q.ph)) * (0.5 + 0.5 * q.k2), on = clamp(p.brillo * fl + (q.hot ? 0.9 * (0.5 + 0.5 * Math.sin(L.t * 5 + q.ph)) ** 3 : 0));
      const halo = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * (2.4 + 2 * on)); halo.addColorStop(0, rgba(lz, 0.38 * on)); halo.addColorStop(1, rgba(lz, 0)); ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, r * (2.4 + 2 * on), 0, TAU); ctx.fill();
      const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r); body.addColorStop(0, rgba(lz, 0.15 + 0.85 * on)); body.addColorStop(0.55, rgba(mix(cr, lz, on * 0.7), 0.55 + 0.4 * on)); body.addColorStop(1, rgba(cr, 0.85));
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(lz, 0.25 + 0.4 * on); ctx.lineWidth = Math.max(1, r * 0.06); ctx.beginPath(); ctx.arc(x, y, r * 0.96, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.22, r * 0.12, -0.6, 0, TAU); ctx.fill();
    }
  });

// ═════ motivos y patrones ═════
const periodico = (ctx, L, px, py) => ctx.translate(mod(L.dx, px) - px, mod(L.dy, py) - py);
capa('reticula', 'motivo', 'Retícula de líneas, puntos o cruces, como papel milimetrado o plano técnico.', ['plano', 'tecnico', 'medida'], {
  color: T.color('ink', 'color'), estilo: T.enu('lineas', 'trazo de la retícula', ['lineas', 'puntos', 'cruces']), paso: T.num(0.05, 'separación (lado menor)', 0.01, 0.5), mayor: T.int(5, 'cada cuántas líneas una más gruesa (0 = ninguna)', 0, 40),
  grosor: T.num(1, 'grosor en píxeles de referencia', 0.3, 8), angulo: T.num(0, 'giro en grados', -90, 90) }, { paralaje: 0.2, deriva: 'per' },
  (ctx, p, L) => {
    const m = Math.min(L.W, L.H), s = p.paso * m, n = Math.ceil(Math.hypot(L.WW, L.HH) / s) + 2, cx = L.W / 2, cy = L.H / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate((p.angulo * Math.PI) / 180); ctx.translate(mod(L.dx, s * (p.mayor || 1)) - cx % s, mod(L.dy, s * (p.mayor || 1)) - cy % s); ctx.strokeStyle = ctx.fillStyle = L.hex(p.color);
    for (let i = -n; i <= n; i++) {
      const major = p.mayor && i % p.mayor === 0, w = p.grosor * L.k * (major ? 1.8 : 1); ctx.lineWidth = w; ctx.globalAlpha = L.alpha * (major ? 1 : 0.55);
      if (p.estilo === 'lineas') { ctx.beginPath(); ctx.moveTo(i * s, -n * s); ctx.lineTo(i * s, n * s); ctx.moveTo(-n * s, i * s); ctx.lineTo(n * s, i * s); ctx.stroke(); }
      else for (let j = -n; j <= n; j++) { const x = i * s, y = j * s; if (p.estilo === 'puntos') { ctx.beginPath(); ctx.arc(x, y, w * 1.2, 0, TAU); ctx.fill(); } else { const l = s * 0.12; ctx.beginPath(); ctx.moveTo(x - l, y); ctx.lineTo(x + l, y); ctx.moveTo(x, y - l); ctx.lineTo(x, y + l); ctx.stroke(); } }
    }
    ctx.restore();
  });
capa('trama', 'motivo', 'Rayado cruzado a mano: líneas paralelas irregulares, simple o en cruz.', ['rayado', 'lapiz', 'grabado'], {
  color: T.color('ink', 'color del trazo'), angulo: T.num(45, 'inclinación en grados', -90, 90), paso: T.num(0.012, 'separación (lado menor)', 0.003, 0.2), cruzada: T.bool(false, 'segunda pasada en perpendicular'),
  grosor: T.num(0.9, 'grosor en píxeles de referencia', 0.3, 6), irregular: T.num(0.5, 'temblor de cada línea 0..1', 0, 1), cobertura: T.num(0.75, 'fracción de líneas que se dibujan 0..1', 0.05, 1) }, { paralaje: 0.3 },
  (ctx, p, L) => {
    const lines = L.memo(`trama|${JSON.stringify(p)}|${L.seed}|${L.W}x${L.H}`, () => {
      const R = rng(L.seed), m = Math.min(L.W, L.H), s = p.paso * m, D = Math.hypot(L.WW, L.HH), out = [];
      for (let pass = 0; pass < (p.cruzada ? 2 : 1); pass++) for (let o = -D / 2; o < D / 2; o += s * (0.85 + R() * 0.3)) if (R() < p.cobertura) { const a = D * (0.4 + 0.6 * R()), b = D * (0.4 + 0.6 * R()); out.push({ pass, o, a, b, j: (R() - 0.5) * s * p.irregular * 2, w: 0.6 + R() * 0.8 }); }
      return out;
    });
    ctx.strokeStyle = L.hex(p.color); ctx.lineCap = 'round'; ctx.save(); ctx.translate(L.W / 2, L.H / 2);
    for (const l of lines) { const a = ((p.angulo + l.pass * 90) * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a); ctx.lineWidth = p.grosor * L.k * l.w; ctx.globalAlpha = L.alpha * (0.55 + 0.45 * l.w / 1.4);
      ctx.beginPath(); ctx.moveTo(ca * -l.a - sa * l.o, sa * -l.a + ca * l.o); ctx.lineTo(ca * l.b - sa * (l.o + l.j), sa * l.b + ca * (l.o + l.j)); ctx.stroke(); }
    ctx.restore(); ctx.globalAlpha = 1;
  });
capa('rayado', 'motivo', 'Renglones de papel de carta o cuaderno, con línea de margen opcional.', ['papel', 'carta', 'cuaderno', 'escritura'], {
  color: T.color('accent2', 'color de los renglones'), paso: T.num(0.045, 'separación entre renglones (lado menor)', 0.01, 0.3), margen: T.num(0.12, 'posición x de la línea de margen (0 = sin margen)', 0, 0.9), colorMargen: T.color('accent', 'color del margen'),
  grosor: T.num(1.1, 'grosor en píxeles de referencia', 0.3, 5), cuadricula: T.bool(false, 'también columnas (papel cuadriculado)'), inicio: T.num(0.12, 'y donde empieza el primer renglón', 0, 0.9), inclinacion: T.num(0.003, 'inclinación del papel en radianes', -0.1, 0.1) }, { paralaje: 0.18, deriva: 'per' },
  (ctx, p, L) => {
    const m = Math.min(L.W, L.H), s = p.paso * m; ctx.save(); ctx.translate(L.W / 2, L.H / 2); ctx.rotate(p.inclinacion); ctx.translate(-L.W / 2, -L.H / 2); ctx.translate(0, mod(L.dy, s)); ctx.lineWidth = p.grosor * L.k; ctx.strokeStyle = L.hex(p.color); ctx.globalAlpha = L.alpha * 0.6;
    ctx.beginPath(); for (let y = L.H * p.inicio - Math.ceil((L.H * p.inicio - L.Y0) / s) * s; y < L.Y0 + L.HH; y += s) { ctx.moveTo(L.X0, y); ctx.lineTo(L.X0 + L.WW, y); }
    if (p.cuadricula) for (let x = L.X0; x < L.X0 + L.WW; x += s) { ctx.moveTo(x, L.Y0); ctx.lineTo(x, L.Y0 + L.HH); } ctx.stroke();
    if (p.margen > 0) { ctx.strokeStyle = L.hex(p.colorMargen); ctx.globalAlpha = L.alpha * 0.8; ctx.lineWidth = p.grosor * L.k * 1.3; ctx.beginPath(); ctx.moveTo(L.W * p.margen, L.Y0); ctx.lineTo(L.W * p.margen, L.Y0 + L.HH); ctx.stroke(); }
    ctx.restore();
  });
capa('semitono', 'motivo', 'Puntos de semitono cuyo tamaño sigue un campo radial, lineal o de ruido.', ['impresion', 'riso', 'puntos'], {
  color: T.color('ink', 'color de los puntos'), paso: T.num(0.022, 'separación (lado menor)', 0.006, 0.2), campo: T.enu('radial', 'qué decide el tamaño', ['radial', 'lineal', 'ruido']), angulo: T.num(45, 'giro de la malla en grados', -90, 90),
  tamano: T.num(0.9, 'tamaño máximo relativo al paso', 0.1, 1.6), centro: T.par([0.5, 0.45], 'centro del campo radial'), direccion: T.num(90, 'campo lineal: grados', -360, 360), invertir: T.bool(false, 'invierte el campo') }, { paralaje: 0.25 },
  (ctx, p, L) => {
    const dots = L.memo(`semitono|${JSON.stringify(p)}|${L.seed}|${L.W}x${L.H}`, () => {
      const m = Math.min(L.W, L.H), s = p.paso * m, a = (p.angulo * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a), D = Math.hypot(L.WW, L.HH), out = [];
      for (let j = -D / 2; j < D / 2; j += s) for (let i = -D / 2; i < D / 2; i += s) {
        const x = L.W / 2 + ca * i - sa * j, y = L.H / 2 + sa * i + ca * j; if (x < L.X0 || x > L.X0 + L.WW || y < L.Y0 || y > L.Y0 + L.HH) continue;
        let v; if (p.campo === 'radial') v = 1 - clamp(Math.hypot((x / L.W - p.centro[0]) * (L.W / m), (y / L.H - p.centro[1]) * (L.H / m)) / 0.75); else if (p.campo === 'lineal') { const d = (p.direccion * Math.PI) / 180; v = clamp(0.5 + ((x / L.W - 0.5) * Math.cos(d) * (L.W / m) + (y / L.H - 0.5) * Math.sin(d) * (L.H / m)) / 1.2); } else v = fbm((x / L.W) * 4, (y / L.H) * 4, 997, 997, 3, 0.5, L.seed);
        if (p.invertir) v = 1 - v; const r = Math.sqrt(v) * p.tamano * s * 0.5; if (r > 0.4) out.push([x, y, r]);
      }
      return out;
    });
    ctx.fillStyle = L.hex(p.color); ctx.beginPath(); for (const [x, y, r] of dots) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); } ctx.fill();
  });
const FORMAS = {
  cruz: (c, r) => { c.moveTo(-r, 0); c.lineTo(r, 0); c.moveTo(0, -r); c.lineTo(0, r); }, circulo: (c, r) => { c.moveTo(r, 0); c.arc(0, 0, r, 0, TAU); }, anillo: (c, r) => { c.moveTo(r, 0); c.arc(0, 0, r, 0, TAU); c.moveTo(r * 0.45, 0); c.arc(0, 0, r * 0.45, 0, TAU); },
  rombo: (c, r) => { c.moveTo(0, -r); c.lineTo(r * 0.7, 0); c.lineTo(0, r); c.lineTo(-r * 0.7, 0); c.closePath(); }, cuadrado: (c, r) => { c.rect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6); },
  estrella: (c, r) => { for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2, q = i % 2 ? r * 0.42 : r; i ? c.lineTo(Math.cos(a) * q, Math.sin(a) * q) : c.moveTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); },
  hoja: (c, r) => { c.moveTo(0, r); c.quadraticCurveTo(r * 0.9, r * 0.2, 0, -r); c.quadraticCurveTo(-r * 0.9, r * 0.2, 0, r); c.moveTo(0, r); c.lineTo(0, -r * 0.7); },
  onda: (c, r) => { c.moveTo(-r, 0); c.bezierCurveTo(-r * 0.5, -r * 0.9, -r * 0.1, -r * 0.9, 0, 0); c.bezierCurveTo(r * 0.1, r * 0.9, r * 0.5, r * 0.9, r, 0); }, gota: (c, r) => { c.moveTo(0, -r); c.bezierCurveTo(r * 0.9, r * 0.1, r * 0.6, r, 0, r); c.bezierCurveTo(-r * 0.6, r, -r * 0.9, r * 0.1, 0, -r); },
};
export const FORMAS_MOTIVO = Object.keys(FORMAS);
capa('motivo', 'motivo', 'Motivo repetido (cruz, hoja, estrella…) con variación de posición, giro y tamaño.', ['patron', 'repeticion', 'papel pintado'], {
  forma: T.enu('cruz', 'forma del motivo', FORMAS_MOTIVO), color: T.color('ink', 'color (o primero de colores)'), colores: T.colores([], 'si se da, cada copia toma uno al azar'), disposicion: T.enu('ladrillo', 'cómo se reparte', ['rejilla', 'ladrillo', 'hex', 'dispersa']),
  paso: T.num(0.1, 'separación (lado menor)', 0.02, 0.8), tamano: T.num(0.28, 'tamaño relativo al paso', 0.05, 1.5), variacion: T.num(0.3, 'cuánto varían posición, giro y tamaño 0..1', 0, 1), relleno: T.bool(false, 'relleno en vez de trazo'),
  grosor: T.num(1.2, 'grosor del trazo en píxeles de referencia', 0.3, 8), giro: T.num(0, 'giro base en grados', -180, 180) }, { paralaje: 0.3, deriva: 'per' },
  (ctx, p, L) => {
    const m = Math.min(L.W, L.H), s = p.paso * m, items = L.memo(`motivo|${JSON.stringify(p)}|${L.seed}|${L.W}x${L.H}`, () => {
      const R = rng(L.seed), out = [], cols = Math.ceil(L.WW / s) + 2, rows = Math.ceil(L.HH / (s * (p.disposicion === 'hex' ? 0.866 : 1))) + 2, N = p.disposicion === 'dispersa' ? Math.round((L.WW * L.HH) / (s * s)) : cols * rows;
      for (let q = 0; q < N; q++) {
        let x, y; if (p.disposicion === 'dispersa') { x = R() * L.WW; y = R() * L.HH; } else { const i = q % cols, j = Math.floor(q / cols), off = p.disposicion === 'rejilla' ? 0 : (j % 2) * 0.5; x = (i + off) * s; y = j * s * (p.disposicion === 'hex' ? 0.866 : 1); }
        const v = p.variacion; out.push({ x: x + (R() - 0.5) * s * v * 0.6, y: y + (R() - 0.5) * s * v * 0.6, a: ((p.giro + (R() - 0.5) * 120 * v) * Math.PI) / 180, k: 1 + (R() - 0.5) * v, c: R() });
      }
      return out;
    }), cols = p.colores.length ? p.colores : [p.color];
    ctx.save(); ctx.translate(L.X0 - s + mod(L.dx, s), L.Y0 - s + mod(L.dy, s)); ctx.lineWidth = p.grosor * L.k; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let ci = 0; ci < cols.length; ci++) {
      const c = L.hex(cols[ci]); ctx.strokeStyle = ctx.fillStyle = c; ctx.beginPath();
      for (const q of items) { if (Math.min(cols.length - 1, Math.floor(q.c * cols.length)) !== ci) continue; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.a); FORMAS[p.forma](ctx, p.tamano * s * q.k * 0.5); ctx.restore(); }
      p.relleno ? ctx.fill() : ctx.stroke();
    }
    ctx.restore();
  });

// ═════ luz ═════
capa('vineta', 'luz', 'Viñeta que oscurece los bordes y concentra la mirada en el centro.', ['borde', 'foco', 'oscuro'], {
  color: T.color('ink', 'color de los bordes'), fuerza: T.num(0.6, 'alfa en las esquinas', 0, 1), interior: T.num(0.35, 'radio sin efecto (fracción de la diagonal)', 0, 0.9), centro: T.par([0.5, 0.5], 'centro de la viñeta'), forma: T.enu('eliptica', 'forma', ['eliptica', 'circular']) }, { paralaje: 0 },
  (ctx, p, L) => {
    const cx = L.W * p.centro[0], cy = L.H * p.centro[1], R = Math.hypot(L.W, L.H) * 0.55, c = L.hex(p.color), g = ctx.createRadialGradient(0, 0, R * p.interior, 0, 0, R);
    g.addColorStop(0, rgba(c, 0)); g.addColorStop(1, rgba(c, p.fuerza)); ctx.save(); ctx.translate(cx, cy); if (p.forma === 'eliptica') ctx.scale(L.W / Math.hypot(L.W, L.H) * 1.3, L.H / Math.hypot(L.W, L.H) * 1.3); ctx.fillStyle = g;
    ctx.fillRect(-R * 3, -R * 3, R * 6, R * 6); ctx.restore();
  });
capa('foco', 'luz', 'Charco de luz o cono sobre un punto, como una lámpara sobre la mesa.', ['luz', 'lampara', 'escena'], {
  color: T.color('paper', 'color de la luz'), centro: T.par([0.5, 0.55], 'centro del charco (fracción del cuadro)'), radio: T.num(0.4, 'radio (lado menor)', 0.02, 2), achatado: T.num(0.7, 'alto/ancho del charco 0.1..1', 0.1, 1),
  intensidad: T.num(0.5, 'alfa en el centro', 0, 1), suavidad: T.num(0.8, 'caída del borde 0..1', 0.05, 1), cono: T.bool(false, 'añade un cono de luz desde arriba'), origenCono: T.par([0.5, -0.1], 'origen del cono') }, { paralaje: 0.4 },
  (ctx, p, L) => {
    const m = Math.min(L.W, L.H), cx = L.W * p.centro[0], cy = L.H * p.centro[1], r = p.radio * m, c = L.hex(p.color);
    if (p.cono) { const ox = L.W * p.origenCono[0], oy = L.H * p.origenCono[1], g = ctx.createLinearGradient(ox, oy, cx, cy); g.addColorStop(0, rgba(c, p.intensidad * 0.5)); g.addColorStop(1, rgba(c, p.intensidad * 0.12));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(ox - r * 0.06, oy); ctx.lineTo(ox + r * 0.06, oy); ctx.lineTo(cx + r * 0.95, cy); ctx.lineTo(cx - r * 0.95, cy); ctx.closePath(); ctx.fill(); }
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, p.achatado); const g = ctx.createRadialGradient(0, 0, r * (1 - p.suavidad) * 0.9, 0, 0, r); g.addColorStop(0, rgba(c, p.intensidad)); g.addColorStop(1, rgba(c, 0));
    const g0 = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g0.addColorStop(0, rgba(c, p.intensidad)); g0.addColorStop(clamp(1 - p.suavidad), rgba(c, p.intensidad * 0.9)); g0.addColorStop(1, rgba(c, 0)); ctx.fillStyle = g0; ctx.fillRect(-r, -r, 2 * r, 2 * r); ctx.restore();
  });
capa('terminador', 'luz', 'Línea de día y noche: franja de sombra con borde suave, recta o curva.', ['planeta', 'crepusculo', 'sombra'], {
  color: T.color('ink', 'color de la sombra'), angulo: T.num(20, 'orientación del borde en grados', -180, 180), posicion: T.num(0.5, 'dónde cae el borde (0..1 a lo largo de su normal)', -0.5, 1.5), suavidad: T.num(0.25, 'anchura de la penumbra', 0.01, 1), intensidad: T.num(0.75, 'alfa de la sombra', 0, 1),
  curvatura: T.num(0, 'curva el borde como el de un planeta (0 = recto)', 0, 1) }, { paralaje: 0.15 },
  (ctx, p, L) => {
    const a = (p.angulo * Math.PI) / 180, nx = Math.cos(a), ny = Math.sin(a), half = (Math.abs(nx) * L.W + Math.abs(ny) * L.H) / 2, c = L.hex(p.color), s = p.suavidad, pos = p.posicion;
    const cx = L.W / 2 + nx * half * (2 * pos - 1), cy = L.H / 2 + ny * half * (2 * pos - 1), w = half * s;
    ctx.save();
    if (p.curvatura > 0) { const R = Math.hypot(L.W, L.H) * (1.3 - p.curvatura), px = cx - nx * R, py = cy - ny * R; const g = ctx.createRadialGradient(px, py, Math.max(1, R - w), px, py, R + w); g.addColorStop(0, rgba(c, 0)); g.addColorStop(1, rgba(c, p.intensidad)); ctx.fillStyle = g; ctx.fillRect(L.X0, L.Y0, L.WW, L.HH); }
    else { const g = ctx.createLinearGradient(cx - nx * w, cy - ny * w, cx + nx * w, cy + ny * w); g.addColorStop(0, rgba(c, 0)); g.addColorStop(1, rgba(c, p.intensidad)); ctx.fillStyle = g; ctx.fillRect(L.X0, L.Y0, L.WW, L.HH); }
    ctx.restore();
  });

// ═════ temáticas ═════
capa('olas', 'tematica', 'Mar en franjas de olas con espuma y deriva, del horizonte a la orilla.', ['mar', 'agua', 'acuarela'], {
  color: T.color('accent2', 'color del mar lejano'), colorB: T.color('paper', 'color de la espuma y la orilla cercana'), horizonte: T.num(0.38, 'altura del horizonte (0..1)', 0, 0.95), filas: T.int(8, 'franjas de olas', 2, 30),
  amplitud: T.num(0.012, 'altura de la ola (lado menor)', 0, 0.1), longitud: T.num(0.28, 'longitud de onda (lado menor)', 0.03, 1.5), velocidad: T.num(0.05, 'avance (ciclos por segundo)', -2, 2), espuma: T.num(0.5, 'cuánta cresta clara 0..1', 0, 1) }, { paralaje: 0.35 },
  (ctx, p, L) => {
    const m = Math.min(L.W, L.H), A = L.hex(p.color), B = L.hex(p.colorB), y0 = L.H * p.horizonte;
    for (let r = 0; r < p.filas; r++) {
      const u = r / (p.filas - 1), y = y0 + (L.Y0 + L.HH - y0) * u ** 1.5, amp = p.amplitud * m * (0.4 + 1.6 * u), wl = p.longitud * m * (0.5 + 1.5 * u), sp = p.velocidad * (0.6 + u) * TAU, ph = hash2(r, L.seed) * TAU;
      ctx.fillStyle = mix(A, B, u * 0.65); ctx.globalAlpha = L.alpha * (0.5 + 0.5 * u); ctx.beginPath(); ctx.moveTo(L.X0, L.Y0 + L.HH);
      const pts = []; for (let x = L.X0; x <= L.X0 + L.WW + 8; x += 8) { const yy = y + Math.sin((x / wl) * TAU + ph + L.t * sp) * amp + Math.sin((x / (wl * 0.43)) * TAU + ph * 2 - L.t * sp * 1.3) * amp * 0.4; pts.push([x, yy]); ctx.lineTo(x, yy); }
      ctx.lineTo(L.X0 + L.WW + 8, L.Y0 + L.HH); ctx.closePath(); ctx.fill();
      if (p.espuma > 0) { ctx.strokeStyle = B; ctx.globalAlpha = L.alpha * p.espuma * (0.2 + 0.5 * u); ctx.lineWidth = (1 + 1.6 * u) * L.k; ctx.beginPath(); pts.forEach(([x, yy], i) => (i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy))); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  });
capa('acuarela', 'tematica', 'Lavados de acuarela: manchas con borde más oscuro, sangrado y pigmento disperso.', ['acuarela', 'papel', 'pintura', 'suave'], {
  colores: T.colores(['accent', 'accent2'], 'pigmentos'), n: T.int(6, 'número de lavados', 1, 40), tamano: T.par([0.18, 0.5], 'radio mínimo y máximo (lado menor)'), intensidad: T.num(0.22, 'alfa por pasada', 0.02, 0.8),
  borde: T.num(0.6, 'oscurecimiento del borde 0..1', 0, 1), humedad: T.num(0.7, 'irregularidad del contorno 0..1', 0, 1), granulado: T.num(0.5, 'pigmento disperso 0..1', 0, 1), zona: T.par([0.05, 0.95], 'tramo vertical donde caen [y0,y1]') }, { deriva: 'tex', paralaje: 0.2 },
  (ctx, p, L) => {
    const [tw, th] = texSize(L, 900);
    textura(L, ctx, `acuarela|${JSON.stringify([p, L.palKey, L.seed])}`, tw, th, (x2d) => {
      const R = rng(L.seed), m = Math.min(tw, th), blob = (cx, cy, r, w) => { const N = 28, ph = Array.from({ length: 4 }, () => R() * TAU), a = [R() * 0.3, R() * 0.2, R() * 0.12, R() * 0.08]; x2d.beginPath();
        for (let i = 0; i <= N; i++) { const t = (i / N) * TAU; let q = 1; for (let h = 0; h < 4; h++) q += Math.sin(t * (h + 2) + ph[h]) * a[h] * w * 0.35; const x = cx + Math.cos(t) * r * q, y = cy + Math.sin(t) * r * q; i ? x2d.lineTo(x, y) : x2d.moveTo(x, y); } x2d.closePath(); };
      for (let b = 0; b < p.n; b++) {
        const cx = R() * tw, cy = (p.zona[0] + R() * (p.zona[1] - p.zona[0])) * th, r = rr(R, p.tamano) * m * 1.4, col = L.hex(p.colores[b % p.colores.length]), seed = R();
        for (let pass = 0; pass < 4; pass++) { const k = 1 - pass * 0.045; x2d.save(); x2d.translate(cx, cy); x2d.scale(1.1 - 0.2 * seed, 1); x2d.translate(-cx, -cy); R(); blob(cx + (R() - 0.5) * r * 0.06, cy + (R() - 0.5) * r * 0.06, r * k, p.humedad); x2d.fillStyle = rgba(col, p.intensidad * 0.55); x2d.fill(); x2d.restore(); }
        x2d.save(); x2d.translate(cx, cy); x2d.scale(1.1 - 0.2 * seed, 1); x2d.translate(-cx, -cy); blob(cx, cy, r, p.humedad); x2d.strokeStyle = rgba(mix(col, '#000000', 0.25), p.intensidad * p.borde * 1.1); x2d.lineWidth = Math.max(1.5, m * 0.008); x2d.stroke();
        x2d.clip(); for (let g = 0; g < 160 * p.granulado; g++) { x2d.fillStyle = rgba(col, 0.05 + R() * 0.12); x2d.beginPath(); x2d.arc(cx + (R() - 0.5) * r * 2.2, cy + (R() - 0.5) * r * 2.2, 0.6 + R() * 2.4, 0, TAU); x2d.fill(); } x2d.restore();
      }
    });
  });
capa('perfil', 'tematica', 'Silueta de horizonte: montañas, ciudad con ventanas, dunas o bosque.', ['horizonte', 'silueta', 'ciudad', 'montana'], {
  modo: T.enu('montanas', 'tipo de silueta', ['montanas', 'ciudad', 'dunas', 'bosque']), color: T.color('ink', 'color de la silueta'), base: T.num(0.72, 'altura de la base (0..1)', 0.1, 1.2), altura: T.num(0.26, 'altura máxima (lado menor)', 0.02, 1),
  detalle: T.int(6, 'octavas de detalle (montañas) o densidad', 1, 12), luces: T.color('paper', 'color de las ventanas encendidas (ciudad)'), encendidas: T.num(0.28, 'fracción de ventanas encendidas', 0, 1), parpadeo: T.num(0.03, 'fracción de ventanas que parpadean', 0, 1),
  lleno: T.bool(true, 'relleno hasta el borde inferior') }, { paralaje: 0.7 },
  (ctx, p, L) => {
    const m = Math.min(L.W, L.H), baseY = L.H * p.base, S = L.memo(`perfil|${JSON.stringify(p)}|${L.seed}|${L.W}x${L.H}`, () => {
      const R = rng(L.seed), out = { pts: [], win: [] };
      if (p.modo === 'ciudad') { let x = L.X0; while (x < L.X0 + L.WW) { const w = (0.03 + R() * 0.06) * m, h = (0.2 + R() * 0.8) * p.altura * m; out.pts.push({ x, w, h }); const cols = Math.max(1, Math.floor(w / (0.014 * m))), rows = Math.max(1, Math.floor(h / (0.022 * m)));
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (R() < p.encendidas) out.win.push({ x: x + w * ((i + 0.5) / cols), y: baseY - h + (j + 0.7) * (h / rows) * 0.92, w: w / cols * 0.5, h: h / rows * 0.4, fl: R() < p.parpadeo, ph: R() * TAU, f: 0.5 + R() * 3 }); x += w; } }
      else if (p.modo === 'bosque') { let x = L.X0; while (x < L.X0 + L.WW) { const w = (0.015 + R() * 0.03) * m, h = (0.35 + R() * 0.65) * p.altura * m; out.pts.push({ x, w, h }); x += w * (0.5 + R() * 0.5); } }
      else { const N = 160, ph = Array.from({ length: p.detalle }, () => R() * 100); for (let i = 0; i <= N; i++) { const u = i / N; let v = 0, a = 1, f = p.modo === 'dunas' ? 1.6 : 2.2, nrm = 0; for (let o = 0; o < p.detalle; o++) { v += a * (pnoise(u * f * 3 + ph[o], 0.5, 9973, 1, L.seed + o) - 0.5); nrm += a; a *= p.modo === 'dunas' ? 0.3 : 0.5; f *= 2; } out.pts.push({ x: L.X0 + u * L.WW, h: (0.5 + (v / nrm) * 1.7) * p.altura * m }); } }
      return out;
    });
    ctx.fillStyle = L.hex(p.color); ctx.beginPath();
    if (p.modo === 'ciudad') { for (const b of S.pts) ctx.rect(b.x, baseY - b.h, b.w + 0.5, b.h + (p.lleno ? L.H : 4)); }
    else if (p.modo === 'bosque') { for (const b of S.pts) { ctx.moveTo(b.x - b.w * 0.2, baseY); ctx.lineTo(b.x + b.w / 2, baseY - b.h); ctx.lineTo(b.x + b.w * 1.2, baseY); } ctx.rect(L.X0, baseY - 1, L.WW, p.lleno ? L.H : 2); }
    else { ctx.moveTo(S.pts[0].x, L.Y0 + L.HH); S.pts.forEach((q) => ctx.lineTo(q.x, baseY - q.h)); ctx.lineTo(S.pts[S.pts.length - 1].x, L.Y0 + L.HH); ctx.closePath(); }
    ctx.fill();
    if (p.modo === 'ciudad') { ctx.fillStyle = L.hex(p.luces); for (const w of S.win) { ctx.globalAlpha = L.alpha * (w.fl ? 0.5 + 0.5 * Math.sin(L.t * w.f + w.ph) : 0.85); ctx.fillRect(w.x - w.w / 2, w.y - w.h / 2, w.w, w.h); } ctx.globalAlpha = 1; }
  });

// ── meta uniforme ─────────────────────────────────────────────────────────────────────────────────────────────
export const paramMeta = (params) => Object.entries(params).map(([name, d]) => ({ name, type: d.type === 'enum' ? `enum(${d.opts.join('|')})` : d.type, def: d.def }));
export const metaCapa = (c) => ({ id: c.tipo, kind: 'capa-fondo', resumen: c.resumen, tags: c.tags, params: paramMeta(c.params) });
export const META_CAPAS = Object.values(CAPAS).map(metaCapa);

// ── validación estricta ───────────────────────────────────────────────────────────────────────────────────────
const isHex = (s) => /^#[0-9a-fA-F]{3,8}$/.test(s), isRole = (s) => /^[A-Za-z][A-Za-z0-9]*$/.test(s);
export function colorOk(v) {
  if (typeof v === 'string') return isHex(v) || isRole(v);
  if (v && typeof v === 'object' && !Array.isArray(v)) { const k = Object.keys(v); return (k.length === 1 && k[0] === 'paleta' && typeof v.paleta === 'number') || (k.length === 1 && k[0] === 'mezcla' && Array.isArray(v.mezcla) && v.mezcla.length === 3 && colorOk(v.mezcla[0]) && colorOk(v.mezcla[1]) && typeof v.mezcla[2] === 'number'); }
  return false;
}
function valorOk(d, v) {
  switch (d.type) {
    case 'num': return typeof v === 'number' && Number.isFinite(v) && v >= d.min && v <= d.max ? '' : `número en [${d.min}, ${d.max}]`;
    case 'int': return Number.isInteger(v) && v >= d.min && v <= d.max ? '' : `entero en [${d.min}, ${d.max}]`;
    case 'bool': return typeof v === 'boolean' ? '' : 'true | false';
    case 'color': return colorOk(v) ? '' : 'rol de la paleta, #hex, {mezcla:[a,b,u]} o {paleta:u}';
    case 'colores': return Array.isArray(v) && v.length <= 12 && v.every(colorOk) ? '' : 'lista de colores (rol, #hex, {mezcla}, {paleta})';
    case 'par': return Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'number' && Number.isFinite(x)) ? '' : '[número, número]';
    case 'enum': return d.opts.includes(v) ? '' : `uno de: ${d.opts.join(' ')}`;
    case 'string': return v == null || typeof v === 'string' ? '' : 'texto';
    case 'json': return v == null || (typeof v === 'object' && !Array.isArray(v)) ? '' : 'objeto';
  }
  return '';
}
export function validateCapa(c, path, E) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) { E(path, 'la capa debe ser un objeto'); return; }
  const def = CAPAS[c.tipo];
  if (!def) { E(`${path}/tipo`, `tipo de capa desconocido "${c.tipo}"`, hint(c.tipo ?? '', Object.keys(CAPAS))); return; }
  for (const k of Object.keys(c)) {
    if (k === 'tipo') continue;
    const d = def.params[k]; if (!d) { E(`${path}/${k}`, `parámetro desconocido "${k}" en capa ${c.tipo}`, hint(k, Object.keys(def.params))); continue; }
    const bad = valorOk(d, c[k]); if (bad) E(`${path}/${k}`, `valor no válido para "${k}"`, bad);
  }
  if (c.id != null && !/^[A-Za-z][A-Za-z0-9]*$/.test(c.id)) E(`${path}/id`, `id "${c.id}" no válido (letras y dígitos)`);
  if (c.anim) for (const [k, src] of Object.entries(c.anim)) {
    if (!ANIM_KEYS.includes(k)) { E(`${path}/anim/${k}`, `anim desconocida "${k}"`, hint(k, ANIM_KEYS)); continue; }
    if (typeof src === 'number') continue;
    try { compile(String(src), { path: `${path}/anim/${k}` }); } catch (e) { E(`${path}/anim/${k}`, e.reason ?? e.message, 'expresión de t (engine/expr.mjs)'); }
  }
}
