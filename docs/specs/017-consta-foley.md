# 017 — Consta: foley de archivo y film sin música

## Intención (usuario, 2026-10-07)
Producir el film CONSTA (45 s, 16:9, kraft = expediente) con voz, humor seco y vértigo; sonido de archivo (llaves, sello, pluma, reloj), silencio donde la voz lo pide; nada de moraleja; texto escaso con voz («consta»). Usar recetas, objetos y fondos (specs 014/016); escribir código solo donde el film lo pida.

## Decisiones de dirección
- Voz: funcionario de archivo, impersonal, tic «consta». El centro es su voz y lo que el escéptico no adivinó.
- Cierre que agranda: desde el 20-V-2019 el cilindro tiene incertidumbre propia (u: 0 → 10 µg; BIPM, CCM «Note on dissemination of the kilogram after redefinition»). Antes no podía estar equivocado por decreto; ahora puede. El sello cae sin tinta.
- Giro «no consta cuál se movió» al 60 %; pico de energía en el sello de 2019 (84 %).

## Medibles
| pieza | medible |
|---|---|
| Foley | `engine/foley.mjs`: 7 voces (llave, sello, sello_seco, pluma, secante, reloj, mosca), deterministas, opt-in por tipo en `shot.sfx`; también en `sound.VOICES` y en el enum del esquema del timeline |
| Estilo `archivo` | `styles/sound/archivo.json`: bus de música a −120 dB, sin whoosh/click/giro derivados, `sfx.buzz.spans` (fluorescente por tramos) |
| Objeto DSL | `hollow` y `focus:false` (herramientas que tocan el texto a propósito: pluma, sello, mano, llave) |
| Recetas | `--objeto/--fondo` instancian el tipo genérico `objeto`/`fondo` (preset) con el catálogo de spec 014 |
| Master | TP ≤ −1 dBTP sobre el mp4; techo de estilo −3 dBTP |

## Escenarios (BDD) — `test/consta.mjs`
F1–F8 foley · R1–R2 recetas · M1 motor · C1–C9 film · S1–S3 sonido.

## Fuera de alcance
Voz sintetizada (TTS); el texto en pantalla es la voz.

## Calificaciones
| film | nota | ¿voz? | comentario |
|---|---|---|---|
| consta | (pendiente) | | |
