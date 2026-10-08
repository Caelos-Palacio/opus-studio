// GENERADO desde shots/S01.scene.json por `node engine/dsl.mjs build` (spec 006). No editar a mano: edita el .scene.json y regenera.
import { shot } from '../engine/dsl-core.mjs';
export default shot({
 "dsl": 1,
 "id": "S01",
 "doc": "Diagrama 1 · pipeline de producción: once etapas del brief a la nota, en serpiente; el color dice quién decide (Claude, el código o el usuario).",
 "objects": [
  {
   "type": "text",
   "text": {
    "$shot": "text"
   },
   "x": {
    "$expr": "W / 2"
   },
   "y": 100,
   "role": "h2",
   "color": "ink",
   "id": "titulo"
  },
  {
   "type": "shape",
   "shape": "rect",
   "x": 470,
   "y": 162,
   "w": 22,
   "h": 22,
   "color": "accent2"
  },
  {
   "type": "text",
   "text": "decide Claude (texto)",
   "x": 506,
   "y": 173,
   "role": "label",
   "color": "ink",
   "align": "left"
  },
  {
   "type": "shape",
   "shape": "rect",
   "x": 900,
   "y": 162,
   "w": 22,
   "h": 22,
   "color": "ink"
  },
  {
   "type": "text",
   "text": "lo hace el código",
   "x": 936,
   "y": 173,
   "role": "label",
   "color": "ink",
   "align": "left"
  },
  {
   "type": "shape",
   "shape": "rect",
   "x": 1330,
   "y": 162,
   "w": 22,
   "h": 22,
   "color": "accent"
  },
  {
   "type": "text",
   "text": "juzga el usuario",
   "x": 1366,
   "y": 173,
   "role": "label",
   "color": "ink",
   "align": "left"
  },
  {
   "id": "b",
   "type": "repeat",
   "items": [
    [
     300,
     335,
     "01",
     "brief",
     "pieza · arco mute",
     "look · lo que no haré",
     "accent2"
    ],
    [
     740,
     335,
     "02",
     "story v2",
     "voz · ancla · giro",
     "pregunta con respuesta tardía",
     "accent2"
    ],
    [
     1180,
     335,
     "03",
     "estilo + medio",
     "paleta · tipo · soporte",
     "salen del encargo",
     "accent2"
    ],
    [
     1620,
     335,
     "04",
     "audio / score",
     "la pista es el reloj",
     "score · sounddesign · mixer",
     "ink"
    ],
    [
     1620,
     610,
     "05",
     "timeline",
     "shots · cámara · acción",
     "validate hasta SHIP",
     "ink"
    ],
    [
     1180,
     610,
     "06",
     "shots",
     "DSL · recetas · objetos",
     "puros: seek(t) sin azar",
     "ink"
    ],
    [
     740,
     610,
     "07",
     "lint",
     "narr · fondo · arc · layout",
     "escalera determinista",
     "ink"
    ],
    [
     300,
     610,
     "08",
     "crítico",
     "hoja de contacto (peek)",
     "solo con lint SHIP",
     "ink"
    ],
    [
     300,
     885,
     "09",
     "gate",
     "SHIP vigente",
     "+ crítico sin FIX",
     "ink"
    ],
    [
     740,
     885,
     "10",
     "master",
     "fragmentos con hash",
     "techo −3 dBTP",
     "ink"
    ],
    [
     1180,
     885,
     "11",
     "nota del usuario",
     "nota 1–10 + comentario",
     "es el juez de gusto",
     "accent"
    ],
    [
     1620,
     885,
     "12",
     "lección",
     "vuelve a la spec (3DD)",
     "falso negativo → escenario",
     "accent"
    ]
   ],
   "fields": [
    "x",
    "y",
    "n",
    "t",
    "s1",
    "s2",
    "c"
   ],
   "children": [
    {
     "type": "shape",
     "shape": "rect",
     "x": {
      "$expr": "b_x - 185"
     },
     "y": {
      "$expr": "b_y - 90"
     },
     "w": 370,
     "h": 180,
     "color": "paper",
     "alpha": {
      "$expr": "0.92 * seg(lt, i * 0.3, i * 0.3 + 0.45)"
     }
    },
    {
     "type": "shape",
     "shape": "rect",
     "x": {
      "$expr": "b_x - 185"
     },
     "y": {
      "$expr": "b_y - 90"
     },
     "w": 370,
     "h": 180,
     "color": "shade",
     "alpha": {
      "$expr": "0.22 * seg(lt, i * 0.3, i * 0.3 + 0.45)"
     }
    },
    {
     "type": "shape",
     "shape": "rect",
     "x": {
      "$expr": "b_x - 185"
     },
     "y": {
      "$expr": "b_y - 90"
     },
     "w": 370,
     "h": 180,
     "color": {
      "$expr": "b_c"
     },
     "stroke": true,
     "lineWidth": 3,
     "alpha": {
      "$expr": "seg(lt, i * 0.3, i * 0.3 + 0.45)"
     }
    },
    {
     "type": "shape",
     "shape": "rect",
     "x": {
      "$expr": "b_x - 185"
     },
     "y": {
      "$expr": "b_y - 90"
     },
     "w": 370,
     "h": 9,
     "color": {
      "$expr": "b_c"
     },
     "alpha": {
      "$expr": "seg(lt, i * 0.3, i * 0.3 + 0.45)"
     }
    },
    {
     "type": "text",
     "text": {
      "$expr": "b_n"
     },
     "x": {
      "$expr": "b_x - 161"
     },
     "y": {
      "$expr": "b_y - 52"
     },
     "role": "label",
     "color": {
      "$expr": "b_c"
     },
     "alpha": {
      "$expr": "seg(lt, i * 0.3, i * 0.3 + 0.45)"
     },
     "align": "left"
    },
    {
     "type": "text",
     "text": {
      "$expr": "b_t"
     },
     "x": {
      "$expr": "b_x"
     },
     "y": {
      "$expr": "b_y - 10"
     },
     "role": "body",
     "color": "ink",
     "alpha": {
      "$expr": "seg(lt, i * 0.3, i * 0.3 + 0.45)"
     }
    },
    {
     "type": "text",
     "text": {
      "$expr": "b_s1"
     },
     "x": {
      "$expr": "b_x"
     },
     "y": {
      "$expr": "b_y + 34"
     },
     "role": "label",
     "color": "ink",
     "alpha": {
      "$expr": "0.85 * seg(lt, i * 0.3, i * 0.3 + 0.45)"
     }
    },
    {
     "type": "text",
     "text": {
      "$expr": "b_s2"
     },
     "x": {
      "$expr": "b_x"
     },
     "y": {
      "$expr": "b_y + 66"
     },
     "role": "label",
     "color": "ink",
     "alpha": {
      "$expr": "0.85 * seg(lt, i * 0.3, i * 0.3 + 0.45)"
     }
    }
   ]
  },
  {
   "id": "a",
   "type": "repeat",
   "items": [
    [
     493,
     335,
     547,
     335,
     "accent2"
    ],
    [
     933,
     335,
     987,
     335,
     "accent2"
    ],
    [
     1373,
     335,
     1427,
     335,
     "accent2"
    ],
    [
     1620,
     433,
     1620,
     512,
     "ink"
    ],
    [
     1427,
     610,
     1373,
     610,
     "ink"
    ],
    [
     987,
     610,
     933,
     610,
     "ink"
    ],
    [
     547,
     610,
     493,
     610,
     "ink"
    ],
    [
     300,
     708,
     300,
     787,
     "ink"
    ],
    [
     493,
     885,
     547,
     885,
     "ink"
    ],
    [
     933,
     885,
     987,
     885,
     "ink"
    ],
    [
     1373,
     885,
     1427,
     885,
     "accent"
    ]
   ],
   "fields": [
    "x0",
    "y0",
    "x1",
    "y1",
    "c"
   ],
   "children": [
    {
     "type": "arrow",
     "x0": {
      "$expr": "a_x0"
     },
     "y0": {
      "$expr": "a_y0"
     },
     "x1": {
      "$expr": "a_x1"
     },
     "y1": {
      "$expr": "a_y1"
     },
     "color": {
      "$expr": "a_c"
     },
     "lw": 3,
     "head": 20,
     "u": {
      "$expr": "seg(lt, i * 0.3 + 0.3, i * 0.3 + 0.7)"
     }
    }
   ]
  },
  {
   "type": "focus",
   "x": 115,
   "y": 245,
   "w": 1690,
   "h": 730,
   "label": "pipeline",
   "weight": 1,
   "hollow": true
  }
 ]
}, {  });
