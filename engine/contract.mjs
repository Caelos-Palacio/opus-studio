// Contratos entre shots (F3 regla 2): al cerrar el gate del animatic se congela, por cada frontera A→B del timeline,
// su interfaz: t de corte, entities de handoff (con su estado en t_handoff si el shot ya existe) y cámara de salida.
//   out/contracts/<film>.json = {film, gate, status: frozen|reopened, hash, boundaries[]}   (lo escribe `orch freeze`)
// Un cambio que viole un contrato congelado da FIX en el lint (check "contracts") salvo que el gate esté reabierto
// (`orch reopen <gate> --why`, queda en el ledger). Si el archivo se edita a mano, su hash no casa → FIX.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, digest } from './ledger.mjs';
import { camEnds } from './camera.mjs';
import { filmKey } from './verdict.mjs';

export const contractFile = (film = filmKey()) => path.join(ROOT, 'out/contracts', film.replace(/\.edit$/, '') + '.json');
export const readContract = (film) => { try { return JSON.parse(fs.readFileSync(contractFile(film), 'utf8')); } catch { return null; } };
export const contractHash = (boundaries) => digest(JSON.stringify(boundaries));
const r3 = (v) => (typeof v === 'number' ? +v.toFixed(3) : v);
const round = (o) => Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => ['number', 'string', 'boolean'].includes(typeof v)).map(([k, v]) => [k, r3(v)]));
const camOut = (s, film) => { try { const b = camEnds(s, film).b; return { z: r3(b.z), x: r3(b.x), y: r3(b.y), r: r3(b.r) }; } catch { return null; } };
function entityAt(film, id, name, t) { const f = film.mods?.[id]?.entities?.[name]; if (typeof f !== 'function') return null; try { return round(f(t, film)); } catch { return null; } }

// Interfaz actual de cada frontera (film compilado; con film.mods si los shots ya existen).
export function boundariesOf(film) {
  const S = film.shots, out = [];
  for (let i = 0; i < S.length - 1; i++) {
    const A = S[i], B = S[i + 1];
    const handoffs = (film.handoffs ?? []).filter((h) => h.from === A.id && h.to === B.id).map((h) => ({ entity: h.entity, ...(h.entityTo ? { entityTo: h.entityTo } : {}), at: h.at, ...(h.kind ? { kind: h.kind } : {}), tol: h.tol ?? 2, state: entityAt(film, A.id, h.entity, h.at) }));
    out.push({ from: A.id, to: B.id, t: r3(A.t[1]), tIn: r3(B.t[0]), cam: camOut(A, film), handoffs });
  }
  return out;
}

const near = (a, b, tol) => Object.keys(a).every((k) => (typeof a[k] === 'number' ? typeof b?.[k] === 'number' && Math.abs(a[k] - b[k]) <= tol : a[k] === b?.[k]));
// Violaciones del contrato congelado → [{level, shot, t, problem, remedy}] (forma del lint).
export function contractIssues(film, C = readContract()) {
  if (!C || C.status !== 'frozen') return [];
  const out = [], F = (shot, t, problem, remedy = `respetar el contrato o reabrir el gate: node engine/orch.mjs reopen ${C.gate} --why "…"`) => out.push({ level: 'FIX', shot, t: r3(t ?? 0), problem, remedy });
  if (contractHash(C.boundaries) !== C.hash) { F('-', 0, `contrato ${path.relative(ROOT, contractFile(C.film))} alterado (hash no casa)`, 'no editar contratos a mano: reabrir y volver a cerrar el gate'); return out; }
  const cur = boundariesOf(film), byPair = new Map(cur.map((b) => [b.from + '>' + b.to, b]));
  for (const b of C.boundaries) {
    const now = byPair.get(b.from + '>' + b.to);
    if (!now) { F(b.from, b.t, `frontera ${b.from}→${b.to} del contrato ya no existe`); continue; }
    if (Math.abs(now.t - b.t) > 1e-6 || Math.abs(now.tIn - b.tIn) > 1e-6) F(b.to, b.t, `corte ${b.from}→${b.to} movido: ${b.t}s → ${now.t}s (contrato)`);
    if (b.cam && now.cam) {
      const dz = Math.abs(now.cam.z - b.cam.z) / b.cam.z, dx = Math.abs(now.cam.x - b.cam.x) / film.width, dy = Math.abs(now.cam.y - b.cam.y) / film.height, dr = Math.abs(now.cam.r - b.cam.r);
      if (dz > 0.01 || dx > 0.01 || dy > 0.01 || dr > 0.3) F(b.from, b.t, `cámara de salida de ${b.from} cambió (contrato ${b.from}→${b.to})`);
    }
    for (const h of b.handoffs) {
      const hn = now.handoffs.find((x) => x.entity === h.entity && Math.abs(x.at - h.at) < 1e-6);
      if (!hn) { F(b.to, h.at, `handoff "${h.entity}" ${b.from}→${b.to} @${h.at}s quitado del timeline (contrato)`); continue; }
      if (!h.state) continue;                                                       // congelado antes de que existiera el shot
      const a = entityAt(film, b.from, h.entity, h.at), z = entityAt(film, b.to, h.entityTo ?? h.entity, h.at);
      if (!a || !near(h.state, a, h.tol)) F(b.from, h.at, `entidad "${h.entity}" de ${b.from} en t=${h.at} ≠ contrato`, `devolver ${h.entity}(${h.at}) a ${JSON.stringify(h.state).slice(0, 80)} o reabrir el gate`);
      if (z && !near(h.state, z, h.tol)) F(b.to, h.at, `entidad "${h.entityTo ?? h.entity}" de ${b.to} en t=${h.at} ≠ contrato`, `arrancar ${b.to} del estado congelado o reabrir el gate`);
    }
  }
  return out;
}
