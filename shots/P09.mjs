// GENERADO desde shots/P09.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as P_mundo from './P_mundo.mjs';
import * as P_dsl from './P_dsl.mjs';
export default shot({
 "dsl": 1,
 "id": "P09",
 "doc": "10^21–10^24 m: Andrómeda y el Grupo Local. Todo se vuelve tenue: la calma antes del pico.",
 "libs": {
  "P_mundo": "./P_mundo.mjs",
  "P_dsl": "./P_dsl.mjs"
 },
 "fns": {
  "Lof": {
   "lib": "P_mundo",
   "fn": "Lof"
  },
  "ppmOf": {
   "lib": "P_dsl",
   "fn": "ppmOf"
  },
  "projPt": {
   "lib": "P_dsl",
   "fn": "projPt"
  }
 },
 "entities": {
  "win": {
   "lib": "P_mundo",
   "fn": "winRide",
   "fields": [],
   "reads": []
  }
 },
 "objects": [
  {
   "id": "viaje",
   "type": "world",
   "lib": "P_mundo",
   "fn": "ride",
   "args": [
    "ctx",
    "api",
    "film",
    "t"
   ],
   "semantic": "el viaje de escala: cielo, estrellas, suelo, sistema solar, ventana (continuidad exacta en cada corte)"
  },
  {
   "id": "G",
   "type": "let",
   "lib": "P_mundo",
   "fn": "geo",
   "args": [
    "film"
   ],
   "fields": [
    "S0",
    "cx",
    "cy",
    "k",
    "W",
    "H",
    "sy0",
    "sh",
    "dot",
    "ry"
   ],
   "semantic": "geometría de pantalla de la escala"
  },
  {
   "id": "L",
   "type": "let",
   "value": {
    "$expr": "Lof(t)"
   }
  },
  {
   "id": "ppm",
   "type": "let",
   "value": {
    "$expr": "ppmOf(G, L)"
   }
  },
  {
   "id": "m31",
   "type": "let",
   "lib": "P_dsl",
   "fn": "projPt",
   "args": [
    {
     "$expr": "G"
    },
    {
     "$expr": "L"
    },
    {
     "$lit": "M31"
    }
   ],
   "fields": [
    "0",
    "1"
   ]
  },
  {
   "id": "R",
   "type": "let",
   "value": {
    "$expr": "max(10, 1.1e21 * ppm)"
   }
  },
  {
   "id": "dentro",
   "type": "let",
   "value": {
    "$expr": "m31_0 > 0 && m31_0 < G_W && m31_1 > 0 && m31_1 < G_H"
   }
  },
  {
   "type": "focus",
   "x": {
    "$expr": "m31_0 - R"
   },
   "y": {
    "$expr": "m31_1 - R"
   },
   "w": {
    "$expr": "2 * R"
   },
   "h": {
    "$expr": "2 * R"
   },
   "label": "Andrómeda",
   "weight": 1,
   "when": "dentro"
  },
  {
   "type": "focus",
   "x": {
    "$expr": "G_cx - 10"
   },
   "y": {
    "$expr": "G_cy - 10"
   },
   "w": {
    "$expr": "20"
   },
   "h": {
    "$expr": "20"
   },
   "label": "Vía Láctea",
   "weight": 1,
   "when": "!dentro"
  },
  {
   "id": "contador",
   "type": "hud",
   "lib": "P_mundo",
   "fn": "hud",
   "args": [
    "api",
    "film",
    "t"
   ],
   "semantic": "contador 10^n m con morph glifo a glifo"
  },
  {
   "id": "c1",
   "type": "caption",
   "lib": "P_mundo",
   "fn": "caption",
   "args": [
    "api",
    "film",
    "t",
    43.2,
    45.2,
    {
     "$lit": "ANDRÓMEDA"
    },
    {
     "$lit": "2{,}4\\times10^{22}\\,\\mathrm{m}"
    }
   ],
   "semantic": "rótulo de hito"
  }
 ]
}, { P_mundo, P_dsl });
