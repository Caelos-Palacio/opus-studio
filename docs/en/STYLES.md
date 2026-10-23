# STYLES: a style is a data file

> English translation of [`STYLES.md`](../../STYLES.md) (Spanish original). Where they differ, the code in `engine/styles.mjs` wins.

The **process** (storyboard, animatic, lint, review, master) is the same for every piece. What changes between a science film, a trailer and a product reel is the **style pack**: `styles/<name>.json`.
Style = *how it looks and moves*. **Profile** (`reel` / `explainer` / `cinematic`, in `engine/profiles.json`) = *how it is paced and what is required*. They are independent axes: `--style noir --profile reel` is valid.

## Catalogue
| pack | default profile | feels | use it for | traits |
|---|---|---|---|---|
| `editorial` | reel | clear, confident | launches, product, brand, light explainers | paper + ink + red accent, medium spring, no effects |
| `scientific` | explainer | contemplative, rigorous | science communication, data, evolving ideas | dark, colour = category, serif, glow as light, slow camera |
| `noir` | cinematic | tense, intimate | trailers, premium brand, narrative | 2.39 letterbox, grain, vignette, amber, spaced serif, `cinema` camera + handheld |
| `kinetic` | reel | aggressive, fast | hype, music, launches, social | black + acid, heavy uppercase type, hard spring, `outExpo` camera |
| `soft` | reel | friendly, light | SaaS, wellness, onboarding | pastel, gradients, soft springs, slow camera |
| `brutalist` | reel | raw, ironic | art, culture, anti-brand | mono, grey + primary red/blue, stepped motion, linear camera |
| `stopmo` | reel | handmade, warm | crafted trailers, warm education | 12 fps quantised, smear, bouncy spring, side light + contact shadow, grain |
| `cosmos` | cinematic | awe, precise, nocturnal | night-sky science communication | blue-black paper, amber + cyan, physical bloom, fog/DOF depth, warm grade with dither |
| `hierro` | cinematic | forceful, tense, epic | combat trailers, power narrative | steel black, bone, red + gold, condensed uppercase, bloom + aberration + grain, heavy camera |
| `nocturno` | explainer | contemplative, rigorous | maths explainers | blue-black slate, ivory, thin lines, soft bloom, colour = mathematical category, Latin Modern type |
| `pulso` | reel | percussive, vibrant | 9:16 reels, music-driven kinetic type | black-blue + acid lime + magenta, giant uppercase, beat-grid cuts, impact frames |
| `suite` | explainer | sober, technical | the README demo GIF | GitHub-dark palette, monospaced type, no post |

`node engine/style.mjs --list` · `npm run gallery` (the same film in every style, with per-style lint, into `out/gallery.png`). The gallery renders the demo film in every style, so a pack with tighter camera limits than the demo may report FIX there; that is a property of the demo, not of the pack.

## Choosing or composing (the Director's job at stage 2)
1. **Translate the request into axes:** 3 adjectives, energy (low/medium/high), formality, warmth, information density, reference (if any).
2. **Does a pack fit?** Use it as-is (`"style": "noir"` in the timeline). One-off tweaks without touching the pack: `"styleOverrides": {...}` in the timeline.
3. **If not, compose one:**
```bash
node engine/style.mjs --new my-brand --from soft            # start from the closest pack
node engine/style.mjs --palette --hue 190 --scheme analogous --mode dark --mood bold --apply my-brand
# edit styles/my-brand.json (type, motion, camera, grade, composition)
node engine/style.mjs --check my-brand                       # taste rules on the palette
OPUS_STYLE=my-brand npm run lint                             # the demo should give SHIP
```
4. **Justify in 5 lines** (emotion, energy, reference, palette, camera) and wait for OK in human mode.

## Axes to parameters
| axis | value | parameters |
|---|---|---|
| **energy** | low | `spring` omega 8-10, zeta 0.9+, `ease` cinema/inOut, camera `maxZoomPerSec` <= 0.12, `stagger` 0.10-0.12 |
| | medium | omega 14, zeta 0.62, inOut, 0.25, 0.06 |
| | high | omega 22-30, zeta 0.45-0.5, outExpo, >= 1.0, 0.03 |
| **formality / luxury** | high | serif, `case:'upper'` + `tracking` 0.1-0.15, dark or cream palette, few colours |
| | low / friendly | rounded sans, `case:'none'`, pastel, gradients |
| | raw | mono, uppercase, saturated primaries (high `maxChroma`) |
| **warmth** | warm | hue 15-55, warm subject on cool background |
| | cool / technical | hue 200-250, analogous or complementary scheme |
| **cinematic** | yes | `letterbox` 2.0-2.39, `vignette` 0.4-0.55, `grain` 0.04-0.07, `shake` <= 0.0015, `compose.anchor:'thirds'` |
| **information density** | high | `anchor:'free'`, semantic colour (`maxColors` 7), small type with low `minFontPx` (explainer profile) |
| **mood** (palette) | | `muted` chroma 0.07, `calm` 0.12, `bold` 0.18, `vivid` 0.24 |

