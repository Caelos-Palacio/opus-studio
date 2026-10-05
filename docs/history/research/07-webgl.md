# 07 — ¿3D real (Three.js) dentro del pipeline? Spike WebGL

> HISTÓRICO: documento fechado; puede no reflejar el estado actual (ver [STATUS.md](/STATUS.md)).

Spike de viabilidad, no producto. Código en `spike/` (`world.mjs` escena agnóstica del renderer, `render-gl.mjs`, `render-chrome.mjs`,
`datacenter.mjs`). Salidas (ignoradas por git): `out/webgl/datacenter.mp4` (3 s, 1280×720, 30 fps) y `out/webgl/contact.png`.
Máquina: 12 hilos, iGPU Intel Raptor Lake, Node 22, Chrome 154, three 0.160. Mediciones a 1280×720, escena ≈ 1 120 racks
instanciados + 27 000 ranuras + 27 000 LED (3 `InstancedMesh`), luz direccional + ambiente, `FogExp2`.

## Tabla comparativa (medida)
| | (a) headless-gl `gl` + three | (b) Chrome headless + puppeteer-core |
|---|---|---|
| Rasterizador | **por defecto usa la iGPU** (ANGLE→EGL); con `LIBGL_ALWAYS_SOFTWARE=1 GALLIUM_DRIVER=llvmpipe` es CPU | SwiftShader (CPU) o GPU con `--use-angle=gl-egl` (en esta máquina falló al crear contexto) |
| ms/fotograma 3D | GPU: **≈10 ms**; llvmpipe 12 hilos: **≈80–115 ms**; 1 hilo: ≈160 ms | SwiftShader: **≈1 100–1 400 ms** (picos 4–11 s con la máquina cargada); +arranque ≈1 s |
| Determinismo (mismo backend, 2 pasadas) | idéntico bit a bit (GPU y llvmpipe) | idéntico bit a bit (SwiftShader) |
| Determinismo entre backends (t=1.5 s) | GPU vs llvmpipe: 0,11 % px distintos, PSNR 48 dB, máx 245 (bordes sin AA) | llvmpipe vs Chrome: 0,40 % px, PSNR 37,8 dB |
| WebGL / three | **WebGL 1** → three ≤ r162 (r163+ exige WebGL2) | WebGL 2, cualquier three actual |
| Instalación | `npm i gl` bajó binario precompilado (sin compilar) en Node 22; necesita libGL/libEGL de Mesa en el sistema; sin X/Xvfb. Paquete poco mantenido (stack-gl) | `puppeteer-core` (sin descarga) + Chrome del sistema; en CI habría que instalar Chrome (≈150–400 MB) |
| Integración con el compositor 2D | `readPixels` → `ImageData` en el mismo proceso, cero copias de red; frame a frame síncrono, encaja en `seek(t)` | RPC por fotograma; el readback pasa por base64 (≈3,7 MB/fotograma) o PNG; asíncrono (`seek` es síncrono hoy) |
| Sandbox / guardia | Three corre en el proceso Node del motor: el código 3D es de confianza (módulo del motor), el shot solo pasa parámetros | Proceso aparte, `file://` + interceptación de peticiones (red bloqueada, 0 peticiones externas en la prueba); aísla mejor, pero más superficie (Chrome) |
| Tamaño añadido | gl 25 MB, three 33 MB | puppeteer-core ≈8 MB + Chrome externo |

(c) Otras, no medidas: `three` + WebGPU en Chrome (no determinista entre GPU, peor); rasterizador software propio (reescribir
three: descartado); Mesa `osmesa` vía `gl` (equivale a llvmpipe).

## Prototipo
`node spike/datacenter.mjs` → 90 fotogramas en **118 ms/fotograma totales** (78 ms 3D llvmpipe + putImageData + HUD node-canvas
+ pipe a ffmpeg). Racks en filas con micro-detalle (ranuras + 2 LED por ranura), 2 acentos (amarillo bandeja/LED, rojo alerta),
niebla de profundidad, zoom de escala 380 m → 7 m con curva suavizada en log, HUD 2D con FOV en metros y regla log 1 m–1 km
con marcador. Viñeta como grade 2D. Limitaciones visibles: sin antialiasing (WebGL1 de headless-gl, bordes dentados), poco
brillo emisivo/bloom, rack héroe sin cables; es un prototipo, no un acabado a nivel bearlyai.

## Recomendación
**Sí, con (a) headless-gl + three r160–r162, rasterizador software fijado.** Es la única opción con coste razonable
(~0,1 s/fotograma en CPU: un film de 60 s a 30 fps ≈ 3 min, y solo en fragmentos con 3D y con caché por hash) y encaja con
`seek(t)` síncrono y puro. Chrome (b) queda como plan B si se necesita WebGL2/MSAA/postproceso moderno (10× más lento).
Cómo:
1. Capa `film.world3d` del motor (módulo de confianza en `engine/world3d/`, no en `shots/`): el shot declara `world: 'datacenter'`
   + parámetros puros (cámara en función de t, colores por rol de paleta) y el motor devuelve una imagen que el shot compone
   (`api.layer3d(id, t, params)`). Los shots no importan three ni gl (el hook del sandbox ya bloquea todo salvo el núcleo puro).
2. Forzar software en el motor (`LIBGL_ALWAYS_SOFTWARE=1`, `GALLIUM_DRIVER=llvmpipe` antes de cargar `gl`) y registrar
   backend + versión de Mesa en el hash del fragmento.
3. Escenas generadas con PRNG con semilla (hecho aquí: `mulberry32`); prohibido `Math.random`/`Date`.

## Riesgos
- **Determinismo**: estable en un mismo backend/Mesa; NO bit a bit entre backends o versiones de Mesa/ANGLE (PSNR 38–48 dB,
  diferencias en bordes). El golden bit a bit actual solo vale para (a)+llvmpipe con la misma versión de Mesa; para el resto,
  golden con tolerancia (PSNR ≥ 40 dB / SSIM) en fotogramas 3D. Los fragmentos cacheados deben incluir el backend en el hash.
- **Hilos**: llvmpipe depende de `LP_NUM_THREADS` solo en velocidad (hashes iguales con 1 y 12 hilos en la prueba), pero el
  coste a 1 hilo (CI pequeño) sube ~2×.
- **Mantenimiento**: `gl` es WebGL1 y poco mantenido; pinea three ≤ r162 y Node; un salto de Node podría romper el binario.
  Mitigación: aislar tras `engine/world3d` para poder conmutar a Chrome.
- **CI**: requiere Mesa (libEGL/libGL/llvmpipe) en la imagen; sin X. No probado en contenedor limpio (solo en esta máquina,
  donde `gl` por defecto usaba la iGPU: sin forzar software, el resultado depende del hardware).
- **Calidad**: sin MSAA en `gl` (supermuestreo 2× en el motor: ×4 coste) ni WebGL2 (sin PMREM/IBL moderno, sin sombras caras).
- **node_modules**: three/gl/puppeteer-core se instalaron SOLO en el node_modules local del worktree (enlace duro, `--no-save`);
  `package.json` sin tocar. Para integrar habría que añadir `three@0.160` y `gl` a dependencies y revisar `package-lock`.

## Coste de integración estimado
Capa `world3d` + `api.layer3d` + hash/caché por backend + guardia: 1–1,5 días. Golden con tolerancia para 3D + test de
determinismo (dos renders): 0,5 día. Biblioteca de mundos (datacenter pulido con cables, bloom barato 2D, AA por
supermuestreo, parametrizable por paleta): 2–3 días por mundo. Pruebas en CI/contenedor limpio: 0,5 día.
