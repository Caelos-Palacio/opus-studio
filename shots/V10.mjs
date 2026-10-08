// GENERADO desde shots/V10.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
export default shot({
 "dsl": 1,
 "id": "V10",
 "doc": "El tramo en blanco entre el 9.º y el 10.º punto (los 7,3 s): una mano con lápiz lo recorre sin marcar nada.",
 "camera": {
  "move": "static"
 },
 "transition": {
  "out": "cut"
 },
 "objects": [
  {
   "type": "fondo",
   "capas": [
    {
     "tipo": "degradado",
     "id": "mesa",
     "modo": "lineal",
     "angulo": 90,
     "stops": [
      "#0d0805",
      "#1d130a",
      "#090604"
     ]
    },
    {
     "tipo": "deformado",
     "id": "vetas",
     "color": "#120a05",
     "colorB": "#4a3018",
     "escala": 0.14,
     "estira": 7,
     "fuerza": 0.5,
     "contraste": 1.5,
     "alfa": 0.35,
     "mezcla": "superponer",
     "paralaje": 0.18
    },
    {
     "tipo": "foco",
     "id": "pozo",
     "color": "#ffcf8a",
     "centro": [
      0.55,
      0.55
     ],
     "radio": 0.55,
     "achatado": 0.7,
     "intensidad": 0.28,
     "mezcla": "pantalla",
     "paralaje": 0.4
    },
    {
     "tipo": "polvo",
     "id": "serrin",
     "n": 80,
     "color": "#ffe2b0",
     "alfaMax": 0.45,
     "tamano": [
      0.5,
      2.2
     ],
     "viento": [
      0.003,
      -0.004
     ],
     "paralaje": 1
    },
    {
     "tipo": "vineta",
     "id": "vineta",
     "color": "#050302",
     "fuerza": 0.92,
     "interior": 0.22,
     "paralaje": 0
    }
   ]
  },
  {
   "id": "Z",
   "type": "let",
   "value": {
    "$expr": "1.25"
   }
  },
  {
   "id": "FX",
   "type": "let",
   "value": {
    "$expr": "-35.712"
   }
  },
  {
   "id": "FY",
   "type": "let",
   "value": {
    "$expr": "-70"
   }
  },
  {
   "id": "ox",
   "type": "let",
   "value": {
    "$expr": "640 + ((0) - FX) * Z"
   }
  },
  {
   "id": "oy",
   "type": "let",
   "value": {
    "$expr": "360 + ((0) - FY) * Z"
   }
  },
  {
   "type": "glow",
   "x": {
    "$expr": "ox"
   },
   "y": {
    "$expr": "oy"
   },
   "r": {
    "$expr": "560 * Z"
   },
   "color": "#ffcf8a",
   "alpha": {
    "$expr": "0.16 * 1"
   }
  },
  {
   "id": "papel",
   "type": "objeto",
   "objeto": "papel_continuo",
   "x": {
    "$expr": "ox"
   },
   "y": {
    "$expr": "oy"
   },
   "size": {
    "$expr": "1000 * Z"
   },
   "rot": 1.5708,
   "params": {
    "pliegues": 9
   },
   "partes": {
    "despliegue": 1,
    "impreso": 0
   },
   "relleno": "#d8c9a4",
   "color": "#3a2a18",
   "acento": "#b99a68",
   "alfa": {
    "$expr": "0.2 + 0.5 * 1"
   }
  },
  {
   "type": "fondo",
   "capas": [
    {
     "tipo": "foco",
     "id": "charco",
     "color": "#ffcf8a",
     "centro": [
      0.5,
      0.52
     ],
     "radio": 0.42,
     "achatado": 0.8,
     "intensidad": 0.22,
     "mezcla": "pantalla",
     "paralaje": 0
    },
    {
     "tipo": "vineta",
     "id": "borde",
     "color": "#030201",
     "fuerza": 0.96,
     "interior": 0.1,
     "paralaje": 0
    }
   ],
   "alfa": {
    "$expr": "1"
   }
  },
  {
   "id": "d",
   "type": "repeat",
   "items": [
    [
     -392,
     -130,
     0,
     0,
     0
    ],
    [
     -385.152,
     -130,
     0,
     1,
     1
    ],
    [
     -372.608,
     -130,
     0,
     2,
     2
    ],
    [
     -371.264,
     -130,
     0,
     3,
     3
    ],
    [
     -359.552,
     -130,
     0,
     4,
     4
    ],
    [
     -348.096,
     -130,
     0,
     5,
     5
    ],
    [
     -293.376,
     -130,
     0,
     6,
     6
    ],
    [
     -281.408,
     -130,
     0,
     7,
     7
    ],
    [
     -269.44,
     -130,
     0,
     8,
     8
    ],
    [
     198.016,
     -130,
     0,
     9,
     9
    ],
    [
     275.712,
     -130,
     0,
     10,
     10
    ],
    [
     404.096,
     -130,
     1,
     -1,
     11
    ],
    [
     -392,
     0,
     0,
     11,
     12
    ],
    [
     -365.632,
     0,
     0,
     12,
     13
    ],
    [
     -350.4,
     0,
     0,
     13,
     14
    ],
    [
     -318.976,
     0,
     0,
     14,
     15
    ],
    [
     -292.032,
     0,
     0,
     15,
     16
    ],
    [
     -220.224,
     0,
     0,
     16,
     17
    ],
    [
     -71.36,
     0,
     0,
     17,
     18
    ],
    [
     -34.752,
     0,
     0,
     18,
     19
    ],
    [
     -392,
     130,
     0,
     19,
     20
    ],
    [
     -364.16,
     130,
     0,
     20,
     21
    ],
    [
     -282.56,
     130,
     0,
     21,
     22
    ],
    [
     99.968,
     130,
     0,
     22,
     23
    ],
    [
     190.336,
     130,
     0,
     23,
     24
    ]
   ],
   "fields": [
    "x",
    "y",
    "h",
    "o",
    "g"
   ],
   "children": [
    {
     "id": "dx",
     "type": "let",
     "value": {
      "$expr": "640 + ((d_x) - FX) * Z"
     }
    },
    {
     "id": "dy",
     "type": "let",
     "value": {
      "$expr": "360 + ((d_y) - FY) * Z"
     }
    },
    {
     "type": "group",
     "when": "d_h == 0",
     "children": [
      {
       "type": "shape",
       "shape": "circle",
       "x": {
        "$expr": "dx"
       },
       "y": {
        "$expr": "dy"
       },
       "r": {
        "$expr": "max(2, 6.5 * Z)"
       },
       "color": "#1f160d",
       "alpha": {
        "$expr": "(1) * 1 * 1"
       }
      }
     ]
    },
    {
     "type": "group",
     "when": "d_h == 1",
     "children": [
      {
       "type": "shape",
       "shape": "circle",
       "stroke": true,
       "lineWidth": {
        "$expr": "max(1, 1.6 * Z)"
       },
       "x": {
        "$expr": "dx"
       },
       "y": {
        "$expr": "dy"
       },
       "r": {
        "$expr": "max(3, 7.5 * Z)"
       },
       "color": "#1f160d",
       "alpha": {
        "$expr": "0.7 * (1) * 1 * 1"
       }
      }
     ]
    },
    {
     "type": "group",
     "when": "d_o >= 0",
     "children": [
      {
       "id": "mk",
       "type": "let",
       "value": {
        "$expr": "0"
       }
      },
      {
       "type": "shape",
       "shape": "circle",
       "stroke": true,
       "lineWidth": {
        "$expr": "max(1.2, 2.2 * Z)"
       },
       "x": {
        "$expr": "dx"
       },
       "y": {
        "$expr": "dy"
       },
       "r": {
        "$expr": "max(5, 13 * Z)"
       },
       "color": "#34343a",
       "alpha": 0.85,
       "sweep": {
        "$expr": "6.2832 * mk"
       }
      }
     ]
    }
   ]
  },
  {
   "id": "lamp",
   "type": "objeto",
   "objeto": "lampara_mesa",
   "x": {
    "$expr": "-30"
   },
   "y": {
    "$expr": "330"
   },
   "size": {
    "$expr": "640"
   },
   "relleno": "#9a6b22",
   "color": "#f1d9a0",
   "params": {
    "cono": false
   },
   "partes": {
    "encendida": {
     "$expr": "1"
    },
    "brazo1": 0.7,
    "brazo2": 0.8
   },
   "alfa": {
    "$expr": "1"
   }
  },
  {
   "id": "tx",
   "type": "let",
   "value": {
    "$expr": "640 + ((-309.44 + 547.456 * smooth(seg(lt, 0.5, 3.4))) - FX) * Z"
   }
  },
  {
   "id": "ty",
   "type": "let",
   "value": {
    "$expr": "360 + ((-130 + 4 + 1.5 * sin(lt * 4)) - FY) * Z"
   }
  },
  {
   "id": "lap",
   "type": "objeto",
   "objeto": "lapiz",
   "x": {
    "$expr": "tx - 0.375 * (330 * Z) * -0.666"
   },
   "y": {
    "$expr": "ty - 0.375 * (330 * Z) * 0.746"
   },
   "size": {
    "$expr": "330 * Z"
   },
   "rot": 2.3,
   "color": "#1a1008",
   "params": {
    "color": "#c79a4a"
   },
   "partes": {
    "desgaste": 0.3
   },
   "alfa": {
    "$expr": "seg(lt, 0.1, 0.5)"
   }
  },
  {
   "id": "mano",
   "type": "objeto",
   "objeto": "mano",
   "x": {
    "$expr": "tx - 0.65 * (330 * Z) * -0.666"
   },
   "y": {
    "$expr": "ty - 0.65 * (330 * Z) * 0.746"
   },
   "size": {
    "$expr": "313.5 * Z"
   },
   "rot": 3.87,
   "estado": "pinza",
   "relleno": "#2b1b0e",
   "color": "#caa66a",
   "alfa": {
    "$expr": "seg(lt, 0.1, 0.5)"
   }
  },
  {
   "id": "t0",
   "type": "text",
   "text": "En esos 13 segundos, ni un ruido ajeno.",
   "x": {
    "$expr": "S_cx"
   },
   "y": {
    "$expr": "S_y1 - 30"
   },
   "role": "body",
   "align": "center",
   "color": "ink",
   "alpha": {
    "$expr": "1 * seg(lt, 0.6, 1.4) * (1 - seg(lt, 3.0999999999999996, 3.9))"
   }
  }
 ]
}, {  });
