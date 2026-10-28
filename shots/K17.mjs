// GENERADO desde shots/K17.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as K_tipo from './K_tipo.mjs';
export default shot({
 "dsl": 1,
 "id": "K17",
 "doc": "K17 · pulso 39 → golpe. El vacío: negro y un punto lima casi quieto. El audio también está en silencio digital (vacío del impacto = un pulso).",
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
     "$expr": "18"
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
   "type": "focus",
   "x": {
    "$expr": "S_cx - 60"
   },
   "y": {
    "$expr": "S_cy - 60"
   },
   "w": 120,
   "h": 120,
   "label": "punto",
   "weight": 1,
   "bleed": true,
   "hollow": 0.9
  }
 ]
}, { K_tipo });
