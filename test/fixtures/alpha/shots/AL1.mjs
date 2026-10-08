// Fixture alpha: un sujeto opaco en el centro y NADA más (fondo vacío): con --alpha las esquinas deben quedar transparentes.
export default {
  draw(ctx, t, u, shot, film, api) {
    const W = film.width, H = film.height;
    ctx.fillStyle = api.color('accent'); ctx.beginPath(); ctx.arc(W / 2, H / 2, 140, 0, Math.PI * 2); ctx.fill();
    api.focus(W / 2 - 140, H / 2 - 140, 280, 280, 'círculo');
  },
};
