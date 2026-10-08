// GENERADO desde shots/C8.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
export default shot({
 "dsl": 1,
 "id": "C8",
 "doc": "[receta:documento] la hoja recibe dos líneas escritas y, al final, un sello.",
 "params": {
  "sellaEn": {
   "type": "number",
   "range": [
    1,
    8
   ],
   "unit": "s",
   "default": 4.6,
   "semantic": "cuándo cae el sello"
  }
 },
 "camera": {
  "move": "push",
  "why": "approach",
  "amount": 0.04
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
   "id": "ancla",
   "type": "objeto",
   "objeto": "acta_cuaderno",
   "x": {
    "$expr": "S_cx - 120"
   },
   "y": {
    "$expr": "S_cy - 50"
   },
   "size": 430,
   "hollow": 0.92,
   "partes": {
    "escrito": {
     "$expr": "0"
    },
    "firmadas": {
     "$expr": "0.66"
    }
   }
  },
  {
   "id": "c1",
   "type": "text",
   "text": "incertidumbre",
   "x": {
    "$expr": "S_cx - 250"
   },
   "y": {
    "$expr": "S_cy - 115"
   },
   "role": "body",
   "align": "left",
   "alpha": {
    "$expr": "seg(lt,0.6,0.8999999999999999)"
   }
  },
  {
   "id": "c2",
   "type": "text",
   "text": "10 µg",
   "x": {
    "$expr": "S_cx - 250"
   },
   "y": {
    "$expr": "S_cy - 60"
   },
   "role": "h2",
   "align": "left",
   "alpha": {
    "$expr": "seg(lt,2.0,2.3)"
   }
  },
  {
   "id": "pluma",
   "type": "objeto",
   "objeto": "pluma",
   "x": {
    "$expr": "S_cx - 250 + 14*min(0.95, 0.15*floor(max(0,lt-2.0)*6)) + 55 + 400*seg(lt,3.0,3.8)"
   },
   "y": {
    "$expr": "S_cy - 140 - 250*seg(lt,3.0,3.8)"
   },
   "size": 230,
   "estado": "escribiendo",
   "focus": false
  },
  {
   "id": "sello",
   "type": "objeto",
   "objeto": "sello_tampon",
   "x": {
    "$expr": "S_cx - 120"
   },
   "y": {
    "$expr": "S_cy + 10 - 240*(1-seg(lt,6.0,6.5))*step(6.0,lt)"
   },
   "size": 250,
   "params": {
    "texto": "CONSTA"
   },
   "estado": "sin_tinta",
   "alfa": {
    "$expr": "step(6.0,lt)"
   },
   "focus": false
  },
  {
   "id": "cil",
   "type": "objeto",
   "objeto": "cilindro_metalico",
   "x": {
    "$expr": "S_cx + 360"
   },
   "y": {
    "$expr": "S_cy + 70"
   },
   "size": 160,
   "partes": {
    "brillo": {
     "$expr": "0.9"
    }
   }
  },
  {
   "id": "l1",
   "type": "text",
   "text": "Desde hoy consta su incertidumbre.",
   "x": {
    "$expr": "S_cx - 330"
   },
   "y": {
    "$expr": "S_cy + 270-42"
   },
   "role": "body",
   "align": "left",
   "alpha": {
    "$expr": "seg(lt,0.4,0.7)"
   }
  },
  {
   "id": "l2",
   "type": "text",
   "text": "Por primera vez,",
   "x": {
    "$expr": "S_cx - 330"
   },
   "y": {
    "$expr": "S_cy + 270-10"
   },
   "role": "body",
   "align": "left",
   "alpha": {
    "$expr": "seg(lt,2.2,2.5)"
   }
  },
  {
   "id": "l3",
   "type": "text",
   "text": "consta que puede equivocarse.",
   "x": {
    "$expr": "S_cx - 330"
   },
   "y": {
    "$expr": "S_cy + 270+22"
   },
   "role": "body",
   "align": "left",
   "alpha": {
    "$expr": "seg(lt,3.0,3.3)"
   }
  }
 ]
}, {  });
