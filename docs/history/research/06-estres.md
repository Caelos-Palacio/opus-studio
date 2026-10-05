# Film de estrés F0 — «Potencias» (medición)

> HISTÓRICO: documento fechado; puede no reflejar el estado actual (ver [STATUS.md](/STATUS.md)).

Film: `data/stress/potencias.json` (brief en `data/stress/brief.md`), 13 shots `P01–P13` + mundo compartido `shots/P_mundo.mjs`
(331 líneas, función pura de t), 78 s · 1280×720 · 30 fps · estilo `cosmos` · perfil `explainer` · TeX real en todas las cifras.
Se usa con `OPUS_TIMELINE=data/stress/potencias.json` (lint, render, master). Máquina: 12 hilos, Node 22.
[M] = medido aquí; [I] = inferencia.

## Coste [M]

| qué | valor |
|---|---|
| `npm run lint` completo (motion 12 fps + firma de ritmo 30 fps + tipo + foco) | 68–92 s (4 corridas tras el merge: 68,9 · 68,3 · 69,2 · 92,4); antes del merge 71,1 s; ~330 MB RSS |
| `npm run validate` (esquema, `--only validate`) | 0,9 s |
| `npm run master` en frío (13 fragmentos, 0 en caché) | 281,7 s pared · 747,5 s CPU · 352 MB RSS |
| por fotograma (2341 fotogramas) | 120 ms pared (8,3 fps agregados con 12 hilos) · 319 ms CPU |
| `npm run master` en caliente (13/13 en caché: concat + mezcla) | 8,9 s |
| fragmentos `out/fragments/potencias/*.mp4` | 13 · 1,36–3,13 MB (mediana 1,73 MB; P10, el borde con bloom, el mayor) · 25,0 MB en total |
| master `out/potencias.mp4` | 26,6 MB · 78,03 s · h264 + aac · −14 LUFS |
| caché TeX versionada `assets/cache/tex/` | 644 KB (41 fórmulas nuevas) |

[I] El lint cuesta ~25 % de un render en frío y no tiene caché por shot en la parte de energía: cada iteración de un detalle de
1 s re-renderiza los 78 s a 192 px. Para afinar la curva hice un medidor local de ventana (render 192 px, mismo cálculo que
`lint.mjs:motion`) que tarda 10–20 s por tramo: es la herramienta que falta en el motor (ver recomendaciones).

## Iteraciones de lint

Antes del merge (agente anterior): SHIP con 16 avisos, iteraciones no registradas (no había ledger).
Tras el merge: **4 lints completos** (ledger: 4 `action: lint`, todos SHIP) + 1 `validate`.
1. Línea base con el motor nuevo: SHIP, 29 avisos (= 16 previos + 13 nuevos del esquema).
2. Quitar `vignette` + calmar red cósmica y anillo CMB: SHIP, 16.
3. Silueta tenue en el primer ×10: SHIP, 16.
4. Aterrizaje por fundido (P13) y galaxia atenuada: SHIP, 16 → master.

## Avisos/FIX nuevos tras el merge (esquema cerrado + guardia AST + sandbox)

- **FIX nuevos: 0.** El esquema cerrado, la guardia AST y el sandbox aceptaron los 14 archivos sin cambios. `P_mundo.mjs` importa
  `engine/core.mjs` y `engine/color.mjs` (núcleo puro permitido) y conjuntos sembrados con `hash2` (sin `Math.random`): ningún falso positivo.
- **WARN nuevos: 13 × `/shots/N/vignette: campo obsoleto (sin consumidor)`.** **Verdadero positivo** (nada en `engine/` lee
  `vignette`), pero la sugerencia es **engañosa**: dice que la viñeta vive en `storyboard/<id>.svg`, y en un repo con más de un film
  las del estrés viven en `storyboard/stress/<id>.svg`. Arreglo aplicado: quitar el campo y anotar la ruta en el brief. El esquema
  cerrado (`additionalProperties:false`) no deja ningún lugar en el timeline para declarar la carpeta de viñetas del film.

## Falsos positivos / negativos del lint (antes y después del merge: idénticos salvo `vignette`)

Falsos positivos (avisos que no piden cambio):
- `pop: energía 7,6× / 5,3× la mediana local` en P10 51,00–51,08 s: es el **impacto deliberado** (2 fotogramas, `sfx impact` en el
  mismo instante, principio 7 de `04-asombro.md`). El lint no cruza `shot.sfx` ni `hold_ok`/beats con el detector de pops.
- `"10^{n}\,\mathrm{m}" visible 0.63s < 0.63s` (×7, P03–P09): el mensaje compara valores que se redondean igual; el contador
  cambia cada 1,5 s por diseño (ritmo Eames) y el número se lee como serie, no aislado. Aviso discutible + mensaje defectuoso.
- `beat sin firma de ritmo` en P11 58,1 s (pico 0,22 vs valle 0,19): beat en pleno silencio posterior al pico; ahí la «firma» es
  el `rev` de audio, que el lint no mira.

Falsos negativos (lo que el lint no vio):
- **Ningún criterio dramático medido**: la curva de energía (principios 1–5 de `04-asombro.md`) no está en el lint. El agente
  anterior quedó atascado porque su pico suavizado estaba «clavado en 48,58 s» y el lint daba SHIP igualmente.
- Un pico secundario al **92 %** (aterrizaje en P13: la persona volaba y crecía desde el icono de la regla, 9,2× la mediana) que
  rompía «final en descenso»: SHIP sin aviso. El aviso `final apagado` solo mira el caso contrario.
- `npm run master` no exige veredicto del crítico: `masterGate` solo bloquea si `C.verdict === 'FIX'`; sin crítico ejecutado pasa
  (`engine/gate.mjs:39`). Documentado como «crítico sin FIX», pero en la práctica el master salió sin ninguna revisión visual.

