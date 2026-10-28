// GENERADO desde shots/R04.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as R_mundo from './R_mundo.mjs';
export default shot({
 "dsl": 1,
 "id": "R04",
 "doc": "CALOR (MS): las placas se ponen al rojo, rayos y brasas (18,1 s).",
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
   "semantic": "intensidad del golpe (estruendo: sacudida, flash, chispas); la dirige la memoria por la cadena de relaciones escala"
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
      "y": -0.03,
      "z": 1.15
     },
     "caps": [
      {
       "str": "CALOR",
       "t0": {
        "$expr": "t0 + 2"
       },
       "t1": {
        "$expr": "t0 + 3.6"
       },
       "color": "accent",
       "at": {
        "$expr": "at(0.15, 0.5)"
       }
      }
     ]
    }
   ],
   "semantic": "la criatura, la rueda y el decorado 2.5D del plano (lee la fuerza de los golpes de OTROS planos: opaco a propósito)"
  }
 ]
}, { R_mundo });
