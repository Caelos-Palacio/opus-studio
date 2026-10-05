// Instrumentación ligera (R0). Desactivada por defecto: `perf.on === false` → cada gancho es una comparación y nada más.
// `npm run profile` la activa. Tiempo EXCLUSIVO por categoría (pila: el tiempo de un hijo no se cuenta en el padre) y por shot.
export const perf = { on: false, acc: {}, shots: {}, stack: [], mark: 0, shot: null };
const hr = process.hrtime.bigint.bind(process.hrtime);                       // capturado al cargar: el sandbox de shots bloquea process.hrtime después
const now = () => Number(hr()) / 1e6;
const add = (cat, d) => { perf.acc[cat] = (perf.acc[cat] ?? 0) + d; if (perf.shot) { const S = (perf.shots[perf.shot] ??= {}); S[cat] = (S[cat] ?? 0) + d; } };
export function enter(cat) { const t = now(); if (perf.stack.length) add(perf.stack[perf.stack.length - 1], t - perf.mark); perf.stack.push(cat); perf.mark = t; }
export function leave() { const t = now(); add(perf.stack.pop(), t - perf.mark); perf.mark = t; }
export function reset() { perf.acc = {}; perf.shots = {}; perf.stack = []; perf.shot = null; }
// Envuelve una función: cuando perf.on, mide su tiempo exclusivo bajo `cat`.
export const span = (cat, fn) => function (...a) { if (!perf.on) return fn.apply(this, a); enter(cat); try { return fn.apply(this, a); } finally { leave(); } };
// Ejecuta f() bajo `cat` (para trozos en línea).
export const run = (cat, f, ...a) => { if (!perf.on) return f(...a); enter(cat); try { return f(...a); } finally { leave(); } };
