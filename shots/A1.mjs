// GENERADO desde shots/A1.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as A1lib from './A1_lib.mjs';
export default shot({
 "dsl": 1,
 "id": "A1",
 "doc": "Motivo \"seed\": dot → ring → frame. La cámara la aplica el motor; el layout sale de api.safe / entidades. Parámetros promovidos (F4): editables por metadatos en timeline shots[i].params o por capa /shots/A1/params/<nombre>.",
 "libs": {
  "A1lib": "./A1_lib.mjs"
 },
 "params": {
  "text": {
   "type": "string",
   "semantic": "título del plan (default: shot.text del timeline)"
  },
  "size": {
   "type": "number",
   "range": [
    0.05,
    0.4
   ],
   "unit": "vh",
   "default": 0.17,
   "semantic": "tamaño del punto (fracción del alto visible)"
  },
  "y": {
   "type": "number",
   "range": [
    0.3,
    0.8
   ],
   "unit": "vh",
   "default": 0.55,
   "semantic": "altura del punto"
  },
  "pulse": {
   "type": "number",
   "range": [
    0,
    1
   ],
   "unit": "×",
   "default": 0.3,
   "semantic": "amplitud del latido en cada on_beat_at"
  },
  "glow": {
   "type": "color",
   "default": "accent",
   "semantic": "color del halo (rol de paleta o #hex)"
  },
  "glowAlpha": {
   "type": "number",
   "range": [
    0,
    1
   ],
   "default": 0.35,
   "semantic": "intensidad del halo"
  },
  "textY": {
   "type": "number",
   "range": [
    0,
    1
   ],
   "unit": "safe",
   "default": 0.22,
   "semantic": "altura del título en el área segura"
  },
  "textIn": {
   "type": "number",
   "range": [
    0,
    2
   ],
   "unit": "s",
   "default": 0.2,
   "semantic": "entrada del título (desde el inicio del plan)"
  }
 },
 "entities": {
  "dot": {
   "lib": "A1lib",
   "fn": "dot",
   "fields": [
    "x",
    "y",
    "s"
   ],
   "reads": [
    "size",
    "y",
    "pulse"
   ]
  }
 },
 "objects": [
  {
   "id": "rejilla",
   "type": "group",
   "depth": 0.25,
   "children": [
    {
     "id": "cruces",
     "type": "marks",
     "cols": 9,
     "rows": 4,
     "x0": 0.1,
     "dx": 0.1,
     "y0": 0.15,
     "dy": 0.25,
     "half": 7,
     "color": "shade",
     "lineWidth": 2
    }
   ]
  },
  {
   "id": "halo",
   "type": "glow",
   "x": {
    "$expr": "dot_x"
   },
   "y": {
    "$expr": "dot_y"
   },
   "r": {
    "$expr": "dot_s * 2"
   },
   "color": {
    "$expr": "glow"
   },
   "alpha": {
    "$expr": "glowAlpha"
   }
  },
  {
   "id": "punto",
   "type": "morph",
   "from": "dot",
   "to": "dot",
   "u": 0,
   "x": {
    "$expr": "dot_x"
   },
   "y": {
    "$expr": "dot_y"
   },
   "size": {
    "$expr": "dot_s"
   },
   "label": "punto"
  },
  {
   "id": "tpos",
   "type": "let",
   "value": {
    "$expr": "at(0.5, textY)"
   },
   "fields": [
    "0",
    "1"
   ]
  },
  {
   "id": "titulo",
   "type": "text",
   "text": {
    "$shot": "text"
   },
   "x": {
    "$expr": "tpos_0"
   },
   "y": {
    "$expr": "tpos_1"
   },
   "role": "h1",
   "alpha": {
    "$expr": "spring(t - t0 - textIn)"
   }
  }
 ]
}, { A1lib });
