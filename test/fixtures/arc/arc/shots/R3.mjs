// Pico (hero): 0,8 s de quietud total → impacto (2 fotogramas, sincronizado con sfx impact) → el punto estalla en un anillo vasto.
// El acento solo vive aquí: significa "lo vasto".
export default {
  draw(ctx, t, u, shot, film, api) {
    const W = film.width, H = film.height, cx = W * 0.5, cy = H * 0.5, s0 = H * 0.12, k = t - shot.t[0] - 0.8;
    if (k < 0) api.morph('dot', 'dot', 0, { x: cx, y: cy, size: s0, label: 'punto' });
    else api.morph('dot', 'ring', Math.min(1, k * 4), { x: cx, y: cy, size: s0 + (1 - Math.exp(-6 * k)) * H * 0.5, color: 'accent', label: 'escala' });
    api.impact(0.8, { x: cx, y: cy, mode: 'both', frames: 2 });
  },
};
