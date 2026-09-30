// Semántica de la matemática: TeX → símbolos con significado (no glifos). q̇ ≠ q; ∂ es un operador; \frac no es nada.
const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ', nu: 'ν', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω', hbar: 'ℏ', ell: 'ℓ' };
const OPS = { partial: '∂', nabla: '∇', int: '∫', oint: '∮', sum: 'Σ', prod: 'Π', infty: '∞', cdot: '·', times: '×' };
const STRUCT = new Set(['frac', 'dfrac', 'tfrac', 'mathbf', 'mathrm', 'mathit', 'mathcal', 'boldsymbol', 'left', 'right', 'quad', 'qquad', 'text', 'operatorname', 'displaystyle', 'begin', 'end', 'sqrt', 'vec', 'hat', 'bar', 'tilde']);
const ACC = { dot: '\u0307', ddot: '\u0308', vec: '\u20D7', hat: '\u0302', bar: '\u0304', tilde: '\u0303' };
export function texSymbols(tex) {
  const out = [], s = String(tex).replace(/\\text\{[^}]*\}/g, ' '), re = /\\([a-zA-Z]+)|([A-Za-z])|(\d+)|([=+\-<>])/g; let m, acc = null;
  while ((m = re.exec(s))) {
    let sym = null;
    if (m[1]) { const c = m[1]; if (ACC[c] && c !== 'vec' && c !== 'hat' && c !== 'bar' && c !== 'tilde' || c === 'dot' || c === 'ddot') { acc = ACC[c]; continue; } if (ACC[c]) { acc = ACC[c]; continue; } if (STRUCT.has(c)) continue; sym = GREEK[c] ?? OPS[c] ?? '\\' + c; }
    else if (m[2]) sym = m[2]; else if (m[3]) sym = m[3]; else if (m[4]) { out.push({ sym: m[4], kind: 'rel' }); continue; }
    if (acc) { sym += acc; acc = null; }
    out.push({ sym, kind: OPS[m[1]] ? 'op' : /^\d+$/.test(sym) ? 'num' : 'var' });
  }
  return out;
}
export const symbolSet = (tex) => [...new Set(texSymbols(tex).filter((x) => x.kind === 'var' || x.kind === 'op').map((x) => x.sym))];
