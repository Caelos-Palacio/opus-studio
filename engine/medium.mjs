// MEDIO (spec 003): la superficie y la materia de todo el film. Soporte (papel con fibras y manchas), tinta (grano riso,
// erosión, desregistro, jitter de trazo), grano animado, viñeta, paleta cerrada, capas de parallax y reglas de composición.
//   · Datos: styles/medios/<nombre>.json; el film lo elige con `"medium"` en el timeline. Sin medio: seek no entra aquí.
//   · Puro y determinista: toda textura sale de rng(seed) y se PRECALCULA UNA VEZ por (medio, seed, tamaño) — nunca por fotograma.
//     Por fotograma solo hay drawImage/patrones desplazados (grano = N teselas con desplazamiento aleatorio por índice de fotograma).
//   · Los shots no cambian: dibujan con la paleta del medio (api.color) en una capa de tinta transparente; seek la compone con
//     multiply sobre el papel (así la tinta "es" del papel: erosión, doble pasada desregistrada y temblor de trazo).
//   · Utilidad pura para shots: paperTone. (docs/MEDIOS.md)
import { rng, clamp, lerp, noise1 } from './core.mjs';
import { hex2rgb, rgba as hexA } from './color.mjs';
import { applyCam } from './camera.mjs';

export const mediumStats = { builds: 0 };
const PAD = 1.35;                                                         // las capas de parallax se dibujan 35 % más grandes que el cuadro

// Sobrescrituras de estilo que implica el medio (paleta, post, reglas, composición). El timeline manda sobre ellas.
export const mediumOverrides = (m) => ({ palette: m.palette, grade: m.grade, rules: m.rules, compose: m.composition });

// ───────── campos de ruido ─────────
function field(w, h, cell, r) {                                           // ruido de valor bilineal [0,1], malla `cell` px
  const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2, g = new Float32Array(gw * gh), out = new Float32Array(w * h);
  for (let i = 0; i < g.length; i++) g[i] = r();
  for (let y = 0; y < h; y++) {
    const fy = y / cell, y0 = Math.floor(fy), v = fy - y0, sv = v * v * (3 - 2 * v);
    for (let x = 0; x < w; x++) {
      const fx = x / cell, x0 = Math.floor(fx), u = fx - x0, su = u * u * (3 - 2 * u), i = y0 * gw + x0;
      out[y * w + x] = lerp(lerp(g[i], g[i + 1], su), lerp(g[i + gw], g[i + gw + 1], su), sv);
    }
  }
  return out;
}
const rgbOf = (c) => hex2rgb(c);
const rr = (r, [a, b]) => a + (b - a) * r();

