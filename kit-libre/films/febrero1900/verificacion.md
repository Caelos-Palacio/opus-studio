# Verificación: febrero1900

Resultado: **PASA** (2026-10-28T03:18:25.652Z)

Archivo: `salida/final.mp4` (final)

## Motivos
- ninguno

## Filtro (panel.mjs filtro --codigo --entrega plan.md)
```
[OK   ] fondo        fondo oscuro/plano 0 %, profundidad n/a
[OK   ] audio        -18.7 LUFS, true peak -3 dBFS
[OK   ] texto        sin texto desbordado, tapado ni de bajo contraste
[OK   ] determinismo mismo md5 al renderizar dos veces
[OK   ] repeticion   no repite ≥ 2 de 5 rasgos de las 3 últimas entregas (máx. 1)
```

## Auditoría del kit
```
  [ ok  ] contraste t=22.20: minimo 12.4:1 ("voz-desplaza")
  [ ok  ] contraste t=23.30: minimo 12.5:1 ("voz-desplaza")

Escena "cierre" (24.4-27.6 s)
  [ ok  ] ocupacion t=26.00: 100 % del cuadro (minimo 30 %)
  [ ok  ] texto     t=26.00: 1 cajas de texto dentro de su contenedor
  [ ok  ] contraste t=26.00: minimo 12.2:1 ("voz-cierre")
  [ ok  ] contraste t=26.80: minimo 12.4:1 ("voz-cierre")

Detalle
  . t=1.90 (tecleo) pixeles distintos del fondo 77% desv 35 detalle 9.3
  . t=2.85 (tecleo) pixeles distintos del fondo 77% desv 35 detalle 9.3
  . t=0.40 (tecleo) pixeles distintos del fondo 77% desv 31 detalle 8.2
  . t=3.55 (tecleo) pixeles distintos del fondo 72% desv 29 detalle 8.1
  . t=5.05 (bisiesto) pixeles distintos del fondo 77% desv 31 detalle 8.8
  . t=5.67 (bisiesto) pixeles distintos del fondo 76% desv 30 detalle 8.9
  . t=4.20 (bisiesto) pixeles distintos del fondo 75% desv 28 detalle 8.1
  . t=6.05 (bisiesto) pixeles distintos del fondo 70% desv 36 detalle 11.7
  . t=9.55 (baja) pixeles distintos del fondo 69% desv 38 detalle 13.7
  . t=11.18 (baja) pixeles distintos del fondo 71% desv 40 detalle 13.9
  . t=6.70 (baja) pixeles distintos del fondo 71% desv 38 detalle 13.4
  . t=12.55 (baja) pixeles distintos del fondo 69% desv 40 detalle 13.8
  . t=14.90 (respiro) pixeles distintos del fondo 71% desv 41 detalle 14.0
  . t=15.95 (respiro) pixeles distintos del fondo 70% desv 40 detalle 13.8
  . t=13.20 (respiro) pixeles distintos del fondo 67% desv 38 detalle 13.5
  . t=16.75 (respiro) pixeles distintos del fondo 41% desv 65 detalle 12.7
  . t=18.50 (lotus) pixeles distintos del fondo 37% desv 51 detalle 13.2
  . t=19.25 (lotus) pixeles distintos del fondo 37% desv 51 detalle 13.2
  . t=17.40 (lotus) pixeles distintos del fondo 32% desv 39 detalle 12.6
  . t=19.75 (lotus) pixeles distintos del fondo 69% desv 79 detalle 13.5
  . t=22.20 (desplaza) pixeles distintos del fondo 71% desv 39 detalle 13.4
  . t=23.30 (desplaza) pixeles distintos del fondo 71% desv 37 detalle 12.8
  . t=20.40 (desplaza) pixeles distintos del fondo 69% desv 39 detalle 13.8
  . t=24.15 (desplaza) pixeles distintos del fondo 66% desv 39 detalle 13.4
  . t=26.00 (cierre) pixeles distintos del fondo 70% desv 48 detalle 14.0
  . t=26.80 (cierre) pixeles distintos del fondo 71% desv 48 detalle 14.2
  . t=24.80 (cierre) pixeles distintos del fondo 66% desv 39 detalle 13.7

RESUMEN: 0 fallos graves, 0 avisos
recortes 4x en kit-libre/films/febrero1900/auditoria
```
