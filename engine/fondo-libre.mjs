// CAPAS LIBRES (spec 021): capas que REACCIONAN a eventos del timeline (onda, mancha, pulso) y la capa `codigo` (función propia del film).
// Todas son funciones puras de (t, lista de eventos): sin estado entre cuadros, así que el orden de pintado no importa y el seek sigue siendo puro.
//   evento = selector (tipo `impacto`, id `giro`, `K01:*`…): ver fondo-valor.mjs. Posición del evento (x,y fracciones del cuadro) o `centro`.
import { clamp, hashStr, rng } from './core.mjs';
import { mix } from './color.mjs';
import { rgba } from './color.mjs';
import { capa, T, CAPAS, TAU } from './fondo-capas.mjs';
import { selEventos, evHelpers } from './fondo-valor.mjs';

const S = (def, doc) => ({ type: 'string', def, doc });
const EV = S('impacto', 'selector de eventos: tipo (impacto, cue, beat) o id (giro, b4, K01:*)');

capa('onda', 'reactiva', 'Anillos que se expanden desde cada evento, como el agua tras un golpe.', ['evento', 'impacto', 'agua', 'onda'], {
  evento: EV, color: T.color('ink', 'color del anillo'), velocidad: T.num(0.55, 'velocidad de expansión (lado menor por segundo)', 0.05, 3), ancho: T.num(0.05, 'grosor inicial (lado menor)', 0.002, 0.3),
  anillos: T.int(2, 'anillos concéntricos por evento', 1, 6), separacion: T.num(0.07, 'separación entre anillos (lado menor)', 0.01, 0.5), vida: T.num(1.8, 'segundos que dura cada onda', 0.1, 20),
  intensidad: T.num(0.8, 'opacidad máxima 0..1', 0, 1), centro: T.par([0.5, 0.5], 'origen si el evento no trae x,y (fracciones del cuadro)') }, { paralaje: 0.4 },
  (ctx, p, L) => {
    const m = Math.min(L.W, L.H), col = L.hex(p.color); ctx.strokeStyle = col; ctx.lineCap = 'round';
    for (const e of selEventos(L.eventos, p.evento)) {
      const age = L.t - e.t; if (age < 0 || age >= p.vida) continue;
      const k = age / p.vida, fade = (1 - k) * (1 - k) * (e.fuerza ?? 1) * p.intensidad, cx = (e.x ?? p.centro[0]) * L.W, cy = (e.y ?? p.centro[1]) * L.H;
      for (let r = 0; r < p.anillos; r++) {
        const rad = (p.velocidad * age - r * p.separacion) * m; if (rad <= 0) continue;
        ctx.globalAlpha = clamp(L.alpha * fade * (1 - r * 0.28)); ctx.lineWidth = Math.max(1, p.ancho * m * (1 - k) * (1 - r * 0.2) * L.k);
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.stroke();
      }
    }
  });
capa('mancha', 'reactiva', 'Mancha de tinta o gota que crece en cada evento, persiste y se desvanece.', ['evento', 'tinta', 'gota', 'mancha'], {
  evento: EV, color: T.color('ink', 'color de la mancha'), radio: T.num(0.22, 'radio final (lado menor)', 0.01, 2), crece: T.num(0.5, 'segundos característicos de crecimiento', 0.02, 10),
  persiste: T.num(4, 'segundos a plena opacidad', 0, 60), vida: T.num(6, 'segundos de desvanecimiento tras persistir', 0.1, 60), irregular: T.num(0.35, 'irregularidad del contorno 0..1', 0, 1),
  intensidad: T.num(0.5, 'opacidad máxima 0..1', 0, 1), centro: T.par([0.5, 0.5], 'origen si el evento no trae x,y (fracciones del cuadro)') }, { paralaje: 0.5 },
  (ctx, p, L) => {
    const m = Math.min(L.W, L.H), col = L.hex(p.color);
    for (const e of selEventos(L.eventos, p.evento)) {
      const age = L.t - e.t; if (age < 0 || age >= p.persiste + p.vida) continue;
      const fade = age < p.persiste ? 1 : 1 - (age - p.persiste) / p.vida, r0 = p.radio * m * (1 - Math.exp(-age / p.crece)), cx = (e.x ?? p.centro[0]) * L.W, cy = (e.y ?? p.centro[1]) * L.H;
      const R = rng((hashStr(String(e.id)) + Math.round(e.t * 1000) + L.seed) | 0), ph = [R() * TAU, R() * TAU, R() * TAU, R() * TAU], am = [R() * 0.5, R() * 0.35, R() * 0.22, R() * 0.14];
      const blob = (sc) => { ctx.beginPath(); for (let i = 0; i <= 56; i++) { const a = (i / 56) * TAU; let q = 1; for (let h = 0; h < 4; h++) q += Math.sin(a * (h + 2) + ph[h]) * am[h] * p.irregular; const x = cx + Math.cos(a) * r0 * q * sc, y = cy + Math.sin(a) * r0 * q * sc; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); };
      ctx.fillStyle = col; ctx.globalAlpha = clamp(L.alpha * fade * p.intensidad * (e.fuerza ?? 1) * 0.55); blob(1); ctx.fill();
      ctx.globalAlpha = clamp(L.alpha * fade * p.intensidad * (e.fuerza ?? 1) * 0.45); blob(0.62); ctx.fill();
    }
  });
