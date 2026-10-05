# MOTOR v4 — arquitectura, algoritmos y fallos previstos

## Invariante
Un fotograma es `seek(ctx, t, film)`: una función pura del tiempo. Todo lo demás (caché de fragmentos, montaje, índice, crítico, motion blur, constraints, autocámara) se apoya en esa pureza. Por eso ningún módulo nuevo guarda estado entre frames. Las memorias (`WeakMap`/`Map`) son cachés de resultados deterministas; borrarlas no cambia ningún píxel.

```
timeline ─► compile ─► seek(t) ─► shots: draw(ctx,t,api) · scene(t)→árbol
                          │         api = texto/foco + prims + scene + layer(fx)
                          ├─ cámara: move | auto (horneada) | track(nodo)
                          └─ grade: post (bloom, aberración) → viñeta/grano → LUT+dither → letterbox
herramientas: lint(+guard) · autocam · cut(fragmentos, EDL) · sound · index/q · critic · assets · doc
```

## Algoritmos (y por qué estos)
| pieza | método | razón |
|---|---|---|
| morph de formas | contornos → remuestreo por longitud de arco (n=72); emparejamiento exterior↔exterior y agujero↔agujero por área+cercanía; sobrantes colapsan al centroide del vecino; mismo sentido de giro + desfase cíclico de mínima distancia cuadrática | evita el “retorcimiento” y las formas que salen volando desde el origen |
| morph de ecuaciones | LCS (programación dinámica O(nm)) sobre el código de carácter de cada glifo; los pares viajan rígidos con arco; solo los huecos entre anclas se deforman | una ∂ sigue siendo ∂ (equivalente a TransformMatchingTex, sin marcar nada a mano) |
| draw-on | recorte por longitud de arco acumulada, contorno a contorno | escritura en orden natural |
| deformación | se aplica a los **puntos de control** tras subdividir (De Casteljau) | resolución infinita; la homografía da perspectiva real |
| partículas | forma cerrada con arrastre lineal: `x(τ)=x₀+gτ/k+(v₀−g/k)(1−e^{−kτ})/k`; emisor evaluado en el instante de nacimiento | cero estado: seek a cualquier t cuesta O(vivas) |
| simulaciones | pasos deterministas con checkpoints cada 60 pasos | seek(t) ≤ 60 pasos, aunque t sea grande |
| streamlines | RK4 sobre el campo normalizado, memorizadas por clave | flujo animado solo con desplazamiento de guiones |
| grafos | Fruchterman–Reingold sembrado, memorizado | mismo grafo → mismo dibujo, siempre |
| constraints | `follow` = posición del objetivo en t−lag (reevaluando `escena(t)`) | retardo sin integrar nada |
| cámara sobre nodo | media en caja temporal de la posición del nodo | inercia sin estado |
| autocámara | `(W+λDᵀD)s=Wb` (banda, O(n)); λ mínimo por bisección en log λ que cumple zoom/s y paneo/s; proyección sobre el conjunto factible (texto dentro del área segura); interpolación Catmull-Rom | la cámara más fiel al sujeto que no marea. D₂ tiene rectas en el núcleo: no desplaza tendencias |
| blur | cadena de reducciones ×2 y ampliación bilineal (≈ gaussiano) | `ctx.filter` no funciona en node-canvas |
| capas desenfocadas | se renderizan a 1/f con f≈r/2 | Nyquist: lo desenfocado no tiene frecuencias que perder (−35 % a −50 % de coste) |
| motion blur | promedio de sub-fotogramas dentro del obturador | exacto porque la capa es función de t |
| aberración | radial ∝ r² con tabla de índices precalculada | la uniforme hace parpadear de color las líneas finas |
| dither | tesela 64² de ruido triangular (TPDF) desfasada por frame | quita el banding en fondos oscuros sin hash por píxel |
| fragmentos | hash de motor-que-afecta-píxeles + estilo + entradas de timeline + código de shots y dependencias + assets | re-render incremental exacto |
| semántica TeX | tokenizador: acentos → q̇/q̈, griegas → glifo, operadores (∂, ∇), estructura descartada | “¿dónde aparece q̇?” sin mirar una imagen |

## Problemas de sistemas parecidos → parche aquí
| sistema | problema | parche |
|---|---|---|
| Manim | depende de TeX Live; render lento; updaters con estado (el seek no es fiable) | MathJax JS con caché; `seek` puro; constraints por reevaluación temporal |
| Motion Canvas | escenas generadoras: saltar a t exige reproducir desde 0 (O(t)) | todo es función de t: O(1) salvo sims (≤ 60 pasos) |
| Remotion | depende del navegador; carrera de carga de fuentes (`delayRender`) | Node puro (node-canvas); lint de fuente ausente; mismo `seek` en el preview |
| After Effects / expresiones | no versionable, sin verificación | todo es datos + código + lint |
| agentes que animan | tipo sobre sujeto, fuera de área segura, cámara falsa, `Math.random`, re-mirar el vídeo | cajas obligatorias vía api, guardia Proxy + escaneo estático, determinismo atribuido, índice consultable |
| VLM como juez | alucina lo medible, caro, inconsistente | recibe los hechos medidos, rúbrica cerrada y JSON validado, caché por hash, pase de coherencia separado |
| node-canvas | sin `filter`, sin `Path2D`, fuentes silenciosas | blur propio, geometría propia, lint de fuente |
| ffmpeg | concat roto por parámetros distintos; color sin etiquetar; loudness; VFR del metraje | encoder idéntico en todos los fragmentos, bt709 explícito, loudnorm en dos pasadas, metraje a fps constante al extraer |
| layouts por fuerzas / sims | no deterministas entre ejecuciones | sembrados y memorizados |
| cajas tras transformaciones | la caja registrada no coincide con los píxeles (p. ej. tarjeta 3D) | las cajas se transportan por la misma homografía |

## Contrato de shot v4
```js
export default {
  params: { size: { type: 'number', range: [0.05, 0.4], unit: 'vh', default: 0.17, semantic: '…' } },   // F4: interfaz pública (api.params / film.params(id, t))
  entities: { dot: (t, film) => ({ x, y, s, role }) },        // relevos (handoffs)
  scene: (t, film) => nodo,                                    // opcional: árbol declarativo
  draw(ctx, t, u, shot, film, api) { … },                      // opcional: modo inmediato (encima de la escena)
};
```
Reglas: texto solo con `api.text/label/tex`; al menos un foco por shot; nada de `setTransform`, `Math.random`, `Date` ni temporizadores; la cámara va en `shot.cam` (move | auto | track). TeX siempre en `String.raw` (así lo precompila `assets --tex`).
Parámetros promovidos, señales, DSL de expresiones y capas de overrides (`data/layers/*.json`): ver `docs/PARAMS.md`. Los valores ajustables se leen de `api.params`, nunca de constantes que un agente tendría que editar en el JS.
