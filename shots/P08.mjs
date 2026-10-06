// GENERADO desde shots/P08.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as P_mundo from './P_mundo.mjs';
import * as P_dsl from './P_dsl.mjs';
export default shot({
 "dsl": 1,
 "id": "P08",
 "doc": "10^18–10^21 m: los brazos espirales (con estela por motion blur) hasta que la Vía Láctea entera cabe en la ventana.",
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
   "id": "gal",
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
     "$lit": "GAL_C"
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
    "$expr": "5e20 * ppm"
   }
  },
  {
   "type": "focus",
   "x": {
    "$expr": "gal_0 - R"
   },
   "y": {
    "$expr": "gal_1 - R"
   },
   "w": {
    "$expr": "2 * R"
   },
   "h": {
    "$expr": "2 * R"
   },
   "label": "Vía Láctea",
   "weight": 1,
   "hollow": 0.5,
   "when": "R > 40 && R < 330"
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
   "label": "estrellas",
   "weight": 1,
   "when": "!(R > 40 && R < 330)"
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
    39.4,
    41.45,
    {
     "$lit": "LA VÍA LÁCTEA"
    },
    {
     "$lit": "10^{21}\\,\\mathrm{m}"
    }
   ],
   "semantic": "rótulo de hito"
  }
 ]
}, { P_mundo, P_dsl });
