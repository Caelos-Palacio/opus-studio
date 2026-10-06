// GENERADO desde shots/K11.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as K_tipo from './K_tipo.mjs';
export default shot({
 "dsl": 1,
 "id": "K11",
 "doc": "K11 · pulsos 24 → 28 (compás 7). Cuenta atrás de filas: 4, 3, 2, 1. En cada pulso se va una (TOC, CLAC, TIC) y las que quedan CRECEN (cartel justificado); la última, PUM, queda tumbada ocupando el alto. Lo roto se reduce a su esencia: el bombo.",
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
  "barPhase": {
   "lib": "K_tipo",
   "fn": "barPhase",
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
  "shake": {
   "lib": "K_tipo",
   "fn": "shake",
   "bind": [
    "P",
    "t"
   ],
   "reads": [
    "chaos"
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
   "id": "left",
   "type": "let",
   "value": {
    "$expr": "since(3) >= 0 ? 1 : since(2) >= 0 ? 2 : since(1) >= 0 ? 3 : 4"
   }
  },
  {
   "id": "since0",
   "type": "let",
   "value": {
    "$expr": "left == 4 ? since(0) : since(4 - left)"
   }
  },
  {
   "id": "p",
   "type": "let",
   "lib": "K_tipo",
   "fn": "pop",
   "args": [
    "api",
    {
     "$expr": "since0"
    },
    {
     "from": {
      "$expr": "left == 4 ? 1 : 1.35"
     }
    }
   ],
   "fields": [
    "s",
    "a"
   ]
  },
  {
   "id": "J",
   "type": "let",
   "value": {
    "$expr": "shake(12 * (1 - 0.5 * lock), 29)"
   },
   "fields": [
    "0",
    "1"
   ]
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
      "$expr": "0.3 + 0.5 * lock"
     },
     "lit": {
      "$expr": "kick"
     }
    }
   ]
  },
  {
   "type": "playhead",
   "lib": "K_tipo",
   "fn": "playhead",
   "args": [
    "ctx",
    "api",
    {
     "$expr": "barPhase()"
    },
    {
     "alpha": 0.7
    }
   ]
  },
  {
   "id": "uno",
   "type": "group",
   "when": "left == 1",
   "children": [
    {
     "id": "size",
     "type": "let",
     "value": {
      "$expr": "fit('PUM', S_h * 0.8)"
     }
    },
    {
     "id": "enP",
     "type": "let",
     "value": {
      "$expr": "kick"
     }
    },
    {
     "type": "word",
     "lib": "K_tipo",
     "str": "PUM",
     "x": {
      "$expr": "S_cx + J_0"
     },
     "y": {
      "$expr": "S_cy + J_1"
     },
     "size": {
      "$expr": "size * p_s * (1 + 0.05 * enP)"
     },
     "opts": {
      "rot": {
       "$expr": "-pi / 2"
      },
      "color": {
       "$expr": "enP > 0.4 ? 'accent' : 'ink'"
      },
      "split": {
       "$expr": "14 * enP + 18 * exp(-since0 * 11)"
      }
     }
    }
   ]
  },
  {
   "id": "varias",
   "type": "group",
   "when": "left != 1",
   "children": [
    {
     "id": "lines",
     "type": "let",
     "lib": "K_tipo",
     "fn": "stack",
     "args": [
      "api",
      {
       "$expr": "take(vec('PUM', 'TIC', 'CLAC', 'TOC'), left)"
      },
      {
       "width": {
        "$expr": "S_w * 0.78"
       },
       "cy": {
        "$expr": "S_cy"
       },
       "maxH": {
        "$expr": "S_h * 0.8"
       },
       "maxSize": 520
      }
     ]
    },
    {
     "id": "L",
     "type": "repeat",
     "items": {
      "$expr": "lines"
     },
     "fields": [
      "str",
      "cx",
      "cy",
      "size",
      "cap"
     ],
     "children": [
      {
       "id": "en",
       "type": "let",
       "value": {
        "$expr": "pget(item(vec('kick', 'hat', 'snare', 'tom'), i))"
       }
      },
      {
       "type": "word",
       "lib": "K_tipo",
       "str": {
        "$expr": "L_str"
       },
       "x": {
        "$expr": "L_cx + J_0"
       },
       "y": {
        "$expr": "L_cy + J_1"
       },
       "size": {
        "$expr": "L_size * p_s * (1 + 0.07 * en)"
       },
       "opts": {
        "color": {
         "$expr": "en > 0.45 ? 'accent' : 'ink'"
        },
        "split": {
         "$expr": "14 * exp(-since0 * 11) + 8 * en"
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
     "$expr": "boxes"
    },
    {
     "$lit": "secuenciador"
    }
   ]
  }
 ]
}, { K_tipo });
