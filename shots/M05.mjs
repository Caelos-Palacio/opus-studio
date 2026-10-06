// GENERADO desde shots/M05.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as M_mundo from './M_mundo.mjs';
export default shot({
 "dsl": 1,
 "id": "M05",
 "doc": "Pasos pequeños de ese giro. Con n pasos de tamaño π/n el punto dibuja un polígono; sus extremos (anillos) para n = 2, 4, 8 se acercan a un mismo sitio.",
 "libs": {
  "M_mundo": "./M_mundo.mjs"
 },
 "fns": {
  "X": {
   "lib": "M_mundo",
   "fn": "X"
  },
  "runStart": {
   "lib": "M_mundo",
   "fn": "runStart"
  }
 },
 "entities": {
  "z": {
   "lib": "M_mundo",
   "fn": "zEntity"
  }
 },
 "objects": [
  {
   "id": "V",
   "type": "let",
   "lib": "M_mundo",
   "fn": "view",
   "args": [
    "film",
    "t"
   ],
   "fields": [
    "oy"
   ]
  },
  {
   "id": "S",
   "type": "let",
   "value": {
    "$expr": "k * 1.5"
   }
  },
  {
   "id": "mundo",
   "type": "plot",
   "lib": "M_mundo",
   "fn": "drawWorld",
   "args": [
    "ctx",
    "api",
    "film",
    "t"
   ],
   "semantic": "plano complejo: eje real, imaginario, arco y punto z"
  },
  {
   "id": "marcas",
   "type": "axis",
   "lib": "M_mundo",
   "fn": "drawTicks",
   "args": [
    "api",
    "film",
    "t"
   ],
   "semantic": "etiquetas numéricas de la recta/plano"
  },
  {
   "id": "ecuacion",
   "type": "equation",
   "steps": {
    "lib": "M_mundo",
    "export": "EQ"
   },
   "semantic": "la ecuación única que muta"
  },
  {
   "id": "lab",
   "type": "repeat",
   "items": [
    [
     48.6,
     "n = 2"
    ],
    [
     53.9,
     "n = 4"
    ],
    [
     57.7,
     "n = 8"
    ]
   ],
   "fields": [
    "a",
    "s"
   ],
   "children": [
    {
     "id": "b",
     "type": "let",
     "value": {
      "$expr": "i < 2 ? runStart(i + 1) - 0.2 : 60"
     }
    },
    {
     "type": "text",
     "text": {
      "$expr": "lab_s"
     },
     "x": {
      "$expr": "X(V, vec(1, 0)) + 80 * S"
     },
     "y": {
      "$expr": "V_oy - 32 * S"
     },
     "role": "body",
     "alpha": {
      "$expr": "seg(t, lab_a, lab_a + 0.8) * (1 - seg(t, b - 0.4, b))"
     },
     "color": "quant"
    }
   ]
  },
  {
   "id": "cierre",
   "type": "text",
   "text": {
    "$shot": "text"
   },
   "x": {
    "$expr": "W / 2"
   },
   "y": {
    "$expr": "H * 0.865"
   },
   "role": "h2",
   "alpha": {
    "$expr": "seg(t, 47.8, 49.0) * (1 - seg(t, 52.4, 53.2))"
   }
  },
  {
   "id": "donde",
   "type": "text",
   "text": "¿Dónde termina con n pasos?",
   "x": {
    "$expr": "W / 2"
   },
   "y": {
    "$expr": "H * 0.865"
   },
   "role": "h2",
   "alpha": {
    "$expr": "seg(t, 53.6, 54.8) * (1 - seg(t, 59.0, 59.9))"
   }
  }
 ]
}, { M_mundo });
