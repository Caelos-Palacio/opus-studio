// GENERADO desde shots/M01.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as M_mundo from './M_mundo.mjs';
export default shot({
 "dsl": 1,
 "id": "M01",
 "doc": "La pregunta. Una recta azul, el número 1 (el punto ámbar) y e^{iπ}, que se escribe despacio. Nada más hasta que aparece la pregunta.",
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
   "id": "pregunta",
   "type": "text",
   "text": {
    "$shot": "text"
   },
   "x": {
    "$expr": "W / 2"
   },
   "y": {
    "$expr": "H * 0.4"
   },
   "role": "h2",
   "alpha": {
    "$expr": "seg(t, 3.0, 4.4)"
   }
  }
 ]
}, { M_mundo });
