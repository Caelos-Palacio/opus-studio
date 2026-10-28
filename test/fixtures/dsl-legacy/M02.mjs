import { seg } from '../engine/core.mjs';
import { drawWorld, drawTicks, drawEq, zEntity, view, X, T } from './M_mundo.mjs';
// Elevar es multiplicar. Dos saltos ×e sobre la recta; la ecuación muta de e^{iπ} a e² = e·e y, al final, de vuelta a e^{iπ} = e·e·… (no se puede).
// Concepto nuevo: «estirar» (cada salto ×e estira la recta). La etiqueta nace pegada al primer arco.
export default {
  entities: { z: zEntity },
  draw(ctx, t, u, shot, film, api) {
    const V = view(film, t), S = api.k * 1.5;
    drawWorld(ctx, api, film, t);
    drawTicks(api, film, t);
    drawEq(api, film, t);
    const fade = 1 - seg(t, 20.2, 21.0);
    // primer arco: foco «salto» + etiqueta «estirar ×e» pegada encima (señalización y contigüidad)
    const a1 = X(V, [1, 0]), b1 = X(V, [Math.E, 0]), apex = V.oy - 4 * S - Math.min(0.22 * (b1 - a1), 86 * S * 1.5);
    const al = seg(t, 11.2, 11.8) * fade;
    if (al > 0.05) { api.focus(a1, apex - 4, b1 - a1, V.oy - apex + 4, 'salto', { weight: 0.6, hollow: 0.6 }); api.text('estirar ×e', (a1 + b1) / 2, apex - 30 * S, { role: 'body', alpha: al, color: 'accent2' }); }
    const a2 = X(V, [Math.E, 0]), b2 = X(V, [Math.E * Math.E, 0]), apex2 = V.oy - 4 * S - Math.min(0.22 * (b2 - a2), 86 * S * 1.5), al2 = seg(t, 15.0, 15.6) * fade;
    if (al2 > 0.05) api.text('×e', (a2 + b2) / 2, apex2 - 28 * S, { role: 'body', alpha: al2, color: 'accent2' });
    // el cuadro se rompe: coral
    api.text(shot.text, film.width / 2, film.height * 0.865, { role: 'h2', alpha: seg(t, 10.0, 11.2) * (1 - seg(t, 16.4, 17.2)) });
    api.text('¿Y multiplicar iπ veces?', film.width / 2, film.height * 0.865, { role: 'h2', color: 'anom', alpha: seg(t, 17.8, 19.2) * fade });
  },
};
