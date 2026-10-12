# 12 - Anatomy y proyectos similares (2025-2026)

Fecha de investigación: 2026-10-12. Investigación solo de lectura: no se ha instalado ni ejecutado nada de lo encontrado.

Convención: **[V]** = verificado leyendo la página del proyecto (o su LICENSE/README) con WebFetch. **[S]** = visto solo en resultados de búsqueda o blogs secundarios. **[I]** = inferencia nuestra.

## Resumen ejecutivo

- No he encontrado un repo llamado «Anatomy» que sea un explicador ilustrado con IA tal como lo describís. El más cercano es `thebuggeddev/anatomy` (3.5k estrellas), pero es un explorador 3D de anatomía humana sobre un starter de vinext; su README no documenta IA ni licencia. Hay que confirmar con vosotros de qué repo hablabais.
- El repo más útil para la idea de «explicador ilustrado generado por IA» es `vthinkxie/illustrated-explainer-spec`: solo es una especificación en README (sin código), con caché determinista y zoom por clic. Su idea de caché es la más aprovechable.
- Para agentes que escriben código de animación, lo más parecido a lo nuestro es **Remotion + Agent Skills** (63.6k estrellas) y **Manim CE + manim_skill** (MIT). Ambos validan el patrón «reglas pequeñas + ejemplos probados» para el agente.
- Ojo con la licencia de Remotion: el LICENSE.md limita la licencia gratuita a individuos, ONG y empresas de hasta 3 empleados. Un estudio probablemente necesita la licencia de empresa.
- Para «más materia y menos clip-art», las librerías de trazo a mano (rough.js, perfect-freehand) son MIT, ligeras y funcionan sobre canvas 2D.
- Las cinco ideas de más impacto/coste están al final (sección 3).

## 1. «Anatomy» en GitHub

| Repo | Verificado | Qué es | Licencia | Estrellas | Actividad |
|---|---|---|---|---|---|
| github.com/thebuggeddev/anatomy | [V] | Explorador 3D de anatomía humana («built using threejs with GPT 5.6 Sol» según About). El README es la plantilla del starter vinext, no describe la app. Stack: TypeScript, Three.js, Vite, Drizzle, Cloudflare D1, Vercel. | No visible en la página | 3.5k estrellas, 925 forks, 9 commits (la página no muestra fecha) | No verificada |
| github.com/vthinkxie/illustrated-explainer-spec | [V] | Especificación (solo README) de una app local de explicadores: escribes un tema, obtienes una ilustración 16:9 y al pulsar un punto se genera una página hija. La IA genera solo imágenes. | «Do whatever you want with this spec» | 334 estrellas, 46 forks, 3 commits | No verificada |

Lo que el spec propone (y que es relevante para nosotros):
- El servidor guarda los prompts y las claves; el cliente es fino.
- Los IDs de página son hashes deterministas del tema o del padre + coordenadas redondeadas. Las imágenes se guardan en disco, así que una petición repetida no vuelve a llamar al modelo.
- Para hacer zoom, el servidor dibuja un anillo rojo en el punto del clic sobre la imagen padre y se la pasa al modelo como referencia; el prompt pide ampliar la zona marcada sin incluir el marcador.
- Un único texto de estilo compartido se incluye en todos los prompts para mantener coherencia visual.

Otras referencias de «anatomy/explicador» (solo [S]): Open Anatomy Browser (visor académico, no generativo), Transformer Explainer (explorable hecho a mano, referencia de formato), GitDiagram y Code Repo (explican repos de GitHub, no anatomía).

## 2. Proyectos similares

