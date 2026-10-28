# STYLES — un estilo es un archivo de datos

El **proceso** (viñetas, animatic, lint, review, master) es el mismo para cualquier obra. Lo que cambia entre una película científica, un trailer y un reel de producto es el **style pack**: `styles/<nombre>.json`.
Estilo = *cómo se ve y se mueve*. **Perfil** (`reel` / `explainer` / `cinematic`) = *cómo se ritma y qué se exige*. Son ejes independientes: `--style noir --profile reel` es válido.

## Catálogo
| pack | perfil por defecto | siente | úsalo para | rasgos |
|---|---|---|---|---|
| `editorial` | reel | claro, seguro | launch, producto, marca, explainer ligero | papel + tinta + acento rojo · muelle medio · sin efectos |
| `scientific` | explainer | contemplativo, riguroso | divulgación, física, datos, ideas que evolucionan | oscuro · color = categoría · serif · glow como luz · cámara lenta |
| `noir` | cinematic | tenso, íntimo | trailer, marca premium, narrativa | letterbox 2,39 · grano · viñeta · ámbar · tipo serif espaciado · cámara `cinema` + handheld |
| `kinetic` | reel | agresivo, rápido | hype, música, lanzamientos, social | negro + ácido · tipo pesado mayúsculas · muelle duro · cámara `outExpo` |
| `soft` | reel | amable, ligero | SaaS, bienestar, onboarding | pastel · degradados · muelles blandos · cámara lenta |
| `brutalist` | reel | crudo, irónico | arte, cultura, anti-marca | mono · gris + rojo/azul primarios · movimiento por pasos · cámara lineal |
| `stopmo` | reel | artesanal, cálido | tráiler con tacto, marca artesanal, educación cálida | 12 fps cuantizados · smear · muelle con rebote · luz lateral + sombra de contacto · grano |
| `cosmos` | cinematic | asombro, preciso, nocturno | divulgación científica nocturna | papel azul-negro · ámbar + cian · bloom físico · niebla/DOF · grade cálido con dither |
| `hierro` | cinematic | contundente, tenso, épico | trailers de combate, narrativa de poder | acero negro + hueso · rojo + oro · tipo condensado en mayúsculas · bloom + aberración + grano · cámara pesada |
| `nocturno` | explainer | contemplativo, riguroso | explainers de matemáticas | pizarra azul-negro · marfil · líneas finas · bloom leve · color = categoría matemática · Latin Modern |
| `pulso` | reel | percusivo, vibrante | reels 9:16, tipografía cinética con música | negro azulado + lima ácida + magenta · mayúsculas gigantes · cortes en rejilla de tempo · impact frames |
| `suite` | explainer | sobrio, técnico | el GIF de demo del README | paleta GitHub dark · tipo monoespaciado · sin post |

`node engine/style.mjs --list` · `npm run gallery` (el mismo film en todos los estilos → `out/gallery.png` + lint por estilo).

## Elegir o componer (lo que hace el Director en la etapa 2)
**Paso 1 — Traduce la petición a ejes.** Anota: 3 adjetivos, energía (baja/media/alta), formalidad, calidez, densidad de información, referencia (si hay).
**Paso 2 — ¿encaja un pack?** Si sí, úsalo tal cual (`"style":"noir"` en el timeline). Ajustes puntuales sin tocar el pack: `"styleOverrides": {...}` en el timeline.
**Paso 3 — Si no encaja, compón uno**:
```bash
node engine/style.mjs --new mi-marca --from soft            # parte del pack más cercano
node engine/style.mjs --palette --hue 190 --scheme analogous --mode dark --mood bold --apply mi-marca
# edita styles/mi-marca.json (tipo, movimiento, cámara, grade, composición)
node engine/style.mjs --check mi-marca                       # reglas de gusto sobre la paleta
OPUS_STYLE=mi-marca npm run lint                             # el demo debe dar SHIP
```
**Paso 4 — Justifica en 5 líneas** (emoción, energía, referencia, paleta, cámara) y espera OK en modo humano.

## Matriz ejes → parámetros
| eje | valor | parámetros |
|---|---|---|
| **energía** | baja | `spring` ω 8–10, ζ 0,9+ · `ease` cinema/inOut · cámara `maxZoomPerSec` ≤ 0,12 · `stagger` 0,10–0,12 |
| | media | ω 14, ζ 0,62 · inOut · 0,25 · 0,06 |
| | alta | ω 22–30, ζ 0,45–0,5 · outExpo · ≥ 1,0 · 0,03 |
| **formalidad / lujo** | alta | serif · `case:'upper'` + `tracking` 0,1–0,15 · paleta oscura o crema · pocos colores |
| | baja / amable | sans redondeada · `case:'none'` · pastel · degradados |
| | crudo | mono · mayúsculas · primarios saturados (`maxChroma` alto) |
| **calidez** | cálida | hue 15–55 · temperatura: sujeto cálido sobre fondo frío |
| | fría / técnica | hue 200–250 · scheme analogous o complementary |
| **cinematográfico** | sí | `letterbox` 2,0–2,39 · `vignette` 0,4–0,55 · `grain` 0,04–0,07 · `shake` ≤ 0,0015 · `compose.anchor:'thirds'` |
| **densidad de información** | alta | `anchor:'free'` · color semántico (`maxColors` 7) · tipo pequeño con `minFontPx` bajo (perfil explainer) |
| **mood** (paleta) | `muted` croma 0,07 · `calm` 0,12 · `bold` 0,18 · `vivid` 0,24 |

