// GENERADO desde shots/V11.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
export default shot({
 "dsl": 1,
 "id": "V11",
 "doc": "La lámpara se aleja con paralaje; 24 puntos, una flecha fina hacia un horizonte sin fin, el listado marcado a lápiz salvo el dudoso.",
 "camera": {
  "move": "pull",
  "why": "reveal",
  "amount": 0.04
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
    "$expr": "1.25 - 0.85 * smooth(seg(lt, 0, 2.4))"
   }
  },
  {
   "id": "FX",
   "type": "let",
   "value": {
    "$expr": "-35.712 * (1 - smooth(seg(lt, 0, 2.4)))"
   }
  },
  {
   "id": "FY",
   "type": "let",
   "value": {
    "$expr": "-70 * (1 - smooth(seg(lt, 0, 2.4))) + 20 * smooth(seg(lt, 0, 2.4))"
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
   "color": "accent",
   "alpha": {
    "$expr": "0.16 * 1"
   }
  },
  {
   "id": "pg",
   "type": "repeat",
   "n": 9,
   "children": [
    {
     "type": "shape",
     "shape": "rect",
     "x": {
      "$expr": "640 + ((-450 + i * 100) - FX) * Z"
     },
     "y": {
      "$expr": "360 + ((-290) - FY) * Z"
     },
     "w": {
      "$expr": "100 * Z + 1"
     },
     "h": {
      "$expr": "580 * Z"
     },
     "color": {
      "$expr": "i % 2 == 0 ? \"#cdbf9b\" : \"#bfb08a\""
     },
     "alpha": {
      "$expr": "0.2 + 0.5 * 1"
     }
    },
    {
     "type": "shape",
     "shape": "rect",
     "stroke": true,
     "lineWidth": 1.2,
     "x": {
      "$expr": "640 + ((-450 + i * 100) - FX) * Z"
     },
     "y": {
      "$expr": "360 + ((-290) - FY) * Z"
     },
     "w": {
      "$expr": "100 * Z + 1"
     },
     "h": {
      "$expr": "580 * Z"
     },
     "color": "#3a2a18",
     "alpha": {
      "$expr": "0.25 * 1"
     }
    }
   ]
  },
  {
   "id": "pp",
   "type": "repeat",
   "n": 36,
   "children": [
    {
     "type": "shape",
     "shape": "circle",
     "x": {
      "$expr": "640 + ((-440 + (i % 18) * 51) - FX) * Z"
     },
     "y": {
      "$expr": "360 + ((i < 18 ? -268 : 268) - FY) * Z"
     },
     "r": {
      "$expr": "max(2, 5 * Z)"
     },
     "color": "#1a1008",
     "alpha": {
      "$expr": "0.28 * 1"
     }
    }
   ]
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
        "$expr": "(d_o == 23 ? 0 : seg(lt, 1.0 + d_o * 0.12, 1.3 + d_o * 0.12))"
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
    "$expr": "-130 + 150 * smooth(seg(lt, 0.2, 5.4))"
   },
   "y": {
    "$expr": "250 - 40 * smooth(seg(lt, 0.2, 5.4))"
   },
   "size": {
    "$expr": "520 - 150 * smooth(seg(lt, 0.2, 5.4))"
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
   "id": "fl",
   "type": "lines",
   "segs": [
    [
     {
      "$expr": "ox + 410 * Z"
     },
     {
      "$expr": "oy"
     },
     1900,
     {
      "$expr": "oy"
     }
    ],
    [
     {
      "$expr": "1900"
     },
     {
      "$expr": "oy"
     },
     {
      "$expr": "1900 - 14"
     },
     {
      "$expr": "oy - 6"
     }
    ],
    [
     {
      "$expr": "1900"
     },
     {
      "$expr": "oy"
     },
     {
      "$expr": "1900 - 14"
     },
     {
      "$expr": "oy + 6"
     }
    ]
   ],
   "color": "ink",
   "lineWidth": 1.2,
   "alpha": {
    "$expr": "0.55 * seg(lt, 3.5, 4.8)"
   }
  },
  {
   "id": "t0",
   "type": "text",
   "text": "Salieron unos 10⁵⁸. Hace 168 000 años.",
   "x": {
    "$expr": "S_cx"
   },
   "y": {
    "$expr": "S_y1 - 74"
   },
   "role": "body",
   "align": "center",
   "color": "ink",
   "alpha": {
    "$expr": "1 * seg(lt, 1.2, 2) * (1 - seg(lt, 5.3, 6.1))"
   }
  },
  {
   "id": "t1",
   "type": "text",
   "text": "Aquí se contaron 24.",
   "x": {
    "$expr": "S_cx"
   },
   "y": {
    "$expr": "S_y1 - 34"
   },
   "role": "label",
   "align": "center",
   "color": "ink",
   "alpha": {
    "$expr": "1 * seg(lt, 3, 3.8) * (1 - seg(lt, 5.3, 6.1))"
   }
  }
 ]
}, {  });
