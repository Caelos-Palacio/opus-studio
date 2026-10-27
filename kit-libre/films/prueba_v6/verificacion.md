# Verificación: prueba_v6

Resultado: **PASA** (2026-10-27T19:06:30.105Z)

Archivo: `salida/clip.mp4` (clip 0-5: no es el corte final, no se puede entregar)

## Motivos
- ninguno

## Filtro (panel.mjs filtro --codigo --entrega plan.md)
```
[OK   ] fondo        fondo oscuro/plano 0 %, profundidad n/a
[OK   ] audio        -16.9 LUFS, true peak -3.6 dBFS
[OK   ] texto        sin texto desbordado, tapado ni de bajo contraste
[OK   ] determinismo mismo md5 al renderizar dos veces
[OK   ] repeticion   no repite ≥ 2 de 5 rasgos de las 3 últimas entregas (máx. 0)
```

## Auditoría del kit
```
AUDITORIA /home/carlos/Documentos/MUltia/opus-studio-4/.claude/worktrees/v6/kit-libre/films/prueba_v6
ritmo: 3 escenas, CV de duraciones 0.35

Escena "sobre" (0-5.0 s)
  [ ok  ] ocupacion t=2.50: 46 % del cuadro (minimo 30 %)
  [ ok  ] texto     t=2.50: 2 cajas de texto dentro de su contenedor
  [ ok  ] contraste t=2.50: minimo 5.0:1 ("subtitulo")
  [ ok  ] contraste t=3.75: minimo 4.8:1 ("subtitulo")

Escena "mapa" (5-12.5 s)
  [ ok  ] ocupacion t=8.75: 100 % del cuadro (minimo 30 %)
  [ ok  ] texto     t=8.75: 3 cajas de texto dentro de su contenedor
  [ ok  ] contraste t=8.75: minimo 6.0:1 ("pie")
  [ ok  ] contraste t=10.63: minimo 5.9:1 ("pie")

Escena "mar" (12.5-24.5 s)
  [ ok  ] ocupacion t=18.50: 37 % del cuadro (minimo 30 %)
  [ ok  ] texto     t=18.50: 3 cajas de texto dentro de su contenedor
  [ ok  ] contraste t=18.50: minimo 7.3:1 ("cifra")
  [ ok  ] ocupacion t=21.50: 39 % del cuadro (minimo 30 %)
  [ ok  ] contraste t=21.50: minimo 7.5:1 ("cifra")

Detalle
  . t=2.50 (sobre) pixeles distintos del fondo 39% desv 34 detalle 9.5
  . t=3.75 (sobre) pixeles distintos del fondo 30% desv 36 detalle 10.4
  . t=0.40 (sobre) pixeles distintos del fondo 33% desv 24 detalle 8.8
  . t=4.75 (sobre) pixeles distintos del fondo 16% desv 19 detalle 8.9
  . t=8.75 (mapa) pixeles distintos del fondo 16% desv 20 detalle 9.4
  . t=10.63 (mapa) pixeles distintos del fondo 16% desv 20 detalle 9.5
  . t=5.40 (mapa) pixeles distintos del fondo 16% desv 20 detalle 9.2
  . t=12.25 (mapa) pixeles distintos del fondo 10% desv 26 detalle 9.1
  . t=18.50 (mar) pixeles distintos del fondo 15% desv 29 detalle 9.7
  . t=21.50 (mar) pixeles distintos del fondo 15% desv 29 detalle 9.9
  . t=12.90 (mar) pixeles distintos del fondo 14% desv 29 detalle 9.4

RESUMEN: 0 fallos graves, 0 avisos
recortes 4x en /home/carlos/Documentos/MUltia/opus-studio-4/.claude/worktrees/v6/kit-libre/films/prueba_v6/auditoria
```
