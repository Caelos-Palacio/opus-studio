// Morph glifo a glifo entre ecuaciones REALES (MathJax → contornos), luego el potencial se dibuja y una partícula oscila en él.
const EL = String.raw`\frac{d}{dt}\frac{\partial L}{\partial \dot q}=\frac{\partial L}{\partial q}`, NW = String.raw`m\ddot q=-\frac{\partial V}{\partial q}`;
const V = (q) => 0.5 * q * q - 0.08 * q ** 4;
export default {
  draw(ctx, t, u, shot, film, api) {
    const lt = t - shot.t[0], [ex, ey] = api.at(0.5, 0.15);
    api.tex(EL, ex, ey, { size: 74 * api.k, morphTo: NW, u: api.ease('inOut', Math.min(1, Math.max(0, (lt - 0.7) / 1.1))), arc: 0.15, color: 'ink' });
    const ax = api.axes({ ...rect(api), xr: [-2.4, 2.4], yr: [-0.2, 1.8], ticks: 6, u: Math.min(1, (lt - 0.4) / 0.8), ylabel: 'V(q)' });
    api.plot(V, ax, { u: Math.min(1, Math.max(0, (lt - 1.0) / 1.2)), color: 'accent', label: 'potencial' });
    if (lt > 1.8) { const q = 1.6 * Math.cos((lt - 1.8) * 3.2); ctx.fillStyle = api.color('accent2'); ctx.beginPath(); ctx.arc(ax.X(q), ax.Y(V(q)) - 10 * api.k, 10 * api.k, 0, 6.2832); ctx.fill(); api.focus(ax.X(q) - 12, ax.Y(V(q)) - 22, 24, 24, 'partícula', { weight: 0.6 }); }
  },
};
const rect = (api) => ({ x: api.safe.x0 + api.safe.w * 0.2, y: api.safe.y0 + api.safe.h * 0.36, w: api.safe.w * 0.6, h: api.safe.h * 0.58 });
