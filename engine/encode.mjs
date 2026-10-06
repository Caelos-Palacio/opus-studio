// Medios (spec 003): `encode:{crf,tune}` del medio (p. ej. tune grain + crf 24 para grano animado) llega por aquí; sin medio, bytes de siempre.
// R4 — argumentos de codificación x264 compartidos (render --range / cut). Por defecto = los de siempre (medium, sin -threads):
// los bytes de los fragmentos no cambian. Opt-in: OPUS_PRESET / --preset (faster ≈ −45 % de CPU a igual PSNR) y threads por worker.
// x264 con threads automáticos (≈1,5×núcleos por proceso) gasta ~2× la CPU (lookahead + frame-threads) frente a -threads 1; con un
// worker de render por núcleo (cut --workers = CPUs) los hilos extra solo compiten: threads = CPUs/workers.
import os from 'node:os';
export const PRESETS = ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower'];
export function x264Args({ crf = 16, preset = 'medium', threads = 0, tune = null } = {}) {
  if (!PRESETS.includes(preset)) throw new Error(`preset x264 "${preset}" no válido (${PRESETS.join(', ')})`);
  return ['-c:v', 'libx264', '-preset', preset, '-crf', String(crf), ...(tune && tune !== 'none' ? ['-tune', tune] : []), ...(threads > 0 ? ['-threads', String(threads)] : []), '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
}
// Hilos de x264 por worker de render: 0 = automático (un solo worker); si no, reparte los núcleos.
export const workerThreads = (workers, cpus = os.cpus().length) => (workers <= 1 ? 0 : Math.max(1, Math.floor(cpus / workers)));
