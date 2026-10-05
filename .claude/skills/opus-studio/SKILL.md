---
name: opus-studio
description: Motor de producción cinematográfica por código (v4) con dirección de arte y de fotografía ejecutables. Brief → estilo → (hechos) → audio → timeline → viñetas → animatic → shots → lint → índice → crítico → sonido → master por fragmentos (+EDL). TeX real, Bézier/morph, scene graph, 2.5D, fx, partículas, plots, campos, grafos, mapas, metraje. Usar cuando pidan animación, reel, launch, trailer, explainer, película científica o motion graphics en JS/Canvas, en cualquier estilo.
---

Eres el director. Lee CRAFT.md (principios), CINE.md (gusto cinematográfico), STYLES.md (estilos), MOTOR.md (motor v4) y docs/API.md (primitivas). No inventes otro proceso.
Estilo (cómo se ve/mueve) y perfil (ritmo/exigencia) son ejes independientes; ambos salen del encargo.

# Orden fijo (no saltes etapas)

1. BRIEF — completa `data/brief.md`. Devuelve 5 líneas (pieza, arco mute, look, ritmo, lo que no harás). GATE.
2. ESTILO — traduce la petición a ejes (STYLES.md): 3 adjetivos, energía, formalidad, calidez, referencia.
   `node engine/style.mjs --list` → si un pack encaja, úsalo; si no, compón uno (`--new`, `--palette --apply`, edita, `--check`).
   Fija `style` y `profile` (o deja el del pack). Justifica en 5 líneas: emoción, energía, referencia, paleta, cámara. GATE.
3. HECHOS (solo `explainer`) — `data/facts.json`: cada fecha, nombre y afirmación con `source`. Sin fuente, no entra.
4. AUDIO — pista: `node engine/audio.mjs --analyze` (y `timeline.music` para ducking). Sin pista: `--click` (reel) o `--cues` (explainer). SFX: `shot.sfx` y/o `autoSfx` (voces: `node engine/sound.mjs --list`).
5. TIMELINE — `data/timeline.json` desde el template. Por shot: id, t, **cam** (UN movimiento; `why` ∈ approach|reveal|follow|compare|unease; `delay` tras un morph), action, on_beat(_at), text, `transition_out` ∈ cut|morph|match|wipe-obj|scale-cut|hold-cut, y `motifState` si hay `motif` en el film.
   Cámara también puede ser `{move:'auto', subject?, fill?}` (tras SHOTS: `npm run autocam`) o `track:{node,k}` sobre un nodo de la escena.
   Assets externos antes de animar: `npm run assets -- --footage clip.mp4 --id x`; TeX: `npm run assets -- --tex`.
   `explainer`: además after, premise, anomaly, facts, cues. Cada tipo de transición exige su predicado (CINE.md §4b): `morph` = handoff + `cam.chain`; `match` = handoff `kind:"match"`; `scale-cut` = `poi_out/poi_in`; `cut` = sin handoff.
   Aplica las 8 preguntas del DP (CINE.md §1) a cada shot. `node engine/lint.mjs --only validate` hasta SHIP.
6. VIÑETAS — un SVG de trazo por shot + `storyboard/STRIP.svg`, con rejilla de tercios, tamaño de plano y flecha de cámara. Prohibido renderizar el film. GATE.
7. ANIMATIC — `npm run animatic`. Ajusta tiempos y cámara, no dibujo. `--only beats|camera|motion` deben pasar. GATE.
8. STYLE LOCK — 3 stills (`--still`): inicio de A1, mitad, último beat, con grade real. Paleta, tipo y grade congelados.
9. SHOTS — `shots/{ID}.mjs`. Paralelo solo tras el style lock. Primero primitivas semánticas (docs/API.md), después ctx crudo. Cada animador: su viñeta, sus IDs, `npm run lint` antes de entregar.
10. LINT — `npm run autocam` (si hay cam auto) → `npm run lint`. Todo FIX se repara en el shot que lo produce. Luego `npm run index`: desde aquí, consulta con `npm run q` antes de re-renderizar o mirar.
11. REVIEW — solo con lint SHIP: `npm run critic` (láminas in/mid/out × color/grises/anotada; con `--api` si hay clave) + hoja 0,5 s + strips. Pases: ritmo / demo-IA / tipo / **cine** (encuadre, cámara, color) / rigor (explainer). SHIP o FIX. GATE.
12. MASTER — `npm run sound` → `npm run master` (fragmentos con hash: solo se re-renderiza lo cambiado; `npm run plan` lo muestra). Montaje posterior: `data/edit.json` + `node engine/cut.mjs --edit data/edit.json` (re-render desde la fuente, sin pérdida).

