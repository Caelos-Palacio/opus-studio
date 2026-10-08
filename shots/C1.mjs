// GENERADO desde shots/C1.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
export default shot({
 "dsl": 1,
 "id": "C1",
 "doc": "[receta:presentar_objeto] el ancla entra con muelle y se asienta; después se lee un detalle.",
 "params": {
  "entra": {
   "type": "number",
   "range": [
    0,
    2
   ],
   "unit": "s",
   "default": 0.3,
   "semantic": "instante de la entrada"
  },
  "detalleEn": {
   "type": "number",
   "range": [
    0,
    4
   ],
   "unit": "s",
   "default": 1.4,
   "semantic": "cuándo se lee el detalle"
  }
 },
 "camera": {
  "move": "push",
  "why": "approach"
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
   "id": "cil",
   "type": "objeto",
   "objeto": "cilindro_metalico",
   "x": {
    "$expr": "S_cx"
   },
   "y": {
    "$expr": "S_cy + 70"
   },
   "size": 230,
   "partes": {
    "brillo": {
     "$expr": "0.9"
    }
   },
   "alfa": {
    "$expr": "1"
   }
  },
  {
   "id": "ancla",
   "type": "objeto",
   "objeto": "campana_cristal",
   "x": {
    "$expr": "S_cx"
   },
   "y": {
    "$expr": "S_cy - 10"
   },
   "size": 430,
   "params": {
    "anidadas": 3
   },
   "alfa": {
    "$expr": "1"
   }
  },
  {
   "id": "sello",
   "type": "objeto",
   "objeto": "sello_tampon",
   "x": {
    "$expr": "S_cx + 400"
   },
   "y": {
    "$expr": "S_cy + 150"
   },
   "size": 190,
   "estado": "sin_tinta",
   "focus": false
  },
  {
   "id": "llave0",
   "type": "objeto",
   "objeto": "llave_laton",
   "x": {
    "$expr": "S_cx - 400"
   },
   "y": {
    "$expr": "S_cy + -170 - 620*seg(lt, 0.0+0.5, 0.0+2.1)"
   },
   "size": 170,
   "focus": false
  },
  {
   "id": "mano0",
   "type": "objeto",
   "objeto": "mano",
   "x": {
    "$expr": "S_cx - 355"
   },
   "y": {
    "$expr": "S_cy + -130 - 620*(1-seg(lt,0.0-0.1,0.0+0.5)) - 620*seg(lt, 0.0+0.5, 0.0+2.1)"
   },
   "size": 170,
   "focus": false
  },
  {
   "id": "llave1",
   "type": "objeto",
   "objeto": "llave_laton",
   "x": {
    "$expr": "S_cx - 400"
   },
   "y": {
    "$expr": "S_cy + -35 - 620*seg(lt, 1.0+0.5, 1.0+2.1)"
   },
   "size": 170,
   "focus": false
  },
  {
   "id": "mano1",
   "type": "objeto",
   "objeto": "mano",
   "x": {
    "$expr": "S_cx - 355"
   },
   "y": {
    "$expr": "S_cy + 5 - 620*(1-seg(lt,1.0-0.1,1.0+0.5)) - 620*seg(lt, 1.0+0.5, 1.0+2.1)"
   },
   "size": 170,
   "focus": false
  },
  {
   "id": "llave2",
   "type": "objeto",
   "objeto": "llave_laton",
   "x": {
    "$expr": "S_cx - 400"
   },
   "y": {
    "$expr": "S_cy + 100 - 620*seg(lt, 2.0+0.5, 2.0+2.1)"
   },
   "size": 170,
   "focus": false
  },
  {
   "id": "mano2",
   "type": "objeto",
   "objeto": "mano",
   "x": {
    "$expr": "S_cx - 355"
   },
   "y": {
    "$expr": "S_cy + 140 - 620*(1-seg(lt,2.0-0.1,2.0+0.5)) - 620*seg(lt, 2.0+0.5, 2.0+2.1)"
   },
   "size": 170,
   "focus": false
  },
  {
   "id": "foco",
   "type": "focus",
   "x": {
    "$expr": "S_cx - 90"
   },
   "y": {
    "$expr": "S_cy - 80"
   },
   "w": 180,
   "h": 180,
   "label": "el kilo"
  },
  {
   "id": "l1",
   "type": "text",
   "text": "Consta: bajo tres campanas de cristal,",
   "x": {
    "$expr": "S_cx"
   },
   "y": {
    "$expr": "S_cy + 270-44"
   },
   "role": "h2",
   "align": "center",
   "alpha": {
    "$expr": "seg(lt,0.6,0.8999999999999999)"
   }
  },
  {
   "id": "l2",
   "type": "text",
   "text": "un cilindro es el kilo.",
   "x": {
    "$expr": "S_cx"
   },
   "y": {
    "$expr": "S_cy + 270+2"
   },
   "role": "h2",
   "align": "center",
   "alpha": {
    "$expr": "seg(lt,2.0,2.3)"
   }
  }
 ]
}, {  });
