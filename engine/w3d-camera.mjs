// world3d v2 (spec 009): cámara derivada del shot. Puro (sin GL): la usan index.mjs (render), prims.mjs (aviso para el lint) y los tests.
// Un solo horizonte y una sola línea de suelo para las dos capas: el 3D se encuadra con un desplazamiento de lente (lens shift) para que
//   · el pie del sujeto (el punto del suelo bajo `target`) caiga en `groundFy` (fracción del alto de la capa, de arriba abajo; es la
//     línea de suelo del shot: api.ground(fy) o la que declare el shot), y
//   · el horizonte caiga en `horizon` (fracción) — de ahí sale la elevación — o, sin horizonte, la elevación sale de la regla de ángulo
//     de la escala de plano y el horizonte resultante se DEVUELVE para que el 2D dibuje el suyo en el mismo sitio.
// Geometría (T = tan(fov/2), d = dist, ty = altura de target sobre el suelo, el = elevación de la cámara, y en fracción de arriba abajo):
//   ndc↑(horizonte) − ndc↑(pie) = [tan el + ty·cos el / (d + ty·sin el)] / T = 2·(groundFy − horizon)
const RAD = Math.PI / 180;

// Reglas de ángulo por escala de plano (data/vocab.json «shot.scale»; en el rótulo del cine: PG plano general, PM plano medio, PP primer plano).
export const ANGLE_RULES = {
  PG: { range: [8, 20], pref: 14, name: 'PG' }, PM: { range: [5, 15], pref: 9, name: 'PM' }, PP: { range: [3, 12], pref: 6, name: 'PP' },
  heroic: { range: [-12, -4], pref: -7, name: 'contrapicado heroico' },
};
const SCALE = { EWS: 'PG', ELS: 'PG', WS: 'PG', LS: 'PG', MLS: 'PG', PG: 'PG', MS: 'PM', MCU: 'PM', PM: 'PM', CU: 'PP', ECU: 'PP', PP: 'PP' };
export const scaleKey = (s) => SCALE[String(s ?? '').toUpperCase()] ?? null;
// fov vertical (°) ligado a la focal del estilo (depth.focal = distancia focal en × ancho de cuadro, como api.p3)
export const fovFromFocal = (focal, W, H) => (2 * Math.atan((0.5 * H) / (Math.max(0.2, focal) * W))) / RAD;

export function angleCheck(a) {
  if (!a || a.ok) return null;
  return { code: 'w3d.angulo', msg: `w3d.angulo: elevación ${a.el.toFixed(1)}° fuera de la regla ${a.rule} [${a.range[0]}°, ${a.range[1]}°]`, remedy: 'ajustar camera.el/horizon o declarar camera.override:true si es intencional' };
}

// cam = camera de la escena ya fusionada con cam(t) del shot. ctx = { focal, W, H, groundFy }
// → { fov, el, shiftY, horizonY, groundY, angle:{ el, scale, rule, range, ok, override } }
export function resolveCameraInfo(cam, ctx = {}) {
  const W = ctx.W ?? 16, H = ctx.H ?? 9, fov = cam.fov ?? fovFromFocal(ctx.focal ?? 1.2, W, H), T = Math.tan((fov * RAD) / 2);
  const gExp = cam.groundFy ?? ctx.groundFy, d = Math.max(1e-6, cam.dist ?? 10), ty = cam.target?.[1] ?? 0;
  const key = cam.heroic ? 'heroic' : scaleKey(cam.scale), rule = key ? ANGLE_RULES[key] : null;
  const k = (el) => Math.tan(el * RAD) + (ty * Math.cos(el * RAD)) / (d + ty * Math.sin(el * RAD));
  let el, yg = gExp ?? 0.78, horizonY;
  if (cam.horizon != null && gExp != null) {                               // horizonte y suelo declarados ⇒ la elevación sale de la geometría (bisección: k es monótona)
    const want = 2 * (yg - cam.horizon) * T; let lo = -70, hi = 70;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (k(m) < want) lo = m; else hi = m; }
    el = (lo + hi) / 2; horizonY = cam.horizon;
  } else if (cam.horizon != null) {                                        // horizonte (la línea de suelo del 2D) + elevación de la regla ⇒ el pie del sujeto cae donde diga la geometría
    el = cam.el ?? rule?.pref ?? 14; horizonY = cam.horizon; yg = cam.horizon + k(el) / (2 * T);
  } else { el = cam.el ?? rule?.pref ?? 15; horizonY = yg - k(el) / (2 * T); }
  const shiftY = 1 - 2 * yg + k0(ty, el, d) / T;
  const override = !!cam.override, ok = !rule || override || (el >= rule.range[0] - 1e-6 && el <= rule.range[1] + 1e-6);
  return { fov, el, shiftY, horizonY, groundY: yg, angle: { el, scale: key ?? null, rule: rule?.name ?? null, range: rule?.range ?? null, ok, override } };
}
const k0 = (ty, el, d) => (ty * Math.cos(el * RAD)) / (d + ty * Math.sin(el * RAD));
