#!/usr/bin/env python3
"""Contornos de Lato Black (TTF) → JSON en unidades de em, y hacia abajo, línea base en y=0.
Herramienta de producción del reel (el motor no tiene glifo→trazo propio: solo MathJax). Salida: stdout (JSON).
Uso: python3 data/reel/tools/glifos.py > /tmp/glifos.json && node data/reel/tools/glifos.mjs /tmp/glifos.json"""
import json, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
FONT = '/usr/share/fonts/truetype/lato/Lato-Black.ttf'
CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ¿?¡!.,:;-—·0123456789'
f = TTFont(FONT); gs = f.getGlyphSet(); cm = f.getBestCmap(); upm = f['head'].unitsPerEm
out = {'upm': upm, 'cap': f['OS/2'].sCapHeight / upm, 'glyphs': {}}
for ch in CHARS:
    g = cm.get(ord(ch))
    if g is None: continue
    pen = SVGPathPen(gs, ntos=lambda v: ('%.4f' % v).rstrip('0').rstrip('.'))
    gs[g].draw(TransformPen(pen, (1 / upm, 0, 0, -1 / upm, 0, 0)))
    out['glyphs'][ch] = {'adv': f['hmtx'][g][0] / upm, 'd': pen.getCommands()}
out['glyphs'][' '] = {'adv': f['hmtx'][cm[32]][0] / upm, 'd': ''}
json.dump(out, sys.stdout, ensure_ascii=False)