// ───────── soporte: tono + mottle + diente + microfibras (estático) ─────────
function buildSupport(film, M, W, H, r, mk) {
  const cv = mk(W, H), x = cv.getContext('2d'), S = M.support, k = W / 1280, im = x.createImageData(W, H), d = im.data;
  const base = rgbOf(S.base), warm = rgbOf(S.mottle.warm), cool = rgbOf(S.mottle.cool);
  const f1 = field(W, H, Math.max(8, S.mottle.cell * k), r), f2 = field(W, H, Math.max(4, S.mottle.cell * k * 0.3), r);
  for (let i = 0, p = 0; i < W * H; i++, p += 4) {
    const n = (f1[i] * 0.7 + f2[i] * 0.3), t = n - 0.5, a = S.mottle.amount * 2, tooth = 1 + (r() - 0.5) * S.tooth * 2;
    for (let c = 0; c < 3; c++) {
      const mixc = t > 0 ? lerp(base[c], warm[c], clamp(t * 2.4)) : lerp(base[c], cool[c], clamp(-t * 2.4));
      d[p + c] = clamp((mixc * (1 + (n - 0.5) * a) * tooth) / 255) * 255;
    }
    d[p + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  if (S.fibers) fibers(x, r, S.fibers, W, H, k);
  if (S.decor) decor(x, r, S.decor, W, H, k, 0, M, 1);                    // rejilla, ladrillo, pliegues… (medios nuevos; papel_crema no usa nada de esto)
  if (S.wet) wet(x, r, S.wet, W, H, k);
  return cv;
}
// Fibras: arcos cortos y finos, algunas claras (sobre el papel) y otras oscuras.
function fibers(x, r, F, W, H, k, over = 0) {
  x.save(); x.lineCap = 'round';
  for (let i = 0; i < F.n; i++) {
    const px = r() * W, py = r() * H, len = rr(r, F.len) * k, ang = r() * Math.PI, bend = (r() - 0.5) * 1.4, light = !over && F.light && r() < 0.3;
    x.strokeStyle = light ? F.light : F.color; x.globalAlpha = rr(r, F.alpha); x.lineWidth = (F.width ?? 0.8) * k * (0.6 + r() * 0.8);
    x.beginPath(); x.moveTo(px, py);
    x.quadraticCurveTo(px + Math.cos(ang + bend) * len * 0.5, py + Math.sin(ang + bend) * len * 0.5, px + Math.cos(ang) * len, py + Math.sin(ang) * len); x.stroke();
  }
  x.restore();
}
function specks(x, r, P, W, H, k) {
  x.save(); x.fillStyle = P.color;
  for (let i = 0; i < P.n; i++) { x.globalAlpha = rr(r, P.alpha); x.beginPath(); x.arc(r() * W, r() * H, rr(r, P.r) * k, 0, 6.2832); x.fill(); }
  x.restore();
}
function stains(x, r, T, W, H, k) {                                       // mancha de té: relleno suave + borde más oscuro (anillo de café)
  for (let i = 0; i < T.n; i++) {
    const cx = r() * W, cy = r() * H, R = rr(r, T.r) * k, sx = 0.7 + r() * 0.6, [R0, G0, B0] = rgbOf(T.color);
    x.save(); x.translate(cx, cy); x.scale(sx, 1); x.rotate(r() * 3);
    const g = x.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
    g.addColorStop(0, `rgba(${R0},${G0},${B0},${T.alpha * 0.55})`); g.addColorStop(0.78, `rgba(${R0},${G0},${B0},${T.alpha * 0.8})`);
    g.addColorStop(0.93, `rgba(${R0 * 0.7 | 0},${G0 * 0.7 | 0},${B0 * 0.7 | 0},${T.alpha * (1 + T.ring)})`); g.addColorStop(1, `rgba(${R0},${G0},${B0},0)`);
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, R, 0, 6.2832); x.fill(); x.restore();
  }
}
function hatch(x, r, Hc, W, H, k) {                                       // parches de rayado a lápiz: líneas paralelas con deriva y longitud irregular
  x.save(); x.strokeStyle = Hc.color; x.lineCap = 'round';
  for (let p = 0; p < Hc.patches; p++) {
    const cx = r() * W, cy = r() * H, sz = rr(r, Hc.size) * k, ang = -0.6 + (r() - 0.5) * 0.5, gap = Hc.gap * k, ca = Math.cos(ang), sa = Math.sin(ang);
    for (let o = -sz; o < sz; o += gap * (0.8 + r() * 0.5)) {
      const l = sz * (0.5 + 0.5 * Math.cos((o / sz) * 1.4)) * (0.7 + r() * 0.3), ox = -sa * o, oy = ca * o;
      x.globalAlpha = Hc.alpha * (0.5 + r() * 0.8); x.lineWidth = (0.7 + r() * 0.6) * k;
      x.beginPath(); x.moveTo(cx + ox - ca * l, cy + oy - sa * l); x.lineTo(cx + ox + ca * l + (r() - 0.5) * 3, cy + oy + sa * l + (r() - 0.5) * 3); x.stroke();
    }
  }
  x.restore();
}
// ───────── primitivas de decoración nuevas (kraft, pizarra, técnico, neón); todas deterministas por rng ─────────
const fontOf = (P, M) => P.font ?? M?.font ?? 'monospace';
function grid(x, G, W, H, k) {                                            // cuadrícula milimetrada: paso fino + línea gruesa cada `major`
  x.save(); x.strokeStyle = G.color; const m = G.minor * k, M2 = G.major ?? 0, lw = Math.max(k, 0.75);
  for (let ax = 0; ax < 2; ax++) for (let i = 0, p = 0; p < (ax ? H : W); i++, p = i * m) {
    const maj = M2 && i % M2 === 0; x.globalAlpha = maj ? (G.majorAlpha ?? Math.min(1, G.alpha * 2.4)) : G.alpha; x.lineWidth = (maj ? 1.4 : 0.9) * lw;
    const q = Math.round(p) + 0.5; x.beginPath(); if (ax) { x.moveTo(0, q); x.lineTo(W, q); } else { x.moveTo(q, 0); x.lineTo(q, H); } x.stroke();
  }
  x.restore();
}
function dims(x, r, D, W, H, k, M) {                                      // cotas: línea entre dos marcas con flechas y valor en mono
  x.save(); x.strokeStyle = D.color; x.fillStyle = D.color; x.font = `${Math.round(D.size * k)}px ${fontOf(D, M)}`; x.textAlign = 'center'; x.lineWidth = Math.max(1, 0.9 * k);
  for (let i = 0; i < D.n; i++) {
    const px = r() * W, py = r() * H, len = rr(r, D.len) * k, vert = r() < 0.4, t = 8 * k, a = 5 * k; x.globalAlpha = rr(r, D.alpha);
    x.save(); x.translate(px, py); if (vert) x.rotate(-Math.PI / 2);
    x.beginPath(); x.moveTo(0, -t); x.lineTo(0, t); x.moveTo(len, -t); x.lineTo(len, t); x.moveTo(0, 0); x.lineTo(len, 0); x.stroke();
    x.beginPath(); x.moveTo(0, 0); x.lineTo(a * 1.5, -a * 0.5); x.lineTo(a * 1.5, a * 0.5); x.closePath(); x.moveTo(len, 0); x.lineTo(len - a * 1.5, -a * 0.5); x.lineTo(len - a * 1.5, a * 0.5); x.closePath(); x.fill();
    x.fillText(((len / k) * (D.unit ?? 0.5)).toFixed(1), len / 2, -t * 0.8); x.restore();
  }
  x.restore();
}
function marks(x, r, Mk, W, H, k) {                                       // marcas de registro: cruz + círculo
  x.save(); x.strokeStyle = Mk.color; x.lineWidth = Math.max(1, k);
  for (let i = 0; i < Mk.n; i++) {
    const cx = r() * W, cy = r() * H, R = rr(r, Mk.r) * k; x.globalAlpha = rr(r, Mk.alpha);
    x.beginPath(); x.arc(cx, cy, R, 0, 6.2832); x.moveTo(cx - R * 1.7, cy); x.lineTo(cx + R * 1.7, cy); x.moveTo(cx, cy - R * 1.7); x.lineTo(cx, cy + R * 1.7); x.stroke();
  }
  x.restore();
}
function texts(x, r, T, W, H, k, M, pad) {                                // HUD: textos en posiciones relativas al CUADRO (no al lienzo con relleno)
  const fw = W / pad, fh = H / pad, ox = (W - fw) / 2, oy = (H - fh) / 2;
  x.save(); x.fillStyle = T.color;
  for (const it of T.items) { x.globalAlpha = it.alpha ?? T.alpha; x.font = `${it.bold ? 'bold ' : ''}${Math.round((it.size ?? T.size) * k)}px ${fontOf(T, M)}`; x.textAlign = it.align ?? 'left'; x.fillText(it.t, ox + it.x * fw, oy + it.y * fh); }
  x.restore();
}
function stamps(x, r, S, W, H, k, M) {                                    // sellos de tinta: circular y rectangular; tinta «falta» en motas y rayas
  x.save(); const tx = S.texts ?? ['FRÁGIL'];
  for (let i = 0; i < S.n; i++) {
    const cx = r() * W, cy = r() * H, R = rr(r, S.r) * k, a = rr(r, S.alpha); x.save(); x.translate(cx, cy); x.rotate((r() - 0.5) * (S.tilt ?? 0.5));
    x.strokeStyle = x.fillStyle = S.color; x.globalAlpha = a; x.textAlign = 'center'; x.textBaseline = 'middle'; const f = fontOf(S, M), t1 = tx[i % tx.length], t2 = tx[(i + 1) % tx.length];
    if (i % 2 === 0) {
      x.lineWidth = 3.4 * k; x.beginPath(); x.arc(0, 0, R, 0, 6.2832); x.stroke(); x.lineWidth = 1.3 * k; x.beginPath(); x.arc(0, 0, R * 0.84, 0, 6.2832); x.stroke();
      x.font = `bold ${Math.round(R * 0.27)}px ${f}`; x.fillText(t1, 0, -R * 0.08); x.font = `${Math.round(R * 0.15)}px ${f}`; x.fillText(t2, 0, R * 0.32);
      x.beginPath(); x.moveTo(-R * 0.55, R * 0.14); x.lineTo(R * 0.55, R * 0.14); x.stroke();
    } else {
      const w = R * 2.3, h = R * 0.95; x.lineWidth = 3.6 * k; x.strokeRect(-w / 2, -h / 2, w, h); x.lineWidth = 1.2 * k; x.strokeRect(-w / 2 + 5 * k, -h / 2 + 5 * k, w - 10 * k, h - 10 * k);
      x.font = `bold ${Math.round(h * 0.42)}px ${f}`; x.fillText(t1, 0, 0);
    }
    x.globalCompositeOperation = 'destination-out';                       // tinta que no prende: motas y rozaduras
    for (let q = 0; q < S.starve; q++) { x.globalAlpha = 0.25 + r() * 0.6; x.beginPath(); x.arc((r() - 0.5) * R * 2.6, (r() - 0.5) * R * 2.2, (0.5 + r() * 2.2) * k, 0, 6.2832); x.fill(); }
    for (let q = 0; q < 6; q++) { x.globalAlpha = 0.3 + r() * 0.4; x.lineWidth = (0.8 + r() * 1.6) * k; const y0 = (r() - 0.5) * R * 2; x.beginPath(); x.moveTo(-R * 1.3, y0); x.lineTo(R * 1.3, y0 + (r() - 0.5) * R * 0.2); x.stroke(); }
    x.restore();
  }
  x.restore();
}
function ghost(x, r, G, W, H, k, M) {                                     // restos de lo borrado: fórmulas y trazos fantasma muy tenues
  x.save(); x.fillStyle = x.strokeStyle = G.color; x.textBaseline = 'middle'; x.textAlign = 'center';
  for (let i = 0; i < G.texts.n; i++) { x.save(); x.globalAlpha = rr(r, G.texts.alpha); x.translate(r() * W, r() * H); x.rotate((r() - 0.5) * 0.35); x.font = `italic ${Math.round(rr(r, G.texts.size) * k)}px ${fontOf(G, M)}`; x.fillText(G.texts.list[Math.floor(r() * G.texts.list.length)], 0, 0); x.restore(); }
  x.lineCap = 'round';
  for (let i = 0; i < G.curves.n; i++) {
    const cx = r() * W, cy = r() * H, len = rr(r, G.curves.len) * k, amp = rr(r, G.curves.amp) * k, ph = r() * 6.28, rot = (r() - 0.5) * 0.5; x.save(); x.translate(cx, cy); x.rotate(rot); x.globalAlpha = rr(r, G.curves.alpha); x.lineWidth = rr(r, G.curves.width) * k;
    x.beginPath(); for (let u = 0; u <= 1.001; u += 0.02) { const px = (u - 0.5) * len, py = Math.sin(u * 6.2832 * 1.3 + ph) * amp; u ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
    x.globalAlpha *= 0.7; x.lineWidth = 1.6 * k; x.beginPath(); x.moveTo(-len / 2, 0); x.lineTo(len / 2, 0); x.moveTo(0, -amp * 1.3); x.lineTo(0, amp * 1.3); x.stroke(); x.restore();
  }
  x.restore();
}
function smudge(x, r, Sm, W, H, k) {                                      // pasadas de borrador: rayas anchas que borran parte de lo anterior y dejan polvo
  x.save(); x.lineCap = 'round';
  for (let i = 0; i < Sm.n; i++) {
    const x0 = r() * W, y0 = r() * H, len = rr(r, Sm.len) * k, ang = (r() - 0.5) * 1.6 + (i % 2 ? 0.25 : -0.2), w = rr(r, Sm.width) * k, bend = (r() - 0.5) * len * 0.35;
    const mx = x0 + Math.cos(ang) * len / 2 - Math.sin(ang) * bend, my = y0 + Math.sin(ang) * len / 2 + Math.cos(ang) * bend, x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len, nx = -Math.sin(ang), ny = Math.cos(ang);
    const pass = (n, op, color, a0, lw0) => { x.globalCompositeOperation = op; x.strokeStyle = color;
      for (let s = 0; s < n; s++) { const o = (s / (n - 1) - 0.5) * w; x.globalAlpha = a0 * (0.35 + r() * 0.9); x.lineWidth = lw0 * (0.6 + r() * 1.2) * k; x.beginPath(); x.moveTo(x0 + nx * o, y0 + ny * o); x.quadraticCurveTo(mx + nx * o, my + ny * o, x1 + nx * o, y1 + ny * o); x.stroke(); } };
    pass(16, 'destination-out', '#000', Sm.erase, 5);                    // borra lo dibujado debajo (fantasmas)
    pass(14, 'source-over', Sm.color, Sm.dust, 4);                         // y deja el velo de polvo de tiza
  }
  x.restore();
}
function haze(x, r, Hz, W, H, k) {                                        // bruma: manchas de luz difusa
  x.save();
  for (let i = 0; i < Hz.n; i++) {
    const cx = r() * W, cy = r() * H, R = rr(r, Hz.r) * k, c = Hz.colors[Math.floor(r() * Hz.colors.length)], a = rr(r, Hz.alpha), g = x.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, hexA(c, a)); g.addColorStop(0.55, hexA(c, a * 0.4)); g.addColorStop(1, hexA(c, 0)); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, 6.2832); x.fill();
  }
  x.restore();
}
function bokeh(x, r, B, W, H, k) {                                        // luces desenfocadas con borde más vivo
  x.save();
  for (let i = 0; i < B.n; i++) {
    const cx = r() * W, cy = r() * H, R = rr(r, B.r) * k, c = B.colors[Math.floor(r() * B.colors.length)], a = rr(r, B.alpha), g = x.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
    g.addColorStop(0, hexA(c, a * 0.45)); g.addColorStop(0.8, hexA(c, a * 0.7)); g.addColorStop(0.93, hexA(c, a * 1.2)); g.addColorStop(1, hexA(c, 0)); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, 6.2832); x.fill();
  }
  x.restore();
}
function creases(x, r, C, W, H, k) {                                      // pliegues: línea oscura + línea clara pegada
  x.save(); x.lineCap = 'round';
  for (let i = 0; i < C.n; i++) {
    const x0 = r() * W, y0 = r() * H, ang = (r() - 0.5) * 1.2 + (r() < 0.5 ? 0 : Math.PI / 2), len = rr(r, C.len) * k, pts = []; for (let q = 0; q <= 5; q++) pts.push([x0 + Math.cos(ang) * len * q / 5 + (r() - 0.5) * 6 * k, y0 + Math.sin(ang) * len * q / 5 + (r() - 0.5) * 6 * k]);
    for (const [col, off, a] of [[C.dark, 0, rr(r, C.alpha)], [C.light, 1.6 * k, rr(r, C.alpha) * 0.8]]) { x.strokeStyle = col; x.globalAlpha = a; x.lineWidth = (1 + r()) * k; x.beginPath(); pts.forEach(([px, py], q) => (q ? x.lineTo(px + off, py + off) : x.moveTo(px + off, py + off))); x.stroke(); }
  }
  x.restore();
}
function bricks(x, r, B, W, H, k) {                                       // muro de ladrillo: teselas con variación de tono y juntas
  const bw = B.w * k, bh = B.h * k, ymax = (B.ymax ?? 1) * H; x.save();
  for (let y = 0, j = 0; y < ymax; y += bh, j++) for (let xx = -(j % 2) * bw / 2; xx < W; xx += bw) { x.globalAlpha = rr(r, B.vary); x.fillStyle = r() < 0.5 ? B.light : B.dark; x.fillRect(xx + 1, y + 1, bw - 2, Math.min(bh, ymax - y) - 2); }
  x.strokeStyle = B.mortar; x.globalAlpha = B.mortarAlpha; x.lineWidth = Math.max(1, 1.4 * k);
  for (let y = 0, j = 0; y < ymax; y += bh, j++) { x.beginPath(); x.moveTo(0, y + 0.5); x.lineTo(W, y + 0.5); for (let xx = -(j % 2) * bw / 2; xx < W; xx += bw) { x.moveTo(xx + 0.5, y); x.lineTo(xx + 0.5, Math.min(y + bh, ymax)); } x.stroke(); }
  x.restore();
}
function wet(x, r, Wt, W, H, k) {                                         // suelo mojado: barniz que sube hacia el horizonte + vetas de reflejo
  const y0 = Wt.y * H, g = x.createLinearGradient(0, y0, 0, H); g.addColorStop(0, hexA(Wt.color, Wt.alpha)); g.addColorStop(1, hexA(Wt.color2 ?? Wt.color, Wt.alpha * 0.4));
  x.save(); x.fillStyle = g; x.fillRect(0, y0, W, H - y0); x.fillStyle = Wt.streak;
  for (let i = 0; i < Wt.streaks; i++) { x.globalAlpha = rr(r, Wt.streakAlpha); x.beginPath(); x.ellipse(r() * W, y0 + r() * (H - y0), rr(r, Wt.streakLen) * k, rr(r, [0.8, 2.6]) * k, 0, 0, 6.2832); x.fill(); }
  x.strokeStyle = Wt.line; x.globalAlpha = Wt.lineAlpha; x.lineWidth = Math.max(1, 1.6 * k); x.beginPath(); x.moveTo(0, y0); x.lineTo(W, y0); x.stroke(); x.restore();
}
function decor(x, r, L, W, H, k, over, M, pad) {                          // el orden fija la secuencia del rng: stains→hatch (papel) primero, intactos
  if (L.stains) stains(x, r, L.stains, W, H, k);
  if (L.hatch) hatch(x, r, L.hatch, W, H, k);
  if (L.bricks) bricks(x, r, L.bricks, W, H, k);
  if (L.grid) grid(x, L.grid, W, H, k);
  if (L.fibers) fibers(x, r, L.fibers, W, H, k, over);
  if (L.creases) creases(x, r, L.creases, W, H, k);
  if (L.ghost) ghost(x, r, L.ghost, W, H, k, M);
  if (L.smudge) smudge(x, r, L.smudge, W, H, k);
  if (L.haze) haze(x, r, L.haze, W, H, k);
  if (L.bokeh) bokeh(x, r, L.bokeh, W, H, k);
  if (L.dims) dims(x, r, L.dims, W, H, k, M);
  if (L.marks) marks(x, r, L.marks, W, H, k);
  if (L.text) texts(x, r, L.text, W, H, k, M, pad);
  if (L.stamps) stamps(x, r, L.stamps, W, H, k, M);
  if (L.specks) specks(x, r, L.specks, W, H, k);
}
function buildLayer(L, W, H, r, mk, M) {
  const PW = Math.round(W * PAD), PH = Math.round(H * PAD), cv = mk(PW, PH), x = cv.getContext('2d'), k = W / 1280;
  decor(x, r, L, PW, PH, k, 1, M, PAD);
  return { cv, PW, PH };
}

