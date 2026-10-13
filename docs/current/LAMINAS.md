# Láminas estáticas: perfil de lint `lamina` (spec 020)

Una lámina (diagrama, esquema, tabla de barras) es un still que se lee a ritmo propio. El perfil `cinematic` le pide cosas de película que no tienen sentido aquí. `"profile": "lamina"` en el timeline las relaja (engine/profiles.json):

| parámetro | cinematic | lamina | porqué |
|---|---|---|---|
| `maxHold` | 6 s | 600 s | un still no es un hold muerto: no hace falta `hold_ok` |
| `readCps` | 12 | 40 | no es subtítulo: se lee mirando, no a ritmo de locución |
| `requireFocus` | sí | no | una lámina no tiene «sujeto» único; si registra foco se mide igual |
| `saliency` | sí | no | el «ojo va a otro sitio» no aplica a un diagrama |
| `maxSizes` | 3 | 5 | título, rótulo, etiqueta, cifra y leyenda conviven |

Se mantiene: zona segura, texto mínimo, texto pisando texto, texto sobre foco. Generadores: `node engine/opus.mjs new shot <id> --receta diagrama_flujo|diagrama_capas|barras_antes_despues` → `shots/<id>.diagrama.json` (≈ 20 líneas) → `node engine/diagramas.mjs build <archivo>`.
