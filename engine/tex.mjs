// Matemática real: TeX → MathJax SVG → Shape (cúbicas, en em) por glifo. Sin LaTeX instalado.
// Problemas que evita: (1) dependencia de TeX Live (Manim) → MathJax en JS puro; (2) render async en el camino de seek →
// la conversión es síncrona y se cachea en assets/cache/tex/<hash>.json (el navegador solo lee la caché);
// (3) ecuaciones como imagen → aquí son contornos: se pueden escribir (draw-on), deformar y MORFAR glifo a glifo.
import fs from 'node:fs';
import path from 'node:path';
import { hashStr } from './core.mjs';
import { parsePath, mapPts } from './geom.mjs';
import { withLockSync, writeAtomic } from './lock.mjs';
import { trusted } from './sandbox.mjs';

let MJ = null;
async function boot() {
  if (MJ) return MJ;
  const [{ mathjax }, { TeX }, { SVG }, { liteAdaptor }, { RegisterHTMLHandler }, { AllPackages }] = await Promise.all([
    import('mathjax-full/js/mathjax.js'), import('mathjax-full/js/input/tex.js'), import('mathjax-full/js/output/svg.js'),
    import('mathjax-full/js/adaptors/liteAdaptor.js'), import('mathjax-full/js/handlers/html.js'), import('mathjax-full/js/input/tex/AllPackages.js')]);
  const A = liteAdaptor(); RegisterHTMLHandler(A);
  const doc = mathjax.document('', { InputJax: new TeX({ packages: AllPackages }), OutputJax: new SVG({ fontCache: 'none' }) });
  return (MJ = { A, doc });
}
const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
function parseTransform(s) {
  let m = [1, 0, 0, 1, 0, 0];
  for (const [, fn, args] of String(s ?? '').matchAll(/(\w+)\(([^)]*)\)/g)) {
    const a = args.split(/[\s,]+/).filter(Boolean).map(Number);
    if (fn === 'translate') m = mul(m, [1, 0, 0, 1, a[0], a[1] ?? 0]);
    else if (fn === 'scale') m = mul(m, [a[0], 0, 0, a[1] ?? a[0], 0, 0]);
    else if (fn === 'matrix') m = mul(m, a);
    else if (fn === 'rotate') { const r = (a[0] * Math.PI) / 180; m = mul(m, [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]); }
  }
  return m;
}
const MAX_TEX = 2000;
export const texKey = (tex, display = true) => (hashStr((display ? 'D:' : 'I:') + tex) >>> 0).toString(36);

// Compila (síncrono tras boot) y devuelve { tex, w, h, glyphs:[{c, shape}] } en unidades em, origen arriba-izquierda.
export function compileTexSync(tex, display = true) {
  if (!MJ) throw new Error('tex: MathJax no inicializado (usa await texReady())');
  const { A, doc } = MJ, node = doc.convert(tex, { display }), svg = A.firstChild(node);
  const vb = (A.getAttribute(svg, 'viewBox') || '0 0 1000 1000').split(/\s+/).map(Number), glyphs = [];
  if (A.textContent(svg).includes('merror') || /data-mjx-error/.test(A.outerHTML(svg))) throw new Error(`TeX inválido: ${tex}`);
  const walk = (n, m) => {
    if (A.kind(n) === '#text' || A.kind(n) === '#comment') return;
    const k = A.kind(n), mm = mul(m, parseTransform(A.getAttribute(n, 'transform')));
    if (k === 'path') glyphs.push({ c: A.getAttribute(n, 'data-c') ?? '', d: A.getAttribute(n, 'd'), m: mm });
    else if (k === 'rect') { const x = +A.getAttribute(n, 'x') || 0, y = +A.getAttribute(n, 'y') || 0, w = +A.getAttribute(n, 'width'), h = +A.getAttribute(n, 'height'); glyphs.push({ c: 'rule', d: `M${x} ${y}H${x + w}V${y + h}H${x}Z`, m: mm }); }
    for (const ch of A.childNodes(n) ?? []) walk(ch, mm);
  };
  for (const ch of A.childNodes(svg)) walk(ch, [1, 0, 0, 1, 0, 0]);
  const em = 1000;
  return { tex, display, w: vb[2] / em, h: vb[3] / em, glyphs: glyphs.filter((g) => g.d).map((g) => ({ c: g.c, shape: round(mapPts(parsePath(g.d), (x, y) => [(g.m[0] * x + g.m[2] * y + g.m[4] - vb[0]) / em, (g.m[1] * x + g.m[3] * y + g.m[5] - vb[1]) / em])) })) };
}
const round = (S) => ({ contours: S.contours.map((c) => ({ closed: c.closed, d: c.d.map((v) => Math.round(v * 1e4) / 1e4) })) });

export async function texReady() { await boot(); }
// Compilador con caché en disco. Se inyecta en film.assets (film.mjs) para que seek siga siendo síncrono y puro.
export function makeTexStore(root) {
  const dir = path.join(root, 'assets/cache/tex'); fs.mkdirSync(dir, { recursive: true });
  const mem = new Map();
  return {
    get(tex, display = true) {
      const k = texKey(tex, display); if (mem.has(k)) return mem.get(k);
      const f = path.join(dir, k + '.json'); let v;
      let hit = null; try { hit = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
      if (hit) v = hit;
      else {
        if (typeof tex !== 'string' || tex.length > MAX_TEX) throw new Error(`tex: expresión no válida (cadena de ≤ ${MAX_TEX} caracteres)`);
        // Fallo de caché = TeX generado por el shot (p. ej. una ecuación por década): se compila AQUÍ, en el servicio del motor, con los
        // globales reales (el shot solo cede una cadena y recibe contornos; el resultado es función pura de la cadena → determinista).
        trusted(() => { v = compileTexSync(tex, display); writeAtomic(f, JSON.stringify(v));
        withLockSync('tex-cache', () => {                                     // RMW del manifiesto bajo lock: dos agentes no se pisan entradas
          const ix = path.join(dir, 'index.json'); let I = {}; try { I = JSON.parse(fs.readFileSync(ix, 'utf8')); } catch {}
          I[k] = { tex, display }; writeAtomic(ix, JSON.stringify(I, null, 1));   // manifiesto para el navegador
        }); });
      }
      mem.set(k, v); return v;
    },
    dir,
  };
}
