import { TAU, hash2 } from '../engine/core.mjs';
// Scene graph: la luna es hija del planeta, que es hijo de un brazo que gira alrededor del sol. Nadie calcula órbitas a mano.
// Estrellas en 3 capas de profundidad (z): el motor aplica perspectiva, niebla y DOF agrupando cada capa en una sola composición.
const S = (film) => film.shots.find((s) => s.id === 'S2');
const star = (i, W, H) => ({ x: (hash2(i, 1) - 0.5) * W * 1.6, y: (hash2(i, 2) - 0.5) * H * 1.6, draw: (c) => { c.fillStyle = '#E9E6EF'; c.beginPath(); c.arc(0, 0, 1.2 + 2.2 * hash2(i, 3), 0, TAU); c.fill(); } });
const dot = (r, color, focus) => (c, tl, api) => { c.fillStyle = api.color(color); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); if (focus) api.focus(-r, -r, 2 * r, 2 * r, focus.label, { weight: focus.w }); };
export default {
  scene: (t, film) => {
    const s = S(film), lt = t - s.t[0], W = film.width, H = film.height, k = Math.min(W, H) / 1080;
    return { id: 'world', x: W / 2, y: H / 2, children: [
      ...[900, 450, 160].map((z, L) => ({ id: 'stars' + L, z, children: Array.from({ length: 40 }, (_, i) => star(i + L * 100, W, H)) })),
      { id: 'sun', draw: dot(46 * k, 'accent', { label: 'sol', w: 0.45 }), fx: { bloom: { threshold: 0.3, strength: 1.2, radius: 40 } } },
      { id: 'arm', rot: 0.4 + lt * 0.55, children: [
        { id: 'planet', x: 300 * k, rot: -(0.4 + lt * 0.55), draw: dot(22 * k, 'accent2', { label: 'planeta', w: 1 }), children: [
          { id: 'moonArm', fps: 8, rot: lt * 2.4, children: [{ id: 'moon', x: 58 * k, draw: dot(8 * k, 'ink') }] },   // ← a 8 fps: stop-motion dentro del mismo plano
        ] },
      ] },
      { id: 'comet', follow: { id: 'planet', lag: 0.45 }, draw: dot(5 * k, 'ink') },                                     // ← constraint pura: el planeta hace 0.45 s
    ] };
  },
  draw(ctx, t, u, shot, film, api) {
    api.text(shot.text, ...api.at(0.5, 0.06), { role: 'h2', alpha: api.spring(t - shot.t[0] - 0.5), screen: true });
    api.label('LUNA · 8 FPS', [api.safe.x0 + api.safe.w * 0.12, api.safe.y1 - api.safe.h * 0.06], { role: 'label', alpha: api.spring(t - shot.t[0] - 1.2) });
  },
};
