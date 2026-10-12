// auditoria.mjs: comprobaciones automaticas de un proyecto frame(ctx,t). CLI: node kit/auditoria.mjs <proyecto> [--escala .5]
import { createCanvas } from 'canvas';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { medir } from './audio.mjs';

const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
const pix = (c, w, h) => { const t = createCanvas(w, h), g = t.getContext('2d'); g.drawImage(c, 0, 0, w, h); return g.getImageData(0, 0, w, h).data; };

/** textoTapado(cajasTexto,cajasObjetos): lista de intersecciones {texto,objeto,area} entre cajas {x,y,w,h}; vacia = bien. */
export function textoTapado(ct, co) {
  const out = [];
  for (const a of ct) for (const b of co) { const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); if (ix > 0 && iy > 0) out.push({ texto: a, objeto: b, area: ix * iy }); }
  return out;
}
/** ocupacion(canvas,{fondo,umbral}): fraccion 0-1 del cuadro que difiere del fondo (canvas `fondo` dado, o fondo estimado desde los bordes). */
export function ocupacion(c, { fondo = null, umbral = 28 } = {}) {
  const w = Math.max(8, c.width >> 3), h = Math.max(8, c.height >> 3), d = pix(c, w, h), f = fondo ? pix(fondo, w, h) : null; let n = 0;
  const m = Math.max(1, Math.round(w * 0.05)), edge = (x0, y0, x1, y1) => { const s = [0, 0, 0]; let k = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { for (let j = 0; j < 3; j++) s[j] += d[(y * w + x) * 4 + j]; k++; } return s.map((v) => v / k); };
  const Lc = Array.from({ length: h }, (_, y) => edge(0, y, m, y + 1)), Rc = Array.from({ length: h }, (_, y) => edge(w - m, y, w, y + 1)), Tc = Array.from({ length: w }, (_, x) => edge(x, 0, x + 1, m)), Bc = Array.from({ length: w }, (_, x) => edge(x, h - m, x + 1, h));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let e = 0; for (let j = 0; j < 3; j++) { const bg = f ? f[(y * w + x) * 4 + j] : (Lc[y][j] * (1 - x / w) + Rc[y][j] * (x / w) + Tc[x][j] * (1 - y / h) + Bc[x][j] * (y / h)) / 2; e += Math.abs(d[(y * w + x) * 4 + j] - bg); }
    if (e / 3 > umbral) n++;
  }
  return n / (w * h);
}
/** vacio(canvas): {desv,grad,vacio}; vacio=true si el cuadro es casi plano (desviacion de luminancia baja o sin detalle local). */
export function vacio(c) {
  const w = c.width >> 1, h = c.height >> 1, d = pix(c, w, h); let s = 0, s2 = 0, g = 0; const N = w * h;
  for (let i = 0; i < N; i++) { const l = lum(d, i * 4); s += l; s2 += l * l; if (i % w) g += Math.abs(l - lum(d, (i - 1) * 4)); }
  const desv = Math.sqrt(Math.max(0, s2 / N - (s / N) ** 2)), grad = g / N; return { desv, grad, vacio: desv < 8 || grad < 0.4 };
}
const md5 = (c) => createHash('md5').update(c.toBuffer('raw')).digest('hex');
/** determinismo(frameFn,ts,{W,H}): renderiza cada t dos veces (intercaladas) y compara md5; devuelve {ok,fallos}. */
export function determinismo(fn, ts, { W = 480, H = 270 } = {}) {
  const r = (t) => { const c = createCanvas(W, H); fn(c.getContext('2d'), t); return md5(c); }, a = ts.map(r), b = ts.map(r);
  const fallos = ts.filter((_, i) => a[i] !== b[i]); return { ok: !fallos.length, fallos };
}
/** zoom4x(canvas,regiones,dir,prefijo): guarda recortes {x,y,w,h} ampliados x4 sin suavizar; devuelve las rutas. */
export function zoom4x(c, regs, dir, pre = 'zoom') {
  fs.mkdirSync(dir, { recursive: true });
  return regs.map((r, i) => { const x = Math.max(0, Math.round(r.x)), y = Math.max(0, Math.round(r.y)), w = Math.min(c.width - x, Math.round(r.w)), h = Math.min(c.height - y, Math.round(r.h)), o = createCanvas(w * 4, h * 4), g = o.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(c, x, y, w, h, 0, 0, w * 4, h * 4); const f = path.join(dir, `${pre}-${i}.png`); fs.writeFileSync(f, o.toBuffer('image/png')); return f; });
}

