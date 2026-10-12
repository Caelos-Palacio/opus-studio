// Spec 019 (boceto): degradación DECLARADA del render rápido. Un solo lugar dice qué se pierde en el boceto y por qué; nada se degrada en silencio.
//   OPUS_BOCETO=1 → loadFilm() llama a degradar(film) tras compilar. El boceto NUNCA es un master: film.P.boceto entra en el hash del fotograma y del fragmento,
//   así que no puede mezclarse con la caché del render completo (ni el gate lo acepta como entrega).
// Por capa/objeto: `"boceto": "omitir"` (no se dibuja) o `"boceto": "sin_fx"` (solo objeto DSL `layer`: sus hijos se dibujan sin la capa de fx) en
//   cualquier objeto del .scene.json (propiedad común) y en cualquier capa del medio (styles/medios/*.json → layers[]).
export const DEGRADACION = [
  { que: 'grano del estilo (grade.grain)', por: 'cientos de miles de fillRect por fotograma; no decide un concepto' },
  { que: 'post del estilo: bloom, aberración cromática, color (grade.post)', por: 'copias de pantalla completa y desenfoques; el color final se juzga en el master' },
  { que: 'medio: grano animado, erosión de tinta, temblor por bandas y desregistro', por: 'el soporte, la paleta y las capas siguen; solo se pierde la textura viva de la tinta' },
  { que: 'fx rápidos (OPUS_FXFAST): blur/glow a media resolución', por: 'R3 (spec 009): −45 % ms/fotograma' },
  { que: 'capas del medio y objetos con "boceto": "omitir" / "sin_fx"', por: 'degradación declarada por el autor de la escena' },
];
export const BOCETO_VALORES = ['omitir', 'sin_fx'];
export function degradar(film) {
  film.P = { ...film.P, boceto: true, fxFast: true };
  const g = film.S?.grade; if (g) { g.grain = 0; g.post = {}; }
  const M = film.medium;
  if (M && typeof M === 'object') {
    if (M.grain) M.grain = { ...M.grain, amount: 0, tiles: 1 };
    if (M.ink) { const { erosion, jitter, misregister, ...rest } = M.ink; M.ink = rest; }
    if (Array.isArray(M.layers)) M.layers = M.layers.filter((L) => L.boceto !== 'omitir');
  }
  return film;
}
