// Tarjeta con giro 3D real (homografía por malla) que se asienta; detrás, una red de conceptos con layout sembrado.
const N = ['L', 'T', 'V', 'q', 'q̇', 'p', 'H', 'S'], E = [['L', 'T'], ['L', 'V'], ['T', 'q̇'], ['V', 'q'], ['L', 'p'], ['p', 'H'], ['H', 'T'], ['H', 'V'], ['L', 'S']];
export default {
  draw(ctx, t, u, shot, film, api) {
    const lt = t - shot.t[0], s = api.safe;
    api.depth(0.6, () => api.graph({ nodes: N, edges: E, seed: 3, u: Math.min(1, lt / 2.2), r: 9, rect: { x: s.x0 + s.w * 0.05, y: s.y0 + s.h * 0.08, w: s.w * 0.9, h: s.h * 0.84 }, edgeColor: 'shade', hot: ['L'], weight: 0.3, label: 'red' }));
    const ry = 1.05 * (1 - api.spring(lt - 0.2, 'soft')), [cx, cy] = api.at(0.5, 0.5);
    api.card3d({ x: cx, y: cy, w: 520 * api.k, h: 250 * api.k, ry, rx: 0.12 * (1 - api.spring(lt - 0.2, 'soft')), label: 'tarjeta' }, (c, A) => {
      c.fillStyle = A.color('accent2'); c.globalAlpha = 0.55; c.fillRect(cx - 260 * A.k, cy - 125 * A.k, 520 * A.k, 250 * A.k);
      c.globalAlpha = 1; c.strokeStyle = A.color('accent'); c.lineWidth = 3 * A.k; c.strokeRect(cx - 260 * A.k, cy - 125 * A.k, 520 * A.k, 250 * A.k);
      A.tex('L = T - V', cx, cy, { size: 70 * A.k, color: 'ink' });
    });
  },
};