async function cli() {
  const dir = path.resolve(process.argv[2] || '.'), k = parseFloat(process.argv[process.argv.indexOf('--escala') + 1]) || 0.5, mp4 = process.argv.includes('--mp4') ? process.argv[process.argv.indexOf('--mp4') + 1] : null;
  const imp = (f) => import(pathToFileURL(path.join(dir, f)).href), tl = await imp('timeline.js'), fr = await imp('frame.js');
  const W = Math.round((fr.W ?? 1920) * k), H = Math.round((fr.H ?? 1080) * k), esc = tl.escenas, graves = [], avisos = [], info = [];
  const ts = esc.flatMap((e, i) => [e.t0 + e.dur * 0.5, e.t0 + Math.min(0.4, e.dur / 4), ...(i < esc.length - 1 ? [e.t0 + e.dur - 0.25] : [])]);
  const det = determinismo(fr.frame, ts.slice(0, 4), { W, H }); if (!det.ok) graves.push(`determinismo: md5 distinto en t=${det.fallos.map((t) => t.toFixed(2))}`);
  ts.forEach((t, i) => {
    const c = createCanvas(W, H); fr.frame(c.getContext('2d'), t); const v = vacio(c), o = ocupacion(c), tag = `t=${t.toFixed(2)}`;
    info.push(`${tag} ocupacion ${(o * 100).toFixed(0)}% desv ${v.desv.toFixed(0)} detalle ${v.grad.toFixed(1)}`);
    if (v.vacio) graves.push(`${tag}: cuadro vacio o plano`); if (o < 0.04) avisos.push(`${tag}: sujeto casi ausente (${(o * 100).toFixed(1)}%)`);
    const cj = fr.cajas?.(t); if (cj) {
      const s = (b) => ({ ...b, x: b.x * k, y: b.y * k, w: b.w * k, h: b.h * k }), tt = textoTapado(cj.texto.map(s), cj.objetos.map(s));
      tt.forEach((x) => graves.push(`${tag}: texto "${x.texto.id ?? ''}" tapado por "${x.objeto.id ?? ''}" (${Math.round(x.area)} px2)`));
      cj.texto.forEach((b) => { if (b.tam && b.tam < 28) avisos.push(`${tag}: texto "${b.id ?? ''}" de ${b.tam}px < 28`); });
      zoom4x(c, cj.texto.slice(0, 2).map(s).map((b) => ({ x: b.x - 10, y: b.y - 10, w: Math.min(b.w + 20, W / 4), h: b.h + 20 })), path.join(dir, 'auditoria'), `t${i}-texto`);
    }
    zoom4x(c, [{ x: W * 0.4, y: H * 0.4, w: W / 5, h: H / 5 }], path.join(dir, 'auditoria'), `t${i}-centro`);
  });
  const D = esc.map((e) => e.dur), mu = D.reduce((a, b) => a + b, 0) / D.length, cv = Math.sqrt(D.reduce((a, b) => a + (b - mu) ** 2, 0) / D.length) / mu;
  info.push(`ritmo: ${D.length} escenas, CV de duraciones ${cv.toFixed(2)}`); if (D.length > 2 && cv < 0.3) avisos.push(`duraciones demasiado regulares (CV ${cv.toFixed(2)} < 0.3)`); D.forEach((d, i) => d < 2 && avisos.push(`escena ${esc[i].id} dura ${d}s (< 2 s)`));
  if (mp4 && fs.existsSync(mp4)) { const m = medir(mp4); info.push(`audio I ${m.I} LUFS, TP ${m.TP} dBTP, LRA ${m.LRA} LU`); if (m.TP > -1) graves.push(`pico verdadero ${m.TP} dBTP > -1`); if (m.I < -19 || m.I > -16) avisos.push(`sonoridad ${m.I} LUFS fuera de -19..-16`); }
  console.log(`AUDITORIA ${dir}\n` + info.map((s) => '  . ' + s).join('\n') + `\n${avisos.length} avisos\n` + avisos.map((s) => '  ~ ' + s).join('\n') + `\n${graves.length} fallos graves\n` + graves.map((s) => '  ! ' + s).join('\n') + `\nrecortes 4x en ${path.join(dir, 'auditoria')}`);
  process.exit(graves.length ? 1 : 0);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) cli();
