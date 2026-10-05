# 003 — Mundo visual: personalidad y gusto (no fondo negro)

## Intención (usuario, 2026-10-02, sobre regla/reel/mate)
"Están bien, no son wow. Mi crítica principal: el fondo es solo un espacio negro y monótono; le falta
personalidad y algo de gusto." Referencias: 4 posts de X (maxescu, kevin_t_ngo ×2, bearlyai) — análisis pendiente.

## Calificaciones
| versión | nota | comentario |
|---|---|---|
| regla / reel / mate v1 | "bien, no wow" | fondo negro monótono; falta personalidad y gusto |

## Análisis de referencias (agentes Sonnet; solo miniatura + texto, sin descargar vídeo)
### bearlyai — "Blackwell Silicon to Scale" (48 s, un único HTML hecho con Claude Opus 5.5, WebGL/Three.js inferido)
Zoom de escala de un datacenter a un átomo. El negro NO está vacío: geometría densa con material y perspectiva real
que se pierde en la distancia. Paleta casi monocroma carbón + 2 acentos saturados (amarillo bandejas, rojo cables)
en diagonales paralelas. Micro-detalle repetido (puertos, ranuras). HUD mono técnico: FOV en metros + regla log
vertical (10 m … 0,1 Å). Es Potencias hecho con mundo.
### kevin_t_ngo — piano compuesto con Claude Opus 5.5 + animación JS (45 s, 2160², la más celebrada)
Todo en un medio coherente: crayón/lápiz sobre papel crema con hatching; la luz también está "dibujada". Mundo con
historia (cuarto, lámpara, piano, partitura) y personajes con carisma (mascota de Claude, gato negro). Imperfección
deliberada. Música = acción visual.

### maxescu — historia de la imprenta, 60 s (Claude Opus 5.5 Max + Higgsfield, IA generativa de imagen)
Papel de trapo crema envejecido (manchas, fibras, motas, viñeta: ningún píxel plano); ilustración grabado/stipple
en B/N como stickers recortados con borde blanco irregular (collage); monocromo cálido; sujeto grande descentrado y
cortado por el borde + 2/3 de aire para texto. Material coherente con el tema (papel/tinta para imprenta).
### kevin_t_ngo — "Claude Opus 5 drew every frame using JavaScript" (28 s, 570 k vistas)
Código puro, lo más cercano a nuestro motor: papel crema procedural con fibras + un único punto con tinta granulada
riso (cobalto + violeta). Minimalismo con confianza: la personalidad sale de la SUPERFICIE.

## Patrón común (las 4)
Mismo modelo y, en 2 casos, mismo medio (JS) que nosotros: la diferencia no es el motor sino el gusto —
soporte material (papel/entorno), tinta/textura con grano, paleta propia por pieza, composición con intención,
mundo o personaje con carisma, estética derivada del tema. El vacío negro digital es el anti-patrón.

## Diagnóstico de los nuestros (por impacto)
1. Sin lugar/mundo: vacío con gradiente mínimo (regla: siluetas al ~5 % de contraste).
2. Sin decisión de medio: vector limpio genérico. 3. Paleta: dorado tímido sobre azul noche (cliché); reel es el mejor.
4. Plano frontal, sin parallax ni fuga. 5. Sin grano/viñeta: "digital muerto". 6. Protagonistas sin carisma.
7. Poco detalle, mucho vacío; texto diminuto gris sobre gris. 8. Tipografía sin jerarquía (salvo reel).

## Dirección (borrador)
Un MEDIO por vídeo aplicado a TODO (técnico-3D-con-acentos | papel/crayón | neón-tipográfico): fondo con luz de
color + grano + viñeta + 2–5 capas de parallax con fuga + paleta 1 neutro + 2 acentos + micro-detalle + jerarquía
tipográfica. Mundo/entorno antes que más efectos sobre el vacío. Límite: 3D real con sombreado por píxel, volumétricos
y PBR requieren WebGL (decisión pendiente: ¿añadir backend WebGL/Three.js?).
