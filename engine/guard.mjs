// Guardia del contrato v4. Cierra el hueco de v3.5: usar ctx crudo se saltaba tipografía, safe area y cámara.
// Solo activo en lint (film.guard): en render no hay Proxy (coste cero).
import fs from 'node:fs';
import path from 'node:path';

const PAINT = new Set(['fill', 'stroke', 'fillRect', 'strokeRect', 'drawImage']);
export function guardCtx(ctx, rec) {
  const m0 = ctx.getTransform(), det = (m) => Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)), base = det(m0) || 1;
  let depth = 0; const scales = [];
  const proxy = new Proxy(ctx, {
    get(target, prop) {
      const v = target[prop];
      if (typeof v !== 'function') return v;
      if (prop === 'fillText' || prop === 'strokeText') return (...a) => { rec.violations.push({ op: prop, detail: String(a[0]).slice(0, 40) }); return v.apply(target, a); };
      if (prop === 'setTransform' || prop === 'resetTransform') return (...a) => { rec.violations.push({ op: prop, detail: 'transform absoluta: ignora la cámara del motor' }); return v.apply(target, a); };
      if (prop === 'save') return () => { depth++; return v.call(target); };
      if (prop === 'restore') return () => { depth--; return v.call(target); };
      if (PAINT.has(prop)) return (...a) => { if (!rec.inApi) scales.push(det(target.getTransform()) / base); return v.apply(target, a); };
      return v.bind(target);
    },
    set(target, prop, val) { target[prop] = val; return true; },
  });
  return {
    ctx: proxy,
    end() {
      const m1 = ctx.getTransform(), moved = ['a', 'b', 'c', 'd', 'e', 'f'].some((k) => Math.abs(m1[k] - m0[k]) > 1e-6);
      if (depth !== 0) rec.violations.push({ op: 'save/restore', detail: `desequilibrio ${depth > 0 ? '+' : ''}${depth}` });
      else if (moved) rec.violations.push({ op: 'transform', detail: 'el shot deja el ctx transformado (fuga de estado)' });
      if (scales.length >= 8) { const s = [...scales].sort((a, b) => a - b), med = s[s.length >> 1], frac = s.filter((v) => Math.abs(v - med) / med < 0.03).length / s.length; rec.scale = { med, frac, n: s.length }; }
    },
  };
}

// Escaneo estático de shots/*.mjs: lo que rompe la pureza de seek(t) se detecta ANTES de renderizar, con archivo y línea.
const RULES = [
  [/\bMath\.random\s*\(/, 'FIX', 'Math.random', 'usar rng(seed) o hash2(i, seed)'],
  [/\bDate\.now\s*\(|\bnew Date\s*\(/, 'FIX', 'Date', 'el reloj es t (frame/fps)'],
  [/\bperformance\.now\s*\(/, 'FIX', 'performance.now', 'el reloj es t'],
  [/\brequestAnimationFrame\b|\bsetTimeout\b|\bsetInterval\b/, 'FIX', 'temporizador', 'nada asíncrono en un shot'],
  [/\bfetch\s*\(|\bXMLHttpRequest\b/, 'FIX', 'red en el shot', 'pre-cargar como asset (engine/assets.mjs)'],
  [/\bctx\.(fillText|strokeText)\s*\(/, 'FIX', 'texto sin api.text', 'api.text / api.label / api.tex (registran cajas para el lint)'],
  [/\bctx\.(setTransform|resetTransform)\s*\(/, 'FIX', 'transform absoluta', 'la cámara la aplica el motor; usa api.depth / scene nodes'],
];
export function scanShots(root, ids) {
  const out = [];
  for (const id of ids) {
    const f = path.join(root, 'shots', id + '.mjs'); if (!fs.existsSync(f)) continue;
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((L, i) => {
      const code = L.replace(/\/\/.*$/, '');
      for (const [re, level, what, fix] of RULES) if (re.test(code)) out.push({ level, shot: id, line: i + 1, problem: `${what} en shots/${id}.mjs:${i + 1}`, remedy: fix });
      if (/^\s*(let|var)\s+\w+/.test(code) && !/^\s/.test(L)) out.push({ level: 'WARN', shot: id, line: i + 1, problem: `estado de módulo mutable (shots/${id}.mjs:${i + 1})`, remedy: 'const, o memo derivado de t' });
    });
  }
  return out;
}
