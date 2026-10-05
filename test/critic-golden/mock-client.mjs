// Cliente simulado del crítico (OPUS_CRITIC_CLIENT=test/critic-golden/mock-client.mjs). Sin red, determinista.
//   OPUS_MOCK = ship | fix | invalid | throw     (por defecto ship)
// Sirve para probar la lógica fail-closed, caché y votación sin API, y para ensayar `--eval`.
const scores = { framing: 4, hierarchy: 4, aesthetic: 4, coherence: 4, clarity: 4 };
export default async function mock(model, text) {
  const mode = process.env.OPUS_MOCK ?? 'ship', coh = text.startsWith('Tira de fotogramas');
  if (mode === 'throw') throw new Error('red caída (simulada)');
  if (mode === 'invalid') return { scores: { framing: 9 }, issues: 'no es un array' };
  const shot = /Shot (\S+)\./.exec(text)?.[1] ?? 'A1';
  const iss = mode === 'fix' ? [{ ...(coh ? { shot } : {}), t: 0.5, severity: 'FIX', problem: 'defecto simulado', fix: 'arreglo simulado' }] : [];
  return coh ? { issues: iss } : { shot, scores, issues: iss };
}
