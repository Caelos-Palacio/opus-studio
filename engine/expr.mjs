// DSL de expresiones de parámetros (F4): `72 + 8*sig('pulse')`. Parser propio (descenso recursivo), SIN eval/Function:
// el texto nunca se ejecuta como JS; se compila a un árbol de cierres sobre un entorno cerrado.
//   Literales: números, 'texto' / "texto", true/false.   Variables: t (tiempo del film), lt (tiempo local del shot),
//   u (progreso 0..1 del shot), dur (duración del shot), pi, tau, e.   Operadores: ?: || && == != < <= > >= + - * / % ^ !
//   Funciones (lista cerrada): ver FUNCS. sig('nombre'[, t]) lee una señal; su nombre DEBE ser literal: las dependencias
//   se extraen al parsear (deps) y así el hash del fragmento solo incluye las señales que el parámetro usa.
// Puro y compartido navegador/Node (sin imports de builtins).
import { clamp, lerp, smooth, ease as EASE } from './core.mjs';

export class ExprError extends Error {
  constructor(msg, { path = '', src = '', col = -1 } = {}) {
    super(`${path ? path + ': ' : ''}${msg}${col >= 0 ? ` (col ${col + 1})\n  ${src}\n  ${' '.repeat(col)}^` : ''}`);
    this.name = 'ExprError'; this.path = path; this.col = col; this.reason = msg;
  }
}

// Funciones permitidas (puras, numéricas). Nada de acceso a propiedades ni a objetos del host.
export const FUNCS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
  abs: Math.abs, sign: Math.sign, floor: Math.floor, ceil: Math.ceil, round: Math.round, sqrt: Math.sqrt, exp: Math.exp, log: Math.log,
  pow: Math.pow, min: Math.min, max: Math.max, hypot: Math.hypot,
  clamp: (x, a = 0, b = 1) => clamp(x, a, b), lerp, mix: lerp, smooth: (u) => smooth(clamp(u)),
  step: (edge, x) => (x >= edge ? 1 : 0), fract: (x) => x - Math.floor(x),
  ease: (name, u) => { const f = EASE[name]; if (!f) throw new ExprError(`curva desconocida '${name}' (válidas: ${Object.keys(EASE).join(' ')})`); return f(clamp(u)); },
};
const CONSTS = { pi: Math.PI, tau: Math.PI * 2, e: Math.E, true: true, false: false };
export const VARS = ['t', 'lt', 'u', 'dur'];
const MAX_LEN = 1000, MAX_DEPTH = 48;

// ── léxico ───────────────────────────────────────────────────────────────────────────────────────────────────────
function lex(src, path) {
  const toks = []; let i = 0;
  const err = (m, c = i) => { throw new ExprError(m, { path, src, col: c }); };
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i)); if (!m) err('número mal formado');
      toks.push({ k: 'num', v: Number(m[0]), c: i }); i += m[0].length; continue;
    }
    if (/[A-Za-z_]/.test(c)) { const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i)); toks.push({ k: 'id', v: m[0], c: i }); i += m[0].length; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1, s = ''; while (j < src.length && src[j] !== c) { if (src[j] === '\\') err('sin secuencias de escape en textos', j); s += src[j++]; }
      if (j >= src.length) err('texto sin cerrar'); toks.push({ k: 'str', v: s, c: i }); i = j + 1; continue;
    }
    const two = src.slice(i, i + 2);
    if (['<=', '>=', '==', '!=', '&&', '||'].includes(two)) { toks.push({ k: 'op', v: two, c: i }); i += 2; continue; }
    if ('+-*/%^()<>!?:,'.includes(c)) { toks.push({ k: 'op', v: c, c: i }); i++; continue; }
    err(`carácter no permitido '${c}'${c === '.' || c === '[' ? ' (sin acceso a propiedades)' : ''}`);
  }
  toks.push({ k: 'end', v: '', c: src.length });
  return toks;
}

