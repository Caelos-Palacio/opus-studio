// GENERADO desde shots/R07.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as R_mundo from './R_mundo.mjs';
export default shot({
 "dsl": 1,
 "id": "R07",
 "doc": "RÁFAGA I (WS): corte, impacto y espina en 1,3 s; se hunde un poco más cada vez.",
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
      "y": 0.02,
      "z": 0.95
     },
     "caps": []
    }
   ],
   "semantic": "la criatura, la rueda y el decorado 2.5D del plano (lee la fuerza de los golpes de OTROS planos: opaco a propósito)"
  }
 ]
}, { R_mundo });
