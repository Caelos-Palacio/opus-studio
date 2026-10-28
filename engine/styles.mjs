// Estilo = datos. Puro (navegador + Node). Un pack de styles/*.json se fusiona sobre DEFAULTS y los overrides del timeline.
import { contrast, oklch } from './color.mjs';

export const DEFAULTS = {
  name: 'default', description: '', defaultProfile: 'reel',
  palette: { paper: '#F4EFE6', ink: '#141414', accent: '#E23D28', accent2: '#2F5D8A', shade: '#C9BBA8' },
  typeface: { family: 'Helvetica', fallback: 'sans-serif', mono: 'Courier New', weights: [500, 800], scale: 1.5, base: 34, case: 'none', tracking: 0, files: [] },
  motion: { spring: { omega: 14, zeta: 0.62 }, ease: 'inOut', stagger: 0.06, stepFps: 0, smear: 0 },   // stepFps>0 = stop-motion · smear = estirado (0.04–0.08)
  camera: { amount: 0.08, slide: 0.05, ease: 'inOut', maxZoomPerSec: 0.25, maxPanPerSec: 0.5, maxRotPerSec: 8, shake: 0, shakeHz: 1.3, maxShake: 0.004 },
  grade: { vignette: 0, grain: 0, letterbox: 0, fade: { in: 0, out: 0, color: 'ink' }, barColor: '#000000', post: {} },   // post: { bloom:{threshold,strength,radius}, chroma:px, color:{lift,gamma,gain,temp,sat,dither} }
  depth: { focal: 1.2, fog: 0, dof: 0, focusZ: 0 },                   // 2.5D: focal (×ancho), niebla por z, desenfoque por |z−focusZ|
  light: { enabled: false, az: 135, shadow: 0.18, highlight: 0.3 },   // luz como vector: az° (135 = arriba-izquierda), sombra de contacto y brillo de borde
  // world3d (spec 004): el estilo manda sobre el 3D. shading: toon (bandas) | soft (lambert suave) | ink (hatching); contorno con la tinta del 2D (grosor ×k como api.path lw 3);
  // snap = fuerza de la cuantización suave a la paleta (null = por modo: toon .8, soft .25, ink .7); la luz clave sale de `light.az` (la misma del 2D); ssaa = supermuestreo; motionBlur: {samples, shutter} | null
  // v2 (spec 009): shadows = sombras proyectadas (shadow map; toon = bandas duras, soft/ink = PCF) · shadowMap = resolución · shadowStrength 0..1 · ao = oclusión de contacto 0..1 (0 = off)
  // rim = luz de borde {color, strength, width px} | false · groundLit = charco de luz del suelo 0..1 · bloom = bloom de los emisivos por el post 2D (fx.bloom). shadows:false + ao:0 + rim:false = v1.
  world3d: { shading: 'toon', bands: 3, outline: { width: 3, color: 'ink' }, snap: null, ssaa: 2, shadowMix: 0.55, light: { el: 28 }, contact: 0.5, hatch: 6, motionBlur: null,
    shadows: true, shadowMap: 2048, shadowStrength: 0.8, ao: 0.5, rim: { color: 'accent', strength: 0.85, width: 3 }, groundLit: 0.12, bloom: false },
  compose: { edgeMargin: 0.04, anchor: 'thirds', anchorTol: 0.14, negativeSpace: 0.4 },
  rules: { glow: false, gradients: false, maxColors: 6, maxChroma: 0.22 }, // popRatio: umbral de picos de movimiento (por defecto el del perfil)
  bans: ['crossfade', 'blur-in', 'brightness', '3d flip', 'flip'],
};
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
export function deepMerge(a, b) {
  if (!isObj(a) || !isObj(b)) return b === undefined ? a : b;
  const o = { ...a };
  for (const k of Object.keys(b)) o[k] = isObj(a[k]) && isObj(b[k]) ? deepMerge(a[k], b[k]) : b[k];
  return o;
}
export function resolveStyle(pack, film = {}) {
  let S = deepMerge(DEFAULTS, pack);
  S = deepMerge(S, film.styleOverrides ?? {});
  if (film.palette) S = deepMerge(S, { palette: film.palette });      // compat opus-studio 2
  if (film.typeface) S = deepMerge(S, { typeface: film.typeface });
  return S;
}
// Reglas de gusto sobre la paleta. Las usan `lint` y `style.mjs --check`.
export function checkPalette(S) {
  const out = [], P = S.palette, add = (level, problem, remedy) => out.push({ level, problem, remedy });
  const ci = contrast(P.ink, P.paper);
  if (ci < 4.5) add('FIX', `contraste tinta/papel ${ci.toFixed(1)}:1 < 4.5`, 'oscurecer tinta o aclarar papel');
  else if (ci < 7) add('WARN', `contraste tinta/papel ${ci.toFixed(1)}:1 < 7`, 'subir contraste si hay texto pequeño');
  for (const k of Object.keys(P)) {
    if (k === 'paper' || k === 'ink' || k === 'shade') continue;
    const c = contrast(P[k], P.paper); if (c < 3) add('WARN', `"${k}" ${P[k]} contra papel ${c.toFixed(1)}:1 < 3`, 'cambiar luminosidad del acento');
    const ch = oklch(P[k]).C; if (ch > S.rules.maxChroma) add('WARN', `"${k}" croma ${ch.toFixed(2)} > ${S.rules.maxChroma}`, 'bajar saturación (vibra sobre fondo neutro)');
  }
  if (Object.keys(P).length > S.rules.maxColors) add('WARN', `${Object.keys(P).length} colores > ${S.rules.maxColors}`, 'reducir la paleta');
  if (/^#(000000|ffffff)$/i.test(P.paper)) add('WARN', `papel ${P.paper} puro`, 'oscuro: L≈0.06–0.16 · claro: L≈0.95–0.97, ambos teñidos');
  return out;
}