// ───────── tinta: máscara de erosión (agujeritos de grano riso, agrupados) y teselas de grano ─────────
function buildErosion(M, W, H, r, mk) {
  const E = M.ink.erosion, w = W + 64, h = H + 64, cv = mk(w, h), x = cv.getContext('2d'), im = x.createImageData(w, h), d = im.data, k = W / 1280;
  const c1 = field(w, h, Math.max(3, E.cell * k), r);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    const cl = clamp((c1[i] - 0.38) * 2.6), a = r() < 0.18 + cl * 0.55 ? (0.35 + r() * 0.65) * clamp(0.3 + cl) : 0;   // sal: más densa donde el campo grueso es alto
    d[p] = d[p + 1] = d[p + 2] = 0; d[p + 3] = a * E.amount * 255;
  }
  x.putImageData(im, 0, 0); return cv;
}
function buildGrain(M, W, H, r, mk) {
  const G = M.grain, w = W + 48, h = H + 48, tiles = [], sc = G.scale ?? 1, screen = (G.mode ?? (M.blend === 'screen' ? 'screen' : 'multiply')) === 'screen';
  const gw = Math.ceil(w / sc), gh = Math.ceil(h / sc);                  // grano a menor resolución (sc > 1): menos entropía para el códec y grano más grueso, estilo riso/película
  for (let n = 0; n < G.tiles; n++) {
    const cv = mk(w, h), x = cv.getContext('2d'), src = sc > 1 ? mk(gw, gh) : cv, sx = src.getContext('2d'), im = sx.createImageData(gw, gh), d = im.data;
    if (screen) for (let p = 0; p < d.length; p += 4) { const v = 255 * G.amount * Math.max(0, r() * 2 - 0.8); d[p] = d[p + 1] = d[p + 2] = v; d[p + 3] = 255; }   // screen: motas claras dispersas sobre negro
    else for (let p = 0; p < d.length; p += 4) { const v = 255 * (1 - G.amount * r() * 1.8); d[p] = d[p + 1] = d[p + 2] = v; d[p + 3] = 255; }   // multiply: oscurece en motas (media ≈ 1 − 0,9·amount)
    sx.putImageData(im, 0, 0);
    if (sc > 1) { x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0, gw, gh, 0, 0, w, h); }
    tiles.push(cv);
  }
  return tiles;
}

