// API que recibe cada shot. Todo lo que se dibuja por aquí queda REGISTRADO (cajas en pantalla) para el lint,
// y se adapta solo al estilo: roles tipográficos, área segura (letterbox incluido), parallax, glow/degradado condicionados.
import { springS, ease as EASE, clamp } from './core.mjs';
import { applyCam } from './camera.mjs';
import { barHeight } from './grade.mjs';
import { rgba as hexA, luminance } from './color.mjs';
import { SHAPES, lerpShape } from './shapes.mjs';
import { prims } from './prims.mjs';
import { drawScene } from './scene.mjs';

function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function toScreen(m, b, meta) {
  const pts = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), sx = Math.hypot(m.a, m.b);
  return { ...meta, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), sizePx: (meta.size ?? 0) * sx };
}

export function makeApi(ctx, film, shot, cx) {
  const S = film.S, W = film.width, H = film.height, k = Math.min(W, H) / 1080, boxes = cx.boxes ?? [], meta = cx.meta ?? [];
  const pal = S.palette, tf = S.typeface, sc = tf.scale || 1.5, base = (tf.base || 34) * k;
  const sizes = { label: base / sc, body: base, h2: base * sc, h1: base * sc * sc, display: base * sc ** 3 };
  const bar = barHeight(film), P = film.P.safe;
  const safe = { x0: W * P.side, x1: W * (1 - P.side), y0: bar + H * P.top, y1: H - bar - H * P.bottom };
  safe.w = safe.x1 - safe.x0; safe.h = safe.y1 - safe.y0; safe.cx = (safe.x0 + safe.x1) / 2; safe.cy = (safe.y0 + safe.y1) / 2;
  const col = (c) => pal[c] ?? c;
  const fam = (mono) => (mono ? `"${tf.mono || 'Courier New'}", monospace` : `"${tf.family}", ${tf.fallback || 'sans-serif'}`);
  const setBase = () => { const b = cx.base; ctx.setTransform(b.a, b.b, b.c, b.d, b.e, b.f); };

  const B0 = cx.base, safeScreen = { x0: B0.a * safe.x0 + B0.e, x1: B0.a * safe.x1 + B0.e, y0: B0.d * safe.y0 + B0.f, y1: B0.d * safe.y1 + B0.f };
  const api = {
    boxes, meta, S, k, safe, safeScreen, sizes, cam: cx.cam, t: cx.t, u: cx.u, shotId: shot.id, family: fam(false),
    _toScreen: (m, b) => toScreen(m, b, {}),
    _box: (m, b, metaB) => boxes.push(toScreen(m, b, { shot: shot.id, ...metaB })),
    _sub: (c2, tt) => makeApi(c2, film, shot, { ...cx, t: tt, boxes, meta }),
    scene: (spec, tt = cx.t) => drawScene(ctx, spec, tt, film, api),
    color: col,
    at: (fx, fy) => [safe.x0 + fx * safe.w, safe.y0 + fy * safe.h],          // punto relativo al área segura
    spring: (t, kind) => springS(t, film, kind),                              // muelle con la personalidad del estilo
    ease: (name, u) => (EASE[name || S.motion.ease] || EASE.inOut)(clamp(u)),
    stagger: (i) => i * (S.motion.stagger ?? 0.06),


    dt: 1 / (S.motion.stepFps || film.fps),                                   // duración de un paso de animación (para velocidades)

    // Motivo: dibuja la forma interpolada from→to (u 0..1) en (x,y) con tamaño-unidad `size`. Con luz activa (S.light)
    // añade sombra de contacto y brillo de borde en el MISMO azimut para todo el film. Registra el foco (con `hollow`).
    // o: { x, y, size, fill?, color?, label?, angle?, lit? }  → devuelve { x, y, w, h, r, th }
    morph(from, to, u, o = {}) {
      const s = o.size, x = o.x, y = o.y;
      if (!SHAPES[from] || !SHAPES[to]) throw new Error(`forma desconocida: ${!SHAPES[from] ? from : to}`);
      const p = lerpShape(SHAPES[from](s), SHAPES[to](s), clamp(u));
      const w = p.w, h = p.h, r = Math.min(p.r, w / 2, h / 2), th = Math.min(p.th, Math.min(w, h) / 2), mn = Math.min(w, h);
      if (!(s > 0.5) || mn < 1) return { x, y, w: 0, h: 0, r: 0, th: 0 };
      const solid = th >= mn / 2 - 0.5, L = S.light, lit = !!L?.enabled && o.lit !== false;
      const colName = o.color ?? film.motif?.roleColor ?? 'ink', fill = o.fill ?? col(colName);
      ctx.save();
      if (lit && (solid || th >= 0.06 * mn)) {                                 // sombra de contacto: cae en sentido opuesto a la luz
        const az = (L.az * Math.PI) / 180, ox = -Math.cos(az);
        ctx.globalAlpha = L.shadow; ctx.fillStyle = '#000'; ctx.beginPath();
        ctx.ellipse(x + ox * w * 0.12, y + h / 2 + h * 0.05, w * 0.46, Math.max(2, mn * 0.1), 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      }
      ctx.beginPath(); rr(ctx, x - w / 2, y - h / 2, w, h, r);
      if (!solid) rr(ctx, x - w / 2 + th, y - h / 2 + th, w - 2 * th, h - 2 * th, Math.max(0, r - th));
      ctx.fillStyle = fill; ctx.fill('evenodd');
      if (lit && r >= 0.9 * (mn / 2)) {                                        // brillo de borde en el lado de la luz
        const dark = typeof fill !== 'string' || luminance(pal[colName] ?? '#000000') < 0.5, la = -(L.az * Math.PI) / 180, rad = solid ? r * 0.82 : r - th / 2;
        ctx.strokeStyle = dark ? `rgba(255,255,255,${L.highlight})` : `rgba(0,0,0,${L.highlight * 0.7})`; ctx.lineWidth = Math.max(1.5 * k, Math.min(solid ? r * 0.08 : th * 0.3, r * 0.08)); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x, y, rad, la - 0.6, la + 0.6); ctx.stroke();
      }
      if (p.sat > 0.01) {                                                      // satélite (orbit)
        const a = o.angle ?? cx.t * 1.4, rad = r - th / 2;
        ctx.fillStyle = col('accent'); ctx.beginPath(); ctx.arc(x + rad * Math.cos(a), y + rad * Math.sin(a), 0.09 * s * p.sat, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      const inner = solid ? 0 : Math.max(0, Math.min((w - 2 * th) / w, (h - 2 * th) / h));
      api.focus(x - w / 2, y - h / 2, w, h, o.label ?? 'motivo', { hollow: inner * 0.7 });
      return { x, y, w, h, r, th };
    },
    // Estirado de stop-motion en el eje de la velocidad (px/s). No hace nada si el estilo no lo pide.
    smear(x, y, vx, vy, fn) {
      const kk = S.motion.smear || 0, sp = Math.hypot(vx, vy);
      if (!kk || sp < 1) return fn();
      const st = 1 + kk * clamp(sp / (W * 0.6)), an = Math.atan2(vy, vx);
      ctx.save(); ctx.translate(x, y); ctx.rotate(an); ctx.scale(st, 1 / Math.sqrt(st)); ctx.rotate(-an); ctx.translate(-x, -y); fn(); ctx.restore();
    },
    // Billboard 2.5D: giro en Y fingido con scaleX = cos θ (≤ 35°, más se ve carta). Devuelve cos θ para estirar la sombra.
    billboard(x, y, theta, fn) {
      const th = clamp(theta, -0.61, 0.61);
      ctx.save(); ctx.translate(x, y); ctx.scale(Math.cos(th), 1); ctx.translate(-x, -y); fn(); ctx.restore(); return Math.cos(th);
    },
    // Suelo: plano que ancla al sujeto y se mueve distinto (parallax 0.6). fy = altura relativa al área segura.
    ground(fy, alpha = 0.3) {
      const yy = safe.y0 + fy * safe.h;
      api.depth(0.6, () => { ctx.fillStyle = hexA(col('shade'), alpha); ctx.fillRect(-W, yy, 3 * W, 3 * H); ctx.fillStyle = hexA(col('shade'), Math.min(1, alpha * 2)); ctx.fillRect(-W, yy - 1, 3 * W, 2); });
    },

    text(str, x, y, o = {}) {
      const role = o.role || 'body', size = o.size ?? sizes[role] ?? sizes.body, a = o.alpha ?? 1;
      const heavy = role === 'h1' || role === 'h2' || role === 'display';
      const weight = o.weight ?? (heavy ? tf.weights[tf.weights.length - 1] : tf.weights[0]);
      const s = (o.case ?? tf.case) === 'upper' ? String(str).toUpperCase() : String(str), tr = (o.tracking ?? tf.tracking ?? 0) * size;
      ctx.save();
      if (o.screen) setBase();
      ctx.font = `${weight} ${size}px ${fam(role === 'mono')}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.globalAlpha = a; ctx.fillStyle = col(o.color ?? 'ink');
      let ws = null, w;
      if (tr) { ws = [...s].map((c) => ctx.measureText(c).width); w = ws.reduce((p, q) => p + q, 0) + tr * (ws.length - 1); } else w = ctx.measureText(s).width;
      const al = o.align ?? 'center', x0 = al === 'center' ? x - w / 2 : al === 'right' ? x - w : x;
      if (ws) { let px = x0; [...s].forEach((c, i) => { ctx.fillText(c, px, y); px += ws[i] + tr; }); } else ctx.fillText(s, x0, y);
      const m = ctx.getTransform(); ctx.restore();
      if (a > 0.2) boxes.push(toScreen(m, { x: x0, y: y - size * 0.575, w, h: size * 1.15 }, { kind: 'text', shot: shot.id, label: s, size, role }));
    },
    // Sujeto/zona que el tipo no debe tapar. opts: { weight, bleed, hollow } — hollow: fracción central libre (anillos, marcos): el tipo puede vivir dentro.
    focus(x, y, w, h, label = 'focus', opts = {}) {
      boxes.push(toScreen(ctx.getTransform(), { x, y, w, h }, { kind: 'focus', shot: shot.id, label, weight: opts.weight ?? 1, bleed: !!opts.bleed, hollow: opts.hollow ?? 0 }));
    },
    glow(x, y, r, color = 'accent', alpha = 0.5) {                            // no-op si el estilo lo prohíbe
      if (!S.rules.glow) return;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, hexA(col(color), alpha)); g.addColorStop(1, hexA(col(color), 0));
      ctx.save(); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore();
    },
    gradient(x0, y0, x1, y1, roles = ['accent', 'accent2'], fallback = 'ink') {  // sólido si el estilo lo prohíbe
      if (!S.rules.gradients) return col(fallback);
      const g = ctx.createLinearGradient(x0, y0, x1, y1); roles.forEach((r, i) => g.addColorStop(i / Math.max(1, roles.length - 1), col(r))); return g;
    },
    // Parallax: 0 fondo lejano · 1 plano del sujeto · >1 primer plano
    depth(d, fn) {
      ctx.save(); const b = cx.base; ctx.setTransform(b.a, b.b, b.c, b.d, b.e, b.f); applyCam(ctx, cx.cam, W, H, d); if (cx.rec) cx.rec.inApi = (cx.rec.inApi ?? 0) + 1; try { fn(); } finally { if (cx.rec) cx.rec.inApi--; } ctx.restore();
    },
  };
  Object.assign(api, prims(ctx, api, film, shot, cx));
  return api;
}
