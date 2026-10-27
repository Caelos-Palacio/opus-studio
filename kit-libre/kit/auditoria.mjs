// auditoria.mjs: comprobaciones automaticas de un proyecto frame(ctx,t). CLI: node kit/auditoria.mjs <proyecto> [--escala .5]
import { createCanvas } from 'canvas';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { medir } from './audio.mjs';
import { contraste } from './texto.mjs';
import { hexRgb } from './base.mjs';

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

// ---- fallos graves de composicion: ocupacion del sujeto, texto desbordado y contraste real ----
export const OCUPACION_MIN = 0.3, CONTRASTE_MIN = 4.5;
const interseccion = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/**
 * ocupacionSujeto(caja,W,H,{ok,min}): fraccion del cuadro que ocupa el sujeto DECLARADO (caja {x,y,w,h} en px del cuadro).
 * Devuelve {estado:'OK'|'EXENTO'|'FALLO',frac,msg}. FALLO si < min (30 %), si no hay sujeto ni `ok` (ocupacion_ok:{porque}), o si la caja se sale del cuadro.
 */
export function ocupacionSujeto(caja, W, H, { ok = null, min = OCUPACION_MIN } = {}) {
  const porque = typeof ok === 'string' ? ok : ok?.porque;
  if (!caja) return porque && porque.trim().length >= 12 ? { estado: 'EXENTO', frac: null, msg: `plano general intencionado: ${porque}` } : { estado: 'FALLO', frac: null, msg: 'sin sujeto declarado: declara `sujeto:{x,y,w,h}` o `ocupacion_ok:{porque}` (motivo de 12+ letras)' };
  const dentro = interseccion(caja, { x: 0, y: 0, w: W, h: H }), area = Math.max(1, caja.w * caja.h), frac = dentro / (W * H);
  if (dentro / area < 0.8) return { estado: 'FALLO', frac, msg: `la caja del sujeto queda ${Math.round((1 - dentro / area) * 100)} % fuera del cuadro` };
  if (frac < min) return porque && porque.trim().length >= 12 ? { estado: 'EXENTO', frac, msg: `${(frac * 100).toFixed(0)} % (< ${min * 100} %) pero intencionado: ${porque}` } : { estado: 'FALLO', frac, msg: `el sujeto ocupa ${(frac * 100).toFixed(1)} % del cuadro (minimo ${min * 100} %): agrandalo o declara ocupacion_ok` };
  return { estado: 'OK', frac, msg: `${(frac * 100).toFixed(0)} % del cuadro (minimo ${min * 100} %)` };
}

/** textoDesbordado(cajasTexto,W,H): textos que se salen de su `contenedor` {x,y,w,h} declarado (o del cuadro). Lista {texto,motivo}; vacia = bien. */
export function textoDesbordado(cajas, W, H, tol = 1.5) {
  const out = [];
  for (const b of cajas) {
    const c = b.contenedor, tag = b.id ?? b.texto ?? '?';
    if (c) { const dx = Math.max(c.x - b.x, b.x + b.w - (c.x + c.w), 0), dy = Math.max(c.y - b.y, b.y + b.h - (c.y + c.h), 0); if (dx > tol || dy > tol) out.push({ texto: b, motivo: `"${tag}" se sale de su contenedor ${Math.round(dx)} px en x y ${Math.round(dy)} px en y` }); }
    else if (b.x < -tol || b.y < -tol || b.x + b.w > W + tol || b.y + b.h > H + tol) out.push({ texto: b, motivo: `"${tag}" se sale del cuadro` });
  }
  return out;
}

