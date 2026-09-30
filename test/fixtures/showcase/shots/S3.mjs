// Campo de dos masas: flechas (magnitud → color) + líneas de corriente RK4 memorizadas que fluyen con t. La ley se ESCRIBE.
const masses = (film) => { const W = film.width, H = film.height; return [[W * 0.38, H * 0.56, 1], [W * 0.66, H * 0.5, 0.6]]; };
const F = (film) => { const M = masses(film); return (x, y) => M.reduce((a, [mx, my, m]) => { const dx = mx - x, dy = my - y, r2 = dx * dx + dy * dy + 900, r = Math.sqrt(r2); return [a[0] + (m * dx) / (r2 * r), a[1] + (m * dy) / (r2 * r)]; }, [0, 0]); };
export default {
  draw(ctx, t, u, shot, film, api) {
    const lt = t - shot.t[0], s = api.safe, r = { x: s.x0, y: s.y0 + s.h * 0.2, w: s.w, h: s.h * 0.78 }, f = F(film);
    api.field(f, r, { n: 22, u: Math.min(1, lt / 1.2), mag: 1.2e-5, low: 'shade', color: 'accent2' });
    api.streamlines(f, r, { seeds: 36, steps: 160, h: 5, u: Math.min(1, (lt - 0.5) / 1.5), flow: 1, color: 'accent', key: 'S3-sl' });
    for (const [x, y, m] of masses(film)) api.glow(x, y, 60 * m, 'accent', 0.5), api.focus(x - 26 * m, y - 26 * m, 52 * m, 52 * m, 'masa', { weight: m });
    for (const [x, y, m] of masses(film)) { ctx.fillStyle = api.color('ink'); ctx.beginPath(); ctx.arc(x, y, 18 * m, 0, 6.2832); ctx.fill(); }
    api.tex(String.raw`\nabla\cdot\mathbf{g}=-4\pi G\rho`, ...api.at(0.5, 0.08), { size: 72 * api.k, write: Math.min(1, (lt - 0.9) / 1.4), color: 'ink' });
  },
};
