import { PARAMS, word, focusOf, stack, shatter, ring, jolt, clamp, lerp } from './K_tipo.mjs';
// K18 · el GOLPE (hero). Fotograma 0: negativo de todo el cuadro (ROM/PE negro sobre blanco); fotograma 1: rayos lima; después ROM / PE estalla en
// esquirlas con smear temporal real (motionBlur de capa) y canales; sacudida con caída e^-9t y dos anillos de onda de choque (señal `shock`).
export default {
  params: PARAMS,
  draw(ctx, t, u, shot, film, api) {
    const S = api.safe, P = api.params, age = t - shot.t[0], [jx, jy] = jolt(age, 40 * (0.5 + P.shock * 0.5), 9, 18), L = stack(api, ['ROM', 'PE'], { width: S.w * 0.7, cy: S.cy });
    const boxes = [], intact = age < 0.07, uu = (a) => clamp((a - 0.05) / 0.85);
    ctx.save(); ctx.translate(jx, jy);
    if (intact) L.forEach((l, i) => boxes.push(word(ctx, api, l.str, l.cx, l.cy, l.size * 1.08, { split: 46, alpha: 1, label: 'ROMPE' })));
    else {
      const draw = (lctx, tt, sub) => L.forEach((l, i) => shatter(lctx, sub, l.str, l.cx, l.cy, l.size * lerp(1.08, 1, clamp((tt - shot.t[0]) / 0.3)), { u: uu(tt - shot.t[0]), seed: 21 + i, cols: 12, rows: i ? 7 : 5, power: 1.15, fade: 0.9, split: 18 * Math.exp(-(tt - shot.t[0]) * 6) }));
      if (age < 0.4) api.layer({ motionBlur: { shutter: 1, samples: 5 } }, draw); else draw(ctx, t, api);
    }
    ctx.restore();
    const e = clamp(age / 0.55);                                           // ondas de choque
    ring(ctx, api, S.cx, S.cy, 60 + 1250 * api.ease('outExpo', e), 38 * (1 - e) + 2, 'accent', (1 - e) * clamp(P.shock + 0.3, 0, 1));
    const e2 = clamp((age - 0.08) / 0.6); ring(ctx, api, S.cx, S.cy, 40 + 1000 * api.ease('outExpo', e2), 22 * (1 - e2) + 1, 'accent2', (1 - e2) * 0.8);
    focusOf(api, boxes.length ? boxes : [{ x: S.cx - 60, y: S.cy - 60, w: 120, h: 120 }], 'golpe');
    api.impact(0, { frames: 2, mode: 'both', x: S.cx, y: S.cy, color: 'accent', rays: 28 });
  },
};
