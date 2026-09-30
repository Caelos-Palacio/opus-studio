# Prompts de etapa (copiar tal cual)

## 1. Brief
```
Completa data/brief.md con lo que te di. Devuelve 5 líneas: pieza, arco mute, look, ritmo, lo que no harás. No codees.
```

## 1b. Estilo
```
Traduce la petición a ejes (3 adjetivos, energía, formalidad, calidez, referencia). node engine/style.mjs --list.
Si un pack encaja, úsalo. Si no: --new (desde el más cercano), --palette --apply, edita tipo/movimiento/cámara/grade, y --check.
Devuelve 5 líneas: emoción, energía, referencia, paleta, cámara. Fija style y profile en el timeline. Espera OK.
```

## 2. Hechos (explainer)
```
Escribe data/facts.json. Una entrada por fecha, nombre o afirmación física que aparecerá en pantalla:
{ "id": { "claim", "date", "source" } }. Busca y cita fuente primaria cuando exista. Sin fuente, fuera.
```

## 3. Timeline
```
Escribe data/timeline.json desde el template. Perfil del brief.
Cada shot: id, t, cam (UN movimiento + why; chain en cortes de continuidad), action, on_beat, on_beat_at, text, transition_out.
Aplica las 8 preguntas del DP (CINE.md §1) a cada shot. `cam.why` es un enum cerrado; cada `transition_out` de la taxonomía exige su predicado (CINE.md §4b). Define el `motif` (estados) y `motifState` por shot.
explainer: after, premise, anomaly, facts, cues.
Declara handoffs para toda entidad que cruce un corte. Morph = t solapados.
Corre node engine/lint.mjs --only validate y corrige hasta SHIP. No dibujes todavía.
```

## 4. Viñetas
```
Por cada shot crea storyboard/{ID}.svg siguiendo storyboard/README.md.
Líneas negras, 20–40 trazos, sin color, sin fill salvo 1 foco. Marca con flecha gruesa las entidades del handoff, dibuja la rejilla de tercios (2+2 líneas punteadas), anota el tamaño de plano (ECU…EWS) y la flecha de cámara.
Monta storyboard/STRIP.svg: orden temporal, regla de beats arriba, id+tiempo abajo. No escribas JS.
Al terminar: "STRIP listo. Espero OK."
```

## 5. Corregir una viñeta
```
Rehaz solo storyboard/{ID}.svg: [qué cambiar]. Regenera STRIP.svg. No toques el resto.
```

## 6. Animatic
```
npm run animatic. Revisa out/sheets/animatic.png.
node engine/lint.mjs --only beats, --only camera y --only validate deben dar SHIP. Ajusta t y cam en timeline, no dibujo. Espera OK.
```

## 7. Style lock
```
node engine/render.mjs --still {t} para: primer beat de A1, mitad del film, último beat.
Solo el shot más representativo implementado. Congela paleta y tipo.
```

## 8. Un shot
```
shots/{ID}.mjs. Viñeta = pose del beat 1. Implementa action + camera + on_beat.
Handoff entrante: arranca de Prev.entities.X. Saliente: exporta entities.X.
Layout con api.safe/api.at, texto con api.text({role}), api.focus obligatorio. No muevas la cámara: la aplica el motor desde shot.cam. seek puro.
Antes de entregar: node engine/lint.mjs (sin FIX en {ID}) y node engine/render.mjs --shot {ID} --stills.
```

## 9. Lint
```
npm run lint. Por cada FIX: repara en el shot indicado con el arreglo mínimo. Repite hasta SHIP.
Si un FIX es un falso positivo, ajusta hold_ok o profileOverrides en el timeline y justifícalo en out/gates.md.
```

## 10. Review
```
Solo con lint SHIP. npm run sheet && npm run strips.
Pases: Ritmo → Demo-IA → Tipo → Cine → (Rigor si explainer).
Salida: SHIP o FIX (shot, t, problema, arreglo). Todo FIX visual que el lint pudo haber detectado → anótalo en FUNDAMENTOS.md § Lecciones.
```

## 11. Master
```
npm run master. Si el entorno corta: --chunk 1500 --max-chunks 1 y relanza hasta completar.
Verifica: ffprobe (duración, streams) y ebur128 ≈ −14 LUFS.
```
