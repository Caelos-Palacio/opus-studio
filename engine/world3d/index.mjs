// world3d: 3D como CAPA del compositor 2D (docs/specs/004-world3d.md). Interfaz aislada del backend (hoy headless-gl + three).
//   const w3 = createWorld3d();  w3.available / w3.reason / w3.sig()
//   w3.render(scene, o) → { width, height, data: Uint8ClampedArray RGBA (arriba→abajo), cached }
// scene = DATOS (nada de GL): { id, background, fog, ground, camera, objects:[…] } — ver docs/API.md (api.world3d).
// o = { size:[w,h], style: S (estilo resuelto), t, u, fps, k (escala de dispositivo), cam, overrides, step, ssaa, motionBlur, transparent, cache }
//   cam / overrides pueden ser funciones de t: así `step` (twos) y el motion blur muestrean el MISMO movimiento que el 2D.
// El estilo manda: paleta, luz clave (S.light.az), contorno (grosor/color de tinta) y modo de sombreado salen de S, no de la escena.
import { backendSig, loadBackend } from './backend-gl.mjs';
import { assertScene } from '../inputs.mjs';
import { resolveCameraInfo, fovFromFocal } from './camera.mjs';

const CAM0 = { fov: 34, near: 0.5, far: 4000, target: [0, 0, 0], dist: 10, az: 0, el: 15, roll: 0 };
const W3_DEF = { shading: 'toon', bands: 3, outline: { width: 3, color: 'ink' }, snap: null, ssaa: 2, shadowMix: 0.55, light: { el: 28 }, contact: 0.5, hatch: 6,
  // v2 (spec 009): shadows=false + ao=0 + rim=false reproduce v1 bit a bit
  shadows: true, shadowMap: 2048, shadowStrength: 0.8, ao: 0.5, rim: { color: 'accent', strength: 0.85 }, groundLit: 0.12 };
const merge = (a, b) => ({ ...a, ...Object.fromEntries(Object.entries(b ?? {}).filter(([, v]) => v !== undefined)) });
const hexRGB = (h) => { h = String(h).replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };
// fondo declarado → paradas verticales [[r,g,b]…] (≤ 8, de arriba abajo) si es degradado; null si es plano. sample = paradas muestreadas del 2D (api.world3d).
function bgStopsOf(bg, palette, sample) {
  const col = (c) => hexRGB(palette[c] ?? c);
  if (sample?.length > 1) return sample.slice(0, 8).map((c) => (typeof c === 'string' ? col(c) : c.map((v) => v / 255)));
  if (bg && typeof bg === 'object') { if (Array.isArray(bg.stops)) return bg.stops.slice(0, 8).map((x) => col(Array.isArray(x) ? x[1] : x)); if (bg.top && bg.bottom) return [col(bg.top), col(bg.bottom)]; }
  return null;
}
const stepT = (t, step, fps) => (step > 1 && fps ? Math.floor(t * fps / step + 1e-6) * step / fps : t);

