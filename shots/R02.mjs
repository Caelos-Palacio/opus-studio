// GENERADO desde shots/R02.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as R_mundo from './R_mundo.mjs';
export default shot({
 "dsl": 1,
 "id": "R02",
 "doc": "CORTE (MS): una diagonal parte las placas; las dos mitades se deslizan; la rueda da un paso (7,9 s). La respuesta de la criatura decrece golpe a golpe (resp) mientras la fuerza crece: la pista que el giro de R12 relee.",
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
      "y": -0.04,
      "z": 1.1
     },
     "caps": [
      {
       "str": "CORTE",
       "t0": {
        "$expr": "t0 + 2.6"
       },
       "t1": {
        "$expr": "t0 + 5.2"
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
