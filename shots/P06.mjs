// GENERADO desde shots/P06.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as P_mundo from './P_mundo.mjs';
import * as P_dsl from './P_dsl.mjs';
export default shot({
 "dsl": 1,
 "id": "P06",
 "doc": "10^12–10^15 m: hasta Neptuno; después, tres pasos sin nada nuevo: el sistema solar se vuelve un punto.",
 "libs": {
  "P_mundo": "./P_mundo.mjs",
  "P_dsl": "./P_dsl.mjs"
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
    "t",
    {
     "hi": {
      "$expr": "t < 30.8 ? 'neptuno' : nil()"
     }
    }
   ],
   "semantic": "el viaje de escala: cielo, estrellas, suelo, sistema solar, ventana (continuidad exacta en cada corte)",
   "fields": [
    "so.ppm",
    "so.sx",
    "so.sy"
   ]
  },
  {
   "id": "AU",
   "type": "let",
   "lib": "P_dsl",
   "fn": "au",
   "args": []
  },
  {
   "id": "R",
   "type": "let",
   "when": "has(viaje_so_ppm)",
   "value": {
    "$expr": "30.07 * AU * viaje_so_ppm"
   }
  },
  {
   "type": "focus",
   "x": {
    "$expr": "viaje_so_sx - R"
   },
   "y": {
    "$expr": "viaje_so_sy - R"
   },
   "w": {
    "$expr": "2 * R"
   },
   "h": {
    "$expr": "2 * R"
   },
   "label": "órbita de Neptuno",
   "weight": 1,
   "hollow": 0.85,
   "when": "has(viaje_so_ppm) && R > 30 && R < 190"
  },
  {
   "type": "focus",
   "x": {
    "$expr": "viaje_so_sx - 10"
   },
   "y": {
    "$expr": "viaje_so_sy - 10"
   },
   "w": {
    "$expr": "20"
   },
   "h": {
    "$expr": "20"
   },
   "label": "sistema solar",
   "weight": 1,
   "when": "has(viaje_so_ppm) && R <= 30"
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
   "id": "neptuno",
   "type": "caption",
   "lib": "P_mundo",
   "fn": "caption",
   "args": [
    "api",
    "film",
    "t",
    28.9,
    30.6,
    {
     "$lit": "NEPTUNO"
    },
    {
     "$lit": "9\\times10^{12}\\,\\mathrm{m}"
    }
   ],
   "semantic": "rótulo de hito"
  },
  {
   "id": "nada",
   "type": "caption",
   "lib": "P_mundo",
   "fn": "caption",
   "args": [
    "api",
    "film",
    "t",
    30.7,
    32.45,
    {
     "$lit": "Y LUEGO, NADA"
    }
   ],
   "semantic": "rótulo de hito"
  }
 ]
}, { P_mundo, P_dsl });
