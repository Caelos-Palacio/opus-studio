import { seg, TAU } from '../engine/core.mjs';
import { drawWorld, drawTicks, drawEq, zEntity, view, X, Y, cis } from './M_mundo.mjs';
// Media vuelta. El ángulo de π (violeta) sobre la semicircunferencia y la ecuación que lo declara: e^{iπ} = −1 y e^{iπ} + 1 = 0.
// Concepto nuevo: «media vuelta», pegado al arco indicador.
export default {
  entities: { z: zEntity },
  draw(ctx, t, u, shot, film, api) {
    const V = view(film, t), S = api.k * 1.5, r = 0.36 * V.u, p = seg(t, 73.0, 75.4);
    drawWorld(ctx, api, film, t);
    drawTicks(api, film, t);
    drawEq(api, film, t);
    if (p > 0) {   // el ángulo recorrido, de 0 a π, alrededor del origen
      const n = Math.max(2, Math.ceil(p * 80)); ctx.save(); ctx.strokeStyle = api.color('quant'); ctx.lineWidth = 2.2 * api.k; ctx.globalAlpha = 0.9 * (1 - seg(t, 80.0, 81.0)); ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i <= n; i++) { const c = cis(Math.PI * p * i / n, 0.36); const x = X(V, c), y = Y(V, c); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke(); ctx.restore();
    }
    const al = seg(t, 73.0, 73.8) * (1 - seg(t, 79.4, 80.6));
    if (al > 0.05) { api.focus(V.ox - 60 * S, V.oy - r - 5 * S, 120 * S, 10 * S, 'arco', { weight: 0.6, hollow: 0.5 }); api.text('media vuelta', V.ox, V.oy - r - 52 * S, { role: 'body', alpha: al, color: 'quant' }); }
    void TAU; void shot;
  },
};
