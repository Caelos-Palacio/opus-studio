// Worker del preview en vivo (spec 019): proceso hijo de engine/livepreview.mjs. Carga el film en modo boceto y sirve fotogramas JPEG por IPC.
// Un worker NUNCA se reutiliza tras una edición: el padre lo mata y lanza otro (módulos de shots frescos; la caché de fotogramas, por hash, sobrevive en disco).
// Protocolo: padre→hijo {id,t,s} · hijo→padre {type:'ready',info} | {type:'error',message} | {id,jpeg,hit} | {id,error}
import { bocetoSize } from './boceto.mjs';

process.env.OPUS_BOCETO = '1'; process.env.OPUS_FXFAST = '1';
const send = (m) => process.send(m);
try {
  const { default: canvasPkg } = await import('canvas'), { createCanvas, ImageData } = canvasPkg;
  const { makeRenderer } = await import('./render.mjs'), { frameCache } = await import('./framecache.mjs'), { activeShots } = await import('./film.mjs');
  const porEscala = new Map();
  const para = async (s) => {
    if (porEscala.has(s)) return porEscala.get(s);
    let film = [...porEscala.values()][0]?.film;
    if (!film) film = (await makeRenderer({ size: '64x36' })).film;
    const [W, H] = bocetoSize(film.width, film.height, s);
    const FC = frameCache({ film, size: `${W}x${H}`, grade: true, make: () => makeRenderer({ size: `${W}x${H}` }) }), v = { film, FC, W, H, cv: createCanvas(W, H) };
    porEscala.set(s, v); return v;
  };
  const first = await para(0.25), film = first.film;
  send({ type: 'ready', info: { duration: film.duration, fps: film.fps, width: film.width, height: film.height, shots: film.shots.map((s) => ({ id: s.id, t: s.t })), escalas: [0.25, 0.5], sizes: { 0.25: [first.W, first.H] } } });
  let cola = Promise.resolve();
  process.on('message', (m) => {
    cola = cola.then(async () => {
      try {
        const v = await para(m.s), t = Math.max(0, Math.min(film.duration, +m.t)), f = await v.FC.get(t, { px: true });
        v.cv.getContext('2d').putImageData(new ImageData(f.data, v.W, v.H), 0, 0);
        send({ id: m.id, jpeg: v.cv.toBuffer('image/jpeg', { quality: 0.85 }), hit: !!f.hit, shots: activeShots(film, t).map((s) => s.id), W: v.W, H: v.H });
      } catch (e) { send({ id: m.id, error: String(e.message ?? e).slice(0, 300) }); }
    });
  });
} catch (e) { send({ type: 'error', message: String(e.message ?? e).slice(0, 2000) }); setTimeout(() => process.exit(0), 50); }
