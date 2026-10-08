// GENERADO desde shots/C6.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
export default shot({
 "dsl": 1,
 "id": "C6",
 "doc": "[receta:revelar] el detalle ocupa el cuadro y retrocede hasta que se ve el todo.",
 "params": {
  "empieza": {
   "type": "number",
   "range": [
    0,
    3
   ],
   "unit": "s",
   "default": 0.6,
   "semantic": "cuándo empieza"
  },
  "tarda": {
   "type": "number",
   "range": [
    0.4,
    4
   ],
   "unit": "s",
   "default": 1.8,
   "semantic": "duración"
  },
  "alReves": {
   "type": "boolean",
   "default": false,
   "semantic": "al revés"
  }
 },
 "camera": {
  "move": "pull",
  "why": "reveal"
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
   "id": "cil",
   "type": "objeto",
   "objeto": "cilindro_metalico",
   "x": {
    "$expr": "S_cx"
   },
   "y": {
    "$expr": "S_cy - 40"
   },
   "size": 130,
   "partes": {
    "brillo": {
     "$expr": "0.9"
    }
   }
  },
  {
   "id": "campana",
   "type": "objeto",
   "objeto": "campana_cristal",
   "x": {
    "$expr": "S_cx"
   },
   "y": {
    "$expr": "S_cy - 110"
   },
   "size": 250,
   "params": {
    "anidadas": 3
   }
  },
  {
   "id": "foco",
   "type": "focus",
   "x": {
    "$expr": "S_cx - 110"
   },
   "y": {
    "$expr": "S_cy - 250"
   },
   "w": 220,
   "h": 260,
   "label": "bajo el vidrio"
  },
  {
   "id": "cer0",
   "type": "shape",
   "shape": "circle",
   "x": {
    "$expr": "S_cx + -300"
   },
   "y": {
    "$expr": "S_cy + 140"
   },
   "r": 26,
   "color": "ink",
   "alpha": 0.85
  },
  {
   "id": "ran0",
   "type": "shape",
   "shape": "rect",
   "x": {
    "$expr": "S_cx + -300 - 3"
   },
   "y": {
    "$expr": "S_cy + 128"
   },
   "w": 6,
   "h": 24,
   "color": "paper"
  },
  {
   "id": "llave0",
   "type": "objeto",
   "objeto": "llave_laton",
   "x": {
    "$expr": "S_cx + -300 - 120"
   },
   "y": {
    "$expr": "S_cy + 140 - 14*seg(lt,1.0,1.1)"
   },
   "size": 190,
   "partes": {
    "giro": {
     "$expr": "ease(\"inOut\", seg(lt,1.2,2.2))"
    },
    "brillo": {
     "$expr": "0.6"
    }
   }
  },
  {
   "id": "cer1",
   "type": "shape",
   "shape": "circle",
   "x": {
    "$expr": "S_cx + 0"
   },
   "y": {
    "$expr": "S_cy + 140"
   },
   "r": 26,
   "color": "ink",
   "alpha": 0.85
  },
  {
   "id": "ran1",
   "type": "shape",
   "shape": "rect",
   "x": {
    "$expr": "S_cx + 0 - 3"
   },
   "y": {
    "$expr": "S_cy + 128"
   },
   "w": 6,
   "h": 24,
   "color": "paper"
  },
  {
   "id": "ancla",
   "type": "objeto",
   "objeto": "llave_laton",
   "x": {
    "$expr": "S_cx + 0 - 120"
   },
   "y": {
    "$expr": "S_cy + 140 - 14*seg(lt,2.0,2.1)"
   },
   "size": 190,
   "partes": {
    "giro": {
     "$expr": "ease(\"inOut\", seg(lt,2.2,3.2))"
    },
    "brillo": {
     "$expr": "0.6"
    }
   }
  },
  {
   "id": "cer2",
   "type": "shape",
   "shape": "circle",
   "x": {
    "$expr": "S_cx + 300"
   },
   "y": {
    "$expr": "S_cy + 140"
   },
   "r": 26,
   "color": "ink",
   "alpha": 0.85
  },
  {
   "id": "ran2",
   "type": "shape",
   "shape": "rect",
   "x": {
    "$expr": "S_cx + 300 - 3"
   },
   "y": {
    "$expr": "S_cy + 128"
   },
   "w": 6,
   "h": 24,
   "color": "paper"
  },
  {
   "id": "llave2",
   "type": "objeto",
   "objeto": "llave_laton",
   "x": {
    "$expr": "S_cx + 300 - 120"
   },
   "y": {
    "$expr": "S_cy + 140 - 14*seg(lt,3.0,3.1)"
   },
   "size": 190,
   "partes": {
    "giro": {
     "$expr": "ease(\"inOut\", seg(lt,3.2,4.2))"
    },
    "brillo": {
     "$expr": "0.6"
    }
   }
  },
  {
   "id": "l1",
   "type": "text",
   "text": {
    "$expr": "item(vec(\"\", \"T\", \"Tr\", \"Tre\", \"Tres\", \"Tres \", \"Tres l\", \"Tres ll\", \"Tres lla\", \"Tres llav\", \"Tres llave\", \"Tres llaves\", \"Tres llaves:\", \"Tres llaves: \", \"Tres llaves: q\", \"Tres llaves: qu\", \"Tres llaves: que\", \"Tres llaves: que \", \"Tres llaves: que n\", \"Tres llaves: que na\", \"Tres llaves: que nad\", \"Tres llaves: que nadi\", \"Tres llaves: que nadie\", \"Tres llaves: que nadie \", \"Tres llaves: que nadie l\", \"Tres llaves: que nadie lo\", \"Tres llaves: que nadie lo \", \"Tres llaves: que nadie lo t\", \"Tres llaves: que nadie lo to\", \"Tres llaves: que nadie lo toc\", \"Tres llaves: que nadie lo toca\", \"Tres llaves: que nadie lo tocas\", \"Tres llaves: que nadie lo tocase\", \"Tres llaves: que nadie lo tocase.\"), min(33, floor(max(0, lt - 3.6) * 22)))"
   },
   "x": {
    "$expr": "S_cx - 330"
   },
   "y": {
    "$expr": "S_cy + 270-26"
   },
   "role": "body",
   "align": "left"
  },
  {
   "id": "l2",
   "type": "text",
   "text": {
    "$expr": "item(vec(\"\", \"N\", \"No\", \"No \", \"No q\", \"No qu\", \"No que\", \"No que \", \"No que n\", \"No que no\", \"No que no \", \"No que no c\", \"No que no ca\", \"No que no cam\", \"No que no camb\", \"No que no cambi\", \"No que no cambia\", \"No que no cambiar\", \"No que no cambiara\", \"No que no cambiara.\"), min(19, floor(max(0, lt - 5.0) * 16)))"
   },
   "x": {
    "$expr": "S_cx - 330"
   },
   "y": {
    "$expr": "S_cy + 270+14"
   },
   "role": "body",
   "align": "left"
  }
 ]
}, {  });
