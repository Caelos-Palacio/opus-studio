# 022: Estudio v6, autónomo, con dirección propia y storyboard opcional

## Intención (usuario, 2026-10-12)
- «No te puedes aferrar a mi gusto. Aunque sea human in the loop, eso hace que el sistema sea poco autónomo.»
- «Debería tener la opción de que el agente presente al usuario el storyboard, y que este dé su opinión o cambie lo que
  guste.»

Antecedentes (experimento Botella, 2026-10-11/12):
- El film hecho con el motor completo costó ≈ 494 000 tokens y quedó con aspecto de clip-art.
- Un Sonnet libre con `frame(ctx, t)` lo hizo en 178 000 tokens en 20 min, y el usuario lo calificó de «genial».
- Haiku con brief y kit: barato y correcto, pero sin ambición visual.

Ver `docs/current/MODO-LIBRE.md`, `kit-libre/` y `docs/research/12`.

## Principios
1. **Autónomo por defecto.** Un film llega de la idea al mp4 sin intervención humana. La nota del usuario es opcional:
   cuando llega, se usa para calibrar, pero nunca es un requisito para entregar.
2. **El gusto vive en el sistema, no en una persona.** Un perfil de gusto versionado (`data/gusto.md`, derivado de
   `data/notas.json` y de las lecciones de las specs) y un panel de críticos lo aplican. El perfil se enriquece con
   las referencias que el sistema estudia (Anatomy, piezas premiadas) y con sus propios A/B, además de con las notas
   humanas.
3. **Dirección antes que motor.** Ideación, guion v2, hechos con fuente y escéptico ciego se mantienen y mandan.
4. **Producción libre.** Un Sonnet escribe `frame(ctx, t)` con el brief MODO-LIBRE y `kit-libre`. Lo antiguo (DSL, recetas,
   presets, toolbox y gobernanza pesada) se congela: sigue en el repo y no recibe funciones nuevas. Si una película
   necesita algo de ahí, se extrae al kit.
5. **Se controla el resultado, no el proceso.** Determinismo, auditoría de píxeles, audio medido y panel de críticos.

## Flujo
idea → hechos con fuente → guion v2 + escéptico ciego → **storyboard** → producción libre → auditoría → panel →
entrega (+ nota humana opcional).

### Storyboard (punto de control)
El agente produce:
- `storyboard.html`: un still por beat a resolución completa, con su tiempo, el texto en pantalla, la paleta, el
  movimiento previsto, la transición y el sonido;
- `plan.md`, como fuente editable.

Modos (campo `revision` del encargo):
- `autonomo` (por defecto): el panel juzga el storyboard. Si el resultado es SHIP sigue; si no, el agente corrige
  (como máximo 2 rondas).
- `consultar`: se presenta el storyboard al usuario, como página publicada o archivo, y el agente espera su opinión.
  - El usuario puede aprobar, comentar o CAMBIAR lo que quiera: beats, textos, colores, duraciones, orden, medio.
  - El agente aplica los cambios en `plan.md`, regenera los stills afectados y solo después produce.
  - Si el usuario no contesta, el film queda en pausa (no se pierde nada). Con `consultar:{espera:"N h"}` se reanuda
    solo, en modo autónomo, pasado ese tiempo.
- `consultar_final`: igual que el anterior, pero además presenta el corte final antes de darlo por entregado.

### Panel de críticos (juez autónomo)
- Tres miradas independientes, cada una con la hoja de contacto, stills, recortes a 4× y el informe de auditoría:
  - **director**: historia, voz, ritmo;
  - **ojo**: composición, materia, color, tipografía;
  - **escéptico**: ¿es genérico? ¿parece clip-art o una presentación corporativa?
- Cada una puntúa la rúbrica del perfil de gusto de 0 a 10 y da 3 arreglos concretos.
- Un SHIP exige una media ≥ 8 y ninguna mirada < 6. Si no, el agente aplica los arreglos (como máximo 2 rondas) y entrega
  con el informe del panel.
- Modelos: Sonnet con visión para las miradas. Haiku solo para leer y resumir las auditorías.

## Enmienda F1 (2026-10): el juez baja a filtro + A/B
Se **abandona la meta ρ ≥ 0,7** (fila «calibración del panel» y G4 de abajo). Motivo: la calibración falló en dos lotes
(lote 1 ρ = 0,338; lote 2 ≈ 0,27 con el director) y con 4 notas humanas no es realista. El juez queda como
`panel.mjs filtro` (mínimos medidos, sin LLM: fondo oscuro/plano sin profundidad, audio, texto, determinismo, veto de
repetición con `--entrega`) y `panel.mjs ab` (lámina para elegir en 10 s). El panel de 3 críticos se conserva como
herramienta opcional (`docs/current/PANEL.md`); «panel ≥ 8» deja de ser criterio de entrega. Ver `docs/research/13-estado-gusto-v6.md`.

## Medibles
| pieza | medible |
|---|---|
| autonomía | un encargo con `revision:"autonomo"` termina en mp4 + informe sin ninguna pregunta al usuario |
| storyboard | `consultar` produce `storyboard.html` y espera. Un cambio del usuario en `plan.md` se refleja en los stills y en el corte |
| calibración del panel | sobre los films con nota humana conocida, el panel los ordena igual que las notas: Spearman ≥ 0,7. Casos: mate_papel 9,5 > potencias v1 «monótona»; Botella libre v1 «genial» > Botella motor; Potencias v2 > v3 técnico |
| coste | film de ≈ 50 s: ≤ 200 000 tokens del agente productor y ≤ 45 min |
| calidad | panel ≥ 8. Si hay nota humana, ≥ 8 y «¿tuvo voz?» = sí en ≥ 2 de 3 films |
| perfil de gusto | `data/gusto.md` regenerable desde `notas.json` + lecciones; cada regla cita su origen (nota, spec o referencia) |

## Escenarios (BDD)
- G1. Dado un concepto nuevo y `autonomo`, el sistema entrega mp4, hoja e informe del panel sin intervención.
- G2. Dado `consultar`, el agente publica el storyboard y se detiene. Si el usuario cambia el texto del beat 3 y la paleta
  del giro, el corte final usa ese texto y esa paleta.
- G3. Dado un storyboard que el panel puntúa < 8, el agente lo corrige antes de renderizar el film entero.
- G4. Calibración: el panel reproduce el orden de las notas humanas existentes (Spearman ≥ 0,7). Si no lo hace, el perfil
  de gusto se revisa antes de usar el panel como juez.
- G5. Una nota humana nueva actualiza `data/gusto.md` (regla con origen) y el panel siguiente la aplica.

## Fuera de alcance
Interfaz de edición visual de arrastrar y soltar (se cambia el plan con palabras o editando `plan.md`). La nota humana
obligatoria se elimina como requisito.