| Proyecto | URL | Licencia | Estado / métricas | Qué aporta | Verif. |
|---|---|---|---|---|---|
| Remotion | https://github.com/remotion-dev/remotion | Licencia propia (LICENSE.md). Gratis para individuos, ONG y empresas ≤3 empleados; resto, licencia de empresa. | 63.6k estrellas; fecha de último commit no visible | Video en React a MP4. Tiene Agent Skills (`.agents/skills`, docs en remotion.dev/docs/ai/skills) para que Claude Code escriba composiciones. | [V] |
| Remotion Agent Skills (guías) | https://www.tella.com/blog/how-to-use-remotion-agent-skills-with-claude-code | — | Blogs secundarios; el número de skills varía entre fuentes | Flujo: una composición, una animación, una pista de subtítulos por prompt. | [S] |
| Motion Canvas | https://github.com/motion-canvas/motion-canvas | MIT | 19.3k estrellas, 955 commits; sin fechas visibles | TypeScript con animaciones como generadores; paquete `2d` para gráficos 2D; editor con preview en tiempo real. Sin IA. | [V] |
| Theatre.js | https://github.com/theatre-js/theatre | Apache-2.0 (core); studio AGPL-3.0 | 12.8k estrellas; la 1.0 «around the corner», desarrollo temporalmente en repo privado | Timeline para animar cualquier variable JS, SVG, 3D. | [V] |
| Manim Community (ManimCE) | https://github.com/ManimCommunity/manim | MIT (copyright 3b1b LLC y Manim Community) | 41.5k estrellas; release no visible | Animaciones matemáticas en Python. | [V] |
| manim_skill (adithya-s-k) | https://github.com/adithya-s-k/manim_skill | MIT (los materiales de ManimGL pueden tener otras licencias) | 1.2k estrellas, 23 commits; `npx skills add` | Skills separadas para ManimCE y ManimGL con reglas por tema y un directorio `tests/` que comprueba los ejemplos. | [V] |
| Generative Manim (raficharm) | https://github.com/raficharm/generative-manim | No indicada en lo visto | Su README marca el Streamlit como «Legacy» | LLM que escribe código Manim. | [S] |
| ManimCat | https://www.sourcepulse.org/projects/27808421 | — | — | Workspace web con modo agente. | [S] |
| Manimator (paper) | https://arxiv.org/html/2507.14306v1 | — | — | Agentes de planificación + código Manim desde papers o prompts. | [S] |
| rough.js | https://github.com/rough-stuff/rough | MIT | 21.3k estrellas; release no visible | Trazos y rellenos a mano (hachure, zigzag, cross-hatch, dots). Controles `roughness`, `bowing`, `hachureGap`, `fillWeight`. Funciona con canvas 2D (`rough.canvas`). | [V] |
| roughViz | https://github.com/jwilber/roughViz | MIT | 7.2k estrellas; sin fechas, mantenimiento incierto (10 issues abiertos) | Gráficos de datos con estilo sketch (bar, pie, line, scatter…) sobre rough.js y D3 v5. | [V] |
| perfect-freehand | https://github.com/steveruizok/perfect-freehand | MIT | 5.8k estrellas; release no visible | `getStroke(points)` devuelve el contorno de un trazo con presión, afinamiento y suavizado. Sirve con Path2D en canvas. | [V] |
| text-to-lottie (diffusionstudio/lottie) | https://github.com/diffusionstudio/lottie | MIT | 5.6k estrellas (la búsqueda cita 5.0k el 3 de agosto de 2026); `npx skills add diffusionstudio/lottie` | Agente (Claude Code, Codex) genera Lottie JSON con preview en vivo que se actualiza al editar. Consejo: dar SVGs o datos reales mejora mucho el resultado. | [V] |
| Rive | https://rive.app | Comercial | — | Animación interactiva de UI. No he encontrado que tenga generación por IA. | [S] |
| Nyx Motion | https://www.producthunt.com/products/nyx-motion | Comercial («freemium» o gratis según la fuente) | Lanzamiento reciente | Motion graphics desde Claude vía MCP, con estudio web para ajustar cámara y timing; export HD. | [S] |
| Claude Design (Anthropic Labs) | https://www.unite.ai/anthropic-launches-claude-design-for-visual-prototyping-and-presentations/ | Producto comercial | Lanzado el 17 de abril de 2026, research preview | Prototipos, slides y mockups desde chat; lee la base de código para construir un design system; exporta PDF, PPTX, HTML. Fuente secundaria, no la página de Anthropic. | [S] |
| Transformer Explainer | https://ojs.aaai.org/index.php/AAAI/article/view/35347 | Código abierto (según el paper) | 125k usuarios según el paper | Explorable sin IA generativa; referencia de formato. | [S] |
| illustrated-explainer-spec | ver sección 1 | Libre | 334 estrellas | Caché determinista y zoom por clic. | [V] |

No he encontrado en fuentes verificables: un generador de «explorable explanations» con IA y código abierto de 2026 que sea sólido; Easing/física (Popmotion/Motion, etc.) ni shaders procedurales en canvas no los he investigado a fondo en esta pasada, así que quedan fuera del informe.

## 3. Top 5 ideas adoptables (impacto/coste)

**1. Reglas pequeñas por tema + ejemplos que se ejecutan en test (menos tokens de agente).**
- Qué es: manim_skill separa las reglas por tema (escenas, animaciones, colores, texto) y tiene un `tests/` que ejecuta los snippets. Remotion recomienda una composición y una animación por prompt.
- Cómo encaja: un directorio `skills/frame-rules/` con un archivo por técnica (trazo, texto, easing, ruido), cada uno con un `frame(ctx, t)` mínimo. El agente lee solo el que necesita. Un script de test renderiza cada snippet a un frame y falla si lanza error.
- Coste: bajo. Impacto: alto en tokens y en errores de agente. [I]