## Copy a reference without copying it
From a reference video or image extract **measurements, not pixels**: (1) background and 2-3 dominant colours into `--palette`/`palette`; (2) serif/sans/mono, case, spacing; (3) cut cadence into the profile and `shotLen`; (4) what the camera does (push, slide, shake) into `camera.*`; (5) grain/vignette/bars into `grade.*`; (6) glow/gradients into `rules.*`. Write down what you copy and what you **forbid** in the brief.

## Pack schema
```jsonc
{
  "name": "", "description": "", "mood": [], "defaultProfile": "reel|explainer|cinematic",
  "palette":  { "paper", "ink", "accent", "accent2", "shade" /* + semantic roles: quant, anom... */ },
  "typeface": { "family", "fallback", "mono", "weights": [1-2], "scale": 1.25-1.8, "base": 30-34, "case": "none|upper", "tracking": 0, "files": [] },
  "motion":   { "spring": { "omega", "zeta" }, "ease": "linear|in|out|inOut|inOutQuint|outExpo|outBack|cinema|step", "stagger": 0.06,
                "stepFps": 0 /* >0 = stop-motion */, "smear": 0 /* 0.04-0.08 */ },
  "light":    { "enabled": false, "az": 135, "shadow": 0.18, "highlight": 0.3 },   // az in degrees; 135 = top-left
  "camera":   { "amount": 0.08, "slide": 0.05, "ease", "maxZoomPerSec", "maxPanPerSec", "maxRotPerSec", "shake": 0, "maxShake": 0.004 },
  "grade":    { "vignette": 0-0.6, "grain": 0-0.08, "letterbox": 0|2.0-2.39, "fade": { "in", "out", "color" }, "barColor", "post": { "bloom", "chroma", "color" } },
  "compose":  { "edgeMargin": 0.04, "anchor": "thirds|center|free", "anchorTol": 0.14, "negativeSpace": 0.4 },
  "rules":    { "glow": false, "gradients": false, "maxColors": 5, "maxChroma": 0.22, "popRatio": 3, "holdEnergy": null },
  "bans":     ["crossfade", "blur-in", "brightness", "3d flip", "flip"]
}
```
Anything undeclared inherits from `DEFAULTS` in `engine/styles.mjs`. `bans` are substrings forbidden in `transition_out`.

## Motif and morph
Timeline: `"motif": {"id":"seed","states":["dot","ring","frame"],"roleColor":"accent"}` plus `motifState` per shot. A shot draws with `api.morph(from, to, u, {x,y,size,fill?,label?})` (catalogue in `engine/shapes.mjs`: dot, ring, bar, frame, card, orbit). Entities handed across a cut export `{x, y, s}` and, where relevant, `role` (colour role), `heading`/`rot` (degrees) and, for `match`, `w`,`h`; lint compares all of them.

## How shots use styles (shot contract)
- **The engine applies the camera** from `shot.cam`. A shot never scales or translates the world.
- Layout with `api.safe` / `api.at(fx,fy)`; text with `api.text(str,x,y,{role})`; subjects with `api.focus(...)`.
- Motif: `api.morph(...)`. Stop-motion: `api.smear(x,y,vx,vy,fn)` with `api.dt`. 2.5D: `api.ground(fy)`, `api.billboard(...)`.
- Parallax: `api.depth(d, () => {...})`. Light: `api.glow`. Gradient: `api.gradient`. Both respect `rules`.
- Motion: `api.spring(t, kind)` / `springS(t, film, kind)` in `entities`; easing: `api.ease(name?, u)`.
- Colours by role only: `api.color('accent')`.
```jsonc
// timeline.json, per shot
"cam": { "move": "push", "amount": 0.06, "why": "approach",   // enum: approach|reveal|follow|compare|unease
         "chain": true, "delay": 0.4, "recenter": false, "shake": 0, "whip": false, "focus": [0.5, 0.5], "dir": [-1, 0], "ease": "cinema" }
"transition_out": "morph"   // cut|morph|match|wipe-obj|scale-cut|hold-cut  (+ poi_out/poi_in for scale-cut)
```
Promoted parameters, signals, the expression DSL and override layers (`data/layers/*.json`): see `docs/PARAMS.md` (Spanish). Adjustable values are read from `api.params`, never from constants an agent would have to edit in the JS.

## What a style pack cannot change
A pack changes the *aesthetic*, not the engine's capabilities. The engine has no shaders, no speech synthesis, no word-synced subtitles and no hand-drawn frame-by-frame animation; real 3D exists only as the optional `world3d` layer. If a commission needs something outside that, say so in the brief and use a backend that supports it (for example Remotion or Manim) while keeping the process, style and lint.