export function createWorld3d() {
  let be = null, reason = null, tried = false;
  const probe = () => {
    if (tried) return; tried = true;
    if (process.env.OPUS_W3D_DISABLE === '1') { reason = 'desactivado por OPUS_W3D_DISABLE=1'; return; }
    const r = loadBackend(); if (r.error) reason = r.error; else be = r;
  };
  const serials = new WeakMap(); let serial = 0;
  const cache = new Map();

  const api = {
    get available() { probe(); return !!be; },
    get reason() { probe(); return reason; },
    sig: () => backendSig(),
    render(scene, o = {}) {
      assertScene(scene);
      probe(); if (!be) throw new Error(`world3d no disponible: ${reason}`);
      const S = o.style, W3 = { ...W3_DEF, ...(S.world3d ?? {}), outline: S.world3d?.outline === false ? false : merge(W3_DEF.outline, S.world3d?.outline), light: merge(W3_DEF.light, S.world3d?.light) };
      const [W, H] = o.size, fps = o.fps ?? 30, step = o.step ?? 0, t3 = stepT(o.t ?? 0, step, fps), mask = o.pass === 'emissive', ss = mask ? 1 : (o.ssaa ?? W3.ssaa);
      const mb = mask ? null : (o.motionBlur ?? W3.motionBlur ?? null), n = mb ? Math.max(1, mb.samples ?? 4) : 1, shutter = mb?.shutter ?? 0.5;
      const ev = (v, tt) => (typeof v === 'function' ? v(tt) : v);
      if (!serials.has(scene)) serials.set(scene, ++serial);
      const key = o.cache === false ? null : JSON.stringify([serials.get(scene), W, H, t3, ss, !!o.transparent, n, shutter, o.k, ev(o.cam, t3), ev(o.overrides, t3), S.palette, S.light?.az, W3, step, o.pass, ev(o.groundFy, t3), o.unitH, o.bgSample, S.depth?.focal]);
      if (key && cache.has(key)) { const c = cache.get(key); cache.delete(key); cache.set(key, c); return { ...c, cached: true }; }
      const light = S.light?.az ?? 135, laz = ((W3.light.az ?? light) * Math.PI) / 180, lel = (W3.light.el * Math.PI) / 180;
      const lightDir = { x: Math.cos(laz) * Math.cos(lel), y: Math.sin(laz) * Math.cos(lel), z: Math.sin(lel) };
      const fxOn = { shadow: W3.shadows !== false, ao: (W3.ao ?? 0) > 0, rim: !!W3.rim && (W3.rim.strength ?? 1) > 0 };
      const bgStops = bgStopsOf(scene.background, S.palette, o.bgSample), catcher = !!(scene.ground && scene.ground.catcher);
      let info = null;
      const resolveCam = (tt, withDyn = true) => {
        const cam = merge(merge(CAM0, scene.camera), withDyn ? ev(o.cam, tt) : undefined); cam.target = [...(cam.target ?? CAM0.target)];
        if (scene.camera?.fromShot) {
          const userEl = (withDyn ? ev(o.cam, tt)?.el : undefined) ?? scene.camera.el, ctx = { focal: o.focal ?? S.depth?.focal ?? 1.2, W: o.unitW ?? W, H: o.unitH ?? H, groundFy: ev(o.groundFy, tt) ?? scene.camera.groundY };
          if (cam.nearK) { cam.near = cam.dist * cam.nearK; cam.far = cam.dist * (cam.farK ?? 40); }
          if (cam.ppm) { const fv = cam.fov ?? fovFromFocal(ctx.focal, ctx.W, ctx.H); cam.dist = (o.unitH ?? H) / (2 * Math.tan((fv * Math.PI) / 360) * cam.ppm); }
          const r = resolveCameraInfo({ ...cam, el: userEl, scale: cam.scale ?? o.scale, override: cam.override ?? o.override }, ctx);
          cam.fov = r.fov; cam.el = r.el; cam.shiftY = r.shiftY; if (withDyn) info = { el: r.el, fov: r.fov, horizonY: r.horizonY, groundY: r.groundY, angle: r.angle, dist: cam.dist };
        }
        return cam;
      };
      const one = (tt) => {
        const cam = resolveCam(tt);
        let fogD = 0; const f = scene.fog; if (f !== false) { if (typeof f === 'number') fogD = f; else if (f?.density != null) fogD = f.density; else fogD = 1.8 / (f?.far ?? cam.dist * 6); }
        const k = o.k ?? Math.min(W, H) / 1080, line = W3.outline;
        const THREE = be.THREE, refCam = resolveCam(t3, false);
        return be.renderFrame(scene, {
          size: [W, H], ss, alpha: !!o.transparent, palette: S.palette, shading: W3.shading, outlineOn: line !== false, outlineColor: line?.color ?? 'ink', outlinePx: (line?.width ?? 0) * k,
          buildKey: JSON.stringify([S.palette, W3.shading, line !== false]), bands: W3.bands, snap: W3.snap ?? { toon: 0.8, soft: 0.25, ink: 0.7 }[W3.shading] ?? 0.7, hatchPx: W3.hatch * k * 2, shadowMix: W3.shadowMix, contactAlpha: W3.contact,
          lightDir: new THREE.Vector3(lightDir.x, lightDir.y, lightDir.z).normalize(), fogDensity: fogD, cam, overrides: ev(o.overrides, tt),
          fx: { ...fxOn, grad: !!bgStops, hard: W3.shading === 'toon', catcher }, bgStops, pass: o.pass, unitH: o.unitH, refCam: { az: refCam.az, el: refCam.el, roll: 0, target: refCam.target },
          ao: W3.ao ?? 0, rim: W3.rim || null, rimPx: (W3.rim?.width ?? 3) * k, shadowMap: W3.shadowMap, shadowStrength: W3.shadowStrength, groundLit: scene.ground?.lit ?? W3.groundLit, hardShadow: W3.shading === 'toon',
        });
      };
      let out;
      if (n <= 1) out = one(t3);
      else {                                                                  // motion blur: n subfotogramas hacia atrás dentro del obturador (como api.layer)
        const acc = new Uint32Array(W * H * 4); let first = null;
        for (let i = 0; i < n; i++) { const r = one(t3 - (shutter / fps) * (i / (n - 1))); first ??= r; for (let j = 0; j < acc.length; j++) acc[j] += r.data[j]; }
        const data = new Uint8ClampedArray(acc.length); for (let j = 0; j < acc.length; j++) data[j] = Math.round(acc[j] / n);
        out = { width: W, height: H, data };
      }
      const res = { width: out.width, height: out.height, data: out.data, info };
      if (key) { cache.set(key, res); if (cache.size > 6) cache.delete(cache.keys().next().value); }
      return { ...res, cached: false };
    },
    dispose() { be?.dispose(); be = null; tried = false; cache.clear(); },
  };
  return api;
}
