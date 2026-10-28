// GENERADO desde shots/P04.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as P_mundo from './P_mundo.mjs';
import * as P_dsl from './P_dsl.mjs';
export default shot({
 "dsl": 1,
 "id": "P04",
 "doc": "10^6–10^9 m. BEAT 3D b4 (story.json): el suelo plano era una esfera (globo con volumen y luz hacia donde entrará el Sol). La órbita lunar (scene graph 2D) queda intacta. Parámetro w3d apagado = disco 2D.",
 "libs": {
  "P_mundo": "./P_mundo.mjs",
  "P_dsl": "./P_dsl.mjs"
 },
 "fns": {
  "earthCam": {
   "lib": "P_dsl",
   "fn": "earthCam",
   "bind": [
    "film"
   ]
  }
 },
 "params": {
  "w3d": {
   "type": "boolean",
   "default": true,
   "semantic": "beat 3D b4: la Tierra como globo con volumen (world3d v2); apagado = disco 2D"
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
   "id": "e3",
   "type": "let",
   "value": {
    "$expr": "w3d ? seg(t, 19.1, 19.9) : 0"
   }
  },
  {
   "id": "fondo",
   "type": "world",
   "lib": "P_mundo",
   "fn": "ride",
   "args": [
    "ctx",
    "api",
    "film",
    "t",
    {
     "stage": {
      "$lit": "back"
     },
     "earth3d": {
      "$expr": "e3"
     }
    }
   ],
   "semantic": "fondo del viaje: cielo, estrellas y atmósfera (el disco 2D cede al globo 3D)"
  },
  {
   "id": "globo",
   "type": "world3d",
   "when": "w3d",
   "scene": {
    "id": "tierra",
    "background": "paper",
    "fog": false,
    "ground": false,
    "camera": {
     "fov": 14,
     "near": 1000,
     "far": 1000000,
     "target": [
      0,
      0,
      0
     ],
     "dist": 100000,
     "az": 0,
     "el": 0
    },
    "objects": [
     {
      "shape": "sphere",
      "size": 6371,
      "pos": [
       0,
       -6371.00085,
       0
      ],
      "color": "accent2",
      "outline": true,
      "contact": false
     }
    ]
   },
   "time": {
    "$expr": "t"
   },
   "cam": {
    "$expr": "earthCam(t3)"
   },
   "opts": {
    "transparent": true,
    "alpha": {
     "$expr": "e3"
    },
    "groundFy": 0.5,
    "override": true
   },
   "semantic": "beat 3D b4: el suelo plano era una esfera"
  },
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
     "stage": {
      "$lit": "front"
     },
     "earth3d": {
      "$expr": "e3"
     }
    }
   ],
   "fields": [
    "mo.ex",
    "mo.ey",
    "mo.rm"
   ],
   "semantic": "frente del viaje: líneas de la Tierra, la Luna (scene graph), la ventana"
  },
  {
   "type": "focus",
   "x": {
    "$expr": "viaje_mo_ex - viaje_mo_rm"
   },
   "y": {
    "$expr": "viaje_mo_ey - viaje_mo_rm"
   },
   "w": {
    "$expr": "2 * viaje_mo_rm"
   },
   "h": {
    "$expr": "2 * viaje_mo_rm"
   },
   "label": "órbita lunar",
   "weight": 1,
   "hollow": 0.85,
   "when": "has(viaje_mo_rm) && viaje_mo_rm > 40 && viaje_mo_rm < 260"
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
    20.3,
    21.8,
    {
     "$lit": "LA TIERRA"
    },
    {
     "$lit": "1{,}3\\times10^{7}\\,\\mathrm{m}"
    }
   ],
   "semantic": "rótulo de hito"
  },
  {
   "id": "c2",
   "type": "caption",
   "lib": "P_mundo",
   "fn": "caption",
   "args": [
    "api",
    "film",
    "t",
    21.9,
    23.45,
    {
     "$lit": "ÓRBITA LUNAR"
    },
    {
     "$lit": "7{,}7\\times10^{8}\\,\\mathrm{m}"
    }
   ],
   "semantic": "rótulo de hito"
  }
 ]
}, { P_mundo, P_dsl });
