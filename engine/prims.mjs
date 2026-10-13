// Primitivas semánticas: el agente describe QUÉ (un plot, un campo, una ecuación, un grafo) y el motor decide CÓMO,
// registrando cajas (lint) y metadatos (índice) automáticamente. Todas son funciones puras de t.
// DOC alimenta docs/API.md (engine/doc.mjs): la referencia no puede desincronizarse del código.
import { clamp, lerp, hash2, noise1, rng, hashStr, TAU } from './core.mjs';
import { WARPS, parsePath, shapes, affine, tracePath, tracePolys, traceTrim, morphPolys, bbox, warpShape, mapPts } from './geom.mjs';
import { layer as fxLayer, bloom as fxBloom, pool as fxPool } from './fx.mjs';
import { angleCheck } from './w3d-camera.mjs';
import { span } from './perf.mjs';
import { rgba, mix } from './color.mjs';
import { drawFondo } from './fondos.mjs';
import { drawObjeto, OBJETOS } from './objetos.mjs';
import { drawSvg, SVG_LIB } from './svg.mjs';

export const DOC = {};
const rrect = (c, x, y, w, h, r) => { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
const doc = (name, sig, text) => (DOC[name] = { sig, text });
const memo = (film, bucket) => { film._memo ??= {}; return (film._memo[bucket] ??= new Map()); };

doc('tex', 'api.tex(tex, x, y, {size, align, color, write, stagger, morphTo, u, display})', 'Ecuación TeX real (MathJax → contornos). write∈[0,1] = escritura trazo→relleno; morphTo+u = morph glifo a glifo. Registra caja de texto (role math).');
doc('path', 'api.path(shape|d, {x,y,s,rot, fill, stroke, lw, trim:[a,b], warp, morphTo, u, arc, label, focus})', 'Cualquier forma vectorial (SVG d o Shape). trim = draw-on; warp = deformación vectorial (WARPS); morphTo = morph arbitrario.');
doc('axes', 'api.axes({x,y,w,h, xr:[a,b], yr:[a,b], ticks, xlabel, ylabel, u, grid}) → {X, Y, rect}', 'Ejes científicos con draw-on; devuelve mapeadores dato→píxel.');
doc('plot', 'api.plot(fn|[[x,y]], axes, {u, color, lw, n, fill, label})', 'Curva de función o datos, draw-on por u. Registra foco.');
doc('arrow', 'api.arrow(x0,y0,x1,y1, {u, color, lw, head})', 'Flecha con draw-on.');
doc('field', 'api.field(F(x,y)→[vx,vy], rect, {n, u, color, scale, mag})', 'Campo vectorial en rejilla; color por magnitud.');
doc('streamlines', 'api.streamlines(F, rect, {seeds, steps, h, u, flow, color, key})', 'Líneas de corriente RK4 memorizadas; flow = desplazamiento de guiones con t.');
doc('trajectory', 'api.trajectory(P(t)→[x,y], {t0, t1, trail, color, lw, head, fade})', 'Trayectoria de un cuerpo con estela; P es función del tiempo (pura).');
doc('particles', 'api.particles({seed, rate, life, at(tb)→[x,y], speed, spread, angle, gravity, drag, turb, size, color, t0, t1, fps, blend})', 'Partículas SIN estado: forma cerrada con arrastre y gravedad; emisor móvil vía at(tb).');
doc('sim', 'api.sim(key, {init, step(state,dt,k), dt}) → state(t)', 'Simulación determinista con checkpoints cada 60 pasos: seek(t) cuesta ≤60 pasos aunque t sea grande.');
doc('graph', 'api.graph({nodes, edges, seed, rect, u, labels, r}) → pos', 'Red con layout de fuerzas sembrado y memorizado; aristas con draw-on escalonado.');
doc('globe', 'api.globe({x,y,r, lon, lat, features, graticule, u})', 'Proyección ortográfica girable con ocultación de cara trasera; features = polilíneas [lon,lat].');
doc('label', 'api.label(str, [x,y], {role, avoid, leader})', 'Etiqueta que se coloca sola en 8 posiciones evitando focos y texto ya registrados.');
doc('image', 'api.image(id, x, y, w, h, {fit, alpha})', 'Imagen de assets/ (síncrona en Node).');
doc('footage', 'api.footage(id, tLocal, x, y, w, h, {loop, speed, fit})', 'Vídeo real: fotogramas pre-extraídos (engine/assets.mjs --footage) con remapeo de tiempo.');
doc('layer', 'api.layer(spec, (ctx, t, api) => ...)', 'Capa compuesta con efectos (blur, bloom, motionBlur, trail, dirBlur, chroma, displace, warp, mask, fps, blend).');
doc('world3d', 'api.world3d(scene, {rect, t, u, cam, overrides, step, motionBlur, transparent, ssaa, alpha, groundFy, parallax, bloom, bg, scale, override}) → {horizonY, groundY, el, fov}', '3D REAL como capa del compositor (backend aislado headless-gl+three): el shot declara la escena como DATOS ({id, background, fog, ground, camera, objects:[{shape|instances, size, pos, color, mat, outline}]}) y el motor la dibuja con el estilo (paleta forzada, luz clave S.light.az, bandas toon + contorno de tinta, niebla y sombra de contacto, SSAA; v2: sombras proyectadas (shadow map, bandas toon o PCF), AO de contacto, rim con el acento, bloom por el post 2D con bloom:true; ground:{catcher:true} proyecta la sombra sobre el suelo 2D). camera:{fromShot:true, scale, horizon} deriva elevación y lente del horizonte y la línea de suelo del shot (api.ground o groundFy) y de la escala de plano (shot.size): PG el∈[8°,20°], PM [5°,15°], heroico [−12°,−4°]; fuera de regla sin override ⇒ aviso w3d.angulo del lint; con fromShot el parallax de la cámara 2D mueve la cámara 3D con la ley de api.depth. background:{top,bottom}|\'sample\' hace que la niebla tome el degradado del fondo. cam/overrides pueden ser funciones de t (cam.ppm = px por metro en el foco); step:\'auto\' sigue los twos del film. Se dibuja ANTES del grade/post/medio. Sin gl/Mesa: lint FIX.');
doc('p3', 'api.p3(x, y, z) → [sx, sy, k]', 'Proyección en perspectiva alrededor del foco de cámara (z>0 = lejos). k = escala.');
doc('card3d', 'api.card3d({x,y,w,h, rx, ry, z}, (ctx, api) => ...)', 'Tarjeta con giro 3D real (homografía por malla) — ≤ 60° legible.');
doc('atmos', 'api.atmos(z) → {alpha, blur}', 'Perspectiva atmosférica y DOF del estilo para una profundidad z.');
doc('fondo', 'api.fondo({preset?, semilla?, ajustes?:{idCapa:{…}}, sin?:[idCapa], capas?:[{tipo, id?, alfa, mezcla, paralaje, deriva, anim:{alfa,escala,dx,dy}, …params}]}, {alfa})', 'Fondo GENERATIVO como pila de capas declaradas (datos): degradados, ruido (fbm, deformado, celular, flujo), atmósfera (niebla, polvo, rayos, bokeh, estrellas, orbes), motivos (retícula, trama, rayado, semitono, motivo), luz (viñeta, foco, terminador) y temáticas (olas, acuarela, perfil). Presets temáticos con `porque` (cosmos_profundo, cuba_oscura, expediente_kraft, papel_carta_acuarela, mar_acuarela, noche_ciudad, laboratorio, taller_madera, amanecer_niebla, plano_tecnico). Determinista (semilla), con parallax por capa y animación por expresiones de t; colores por rol de la paleta del medio. Pintar PRIMERO en el shot. Catálogo: node engine/fondos-meta.mjs.');
doc('objeto', 'api.objeto(id, {x, y, size, rot, estado, partes, params, color, relleno, acento, flip, alfa, label}) → {x, y, w, h, <ancla>:{x,y}}', 'Objeto vectorial paramétrico de la biblioteca (cilindro_metalico, campana_cristal, llave_laton, balanza_cruz, sello_tampon, acta_cuaderno, pluma, fotomultiplicador, cuba, contador, papel_continuo, lapiz, lampara_mesa, botella_vidrio, tarjeta_postal, moneda, sobre_sello, red_pesca, mapa_costero, reloj, mano, puerta, ventana, mesa, libro). `estado` = nombre o [a,b,u] (interpola), `partes` = valores animables, `params` = forma/cantidad/texto; devuelve las anclas con nombre en px. Registra foco. Trazo con la tinta del medio y relleno por rol.');
doc('svg', 'api.svg(id, {x, y, size, rot, flip, alfa, trazo, morphTo, u, roles, mono, label}) → {x, y, w, h, punta:{x,y}, centro:{x,y}}', `SVG importado (assets/svg/: ${SVG_LIB.join(', ')}; o una ruta assets/….svg) como elemento: sanitizado (sin scripts/href externos/foreignObject), cuadro unidad de lado size, recoloreable por roles de paleta (data-fill/data-stroke, roles:{"#hex":"rol"}, mono:"rol"), trazo 0..1 = trazado progresivo por longitud de path (punta = la pluma) y morphTo+u entre dos SVG con el mismo número de paths.`);
doc('box', 'api.box(x, y, w, h, {label, tag, color, fill, fillAlpha, radius, lw, banda, sombra, alpha, role}) → {x, y, w, h}', 'Caja con rótulo para diagramas: relleno (fill, def. paper), contorno (color), banda superior, sombra, etiqueta numerada (tag) y rótulo de varias líneas (label con saltos de línea: la 1.ª en role, las demás en label). Registra el texto para el lint; el foco lo pone el diagrama.');

export function prims(ctx, api, film, shot, cx) {
  const S = film.S, col = api.color, k = api.k, W = film.width, H = film.height;
  const log = (prim, box, extra = {}) => api.meta.push({ prim, shot: shot.id, ...box, ...extra });
  const colorOf = (c) => (typeof c === 'string' ? col(c) : c);
  const texSize = (o) => o.size ?? api.sizes[o.role ?? 'h2'] * 1.1;

  const fondoE = (film._fondoE ??= { cache: new Map() });
  const P = {
    fondo(spec, o = {}) {
      const E = fondoE; if (E.pal !== S.palette) { E.pal = S.palette; E._col = null; E._palKey = null; }
      Object.assign(E, { W, H, k, canvas: film.canvas, depth: api.depth, u: cx.u, dur: shot.t[1] - shot.t[0], lt: o.lt ?? cx.t - shot.t[0], alfa: o.alfa ?? 1 });
      drawFondo(ctx, spec, cx.t, E);
    },
    objeto(id, o = {}) {
      const tf = S.typeface, r = drawObjeto(ctx, id, { ...o, x: o.x, y: o.y }, { pal: S.palette, k, t: cx.t, font: `"${tf.mono || 'Courier New'}", monospace` }), c = Math.abs(Math.cos(r.rot)), sn = Math.abs(Math.sin(r.rot));
      const bw = r.w * c + r.h * sn, bh = r.w * sn + r.h * c; if (o.focus !== false) api.focus(r.x - bw / 2, r.y - bh / 2, bw, bh, o.label ?? id, o.hollow ? { hollow: o.hollow } : {});
      log('objeto', { x: r.x - bw / 2, y: r.y - bh / 2, w: bw, h: bh }, { objeto: id });
      return r;
    },
    svg(id, o = {}) {
      const doc = film.assets.svg(id), B = o.morphTo != null ? film.assets.svg(o.morphTo) : undefined, r = drawSvg(ctx, doc, { ...o, morphTo: B }, { pal: S.palette, k }), c = Math.abs(Math.cos(r.rot)), sn = Math.abs(Math.sin(r.rot));
      const bw = r.w * c + r.h * sn, bh = r.w * sn + r.h * c; api.focus(r.x - bw / 2, r.y - bh / 2, bw, bh, o.label ?? id);
      log('svg', { x: r.x - bw / 2, y: r.y - bh / 2, w: bw, h: bh }, { svg: id });
      return r;
    },
    box(x, y, w, h, o = {}) {
      const a = clamp(o.alpha ?? 1), rad = Math.min((o.radius ?? 0) * k, w / 2, h / 2), cc = o.color ?? 'ink', fl = o.fill === undefined ? 'paper' : o.fill, lw = (o.lw ?? 2) * k;
      const path = () => { ctx.beginPath(); if (rad > 0) rrect(ctx, x, y, w, h, rad); else ctx.rect(x, y, w, h); };
      ctx.save();
      if (o.sombra) { ctx.globalAlpha = 0.22 * a; ctx.fillStyle = col('shade'); path(); ctx.fill(); }
      if (fl) { ctx.globalAlpha = a * (o.fillAlpha ?? 0.92); ctx.fillStyle = col(fl); path(); ctx.fill(); }
      if (o.banda) { ctx.globalAlpha = a; ctx.fillStyle = col(cc); ctx.fillRect(x, y, w, o.banda * k); }
      if (lw > 0) { ctx.globalAlpha = a; ctx.strokeStyle = col(cc); ctx.lineWidth = lw; path(); ctx.stroke(); }
      ctx.restore();
      if (o.tag != null && o.tag !== '') api.text(String(o.tag), x + 24 * k, y + 28 * k, { role: 'label', color: cc, alpha: a, align: 'left' });
      const L = o.label == null ? [] : String(o.label).split('\n'), s1 = api.sizes[o.role ?? 'body'], s2 = api.sizes.label, gap = 1.45;
      if (L.length) { const blk = s1 * 1.2 + (L.length - 1) * s2 * gap, y0 = y + h / 2 - blk / 2 + s1 * 0.6 + (o.tag ? 12 * k : 0);
        L.forEach((ln, i) => api.text(ln, x + w / 2, i ? y0 + s1 * 0.6 + (i - 0.5) * s2 * gap + s2 * 0.1 : y0, i ? { role: 'label', alpha: 0.85 * a } : { role: o.role ?? 'body', alpha: a })); }
      return { x, y, w, h };
    },
    tex(tex, x, y, o = {}) {
      const T = film.assets.tex(tex, o.display !== false), size = texSize(o), w = T.w * size, h = T.h * size;
      const al = o.align ?? 'center', x0 = al === 'center' ? x - w / 2 : al === 'right' ? x - w : x, y0 = y - h / 2;
      const place = (S2) => affine(S2, { x: x0, y: y0, s: size });
      const fill = colorOf(o.color ?? 'ink'), write = o.write ?? 1, n = T.glyphs.length, st = o.stagger ?? 0.6;
      ctx.save(); ctx.fillStyle = fill; ctx.strokeStyle = fill; ctx.lineWidth = Math.max(1, size * 0.018); ctx.lineJoin = 'round';
      if (o.morphTo) {
        // Morph SEMÁNTICO: los glifos con el mismo carácter se emparejan por LCS (orden preservado) y viajan RÍGIDOS
        // (una ∂ sigue siendo ∂ durante todo el viaje); solo los huecos entre anclas se deforman con morphPolys.
        const B = film.assets.tex(o.morphTo, o.display !== false), wB = B.w * size, x0B = al === 'center' ? x - wB / 2 : al === 'right' ? x - wB : x;
        const u = clamp(o.u ?? 0), plan = texMorphPlan(film, T, B), GA = T.glyphs.map((g) => affine(g.shape, { x: x0, y: y - (T.h * size) / 2, s: size })), GB = B.glyphs.map((g) => affine(g.shape, { x: x0B, y: y - (B.h * size) / 2, s: size }));
        const e = u * u * (3 - 2 * u);
        ctx.beginPath();
        for (const [i, j] of plan.pairs) {                                   // rígido: bbox A → bbox B, con arco para no cruzarse
          const a = bbox(GA[i]), b = bbox(GB[j]), sx = lerp(1, b.w / Math.max(1e-6, a.w), e), sy = lerp(1, b.h / Math.max(1e-6, a.h), e);
          const lift = Math.sin(Math.PI * e) * (o.arc ?? 0.15) * (b.x - a.x);
          tracePath(ctx, affine(GA[i], { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) - lift, sx, sy, ox: a.x, oy: a.y }));
        }
        for (const [ia, ib] of plan.gaps) {                                  // huecos: deformación entre grupos
          const A2 = { contours: ia.flatMap((i) => GA[i].contours) }, B2 = { contours: ib.flatMap((j) => GB[j].contours) };
          if (ia.length && ib.length) { if (u <= 1e-3) tracePath(ctx, A2); else if (u >= 1 - 1e-3) tracePath(ctx, B2); else tracePolys(ctx, morphPolys(A2, B2, e, { n: 48 })); }
        }
        ctx.fill('evenodd');
        for (const [ia, ib] of plan.gaps) if (!ia.length || !ib.length) {    // aparece/desaparece: escala desde su centro + fundido
          const G = !ia.length ? ib.map((j) => GB[j]) : ia.map((i) => GA[i]), k2 = !ia.length ? clamp(e * 1.6 - 0.6) : clamp(1 - e * 1.6);
          if (k2 <= 0) continue; ctx.save(); ctx.globalAlpha = k2; ctx.beginPath();
          for (const g of G) { const b = bbox(g); tracePath(ctx, affine(g, { x: b.x + b.w / 2, y: b.y + b.h / 2, s: 0.6 + 0.4 * k2, ox: b.x + b.w / 2, oy: b.y + b.h / 2 })); }
          ctx.fill('evenodd'); ctx.restore();
        }
      } else T.glyphs.forEach((g, i) => {
        const a = (i / Math.max(1, n)) * st, lw = clamp((write - a) / (1 - st)), G = place(g.shape);
        if (lw <= 0) return;
        if (lw < 1) { ctx.globalAlpha = 1; ctx.beginPath(); traceTrim(ctx, G, 0, Math.min(1, lw * 1.6)); ctx.stroke(); ctx.globalAlpha = clamp(lw * 2 - 1); }
        ctx.beginPath(); tracePath(ctx, G); ctx.fill('evenodd'); ctx.globalAlpha = 1;
      });
      const m = ctx.getTransform(); ctx.restore();
      if (write > 0.2) api._box(m, { x: x0, y: y0, w, h }, { kind: 'text', role: 'math', label: tex, size: size * 0.7, chars: Math.ceil(n * 0.6) });
      log('tex', { x: x0, y: y0, w, h }, { tex, morphTo: o.morphTo, u: o.u });
      return { x: x0, y: y0, w, h };
    },

    path(src, o = {}) {
      let Sh = typeof src === 'string' ? parsePath(src) : src;
      if (o.x != null || o.s != null || o.rot) Sh = affine(Sh, { x: o.x ?? 0, y: o.y ?? 0, s: o.s ?? 1, rot: o.rot ?? 0, ox: o.ox ?? 0, oy: o.oy ?? 0 });
      let Bh = o.morphTo ? (typeof o.morphTo === 'string' ? parsePath(o.morphTo) : o.morphTo) : null;
      if (Bh && (o.x != null || o.s != null || o.rot)) Bh = affine(Bh, { x: o.x ?? 0, y: o.y ?? 0, s: o.s ?? 1, rot: o.rot ?? 0, ox: o.ox ?? 0, oy: o.oy ?? 0 });
      if (o.warp) { Sh = warpShape(Sh, o.warp); if (Bh) Bh = warpShape(Bh, o.warp); }
      const u = clamp(o.u ?? 0);
      ctx.save(); ctx.beginPath();
      const trim = o.trim && (o.trim[0] > 0 || o.trim[1] < 1);
      if (trim) traceTrim(ctx, Sh, o.trim[0], o.trim[1]);
      else if (Bh && u > 1e-3) { if (u >= 1 - 1e-3) tracePath(ctx, Bh); else tracePolys(ctx, morphPolys(Sh, Bh, u, { n: o.n ?? 72, arc: o.arc ?? 0 })); }
      else tracePath(ctx, Sh);
      if (o.fill && !trim) { ctx.fillStyle = colorOf(o.fill); ctx.globalAlpha = o.alpha ?? 1; ctx.fill(o.rule ?? 'evenodd'); }
      if (o.stroke || trim) { ctx.strokeStyle = colorOf(o.stroke ?? o.fill ?? 'ink'); ctx.lineWidth = (o.lw ?? 3) * k; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = o.alpha ?? 1; ctx.stroke(); }
      ctx.restore();
      const b = bbox(Bh && u > 0.5 ? Bh : Sh);
      if (o.focus !== false) api.focus(b.x, b.y, b.w, b.h, o.label ?? 'forma', { weight: o.weight ?? 1, hollow: o.hollow ?? 0 });
      log('path', b, { label: o.label });
      return b;
    },

    axes(o = {}) {
      const r = { x: o.x ?? api.safe.x0 + api.safe.w * 0.1, y: o.y ?? api.safe.y0 + api.safe.h * 0.1, w: o.w ?? api.safe.w * 0.8, h: o.h ?? api.safe.h * 0.75 };
      const [xa, xb] = o.xr ?? [0, 1], [ya, yb] = o.yr ?? [0, 1], u = clamp(o.u ?? 1);
      const X = (v) => r.x + ((v - xa) / (xb - xa)) * r.w, Y = (v) => r.y + r.h - ((v - ya) / (yb - ya)) * r.h;
      const zx = clamp(X(0), r.x, r.x + r.w), zy = clamp(Y(0), r.y, r.y + r.h);
      ctx.save(); ctx.strokeStyle = col(o.color ?? 'ink'); ctx.lineWidth = 2 * k; ctx.lineCap = 'round';
      if (o.grid) { ctx.globalAlpha = 0.18 * u; ctx.lineWidth = 1 * k; for (let i = 0; i <= (o.ticks ?? 5); i++) { const f = i / (o.ticks ?? 5); ctx.beginPath(); ctx.moveTo(r.x + f * r.w, r.y); ctx.lineTo(r.x + f * r.w, r.y + r.h); ctx.moveTo(r.x, r.y + f * r.h); ctx.lineTo(r.x + r.w, r.y + f * r.h); ctx.stroke(); } ctx.globalAlpha = 1; ctx.lineWidth = 2 * k; }
      ctx.beginPath(); ctx.moveTo(r.x, zy); ctx.lineTo(r.x + r.w * clamp(u * 2), zy); ctx.moveTo(zx, r.y + r.h); ctx.lineTo(zx, r.y + r.h - r.h * clamp(u * 2 - 0.3)); ctx.stroke();
      const nt = o.ticks ?? 5; ctx.lineWidth = 1.5 * k;
      for (let i = 0; i <= nt; i++) { const f = i / nt; if (f > u * 1.2) break; ctx.beginPath(); ctx.moveTo(r.x + f * r.w, zy - 5 * k); ctx.lineTo(r.x + f * r.w, zy + 5 * k); ctx.moveTo(zx - 5 * k, r.y + r.h - f * r.h); ctx.lineTo(zx + 5 * k, r.y + r.h - f * r.h); ctx.stroke(); }
      ctx.restore();
      if (u > 0.6 && o.xlabel) api.text(o.xlabel, r.x + r.w, zy + api.sizes.label * 1.4, { role: 'label', align: 'right', alpha: clamp((u - 0.6) / 0.4) });
      if (u > 0.6 && o.ylabel) api.text(o.ylabel, zx + api.sizes.label * 0.6, r.y - api.sizes.label * 0.2, { role: 'label', align: 'left', alpha: clamp((u - 0.6) / 0.4) });
      log('axes', r, { xr: [xa, xb], yr: [ya, yb] });
      return { X, Y, rect: r, xr: [xa, xb], yr: [ya, yb] };
    },

    plot(f, ax, o = {}) {
      const n = o.n ?? 240, [xa, xb] = ax.xr, pts = typeof f === 'function' ? Array.from({ length: n + 1 }, (_, i) => { const v = xa + ((xb - xa) * i) / n; return [ax.X(v), ax.Y(f(v))]; }) : f.map(([a, b]) => [ax.X(a), ax.Y(b)]);
      const good = pts.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
      const Sh = shapes.polyline(good.map((p) => [clamp(p[0], ax.rect.x - 50, ax.rect.x + ax.rect.w + 50), clamp(p[1], ax.rect.y - 50, ax.rect.y + ax.rect.h + 50)]));
      ctx.save(); ctx.beginPath(); ctx.rect(ax.rect.x, ax.rect.y - 4, ax.rect.w, ax.rect.h + 8); ctx.clip();
      ctx.beginPath(); traceTrim(ctx, Sh, 0, clamp(o.u ?? 1)); ctx.strokeStyle = colorOf(o.color ?? 'accent'); ctx.lineWidth = (o.lw ?? 4) * k; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
      const b = bbox(Sh); api.focus(b.x, b.y, b.w, b.h, o.label ?? 'curva', { weight: o.weight ?? 0.8, hollow: 0.85 });
      log('plot', b, { label: o.label }); return b;
    },

    arrow(x0, y0, x1, y1, o = {}) {
      const u = clamp(o.u ?? 1), ex = lerp(x0, x1, u), ey = lerp(y0, y1, u), a = Math.atan2(y1 - y0, x1 - x0), hs = (o.head ?? 14) * k * Math.min(1, u * 3);
      ctx.save(); ctx.strokeStyle = ctx.fillStyle = colorOf(o.color ?? 'ink'); ctx.lineWidth = (o.lw ?? 3) * k; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(ex - Math.cos(a) * hs * 0.6, ey - Math.sin(a) * hs * 0.6); ctx.stroke();
      if (hs > 0.5) { ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - hs * Math.cos(a - 0.45), ey - hs * Math.sin(a - 0.45)); ctx.lineTo(ex - hs * Math.cos(a + 0.45), ey - hs * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    },

    field(F, r, o = {}) {
      const n = o.n ?? 14, u = clamp(o.u ?? 1), ny = Math.max(2, Math.round((n * r.h) / r.w)), cell = r.w / n, vs = [];
      for (let j = 0; j < ny; j++) for (let i = 0; i < n; i++) { const x = r.x + (i + 0.5) * cell, y = r.y + ((j + 0.5) * r.h) / ny, v = F(x, y); vs.push([x, y, v[0], v[1], Math.hypot(v[0], v[1])]); }
      const mx = o.mag ?? Math.max(1e-9, ...vs.map((v) => v[4]));
      vs.forEach(([x, y, vx, vy, m], i) => {
        const d = hash2(i, 5) * 0.4, uu = clamp((u - d) / 0.6); if (uu <= 0) return;
        const L = cell * 0.8 * clamp(m / mx, 0.15, 1) * uu, a = Math.atan2(vy, vx);
        P.arrow(x - (Math.cos(a) * L) / 2, y - (Math.sin(a) * L) / 2, x + (Math.cos(a) * L) / 2, y + (Math.sin(a) * L) / 2, { lw: 2, head: 7, color: mix(col(o.low ?? 'shade'), col(o.color ?? 'accent'), clamp(m / mx)) });
      });
      log('field', r, { n });
    },

    streamlines(F, r, o = {}) {
      const key = o.key ?? shot.id + ':sl:' + hashStr(F.toString() + JSON.stringify(r) + (o.seeds ?? 24)), M = memo(film, 'stream');
      let lines = M.get(key);
      if (!lines) {
        const R = rng(o.seed ?? 7), h = o.h ?? 4, steps = o.steps ?? 120; lines = [];
        const f = (x, y) => { const v = F(x, y), m = Math.hypot(v[0], v[1]) || 1; return [v[0] / m, v[1] / m]; };
        for (let s = 0; s < (o.seeds ?? 24); s++) {
          let x = r.x + R() * r.w, y = r.y + R() * r.h; const pts = [[x, y]];
          for (let i = 0; i < steps; i++) { const a = f(x, y), b = f(x + (h / 2) * a[0], y + (h / 2) * a[1]), c = f(x + (h / 2) * b[0], y + (h / 2) * b[1]), d = f(x + h * c[0], y + h * c[1]);
            x += (h / 6) * (a[0] + 2 * b[0] + 2 * c[0] + d[0]); y += (h / 6) * (a[1] + 2 * b[1] + 2 * c[1] + d[1]); if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) break; pts.push([x, y]); }
          if (pts.length > 4) lines.push(shapes.polyline(pts));
        }
        M.set(key, lines);
      }
      const u = clamp(o.u ?? 1);
      ctx.save(); ctx.strokeStyle = colorOf(o.color ?? 'accent2'); ctx.lineWidth = (o.lw ?? 2) * k; ctx.lineCap = 'round';
      if (o.flow) { ctx.setLineDash([12 * k, 10 * k]); ctx.lineDashOffset = -cx.t * o.flow * 40 * k; }
      lines.forEach((L, i) => { ctx.globalAlpha = 0.85; ctx.beginPath(); traceTrim(ctx, L, 0, clamp(u * 1.4 - (i / lines.length) * 0.4)); ctx.stroke(); });
      ctx.restore(); if (o.focus !== false) api.focus(r.x, r.y, r.w, r.h, o.label ?? 'flujo', { weight: o.weight ?? 0.45, hollow: 0.92, bleed: o.bleed ?? true }); log('streamlines', r, { n: lines.length });
    },

    trajectory(Pf, o = {}) {
      const t0 = o.t0 ?? shot.t[0], t1 = Math.min(o.t1 ?? cx.t, cx.t), trail = o.trail ?? Infinity, a = Math.max(t0, t1 - trail), n = Math.max(2, Math.ceil((t1 - a) * 60));
      const pts = Array.from({ length: n + 1 }, (_, i) => Pf(a + ((t1 - a) * i) / n));
      ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = (o.lw ?? 3) * k; const c = colorOf(o.color ?? 'accent');
      for (let i = 1; i < pts.length; i++) { ctx.strokeStyle = o.fade === false ? c : rgba(c, (i / pts.length) ** 1.5); ctx.beginPath(); ctx.moveTo(...pts[i - 1]); ctx.lineTo(...pts[i]); ctx.stroke(); }
      const hd = pts[pts.length - 1]; if (o.head !== false) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(hd[0], hd[1], (o.r ?? 9) * k, 0, TAU); ctx.fill(); }
      ctx.restore(); api.focus(hd[0] - 14 * k, hd[1] - 14 * k, 28 * k, 28 * k, o.label ?? 'móvil', { weight: o.weight ?? 0.7 });
      log('trajectory', { x: hd[0], y: hd[1], w: 0, h: 0 }); return hd;
    },

    particles(o = {}) {
      const t = o.fps ? Math.floor(cx.t * o.fps + 1e-9) / o.fps : cx.t, rate = o.rate ?? 60, life = o.life ?? 1.5, t0 = o.t0 ?? shot.t[0], t1 = o.t1 ?? Infinity, seed = o.seed ?? 1;
      const g = o.gravity ?? [0, 0], kd = o.drag ?? 0, c = colorOf(o.color ?? 'accent'), at = o.at ?? (() => [W / 2, H / 2]);
      const iMin = Math.max(0, Math.ceil((t - life - t0) * rate)), iMax = Math.floor((Math.min(t, t1) - t0) * rate);
      ctx.save(); if (o.blend) ctx.globalCompositeOperation = o.blend; ctx.fillStyle = c; let n = 0;
      for (let i = iMin; i <= iMax; i++) {
        const tb = t0 + i / rate, tau = t - tb; if (tau < 0 || tau > life) continue;
        const r1 = hash2(i, seed), r2 = hash2(i, seed + 1), r3 = hash2(i, seed + 2), ang = (o.angle ?? -Math.PI / 2) + (r1 - 0.5) * (o.spread ?? TAU), sp = (o.speed ?? 200) * k * (0.5 + r2);
        const [ex, ey] = at(tb), v0x = Math.cos(ang) * sp, v0y = Math.sin(ang) * sp;
        let x, y;
        if (kd > 1e-6) { const e = (1 - Math.exp(-kd * tau)) / kd; x = ex + (g[0] * k * tau) / kd + (v0x - (g[0] * k) / kd) * e; y = ey + (g[1] * k * tau) / kd + (v0y - (g[1] * k) / kd) * e; }
        else { x = ex + v0x * tau + 0.5 * g[0] * k * tau * tau; y = ey + v0y * tau + 0.5 * g[1] * k * tau * tau; }
        if (o.turb) { x += o.turb * k * noise1(tau * 2 + r1 * 10, seed + i); y += o.turb * k * noise1(tau * 2 + r3 * 10, seed + i + 99); }
        const lf = tau / life, al = Math.min(1, lf * 8) * (1 - lf) ** 1.2, s = (o.size ?? 3) * k * (0.6 + 0.8 * r3) * (o.shrink === false ? 1 : 1 - 0.6 * lf);
        ctx.globalAlpha = al; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill(); n++;
      }
      ctx.restore(); log('particles', { x: 0, y: 0, w: 0, h: 0 }, { alive: n }); return n;
    },

    sim(key, o) {
      const M = memo(film, 'sim'), dt = o.dt ?? 1 / 120, K = 60, target = Math.max(0, Math.floor((cx.t - (o.t0 ?? shot.t[0])) / dt + 1e-9));
      let cp = M.get(key); if (!cp) { cp = new Map([[0, structuredClone(o.init)]]); M.set(key, cp); }
      let base = Math.floor(target / K) * K; while (base > 0 && !cp.has(base)) base -= K;
      let st = structuredClone(cp.get(base));
      for (let i = base; i < target; i++) { st = o.step(st, dt, i); if ((i + 1) % K === 0 && !cp.has(i + 1)) cp.set(i + 1, structuredClone(st)); }
      return st;
    },

    graph(o) {
      const key = JSON.stringify([o.nodes, o.edges, o.seed ?? 1]), M = memo(film, 'graph'), r = o.rect ?? { x: api.safe.x0 + api.safe.w * 0.15, y: api.safe.y0 + api.safe.h * 0.15, w: api.safe.w * 0.7, h: api.safe.h * 0.7 };
      let L = M.get(key);
      if (!L) {                                                            // Fruchterman–Reingold sembrado: mismo grafo → mismo dibujo, siempre
        const R = rng(o.seed ?? 1), N = o.nodes.length, p = o.nodes.map(() => [R(), R()]), kk = Math.sqrt(1 / N), idx = new Map(o.nodes.map((n, i) => [n, i]));
        for (let it = 0; it < 300; it++) {
          const d = p.map(() => [0, 0]), T = 0.1 * (1 - it / 300);
          for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const dx = p[i][0] - p[j][0], dy = p[i][1] - p[j][1], dd = Math.max(1e-3, Math.hypot(dx, dy)), f = (kk * kk) / dd; d[i][0] += (dx / dd) * f; d[i][1] += (dy / dd) * f; d[j][0] -= (dx / dd) * f; d[j][1] -= (dy / dd) * f; }
          for (const [a, b] of o.edges) { const i = idx.get(a), j = idx.get(b), dx = p[i][0] - p[j][0], dy = p[i][1] - p[j][1], dd = Math.max(1e-3, Math.hypot(dx, dy)), f = (dd * dd) / kk; d[i][0] -= (dx / dd) * f; d[i][1] -= (dy / dd) * f; d[j][0] += (dx / dd) * f; d[j][1] += (dy / dd) * f; }
          for (let i = 0; i < N; i++) { const m = Math.hypot(...d[i]) || 1; p[i][0] += (d[i][0] / m) * Math.min(m, T); p[i][1] += (d[i][1] / m) * Math.min(m, T); }
        }
        const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]), [ax, bx, ay, by] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
        L = new Map(o.nodes.map((n, i) => [n, [(p[i][0] - ax) / (bx - ax || 1), (p[i][1] - ay) / (by - ay || 1)]])); M.set(key, L);
      }
      const pos = new Map([...L].map(([n, [fx, fy]]) => [n, [r.x + fx * r.w, r.y + fy * r.h]])), u = clamp(o.u ?? 1), rad = (o.r ?? 14) * k;
      ctx.save(); ctx.strokeStyle = col(o.edgeColor ?? 'shade'); ctx.lineWidth = 2.5 * k;
      o.edges.forEach(([a, b], i) => { const uu = clamp((u - (i / o.edges.length) * 0.5) / 0.5); if (uu <= 0) return; const A = pos.get(a), B = pos.get(b); ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(lerp(A[0], B[0], uu), lerp(A[1], B[1], uu)); ctx.stroke(); });
      o.nodes.forEach((n, i) => { const uu = clamp((u - (i / o.nodes.length) * 0.4) / 0.3), [x, y] = pos.get(n); if (uu <= 0) return; ctx.fillStyle = col(o.hot?.includes(n) ? 'accent' : 'ink'); ctx.beginPath(); ctx.arc(x, y, rad * api.spring(uu * 0.6), 0, TAU); ctx.fill(); });
      ctx.restore();
      api.focus(r.x, r.y, r.w, r.h, o.label ?? 'red', { weight: o.weight ?? 0.9, hollow: 0.5 });
      if (o.labels && u > 0.7) for (const n of o.nodes) P.label(n, pos.get(n), { role: 'label', alpha: clamp((u - 0.7) / 0.3), clearance: rad });
      log('graph', r, { nodes: o.nodes.length, edges: o.edges.length }); return pos;
    },

    globe(o = {}) {
      const x = o.x ?? W / 2, y = o.y ?? H / 2, R = o.r ?? Math.min(W, H) * 0.3, l0 = ((o.lon ?? 0) * Math.PI) / 180, p0 = ((o.lat ?? 0) * Math.PI) / 180, u = clamp(o.u ?? 1);
      const pr = (lon, lat) => { const l = (lon * Math.PI) / 180 - l0, p = (lat * Math.PI) / 180, cz = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l); return [x + R * Math.cos(p) * Math.sin(l), y - R * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)), cz]; };
      const line = (pts) => { let on = false; for (const q of pts) { const [a, b, z] = pr(q[0], q[1]); if (z < 0) { on = false; continue; } if (!on) ctx.moveTo(a, b); else ctx.lineTo(a, b); on = true; } };
      ctx.save(); ctx.fillStyle = col(o.sea ?? 'shade'); ctx.globalAlpha = 0.35 * u; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill(); ctx.globalAlpha = u;
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 2 * k; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU * u); ctx.stroke();
      if (o.graticule !== false) { ctx.globalAlpha = 0.25 * u; ctx.lineWidth = 1 * k; ctx.beginPath(); for (let lo = -180; lo < 180; lo += 30) line(Array.from({ length: 37 }, (_, i) => [lo, -90 + i * 5])); for (let la = -60; la <= 60; la += 30) line(Array.from({ length: 73 }, (_, i) => [-180 + i * 5, la])); ctx.stroke(); }
      ctx.globalAlpha = u; ctx.strokeStyle = col(o.color ?? 'accent'); ctx.lineWidth = (o.lw ?? 2.5) * k; ctx.beginPath(); for (const f of o.features ?? []) line(f); ctx.stroke();
      for (const m of o.markers ?? []) { const [a, b, z] = pr(m[0], m[1]); if (z > 0) { ctx.fillStyle = col('accent'); ctx.beginPath(); ctx.arc(a, b, 6 * k, 0, TAU); ctx.fill(); } }
      ctx.restore(); api.focus(x - R, y - R, 2 * R, 2 * R, o.label ?? 'globo', { weight: 1, hollow: 0.2 });
      log('globe', { x: x - R, y: y - R, w: 2 * R, h: 2 * R }); return { project: pr };
    },

    // Colocación automática: 8 candidatos alrededor del ancla; coste = solape con cajas ya registradas + salir del área segura.
    label(str, [ax, ay], o = {}) {
      const role = o.role ?? 'label', size = api.sizes[role], cl = (o.clearance ?? 0) + size * 0.9;
      ctx.save(); ctx.font = `600 ${size}px ${api.family}`; const w = ctx.measureText(str).width, m = ctx.getTransform(); ctx.restore();
      const cands = [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]].map(([dx, dy]) => [ax + dx * (cl + w / 2), ay + dy * cl]);
      const sc = (cxx, cyy) => { const b = api._toScreen(m, { x: cxx - w / 2, y: cyy - size * 0.6, w, h: size * 1.2 }); let c = 0;
        for (const B of api.boxes) if (B.kind === 'text' || (B.kind === 'focus' && B.weight >= 0.5)) c += Math.max(0, Math.min(b.x + b.w, B.x + B.w) - Math.max(b.x, B.x)) * Math.max(0, Math.min(b.y + b.h, B.y + B.h) - Math.max(b.y, B.y));
        const s = api.safeScreen; c += 50 * (Math.max(0, s.x0 - b.x) + Math.max(0, b.x + b.w - s.x1) + Math.max(0, s.y0 - b.y) + Math.max(0, b.y + b.h - s.y1)) * size; return c; };
      let best = cands[0], bc = Infinity; for (const c of cands) { const v = sc(...c); if (v < bc - 1e-6) { bc = v; best = c; } }
      if (o.leader) { ctx.save(); ctx.strokeStyle = col('shade'); ctx.lineWidth = 1.5 * k; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(best[0], best[1]); ctx.stroke(); ctx.restore(); }
      api.text(str, best[0], best[1], { role, alpha: o.alpha ?? 1, color: o.color });
      return best;
    },

    image(id, x, y, w, h, o = {}) {
      const img = film.assets.image(id); if (!img) { if (film.browser) return placeholderBox(ctx, api, x, y, w, h, id); throw new Error(`imagen "${id}" no encontrada en assets/`); }
      const [dx, dy, dw, dh, sx, sy, sw, sh] = fit(img.width, img.height, x, y, w, h, o.fit ?? 'cover');
      ctx.save(); ctx.globalAlpha = o.alpha ?? 1; ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh); ctx.restore();
      if (o.focus !== false) api.focus(x, y, w, h, o.label ?? id, { weight: o.weight ?? 1 });
      log('image', { x, y, w, h }, { id });
    },
    footage(id, tl, x, y, w, h, o = {}) {
      const F = film.assets.footage(id); if (!F && film.browser) return placeholderBox(ctx, api, x, y, w, h, id); if (!F) throw new Error(`footage "${id}" sin extraer: node engine/assets.mjs --footage archivo --id ${id}`);
      let tt = tl * (o.speed ?? 1); if (o.loop) tt = ((tt % F.duration) + F.duration) % F.duration; tt = clamp(tt, 0, F.duration - 1 / F.fps);
      const img = F.frame(Math.floor(tt * F.fps + 1e-6)), [dx, dy, dw, dh, sx, sy, sw, sh] = fit(img.width, img.height, x, y, w, h, o.fit ?? 'cover');
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.globalAlpha = o.alpha ?? 1; ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh); ctx.restore();
      if (o.focus !== false) api.focus(x, y, w, h, o.label ?? id, { weight: o.weight ?? 1 });
      log('footage', { x, y, w, h }, { id, t: tt });
    },

    layer(spec, draw) {
      fxLayer(film, ctx, spec, cx.t, (lctx, tt) => { const sub = api._sub(lctx, tt); draw(lctx, tt, sub); });
      log('layer', { x: 0, y: 0, w: W, h: H }, { fx: Object.keys(spec) });
    },

    // 3D como capa (spec 004/009): escena declarada como datos; el backend (film.world3d) rasteriza a la resolución de dispositivo y el
    // resultado se dibuja con el transform actual (cámara 2D del shot incluida). Pasa por el MISMO grade/post/medio que el 2D.
    // v2: con scene.camera.fromShot la cámara sale del horizonte/suelo del shot (api.ground o o.groundFy), la escala de plano (shot.size)
    // y el parallax de la cámara 2D (truck/dolly 3D con la misma ley que api.depth); o.bloom pasa el emisivo por el bloom del post 2D (fx.bloom);
    // fondo/niebla con degradado muestreado del 2D (scene.background:'sample' u o.bgSample).
    world3d(scene, o = {}) {
      const W3 = film.world3d, rect = o.rect ?? [0, 0, W, H], B = cx.base, sx = Math.hypot(B.a, B.b), sy = Math.hypot(B.c, B.d), pw = Math.max(2, Math.round(rect[2] * sx)), ph = Math.max(2, Math.round(rect[3] * sy));
      const box = { x: rect[0], y: rect[1], w: rect[2], h: rect[3] };
      if (!W3 || !W3.available) {
        log('world3d', box, { id: scene.id, unavailable: true, reason: W3?.reason ?? 'sin backend (navegador)' });
        ctx.save(); ctx.fillStyle = col('shade'); ctx.globalAlpha = 0.5; ctx.fillRect(rect[0], rect[1], rect[2], rect[3]); ctx.restore();
        api.text('3D NO DISPONIBLE', rect[0] + rect[2] / 2, rect[1] + rect[3] / 2, { role: 'label' }); return { available: false };
      }
      const st = shot.on | 0, twos = S.motion.stepFps ? Math.round(film.fps / S.motion.stepFps) : 0, step = o.step === 'auto' || o.step === undefined ? Math.max(st > 1 ? st : 0, twos > 1 ? twos : 0) : +o.step || 0;
      const fromShot = !!scene.camera?.fromShot, par = o.parallax ?? fromShot, tNow = o.t ?? cx.t;
      const groundFy = o.groundFy ?? (cx.groundY != null ? (cx.groundY - rect[1]) / rect[3] : undefined);
      let bgSample = o.bgSample ?? null;
      if (!bgSample && (o.bg === 'sample' || scene.background === 'sample')) {                       // degradado del fondo 2D ya pintado: 8 paradas de arriba abajo (columnas junto a los bordes de la capa)
        const n = 8, got = []; for (let i = 0; i < n; i++) { const yy = rect[1] + rect[3] * (i + 0.5) / n, p0 = [0.03, 0.97].map((fx) => ctx.getImageData(Math.max(0, Math.round(B.e + (rect[0] + rect[2] * fx) * sx - 1)), Math.max(0, Math.round(B.f + yy * sy - 1)), 3, 3).data);
          const acc = [0, 0, 0]; for (const d of p0) for (let q = 0; q < d.length; q += 4) { acc[0] += d[q]; acc[1] += d[q + 1]; acc[2] += d[q + 2]; } got.push(acc.map((v) => v / (p0.length * 9))); }
        bgSample = got;
      }
      const camFn = par ? (tt) => ({ ...(typeof o.cam === 'function' ? o.cam(tt) : o.cam), pan: [cx.cam.x ?? 0, cx.cam.y ?? 0], zoom: cx.cam.z ?? 1 }) : o.cam;
      const dev = { size: [pw, ph], style: S, t: tNow, u: o.u ?? cx.u, fps: film.fps, k: k * sx, cam: camFn, overrides: o.overrides, step, ssaa: o.ssaa, motionBlur: o.motionBlur, transparent: !!o.transparent,
        groundFy, unitH: rect[3], unitW: rect[2], scale: o.scale ?? shot.size, override: o.override, bgSample, focal: S.depth?.focal };
      const im = W3.render(scene, dev);
      const cvs = ((film._w3cv ??= new Map())), key = pw + 'x' + ph; let cv = cvs.get(key); if (!cv) { if (cvs.size > 3) cvs.clear(); cv = film.canvas(pw, ph); cvs.set(key, cv); }
      const c2 = cv.getContext('2d'), id = c2.createImageData(pw, ph); id.data.set(im.data); c2.putImageData(id, 0, 0);
      ctx.save(); if (par) ctx.setTransform(B.a, B.b, B.c, B.d, B.e, B.f);                         // el parallax lo hace la cámara 3D: la capa se pega SIN la cámara 2D
      ctx.globalAlpha *= o.alpha ?? 1; ctx.drawImage(cv, rect[0], rect[1], rect[2], rect[3]); ctx.restore();
      // bloom de los emisivos 3D con el MISMO kernel del post 2D (fx.bloom): ni un solo píxel de bloom propio del backend
      const bl = o.bloom ?? S.world3d?.bloom ?? false;
      if (bl) {
        const spec = { ...(S.grade?.post?.bloom ?? { threshold: 0.62, strength: 0.7, radius: 26 }), ...(typeof bl === 'object' ? bl : {}) }, mk = W3.render(scene, { ...dev, pass: 'emissive', motionBlur: null });
        const full = fxPool(film).get(ctx.canvas.width, ctx.canvas.height), fx2 = full.getContext('2d'), mc = film.canvas(pw, ph), mx = mc.getContext('2d'), md = mx.createImageData(pw, ph); md.data.set(mk.data); mx.putImageData(md, 0, 0);
        fx2.setTransform(par ? B.a : ctx.getTransform().a, par ? B.b : ctx.getTransform().b, par ? B.c : ctx.getTransform().c, par ? B.d : ctx.getTransform().d, par ? B.e : ctx.getTransform().e, par ? B.f : ctx.getTransform().f); fx2.drawImage(mc, rect[0], rect[1], rect[2], rect[3]);
        fxBloom(film, ctx, full, { ...spec, strength: (spec.strength ?? 0.7) * (o.alpha ?? 1), radius: (spec.radius ?? 24) * sx });
      }
      const info = im.info ?? null, warn = info ? angleCheck(info.angle) : null;
      log('world3d', box, { id: scene.id, backend: W3.sig(), cached: im.cached, step, ...(info ? { horizonY: +info.horizonY.toFixed(4), groundY: +info.groundY.toFixed(4), el: +info.el.toFixed(2), angle: info.angle } : {}), ...(warn ? { angulo: warn.msg, remedy: warn.remedy } : {}) });
      return { available: true, rect, cached: im.cached, ...(info ? { horizonY: info.horizonY, groundY: info.groundY, el: info.el, fov: info.fov } : {}) };
    },

    // 2.5D: perspectiva alrededor del foco de cámara. f = distancia focal en px (estilo: depth.focal).
    p3(x, y, z) { const f = (S.depth?.focal ?? 1.2) * W, fx = cx.cam.fx * W, fy = cx.cam.fy * H, kk = f / Math.max(f * 0.05, f + z); return [fx + (x - fx) * kk, fy + (y - fy) * kk, kk]; },
    atmos(z) { const D = S.depth ?? {}, dz = Math.abs(z - (D.focusZ ?? 0)); return { alpha: clamp(1 - (D.fog ?? 0) * Math.max(0, z) / W, 0.08, 1), blur: (D.dof ?? 0) * dz / 100 }; },
    card3d(o, draw) {
      const { x, y, w, h, rx = 0, ry = 0, z = 0 } = o, f = (S.depth?.focal ?? 1.2) * W;
      const corner = (px, py) => { const X = px * Math.cos(ry), Z = -px * Math.sin(ry) * Math.cos(rx) + py * Math.sin(rx), Y = py * Math.cos(rx), kk = f / (f + z + Z); return [x + X * kk, y + Y * kk]; };
      const dst = [corner(-w / 2, -h / 2), corner(w / 2, -h / 2), corner(w / 2, h / 2), corner(-w / 2, h / 2)];
      const m = ctx.getTransform(), toDev = (p) => [m.a * p[0] + m.c * p[1] + m.e, m.b * p[0] + m.d * p[1] + m.f];
      const src = [[x - w / 2, y - h / 2], [x + w / 2, y - h / 2], [x + w / 2, y + h / 2], [x - w / 2, y + h / 2]].map(toDev), D = dst.map(toDev);
      const Hw = WARPq(src, D), nb = api.boxes.length;
      P.layer({ warp: Hw, grid: 16 }, (lctx, tt, sub) => draw(lctx, sub));
      for (let i = nb; i < api.boxes.length; i++) {                        // las cajas viven en el espacio de los píxeles: transportarlas por la homografía
        const b = api.boxes[i], q = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].map(([u, v]) => Hw(u, v)), qx = q.map((p) => p[0]), qy = q.map((p) => p[1]);
        Object.assign(b, { x: Math.min(...qx), y: Math.min(...qy), w: Math.max(...qx) - Math.min(...qx), h: Math.max(...qy) - Math.min(...qy), sizePx: b.sizePx * Math.sqrt(((Math.max(...qx) - Math.min(...qx)) * (Math.max(...qy) - Math.min(...qy))) / Math.max(1, b.w * b.h)) });
      }
      const xs = dst.map((p) => p[0]), ys = dst.map((p) => p[1]); api.focus(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), o.label ?? 'tarjeta', { hollow: o.hollow ?? 0.8, weight: o.weight ?? 1 });
    },
  };
  P.tex = span('tex', P.tex);
  return P;
}
const WARPq = (src, dst) => WARPS.quad({ src, dst });
// LCS sobre códigos de carácter (programación dinámica O(n·m), memorizada). Devuelve pares anclados y huecos entre anclas.
export function texMorphPlan(film, A, B) {
  const M = memo(film, 'texmorph'), key = A.tex + '\u0000' + B.tex; if (M.has(key)) return M.get(key);
  const a = A.glyphs.map((g) => g.c), b = B.glyphs.map((g) => g.c), n = a.length, m = b.length, L = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] && a[i] !== 'rule' ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const pairs = [], gaps = []; let i = 0, j = 0, ga = [], gb = [];
  const flush = () => { if (ga.length || gb.length) gaps.push([ga, gb]); ga = []; gb = []; };
  while (i < n && j < m) { if (a[i] === b[j] && a[i] !== 'rule' && L[i][j] === L[i + 1][j + 1] + 1) { flush(); pairs.push([i, j]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) ga.push(i++); else gb.push(j++); }
  while (i < n) ga.push(i++); while (j < m) gb.push(j++); flush();
  const plan = { pairs, gaps }; M.set(key, plan); return plan;
}
function placeholderBox(ctx, api, x, y, w, h, id) { ctx.save(); ctx.fillStyle = api.color('shade'); ctx.fillRect(x, y, w, h); ctx.restore(); api.focus(x, y, w, h, id); }
function fit(iw, ih, x, y, w, h, mode) {
  if (mode === 'stretch') return [x, y, w, h, 0, 0, iw, ih];
  const s = mode === 'contain' ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih), dw = iw * s, dh = ih * s;
  return [x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, 0, 0, iw, ih];
}
