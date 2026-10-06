import { PARAMS, word, focusOf, since, pop, shake, glitch, stack } from './K_tipo.mjs';
// K03 · pulsos 2 → 4. SUE / NA, cartel justificado: entra a golpe y tiembla; en el 2.º pulso estalla en tiras y canales (glitch que cae con e^-9t).
export default {
  params: PARAMS,
  draw(ctx, t, u, shot, film, api) {
    const S = api.safe, P = api.params, a0 = since(film, shot, t, 0), a1 = since(film, shot, t, 1), p = pop(api, a0, { from: 1.1 }), [jx, jy] = shake(P, t, 18, 3), burst = a1 >= 0 ? Math.exp(-a1 * 9) : 0;
    const q = word(ctx, api, '¿', S.x0 + 56, S.y0 + 135, 220, { color: 'accent', align: 'left', alpha: 0.95 });
    const L = stack(api, ['SUE', 'NA'], { width: api.safe.w * 0.78, cy: S.cy + 90 }), boxes = [q];
    L.forEach((l, i) => { const g = glitch(P, t, l.size, 3 + i); boxes.push(word(ctx, api, l.str, l.cx + jx * (i ? -1 : 1), l.cy + jy, l.size * p.s * (1 + 0.035 * P.kick + 0.05 * burst), { label: 'SUENA', slice: { ...g, amp: g.amp * (1 + 0.5 * burst) + l.size * 0.16 * burst }, split: 10 * P.chaos * (0.3 + P.snare) + 36 * burst })); });
    focusOf(api, boxes, 'pregunta');
  },
};
