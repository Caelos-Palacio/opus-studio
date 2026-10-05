// GENERADO desde shots/A3.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as A3lib from './A3_lib.mjs';
import * as A2 from './A2.mjs';
export default shot({
 "dsl": 1,
 "id": "A3",
 "doc": "A3 usa A2 (A3lib.dot parte de A2.entities.dot): A2 se importa para declarar la dependencia. ring → frame: el anillo endereza su radio hasta ser marco; el texto vive en el vacío.",
 "libs": {
  "A3lib": "./A3_lib.mjs",
  "A2": "./A2.mjs"
 },
 "params": {
  "text": {
   "type": "string",
   "semantic": "frase final (default: shot.text del timeline)"
  },
  "pulse": {
   "type": "number",
   "range": [
    0,
    1
   ],
   "unit": "×",
   "default": 0.2,
   "semantic": "amplitud del latido del marco en cada on_beat_at"
  },
  "accent": {
   "type": "color",
   "default": "accent",
   "semantic": "color inicial del degradado del marco"
  },
  "accent2": {
   "type": "color",
   "default": "accent2",
   "semantic": "color final del degradado del marco"
  },
  "hitAt": {
   "type": "number",
   "range": [
    0,
    2
   ],
   "unit": "s",
   "default": 1,
   "semantic": "instante del acento (desde el inicio del plan)"
  },
  "hitDur": {
   "type": "number",
   "range": [
    0.02,
    0.5
   ],
   "unit": "s",
   "default": 0.1,
   "semantic": "duración del acento"
  },
  "hitColor": {
   "type": "color",
   "default": "accent",
   "semantic": "color del acento"
  },
  "hitR": {
   "type": "number",
   "range": [
    2,
    40
   ],
   "unit": "px",
   "default": 14,
   "semantic": "radio del acento"
  },
  "textIn": {
   "type": "number",
   "range": [
    0,
    2
   ],
   "unit": "s",
   "default": 0.7,
   "semantic": "entrada de la frase"
  }
 },
 "entities": {
  "dot": {
   "lib": "A3lib",
   "fn": "dot",
   "fields": [
    "x",
    "y",
    "s",
    "u"
   ],
   "reads": [
    "pulse"
   ]
  }
 },
 "camera": {
  "move": "pull",
  "why": "reveal"
 },
 "transition": {
  "out": "cut"
 },
 "cues": [
  {
   "id": "acento",
   "at": {
    "$expr": "hitAt"
   },
   "dur": {
    "$expr": "hitDur"
   },
   "semantic": "golpe de luz en el borde superior del marco"
  }
 ],
 "objects": [
  {
   "id": "suelo",
   "type": "ground",
   "fy": 0.86,
   "alpha": 0.22
  },
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
   "id": "degradado",
   "type": "gradient",
   "x0": {
    "$expr": "dot_x - dot_s"
   },
   "y0": {
    "$expr": "dot_y - dot_s"
   },
   "x1": {
    "$expr": "dot_x + dot_s * 2"
   },
   "y1": {
    "$expr": "dot_y + dot_s"
   },
   "stops": [
    {
     "$expr": "accent"
    },
    {
     "$expr": "accent2"
    }
   ],
   "fallback": "ink"
  },
  {
   "id": "marco",
   "type": "morph",
   "from": "ring",
   "to": "frame",
   "u": {
    "$expr": "dot_u"
   },
   "x": {
    "$expr": "dot_x"
   },
   "y": {
    "$expr": "dot_y"
   },
   "size": {
    "$expr": "dot_s"
   },
   "fill": {
    "$expr": "degradado"
   },
   "label": "marco",
   "lit": false
  },
  {
   "id": "borde",
   "type": "let",
   "value": {
    "$expr": "dot_y - marco_h / 2"
   }
  },
  {
   "id": "foco",
   "type": "focus",
   "x": {
    "$expr": "dot_x - 16"
   },
   "y": {
    "$expr": "borde - 16"
   },
   "w": 32,
   "h": 32,
   "label": "acento",
   "weight": 0.3
  },
  {
   "id": "golpe",
   "type": "shape",
   "shape": "circle",
   "cue": "acento",
   "x": {
    "$expr": "dot_x"
   },
   "y": {
    "$expr": "borde"
   },
   "r": {
    "$expr": "hitR"
   },
   "color": {
    "$expr": "hitColor"
   }
  },
  {
   "id": "frase",
   "type": "text",
   "text": {
    "$shot": "text"
   },
   "x": {
    "$expr": "dot_x"
   },
   "y": {
    "$expr": "dot_y"
   },
   "role": "body",
   "alpha": {
    "$expr": "spring(lt - textIn)"
   }
  }
 ]
}, { A3lib, A2 });
