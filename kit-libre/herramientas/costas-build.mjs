// costas-build.mjs: node herramientas/costas-build.mjs [land.geojson]. Recorta Natural Earth 1:50m (dominio publico) a
// Europa occidental + Atlantico Norte (lon -25..30, lat 35..72, con margen de 1.5 grados) y escribe kit/datos/costas.json.
// Descarga: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson
import fs from 'node:fs';
const L0 = -26.5, L1 = 31.5, A0 = 33.5, A1 = 73.5, DEC = 2;
const ent = [[(p) => p[0] >= L0, (a, b) => { const t = (L0 - a[0]) / (b[0] - a[0]); return [L0, a[1] + t * (b[1] - a[1])]; }], [(p) => p[0] <= L1, (a, b) => { const t = (L1 - a[0]) / (b[0] - a[0]); return [L1, a[1] + t * (b[1] - a[1])]; }],
  [(p) => p[1] >= A0, (a, b) => { const t = (A0 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), A0]; }], [(p) => p[1] <= A1, (a, b) => { const t = (A1 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), A1]; }]];
const recortar = (anillo) => { let s = anillo; for (const [dentro, cruce] of ent) { const o = []; s.forEach((b, i) => { const a = s[(i + s.length - 1) % s.length]; if (dentro(b)) { if (!dentro(a)) o.push(cruce(a, b)); o.push(b); } else if (dentro(a)) o.push(cruce(a, b)); }); s = o; if (!s.length) return []; } return s; };
const area = (r) => Math.abs(r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0) / 2);
const gj = JSON.parse(fs.readFileSync(process.argv[2] ?? '/tmp/claude-1000/ne/land50.json', 'utf8')), anillos = [];
for (const f of gj.features) for (const poli of f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) poli.forEach((r, k) => { const c = recortar(r); if (c.length >= 4 && area(c) > 0.004) anillos.push({ hueco: k > 0, p: c }); });
const q = (v) => +v.toFixed(DEC), out = { fuente: 'Natural Earth 1:50m land (dominio publico), recortado', bbox: [L0, A0, L1, A1], anillos: anillos.map((a) => ({ hueco: a.hueco, p: a.p.flatMap(([x, y]) => [q(x), q(y)]) })) };
fs.writeFileSync(new URL('../kit/datos/costas.json', import.meta.url), JSON.stringify(out)); console.log(anillos.length, 'anillos', fs.statSync(new URL('../kit/datos/costas.json', import.meta.url)).size, 'bytes');
