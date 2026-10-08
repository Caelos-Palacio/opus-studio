// GENERADO desde shots/V04.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
export default shot({
 "dsl": 1,
 "id": "V04",
 "doc": "Dos destellos más (9,219 y 10,433 s tras el primero): el contador llega a 11.",
 "camera": {
  "move": "static"
 },
 "transition": {
  "out": "cut"
 },
 "objects": [
  {
   "type": "fondo",
   "preset": "cuba_oscura",
   "ajustes": {
    "agua": {
     "stops": [
      "#01070c",
      "#03141d",
      "#010305"
     ]
    },
    "haces": {
     "intensidad": 0.045
    },
    "turbidez": {
     "alfa": 0.1
    },
    "bruma": {
     "densidad": 0.2
    },
    "pmtLejanos": {
     "brillo": 0.3,
     "alfa": 0.5
    },
    "pmtCercanos": {
     "brillo": 0.4,
     "alfa": 0.75
    },
    "vineta": {
     "fuerza": 0.9
    }
   }
  },
  {
   "id": "f",
   "type": "repeat",
   "items": [
    [
     0.069,
     409.786,
     225.134,
     0.6,
     0.225,
     1
    ],
    [
     1.283,
     368.567,
     302.705,
     0.3,
     0.122,
     1
    ]
   ],
   "fields": [
    "k",
    "x",
    "y",
    "z",
    "e",
    "ok"
   ],
   "children": [
    {
     "id": "age",
     "type": "let",
     "value": {
      "$expr": "lt - f_k"
     }
    },
    {
     "id": "dec",
     "type": "let",
     "value": {
      "$expr": "exp(-age * (2.6 + 3 * (1 - f_z)))"
     }
    },
    {
     "type": "group",
     "when": "age >= 0 && age < 2.6",
     "children": [
      {
       "type": "glow",
       "x": {
        "$expr": "f_x"
       },
       "y": {
        "$expr": "f_y"
       },
       "r": {
        "$expr": "(60 + 200 * f_z) * (0.6 + 0.4 * f_e)"
       },
       "color": "accent2",
       "alpha": {
        "$expr": "0.42 * dec * f_ok"
       }
      },
      {
       "type": "glow",
       "x": {
        "$expr": "f_x"
       },
       "y": {
        "$expr": "f_y"
       },
       "r": {
        "$expr": "(20 + 50 * f_z)"
       },
       "color": "ink",
       "alpha": {
        "$expr": "0.35 * exp(-age * 9) * f_ok"
       }
      },
      {
       "type": "shape",
       "shape": "circle",
       "stroke": true,
       "lineWidth": {
        "$expr": "2 + 5 * f_z"
       },
       "x": {
        "$expr": "f_x"
       },
       "y": {
        "$expr": "f_y"
       },
       "r": {
        "$expr": "12 + (60 + 190 * f_z) * (1 - exp(-age * 3.4))"
       },
       "color": "accent2",
       "alpha": {
        "$expr": "0.85 * dec * f_ok"
       }
      },
      {
       "type": "shape",
       "shape": "circle",
       "stroke": true,
       "lineWidth": {
        "$expr": "0.8 + 1.5 * f_z"
       },
       "x": {
        "$expr": "f_x"
       },
       "y": {
        "$expr": "f_y"
       },
       "r": {
        "$expr": "6 + (34 + 120 * f_z) * (1 - exp(-age * 3.4))"
       },
       "color": "ink",
       "alpha": {
        "$expr": "0.5 * dec * f_ok"
       }
      },
      {
       "type": "shape",
       "shape": "circle",
       "x": {
        "$expr": "f_x"
       },
       "y": {
        "$expr": "f_y"
       },
       "r": {
        "$expr": "2 + 7 * f_z"
       },
       "color": "ink",
       "alpha": {
        "$expr": "exp(-age * 16) * f_ok"
       }
      },
      {
       "id": "p",
       "type": "repeat",
       "n": 9,
       "children": [
        {
         "type": "glow",
         "x": {
          "$expr": "f_x + cos(i * 0.698 + f_k * 5) * (12 + (60 + 190 * f_z) * (1 - exp(-age * 3.4)))"
         },
         "y": {
          "$expr": "f_y + sin(i * 0.698 + f_k * 5) * (12 + (60 + 190 * f_z) * (1 - exp(-age * 3.4))) * 0.92"
         },
         "r": {
          "$expr": "7 + 9 * f_z"
         },
         "color": "accent2",
         "alpha": {
          "$expr": "0.8 * dec * f_ok * (0.4 + 0.6 * abs(sin(i * 2.1 + f_k)))"
         }
        }
       ]
      }
     ]
    }
   ]
  },
  {
   "id": "cont",
   "type": "objeto",
   "objeto": "contador",
   "x": 215,
   "y": 112,
   "size": 220,
   "alfa": {
    "$expr": "1"
   },
   "params": {
    "digitos": 2,
    "tipo": "numerico"
   },
   "partes": {
    "valor": {
     "$expr": "9 + seg(lt, 0.069, 0.229) + seg(lt, 1.283, 1.443)"
    },
    "brillo": 0.95
   },
   "color": "#07141c",
   "relleno": "#0a1a24",
   "acento": "accent2"
  },
  {
   "id": "et",
   "type": "text",
   "text": "KAMIOKANDE-II",
   "x": {
    "$expr": "215"
   },
   "y": {
    "$expr": "178"
   },
   "role": "label",
   "align": "center",
   "color": "accent2",
   "alpha": {
    "$expr": "0.6 * seg(lt, 0.3, 1.1) * (1 - seg(lt, 98.2, 99))"
   }
  },
  {
   "id": "t0",
   "type": "text",
   "text": "Dos más. Contamos once.",
   "x": {
    "$expr": "S_cx"
   },
   "y": {
    "$expr": "S_y1 - 46"
   },
   "role": "body",
   "align": "center",
   "color": "ink",
   "alpha": {
    "$expr": "1 * seg(lt, 0.5, 1.3) * (1 - seg(lt, 2.05, 2.85))"
   }
  }
 ]
}, {  });
