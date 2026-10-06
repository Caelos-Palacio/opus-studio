// Fixture world3d v2: suelo del shot (api.ground) + escena 3D con camera.fromShot y elevación 40° en plano general (fuera de regla, sin override).
const SC = { id: 'w2a', background: 'paper', fog: { density: 0.01 }, camera: { fromShot: true, el: 40, dist: 20 }, ground: { color: 'shade', contact: true },
  objects: [{ shape: 'box', size: [2, 3, 2], pos: [0, 1.5, 0], color: 'accent' }] };
export default {
  draw(ctx, t, u, shot, film, api) {
    api.ground(0.8);
    api.world3d(SC, { t, u });
    api.focus(film.width / 2 - 150, film.height / 2 - 200, 300, 400, 'caja');
  },
};
