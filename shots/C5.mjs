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
   "preset": "expediente_kraft"
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
   "text": {
    "$expr": "item(vec(\"\", \"a\", \"añ\", \"año\"), min(3, floor(max(0, lt - 0.2) * 12)))"
   },
   "x": {
    "$expr": "S_cx - 450"
   },
   "y": {
    "$expr": "S_cy + -150"
   },
   "role": "body",
   "align": "left"
  },
  {
   "id": "a1",
   "type": "text",
   "text": {
    "$expr": "item(vec(\"\", \"1\", \"18\", \"188\", \"1889\"), min(4, floor(max(0, lt - 0.5) * 12)))"
   },
   "x": {
    "$expr": "S_cx - 450"
   },
   "y": {
    "$expr": "S_cy + -70"
   },
   "role": "body",
   "align": "left"
  },
  {
   "id": "a2",
   "type": "text",
   "text": {
    "$expr": "item(vec(\"\", \"1\", \"19\", \"194\", \"1948\"), min(4, floor(max(0, lt - 0.8) * 12)))"
   },
   "x": {
    "$expr": "S_cx - 450"
   },
   "y": {
    "$expr": "S_cy + 10"
   },
   "role": "body",
   "align": "left"
  },
  {
   "id": "a3",
   "type": "text",
   "text": {
    "$expr": "item(vec(\"\", \"1\", \"19\", \"198\", \"1989\"), min(4, floor(max(0, lt - 1.0999999999999999) * 12)))"
   },
   "x": {
    "$expr": "S_cx - 450"
   },
   "y": {
    "$expr": "S_cy + 92"
   },
   "role": "body",
   "align": "left"
  },
  {
   "id": "b0",
   "type": "text",
   "text": {
    "$expr": "item(vec(\"\", \"c\", \"co\", \"cop\", \"copi\", \"copia\", \"copias\"), min(6, floor(max(0, lt - 0.6) * 16)))"
   },
   "x": {
    "$expr": "S_cx - 232"
   },
   "y": {
    "$expr": "S_cy + -150"
   },
   "role": "body",
   "align": "left"
  },
  {
   "id": "b1",
   "type": "text",
   "text": {
    "$expr": "item(vec(\"\", \"c\", \"co\", \"com\", \"comp\", \"compa\", \"compar\", \"compara\", \"comparad\", \"comparado\", \"comparados\"), min(10, floor(max(0, lt - 0.8999999999999999) * 16)))"
   },
   "x": {
    "$expr": "S_cx - 232"
   },
   "y": {
    "$expr": "S_cy + -70"
   },
   "role": "body",
   "align": "left"
  },
  {
   "id": "b2",
   "type": "text",
   "text": {
    "$expr": "item(vec(\"\", \"c\", \"co\", \"com\", \"comp\", \"compa\", \"compar\", \"compara\", \"comparad\", \"comparado\", \"comparados\"), min(10, floor(max(0, lt - 1.2) * 16)))"
   },
   "x": {
    "$expr": "S_cx - 232"
   },
   "y": {
    "$expr": "S_cy + 10"
   },
   "role": "body",
   "align": "left"
  },
  {
   "id": "b3",
   "type": "text",
   "text": {
    "$expr": "item(vec(\"\", \"c\", \"co\", \"com\", \"comp\", \"compa\", \"compar\", \"compara\", \"comparad\", \"comparado\", \"comparados\"), min(10, floor(max(0, lt - 1.5) * 16)))"
   },
   "x": {
    "$expr": "S_cx - 232"
   },
   "y": {
    "$expr": "S_cy + 92"
   },
   "role": "body",
   "align": "left"
  },
  {
   "id": "q0",
   "type": "text",
   "text": {
    "$expr": "item(vec(\"\", \"q\", \"qu\", \"qui\", \"quié\", \"quién\", \"quién \", \"quién s\", \"quién se\", \"quién se \", \"quién se m\", \"quién se mo\", \"quién se mov\", \"quién se movi\", \"quién se movió\"), min(14, floor(max(0, lt - 0.9) * 16)))"
   },
   "x": {
    "$expr": "S_cx - 75"
   },
   "y": {
    "$expr": "S_cy - 150"
   },
   "role": "body",
   "align": "left"
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
   "text": {
    "$expr": "item(vec(\"\", \"N\", \"No\", \"No \", \"No c\", \"No co\", \"No con\", \"No cons\", \"No const\", \"No consta\", \"No consta \", \"No consta c\", \"No consta cu\", \"No consta cuá\", \"No consta cuál\", \"No consta cuál \", \"No consta cuál s\", \"No consta cuál se\", \"No consta cuál se \", \"No consta cuál se m\", \"No consta cuál se mo\", \"No consta cuál se mov\", \"No consta cuál se movi\", \"No consta cuál se movió\", \"No consta cuál se movió.\"), min(24, floor(max(0, lt - 1.4) * 12)))"
   },
   "x": {
    "$expr": "S_cx - 330"
   },
   "y": {
    "$expr": "S_cy + 270"
   },
   "role": "body",
   "align": "left"
  }
 ]
}, {  });