**2. Caché de render por contenido (menos render y menos llamadas).**
- Qué es: el spec de illustrated-explainer guarda imágenes en disco con ID = hash de (prompt/tema + coordenadas redondeadas) y no vuelve a llamar al modelo si ya existe.
- Cómo encaja: hash de (fuente de la escena, parámetros, versión del motor) → PNG/frames en `cache/`. Si el hash coincide, ffmpeg usa los frames ya renderizados. Las escenas que solo cambian en el texto no re-renderizan el fondo, que es la parte cara. [I]
- Coste: bajo-medio. Impacto: alto en iteraciones (el agente itera mucho).

**3. Trazo a mano con rough.js sobre canvas (más materia, menos clip-art).**
- Qué es: rough.js dibuja rectángulos, elipses, paths y rellenos con hachure o zigzag; `roughness` y `bowing` controlan el temblor.
- Cómo encaja: generar las formas una vez con seed fijo (`rough.generator({seed})`) y cachear el resultado de `drawable`; en `frame(ctx,t)` solo se dibuja con transformaciones y alfa en función de `t`. Así `frame` sigue siendo una función pura del tiempo. [I]
- Coste: bajo. Impacto: alto en estilo visual.

**4. Trazos con presión (perfect-freehand) para flechas, subrayados y firmas.**
- Qué es: `getStroke(points)` devuelve el contorno del trazo; con `thinning`, `smoothing` y `streamline` se controla la estética.
- Cómo encaja: el agente declara los puntos de un trazo como datos (SVG path o lista de coordenadas), el motor genera el contorno una vez y lo rellena con `Path2D` y el progreso `t` cambia el `end` del trazo. [I]
- Coste: bajo. Impacto: medio-alto; reemplaza líneas de 1px que se ven «de clip-art».

**5. Bucle de preview en vivo (el patrón de text-to-lottie y Motion Canvas).**
- Qué es: el agente edita una escena y un visor se actualiza al instante; se puede hacer scrub por `t`.
- Cómo encaja: un servidor Vite con un `preview.html` que importa `scene.js` y expone un slider de `t`; el agente solo reescribe ese archivo y el visor recarga. Ahorra renders completos de mp4 mientras se decide el diseño. [I]
- Coste: medio (es un servidor local). Impacto: alto en tiempo de agente y en render.

Orden: 1 y 3 son baratas y rápidas; 2 y 5 son inversiones mayores con retorno en cada iteración; 4 es un complemento de estilo.

## 4. Advertencias

- Muchas páginas no muestran la fecha del último commit ni la última release, así que la «actividad reciente» no está verificada para casi ningún repo.
- Las cifras de estrellas son del momento de la lectura y pueden estar desactualizadas.
- Remotion: el LICENSE.md indica que la licencia gratuita es para ≤3 empleados en empresas; el propio texto anuncia cambios en Remotion 5.0.
- ManimGL incluye material adaptado de 3Blue1Brown con CC BY-NC-SA según un blog; no lo mezclaría con nuestro material sin revisión.

## 5. Fuentes

- https://github.com/thebuggeddev/anatomy
- https://github.com/vthinkxie/illustrated-explainer-spec
- https://github.com/remotion-dev/remotion
- https://github.com/remotion-dev/remotion/blob/main/LICENSE.md
- https://www.tella.com/blog/how-to-use-remotion-agent-skills-with-claude-code
- https://github.com/motion-canvas/motion-canvas
- https://github.com/theatre-js/theatre
- https://github.com/ManimCommunity/manim
- https://github.com/adithya-s-k/manim_skill
- https://github.com/raficharm/generative-manim
- https://arxiv.org/html/2507.14306v1
- https://github.com/rough-stuff/rough
- https://github.com/jwilber/roughViz
- https://github.com/steveruizok/perfect-freehand
- https://github.com/diffusionstudio/lottie
- https://www.producthunt.com/products/nyx-motion
- https://www.unite.ai/anthropic-launches-claude-design-for-visual-prototyping-and-presentations/
- https://ojs.aaai.org/index.php/AAAI/article/view/35347
- https://www.sourcepulse.org/projects/27808421

## Añadido (verificación del director, 2026-10-12)
- **explain-this** (analyticalmonk): plugin de Claude Code que convierte un paper/post/tema en un explicador `index.html`
  autocontenido con figuras Canvas hechas a mano y layout de dos columnas fijo. Es lo más parecido a «explicador
  ilustrado con IA» que es agente + canvas. Fuente: https://www.remoteopenclaw.com/plugins/analyticalmonk-explain-this/explain-this [S]
- Guía de Anthropic «build interactive diagram tools»: usar SVG precisos ya hechos (con IDs de ontología) en vez de que el
  modelo dibuje anatomía; el modelo orquesta, no ilustra. https://claude.com/resources/use-case/build-interactive-diagram-tools [S]
- No se encontró un repo «Anatomy» explicador; pendiente que el usuario dé el enlace exacto.