Tras el STRIP escribe exactamente:
```
STRIP listo en storyboard/STRIP.svg
Shots: A1 A2 …
Espero OK o correcciones por viñeta.
```

# Contrato de código v4 (lo verifican el lint y la guardia)

- Frame = `seek(ctx, t, film)` puro. Reloj = `frame / fps`. Prohibido Date, Math.random (usar `rng(seed)`), rAF como reloj, CSS transitions, estado entre frames.
- Cada shot exporta `default { draw?(ctx, t, u, shot, film, api), scene?(t, film), entities? }`. Todo shot registra ≥1 foco (api.focus o una primitiva).
- **La cámara la aplica el motor** desde `shot.cam`; el shot NO escala ni traslada el mundo. Parallax: `api.depth(d, fn)`.
- Layout SOLO desde `api.safe` / `api.at(fx,fy)` (incluye letterbox y safe area). Nada de píxeles absolutos ligados a un estilo.
- Texto SOLO con `api.text(str,x,y,{role, screen?})`, `api.label` (se coloca sola) o `api.tex(String.raw`…`)` (ecuaciones; `morphTo` para transformar). Sujetos y zonas que el tipo no debe tapar con `api.focus(x,y,w,h,label,{weight,bleed,hollow})`.
- Luz y degradado con `api.glow` / `api.gradient` (se desactivan solos si el estilo los prohíbe). Colores por rol: `api.color('accent')`.
- Movimiento: `api.spring(t, 'main|soft|snap')` (dentro de `entities`: `springS(t, film, kind)`); easing `api.ease(name?, u)`.
- Motivo: `api.morph(from,to,u,{x,y,size})` (dot|ring|bar|frame|card|orbit). Stop-motion/luz/2.5D: `api.smear`, `api.ground`, `api.billboard`; la luz y `stepFps` salen del estilo.
- Una entidad que cruza un corte se exporta en `entities` (`{x,y,s}` + `role`/`heading` si aplica) y el shot siguiente arranca de `Prev.entities.X(t_corte)`. Declárala en `handoffs`.
- Morph: solapa los `t` de ambos shots; `seek` dibuja los dos; el segundo con `cam.chain:true`.

# Modo autónomo (sin humano)

Cada GATE se sustituye por: `lint` SHIP + un pase de crítico VLM sobre la hoja/strip con la checklist de REVIEW.md (incluido Review-Cine).
Cierra cada GATE con `node engine/gate.mjs close <gate>` (criterios ejecutables de `gates.json`; estado en `out/gates.json`, traza en `out/ledger.jsonl`). Un GATE fallido dos veces seguidas → detente y reporta.

# Límites de ejecución

Si el entorno corta comandos largos: `--chunk 1500 --max-chunks 1` y relanza; los bloques terminados se saltan.
Canvas 2D: sin 3D real, shaders ni voz (el 2.5D es perspectiva/niebla/DOF/homografías). Si el encargo exige más, dilo en el brief. Coste: con post pesado ~0,1–0,17 s/frame a 720p por núcleo; planifica con `npm run plan`.

# Memoria

Al cerrar un film, añade a `FUNDAMENTOS.md § Lecciones` lo que el lint no detectó y el review sí: es el siguiente check a automatizar.
