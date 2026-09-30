// Scene graph DECLARATIVO y puro: el shot devuelve un árbol como función de t; el motor lo resuelve y dibuja.
//   nodo = { id, x, y, z, rot, s, sx, sy, ax, ay, opacity, visible,
//            time:{offset, speed, from, to, loop}, fps,                 ← tiempo local + fps propio (partes a distinto fps)
//            props:(tl)=>({...}), children:[...] | (tl)=>[...],
//            draw:(ctx, tl, api, node)=>void, clip:(ctx)=>void, fx:{...spec de api.layer},
//            focus:true|{w,h,weight,label,hollow}, w, h,
//            follow:{id, lag, k}, lookAt:id, attach:{id, dx, dy}, zsort:true }
// Constraints sin estado: "follow con retraso" = posición del objetivo evaluada en t−lag (no se integra nada).
// Problemas que evita: updaters con estado (Manim), seek O(t) por generadores (Motion Canvas), transforms repetidos a mano.
import { clamp } from './core.mjs';

const I = [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const local = (n) => { const c = Math.cos(n.rot ?? 0), s = Math.sin(n.rot ?? 0), sx = (n.sx ?? n.s ?? 1), sy = (n.sy ?? n.s ?? 1), ax = n.ax ?? 0, ay = n.ay ?? 0;
  return mul([c * sx, s * sx, -s * sy, c * sy, n.x ?? 0, n.y ?? 0], [1, 0, 0, 1, -ax, -ay]); };
export const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

function timeOf(n, tp) {
  const T = n.time; let t = tp;
  if (T) { t = (tp - (T.offset ?? 0)) * (T.speed ?? 1); if (T.loop) t = ((t % T.loop) + T.loop) % T.loop; if (T.from != null || T.to != null) t = clamp(t, T.from ?? -Infinity, T.to ?? Infinity); }
  if (n.fps) t = Math.floor(t * n.fps + 1e-9) / n.fps;
  return t;
}
// Resuelve el árbol a una lista plana con matrices de mundo (sin cámara). Puro.
export function resolve(spec, t) {
  const out = [], byId = new Map();
  const rec = (s, tp, M, op, z, parent, depth) => {
    if (!s) return;
    const tl = timeOf(s, tp), n = { ...s, ...(typeof s.props === 'function' ? s.props(tl) : s.props ?? {}) };
    if (n.visible === false) return;
    const W = mul(M, local(n)), node = { n, tl, M: W, op: op * (n.opacity ?? 1), z: z + (n.z ?? 0), parent, depth, kids: [] };
    out.push(node); if (n.id) byId.set(n.id, node); if (parent) parent.kids.push(node);
    const ch = typeof n.children === 'function' ? n.children(tl) : n.children ?? [];
    for (const c of ch) rec(c, tl, W, node.op, node.z, node, depth + 1);
  };
  rec(spec, t, I, 1, 0, null, 0);
  return { list: out, byId };
}
// Constraints evaluadas contra el árbol en otros tiempos (memorizado por t dentro del proceso).
// `build` es la FUNCIÓN escena(t): una constraint temporal necesita el mundo en otro instante, no el árbol ya instanciado.
function constrain(R, build, t, memo) {
  const at = (tt) => { const k = tt.toFixed(6); if (!memo.has(k)) memo.set(k, resolve(build(tt), tt)); return memo.get(k); };
  for (const node of R.list) {
    const n = node.n;
    if (n.follow) { const src = at(t - (n.follow.lag ?? 0.2)).byId.get(n.follow.id); if (src) { const k = n.follow.k ?? 1, p = apply(src.M, 0, 0); node.M = [...node.M]; node.M[4] += (p[0] - node.M[4]) * k; node.M[5] += (p[1] - node.M[5]) * k; } }
    if (n.attach) { const src = R.byId.get(n.attach.id); if (src) { const p = apply(src.M, n.attach.dx ?? 0, n.attach.dy ?? 0); node.M = [...node.M]; node.M[4] = p[0]; node.M[5] = p[1]; } }
    if (n.lookAt) { const tg = R.byId.get(n.lookAt); if (tg) { const a = Math.atan2(tg.M[5] - node.M[5], tg.M[4] - node.M[4]), sx = Math.hypot(node.M[0], node.M[1]), sy = Math.hypot(node.M[2], node.M[3]); node.M = [Math.cos(a) * sx, Math.sin(a) * sx, -Math.sin(a) * sy, Math.cos(a) * sy, node.M[4], node.M[5]]; } }
  }
  // los hijos de un nodo re-colocado heredan el desplazamiento
  for (const node of R.list) if (node.parent && (node.parent.n.follow || node.parent.n.attach || node.parent.n.lookAt) && !(node.n.follow || node.n.attach)) {
    const P0 = resolveParentBase(node), P1 = node.parent.M; node.M = mul(P1, mul(inv(P0), node.M));
  }
  return R;
}
const resolveParentBase = (node) => { let M = I; const chain = []; for (let p = node.parent; p; p = p.parent) chain.unshift(p); for (const p of chain) M = mul(M, local(p.n)); return M; };
const inv = (m) => { const d = m[0] * m[3] - m[1] * m[2] || 1e-12; return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d]; };

