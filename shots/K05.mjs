// GENERADO desde shots/K05.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as K_tipo from './K_tipo.mjs';
import * as K_dsl from './K_dsl.mjs';
export default shot({
 "dsl": 1,
 "id": "K05",
 "doc": "K05 · pulso 5 → 6. TO / DO / SE: tres líneas justificadas que llenan el cuadro; las letras CAEN una a una (muelle del estilo, escalonadas).",
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
  },
  "stagger": {
   "lib": "K_dsl",
   "fn": "stagger",
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
   "id": "age",
   "type": "let",
   "value": {
    "$expr": "since(0)"
   }
  },
  {
   "id": "J",
   "type": "let",
   "value": {
    "$expr": "shake(12, 5)"
   },
   "fields": [
    "0",
    "1"
   ]
  },
  {
   "id": "st",
   "type": "let",
   "value": {
    "$expr": "stagger() * 1.3"
   }
  },
  {
   "type": "word",
   "lib": "K_tipo",
   "str": "¿",
   "x": {
    "$expr": "S_x0 + 56"
   },
   "y": {
    "$expr": "S_y0 + 135"
   },
   "size": {
    "$expr": "180"
   },
   "opts": {
    "color": "accent",
    "align": "left",
    "alpha": 0.95
   }
  },
  {
   "id": "lines",
   "type": "let",
   "lib": "K_tipo",
   "fn": "stack",
   "args": [
    "api",
    [
     "TO",
     "DO",
     "SE"
    ],
    {
     "width": {
      "$expr": "S_w * 0.78"
     },
     "cy": {
      "$expr": "S_cy"
     },
     "maxH": {
      "$expr": "S_h * 0.8"
     }
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
      "$expr": "L_size"
     },
     "opts": {
      "label": "TODO"
     },
     "per": {
      "dy": {
       "$expr": "-(1 - spring((age - i * 0.06 - pk * st), 'snap')) * 0.9 * L_size"
      },
      "a": {
       "$expr": "clamp((age - i * 0.06 - pk * st) / 0.03)"
      },
      "s": {
       "$expr": "lerp(1.15, 1, clamp(spring((age - i * 0.06 - pk * st), 'snap')))"
      }
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
     "$expr": "boxes"
    },
    {
     "$lit": "pregunta"
    }
   ]
  }
 ]
}, { K_tipo, K_dsl });
