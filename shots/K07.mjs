// GENERADO desde shots/K07.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as K_tipo from './K_tipo.mjs';
import * as K_dsl from './K_dsl.mjs';
export default shot({
 "dsl": 1,
 "id": "K07",
 "doc": "K07 · pulsos 8 → 12 (un compás). RUIDO: cinco golpes sueltos (onomatopeyas) en síncopa 3+3+4+3+3 semicorcheas, en filas desordenadas. Cada golpe cae en una semicorchea que NO es un pulso: el ojo y el oído oyen ruido porque la rejilla todavía no se ve.",
 "libs": {
  "K_tipo": "./K_tipo.mjs",
  "K_dsl": "./K_dsl.mjs"
 },
 "fns": {
  "since": {
   "lib": "K_tipo",
   "fn": "since",
   "bind": [
    "film",
    "shot",
    "t"
   ]
  },
  "fit": {
   "lib": "K_tipo",
   "fn": "fit"
  },
  "rngAt": {
   "lib": "K_dsl",
   "fn": "rngAt"
  }
 },
 "params": {
  "kick": {
   "type": "number",
   "range": [
    0,
    2
   ],
   "default": 0,
   "semantic": "envolvente de los onsets del bombo: golpe de escala"
  },
  "snare": {
   "type": "number",
   "range": [
    0,
    2
   ],
   "default": 0,
   "semantic": "envolvente de caja/palmas/toms: destello y corte de tiras"
  },
  "hat": {
   "type": "number",
   "range": [
    0,
    2
   ],
   "default": 0,
   "semantic": "envolvente de hats: titileo"
  },
  "tom": {
   "type": "number",
   "range": [
    0,
    2
   ],
   "default": 0,
   "semantic": "envolvente de toms: cuarta voz del secuenciador"
  },
  "chaos": {
   "type": "number",
   "range": [
    0,
    1
   ],
   "default": 0.5,
   "semantic": "desorden: 1 = ruido (tiras y temblor), 0 = todo alineado"
  },
  "lock": {
   "type": "number",
   "range": [
    0,
    1
   ],
   "default": 0,
   "semantic": "cuánto se pega el contenido a la rejilla visible"
  },
  "shock": {
   "type": "number",
   "range": [
    0,
    2
   ],
   "default": 0,
   "semantic": "onda de choque tras el golpe (sacudida, canales, anillo)"
  },
  "tension": {
   "type": "number",
   "range": [
    0,
    1.5
   ],
   "default": 0,
   "semantic": "tensión acumulada del crescendo (compresión, brillo del acento)"
  },
  "drift": {
   "type": "number",
   "range": [
    -1,
    1
   ],
   "default": 0,
   "semantic": "deriva lenta (LFO): respiración en los respiros"
  },
  "text": {
   "type": "string",
   "semantic": "texto principal del shot (default shot.text)"
  }
 },
 "objects": [
  {
   "id": "golpes",
   "type": "repeat",
   "items": [
    [
     0,
     "CRAC",
     "accent2",
     2
    ],
    [
     0.75,
     "TAC",
     "ink",
     0
    ],
    [
     1.5,
     "PUM",
     "ink",
     4
    ],
    [
     2.5,
     "CLIC",
     "ink",
     1
    ],
    [
     3.25,
     "BUM",
     "accent2",
     3
    ]
   ],
   "fields": [
    "k",
    "str",
    "color",
    "row"
   ],
   "children": [
    {
     "id": "age",
     "type": "let",
     "value": {
      "$expr": "since(golpes_k)"
     }
    },
    {
     "type": "group",
     "when": "age >= 0",
     "children": [
      {
       "id": "p",
       "type": "let",
       "lib": "K_tipo",
       "fn": "pop",
       "args": [
        "api",
        {
         "$expr": "age"
        },
        {
         "from": 1.15
        }
       ],
       "fields": [
        "s",
        "a"
       ]
      },
      {
       "id": "size",
       "type": "let",
       "value": {
        "$expr": "min(340, fit(golpes_str, S_w * 0.8))"
       }
      },
      {
       "id": "left",
       "type": "let",
       "value": {
        "$expr": "i % 2 == 0"
       }
      },
      {
       "id": "cy",
       "type": "let",
       "value": {
        "$expr": "S_y0 + ((golpes_row + 0.5) * S_h) / 5"
       }
      },
      {
       "type": "word",
       "lib": "K_tipo",
       "str": {
        "$expr": "golpes_str"
       },
       "x": {
        "$expr": "left ? S_x0 + 30 : S_x1 - 30"
       },
       "y": {
        "$expr": "cy"
       },
       "size": {
        "$expr": "size * p_s"
       },
       "opts": {
        "align": {
         "$expr": "left ? 'left' : 'right'"
        },
        "color": {
         "$expr": "golpes_color"
        },
        "rot": {
         "$expr": "(rngAt(7, i) - 0.5) * 0.07 * exp(-age * 5)"
        },
        "split": {
         "$expr": "26 * exp(-age * 11)"
        }
       }
      }
     ]
    }
   ]
  },
  {
   "type": "focusOf",
   "lib": "K_tipo",
   "fn": "focusOf",
   "args": [
    "api",
    {
     "$expr": "len(boxes) > 0 ? boxes : vec(box(S_cx - 10, S_cy - 10, 20, 20))"
    },
    {
     "$lit": "ruido"
    }
   ]
  }
 ]
}, { K_tipo, K_dsl });
