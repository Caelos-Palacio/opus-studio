# Review

Orden: **lint automático → ritmo → demo-IA → tipo → cine → rigor**. Nada visual se revisa con lint en FIX.

## Automático (`node engine/lint.mjs`)
| check | cómo se mide | perfil |
|---|---|---|
| determinismo | `seek(t)` dos veces, buffers idénticos | todos |
| cobertura / ids / t | validación del timeline | todos |
| cámara de un eje, transiciones prohibidas | texto de `camera` / `transition_out` | todos |
| causalidad | `after` apunta a un shot previo; `premise`/`anomaly` | explainer |
| hechos con fuente | `facts` ∈ `facts.json` con `source` | explainer |
| texto fuera de safe area | cajas de `api.text` vs `profiles.safe` | todos |
| tamaño mínimo de tipo | px reales a la resolución de salida | todos |
| texto/texto y texto/foco | intersección de cajas > 2 % | todos |
| corte en beat ±1 frame | `t[0]` vs rejilla de `audio.json` | reel |
| relevo de entidades | `Prev.entities.X(t) == Next.entities.X(t)` ± tol | todos |
| cámara: razón cerrada | `cam.why` ∈ enum; casa con `move`; ≤1 plano violento por ~8 shots | todos |
| transiciones (taxonomía) | cut sin handoff · morph = handoff + cámara continua + `delay` · match = silueta · scale-cut = poi ±0.06 · wipe-obj ≥ 80 % | todos |
| motivo | `motifState` avanza un estado por shot o hay `cut` | si hay `motif` |
| firma de ritmo | valle→pico en `on_beat_at`; cortes en la acción; hold-cut 2–4 fotogramas | todos |
| peak-end y rima | último 8 % ≥ p70 de energía; primer/último frame dialogan sin ser clones | todos (aviso) |
| foco único | segundo foco < 0.6× el primero; sujeto separado del papel en grises (Δ ≥ 0.30) | todos (aviso) |
| cámara: velocidad | pico de zoom/paneo/giro con la curva real vs. límites del estilo | todos |
| cámara: handheld | amplitud ≤ `maxShake` | todos |
| cámara: continuidad en morph | estado de cámara de ambos shots al solaparse | todos |
| composición: bordes | sujeto (`api.focus`) dentro del margen del encuadre útil (letterbox incl.) | todos |
| composición: anclaje | centroide ponderado cerca de centro/tercios (`compose.anchor`) | según estilo |
| composición: aire | área de sujetos ≤ `1 − negativeSpace` | según estilo |
| tipografía: niveles | ≤ 3 tamaños de tipo a la vez | todos |
| tiempo de lectura | visible ≥ `0,4 s + car/cps` | todos |
| paleta | contraste tinta/papel ≥ 4,5 (7), acentos ≥ 3, croma ≤ `maxChroma`, nº de colores, papel no puro | todos |
| transiciones | `transition_out` sin subcadenas de `bans` del estilo | todos |
| hold > máx. sin silencio | energía de movimiento < `holdEnergy` | todos |
| pop | pico > `popRatio` × mediana de vecinos | todos |

## Guardia y estructura (también en `npm run lint`)
Escaneo estático de shots (Math.random, Date, timers, fetch, ctx.fillText, setTransform → FIX con archivo:línea) · Proxy de ctx (texto crudo, transforms absolutas, fugas de save/restore → FIX; cámara falsa → WARN) · shot sin foco → FIX · determinismo atribuido por shot · prominencia vs focos (WARN) · fuente ausente (WARN) · cam auto sin hornear → FIX.

## Crítico visual (`npm run critic [-- --api]`)
Después del lint, nunca en su lugar. Láminas in/mid/out × color/grises/anotada + hechos medidos + rúbrica (framing, hierarchy, aesthetic, coherence, clarity). Sin `--api`, el agente con visión lee `out/review/<film>/*.png` y responde con el esquema de `packet.md`. Con `--api`, el veredicto se cachea por hash y FIX da exit 1.

## Visual (lo que el lint no puede medir)
- **Hoja de contacto** (`npm run sheet`): 1 still cada 0,5 s, etiqueta `t  shot  beat`. Si un panel se parece al siguiente sin intención, está muerto.
- **Strips** (`npm run strips`): 8 frames alrededor de cada corte y `on_beat_at`. Morphs rotos, texto que salta.
- **Muestreo sistemático**: inicio, medio y fin de cada shot + cada relevo. Nunca frames elegidos a ojo.
- Ritmo al servicio de la idea; look de template; jerarquía; first/last frame rima.
- **Cine** (con la hoja en escala de grises): sujeto legible por valor · lead room y headroom · el tamaño de plano sirve a la idea y no se repite tres veces · la cámara ayuda a entender · temperatura/contraste entre planos · glow/viñeta/grano en su medida (CINE.md §7–9).
- Rigor (explainer): analogías presentadas como literales, simplificaciones no declaradas.

## Audio
- `npm run sound`: SFX del timeline (`shot.sfx`, `autoSfx`) + música con ducking → `data/mix.wav`. loudnorm −14 LUFS en dos pasadas (lo hace `cut.mjs`). Verificar con `ffmpeg -i out/master.mp4 -af ebur128 -f null -`.
- Una señal corta y con picos puede quedar por debajo del objetivo por el límite de true peak; es correcto.

## Veredicto
`SHIP` o `FIX` con `shot  t  problema  arreglo`. Sin FIX cerrado no hay master.
