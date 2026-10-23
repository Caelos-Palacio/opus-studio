# Engine architecture, algorithms and anticipated failures

> English translation of [`MOTOR.md`](../../MOTOR.md) (Spanish original; its title still says "v4", the engine package is v5.0.0 and the shot contract below is unchanged).

## Invariant
A frame is `seek(ctx, t, film)`: a pure function of time. Everything else (fragment cache, montage, index, critic, motion blur, constraints, autocamera) rests on that purity, which is why no module keeps state between frames. The memo tables (`WeakMap`/`Map`) are caches of deterministic results; clearing them changes no pixel.

```
timeline -> compile -> seek(t) -> shots: draw(ctx,t,api) · scene(t) -> tree
                          |         api = text/focus + prims + scene + layer(fx)
                          |- camera: move | auto (baked) | track(node)
                          '- grade: post (bloom, aberration) -> vignette/grain -> LUT+dither -> letterbox
tools: lint(+guard) · autocam · cut(fragments, EDL) · sound · index/q · critic · assets · doc
```

## Algorithms (and why these)
| piece | method | rationale |
|---|---|---|
| shape morph | contours resampled by arc length (n=72); outer<->outer and hole<->hole matched by area + proximity; leftovers collapse to the neighbour's centroid; same winding + cyclic offset of minimum squared distance | avoids "twisting" and shapes flying in from the origin |
| equation morph | LCS (O(nm) dynamic programming) over each glyph's character code; pairs travel rigidly along an arc; only the gaps between anchors deform | a ∂ stays a ∂ (the equivalent of TransformMatchingTex, with nothing marked by hand) |
| draw-on | clip by cumulative arc length, contour by contour | writing in natural order |
| deformation | applied to the **control points** after subdivision (De Casteljau) | infinite resolution; the homography gives real perspective |
| particles | closed form with linear drag: `x(τ)=x₀+gτ/k+(v₀−g/k)(1−e^{−kτ})/k`; emitter evaluated at birth time | zero state: seek to any t costs O(alive) |
| simulations | deterministic steps with checkpoints every 60 steps | seek(t) <= 60 steps however large t is |
| streamlines | RK4 over the normalised field, memoised by key | animated flow just by dash offset |
| graphs | seeded Fruchterman-Reingold, memoised | same graph, same drawing, always |
| constraints | `follow` = target position at t−lag (re-evaluating `scene(t)`) | delay without integrating anything |
| camera on a node | box-average of the node's position over time | inertia without state |
| autocamera | `(W+λDᵀD)s=Wb` (banded, O(n)); smallest λ by bisection in log λ that meets zoom/s and pan/s limits; projection onto the feasible set (text inside the safe area); Catmull-Rom interpolation | the camera most faithful to the subject that does not cause motion sickness. D₂ has straight lines in its kernel: it does not shift trends |
| blur | chain of ×2 reductions and bilinear upsampling (≈ Gaussian) | `ctx.filter` does not work in node-canvas |
| blurred layers | rendered at 1/f with f≈r/2 | Nyquist: what is blurred has no frequencies to lose (−35 % to −50 % cost) |
| motion blur | average of sub-frames inside the shutter | exact because the layer is a function of t |
| aberration | radial ∝ r² with a precomputed index table | uniform aberration makes thin lines flicker in colour |
| dither | 64² tile of triangular noise (TPDF), offset per frame | removes banding on dark backgrounds without a per-pixel hash |
| fragments | hash of pixel-affecting engine + style + timeline inputs + shot code and dependencies + assets | exact incremental re-render |
| TeX semantics | tokeniser: accents -> q̇/q̈, Greek -> glyph, operators (∂, ∇), structure discarded | "where does q̇ appear?" without looking at an image |

## Problems in similar systems, and the patch here
| system | problem | patch |
|---|---|---|
| Manim | depends on TeX Live; slow render; stateful updaters (seek is unreliable) | MathJax in JS with a cache; pure `seek`; constraints by temporal re-evaluation |
| Motion Canvas | generator scenes: jumping to t requires replaying from 0 (O(t)) | everything is a function of t: O(1) except sims (<= 60 steps) |
| Remotion | depends on the browser; font-loading race (`delayRender`) | pure Node (node-canvas); missing-font lint; same `seek` in the preview |
| After Effects / expressions | not versionable, not verifiable | everything is data + code + lint |
| agents that animate | type over subject, outside the safe area, fake camera, `Math.random`, re-watching the video | mandatory boxes via the api, Proxy guard + static scan, per-shot determinism, queryable index |
| VLM as judge | hallucinates what is measurable, expensive, inconsistent | receives measured facts, closed rubric and validated JSON, hash cache, separate coherence pass |
| node-canvas | no `filter`, no `Path2D`, silent fonts | own blur, own geometry, font lint |
| ffmpeg | concat broken by differing parameters; untagged colour; loudness; VFR footage | identical encoder in every fragment, explicit bt709, two-pass loudnorm, footage at constant fps on extraction |
| force layouts / sims | non-deterministic between runs | seeded and memoised |
| boxes after transforms | the registered box does not match the pixels (e.g. a 3D card) | boxes are carried through the same homography |

## Shot contract
```js
export default {
  params: { size: { type: 'number', range: [0.05, 0.4], unit: 'vh', default: 0.17, semantic: '…' } },   // public interface (api.params / film.params(id, t))
  entities: { dot: (t, film) => ({ x, y, s, role }) },        // handoffs across cuts
  scene: (t, film) => node,                                    // optional: declarative tree
  draw(ctx, t, u, shot, film, api) { … },                      // optional: immediate mode (on top of the scene)
};
```
Rules: text only through `api.text/label/tex`; at least one focus per shot; no `setTransform`, `Math.random`, `Date` or timers; the camera lives in `shot.cam` (move | auto | track). TeX always in `String.raw` (so `assets --tex` can precompile it). Shots run in a fail-closed sandbox (Node >= 22.15, `module.registerHooks`).
Promoted parameters, signals, the expression DSL and override layers (`data/layers/*.json`): see `docs/PARAMS.md` (Spanish). Adjustable values are read from `api.params`, never from constants an agent would have to edit in the JS.