## Copiar una referencia sin copiarla
De un vídeo/imagen de referencia extrae **medidas, no píxeles**: (1) fondo y 2–3 colores dominantes → `--palette`/`palette`; (2) serif/sans/mono, mayúsculas, espaciado; (3) cadencia de cortes (¿cada cuántos segundos?) → perfil y `shotLen`; (4) qué hace la cámara (¿empuja, desliza, tiembla?) → `camera.*`; (5) grano/viñeta/barras → `grade.*`; (6) ¿hay glow/degradado? → `rules.*`. Escribe qué copias y qué **prohíbes** en el brief.

## Esquema de un pack
```jsonc
{
  "name": "", "description": "", "mood": [], "defaultProfile": "reel|explainer|cinematic",
  "palette":  { "paper", "ink", "accent", "accent2", "shade", /* + roles semánticos: quant, anom… */ },
  "typeface": { "family", "fallback", "mono", "weights": [1–2], "scale": 1.25–1.8, "base": 30–34, "case": "none|upper", "tracking": 0, "files": [] },
  "motion":   { "spring": { "omega", "zeta" }, "ease": "linear|in|out|inOut|inOutQuint|outExpo|outBack|cinema|step", "stagger": 0.06,
                "stepFps": 0 /* >0 = stop-motion */, "smear": 0 /* 0.04–0.08 */ },
  "light":    { "enabled": false, "az": 135, "shadow": 0.18, "highlight": 0.3 },   // az° · 135 = arriba-izquierda
  "camera":   { "amount": 0.08, "slide": 0.05, "ease", "maxZoomPerSec", "maxPanPerSec", "maxRotPerSec", "shake": 0, "maxShake": 0.004 },
  "grade":    { "vignette": 0–0.6, "grain": 0–0.08, "letterbox": 0|2.0–2.39, "fade": { "in", "out", "color" }, "barColor" },
  "compose":  { "edgeMargin": 0.04, "anchor": "thirds|center|free", "anchorTol": 0.14, "negativeSpace": 0.4 },
  "rules":    { "glow": false, "gradients": false, "maxColors": 5, "maxChroma": 0.22, "popRatio": 3, "holdEnergy": null },
  "bans":     ["crossfade", "blur-in", "brightness", "3d flip", "flip"]
}
```
Lo no declarado hereda de `engine/styles.mjs → DEFAULTS`. Los `bans` son subcadenas prohibidas en `transition_out`.

## Motivo y morph (v3.5)
Timeline: `"motif": {"id":"seed","states":["dot","ring","frame"],"roleColor":"accent"}` y `motifState` por shot. El shot dibuja con
`api.morph(from, to, u, {x,y,size,fill?,label?})` (catálogo en `engine/shapes.mjs`: dot · ring · bar · frame · card · orbit; añadir una forma = una línea de parámetros).
Las entidades de un relevo exportan `{x, y, s}` y, si aplica, `role` (color-rol), `heading`/`rot` (°) y para `match` `w`,`h`: el lint compara todo.

## Cómo lo usan los shots (contrato v3)
- **La cámara la aplica el motor** desde `shot.cam`. El shot no escala ni traslada el mundo.
- Layout con `api.safe` / `api.at(fx,fy)`; texto con `api.text(str,x,y,{role})`; sujetos con `api.focus(...)`.
- Motivo: `api.morph(...)`. Stop-motion: `api.smear(x,y,vx,vy,fn)` con `api.dt`. 2.5D: `api.ground(fy)`, `api.billboard(...)`.
- Parallax: `api.depth(d, () => {...})`. Luz: `api.glow`. Degradado: `api.gradient`. Ambos respetan `rules`.
- Movimiento: `api.spring(t, kind)` / `springS(t, film, kind)` en `entities`; easing: `api.ease(name?, u)`.
- Colores solo por rol: `api.color('accent')`.
```jsonc
// timeline.json · por shot
"cam": { "move": "push", "amount": 0.06, "why": "approach",   // enum: approach|reveal|follow|compare|unease
         "chain": true, "delay": 0.4, "recenter": false, "shake": 0, "whip": false, "focus": [0.5, 0.5], "dir": [-1, 0], "ease": "cinema" }
"transition_out": "morph"   // cut|morph|match|wipe-obj|scale-cut|hold-cut  (+ poi_out/poi_in si scale-cut)
```

## Límites honestos del motor
Canvas 2D: **no hay** shaders, voz sintética, subtítulos sincronizados por palabra ni animación dibujada cuadro a cuadro; el 3D real existe solo como capa opcional `world3d`. (TeX real y metraje sí existen: `api.tex`, `api.footage`.) Un pack cambia la *estética*, no esas capacidades. Si el encargo las exige, dilo en el brief y usa un backend con soporte (p. ej. Remotion/HyperFrames o Manim) conservando proceso, estilo y lint.
