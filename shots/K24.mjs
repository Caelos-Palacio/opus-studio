// GENERADO desde shots/K24.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as K_tipo from './K_tipo.mjs';
export default shot({
 "dsl": 1,
 "id": "K24",
 "doc": "K24 · pulso 55 → fin. La frase se contrae hacia el centro y en su lugar queda UN punto lima del tamaño de la ¿ del principio: respuesta y rima (primer y último fotograma dialogan).",
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
   "id": "a0",
   "type": "let",
   "value": {
    "$expr": "since(0)"
   }
  },
  {
   "id": "c",
   "type": "let",
   "value": {
    "$expr": "ease('inOut', clamp(since(0.6) / (atBeat(1.6) - atBeat(0.6))))"
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
     "$expr": "since(1.6)"
    },
    {
     "from": 0.4,
     "kind": "main"
    }
   ],
   "fields": [
    "s",
    "a"
   ]
  },
  {
   "id": "fl",
   "type": "let",
   "value": {
    "$expr": "exp(-max(0, a0) * 8)"
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
   "id": "contrae",
   "type": "group",
   "when": "c < 0.97",
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
       "id": "kk",
       "type": "let",
       "value": {
        "$expr": "1 - c"
       }
      },
      {
       "id": "sc",
       "type": "let",
       "value": {
        "$expr": "lerp(1, 0.05, c)"
       }
      },
      {
       "type": "word",
       "lib": "K_tipo",
       "str": {
        "$expr": "L_str"
       },
       "x": {
        "$expr": "S_cx + (L_cx - S_cx) * kk"
       },
       "y": {
        "$expr": "S_cy + (L_cy - S_cy) * kk"
       },
       "size": {
        "$expr": "L_size * sc * (1 + 0.04 * fl)"
       },
       "opts": {
        "alpha": {
         "$expr": "clamp(1 - c * 1.2)"
        },
        "color": {
         "$expr": "fl > 0.3 ? 'accent' : 'ink'"
        },
        "reg": false
       }
      }
     ]
    }
   ]
  },
  {
   "id": "punto",
   "type": "group",
   "when": "p_a > 0 && since(1.6) >= 0",
   "children": [
    {
     "id": "r",
     "type": "let",
     "value": {
      "$expr": "200 * p_s * (1 + 0.04 * kick)"
     }
    },
    {
     "type": "dot",
     "lib": "K_tipo",
     "fn": "dot",
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
       "$expr": "r"
      },
      {
       "$lit": "accent"
      },
      {
       "$expr": "1"
      }
     ]
    },
    {
     "type": "box",
     "x": {
      "$expr": "S_cx - r"
     },
     "y": {
      "$expr": "S_cy - r"
     },
     "w": {
      "$expr": "2 * r"
     },
     "h": {
      "$expr": "2 * r"
     }
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
     "$lit": "frase"
    }
   ]
  }
 ]
}, { K_tipo });
