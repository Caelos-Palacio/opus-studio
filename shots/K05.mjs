import { PARAMS, word, focusOf, since, shake, stack, clamp, lerp } from './K_tipo.mjs';
// K05 · pulso 5 → 6. TO / DO / SE: tres líneas justificadas que llenan el cuadro; las letras CAEN una a una (muelle del estilo, escalonadas).
export default {
  params: PARAMS,
  draw(ctx, t, u, shot, film, api) {
    const S = api.safe, P = api.params, age = since(film, shot, t, 0), [jx, jy] = shake(P, t, 12, 5), st = api.S.motion.stagger * 1.3, boxes = [];
    boxes.push(word(ctx, api, '¿', S.x0 + 56, S.y0 + 135, 180, { color: 'accent', align: 'left', alpha: 0.95 }));
    stack(api, ['TO', 'DO', 'SE'], { width: api.safe.w * 0.78, cy: S.cy, maxH: S.h * 0.8 }).forEach((l, i) => {
      const per = (k) => { const a = age - i * 0.06 - k * st, e = api.spring(a, 'snap'); return { dy: -(1 - e) * 0.9 * l.size, a: clamp(a / 0.03), s: lerp(1.15, 1, clamp(e)) }; };
      boxes.push(word(ctx, api, l.str, l.cx + jx, l.cy + jy, l.size, { per, label: 'TODO' }));
    });
    focusOf(api, boxes, 'pregunta');
  },
};
