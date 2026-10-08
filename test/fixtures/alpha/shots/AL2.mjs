// Fixture alpha: un sujeto opaco en el centro y NADA más (fondo vacío): con --alpha las esquinas deben quedar transparentes.
export default {
  draw(ctx, t, u, shot, film, api) {
    const W = film.width, H = film.height;
    ctx.fillStyle = api.color('accent'); ctx.fillRect(W / 2 - 140, H / 2 - 140, 280, 280);
    api.focus(W / 2 - 140, H / 2 - 140, 280, 280, 'cuadrado');
  },
};
