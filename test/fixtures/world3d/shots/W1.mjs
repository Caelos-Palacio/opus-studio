// Fixture world3d: la capa 3D pasa por el mismo grade/post que el 2D (grano, viñeta, bloom del estilo).
// t < 1.5: mitad izquierda 2D plana y mitad derecha 3D plana del mismo rol de paleta → el grano debe cubrir ambas igual.
// t ≥ 1.5: esfera toon a pantalla completa.
const FLAT = { id: 'w1-flat', background: 'paper', fog: false, camera: { fov: 30, dist: 10, target: [0, 0, 0] },
  objects: [{ shape: 'plane', size: [40, 40], pos: [0, 0, 0], color: 'shade', mat: 'flat' }] };
const BALL = { id: 'w1-ball', background: 'paper', fog: false, camera: { fov: 30, dist: 6, target: [0, 0, 0] },
  objects: [{ shape: 'sphere', size: 1, pos: [0, 0, 0], color: 'accent' }] };
export default {
  draw(ctx, t, u, shot, film, api) {
    const W = film.width, H = film.height;
    if (t < 1.5) {
      ctx.fillStyle = api.color('shade'); ctx.fillRect(0, 0, W / 2, H);
      api.world3d(FLAT, { rect: [W / 2, 0, W / 2, H], t, u });
      api.focus(W / 4, H / 4, W / 2, H / 2, 'plano');
    } else {
      api.world3d(BALL, { t, u });
      api.focus(W / 2 - 200, H / 2 - 200, 400, 400, 'esfera');
    }
  },
};
