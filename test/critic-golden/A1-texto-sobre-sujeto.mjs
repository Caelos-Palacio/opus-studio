// Defecto inyectado (set dorado del crítico): rótulo grande encima del sujeto.
import A1 from '../../shots/A1.mjs';
export default { ...A1, draw(ctx, t, u, shot, film, api) { A1.draw(ctx, t, u, shot, film, api); const [x, y] = api.at(0.5, 0.55); api.text('UNA IDEA', x, y, { role: 'h1' }); } };
