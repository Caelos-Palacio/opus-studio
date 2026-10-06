// GENERADO desde shots/K23.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as K_tipo from './K_tipo.mjs';
import * as K_dsl from './K_dsl.mjs';
export default shot({
 "dsl": 1,
 "id": "K23",
 "doc": "K23 · pulsos 51 → 55. La frase completa late con el groove: una ola lima recorre las letras (un barrido cada dos pulsos) y cada letra salta al paso de la ola.",
 "libs": {
  "K_tipo": "./K_tipo.mjs",
  "K_dsl": "./K_dsl.mjs"
 },
 "fns": {
  "beatX": {
   "lib": "K_tipo",
   "fn": "beatX",
   "bind": [
    "film",
    "t"
   ]
  },
  "shotBeat0": {
   "lib": "K_tipo",
   "fn": "shotBeat0",
   "bind": [
    "film",
    "shot"
   ]
  },
  "glyphN": {
   "lib": "K_dsl",
   "fn": "glyphN"
  },
  "glyphIdx": {
   "lib": "K_dsl",
   "fn": "glyphIdx"
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
   "id": "lines",
   "type": "let",
   "lib": "K_tipo",
   "fn": "finalStack",
   "args": [
    "api"
   ]
  },
  {
   "id": "N",
   "type": "let",
   "value": {
    "$expr": "glyphN(lines)"
   }
  },
  {
   "id": "bx",
   "type": "let",
   "value": {
    "$expr": "beatX() - shotBeat0()"
   }
  },
  {
   "id": "wp",
   "type": "let",
   "value": {
    "$expr": "((bx / 2) % 1) * (N + 8) - 4"
   }
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
      "$expr": "L_cx"
     },
     "y": {
      "$expr": "L_cy"
     },
     "size": {
      "$expr": "L_size * (1 + 0.03 * kick)"
     },
     "per": {
      "dy": {
       "$expr": "-(glyphIdx(lines, i, pk) < 0 ? 0 : clamp(1 - abs(glyphIdx(lines, i, pk) - wp) / 2.2)) * 0.07 * L_size"
      },
      "s": {
       "$expr": "1 + 0.1 * (glyphIdx(lines, i, pk) < 0 ? 0 : clamp(1 - abs(glyphIdx(lines, i, pk) - wp) / 2.2))"
      },
      "color": {
       "$expr": "(glyphIdx(lines, i, pk) < 0 ? 0 : clamp(1 - abs(glyphIdx(lines, i, pk) - wp) / 2.2)) > 0.4 ? 'accent' : nil()"
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
     "$lit": "frase"
    }
   ]
  }
 ]
}, { K_tipo, K_dsl });
