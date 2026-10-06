// GENERADO desde shots/K18.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as K_tipo from './K_tipo.mjs';
export default shot({
 "dsl": 1,
 "id": "K18",
 "doc": "K18 · el GOLPE (hero). Fotograma 0: negativo de todo el cuadro (ROM/PE negro sobre blanco); fotograma 1: rayos lima; después ROM / PE estalla en esquirlas con smear temporal real (motionBlur de capa) y canales; sacudida con caída e^-9t y dos anillos de onda de choque (señal `shock`).",
 "libs": {
  "K_tipo": "./K_tipo.mjs"
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
   "id": "age",
   "type": "let",
   "value": {
    "$expr": "lt"
   }
  },
  {
   "id": "J",
   "type": "let",
   "lib": "K_tipo",
   "fn": "jolt",
   "args": [
    {
     "$expr": "age"
    },
    {
     "$expr": "40 * (0.5 + shock * 0.5)"
    },
    9,
    18
   ],
   "fields": [
    "0",
    "1"
   ]
  },
  {
   "id": "lines",
   "type": "let",
   "lib": "K_tipo",
   "fn": "stack",
   "args": [
    "api",
    [
     "ROM",
     "PE"
    ],
    {
     "width": {
      "$expr": "S_w * 0.7"
     },
     "cy": {
      "$expr": "S_cy"
     }
    }
   ]
  },
  {
   "id": "sacudida",
   "type": "group",
   "translate": {
    "$expr": "vec(J_0, J_1)"
   },
   "children": [
    {
     "id": "intacta",
     "type": "group",
     "when": "age < 0.07",
     "children": [
      {
       "id": "L0",
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
         "type": "word",
         "lib": "K_tipo",
         "str": {
          "$expr": "L0_str"
         },
         "x": {
          "$expr": "L0_cx"
         },
         "y": {
          "$expr": "L0_cy"
         },
         "size": {
          "$expr": "L0_size * 1.08"
         },
         "opts": {
          "split": 46,
          "alpha": 1,
          "label": "ROMPE"
         }
        }
       ]
      }
     ]
    },
    {
     "id": "estalla",
     "type": "layer",
     "when": "age >= 0.07 && age < 0.4",
     "opts": {
      "motionBlur": {
       "shutter": 1,
       "samples": 5
      }
     },
     "children": [
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
           "$expr": "L_size * lerp(1.08, 1, clamp(lt / 0.3))"
          },
          {
           "u": {
            "$expr": "clamp((lt - 0.05) / 0.85)"
           },
           "seed": {
            "$expr": "21 + i"
           },
           "cols": 12,
           "rows": {
            "$expr": "i ? 7 : 5"
           },
           "power": 1.15,
           "fade": 0.9,
           "split": {
            "$expr": "18 * exp(-lt * 6)"
           }
          }
         ]
        }
       ]
      }
     ]
    },
    {
     "id": "estalla2",
     "type": "group",
     "when": "age >= 0.4",
     "children": [
      {
       "id": "L2",
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
         "type": "shatter",
         "lib": "K_tipo",
         "fn": "shatter",
         "args": [
          "ctx",
          "api",
          {
           "$expr": "L2_str"
          },
          {
           "$expr": "L2_cx"
          },
          {
           "$expr": "L2_cy"
          },
          {
           "$expr": "L2_size * lerp(1.08, 1, clamp(lt / 0.3))"
          },
          {
           "u": {
            "$expr": "clamp((lt - 0.05) / 0.85)"
           },
           "seed": {
            "$expr": "21 + i"
           },
           "cols": 12,
           "rows": {
            "$expr": "i ? 7 : 5"
           },
           "power": 1.15,
           "fade": 0.9,
           "split": {
            "$expr": "18 * exp(-lt * 6)"
           }
          }
         ]
        }
       ]
      }
     ]
    }
   ]
  },
  {
   "id": "ea",
   "type": "let",
   "value": {
    "$expr": "clamp(age / 0.55)"
   }
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
     "$expr": "S_cy"
    },
    {
     "$expr": "60 + 1250 * ease('outExpo', ea)"
    },
    {
     "$expr": "38 * (1 - ea) + 2"
    },
    {
     "$lit": "accent"
    },
    {
     "$expr": "(1 - ea) * clamp(shock + 0.3, 0, 1)"
    }
   ]
  },
  {
   "id": "eb",
   "type": "let",
   "value": {
    "$expr": "clamp((age - 0.08) / 0.6)"
   }
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
     "$expr": "S_cy"
    },
    {
     "$expr": "40 + 1000 * ease('outExpo', eb)"
    },
    {
     "$expr": "22 * (1 - eb) + 1"
    },
    {
     "$lit": "accent2"
    },
    {
     "$expr": "(1 - eb) * 0.8"
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
     "$expr": "len(boxes) > 0 ? boxes : vec(box(S_cx - 60, S_cy - 60, 120, 120))"
    },
    {
     "$lit": "golpe"
    }
   ]
  },
  {
   "type": "impact",
   "at": 0,
   "opts": {
    "frames": 2,
    "mode": "both",
    "x": {
     "$expr": "S_cx"
    },
    "y": {
     "$expr": "S_cy"
    },
    "color": "accent",
    "rays": 28
   }
  }
 ]
}, { K_tipo });