// Parpadeo de los tubos (multiplicador de luz ≤ 1, determinista en t): ruido por escalones + zumbido lento + caídas puntuales.
export function flickerAt(M, t) {
  const F = M.ink?.flicker; if (!F) return 1;
  const i = Math.floor(t * F.fps), n = 0.5 + 0.5 * noise1(i * 0.37, 91), hum = 0.5 + 0.5 * Math.sin(t * 6.2832 * (F.hum ?? 1.7)), drop = rng(i * 131 + 7)() < (F.dropout ?? 0.02) ? 1 : 0;
  return 1 - F.amount * (0.55 * n + 0.25 * hum + 1.3 * drop);
}
// Desenfoque barato por pirámide (mitades sucesivas + subida con suavizado): halo de polvo de tiza y de luz de neón.
// halos = [{ lv: nivel (1 = ½ de resolución … 6 = 1/64), a: alfa }]; se compone sobre `out` con `op`.
function drawHalos(out, st, film, halos, op, gain) {
  const mk = (w, h) => film.canvas(w, h), Lmax = Math.max(...halos.map((h) => h.lv)); st.pyr ??= []; st.up ??= {};
  let src = st.ink, w = st.W, h = st.H;
  for (let i = 0; i < Lmax; i++) { w = Math.max(2, w >> 1); h = Math.max(2, h >> 1); const c = (st.pyr[i] ??= mk(w, h)), x = c.getContext('2d'); x.clearRect(0, 0, w, h); x.imageSmoothingEnabled = true; x.drawImage(src, 0, 0, w, h); src = c; }
  out.save(); out.setTransform(1, 0, 0, 1, 0, 0); out.globalCompositeOperation = op; out.imageSmoothingEnabled = true;
  for (const H of halos) {
    let cur = st.pyr[H.lv - 1];
    for (let i = H.lv - 2; i >= 0; i--) { const c = (st.up[H.lv + ':' + i] ??= mk(st.pyr[i].width, st.pyr[i].height)), x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.imageSmoothingEnabled = true; x.drawImage(cur, 0, 0, c.width, c.height); cur = c; }
    out.globalAlpha = Math.min(1, H.a * gain); out.drawImage(cur, 0, 0, st.W, st.H);
  }
  out.restore();
}
// Reflejo en suelo mojado: la capa de tinta espejada bajo el horizonte, con ondulación por bandas y desvanecimiento con la distancia.
function drawReflection(out, st, film, R, k, gain) {
  const W = st.W, H = st.H, yH = Math.round(R.y * H), tc = st.tmp.getContext('2d'), band = Math.max(2, Math.round((R.band ?? 3) * k)), fade = (R.fade ?? 0.22) * H;
  tc.save(); tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(0, 0, W, H); tc.translate(0, 2 * yH); tc.scale(1, -1); tc.drawImage(st.ink, 0, 0); tc.restore();
  out.save(); out.setTransform(1, 0, 0, 1, 0, 0); out.globalCompositeOperation = 'screen';
  for (let y = yH; y < H; y += band) {
    const u = (y - yH) / fade; if (u >= 1) break; out.globalAlpha = R.alpha * gain * (1 - u) ** 1.6;
    const dx = (R.ripple ?? 2) * k * noise1(y / (band * 5), 311) * (0.4 + u); out.drawImage(st.tmp, 0, y, W, Math.min(band, H - y), dx, y, W, Math.min(band, H - y));
  }
  out.restore();
}

