// GENERADO desde shots/P13.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
import * as P_mundo from './P_mundo.mjs';
import * as P_dsl from './P_dsl.mjs';
export default shot({
 "dsl": 1,
 "id": "P13",
 "doc": "Casa. El cursor, en 10^0, vuelve a ser la ventana de 1 m y el icono de la persona vuelve a tamaño real. La regla baja al suelo como memoria. El último fotograma rima con el primero (misma masa, otra función).",
 "libs": {
  "P_mundo": "./P_mundo.mjs",
  "P_dsl": "./P_dsl.mjs"
 },
 "fns": {
  "rx": {
   "lib": "P_dsl",
   "fn": "rx"
  }
 },
 "entities": {
  "win": {
   "lib": "P_dsl",
   "fn": "win13",
   "fields": [
    "x",
    "y",
    "s"
   ],
   "reads": []
  }
 },
 "objects": [
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
    "sy0",
    "sh",
    "dot",
    "ry"
   ],
   "semantic": "geometría de pantalla de la escala"
  },
  {
   "id": "T0",
   "type": "let",
   "value": 71
  },
  {
   "id": "l",
   "type": "let",
   "value": {
    "$expr": "t - T0"
   }
  },
  {
   "id": "K",
   "type": "let",
   "value": {
    "$expr": "G_k * 1.5"
   }
  },
  {
   "id": "ee",
   "type": "let",
   "value": {
    "$expr": "spring(t - T0 - 0.3, 'soft')"
   }
  },
  {
   "id": "back",
   "type": "let",
   "semantic": "vuelve el mundo a escala humana (cielo y suelo)",
   "value": {
    "$expr": "seg(l, 0.2, 2.8)"
   }
  },
  {
   "id": "mundo",
   "type": "layer",
   "when": "back > 0",
   "opts": {
    "opacity": {
     "$expr": "back"
    }
   },
   "children": [
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
       "L": 0,
       "person": {
        "fill": 0
       },
       "win": {
        "alpha": 0
       }
      }
     ]
    }
   ]
  },
  {
   "id": "y",
   "type": "let",
   "value": {
    "$expr": "lerp(G_ry, G_sy0 + 0.95 * G_sh, seg(l, 0.4, 2.2))"
   }
  },
  {
   "id": "ra",
   "type": "let",
   "value": {
    "$expr": "1 - 0.55 * seg(l, 0.4, 2.2)"
   }
  },
  {
   "id": "regla",
   "type": "axis",
   "lib": "P_mundo",
   "fn": "ruler",
   "args": [
    "ctx",
    "api",
    {
     "$expr": "G"
    },
    {
     "y": {
      "$expr": "y"
     },
     "alpha": {
      "$expr": "ra"
     },
     "icons": {
      "$expr": "1 - seg(l, 0.3, 1.2)"
     },
     "labels": {
      "$expr": "1 - seg(l, 0.3, 1.0)"
     },
     "noPerson": true,
     "weight": 0.3
    }
   ],
   "semantic": "regla de exponentes: línea, marcas, iconos de hitos y etiquetas"
  },
  {
   "id": "marcas",
   "type": "repeat",
   "n": 26,
   "children": [
    {
     "type": "plot",
     "lib": "P_mundo",
     "fn": "sqdot",
     "args": [
      "ctx",
      {
       "$expr": "rx(G, i + 1)"
      },
      {
       "$expr": "y"
      },
      {
       "$expr": "G_dot"
      },
      {
       "$expr": "1"
      },
      {
       "$expr": "color('accent')"
      },
      {
       "$expr": "0.55 * ra"
      }
     ],
     "semantic": "cuadrado→punto de la regla"
    }
   ]
  },
  {
   "type": "plot",
   "lib": "P_mundo",
   "fn": "sqdot",
   "args": [
    "ctx",
    {
     "$expr": "win_x"
    },
    {
     "$expr": "win_y"
    },
    {
     "$expr": "win_s"
    },
    {
     "$expr": "0"
    },
    {
     "$expr": "color('accent')"
    },
    {
     "$expr": "1"
    },
    {
     "$expr": "lerp(1.8, 2.2 * K, ee)"
    }
   ],
   "semantic": "cuadrado→punto de la regla",
   "id": "cursor"
  },
  {
   "type": "focus",
   "x": {
    "$expr": "win_x - win_s / 2"
   },
   "y": {
    "$expr": "win_y - win_s / 2"
   },
   "w": {
    "$expr": "win_s"
   },
   "h": {
    "$expr": "win_s"
   },
   "label": "ventana",
   "weight": 0.3,
   "hollow": 0.9,
   "when": "ee > 0.3"
  },
  {
   "id": "pf",
   "type": "let",
   "semantic": "la persona: el icono de la regla se funde y la de 1,7 m aparece en su sitio (fundido, no vuelo: el final desciende)",
   "value": {
    "$expr": "seg(l, 0.6, 2.4)"
   }
  },
  {
   "id": "iconoPersona",
   "type": "plot",
   "when": "pf < 1",
   "lib": "P_mundo",
   "fn": "person",
   "args": [
    "api",
    {
     "$expr": "G"
    },
    0,
    {
     "x": {
      "$expr": "rx(G, 0)"
     },
     "y": {
      "$expr": "G_ry - 26 * K"
     },
     "h": {
      "$expr": "2.6 * 8 * K"
     },
     "fill": {
      "$expr": "1 - pf"
     },
     "focus": false
    }
   ]
  },
  {
   "id": "persona",
   "type": "plot",
   "when": "pf > 0",
   "lib": "P_mundo",
   "fn": "person",
   "args": [
    "api",
    {
     "$expr": "G"
    },
    0,
    {
     "x": {
      "$expr": "G_cx"
     },
     "y": {
      "$expr": "G_cy"
     },
     "h": {
      "$expr": "1.7 * G_S0"
     },
     "fill": {
      "$expr": "pf"
     },
     "focus": {
      "$expr": "pf > 0.5"
     }
    }
   ]
  },
  {
   "id": "d",
   "type": "let",
   "value": {
    "$expr": "seg(l, 2.0, 2.7)"
   }
  },
  {
   "id": "x",
   "type": "let",
   "value": {
    "$expr": "G_cx + G_S0 / 2 + 16 * K"
   }
  },
  {
   "id": "cota",
   "type": "lines",
   "when": "d > 0",
   "color": "ink",
   "alpha": {
    "$expr": "0.6 * d"
   },
   "lineWidth": 1.2,
   "segs": [
    [
     {
      "$expr": "x"
     },
     {
      "$expr": "G_cy - G_S0 / 2"
     },
     {
      "$expr": "x"
     },
     {
      "$expr": "G_cy - G_S0 / 2 + G_S0 * d"
     }
    ],
    [
     {
      "$expr": "x - 5"
     },
     {
      "$expr": "G_cy - G_S0 / 2"
     },
     {
      "$expr": "x + 5"
     },
     {
      "$expr": "G_cy - G_S0 / 2"
     }
    ],
    [
     {
      "$expr": "x - 5"
     },
     {
      "$expr": "G_cy + G_S0 / 2"
     },
     {
      "$expr": "x + 5"
     },
     {
      "$expr": "G_cy + G_S0 / 2"
     }
    ]
   ]
  },
  {
   "id": "rotulo",
   "type": "text",
   "text": {
    "$shot": "text"
   },
   "x": {
    "$expr": "x + 14 * K"
   },
   "y": {
    "$expr": "G_cy"
   },
   "role": "body",
   "align": "left",
   "alpha": {
    "$expr": "spring(l - 2.3)"
   }
  },
  {
   "id": "contador",
   "type": "hud",
   "lib": "P_mundo",
   "fn": "hud",
   "args": [
    "api",
    "film",
    "t",
    {
     "tex": {
      "from": "10^{0}\\,\\mathrm{m}"
     }
    }
   ],
   "semantic": "contador 10^n m con morph glifo a glifo"
  }
 ]
}, { P_mundo, P_dsl });
