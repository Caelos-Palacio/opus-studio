// GENERADO desde shots/VT02.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
export default shot({
 "dsl": 1,
 "id": "VT02",
 "doc": "[receta:diagrama_flujo] Del archivo SVG a la lámina: cinco etapas. GENERADO desde shots/VT02.diagrama.json por `node engine/diagramas.mjs build` (spec 020): edita ese archivo y regenera.",
 "objects": [
  {
   "id": "titulo",
   "type": "text",
   "text": {
    "$shot": "text"
   },
   "x": {
    "$expr": "W / 2"
   },
   "y": {
    "$expr": "H * 0.0926"
   },
   "role": "h2",
   "color": "ink"
  },
  {
   "type": "shape",
   "shape": "rect",
   "x": {
    "$expr": "W * 0.2448"
   },
   "y": {
    "$expr": "H * 0.15"
   },
   "w": {
    "$expr": "k * 22"
   },
   "h": {
    "$expr": "k * 22"
   },
   "color": "accent2"
  },
  {
   "type": "text",
   "text": "lo escribe una persona",
   "x": {
    "$expr": "W * 0.2635"
   },
   "y": {
    "$expr": "H * 0.1602"
   },
   "role": "label",
   "color": "ink",
   "align": "left"
  },
  {
   "type": "shape",
   "shape": "rect",
   "x": {
    "$expr": "W * 0.4688"
   },
   "y": {
    "$expr": "H * 0.15"
   },
   "w": {
    "$expr": "k * 22"
   },
   "h": {
    "$expr": "k * 22"
   },
   "color": "ink"
  },
  {
   "type": "text",
   "text": "lo hace el motor",
   "x": {
    "$expr": "W * 0.4875"
   },
   "y": {
    "$expr": "H * 0.1602"
   },
   "role": "label",
   "color": "ink",
   "align": "left"
  },
  {
   "id": "b",
   "type": "repeat",
   "items": [
    [
     0.148,
     0.58,
     0.1478,
     0.17,
     "01",
     "SVG\nassets/svg/*.svg\ndibujado a mano",
     "accent2",
     0.2
    ],
    [
     0.324,
     0.58,
     0.1478,
     0.17,
     "02",
     "sanea\nsin scripts ni href\nfalla con mensaje",
     "ink",
     0.5
    ],
    [
     0.5,
     0.58,
     0.1478,
     0.17,
     "03",
     "traza\npor longitud de path\ntrazo 0..1",
     "ink",
     0.8
    ],
    [
     0.676,
     0.58,
     0.1478,
     0.17,
     "04",
     "recolorea\nroles del medio\ndata-fill / mono",
     "ink",
     1.1
    ],
    [
     0.852,
     0.58,
     0.1478,
     0.17,
     "05",
     "lámina\nbox + flechas\ndesde ~20 líneas",
     "accent2",
     1.4
    ]
   ],
   "fields": [
    "x",
    "y",
    "w",
    "h",
    "n",
    "t",
    "c",
    "d"
   ],
   "children": [
    {
     "type": "box",
     "x": {
      "$expr": "(b_x - b_w / 2) * W"
     },
     "y": {
      "$expr": "(b_y - b_h / 2) * H"
     },
     "w": {
      "$expr": "b_w * W"
     },
     "h": {
      "$expr": "b_h * H"
     },
     "label": {
      "$expr": "b_t"
     },
     "tag": {
      "$expr": "b_n"
     },
     "color": {
      "$expr": "b_c"
     },
     "fill": "paper",
     "banda": 9,
     "lw": 3,
     "sombra": true,
     "alpha": {
      "$expr": "seg(lt, b_d, b_d + 0.45)"
     }
    }
   ]
  },
  {
   "id": "a",
   "type": "repeat",
   "items": [
    [
     0.2267,
     0.58,
     0.2453,
     0.58,
     "accent2",
     0.62
    ],
    [
     0.4027,
     0.58,
     0.4213,
     0.58,
     "ink",
     0.92
    ],
    [
     0.5787,
     0.58,
     0.5973,
     0.58,
     "ink",
     1.22
    ],
    [
     0.7547,
     0.58,
     0.7733,
     0.58,
     "ink",
     1.52
    ]
   ],
   "fields": [
    "x0",
    "y0",
    "x1",
    "y1",
    "c",
    "d"
   ],
   "children": [
    {
     "type": "arrow",
     "x0": {
      "$expr": "a_x0 * W"
     },
     "y0": {
      "$expr": "a_y0 * H"
     },
     "x1": {
      "$expr": "a_x1 * W"
     },
     "y1": {
      "$expr": "a_y1 * H"
     },
     "u": {
      "$expr": "seg(lt, a_d, a_d + 0.4)"
     },
     "color": {
      "$expr": "a_c"
     }
    }
   ]
  },
  {
   "type": "focus",
   "x": {
    "$expr": "W * 0.063"
   },
   "y": {
    "$expr": "H * 0.225"
   },
   "w": {
    "$expr": "W * 0.88"
   },
   "h": {
    "$expr": "H * 0.71"
   },
   "label": "diagrama",
   "weight": 1,
   "hollow": true
  }
 ]
}, {  });
