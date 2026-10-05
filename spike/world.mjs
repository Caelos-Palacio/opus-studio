// Mundo 3D "datacenter" agnóstico del renderer: world(THREE, renderer, W, H) → { render(t) }. Puro en t, sin Math.random ni Date.
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const ACC = { yellow: 0xffc21a, red: 0xff2d2d };
export const DURATION = 3;
export function makeWorld(THREE, renderer, W, H) {
  const rnd = mulberry32(1337);
  const scene = new THREE.Scene();
  const BG = new THREE.Color(0x0c0a0b);
  scene.background = BG;
  scene.fog = new THREE.FogExp2(BG, 0.0016);
  const cam = new THREE.PerspectiveCamera(34, W / H, 0.5, 4000);
  // luz: direccional cálida baja + ambiente fría tenue
  const sun = new THREE.DirectionalLight(0xfff0dd, 2.2); sun.position.set(-60, 90, 40); scene.add(sun);
  scene.add(new THREE.AmbientLight(0x3a4a66, 0.9));
  // suelo
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshLambertMaterial({ color: 0x15161a }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  // racks instanciados: filas largas con pasillos
  const COLS = 40, ROWS = 28, SX = 2.2, SZ = 6.0, RW = 1.2, RH = 4.2, RD = 2.2;
  const racks = new THREE.InstancedMesh(new THREE.BoxGeometry(RW, RH, RD), new THREE.MeshLambertMaterial({ color: 0x2a2d35 }), COLS * ROWS);
  const m = new THREE.Matrix4(), col = new THREE.Color();
  // micro-detalle: 12 ranuras de servidor por rack (luces de estado) + franja frontal
  const SLOTS = 12, leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.12, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff }), COLS * ROWS * SLOTS * 2);
  const slotsM = new THREE.InstancedMesh(new THREE.BoxGeometry(1.0, 0.24, 0.04), new THREE.MeshLambertMaterial({ color: 0x1b1d23 }), COLS * ROWS * SLOTS);
  let ri = 0, li = 0, si = 0; const tint = new THREE.Color();
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x = (c - COLS / 2) * SX, z = -r * SZ, h = 0.92 + rnd() * 0.16;
    m.makeScale(1, h, 1).setPosition(x, RH * h / 2, z); racks.setMatrixAt(ri++, m);
    const faceZ = z + RD / 2 + 0.03, hot = rnd() < 0.045, bad = rnd() < 0.006;
    for (let s = 0; s < SLOTS; s++) {
      const y = 0.35 + s * 0.33 * h;
      m.makeTranslation(x, y, faceZ); slotsM.setMatrixAt(si++, m);
      for (let k = 0; k < 2; k++) {
        m.makeScale(k ? 0.12 : 0.5, 1, 1).setPosition(x + (k ? 0.38 : -0.12), y, faceZ + 0.04); leds.setMatrixAt(li, m);
        const q = rnd();
        if (k && bad) tint.setHex(ACC.red); else if (k && (hot || q < 0.05)) tint.setHex(ACC.yellow); else tint.setRGB(0.10 + q * 0.07, 0.13 + q * 0.07, 0.18 + q * 0.1);
        leds.setColorAt(li++, tint);
      }
    }
  }
  for (const o of [racks, slotsM, leds]) { o.instanceMatrix.needsUpdate = true; scene.add(o); }
  leds.instanceColor.needsUpdate = true;
  // un rack "héroe" con acento rojo en el que termina el zoom
  const hx = 0, hz = -9 * SZ;
  const hero = new THREE.Mesh(new THREE.BoxGeometry(RW + 0.1, 0.06, 0.05), new THREE.MeshBasicMaterial({ color: ACC.red }));
  hero.position.set(hx, RH * 0.62, hz + RD / 2 + 0.12); scene.add(hero);
  const heroY = new THREE.Mesh(new THREE.BoxGeometry(RW + 0.1, 0.04, 0.05), new THREE.MeshBasicMaterial({ color: ACC.yellow }));
  heroY.position.set(hx, RH * 0.62 + 0.35, hz + RD / 2 + 0.12); scene.add(heroY);
  const target = new THREE.Vector3(hx, RH * 0.6, hz + RD / 2);
  // cámara: zoom de escala logarítmico 600 m → 3 m (regla log: cada tercio de tiempo = una década-ish)
  const D0 = 380, D1 = 7;
  const ease = (u) => u * u * (3 - 2 * u);
  const dist = (t) => D0 * Math.pow(D1 / D0, ease(Math.min(1, Math.max(0, t / DURATION))));
  const info = (t) => { const d = dist(t); return { d, log10: Math.log10(d) }; };
  renderer.setSize(W, H, false); renderer.setPixelRatio(1);
  return {
    info,
    render(t) {
      const d = dist(t), u = ease(t / DURATION);
      const az = -0.55 * (1 - u), el = 0.55 * (1 - u) + 0.04;                 // de vista aérea oblicua a plano frontal
      cam.position.set(target.x + Math.sin(az) * Math.cos(el) * d, target.y + Math.sin(el) * d, target.z + Math.cos(az) * Math.cos(el) * d);
      cam.lookAt(target); cam.updateMatrixWorld();
      renderer.render(scene, cam);
    },
  };
}
