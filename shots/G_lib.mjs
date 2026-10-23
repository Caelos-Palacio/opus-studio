import { bezier, TAU, clamp } from '../engine/core.mjs';
// Demo del README: UNA funcion de t, periodica (T = 8 s) => bucle sin costura.
// La curva respira, el punto la recorre con la curva de easing que se dibuja a la derecha, el HUD lee el mismo t.
const T = 8, EASE = [0.65, 0, 0.35, 1], ease = bezier(...EASE);
const cub = (P, s) => { const m = 1 - s; return [0, 1].map((i) => m * m * m * P[0][i] + 3 * m * m * s * P[1][i] + 3 * m * s * s * P[2][i] + s * s * s * P[3][i]); };
const d = (P) => `M${P[0]} C${P[1]} ${P[2]} ${P[3]}`.replace(/,/g, ' ');
export function demo(ctx, t, shot, film, api) {
  const p = (t % T) / T, tri = 1 - Math.abs(1 - 2 * p), s = ease(tri), ph = TAU * p, frame = Math.round(t * film.fps) % (T * film.fps);
  const sf = api.safe, X0 = 70, X1 = 520, Y0 = 175, Y1 = 335;
  // ── fondo: rejilla de cruces (parallax 0.25)
  api.depth(0.25, () => {
    ctx.fillStyle = api.color('shade'); ctx.globalAlpha = 0.28;
    for (let i = 0; i <= 16; i++) for (let j = 0; j <= 9; j++) ctx.fillRect(i * 50 - 1, j * 50 - 1, 2, 2);
    ctx.globalAlpha = 1;
  });
  // ── curva Bezier cubica con respiracion periodica
  const P = [[X0, Y1], [X0 + 90 + 40 * Math.sin(ph), Y0 - 20 + 20 * Math.cos(ph)], [X1 - 120 - 40 * Math.cos(ph), Y1 + 15 - 30 * Math.sin(ph)], [X1, Y0]];
  ctx.save(); ctx.strokeStyle = api.color('shade'); ctx.globalAlpha = 0.55; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
  ctx.beginPath(); ctx.moveTo(...P[0]); ctx.lineTo(...P[1]); ctx.moveTo(...P[3]); ctx.lineTo(...P[2]); ctx.stroke(); ctx.restore();
  api.path(d(P), { stroke: 'accent', lw: 5, label: 'curva', weight: 0.5 });
  ctx.save(); ctx.strokeStyle = api.color('shade'); ctx.fillStyle = api.color('paper'); ctx.lineWidth = 1.5;
  P.forEach(([x, y], i) => { ctx.beginPath(); ctx.arc(x, y, i % 3 ? 3.5 : 4.5, 0, TAU); ctx.fill(); ctx.stroke(); }); ctx.restore();
  // ── el punto: pasa por una capa con bloom y estela de motion blur (compositor)
  const [dx, dy] = cub(P, s);
  api.layer({ bloom: { threshold: 0.5, strength: 0.9, radius: 10 }, motionBlur: { shutter: 0.6, samples: 5 } }, (c, tt, A) => {
    const q = (tt % T) / T, [qx, qy] = cub(P, ease(1 - Math.abs(1 - 2 * q)));
    c.fillStyle = A.color('ink'); c.beginPath(); c.arc(qx, qy, 6, 0, TAU); c.fill();
  });
  api.focus(dx - 8, dy - 8, 16, 16, 'punto', { weight: 1 });
  // ── curva de easing: el mismo tipo de Bezier, con su marcador
  const ex = 570, ey = 170, ew = 130, eh = 130, E = [[ex, ey + eh], [ex + EASE[0] * ew, ey + eh - EASE[1] * eh], [ex + EASE[2] * ew, ey + eh - EASE[3] * eh], [ex + ew, ey]];
  ctx.save(); ctx.strokeStyle = api.color('shade'); ctx.globalAlpha = 0.5; ctx.lineWidth = 1; ctx.strokeRect(ex, ey, ew, eh); ctx.restore();
  api.path(d(E), { stroke: 'accent2', lw: 3, focus: false });
  const mx = ex + tri * ew, my = ey + eh - s * eh;
  ctx.save(); ctx.strokeStyle = api.color('shade'); ctx.globalAlpha = 0.6; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
  ctx.beginPath(); ctx.moveTo(mx, ey + eh); ctx.lineTo(mx, my); ctx.lineTo(ex, my); ctx.stroke(); ctx.restore();
  ctx.fillStyle = api.color('ink'); ctx.beginPath(); ctx.arc(mx, my, 4, 0, TAU); ctx.fill();
  api.text('ease .65 0 .35 1', ex, ey + eh + 18, { role: 'label', size: 12, color: 'shade', align: 'left' });
  // ── TeX real (MathJax -> contornos), en pantalla
  api.tex(String.raw`B(s)=\sum_{i=0}^{3}\binom{3}{i}(1-s)^{3-i}s^{i}P_i`, 705, 66, { size: 13, align: 'right', color: 'shade', screen: true });
  // ── scrubber: un tick por fotograma; el playhead es t
  const sx0 = 70, sx1 = 715, sy = 384;
  ctx.save(); ctx.fillStyle = api.color('shade');
  for (let i = 0; i <= T * film.fps; i++) { const x = sx0 + (i / (T * film.fps)) * (sx1 - sx0), M = i % film.fps === 0; ctx.globalAlpha = M ? 0.9 : 0.35; ctx.fillRect(x - 0.5, sy - (M ? 7 : 3), 1, M ? 14 : 6); }
  ctx.restore();
  const px = sx0 + p * (sx1 - sx0);
  ctx.fillStyle = api.color('accent'); ctx.fillRect(px - 1, sy - 12, 2, 24);
  // ── HUD (screen: no lo mueve la camara)
  api.text('seek(t)', 70, 62, { role: 'h1', color: 'ink', align: 'left', screen: true });
  api.text('every frame is a pure function of time', 70, 92, { role: 'label', size: 13, color: 'shade', align: 'left', screen: true });
  api.text('0', sx0, sy + 18, { role: 'label', size: 12, color: 'shade', align: 'left' });
  api.text('8 s', sx1, sy + 18, { role: 'label', size: 12, color: 'shade', align: 'right' });
}
