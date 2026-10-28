// GENERADO desde shots/K20.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as K_tipo from './K_tipo.mjs';
export default shot({
 "dsl": 1,
 "id": "K20",
 "doc": "K20 · pulsos 45 → 47. El groove vuelve EN rejilla (el respiro dura 5 pulsos exactos). Esquirlas de LO / ROTO vuelan de vuelta y ENCAJAN en el pulso 1,6 (la misma geometría del golpe, recorrida al revés: u 1→0); al encajar: destello lima, sacudida y anillo.",
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
  "atBeat": {
   "lib": "K_tipo",
   "fn": "atBeat",
   "bind": [
    "film",
    "shot"
   ]
  },
  "jolt": {
   "lib": "K_tipo",
   "fn": "jolt"
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
   "id": "tl",
   "type": "let",
   "value": {
    "$expr": "since(1.6)"
   }
  },
  {
   "id": "T",
   "type": "let",
   "value": {
    "$expr": "atBeat(1.6) - t0"
   }
  },
  {
   "id": "x",
   "type": "let",
   "value": {
    "$expr": "clamp((t - t0) / T)"
   }
  },
  {
   "id": "uu",
   "type": "let",
   "value": {
    "$expr": "1 - ease('inOut', x)"
   }
  },
  {
   "id": "lines",
   "type": "let",
   "lib": "K_tipo",
   "fn": "finalStack",
   "args": [
    "api"
   ]
  },
  {
   "id": "J",
   "type": "let",
   "value": {
    "$expr": "tl >= 0 ? jolt(tl, 30, 10, 7) : vec(0, 0)"
   },
   "fields": [
    "0",
    "1"
   ]
  },
  {
   "id": "golpe",
   "type": "group",
   "translate": {
    "$expr": "vec(J_0, J_1)"
   },
   "children": [
    {
     "id": "L",
     "type": "repeat",
     "items": {
      "$expr": "take(lines, 2)"
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
       "id": "vuelo",
       "type": "group",
       "when": "uu > 0.02",
       "children": [
        {
         "type": "word",
         "lib": "K_tipo",
         "str": {
          "$expr": "L_str"
         },
         "x": {
          "$expr": "L_cx"
         },
         "y": {
          "$expr": "L_cy"
         },
         "size": {
          "$expr": "L_size"
         },
         "opts": {
          "reg": {
           "$lit": "only"
          },
          "alpha": 0
         }
        },
        {
         "type": "shatter",
         "lib": "K_tipo",
         "fn": "shatter",
         "args": [
          "ctx",
          "api",
          {
           "$expr": "L_str"
          },
          {
           "$expr": "L_cx"
          },
          {
           "$expr": "L_cy"
          },
          {
           "$expr": "L_size"
          },
          {
           "u": {
            "$expr": "uu"
           },
           "seed": {
            "$expr": "41 + i"
           },
           "cols": 12,
           "rows": {
            "$expr": "i ? 6 : 8"
           },
           "power": 1.1,
           "curve": 1.6,
           "split": {
            "$expr": "10 * uu"
           },
           "color": "ink"
          }
         ]
        }
       ]
      },
      {
       "type": "word",
       "lib": "K_tipo",
       "str": {
        "$expr": "L_str"
       },
       "x": {
        "$expr": "L_cx"
       },
       "y": {
        "$expr": "L_cy"
       },
       "size": {
        "$expr": "L_size * (1 + 0.04 * kick)"
       },
       "opts": {
        "color": {
         "$expr": "tl >= 0 && tl < 0.25 ? 'accent' : 'ink'"
        },
        "split": {
         "$expr": "6 + 24 * shock"
        }
       },
       "when": "!(uu > 0.02)"
      }
     ]
    }
   ]
  },
  {
   "id": "ea",
   "type": "let",
   "value": {
    "$expr": "clamp(tl / 0.5)"
   },
   "when": "tl >= 0"
  },
  {
   "type": "ring",
   "lib": "K_tipo",
   "fn": "ring",
   "args": [
    "ctx",
    "api",
    {
     "$expr": "S_cx"
    },
    {
     "$expr": "item(lines, 0, 'cy')"
    },
    {
     "$expr": "80 + 900 * ease('outExpo', ea)"
    },
    {
     "$expr": "20 * (1 - ea) + 1"
    },
    {
     "$lit": "accent"
    },
    {
     "$expr": "1 - ea"
    }
   ],
   "when": "tl >= 0"
  },
  {
   "type": "focusOf",
   "lib": "K_tipo",
   "fn": "focusOf",
   "args": [
    "api",
    {
     "$expr": "len(boxes) > 0 ? boxes : vec(box(S_cx - 60, S_cy - 60, 120, 120))"
    },
    {
     "$lit": "frase"
    }
   ]
  }
 ]
}, { K_tipo });
