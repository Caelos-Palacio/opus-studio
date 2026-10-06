// GENERADO desde shots/K01.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as K_tipo from './K_tipo.mjs';
export default shot({
 "dsl": 1,
 "id": "K01",
 "doc": "K01 · pulso 0 → 1. La ¿ lima golpea el primer pulso del film. El fotograma 0 YA tiene la ¿ a escala 1,25: el reel no empieza en negro.",
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
     "from": 1.1
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
    "$expr": "1200 * p_s * (1 + 0.05 * kick)"
   }
  },
  {
   "id": "J",
   "type": "let",
   "value": {
    "$expr": "shake(10, 1)"
   },
   "fields": [
    "0",
    "1"
   ]
  },
  {
   "type": "word",
   "lib": "K_tipo",
   "str": "¿",
   "x": {
    "$expr": "S_cx + J_0"
   },
   "y": {
    "$expr": "S_cy - 0.1 * size + J_1"
   },
   "size": {
    "$expr": "size"
   },
   "opts": {
    "color": "accent",
    "split": {
     "$expr": "7 * chaos * (0.3 + kick)"
    }
   }
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