const linealizar = new Float32Array(256).map((_, i) => { const v = i / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
const luminancia = (r, g, b) => 0.2126 * linealizar[r] + 0.7152 * linealizar[g] + 0.0722 * linealizar[b];
/**
 * contrasteCaja(canvas,caja): contraste WCAG del color del texto (`caja.color`, hex) contra el fondo REAL renderizado alrededor de la caja
 * (anillo exterior de ~0,3 tam + pixeles interiores lejos del color del texto). Devuelve {mediana,peor,n}; `peor` es el decil menos favorable.
 */
export function contrasteCaja(c, b) {
  const tam = b.tam ?? b.h, pad = Math.max(3, Math.round(tam * 0.3)), x0 = Math.max(0, Math.floor(b.x - pad)), y0 = Math.max(0, Math.floor(b.y - pad)), x1 = Math.min(c.width, Math.ceil(b.x + b.w + pad)), y1 = Math.min(c.height, Math.ceil(b.y + b.h + pad));
  if (x1 - x0 < 2 || y1 - y0 < 2) return null;
  const d = c.getContext('2d').getImageData(x0, y0, x1 - x0, y1 - y0).data, tc = hexRgb(b.color), Lt = luminancia(tc[0], tc[1], tc[2]), al = Math.min(1, Math.max(0, b.alfa ?? 1)), rs = [];
  let te = tc; // color de texto efectivo: con alfa < 1 es la mezcla con el fondo (estimado con el anillo exterior)
  if (al < 0.999) { let n = 0; const m = [0, 0, 0]; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) { const o = ((y - y0) * (x1 - x0) + (x - x0)) * 4; m[0] += d[o]; m[1] += d[o + 1]; m[2] += d[o + 2]; n++; } if (n) te = tc.map((v, k) => al * v + (1 - al) * m[k] / n); }
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const o = ((y - y0) * (x1 - x0) + (x - x0)) * 4, dentro = x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
    if (dentro && Math.hypot(d[o] - te[0], d[o + 1] - te[1], d[o + 2] - te[2]) < 70) continue; // pixel de texto (o casi)
    const Lb = luminancia(d[o], d[o + 1], d[o + 2]), Le = al >= 0.999 ? Lt : luminancia(Math.round(al * tc[0] + (1 - al) * d[o]), Math.round(al * tc[1] + (1 - al) * d[o + 1]), Math.round(al * tc[2] + (1 - al) * d[o + 2])); // alfa < 1: el color efectivo es la mezcla con el fondo
    rs.push((Math.max(Le, Lb) + 0.05) / (Math.min(Le, Lb) + 0.05));
  }
  if (rs.length < 8) return { mediana: 1, peor: 1, n: rs.length };
  rs.sort((a, b2) => a - b2); return { mediana: rs[rs.length >> 1], peor: rs[Math.floor(rs.length * 0.1)], n: rs.length };
}

/**
 * auditarCuadro({canvas,cajas,escena,W,H}): aplica ocupacion, texto desbordado y contraste a UN cuadro ya renderizado. `cajas` (en px del canvas):
 * {texto:[{id,x,y,w,h,color,tam,alfa,contenedor?}], objetos:[...], sujeto?:{x,y,w,h}}; `escena` puede llevar `sujeto` y `ocupacion_ok`.
 * Devuelve filas {check,estado:'OK'|'AVISO'|'FALLO'|'EXENTO',msg}; FALLO = fallo grave.
 */
