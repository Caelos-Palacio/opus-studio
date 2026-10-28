#!/usr/bin/env node
// Preview en vivo (spec 019, E4): ver el film en baja resolución mientras lo editas, sin render ni gates.
//   node engine/opus.mjs preview [film] [--port 4780] [--escala 0.25|0.5] [--no-abrir]
//   → servidor HTTP SOLO en 127.0.0.1 (no hay opción de otra interfaz) con una página: fotograma en baja resolución (boceto) + scrubber de t, ▶ a 12 fps, ←/→ un fotograma.
//   Recarga al guardar shots/*.scene.json, el timeline o audio.json del film (fs.watch + debounce): recompila el DSL (esquema estricto: el error sale en la página
//   y se conserva el último render bueno), lanza un worker fresco y la caché de fotogramas se invalida POR HASH (solo cambian los fotogramas de los shots tocados).
//   Superficie mínima: GET /, /info, /frame?t=, /events (SSE) y /f/<archivo> (solo lectura, .json/.md/.txt DENTRO de la carpeta del film y de shots/). Sin POST, sin eval,
//   sin ejecutar nada que llegue por la red; se rechazan Host ajenos a loopback (DNS rebinding), rutas con .., NUL, \ o fuera del film (también por symlink).
import './help.mjs';
import { isMain } from './paths.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findFilm, announceFilm, filmId, filmFolder, resolveFilm } from './filmid.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
export const HOST = '127.0.0.1', ESCALAS = [0.25, 0.5], EXT_OK = new Set(['.json', '.md', '.txt']);
const digest = (f) => { try { return crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex'); } catch { return null; } };

// Ruta confinada para /f/…: relativa, sin .., NUL ni \, extensión permitida, sin ficheros ocultos, y su realpath dentro de alguna de las bases.
export function confinada(rel, bases) {
  let r; try { r = decodeURIComponent(rel); } catch { return null; }
  if (!r || r.includes('\0') || r.includes('\\') || path.isAbsolute(r) || r.split('/').some((p) => p === '..' || p === '.' || p === '' || p.startsWith('.'))) return null;
  if (!EXT_OK.has(path.extname(r).toLowerCase())) return null;
  for (const b of bases) {
    const base = path.resolve(b), p = path.resolve(base, r);
    if (p !== base && !p.startsWith(base + path.sep)) continue;
    try { const rp = fs.realpathSync(p); if (rp.startsWith(fs.realpathSync(base) + path.sep) && fs.statSync(rp).isFile()) return rp; } catch {}
  }
  return null;
}
const hostOk = (h) => /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(h ?? '');

export async function startPreview({ film: filmName, root = ROOT, port = 4780, escala = 0.25, log = () => {} } = {}) {
  const tl = filmName ? findFilm(filmName) : null;
  if (filmName && !tl) throw new Error(`no encuentro el film «${filmName}»`);
  const timeline = tl ?? resolveFilm().timeline;                       // sin nombre: --timeline > OPUS_TIMELINE > out/.film > demo
  const id = filmId(timeline), fdir = filmFolder(timeline), filmBase = fdir ? path.join(root, fdir) : null;
  const pageHtml = fs.readFileSync(path.join(HERE, 'preview-live.html'), 'utf8');
  const S = { version: 0, error: null, info: null, worker: null, pend: new Map(), seq: 0, closed: false, sse: new Set(), digests: new Map(), timers: new Map() };

  // ── worker ──
  const lanzar = () => new Promise((resolve) => {
    const w = fork(path.join(HERE, 'preview-worker.mjs'), ['--timeline', timeline], { cwd: root, execArgv: [], serialization: 'advanced', env: { ...process.env, OPUS_BOCETO: '1', OPUS_FXFAST: '1' }, stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
    let listo = false;
    w.on('message', (m) => {
      if (m.type === 'ready') { listo = true; resolve({ w, info: m.info }); }
      else if (m.type === 'error') { resolve({ w: null, error: m.message }); }
      else if (m.id != null) { const p = S.pend.get(m.id); if (p) { S.pend.delete(m.id); p(m); } }
    });
    w.on('exit', () => { if (!listo) resolve({ w: null, error: 'el worker terminó antes de cargar el film' }); if (S.worker === w) S.worker = null; for (const [k, p] of S.pend) if (p.w === w) { S.pend.delete(k); p({ error: 'worker reiniciado' }); } });
  });
  const pedir = (t, s) => new Promise((resolve) => {
    const w = S.worker; if (!w) return resolve({ error: S.error ?? 'sin worker' });
    const n = ++S.seq, p = resolve; p.w = w; S.pend.set(n, p); w.send({ id: n, t, s });
  });
  const difundir = (obj) => { const d = `data: ${JSON.stringify(obj)}\n\n`; for (const r of S.sse) r.write(d); };
  const cargar = async () => {
    const r = await lanzar();
    if (!r.w) { S.error = r.error; difundir({ type: 'error', error: S.error, version: S.version }); return false; }
    const vieja = S.worker; S.worker = r.w; S.info = r.info; S.error = null; S.version++;
    if (vieja) { vieja.kill('SIGKILL'); }
    difundir({ type: 'reload', version: S.version, error: null }); log(`recargado (v${S.version})`);
    return true;
  };

  // ── recompilación DSL + vigilancia ──
  const { build } = await import('./dsl.mjs');
  const ids = () => { try { return JSON.parse(fs.readFileSync(path.join(root, timeline), 'utf8')).shots.map((s) => s.id); } catch { return null; } };
  const vigiladas = (nombre, dir) => {
    if (dir === 'shots') return /\.(scene\.json|mjs)$/.test(nombre);
    return nombre === path.basename(timeline) || nombre === 'audio.json';
  };
  let ocupado = false, otra = false;
  const alCambiar = async () => {
    if (ocupado) { otra = true; return; } ocupado = true;
    try {
      do {
        otra = false;
        const usados = ids(); let err = null;
        for (const f of fs.readdirSync(path.join(root, 'shots'))) {
          if (!f.endsWith('.scene.json') || (usados && !usados.includes(f.replace(/\.scene\.json$/, '')))) continue;
          try { build(`shots/${f}`, { root }); } catch (e) { err = `${f}: ${String(e.message).slice(0, 600)}`; break; }
        }
        if (err) { S.error = err; difundir({ type: 'error', error: err, version: S.version }); log('✗ ' + err.split('\n')[0]); }
        else await cargar();
      } while (otra);
    } finally { ocupado = false; }
  };
  const vigilantes = [];
  const vigilar = (dir, etiqueta) => {
    for (const f of fs.readdirSync(dir)) if (vigiladas(f, etiqueta)) S.digests.set(path.join(dir, f), digest(path.join(dir, f)));
    const w = fs.watch(dir, { persistent: true }, (_ev, nombre) => {
      if (!nombre || !vigiladas(nombre, etiqueta)) return;
      const abs = path.join(dir, nombre); clearTimeout(S.timers.get(abs));
      S.timers.set(abs, setTimeout(() => { const d = digest(abs); if (d === S.digests.get(abs)) return; S.digests.set(abs, d); alCambiar(); }, 120));   // debounce + contenido: ignora el eco de lo que escribe el propio build
    });
    vigilantes.push(w);
  };
  // arranque: compila escenas y carga; DESPUÉS se vigila (lo que el build regenera no cuenta como edición)
  await alCambiar();
  vigilar(path.join(root, 'shots'), 'shots');
  vigilar(path.dirname(path.join(root, timeline)), 'film');

  // ── HTTP ──
  const bases = [filmBase, path.join(root, 'shots')].filter(Boolean);
  const server = http.createServer(async (req, res) => {
    const fin = (code, body, type = 'text/plain; charset=utf-8', extra = {}) => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra }); res.end(req.method === 'HEAD' ? undefined : body); };
    if (!hostOk(req.headers.host)) return fin(403, 'Host no permitido (solo loopback)');
    if (req.method !== 'GET' && req.method !== 'HEAD') return fin(405, 'solo GET', 'text/plain; charset=utf-8', { Allow: 'GET, HEAD' });
    let u; try { u = new URL(req.url, 'http://127.0.0.1'); } catch { return fin(400, 'URL inválida'); }
    const p = u.pathname;
    if (p === '/') return fin(200, pageHtml, 'text/html; charset=utf-8', { 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' blob:; connect-src 'self'" });
    if (p === '/info') return fin(200, JSON.stringify({ film: id, version: S.version, error: S.error, escala, ...(S.info ?? {}) }), 'application/json; charset=utf-8');
    if (p === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(`data: ${JSON.stringify({ type: 'hello', version: S.version, error: S.error })}\n\n`); S.sse.add(res);
      const ka = setInterval(() => res.write(': ka\n\n'), 20000); req.on('close', () => { clearInterval(ka); S.sse.delete(res); }); return;
    }
    if (p === '/frame') {
      const t = Number(u.searchParams.get('t') ?? 0), s = Number(u.searchParams.get('s') ?? escala);
      if (!Number.isFinite(t) || !ESCALAS.includes(s)) return fin(400, `t numérico y s ∈ ${ESCALAS.join('|')}`);
      if (!S.worker) return fin(503, S.error ?? 'cargando…');
      const m = await pedir(t, s);
      if (m.error) return fin(500, m.error);
      return fin(200, m.jpeg, 'image/jpeg', { 'X-Cache': m.hit ? 'hit' : 'miss', 'X-Version': String(S.version), 'X-Shots': m.shots.join('+') });
    }
    if (p.startsWith('/f/')) {
      const f = confinada(p.slice(3), bases);
      if (!f) return fin(404, 'no encontrado');
      return fin(200, fs.readFileSync(f), 'text/plain; charset=utf-8');
    }
    return fin(404, 'no encontrado');
  });
  const escuchar = (pt) => new Promise((resolve, reject) => { server.once('error', reject); server.listen(pt, HOST, () => { server.off('error', reject); resolve(); }); });
  try { await escuchar(port); } catch (e) { if (e.code === 'EADDRINUSE' && port !== 0) await escuchar(0); else throw e; }
  const close = async () => {
    S.closed = true; for (const w of vigilantes) w.close(); for (const t of S.timers.values()) clearTimeout(t);
    for (const r of S.sse) r.end(); S.worker?.kill('SIGKILL');
    server.closeAllConnections?.(); await new Promise((r) => server.close(r));
  };
  return { server, port: server.address().port, host: HOST, close, state: S, url: `http://${HOST}:${server.address().port}/` };
}

if (isMain(import.meta.url)) {
  const a = process.argv.slice(2), val = (k, d) => { const i = a.indexOf(k); return i >= 0 && a[i + 1] && !a[i + 1].startsWith('--') ? a[i + 1] : d; };
  const flagsConValor = new Set(['--port', '--escala', '--timeline']), pos = a.filter((x, i) => !x.startsWith('--') && !flagsConValor.has(a[i - 1]));
  if (pos[0]) { const tl = findFilm(pos[0]); if (!tl) { console.error(`no encuentro el film «${pos[0]}»`); process.exit(1); } process.argv.push('--timeline', tl); }
  announceFilm();
  const P = await startPreview({ film: null, port: +val('--port', 4780), escala: +val('--escala', 0.25), log: (m) => console.log('  ' + m) }).catch((e) => { console.error('✗ ' + e.message); process.exit(1); });
  console.log(`preview: ${P.url}  (solo ${HOST}; Ctrl-C para salir)${P.state.error ? '\n  ✗ ' + P.state.error.split('\n')[0] : ''}`);
  const salir = async () => { await P.close(); process.exit(0); }; process.on('SIGINT', salir); process.on('SIGTERM', salir);
}
