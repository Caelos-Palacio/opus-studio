// T2: salida para agentes. `import './summary.mjs'` como PRIMER import de una CLI: con --summary, OPUS_SUMMARY=1 u OPUS_AGENT=1
// (OPUS_AGENT=<nombre> sigue siendo solo el nombre en el ledger) la salida completa va a out/logs/<cli>-<ts>.log y a la
// consola solo: film + veredicto + conteos + top-5 problemas + ruta al log. Con failOnly (npm test): solo las líneas ✗ y el total.
// El código de salida no cambia. Los hijos heredan OPUS_SUMMARY=0 (su salida llega entera al padre, que es quien resume).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './ledger.mjs';

const CLIS = new Set(['lint', 'arc', 'sound', 'metrics', 'memoria', 'run']);
const si = process.argv.indexOf('--summary');
const on = si >= 0 || process.env.OPUS_SUMMARY === '1' || (process.env.OPUS_AGENT === '1' && process.env.OPUS_SUMMARY !== '0');
const name = path.basename(process.argv[1] ?? '', '.mjs');
const cut = (s, n = 200) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function condense(text, { failOnly = false, log = null, top = 5 } = {}) {
  const L = text.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim() && !/^⚠ ledger/.test(l));
  const film = L.find((l) => /^film:/.test(l)), c = { FIX: 0, WARN: 0, '✗': 0, '✓': 0 };
  for (const l of L) { const m = /^\s*(FIX|WARN|✗|✓)/.exec(l); if (m) c[m[1]]++; else if (/✗/.test(l)) c['✗']++; }
  const bad = L.filter((l) => /^\s*(FIX|✗)/.test(l) || /✗/.test(l)), warn = L.filter((l) => /^\s*WARN/.test(l));
  const last = [...L].reverse().find((l) => /^\s*(SHIP|FIX|PASS|OK|NO|Todo verde|\d+ fallos|[✓✗] \S+\s+\d+\/\d+)/.test(l)) ?? L[L.length - 1] ?? '';
  const out = failOnly ? [...bad.map((l) => cut(l)), cut(last)] : [...(film ? [film] : []), cut(last.trim()), `conteos: FIX ${c.FIX} · WARN ${c.WARN} · ✗ ${c['✗']} · ${L.length} líneas`, ...(bad.length || warn.length ? ['top-5:'] : []), ...[...bad, ...warn].slice(0, top).map((l) => '  ' + cut(l.trim()))];
  if (log) out.push(`log: ${log}`);
  return out.join('\n');
}

export function install({ failOnly = false } = {}) {
  if (!on || !CLIS.has(name)) return false;
  if (si >= 0) process.argv.splice(si, 1);
  process.env.OPUS_SUMMARY = '0';                                              // hijos: salida entera
  const w1 = process.stdout.write.bind(process.stdout), w2 = process.stderr.write.bind(process.stderr); let buf = '';
  const grab = (chunk, enc, cb) => { buf += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk); if (typeof enc === 'function') enc(); else if (cb) cb(); return true; };
  process.stdout.write = grab; process.stderr.write = grab;
  process.on('exit', () => {
    process.stdout.write = w1; process.stderr.write = w2;
    const lf = path.join(ROOT, 'out/logs', `${name}-${Date.now().toString(36)}-${process.pid}.log`);
    fs.mkdirSync(path.dirname(lf), { recursive: true }); fs.writeFileSync(lf, buf);
    fs.writeSync(1, condense(buf, { failOnly, log: path.relative(ROOT, lf) }) + '\n');
  });
  return true;
}
if (CLIS.has(name)) install({ failOnly: name === 'run' });
