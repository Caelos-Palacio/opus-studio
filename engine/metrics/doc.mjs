// Genera docs/METRICAS.md desde el registro (única fuente de verdad).
import { REGISTRY, CONVENTIONS, SCHEMA } from './registry.mjs';
import { UNITS, dimOf } from './units.mjs';
export function renderDoc() {
  const L = ['# Métricas con sentido y estandarizables', '', '> GENERADO por `npm run metrics -- doc` desde `engine/metrics/registry.mjs`. No editar a mano.', '',
    `Esquema de salida: \`${SCHEMA}\` (\`out/metrics/<film>.json\`): \`{ schema, film, params, metrics:[{id, name, domain, value, unit, ci, ciLevel, method, confidence, n, notes?, sensitivity?}], series }\`.`, '',
    '**Principio (spec 005).** Cada magnitud tiene unidad reconocible por un director/músico/diseñador, definición formal, estimador, incertidumbre, invariancias y norma. Los píxeles son un método interno (solo `color.cutDeltaE`), nunca la métrica.', '',
    '## Convenciones declaradas (todo lo convencional es explícito y se informa su sensibilidad)', '', '| clave | valor | significado |', '|---|---|---|', ...Object.entries(CONVENTIONS).map(([k, v]) => `| ${k} | ${v.value} | ${v.doc} |`), '',
    '## Confianza', '', '`confianza = base(cls) · min(1, n/n_min) · (1 − min(½, semianchura(IC)/|valor|))`, con base: analítico 0,95 · semántico 0,85 · convención 0,70 · estimado 0,60. Valor `null` ⇒ confianza 0 y `notes` explica la falta de datos.', '',
    '## Invariancias (verificadas en `test/metrics.mjs`)', '', '- Resolución de render y de film: las magnitudes son razones de longitudes (anchos/alturas de pantalla, fracciones de encuadre) ⇒ invariantes.', '- fps del film: los tiempos son segundos; la cuantización ±1/(2·fps) entra en el IC. Muestreo de cajas: se estima el error con Richardson (|v_h − v_2h|/3).', '- Duración: tasas por minuto, tiempo normalizado τ = t/D para curvas, proporciones.', '',
    '## Unidades y análisis dimensional', '', '| símbolo | dimensión | nombre |', '|---|---|---|', ...Object.entries(UNITS).map(([k, u]) => `| ${k} | ${dimOf(k)} | ${u.label} |`), '',
    'Dimensiones base: T tiempo · A ángulo · L longitud · S log₂ de razón de longitudes (stop) · D log₁₀ de razón (década) · C diferencia de color · dB nivel relativo · B pulsos · W palabras · Ch caracteres · N elementos · K conceptos. Una razón de longitudes es adimensional; S y D se rastrean aparte para no confundir una velocidad de zoom con un ritmo.', ''];
  for (const dom of [...new Set(REGISTRY.map((m) => m.domain))]) {
    L.push(`## ${dom}`, '');
    for (const m of REGISTRY.filter((x) => x.domain === dom)) {
      L.push(`### \`${m.id}\` — ${m.name}`, '', `- **Unidad**: ${m.unit} · **dimensión**: ${m.dim} · **clase**: ${m.cls} · **tipo**: ${m.kind}`, `- **Fuente**: ${m.source}`, `- **Definición formal**: ${m.formula}`, `- **Estimador**: ${m.estimator}`, `- **Incertidumbre**: ${m.uncertainty}`, `- **Invariancia / normalización**: ${m.invariance}`, `- **Norma / referencia**: ${m.norm}`,
        `- **Rango típico (indicativo)**: ${m.typical ? Object.entries(m.typical).map(([g, r]) => `${g}: ${r[0]}–${r[1]} ${m.unit}`).join('; ') + ' (orientativo: contrastar con la fuente; sin calibrar con corpus propio)' : 'sin rango por género establecido'}`, '');
    }
  }
  L.push('## Series temporales (tensión, tempo, movimiento, sonoridad, cámara)', '', 'Cada serie se entrega como `v(τ)` en [0,1], τ = (i+½)/100, tras min-max: la **forma** es comparable entre films, la amplitud absoluta no (está en las métricas con unidades). `tension` = media de las transformadas integrales de probabilidad (PIT) de sus componentes disponibles (densidad de cortes σ=2 s, actividad de cámara, velocidad en pantalla, sonoridad momentánea, preguntas abiertas de la memoria), suavizada 1,5 s. Es un **índice compuesto propio, no una norma**; su robustez se acota con leave-one-out. Descriptores: momentos (centroide, dispersión, asimetría), posición y prominencia del pico, nº de picos, entropía normalizada, periodicidad (ACF), ajuste a Freytag, fases. Distancia entre films: L2 (RMS sobre τ) y DTW con banda ±10 % (Sakoe & Chiba 1978), más ρ de Spearman.', '', '## Parámetros de shot', '', '`npm run metrics -- units [film]` lista cada parámetro promovido (F4) con su `unit` y la conversión a magnitud con sentido: `vh` → alto visible (y escala de plano si es un tamaño), `w`/`px` → anchos de pantalla, `s` → s y fotogramas, `safe` → alto visible, `×` → factor.', '');
  return L.join('\n');
}
