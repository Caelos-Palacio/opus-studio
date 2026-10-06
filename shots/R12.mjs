// GENERADO desde shots/R12.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as R_mundo from './R_mundo.mjs';
import * as R_eco from './R_eco.mjs';
export default shot({
 "dsl": 1,
 "id": "R12",
 "doc": "LA REVELACIÓN (MS, pull): las placas vuelven en reversa, los cortes son costuras de oro y la rueda se enciende. Después cada golpe releído se repite en oro. Todo lo dirige la memoria (docs/MEMORIA.md): eco (qué planos y con qué fuerza = 1 − peso), hold (0,6 s para que el espectador relea) y revelar_en (retiene la respuesta de «¿por qué gira la rueda?»). Sin capa: película base, sin eco.",
 "libs": {
  "R_mundo": "./R_mundo.mjs",
  "R_eco": "./R_eco.mjs"
 },
 "params": {
  "text": {
   "type": "string",
   "semantic": "la respuesta (default: shot.text del timeline)"
  },
  "eco": {
   "type": "json",
   "default": [],
   "semantic": "callbacks a los planos releídos [{ref, tramo, concepto, giro, fuerza}] (rol eco de la memoria)"
  },
  "hold": {
   "type": "number",
   "range": [
    0,
    2
   ],
   "unit": "s",
   "default": 0,
   "semantic": "pausa antes del primer eco (rol hold de la memoria)"
  },
  "revelar_en": {
   "type": "number",
   "range": [
    0,
    6
   ],
   "unit": "s",
   "default": 1.2,
   "semantic": "cuándo aparece la respuesta, desde el inicio del plano (rol retencion)"
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
   "id": "plan",
   "type": "let",
   "lib": "R_eco",
   "fn": "echoPlan",
   "args": [
    "api",
    "film",
    "t",
    {
     "$expr": "hold"
    },
    {
     "$expr": "eco"
    }
   ],
   "fields": [
    "echoes",
    "wheelEcho",
    "rows"
   ],
   "reads": [
    "hold",
    "eco"
   ],
   "semantic": "ecos releídos ordenados: cuándo suena cada uno y cómo se rotula"
  },
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
     "mood": 0.8,
     "caps": [
      {
       "str": {
        "$expr": "text"
       },
       "t0": {
        "$expr": "t0 + revelar_en"
       },
       "t1": {
        "$expr": "t1 - 0.2"
       },
       "color": "accent2",
       "role": "h2"
      }
     ],
     "echoes": {
      "$expr": "plan_echoes"
     },
     "wheelEcho": {
      "$expr": "plan_wheelEcho"
     }
    }
   ],
   "semantic": "el mundo con los ecos releídos (lee la fuerza de los golpes de OTROS planos: opaco a propósito)"
  },
  {
   "id": "lista",
   "type": "repeat",
   "items": {
    "$expr": "plan_rows"
   },
   "fields": [
    "s",
    "x",
    "y",
    "a"
   ],
   "children": [
    {
     "type": "text",
     "text": {
      "$expr": "lista_s"
     },
     "x": {
      "$expr": "lista_x"
     },
     "y": {
      "$expr": "lista_y"
     },
     "role": "body",
     "color": "accent2",
     "alpha": {
      "$expr": "lista_a"
     },
     "align": "right"
    }
   ]
  }
 ]
}, { R_mundo, R_eco });
