// GENERADO desde shots/R11.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as R_mundo from './R_mundo.mjs';
export default shot({
 "dsl": 1,
 "id": "R11",
 "doc": "GOLPE FINAL (WS): la hoja cae a los 1,6 s; blanco; la criatura estalla; polvo y silencio; la rueda sola; octavo paso (6,0 s).",
 "libs": {
  "R_mundo": "./R_mundo.mjs"
 },
 "params": {
  "fuerza": {
   "type": "number",
   "range": [
    0.5,
    4.5
   ],
   "unit": "×",
   "default": 1,
   "semantic": "intensidad del golpe final (la dirige la memoria: relación escala)"
  }
 },
 "entities": {
  "rueda": {
   "lib": "R_mundo",
   "fn": "wheelEntity",
   "make": [
    {
     "x": 0,
     "y": 0,
     "z": 1
    }
   ]
  }
 },
 "objects": [
  {
   "id": "mundo",
   "type": "world",
   "lib": "R_mundo",
   "fn": "renderShot",
   "args": [
    "ctx",
    "api",
    "film",
    "shot",
    "t",
    {
     "view": {
      "x": 0,
      "y": 0,
      "z": 1
     },
     "tension": 1,
     "mood": 0.5
    }
   ],
   "semantic": "la criatura, la rueda y el decorado 2.5D del plano (lee la fuerza de los golpes de OTROS planos: opaco a propósito)"
  }
 ]
}, { R_mundo });
