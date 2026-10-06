# Traspaso — prod-reel (spec 012, Reel v2 «Pulso»)

Rama `prod-reel` (desde main 04ed68d). Entregas en `out/entregas/`: `reel_v2.mp4`, `reel_v2.jpg` (hoja 4×3), `reel_ab.jpg` (arriba v1, abajo v2, mismos instantes).

## Decisiones
- **Medio: `neon_pulso`** (nuevo, `styles/medios/neon_pulso.json`, derivado de `neon`). Porqué (también en `data/reel/story.json` → `medium.porque`):
  el reel pregunta qué suena cuando todo se rompe y un letrero de neón roto es el objeto que suena roto (zumba, parpadea, se apaga, se reenciende).
  Luz aditiva ⇒ nunca negro vacío: ladrillo ciruela, bruma/bokeh de color, suelo mojado con reflejo. Acentos lima + magenta (los del estilo pulso).
- **Tubo de neón en `shots/K_tipo.mjs`** (`word`/`tubeLetter`, activo solo con `rules.tube` del medio): cada letra es contorno de vidrio con
  halo, núcleo caliente y cuerpo que se llena con el bombo; pozo de luz sobre el muro. El halo cuenta el estado: magenta = roto (señal `chaos`),
  lima = enganchado (`lock`/orden). Con caos la letra tartamudea (`litOf`); un tubo apagado sigue viéndose (vidrio). Los .scene.json NO se tocaron
  (toda la mejora vive en la librería y el medio, así DSL y JS legado siguen idénticos).
- **Guion**: tesis reescrita con el letrero; beats con la puesta en escena (apagón antes del golpe, reignición uno a uno); `accent.means` = color de estado.
  Tiempos de beats y pico (22,0 s) intactos. Memoria: lecturas de estados con el letrero (mismos conceptos y relaciones).
- **Señal `chaos`** (build.mjs): en el regreso (rev0) sube a 0,7 y cae a 0 en 2 pulsos ⇒ los tubos se reencienden tartamudeando.
- 3D: no (el guion no lo pide).

## Soundtrack v2 (estilo `electro`)
- Voz nueva `buzz` en `engine/sounddesign.mjs` (**único cambio de motor**, aditivo y opt-in con `sfx.buzz` del estilo): zumbido de tubo afinado a la
  tónica (12 armónicos filtrados) con caídas y chisporroteo según la señal `chaos` del timeline; bus `amb` ⇒ el vacío del golpe lo corta como apagón
  y vuelve en la reignición. Otros estilos no cambian (test/sound.mjs verde en Potencias).
- `electro.json`: floorDb −21 (más rango dinámico), hats antes (thr 0,32), arp/hat/clap del groove más presentes, buzz gain 0,8.
- K01: dos tics ascendentes (entonación de la pregunta).
- Medido sobre el mp4: −14,1 LUFS, LRA 8,1 LU, true peak −1,6 dBTP (v1: −14,1 / 7,2 / −1,8).

## Tests / hashes
- `test/fixtures/dsl-legacy/hashes.json`: SOLO las 24 entradas K01–K24 regeneradas a propósito (el medio cambia todos los píxeles del reel). Se obtuvieron
  del render DSL y se verifican contra el JS legado (C3b). Ratchet de cobertura intacto (92,1 %).
- `data/vocab.json`: término `neon_pulso` en medios.
- Fallos previos a esta rama (no son de reel): `medios` V4 y «film carga el medio declarado papel_crema_terracota` (mate_papel→terracota en main).
- `semántica I2b` depende del film activo: falla si `out/.film` apunta a reel; sin film fijado pasa.

## Pipeline para regenerar
`node engine/grid.mjs` → `node data/reel/build.mjs` → `node engine/grid.mjs` → `npm run sound` → `node engine/grid.mjs --mix` → `npm run lint` →
`npm run critic` (+ `--verdict`, veredicto manual del agente sobre láminas) → `npm run master` (sin --force).

## Riesgos
- Parpadeo/tartamudeo de tubos a ~11 Hz con caos alto (warnings `pop` del lint); sin nota humana aún (H1).
- `ab.mjs` en forma larga encoge 9:16 a 16:9; la hoja A/B se montó con dos `peek` apilados.
