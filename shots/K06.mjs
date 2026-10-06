// GENERADO desde shots/K06.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as K_tipo from './K_tipo.mjs';
export default shot({
 "dsl": 1,
 "id": "K06",
 "doc": "K06 · pulsos 6 → 8. ROM / PE entra en el pulso 1; en el 2.º se agrieta y la ? lima golpea abajo: la pregunta se cierra… y no tiene respuesta.",
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
  "glitch": {
   "lib": "K_tipo",
   "fn": "glitch",
   "bind": [
    "P",
    "t"
   ],
   "reads": [
    "chaos",
    "snare",
    "kick"
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
   "id": "a1",
   "type": "let",
   "value": {
    "$expr": "since(1)"
   }
  },
  {
   "id": "p0",
   "type": "let",
   "lib": "K_tipo",
   "fn": "pop",
   "args": [
    "api",
    {
     "$expr": "a0"
    },
    {
     "from": 1.1
    }
   ],
   "fields": [
    "s",
    "a"
   ]
  },
  {
   "id": "p1",
   "type": "let",
   "lib": "K_tipo",
   "fn": "pop",
   "args": [
    "api",
    {
     "$expr": "a1"
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
   "id": "J",
   "type": "let",
   "value": {
    "$expr": "shake(18, 6)"
   },
   "fields": [
    "0",
    "1"
   ]
  },
  {
   "id": "j1",
   "type": "let",
   "value": {
    "$expr": "a1 >= 0 ? exp(-a1 * 14) : 0"
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
    "$expr": "S_y0 + 150"
   },
   "size": {
    "$expr": "160"
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
     "ROM",
     "PE"
    ],
    {
     "width": {
      "$expr": "S_w * 0.78"
     },
     "cy": {
      "$expr": "S_cy - 120"
     },
     "gap": 0.22
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
     "id": "g",
     "type": "let",
     "value": {
      "$expr": "glitch(L_size, 6 + i)"
     }
    },
    {
     "type": "word",
     "lib": "K_tipo",
     "str": {
      "$expr": "L_str"
     },
     "x": {
      "$expr": "L_cx + J_0 + 22 * j1 * sin(t * 90)"
     },
     "y": {
      "$expr": "L_cy + J_1"
     },
     "size": {
      "$expr": "L_size * p0_s * (1 + 0.03 * kick)"
     },
     "opts": {
      "label": "ROMPE",
      "slice": {
       "$expr": "g"
      },
      "split": {
       "$expr": "9 * chaos + 30 * j1"
      }
     }
    }
   ]
  },
  {
   "id": "my",
   "type": "let",
   "value": {
    "$expr": "(item(lines, 0, 'cy') + item(lines, 1, 'cy')) / 2"
   }
  },
  {
   "type": "cracks",
   "lib": "K_tipo",
   "fn": "cracks",
   "args": [
    "ctx",
    "api",
    {
     "$expr": "S_cx"
    },
    {
     "$expr": "my"
    },
    {
     "$expr": "item(lines, 1, 'size') * 0.9"
    },
    {
     "$expr": "a1 >= 0 ? clamp(a1 / 0.35) : 0"
    },
    {
     "seed": 11,
     "n": 6,
     "color": "paper"
    }
   ]
  },
  {
   "type": "word",
   "lib": "K_tipo",
   "str": "?",
   "x": {
    "$expr": "S_cx + 40 * sin(a1 * 40) * j1"
   },
   "y": {
    "$expr": "S_cy + 560"
   },
   "size": {
    "$expr": "420 * p1_s"
   },
   "opts": {
    "color": "accent"
   },
   "when": "p1_a > 0"
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
}, { K_tipo });
