# Roles

Regla de alcance: cada rol escribe solo en sus rutas. El lint es el árbitro común.

## Director (tú)
Etapas 1–8, 11 y 12. Brief, estilo, hechos, timeline, viñetas, animatic, style lock, veredicto final.
Único que edita `CRAFT.md`, `CINE.md`, `data/timeline.json`, `engine/profiles.json` y `styles/*.json`.

## DP (director de fotografía)
Decide por shot: tamaño de plano, encuadre, `cam` (movimiento + `why`), profundidad (`api.depth`), color y luz según `CINE.md`. Entrega `cam` en el timeline y la rejilla/flecha en la viñeta. Corre el pase Review-Cine.

## Investigador (solo `explainer`)
Escribe `data/facts.json`. Cada entrada: `claim`, `date`, `source`. No toca timeline.

## TD
Solo `engine/`. Tras tocar prims: `npm run docs`. Siempre: `npm test` en verde. No decide look. Si cambia el contrato de `seek`/`api`, actualiza MOTOR.md § Contrato y corre el demo (`npm run lint` → SHIP).

## Animator {IDs}
Input: CRAFT + CINE + STYLES + timeline + `storyboard/{ID}.svg` + los `entities` de los shots vecinos.
Output: `shots/{ID}.mjs` y `out/sheets/{ID}.png`.
```
Implementa solo {IDs}.
Lee CRAFT.md y data/timeline.json. La viñeta storyboard/{ID}.svg es la pose canónica del beat 1.
Si hay handoff entrante: arranca de Prev.entities.X(t_corte). Si hay saliente: exporta entities.X.
Layout solo con api.safe/api.at; texto solo con api.text/api.label/api.tex (TeX en String.raw); foco con api.focus o primitivas (docs/API.md). Estructura jerárquica → export scene(t). Antes de mirar vídeo, consulta: npm run q -- shot {ID} / at T / sym S. La cámara la aplica el motor (no escales el mundo); parallax con api.depth. Colores por rol. seek puro. Paleta, tipo y grade intocables.
Antes de entregar: npm run lint → sin FIX en tus IDs; node engine/render.mjs --shot {ID} --stills; npm run index -- --changed.
```

## Review-Ritmo
Ve `out/sheets/contact.png`, strips y `out/motion.json`. Solo juzga lo que el lint no mide: si el ritmo *sirve a la idea*.
Salida: `shot  t  problema  arreglo mínimo`. No reescribe estilo.

## Review-Demo
Ve la hoja. Marca look de template: gradiente + tipo centrado, partículas, glow, logo final, easing uniforme, 3D flip, blur-in.

## Review-Tipo
Lo que queda tras el lint: jerarquía, legibilidad real, créditos, first/last frame, loudness percibida.

## Review-Rigor (solo `explainer`)
Contrasta cada afirmación visible con `facts.json`. Marca analogías presentadas como literales y simplificaciones no declaradas.

## Review-Cine
Ve la hoja (también en **escala de grises**) y los strips. Solo juzga lo que el lint no mide, con `CINE.md`:
sujeto legible por valor, lead room y headroom, tamaño de plano que sirve a la idea (no tres iguales seguidos), la cámara ayuda a entender (no decora), temperatura/contraste entre planos, luz motivada (glow/viñeta/grano en su medida), rima primer/último frame.
Salida: `shot  t  problema  arreglo mínimo`.
