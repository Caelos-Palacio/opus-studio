# Proceso de guionistas, directores, animadores y divulgadores

[W] = verificado en la web; [C] = conocimiento previo sin verificar (hipótesis).

| quién | proceso / artefacto | valida | rechaza |
|---|---|---|---|
| Pixar (Coats, Story Spine) [W] | spine de una página; final antes que el medio; reescritura | interés del público | coincidencias que salvan al protagonista, "y luego" |
| Parker y Stone [W] | beats con conectores | entre beats cabe "pero" o "por lo tanto" | "y luego" |
| Pixar Braintrust [W] | story reels feos a propósito, iterados | notas de diagnóstico, **no prescriptivas**; decide el director | ocultar trabajo, notas obligatorias |
| Miyazaki/Ghibli [W] | el storyboard (e-conte) es el guion | una sola autoridad | comité (no copiar "empezar sin final" en un sistema autónomo) |
| Spider-Verse [W] | layout 3D → animación → dibujo encima → comp; animación a doses; ~1 semana por segundo | estilo como restricción técnica medible | — |
| Arcane/Fortiche [W] | 3D pintado + FX 2D; combates a mano; secuencias animadas sobre la música ya fijada | audio bloqueado | — |
| Animación (12 principios) [C] | thumbnails → layout → keys → breakdowns → in-betweens; animatic; hojas de exposición | aprobación por fases: blocking → spline → polish | cambios tardíos |
| MAPPA / sakuga [C] | conte → layout → genga → douga; animadores estrella en los cortes clave | presupuesto de esfuerzo por shot | — |
| Kurzgesagt [W] | investigación + expertos → guion (~12 versiones) → metáforas visuales → voz como base del timing → animación → sonido; >1.200 h por vídeo | revisión por científicos, hoja de fuentes publicada | hechos sin fuente |
| 3Blue1Brown [W/C] | idea central accesible; el visual como misterio; manim (código) | que la idea se sienta como un descubrimiento | fórmulas sin visual honesto |
| Veritasium / Primer / Vsauce / TED-Ed [C] | gancho con un error común / simulación emergente / cadena de preguntas / educador + animador | el gancho es una pregunta, no una tesis | — |
| Mayer [W] | 12 principios multimedia | coherencia, señalización, contigüidad, segmentación, modalidad, preentrenamiento | material extraño, texto que duplica la narración |

## Gates derivados (umbrales heurísticos, a calibrar)
1. Brief: idea central en una frase + pregunta del gancho + público + duración.
2. Spine causal: 100 % de transiciones con "pero" o "por lo tanto"; final escrito antes que el medio.
3. Fuentes: 100 % de afirmaciones numéricas o causales con referencia.
4. Estilo como especificación medible (ya existe: `styles/*.json`).
5. Audio bloqueado antes de animar; un cambio > ±3 % reabre el spine.
6. Segmentos de una idea, de 20–90 s.
7. Coherencia: 0 elementos visuales sin frase del guion.
8. Contigüidad: etiqueta junto al objeto, ±0,5 s; sin texto que duplique la narración.
9. Señalización: ≥90 % de términos nuevos resaltados al nombrarlos.
10. Carga: ≤3 conceptos nuevos por minuto; ≤4 elementos animados a la vez.
11. Animatic aprobado antes de los shots.
12. Presupuesto sakuga: shots hero, normal o simple.
13. Lint en 0 FIX antes de gastar tokens en el crítico.
14. Crítico tipo Braintrust: diagnostica; un solo decisor; notas rechazadas registradas con motivo.
15. Máximo K iteraciones por etapa; al agotarse, escalar o aprobar con deuda explícita; nunca degradar una etapa ya aprobada.
16. Master: todos los gates en verde + hoja de fuentes publicada.

Fuentes: openculture.com (22 reglas de Pixar) · thehustle.co (Parker y Stone) · kurzgesagt.org · gigazine.net (proceso de Kurzgesagt) ·
slashfilm.com/865373 (Ghibli) · mindsetonline.com y atlassian.com (Braintrust) · thewrap.com, creativebloq.com (Spider-Verse) ·
redsharknews.com (Arcane) · 3blue1brown.com/faq · lucidea.com, elearning.adobe.com (Mayer)