## El pico «clavado en 48,58 s» (diagnóstico y arreglo)

Inspección del fotograma (diferencia 48,50→48,58 a 640 px y ablación por componente):
- En 48,58 s, L = log10(lado) = 25,4: la **red cósmica** (cientos de nodos y filamentos, `web()`) ocupa todo el cuadro y se contrae
  a velocidad logarítmica constante. Cada nodo se mueve, y la diferencia entre fotogramas es alta en todo el plano durante
  ~3 s (47,5–50,5 s, 3–8× la mediana). Con cualquier suavizado ≥ 1 s esa meseta gana al destello del borde (2 fotogramas + decaimiento
  de 0,55 s). Por eso el pico no se movía al tocar timeline, sfx o el destello: la meseta la fija `Lof(t)` (ritmo constante), no esos parámetros.
- Al arreglarlo aparecieron, por orden, los siguientes dominadores: anillo CMB acercándose (50,25 s), siluetas cercanas en el primer
  ×10 (12 s, 80 % de la energía por ablación), la Vía Láctea entera contrayéndose (41 s) y el vuelo de la persona en el aterrizaje (72 s, 75 %).

Arreglos (solo shots, sin tocar motor): red ×0,2 entre L 24,3–25; anillo CMB más tenue antes del choque (0,2–0,5 en vez de 0,35–1);
siluetas cercanas de menor contraste (mezcla papel/sombra 0,28 en vez de 0,55: el alfa no servía porque se solapan); galaxia ×0,55
al alejarse; en P13 la persona ya no vuela: el icono se funde y la de 1,7 m aparece en su sitio (el mundo vuelve en 2,6 s).

Resultado (energía de `out/motion.json`, mediana 0,00167):

| métrica | antes | después |
|---|---|---|
| pico bruto | 51,00 s (65 %), 17,6× | 51,00 s (65 %), 17,8× |
| pico suavizado 1 s | meseta 47,5–50,5 s compitiendo; luego 72 s (92 %) 6,0× | **50,58 s (65 %) 5,9×**; siguientes: 26,8 s 5,3× · 41,3 s 4,0× |
| calma inicial 0–9,5 s | 0,2× | 0,2× |
| valle justo antes del impacto (50,75–51 s) | 2,6× | 2,4× (relativo al acercamiento: 3 fotogramas) |
| hold/silencio tras el pico 52–55,4 s | ~0 | 0,06× (hold_ok + sin eventos de audio) |
| último 8 % | — | 0,72× (descenso; `end_hold_ok`) |

Pendiente, sin perfeccionismo: la «calma antes del pico» es solo relativa (el acercamiento al borde sigue a 4–6× la mediana hasta
3 fotogramas antes del choque); P05 (Sol, 26,8 s) queda a un 10 % del pico principal.

## Bugs y huecos del motor (anotados, no tocados)

1. Mensaje `visible 0.63s < 0.63s`: compara sin redondear y muestra con 2 decimales (`lint.mjs:200`).
2. Sugerencia de `vignette` asume un solo film por repo (`storyboard/<id>.svg`).
3. Detector de pops ignora impactos declarados (`sfx type: impact` a ≤ 1 fotograma).
4. `masterGate` deja pasar sin crítico (ver arriba).
5. El ledger registra `agent: "anon"` si no se exporta `OPUS_AGENT`/`OPUS_ROLE`: no hay aviso.
6. `api.tex` no acepta `alpha` (anotado ya en `P_mundo.mjs:8`; se funde con un color rgba).

## Fricciones del proceso para agentes

- **La selección de film es una variable de entorno**: en una sesión de agente el shell no conserva `export` entre comandos.
  Me pasó: un `render --still` sin la variable dibujó el demo por defecto en `out/sheets/still_72.20.png` sin avisar del film.
  Todo comando debería imprimir el film activo (lo hace `cut`, no `render --still`) o leerlo de un fichero de sesión.
- El lint no da números de la curva dramática; hay que reconstruirlos de `out/motion.json` (índice desplazado: `E[i]` es t = (i+1)/fps).
- Sin `lint --range a b` ni energía por tramo: cada prueba de 1 s cuesta ~70 s de lint completo.
- `out/` es por worktree y no comparte caché de fragmentos con el repo principal: el primer master de cada agente es frío (282 s).
- El merge de `main` fue limpio (sin conflictos) porque los shots y el timeline del estrés viven en rutas propias; el `node_modules`
  symlink del worktree no lo ignora `.gitignore` (`node_modules/` con barra no casa con un symlink): hay que añadir rutas a mano al hacer commit.

## Recomendaciones (prioridad)

1. **Lint dramático medible** (alta): calcular desde `motion.json` pico bruto y suavizado, % del film, calma previa, hold posterior y
   pico secundario tras el principal; avisar si el pico suavizado no cae en 60–85 % o si hay otro ≥ 90 % de él después. Habría
   evitado las dos trampas de este film.
2. **Energía por tramo** (alta): `npm run lint -- --only motion --range a b` o `q energy a b`, con ablación opcional por capa.
3. **Film activo explícito** (alta): imprimirlo en toda salida y permitir `--timeline` además del env.
4. **Gate del crítico** (media): exigir veredicto vigente o un `--no-critic "razón"` que quede en el ledger.
5. **Pops vs impactos** (media): no avisar de pops a ≤ 1 fotograma de un `impact`/`on_beat_at` declarado.
6. **Mensajes** (baja): redondeo coherente en la regla de lectura; viñeta por film (`storyboard/<film>/<id>.svg`) en el esquema.
7. **Caché de fragmentos compartida entre worktrees** (baja): ruta configurable para `out/fragments`.