capa('pulso', 'reactiva', 'Lavado de color o foco que se enciende en cada evento y se apaga.', ['evento', 'destello', 'luz', 'sacudida'], {
  evento: EV, color: T.color('paper', 'color del destello'), tau: T.num(0.35, 'constante de apagado (s)', 0.02, 10), intensidad: T.num(0.5, 'opacidad máxima 0..1', 0, 1),
  modo: T.enu('lavado', 'lavado: todo el cuadro · radial: foco sobre el último evento', ['lavado', 'radial']), radio: T.num(0.9, 'radial: radio (diagonal)', 0.05, 3), centro: T.par([0.5, 0.5], 'origen radial si el evento no trae x,y') }, { paralaje: 0 },
  (ctx, p, L) => {
    const h = evHelpers(L.eventos, L.t), a = clamp(p.intensidad * h.pulso(p.evento, p.tau)); if (a <= 0.003) return;
    const col = L.hex(p.color);
    if (p.modo === 'radial') {
      const last = selEventos(L.eventos, p.evento).filter((e) => e.t <= L.t).pop(), cx = (last?.x ?? p.centro[0]) * L.W, cy = (last?.y ?? p.centro[1]) * L.H, R = (p.radio * Math.hypot(L.W, L.H)) / 2;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g;
    } else ctx.fillStyle = rgba(col, a);
    ctx.fillRect(L.X0, L.Y0, L.WW, L.HH);
  });
for (const k of ['onda', 'mancha', 'pulso']) CAPAS[k].reactiva = true;

// ═════ codigo: la vía libre ═════
export const CODIGO_RE = /^fondos\/[A-Za-z0-9_-]+\.mjs$/;
capa('codigo', 'libre', 'Capa escrita por el agente: función pura (ctx, t, E) en shots/fondos/, bajo sandbox.', ['codigo', 'libre', 'sandbox', 'procedural'], {
  archivo: S(null, 'ruta bajo shots/: fondos/<nombre>.mjs (export default function (ctx, t, E))'),
  params: { type: 'json', def: null, din: true, doc: 'valores para E.p; admiten expr y keyframes' }, maxMs: T.num(30, 'presupuesto de ms por cuadro; lint avisa si se supera', 1, 1000) }, { paralaje: 0.3 },
  (ctx, p, L) => {
    if (!L.codigo) throw new Error('fondo: la capa codigo exige el sandbox de shots (E.codigo): falla cerrada, no se ejecuta código del film sin él');
    const fn = L.codigo(p.archivo);
    if (typeof fn !== 'function') throw new Error(`fondo: codigo "${p.archivo}" no está cargado (¿existe shots/${p.archivo}? ¿lo rechazó la guardia? ver node engine/lint.mjs --only validate)`);
    const env = L.env, h = env.fns;
    const E = Object.freeze({ W: L.W, H: L.H, k: L.k, t: L.t, lt: L.lt, u: L.u, dur: env.dur, beat: env.beat, seed: L.seed, p: Object.freeze(p.params ?? {}), pal: Object.freeze({ ...L.pal }), hex: L.hex, mix,
      eventos: Object.freeze(env.eventos.map((e) => Object.freeze({ ...e }))), pulso: h.pulso, desde: h.desde, hasta: h.hasta, paso: h.paso, cuenta: h.cuenta });
    fn(ctx, L.t, E);
  });
CAPAS.codigo.validar = (c, path, E) => {
  if (c.archivo == null || !CODIGO_RE.test(String(c.archivo))) E(`${path}/archivo`, `archivo "${c.archivo}" no válido: debe ser fondos/<nombre>.mjs`, 'el código del fondo vive en shots/fondos/<nombre>.mjs');
};