// ── sintaxis → AST ───────────────────────────────────────────────────────────────────────────────────────────────
// Devuelve { ast, deps:Set<señal>, vars:Set, src }. Lanza ExprError con ruta y columna.
export function parse(src, { path = '', vars: xv = [], funcs: xf = [] } = {}) {   // xv/xf: variables y funciones EXTRA (DSL de escenas, spec 006); las de siempre no cambian
  src = String(src);
  if (src.length > MAX_LEN) throw new ExprError(`expresión demasiado larga (${src.length} > ${MAX_LEN})`, { path });
  const T = lex(src, path), deps = new Set(), vars = new Set(); let p = 0, depth = 0;
  const peek = () => T[p], next = () => T[p++];
  const err = (m, tok = peek()) => { throw new ExprError(m, { path, src, col: tok.c }); };
  const isOp = (v) => peek().k === 'op' && peek().v === v;
  const expect = (v) => { if (!isOp(v)) err(`se esperaba '${v}'`); return next(); };
  const nest = (f) => { if (++depth > MAX_DEPTH) err('expresión demasiado anidada'); try { return f(); } finally { depth--; } };
  const bin = (sub, ops) => () => { let a = sub(); while (peek().k === 'op' && ops.includes(peek().v)) { const o = next().v; a = { k: 'bin', o, a, b: sub() }; } return a; };
  const cond = () => nest(() => { const c = or(); if (!isOp('?')) return c; next(); const a = cond(); expect(':'); return { k: 'if', c, a, b: cond() }; });
  const unary = () => nest(() => { if (isOp('-') || isOp('+') || isOp('!')) { const o = next().v; return { k: 'un', o, a: unary() }; } return power(); });
  const power = () => { const a = primary(); if (isOp('^')) { next(); return { k: 'bin', o: '^', a, b: unary() }; } return a; };   // asociativa a la derecha
  const mul = bin(unary, ['*', '/', '%']), add = bin(mul, ['+', '-']), cmp = bin(add, ['<', '<=', '>', '>=', '==', '!=']), and = bin(cmp, ['&&']), or = bin(and, ['||']);
  function primary() {
    const tk = next();
    if (tk.k === 'num') return { k: 'lit', v: tk.v };
    if (tk.k === 'str') return { k: 'lit', v: tk.v };
    if (tk.k === 'op' && tk.v === '(') { const e = cond(); expect(')'); return e; }
    if (tk.k === 'id') {
      if (isOp('(')) {
        next(); const args = [];
        if (!isOp(')')) { do { args.push(cond()); } while (isOp(',') && next()); }
        expect(')');
        if (tk.v === 'sig') {
          if (!args.length || args[0].k !== 'lit' || typeof args[0].v !== 'string') err("sig() exige el nombre de la señal como texto literal: sig('pulse')", tk);
          if (args.length > 2) err('sig(nombre[, t]) admite como mucho 2 argumentos', tk);
          deps.add(args[0].v); return { k: 'sig', name: args[0].v, at: args[1] ?? null };
        }
        if (!Object.hasOwn(FUNCS, tk.v) && !xf.includes(tk.v)) err(`función desconocida '${tk.v}' (permitidas: sig ${Object.keys(FUNCS).join(' ')})`, tk);
        return { k: 'call', f: tk.v, args };
      }
      if (Object.hasOwn(CONSTS, tk.v)) return { k: 'lit', v: CONSTS[tk.v] };
      if (VARS.includes(tk.v) || xv.includes(tk.v)) { vars.add(tk.v); return { k: 'var', v: tk.v }; }
      err(`identificador desconocido '${tk.v}' (variables: ${VARS.join(' ')}; constantes: pi tau e)`, tk);
    }
    err(tk.k === 'end' ? 'expresión incompleta' : `token inesperado '${tk.v}'`, tk);
  }
  const ast = cond();
  if (peek().k !== 'end') err(`token inesperado '${peek().v}'`);
  return { ast, deps, vars, src };
}

// ── evaluación: AST → cierre (env) => valor. env = { t, lt, u, dur, sig(name, t) } ─────────────────────────────────
const BIN = {
  '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b, '%': (a, b) => a % b, '^': (a, b) => a ** b,
  '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b, '==': (a, b) => a === b, '!=': (a, b) => a !== b,
};
function build(n) {
  switch (n.k) {
    case 'lit': { const v = n.v; return () => v; }
    case 'var': { const k = n.v; return (env) => env[k]; }
    case 'un': { const a = build(n.a); return n.o === '-' ? (e) => -a(e) : n.o === '!' ? (e) => !a(e) : (e) => +a(e); }
    case 'bin': {
      const a = build(n.a), b = build(n.b);
      if (n.o === '&&') return (e) => a(e) && b(e);
      if (n.o === '||') return (e) => a(e) || b(e);
      const f = BIN[n.o]; return (e) => f(a(e), b(e));
    }
    case 'if': { const c = build(n.c), a = build(n.a), b = build(n.b); return (e) => (c(e) ? a(e) : b(e)); }
    case 'call': { const f = FUNCS[n.f], as = n.args.map(build), nm = n.f; return (e) => (f ?? e.fns?.[nm])(...as.map((g) => g(e))); }
    case 'sig': { const name = n.name, at = n.at ? build(n.at) : null; return (e) => e.sig(name, at ? at(e) : e.t); }
  }
  throw new ExprError(`nodo desconocido ${n.k}`);
}
// compile(src) → { fn(env), deps:[...], src }.  Memo por texto (las expresiones se repiten entre shots y procesos de lint).
const MEMO = new Map();
export function compile(src, { path = '', vars: xv = [], funcs: xf = [] } = {}) {
  const key = xv.length || xf.length ? `${xv.join(',')}|${xf.join(',')}|${src}` : String(src);
  let c = MEMO.get(key);
  if (!c) {
    try { const P = parse(String(src), { vars: xv, funcs: xf }); c = { fn: build(P.ast), deps: [...P.deps].sort(), vars: [...P.vars].sort(), src: String(src) }; }
    catch (e) { if (e instanceof ExprError) throw new ExprError(e.reason, { path, src: String(src), col: e.col }); throw e; }
    if (MEMO.size > 4096) MEMO.clear(); MEMO.set(key, c);
  }
  return c;
}
export const evaluate = (src, env = {}) => compile(src).fn({ t: 0, lt: 0, u: 0, dur: 0, sig: () => 0, ...env });