// ───────── estado por (medio, seed, tamaño) ─────────
export function mediumState(film, cv) {
  const M = film.medium; if (!M || !film.canvas) return null;
  const W = cv.width, H = cv.height, key = `${M.name}:${M.seed}:${W}x${H}`;
  film._mx ??= new Map(); let st = film._mx.get(key); if (st) return st;
  if (film._mx.size > 6) film._mx.clear();
  const r = rng(M.seed ?? 1), mk = (w, h) => film.canvas(w, h);
  st = { W, H, support: buildSupport(film, M, W, H, r, mk), layers: M.layers.map((L) => ({ L, ...buildLayer(L, W, H, r, mk, M) })), erosion: buildErosion(M, W, H, r, mk), grain: buildGrain(M, W, H, r, mk), ink: mk(W, H), tmp: mk(W, H) };
  st.vig = null; mediumStats.builds++; film._mx.set(key, st); return st;
}

// Desplazamiento de cada capa para una cámara dada (misma ley que applyCam con profundidad = depth): lo usan seek y los tests.
export const layerOffsets = (M, cam, W, H) => M.layers.map((L) => {
  const z = 1 + (cam.z - 1) * L.depth; return { name: L.name, depth: L.depth, over: !!L.over, s: z, dx: cam.x * L.depth, dy: cam.y * L.depth };
});

