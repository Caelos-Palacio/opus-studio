// GENERADO desde shots/C5.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
export default shot({
 "dsl": 1,
 "id": "C5",
 "doc": "[receta:pausa_sostenida] el ancla no se mueve; solo respira el halo del fondo.",
 "params": {
  "respira": {
   "type": "number",
   "range": [
    2,
    12
   ],
   "unit": "s",
   "default": 6,
   "semantic": "periodo"
  }
 },
 "camera": {
  "move": "push",
  "why": "approach",
  "amount": 0.02
 },
 "transition": {
  "out": "cut"
 },
 "objects": [
  {
   "id": "fondo",
   "type": "fondo",
   "preset": "expediente_kraft",
   "ajustes": {
    "vineta": {
     "fuerza": 0.1
    },
    "soporte": {
     "alfa": 0.15
    },
    "mota": {
     "alfa": 0.2
    }
   }
  },
  {
   "id": "hoja",
   "type": "shape",
   "shape": "rect",
   "x": {
    "$expr": "S_cx - 470"
   },
   "y": {
    "$expr": "S_cy - 190"
   },
   "w": 640,
   "h": 330,
   "color": "paper",
   "alpha": 0.35
  },
  {
   "id": "h0",
   "type": "shape",
   "shape": "rect",
   "x": {
    "$expr": "S_cx - 470"
   },
   "y": {
    "$expr": "S_cy + -190"
   },
   "w": 640,
   "h": 2,
   "color": "ink",
   "alpha": 0.8
  },
  {
   "id": "h1",
   "type": "shape",
   "shape": "rect",
   "x": {
    "$expr": "S_cx - 470"
   },
   "y": {
    "$expr": "S_cy + -110"
   },
   "w": 640,
   "h": 2,
   "color": "ink",
   "alpha": 0.8
  },
  {
   "id": "h2",
   "type": "shape",
   "shape": "rect",
   "x": {
    "$expr": "S_cx - 470"
   },
   "y": {
    "$expr": "S_cy + -30"
   },
   "w": 640,
   "h": 2,
   "color": "ink",
   "alpha": 0.8
  },
  {
   "id": "h3",
   "type": "shape",
   "shape": "rect",
   "x": {
    "$expr": "S_cx - 470"
   },
   "y": {
    "$expr": "S_cy + 50"
   },
   "w": 640,
   "h": 2,
   "color": "ink",
   "alpha": 0.8
  },
  {
   "id": "h4",
   "type": "shape",
   "shape": "rect",
   "x": {
    "$expr": "S_cx - 470"
   },
   "y": {
    "$expr": "S_cy + 140"
   },
   "w": 640,
   "h": 2,
   "color": "ink",
   "alpha": 0.8
  },
  {
   "id": "v0",
   "type": "shape",
   "shape": "rect",
   "x": {
    "$expr": "S_cx + -470"
   },
   "y": {
    "$expr": "S_cy - 190"
   },
   "w": 2,
   "h": 332,
   "color": "ink",
   "alpha": 0.8
  },
  {
   "id": "v1",
   "type": "shape",
   "shape": "rect",
   "x": {
    "$expr": "S_cx + -250"
   },
   "y": {
    "$expr": "S_cy - 190"
   },
   "w": 2,
   "h": 332,
   "color": "ink",
   "alpha": 0.8
  },
  {
   "id": "v2",
   "type": "shape",
   "shape": "rect",
   "x": {
    "$expr": "S_cx + -90"
   },
   "y": {
    "$expr": "S_cy - 190"
   },
   "w": 2,
   "h": 332,
   "color": "ink",
   "alpha": 0.8
  },
  {
   "id": "v3",
   "type": "shape",
   "shape": "rect",
   "x": {
    "$expr": "S_cx + 170"
   },
   "y": {
    "$expr": "S_cy - 190"
   },
   "w": 2,
   "h": 332,
   "color": "ink",
   "alpha": 0.8
  },
  {
   "id": "a0",
   "type": "text",
   "text": "año",
   "x": {
    "$expr": "S_cx - 450"
   },
   "y": {
    "$expr": "S_cy + -150"
   },
   "role": "label",
   "align": "left",
   "alpha": {
    "$expr": "seg(lt,0.2,0.5)"
   }
  },
  {
   "id": "a1",
   "type": "text",
   "text": "1889",
   "x": {
    "$expr": "S_cx - 450"
   },
   "y": {
    "$expr": "S_cy + -70"
   },
   "role": "label",
   "align": "left",
   "alpha": {
    "$expr": "seg(lt,0.5,0.8)"
   }
  },
  {
   "id": "a2",
   "type": "text",
   "text": "1948",
   "x": {
    "$expr": "S_cx - 450"
   },
   "y": {
    "$expr": "S_cy + 10"
   },
   "role": "label",
   "align": "left",
   "alpha": {
    "$expr": "seg(lt,0.8,1.1)"
   }
  },
  {
   "id": "a3",
   "type": "text",
   "text": "1989",
   "x": {
    "$expr": "S_cx - 450"
   },
   "y": {
    "$expr": "S_cy + 92"
   },
   "role": "label",
   "align": "left",
   "alpha": {
    "$expr": "seg(lt,1.0999999999999999,1.4)"
   }
  },
  {
   "id": "b0",
   "type": "text",
   "text": "copias",
   "x": {
    "$expr": "S_cx - 232"
   },
   "y": {
    "$expr": "S_cy + -150"
   },
   "role": "label",
   "align": "left",
   "alpha": {
    "$expr": "seg(lt,0.6,0.8999999999999999)"
   }
  },
  {
   "id": "b1",
   "type": "text",
   "text": "comparados",
   "x": {
    "$expr": "S_cx - 232"
   },
   "y": {
    "$expr": "S_cy + -70"
   },
   "role": "label",
   "align": "left",
   "alpha": {
    "$expr": "seg(lt,0.8999999999999999,1.2)"
   }
  },
  {
   "id": "b2",
   "type": "text",
   "text": "comparados",
   "x": {
    "$expr": "S_cx - 232"
   },
   "y": {
    "$expr": "S_cy + 10"
   },
   "role": "label",
   "align": "left",
   "alpha": {
    "$expr": "seg(lt,1.2,1.5)"
   }
  },
  {
   "id": "b3",
   "type": "text",
   "text": "comparados",
   "x": {
    "$expr": "S_cx - 232"
   },
   "y": {
    "$expr": "S_cy + 92"
   },
   "role": "label",
   "align": "left",
   "alpha": {
    "$expr": "seg(lt,1.5,1.8)"
   }
  },
  {
   "id": "q0",
   "type": "text",
   "text": "quién se movió",
   "x": {
    "$expr": "S_cx - 75"
   },
   "y": {
    "$expr": "S_cy - 150"
   },
   "role": "label",
   "align": "left",
   "alpha": {
    "$expr": "seg(lt,0.9,1.2)"
   }
  },
  {
   "id": "casilla",
   "type": "shape",
   "shape": "rect",
   "x": {
    "$expr": "S_cx - 70"
   },
   "y": {
    "$expr": "S_cy - 100"
   },
   "w": 230,
   "h": 230,
   "color": "accent",
   "stroke": true,
   "lineWidth": 3,
   "alpha": {
    "$expr": "0.55 + 0.25*sin(tau*lt/3)"
   }
  },
  {
   "id": "mosca",
   "type": "shape",
   "shape": "circle",
   "x": {
    "$expr": "(S_cx + 45 + 60*sin(1.3*lt) + 25*sin(3.1*lt)*step(1.5,lt))*step(0.8,lt) + (S_cx + 45)*(1-step(0.8,lt))"
   },
   "y": {
    "$expr": "S_cy + 20 + 70*sin(0.9*lt + 1) + 20*sin(2.3*lt)"
   },
   "r": 5,
   "color": "ink",
   "alpha": {
    "$expr": "step(0.8,lt)"
   }
  },
  {
   "id": "ancla",
   "type": "objeto",
   "objeto": "reloj",
   "x": {
    "$expr": "S_cx + 400"
   },
   "y": {
    "$expr": "S_cy - 40"
   },
   "size": 230,
   "partes": {
    "hora": {
     "$expr": "10.1"
    },
    "segundos": {
     "$expr": "floor(lt)"
    }
   }
  },
  {
   "id": "foco",
   "type": "focus",
   "x": {
    "$expr": "S_cx + 285"
   },
   "y": {
    "$expr": "S_cy - 155"
   },
   "w": 230,
   "h": 230,
   "label": "el reloj"
  },
  {
   "id": "l1",
   "type": "text",
   "text": "No consta.",
   "x": {
    "$expr": "S_cx"
   },
   "y": {
    "$expr": "S_cy + 270"
   },
   "role": "h2",
   "align": "center",
   "alpha": {
    "$expr": "seg(lt,1.0,1.3)"
   }
  }
 ]
}, {  });
