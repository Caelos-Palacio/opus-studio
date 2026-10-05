// GENERADO desde shots/M08.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as M_mundo from './M_mundo.mjs';
export default shot({
 "dsl": 1,
 "id": "M08",
 "doc": "Regreso a casa. El punto vuelve a 1 por el arco, que se deshace al pasarlo; la vista regresa a la recta del principio.",
 "libs": {
  "M_mundo": "./M_mundo.mjs"
 },
 "entities": {
  "z": {
   "lib": "M_mundo",
   "fn": "zEntity"
  }
 },
 "objects": [
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
    "$expr": "seg(t, 83.0, 84.6)"
   }
  }
 ]
}, { M_mundo });
