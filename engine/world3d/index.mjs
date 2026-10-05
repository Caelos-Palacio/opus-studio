// world3d: 3D como CAPA del compositor 2D (docs/specs/004-world3d.md). Interfaz aislada del backend (hoy headless-gl + three).
//   const w3 = createWorld3d();  w3.available / w3.reason / w3.sig()
//   w3.render(scene, o) → { width, height, data: Uint8ClampedArray RGBA (arriba→abajo), cached }
// scene = DATOS (nada de GL): { id, background, fog, ground, camera, objects:[…] } — ver docs/API.md (api.world3d).
// o = { size:[w,h], style: S (estilo resuelto), t, u, fps, k (escala de dispositivo), cam, overrides, step, ssaa, motionBlur, transparent, cache }
//   cam / overrides pueden ser funciones de t: así `step` (twos) y el motion blur muestrean el MISMO movimiento que el 2D.
// El estilo manda: paleta, luz clave (S.light.az), contorno (grosor/color de tinta) y modo de sombreado salen de S, no de la escena.
import { backendSig, loadBackend } from './backend-gl.mjs';
import { assertScene } from '../inputs.mjs';

const CAM0 = { fov: 34, near: 0.5, far: 4000, target: [0, 0, 0], dist: 10, az: 0, el: 15, roll: 0 };
const W3_DEF = { shading: 'toon', bands: 3, outline: { width: 3, color: 'ink' }, snap: null, ssaa: 2, shadowMix: 0.55, light: { el: 28 }, contact: 0.5, hatch: 6 };
const merge = (a, b) => ({ ...a, ...Object.fromEntries(Object.entries(b ?? {}).filter(([, v]) => v !== undefined)) });
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
      const [W, H] = o.size, fps = o.fps ?? 30, step = o.step ?? 0, t3 = stepT(o.t ?? 0, step, fps), ss = o.ssaa ?? W3.ssaa;
      const mb = o.motionBlur ?? W3.motionBlur ?? null, n = mb ? Math.max(1, mb.samples ?? 4) : 1, shutter = mb?.shutter ?? 0.5;
      const ev = (v, tt) => (typeof v === 'function' ? v(tt) : v);
      if (!serials.has(scene)) serials.set(scene, ++serial);
      const key = o.cache === false ? null : JSON.stringify([serials.get(scene), W, H, t3, ss, !!o.transparent, n, shutter, o.k, ev(o.cam, t3), ev(o.overrides, t3), S.palette, S.light?.az, W3, step]);
      if (key && cache.has(key)) { const c = cache.get(key); cache.delete(key); cache.set(key, c); return { ...c, cached: true }; }
      const light = S.light?.az ?? 135, laz = ((W3.light.az ?? light) * Math.PI) / 180, lel = (W3.light.el * Math.PI) / 180;
      const lightDir = { x: Math.cos(laz) * Math.cos(lel), y: Math.sin(laz) * Math.cos(lel), z: Math.sin(lel) };
      const one = (tt) => {
        const cam = merge(merge(CAM0, scene.camera), ev(o.cam, tt)); cam.target = cam.target ?? CAM0.target;
        let fogD = 0; const f = scene.fog; if (f !== false) { if (typeof f === 'number') fogD = f; else if (f?.density != null) fogD = f.density; else fogD = 1.8 / (f?.far ?? cam.dist * 6); }
        const k = o.k ?? Math.min(W, H) / 1080, line = W3.outline;
        const THREE = be.THREE;
        return be.renderFrame(scene, {
          size: [W, H], ss, alpha: !!o.transparent, palette: S.palette, shading: W3.shading, outlineOn: line !== false, outlineColor: line?.color ?? 'ink', outlinePx: (line?.width ?? 0) * k,
          buildKey: JSON.stringify([S.palette, W3.shading, line !== false]), bands: W3.bands, snap: W3.snap ?? { toon: 0.8, soft: 0.25, ink: 0.7 }[W3.shading] ?? 0.7, hatchPx: W3.hatch * k * 2, shadowMix: W3.shadowMix, contactAlpha: W3.contact,
          lightDir: new THREE.Vector3(lightDir.x, lightDir.y, lightDir.z).normalize(), fogDensity: fogD, cam, overrides: ev(o.overrides, tt),
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
      const res = { width: out.width, height: out.height, data: out.data };
      if (key) { cache.set(key, res); if (cache.size > 6) cache.delete(cache.keys().next().value); }
      return { ...res, cached: false };
    },
    dispose() { be?.dispose(); be = null; tried = false; cache.clear(); },
  };
  return api;
}