function drawLayer(out, B, st, l, cam, film) {
  out.save(); out.setTransform(B.a, B.b, B.c, B.d, B.e, B.f);
  applyCam(out, cam, film.width, film.height, l.L.depth);
  const sx = B.a, ox = -((PAD - 1) / 2) * film.width, oy = -((PAD - 1) / 2) * film.height;
  out.drawImage(l.cv, ox, oy, l.PW / sx, l.PH / sx); out.restore();
}
// Fondo: soporte + capas de parallax por detrás (multiply). `cam` = cámara del shot activo.
export function paintBackdrop(out, film, st, cam, B) {
  out.save(); out.setTransform(1, 0, 0, 1, 0, 0); out.globalCompositeOperation = 'source-over'; out.drawImage(st.support, 0, 0); out.restore();
  out.save(); out.globalCompositeOperation = film.medium.blend === 'screen' ? 'screen' : 'multiply';
  for (const l of st.layers) if (!l.L.over) drawLayer(out, B, st, l, cam, film);
  out.restore();
}
// Tinta: erosiona la capa (destination-out con la máscara desplazada), la pasa con temblor por bandas y la compone con multiply,
// más una pasada fantasma desplazada (desregistro). Luego capas en primer plano (polvo, parallax > 1).
export function compositeInk(out, film, st, cam, t, B, animated = true) {   // animated=false (mediciones sin grade): erosión fija y sin temblor → la energía de movimiento mide solo la animación del film
  const M = film.medium, I = M.ink, lc = st.ink.getContext('2d'), W = st.W, H = st.H, k = W / 1280, op = M.blend === 'screen' ? 'screen' : 'multiply', fl = animated ? flickerAt(M, t) : 1;
  if (I.erosion) {
    const i = animated ? Math.floor(t * I.erosion.fps) : 0, r = rng(i * 7919 + 13), ox = Math.floor(r() * 64), oy = Math.floor(r() * 64);
    lc.save(); lc.setTransform(1, 0, 0, 1, 0, 0); lc.globalCompositeOperation = 'destination-out'; lc.drawImage(st.erosion, -ox, -oy); lc.restore();
  }
  const mis = I.misregister;
  out.save(); out.setTransform(1, 0, 0, 1, 0, 0); out.globalCompositeOperation = op;
  if (mis && animated) { out.globalAlpha = mis.alpha * fl; out.drawImage(st.ink, mis.dx * k, mis.dy * k); }
  out.globalAlpha = (I.alpha ?? 1) * fl;
  if (I.jitter && animated) {
    const J = I.jitter, band = Math.max(1, Math.round(J.band * k)), f = Math.floor(t * J.fps), amp = J.amp * k;
    for (let y = 0; y < H; y += band) { const dx = amp * (noise1(y / (band * 9), f * 31 + 5) * 1.2 + (noise1(y / 2 + f, 77) * 0.4)); out.drawImage(st.ink, 0, y, W, Math.min(band, H - y), dx, y, W, Math.min(band, H - y)); }
  } else out.drawImage(st.ink, 0, 0);
  out.restore();
  if (I.halo) drawHalos(out, st, film, I.halo, op, fl);
  if (I.reflection) drawReflection(out, st, film, I.reflection, k, fl);
  out.save(); out.globalCompositeOperation = op;
  for (const l of st.layers) if (l.L.over) drawLayer(out, B, st, l, cam, film);
  out.restore();
}
// Post del medio (solo con grade): grano animado + viñeta cálida. Determinista por fotograma.
export function postMedium(out, film, st, t) {
  const M = film.medium, G = M.grain, W = st.W, H = st.H;
  out.save(); out.setTransform(1, 0, 0, 1, 0, 0);
  if (G && G.amount > 0) { const i = Math.floor(t * G.fps), r = rng(i * 104729 + 31); out.globalCompositeOperation = (G.mode ?? (M.blend === 'screen' ? 'screen' : 'multiply')); out.drawImage(st.grain[i % st.grain.length], -Math.floor(r() * 48), -Math.floor(r() * 48)); }
  const v = M.vignette;
  if (v && v.amount > 0) {
    const [R, Gc, Bc] = rgbOf(v.color), g = out.createRadialGradient(W / 2, H / 2, Math.min(W, H) * v.inner, W / 2, H / 2, Math.hypot(W, H) * 0.56);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, `rgb(${Math.round(lerp(255, R, v.amount * 2.2))},${Math.round(lerp(255, Gc, v.amount * 2.2))},${Math.round(lerp(255, Bc, v.amount * 2.2))})`);
    out.globalCompositeOperation = 'multiply'; out.fillStyle = g; out.fillRect(0, 0, W, H);
  }
  out.restore();
}
// Preparar la capa de tinta para un fotograma: transparente, con la transformación base del seek.
export function beginInk(st, B) { const c = st.ink.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, st.W, st.H); c.setTransform(B.a, B.b, B.c, B.d, B.e, B.f); return c; }

// ───────── utilidades puras para shots ─────────
// Tono de papel (0..1) en (x,y) a partir de ruido de valor determinista: para dibujar «luz» o sombra coherente con el soporte.
export const paperTone = (x, y, seed = 1) => 0.5 + 0.5 * noise1(x * 0.004 + y * 0.0031, seed);
