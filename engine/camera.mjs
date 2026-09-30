// Cámara como parte de la explicación. Un shot = UN movimiento, con razón (`why`), curva y límites de velocidad.
//   shot.cam = { move, amount, dir, ease, focus:[fx,fy], why, chain, recenter, shake, whip }
//   move: static | push | pull | slide | pan | tilt | rotate
//   amount: push/pull = fracción de zoom · slide/pan/tilt = fracción del ancho/alto · rotate = grados
//   why: approach | reveal | follow | compare | unease   (enum cerrado: el texto libre no cuenta)
//   delay: segundos quieta al empezar (tras un morph, 0.4–0.8 s: el cuerpo necesita asentar)
//   chain: arranca donde acabó la cámara del shot anterior (sin salto en el corte)
//   recenter: termina en x=0,y=0,rot=0 (aterrizaje) · shake: amplitud handheld (fracción del ancho)
import { ease as EASE, lerp, clamp, noise1, hashStr } from './core.mjs';

function legacy(str) {
  const s = (str || '').toLowerCase(), m = /(\d+(?:\.\d+)?)\s*(%|°|deg)/.exec(s), amt = m ? +m[1] / (m[2] === '%' ? 100 : 1) : null;
  if (/push-out|pull|dolly-out|zoom-out/.test(s)) return { move: 'pull', amount: amt };
  if (/push|dolly-in|zoom-in/.test(s)) return { move: 'push', amount: amt };
  if (/rotate|roll|dutch/.test(s)) return { move: 'rotate', amount: amt };
  if (/tilt/.test(s)) return { move: 'tilt', dir: /down/.test(s) ? [0, 1] : [0, -1], amount: amt };
  if (/slide|truck|pan/.test(s)) return { move: 'slide', dir: /right/.test(s) ? [1, 0] : /up/.test(s) ? [0, -1] : /down/.test(s) ? [0, 1] : [-1, 0], amount: amt };
  return { move: 'static' };
}
export function specOf(shot, film) {
  const C = film.S.camera, raw = shot.cam ?? legacy(shot.camera), move = raw.move ?? 'static';
  const dir = raw.dir ?? (move === 'tilt' ? [0, -1] : [-1, 0]);
  const amount = raw.amount ?? (move === 'rotate' ? 3 : ['slide', 'pan', 'tilt'].includes(move) ? C.slide ?? C.amount : C.amount);
  return { move, dir, amount, ease: raw.ease ?? C.ease, focus: raw.focus ?? [0.5, 0.5], why: raw.why ?? (move === 'auto' ? 'follow' : undefined), chain: !!raw.chain, recenter: !!raw.recenter, shake: raw.shake ?? C.shake ?? 0, whip: !!raw.whip, delay: raw.delay ?? 0 };
}
const ID = { z: 1, x: 0, y: 0, r: 0 };
// cam.move 'auto': trayectoria horneada por engine/autocam.mjs (mínimos cuadrados regularizados sobre los focos del shot).
function autoAt(shot, film, t) {
  const A = film.autocam?.[shot.id]; if (!A) return { ...ID };
  const S = A.samples, f = (t - S[0][0]) * A.fps, i = Math.max(0, Math.min(S.length - 2, Math.floor(f))), u = clamp(f - i), n = S.length - 1;
  // Catmull-Rom: C¹ y derivada en cada muestra = diferencia central → la velocidad pico ≈ la verificada al hornear
  // (smoothstep entre muestras la multiplicaría por 1.5 y rompería los límites del estilo).
  const P0 = S[Math.max(0, i - 1)], P1 = S[i], P2 = S[i + 1], P3 = S[Math.min(n, i + 2)], u2 = u * u, u3 = u2 * u;
  const h = (p) => 0.5 * (2 * P1[p] + (-P0[p] + P2[p]) * u + (2 * P0[p] - 5 * P1[p] + 4 * P2[p] - P3[p]) * u2 + (-P0[p] + 3 * P1[p] - 3 * P2[p] + P3[p]) * u3);
  return { z: h(1), x: h(2) * film.width, y: h(3) * film.height, r: 0 };
}
export function camEnds(shot, film) {
  const sp = specOf(shot, film), W = film.width, H = film.height;
  if (sp.move === 'auto') return { a: autoAt(shot, film, shot.t[0]), b: autoAt(shot, film, shot.t[1]), sp };
  let a = { ...ID };
  if (sp.chain) { const i = film.shots.indexOf(shot); if (i > 0) a = { ...camEnds(film.shots[i - 1], film).b }; }
  const b = { ...a };
  switch (sp.move) {
    case 'push': b.z = a.z * (1 + sp.amount); break;
    case 'pull': if (sp.chain) b.z = a.z / (1 + sp.amount); else { a.z = 1 + sp.amount; b.z = 1; } break;
    case 'slide': case 'pan': case 'tilt': b.x = a.x + sp.dir[0] * sp.amount * W; b.y = a.y + sp.dir[1] * sp.amount * H; break;
    case 'rotate': b.r = a.r + sp.amount; break;
  }
  if (sp.recenter) { b.x = 0; b.y = 0; b.r = 0; }
  return { a, b, sp };
}
export function camState(shot, t, film, { shake = true } = {}) {
  if (shot.cam?.move === 'auto') { const c = autoAt(shot, film, t); return { ...c, fx: 0.5, fy: 0.5 }; }
  const { a, b, sp } = camEnds(shot, film), u = clamp((t - shot.t[0] - sp.delay) / Math.max(1e-4, shot.t[1] - shot.t[0] - sp.delay));
  const e = (EASE[sp.ease] || EASE.inOut)(u);
  let z = lerp(a.z, b.z, e), x = lerp(a.x, b.x, e), y = lerp(a.y, b.y, e), r = lerp(a.r, b.r, e);
  if (shake && sp.shake > 0) {
    const sd = hashStr(shot.id), f = film.S.camera.shakeHz ?? 1.3;
    x += sp.shake * film.width * noise1(t * f, sd); y += sp.shake * film.width * noise1(t * f * 1.1, sd + 7); r += sp.shake * 20 * noise1(t * f * 0.7, sd + 13);
  }
  return { z, x, y, r, fx: sp.focus[0], fy: sp.focus[1] };
}
// depth: 0 = fondo lejano (casi no se mueve) · 1 = plano del sujeto · >1 = primer plano (parallax)
export function applyCam(ctx, cam, W, H, depth = 1) {
  const z = 1 + (cam.z - 1) * depth, r = (cam.r * depth * Math.PI) / 180;
  ctx.translate(cam.fx * W + cam.x * depth, cam.fy * H + cam.y * depth);
  if (r) ctx.rotate(r);
  ctx.scale(z, z);
  ctx.translate(-(cam.tx != null ? cam.fx * W + (cam.tx - cam.fx * W) * depth : cam.fx * W), -(cam.ty != null ? cam.fy * H + (cam.ty - cam.fy * H) * depth : cam.fy * H));
}
// Velocidades pico (por segundo) muestreando la curva real, sin handheld.
export function camStats(shot, film) {
  const dt = 1 / 120, W = film.width, H = film.height; let zr = 0, pan = 0, rot = 0, prev = camState(shot, shot.t[0], film, { shake: false });
  for (let t = shot.t[0] + dt; t <= shot.t[1] + 1e-9; t += dt) {
    const c = camState(shot, t, film, { shake: false });
    zr = Math.max(zr, Math.abs(c.z - prev.z) / prev.z / dt); pan = Math.max(pan, Math.max(Math.abs(c.x - prev.x) / W, Math.abs(c.y - prev.y) / H) / dt); rot = Math.max(rot, Math.abs(c.r - prev.r) / dt);
    prev = c;
  }
  return { zoomPerSec: zr, panPerSec: pan, rotPerSec: rot };
}
