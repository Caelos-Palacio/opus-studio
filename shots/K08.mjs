// GENERADO desde shots/K08.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as K_tipo from './K_tipo.mjs';
export default shot({
 "dsl": 1,
 "id": "K08",
 "doc": "K08 · pulsos 12 → 16 (un compás). Ocho golpes en corcheas con síncopa; el vocabulario se REPITE (TIC TAC TIC…) y la rejilla visible empieza a asomar (señal `lock` → opacidad de las líneas y fuerza con que cada palabra se pega a su casilla).",
 "libs": {
  "K_tipo": "./K_tipo.mjs"
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
  "snapTo": {
   "lib": "K_tipo",
   "fn": "snapTo",
   "bind": [
    "api"
   ]
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
   "id": "size",
   "type": "let",
   "value": {
    "$expr": "min(185, fit('CLAC', S_w * 0.55))"
   }
  },
  {
   "type": "gridlines",
   "lib": "K_tipo",
   "fn": "gridlines",
   "args": [
    "ctx",
    "api",
    {
     "cols": 4,
     "rows": 8,
     "alpha": {
      "$expr": "0.12 + 0.9 * lock"
     },
     "lit": {
      "$expr": "kick * lock"
     }
    }
   ]
  },
  {
   "id": "golpes",
   "type": "repeat",
   "items": [
    [
     0,
     "TIC",
     3
    ],
    [
     0.5,
     "TAC",
     6
    ],
    [
     1,
     "TIC",
     0
    ],
    [
     1.75,
     "CLAC",
     5
    ],
    [
     2,
     "TIC",
     2
    ],
    [
     2.5,
     "TAC",
     7
    ],
    [
     3.25,
     "PUM",
     1
    ],
    [
     3.5,
     "CRAC",
     4
    ]
   ],
   "fields": [
    "k",
    "str",
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
        "$expr": "S_y0 + ((golpes_row + 0.5) * S_h) / 8"
       }
      },
      {
       "id": "x0",
       "type": "let",
       "value": {
        "$expr": "left ? S_x0 + 40 : S_x1 - 40"
       }
      },
      {
       "id": "col",
       "type": "let",
       "value": {
        "$expr": "golpes_str == 'CRAC' || golpes_str == 'PUM' ? 'accent2' : 'ink'"
       }
      },
      {
       "id": "sn",
       "type": "let",
       "value": {
        "$expr": "snapTo(x0, cy, lock * 0.6)"
       },
       "fields": [
        "0",
        "1"
       ]
      },
      {
       "id": "jit",
       "type": "let",
       "value": {
        "$expr": "(1 - lock) * 26 * sin(i * 7.3 + 1)"
       }
      },
      {
       "type": "word",
       "lib": "K_tipo",
       "str": {
        "$expr": "golpes_str"
       },
       "x": {
        "$expr": "sn_0 + (left ? jit : -jit)"
       },
       "y": {
        "$expr": "sn_1"
       },
       "size": {
        "$expr": "size * p_s"
       },
       "opts": {
        "align": {
         "$expr": "left ? 'left' : 'right'"
        },
        "color": {
         "$expr": "col"
        },
        "split": {
         "$expr": "18 * exp(-age * 12)"
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
}, { K_tipo });
