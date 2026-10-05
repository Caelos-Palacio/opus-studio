// Defecto inyectado: el plano entero se desplaza a la derecha; el marco toca/corta el borde.
import A3 from '../../shots/A3.mjs';
export default { ...A3, draw(ctx, t, u, shot, film, api) { ctx.save(); ctx.translate(film.width * 0.42, 0); A3.draw(ctx, t, u, shot, film, api); ctx.restore(); } };