export function evalScene(specOrBuild, t, film) {
  const build = typeof specOrBuild === 'function' ? specOrBuild : () => specOrBuild;
  film._sceneMemo ??= new WeakMap(); let memo = film._sceneMemo.get(build.key ?? build);   // memo por constructor (clave estable por shot)
  if (!memo || memo.size > 256) { memo = new Map(); film._sceneMemo.set(build.key ?? build, memo); }
  return constrain(resolve(build(t), t), build, t, memo);
}
// Posición de mundo de un nodo (para cámara que sigue nodos). Promedio en caja temporal = inercia sin estado.
export function nodeWorld(build, id, t, film, smooth = 0) {
  const N = smooth > 0 ? 7 : 1; let x = 0, y = 0, c = 0;
  for (let i = 0; i < N; i++) { const tt = t - (smooth * i) / Math.max(1, N - 1), nd = evalScene(build, tt, film).byId.get(id); if (nd) { x += nd.M[4]; y += nd.M[5]; c++; } }
  return c ? [x / c, y / c] : null;
}

// Dibujo recursivo (los clips afectan a los descendientes). 2.5D: perspectiva por z, niebla y DOF del estilo.
export function drawScene(ctx, spec, t, film, api) {
  const R = evalScene(spec, t, film), root = ctx.getTransform(), rootM = [root.a, root.b, root.c, root.d, root.e, root.f];
  const D = film.S.depth ?? {}, f = (D.focal ?? 1.2) * film.width, fx = api.cam.fx * film.width, fy = api.cam.fy * film.height;
  const persp = (M, z) => { if (!z) return M; const k = f / Math.max(f * 0.05, f + z); return mul([k, 0, 0, k, fx * (1 - k), fy * (1 - k)], M); };
  // Un nodo con fx o desenfoque de profundidad se compone con TODO su subárbol en UNA capa (agrupa estrellas, no 1 capa por estrella).
  const visit = (node, c, a, flat) => {
    const n = node.n, M = persp(node.M, node.z), at = a.atmos(node.z), op = node.op * (node.z ? at.alpha : 1);
    const blur = !flat && node.z && at.blur > 0.75 ? at.blur : 0;
    const body = (cc, aa, fl) => {
      cc.save(); cc.setTransform(...mul(rootM, M)); cc.globalAlpha = op;
      if (n.clip) { cc.beginPath(); n.clip(cc); cc.clip(); }
      if (n.draw) n.draw(cc, node.tl, aa, n);
      if (n.focus) { const F = n.focus === true ? {} : n.focus; aa.focus(F.x ?? -(n.w ?? 0) / 2, F.y ?? -(n.h ?? 0) / 2, F.w ?? n.w ?? 0, F.h ?? n.h ?? 0, F.label ?? n.id ?? 'nodo', { weight: F.weight ?? 1, hollow: F.hollow ?? 0 }); }
      if (n.id) { const [sx, sy] = apply(mul(rootM, M), 0, 0); aa.meta.push({ prim: 'node', shot: aa.shotId, id: n.id, x: sx, y: sy, z: node.z }); }
      for (const k of n.zsort ? [...node.kids].sort((p, q) => q.z - p.z) : node.kids) visit(k, cc, aa, fl);
      cc.restore();
    };
    if (!flat && (n.fx || blur)) a.layer({ ...(n.fx ?? {}), blur: (n.fx?.blur ?? 0) + blur }, (lctx, tt, sub) => body(lctx, sub, true));
    else body(c, a, flat);
  };
  if (R.list.length) visit(R.list[0], ctx, api, false);
  return R;
}