export function auditarCuadro({ canvas, cajas, escena = {}, W, H }) {
  const f = [], cj = cajas ?? { texto: [], objetos: [] }, suj = cj.sujeto ?? escena.sujeto ?? null;
  const o = ocupacionSujeto(typeof suj === 'function' ? null : suj, W, H, { ok: escena.ocupacion_ok }); f.push({ check: 'ocupacion', ...o });
  if (suj && o.estado !== 'FALLO') { const c = canvas, r = { x: Math.max(0, suj.x), y: Math.max(0, suj.y), w: Math.min(c.width - Math.max(0, suj.x), suj.w), h: Math.min(c.height - Math.max(0, suj.y), suj.h) }; if (r.w > 8 && r.h > 8) { const t = createCanvas(Math.round(r.w), Math.round(r.h)); t.getContext('2d').drawImage(c, r.x, r.y, r.w, r.h, 0, 0, t.width, t.height); if (vacio(t).vacio) f.push({ check: 'ocupacion', estado: 'FALLO', msg: 'la caja del sujeto declarada esta vacia o plana' }); } }
  const des = textoDesbordado(cj.texto, W, H); des.forEach((x) => f.push({ check: 'texto', estado: 'FALLO', msg: x.motivo }));
  if (!des.length) f.push({ check: 'texto', estado: 'OK', msg: `${cj.texto.length} cajas de texto dentro de su contenedor` });
  const tt = textoTapado(cj.texto, cj.objetos); tt.forEach((x) => f.push({ check: 'texto', estado: 'FALLO', msg: `"${x.texto.id ?? ''}" tapado por "${x.objeto.id ?? ''}" (${Math.round(x.area)} px2)` }));
  let peor = null; const cr = [];
  for (const b of cj.texto) { if (!b.color || (b.alfa ?? 1) < 0.1) continue; const r = contrasteCaja(canvas, b); if (!r) continue; cr.push({ b, r }); if (!peor || r.mediana < peor.r.mediana) peor = { b, r }; }
  cr.forEach(({ b, r }) => { if (r.mediana < CONTRASTE_MIN) f.push({ check: 'contraste', estado: 'FALLO', msg: `"${b.id ?? ''}" ${r.mediana.toFixed(1)}:1 contra el fondo real (minimo ${CONTRASTE_MIN}:1)` }); else if (r.peor < 3) f.push({ check: 'contraste', estado: 'AVISO', msg: `"${b.id ?? ''}" mediana ${r.mediana.toFixed(1)}:1 pero zonas de ${r.peor.toFixed(1)}:1` }); });
  if (peor && peor.r.mediana >= CONTRASTE_MIN) f.push({ check: 'contraste', estado: 'OK', msg: `minimo ${peor.r.mediana.toFixed(1)}:1 ("${peor.b.id ?? ''}")` });
  return f;
}

