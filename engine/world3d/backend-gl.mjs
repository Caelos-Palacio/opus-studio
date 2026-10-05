// Backend headless-gl + three (≤ r162: headless-gl es WebGL1) con rasterizador software (Mesa llvmpipe) fijado: reproducible sin GPU.
// Intercambiable: index.mjs solo conoce { name, sig(), renderFrame(scene, p) → {width,height,data}, dispose() }.
// El shot NUNCA ve three ni gl: declara la escena como datos (docs/specs/004-world3d.md) y este módulo (de confianza) la dibuja.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { VERT, FRAG, DECAL_VERT, DECAL_FRAG, QUAD_VERT, QUAD_FRAG } from './shaders.mjs';

// Rasterizador software fijado ANTES de cargar gl (a nivel de módulo: el sandbox de shots congela process mientras corre un shot).
process.env.LIBGL_ALWAYS_SOFTWARE ??= '1'; process.env.GALLIUM_DRIVER ??= 'llvmpipe';
const require = createRequire(import.meta.url);
const hex = (h) => { h = String(h).replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };
const mode = { flat: 0, emissive: 0, toon: 1, matte: 2, soft: 2, ink: 3 };

let SIG = null;
function mesaVersion() {
  try {
    const r = spawnSync('ldconfig', ['-p'], { encoding: 'utf8' }), m = /libgallium-([\d.]+)\.so/.exec(r.stdout ?? '') ?? /libEGL_mesa\.so\.0\s.*=>\s*\S*?([\d]+\.[\d]+\.[\d]+)/.exec(r.stdout ?? '');
    if (m) return m[1].replace(/-.*/, '');
    const d = spawnSync('dpkg-query', ['-W', '-f=${Version}', 'libegl-mesa0'], { encoding: 'utf8' }); if (d.status === 0 && d.stdout) return d.stdout.trim();
  } catch {}
  return '?';
}
// Firma del backend: entra en el hash de los fragmentos 3D. Sin crear contexto (barata y estable).
export function backendSig() {
  if (SIG) return SIG;
  let gl = '?', three = '?';
  const pj = (name) => { try { let d = path.dirname(require.resolve(name)); for (let i = 0; i < 5; i++, d = path.dirname(d)) { const f = path.join(d, 'package.json'); if (fs.existsSync(f)) { const j = JSON.parse(fs.readFileSync(f, 'utf8')); if (j.name === name) return j.version; } } } catch {} return '?'; };
  gl = pj('gl'); three = pj('three');
  return (SIG = `headless-gl@${gl} three@${three} mesa@${mesaVersion()} ${process.env.GALLIUM_DRIVER ?? 'llvmpipe'}`);
}

