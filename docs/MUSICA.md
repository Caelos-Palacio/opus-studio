# Música por código (proceso reutilizable)

La música no se elige: se **deriva de la estructura del film**. PoC: `engine/score.mjs` (Node puro, determinista, 48 kHz estéreo).

```
node engine/score.mjs --timeline data/stress/potencias.json --video out/potencias.mp4 --out out/potencias_musica.mp4 [--sfx-db -17] [--lufs -14] [--curve]
```

## Pasos
1. **Leer la estructura.** `timeline.shots` (cortes, textos), `shot.sfx` (impacto, rev), curva de energía (`docs/research/06-estres.md`:
   calma, pico, hold, revelación) y, si existe, la memoria conceptual (qué idea vuelve). El script saca de aquí: `HIT` (sfx `impact`,
   ≈ pico visual), `HOLD` (silencio = HIT+0,65 … +3,65), `REV0` (primer shot tras el hold), `REV` (sfx `rev`), `RET` (último shot).
2. **Mapa de secciones.** intro (calma) → exposición → construcción → clímax (HIT) → silencio → resolución/revelación → descenso → regreso/cola.
   Cada sección tiene una intensidad `I(t)` 0–1 (curva lineal por tramos, crescendo con potencia 1,7 en los ~21 s previos al golpe).
3. **Tempo y compás.** El tempo es una función `bpm(t)` (54 → 76 → 132) y la rejilla de pulsos se genera **hacia atrás desde el
   golpe**, de modo que un pulso (compás 1) cae exactamente en HIT. Tras el hold, 60 bpm fijos desde REV0.
4. **Armonía.** Ciclo Dm – Bb – Gm – A (el último compás antes del golpe es la dominante) y el golpe cae en Bb sobre pedal de re
   (bVI: grande pero no resuelve). La tensión se resuelve **en la revelación**: re mayor ancho (3.ª mayor, novena), luego D–Bm–G.
5. **Instrumentación por intensidad.** Entran capas con `I`: drone → pad → bajo → pulsos sueltos (≈16 s) → arpegio 8.º (MID) →
   bombo (HIT−22) → arpegio 16.º, hi-hat, toms (HIT−12) → redoble acelerado y riser de ruido (HIT−4,5 / −9). Brillo del pad = f(I).
   Una micro-pausa de 0,12 s antes del golpe aumenta el contraste.
6. **Motivo (7 notas, re menor).** Intro lento y solo; reaparece en diminución con octavas y subiendo (+0, +3, +7 semitonos) hacia
   el clímax; cabeza aumentada en el golpe; en la revelación en **mayor y ascendente**; al regreso original que acaba en re mayor.
7. **Síntesis.** Aditiva/sustractiva propia: sierras desafinadas + paso bajo (pad), sinusoides (bajo), pluck por parciales,
   FM suave (campana/lead), ruido filtrado (percusión, riser), reverb Schroeder. Ruido sembrado: salida idéntica en cada ejecución.
8. **Silencio.** Compuerta dura en HOLD (cola del golpe apagada en 0,5 s); una respiración muy suave vuelve 0,4 s antes de REV0.
9. **Mezcla.** El audio original del vídeo (sfx masterizados planos a −14 LUFS, que ahogan cualquier arco) baja `--sfx-db` (−17 dB) y
   actúa como capa de acentos; la música se comprime por sidechain con esos sfx (ducking suave, 2,5:1); ganancia a −14 LUFS
   integrado (bucle de medición) y limitador de picos a −1 dBFS. El vídeo se copia (`-c:v copy`); solo cambia el audio.
10. **Verificar** (ebur128): integrado ≈ −14 LUFS; LRA ≥ 6 LU; instante del máximo de loudness de 3 s frente al pico visual (±0,5 s);
    crescendo monótono previo; silencio en HOLD (< −60 dBFS en la música). `--curve` imprime el short-term por segundo.
    Nota: ffmpeg etiqueta la ventana por su **final**; la spec debería fijar si "±0,5 s" se mide por final o por centro.

## Para otro film
Cambiar solo el timeline (tiempos del impacto/hold/revelación se leen de `shot.sfx`), la tonalidad/ciclo (`CH`, `CYC`), el motivo
(`MOTIF`) y la intensidad (`I`). Lo demás (rejilla hacia atrás, capas, mezcla, medición) es el motor.