async function cli() {
  const dir = path.resolve(process.argv[2] || '.'), k = parseFloat(process.argv[process.argv.indexOf('--escala') + 1]) || 0.5, mp4 = process.argv.includes('--mp4') ? process.argv[process.argv.indexOf('--mp4') + 1] : null;
  const imp = (f) => import(pathToFileURL(path.join(dir, f)).href), tl = await imp('timeline.js'), fr = await imp('frame.js');
  const W = Math.round((fr.W ?? 1920) * k), H = Math.round((fr.H ?? 1080) * k), esc = tl.escenas, graves = [], avisos = [], info = [], porEscena = esc.map(() => []);
  const s = (b) => b && ({ ...b, x: b.x * k, y: b.y * k, w: b.w * k, h: b.h * k, tam: b.tam && b.tam * k, contenedor: b.contenedor && { x: b.contenedor.x * k, y: b.contenedor.y * k, w: b.contenedor.w * k, h: b.contenedor.h * k } });
  const ts = esc.flatMap((e, i) => [e.t0 + e.dur * 0.5, e.t0 + e.dur * 0.75, e.t0 + Math.min(0.4, e.dur / 4), ...(i < esc.length - 1 ? [e.t0 + e.dur - 0.25] : [])]);
  const det = determinismo(fr.frame, ts.slice(0, 4), { W, H }); if (!det.ok) graves.push(`determinismo: md5 distinto en t=${det.fallos.map((t) => t.toFixed(2))}`);
  esc.forEach((e, i) => {
    const medio = [e.t0 + e.dur * 0.5, e.t0 + e.dur * 0.75];
    [...medio, e.t0 + Math.min(0.4, e.dur / 4), ...(i < esc.length - 1 ? [e.t0 + e.dur - 0.25] : [])].forEach((t, j) => {
      const c = createCanvas(W, H); fr.frame(c.getContext('2d'), t); const v = vacio(c), o = ocupacion(c), tag = `t=${t.toFixed(2)}`, cj = fr.cajas?.(t), rows = porEscena[i];
      info.push(`${tag} (${e.id}) pixeles distintos del fondo ${(o * 100).toFixed(0)}% desv ${v.desv.toFixed(0)} detalle ${v.grad.toFixed(1)}`);
      if (v.vacio) rows.push({ check: 'cuadro', estado: 'FALLO', msg: `${tag}: cuadro vacio o plano` });
      if (cj) {
        const cc = { texto: cj.texto.map(s), objetos: cj.objetos.map(s), sujeto: s(typeof cj.sujeto === 'function' ? cj.sujeto(t - e.t0) : cj.sujeto) }, esce = { ...e, sujeto: s(typeof e.sujeto === 'function' ? e.sujeto(t - e.t0) : e.sujeto) };
        if (j < 2) rows.push(...auditarCuadro({ canvas: c, cajas: cc, escena: esce, W, H }).map((r) => ({ ...r, msg: `${tag}: ${r.msg}` })));
        else textoTapado(cc.texto, cc.objetos).forEach((x) => rows.push({ check: 'texto', estado: 'FALLO', msg: `${tag}: "${x.texto.id ?? ''}" tapado por "${x.objeto.id ?? ''}"` }));
        cc.texto.forEach((b) => { if (b.tam && b.tam < 28 * k) rows.push({ check: 'texto', estado: 'AVISO', msg: `${tag}: "${b.id ?? ''}" de ${Math.round(b.tam / k)}px < 28` }); });
        if (j === 0) zoom4x(c, cc.texto.slice(0, 2).map((b) => ({ x: b.x - 10, y: b.y - 10, w: Math.min(b.w + 20, W / 4), h: b.h + 20 })), path.join(dir, 'auditoria'), `e${i}-texto`);
      } else if (j === 0) rows.push(...auditarCuadro({ canvas: c, cajas: null, escena: { ...e, sujeto: s(e.sujeto) }, W, H }).filter((r) => r.check === 'ocupacion'));
      if (j === 0) zoom4x(c, [{ x: W * 0.4, y: H * 0.4, w: W / 5, h: H / 5 }], path.join(dir, 'auditoria'), `e${i}-centro`);
    });
  });
  const D = esc.map((e) => e.dur), mu = D.reduce((a, b) => a + b, 0) / D.length, cv = Math.sqrt(D.reduce((a, b) => a + (b - mu) ** 2, 0) / D.length) / mu;
  const ritmo = []; if (D.length > 2 && cv < 0.3) ritmo.push({ check: 'ritmo', estado: 'AVISO', msg: `duraciones demasiado regulares (CV ${cv.toFixed(2)} < 0.3)` }); D.forEach((d, i) => d < 2 && ritmo.push({ check: 'ritmo', estado: 'AVISO', msg: `escena ${esc[i].id} dura ${d}s (< 2 s)` }));
  if (mp4 && fs.existsSync(mp4)) { const m = medir(mp4); info.push(`audio I ${m.I} LUFS, TP ${m.TP} dBTP, LRA ${m.LRA} LU`); if (m.TP > -1) graves.push(`pico verdadero ${m.TP} dBTP > -1`); if (m.I < -19 || m.I > -16) avisos.push(`sonoridad ${m.I} LUFS fuera de -19..-16`); }
  const sal = [`AUDITORIA ${dir}`, `ritmo: ${D.length} escenas, CV de duraciones ${cv.toFixed(2)}`];
  const marca = { OK: ' ok  ', EXENTO: ' ok* ', AVISO: ' aviso', FALLO: ' FALLO' };
  esc.forEach((e, i) => {
    sal.push(`\nEscena "${e.id}" (${e.t0}-${(e.t0 + e.dur).toFixed(1)} s)`);
    const vistos = new Set(); for (const r of porEscena[i]) { const kk = `${r.check}|${r.estado}|${r.msg.replace(/^t=[\d.]+: /, '')}`; if (vistos.has(kk) && r.estado === 'OK') continue; vistos.add(kk); sal.push(`  [${marca[r.estado]}] ${r.check.padEnd(9)} ${r.msg}`); (r.estado === 'FALLO' ? graves : r.estado === 'AVISO' ? avisos : []).push(`${e.id}: ${r.check}: ${r.msg}`); }
  });
  ritmo.forEach((r) => { sal.push(`  [ aviso] ${r.check} ${r.msg}`); avisos.push(r.msg); });
  sal.push('\nDetalle', ...info.map((x) => '  . ' + x), `\nRESUMEN: ${graves.length} fallos graves, ${avisos.length} avisos`, ...graves.map((x) => '  ! ' + x), `recortes 4x en ${path.join(dir, 'auditoria')}`);
  console.log(sal.join('\n')); process.exit(graves.length ? 1 : 0);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) cli();