export function loadBackend() {
  let createGL, THREE;
  try { createGL = require('gl'); THREE = require('three'); } catch (e) { return { error: `paquetes 'gl'/'three' no instalados (${String(e.message).split('\n')[0]})` }; }
  let gl;
  try { gl = createGL(16, 16, { preserveDrawingBuffer: true, antialias: false, alpha: true, premultipliedAlpha: false }); } catch (e) { return { error: `no se pudo crear el contexto GL: ${e.message}` }; }
  if (!gl) return { error: 'headless-gl no creó contexto (¿Mesa/libEGL/libGL ausentes?)' };
  const resizeExt = gl.getExtension('STACKGL_resize_drawingbuffer');
  const canvas = { width: 16, height: 16, style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => gl, clientWidth: 16, clientHeight: 16 };
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: false, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.autoClear = false;
  if (THREE.LinearSRGBColorSpace) renderer.outputColorSpace = THREE.LinearSRGBColorSpace;           // no convertir: el cálculo ya es sRGB

  // uniformes compartidos por todos los materiales (se actualizan por fotograma)
  const U = {
    uRes: { value: new THREE.Vector2(1, 1) }, uHullPx: { value: 2 }, uL: { value: new THREE.Vector3(0, 0, 1) },
    uInk: { value: new THREE.Vector3() }, uLine: { value: new THREE.Vector3() }, uBg: { value: new THREE.Vector3() }, uFogC: { value: new THREE.Vector3() }, uFogD: { value: 0 },
    uBands: { value: 3 }, uSnap: { value: 0.7 }, uHatch: { value: 6 }, uShadowMix: { value: 0.55 },
    uPal: { value: Array.from({ length: 8 }, () => new THREE.Vector3()) }, uShadowC: { value: new THREE.Vector3() }, uShadowA: { value: 0.5 },
  };
  const mats = new Map();
  const material = (kind, hull) => {
    const key = `${kind}|${hull}`; let m = mats.get(key); if (m) return m;
    if (kind === 'decal') m = new THREE.ShaderMaterial({ uniforms: U, vertexShader: DECAL_VERT, fragmentShader: DECAL_FRAG, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    else m = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, defines: { MODE: mode[kind] ?? 1, ...(hull ? { HULL: 1 } : {}) }, side: hull ? THREE.BackSide : THREE.FrontSide });
    mats.set(key, m); return m;
  };
  const geoms = {
    box: () => new THREE.BoxGeometry(1, 1, 1), sphere: () => new THREE.SphereGeometry(1, 40, 28), cylinder: () => new THREE.CylinderGeometry(1, 1, 1, 40, 1),
    cone: () => new THREE.ConeGeometry(1, 1, 40, 1), plane: () => new THREE.PlaneGeometry(1, 1), decal: () => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g; },
  };
  const gcache = new Map(), geom = (s) => { if (!gcache.has(s)) gcache.set(s, geoms[s]()); return gcache.get(s); };
  // forma → escala TRS por instancia
  const scaleOf = (shape, size) => {
    const a = Array.isArray(size) ? size : [size ?? 1];
    if (shape === 'sphere') return [a[0], a[0], a[0]];
    if (shape === 'cylinder' || shape === 'cone') return [a[0], a[1] ?? a[0] * 2, a[0]];
    if (shape === 'plane') return [a[0], a[1] ?? a[0], 1];
    return [a[0], a[1] ?? a[0], a[2] ?? a[0]];
  };
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  const setMat = (mesh, i, pos, rot, sc) => { e4.set((rot?.[0] ?? 0) * Math.PI / 180, (rot?.[1] ?? 0) * Math.PI / 180, (rot?.[2] ?? 0) * Math.PI / 180, 'YXZ'); q4.setFromEuler(e4); m4.compose(v3.set(pos[0], pos[1], pos[2]), q4, s3.set(sc[0], sc[1], sc[2])); mesh.setMatrixAt(i, m4); };

  // ── construcción de la escena declarada (una vez por objeto de escena) ───────────────────────────────────────────────
  const BUILT = new WeakMap();
  const foot = (shape, sc) => (shape === 'box' ? [sc[0], sc[2]] : [2 * sc[0], 2 * sc[2]]), halfH = (shape, sc) => (shape === 'sphere' ? sc[0] : sc[1] / 2);
  function build(spec, palette, shading, outlineOn) {
    const root = new THREE.Scene(), hullMeshes = [], byId = new Map(), decalSpecs = [];
    const col = (c) => hex(palette[c] ?? c ?? '#ffffff');
    const ground = spec.ground, gy = ground?.y ?? 0, tmp = new THREE.Color();
    const addMesh = (shape, kind, count, outline, order) => { const mesh = new THREE.InstancedMesh(geom(shape), material(kind, false), count); mesh.frustumCulled = false; mesh.renderOrder = order; root.add(mesh);
      if (outline) { const h = new THREE.InstancedMesh(geom(shape), material(kind, true), count); h.frustumCulled = false; h.renderOrder = order; root.add(h); hullMeshes.push(h); mesh.userData.hull = h; } return mesh; };
    if (ground) {
      const g = addMesh('plane', ground.mat ?? 'flat', 1, false, 0); setMat(g, 0, [0, gy, 0], [-90, 0, 0], [ground.size ?? 4000, ground.size ?? 4000, 1]);
      const c = col(ground.color ?? 'shade'); g.setColorAt(0, tmp.setRGB(c[0], c[1], c[2])); g.instanceMatrix.needsUpdate = true; g.instanceColor.needsUpdate = true;
    }
    for (const o of spec.objects ?? []) {
      const shape = o.shape ?? o.instances?.shape ?? 'box', kind = !o.mat || o.mat === 'lit' ? shading : o.mat, outline = outlineOn && (o.outline ?? (shape !== 'plane' && kind !== 'flat' && kind !== 'emissive'));
      if (o.instances) {
        const D = o.data, N = Math.floor(D.length / 7), unit = scaleOf(shape, o.instances.size ?? 1), colors = (o.colors ?? ['accent']).map(col);
        const mesh = addMesh(shape, kind, N, outline ?? false, 2); const wantC = o.contact ?? (ground?.contact !== false && !!ground);
        for (let i = 0; i < N; i++) {
          const b = i * 7; setMat(mesh, i, [D[b], D[b + 1], D[b + 2]], null, [unit[0] * D[b + 3], unit[1] * D[b + 4], unit[2] * D[b + 5]]);
          const c = colors[D[b + 6] | 0] ?? colors[0]; mesh.setColorAt(i, tmp.setRGB(c[0], c[1], c[2]));
          if (wantC && shape !== 'plane') { const sc = [unit[0] * D[b + 3], unit[1] * D[b + 4], unit[2] * D[b + 5]]; if (D[b + 1] - halfH(shape, sc) <= gy + 0.15) decalSpecs.push([D[b], D[b + 2], ...foot(shape, sc)]); }
        }
        mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
        if (mesh.userData.hull) { mesh.userData.hull.instanceMatrix = mesh.instanceMatrix; mesh.userData.hull.instanceColor = mesh.instanceColor; }
        continue;
      }
      const sc = scaleOf(shape, o.size), c = col(o.color ?? 'ink'), mesh = addMesh(shape, kind, 1, outline, 2);
      const pos = o.pos ?? [0, 0, 0]; setMat(mesh, 0, pos, o.rot, sc); mesh.setColorAt(0, tmp.setRGB(c[0], c[1], c[2])); mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
      if (mesh.userData.hull) { mesh.userData.hull.instanceMatrix = mesh.instanceMatrix; mesh.userData.hull.instanceColor = mesh.instanceColor; }
      if (o.id) byId.set(o.id, { mesh, base: { pos, rot: o.rot, sc, color: c } });
      const wantC = o.contact ?? (ground?.contact !== false && !!ground);
      if (wantC && ground && shape !== 'plane' && pos[1] - halfH(shape, sc) <= gy + 0.15) decalSpecs.push([pos[0], pos[2], ...foot(shape, sc)]);
    }
    if (decalSpecs.length) {
      const d = new THREE.InstancedMesh(geom('decal'), material('decal', false), decalSpecs.length); d.frustumCulled = false; d.renderOrder = 1;
      decalSpecs.forEach(([x, z, fw, fd], i) => setMat(d, i, [x, gy + 0.01, z], null, [fw * 1.6 + 0.3, 1, fd * 1.6 + 0.3]));
      d.instanceMatrix.needsUpdate = true; root.add(d);
    }
    return { root, byId };
  }

  // ── buffers de destino por tamaño ────────────────────────────────────────────────────────────────────────────────────
  const RT = new Map();
  const target = (w, h) => { const k = `${w}x${h}`; let t = RT.get(k); if (!t) { if (RT.size >= 3) { const [kk, v] = RT.entries().next().value; v.dispose(); RT.delete(kk); }
    t = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: true, stencilBuffer: true, type: THREE.UnsignedByteType, format: THREE.RGBAFormat }); RT.set(k, t); } return t; };
  const quadScene = new THREE.Scene(), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadMat = new THREE.ShaderMaterial({ uniforms: { tMap: { value: null } }, vertexShader: QUAD_VERT, fragmentShader: QUAD_FRAG, depthTest: false, depthWrite: false, blending: THREE.NoBlending });
  quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat));
  const cam = new THREE.PerspectiveCamera(34, 1, 0.5, 4000);
  let curW = 0, curH = 0, buf = null;

  function renderFrame(spec, p) {
    const { size: [W, H], ss = 2 } = p, SW = Math.max(1, Math.round(W * ss)), SH = Math.max(1, Math.round(H * ss));
    if (W !== curW || H !== curH) { resizeExt?.resize(W, H); canvas.width = W; canvas.height = H; renderer.setSize(W, H, false); curW = W; curH = H; buf = new Uint8Array(W * H * 4); }
    let built = BUILT.get(spec); if (!built || built.pk !== p.buildKey) { built = build(spec, p.palette, p.shading, p.outlineOn); built.pk = p.buildKey; BUILT.set(spec, built); }
    // uniformes del estilo
    const v = (a, x) => a.value.set(x[0], x[1], x[2]);
    v(U.uInk, hex(p.palette.ink ?? '#ffffff')); v(U.uLine, hex(p.palette[p.outlineColor] ?? p.outlineColor ?? p.palette.ink ?? '#ffffff')); const bgc = hex(p.palette[spec.background ?? 'paper'] ?? spec.background ?? p.palette.paper ?? '#000000'); v(U.uBg, bgc); v(U.uFogC, bgc);
    U.uShadowC.value.set(bgc[0] * 0.35, bgc[1] * 0.35, bgc[2] * 0.35);
    const pal = [...new Set(Object.values(p.palette))].slice(0, 8).map(hex); while (pal.length < 8) pal.push(pal[pal.length - 1]); pal.forEach((c, i) => U.uPal.value[i].set(c[0], c[1], c[2]));
    U.uRes.value.set(SW, SH); U.uHullPx.value = p.outlinePx * ss; U.uBands.value = p.bands; U.uSnap.value = p.snap; U.uHatch.value = Math.max(3, p.hatchPx * ss); U.uShadowMix.value = p.shadowMix; U.uShadowA.value = p.contactAlpha;
    U.uL.value.copy(p.lightDir); U.uFogD.value = p.fogDensity;
    // cámara
    const c = p.cam; cam.fov = c.fov; cam.aspect = W / H; cam.near = c.near; cam.far = c.far; cam.updateProjectionMatrix();
    const az = c.az * Math.PI / 180, el = c.el * Math.PI / 180, T = c.target;
    cam.position.set(T[0] + Math.sin(az) * Math.cos(el) * c.dist, T[1] + Math.sin(el) * c.dist, T[2] + Math.cos(az) * Math.cos(el) * c.dist);
    cam.up.set(Math.sin((c.roll ?? 0) * Math.PI / 180) * -1, Math.cos((c.roll ?? 0) * Math.PI / 180), 0); cam.lookAt(T[0], T[1], T[2]); cam.updateMatrixWorld();
    // sustituciones por fotograma de objetos con id (posición, rotación, escala, color)
    for (const [id, ov] of Object.entries(p.overrides ?? {})) { const b = built.byId.get(id); if (!b) continue; const pos = ov.pos ?? b.base.pos, sc = ov.scale ? (Array.isArray(ov.scale) ? ov.scale : [ov.scale, ov.scale, ov.scale]).map((x, i) => x * b.base.sc[i]) : b.base.sc; setMat(b.mesh, 0, pos, ov.rot ?? b.base.rot, sc); b.mesh.instanceMatrix.needsUpdate = true;
      if (ov.color) { const cc = hex(p.palette[ov.color] ?? ov.color); b.mesh.setColorAt(0, new THREE.Color().setRGB(cc[0], cc[1], cc[2])); b.mesh.instanceColor.needsUpdate = true; } }
    // pase 1: escena a SSAA
    const rt = target(SW, SH); renderer.setRenderTarget(rt); renderer.setClearColor(new THREE.Color(bgc[0], bgc[1], bgc[2]), p.alpha ? 0 : 1); renderer.clear(true, true, true);
    renderer.render(built.root, cam);
    // pase 2: resolución al tamaño final (promedio bilineal)
    rt.texture.minFilter = rt.texture.magFilter = THREE.LinearFilter; quadMat.uniforms.tMap.value = rt.texture;
    renderer.setRenderTarget(null); renderer.setViewport(0, 0, W, H); renderer.setClearColor(new THREE.Color(bgc[0], bgc[1], bgc[2]), 0); renderer.clear(true, true, true); renderer.render(quadScene, quadCam);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const out = new Uint8ClampedArray(W * H * 4), row = W * 4;
    for (let y = 0; y < H; y++) out.set(buf.subarray((H - 1 - y) * row, (H - y) * row), y * row);          // gl es bottom-up
    return { width: W, height: H, data: out };
  }
  return { name: 'headless-gl', sig: backendSig, renderFrame, dispose() { for (const t of RT.values()) t.dispose(); RT.clear(); try { gl.getExtension('STACKGL_destroy_context')?.destroy(); } catch {} }, THREE };
}
