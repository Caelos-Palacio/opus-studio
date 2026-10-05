# 004 — world3d: 3D real integrado sin costuras

## Intención (usuario, 2026-10-05)
"Integra el 3D con world3d, pero que la integración sea limpia y suave: que no se vea como un VFX de modelo 3D sin
terminar metido en un anime."

## Diagnóstico (por qué el 3D "se nota")
Spike (docs/history/research/07-webgl.md): headless-gl + three r160–r162 (llvmpipe), determinista, ~80–115 ms/fotograma CPU.
Defectos del prototipo: bordes dentados (sin AA), luces planas, sin bloom, superficie limpia sin el grano del film.
Causas típicas del "CG pegado": aliasing; iluminación y paleta propias del 3D; textura limpia frente a 2D con grano;
movimiento perfecto a 30 fps junto a 2D en "twos"; recorte duro sin atmósfera ni sombra de contacto; cámara 3D
desacoplada de la 2D; materiales PBR genéricos en un film dibujado.

## Principio
El 3D NO es un vídeo pegado: es una CAPA del compositor 2D. Pasa por la misma cámara, paleta, luz, medio
(grano/papel/tinta), grade y post que todo lo demás. El estilo del film manda sobre el 3D, nunca al revés.

## Medibles
| aspecto | medible |
|---|---|
| bordes | AA (SSAA 2× o FXAA/SMAA): energía de escalera en bordes ≤ umbral; sin dientes visibles en peek |
| paleta | p95 de ΔE (Lab) de los píxeles 3D al color más cercano de la paleta del estilo/medio ≤ umbral |
| sombreado | modos declarables por estilo: `toon` (bandas cuantizadas + contorno con el mismo grosor/color de tinta que el 2D), `soft` (lambert suave), `ink` (hatching del medio); nunca PBR por defecto |
| textura | el medio (grano, papel, desregistro) se aplica DESPUÉS de componer: espectro de ruido de la región 3D ≈ región 2D (ratio en [0,7; 1,4]) |
| luz | dirección y color de la luz clave vienen del estilo; la misma luz ilumina 2D (glow/sombras) y 3D |
| bordes con el 2D | niebla de profundidad hacia el color del fondo/medio; sombra de contacto; sin rectángulos ni halos de recorte |
| movimiento | cámara 3D derivada de la cámara del shot (seek(t)); opción `step: 2` (3D en twos) cuando el film anima en twos; motion blur coherente con el 2D |
| determinismo | dos renders iguales bit a bit en el mismo backend; hash de fragmento incluye backend + versión de Mesa/three |
| aislamiento | `engine/world3d` es una interfaz: el shot declara escena (datos, params), no código GL; guard/sandbox intactos |
| golden | fotogramas 3D con tolerancia (PSNR ≥ 40 dB); el resto bit a bit |
| coste | ≤ 150 ms/fotograma a 1280×720 con SSAA en CPU (llvmpipe) |

## Escenarios (BDD)
- Dado un shot 2D que declara `world3d` con estilo toon, Cuando se renderiza, Entonces los contornos 3D tienen el grosor y color de tinta del estilo y no hay dientes (AA).
- Dado un medio papel/riso, Cuando se compone una capa 3D, Entonces el grano y la textura cubren la capa 3D igual que el 2D.
- Dado un film en twos, Cuando la capa 3D se mueve, Entonces cambia solo cada 2 fotogramas.
- Dado un objeto 3D sobre el fondo, Entonces su base tiene sombra de contacto y su lejanía se funde en la niebla del color de fondo.
- Dado el mismo t dos veces, Entonces el fotograma es idéntico.
- Dado un shot que intenta código GL o fs, Entonces la guardia da FIX.
- [HUMANO] Dado el shot datacenter rehecho (Potencias), Cuando el usuario lo ve, Entonces "no parece CG pegado".

## Calificaciones
| versión | nota | comentario |
|---|---|---|
| spike datacenter | — | prototipo; aprobado integrar con estas condiciones |
| world3d v1 (datacenter D01 + variante w3d de Potencias P03) | — | implementado (docs/handoff/world3d.md); pendiente de juicio de gusto |
