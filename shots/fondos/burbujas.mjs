// Capa `codigo` del demo fondos_libres (spec 021 §B): burbujas que suben; el golpe de un impacto las acelera y las enciende.
// Función pura de (ctx, t, E): sin Math.random ni Date; la aleatoriedad sale de rng(E.seed) y todo lo demás de t y de los eventos.
import { rng } from '../../engine/core.mjs';
export default function (ctx, t, E) {
  const R = rng(E.seed), n = E.p.n ?? 46, sacudida = E.pulso('impacto', 0.5), m = Math.min(E.W, E.H);
  ctx.save(); ctx.lineWidth = Math.max(1, m * 0.0025);
  for (let i = 0; i < n; i++) {
    const x0 = R(), r = (0.006 + R() * R() * 0.03) * m, v = 0.04 + R() * 0.09, ph = R(), bal = R() * 6.28;
    const y = 1.1 - ((ph + t * v * (1 + 1.5 * sacudida * 0.15)) % 1.2), x = (x0 + Math.sin(t * 0.7 + bal) * 0.015) * E.W;
    ctx.globalAlpha = Math.min(1, (0.25 + 0.5 * R()) * (E.p.alfa ?? 1) * (1 + sacudida));
    ctx.strokeStyle = E.hex(E.p.color ?? 'ink'); ctx.beginPath(); ctx.arc(x, y * E.H, r * (1 + 0.25 * sacudida), 0, 6.2832); ctx.stroke();
    ctx.globalAlpha *= 0.35; ctx.fillStyle = E.hex(E.p.color ?? 'ink'); ctx.beginPath(); ctx.arc(x - r * 0.3, y * E.H - r * 0.3, r * 0.3, 0, 6.2832); ctx.fill();
  }
  ctx.restore();
}
