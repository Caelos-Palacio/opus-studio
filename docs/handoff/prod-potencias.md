# Handoff — prod-potencias (spec 012, film POTENCIAS v3 + S10)
Rama `prod-potencias` (worktree .claude/worktrees/prod-potencias). Sin push. Entrega: `out/entregas/potencias_v3.mp4`, `potencias_v3.jpg`, `potencias_ab.jpg` (v2 arriba / v3 abajo). Falta SOLO la nota del usuario (H1; meta ≥ 8, ideal 9).

## A · Check S10 (commit aparte 77bf03d)
- `engine/arc.mjs`: `measure()` recoge los shots que llaman a `api.world3d` (meta `world3d`); `analyze()` emite el aviso `w3d.sin-guion` (check `w3d-sin-guion`, WARN) si un shot con world3d no cae en un beat 3D declarado. Un beat dura hasta el siguiente beat; vale `beat.shot == id` o solapamiento de tiempo.
- Formato: `story.beats[].w3d = { concepto, porque }` (ambos obligatorios; `data/story.schema.json`). Términos en `data/vocab.json` (`w3d.sin-guion` en lint.rule; `w3d-sin-guion` entre los checks del arco). Tests en rojo primero: `test/arc.mjs` (5 comprobaciones S10). `node engine/vocab.mjs lint` = 0.
- Añadido también `story.medium = { id, porque }` al esquema (spec 012 principio 2); los otros films deben usar el mismo formato.

## B · Guion primero
`data/stress/story.json` (nuevo). Beats 3D declarados, con el concepto que el 3D encarna:
- **b3 · P03 (11,5–19 s) la ciudad como volumen**: último tramo a escala humana; lo que aún se recorre a pie tiene profundidad; la cámara se eleva al alejarnos y el volumen se aplana en silueta 2D (13,9→14,8 s).
- **b4 · P04 (19–23,5 s) el suelo plano era una esfera**: globo con terminador y luz desde donde entrará el Sol en P05. La órbita lunar (scene graph 2D, la que gustó) queda intacta (y más visible: dash alpha .38→.6).
- Resto del viaje (P05–P13) SIN 3D a propósito: más allá del cuerpo solo hay puntos y la ventana. El datacenter de P03 (v2) desaparece: no encarnaba nada del guion.
Código: `shots/W_potencias.mjs` (escenas 3D; la ciudad se genera con PRNG sembrado; el globo va en km porque el esquema limita a 1e6), `shots/P_mundo.mjs` (`ride(..., {stage:'back'|'front', earth3d, surf})`, `earthLines`), `shots/P_dsl.mjs` (`cityCam`, `earthCam`, `windowsOn`). Parámetro `w3d` (default true) en P03/P04: apagado = 2D original. La variante `w3d` de potencias.json queda como no-op (default ya true).

## C · Medio
`medium: tecnico_bermellon` (nuevo, `styles/medios/tecnico_bermellon.json`, derivado de `tecnico`): plano técnico/cianotipia con cuadrícula milimetrada, cotas, hoja de plano y acento coral (#F27A5E) en vez del ámbar. Porqué (en story.json `medium.porque`): Potencias es una medición; cada ventana es una cota; el contador, un logaritmo. Fuera el fondo negro; fuera «dorado sobre azul noche». Estilo nuevo `styles/cosmos_plano.json` (cosmos + luz clave az 25° = dirección del Sol de P05 + rim del 3D en cian). Terreno = rayado oblicuo (el medio compone con `screen`: lo oscuro no se ve, hay que dibujar luz); la ventana actual lleva cota con flechas.
Gotcha: bajo `blend: screen` el acento se lava hacia salmón sobre el azul: el chequeo de arc «el acento no aparece nunca» (WARN) no lo encuentra (busca el color puro).

## D · Soundtrack v2
`timeline.sound.overrides` (sin tocar styles/sound/epico.json, que es del sistema): dinámica más ancha (floorDb −27, macro −20; LRA 9,1 → 11 LU), impacto con más sub/transitorio, riser/roll/tom más fuertes; capas nuevas en el pico P10: riser largo de 7,5 s (anticipación bajo la calma visual), `rev` (bloom) a +0,03 s y shimmer a +0,6 s; cue `rev` en P04 (el suelo era una esfera) y shimmer en P03 (la ciudad aparece). Visual del golpe en capas: velo blanco de pantalla completa, disco coral, onda de choque. `node test/sound.mjs`: 15 medibles en verde.
Medido sobre el mp4: −14,2 LUFS, LRA 11,0 LU, true peak −1,5 dBTP (ebur128 peak=true).

## E · Calma previa al pico (arc FIX que apareció al añadir story.json)
Antes no había story ⇒ arc omitido. Con story salió FIX «sin calma antes del pico»: causas medidas (diff por celdas): ventanas y red moviéndose, el «mar» de galaxias (disco al 3 % que saltaba a pantalla completa en t=48,4 s: ELIMINADO), ventana de 8,8e26 que aparecía 1 s antes. Ahora: ventanas atenuadas L>24 hasta el golpe, red apagada antes, última ventana entra a ≤0,2 s del choque. Calma 0,55× la mediana.

## F · DSL y hashes
P03/P04 pasan al DSL con world3d NATIVO (escena en el JSON). Legado JS en `test/fixtures/dsl-legacy/P03.mjs|P04.mjs`; DSL == JS en 6 instantes (`node test/dsl-cov.mjs --check potencias P03,P04`). Cobertura 92,1 → 95,2 % (ratchet 95). **Hashes de referencia de P01–P13 REGENERADOS A PROPÓSITO** (cambian el medio, el terreno, la cota, el golpe): sacados del JS legado con el mismo P_mundo; solo se tocaron las claves de Potencias (script: render del film con el worker de dsl-cov y `Object.assign` por id). D01 sigue pendiente.

## Gates
lint SHIP (15 avisos, 0 FIX), critic SHIP (manual, `out/tmp/verdict.json`; vi láminas de P03/P04/P10/P11 + peek del resto), `npm run master` sin --force. Avisos que quedan: legibilidad del contador (0,625 s), contraste en grises de Neptuno/Próxima/borde, firma de ritmo P01/P11/P13, acento en arc.

## Riesgos / pendiente
- Tests ajenos que fallan en main (no míos): `medios` (film por defecto de mate_papel ya es terracota) y, si el film activo no es el demo, `semántica I2b` (usa out/.film): correr `npm test` con `node engine/opus.mjs use demo`.
- Conflictos probables al integrar con Regla/Reel: `data/vocab.json` (medios nuevos), `data/story.schema.json` (propiedad `medium`), `data/dsl-coverage.json`, `test/fixtures/dsl-legacy/hashes.json` (claves distintas, mismo fichero), STATUS.md (regenerar).
- El mp4 pesa 42 MB (grano del medio; v2 26 MB).
- Sin oído humano: el soundtrack se juzgó por medidas; la nota del usuario decide.
